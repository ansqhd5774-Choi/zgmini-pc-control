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
