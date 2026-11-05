import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeCscriptResult,analyzeCoreTaskXml,authorizeDiagnostic,runReadOnlyDiagnostic,
  sanitizeDiagnosticResult,commentDiagnostic,readSafeResult}
from './r17-b-probe-diagnostic.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REQUEST_ID='pc-r17-probe-12345678-1234-4234-8234-123456789abc';
const CHAT_ID='chat-12345678-1234-4234-8234-123456789abc';
const SHA='a'.repeat(40);
const BODY={schema:'ZGMINI_R17_B_PROBE_DIAG_REQUEST_V1',
  requestId:REQUEST_ID,chatId:CHAT_ID,
  operation:'r17-probe-diagnostic-readonly-once',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  expectedProbeSha256:'7050dc256e8165827e5a4296dc3d3e2d18408c94508bdf8b51975f5499c95a13',
  expectedFixtureSha256:'22261ee72d757c9372ed9e0b806e27e4ad65ad9c1d5e274fa82f8e914755fa1d'};
const env=()=>({GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_RUN_ID:'41921386128',RUNNER_NAME:'zgmini-pc-01',
  GITHUB_SHA:SHA,R17_CONTROL_SHA:SHA,GITHUB_TOKEN:'t'.repeat(45)});
const event=()=>({action:'opened',
  repository:{private:true,full_name:'ansqhd5774-Choi/zgmini-pc-control'},
  sender:{login:'ansqhd5774-Choi'},
  issue:{number:388,title:'pc-r17-writer-probe-diagnostic',
    user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-r17-writer-b-probe-diag'}],
    body:JSON.stringify(BODY)}});
const normal='{"ok":true,"enabled":true,"state":3,"instances":0,"relatedProcesses":0,"unknownProcessLines":0}\r\n';
const result=(stdout,status=0,stderr='')=>({status,stdout:Buffer.from(stdout),stderr:Buffer.from(stderr)});
const taskXml='<Task><Settings><Enabled>true</Enabled><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy></Settings></Task>';
const gitStage={status:'STOP',lastPass:'READ_TREE',firstFail:'APPLY_CHECK',
  reason:'COMMAND_FAILED',exitCode:1,sourceWrites:0,taskWrites:0,
  configWrites:0,installReruns:0};

test('owner-only private A issue exactly gated, fixed probe digest',()=>{
  assert.equal(authorizeDiagnostic(event(),env()).requestId,REQUEST_ID);
  const altered=event();altered.issue.body=JSON.stringify({...BODY,
    expectedProbeSha256:'b'.repeat(64)});
  assert.throws(()=>authorizeDiagnostic(altered,env()),/R17_B_DIAG_EVENT_STOP/);
  const retry=env();retry.GITHUB_RUN_ATTEMPT='2';
  assert.throws(()=>authorizeDiagnostic(event(),retry),/R17_B_DIAG_EVENT_STOP/);
  const outsider=event();outsider.issue.user.login='external';
  assert.throws(()=>authorizeDiagnostic(outsider,env()),/R17_B_DIAG_EVENT_STOP/);
  const invalid=event();invalid.issue.labels=[];
  assert.throws(()=>authorizeDiagnostic(invalid,env()),/R17_B_DIAG_EVENT_STOP/);
});

test('fixture UTF8 + probe JSON parse succeeds with no banner or raw echo',()=>{
  const fixture=analyzeCscriptResult(result('R17_B_WSH_OK\r\n'),'fixture');
  const probe=analyzeCscriptResult(result(normal),'probe');
  assert.equal(fixture.shape,'FIXTURE_MAGIC_MATCH');
  assert.equal(probe.shape,'EXPECTED_SUCCESS');
  assert.equal(probe.execState,'EXIT_ZERO');
  assert.equal(probe.encodingHint,'UTF8_OR_ANSI');
  assert.equal(probe.bannerObserved,false);
  assert.equal(probe.noLogoArgSent,true);
  assert.equal(JSON.stringify(probe).includes('"enabled"'),false);
});

test('UTF16LE NUL, BOM and stray NoLogo banner detected without stdout leakage',()=>{
  const utf16=analyzeCscriptResult({status:0,
    stdout:Buffer.from('R17_B_WSH_OK\r\n','utf16le'),stderr:Buffer.alloc(0)},'fixture');
  assert.equal(utf16.encodingHint,'UTF16LE_LIKELY');
  assert.equal(utf16.shape,'FIXTURE_UTF16_MATCH');
  assert.ok(utf16.nulBytes>0);
  const noisy=analyzeCscriptResult(result('Microsoft (R) Windows Script Host\r\n'+normal),'probe');
  assert.equal(noisy.bannerObserved,true);
  assert.equal(noisy.shape,'JSON_EXTRA_TEXT');
  assert.equal(noisy.noLogoArgSent,true);
  assert.doesNotMatch(JSON.stringify(noisy),/Windows Script Host/);
});

test('nonzero code and WSH error probe structure remain classified, never PASS',()=>{
  const bad=analyzeCscriptResult(result('{"ok":false,"code":"R17_B_WINDOWS_PROBE_STOP"}',2,
    'UNSAFE-WMI-COMMAND-LINE'),'probe');
  assert.equal(bad.execState,'EXIT_NONZERO');
  assert.equal(bad.exitCode,2);
  assert.equal(bad.shape,'EXPECTED_PROBE_STOP');
  assert.equal(bad.stderrBytes,'UNSAFE-WMI-COMMAND-LINE'.length);
  assert.doesNotMatch(JSON.stringify(bad),/UNSAFE-WMI/);
});

test('Core Task XML read-only output contains only count, shape and digest comparison',()=>{
  const valid=analyzeCoreTaskXml(result(taskXml));
  assert.equal(valid.shape,'EXPECTED_SETTINGS_ENABLED');
  assert.equal(valid.settingsCount,1);
  assert.equal(valid.enabledCount,1);
  assert.equal(valid.digestMatched,false); // Fixture cannot impersonate pinned PC Task XML.
  assert.doesNotMatch(JSON.stringify(valid),/MultipleInstancesPolicy|<Task>|<Settings>/);
  const missing=analyzeCoreTaskXml(result('<Task><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy></Settings></Task>'));
  assert.equal(missing.shape,'ENABLED_ABSENT');
  assert.equal(missing.enabledCount,0);
  const duplicated=analyzeCoreTaskXml(result('<Task><Settings><Enabled>true</Enabled><Enabled>false</Enabled></Settings></Task>'));
  assert.equal(duplicated.shape,'ENABLED_DUPLICATE');
  assert.equal(analyzeCoreTaskXml(result('<Task/>')).shape,'SETTINGS_COUNT_INVALID');
  const failed=analyzeCoreTaskXml(result('PRIVATE-ERROR',1,'PRIVATE-ERROR'));
  assert.equal(failed.shape,'QUERY_FAILED');
  assert.doesNotMatch(JSON.stringify(failed),/PRIVATE-ERROR/);
});

test('mock executes exactly fixture + original probe via fixed single argv lane',()=>{
  const called=[];
  const raw=runReadOnlyDiagnostic({event:event(),env:env(),scriptRoot:ROOT,
    runTaskXml:()=>result(taskXml),
    runGitStage:()=>gitStage,
    runCscript:(exe,script)=>{
      called.push({exe,script});
      return script.endsWith('echo-fixture.js')?
        result('R17_B_WSH_OK\r\n'):result(normal);
    }});
  assert.equal(called.length,2);
  assert.match(called[0].script,/r17-b-echo-fixture\.js$/);
  assert.match(called[1].script,/r17-b-windows-probe\.js$/);
  assert.equal(raw.status,'DIAGNOSTIC_COMPLETE');
  assert.equal(raw.fixture.shape,'FIXTURE_MAGIC_MATCH');
  assert.equal(raw.probe.shape,'EXPECTED_SUCCESS');
  assert.equal(raw.taskXml.shape,'EXPECTED_SETTINGS_ENABLED');
  assert.equal(raw.gitStage.firstFail,'APPLY_CHECK');
  assert.equal(raw.installReruns,0);
  assert.equal(raw.sourceWrites,0);
  assert.equal(raw.taskWrites,0);
  assert.equal(raw.configWrites,0);
  const safe=sanitizeDiagnosticResult(raw,REQUEST_ID,env().GITHUB_RUN_ID);
  assert.equal(safe.status,'DIAGNOSTIC_COMPLETE');
  assert.equal(safe.taskXml.enabledCount,1);
  assert.equal(safe.gitStage.lastPass,'READ_TREE');
  assert.throws(()=>runReadOnlyDiagnostic({event:event(),env:env(),
    scriptRoot:'/nonexistent',runCscript:()=>result(normal)}));
});

test('comment only once, never posts raw bytes or secrets and no other method',async()=>{
  const valid=runReadOnlyDiagnostic({event:event(),env:env(),scriptRoot:ROOT,
    runTaskXml:()=>result(taskXml),
    runGitStage:()=>gitStage,
    runCscript:(_exe,script)=>script.endsWith('echo-fixture.js')?
      result('R17_B_WSH_OK\r\n'):result(normal)});
  let postBody,postCount=0;
  const out=await commentDiagnostic({event:event(),env:env(),
    readResult:()=>JSON.stringify({...valid,rawStdout:'very-secret'}),
    apiFetch:async(_url,options)=>{
      assert.equal(options.method,'POST');postCount++;
      postBody=JSON.parse(options.body).body;
      return {status:201};
    }});
  assert.equal(out.status,'STATE_UNKNOWN');
  assert.equal(postCount,1);
  assert.match(postBody,/NO_AUTO_B_RETRY/);
  assert.doesNotMatch(postBody,/very-secret/);
  assert.doesNotMatch(postBody,/tttttttttt/);
});

test('missing result strictly unknown; invalid extra shape cannot be promoted',()=>{
  assert.equal(readSafeResult('/no/such/file.json'),'{}');
  const status=sanitizeDiagnosticResult({schema:'ZGMINI_R17_B_PROBE_DIAG_RESULT_V1',
    requestId:REQUEST_ID,status:'DIAGNOSTIC_COMPLETE',fixture:{status:0}},
  REQUEST_ID,env().GITHUB_RUN_ID);
  assert.equal(status.status,'STATE_UNKNOWN');
});

test('Git stage evidence is enum-only and rejects unsafe command output or inconsistent PASS',()=>{
  const baseline=runReadOnlyDiagnostic({event:event(),env:env(),scriptRoot:ROOT,
    runTaskXml:()=>result(taskXml),runGitStage:()=>gitStage,
    runCscript:(_exe,script)=>script.endsWith('echo-fixture.js')?
      result('R17_B_WSH_OK\r\n'):result(normal)});
  assert.equal(sanitizeDiagnosticResult(baseline,REQUEST_ID,env().GITHUB_RUN_ID)
    .gitStage.firstFail,'APPLY_CHECK');
  assert.equal(sanitizeDiagnosticResult({...baseline,gitStage:{...gitStage,
    stdout:'CREDENTIALS'}},REQUEST_ID,env().GITHUB_RUN_ID).status,'STATE_UNKNOWN');
  assert.equal(sanitizeDiagnosticResult({...baseline,gitStage:{...gitStage,
    status:'PASS'}},REQUEST_ID,env().GITHUB_RUN_ID).status,'STATE_UNKNOWN');
});
