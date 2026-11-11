import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticateProcess,collect,sanitizeProbe,toText,SCHEMA,TITLE,ROLE_OPERATION}
 from '../tools/pc-process-inventory-readonly.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
function event(role='operating'){
 const request={schema:SCHEMA,operation:ROLE_OPERATION,role,
  requestId:'2d605c34-939e-43e4-8ca1-58d678bf3862'};
 return {action:'opened',repository:{full_name:REPO,private:true},
  issue:{number:2001,user:{login:'ansqhd5774-Choi'},title:TITLE,
   body:JSON.stringify(request)}};
}
const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
 GITHUB_EVENT_NAME:'issues',GITHUB_RUN_ID:'43110000000',GITHUB_RUN_ATTEMPT:'1'};
test('exact read-only schema, owner, roles and run provenance',()=>{
 assert.equal(authenticateProcess(event(),env,'operating').role,'operating');
 assert.equal(authenticateProcess(event('handoff'),env,'handoff').role,'handoff');
 for(const role of ['operating','handoff']){
  const e=event(role),b=JSON.parse(e.issue.body);
  for(const prop of ['cmd','path','script','token','operationWrites']){
   assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
    body:JSON.stringify({...b,[prop]:'not-allowed'})}},env,role));
  }
 }
 assert.throws(()=>authenticateProcess({...event(),action:'labeled'},env,'operating'));
 assert.throws(()=>authenticateProcess(event(),{...env,GITHUB_ACTOR:'other'},'operating'));
});
test('sanitize output keeps only bounded whitelisted Windows process metadata',()=>{
 const result=sanitizeProbe({schema:'ZGMINI_PC_PROCESS_PROBE_V1',
  observedAtUtc:'2026-11-12T10:00:00Z',totalProcessCount:151,
  selectedProcessCount:2,processes:[
  {name:'Runner.Listener.exe',pid:44,ppid:3,session:1,workingSetMiB:84,commandLine:'super-secret'},
  {name:'node.exe',pid:46,ppid:44,session:1,workingSetMiB:31,
   path:'C:\\Users\\secret'}],services:[{name:'actions.runner.zgmini-pc-03',
  state:'Running',startMode:'Auto',path:'C:\\SECRET'}],
  serviceStatus:'OK',tasks:[{name:'ZGMINI-PC-Local-Core',state:'Ready',argument:'SECRET'}],
  taskStatus:'OK',startup:['ZGMINI_PC_CONTROL.vbs'],startupStatus:'OK'});
 assert.equal(result.processes.length,2);
 assert.equal(result.totalProcessCount,151);
 assert.doesNotMatch(JSON.stringify(result),/super-secret|C:\\Users|SECRET/);
 assert.equal(result.services[0].startMode,'Auto');
 assert.equal(result.tasks[0].state,'Ready');
});
test('reject unapproved process names, task names, service names',()=>{
 const raw={schema:'ZGMINI_PC_PROCESS_PROBE_V1',
  processes:[{name:'unknown.exe',pid:1,ppid:0}],services:[],tasks:[]};
 assert.throws(()=>sanitizeProbe(raw),/PROBE_PROCESS_NOT_ALLOWLISTED/);
 assert.throws(()=>sanitizeProbe({...raw,processes:[],tasks:[{name:'MicrosoftWindows',state:'Ready'}]}));
 assert.throws(()=>sanitizeProbe({...raw,processes:[],services:[{name:'SecretsService',state:'Running'}]}));
});
test('result text is limited to safe run summary',()=>{
 const text=toText({schema:'R',requestId:'id',role:'handoff',runId:'1',
  attempt:'1',host:'PC',runnerName:'runner',status:'PASS',
  code:'PROCESS_INVENTORY_COLLECTED',observedAtUtc:'2026-11-12T00:00Z',
  snapshot:{totalProcessCount:140,selectedProcessCount:12}});
 assert.match(text,/totalProcessCount=140/);
 assert.doesNotMatch(text,/cmd|token|AppData|C:\\Users/i);
});
test('no implicit cross-host worker execution',()=>{
 const out=collect('operating',{requestId:'id',issueNumber:2,runId:'2',attempt:'1'},
  {RUNNER_NAME:'zgmini-handoff-ci-spare-01'});
 assert.equal(out.status,'BLOCKED');
});
