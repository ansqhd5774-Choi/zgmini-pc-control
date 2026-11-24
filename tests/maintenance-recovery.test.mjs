import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createHash} from 'node:crypto';
import {classifyRecovery,archiveUntouched,
 verifyMaintenanceManifest as recoveryInventory,verifyOperatingRunners,inspectOperatingRunners,inspectEvidenceFile,fixedInstalledRecoveryCase} from '../tools/maintenance-recovery.mjs';
import {verifyMaintenanceManifest as statusInventory} from '../tools/automation-status.mjs';
test('fixed installed reconciliation admits only original #2960 and W04 #3409 identities',()=>{
 const a=fixedInstalledRecoveryCase('pc-update-e8767e20-6bad-4418-97c6-561cf79a8213');
 assert.equal(a.issueNumber,2960);assert.equal(a.postIssueNumber,2965);
 assert.equal(a.targetSha,'b9a423cf38d0967d6ed336912a66433f79502d3d');
 assert.equal(a.postSourceBranch,'main');assert.equal(a.allowUnchangedBaseline,false);
 assert.equal(a.proof.issueNumber,2982);assert.equal(a.proof.runId,45186420113);
 const w=fixedInstalledRecoveryCase('pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0');
 assert.equal(w.issueNumber,3409);assert.equal(w.postIssueNumber,3410);
 assert.equal(w.targetSha,'6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4');
 assert.equal(w.postSourceBranch,'codex/employment-1y-reader-r1');
 assert.equal(w.postSourceSha,'50769db23ac6a5f55203855f5231d12dc0595bb4');
 assert.deepEqual(w.proof,{issueNumber:3438,runId:45457196689,jobId:138669741465,
  runnerName:'zgmini-pc-03',resultPath:'results/45457196689-1-seat-3.json'});
 assert.equal(w.allowUnchangedBaseline,true);assert.equal(Object.isFrozen(w),true);
 for(const id of [null,undefined,'','pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec1',
  'pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0-postcheck',
  'pc-update-e8767e20-6bad-4418-97c6-561cf79a8214'])
  assert.equal(fixedInstalledRecoveryCase(id),null);
});
const sha='a'.repeat(40),id='pc-update-recovery-fixture';
test('inspect evidence distinguishes missing, unreadable and malformed bytes without disclosing local paths',()=>{
 const secretFile='E:/private/DO_NOT_EXPOSE_SECRET.json';
 const run=(label,fn)=>()=>inspectEvidenceFile(secretFile,label,fn);
 const missing=Object.assign(Error('DO_NOT_EXPOSE_SECRET'),{code:'ENOENT'});
 const denied=Object.assign(Error('DO_NOT_EXPOSE_SECRET'),{code:'EACCES'});
 for(const [action,expected] of [
  [run('RECOVERY_REQUEST_LEDGER',()=>{throw missing;}),'RECOVERY_REQUEST_LEDGER_MISSING'],
  [run('RECOVERY_INSTALL_OWNER',()=>{throw denied;}),'RECOVERY_INSTALL_OWNER_UNREADABLE'],
  [run('RECOVERY_INSTALL_MARKER',()=>Buffer.from('{DO_NOT_EXPOSE_SECRET')),'RECOVERY_INSTALL_MARKER_INVALID_JSON'],
  [run('RECOVERY_CONTROLLER_HOST',()=>Buffer.from('null')),'RECOVERY_CONTROLLER_HOST_INVALID_JSON'],
 ]){
  assert.throws(action,e=>e.code===expected&&e.message===expected&&
   !e.message.includes(secretFile)&&!e.message.includes('DO_NOT_EXPOSE_SECRET'));
 }
 const good=inspectEvidenceFile(secretFile,'RECOVERY_REQUEST_LEDGER',()=>Buffer.from('{"status":"RECOVERY_REQUIRED"}'));
 assert.equal(good.value.status,'RECOVERY_REQUIRED');
 assert.equal(good.bytes.toString(),'{"status":"RECOVERY_REQUIRED"}');
});
const state=()=>({identityVerified:true,ownerAlive:false,
 ledger:{status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',firstFail:'RECEIVED',installedShaBefore:sha,intakePaused:false,workflowEnabled:true},
 actualSha:sha,controllerVerified:true,maintenanceVerified:true,backupExists:false,backlogExists:false,
 workflow:'active',runnerSetVerified:true,runnersIdle:true,otherLeaseCount:0});
test('status and recovery verify both pre-handoff six and post-handoff seven exact runtime files',()=>{
 const original=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs'];
 const next=[...original,'tools/source-bundle-register.mjs'];
 const data=Object.fromEntries([...next,'tools/unapproved.mjs'].map(p=>[p,Buffer.from(p)]));
 const oldSha='4f076a0228f8ba9598e85b7d0f64f161b6b7c8a4';
 const targetSha='f'.repeat(40);
 const manifest=(files,sourceSha=files.length===original.length?oldSha:targetSha)=>({
  schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha,files:Object.fromEntries(
  files.map(p=>[p,createHash('sha256').update(data[p]).digest('hex')]))});
 const readBytes=p=>data[path.relative('/fixture',p).split(path.sep).join('/')];
 for(const validate of [recoveryInventory,statusInventory]){
  assert.equal(validate(manifest(original),'/fixture',readBytes),true);
  assert.equal(validate(manifest(next),'/fixture',readBytes),true);
  assert.equal(validate(manifest(original,targetSha),'/fixture',readBytes),false);
  assert.equal(validate(manifest([...original,'tools/unapproved.mjs']),'/fixture',readBytes),false);
  assert.equal(validate(manifest([...next,'tools/unapproved.mjs']),'/fixture',readBytes),false);
  const changed=manifest(next);changed.files['tools/update.mjs']='0'.repeat(64);
  assert.equal(validate(changed,'/fixture',readBytes),false);
  const missing=manifest(next);delete missing.files['tools/source-bundle-register.mjs'];
  missing.files['tools/unapproved.mjs']='0'.repeat(64);
  assert.equal(validate(missing,'/fixture',readBytes),false);
 }
});
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-recovery-'));
 fs.mkdirSync(path.join(root,'leases/controller-install'),{recursive:true});fs.mkdirSync(path.join(root,'ledger'));
 const ownerBytes=Buffer.from(JSON.stringify({pid:123,nonce:'fixture'}));
 const markerBytes=Buffer.from(JSON.stringify({nonce:'fixture'})),ledgerBytes=Buffer.from(JSON.stringify(state().ledger));
 fs.writeFileSync(path.join(root,'leases/controller-install/owner.json'),ownerBytes);
 fs.writeFileSync(path.join(root,'leases/controller-install/RECOVERY_REQUIRED.json'),markerBytes);
 fs.writeFileSync(path.join(root,'ledger',id+'.json'),ledgerBytes);
 return {root,requestId:id,ownerBytes,markerBytes,ledgerBytes,observe:state,isAlive:()=>false};
}
test('only proven untouched prevalidation failure is eligible',()=>assert.equal(classifyRecovery(state()).status,'ABORT_UNTOUCHED_ELIGIBLE'));
for(const [name,change] of Object.entries({liveOwner:s=>s.ownerAlive=true,unknownOwner:s=>s.ownerAlive=null,
 switched:s=>s.ledger.firstFail='SWITCHED',staged:s=>s.backupExists=true,paused:s=>s.backlogExists=true,
 changedController:s=>s.actualSha='b'.repeat(40),missingBytes:s=>s.controllerVerified=false,
 missingMaintainer:s=>s.maintenanceVerified=false,workflowUnknown:s=>s.workflow=null,busy:s=>s.runnersIdle=false,
 otherLease:s=>s.otherLeaseCount=1,badIdentity:s=>s.identityVerified=false,
 postcheck:s=>s.ledger.postIssueNumber=5}))test('fails closed: '+name,()=>{
 const s=state();change(s);assert.equal(classifyRecovery(s).status,'RECOVERY_REQUIRED');
});
test('archive preserves original journal and complete lease; never retries',()=>{
 const f=fixture();try{
  const r=archiveUntouched(f);assert.equal(r.status,'ABORTED_UNTOUCHED');
  assert.equal(r.originalRequestRetried,false);assert.equal(r.controllerChanged,false);
  assert.deepEqual(fs.readFileSync(path.join(f.root,'ledger',id+'.json')),f.ledgerBytes);
  assert.deepEqual(fs.readFileSync(path.join(f.root,'recovery',r.archiveName,'owner.json')),f.ownerBytes);
  assert.equal(fs.existsSync(path.join(f.root,'leases/controller-install')),false);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('changed nonce or journal never archives another owner',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.root,'leases/controller-install/owner.json'),'{}');
  assert.throws(()=>archiveUntouched(f),{code:'RECOVERY_EVIDENCE_CHANGED'});
  assert.ok(fs.existsSync(path.join(f.root,'leases/controller-install')));
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('owner liveness rechecked after fresh observation',()=>{
 const f=fixture();try{
  let n=0;f.isAlive=()=>++n===1?false:true;
  assert.throws(()=>archiveUntouched(f),{code:'RECOVERY_OWNER_NOT_DEAD'});
  assert.ok(fs.existsSync(path.join(f.root,'leases/controller-install')));
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('second recovery cannot compete for single reservation',()=>{
 const f=fixture();try{
  fs.mkdirSync(path.join(f.root,'leases/controller-recovery'));
  assert.throws(()=>archiveUntouched(f),{code:'EEXIST'});
  assert.ok(fs.existsSync(path.join(f.root,'leases/controller-install')));
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});

const operating=()=>Array.from({length:6},(_,i)=>({name:'zgmini-pc-0'+(i+1),status:'online',busy:false}));
test('six operating runners pass with or without isolated runner',()=>{
 const six=operating();const isolated={name:'DESKTOP-N62L0NG',status:'online',busy:true};
 assert.deepEqual(verifyOperatingRunners(six),{runnerSetVerified:true,runnersIdle:true});
 assert.deepEqual(verifyOperatingRunners([...six,isolated]),{runnerSetVerified:true,runnersIdle:true});
});
test('operating runner duplicates, missing, offline and busy fail closed',()=>{
 const six=operating();
 for(const rows of [[...six,six[0]],six.slice(1),six.map((x,i)=>i===0?{...x,status:'offline'}:x)]){
  assert.equal(verifyOperatingRunners(rows).runnerSetVerified,false);
 }
 const busy=six.map((x,i)=>i===0?{...x,busy:true}:x);
 assert.equal(verifyOperatingRunners(busy).runnersIdle,false);
 assert.equal(verifyOperatingRunners(null).runnerSetVerified,false);
});

test('W01 shared recovery inspect preserves read-only diagnostics on runner API HTTP 403, never approves',()=>{
 const denied=inspectOperatingRunners(()=>{throw Object.assign(Error('forbidden'),{code:'RECOVERY_GITHUB_QUERY_UNAVAILABLE'});});
 assert.deepEqual(denied,{runnerSetVerified:false,runnersIdle:false,runnerQueryStatus:'UNAVAILABLE'});
 const recovery=state();Object.assign(recovery,denied);
 const judged=classifyRecovery(recovery);
 assert.equal(judged.status,'RECOVERY_REQUIRED');
 assert.equal(judged.checks.RUNNERS_IDLE,false);
 assert.notEqual(judged.code,'PREVALIDATION_ABORT_VERIFIED');
});
test('W01 runner inventory malformed/missing remains unknown; valid six verified unchanged',()=>{
 const missing=inspectOperatingRunners(()=>({status:'HTTP_403_FORBIDDEN'}));
 assert.deepEqual(missing,{runnerSetVerified:false,runnersIdle:false,runnerQueryStatus:'UNVERIFIED'});
 assert.equal(classifyRecovery({...state(),...missing}).status,'RECOVERY_REQUIRED');
 const ok=inspectOperatingRunners(()=>({runners:operating()}));
 assert.deepEqual(ok,{runnerSetVerified:true,runnersIdle:true,runnerQueryStatus:'VERIFIED'});
 const busy=inspectOperatingRunners(()=>({runners:operating().map((x,i)=>i===1?{...x,busy:true}:x)}));
 assert.equal(busy.runnerSetVerified,true);
 assert.equal(busy.runnersIdle,false);
});
