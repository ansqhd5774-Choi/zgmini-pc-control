import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build996ConsentComment,review996CConsent}
 from '../tools/controller-996-c-consent-verifier.mjs';

const h=n=>n.toString(16).repeat(64);
const sha=b=>createHash('sha256').update(b).digest('hex');
const requestId='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const rawKeys=['ledger','owner','recoveryMarker','backlog','controllerHost',
 'stagedHost','maintainerManifest'];

function fixture(){
 const manifest={schema:'ZGMINI_CONTROLLER_996_C_APPROVAL_V1',
  approved:true,grade:'C',operation:'RECONCILE_INTAKE_PAUSED_ONLY',
  executionScope:'ORIGINAL_WINDOWS_ONE_SHOT',
  authorizationMode:'PHASE_SCOPED_EVIDENCE_EXCEPTION',
  requestId,issueNumber:996,
  controllerSha:'badad9124157879d7a645b64f2768113d632355b',
  targetSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
  maintainerSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
  acceptsUnprovenGitHubDisableActor:true,
  acceptsMissingHistoricalProtectedBaseline:true,
  acceptsNoAllActorsImmutabilityProof:true,
  phaseScopedSourceProof:{
   maintainerSourceSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
   failureFirstPhase:'INTAKE_PAUSED',failureCode:'RUNNER_SET_DRIFT',
   reachedBackup:false,reachedControllerSwitch:false,
   claimsIndependentDisableActorAudit:false,
   claimsAllActorsProtectedImmutability:false},
  acceptedGaps:['workflowDisableActorVerified','protectedBaselineVerified'],
  allowedEffects:['CREATE_AND_ARCHIVE_OWN_C_RECOVERY_CLAIM',
   'WRITE_C_SCOPED_AUDIT_AND_ATTEMPT_MARKERS',
   'ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE',
   'CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE',
   'READ_ONLY_DISPOSITION_NO_REPLAY',
   'ARCHIVE_ONLY_ORIGINAL_INSTALL_LEASE_AFTER_POSTCHECK'],
  evidenceObservedAt:'2026-11-10T03:02:02.041Z',
  protectedItemsObservedAt:'2026-11-10T03:12:02.041Z',
  protectionNowFingerprint:h(1),
  evidenceSha256:Object.fromEntries(rawKeys.map((n,i)=>[n,h(i+1)])),
  protectedItemsSha256:{files:{'config.json':h(1),
   'quota-runner.cmd':h(2),'run-local.cmd':h(3)},
   tasks:{'ZGMINI-PC-Local-Core':h(4),
    'ZGMINI-PC-Local-Korea':h(5)}},
  protectedWriterFileStatus:{'config.json':'PRESENT',
   'quota-runner.cmd':'PRESENT','run-local.cmd':'PRESENT'},
  protectedTaskEnabled:{'ZGMINI-PC-Local-Core':true,
   'ZGMINI-PC-Local-Korea':false},
 };
 const bytes=Buffer.from(`${JSON.stringify(manifest,null,2)}\n`);
 const gitRead={repository:'ansqhd5774-Choi/zgmini-pc-control',
  path:'docs/CONTROLLER_996_C_APPROVAL_R1.json',commitSha:'a'.repeat(40),bytes};
 const originalIssue={number:996,title:'pc-controller-update',
  user:{login:'ansqhd5774-Choi'},
  body:JSON.stringify({requestId,targetControllerSha:manifest.targetSha})};
 const comment={id:999,body:build996ConsentComment(sha(bytes)),
  user:{login:'ansqhd5774-Choi'},created_at:'2026-11-10T03:14:02Z'};
 const commentsReadback={complete:true,comments:[comment]};
 return {manifest,operatorManifestBytes:bytes,gitRead,
  originalIssue,commentsReadback};
}
const review=state=>review996CConsent(state);
function rerenderManifest(state){
 const bytes=Buffer.from(`${JSON.stringify(state.manifest,null,2)}\n`);
 state.gitRead.bytes=bytes;
 state.operatorManifestBytes=bytes;
 state.commentsReadback.comments[0].body=build996ConsentComment(sha(bytes));
}

test('exact original Issue, immutable bytes and owner consent yield reviewed-only',()=>{
 const f=fixture(),result=review(f);
 assert.equal(result.status,'CONSENT_PROVENANCE_REVIEWED_ONLY');
 assert.equal(result.manifestSha256,sha(f.gitRead.bytes));
 assert.equal(result.manifestCommitSha,'a'.repeat(40));
 assert.equal(result.consentCommentId,999);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.pcWritesAuthorized,0);
 assert.equal(result.workflowEnablesAuthorized,0);
 assert.equal(result.allowedEffects.length,6);
});

test('original issue identity or body cannot be changed',()=>{
 for(const mutate of [
  f=>{f.originalIssue.number=997;},
  f=>{f.originalIssue.user.login='github-actions[bot]';},
  f=>{f.originalIssue.title='pc-job';},
  f=>{f.originalIssue.body=JSON.stringify({requestId:'wrong',targetControllerSha:'x'});},
 ]){
  const f=fixture();mutate(f);
  assert.equal(review(f).status,'CONSENT_UNVERIFIED');
 }
});

test('local/Git source SHA pin or bytes drift never authorizes',()=>{
 for(const mutate of [
  f=>{f.gitRead.path='docs/other.json';},
  f=>{f.gitRead.repository='other/repo';},
  f=>{f.gitRead.commitSha='invalid';},
  f=>{f.operatorManifestBytes=Buffer.from('{}');},
  f=>{f.gitRead.bytes=Buffer.from('not JSON');},
  f=>{f.gitRead.bytes=Buffer.alloc(0);},
 ]){
  const f=fixture();mutate(f);
  assert.equal(review(f).status,'CONSENT_UNVERIFIED');
 }
});

test('user consent marker is explicit owner-authored and unique',()=>{
 for(const mutate of [
  f=>{f.commentsReadback.comments[0].user.login='github-actions[bot]';},
  f=>{f.commentsReadback.comments[0].body='approved';},
  f=>{f.commentsReadback.comments[0].body=build996ConsentComment('a'.repeat(64));},
  f=>{f.commentsReadback.comments[0].id=0;},
  f=>{f.commentsReadback.comments.push({...f.commentsReadback.comments[0],id:1000});},
  f=>{f.commentsReadback.complete=false;},
  f=>{f.commentsReadback.comments[0].created_at='2026-11-09T03:14:02Z';},
  f=>{f.commentsReadback.comments[0].body+= '\nextra-scope';},
  f=>{f.commentsReadback.comments.push({id:2000,
    user:{login:'github-actions[bot]'},body:'ZGMINI_CONTROLLER_996_C_CONSENT_V1'});},
 ]){
  const f=fixture();mutate(f);
  assert.equal(review(f).status,'CONSENT_UNVERIFIED');
 }
});

test('subsequent owner revocation blocks reviewed consent',()=>{
 const f=fixture();f.commentsReadback.comments.push({id:1001,
  user:{login:'ansqhd5774-Choi'},
  body:'ZGMINI_CONTROLLER_996_C_REVOKE_V1',
  created_at:'2026-11-10T03:20:00Z'});
 assert.equal(review(f).code,'CONSENT_REVOKED');
});

test('missing two acknowledged gaps, extra effect or evidence fails',()=>{
 for(const mutate of [
  f=>{f.manifest.approved=false;},
  f=>{f.manifest.acceptedGaps=[];},
  f=>{f.manifest.acceptsMissingHistoricalProtectedBaseline=false;},
  f=>{f.manifest.acceptsNoAllActorsImmutabilityProof=false;},
  f=>{f.manifest.phaseScopedSourceProof.reachedBackup=true;},
  f=>{f.manifest.phaseScopedSourceProof.claimsIndependentDisableActorAudit=true;},
  f=>{f.manifest.allowedEffects.push('INSTALL_CONTROLLER');},
  f=>{f.manifest.executeControllerInstall=true;},
  f=>{f.manifest.allowedEffects.splice(1,1);},
  f=>{f.manifest.evidenceSha256.protectedSnapshot=h(6);},
  f=>{delete f.manifest.protectedItemsSha256.files['config.json'];},
  f=>{f.manifest.protectedWriterFileStatus['config.json']='ABSENT';},
  f=>{f.manifest.protectedTaskEnabled['ZGMINI-PC-Local-Core']=null;},
 ]){
  const f=fixture();mutate(f);rerenderManifest(f);
  assert.equal(review(f).status,'CONSENT_UNVERIFIED');
 }
});

test('manifest preserves actual R2 absent Writer paths without fictitious SHA',()=>{
 const f=fixture();
 delete f.manifest.protectedItemsSha256.files['quota-runner.cmd'];
 delete f.manifest.protectedItemsSha256.files['run-local.cmd'];
 f.manifest.protectedWriterFileStatus['quota-runner.cmd']='ABSENT';
 f.manifest.protectedWriterFileStatus['run-local.cmd']='ABSENT';
 rerenderManifest(f);
 assert.equal(review(f).status,'CONSENT_PROVENANCE_REVIEWED_ONLY');
 for(const mutate of [
  x=>{x.manifest.protectedItemsSha256.files['run-local.cmd']=h(3);},
  x=>{x.manifest.protectedWriterFileStatus['run-local.cmd']='PRESENT';},
  x=>{x.manifest.protectedItemsSha256.files=null;},
 ]){
  const altered=fixture();
  delete altered.manifest.protectedItemsSha256.files['quota-runner.cmd'];
  delete altered.manifest.protectedItemsSha256.files['run-local.cmd'];
  altered.manifest.protectedWriterFileStatus['quota-runner.cmd']='ABSENT';
  altered.manifest.protectedWriterFileStatus['run-local.cmd']='ABSENT';
  mutate(altered);rerenderManifest(altered);
  assert.equal(review(altered).status,'CONSENT_UNVERIFIED');
 }
});

test('signing a changed valid manifest needs a new matching owner comment',()=>{
 const f=fixture();f.manifest.protectionNowFingerprint=h(2);
 f.gitRead.bytes=Buffer.from(`${JSON.stringify(f.manifest,null,2)}\n`);
 f.operatorManifestBytes=f.gitRead.bytes;
 assert.equal(review(f).code,'CONSENT_AUTHOR_OR_EXACT_RECEIPT_UNVERIFIED');
});

test('consent verification module has no Windows, network or file operations',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../tools/controller-996-c-consent-verifier.mjs',import.meta.url)),'utf8');
 assert.doesNotMatch(source,/\b(?:writeFileSync|renameSync|unlinkSync|mkdirSync|rmSync|cpSync|execFileSync|spawnSync)\s*\(/);
 assert.doesNotMatch(source,/\b(?:fetch|https\.request|http\.request|process\.kill)\s*\(/);
});
