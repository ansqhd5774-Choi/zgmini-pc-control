import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
 CONTROL_REPO,SOURCE_COMMIT,ORIGINAL_PC_SOURCE,PC_REPO,PC_HOME,
 PATHS,R10_B_FILES,RESERVATION_PATH,sha256,
 validateR10BManifest,validateR10BRequest,validateR10BDiff,
} from './r10-source-b-contract.mjs';
import {preflightR10B,applyR10BOnce,
 recoverR10BVerifiedBackup} from './r10-source-b-apply.mjs';
import {inspectR10BSourceBytes,stageR10BBytes} from './r10-source-b-stage.mjs';

const SHA40='b'.repeat(40),SHA64='e'.repeat(64);
const request={schema:'ZGMINI_R10_SOURCE_B_REQUEST_V1',
 requestId:'pc-r10-source-123e4567-e89b-42d3-a456-426614174000',
 chatId:'chat-123e4567-e89b-42d3-a456-426614174001',
 operation:'r10-two-source-files-approved-once',
 controlRepository:CONTROL_REPO,sourceCommit:SOURCE_COMMIT,
 targetPcSourceSha:SHA40,approvalManifestSha256:null};
const template=()=>JSON.parse(fs.readFileSync(
 path.join(import.meta.dirname,'R10_SOURCE_B_APPROVAL_TEMPLATE.json'),'utf8'));
const manifest=()=>({...template(),status:'APPROVED_B',targetPcSourceSha:SHA40,
 originalFilesSha256:Object.fromEntries(PATHS.map((p,i)=>[p,(i?'c':'a').repeat(64)])),
 originalConfigSha256:'1'.repeat(64),rollbackBundleSha256:'2'.repeat(64),
 runtimeProvenanceSha256:'3'.repeat(64)});
const packed=()=>{
 const m=manifest(),bytes=Buffer.from(JSON.stringify(m));
 return {m,bytes,r:{...request,approvalManifestSha256:sha256(bytes)}};
};
const today=()=>Date.now();
const portFor=(m,{now=today(),overrides={}}={})=>{
 const probe={pcHome:PC_HOME,pcRepo:PC_REPO,
  sourceHead:ORIGINAL_PC_SOURCE,approvedConfigSource:ORIGINAL_PC_SOURCE,
  trackedClean:true,configSha256:m.originalConfigSha256,
  originalFilesSha256:m.originalFilesSha256,
  runtimeProvenance:{kind:'LIVE_TASK_PROCESS_CHECKOUT_VERIFIED',
   checkoutPath:PC_REPO,head:ORIGINAL_PC_SOURCE,verifiedAt:now,
   sha256:m.runtimeProvenanceSha256,taskPidVerified:true,processTreeVerified:true},
  taskEnabled:true,coreIdle:true,coreLockFree:true,
  writerProcessFree:true,sharedApplyLeaseFree:true,otherInstallerFree:true,
  sqliteUnmodified:true,providersUnmodified:true,tasksUnmodified:true,
  protectedSnapshotSha256:SHA64,originalGitObjectVerified:true,
  originalRemoteRetrievable:true,targetGitObjectVerified:true,
  targetRemoteRetrievable:true,targetDescendsOriginal:true,
  targetSourceSha:m.targetPcSourceSha,candidateSourceCommit:SOURCE_COMMIT,
  rollbackBundleSha256:m.rollbackBundleSha256,rollbackVerified:true,
  candidateDependencyVerified:true,...overrides};
 const calls=[];
 const port={inspect:async()=>{calls.push('inspect');return probe},
  verifyDiff:async()=>({fromSha:ORIGINAL_PC_SOURCE,toSha:m.targetPcSourceSha,
   files:PATHS,targetFilesSha256:m.candidateFilesSha256}),
  acquireExclusiveLease:async()=>{calls.push('lease');return {owned:true}},
  verifyBackup:async()=>{calls.push('backup');return {verified:true,
   sha256:m.rollbackBundleSha256,originalSourceSha:ORIGINAL_PC_SOURCE,
   originalConfigSha256:m.originalConfigSha256}},
  reserveCreateOnly:async()=>{calls.push('reserve');return {status:'CREATED_201',path:RESERVATION_PATH}},
  markAttemptStarted:async()=>{calls.push('marker')},
  applyExactSourceCommit:async()=>{calls.push('apply')},
  verifyAfterApply:async()=>{calls.push('readback');return {
   sourceHead:m.targetPcSourceSha,configSource:m.targetPcSourceSha,
   trackedClean:true,exactTwoFilesChanged:true,coreTaskUnchanged:true,
   sqliteUnchanged:true,providersUnchanged:true,d1Writes:0,providerCalls:0,
   protectedBaselineUnchanged:true}},
  releaseExclusiveLease:async()=>{calls.push('release')},
 };
 return {port,calls,probe};
};

test('DRAFT manifest cannot pass approval and exact two-file scope is enforced',()=>{
 const {bytes,r}=packed();
 assert.equal(validateR10BManifest(bytes,r).targetPcSourceSha,SHA40);
 const bad=(patch)=>{
  const m={...manifest(),...patch};
  const b=Buffer.from(JSON.stringify(m));
  assert.throws(()=>validateR10BManifest(b,{...r,approvalManifestSha256:sha256(b)}),
   /R10_B_APPROVAL_SCOPE_STOP/);
 };
 bad({status:'DRAFT_PENDING_LIVE_PC_PROVENANCE_AND_REMOTE_ROLLBACK'});
 bad({allowTaskChanges:true});
 bad({allowD1Writes:true});
 bad({candidateFilesSha256:{...R10_B_FILES,[PATHS[0]]:SHA64}});
 assert.throws(()=>validateR10BManifest(bytes,{...r,approvalManifestSha256:SHA64}),
  /R10_B_APPROVAL_DIGEST_STOP/);
 assert.throws(()=>validateR10BDiff({files:['scripts/pc-writer/run-local.mjs'],
  fromSha:ORIGINAL_PC_SOURCE,toSha:SHA40,manifest:manifest()}),
  /R10_B_NOT_EXACTLY_TWO_FILE_DIFF_STOP/);
});

test('Issue admission requires fixed private author, title, label and no commands',()=>{
 const {r}=packed();
 const event={repository:{private:true,full_name:CONTROL_REPO},action:'opened',
  sender:{login:'ansqhd5774-Choi'},issue:{user:{login:'ansqhd5774-Choi'},
   number:215,title:'pc-r10-source-approved-once',
   labels:[{name:'pc-r10-source-b-approved'}],body:JSON.stringify(r)}};
 assert.equal(validateR10BRequest(event).targetPcSourceSha,SHA40);
 assert.throws(()=>validateR10BRequest({...event,issue:{...event.issue,
  body:JSON.stringify({...r,command:'cmd /c dir'})}}),/R10_B_REQUEST_SCOPE_STOP/);
 assert.throws(()=>validateR10BRequest({...event,issue:{...event.issue,
  labels:[]}}),/R10_B_ISSUE_IDENTITY_STOP/);
});

test('preflight blocks local-only orphan rollback and static/historical-only Core evidence',async()=>{
 const {bytes,r,m}=packed(),{port,probe}=portFor(m);
 probe.originalRemoteRetrievable=false;
 await assert.rejects(()=>preflightR10B({request:r,approvalBytes:bytes,port}),
  /R10_B_GIT_ROLLBACK_OR_DEPENDENCY_STOP/);
 probe.originalRemoteRetrievable=true;
 probe.runtimeProvenance.kind='HISTORICAL_CHECKOUT_ONLY';
 await assert.rejects(()=>preflightR10B({request:r,approvalBytes:bytes,port}),
  /R10_B_LIVE_CORE_PROVENANCE_STOP/);
});

test('offline source trees require independently restored bundle bound to both SHAs and approval',async()=>{
 const {bytes,r,m}=packed(),{port,probe}=portFor(m,{overrides:{
  originalRemoteRetrievable:false,targetRemoteRetrievable:false,
 }});
 const check=()=>preflightR10B({request:r,approvalBytes:bytes,port});
 const proof={independentlyRestored:true,connectivityVerified:true,
  originalSha:ORIGINAL_PC_SOURCE,targetSha:m.targetPcSourceSha,
  bundleSha256:m.rollbackBundleSha256};
 for(const drift of [{bundleSha256:SHA64},{targetSha:ORIGINAL_PC_SOURCE},{connectivityVerified:false}]){
  probe.verifiedRecoveryBundle={...proof,...drift};
  await assert.rejects(check,/R10_B_GIT_ROLLBACK_OR_DEPENDENCY_STOP/);
 }
 probe.verifiedRecoveryBundle=proof;
 assert.equal((await check()).status,'READY_FOR_INDEPENDENT_B_ONLY');
});

test('Core cycle/lock, dirty checkout, config, dependencies and extra diff fail closed',async()=>{
 const {bytes,r,m}=packed(),{port,probe}=portFor(m);
 for(const [key,value,code] of [
  ['coreLockFree',false,'R10_B_CORE_OR_SHARED_LANE_BUSY_STOP'],
  ['trackedClean',false,'R10_B_ORIGINAL_SOURCE_CAS_STOP'],
  ['candidateDependencyVerified',false,'R10_B_GIT_ROLLBACK_OR_DEPENDENCY_STOP'],
 ]){
  const old=probe[key];probe[key]=value;
  await assert.rejects(()=>preflightR10B({request:r,approvalBytes:bytes,port}),new RegExp(code));
  probe[key]=old;
 }
 port.verifyDiff=async()=>({fromSha:ORIGINAL_PC_SOURCE,toSha:SHA40,
  files:[...PATHS,'scripts/pc-writer/run-local.mjs'],targetFilesSha256:R10_B_FILES});
 await assert.rejects(()=>preflightR10B({request:r,approvalBytes:bytes,port}),
  /R10_B_NOT_EXACTLY_TWO_FILE_DIFF_STOP/);
});

test('staged B sequence reserves once only AFTER preflight, backup, exclusive CAS',async()=>{
 const {bytes,r,m}=packed(),{port,calls}=portFor(m);
 const result=await applyR10BOnce({request:r,approvalBytes:bytes,port});
 assert.equal(result.status,'PASS');
 assert.deepEqual(calls,['inspect','lease','inspect','backup','reserve',
  'marker','apply','readback','release']);
 assert.equal(result.operationalSourceFilesChanged,2);
 assert.equal(result.d1Writes,0);
});

test('unknown after global reservation remains STATE_UNKNOWN with lease retained; no retry',async()=>{
 const {bytes,r,m}=packed(),{port,calls}=portFor(m);
 port.applyExactSourceCommit=async()=>{calls.push('apply');throw Object.assign(
  Error('R10_B_APPLY_OUTCOME_UNKNOWN_STOP'),{code:'R10_B_APPLY_OUTCOME_UNKNOWN_STOP'})};
 const result=await applyR10BOnce({request:r,approvalBytes:bytes,port});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.leaseRetained,true);
 assert.equal(result.operationalWrites,'UNKNOWN');
 assert.equal(calls.includes('release'),false);
});

test('lost create-only reservation response remains UNKNOWN and retains lease',async()=>{
 const {bytes,r,m}=packed(),{port,calls}=portFor(m);
 port.reserveCreateOnly=async()=>{calls.push('reserve');throw Object.assign(
  Error('R10_B_GLOBAL_RESERVATION_UNKNOWN_STOP'),
  {code:'R10_B_GLOBAL_RESERVATION_UNKNOWN_STOP'})};
 const result=await applyR10BOnce({request:r,approvalBytes:bytes,port});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.leaseRetained,true);
 assert.equal(calls.includes('apply'),false);
 assert.equal(calls.includes('release'),false);
});

test('only a separately authorized quiescent CAS recovery restores verified original',async()=>{
 const {bytes,r,m}=packed();
 const proof={ownLeaseHeld:true,attemptMarkerMatches:true,taskProcessStopped:true,
  coreLockFree:true,writerProcessFree:true,sourceWithinExpectedStates:true,
  backupSha256:m.rollbackBundleSha256,originalSha:ORIGINAL_PC_SOURCE,
  originalConfigSha256:m.originalConfigSha256,
  protectedBaselineUnchanged:true,observedSourceSha:m.targetPcSourceSha,
  observedConfigSha256:'4'.repeat(64)};
 const port={inspectRecovery:async()=>proof,
  restoreExactBackupCAS:async()=>({status:'RESTORED'}),
  verifyRecoveredOriginal:async()=>({sourceHead:ORIGINAL_PC_SOURCE,
   configSource:ORIGINAL_PC_SOURCE,trackedClean:true,
   exactOriginalFiles:true,tasksUnchanged:true,sqliteUnchanged:true,
   d1Writes:0,providerCalls:0})};
 assert.equal((await recoverR10BVerifiedBackup({request:r,
  approvalBytes:bytes,port})).status,'ROLLED_BACK');
 proof.attemptMarkerMatches=false;
 await assert.rejects(()=>recoverR10BVerifiedBackup({request:r,
  approvalBytes:bytes,port}),/R10_B_RECOVERY_CAS_OR_QUIESCENCE_STOP/);
});

test('unverified staged candidate rejects altered bytes and leaves operating tree intact',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r10-b-stage-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const candidate=path.join(root,'candidate'),operating=path.join(root,'operating');
 fs.mkdirSync(candidate);fs.mkdirSync(operating);
 const originals=Object.fromEntries(PATHS.map(p=>[p,Buffer.from('OLD_'+p)]));
 for(const p of PATHS){for(const [base,bytes] of [[candidate,Buffer.from('BAD')],[operating,originals[p]]]){
  const dest=path.join(base,...p.split('/'));fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,bytes);
 }}
 const m={...manifest(),originalFilesSha256:Object.fromEntries(
  PATHS.map(p=>[p,sha256(originals[p])]))};
 assert.throws(()=>inspectR10BSourceBytes({candidateRoot:candidate,
  operatingRoot:operating,manifest:m,strictWindows:false}),
  /R10_B_PINNED_CANDIDATE_FILE_DRIFT_STOP/);
 assert.throws(()=>stageR10BBytes({candidateRoot:candidate,
  operatingRoot:operating,stageRoot:path.join(root,'stage'),manifest:m,
  strictWindows:false}),/R10_B_PINNED_CANDIDATE_FILE_DRIFT_STOP/);
 assert.equal(fs.existsSync(path.join(root,'stage')),false);
 assert.deepEqual(fs.readFileSync(path.join(operating,...PATHS[0].split('/'))),originals[PATHS[0]]);
});
