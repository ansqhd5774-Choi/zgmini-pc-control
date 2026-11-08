import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {verifyProofIssue,loadProofApproval,proveWithoutInstall,
  proveReadOnlyCliEntrypoint,PROOF_SCHEMA,PROOF_CLI_SCHEMA}
  from './proof-only.mjs';
import {sanitizeProofReport,uploadProofReport}
  from './proof-only-report.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const sourceSha='0c97599431882245a156470bd51290e327e7ee78';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const requestId='abeb79fe-03b3-4f7c-9df3-f521bff31c50';
const env={GITHUB_REPOSITORY:repo,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'1234',
  GITHUB_TOKEN:'t'.repeat(30)};
const manifest={schema:'ZGMINI_CONFIGURED_RUNTIME_B_APPROVAL_V1',
  status:'APPROVED_B',scope:'PC_WRITER_CONFIGURED_THEME_REPEAT_UPGRADE_ONLY',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha,
  profileId:'configured-themes',
  runnerPath:'scripts/pc-writer/theme-config-package-runner.mjs',
  packageManifestSha256:'b'.repeat(64),
  runtimeMode:'REPEATABLE_ACTIVE_RUNTIME',
  runtimePreimage:{activeRuntimeSha256:'c'.repeat(64),
    taskXmlSha256:'d'.repeat(64),scheduledCmdSha256:'e'.repeat(64),
    scheduledVbsSha256:'f'.repeat(64)},
  effects:{providerCalls:false,dbWrites:false,d1Writes:false,
    taskDefinitionChanges:false,newTasks:false,otherOperationalFiles:false}};
const raw=Buffer.from(JSON.stringify(manifest)+'\n');
function fixture(){
  const request={schema:'ZGMINI_CONFIGURED_RUNTIME_PROOF_REQUEST_V1',
    requestId,chatId:'bc5fe67b-c68d-4b62-9448-6b15a05e9241',
    operation:'pc-configured-runtime-proof',controlRepository:repo,
    approvalManifestSha256:sha(raw)};
  const event={repository:{full_name:repo,private:true},
    sender:{login:'ansqhd5774-Choi'},issue:{user:{login:'ansqhd5774-Choi'},
      title:'pc-configured-runtime-proof',number:837,
      labels:[],body:JSON.stringify(request)}};
  const auth=loadProofApproval({event,env,root:'/fixed-control',
    head:()=>env.GITHUB_SHA,blob:(_,p)=>{
      assert.equal(p,`approvals/approved-runtime-b/${sha(raw)}.json`);
      return raw;},read:()=>raw});
  return {event,request,auth};
}

test('proof-only owner Issue and committed approval pins reject injection',()=>{
  const f=fixture();
  assert.deepEqual(verifyProofIssue(f.event,env),f.request);
  assert.equal(f.auth.manifest.sourceSha,sourceSha);
  for(const change of [
    e=>{e.issue.title='pc-approved-runtime-b';},
    e=>{e.sender.login='other';},
    e=>{e.repository.private=false;},
    e=>{e.issue.body=JSON.stringify({...f.request,command:'cmd /c evil'});},
    e=>{e.issue.title='pc-configured-runtime-other';},
  ]){
    const e=structuredClone(f.event);change(e);
    assert.throws(()=>verifyProofIssue(e,env),/PROOF_/);
  }
  assert.throws(()=>loadProofApproval({event:f.event,env,
    root:'/fixed-control',head:()=>env.GITHUB_SHA,
    blob:()=>Buffer.from('tampered'),read:()=>raw}),
  /PROOF_APPROVAL_ORIGIN_DRIFT/);
});

function canonicalTranscript(auth){
  const simulation=direction=>({direction,mockFetchCalls:4,d1Writes:0,
    cycleCheckpointSha256:'8'.repeat(64),sameWindowDedup:true,revisions:2,
    casRejected:true,tamperRejected:true,sameDayBudgetRetained:true});
  return {schema:'ZGMINI_CONFIGURED_OLD_NEW_WINDOWS_PROOF_V1',
    sourceSha,oldSourceSha:'a'.repeat(40),oldVersion:'f'.repeat(16),
    taskXmlSha256:auth.manifest.runtimePreimage.taskXmlSha256,
    metrics:{externalNetworkCalls:0,d1Writes:0,
      simulations:[simulation('OLD_TO_NEW'),simulation('NEW_TO_OLD')],
      mockFetchCalls:8,sharedLeaseCollisionRejected:true,
      oneShotReplayRejected:true}};
}
function validProof(auth){
  const transcript=canonicalTranscript(auth);
  return {schema:PROOF_SCHEMA,status:'PROOF_PASS',requestId,
    sourceSha,approvalSha256:auth.approvalSha256,
    manifestSha256:auth.manifest.packageManifestSha256,
    activeRuntimeSha256:auth.manifest.runtimePreimage.activeRuntimeSha256,
    taskXmlSha256:auth.manifest.runtimePreimage.taskXmlSha256,
    evidenceSha256:sha(JSON.stringify(transcript)),transcript,operationWrites:0};
}
function modernProof(auth){
  const original=validProof(auth);
  return {...original,schema:PROOF_CLI_SCHEMA,
    cliEntrypointProof:{status:'PASS',childExitCode:0,
      testSha256:sha(fs.readFileSync(new URL('./approval-cycle.test.mjs',
        import.meta.url))),fixtureRoot:'RUNNER_TEMP',operationWrites:0}};
}

test('read-only Windows transcript is independently checked and bounded',()=>{
  const f=fixture();
  const good=sanitizeProofReport(validProof(f.auth),f.auth,env);
  assert.equal(good.status,'PROOF_PASS');
  assert.equal(good.transcript.metrics.simulations.length,2);
  assert.equal(good.runId,'1234');
  assert.equal(sanitizeProofReport({...validProof(f.auth),
    transcript:{...validProof(f.auth).transcript,apiKey:'LEAK'}},
  f.auth,env).status,'PROOF_UNVERIFIED');
  assert.equal(sanitizeProofReport({...validProof(f.auth),operationWrites:1},
    f.auth,env).status,'PROOF_UNVERIFIED');
});

test('V2 requires pinned real CLI entrypoint proof; historical V1 stays valid',()=>{
  const f=fixture();
  const old=sanitizeProofReport(validProof(f.auth),f.auth,env);
  assert.equal(old.code,'PROOF_WINDOWS_BILATERAL_PASS');
  assert.equal(old.cliEntrypointProof,'LEGACY_NOT_TESTED');
  const newer=sanitizeProofReport(modernProof(f.auth),f.auth,env);
  assert.equal(newer.status,'PROOF_PASS');
  assert.equal(newer.code,'PROOF_WINDOWS_BILATERAL_CLI_PASS');
  assert.equal(newer.cliEntrypointProof,'WINDOWS_CLI_ENTRY_PASS');
  assert.equal(newer.cliNodeExitCode,0);
  const missing=modernProof(f.auth);delete missing.cliEntrypointProof;
  assert.equal(sanitizeProofReport(missing,f.auth,env).status,'PROOF_UNVERIFIED');
  for(const modified of [
    {childExitCode:13},{testSha256:'0'.repeat(64)},
    {fixtureRoot:'OPERATING_ROOT'},{operationWrites:1},{extra:'spoof'}]){
    const invalid=modernProof(f.auth);
    invalid.cliEntrypointProof={...invalid.cliEntrypointProof,...modified};
    assert.equal(sanitizeProofReport(invalid,f.auth,env).status,
      'PROOF_UNVERIFIED');
  }
});

test('pinned CLI child test runs only under temp without workflow secrets',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-proof-cycle-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const passed=proveReadOnlyCliEntrypoint({env:{
    RUNNER_TEMP:temp,GITHUB_TOKEN:'PRIVATE_TOKEN_NOT_FOR_CHILD'},
    platform:'win32'});
  assert.equal(passed.status,'PASS');
  assert.equal(passed.childExitCode,0);
  assert.equal(passed.operationWrites,0);
  assert.equal(passed.fixtureRoot,'RUNNER_TEMP');
  assert.match(passed.testSha256,/^[a-f0-9]{64}$/);
  assert.throws(()=>proveReadOnlyCliEntrypoint({
    env:{RUNNER_TEMP:temp},platform:'win32',
    runNode:(_node,args,opts)=>{
      assert.equal(args[0],'--test');
      assert.ok(args[1].endsWith('approval-cycle.test.mjs'));
      assert.equal(opts.env.CYCLE_TEST_TEMP_BASE,temp);
      assert.equal(opts.env.GITHUB_TOKEN,undefined);
      return {status:13,signal:null};},
  }),err=>err.code==='PROOF_CLI_UNSETTLED_AWAIT_STOP'&&
    err.nodeExitCode===13);
});

test('V2 BLOCKED preserves bounded CLI Node exit for reporter',()=>{
  const f=fixture();
  const raw={schema:PROOF_CLI_SCHEMA,status:'PROOF_BLOCKED',
    requestId,sourceSha,approvalSha256:f.auth.approvalSha256,
    manifestSha256:f.auth.manifest.packageManifestSha256,
    code:'PROOF_CLI_UNSETTLED_AWAIT_STOP',cliNodeExitCode:13,
    operationWrites:0};
  const found=sanitizeProofReport(raw,f.auth,env);
  assert.equal(found.status,'PROOF_BLOCKED');
  assert.equal(found.code,'PROOF_CLI_UNSETTLED_AWAIT_STOP');
  assert.equal(found.cliNodeExitCode,13);
});

test('no Windows environment reaches neither package build nor operation',async()=>{
  const f=fixture();let imported=0;
  await assert.rejects(proveWithoutInstall({auth:f.auth,env:{RUNNER_TEMP:'/tmp'},
    loadModule:()=>{imported++;}}),/PROOF_WINDOWS_TEMP_REQUIRED/);
  assert.equal(imported,0);
});

test('proof CLI --run/--report cannot deadlock their ES module imports',()=>{
  const dir=path.dirname(fileURLToPath(import.meta.url));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-proof-cli-'));
  try{
    const event=path.join(temp,'event.json');
    fs.writeFileSync(event,'{}\n',{flag:'wx'});
    const run=spawnSync(process.execPath,
      [path.join(dir,'proof-only.mjs'),'--report'],
      {env:{...process.env,GITHUB_EVENT_PATH:event},
        encoding:'utf8',timeout:6000});
    assert.equal(run.status,1);
    assert.match(run.stderr,/PROOF_OWNER_ISSUE_DENIED/);
    assert.doesNotMatch(run.stderr,/unsettled top-level await/i);
    const runMode=spawnSync(process.execPath,
      [path.join(dir,'proof-only.mjs'),'--run'],
      {env:{...process.env,GITHUB_EVENT_PATH:event},
        encoding:'utf8',timeout:6000});
    assert.equal(runMode.status,1);
    assert.match(runMode.stderr,
      process.platform==='win32'?/PROOF_OWNER_ISSUE_DENIED/:
        /PROOF_WINDOWS_REQUIRED/);
    assert.doesNotMatch(runMode.stderr,/unsettled top-level await/i);
  }finally{fs.rmSync(temp,{recursive:true});}
});

test('proof-only workflow has no install/effect stage',()=>{
  const dir=path.dirname(fileURLToPath(import.meta.url));
  const yml=fs.readFileSync(path.join(dir,
    '../.github/workflows/pc-configured-runtime-proof-once.yml'),'utf8');
  assert.match(yml,/types: \[opened\]/);
  assert.match(yml,/pc-configured-runtime-proof/);
  assert.match(yml,/--pin/);
  assert.match(yml,/--run/);
  assert.match(yml,/Prove Windows CLI entrypoint and both versions/);
  assert.match(yml,/--report/);
  assert.doesNotMatch(yml,/direct-writer-b\\run\.mjs/);
  assert.doesNotMatch(yml,/RUN_INSTALL\.cmd/);
});

test('unmatched Issue workflows cannot evict a valid Writer B or proof job',()=>{
  const dir=path.dirname(fileURLToPath(import.meta.url));
  const workflows=[
    ['pc-approved-runtime-b-once.yml',true],
    ['pc-writer-b-source-once.yml',true],
    ['pc-writer-provider-flags-once.yml',true],
    ['pc-configured-runtime-proof-once.yml',false],
  ];
  for(const [name,writer] of workflows){
    const yml=fs.readFileSync(path.join(dir,'../.github/workflows',name),'utf8');
    assert.doesNotMatch(yml,/^concurrency:/m,`${name}: run-level collision`);
    assert.match(yml,/^    concurrency:\n      group: /m);
    assert.match(yml,/^      cancel-in-progress: false$/m);
    if(writer){
      assert.match(yml,/^      group: zgmini-writer-source-b-one-at-a-time$/m);
      assert.match(yml,/^      queue: max$/m);
    }else{
      assert.match(yml,/^      group: zgmini-configured-runtime-proof-/m);
      assert.doesNotMatch(yml,/^      group: zgmini-writer-source-b-one-at-a-time$/m);
    }
  }
});

test('legacy and V2 create-only proof pairs verify JSON/TXT without retry',async()=>{
  const f=fixture();
  for(const rawProof of [validProof(f.auth),modernProof(f.auth)]){
    const objects=new Map();
    const mockFetch=async(url,options)=>{
      if(options.method==='PUT'){
        objects.set(url,Buffer.from(JSON.parse(options.body).content,'base64'));
        return {status:201};
      }
      if(options.method==='GET'){
        const bytes=objects.get(url.split('?ref=')[0]);
        return bytes?{status:200,json:async()=>({encoding:'base64',
          content:bytes.toString('base64')})}:{status:404};
      }
      if(options.method==='POST')return {status:201};
      throw Error('unexpected method');
    };
    const result=await uploadProofReport({event:f.event,env,auth:f.auth,
      rawResult:JSON.stringify(rawProof),fetchApi:mockFetch});
    assert.deepEqual(result,{status:'PROOF_PASS',created:2,verified:2});
    assert.equal(objects.size,2);
    const json=[...objects].find(([k])=>k.endsWith('.json'))[1];
    const txt=[...objects].find(([k])=>k.endsWith('.txt'))[1];
    assert.equal(JSON.parse(json).evidenceSha256,rawProof.evidenceSha256);
    if(rawProof.schema===PROOF_CLI_SCHEMA){
      assert.equal(JSON.parse(json).cliEntrypointProof,
        'WINDOWS_CLI_ENTRY_PASS');
      assert.match(txt.toString('utf8'),/CLI_NODE_EXIT_CODE=0/);
    }else assert.match(txt.toString('utf8'),
      /CLI_ENTRY_PROOF=LEGACY_NOT_TESTED/);
  }
});
