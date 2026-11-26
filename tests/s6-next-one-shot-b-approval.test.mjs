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
