import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  validateRequest,SOURCE_SHA,TITLE,
} from './inflation-sce31-b-once.mjs';
const request={schema:'ZGMINI_INFLATION_SCE31_ONCE_V1',
  requestId:'pc-sce31-4a84e176-321f-4e0e-9a75-8b1cd9b39118',
  chatId:'chat-e7a6b5bc-770f-4e3a-b0ef-76d58e44ac19',
  operation:'collect-sce31-private-once',sourceSha:SOURCE_SHA};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened'};
const event={action:'opened',repository:{private:true},issue:{user:{login:'ansqhd5774-Choi'},
  title:TITLE,body:JSON.stringify(request)}};

test('exact request, private repo, approved actor and pinned source admitted',()=>{
  assert.deepEqual(validateRequest(event,env),request);
});
test('extra fields cannot inject source, target or command',()=>{
  for(const mutation of [{...request,command:'cmd /c echo wrong'},
    {...request,sourceSha:'f'.repeat(40)},
    {...request,requestId:'unstructured'}]){
    assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify(mutation)}},env),
      /SCE31_REQUEST_CONTRACT_DENIED/);
  }
});
test('public repo, wrong actor, title or replayed event rejected',()=>{
  for(const [e,v] of [[{...event,repository:{private:false}},env],
    [event,{...env,GITHUB_ACTOR:'evil'}],
    [{...event,issue:{...event.issue,title:'another-job'}},env],
    [{...event,action:'edited'},env]])
    assert.throws(()=>validateRequest(e,v),/SCE31_ACTOR_OR_ISSUE_DENIED/);
});
test('approval and workflow enforce exact one-shot, no public writes or scheduler mutation',()=>{
  const approval=JSON.parse(fs.readFileSync(new URL('./INFLATION_SCE31_B_APPROVAL.json',import.meta.url)));
  const workflow=fs.readFileSync(new URL('./pc-inflation-sce31-approved-once.yml',import.meta.url),'utf8');
  assert.equal(approval.maxAutomaticRetries,0);
  assert.equal(approval.maxProviderRequests,3);
  assert.equal(approval.allowCoreWrites,false);
  assert.equal(approval.allowD1Writes,false);
  assert.equal(approval.allowSchedulerChanges,false);
  assert.match(workflow,/self-hosted, Windows, X64, zgmini-pc-control/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/ref: f0f70b2bdc091e6f2db7ddac71324b7bdb53dbbd/);
});
