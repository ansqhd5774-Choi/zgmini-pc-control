import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {validateRequest,verifyManifest,MARKER_ROOT,
 SCHEMA,REPO,SOURCE_SHA,TITLE} from './receiver.mjs';
import {PRIOR_SHA_251} from './gas-refresh.mjs';
import {validateReceiptEnvironment,receiptBody} from './upload.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const candidate=JSON.parse(fs.readFileSync(path.join(dir,'inflation-gas-refresh-b-approval.json'),'utf8'));
const manifest={...candidate,approved:true};
const id=randomUUID(),req=`pc-infl-gas-refresh-${id}`,chat=`chat-${id}`;
const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1'};
const event={action:'opened',repository:{private:true,full_name:REPO},issue:{
 user:{login:'ansqhd5774-Choi'},title:TITLE,number:424,body:JSON.stringify({
  schema:SCHEMA,operation:'refresh-gas-dhhngsp-private-once',
  sourceSha:SOURCE_SHA,requestId:req,chatId:chat})}};
const clone=x=>structuredClone(x);

test('single series B manifest pins old file, exact source and new isolated receipt path',()=>{
 assert.equal(candidate.approved,false);
 assert.throws(()=>verifyManifest(candidate),/GAS_REFRESH_MANIFEST_DENIED/);
 assert.equal(verifyManifest(manifest),true);
 assert.equal(manifest.priorGasSha256,PRIOR_SHA_251);
 assert.equal(manifest.outputRelative,'inflation-causal-r1/gas-dhhngsp.json');
 assert.equal(manifest.expectedLatestObservation,'2026-11-03');
 assert.equal(manifest.expectedValueForLatest,2.63);
 assert.equal(manifest.markerRoot,MARKER_ROOT);
 assert.ok(!MARKER_ROOT.toLowerCase().includes('inflation-gas-electric-once-guard'));
 assert.equal(manifest.maxProviderRequests,1);
});
test('manifest blocks source SHA drift and extra provider calls',()=>{
 for(const [key,value] of [['sourceSha','1'.repeat(40)],['maxProviderRequests',3],
  ['priorGasSha256','0'.repeat(64)],['expectedLatestObservation','2026-10-27'],
  ['expectedValueForLatest',2.64],
  ['allowD1Writes',true],['allowSchedulerChanges',true]]){
  const m=clone(manifest);m[key]=value;
  assert.throws(()=>verifyManifest(m),/GAS_REFRESH_MANIFEST_DENIED/);
 }
});
test('manifest blocks replacement of pinned source dependency checksum',()=>{
 const m=clone(manifest);
 m.sourceFileHashes['scripts/inflation-causal-gas-electric.mjs']='0'.repeat(64);
 assert.throws(()=>verifyManifest(m),/GAS_REFRESH_MANIFEST_DENIED/);
});
test('exact private opened Issue author, schema, paired request ID accepted',()=>{
 assert.equal(validateRequest(event,env).requestId,req);
 assert.equal(validateReceiptEnvironment(event,env),424);
});
test('Issue title, actor, privacy, run retry and event reject before any write',()=>{
 for(const bad of [
  {event:{...event,issue:{...event.issue,title:'pc-job'}}},
  {event:{...event,repository:{...event.repository,private:false}}},
  {env:{...env,GITHUB_RUN_ATTEMPT:'2'}},
  {env:{...env,GITHUB_ACTOR:'attacker'}},
  {env:{...env,GITHUB_EVENT_ACTION:'edited'}}]){
  assert.throws(()=>validateRequest(bad.event??event,bad.env??env),/GAS_REFRESH_ISSUE_DENIED/);
 }
});
test('Issue JSON cannot choose another source or arbitrary execution inputs',()=>{
 for(const body of [
  {...JSON.parse(event.issue.body),sourceSha:'a'.repeat(40)},
  {...JSON.parse(event.issue.body),command:'cmd /c whoami'},
  {...JSON.parse(event.issue.body),chatId:`chat-${randomUUID()}`},
 ]){
  assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify(body)}},env),
   /GAS_REFRESH_REQUEST_DENIED/);
 }
});
test('receipt includes expected evidence but drops arbitrary details',()=>{
 const body=receiptBody({schema:SCHEMA,status:'PASS',code:'GAS_REFRESH_SAVED_READBACK',
  priorLatest:'2026-10-27',latest:'2026-11-03',sourceSha:SOURCE_SHA,
  priorSha256:PRIOR_SHA_251,newSha256:'f'.repeat(64),providerCalls:1,
  coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0,
  fredKey:'do-not-publish-me',debugTrace:'do-not-publish-me'},'12345');
 assert.match(body,/2026-11-03/);
 assert.ok(!body.includes('do-not-publish-me'));
 assert.match(body,/Old #251 ONCE_STARTED marker never modified/);
});
test('receipt refuses fabricated result or invalid status/code',()=>{
 for(const item of [{schema:SCHEMA,status:'PASS',code:'EXTERNAL_ERROR'},
  {schema:SCHEMA,status:'DONE',code:'GAS_REFRESH_SAVED_READBACK'},
  {schema:'INJECTION',status:'PASS',code:'GAS_REFRESH_SAVED_READBACK'}])
  assert.throws(()=>receiptBody(item,'12345'),/GAS_REFRESH_RECEIPT_UPLOAD_BLOCKED/);
});
