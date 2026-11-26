import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {validateS6OnceBManifest} from '../tools/maintenance-contract.mjs';

const PREIMAGE=new URL('../results/pc-process-inventory-45878730994-1-operating.json',import.meta.url);
const PREDRAIN=new URL('../results/pc-process-inventory-45878791152-1-operating.json',import.meta.url);
const PREVIOUS_APPROVAL=new URL('../approvals/controller-s6/7dc6233e40b6d351e313969a0899ff96fe31a2b189e6ae04c3c3ed1aeb037b76.json',import.meta.url);
const digest=raw=>createHash('sha256').update(raw).digest('hex');
const candidate=()=>JSON.parse(readFileSync(PREIMAGE,'utf8')).s6NextPreimage;
const predain=()=>JSON.parse(readFileSync(PREDRAIN,'utf8')).s6PredrainInputs;

test('S6 current A source/preimage is exact but does not grant B authorization',()=>{
 const p=candidate();
 assert.equal(p.status,'PASS');
 assert.equal(p.code,'S6_APPROVAL_PREIMAGE_CANDIDATE_ONLY');
 assert.equal(p.s6Live.installedControllerSha,'3c7d4cfefacf072fd35cb19706b352c64c5e4fd2');
 assert.equal(p.s6Live.installedMaintainerSha,'5a85f803fd9cb280561395f88a3544ee8e7d4660');
 for(const key of ['bAuthorization','independentOperatorAttested','promotionApproved',
   'sixIdleRunnersVerified','workflowActiveVerified','failoverTested'])
  assert.equal(p[key],false);
 const d=predain();
 assert.equal(d.status,'PASS');
 assert.equal(d.code,'S6_PRE_DRAIN_INPUTS_OBSERVED_ONLY');
 assert.equal(d.relatedLeaseCount,0);
 assert.equal(d.pendingWorkCount,0);
 assert.equal(d.inputClearAtObservation,true);
 for(const key of ['bAuthorization','independentlyAttested','replayAuthorized','failoverTested'])
  assert.equal(d[key],false);
});

test('S6 prior #4016 B exact manifest is no longer eligible for current Controller source',()=>{
 const p=candidate(),bytes=readFileSync(PREVIOUS_APPROVAL);
 const old=JSON.parse(bytes.toString('utf8'));
 assert.notEqual(old.installedControllerSha,p.s6Live.installedControllerSha);
 assert.notEqual(old.installedMaintainerSha,p.s6Live.installedMaintainerSha);
 assert.notEqual(old.ownerSha256,p.s6Live.ownerSha256);
 const request={
  schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:old.requestId,
  chatId:'chat-zgmini-s6-current-cas-20261127',
  operation:old.operation,
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  targetControllerSha:old.installedControllerSha,
  approvalManifestSha256:digest(bytes)
 };
 assert.throws(()=>validateS6OnceBManifest(request,bytes,{
  actor:'ansqhd5774-Choi',live:p.s6Live
 }),/S6_ONCE_LIVE_CAS_UNVERIFIED/);
});

const REQUEST_ID='pc-s6-63afb126-72dc-4ec5-a721-4819771fa9ee';
const CURRENT_PIN='1fceeba061f7f8731811220b27cac245bd91d44e87d68935cd8475117f094141';
const CURRENT_APPROVAL=new URL('../approvals/controller-s6/'+CURRENT_PIN+'.json',import.meta.url);
const current=()=>readFileSync(CURRENT_APPROVAL);
const envelope=(pin=CURRENT_PIN)=>({
 schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
 requestId:REQUEST_ID,
 chatId:'chat-zgmini-s6-b3-20261127',
 operation:'controller-s6-failover-once',
 controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
 targetControllerSha:candidate().s6Live.installedControllerSha,
 approvalManifestSha256:pin
});

test('S6 #4063 distinct immutable approval exactly matches new live CAS, still authorizes no operation',()=>{
 const raw=current(),live=candidate().s6Live,approved=JSON.parse(raw.toString('utf8'));
 assert.equal(digest(raw),CURRENT_PIN);
 assert.equal(approved.schema,'ZGMINI_PC_S6_ONCE_B_APPROVAL_V1');
 assert.equal(approved.operation,'controller-s6-failover-once');
 assert.equal(approved.requestId,REQUEST_ID);
 assert.notEqual(approved.requestId,JSON.parse(readFileSync(PREVIOUS_APPROVAL,'utf8')).requestId);
 for(const key of ['installedControllerSha','installedMaintainerSha','watchdogSourceSha256',
  'protectedSha256','ownerSha256','watchdogPid'])
  assert.equal(approved[key],live[key]);
 assert.deepEqual(approved.standbyPids,live.standbyPids);
 assert.deepEqual(approved.approval,{
  approved:true,grade:'B',
  ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4063',
  scope:'EXACT_ONE_SUPERVISOR_TREE_STOP_WITH_WATCHDOG_AUTO_PROMOTION'
 });
 assert.equal(approved.effect.stop,'OLD_OWNED_SUPERVISOR_TREE_ONLY');
 assert.equal(approved.effect.noAutomaticRetry,true);
 assert.equal(approved.effect.noForcedRollback,true);
 assert.equal(approved.effect.preserveWorkersAndLedger,true);
 assert.equal(approved.effect.preserveProtectedSourceAndDb,true);
 const result=validateS6OnceBManifest(envelope(),raw,{
  actor:'ansqhd5774-Choi',live
 });
 assert.equal(result.authorization,false);
 assert.equal(result.operationalEffectExecuted,false);
});

test('S6 #4063 approval rejects byte, actor, current operating origin and protected CAS drift',()=>{
 const raw=current(),live=candidate().s6Live;
 const ctx={actor:'ansqhd5774-Choi',live};
 assert.throws(()=>validateS6OnceBManifest({...envelope(),
  requestId:'pc-s6-2a9bae01-bb3d-435c-b952-996cef65950a'},raw,ctx),
  /S6_ONCE_MANIFEST_PREIMAGE_INVALID/);
 assert.throws(()=>validateS6OnceBManifest(envelope(),raw,{
  ...ctx,actor:'github-actions[bot]'}),/S6_ONCE_ACTOR_OR_REPOSITORY_DENIED/);
 assert.throws(()=>validateS6OnceBManifest(envelope(),Buffer.concat([raw,Buffer.from(' ')]),ctx),
  /S6_ONCE_MANIFEST_BYTES_DRIFT/);
 for(const change of [
  {installedControllerSha:'0'.repeat(40)},
  {installedMaintainerSha:'0'.repeat(40)},
  {watchdogSourceSha256:'0'.repeat(64)},
  {protectedSha256:'0'.repeat(64)},
  {ownerSha256:'0'.repeat(64)},
  {watchdogPid:12345},
  {standbyPids:[20068,12345]}
 ]){
  assert.throws(()=>validateS6OnceBManifest(envelope(),raw,{
   ...ctx,live:{...live,...change}}),/S6_ONCE_LIVE_CAS_UNVERIFIED/);
 }
 const approved=JSON.parse(raw.toString('utf8'));
 const canceled=Buffer.from(JSON.stringify({...approved,
  approval:{...approved.approval,approved:false}})+'\n');
 assert.throws(()=>validateS6OnceBManifest(envelope(digest(canceled)),canceled,ctx),
  /S6_ONCE_NEW_B_APPROVAL_REQUIRED/);
});
