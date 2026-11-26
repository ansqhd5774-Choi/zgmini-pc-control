import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {test} from 'node:test';
import {validateS6OnceBManifest} from '../tools/maintenance-contract.mjs';

const PREIMAGE=new URL('../results/pc-process-inventory-45867938595-1-operating.json',import.meta.url);
const ORIGINAL=new URL('../approvals/controller-s6/b8fed5bebec6a473730ed0b09ede5b5dc173db53af5cfc1e619e34a45bb8aefd.json',import.meta.url);
const REQUEST_ID='pc-s6-2a9bae01-bb3d-435c-b952-996cef65950a';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('S6 second one-shot reuses neither old B bytes nor A-only authority',()=>{
 const observed=JSON.parse(fs.readFileSync(PREIMAGE,'utf8'));
 assert.equal(observed.status,'PASS');
 assert.equal(observed.code,'S6_APPROVAL_PREIMAGE_CANDIDATE_ONLY');
 const proof=observed.s6NextPreimage;
 assert.equal(proof.status,'PASS');
 assert.equal(proof.bAuthorization,false);
 assert.equal(proof.independentOperatorAttested,false);
 assert.equal(proof.promotionApproved,false);
 assert.equal(proof.sixIdleRunnersVerified,false);
 assert.equal(proof.workflowActiveVerified,false);
 const live=proof.s6Live;
 assert.equal(live.installedMaintainerSha,'20a2939d419675ede3e8ab38a3ea3b70756981ac');
 assert.equal(live.installedControllerSha,'182bb46f2838306ba40d8b4ec32bac40ab75b69a');
 const old=fs.readFileSync(ORIGINAL);
 const oldApproval=JSON.parse(old.toString('utf8'));
 assert.notEqual(oldApproval.requestId,REQUEST_ID);
 assert.notEqual(oldApproval.installedMaintainerSha,live.installedMaintainerSha);
 const envelope={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:oldApproval.requestId,chatId:'chat-zgmini-s6-20261127',
  operation:'controller-s6-failover-once',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  targetControllerSha:live.installedControllerSha,
  approvalManifestSha256:digest(old)};
 assert.throws(()=>validateS6OnceBManifest(envelope,old,{
  actor:'ansqhd5774-Choi',live,
 }),/S6_ONCE_LIVE_CAS_UNVERIFIED/);
});

test('S6 B #4016 exact current A pin has separate one-shot authorization and cannot drift',()=>{
 const observed=JSON.parse(fs.readFileSync(PREIMAGE,'utf8'));
 const live=observed.s6NextPreimage.s6Live;
 const file=new URL('../approvals/controller-s6/7dc6233e40b6d351e313969a0899ff96fe31a2b189e6ae04c3c3ed1aeb037b76.json',import.meta.url);
 const bytes=fs.readFileSync(file);
 const approved=JSON.parse(bytes.toString('utf8'));
 const pin=digest(bytes);
 assert.equal(pin,'7dc6233e40b6d351e313969a0899ff96fe31a2b189e6ae04c3c3ed1aeb037b76');
 assert.equal(approved.schema,'ZGMINI_PC_S6_ONCE_B_APPROVAL_V1');
 assert.equal(approved.requestId,REQUEST_ID);
 assert.equal(approved.approval.approved,true);
 assert.equal(approved.approval.grade,'B');
 assert.equal(approved.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4016');
 assert.equal(approved.approval.scope,
  'EXACT_ONE_SUPERVISOR_TREE_STOP_WITH_WATCHDOG_AUTO_PROMOTION');
 assert.equal(approved.installedMaintainerSha,live.installedMaintainerSha);
 assert.equal(approved.installedControllerSha,live.installedControllerSha);
 assert.equal(approved.watchdogSourceSha256,live.watchdogSourceSha256);
 assert.equal(approved.protectedSha256,live.protectedSha256);
 assert.equal(approved.ownerSha256,live.ownerSha256);
 assert.equal(approved.watchdogPid,live.watchdogPid);
 assert.deepEqual(approved.standbyPids,live.standbyPids);
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:REQUEST_ID,chatId:'chat-zgmini-s6-b2-20261127',
  operation:'controller-s6-failover-once',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  targetControllerSha:approved.installedControllerSha,
  approvalManifestSha256:pin};
 const ctx={actor:'ansqhd5774-Choi',live};
 const admitted=validateS6OnceBManifest(request,bytes,ctx);
 assert.equal(admitted.authorization,false);
 assert.equal(admitted.operationalEffectExecuted,false);
 assert.throws(()=>validateS6OnceBManifest({...request,
  requestId:'pc-s6-d7c0a971-5219-4a3a-9dce-30b0543b0e72'},bytes,ctx),
  /S6_ONCE_MANIFEST_PREIMAGE_INVALID/);
 for(const delta of [{installedMaintainerSha:'f'.repeat(40)},
  {protectedSha256:'a'.repeat(64)},{ownerSha256:'b'.repeat(64)},
  {watchdogPid:11111},{standbyPids:[22222,33333]}]){
  assert.throws(()=>validateS6OnceBManifest(request,bytes,
   {...ctx,live:{...live,...delta}}),/S6_ONCE_LIVE_CAS_UNVERIFIED/);
 }
 assert.throws(()=>validateS6OnceBManifest(request,bytes,
  {...ctx,actor:'github-actions[bot]'}),/S6_ONCE_ACTOR_OR_REPOSITORY_DENIED/);
 const unapproved={...approved,approval:{...approved.approval,approved:false}};
 const newBytes=Buffer.from(JSON.stringify(unapproved)+'\n');
 assert.throws(()=>validateS6OnceBManifest({...request,
  approvalManifestSha256:digest(newBytes)},newBytes,ctx),
  /S6_ONCE_NEW_B_APPROVAL_REQUIRED/);
 assert.throws(()=>validateS6OnceBManifest(request,Buffer.concat([bytes,
  Buffer.from(' ')]),ctx),/S6_ONCE_MANIFEST_BYTES_DRIFT/);
});
