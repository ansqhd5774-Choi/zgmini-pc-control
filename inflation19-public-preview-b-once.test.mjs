import assert from 'node:assert/strict';
import test from 'node:test';
import {validate,validatePreview,resultName,SCHEMA,SOURCE_SHA,TITLE} from './inflation19-public-preview-b-once.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const args=()=>({
 env:{GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1'},
 event:{action:'opened',repository:{private:true,full_name:'ansqhd5774-Choi/zgmini-pc-control'},
 issue:{number:311,user:{login:'ansqhd5774-Choi'},title:TITLE,
 body:JSON.stringify({schema:SCHEMA,operation:'verify-private-19-public-preview-readonly-once',
 sourceSha:SOURCE_SHA,requestId:'pc-infl19-preview-'+id,chatId:'chat-'+id})}}
});
test('exact event schema admits only owned private fixed operation and unique result',()=>{
 const {event,env}=args();assert.equal(validate(event,env).sourceSha,SOURCE_SHA);
 assert.equal(resultName(311),'INFL19_PUBLIC_PREVIEW_311.json');
});
test('reject unsafe actor, changed SHA, extra code, replay attempts and public issues',()=>{
 const {event,env}=args();
 assert.throws(()=>validate(event,{...env,GITHUB_ACTOR:'attacker'}));
 assert.throws(()=>validate(event,{...env,GITHUB_RUN_ATTEMPT:'2'}));
 assert.throws(()=>validate({...event,repository:{...event.repository,private:false}},env));
 const body=JSON.parse(event.issue.body);
 assert.throws(()=>validate({...event,issue:{...event.issue,body:JSON.stringify({...body,command:'powershell'})}},env));
 assert.throws(()=>validate({...event,issue:{...event.issue,body:JSON.stringify({...body,sourceSha:'a'.repeat(40)})}},env));
});
test('19/19 sanitized status and 0 mutation valid, no raw input included',()=>{
 const latest=Object.fromEntries(['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'].map(id=>[id,'2026-09']));
 const s={status:'PASS_READONLY',code:'INFL19_PUBLIC_PREVIEW',ready:19,
  latest,missing:{},providerCalls:0,dbWrites:0,coreWrites:0,d1Writes:0,schedulerWrites:0};
 assert.equal(validatePreview(s).ready,19);
 assert.throws(()=>validatePreview({...s,d1Writes:1}));
 assert.throws(()=>validatePreview({...s,ready:18}));
 assert.throws(()=>validatePreview({...s,latest:{...latest,raw:'PRIVATE_SECRET'}}));
});
test('partial reporting must explicitly name every missing source',()=>{
 const s={status:'PASS_READONLY',code:'INFL19_PUBLIC_PREVIEW',ready:1,latest:{'3':'2026-10-27'},
  missing:Object.fromEntries(['1','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'].map(x=>[x,'INFL19_SOURCE_UNAVAILABLE'])),
  providerCalls:0,dbWrites:0,coreWrites:0,d1Writes:0,schedulerWrites:0};
 assert.equal(validatePreview(s).ready,1);
 assert.throws(()=>validatePreview({...s,missing:{}}));
});
