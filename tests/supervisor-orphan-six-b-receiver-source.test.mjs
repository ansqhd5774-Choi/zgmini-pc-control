import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
 ORPHAN_SIX_B_TITLE,ORPHAN_SIX_B_OPERATION,
 ORPHAN_SIX_B_REQUEST_SCHEMA,ORPHAN_SIX_B_MANIFEST_SCHEMA,
 ORPHAN_SIX_B_SCOPE,ORPHAN_SIX_B_FIXED_EFFECT
} from '../tools/supervisor-orphan-six-b-admission.mjs';
import {receiveOrphanSixBApprovalSource}
 from '../tools/supervisor-orphan-six-b-receiver-source.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const d=s=>s.repeat(64), repo='ansqhd5774-Choi/zgmini-pc-control';
function sample(){
 const issueBody={
  schema:ORPHAN_SIX_B_REQUEST_SCHEMA,operation:ORPHAN_SIX_B_OPERATION,
  controlRepository:repo,requestId:'pc-12345678-1234-4234-9234-123456789abc',
  chatId:'chat-orphan-s6-b-source-20261127',
  targetControllerSha:'a'.repeat(40),approvalManifestSha256:d('0')
 };
 const manifest={
  schema:ORPHAN_SIX_B_MANIFEST_SCHEMA,operation:ORPHAN_SIX_B_OPERATION,
  requestId:issueBody.requestId,installedControllerSha:issueBody.targetControllerSha,
  installedMaintainerSha:'b'.repeat(40),
  maintenanceFilesSha256:d('c'),watchdogSourceSha256:d('d'),
  oldOwnerRawSha256:d('e'),heartbeatRawSha256:d('f'),hostRawSha256:d('a'),
  privateOriginalSixSeatDigestSha256:d('b'),
  approval:{approved:true,grade:'B',scope:ORPHAN_SIX_B_SCOPE,
   ref:'https://github.com/'+repo+'/pull/6200',reviewedSourceSha:'c'.repeat(40)},
  effect:{...ORPHAN_SIX_B_FIXED_EFFECT}
 };
 const raw=Buffer.from(JSON.stringify(manifest)+'\n');
 issueBody.approvalManifestSha256=hash(raw);
 const issue={number:6201,title:ORPHAN_SIX_B_TITLE,state:'open',
  author:{login:'ansqhd5774-Choi'},labels:[{name:'pc-maintenance'}],
  body:JSON.stringify(issueBody)};
 const pr={number:6200,state:'closed',merged:true,
  merged_at:'2026-11-27T04:00:00Z',
  head:{sha:manifest.approval.reviewedSourceSha,repo:{full_name:repo}},
  base:{repo:{full_name:repo}}};
 const reviews=[{user:{login:'ansqhd5774-Choi'},state:'APPROVED',
  commit_id:pr.head.sha,submitted_at:'2026-11-27T03:59:00Z'}];
 const installed={origin:'PRIVATE_INDEPENDENT_B_MAINTAINER',
  currentInstallVerified:true,sourceFilesVerified:true,
  controllerBPolicyUnchangedVerified:true,
  installedControllerSha:manifest.installedControllerSha,
  installedMaintainerSha:manifest.installedMaintainerSha,
  maintenanceFilesSha256:manifest.maintenanceFilesSha256};
 const calls=[];
 const ports={
  getMainManifest:async(p,ref)=>{calls.push(['manifest',p,ref]);return raw;},
  getPullRequest:async(n)=>{calls.push(['pr',n]);return pr;},
  getReviews:async(n)=>{calls.push(['reviews',n]);return {source:'GITHUB_CANONICAL_REVIEW_API',complete:true,items:reviews};},
  getInstalledReadback:async()=>{calls.push(['installed']);return installed;},
  readOriginalOneUseClaim:async(id)=>{calls.push(['claim',id]);return null;}
 };
 return {issueBody,issue,manifest,raw,pr,reviews,installed,ports,calls};
}
test('receiver uses canonical main digest and merged owner-reviewed PR and installed CAS',async()=>{
 const f=sample();
 const result=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
 assert.equal(result.status,'CANDIDATE_ONLY');
 assert.equal(result.approvalSourceVerified,true);
 assert.equal(result.effectAuthorized,false);
 assert.equal(result.runnerStopAuthorized,false);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.automaticRetries,0);
 assert.equal(result.approvalPrNumber,6200);
 assert.equal(result.manifestRawSha256,hash(f.raw));
 assert.deepEqual(f.calls[0],['claim',f.issueBody.requestId]);
 assert.deepEqual(f.calls[1],['manifest',
  'approvals/controller-orphan-six/'+hash(f.raw)+'.json','main']);
 assert.equal(f.calls.some(c=>c[0]==='pr'&&c[1]===6200),true);
 assert.doesNotMatch(JSON.stringify(result),/Runner.Listener|oldOwnerRawSha256|birth|nonce|watchdogSourceSha256/);
});
test('bot, missing label, mismatched title and oversized body never read remote',async()=>{
 for(const mutate of [
  x=>{x.issue.author.login='github-actions[bot]';},
  x=>{x.issue.title='pc-controller-s6-once';},
  x=>{x.issue.labels=[];},
  x=>{x.issue.state='closed';},
  x=>{x.issue.body='X'.repeat(20000);}
 ]){
  const f=sample();mutate(f);
  const r=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
  assert.equal(r.status,'BLOCKED');
  assert.equal(f.calls.length,0);
 }
});
test('missing read ports fail closed with no effect',async()=>{
 const f=sample();
 const result=await receiveOrphanSixBApprovalSource({
  issue:f.issue,getMainManifest:f.ports.getMainManifest
 });
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'ORPHAN_SIX_B_RECEIVER_READ_PORTS_MISSING');
 assert.equal(f.calls.length,0);
});
test('prior one-use claim or failed prior-check cannot replay',async()=>{
 const f=sample();
 f.ports.readOriginalOneUseClaim=async()=>({phase:'STOP_INTENT_RECORDED'});
 const r=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
 assert.equal(r.code,'ORPHAN_SIX_B_ORIGINAL_CLAIM_RECONCILE_FIRST');
 assert.equal(f.calls.length,0);
 const f2=sample();f2.ports.readOriginalOneUseClaim=async()=>{throw Error('unavailable');};
 const b=await receiveOrphanSixBApprovalSource({issue:f2.issue,...f2.ports});
 assert.equal(b.code,'ORPHAN_SIX_B_APPROVAL_OR_INSTALLED_READBACK_UNKNOWN');
 assert.equal(b.effectAuthorized,false);
});
test('PR merge and matching final head owner approval are mandatory',async()=>{
 for(const mutate of [
  x=>{x.pr.merged=false;},
  x=>{x.pr.head.sha='f'.repeat(40);},
  x=>{x.pr.head.repo.full_name='someone/other';},
  x=>{x.pr.base.repo.full_name='someone/other';},
  x=>{x.reviews[0].user.login='unknown-reviewer';},
  x=>{x.reviews[0].state='COMMENTED';},
  x=>{x.reviews[0].commit_id='f'.repeat(40);},
  x=>{x.reviews[0].submitted_at='2026-11-27T05:00:00Z';}
 ]){
  const f=sample();mutate(f);
  const x=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
  assert.equal(x.status,'BLOCKED');
  assert.equal(x.code,'ORPHAN_SIX_B_APPROVAL_REVIEW_OR_MERGE_UNVERIFIED');
 }
});
test('incomplete review pagination or noncanonical responses never establish B approval',async()=>{
 for(const readback of [
  {source:'GITHUB_CANONICAL_REVIEW_API',complete:false,items:sample().reviews},
  {source:'ISSUE_BODY',complete:true,items:sample().reviews},
  sample().reviews
 ]){
  const f=sample();
  f.ports.getReviews=async()=>readback;
  const result=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
  assert.equal(result.code,'ORPHAN_SIX_B_APPROVAL_REVIEW_OR_MERGE_UNVERIFIED');
  assert.equal(result.effectAuthorized,false);
 }
});
test('dismissed exact-head review is not approval',async()=>{
 const f=sample();
 f.reviews.push({user:{login:'ansqhd5774-Choi'},state:'DISMISSED',
  commit_id:f.pr.head.sha,submitted_at:'2026-11-27T03:59:30Z'});
 const r=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.runnerStopAuthorized,false);
});
test('latest exact-head owner approval is independent of API review order',async()=>{
 const later='2026-11-27T03:59:45Z';
 const between='2026-11-27T03:59:30Z';
 const f=sample();
 f.reviews.unshift({user:{login:'ansqhd5774-Choi'},state:'APPROVED',
  commit_id:f.pr.head.sha,submitted_at:later});
 f.reviews.push({user:{login:'ansqhd5774-Choi'},state:'DISMISSED',
  commit_id:f.pr.head.sha,submitted_at:between});
 const ok=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
 assert.equal(ok.status,'CANDIDATE_ONLY');
 assert.equal(ok.effectAuthorized,false);
 assert.equal(ok.runnerStopAuthorized,false);
 f.reviews.push({user:{login:'ansqhd5774-Choi'},state:'DISMISSED',
  commit_id:f.pr.head.sha,submitted_at:later});
 const blocked=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
 assert.equal(blocked.code,'ORPHAN_SIX_B_APPROVAL_REVIEW_OR_MERGE_UNVERIFIED');
 assert.equal(blocked.effectAuthorized,false);
});

test('manifest byte drift, arbitrary digest or fabricated B effect fail closed',async()=>{
 const f=sample();
 f.ports.getMainManifest=async()=>Buffer.from(JSON.stringify(f.manifest));
 const drift=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
 assert.equal(drift.code,'ORPHAN_SIX_B_APPROVAL_RAW_BYTES_UNVERIFIED');
 const k=sample();k.manifest.effect.noForceKill=false;
 const mutated=Buffer.from(JSON.stringify(k.manifest)+'\n');
 k.issueBody.approvalManifestSha256=hash(mutated);
 k.issue.body=JSON.stringify(k.issueBody);
 k.ports.getMainManifest=async()=>mutated;
 const r=await receiveOrphanSixBApprovalSource({issue:k.issue,...k.ports});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'ORPHAN_SIX_B_APPROVAL_OR_INSTALLED_READBACK_UNKNOWN');
});
test('installed source, files digest and Controller B policy unchanged must read back',async()=>{
 for(const patch of [
  x=>{x.installed.currentInstallVerified=false;},
  x=>{x.installed.sourceFilesVerified=false;},
  x=>{x.installed.controllerBPolicyUnchangedVerified=false;},
  x=>{x.installed.installedControllerSha='f'.repeat(40);},
  x=>{x.installed.installedMaintainerSha='f'.repeat(40);},
  x=>{x.installed.maintenanceFilesSha256=d('f');},
  x=>{x.installed.origin='GITHUB_ACTION';}
 ]){
  const f=sample();patch(f);
  const r=await receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
  assert.equal(r.code,'ORPHAN_SIX_B_INSTALLED_SOURCE_CAS_UNVERIFIED');
  assert.equal(r.effectAuthorized,false);
 }
});
test('even a simulated positive receiver result has no OS or filesystem writes',()=>{
 const source=fs.readFileSync(new URL('../tools/supervisor-orphan-six-b-receiver-source.mjs',
  import.meta.url),'utf8');
 for(const forbidden of [/\bexecFile\(/,/\bspawn\(/,/\btaskkill\b/i,
  /GenerateConsoleCtrlEvent/,/Stop-Process/,/\bwriteFileSync\(/,
  /\brenameSync\(/,/\bfetch\(/,/\bmkdirSync\(/])
  assert.doesNotMatch(source,forbidden);
 assert.match(source,/effectAuthorized:false/);
 assert.match(source,/runnerStopAuthorized:false/);
});
