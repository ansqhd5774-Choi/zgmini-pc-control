import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRequest,REPO,TITLE,SCHEMA,SOURCE_SHA,KEY,ENTRY,MARKER} from './inflation19-public-d1-b-once.mjs';
const uid='123e4567-e89b-42d3-a456-426614174000';
const baseline=()=>{
 const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1'};
 const body={schema:SCHEMA,operation:'publish-stored-19-summary-only-once',
 sourceSha:SOURCE_SHA,requestId:'pc-infl19-public-'+uid,chatId:'chat-'+uid};
 const event={action:'opened',repository:{private:true,full_name:REPO},
 issue:{number:315,title:TITLE,user:{login:'ansqhd5774-Choi'},body:JSON.stringify(body)}};
 return {event,env,body};
};
const accept=(e,v)=>verifyRequest(e,v,{platform:'win32'});
test('only owner private one-shot exact payload may publish',()=>{
 const {event,env,body}=baseline();
 assert.equal(accept(event,env).requestId,body.requestId);
 assert.equal(KEY,'detail:inflation-causal-public-19:r1');
 assert.equal(ENTRY,'scripts/pc-writer/inflation-causal-public-publish-r1.mjs');
 assert.match(MARKER,/E:\\ZGmini\\automation\\inflation19-public-r1\\ONE_SHOT_STARTED\.json/);
});
test('public, nonowner, run attempt 2 and extra shell arguments are all rejected',()=>{
 const {event,env,body}=baseline();
 assert.throws(()=>accept(event,{...env,GITHUB_ACTOR:'attacker'}));
 assert.throws(()=>accept(event,{...env,GITHUB_RUN_ATTEMPT:'2'}));
 assert.throws(()=>accept({...event,repository:{...event.repository,private:false}},env));
 assert.throws(()=>accept({...event,issue:{...event.issue,body:JSON.stringify({...body,script:'cmd.exe'})}},env));
 assert.throws(()=>accept({...event,issue:{...event.issue,body:JSON.stringify({...body,sourceSha:'a'.repeat(40)})}},env));
 assert.throws(()=>accept({...event,issue:{...event.issue,body:JSON.stringify({...body,chatId:'chat-11111111-1111-4111-8111-111111111111'})}},env));
});
test('platform permission cannot be silently ignored',()=>{
 const {event,env}=baseline();
 assert.throws(()=>verifyRequest(event,env,{platform:'linux'}),/REQUEST|ISSUE/);
});
