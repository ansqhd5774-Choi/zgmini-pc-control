import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  OPERATION,REQUEST_SCHEMA,APPROVAL_SCHEMA,TARGET,CYCLE,TASK,
  TARGET_AFTER_SHA,CYCLE_SHA,ACTION_SHA,authorizeExistingR47Task,
  runAuthorizedR47Task,runR47ExistingTaskEntry,
} from '../tools/r47-existing-task-once.mjs';
import {sanitizeR47TaskResult}
  from '../tools/r47-existing-task-report.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control',sha=b=>
  createHash('sha256').update(b).digest('hex');
function fixture(){
 const m={
  schema:APPROVAL_SCHEMA,status:'APPROVED_B',
  scope:'W03_R47_EXISTING_TASK_RUN_ONCE',operation:OPERATION,
  controlSourceSha:'b'.repeat(40),taskName:TASK,
  actionSha256:ACTION_SHA,helperAfterSha256:TARGET_AFTER_SHA,
  cycleSha256:CYCLE_SHA,maxLaunches:1,allowProviderCalls:true,
  allowSqliteWrites:false,allowD1Writes:false,
  allowTaskRegistrationChanges:false,allowScheduleChanges:false,
  allowOtherOperations:false,
 };
 const bytes=Buffer.from(JSON.stringify(m));
 const req={
  schema:REQUEST_SCHEMA,requestId:'00000000-0000-4000-8000-000000000001',
  chatId:'00000000-0000-4000-8000-000000000002',operation:OPERATION,
  controlRepository:repo,
  approvalManifestPath:'approvals/r47-task-once/r47-task-exact-once.json',
  approvalManifestSha256:sha(bytes),
 };
 const event={repository:{full_name:repo,private:true},
  sender:{login:'ansqhd5774-Choi'},
  issue:{number:1555,title:OPERATION,user:{login:'ansqhd5774-Choi'},
   labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(req)}};
 const env={GITHUB_REPOSITORY:repo,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:'a'.repeat(40),
  GITHUB_RUN_ID:'438000000001'};
 return {m,bytes,req,event,env};
}
function fakeIo(steps,{badHash=false,ambiguous=false}={}){
 return {
  acquire:()=>{steps.push('LEASE');return {fd:7};},
  sourceDigest:(file,bytes)=>{
   steps.push('SOURCE');
   assert.equal(bytes,file===TARGET?219531:6378);
   assert.ok(file===TARGET||file===CYCLE);
   return badHash?'0'.repeat(64):
     file===TARGET?TARGET_AFTER_SHA:CYCLE_SHA;
  },
  taskXml:()=>{steps.push('TASK_XML');return 'fixed-schtasks.exe';},
  claim:()=>{steps.push('CLAIM');},
  launch:({exe})=>{
   assert.equal(exe,'fixed-schtasks.exe');
   steps.push('LAUNCH');return ambiguous?'STATE_UNKNOWN':'ACCEPTED';
  },
  release:({retain})=>{steps.push(retain?'RETAIN':'RELEASE');},
 };
}
test('one-shot approved event forbids task edits and D1 writes',()=>{
 const x=fixture();
 const p=authorizeExistingR47Task({event:x.event,env:x.env,manifestBytes:x.bytes});
 assert.equal(p.manifest.taskName,TASK);
 const wrong=fixture();
 wrong.m.allowScheduleChanges=true;
 const b=Buffer.from(JSON.stringify(wrong.m));
 wrong.req.approvalManifestSha256=sha(b);
 wrong.event.issue.body=JSON.stringify(wrong.req);
 assert.throws(()=>authorizeExistingR47Task({event:wrong.event,
  env:wrong.env,manifestBytes:b}),e=>e.code==='R47_TASK_APPROVAL_DENIED');
});
test('accepted Windows Task Scheduler start is NOT collection success',async()=>{
 const x=fixture(),p=authorizeExistingR47Task({
  event:x.event,env:x.env,manifestBytes:x.bytes});
 const steps=[];
 const r=await runAuthorizedR47Task(p,fakeIo(steps));
 assert.equal(r.status,'RUN_REQUEST_ACCEPTED');
 assert.equal(r.code,'R47_TASK_SCHEDULER_ACCEPTED');
 assert.equal(r.collectorVerified,false);
 assert.equal(r.providerCalls,null);
 assert.equal(r.sqliteWrites,null);
 assert.equal(r.d1Writes,null);
 assert.deepEqual(steps,['LEASE','SOURCE','SOURCE','TASK_XML','CLAIM','LAUNCH','RELEASE']);
 const result=sanitizeR47TaskResult(r,x.req,x.env);
 assert.equal(result.status,'RUN_REQUEST_ACCEPTED');
 assert.equal(result.collectorVerified,false);
});
test('wrong source SHA prevents Task launch and one-shot claim',async()=>{
 const x=fixture(),p=authorizeExistingR47Task({event:x.event,
  env:x.env,manifestBytes:x.bytes});
 const steps=[];
 const r=await runAuthorizedR47Task(p,fakeIo(steps,{badHash:true}));
 assert.equal(r.status,'PREFLIGHT_STOP');
 assert.equal(r.code,'R47_TASK_PATCH_NOT_INSTALLED_STOP');
 assert.deepEqual(steps,['LEASE','SOURCE','RELEASE']);
});
test('uncertain Task Scheduler start is consumed, retained, never retried',async()=>{
 const x=fixture(),p=authorizeExistingR47Task({event:x.event,
  env:x.env,manifestBytes:x.bytes});
 const steps=[];
 const r=await runAuthorizedR47Task(p,fakeIo(steps,{ambiguous:true}));
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.taskRunRequested,true);
 assert.equal(r.collectorVerified,false);
 assert.equal(steps.at(-1),'RETAIN');
 assert.equal(steps.filter(x=>x==='LAUNCH').length,1);
});
test('unissued proof cannot launch Task',async()=>{
 const steps=[],forged={manifest:{operation:OPERATION,taskName:TASK},
  request:{requestId:'00000000-0000-4000-8000-000000000001'}};
 await assert.rejects(()=>runAuthorizedR47Task(forged,fakeIo(steps)),
  e=>e.code==='R47_TASK_PROOF_REQUIRED');
 assert.deepEqual(steps,[]);
});
test('source admission checks code pin before any task effects',async()=>{
 const x=fixture(),steps=[];
 const io=fakeIo(steps);
 const r=await runR47ExistingTaskEntry({
  event:x.event,env:x.env,controlRoot:'C:\\test',
  verifyRoot:()=>steps.push('ROOT'),
  readManifest:()=>x.bytes,
  verifyCode:(_,pin)=>{assert.equal(pin,'b'.repeat(40));steps.push('CODE');},
  io,
 });
 assert.equal(r.status,'RUN_REQUEST_ACCEPTED');
 assert.deepEqual(steps.slice(0,3),['ROOT','CODE','LEASE']);
});
test('reported result cannot claim raw or database success',()=>{
 const x=fixture(),raw={
  requestId:x.req.requestId,status:'RUN_REQUEST_ACCEPTED',
  code:'R47_TASK_SCHEDULER_ACCEPTED',taskRunRequested:true,
  collectorVerified:true,providerCalls:14,sqliteWrites:14,d1Writes:1,
  controlSha:x.env.GITHUB_SHA,rawDbRows:'PRIVATE'};
 const rejected=sanitizeR47TaskResult(raw,x.req,x.env);
 assert.equal(rejected.status,'STATE_UNKNOWN');
 const good=sanitizeR47TaskResult({...raw,collectorVerified:false,
  providerCalls:null,sqliteWrites:null,d1Writes:null},x.req,x.env);
 assert.equal(good.status,'RUN_REQUEST_ACCEPTED');
 assert.equal(JSON.stringify(good).includes('PRIVATE'),false);
});
test('existing Writer B workflow uses only explicit operation and normal path',()=>{
 const root=path.dirname(fileURLToPath(import.meta.url));
 const s=fs.readFileSync(path.join(root,'..','.github','workflows',
  'pc-writer-b-source-once.yml'),'utf8');
 assert.match(s,/r47-existing-task-run-once/);
 assert.match(s,/tools\\r47-existing-task-once\.mjs/);
 assert.match(s,/tools\\r47-existing-task-report\.mjs/);
});

for(const[name,change]of Object.entries({actor:x=>x.env.GITHUB_ACTOR='other',retry:x=>x.env.GITHUB_RUN_ATTEMPT='2',action:x=>x.env.GITHUB_EVENT_ACTION='edited',wrongTask:x=>x.m.taskName='ZGMINI-PC-Local-Core',sqlite:x=>x.m.allowSqliteWrites=true,providerDenied:x=>x.m.allowProviderCalls=false}))test('fixed R47 one-shot rejects '+name,()=>{const x=fixture();change(x);const bytes=Buffer.from(JSON.stringify(x.m));x.req.approvalManifestSha256=sha(bytes);x.event.issue.body=JSON.stringify(x.req);assert.throws(()=>authorizeExistingR47Task({event:x.event,env:x.env,manifestBytes:bytes}));});
