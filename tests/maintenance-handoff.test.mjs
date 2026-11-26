import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync}from'node:child_process';
import {requireHandoffCheckoutScope,requireStopped,requireNoReplacement,requireReceiverOrigin,requireNewReceiverOrigin,requireCurrentReceiverIdentity,reserveReceiverSlot,reservationFailureStatus,rollbackStatus,
  priorRuntimeFiles,nextRuntimeFiles,requireSixToSevenContract,requireSevenToSevenContract,
  requireHandoffApproval,approvedRuntimeChanges,approvedHandoffCiPolicy,approvedPolicyOnlyHandoff,handoffFilePlan,
  requireDirectInstalledFiles,requireNoUnfinishedHandoff,requireOwnedInstallGuard,requireRollbackWindow,
  requireOriginalStartupBytes,preserveRollbackReservation}from'../tools/handoff-maintenance.mjs';
import {sourceFiles as bootstrapFiles}from'../tools/bootstrap-maintenance.mjs';
import {maintenanceOriginFiles}from'../tools/update.mjs';
import {acquireMaintenanceLock}from'../tools/maintenance-lock.mjs';
test('post-S6 CI policy-only V2 candidate denies unapproved and changes no executable byte',()=>{
 const previous=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/20a2939d419675ede3e8ab38a3ea3b70756981ac.json',
  import.meta.url),'utf8'));
 const candidate=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/5a85f803fd9cb280561395f88a3544ee8e7d4660.json',
  import.meta.url),'utf8'));
 assert.equal(candidate.schema,'ZGMINI_MAINTENANCE_HANDOFF_V2');
 assert.equal(candidate.transition,'SEVEN_TO_SEVEN');
 assert.equal(candidate.installedSha,previous.targetSha);
 assert.equal(candidate.targetSha,'5a85f803fd9cb280561395f88a3544ee8e7d4660');
 assert.equal(candidate.approved,false);
 assert.equal(candidate.checks.ownerNativeEffectApproved,false);
 assert.equal(candidate.checks.windowsHandoffExecuted,false);
 assert.equal(candidate.checks.ciControllerBEnabled,false);
 assert.deepEqual(candidate.runtimeChangedFiles,[]);
 const runtime=nextRuntimeFiles;
 const source=[...runtime,'tools/bootstrap-maintenance.mjs',
  'tools/handoff-maintenance.mjs'];
 assert.deepEqual(Object.keys(candidate.files).sort(),source.sort());
 const existingFiles=Object.fromEntries(runtime.map(rel=>[rel,previous.files[rel]]));
 requireSevenToSevenContract(existingFiles,candidate.files);
 for(const rel of source){
  assert.equal(candidate.files[rel],previous.files[rel],'no executable SHA drift: '+rel);
  assert.equal(createHash('sha256').update(
   fs.readFileSync(new URL('../'+rel,import.meta.url))).digest('hex'),
   candidate.files[rel],'checkout bytes must match approved target: '+rel);
 }
 const syntheticOldPolicy={...candidate.ciControllerBPolicy,
  workflowBlobSha:'b568bbc5de05b2d6fff75419b88322b3e2de020c'};
 const before={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha:previous.targetSha,startupSha256:'f'.repeat(64),
  files:existingFiles,ciControllerBPolicy:syntheticOldPolicy};
 assert.throws(()=>requireHandoffApproval(candidate,candidate.targetSha,before.sourceSha),
  /HANDOFF_APPROVAL_REQUIRED/);
 const hypotheticallyApproved={...candidate,approved:true};
 assert.equal(requireHandoffApproval(hypotheticallyApproved,
  candidate.targetSha,before.sourceSha),'SEVEN_TO_SEVEN');
 const context={before,approval:hypotheticallyApproved,target:candidate.targetSha};
 assert.equal(approvedPolicyOnlyHandoff(before,hypotheticallyApproved,
  candidate.targetSha),true);
 assert.deepEqual(handoffFilePlan('SEVEN_TO_SEVEN',existingFiles,candidate.files,
  context).writes,[]);
 assert.throws(()=>handoffFilePlan('SEVEN_TO_SEVEN',existingFiles,candidate.files,{
  before:{...before,ciControllerBPolicy:undefined},
  approval:hypotheticallyApproved,target:candidate.targetSha}),/HANDOFF_NO_RUNTIME_CHANGE/);
 const after={...before,sourceSha:candidate.targetSha,files:Object.fromEntries(
  runtime.map(rel=>[rel,candidate.files[rel]]))};
 assert.deepEqual(approvedHandoffCiPolicy(before,hypotheticallyApproved,after),
  candidate.ciControllerBPolicy);
 assert.equal(candidate.ciControllerBPolicy.workflowBlobSha,
  '27e48ecde81bdf6f15cccffcffd9b3e70482a5f3');
 // The old-policy stub and approved:true clone are only pure regression fixtures;
 // neither is a current PC preimage, user approval, or executable operation.
});
test('handoff ignores unrelated checkout edits, still denies executable and approval edits',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-handoff-scope-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const git=args=>execFileSync('git',args,{cwd:dir});
 const target='f'.repeat(40);
 const source=['maintenance-contract.mjs','maintenance-apply.mjs','maintenance-agent.mjs',
   'maintenance-lock.mjs','update.mjs','maintenance-ancestry.vbs',
   'bootstrap-maintenance.mjs','handoff-maintenance.mjs',
   'source-bundle-register.mjs'].map(name=>'tools/'+name);
 const approval=`approvals/maintenance-handoffs/${target}.json`;
 const unrelated=['docs/work-in-progress.md','results/maintenance-result.txt'];
 for(const rel of [...source,approval,...unrelated]){
   const file=path.join(dir,rel);fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,'approved bytes\n');
 }
 git(['init','-q']);git(['add','--',...source,approval,...unrelated]);
 git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture']);
 for(const rel of unrelated){
   const file=path.join(dir,rel);fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,'unrelated local edit\n');
 }
 assert.doesNotThrow(()=>requireHandoffCheckoutScope(target,git));
 fs.writeFileSync(path.join(dir,source[0]),'modified execution source\n');
 assert.throws(()=>requireHandoffCheckoutScope(target,git),/HANDOFF_CHECKOUT_DIRTY/);
 fs.writeFileSync(path.join(dir,source[0]),'approved bytes\n');
 fs.writeFileSync(path.join(dir,approval),'tampered approval\n');
 assert.throws(()=>requireHandoffCheckoutScope(target,git),/HANDOFF_CHECKOUT_DIRTY/);
 assert.throws(()=>requireHandoffCheckoutScope('../bad',git),/HANDOFF_PIN_REQUIRED/);
});
test('old six-file install is admitted only with exact nine-file handoff source approval',()=>{
 const hash='a'.repeat(64);
 const old=Object.fromEntries(priorRuntimeFiles.map(name=>[name,hash]));
 const approved=Object.fromEntries([...nextRuntimeFiles,
  'tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs'].map(name=>[name,hash]));
 assert.equal(priorRuntimeFiles.length,6);
 assert.equal(nextRuntimeFiles.length,7);
 assert.deepEqual(bootstrapFiles,nextRuntimeFiles);
 assert.deepEqual(maintenanceOriginFiles,nextRuntimeFiles);
 assert.doesNotThrow(()=>requireSixToSevenContract(old,approved));
 assert.throws(()=>requireSixToSevenContract({...old,['tools/source-bundle-register.mjs']:hash},approved),
  /HANDOFF_INSTALLED_FILE_SET_MISMATCH/);
 assert.throws(()=>requireSixToSevenContract(old,{...approved,['tools/unapproved.mjs']:hash}),
  /HANDOFF_TARGET_FILE_SET_MISMATCH/);
 const missing={...approved};delete missing['tools/source-bundle-register.mjs'];
 assert.throws(()=>requireSixToSevenContract(old,missing),/HANDOFF_TARGET_FILE_SET_MISMATCH/);
 assert.throws(()=>requireSixToSevenContract(old,{...approved,['tools/update.mjs']:'bad'}),
  /HANDOFF_TARGET_FILE_SET_MISMATCH/);
});
test('V1 six-to-seven and V2 seven-to-seven require distinct, exact approvals',()=>{
 const installedSha='b'.repeat(40),targetSha='c'.repeat(40);
 const base={targetSha,installedSha,approved:true,scope:'COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE'};
 assert.equal(requireHandoffApproval({...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V1'},targetSha,installedSha),
  'SIX_TO_SEVEN');
 assert.equal(requireHandoffApproval({...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',
  transition:'SEVEN_TO_SEVEN'},targetSha,installedSha),'SEVEN_TO_SEVEN');
 for(const badSha of [null,undefined,'',0,'not-a-sha','a'.repeat(39),'A'.repeat(40)]){
  const v2={...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',
   transition:'SEVEN_TO_SEVEN',installedSha:badSha};
  assert.throws(()=>requireHandoffApproval(v2,targetSha,badSha),/HANDOFF_APPROVAL_REQUIRED/);
 }
 assert.throws(()=>requireHandoffApproval({...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',
  transition:'SEVEN_TO_SEVEN',targetSha:installedSha},installedSha,installedSha),
 /HANDOFF_APPROVAL_REQUIRED/);
 assert.throws(()=>requireHandoffApproval({...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',
  transition:'SEVEN_TO_SEVEN',targetSha:null},null,installedSha),/HANDOFF_APPROVAL_REQUIRED/);
 for(const approval of [
  {...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V1',transition:'SEVEN_TO_SEVEN'},
  {...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2'},
  {...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SIX_TO_SEVEN'},
  {...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SEVEN_TO_SEVEN',approved:false},
  {...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SEVEN_TO_SEVEN',installedSha:'d'.repeat(40)},
  {...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SEVEN_TO_SEVEN',targetSha:'d'.repeat(40)},
  {...base,schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SEVEN_TO_SEVEN',scope:'ANY'},
 ])assert.throws(()=>requireHandoffApproval(approval,targetSha,installedSha),/HANDOFF_APPROVAL_REQUIRED/);
});
test('seven-to-seven checks all seven installed hashes and exact nine target hashes',()=>{
 const oldHash='a'.repeat(64),newHash='b'.repeat(64);
 const installed=Object.fromEntries(nextRuntimeFiles.map(name=>[name,oldHash]));
 const target=Object.fromEntries([...nextRuntimeFiles,
  'tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs'].map(name=>[name,oldHash]));
 target['tools/update.mjs']=newHash;
 assert.doesNotThrow(()=>requireSevenToSevenContract(installed,target));
 const plan=handoffFilePlan('SEVEN_TO_SEVEN',installed,target);
 assert.deepEqual(plan.installed,nextRuntimeFiles);
 assert.deepEqual(plan.writes,['tools/update.mjs']);
 assert.deepEqual(plan.rollbackAdded,[]);
 assert.deepEqual(approvedRuntimeChanges('SEVEN_TO_SEVEN',installed,target),['tools/update.mjs']);
 assert.equal(plan.installed.includes('tools/source-bundle-register.mjs'),true);
 assert.equal(plan.writes.includes('tools/source-bundle-register.mjs'),false);
 assert.throws(()=>approvedRuntimeChanges('SEVEN_TO_SEVEN',installed,{...target,['tools/update.mjs']:oldHash}),
  /HANDOFF_NO_RUNTIME_CHANGE/);
 const missing={...installed};delete missing['tools/source-bundle-register.mjs'];
 assert.throws(()=>requireSevenToSevenContract(missing,target),/HANDOFF_INSTALLED_FILE_SET_MISMATCH/);
 assert.throws(()=>requireSevenToSevenContract({...installed,['tools/unapproved.mjs']:oldHash},target),
  /HANDOFF_INSTALLED_FILE_SET_MISMATCH/);
 assert.throws(()=>requireSevenToSevenContract({...installed,['tools/update.mjs']:'bad'},target),
  /HANDOFF_INSTALLED_FILE_SET_MISMATCH/);
 const targetMissing={...target};delete targetMissing['tools/handoff-maintenance.mjs'];
 assert.throws(()=>requireSevenToSevenContract(installed,targetMissing),
  /HANDOFF_TARGET_FILE_SET_MISMATCH/);
 assert.throws(()=>requireSevenToSevenContract(installed,{...target,['tools/unapproved.mjs']:oldHash}),
  /HANDOFF_TARGET_FILE_SET_MISMATCH/);
 assert.throws(()=>approvedRuntimeChanges('UNKNOWN',installed,target),/HANDOFF_TRANSITION_UNSUPPORTED/);
});
test('seven-to-seven policy-only handoff requires exact approved V2 pin rotation',()=>{
 const installed=Object.fromEntries(nextRuntimeFiles.map((rel,i)=>[rel,String(i+1).repeat(64)]));
 const policy={schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V1',enabled:true,
  workflowId:430972394,workflowBlobSha:'b'.repeat(40),
  workflowPath:'.github/workflows/ci-approval-controller-b.yml'};
 const before={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha:'a'.repeat(40),
  startupSha256:'f'.repeat(64),files:installed,ciControllerBPolicy:policy};
 const files=Object.fromEntries([...nextRuntimeFiles,
  'tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs']
  .map(rel=>[rel,installed[rel]??'d'.repeat(64)]));
 const approval={schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SEVEN_TO_SEVEN',
  approved:true,installedSha:before.sourceSha,targetSha:'c'.repeat(40),
  ciControllerBPolicy:{...policy,workflowBlobSha:'e'.repeat(40)},files};
 const scope={before,approval,target:approval.targetSha};
 // Without the independently approved policy scope, the historical rejection stays.
 assert.throws(()=>handoffFilePlan('SEVEN_TO_SEVEN',installed,files),/HANDOFF_NO_RUNTIME_CHANGE/);
 assert.equal(approvedPolicyOnlyHandoff(before,approval,scope.target),true);
 const plan=handoffFilePlan('SEVEN_TO_SEVEN',installed,files,scope);
 assert.deepEqual(plan.installed,nextRuntimeFiles);
 assert.deepEqual(plan.writes,[]); // No executable dummy diff or overwrite.
 assert.deepEqual(plan.rollbackAdded,[]);
 const cases=[
  {...approval,approved:false},
  {...approval,schema:'ZGMINI_MAINTENANCE_HANDOFF_V1'},
  {...approval,transition:'SIX_TO_SEVEN'},
  {...approval,installedSha:'f'.repeat(40)},
  {...approval,targetSha:'f'.repeat(40)},
  {...approval,ciControllerBPolicy:policy}, // No policy effect to install.
  {...approval,ciControllerBPolicy:{...approval.ciControllerBPolicy,workflowId:1}},
  {...approval,ciControllerBPolicy:{...approval.ciControllerBPolicy,workflowPath:'other.yml'}},
  {...approval,ciControllerBPolicy:{...approval.ciControllerBPolicy,enabled:false}},
  {...approval,ciControllerBPolicy:{...approval.ciControllerBPolicy,workflowBlobSha:'invalid'}},
 ];
 for(const candidate of cases){
  assert.equal(approvedPolicyOnlyHandoff(before,candidate,scope.target),false);
  assert.throws(()=>handoffFilePlan('SEVEN_TO_SEVEN',installed,files,
   {...scope,approval:candidate}),/HANDOFF_NO_RUNTIME_CHANGE/);
 }
 assert.equal(approvedPolicyOnlyHandoff({...before,ciControllerBPolicy:null},
  approval,scope.target),false);
 assert.throws(()=>handoffFilePlan('SEVEN_TO_SEVEN',installed,files,
  {...scope,before:{...before,ciControllerBPolicy:null}}),/HANDOFF_NO_RUNTIME_CHANGE/);
});

test('seven-to-seven rollback plan preserves all original runtime files and never removes an old module',()=>{
 const installed=Object.fromEntries(nextRuntimeFiles.map((name,index)=>[name,
  String(index+1).repeat(64)]));
 const approved=Object.fromEntries([...nextRuntimeFiles,
  'tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs'].map(name=>[name,installed[name]??'f'.repeat(64)]));
 approved['tools/update.mjs']='a'.repeat(64);
 approved['tools/source-bundle-register.mjs']='b'.repeat(64);
 const plan=handoffFilePlan('SEVEN_TO_SEVEN',installed,approved);
 assert.equal(plan.installed.length,7);
 assert.deepEqual(plan.writes,['tools/update.mjs','tools/source-bundle-register.mjs']);
 assert.deepEqual(plan.rollbackAdded,[]);
 assert.deepEqual(plan.installed,nextRuntimeFiles);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-handoff-seven-seven-'));
 try{
  for(const rel of plan.installed){
   const source=path.join(temp,'installed',rel),backup=path.join(temp,'backup',rel);
   fs.mkdirSync(path.dirname(source),{recursive:true});fs.mkdirSync(path.dirname(backup),{recursive:true});
   fs.writeFileSync(source,installed[rel]);fs.copyFileSync(source,backup);
  }
  for(const rel of plan.writes)fs.writeFileSync(path.join(temp,'installed',rel),approved[rel]);
  for(const rel of plan.installed)fs.copyFileSync(path.join(temp,'backup',rel),
   path.join(temp,'installed',rel));
  for(const rel of plan.installed)assert.equal(
   fs.readFileSync(path.join(temp,'installed',rel),'utf8'),installed[rel]);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 const six=Object.fromEntries(priorRuntimeFiles.map(name=>[name,'a'.repeat(64)]));
 const first=handoffFilePlan('SIX_TO_SEVEN',six,approved);
 assert.deepEqual(first.installed,priorRuntimeFiles);
 assert.deepEqual(first.writes,nextRuntimeFiles);
 assert.deepEqual(first.rollbackAdded,['tools/source-bundle-register.mjs']);
});
test('seven-to-seven rejects symlinks, hardlinks and parent aliases even with matching bytes',async t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-handoff-file-scope-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const target=path.join(temp,'receiver');fs.mkdirSync(path.join(target,'tools'),{recursive:true});
 const external=path.join(temp,'outside.mjs');fs.writeFileSync(external,'matching bytes');
 const installed=path.join(target,'tools','update.mjs');
 fs.writeFileSync(installed,'matching bytes');
 assert.doesNotThrow(()=>requireDirectInstalledFiles(target,['tools/update.mjs']));
 const alias=path.join(target,'tools','alias.mjs');
 fs.linkSync(installed,alias);
 assert.throws(()=>requireDirectInstalledFiles(target,['tools/update.mjs']),/HANDOFF_PATH_ALIAS/);
 fs.unlinkSync(alias);
 fs.unlinkSync(installed);
 await t.test('file symlink is rejected when the OS permits creating the fixture',sub=>{
  try{fs.symlinkSync(external,installed);}catch(error){
   if(process.platform==='win32'&&error.code==='EPERM'){
    sub.skip('Windows file-symlink creation privilege unavailable; no privilege change');return;
   }
   throw error;
  }
  assert.throws(()=>requireDirectInstalledFiles(target,['tools/update.mjs']),/HANDOFF_PATH_ALIAS/);
  fs.unlinkSync(installed);
 });
 fs.rmSync(path.join(target,'tools'),{recursive:true,force:true});
 fs.symlinkSync(path.dirname(external),path.join(target,'tools'),process.platform==='win32'?'junction':'dir');
 assert.throws(()=>requireDirectInstalledFiles(target,['tools/outside.mjs']),/HANDOFF_PATH_ALIAS/);
 const realParent=path.join(temp,'real-parent');
 fs.mkdirSync(path.join(realParent,'receiver','tools'),{recursive:true});
 fs.writeFileSync(path.join(realParent,'receiver','tools','update.mjs'),'matching bytes');
 const linkedParent=path.join(temp,'junction-like-parent');
 fs.symlinkSync(realParent,linkedParent,process.platform==='win32'?'junction':'dir');
 assert.throws(()=>requireDirectInstalledFiles(path.join(linkedParent,'receiver'),
  ['tools/update.mjs']),/HANDOFF_PATH_ALIAS/);
});
test('unfinished prior handoff journal blocks other targets, and completed proof is reusable',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-handoff-prior-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const journal=path.join(temp,'handoff-'+'a'.repeat(40)+'.json');
 assert.doesNotThrow(()=>requireNoUnfinishedHandoff(temp));
 for(const status of ['RUNNING','RECOVERY_REQUIRED','UNKNOWN']){
  fs.writeFileSync(journal,JSON.stringify({status}));
  assert.throws(()=>requireNoUnfinishedHandoff(temp),/HANDOFF_PRIOR_RECOVERY_REQUIRED/);
 }
 fs.writeFileSync(journal,'invalid json');
 assert.throws(()=>requireNoUnfinishedHandoff(temp),/HANDOFF_PRIOR_RECOVERY_REQUIRED/);
 for(const status of ['PASS','BLOCKED','ROLLED_BACK']){
  fs.writeFileSync(journal,JSON.stringify({status}));
  assert.doesNotThrow(()=>requireNoUnfinishedHandoff(temp));
 }
});
test('seven-to-seven keeps a separate B-lease guard after receiver lease release until origin verification',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-handoff-live-guard-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 fs.mkdirSync(path.join(temp,'leases'));
 const guard=acquireMaintenanceLock(temp,'controller-install');
 assert.doesNotThrow(()=>requireOwnedInstallGuard(temp,guard));
 const reservation=reserveReceiverSlot(path.join(temp,'leases','receiver'));
 reservation.release(); // Receiver must be able to acquire this slot and start.
 assert.equal(fs.existsSync(path.join(temp,'leases','receiver')),false);
 assert.throws(()=>acquireMaintenanceLock(temp,'controller-install'),
  /MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED/);
 guard.holdForRecovery(); // Simulates a failed launch or CAPTURE.
 assert.equal(fs.existsSync(path.join(temp,'leases','controller-install','RECOVERY_REQUIRED.json')),true);
 assert.throws(()=>acquireMaintenanceLock(temp,'controller-install'),
  /MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED/);
});
test('seven-to-seven B-lease guard refuses changed owner and releases only the exact owner',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-handoff-owner-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 fs.mkdirSync(path.join(temp,'leases'));
 const guard=acquireMaintenanceLock(temp,'controller-install');
 const ownerFile=path.join(temp,'leases','controller-install','owner.json');
 const original=fs.readFileSync(ownerFile);
 fs.writeFileSync(ownerFile,JSON.stringify({...guard.owner,nonce:'forged-owner'})+'\n');
 assert.throws(()=>requireOwnedInstallGuard(temp,guard),/HANDOFF_UPDATE_ACTIVE/);
 assert.throws(()=>guard.release(),/MAINTENANCE_LOCK_OWNER_CHANGED/);
 fs.writeFileSync(ownerFile,original);
 assert.doesNotThrow(()=>requireOwnedInstallGuard(temp,guard));
 guard.release(); // Simulates verified new receiver CAPTURE, not failure.
 assert.equal(fs.existsSync(path.join(temp,'leases','controller-install')),false);
});
test('pre-stop handoff rejects any startup byte drift from installed manifest',()=>{
 const startup=Buffer.from('approved startup vbs\r\n');
 const original={startupSha256:createHash('sha256').update(startup).digest('hex')};
 assert.doesNotThrow(()=>requireOriginalStartupBytes(original,startup));
 assert.throws(()=>requireOriginalStartupBytes(original,Buffer.from('modified startup vbs\r\n')),
  /HANDOFF_STARTUP_DRIFT/);
 assert.throws(()=>requireOriginalStartupBytes({...original,startupSha256:'bad'},startup),
  /HANDOFF_STARTUP_DRIFT/);
});
const prior={pid:123,nonce:'11111111-2222-3333-4444-555555555555',bootAt:1700000000000};
const installed={sourceSha:'a'.repeat(40),startupSha256:'b'.repeat(64)};
const proof={schema:'ZGMINI_PC_RECEIVER_ORIGIN_V1',pid:123,nonce:prior.nonce,
 bootAt:prior.bootAt,sourceSha:installed.sourceSha,startupSha256:installed.startupSha256,
 created:'20261103072233.123456+540',session:1,sid:'S-1-5-21-123456-789012'};
test('existing receiver uses captured origin plus exact current identity without rewalking retired parent',()=>{
 const identity=`IDENTIFIED|${proof.created}|${proof.session}|${proof.sid}`;
 assert.doesNotThrow(()=>requireCurrentReceiverIdentity(prior,proof,installed,identity));
 for(const bad of ['UNKNOWN',identity.replace('.123456','.123457'),identity.replace('|1|','|2|'),identity.replace(proof.sid,'S-1-5-21-999')])
  assert.throws(()=>requireCurrentReceiverIdentity(prior,proof,installed,bad),/HANDOFF_RECEIVER_IDENTITY_NOT_PROVEN/);
 assert.throws(()=>requireCurrentReceiverIdentity(prior,null,installed,identity),/HANDOFF_RECEIVER_ORIGIN_NOT_PROVEN/);
});
test('missing, invalid, active and uncertain receiver ownership fail closed',()=>{
 for(const item of [null,undefined,{}, {pid:0,nonce:prior.nonce},{pid:123},
   {...prior,nonce:'../forged'}])assert.throws(()=>requireStopped(item,()=>false),/NOT_PROVEN_STOPPED/);
 assert.doesNotThrow(()=>requireStopped(prior,()=>false));
 for(const value of [true,null])assert.throws(()=>requireStopped(prior,()=>value),/NOT_PROVEN_STOPPED/);
});
test('released original lease is allowed only with a known, stopped prior receiver',()=>{
 assert.doesNotThrow(()=>requireNoReplacement(prior,null));
 assert.doesNotThrow(()=>requireNoReplacement(prior,{pid:prior.pid,nonce:prior.nonce}));
 assert.throws(()=>requireNoReplacement(null,null),/HANDOFF_RECEIVER_CHANGED/);
 assert.throws(()=>requireNoReplacement(prior,{...prior,nonce:'other'}),/HANDOFF_RECEIVER_CHANGED/);
 assert.throws(()=>requireNoReplacement(prior,{pid:456,nonce:prior.nonce}),/HANDOFF_RECEIVER_CHANGED/);
});
test('rollback window permits only original or our own reserved slot before new startup',()=>{
 const reserved={pid:987,nonce:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'};
 assert.doesNotThrow(()=>requireRollbackWindow({prior,current:null}));
 assert.doesNotThrow(()=>requireRollbackWindow({prior,current:prior}));
 assert.doesNotThrow(()=>requireRollbackWindow({prior,current:reserved,reservationOwner:reserved}));
 assert.throws(()=>requireRollbackWindow({prior,current:reserved}),/HANDOFF_RECEIVER_CHANGED/);
 assert.throws(()=>requireRollbackWindow({prior,current:reserved,reservationOwner:{...reserved,nonce:'drift'}}),
  /HANDOFF_RECEIVER_CHANGED/);
 assert.throws(()=>requireRollbackWindow({prior,current:null,startupInvoked:true}),
  /HANDOFF_NEW_RECEIVER_MAY_BE_RUNNING/);
 assert.throws(()=>requireRollbackWindow({prior,current:reserved,reservationOwner:reserved,startupInvoked:true}),
  /HANDOFF_NEW_RECEIVER_MAY_BE_RUNNING/);
});
test('receiver record and live Windows CAPTURE must match the prior process identity',()=>{
 const capture=`ATTESTED|${proof.created}|${proof.session}|${proof.sid}`;
 assert.doesNotThrow(()=>requireReceiverOrigin(prior,proof,installed));
 assert.doesNotThrow(()=>requireReceiverOrigin(prior,proof,installed,capture+'\r\n'));
 for(const changed of [
   {...proof,pid:456},{...proof,bootAt:0},{...proof,nonce:'other'},
   {...proof,created:'UNKNOWN'},{...proof,session:null},{...proof,sid:''},
   {...proof,sourceSha:'c'.repeat(40)}]){
  assert.throws(()=>requireReceiverOrigin(prior,changed,installed),/ORIGIN_NOT_PROVEN/);
 }
 assert.throws(()=>requireReceiverOrigin(prior,proof,installed,'ATTESTED|reused|1|S-1-5-21'),/ORIGIN_NOT_PROVEN/);
});
test('new receiver PASS requires complete proof, fresh live Windows CAPTURE and stable owner',()=>{
 const current={pid:456,nonce:'88888888-2222-3333-4444-555555555555',bootAt:prior.bootAt};
 const fresh={...proof,pid:current.pid,nonce:current.nonce,
   created:'20261103072301.654321+540'};
 const capture=`ATTESTED|${fresh.created}|${fresh.session}|${fresh.sid}\r\n`;
 const verify=(ownerValue=current,record=fresh,wmi=capture,live=()=>true,previous=prior)=>
  requireNewReceiverOrigin(previous,proof,current,record,installed,wmi,ownerValue,live);
 assert.doesNotThrow(()=>verify());
 for(const changed of [
  {...fresh,created:proof.created},{...fresh,nonce:prior.nonce},
  {...fresh,bootAt:0},{...fresh,sourceSha:'c'.repeat(40)},
  {...fresh,startupSha256:'d'.repeat(64)},{...fresh,sid:'S-1-5-21-999999'}]){
  assert.throws(()=>verify(current,changed),/NOT_PROVEN/);
 }
 for(const wmi of [null,'',`ATTESTED|${proof.created}|${fresh.session}|${fresh.sid}`])
  assert.throws(()=>verify(current,fresh,wmi),/NOT_PROVEN/);
 assert.throws(()=>requireNewReceiverOrigin(prior,proof,current,fresh,installed,
   undefined,current,()=>true),/NOT_PROVEN/);
 for(const currentAfter of [null,{...current,pid:789},{...current,nonce:'changed'}])
  assert.throws(()=>verify(currentAfter),/NOT_PROVEN/);
 for(const status of [false,null])assert.throws(()=>verify(current,fresh,capture,()=>status),/NOT_PROVEN/);
 assert.throws(()=>verify(current,fresh,capture,()=>true,{...prior,nonce:current.nonce}),/NOT_PROVEN/);
});
test('atomic handoff reservation blocks a second receiver until owned release',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 fs.mkdirSync(path.join(temp,'leases'));
 const dir=path.join(temp,'leases','receiver');
 try{
  const reservation=reserveReceiverSlot(dir);
  assert.equal(reservation.owner.pid,process.pid);
  assert.equal(fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json')),true);
  assert.throws(()=>reserveReceiverSlot(dir),/HANDOFF_RECEIVER_LEASE_BUSY/);
  assert.throws(()=>acquireMaintenanceLock(temp,'receiver'),/MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED/);
  assert.doesNotThrow(()=>reservation.verify());
  reservation.release();
  assert.equal(fs.existsSync(dir),false);
  assert.throws(()=>reservation.release(),/HANDOFF_RESERVATION_ALREADY_RELEASED/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('pre-startup rollback retains receiver recovery marker until independently resolved',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-handoff-rollback-'));
 const dir=path.join(temp,'receiver');
 try{
  const reservation=reserveReceiverSlot(dir);
  assert.doesNotThrow(()=>preserveRollbackReservation(reservation));
  assert.equal(fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json')),true);
  assert.throws(()=>reserveReceiverSlot(dir),/HANDOFF_RECEIVER_LEASE_BUSY/);
  assert.equal(rollbackStatus({filesRestored:true,receiverReattested:false}),'RECOVERY_REQUIRED');
  reservation.release(); // Isolated fixture cleanup, not the production rollback path.
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('interrupted handoff reservation remains unreclaimable after owner exits',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 fs.mkdirSync(path.join(temp,'leases'));
 const dir=path.join(temp,'leases','receiver');
 try{
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'owner.json'),JSON.stringify({pid:2147483647,nonce:'dead-owner'})+'\n');
  fs.writeFileSync(path.join(dir,'RECOVERY_REQUIRED.json'),'recovery required\n');
  assert.throws(()=>acquireMaintenanceLock(temp,'receiver'),/MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED/);
  assert.equal(fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json')),true);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('partial reservation write failure remains RECOVERY_REQUIRED, never ROLLED_BACK',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 const dir=path.join(temp,'receiver');
 try{
  const failingIo=Object.create(fs);
  failingIo.writeFileSync=(file,...args)=>{
   if(String(file).endsWith('owner.json'))throw Object.assign(Error('simulated-write-fail'),{code:'EIO'});
   return fs.writeFileSync(file,...args);
  };
  let error=null;
  try{reserveReceiverSlot(dir,failingIo);}catch(e){error=e;}
  assert.equal(error?.code,'HANDOFF_RESERVATION_INCOMPLETE');
  assert.equal(reservationFailureStatus(error),'RECOVERY_REQUIRED');
  assert.equal(fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json')),true);
  assert.equal(fs.existsSync(path.join(dir,'owner.json')),false);
  assert.throws(()=>reserveReceiverSlot(dir),/HANDOFF_RECEIVER_LEASE_BUSY/);
  assert.equal(reservationFailureStatus({code:'HANDOFF_RECEIVER_LEASE_BUSY'}),'BLOCKED');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('reservation owner drift blocks release and retains recovery marker',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 const dir=path.join(temp,'receiver');
 try{
  const reservation=reserveReceiverSlot(dir);
  const file=path.join(dir,'owner.json');
  fs.writeFileSync(file,JSON.stringify({...reservation.owner,nonce:'external-owner'})+'\n');
  assert.throws(()=>reservation.verify(),/HANDOFF_RESERVATION_LOST/);
  assert.throws(()=>reservation.release(),/HANDOFF_RESERVATION_LOST/);
  assert.equal(fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json')),true);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('pre-existing receiver lease must never be overwritten',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 const dir=path.join(temp,'receiver');
 try{
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'owner.json'),'existing owner proof\n');
  assert.throws(()=>reserveReceiverSlot(dir),/HANDOFF_RECEIVER_LEASE_BUSY/);
  assert.equal(fs.readFileSync(path.join(dir,'owner.json'),'utf8'),'existing owner proof\n');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('restored files without reattested receiver are RECOVERY_REQUIRED',()=>{
 assert.equal(rollbackStatus({filesRestored:true,receiverReattested:false}),'RECOVERY_REQUIRED');
 assert.equal(rollbackStatus({filesRestored:false,receiverReattested:true}),'RECOVERY_REQUIRED');
 assert.equal(rollbackStatus({filesRestored:false,receiverReattested:false}),'RECOVERY_REQUIRED');
 assert.equal(rollbackStatus({filesRestored:true,receiverReattested:true}),'ROLLED_BACK');
});
