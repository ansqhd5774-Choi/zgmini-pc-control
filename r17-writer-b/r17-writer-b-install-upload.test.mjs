import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeInstallReport,validateEventForUpload,uploadInstallReport,
  readResultFile} from './r17-writer-b-install-upload.mjs';

const REQUEST_ID='pc-r17-12345678-1234-4234-8234-123456789abc';
const CHAT_ID='chat-12345678-1234-4234-8234-123456789abc';
const CTRL='f'.repeat(40);
const CANDIDATE='81c8ee543c164fc16c8c760d504b113428d01d4a';
const OPER_SOURCE='a'.repeat(40);
const BODY={
  schema:'ZGMINI_R17_WRITER_B_INSTALL_REQUEST_V1',requestId:REQUEST_ID,
  chatId:CHAT_ID,operation:'r17-writer-fivefile-install-once',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  candidateSourceSha:CANDIDATE,approvalManifestSha256:'b'.repeat(64),
};
const event=()=>({
  action:'opened',repository:{private:true,full_name:'ansqhd5774-Choi/zgmini-pc-control'},
  sender:{login:'ansqhd5774-Choi'},
  issue:{number:377,title:'pc-r17-writer-fivefile-install',
    user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-r17-writer-b-install'}],
    body:JSON.stringify(BODY)},
});
const env=()=>({
  GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
  RUNNER_NAME:'zgmini-pc-01',GITHUB_RUN_ID:'123456789',
  R17_CONTROL_SHA:CTRL,GITHUB_SHA:CTRL,GITHUB_TOKEN:'x'.repeat(40),
});
const verified=()=>({status:'R17_B_INSTALLED_VERIFIED',phase:'VERIFIED',
  requestId:REQUEST_ID,sourceSha:OPER_SOURCE});

test('strict owner private one-shot opening event with fixed candidate',()=>{
  assert.equal(validateEventForUpload(event(),env()).requestId,REQUEST_ID);
  const retry=env();retry.GITHUB_RUN_ATTEMPT='2';
  assert.throws(()=>validateEventForUpload(event(),retry),/EVENT_CONTEXT_STOP/);
  const otherUser=event();otherUser.issue.user.login='collaborator';
  assert.throws(()=>validateEventForUpload(otherUser,env()),/EVENT_AUTHORIZATION_STOP/);
  const noLabel=event();noLabel.issue.labels=[];
  assert.throws(()=>validateEventForUpload(noLabel,env()),/EVENT_AUTHORIZATION_STOP/);
  const moved=event();moved.issue.body=JSON.stringify({...BODY,candidateSourceSha:'1'.repeat(40)});
  assert.throws(()=>validateEventForUpload(moved,env()),/REQUEST_STOP/);
  const otherSha=env();otherSha.GITHUB_SHA='e'.repeat(40);
  assert.throws(()=>validateEventForUpload(event(),otherSha),/EVENT_CONTEXT_STOP/);
});

test('success requires exact validated phase, requestId and non-base source SHA',()=>{
  const ok=sanitizeInstallReport(verified(),REQUEST_ID,'123456789');
  assert.equal(ok.status,'R17_B_INSTALLED_VERIFIED');
  assert.equal(ok.code,'R17_B_INSTALL_VERIFIED');
  assert.equal(ok.sourceSha,OPER_SOURCE);
  assert.equal(ok.retry,'NO_REEXECUTE_READBACK_ONLY');
  assert.equal(sanitizeInstallReport({...verified(),phase:'PREPARED'},REQUEST_ID).status,'STATE_UNKNOWN');
  assert.equal(sanitizeInstallReport({...verified(),sourceSha:'a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e'},REQUEST_ID).status,'STATE_UNKNOWN');
  assert.equal(sanitizeInstallReport({...verified(),extra:'token-unsafe'},REQUEST_ID).status,'STATE_UNKNOWN');
  assert.equal(sanitizeInstallReport({...verified(),requestId:'other'},REQUEST_ID).code,'R17_B_RESULT_REQUEST_MISMATCH');
});

test('setup STOP, normal STOP and recovery report never become PASS',()=>{
  const setup=sanitizeInstallReport({status:'R17_B_SETUP_STOP',
    errorCode:'R17_B_CONTROL_CHECKOUT_SHA_STOP'},REQUEST_ID);
  assert.equal(setup.status,'R17_B_SETUP_STOP');
  assert.equal(setup.phase,'SETUP');
  const stopped=sanitizeInstallReport({status:'R17_B_INSTALL_STOP',phase:'CORE_DRAINED',
    requestId:REQUEST_ID,sourceSha:null,errorCode:'R17_B_CONFIG_TARGET_STOP'},REQUEST_ID);
  assert.equal(stopped.status,'R17_B_INSTALL_STOP');
  assert.equal(stopped.code,'R17_B_CONFIG_TARGET_STOP');
  const recovery=sanitizeInstallReport({status:'R17_B_RECOVERY_REQUIRED',
    phase:'SOURCE_SWITCHED',requestId:REQUEST_ID,sourceSha:null,
    errorCode:'R17_B_SOURCE_RESTORE_DRIFT_STOP',
    recovery:['SOURCE_RESTORE_FAILED','CORE_STATE_UNKNOWN']},REQUEST_ID);
  assert.equal(recovery.status,'R17_B_RECOVERY_REQUIRED');
  assert.deepEqual(recovery.recovery,['SOURCE_RESTORE_FAILED','CORE_STATE_UNKNOWN']);
  assert.equal(sanitizeInstallReport({...recovery,recovery:['DROP_TABLE']},REQUEST_ID).status,'STATE_UNKNOWN');
});

test('reporter creates only two private artifacts, reads exact bytes and comments once',async()=>{
  const created=new Map();const calls=[];
  const apiFetch=async(url,options)=>{
    calls.push({url,method:options.method,body:options.body});
    if(options.method==='PUT'){
      const body=JSON.parse(options.body);
      assert.equal(Object.hasOwn(body,'sha'),false,'no overwrite SHA accepted');
      created.set(url,Buffer.from(body.content,'base64'));
      return {status:201};
    }
    if(options.method==='GET'){
      const blob=created.get(url.split('?')[0]);
      return {status:200,json:async()=>({encoding:'base64',content:blob.toString('base64')})};
    }
    if(options.method==='POST')return {status:201};
    throw new Error('unexpected API method');
  };
  const value=await uploadInstallReport({event:event(),env:env(),
    readReport:()=>JSON.stringify(verified()),apiFetch});
  assert.deepEqual(value,{status:'R17_B_INSTALLED_VERIFIED',
    code:'R17_B_INSTALL_VERIFIED',created:2,verified:2});
  assert.equal(calls.filter(c=>c.method==='PUT').length,2);
  assert.equal(calls.filter(c=>c.method==='GET').length,2);
  assert.equal(calls.filter(c=>c.method==='POST').length,1);
  assert.ok(calls.some(c=>c.method==='POST'&&
    JSON.parse(c.body).body.includes('RESULT_READBACK: 2/2')));
});

test('ambiguous PUT never retries, GET readback may independently verify',async()=>{
  let put=0;let comment='';
  const out=await uploadInstallReport({event:event(),env:env(),
    readReport:()=>JSON.stringify(verified()),apiFetch:async(url,options)=>{
      if(options.method==='PUT'){put++;throw new Error('unknown network acceptance');}
      if(options.method==='GET')return {status:404};
      if(options.method==='POST'){comment=JSON.parse(options.body).body;return {status:201};}
    }});
  assert.equal(put,2,'each distinct create-only file attempted once');
  assert.equal(out.created,0);
  assert.equal(out.verified,0);
  assert.match(comment,/RESULT_READBACK: 0\/2/);
  assert.match(comment,/NO_REEXECUTE_READBACK_ONLY/);
});

test('duplicate create-only response never overwrites or retries; exact readback reported separately',async()=>{
  let puts=0,posts=0;
  const previous=new Map();
  const result=await uploadInstallReport({event:event(),env:env(),
    readReport:()=>JSON.stringify(verified()),apiFetch:async(url,options)=>{
      if(options.method==='PUT'){
        puts++;
        const data=JSON.parse(options.body);
        assert.equal(Object.hasOwn(data,'sha'),false);
        previous.set(url,Buffer.from(data.content,'base64'));
        return {status:422}; // GitHub already has this immutable path.
      }
      if(options.method==='GET'){
        return {status:200,json:async()=>({encoding:'base64',
          content:previous.get(url.split('?')[0]).toString('base64')})};
      }
      if(options.method==='POST'){posts++;return {status:201};}
    }});
  assert.equal(puts,2);
  assert.equal(posts,1);
  assert.equal(result.created,0);
  assert.equal(result.verified,2);
});

test('missing, malicious or oversized reporter input is sanitized STATE_UNKNOWN',async()=>{
  assert.equal(readResultFile('/nonexistent/r17-b-install-result.json'),'{}');
  let comment='';
  await uploadInstallReport({event:event(),env:env(),
    readReport:()=>JSON.stringify({...verified(),config:'SECRET-DO-NOT-LOG'}),
    apiFetch:async(_url,options)=>{
      if(options.method==='PUT')return {status:201};
      if(options.method==='GET')return {status:404};
      if(options.method==='POST'){comment=JSON.parse(options.body).body;return {status:201};}
    }});
  assert.match(comment,/STATE_UNKNOWN/);
  assert.doesNotMatch(comment,/SECRET-DO-NOT-LOG/);
  assert.equal(sanitizeInstallReport(null,REQUEST_ID).status,'STATE_UNKNOWN');
  assert.equal(sanitizeInstallReport({status:'R17_B_SETUP_STOP',
    errorCode:'HOST-COMMAND-OUTPUT'},REQUEST_ID).status,'STATE_UNKNOWN');
});
