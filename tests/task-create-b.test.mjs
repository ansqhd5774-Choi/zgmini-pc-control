import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readCommittedTaskCreateB} from '../task-create-b/trusted-approval.mjs';
import {
 authorizeTaskCreateB,verifyTaskCreateBPreimage,verifyTaskCreateBCandidate,
 TASK,INSTALLED_SOURCE,SOURCE_ROOT,WRAPPER,APPROVAL_SCHEMA,
 REQUEST_SCHEMA,ISSUE_TITLE,ISSUE_LABEL,sha256,normalizedW06TaskTemplate
} from '../task-create-b/contract.mjs';
import {applyTaskCreateB} from '../task-create-b/transaction.mjs';
import {hasOnlyApprovedMinuteTrigger,hasOnlyApprovedSingleExec} from '../task-create-b/windows-adapter.mjs';

const reqId='abec1087-3a25-4452-a5a8-a45218f05c37';
const digest=value=>createHash('sha256').update(value).digest('hex');
const candidate=()=>{
 const text='<Task><Triggers><TimeTrigger><StartBoundary>2026-11-26T12:35:00.000Z</StartBoundary><Repetition><Interval>PT1M</Interval></Repetition></TimeTrigger></Triggers>'+
  '<Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>'+
  '<Enabled>true</Enabled><ExecutionTimeLimit>PT30M</ExecutionTimeLimit></Settings>'+
  '<Principals><Principal><UserId>PC\\\\test</UserId></Principal></Principals><Actions><Exec><Arguments>run-local-cnn-minute.vbs</Arguments></Exec></Actions></Task>';
 const off=text.replace('<Enabled>true</Enabled>','<Enabled>false</Enabled>');
 return {launcher:Buffer.from('Set shell = CreateObject("WScript.Shell")\r\nSet taskEnvironment = shell.Environment("PROCESS")\r\ntaskEnvironment("ZGMINI_PC_HOME") = "E:\\ZGmini\\data\\pc-writer"\r\nWScript.Quit shell.Run("local-cycle.mjs --cnn-minute --publish", 0, True)\r\n','utf8'),
  enabledXml:Buffer.from(text,'utf16le'),disabledXml:Buffer.from(off,'utf16le')};
};
const approval=bytes=>({
 schema:APPROVAL_SCHEMA,status:'APPROVED_B',
 scope:'W06_ONE_TASK_CREATE_AND_ENABLE_WITH_CNN_RUNTIME_EFFECTS',
 taskName:TASK,installedSourceSha:INSTALLED_SOURCE,
 candidateSourceSha:'f'.repeat(40),candidateFileSha256:'e'.repeat(64),sourceRoot:SOURCE_ROOT,
 wrapperPath:WRAPPER,launcherSha256:digest(bytes.launcher),
 disabledTemplateSha256:normalizedW06TaskTemplate(bytes.disabledXml),enabledTemplateSha256:normalizedW06TaskTemplate(bytes.enabledXml),
 coreTaskXmlSha256:'d'.repeat(64),sidecarSourceSha256:'e'.repeat(64),
 allowCnnHttpRequests:true,allowSqliteObservationWrites:true,
 allowD1PublicProjectionWrites:true,allowOtherTaskChanges:false,runCount:1
});
function proofSetup(){
 const bytes=candidate(),manifest=approval(bytes),raw=Buffer.from(JSON.stringify(manifest));
 const request={schema:REQUEST_SCHEMA,requestId:reqId,operation:'task-create-once',
  approvalManifestPath:'approvals/task-create-b/w06-cnn-minute-20261126.json',
  approvalManifestSha256:digest(raw)};
 const event={action:'opened',issue:{title:ISSUE_TITLE,
  user:{login:'ansqhd5774-Choi'},labels:[{name:ISSUE_LABEL}],body:JSON.stringify(request)}};
 const proof=authorizeTaskCreateB({event,manifestBytes:raw,manifestCommitted:true});
 const original={taskExists:false,wrapperExists:false,installedSourceSha:INSTALLED_SOURCE,
  configSourceSha:INSTALLED_SOURCE,coreTaskXmlSha256:manifest.coreTaskXmlSha256,
  sidecarSourceSha256:manifest.sidecarSourceSha256,
  coreTaskEnabled:true,unrelatedTaskMutation:false};
 return {bytes,manifest,raw,event,proof,original};
}
function port(original,{disabledReadback=true,enabledReadback=true,throwOnEnable=false,
 protectedOk=true,restoreOk=true,taskUndoOk=true}={}){
 const log=[];
 const io={
  async acquireSharedLease(){log.push('lease')},
  async observe(){log.push('observe');return original},
  async claimOnce(){log.push('claim')},
  async backupProtected(){log.push('backup')},
  async createLauncherExclusive(){log.push('wrapper')},
  async launcherReadback(){log.push('wrapperReadback');return true},
  async registerTaskDisabled(){log.push('registerDisabled')},
  async taskReadback(a){log.push('taskReadback:'+a.enabled);
   return a.enabled?enabledReadback:disabledReadback},
  async enableTask(){log.push('enable');if(throwOnEnable)throw Error('UNCERTAIN')},
  async verifyProtectedUnchanged(){log.push('protected');return protectedOk},
  async undoOwnedTaskIfExact(){log.push('undoTask');return taskUndoOk},
  async undoOwnedLauncherIfExact(){log.push('undoWrapper');return true},
  async verifyRestored(){log.push('verifyRestored');return restoreOk},
  async releaseSharedLease(){log.push('release')}
 };
 return {io,log};
}


test('B: Task readback rejects extra actions even if one approved Exec remains',()=>{
 const single='<Task><Actions Context="User"><Exec><Command>C:\\\\Windows\\\\System32\\\\wscript.exe</Command></Exec></Actions></Task>';
 assert.equal(hasOnlyApprovedSingleExec(single),true);
 const extras=['ComHandler','SendEmail','ShowMessage'];
 for(const name of extras){
  const altered=single.replace('</Actions>','<'+name+'></'+name+'></Actions>');
  assert.equal(hasOnlyApprovedSingleExec(altered),false,name);
 }
 assert.equal(hasOnlyApprovedSingleExec(single.replace('</Exec>',
  '<Exec><Command>other</Command></Exec></Exec>')),false);
 assert.equal(hasOnlyApprovedSingleExec(single.replace('</Task>',
  '<Actions><Exec></Exec></Actions></Task>')),false);
 assert.equal(hasOnlyApprovedSingleExec('<Task><Actions><ComHandler/></Actions></Task>'),false);
});

test('B: Task readback rejects additional scheduled triggers beside approved minute TimeTrigger',()=>{
 const single='<Task><Triggers><TimeTrigger><StartBoundary>2026-11-26T12:35:00Z</StartBoundary>'+
  '<Repetition><Interval>PT1M</Interval></Repetition></TimeTrigger></Triggers></Task>';
 assert.equal(hasOnlyApprovedMinuteTrigger(single),true);

 // A global PT1M token must not mask an actual PT5M TimeTrigger.
 const foreignMinute=single.replace('<Interval>PT1M</Interval>','<Interval>PT5M</Interval>')
  .replace('</Task>','<Meta><Interval>PT1M</Interval></Meta></Task>');
 assert.equal(hasOnlyApprovedMinuteTrigger(foreignMinute),false);
 assert.equal(hasOnlyApprovedMinuteTrigger(single.replace(
  '</Repetition>','<Interval>PT5M</Interval></Repetition>')),false);
 assert.equal(hasOnlyApprovedMinuteTrigger(single.replace(
  '<Repetition><Interval>PT1M</Interval></Repetition>','')),false);
 const extra=['BootTrigger','CalendarTrigger','LogonTrigger','EventTrigger',
  'IdleTrigger','RegistrationTrigger','SessionStateChangeTrigger'];
 for(const name of extra){
  const altered=single.replace('</Triggers>','<'+name+'><Enabled>true</Enabled></'+name+'></Triggers>');
  assert.equal(hasOnlyApprovedMinuteTrigger(altered),false,name);
 }
 assert.equal(hasOnlyApprovedMinuteTrigger(single.replace('</Triggers>',
  '<TimeTrigger><Enabled>true</Enabled></TimeTrigger></Triggers>')),false);
 assert.equal(hasOnlyApprovedMinuteTrigger(single.replace('</Task>',
  '<Triggers><BootTrigger/></Triggers></Task>')),false);
 assert.equal(hasOnlyApprovedMinuteTrigger('<Task><BootTrigger/></Task>'),false);
});

test('B: fixed template digest is independent of private principal and minute',()=>{
 const bytes=candidate();
 const replace=data=>Buffer.from(data,'utf16le');
 const alternate=replace(bytes.enabledXml.toString('utf16le')
  .replace('2026-11-26T12:35:00.000Z','2026-11-27T00:01:00.000Z')
  .replace(/<UserId>[^<]+<\/UserId>/,'<UserId>OTHER_USER</UserId>'));
 assert.equal(normalizedW06TaskTemplate(bytes.enabledXml),
  normalizedW06TaskTemplate(alternate));
 const tampered=replace(bytes.enabledXml.toString('utf16le').replace('PT1M','PT5M'));
 assert.notEqual(normalizedW06TaskTemplate(bytes.enabledXml),
  normalizedW06TaskTemplate(tampered));
});
test('B: authentic owner, committed raw manifest and explicit HTTP/SQLite/D1 effects',()=>{
 const {event,raw,proof,bytes,original}=proofSetup();
 assert.equal(verifyTaskCreateBPreimage(proof,original),true);
 assert.equal(verifyTaskCreateBCandidate(proof,bytes),true);
 const missingHome={...bytes,launcher:Buffer.from('local-cycle.mjs --cnn-minute --publish')};
 assert.throws(()=>verifyTaskCreateBCandidate(proof,missingHome),
  e=>e.code==='TASK_CREATE_B_CANDIDATE_HASH_STOP');
 assert.throws(()=>authorizeTaskCreateB({event,manifestBytes:raw,manifestCommitted:false}),
  e=>e.code==='TASK_CREATE_B_OWNER_OR_COMMIT_STOP');
 assert.throws(()=>authorizeTaskCreateB({event:{...event,issue:{...event.issue,
  user:{login:'untrusted'}}},manifestBytes:raw,manifestCommitted:true}),
  e=>e.code==='TASK_CREATE_B_OWNER_OR_COMMIT_STOP');
 const changed=Buffer.from(raw);changed[10]=changed[10]^1;
 assert.throws(()=>authorizeTaskCreateB({event,manifestBytes:changed,manifestCommitted:true}),
  e=>['TASK_CREATE_B_REQUEST_SCOPE_STOP','TASK_CREATE_B_REQUEST_OR_MANIFEST_JSON_STOP'].includes(e.code));
 assert.throws(()=>verifyTaskCreateBCandidate(proof,{...bytes,launcher:Buffer.from('bad')}),
  e=>e.code==='TASK_CREATE_B_CANDIDATE_HASH_STOP');
 assert.equal(sha256(bytes.launcher),digest(bytes.launcher));
});
test('B: Task absence, installed source, original Core/Sidecar hashes required',()=>{
 const {proof,original}=proofSetup();
 for(const patch of [{taskExists:true},{wrapperExists:true},
  {configSourceSha:'0'.repeat(40)},{coreTaskEnabled:false},
  {sidecarSourceSha256:'0'.repeat(64)},{unrelatedTaskMutation:true}]){
  assert.throws(()=>verifyTaskCreateBPreimage(proof,{...original,...patch}),
   e=>e.code==='TASK_CREATE_B_PREIMAGE_STOP');
 }
});
test('B: creates exact disabled Task, validates, then enables once',async()=>{
 const {proof,bytes,original}=proofSetup(),{io,log}=port(original);
 const result=await applyTaskCreateB(proof,bytes,io);
 assert.equal(result.status,'TASK_CREATE_B_INSTALLED_VERIFIED');
 assert.equal(result.code,'TASK_CREATE_B_ONE_TASK_ENABLE_READBACK_PASS');
 assert.equal(result.taskChanges,1);assert.equal(result.otherTaskChanges,0);
 assert.deepEqual(log,['lease','observe','claim','backup','observe','wrapper',
  'wrapperReadback','registerDisabled','taskReadback:false','protected',
  'enable','taskReadback:true','protected','release']);
 assert.equal(log.filter(x=>x==='enable').length,1);
});
test('B: preflight never claims or mutates Task',async()=>{
 const {proof,bytes,original}=proofSetup(),{io,log}=port({...original,taskExists:true});
 const result=await applyTaskCreateB(proof,bytes,io);
 assert.equal(result.status,'TASK_CREATE_B_PREFLIGHT_STOP');
 assert.equal(result.created,false);
 assert.deepEqual(log,['lease','observe','release']);
});
test('B: failure before enable restores only exactly owned Task/launcher',async()=>{
 const {proof,bytes,original}=proofSetup();
 const {io,log}=port(original,{disabledReadback:false});
 const result=await applyTaskCreateB(proof,bytes,io);
 assert.equal(result.status,'TASK_CREATE_B_INSTALL_STOP_RESTORED');
 assert.equal(result.taskChanges,0);
 assert.ok(log.includes('undoTask'));assert.ok(log.includes('undoWrapper'));
 assert.ok(log.includes('verifyRestored'));assert.ok(log.includes('release'));
 assert.equal(log.includes('enable'),false);
});
test('B: unknown activation is RECOVERY_REQUIRED, no unsafe rollback/replay',async()=>{
 const {proof,bytes,original}=proofSetup(),{io,log}=port(original,{throwOnEnable:true});
 const result=await applyTaskCreateB(proof,bytes,io);
 assert.equal(result.status,'TASK_CREATE_B_RECOVERY_REQUIRED');
 assert.equal(result.created,null);assert.equal(result.providerCalls,null);
 assert.equal(log.filter(x=>x==='enable').length,1);
 assert.equal(log.includes('undoTask'),false);
 assert.equal(log.includes('release'),false);
});
test('B: ambiguous exclusive-wrapper creation never removes possibly foreign file',async()=>{
 const {proof,bytes,original}=proofSetup(),{io,log}=port(original);
 io.createLauncherExclusive=async()=>{log.push('wrapper');throw Error('EEXIST_OR_PARTIAL_WRITE');};
 const result=await applyTaskCreateB(proof,bytes,io);
 assert.equal(result.status,'TASK_CREATE_B_RECOVERY_REQUIRED');
 assert.equal(result.code,'TASK_CREATE_B_CREATION_OUTCOME_UNKNOWN');
 assert.equal(result.created,null);
 assert.equal(log.includes('undoWrapper'),false);
 assert.equal(log.includes('undoTask'),false);
 assert.equal(log.includes('release'),false);
});
test('B: ambiguous Windows scheduler registration never deletes another Task',async()=>{
 const {proof,bytes,original}=proofSetup(),{io,log}=port(original);
 io.registerTaskDisabled=async()=>{log.push('registerDisabled');throw Error('UNKNOWN_SCHTASKS_EXIT');};
 const result=await applyTaskCreateB(proof,bytes,io);
 assert.equal(result.status,'TASK_CREATE_B_RECOVERY_REQUIRED');
 assert.equal(result.code,'TASK_CREATE_B_CREATION_OUTCOME_UNKNOWN');
 assert.equal(result.created,null);
 assert.equal(log.includes('undoTask'),false);
 assert.equal(log.includes('undoWrapper'),false);
 assert.equal(log.includes('enable'),false);
 assert.equal(log.includes('release'),false);
});
test('B: failed pre-enable rollback retains lease and claim for reconciliation',async()=>{
 const {proof,bytes,original}=proofSetup();
 const {io,log}=port(original,{disabledReadback:false,taskUndoOk:false});
 const result=await applyTaskCreateB(proof,bytes,io);
 assert.equal(result.status,'TASK_CREATE_B_RECOVERY_REQUIRED');
 assert.equal(result.code,'TASK_CREATE_B_ROLLBACK_UNVERIFIED');
 assert.equal(log.includes('release'),false);
});


test('B: committed approval reader denies dirty/non-owner/unsafe paths',()=>{
 const {event,raw}=proofSetup();
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w06-task-create-b-'));
 try{
  const dir=path.join(root,'approvals','task-create-b');
  fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'w06-cnn-minute-20261126.json');
  fs.writeFileSync(file,raw);
  const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
   GITHUB_SHA:'c'.repeat(40)};
  const gitOk=(_root,args)=>({status:0,
   stdout:args[0]==='rev-parse'?env.GITHUB_SHA+'\n':''});
  const authorized=readCommittedTaskCreateB({controlRoot:root,event,env,runGit:gitOk});
  assert.equal(verifyTaskCreateBPreimage(authorized,proofSetup().original),true);
  const gitDirty=(_root,args)=>({status:args[0]==='diff'?1:0,
   stdout:args[0]==='rev-parse'?env.GITHUB_SHA+'\n':''});
  assert.throws(()=>readCommittedTaskCreateB({controlRoot:root,event,env,runGit:gitDirty}),
   e=>e.code==='TASK_CREATE_B_APPROVAL_COMMIT_STOP');
  assert.throws(()=>readCommittedTaskCreateB({controlRoot:root,event,
   env:{...env,GITHUB_SHA:'0'.repeat(40)},runGit:gitOk}),
   e=>e.code==='TASK_CREATE_B_CONTROL_HEAD_STOP');
  assert.throws(()=>readCommittedTaskCreateB({controlRoot:root,event:{
   ...event,issue:{...event.issue,body:'{"approvalManifestPath":"../secret.json"}'}},
   env,runGit:gitOk}),e=>e.code==='TASK_CREATE_B_APPROVAL_PATH_STOP');
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
