import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {decide,archiveDeadLease,validateHandoffIntent,verifyHandoffPass} from '../tools/runner-watchdog.mjs';
test('fresh heartbeat is required for healthy status',()=>{
 const now=Date.now(),owner={pid:123};
 assert.equal(decide({owner,live:true,heartbeat:new Date(now).toISOString(),now}),'HEALTHY');
 assert.equal(decide({owner,live:true,heartbeat:new Date(now-60000).toISOString(),now}),'BLOCKED_LIVE_OR_UNKNOWN');
});
test('maintenance and intentional pause suppress recovery',()=>{
 assert.equal(decide({paused:true,owner:{pid:123},live:false}),'PAUSED');
});
test('only a proven dead owner permits recovery',()=>{
 assert.equal(decide({owner:{pid:123},live:null}),'BLOCKED_LIVE_OR_UNKNOWN');
 assert.equal(decide({owner:{pid:123},live:false}),'RECOVER');
});
test('dead lease is archived intact; live or reused PID is never removed',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-watchdog-'));
 const lease=path.join(root,'supervisor');fs.mkdirSync(lease);
 const bytes=JSON.stringify({pid:123,nonce:'proof'});fs.writeFileSync(path.join(lease,'owner.json'),bytes);
 assert.throws(()=>archiveDeadLease(lease,()=>true),/NOT_PROVEN_DEAD/);
 assert.throws(()=>archiveDeadLease(lease,()=>null),/NOT_PROVEN_DEAD/);
 const archived=archiveDeadLease(lease,()=>false);
 assert.equal(fs.readFileSync(path.join(archived,'owner.json'),'utf8'),bytes);
 assert.equal(fs.existsSync(lease),false);
});

const fixedSha='c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7';
const oldSha='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const manifestDigest='458bd775e2f50fef4212713f859bc601205159fe503d4cdb697786256663c4cb';
const requestId='pc-handoff-810bc8a5-abca-473c-b375-63abb56c24d6';
function validIntent(){
 return {
  issue:{title:'pc-maintenance-handoff',state:'OPEN',
   author:{login:'ansqhd5774-Choi'},labels:[{name:'pc-maintenance'}]},
  body:{schema:'ZGMINI_MAINTENANCE_HANDOFF_REQUEST_V1',requestId,
   operation:'maintenance-handoff',targetSha:fixedSha,approvalManifestSha256:manifestDigest},
  approval:{schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SEVEN_TO_SEVEN',
   approved:true,scope:'COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE',
   installedSha:oldSha,targetSha:fixedSha},
  installed:{sourceSha:oldSha},rawDigest:manifestDigest,
 };
}
const admit=o=>validateHandoffIntent(o.issue,o.body,o.approval,o.installed,o.rawDigest);
test('bounded existing 7-to-7 source manifest admits only trusted owner issue',()=>{
 const expected=admit(validIntent());
 assert.deepEqual({...expected},{requestId,targetSha:fixedSha});
});
test('a false GitHub author or label never turns a request into authority',()=>{
 for(const field of ['author','labels','state','title']){
  const value=validIntent();
  if(field==='author')value.issue.author.login='untrusted';
  if(field==='labels')value.issue.labels=[];
  if(field==='state')value.issue.state='CLOSED';
  if(field==='title')value.issue.title='pc-maintenance';
  assert.throws(()=>admit(value),/HANDOFF_REQUEST_ACTOR_OR_LABEL_DENIED/);
 }
});
test('strict operation/schema/request ID/fields reject arbitrary remote commands',()=>{
 for(const mutation of [
  a=>{a.body.command='powershell';},
  a=>{a.body.operation='controller-update';},
  a=>{a.body.schema='ZGMINI_PC_JOB_V1';},
  a=>{a.body.requestId='../escape';},
  a=>{a.body.targetSha='not-a-commit';},
 ]){
  const value=validIntent();mutation(value);
  assert.throws(()=>admit(value),/HANDOFF_REQUEST_CONTRACT_INVALID/);
 }
});
test('a merged source without exact B approval, scope or raw file bytes does not authorize handoff',()=>{
 for(const mutation of [
  a=>{a.approval.approved=false;},
  a=>{a.approval.schema='ZGMINI_MAINTENANCE_HANDOFF_V1';},
  a=>{a.approval.transition='SIX_TO_SEVEN';},
  a=>{a.approval.scope='STOPPED_RECEIVER_IN_PLACE_ONLY';},
  a=>{a.approval.targetSha='a'.repeat(40);},
  a=>{a.installed.sourceSha='b'.repeat(40);},
  a=>{a.rawDigest='f'.repeat(64);},
  a=>{a.body.approvalManifestSha256='d'.repeat(64);},
 ]){
  const value=validIntent();mutation(value);
  assert.throws(()=>admit(value),/HANDOFF_APPROVAL_BYTES_OR_SOURCE_MISMATCH/);
 }
});

test('operator stdout PASS requires independent persisted Windows install proof',()=>{
 const good={report:{status:'PASS'},
   ledger:{schema:'ZGMINI_MAINTENANCE_HANDOFF_RESULT_V1',status:'PASS',
    targetSha:fixedSha,code:'STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED',
    receiverPid:4365},
   installed:{sourceSha:fixedSha},targetSha:fixedSha,exitCode:0};
 assert.equal(verifyHandoffPass(good),true);
 for(const mutate of [
   value=>{value.exitCode=1;},
   value=>{value.ledger.targetSha=oldSha;},
   value=>{value.ledger.status='RUNNING';},
   value=>{value.ledger.receiverPid=null;},
   value=>{value.installed.sourceSha=oldSha;},
 ]){
  const x=JSON.parse(JSON.stringify(good));mutate(x);
  assert.throws(()=>verifyHandoffPass(x),/HANDOFF_PASS_RUNTIME_READBACK_MISMATCH/);
 }
});
