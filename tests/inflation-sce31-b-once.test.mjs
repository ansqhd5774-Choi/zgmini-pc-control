import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  validateRequest,SOURCE_SHA,TITLE,
} from '../inflation-sce31-b-once.mjs';
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
test('approval, immutable source and retired trigger preserve exact one-shot constraints',()=>{
  const approval=JSON.parse(fs.readFileSync(new URL('../INFLATION_SCE31_B_APPROVAL.json',import.meta.url)));
  const oldTrigger=new URL('../.github/workflows/pc-inflation-sce31-approved-once.yml',import.meta.url);
  assert.equal(approval.maxAutomaticRetries,0);
  assert.equal(approval.maxProviderRequests,3);
  assert.equal(approval.allowCoreWrites,false);
  assert.equal(approval.allowD1Writes,false);
  assert.equal(approval.allowSchedulerChanges,false);
  assert.equal(fs.existsSync(oldTrigger),false,'completed Issue-opened trigger must remain retired');
  assert.equal(approval.sourceSha,SOURCE_SHA);
  assert.equal(approval.scope,'SCE31_PC_PRIVATE_ONE_SHOT');
  assert.equal(approval.sourceRepository,'ansqhd5774-Choi/zgmini');
  assert.equal(approval.allowPublicRawData,false);
  assert.deepEqual(Object.keys(approval.sourceFileHashes).sort(),[
    'scripts/pc-writer/inflation-sce31-once.mjs',
    'scripts/inflation-sce-collector.mjs',
    'scripts/inflation-sce-source.mjs'
  ].sort());
  const source=fs.readFileSync(new URL('../inflation-sce31-b-once.mjs',import.meta.url),'utf8');
  assert.match(source,/ONCE_STARTED\.json/);
  assert.match(source,/flag:'wx'/);
  assert.match(source,/SCE31_ALREADY_ATTEMPTED/);
});
