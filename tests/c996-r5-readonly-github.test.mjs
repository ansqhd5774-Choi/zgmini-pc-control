import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvent,selectSafeReport,runCollector,uploadVerifiedPair,REPO,HOST,SCHEMA,OPERATION}
  from '../c996-r5-readonly/github-runner.mjs';

const uuid='ef64077e-61ab-40a0-abcd-a46d31f4e727';
const ctx={requestId:uuid,issueNumber:1500,runId:'42700000001',attempt:'1'};
function fixture(){
  return {event:{action:'opened',repository:{full_name:REPO,private:true},
    issue:{number:1500,title:'pc-c996-r5-readonly',user:{login:'ansqhd5774-Choi'},
      labels:[],
      body:JSON.stringify({schema:SCHEMA,requestId:uuid,operation:OPERATION,host:HOST})}},
    env:{GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
      GITHUB_EVENT_NAME:'issues',GITHUB_RUN_ID:ctx.runId,GITHUB_RUN_ATTEMPT:ctx.attempt}};
}
function raw(){return {schema:'C996_R5_LOG_EVIDENCE_READONLY_V1',host:HOST,
  status:'COMPLETE',code:'LOGS_PRESENT_STAGE_UNPROVEN',rawLogIncluded:false,
  operationalWrites:0,discardAttempts:0,isoAttempts:0,
  inputs:[{id:'FINAL_WIM',bytes:341652286,sha256:'a'.repeat(64),matched:true}],
  logs:[{name:'COMMIT_NEW_WIM.dism.log',directory:'ISO_ATTEMPT',lines:12,
    bytes:900,sha256:'b'.repeat(64),counts:{COMMIT_REQUEST:1},
    events:[{code:'COMMIT_REQUEST',line:5,at:'11/12/2026 03:01:02',raw:'PRIVATE LINE'}]}]};}
test('verified issue and exact request schema',()=>{
 const {event,env}=fixture();assert.deepEqual(validateEvent(event,env),ctx);
});
test('issue scope stops arbitrary CMD or path injections',()=>{
 const {event,env}=fixture();
 for(const mutate of [
   x=>x.cmd='dir C:\\',x=>x.path='C:\\Users\\ansqh',x=>x.operation='shell',
   x=>x.host='OTHER',x=>x.requestId='bad',x=>x.schema='other'
 ]) {
   const copy=structuredClone(event),body=JSON.parse(copy.issue.body);
   mutate(body);copy.issue.body=JSON.stringify(body);
   assert.throws(()=>validateEvent(copy,env));
 }
});
test('issue authenticity and event provenance are checked',()=>{
 for(const mutate of [
  f=>f.event.issue.user.login='attacker',f=>f.event.repository.private=false,
  f=>f.event.repository.full_name='other/repo',f=>f.env.GITHUB_ACTOR='other',
  f=>f.env.GITHUB_EVENT_NAME='issue_comment',f=>f.event.action='labeled',
  f=>f.event.issue.title='other-work'
 ]){
  const f=fixture();mutate(f);assert.throws(()=>validateEvent(f.event,f.env));
 }
});
test('collector output rebuild drops raw text and paths',()=>{
 const r=raw();r.absolute='C:\\Users\\secret';r.logs[0].events[0].raw='TOP SECRET';
 const s=selectSafeReport(r,ctx,HOST);
 assert.equal(s.pinCount,1);assert.equal(s.logCount,1);
 assert.doesNotMatch(JSON.stringify(s),/TOP SECRET|C:\\Users\\secret/);
 assert.equal(s.rootCauseStage,'UNKNOWN');assert.equal(s.operationalWrites,0);
});
test('unexpected fields in structured log reject',()=>{
 const r=raw();r.logs[0].counts.DANGEROUS=1;
 assert.throws(()=>selectSafeReport(r,ctx,HOST),/LOG_REPORT_STOP/);
});
test('raw log inclusion or operational write stops',()=>{
 for(const key of ['rawLogIncluded','operationalWrites','discardAttempts','isoAttempts']){
 const r=raw();r[key]=key==='rawLogIncluded'?true:1;
 assert.throws(()=>selectSafeReport(r,ctx,HOST),/REPORT_CONTRACT_STOP/);
 }
});
test('wrong host blocks without touching inputs',()=>{
 const r=runCollector(ctx,'OTHER_HOST');
 assert.equal(r.status,'BLOCKED');assert.equal(r.code,'WRONG_HOST');
 assert.equal(r.operationalWrites,0);assert.equal(r.rawLogIncluded,false);
});
test('readback pair uploads only sanitized JSON and TXT and comments after both',async()=>{
 const r=selectSafeReport(raw(),ctx,HOST),files=new Map(),calls=[];
 const fake=async(url,{method,body})=>{
   calls.push(method);
   const suffix=new URL(url).pathname;
   if(method==='PUT') {
     const b=JSON.parse(body);files.set(suffix,Buffer.from(b.content,'base64').toString('utf8'));
     return {ok:true,status:201,json:async()=>({})};
   }
   if(method==='GET') return {ok:true,status:200,json:async()=>({
     content:Buffer.from(files.get(suffix.replace(/\?ref=.*/,''))).toString('base64')})};
   if(method==='POST') return {ok:true,status:201,json:async()=>({id:1})};
 };
 const x=await uploadVerifiedPair(r,'fake-test-token',fake);
 assert.equal(x.verified,true);assert.deepEqual(calls,['PUT','GET','PUT','GET','POST']);
 assert.equal(files.size,2);
 assert.doesNotMatch([...files.values()].join('\n'),/TOP SECRET|PRIVATE LINE/);
});
test('readback mismatch never creates issue success comment',async()=>{
 const r=selectSafeReport(raw(),ctx,HOST),calls=[];
 const fake=async(_,opts)=>{
  calls.push(opts.method);
  return {ok:true,status:200,json:async()=>opts.method==='GET'?{content:Buffer.from('wrong').toString('base64')}:{}};};
 await assert.rejects(uploadVerifiedPair(r,'fake-token',fake),/RESULT_READBACK_MISMATCH/);
 assert.deepEqual(calls,['PUT','GET']);
});
test('missing GitHub token stops before any upload',async()=>{
 await assert.rejects(uploadVerifiedPair(selectSafeReport(raw(),ctx,HOST),'',async()=>{}),/TOKEN_MISSING/);
});
