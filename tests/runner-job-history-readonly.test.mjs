import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {inspectRunnerJobHistory,validateRunnerJobRefs}
 from '../tools/runner-job-history-readonly.mjs';
import {authenticateProcess,SCHEMA,TITLE,ROLE_OPERATION}
 from '../tools/pc-process-inventory-readonly.mjs';

const NOW=Date.now();
const start=new Date(NOW-3600000);
start.setMilliseconds(0);
const end=new Date(start.getTime()+13*60000);
const ref={runId:'44372235510',jobId:'135041841316',seat:3,
 startedAtUtc:start.toISOString().replace('.000Z','Z'),
 completedAtUtc:end.toISOString().replace('.000Z','Z')};
const root=path.resolve('/pc-control');
function logName(kind,d){
 const s=d.toISOString().replace(/[-:]/g,'');
 return kind+'_'+s.slice(0,8)+'-'+s.slice(9,15)+'-utc.log';
}
function fakeLogs(content,kind='Worker'){
 const files=new Map([[logName(kind,new Date(start.getTime()+20000)),content]]);
 return {
  lstatSync(p){
   if(String(p).endsWith('_diag'))return {isDirectory:()=>true,isSymbolicLink:()=>false};
   if(!files.has(path.basename(p)))throw Error('ENOENT');
   return {isFile:()=>true,isSymbolicLink:()=>false,size:Buffer.byteLength(files.get(path.basename(p)))};
  },
  readdirSync(){return [...files.keys()].map(name=>({
   name,isFile:()=>true,isSymbolicLink:()=>false}));},
  openSync(p){return path.basename(p);},
  fstatSync(fd){return {size:Buffer.byteLength(files.get(fd)),isFile:()=>true};},
  readSync(fd,b,offset,n,pos){
   const data=Buffer.from(files.get(fd));
   return data.copy(b,offset,pos,pos+n);
  },
  closeSync(){}
 };
}
test('scope validation rejects arbitrary commands, time windows and unknown fields',()=>{
 assert.equal(validateRunnerJobRefs([ref],NOW)[0].seat,3);
 for(const x of [{...ref,seat:7},{...ref,path:'secret'},
  {...ref,startedAtUtc:'2001-01-01T00:00:00Z'},
  {...ref,completedAtUtc:new Date(NOW+86400000).toISOString().replace('.000Z','Z')}])
  assert.throws(()=>validateRunnerJobRefs([x],NOW));
 assert.throws(()=>validateRunnerJobRefs([ref,ref],NOW));
 assert.throws(()=>validateRunnerJobRefs([],NOW));
});
test('exact numeric reference yields only bounded yes/no hints, no raw secrets',()=>{
 const io=fakeLogs('PRIVATE_SECRET=TOPSECRET\nJob request 135041841316 received.\n'+
  'Starting worker for 135041841316\nJob cancellation 135041841316', 'Worker');
 const x=inspectRunnerJobHistory([ref],{io,root,now:NOW})[0];
 assert.equal(x.classification,'EXACT_JOB_REFERENCE_IN_DIAG');
 assert.equal(x.exactReferences,1);
 assert.equal(x.workerCandidates,1);
 assert.equal(x.receivedHint,true);
 assert.equal(x.workerHint,true);
 assert.equal(x.cancelHint,true);
 assert.doesNotMatch(JSON.stringify(x),/PRIVATE|TOPSECRET|path|filename|worker.*\.log/i);
});
test('time-neighbor logs are not attributed to a job without exact reference',()=>{
 const io=fakeLogs('SECRET=PRIVATE\nStarting Worker for a different job','Worker');
 const x=inspectRunnerJobHistory([ref],{io,root,now:NOW})[0];
 assert.equal(x.classification,'TIME_ONLY_UNATTRIBUTED');
 assert.equal(x.exactReferences,0);
 assert.equal(x.workerHint,false);
 assert.doesNotMatch(JSON.stringify(x),/SECRET|PRIVATE/);
});
test('absent _diag and malformed log never imply worker did not execute',()=>{
 const bad={lstatSync(){throw Error('EACCES')}};
 const x=inspectRunnerJobHistory([ref],{io:bad,root,now:NOW})[0];
 assert.equal(x.classification,'DIAG_UNAVAILABLE');
 const io=fakeLogs('UNRELATED', 'Runner');
 assert.equal(inspectRunnerJobHistory([ref],{io,root,now:NOW})[0].classification,
  'TIME_ONLY_UNATTRIBUTED');
});
test('existing process inventory A accepts only owner opt-in operating Runner refs',()=>{
 const body={schema:SCHEMA,operation:ROLE_OPERATION,requestId:'2d605c34-939e-43e4-8ca1-58d678bf3862',
  role:'operating',runnerJobRefs:[ref]};
 const event={action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
  issue:{number:2237,user:{login:'ansqhd5774-Choi'},title:TITLE,body:JSON.stringify(body)}};
 const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
  GITHUB_RUN_ID:'44442220000',GITHUB_RUN_ATTEMPT:'1'};
 const v=authenticateProcess(event,env,'operating');
 assert.equal(v.runnerJobRefs?.length,1);
 assert.throws(()=>authenticateProcess({...event,issue:{...event.issue,
  body:JSON.stringify({...body,role:'handoff'})}},env,'handoff'));
 assert.throws(()=>authenticateProcess({...event,issue:{...event.issue,
  body:JSON.stringify({...body,script:'bad'})}},env,'operating'));
});
