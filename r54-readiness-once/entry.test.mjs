import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect,validateRequest,TITLE,SCHEMA,REPO,OWNER,TASK_NAMES} from './entry.mjs';

const id='12345678-1234-4123-8123-123456789abc';
const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:OWNER,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_SHA:'a'.repeat(40)};
const request={schema:SCHEMA,operation:'r54-readiness-readonly-once',
 requestId:'pc-theme-r54-readiness-'+id,chatId:'chat-'+id,controlSha:env.GITHUB_SHA};
const event={action:'opened',repository:{private:true,full_name:REPO},issue:{number:301,
 user:{login:OWNER},title:TITLE,labels:[],body:JSON.stringify(request)}};

test('exact issue and immutable request are accepted',()=>{
 assert.deepEqual(validateRequest(event,env),request);
});
test('request cannot choose operation or source',()=>{
 const replaced={...request,operation:'shell'};
 assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify(replaced)}},env),
  /R54_READINESS_REQUEST_DENIED/);
 const extra={...request,command:'schtasks /Delete'};
 assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify(extra)}},env),
  /R54_READINESS_REQUEST_DENIED/);
});
test('task failure is isolated and does not mask other task results',()=>{
 const seen=[];
 const r=inspect({freeMiB:1488,dataRoot:'R54-fixture',
  taskQuery:name=>{seen.push(name);if(name===TASK_NAMES[1]){
   const error=Object.assign(new Error('not found'),{status:1});throw error;
  }return Buffer.from('<Task/>');},
  list:()=>[]});
 assert.deepEqual(seen,TASK_NAMES);
 assert.equal(r.tasks[0].found,true);
 assert.equal(r.tasks[1].found,false);
 assert.equal(r.tasks[1].exitCode,1);
 assert.equal(r.tasks[2].found,true);
 assert.equal(r.freeMiB,1488);
});
test('observation contains no raw XML or error stderr',()=>{
 const r=inspect({freeMiB:1700,dataRoot:'R54-fixture',
  taskQuery:name=>{if(name===TASK_NAMES[2])throw Object.assign(new Error('secret'),{status:1,stderr:'secret'});
   return Buffer.from('<Task><Password>secret</Password></Task>');},
  list:()=>[]});
 const body=JSON.stringify(r);
 assert.equal(body.includes('<Task>'),false);
 assert.equal(body.includes('secret'),false);
});
