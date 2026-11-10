import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {create996NativePostcheck} from '../tools/controller-996-native-postcheck.mjs';

const REQUEST='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const CONTROLLER_SHA='badad9124157879d7a645b64f2768113d632355b';
const TARGET_SHA='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const MAINTAINER_SHA='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const CONTROLLER_FILES=['config/operations.json','controller/alpha.mjs',
 'controller/beta.mjs','controller/gamma.mjs','controller/delta.mjs'];
const MAINTAINER_FILES=['tools/maintenance-contract.mjs',
 'tools/maintenance-apply.mjs','tools/maintenance-agent.mjs',
 'tools/maintenance-lock.mjs','tools/update.mjs',
 'tools/maintenance-ancestry.vbs','tools/source-bundle-register.mjs'];
const ORIGINAL_BACKLOG='d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780';
const FINGERPRINT='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const sha=b=>createHash('sha256').update(b).digest('hex');
const map={
 ledger:'automation/pc-maintenance/ledger/'+REQUEST+'.json',
 controllerHost:'automation/pc-control/host.json',
 stagedHost:'automation/pc-control/backups/controller-update-'+REQUEST+'/stage/host.json',
 stage:'automation/pc-control/backups/controller-update-'+REQUEST+'/stage',
 controller:'automation/pc-control',
 maintainer:'automation/pc-maintenance',
 maintainerManifest:'automation/pc-maintenance/MAINTENANCE_INSTALL.json',
 backlog:'automation/pc-maintenance/backlog/'+REQUEST+'.json',
 original:'automation/pc-maintenance/leases/controller-install',
 originalArchived:'automation/pc-maintenance/leases/controller-install-recovered-'+REQUEST,
 own:'automation/pc-maintenance/leases/controller-recovery',
 ownArchived:'automation/pc-maintenance/leases/controller-recovery-archived-'+REQUEST,
};
const r2=()=>({
 schema:'ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1',
 requestId:REQUEST,issueNumber:996,observedAt:'2026-11-10T04:50:00.000Z',
 status:'CURRENT_ITEMS_MATCH_OBSERVATION',
 items:{files:{'config.json':'0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453'},
  writerFileStatus:{'config.json':'PRESENT','quota-runner.cmd':'ABSENT',
   'run-local.cmd':'ABSENT'},
  taskSha256:{'ZGMINI-PC-Local-Core':'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
   'ZGMINI-PC-Local-Korea':'1797e5def9fc92551132ca69f60bb5320bb346c687988be3e4ff3eb76ef5fdc1'},
  taskEnabled:{'ZGMINI-PC-Local-Core':true,'ZGMINI-PC-Local-Korea':true}},
 currentFingerprint:FINGERPRINT,originalObservationFingerprint:FINGERPRINT,
 fingerprintMatch:true,allFivePresent:false,presentWriterFileCount:1,
 historicalBaselineAvailable:false,allActorsImmutableProven:false,
 operationalWrites:0,issuePosts:0,pcRetries:0,executionAuthorized:false,
});
function fixture(t,phase='BACKLOG_CLOSED'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const write=(rel,content)=>{
  const bytes=Buffer.isBuffer(content)?content:Buffer.from(
   typeof content==='string'?content:JSON.stringify(content)+'\n');
  const target=path.join(root,...rel.split('/'));
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,bytes);return sha(bytes);
 };
 const oldArchived=phase!=='BACKLOG_CLOSED',ownArchived=phase==='FINAL_ARCHIVED';
 const orig=oldArchived?map.originalArchived:map.original;
 const own=ownArchived?map.ownArchived:map.own;
 const expectedRaw={};
 expectedRaw.ledger=write(map.ledger,{requestId:REQUEST,status:'RECOVERY_REQUIRED'});
 const sourceByKey=new Map();
 const sourceFile=(folder,commit,rel,value)=>{
  const bytes=Buffer.from(value);
  sourceByKey.set(`${commit}:${rel}`,bytes);
  return write(folder+'/'+rel,bytes);
 };
 const installedMap={};
 const stagedMap={};
 for(const rel of CONTROLLER_FILES){
  installedMap[rel]=sourceFile(map.controller,CONTROLLER_SHA,rel,
   `original ${rel}\n`);
  stagedMap[rel]=sourceFile(map.stage,TARGET_SHA,rel,
   `staged ${rel}\n`);
 }
 const maintainerMap={};
 for(const rel of MAINTAINER_FILES)
  maintainerMap[rel]=sourceFile(map.maintainer,MAINTAINER_SHA,rel,
   `maintainer ${rel}\n`);
 expectedRaw.controllerHost=write(map.controllerHost,{controllerSourceSha:CONTROLLER_SHA,
  controllerFiles:installedMap});
 expectedRaw.stagedHost=write(map.stagedHost,{controllerSourceSha:TARGET_SHA,
  controllerFiles:stagedMap});
 expectedRaw.maintainerManifest=write(map.maintainerManifest,{
  schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha:MAINTAINER_SHA,
  files:maintainerMap});
 expectedRaw.owner=write(orig+'/owner.json',{pid:2147480000,nonce:'original'});
 expectedRaw.recoveryMarker=write(orig+'/RECOVERY_REQUIRED.json',{phase:'INTAKE_PAUSED'});
 const ownOwner={requestId:REQUEST,issueNumber:996,pid:process.pid,
  nonce:'11111111-1111-4111-8111-111111111111'};
 write(own+'/owner.json',ownOwner);
 const pausedAt='2026-11-10T03:00:00.000Z';
 const resumeAt='2026-11-10T04:40:00.000Z';
 const backlog={schema:'ZGMINI_PC_BACKLOG_V1',requestId:REQUEST,
  pausedAt,resumedAt:resumeAt,
  windows:[{pausedAt,resumedAt:resumeAt}],replays:{}};
 const nextSha=write(map.backlog,backlog);
 const mark=(name,details={})=>write(own+'/'+name+'.json',{
  schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1',
  requestId:REQUEST,issueNumber:996,ownerNonce:ownOwner.nonce,
  name,at:'2026-11-10T04:40:00.000Z',details});
 mark('PREPARED');
 mark('WORKFLOW_ENABLE_ATTEMPTED');
 mark('BACKLOG_CLOSE_ATTEMPTED',{originalSha:ORIGINAL_BACKLOG,
  nextSha,resumeAt,ownerNonce:ownOwner.nonce});
 if(oldArchived){
  mark('PRE_ARCHIVE');
  mark('ORIGINAL_LEASE_ARCHIVE_ATTEMPTED');
 }
 if(ownArchived){
  mark('COMPLETE',{status:'INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED'});
  mark('OWN_CLAIM_ARCHIVE_ATTEMPTED');
 }
 let workflow='active';
 let onWorkflowRead=()=>{};
 let protectedState=r2();
 const gateway=create996NativePostcheck({root,testOnly:true,expectedRaw,
  readWorkflow:()=>{onWorkflowRead();return workflow;},isOldOwnerAlive:()=>false,
  readProtected:()=>protectedState,
  sourceRead:(commit,rel)=>sourceByKey.get(`${commit}:${rel}`)});
 const inspect=(phase,overrides={})=>gateway.inspect({phase,
  expectedOwnerNonce:ownOwner.nonce,expectedOwnerPid:ownOwner.pid,
  ...overrides});
 return {root,write,map,own,orig,ownOwner,expectedRaw,
  gateway,inspect,nextSha,backlog,sourceByKey,
  setWorkflow:x=>{workflow=x;},
  setOnWorkflowRead:x=>{onWorkflowRead=x;},
  setProtected:x=>{protectedState=x;}};
}

test('three physical postcheck phases keep their distinct active/archive requirements',t=>{
 for(const phase of ['BACKLOG_CLOSED','ORIGINAL_LEASE_ARCHIVED','FINAL_ARCHIVED']){
  const f=fixture(t,phase),r=f.inspect(phase);
  assert.equal(r.status,'READONLY_PHASE_PHYSICAL_STATE_MATCHES_PINNED');
  assert.equal(r.originalStaticFilesVerified,4);
  assert.equal(r.installedControllerFilesVerified,5);
  assert.equal(r.stagedControllerFilesVerified,5);
  assert.equal(r.maintainerSourceFilesVerified,7);
  assert.equal(r.sourceReadbackPasses,2);
  assert.equal(r.originalLeaseHashesVerified,2);
  assert.equal(r.protectedTasksEnabled,2);
  assert.equal(r.originalLeaseArchived,phase!=='BACKLOG_CLOSED');
  assert.equal(r.ownClaimArchived,phase==='FINAL_ARCHIVED');
  assert.equal(r.issueReconciliationVerified,false);
  assert.equal(r.executionAuthorized,false);
 }
});

test('postcheck blocks Workflow, protected Task, backlog and source drift',t=>{
 for(const change of [
  x=>x.setWorkflow('disabled_manually'),
  x=>{const p=r2();p.items.taskEnabled['ZGMINI-PC-Local-Core']=false;
   x.setProtected(p);},
  x=>x.write(map.backlog,{...x.backlog,resumedAt:'2026-11-10T04:42:00.000Z'}),
  x=>x.write(map.ledger,{status:'UPDATED'}),
 ]){
  const f=fixture(t);change(f);
  const r=f.inspect('BACKLOG_CLOSED');
  assert.equal(r.status,'POSTCHECK_UNVERIFIED');
  assert.equal(r.executionAuthorized,false);
 }
});

test('all three phases detect changed installed Controller execution bytes',t=>{
 for(const phase of ['BACKLOG_CLOSED','ORIGINAL_LEASE_ARCHIVED','FINAL_ARCHIVED']){
  const f=fixture(t,phase);
  f.write(map.controller+'/'+CONTROLLER_FILES[1],Buffer.from('tampered controller\n'));
  assert.equal(f.inspect(phase).code,
   'C_POSTCHECK_INSTALLED_CONTROLLER_CODE_DRIFT');
 }
});

test('all three phases detect staged target execution bytes drift',t=>{
 for(const phase of ['BACKLOG_CLOSED','ORIGINAL_LEASE_ARCHIVED','FINAL_ARCHIVED']){
  const f=fixture(t,phase);
  f.write(map.stage+'/'+CONTROLLER_FILES[2],Buffer.from('tampered stage\n'));
  assert.equal(f.inspect(phase).code,
   'C_POSTCHECK_STAGED_CONTROLLER_CODE_DRIFT');
 }
});

test('all three phases detect one of seven maintainer source bytes drift',t=>{
 for(const phase of ['BACKLOG_CLOSED','ORIGINAL_LEASE_ARCHIVED','FINAL_ARCHIVED']){
  const f=fixture(t,phase);
  f.write(map.maintainer+'/'+MAINTAINER_FILES[6],Buffer.from('tampered maintenance\n'));
  assert.equal(f.inspect(phase).code,
   'C_POSTCHECK_MAINTAINER_CODE_DRIFT');
 }
});

test('unknown stage file, missing Git source and source mismatch fail closed',t=>{
 const extra=fixture(t);
 extra.write(map.stage+'/controller/rogue.mjs','unlisted');
 assert.equal(extra.inspect('BACKLOG_CLOSED').code,
  'C_POSTCHECK_STAGE_FILE_SET_DRIFT');
 const sourceMissing=fixture(t,'ORIGINAL_LEASE_ARCHIVED');
 sourceMissing.sourceByKey.delete(`${CONTROLLER_SHA}:${CONTROLLER_FILES[1]}`);
 assert.equal(sourceMissing.inspect('ORIGINAL_LEASE_ARCHIVED').status,
  'POSTCHECK_UNVERIFIED');
 const sourceMismatch=fixture(t,'FINAL_ARCHIVED');
 sourceMismatch.sourceByKey.set(`${MAINTAINER_SHA}:${MAINTAINER_FILES[0]}`,
  Buffer.from('wrong immutable Git blob\n'));
 assert.equal(sourceMismatch.inspect('FINAL_ARCHIVED').code,
  'C_POSTCHECK_MAINTAINER_CODE_DRIFT');
});

test('Controller code changed during Workflow read is caught on second physical pass',t=>{
 const f=fixture(t,'FINAL_ARCHIVED');
 let changed=false;
 f.setOnWorkflowRead(()=>{
  if(changed)return;
  changed=true;
  f.write(map.controller+'/'+CONTROLLER_FILES[3],Buffer.from('concurrent edit\n'));
 });
 assert.equal(f.inspect('FINAL_ARCHIVED').code,
  'C_POSTCHECK_INSTALLED_CONTROLLER_CODE_DRIFT');
});

test('archive phase and stale active lease must not be confused',t=>{
 const a=fixture(t,'BACKLOG_CLOSED');
 assert.equal(a.inspect('FINAL_ARCHIVED').status,'POSTCHECK_UNVERIFIED');
 const b=fixture(t,'ORIGINAL_LEASE_ARCHIVED');
 b.write(map.original+'/owner.json',{pid:12345});
 assert.equal(b.inspect('ORIGINAL_LEASE_ARCHIVED').code,
  'C_POSTCHECK_UNEXPECTED_LEASE_PATH');
 const c=fixture(t,'FINAL_ARCHIVED');
 c.write(map.own+'/owner.json',{pid:12345});
 assert.equal(c.inspect('FINAL_ARCHIVED').code,
  'C_POSTCHECK_UNEXPECTED_LEASE_PATH');
});

test('claim markers are immutable evidence, never substitutes for unknown originals',t=>{
 const a=fixture(t,'BACKLOG_CLOSED');
 a.write(a.own+'/BACKLOG_CLOSE_ATTEMPTED.json',{
  schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1',
  requestId:REQUEST,issueNumber:996,ownerNonce:'foreign',
  name:'BACKLOG_CLOSE_ATTEMPTED',at:'2026-11-10T04:40:00.000Z',
  details:{originalSha:ORIGINAL_BACKLOG,nextSha:a.nextSha,
   resumeAt:a.backlog.resumedAt}});
 assert.equal(a.inspect('BACKLOG_CLOSED').code,
  'C_POSTCHECK_CLAIM_MARKER_INVALID');
 const b=fixture(t,'FINAL_ARCHIVED');
 b.write(b.own+'/COMPLETE.json',{
  schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1',
  requestId:REQUEST,issueNumber:996,ownerNonce:b.ownOwner.nonce,
  name:'COMPLETE',at:'2026-11-10T04:40:00.000Z',
  details:{status:'WRONG'}});
 assert.equal(b.inspect('FINAL_ARCHIVED').code,
  'C_POSTCHECK_COMPLETION_MARKER_INVALID');
});

test('all phases require the reserved C nonce and original operator PID',t=>{
 for(const phase of ['BACKLOG_CLOSED','ORIGINAL_LEASE_ARCHIVED','FINAL_ARCHIVED']){
  const f=fixture(t,phase);
  assert.equal(f.gateway.inspect({phase}).code,
   'C_POSTCHECK_EXPECTED_OWN_CLAIM_REQUIRED');
  assert.equal(f.inspect(phase,{expectedOwnerNonce:undefined}).code,
   'C_POSTCHECK_EXPECTED_OWN_CLAIM_REQUIRED');
  assert.equal(f.inspect(phase,{expectedOwnerPid:undefined}).code,
   'C_POSTCHECK_EXPECTED_OWN_CLAIM_REQUIRED');
  assert.equal(f.inspect(phase,{expectedOwnerNonce:'foreign-valid-nonce'}).code,
   'C_POSTCHECK_OWN_CLAIM_OWNER_DRIFT');
  assert.equal(f.inspect(phase,{expectedOwnerPid:process.pid+1}).code,
   'C_POSTCHECK_EXPECTED_OWN_CLAIM_REQUIRED');
 }
});

test('self-consistent replacement C Claim and markers cannot pass in any phase',t=>{
 for(const phase of ['BACKLOG_CLOSED','ORIGINAL_LEASE_ARCHIVED','FINAL_ARCHIVED']){
  const f=fixture(t,phase);
  const replacementNonce='99999999-9999-4999-8999-999999999999';
  f.write(f.own+'/owner.json',{...f.ownOwner,nonce:replacementNonce});
  for(const name of fs.readdirSync(path.join(f.root,...f.own.split('/')))){
   if(name==='owner.json'||!name.endsWith('.json'))continue;
   const relative=f.own+'/'+name;
   const marker=JSON.parse(fs.readFileSync(path.join(f.root,...relative.split('/'))));
   f.write(relative,{...marker,ownerNonce:replacementNonce});
  }
  assert.equal(f.inspect(phase).code,'C_POSTCHECK_OWN_CLAIM_OWNER_DRIFT');
 }
});

test('own Claim PID replacement is rejected before marker inspection',t=>{
 const f=fixture(t,'FINAL_ARCHIVED');
 f.write(f.own+'/owner.json',{...f.ownOwner,pid:process.pid+1});
 assert.equal(f.inspect('FINAL_ARCHIVED').code,'C_POSTCHECK_OWN_CLAIM_OWNER_DRIFT');
});

test('runtime original Windows ports cannot be impersonated from Linux',()=>{
 assert.throws(()=>create996NativePostcheck({
  readWorkflow:()=> 'active',isOldOwnerAlive:()=>false}),
 /C_POSTCHECK_ORIGINAL_WINDOWS_REQUIRED/);
});

test('independent final readback has no claim-dependent mutation or implicit success',t=>{
 const f=fixture(t,'FINAL_ARCHIVED');
 const result=f.inspect('FINAL_ARCHIVED');
 assert.equal(result.status,'READONLY_PHASE_PHYSICAL_STATE_MATCHES_PINNED');
 assert.equal(result.code,'ORIGINAL_GITHUB_DISPOSITION_AND_C_OPERATOR_STILL_REQUIRED');
 assert.equal(result.issueReconciliationVerified,false);
 assert.equal(result.issuePosts,0);
 assert.equal(result.pcRetries,0);
});

test('postcheck source uses only authenticated GitHub GET and never mutates resources',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../tools/controller-996-native-postcheck.mjs',import.meta.url)),'utf8');
 assert.doesNotMatch(source,/\b(?:writeFileSync|renameSync|unlinkSync|mkdirSync|rmSync|cpSync|spawnSync)\s*\(/);
 assert.match(source,/['"]--method['"],['"]GET['"]/);
 assert.doesNotMatch(source,/['"]-X['"]|['"]--method['"],['"](?:PUT|POST|DELETE)['"]/);
 assert.doesNotMatch(source,/['"](?:PUT|POST)['"]/);
});
