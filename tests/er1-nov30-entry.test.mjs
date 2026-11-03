import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest} from '../er1-nov30-entry.mjs';

const request={schema:'ZGMINI_ER1_NOV30_CAPTURE_V1',
  requestId:'pc-nov30-57aad8a3-7352-413c-b312-82ad2604b977',
  chatId:'chat-876b79c2-56d4-441b-8430-0dd73e981245',
  operation:'capture-earnings-calendar-through-2026-11-30',
  sourceSha:'11a971cb5d3514c2d1e1798def58465fb8a74035',
  from:'2026-11-01',through:'2026-11-30'};
const event={action:'opened',issue:{user:{login:'ansqhd5774-Choi'},
  title:'pc-er1-nov30-capture-one-shot',labels:[{name:'pc-er1-approved'}],
  body:JSON.stringify(request)}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened'};

test('exact approved issue contract accepted',()=>{
  assert.deepEqual(validateRequest(event,env),request);
});
test('unapproved scope, actor and extra arguments rejected',()=>{
  for(const changed of [{...request,through:'2026-12-31'},
    {...request,command:'cmd /c arbitrary'},
    {...request,sourceSha:'a'.repeat(40)}]){
    assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify(changed)}},env));
  }
  assert.throws(()=>validateRequest(event,{...env,GITHUB_ACTOR:'someone-else'}));
});
