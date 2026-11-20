import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {authorizeR6RegisteredB,R6_B_REPO,R6_B_TITLE,R6_B_LABEL,R6_B_SCHEMA,R6_B_APPROVAL_V2,R6_B_APPROVAL_V3,isApprovedR6RuntimeMode,verifyInstalledR6DolManualOverlay,verifyInstalledR6Overlay,R6_B_SOURCE,R6_B_HOME}
 from './operation.mjs';

const uid='d3ac6032-49c1-47e6-98d1-d7adeba91a7c';
const chat='b3ac6032-49c1-47e6-98d1-d7adeba91a7c';
const hash=v=>createHash('sha256').update(v).digest('hex');
const sha40='a'.repeat(40),sha64='f'.repeat(64);
const proposed=JSON.parse(readFileSync(new URL('../approvals/employment-r6-registered-data/PROPOSED-ONE_YEAR-20261109.json',import.meta.url)));
const overlay=Object.freeze({schema:'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1',
 status:'APPROVED_B',sourceRoot:proposed.sourceRoot,candidateSourceSha:sha40,
 allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
 files:Array.from({length:13},(_,i)=>({path:`lib/market-score/x${i}.mjs`,afterSha256:sha64}))});
function fixture(approval={...proposed,status:'APPROVED_B'},changes={}){
 const overlayBytes=Buffer.from(JSON.stringify(overlay));
 const payload={...approval,overlayManifestSha256:hash(overlayBytes)};
 const approvalBytes=Buffer.from(JSON.stringify(payload));
 const request={schema:R6_B_SCHEMA,requestId:uid,chatId:chat,
  operation:'employment-r6-registered-data-once',approvalManifestSha256:hash(approvalBytes)};
 const event={action:'opened',repository:{full_name:R6_B_REPO,private:true},
  sender:{login:'ansqhd5774-Choi'},issue:{title:R6_B_TITLE,
   user:{login:'ansqhd5774-Choi'},number:1,
   labels:[{name:R6_B_LABEL}],body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:R6_B_REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha40};
 return {event:{...event,...changes.event},env:{...env,...changes.env},
  approvalBytes,overlayBytes};
}

test('strict approved 7 BLS+2 DOL ONE_YEAR manifest passes pure authentication',()=>{
 const input=fixture();
 const result=authorizeR6RegisteredB(input);
 assert.equal(result.approval.mode,'ONE_YEAR');
 assert.equal(result.approval.maxBlsCalls,7);
 assert.equal(result.approval.maxDolCalls,2);
});
test('proposed manifest never authorizes external effects',()=>{
 assert.throws(()=>authorizeR6RegisteredB(fixture(proposed)),
  /R6_B_EFFECT_APPROVAL_STOP/);
});
test('manifest pin mismatch fails before operational checkout',()=>{
 const input=fixture();
 input.approvalBytes=Buffer.from('not the manifest');
 assert.throws(()=>authorizeR6RegisteredB(input),/R6_B_APPROVAL_HASH_STOP/);
});
test('non-owner, rerun, or wrong title are not accepted',()=>{
 for(const changes of [{env:{GITHUB_ACTOR:'someone'}},
  {env:{GITHUB_RUN_ATTEMPT:'2'}},
  {event:{issue:{title:'wrong'}}}]){
  assert.throws(()=>authorizeR6RegisteredB(fixture(undefined,changes)),
    /R6_B_OWNER_EVENT_STOP/);
 }
});
test('registered API call over-cap and unauthorized task effect fail',()=>{
 for(const mutate of [a=>{a.maxBlsCalls=14;},
  a=>{a.effects.taskWrites=true;},
  a=>{a.effects.d1PublicSnapshot=false;}]){
  const a=structuredClone(proposed);a.status='APPROVED_B';mutate(a);
  assert.throws(()=>authorizeR6RegisteredB(fixture(a)),
   /R6_B_EFFECT_APPROVAL_STOP/);
 }
});

const deltaPath='approvals/writer-updates/employment-r6-2015-600-onefile-20261109.json';
const providerPath='lib/market-score/employment-r6-provider.mjs';
function v2Fixture({mutateDelta=()=>{},mutateApproval=()=>{}}={}){
 const input=fixture();
 const baseOverlay={...overlay,sourceBranch:'feat/bls-registered-v2-20261109',
  files:overlay.files.map((f,i)=>i===0?{...f,path:providerPath}:f)};
 input.overlayBytes=Buffer.from(JSON.stringify(baseOverlay));
 const delta={schema:'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1',
  status:'APPROVED_B',scope:'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY',
  sourceRepository:proposed.sourceRepository,sourceBranch:baseOverlay.sourceBranch,
  sourceRoot:proposed.sourceRoot,candidateSourceSha:'c'.repeat(40),runCount:1,
  allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
  allowTaskDefinitionChanges:false,allowOtherSourceChanges:false,
  files:[{path:providerPath,change:'M',beforeSha256:sha64,afterSha256:'e'.repeat(64)}]};
 mutateDelta(delta);
 input.deltaOverlayBytes=Buffer.from(JSON.stringify(delta));
 const approved={...proposed,schema:R6_B_APPROVAL_V2,status:'APPROVED_B',
  mode:'BACKFILL',maxBlsCalls:14,
  overlayManifestSha256:hash(input.overlayBytes),
  deltaOverlayManifestPath:deltaPath,
  deltaOverlayManifestSha256:hash(input.deltaOverlayBytes)};
 mutateApproval(approved);
 input.approvalBytes=Buffer.from(JSON.stringify(approved));
 const request=JSON.parse(input.event.issue.body);
 request.approvalManifestSha256=hash(input.approvalBytes);
 input.event.issue.body=JSON.stringify(request);
 return input;
}

test('V2 one-file delta retains all 13 effective SHA checks and BACKFILL caps',()=>{
 const input=v2Fixture();
 const auth=authorizeR6RegisteredB(input);
 assert.equal(auth.approval.schema,R6_B_APPROVAL_V2);
 assert.equal(auth.approval.mode,'BACKFILL');
 assert.equal(auth.approval.maxBlsCalls,14);
 assert.equal(auth.approval.maxDolCalls,2);
 assert.equal(auth.overlay.files.length,13);
 assert.equal(auth.overlay.files[0].path,providerPath);
 assert.equal(auth.overlay.files[0].afterSha256,'e'.repeat(64));
 assert.deepEqual(auth.overlay.files.slice(1),overlay.files.slice(1));
});

test('V2 rejects absent or tampered delta bytes before provider effects',()=>{
 const absent=v2Fixture();
 absent.deltaOverlayBytes=null;
 assert.throws(()=>authorizeR6RegisteredB(absent),/R6_B_DELTA_APPROVAL_STOP/);
 const tampered=v2Fixture();
 tampered.deltaOverlayBytes=Buffer.from('{}');
 assert.throws(()=>authorizeR6RegisteredB(tampered),/R6_B_DELTA_APPROVAL_STOP/);
});

test('V2 rejects wrong delta path, predecessor, broadened files or DB scope',()=>{
 for(const mutateDelta of [
  d=>{d.files[0].path='lib/market-score/another.mjs';},
  d=>{d.files[0].beforeSha256='0'.repeat(64);},
  d=>{d.files.push({...d.files[0],path:'lib/market-score/extra.mjs'});},
  d=>{d.allowDbChanges=true;},
 ]){
  assert.throws(()=>authorizeR6RegisteredB(v2Fixture({mutateDelta})),
   /R6_B_DELTA_SCOPE_STOP/);
 }
 assert.throws(()=>authorizeR6RegisteredB(v2Fixture({
  mutateApproval:a=>{a.deltaOverlayManifestPath='approvals/writer-updates/unapproved.json';}
 })),/R6_B_DELTA_APPROVAL_STOP/);
});

test('V1 cannot smuggle a supplemental delta without V2 explicit authorization',()=>{
 const input=fixture();
 input.deltaOverlayBytes=Buffer.from('{}');
 assert.throws(()=>authorizeR6RegisteredB(input),/R6_B_DELTA_SCOPE_STOP/);
});


const collectorDeltaPath='approvals/writer-updates/employment-r6-backfill-window-collector-20261109.json';
const collectorPath='lib/market-score/employment-r6-collector.mjs';
function v3Fixture({mutateCollector=()=>{},mutateApproval=()=>{}}={}){
 const input=v2Fixture();
 const base=JSON.parse(input.overlayBytes.toString('utf8'));
 base.files[1]={...base.files[1],path:collectorPath};
 input.overlayBytes=Buffer.from(JSON.stringify(base));
 const delta={
  schema:'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1',status:'APPROVED_B',
  scope:'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY',
  sourceRepository:proposed.sourceRepository,sourceBranch:base.sourceBranch,
  sourceRoot:proposed.sourceRoot,candidateSourceSha:'b'.repeat(40),runCount:1,
  allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
  allowTaskDefinitionChanges:false,allowOtherSourceChanges:false,
  files:[{path:collectorPath,change:'M',beforeSha256:sha64,afterSha256:'9'.repeat(64)}],
 };
 mutateCollector(delta);
 input.collectorDeltaOverlayBytes=Buffer.from(JSON.stringify(delta));
 const approved=JSON.parse(input.approvalBytes.toString('utf8'));
 approved.schema=R6_B_APPROVAL_V3;
 approved.overlayManifestSha256=hash(input.overlayBytes);
 approved.collectorDeltaOverlayManifestPath=collectorDeltaPath;
 approved.collectorDeltaOverlayManifestSha256=hash(input.collectorDeltaOverlayBytes);
 mutateApproval(approved);
 input.approvalBytes=Buffer.from(JSON.stringify(approved));
 const request=JSON.parse(input.event.issue.body);
 request.approvalManifestSha256=hash(input.approvalBytes);
 input.event.issue.body=JSON.stringify(request);
 return input;
}

test('V3 composes 13 original overlay hashes with exactly two independently approved deltas',()=>{
 const auth=authorizeR6RegisteredB(v3Fixture());
 assert.equal(auth.approval.schema,R6_B_APPROVAL_V3);
 assert.equal(auth.approval.mode,'BACKFILL');
 assert.equal(auth.approval.maxBlsCalls,14);
 assert.equal(auth.overlay.files.length,13);
 assert.equal(auth.overlay.files[0].path,providerPath);
 assert.equal(auth.overlay.files[0].afterSha256,'e'.repeat(64));
 assert.equal(auth.overlay.files[1].path,collectorPath);
 assert.equal(auth.overlay.files[1].afterSha256,'9'.repeat(64));
 assert.deepEqual(auth.overlay.files.slice(2),overlay.files.slice(2));
});

test('V3 denies missing, altered, unapproved or broadened collector delta before provider effects',()=>{
 const missing=v3Fixture();
 missing.collectorDeltaOverlayBytes=null;
 assert.throws(()=>authorizeR6RegisteredB(missing),/R6_B_COLLECTOR_DELTA_APPROVAL_STOP/);
 const changed=v3Fixture();
 changed.collectorDeltaOverlayBytes=Buffer.from('{}');
 assert.throws(()=>authorizeR6RegisteredB(changed),/R6_B_COLLECTOR_DELTA_APPROVAL_STOP/);
 for(const mutateCollector of [
  d=>{d.status='PROPOSED_B';},
  d=>{d.files[0].path='lib/market-score/not-collector.mjs';},
  d=>{d.files[0].beforeSha256='0'.repeat(64);},
  d=>{d.files.push({...d.files[0],path:'lib/market-score/extra.mjs'});},
  d=>{d.allowProviderCalls=true;},
  d=>{d.allowDbChanges=true;},
 ])assert.throws(()=>authorizeR6RegisteredB(v3Fixture({mutateCollector})),
  /R6_B_COLLECTOR_DELTA_SCOPE_STOP/);
 assert.throws(()=>authorizeR6RegisteredB(v3Fixture({
  mutateApproval:a=>{a.collectorDeltaOverlayManifestPath='approvals/elsewhere.json';}
 })),/R6_B_COLLECTOR_DELTA_APPROVAL_STOP/);
});

test('V2 and V1 cannot smuggle a collector delta without V3 scope',()=>{
 const v2=v2Fixture();
 v2.collectorDeltaOverlayBytes=Buffer.from('{}');
 assert.throws(()=>authorizeR6RegisteredB(v2),/R6_B_COLLECTOR_DELTA_SCOPE_STOP/);
 const v1=fixture();
 v1.collectorDeltaOverlayBytes=Buffer.from('{}');
 assert.throws(()=>authorizeR6RegisteredB(v1),/R6_B_COLLECTOR_DELTA_SCOPE_STOP/);
});

test('malformed null approval fails closed with the documented approval code',()=>{
 const input=fixture();
 input.approvalBytes=Buffer.from('null');
 const request=JSON.parse(input.event.issue.body);
 request.approvalManifestSha256=hash(input.approvalBytes);
 input.event.issue.body=JSON.stringify(request);
 assert.throws(()=>authorizeR6RegisteredB(input),/R6_B_EFFECT_APPROVAL_STOP/);
});

test('027 DOL manual source preflight ignores scheduled-auto flags, not identity or enabled runtime',()=>{
 const sha='a'.repeat(40);
 const config={enabled:true,collectionTarget:'pc',source:sha,
  employmentR6AutoCollection:false,employmentR6OneYearAutoPublication:false};
 assert.equal(isApprovedR6RuntimeMode(config,sha,true),true);
 assert.equal(isApprovedR6RuntimeMode(config,sha),false);
 assert.equal(isApprovedR6RuntimeMode({...config,employmentR6AutoCollection:true},sha),false);
 assert.equal(isApprovedR6RuntimeMode({...config,employmentR6AutoCollection:true,
  employmentR6OneYearAutoPublication:true},sha),true);
 for(const wrong of [{...config,enabled:false},
  {...config,collectionTarget:'cloud'},{...config,source:'b'.repeat(40)}])
  assert.equal(isApprovedR6RuntimeMode(wrong,sha,true),false);
});
test('027 manual DOL preflight remains restricted to three approval-pinned source files',()=>{
 const a=['employment-r6-provider','employment-r6-collector','employment-r6-scheduler']
  .map(n=>({path:'lib/market-score/'+n+'.mjs',afterSha256:'a'.repeat(64)}));
 for(const files of [a.slice(1),[...a,a[0]],[a[0],a[1],a[1]],
  a.map((v,i)=>i===2?{...v,path:'lib/market-score/other.mjs'}:v),
  a.map((v,i)=>i===2?{...v,afterSha256:'bad'}:v)])
   assert.throws(()=>verifyInstalledR6DolManualOverlay({overlay:{files}}),
    /R6_DOL_FILE_SCOPE_STOP/);
});

test('027 Windows manual DOL checks exact source bytes but not unrelated automatic publication toggles',t=>{
 if(process.platform!=='win32')return t.skip('Windows source verifier');
 const sourceSha='a'.repeat(40),approvedBytes=Buffer.from('approved DOL source bytes\n');
 const digest=hash(approvedBytes);
 const files=['employment-r6-provider','employment-r6-collector','employment-r6-scheduler']
  .map(x=>({path:'lib/market-score/'+x+'.mjs',afterSha256:digest}));
 const config={enabled:true,collectionTarget:'pc',source:sourceSha,
  employmentR6AutoCollection:false,employmentR6OneYearAutoPublication:false};
 const calls=[];
 const settings={sourceRoot:R6_B_SOURCE,pcHome:R6_B_HOME,approvedSha:sourceSha,
  overlay:{files},exists:()=>true,
  read:f=>String(f).endsWith('config.json')?JSON.stringify(config):approvedBytes,
  git:args=>{calls.push(args);return args[0]==='rev-parse'?sourceSha:'';}};
 assert.deepEqual(verifyInstalledR6DolManualOverlay(settings),config);
 assert.deepEqual(calls.map(x=>x[0]),['rev-parse','diff']);
 assert.throws(()=>verifyInstalledR6Overlay(settings),/R6_B_INSTALLED_SOURCE_STOP/);
 const dirty={...settings,git:args=>{if(args[0]==='diff')throw new Error('unapproved dirty source');return sourceSha;}};
 assert.throws(()=>verifyInstalledR6DolManualOverlay(dirty),/R6_B_INSTALLED_GIT_DIFF_STOP/);
 const changed={...settings,overlay:{files:files.map((v,i)=>i===0?
  {...v,afterSha256:'b'.repeat(64)}:v)}};
 assert.throws(()=>verifyInstalledR6DolManualOverlay(changed),
  /R6_B_INSTALLED_OVERLAY_DRIFT_STOP/);
});

test('027 dirty Git worktree stays blocked with bounded diagnostic',t=>{
 if(process.platform!=='win32')return t.skip('Windows source verifier');
 const sha='a'.repeat(40),bytes=Buffer.from('pinned DOL fixture');
 const files=['employment-r6-provider','employment-r6-collector','employment-r6-scheduler']
  .map(name=>({path:'lib/market-score/'+name+'.mjs',afterSha256:hash(bytes)}));
 const opts={sourceRoot:R6_B_SOURCE,pcHome:R6_B_HOME,approvedSha:sha,
  overlay:{files},exists:()=>true,
  read:p=>String(p).endsWith('config.json')?
    JSON.stringify({source:sha,enabled:true,collectionTarget:'pc'}):bytes,
  git:args=>{if(args[0]==='diff')throw Error('git dirty');return sha;}};
 assert.throws(()=>verifyInstalledR6DolManualOverlay(opts),/R6_B_INSTALLED_GIT_DIFF_STOP/);
});
