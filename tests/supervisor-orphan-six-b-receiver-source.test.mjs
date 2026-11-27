import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
 ORPHAN_SIX_B_TITLE,ORPHAN_SIX_B_OPERATION,
 ORPHAN_SIX_B_REQUEST_SCHEMA,ORPHAN_SIX_B_MANIFEST_SCHEMA,
 ORPHAN_SIX_B_SCOPE,ORPHAN_SIX_B_FIXED_EFFECT
} from '../tools/supervisor-orphan-six-b-admission.mjs';
import {receiveOrphanSixBApprovalSource,recheckOrphanSixFreshOwnerEffectSource}
 from '../tools/supervisor-orphan-six-b-receiver-source.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const d=s=>s.repeat(64);
const repo='ansqhd5774-Choi/zgmini-pc-control',owner='ansqhd5774-Choi';
const MERGED='2026-11-27T04:00:00Z';
const AFTER='2026-11-27T04:01:00Z';
const LATER='2026-11-27T04:03:00Z';
const LAST='2026-11-27T04:04:00Z';
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
  oldOwnerRawSha256:d('e'),heartbeatRawSha256:d('f'),
  hostRawSha256:d('a'),privateOriginalSixSeatDigestSha256:d('b'),
  approval:{approved:true,grade:'B',scope:ORPHAN_SIX_B_SCOPE,
   ref:'https://github.com/'+repo+'/pull/6200',reviewedSourceSha:'c'.repeat(40)},
  effect:{...ORPHAN_SIX_B_FIXED_EFFECT}
 };
 const raw=Buffer.from(JSON.stringify(manifest)+'\n');
 issueBody.approvalManifestSha256=hash(raw);
 const issue={number:6201,title:ORPHAN_SIX_B_TITLE,state:'open',
  author:{login:owner},labels:[{name:'pc-maintenance'}],body:JSON.stringify(issueBody)};
 const pr={number:6200,state:'closed',merged:true,merged_at:MERGED,
  head:{sha:manifest.approval.reviewedSourceSha,repo:{full_name:repo}},
  base:{repo:{full_name:repo}}};
 const installed={origin:'PRIVATE_INDEPENDENT_B_MAINTAINER',
  currentInstallVerified:true,sourceFilesVerified:true,
  controllerBPolicyUnchangedVerified:true,
  installedControllerSha:manifest.installedControllerSha,
  installedMaintainerSha:manifest.installedMaintainerSha,
  maintenanceFilesSha256:manifest.maintenanceFilesSha256};
 const comment=(decision='APPROVE',id=41000,time=AFTER)=>({
  id,user:{login:owner},created_at:time,updated_at:time,
  html_url:'https://github.com/'+repo+'/issues/6201#issuecomment-'+id,
  body:JSON.stringify({
   schema:'ZGMINI_ORPHAN_SIX_B_OWNER_DECISION_V1',decision,
   requestId:issueBody.requestId,
   approvalManifestSha256:issueBody.approvalManifestSha256,
   reviewedSourceSha:pr.head.sha,scope:ORPHAN_SIX_B_SCOPE,
   operation:ORPHAN_SIX_B_OPERATION,
   effect:'SIX_ORPHAN_LISTENER_GRACEFUL_STOP_ONCE',
   installedControllerSha:manifest.installedControllerSha
  })
 });
 const comments=[comment()];
 const calls=[];
 const ports={
  getMainManifest:async(p,ref)=>{calls.push(['manifest',p,ref]);return raw;},
  getPullRequest:async(n)=>{calls.push(['pr',n]);return pr;},
  getOwnerEffectComments:async(n)=>{calls.push(['comments',n]);return {
   source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',complete:true,issueNumber:n,items:comments};},
  getInstalledReadback:async()=>{calls.push(['installed']);return installed;},
  readOriginalOneUseClaim:async(id)=>{calls.push(['claim',id]);return null;}
 };
 return {issueBody,issue,manifest,raw,pr,installed,comments,comment,ports,calls};
}
const receive=f=>receiveOrphanSixBApprovalSource({issue:f.issue,...f.ports});
test('merged exact source, canonical explicit owner B comment and installed CAS yield only a candidate',async()=>{
 const f=sample(),r=await receive(f);
 assert.equal(r.status,'CANDIDATE_ONLY');
 assert.equal(r.approvalSourceVerified,true);
 assert.equal(r.effectAuthorized,false);
 assert.equal(r.runnerStopAuthorized,false);
 assert.equal(r.executionStarted,false);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.automaticRetries,0);
 assert.equal(r.approvalPrNumber,6200);
 assert.equal(r.manifestRawSha256,hash(f.raw));
 assert.deepEqual(f.calls[0],['claim',f.issueBody.requestId]);
 assert.deepEqual(f.calls[1],['manifest',
  'approvals/controller-orphan-six/'+hash(f.raw)+'.json','main']);
 assert.ok(f.calls.some(c=>c[0]==='comments'&&c[1]===6201));
 assert.doesNotMatch(JSON.stringify(r),/Runner.Listener|oldOwnerRawSha256|birth|nonce|watchdogSourceSha256/);
});
test('untrusted or malformed request cannot trigger remote reads',async()=>{
 for(const mutate of [
  f=>{f.issue.author.login='github-actions[bot]';},
  f=>{f.issue.title='pc-controller-s6-once';},
  f=>{f.issue.labels=[];},
  f=>{f.issue.state='closed';},
  f=>{f.issue.body='X'.repeat(20000);}
 ]){
  const f=sample();mutate(f);
  assert.equal((await receive(f)).status,'BLOCKED');
  assert.equal(f.calls.length,0);
 }
});
test('missing read callback and prior one-use claim block without effect or retry',async()=>{
 const f=sample();
 const missing=await receiveOrphanSixBApprovalSource({
  issue:f.issue,getMainManifest:f.ports.getMainManifest
 });
 assert.equal(missing.code,'ORPHAN_SIX_B_RECEIVER_READ_PORTS_MISSING');
 assert.equal(f.calls.length,0);
 f.ports.readOriginalOneUseClaim=async()=>({phase:'STOP_INTENT_RECORDED'});
 assert.equal((await receive(f)).code,'ORPHAN_SIX_B_ORIGINAL_CLAIM_RECONCILE_FIRST');
 assert.equal(f.calls.length,0);
 const other=sample();
 other.ports.readOriginalOneUseClaim=async()=>{throw Error('not readable');};
 assert.equal((await receive(other)).code,
  'ORPHAN_SIX_B_APPROVAL_OR_INSTALLED_READBACK_UNKNOWN');
});
test('merged final source SHA, repository, PR number and date must match',async()=>{
 for(const mutate of [
  f=>{f.pr.merged=false;},
  f=>{f.pr.head.sha='f'.repeat(40);},
  f=>{f.pr.head.repo.full_name='other/repo';},
  f=>{f.pr.base.repo.full_name='other/repo';},
  f=>{f.pr.number=6203;},
  f=>{f.pr.merged_at=null;}
 ]){
  const f=sample();mutate(f);
  const r=await receive(f);
  assert.equal(r.code,'ORPHAN_SIX_B_MERGED_SOURCE_UNVERIFIED');
  assert.equal(r.effectAuthorized,false);
 }
});
test('self-merged PR alone is not owner approval: separate exact B comment required',async()=>{
 const f=sample();f.comments.length=0;
 assert.equal((await receive(f)).code,'ORPHAN_SIX_B_OWNER_EXACT_EFFECT_APPROVAL_UNVERIFIED');
 const g=sample();g.comments[0].user.login='github-actions[bot]';
 assert.equal((await receive(g)).code,'ORPHAN_SIX_B_OWNER_EXACT_EFFECT_APPROVAL_UNVERIFIED');
});
test('incomplete or untrusted comment pagination cannot authorize B',async()=>{
 const readbacks=[
  {source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',complete:false,issueNumber:6201,items:[sample().comment()]},
  {source:'ISSUE_BODY',complete:true,issueNumber:6201,items:[sample().comment()]},
  {source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',complete:true,issueNumber:6202,items:[sample().comment()]},
  [sample().comment()]
 ];
 for(const v of readbacks){
  const f=sample();f.ports.getOwnerEffectComments=async()=>v;
  const r=await receive(f);
  assert.equal(r.code,'ORPHAN_SIX_B_OWNER_EXACT_EFFECT_APPROVAL_UNVERIFIED');
  assert.equal(r.runnerStopAuthorized,false);
 }
});
test('owner comment must be immutable, post merge, canonical and exact raw CAS',async()=>{
 for(const change of [
  c=>{c.updated_at=LATER;},
  c=>{c.created_at=MERGED;c.updated_at=MERGED;},
  c=>{c.html_url='https://github.com/other/repo/issues/6201#issuecomment-41000';},
  c=>{c.body=c.body+' ';},
  c=>{const m=JSON.parse(c.body);m.requestId='pc-ffffffff-ffff-ffff-ffff-ffffffffffff';c.body=JSON.stringify(m);},
  c=>{const m=JSON.parse(c.body);m.approvalManifestSha256=d('f');c.body=JSON.stringify(m);},
  c=>{const m=JSON.parse(c.body);m.reviewedSourceSha=d('f').slice(0,40);c.body=JSON.stringify(m);},
  c=>{const m=JSON.parse(c.body);m.effect='FORCE_KILL_ALL';c.body=JSON.stringify(m);},
  c=>{const m=JSON.parse(c.body);m.scope='CONTROLLER_B_POLICY_REPLACE';c.body=JSON.stringify(m);},
  c=>{const m=JSON.parse(c.body);m.extra=true;c.body=JSON.stringify(m);}
 ]){
  const f=sample();change(f.comments[0]);
  const r=await receive(f);
  // Space in a JSON comment is syntactically valid, but the parsed exact
  // effect statement is still the same. Other changes must fail closed.
  if(f.comments[0].body.endsWith(' '))assert.equal(r.status,'CANDIDATE_ONLY');
  else assert.equal(r.code,'ORPHAN_SIX_B_OWNER_EXACT_EFFECT_APPROVAL_UNVERIFIED');
 }
});
test('one later owner REVOKE blocks despite prior APPROVE and unordered API results',async()=>{
 const f=sample();
 f.comments.push(f.comment('REVOKE',41001,LATER));
 let r=await receive(f);
 assert.equal(r.code,'ORPHAN_SIX_B_OWNER_EXACT_EFFECT_APPROVAL_UNVERIFIED');
 f.comments.reverse();
 r=await receive(f);
 assert.equal(r.code,'ORPHAN_SIX_B_OWNER_EXACT_EFFECT_APPROVAL_UNVERIFIED');
 f.comments.push(f.comment('APPROVE',41002,LAST));
 assert.equal((await receive(f)).status,'CANDIDATE_ONLY');
});
test('same-second approval and revoke conflict fails closed',async()=>{
 const f=sample();f.comments.push(f.comment('REVOKE',41001,AFTER));
 assert.equal((await receive(f)).code,'ORPHAN_SIX_B_OWNER_EXACT_EFFECT_APPROVAL_UNVERIFIED');
});
test('raw manifest bytes and effect scope drift do not pass',async()=>{
 const f=sample();
 f.ports.getMainManifest=async()=>Buffer.from(JSON.stringify(f.manifest));
 assert.equal((await receive(f)).code,'ORPHAN_SIX_B_APPROVAL_RAW_BYTES_UNVERIFIED');
 const other=sample();
 other.manifest.effect.noForceKill=false;
 const raw=Buffer.from(JSON.stringify(other.manifest)+'\n');
 other.issueBody.approvalManifestSha256=hash(raw);
 other.issue.body=JSON.stringify(other.issueBody);
 other.comments[0]=other.comment();
 other.ports.getMainManifest=async()=>raw;
 assert.equal((await receive(other)).status,'BLOCKED');
});
test('installed controller and maintainer SHA, file digest, policy pin all necessary',async()=>{
 for(const mutate of [
  f=>{f.installed.currentInstallVerified=false;},
  f=>{f.installed.sourceFilesVerified=false;},
  f=>{f.installed.controllerBPolicyUnchangedVerified=false;},
  f=>{f.installed.installedControllerSha='f'.repeat(40);},
  f=>{f.installed.installedMaintainerSha='f'.repeat(40);},
  f=>{f.installed.maintenanceFilesSha256=d('f');},
  f=>{f.installed.origin='GITHUB_ACTION';}
 ]){
  const f=sample();mutate(f);
  const r=await receive(f);
  assert.equal(r.code,'ORPHAN_SIX_B_INSTALLED_SOURCE_CAS_UNVERIFIED');
  assert.equal(r.effectAuthorized,false);
 }
});
test('receiver is source-only and has no process or filesystem effects',()=>{
 const src=fs.readFileSync(new URL(
  '../tools/supervisor-orphan-six-b-receiver-source.mjs',import.meta.url),'utf8');
 for(const forbidden of [/\bexecFile\(/,/\bspawn\(/,/\btaskkill\b/i,
  /GenerateConsoleCtrlEvent/,/Stop-Process/,/\bwriteFileSync\(/,
  /\brenameSync\(/,/\bfetch\(/,/\bmkdirSync\(/])
  assert.doesNotMatch(src,forbidden);
 assert.match(src,/effectAuthorized:false/);
 assert.match(src,/runnerStopAuthorized:false/);
});

const freshSeat=(f,seat=1,extra={})=>
 recheckOrphanSixFreshOwnerEffectSource({
  issue:f.issue,seat,proposalId:d('e'),
  expectedJournalSha256:d('f'),
  expectedRequestId:f.issueBody.requestId,
  expectedManifestRawSha256:hash(f.raw),
  getMainManifest:f.ports.getMainManifest,
  getPullRequest:f.ports.getPullRequest,
  getOwnerEffectComments:f.ports.getOwnerEffectComments,
  ...extra
 });

test('per-seat fresh owner approval re-reads canonical PR, comments and raw bytes; source grants zero effect',async()=>{
 const f=sample();
 for(const seat of [1,2,3,4,5,6]){
  const r=await freshSeat(f,seat);
  assert.equal(r.status,'CANDIDATE_ONLY');
  assert.equal(r.code,'ORPHAN_SIX_FRESH_DECISION_REVIEW_ONLY');
  assert.equal(r.seat,seat);
  assert.equal(r.manifestRawSha256,hash(f.raw));
  assert.equal(r.intentReadbackSha256,d('f'));
  assert.equal(r.effectAuthorized,false);
  assert.equal(r.runnerStopAuthorized,false);
  assert.equal(r.operationalWrites,0);
  assert.equal(r.automaticRetries,0);
 }
 for(const kind of ['manifest','pr','comments'])
  assert.equal(f.calls.filter(x=>x[0]===kind).length,6,kind);
 assert.equal(f.calls.some(x=>x[0]==='claim'),false);
});
test('fresh owner REVOKE between seats prevents every subsequent source candidate',async()=>{
 const f=sample();
 assert.equal((await freshSeat(f,1)).status,'CANDIDATE_ONLY');
 f.comments.push(f.comment('REVOKE',41001,LATER));
 for(const seat of [2,3,4,5,6]){
  const result=await freshSeat(f,seat);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'ORPHAN_SIX_FRESH_DECISION_LATEST_OWNER_APPROVAL_UNVERIFIED');
  assert.equal(result.runnerStopAuthorized,false);
 }
 assert.equal(f.calls.filter(x=>x[0]==='comments').length,6);
});
test('fresh owner decision rejects missing full comment readback, edited approval and canonical read outage',async()=>{
 const noPages=sample();
 noPages.ports.getOwnerEffectComments=async()=>({
  source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',
  complete:false,issueNumber:noPages.issue.number,items:noPages.comments
 });
 assert.equal((await freshSeat(noPages)).status,'BLOCKED');
 const edited=sample();
 edited.comments[0].updated_at=LATER;
 assert.equal((await freshSeat(edited)).code,
  'ORPHAN_SIX_FRESH_DECISION_LATEST_OWNER_APPROVAL_UNVERIFIED');
 const down=sample();
 down.ports.getOwnerEffectComments=async()=>{throw Error('canonical API outage');};
 assert.equal((await freshSeat(down)).code,'ORPHAN_SIX_FRESH_DECISION_READBACK_UNKNOWN');
});
test('fresh decision blocks changed raw manifest or merged PR, never allows OS action',async()=>{
 const raw=sample();
 raw.ports.getMainManifest=async()=>Buffer.from(JSON.stringify(raw.manifest));
 assert.equal((await freshSeat(raw)).code,'ORPHAN_SIX_FRESH_DECISION_MANIFEST_CAS_CHANGED');
 const pr=sample();
 pr.pr.head.sha='a'.repeat(40);
 assert.equal((await freshSeat(pr)).code,'ORPHAN_SIX_FRESH_DECISION_MERGED_PR_UNVERIFIED');
 const invalid=sample();
 const originalRequestId=invalid.issueBody.requestId;
 invalid.issueBody.requestId='pc-12345678-1234-4234-9234-ffffffffffff';
 invalid.issue.body=JSON.stringify(invalid.issueBody);
 assert.equal((await freshSeat(invalid,1,{expectedRequestId:originalRequestId})).code,
  'ORPHAN_SIX_FRESH_DECISION_REQUEST_PIN_CHANGED');
});
test('duplicate raw Issue ID is blocked at initial and fresh seat B approval boundaries',async()=>{
 const f=sample();
 const initial=await receive(f);
 assert.equal(initial.status,'CANDIDATE_ONLY');
 const first=await freshSeat(f,1);
 assert.equal(first.status,'CANDIDATE_ONLY');
 // A modified raw Issue body may parse last-key-wins to a valid request,
 // but neither admission nor any later seat may trust that ambiguous JSON.
 f.issue.body=f.issue.body.replace(
  '"requestId":','"requestId":"pc-ffffffff-ffff-ffff-ffff-ffffffffffff","requestId":');
 const after=await receive(f);
 assert.equal(after.code,'ORPHAN_SIX_B_REQUEST_UNVERIFIED');
 const second=await freshSeat(f,2);
 assert.equal(second.code,'ORPHAN_SIX_FRESH_DECISION_REQUEST_UNVERIFIED');
 assert.equal(second.operationalWrites,0);
 assert.equal(second.runnerStopAuthorized,false);
});
test('fresh seat B approval rejects trailing comma and malformed raw token',async()=>{
 for(const change of [
  raw=>raw.slice(0,-1)+',}',
  raw=>raw.slice(0,-1)+',"unexpected":"x"}',
  raw=>raw+'{}'
 ]){
  const f=sample();
  f.issue.body=change(f.issue.body);
  const r=await freshSeat(f,2);
  assert.equal(r.code,'ORPHAN_SIX_FRESH_DECISION_REQUEST_UNVERIFIED');
  assert.equal(f.calls.length,0);
 }
});

test('fresh decision refuses missing seat/journal/proposal pins before any canonical reads',async()=>{
 const f=sample();
 for(const override of [{seat:0},{seat:7},{proposalId:'bad'},
  {expectedJournalSha256:'bad'},{expectedManifestRawSha256:'bad'},
  {getOwnerEffectComments:null}]){
  const r=await freshSeat(f,1,override);
  assert.equal(r.code,'ORPHAN_SIX_FRESH_DECISION_CONTEXT_UNVERIFIED');
  assert.equal(r.operationalWrites,0);
 }
 assert.equal(f.calls.length,0);
});
