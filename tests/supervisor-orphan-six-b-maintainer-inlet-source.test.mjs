import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {ORPHAN_SIX_B_FIXED_EFFECT,ORPHAN_SIX_B_SCOPE}
 from '../tools/supervisor-orphan-six-b-admission.mjs';
import {parseOrphanSixBFlatRequest,inspectOrphanSixBMaintainerInletSource}
 from '../tools/supervisor-orphan-six-b-maintainer-inlet-source.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
const sha=x=>createHash('sha256').update(x).digest('hex');
function sample(){
 const body={
  schema:'ZGMINI_PC_ORPHAN_SIX_B_REQUEST_V1',
  requestId:'pc-12345678-1234-4234-9234-123456789abc',
  chatId:'chat-orphan-six-source-only',
  operation:'controller-orphan-six-graceful-once',
  controlRepository:REPO,targetControllerSha:'a'.repeat(40),
  approvalManifestSha256:'0'.repeat(64)
 };
 const manifest={
  schema:'ZGMINI_PC_ORPHAN_SIX_B_APPROVAL_V1',
  operation:body.operation,requestId:body.requestId,
  installedControllerSha:body.targetControllerSha,
  installedMaintainerSha:'b'.repeat(40),
  maintenanceFilesSha256:'c'.repeat(64),watchdogSourceSha256:'d'.repeat(64),
  oldOwnerRawSha256:'e'.repeat(64),heartbeatRawSha256:'f'.repeat(64),
  hostRawSha256:'a'.repeat(64),privateOriginalSixSeatDigestSha256:'b'.repeat(64),
  approval:{approved:true,grade:'B',scope:ORPHAN_SIX_B_SCOPE,
   ref:'https://github.com/'+REPO+'/pull/6200',
   reviewedSourceSha:'c'.repeat(40)},
  effect:{...ORPHAN_SIX_B_FIXED_EFFECT}
 };
 const raw=Buffer.from(JSON.stringify(manifest)+'\n');
 body.approvalManifestSha256=sha(raw);
 const issue={title:'pc-controller-orphan-six-graceful-once',
  state:'OPEN',number:6201,author:{login:OWNER},
  labels:[{name:'pc-maintenance'}],body:JSON.stringify(body)};
 const pr={number:6200,state:'closed',merged:true,
  merged_at:'2026-11-27T01:00:00Z',
  head:{sha:manifest.approval.reviewedSourceSha,repo:{full_name:REPO}},
  base:{repo:{full_name:REPO}}};
 const comment=(decision='APPROVE')=>({
  id:41000,user:{login:OWNER},
  created_at:'2026-11-27T01:01:00Z',
  updated_at:'2026-11-27T01:01:00Z',
  html_url:'https://github.com/'+REPO+'/issues/6201#issuecomment-41000',
  body:JSON.stringify({schema:'ZGMINI_ORPHAN_SIX_B_OWNER_DECISION_V1',
   decision,requestId:body.requestId,
   approvalManifestSha256:body.approvalManifestSha256,
   reviewedSourceSha:manifest.approval.reviewedSourceSha,
   scope:ORPHAN_SIX_B_SCOPE,operation:body.operation,
   effect:'SIX_ORPHAN_LISTENER_GRACEFUL_STOP_ONCE',
   installedControllerSha:body.targetControllerSha})
 });
 const calls=[];
 const p={
  attestCurrentMaintainerSource:async()=>{calls.push('source');return {
   origin:'PRIVATE_INDEPENDENT_B_MAINTAINER',
   verifiedNinePinnedMaintainerFiles:true,
   currentMaintainerSourceUnchangedVerified:true
  };},
  readOriginalOneUseClaim:async()=>{calls.push('claim');return null;},
  getMainManifest:async(rel,ref)=>{
   calls.push('manifest');assert.equal(ref,'main');
   assert.equal(rel,'approvals/controller-orphan-six/'+sha(raw)+'.json');
   return raw;
  },
  getPullRequest:async()=>{calls.push('pr');return pr;},
  getOwnerEffectComments:async()=>{calls.push('comments');return {
   source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',
   complete:true,issueNumber:6201,items:[comment()]
  };},
  getInstalledReadback:async()=>{calls.push('installed');return {
   origin:'PRIVATE_INDEPENDENT_B_MAINTAINER',
   currentInstallVerified:true,sourceFilesVerified:true,
   controllerBPolicyUnchangedVerified:true,
   installedControllerSha:manifest.installedControllerSha,
   installedMaintainerSha:manifest.installedMaintainerSha,
   maintenanceFilesSha256:manifest.maintenanceFilesSha256
  };}
 };
 return {body,issue,manifest,raw,pr,comment,p,calls};
}
test('flat request parser requires exactly seven distinct scalar fields',()=>{
 const f=sample();
 assert.deepEqual(parseOrphanSixBFlatRequest(f.issue.body),f.body);
 for(const raw of [
  f.issue.body.slice(0,-1)+',"requestId":"pc-ffffffff-ffff-ffff-ffff-ffffffffffff"}',
  f.issue.body.slice(0,-1)+',"operation":1}',
  f.issue.body.slice(0,-1)+',"extra":"x"}',
  f.issue.body.replace('"chat-orphan-six-source-only"','null'),
  f.issue.body.slice(0,-1)+',}',
  f.issue.body+'{}',
  '{"schema":{"nested":true}}',
  '[]',
  ''.padEnd(20000,'X')
 ])assert.throws(()=>parseOrphanSixBFlatRequest(raw));
});
test('verified canonical merged source and exact owner decision yield non-executable candidate',async()=>{
 const f=sample();
 const r=await inspectOrphanSixBMaintainerInletSource({issue:f.issue,...f.p});
 assert.equal(r.status,'CANDIDATE_ONLY');
 assert.equal(r.approvalSourceVerified,true);
 assert.equal(r.effectAuthorized,false);
 assert.equal(r.runnerStopAuthorized,false);
 assert.equal(r.executionStarted,false);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.automaticRetries,0);
 assert.deepEqual(f.calls.sort(),['source','claim','manifest','pr','comments','installed'].sort());
 assert.doesNotMatch(JSON.stringify(r),/Runner.Listener|oldOwnerRawSha256|birth|nonce/);
});
test('bot, missing source callbacks and installed source drift cannot be interpreted as B authority',async()=>{
 const bot=sample();bot.issue.author.login='github-actions[bot]';
 const denied=await inspectOrphanSixBMaintainerInletSource({issue:bot.issue,...bot.p});
 assert.equal(denied.code,'ORPHAN_SIX_B_UNTRUSTED_ISSUE');
 assert.equal(bot.calls.length,0);
 const missing=sample();
 assert.equal((await inspectOrphanSixBMaintainerInletSource({issue:missing.issue}))
  .code,'ORPHAN_SIX_B_SOURCE_READ_PORTS_MISSING');
 const drift=sample();
 drift.p.attestCurrentMaintainerSource=async()=>({
  origin:'PRIVATE_INDEPENDENT_B_MAINTAINER',verifiedNinePinnedMaintainerFiles:false,
  currentMaintainerSourceUnchangedVerified:true
 });
 const x=await inspectOrphanSixBMaintainerInletSource({issue:drift.issue,...drift.p});
 assert.equal(x.code,'ORPHAN_SIX_B_MAINTAINER_SOURCE_UNVERIFIED');
 assert.equal(drift.calls.length,0);
});
test('old journal claim forbids resubmission even when canonical B approval is valid',async()=>{
 const f=sample();
 f.p.readOriginalOneUseClaim=async()=>({phase:'STOP_INTENT_RECORDED'});
 const r=await inspectOrphanSixBMaintainerInletSource({issue:f.issue,...f.p});
 assert.equal(r.code,'ORPHAN_SIX_B_ORIGINAL_CLAIM_RECONCILE_FIRST');
 assert.equal(r.operationalWrites,0);
 assert.deepEqual(f.calls,['source']);
});
test('revoked explicit B effect, readback outage and duplicate raw ID fail closed',async()=>{
 const f=sample();
 f.p.getOwnerEffectComments=async()=>({
  source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',
  complete:true,issueNumber:6201,items:[f.comment('REVOKE')]
 });
 assert.equal((await inspectOrphanSixBMaintainerInletSource({issue:f.issue,...f.p})).status,'BLOCKED');
 const g=sample();g.p.readOriginalOneUseClaim=async()=>{throw Error('readoutage');};
 assert.equal((await inspectOrphanSixBMaintainerInletSource({issue:g.issue,...g.p})).status,'BLOCKED');
 const h=sample();h.issue.body=h.issue.body.slice(0,-1)+',"requestId":"pc-ffffffff-ffff-ffff-ffff-ffffffffffff"}';
 assert.equal((await inspectOrphanSixBMaintainerInletSource({issue:h.issue,...h.p}))
  .code,'ORPHAN_SIX_B_RAW_REQUEST_INVALID');
 assert.equal(h.calls.length,0);
});
test('future B inlet module is source-only: no built-in process or filesystem effects',()=>{
 const src=fs.readFileSync(new URL(
  '../tools/supervisor-orphan-six-b-maintainer-inlet-source.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/from ['"]node:(?:child_process|fs|net|http|https)['"]/);
 assert.doesNotMatch(src,/\b(?:execFile|spawnSync|taskkill|GenerateConsoleCtrlEvent)\s*\(/);
});
