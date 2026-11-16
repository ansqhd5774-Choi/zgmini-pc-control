import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHandoff,fingerprintHandoff,routeHandoff} from '../agent-handoff/contract.mjs';
import {HANDOFF_REPOSITORY,HANDOFF_BOT,selectionReceipt} from '../agent-handoff/queue-selector.mjs';
import {prepareAiCase,attemptReceipt,normalizePatch,
  safeBranchName,resultReceipt,AI_ATTEMPT_MARKER} from '../agent-handoff/ai-proposal-contract.mjs';
import {validateAiEvent,executeOnce,callStructuredModel} from '../agent-handoff/ai-proposal-runner.mjs';

const owner='ansqhd5774-Choi';
const url=n=>'https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/'+n;
const sha=c=>c.repeat(40);
function fixture(n=2001,fileRefs=['writer-b/installer.mjs'],failureCode='WRITER_B_PC_PREIMAGE_STOP'){
  const body={schema:'ZGMINI_AGENT_HANDOFF_V1',incidentId:'handoff-case-'+n+'-20261116',
    origin:{repository:HANDOFF_REPOSITORY,issueNumber:n-1,
      requestId:'req-'+n+'-20261116',chatId:'chat-abc1234',
      branch:'main',sourceSha:sha('a'),checkpoint:'OTHER'},
    failure:{kind:'COMMON_WRITER',code:failureCode,
      lastPass:'NOT_RECORDED',firstFail:'NOT_RECORDED',fileRefs,evidenceIssueNumber:n-1}};
  const request=parseHandoff(JSON.stringify(body));
  const route=routeHandoff(request);
  const issue={repository:HANDOFF_REPOSITORY,number:n,state:'open',
    labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}],
    user:{login:HANDOFF_BOT},title:'agent-handoff '+body.incidentId,body:JSON.stringify(body)};
  const routing={user:{login:HANDOFF_BOT},issue_url:url(n),body:[
    'HANDOFF_ROUTED','incidentId: '+body.incidentId,
    'fingerprint: '+fingerprintHandoff(request),
    'role: '+route.role,'state: AWAITING_AGENT_CONFIGURATION',
    'checkpoint: OTHER','PC retries: 0','operationalWrites: 0',
    'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'].join('\n')};
  const selected={user:{login:HANDOFF_BOT},issue_url:url(n),
    body:selectionReceipt(request,fingerprintHandoff(request))};
  return {issue,request,comments:[routing,selected]};
}
const patch=(p='writer-b/installer.mjs')=>({
  status:'PROPOSE',path:p,oldSnippet:'= 1;',newSnippet:'= 2;',reason:'test change'
});

test('only bot-verified candidate receipt can lead to AI attempt',()=>{
  const {issue,request,comments}=fixture();
  const task=prepareAiCase(issue,comments);
  assert.equal(task.path,'writer-b/installer.mjs');
  assert.equal(task.number,issue.number);
  assert.match(attemptReceipt(task),/scope: GITHUB_DRAFT_PR_ONLY/);
  assert.match(safeBranchName(task),/^ai\/handoff-2001-[a-f0-9]{12}$/);
  assert.throws(()=>prepareAiCase(issue,[comments[0]]),/SELECTOR_PROOF_REQUIRED/);
  assert.throws(()=>prepareAiCase(issue,[comments[1]]),/SELECTOR_PROOF_REQUIRED/);
  assert.equal(task.fingerprint,fingerprintHandoff(request));
});

test('unverified operating-PC recovery cannot trigger an AI source patch',()=>{
  const {issue,comments}=fixture(2010,['tools/update.mjs'],'BACKLOG_OR_RECOVERY_NOT_VERIFIED');
  assert.throws(()=>prepareAiCase(issue,comments),/RUNTIME_EVIDENCE_REQUIRED/);
});
test('no approved source file means no model call or inference from result files',()=>{
  const {issue,comments}=fixture(2002,['results/b-install.json','approvals/writer-updates/r1.json']);
  assert.throws(()=>prepareAiCase(issue,comments),/NO_APPROVED_CODE_REFERENCE/);
});
test('cannot switch to a different source path or repeat a claimed incident',()=>{
  const {issue,comments}=fixture();
  assert.throws(()=>prepareAiCase(issue,comments,'controller/engine.mjs'),/PATH_OUTSIDE_INCIDENT_PROOF/);
  const task=prepareAiCase(issue,comments);
  const claimed=[...comments,{user:{login:HANDOFF_BOT},issue_url:url(issue.number),body:attemptReceipt(task)}];
  assert.throws(()=>prepareAiCase(issue,claimed),/ALREADY_ATTEMPTED/);
  assert.throws(()=>prepareAiCase({...issue,state:'closed'},comments),/SELECTOR_PROOF_REQUIRED/);
});

test('bounded exact snippet replacement and no broad or ambiguous patches',()=>{
  const {issue,comments}=fixture();
  const task=prepareAiCase(issue,comments);
  const text='export const x = 1;\n';
  const good={...patch(),oldSnippet:'= 1;',newSnippet:'= 2;'};
  assert.equal(normalizePatch(good,task,text).updated,'export const x = 2;\n');
  assert.throws(()=>normalizePatch({...good,path:'AGENTS.md'},task,text),/PATH_INVALID/);
  assert.throws(()=>normalizePatch(good,task,'const a=1; const b=1;'),/ANCHOR_NOT_UNIQUE|PATCH_ANCHOR_NOT_UNIQUE/);
  assert.throws(()=>normalizePatch({...good,oldSnippet:'secret'},task,text),/ANCHOR_NOT_UNIQUE/);
  assert.equal(normalizePatch({status:'NEEDS_EVIDENCE'},task,text).status,'NEEDS_EVIDENCE');
  assert.throws(()=>normalizePatch({...good,newSnippet:good.oldSnippet},task,text),/PATCH_SIZE_OR_NOOP/);
  assert.throws(()=>normalizePatch({...good,newSnippet:'x'.repeat(8100)},task,text),/PATCH_SIZE_OR_NOOP/);
  assert.throws(()=>normalizePatch({...good,oldSnippet:text},task,text),/PATCH_TOO_BROAD/);
});

test('result must be a verified draft PR and exact commit identity',()=>{
  const {issue,comments}=fixture();
  const task=prepareAiCase(issue,comments);
  assert.match(resultReceipt(task,{status:'DRAFT_PR_CREATED',
    prNumber:52,commitSha:sha('e')}),/runtimeStatus: NOT_APPLIED/);
  assert.throws(()=>resultReceipt(task,{status:'DRAFT_PR_CREATED',prNumber:52,commitSha:'BAD'}));
});

test('enforce owner-only manual and attested automated triggers',()=>{
  const base={repository:{full_name:HANDOFF_REPOSITORY,private:true}};
  const env={GITHUB_REPOSITORY:HANDOFF_REPOSITORY,GITHUB_EVENT_PATH:'ev.json',
    GITHUB_ACTOR:owner,GITHUB_EVENT_NAME:'workflow_dispatch'};
  assert.equal(validateAiEvent({...base,sender:{login:owner},
    inputs:{issue_number:'2001'}},env).issueNumber,2001);
  assert.throws(()=>validateAiEvent({...base,sender:{login:'attacker'},
    inputs:{issue_number:'2001'}},env),/OWNER_ONLY/);
  assert.throws(()=>validateAiEvent({...base,sender:{login:owner},
    inputs:{issue_number:'0'}},env),/ISSUE_NUMBER_REQUIRED/);
  const workflow={...base,action:'completed',
    workflow_run:{name:'ZGMINI Handoff Queue Candidate Selector',
      conclusion:'success',actor:{login:owner}}};
  assert.equal(validateAiEvent(workflow,{...env,GITHUB_EVENT_NAME:'workflow_run'}).issueNumber,null);
  assert.throws(()=>validateAiEvent({...workflow,
    workflow_run:{...workflow.workflow_run,actor:{login:'attacker'}}},
    {...env,GITHUB_EVENT_NAME:'workflow_run'}),/PROVENANCE/);
});

test('model output is structured and calls a single well-scoped Responses request',async()=>{
  const {issue,comments}=fixture();
  const task=prepareAiCase(issue,comments);
  let calls=0;let body;
  const res=await callStructuredModel({task,source:'export const x = 1;\n',
    model:'gpt-6-astra',apiKey:'test-fixture-only',
    fetcher:async(uri,opts)=>{
      calls++;assert.equal(uri,'https://api.openai.com/v1/responses');
      body=JSON.parse(opts.body);
      return {ok:true,json:async()=>({status:'completed',
        output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(patch())}]}]})};
    }});
  assert.equal(calls,1);
  assert.equal(body.store,false);
  assert.equal(body.text.format.type,'json_schema');
  assert.equal(res.status,'PROPOSE');
  await assert.rejects(()=>callStructuredModel({task,source:'x',model:'bad',apiKey:'',
    fetcher:async()=>{throw Error('should not call');}}),/MODEL_AUTH_NOT_CONFIGURED/);
});

function mockIo(n=2001,source='export const x = 1;\n') {
  const {issue,comments}=fixture(n);
  const history=[...comments],writes=[],calls=[];
  const io={
    readIssue:async()=>structuredClone(issue),
    readComments:async()=>structuredClone(history),
    readMainHead:async()=>sha('b'),
    readFile:async()=>({sha:sha('c'),content:source}),
    postComment:async(_,body)=>{writes.push('comment');
      history.push({user:{login:HANDOFF_BOT},issue_url:url(n),body});},
    model:async()=>{calls.push('model');return patch();},
    createBranch:async()=>{writes.push('branch');},
    updateBranchFile:async()=>{writes.push('file');return {commitSha:sha('d')};},
    createDraftPR:async()=>{writes.push('pr');return {number:33,draft:true}}
  };
  return {io,writes,calls,history};
}
test('single approved model call creates only a draft PR, never PC changes',async()=>{
  const {io,writes,calls,history}=mockIo();
  const z=await executeOnce(2001,io,{model:'gpt-6-astra',apiKey:'test-fixture-only'});
  assert.equal(z.state,'DRAFT_PR_CREATED');
  assert.equal(z.operationalWrites,0);
  assert.deepEqual(calls,['model']);
  assert.deepEqual(writes,['comment','branch','file','pr','comment']);
  assert.equal(history.filter(x=>x.body.startsWith(AI_ATTEMPT_MARKER)).length,1);
  await assert.rejects(()=>executeOnce(2001,io,{model:'gpt-6-astra',
    apiKey:'test-fixture-only'}),/ALREADY_ATTEMPTED/);
});

test('missing credentials reject before claim or branch creation',async()=>{
  const {io,writes,calls}=mockIo();
  await assert.rejects(()=>executeOnce(2001,io,{model:'',apiKey:''}),
    /MODEL_AUTH_NOT_CONFIGURED/);
  assert.deepEqual(writes,[]);
  assert.deepEqual(calls,[]);
});
test('incomplete evidence leaves one claimed attempt without code modification',async()=>{
  const {io,writes}=mockIo();
  io.model=async()=>({status:'NEEDS_EVIDENCE'});
  const z=await executeOnce(2001,io,{model:'gpt-6-astra',apiKey:'test'});
  assert.equal(z.state,'NEEDS_EVIDENCE');
  assert.deepEqual(writes,['comment']);
});
test('invalid or unsyntactic model patch never creates a branch',async()=>{
  const {io,writes}=mockIo();
  io.model=async()=>({...patch(),newSnippet:'= ;'});
  await assert.rejects(()=>executeOnce(2001,io,{model:'gpt-6-astra',
    apiKey:'test'}),/PATCH_SYNTAX_FAILED/);
  assert.deepEqual(writes,['comment']);
});
