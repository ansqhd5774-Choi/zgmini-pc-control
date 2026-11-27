import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
 ORPHAN_SIX_B_TITLE,ORPHAN_SIX_B_OPERATION,
 ORPHAN_SIX_B_REQUEST_SCHEMA,ORPHAN_SIX_B_MANIFEST_SCHEMA,
 ORPHAN_SIX_B_SCOPE,ORPHAN_SIX_B_FIXED_EFFECT,
 validateOrphanSixBRequest,validateOrphanSixBManifest,
 assessOrphanSixBPrivatePreflight
} from '../tools/supervisor-orphan-six-b-admission.mjs';
const d=x=>x.repeat(64);
const sha=x=>createHash('sha256').update(x).digest('hex');
const sample=()=>{
 const issue={
  schema:ORPHAN_SIX_B_REQUEST_SCHEMA,operation:ORPHAN_SIX_B_OPERATION,
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  requestId:'pc-12345678-1234-4234-8234-123456789abc',
  chatId:'chat-controller-orphan-20261127',
  targetControllerSha:'a'.repeat(40),
  approvalManifestSha256:d('0')
 };
 const manifest={
  schema:ORPHAN_SIX_B_MANIFEST_SCHEMA,
  operation:ORPHAN_SIX_B_OPERATION,requestId:issue.requestId,
  installedControllerSha:issue.targetControllerSha,
  installedMaintainerSha:'b'.repeat(40),
  maintenanceFilesSha256:d('c'),
  watchdogSourceSha256:d('d'),oldOwnerRawSha256:d('e'),
  heartbeatRawSha256:d('f'),hostRawSha256:d('a'),
  privateOriginalSixSeatDigestSha256:d('b'),
  approval:{
   approved:true,grade:'B',scope:ORPHAN_SIX_B_SCOPE,
   ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/6200',
   reviewedSourceSha:'c'.repeat(40)
  },
  effect:{...ORPHAN_SIX_B_FIXED_EFFECT}
 };
 const raw=Buffer.from(JSON.stringify(manifest)+'\n');
 issue.approvalManifestSha256=sha(raw);
 const proof={number:6200,state:'closed',merged:true,
  headSha:manifest.approval.reviewedSourceSha,
  baseRepo:issue.controlRepository,reviewedByOwner:true};
 return {issue,manifest,raw,proof};
};
const approval=({issue,raw,proof})=>validateOrphanSixBManifest(issue,raw,{
 actor:'ansqhd5774-Choi',approvalPr:proof
});
const privateLive=()=>({
 source:'PRIVATE_INDEPENDENT_WINDOWS_B',host:'PC',
 installedMaintainerSha:'b'.repeat(40),
 installedControllerSha:'a'.repeat(40),
 verifiedMaintainerOrigin:true,oneUseEffectClaimHeld:true,
 currentInstallLeaseOwned:true,oldOwnerDeadVerified:true,
 originalSixSeatIdentityPinned:true,exclusiveSixConsolesVerified:true,
 currentWorkerCount:0,relatedLeaseCount:0,
 completeLeaseEnumerationVerified:true,
 intakePausedAndDrainedVerified:true,
 watchdogInFlightRecoveryExcludedVerified:true,
 originalRawCASUnchangedVerified:true,
 controllerBPolicyUnchangedVerified:true,
 observedAtUtc:new Date().toISOString()
});
test('new B request is separate from forced S6, and rejects nonowner or arbitrary inputs',()=>{
 const v=sample();assert.equal(ORPHAN_SIX_B_TITLE,'pc-controller-orphan-six-graceful-once');
 assert.equal(validateOrphanSixBRequest(v.issue,{actor:'ansqhd5774-Choi'}).operation,
  ORPHAN_SIX_B_OPERATION);
 assert.throws(()=>validateOrphanSixBRequest(v.issue,{actor:'github-actions[bot]'}),
  /ORPHAN_SIX_REQUEST_ACTOR_DENIED/);
 assert.throws(()=>validateOrphanSixBRequest({...v.issue,command:'taskkill'},
  {actor:'ansqhd5774-Choi'}),/ORPHAN_SIX_REQUEST_SCHEMA_DENIED/);
 assert.throws(()=>validateOrphanSixBRequest({...v.issue,
  requestId:'pc-s6-12345678-1234-1234-1234-123456789abc'},
  {actor:'ansqhd5774-Choi'}),/ORPHAN_SIX_REQUEST_SCHEMA_DENIED/);
});
test('exact immutable raw B approval/PR is a CANDIDATE, never effect authority',()=>{
 const v=sample(),a=approval(v);
 assert.equal(a.status,'CANDIDATE_ONLY');
 assert.equal(a.actuationAllowed,false);
 assert.equal(a.runnerStopAuthorized,false);
 assert.equal(a.operationalWrites,0);
 assert.equal(a.canInstall,false);
 assert.equal(a.manifestRawSha256,sha(v.raw));
 assert.equal(a.approvalPrNumber,6200);
 assert.doesNotMatch(JSON.stringify(a),/pid|nonce|Runner\.Listener|1234-4234/);
});
test('raw B manifest bytes and independent reviewed PR identity cannot drift',()=>{
 const v=sample();
 assert.throws(()=>approval({...v,raw:Buffer.from(v.raw+' ')}),
  /ORPHAN_SIX_B_MANIFEST_RAW_DIGEST_MISMATCH/);
 assert.throws(()=>approval({...v,proof:{...v.proof,merged:false}}),
  /ORPHAN_SIX_B_APPROVAL_PR_IDENTITY_UNVERIFIED/);
 assert.throws(()=>approval({...v,proof:{...v.proof,reviewedByOwner:false}}),
  /ORPHAN_SIX_B_APPROVAL_PR_IDENTITY_UNVERIFIED/);
 assert.throws(()=>approval({...v,proof:{...v.proof,headSha:'f'.repeat(40)}}),
  /ORPHAN_SIX_B_APPROVAL_PR_IDENTITY_UNVERIFIED/);
});
test('force kill, Controller B policy mutation, and missing scope are denied',()=>{
 for(const mutate of [
  m=>{m.effect.noForceKill=false;},
  m=>{m.effect.preserveControllerBPolicy=false;},
  m=>{m.effect.signal='TASKKILL_FORCE';},
  m=>{m.effect.extra='BYPASS';},
  m=>{m.approval.scope='EXACT_ONE_SUPERVISOR_TREE_STOP_WITH_WATCHDOG_AUTO_PROMOTION';},
  m=>{m.approval.approved=false;},
  m=>{m.privateOriginalSixSeatDigestSha256='bad';},
  m=>{m.extraPid=51101;}
 ]){
  const v=sample();mutate(v.manifest);
  v.raw=Buffer.from(JSON.stringify(v.manifest)+'\n');
  v.issue.approvalManifestSha256=sha(v.raw);
  assert.throws(()=>approval(v),/ORPHAN_SIX_B_(EFFECT_SCOPE_DENIED|SEPARATE_APPROVAL_REQUIRED|MANIFEST_CAS_DENIED)/);
 }
});
test('host-private six-seat source pins are never accepted via raw Issue',()=>{
 const v=sample(),a=approval(v);
 const live=privateLive();
 const positive=assessOrphanSixBPrivatePreflight(a,live);
 assert.equal(positive.status,'CANDIDATE_ONLY');
 assert.equal(positive.runnerStopAuthorized,false);
 assert.equal(positive.actuationAllowed,false);
 assert.equal(positive.canInstall,false);
 assert.equal(positive.code,'ORPHAN_SIX_B_SAME_HOST_PREFLIGHT_CANDIDATE');
 assert.doesNotMatch(JSON.stringify(positive),/51101|Runner.Listener|nonce/);
});
test('current maintainer identity, fence, drain, CAS and freshness are all necessary',()=>{
 const v=sample(),a=approval(v);
 const changes=[
  x=>{x.host='DESKTOP-N62L0NG';},
  x=>{x.installedMaintainerSha='f'.repeat(40);},
  x=>{x.verifiedMaintainerOrigin=false;},
  x=>{x.oneUseEffectClaimHeld=false;},
  x=>{x.currentInstallLeaseOwned=false;},
  x=>{x.oldOwnerDeadVerified=false;},
  x=>{x.originalSixSeatIdentityPinned=false;},
  x=>{x.exclusiveSixConsolesVerified=false;},
  x=>{x.currentWorkerCount=1;},
  x=>{x.relatedLeaseCount=1;},
  x=>{x.completeLeaseEnumerationVerified=false;},
  x=>{x.intakePausedAndDrainedVerified=false;},
  x=>{x.watchdogInFlightRecoveryExcludedVerified=false;},
  x=>{x.originalRawCASUnchangedVerified=false;},
  x=>{x.controllerBPolicyUnchangedVerified=false;},
  x=>{x.observedAtUtc=new Date(Date.now()-6500).toISOString();}
 ];
 for(const [i,change] of changes.entries()){
  const live=privateLive();change(live);
  const r=assessOrphanSixBPrivatePreflight(a,live);
  assert.equal(r.status,'BLOCKED','gate '+i);
  assert.equal(r.runnerStopAuthorized,false,'gate '+i);
 }
});
test('untrusted approval object and absent B ports do not authorize work',()=>{
 const v=sample();
 const denied=assessOrphanSixBPrivatePreflight({status:'PASS'},privateLive());
 assert.equal(denied.status,'BLOCKED');
 assert.equal(denied.actuationAllowed,false);
 assert.throws(()=>validateOrphanSixBManifest(v.issue,v.raw,{
  actor:'random',approvalPr:v.proof}),/ORPHAN_SIX_REQUEST_ACTOR_DENIED/);
});
test('source has no OS control or installed maintenance routing',()=>{
 const file=fs.readFileSync(new URL(
  '../tools/supervisor-orphan-six-b-admission.mjs',import.meta.url),'utf8');
 for(const regex of [/GenerateConsoleCtrlEvent/,/\btaskkill\b/i,
  /Stop-Process/,/\bspawn\(/,/\bexecFile\(/,
  /\bfetch\(/,/writeFileSync/,/renameSync/])
  assert.doesNotMatch(file,regex);
 assert.match(file,/actuationAllowed:false/);
});
