import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fingerprintHandoff, parseHandoff, routeHandoff} from '../agent-handoff/contract.mjs';
import {assessIncident, selectionReceipt, processQueue, SELECTION_MARKER,
  HANDOFF_BOT, HANDOFF_REPOSITORY} from '../agent-handoff/queue-selector.mjs';
import {validateTrigger, finalizeSelection, isolateInitialCommentRead, pages, verifyNoopSelection, validateNoopTrigger} from '../agent-handoff/queue-dispatcher.mjs';

const owner = 'ansqhd5774-Choi';
function fixture(n=2001) {
  const body = {
    schema:'ZGMINI_AGENT_HANDOFF_V1',incidentId:'handoff-case-'+n+'-20261116',
    origin:{repository:HANDOFF_REPOSITORY,issueNumber:n-1,requestId:'req-'+n+'-20261116',
      chatId:'chat-abc12345',branch:'main',sourceSha:'b'.repeat(40),checkpoint:'OTHER'},
    failure:{kind:'COMMON_WRITER',code:'WRITER_B_PC_PREIMAGE_STOP',
      lastPass:'NOT_RECORDED',firstFail:'NOT_RECORDED',
      fileRefs:['writer-b/installer.mjs'],evidenceIssueNumber:n-1}
  };
  const normalized=parseHandoff(JSON.stringify(body));
  const routed=routeHandoff(normalized);
  const issue={number:n,state:'open',repository:HANDOFF_REPOSITORY,
    user:{login:HANDOFF_BOT},title:'agent-handoff '+body.incidentId,body:JSON.stringify(body),
    labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}]};
  const issue_url='https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/'+n;
  const route={user:{login:HANDOFF_BOT},issue_url,body:[
    'HANDOFF_ROUTED','incidentId: '+body.incidentId,
    'fingerprint: '+fingerprintHandoff(normalized),
    'role: '+routed.role,'state: AWAITING_AGENT_CONFIGURATION','checkpoint: OTHER',
    'PC retries: 0','operationalWrites: 0',
    'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'
  ].join('\n')};
  return {issue,route,request:normalized,issue_url};
}

test('authenticated bot handoff is selected without claiming agent execution',()=>{
  const {issue,route,request}=fixture();
  const result=assessIncident(issue,[route]);
  assert.equal(result.state,'READY');
  assert.equal(result.issueNumber,issue.number);
  assert.equal(result.receipt,selectionReceipt(request,fingerprintHandoff(request)));
  assert.match(result.receipt,/automaticAiExecution: NOT_CONFIGURED/);
  assert.match(result.receipt,/pcOperationalWrites: 0/);
});
test('forged, duplicated, missing or conflicting routing receipt cannot dispatch',()=>{
  const {issue,route}=fixture();
  assert.equal(assessIncident(issue,[]).state,'ROUTE_RECEIPT_UNVERIFIED');
  assert.equal(assessIncident(issue,[{...route,user:{login:owner}}]).state,'ROUTE_RECEIPT_UNVERIFIED');
  assert.equal(assessIncident(issue,[route,route]).state,'ROUTE_RECEIPT_UNVERIFIED');
  assert.equal(assessIncident(issue,[{...route,issue_url:'bad'}]).state,'ROUTE_RECEIPT_UNVERIFIED');
  assert.equal(assessIncident(issue,[{...route,body:route.body.replace('fingerprint:', 'not-fingerprint:')}]).state,'ROUTE_RECEIPT_UNVERIFIED');
});
test('rejects invalid or ineligible incidents without operations',()=>{
  const {issue,route}=fixture();
  assert.equal(assessIncident({...issue,state:'closed'},[route]).state,'NOT_PENDING');
  assert.equal(assessIncident({...issue,user:{login:'attacker'}},[route]).state,'UNTRUSTED_ISSUE');
  assert.equal(assessIncident({...issue,body:'not-json'},[route]).state,'INVALID_CONTRACT');
  assert.equal(assessIncident({...issue,repository:'attacker/repo'},[route]).state,'ISSUE_IDENTITY_MISMATCH');
  assert.equal(assessIncident({...issue,title:'different'},[route]).state,'ISSUE_IDENTITY_MISMATCH');
  assert.equal(assessIncident({...issue,labels:[...issue.labels,{name:'handoff-duplicate'}]},[route]).state,'NOT_PENDING');
});
test('authenticated owner issue with descriptive title uses exact bot route, not title as authorization',async()=>{
  const {issue,route}=fixture(2501);
  const ownerIssue={...issue,user:{login:owner},
    title:'[W03→프로세스 총괄] approved one-file B scope review'};
  const verdict=assessIncident(ownerIssue,[route]);
  assert.equal(verdict.state,'READY');
  assert.match(verdict.receipt,/automaticAiExecution: NOT_CONFIGURED/);
  let writes=0;
  const saved=[route];
  const result=await processQueue([ownerIssue],{
    readComments:async()=>structuredClone(saved),
    readIssue:async()=>structuredClone(ownerIssue),
    recordReceipt:async(_,body)=>{writes++;saved.push({user:{login:HANDOFF_BOT},
      issue_url:'https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/2501',body});}
  });
  assert.equal(result.selected,1);
  assert.deepEqual(result.selectedIssues,[2501]);
  assert.equal(result.pcOperationalWrites,0);
  assert.equal(result.automaticAiExecutions,0);
  assert.equal(writes,1);
  assert.equal(assessIncident(ownerIssue,saved).state,'ALREADY_SELECTED');
  const again=await processQueue([ownerIssue],{
    readComments:async()=>structuredClone(saved),
    readIssue:async()=>structuredClone(ownerIssue),
    recordReceipt:async()=>{writes++;}
  });
  assert.equal(again.alreadySelected,1);
  assert.equal(writes,1);
});

test('descriptive owner title cannot bypass missing route or author and body integrity',()=>{
  const {issue,route}=fixture(2502);
  const ownerIssue={...issue,user:{login:owner},title:'W03 R47 shared handoff'};
  assert.equal(assessIncident(ownerIssue,[]).state,'ROUTE_RECEIPT_UNVERIFIED');
  assert.equal(assessIncident(ownerIssue,[{...route,body:route.body.replace('fingerprint:', 'changed:')}]).state,'ROUTE_RECEIPT_UNVERIFIED');
  assert.equal(assessIncident({...ownerIssue,user:{login:'collaborator'}},[route]).state,'UNTRUSTED_ISSUE');
  assert.equal(assessIncident({...ownerIssue,title:' '},[route]).state,'ISSUE_IDENTITY_MISMATCH');
  assert.equal(assessIncident({...ownerIssue,body:'not-json'},[route]).state,'INVALID_CONTRACT');
  assert.equal(assessIncident({...issue,title:'W03 R47 shared handoff'},[route]).state,'ISSUE_IDENTITY_MISMATCH');
});

test('candidate receipt is idempotent; malformed previous selection blocks duplication',()=>{
  const {issue,route,request,issue_url}=fixture();
  const body=selectionReceipt(request,fingerprintHandoff(request));
  assert.equal(assessIncident(issue,[route,{user:{login:HANDOFF_BOT},issue_url,body}]).state,'ALREADY_SELECTED');
  assert.equal(assessIncident(issue,[route,{user:{login:HANDOFF_BOT},issue_url,body},
    {user:{login:HANDOFF_BOT},issue_url,body}]).state,'SELECTION_RECEIPT_CONFLICT');
  assert.equal(assessIncident(issue,[route,{user:{login:HANDOFF_BOT},issue_url,
    body:SELECTION_MARKER+'\nforged'}]).state,'SELECTION_RECEIPT_CONFLICT');
});
test('processes at most ten in ascending order, exactly one receipt per candidate',async()=>{
  const first=fixture(2101),second=fixture(2102),third=fixture(2103);
  const rows=[third.issue,first.issue,second.issue];
  const store=new Map([[2101,[first.route]],[2102,[second.route]],[2103,[third.route]]]);
  const writes=[];
  const io={
    readComments:async n=>[...store.get(n)],
    readIssue:async n=>structuredClone(rows.find(x=>x.number===n)),
    recordReceipt:async(n,body)=>{
      writes.push(n);
      store.get(n).push({user:{login:HANDOFF_BOT},
        issue_url:'https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/'+n,body});
    }
  };
  const one=await processQueue(rows,io,2);
  assert.deepEqual(one.selectedIssues,[2101,2102]);
  assert.equal(one.selected,2);
  assert.equal(one.pcOperationalWrites,0);
  assert.equal(one.automaticAiExecutions,0);
  const two=await processQueue(rows,io,10);
  assert.deepEqual(two.selectedIssues,[2103]);
  assert.equal(two.alreadySelected,2);
  assert.deepEqual(writes,[2101,2102,2103]);
});
test('lost POST response is reconciled without a second write',async()=>{
  const {issue,route,issue_url}=fixture(2201);
  const comments=[route]; let posts=0;
  const r=await processQueue([issue],{
    readComments:async()=>[...comments],readIssue:async()=>structuredClone(issue),
    recordReceipt:async(_,body)=>{posts++;comments.push({user:{login:HANDOFF_BOT},issue_url,body});throw Error('ack lost');}
  });
  assert.equal(r.selected,1);assert.equal(posts,1);
});
test('an uncertain POST without receipt fails closed',async()=>{
  const {issue,route}=fixture(2301);
  await assert.rejects(()=>processQueue([issue],{
    readComments:async()=>[route],readIssue:async()=>structuredClone(issue),
    recordReceipt:async()=>{throw Error('network lost');}
  }),/POST_OUTCOME_UNKNOWN/);
});
test('rejects issue drift before metadata write',async()=>{
  const {issue,route}=fixture(2401);
  let writes=0;
  await assert.rejects(()=>processQueue([issue],{
    readComments:async()=>[route],
    readIssue:async()=>({...issue,state:'closed'}),
    recordReceipt:async()=>{writes++;}
  }),/ISSUE_DRIFT_STOP/);
  assert.equal(writes,0);
});
test('workflow_run owner verification and explicit manual trigger only',()=>{
  const event={action:'completed',repository:{full_name:HANDOFF_REPOSITORY,private:true},
    workflow_run:{name:'ZGMINI Agent Handoff Writer B Failure Intake',
      conclusion:'success',actor:{login:owner}}};
  const env={GITHUB_REPOSITORY:HANDOFF_REPOSITORY,
    GITHUB_EVENT_PATH:'event.json',GITHUB_EVENT_NAME:'workflow_run'};
  assert.doesNotThrow(()=>validateTrigger(event,env));
  assert.throws(()=>validateTrigger({...event,workflow_run:{...event.workflow_run,actor:{login:'attacker'}}},env));
  assert.throws(()=>validateTrigger({...event,workflow_run:{...event.workflow_run,name:'Untrusted'}},env));
  assert.throws(()=>validateTrigger({...event,workflow_run:{...event.workflow_run,conclusion:'failure'}},env));
  assert.doesNotThrow(()=>validateTrigger({repository:event.repository,sender:{login:owner}},
    {...env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:owner}));
  assert.doesNotThrow(()=>validateTrigger({repository:event.repository,ref:'refs/heads/main'},
    {...env,GITHUB_EVENT_NAME:'push',GITHUB_ACTOR:owner}));
  assert.throws(()=>validateTrigger({repository:event.repository,ref:'refs/heads/other'},
    {...env,GITHUB_EVENT_NAME:'push',GITHUB_ACTOR:owner}));
  assert.throws(()=>validateTrigger({repository:event.repository,sender:{login:'attacker'}},
    {...env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:owner}));
});

test('candidate selection stays recorded when the separate board readback fails',async()=>{
  const selection={selected:1,alreadySelected:0,selectedIssues:[2405],
    pcOperationalWrites:0,automaticPcRetries:0};
  const output=await finalizeSelection(selection,async()=>{
    throw Error('HANDOFF_BOARD_RUNNER_BACKLOG_CAP_EXCEEDED');
  });
  assert.equal(output.state,'CANDIDATE_SELECTION_COMPLETED_BOARD_UNVERIFIED');
  assert.deepEqual(output.selectedIssues,[2405]);
  assert.equal(output.selected,1);
  assert.equal(output.execution,null);
  assert.deepEqual(output.boardReadback,{
    state:'UNVERIFIED',reason:'HANDOFF_BOARD_RUNNER_BACKLOG_CAP_EXCEEDED'});
  assert.equal(output.pcRuntimeVerified,false);
  assert.equal(output.automaticPcRetries,0);
});

test('board validation preserves pending owner actions even with zero new candidates',async()=>{
  const output=await finalizeSelection({selected:0,alreadySelected:2},async()=>({
    schema:'ZGMINI_HANDOFF_BOARD_R1',pendingIssueCount:2,
    records:[{issueNumber:2301,status:'PENDING_OWNER_ACK'},
      {issueNumber:2302,status:'WORKING'}]
  }));
  assert.equal(output.state,'OWNER_ACTION_REQUIRED');
  assert.deepEqual(output.execution.ownerActionRequired,[2301]);
  assert.deepEqual(output.execution.working,[2302]);
  assert.deepEqual(output.boardReadback,{state:'VERIFIED',pendingIssueCount:2});
  assert.equal(output.pcRuntimeVerified,false);
});

test('untrusted board errors do not leak arbitrary API or credential text',async()=>{
  const output=await finalizeSelection({selected:0},async()=>{
    throw Error('error: Authorization Bearer secret-token');
  });
  assert.equal(output.state,'CANDIDATE_SELECTION_COMPLETED_BOARD_UNVERIFIED');
  assert.equal(output.boardReadback.reason,'HANDOFF_SELECTOR_BOARD_STATUS_UNAVAILABLE');
  assert.equal(JSON.stringify(output).includes('secret-token'),false);
});

test('finalization rejects malformed input instead of manufacturing PASS',async()=>{
  await assert.rejects(()=>finalizeSelection(null,async()=>({})),
    /HANDOFF_SELECTOR_FINALIZATION_INPUT_INVALID/);
  await assert.rejects(()=>finalizeSelection({selected:0},null),
    /HANDOFF_SELECTOR_FINALIZATION_INPUT_INVALID/);
});

test('first Issue read failure is isolated in dispatcher while good receipts still post',async()=>{
  const failed=fixture(2701),good=fixture(2702);
  const rows=[failed.issue,good.issue],deferredReads=[]; let writes=0;
  const saved=[good.route];
  const readComments=isolateInitialCommentRead(async n=>{
    if(n===2701)throw Error('backend unavailable: sensitive text not for logs');
    return structuredClone(saved);
  },n=>deferredReads.push(n));
  const result=await processQueue(rows,{
    readComments,
    readIssue:async n=>structuredClone(rows.find(x=>x.number===n)),
    recordReceipt:async(n,body)=>{
      writes++;
      saved.push({user:{login:HANDOFF_BOT},
        issue_url:'https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/'+n,body});
    }
  });
  assert.equal(result.selected,1);
  assert.deepEqual(result.selectedIssues,[2702]);
  assert.equal(result.deferred,1);
  assert.deepEqual(deferredReads,[2701]);
  assert.equal(JSON.stringify({result,deferredReads}).includes('sensitive text'),false);
  assert.equal(writes,1);
});

test('missing route is deferred without fabricating evidence',async()=>{
  const f=fixture(2703),deferredReads=[];
  const readComments=isolateInitialCommentRead(async()=>[],n=>deferredReads.push(n));
  const result=await processQueue([f.issue],{
    readComments,
    readIssue:async()=>structuredClone(f.issue),
    recordReceipt:async()=>{throw Error('unexpected write');}
  });
  assert.equal(result.selected,0);
  assert.equal(result.deferred,1);
  assert.deepEqual(deferredReads,[]);
});

test('repository auth failure and post-write readback remain hard stop',async()=>{
  const f=fixture(2704),deferredReads=[];
  const authorized=isolateInitialCommentRead(async()=>{
    throw Error('HANDOFF_SELECTOR_GITHUB_HTTP_403');
  },n=>deferredReads.push(n));
  await assert.rejects(()=>authorized(f.issue.number),/GITHUB_HTTP_403/);
  assert.deepEqual(deferredReads,[]);
  let readCount=0,posts=0;
  const reader=isolateInitialCommentRead(async()=>{
    readCount++;
    if(readCount>2)throw Error('post-write proof not readable');
    return [f.route];
  },n=>deferredReads.push(n));
  await assert.rejects(()=>processQueue([f.issue],{
    readComments:reader,
    readIssue:async()=>structuredClone(f.issue),
    recordReceipt:async()=>{posts++;}
  }),/post-write proof not readable/);
  assert.equal(posts,1);
  assert.deepEqual(deferredReads,[]);
});

test('001 candidate pagination processes 600 open candidates without 500-row gate',async()=>{
 const data=Array.from({length:600},(_,i)=>({number:i+1}));
 const seen=[];
 const rows=await pages('issues?state=open',100,async resource=>{
  const page=Number(resource.split('page=').at(-1));
  seen.push(page);return data.slice((page-1)*100,page*100);
 });
 assert.equal(rows.length,600);
 assert.deepEqual(seen,[1,2,3,4,5,6,7]);
});
test('001 exact 500-row boundary no longer becomes incomplete inventory',async()=>{
 const data=Array.from({length:500},(_,i)=>({number:i+1}));
 const rows=await pages('issues',5,async resource=>{
  const page=Number(resource.split('page=').at(-1));
  return data.slice((page-1)*100,page*100);
 });
 assert.equal(rows.length,500);
});
test('001 activation matches 009 and 006 without adding a global queue',()=>{
 const read=n=>readFileSync(new URL('../.github/workflows/'+n,import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const selector=read('agent-handoff-candidate-selector.yml');
 assert.ok(selector.includes("vars.ZGMINI_AGENT_HANDOFF_ENABLED == 'true'"));
 assert.ok(!selector.startsWith('concurrency:')&&!selector.includes('\nconcurrency:\n'));
 assert.ok(selector.includes("verify-and-select-candidates:\n    concurrency:"));
 assert.ok(selector.includes('queue: max'));
 const intake=read('agent-handoff.yml');
 assert.ok(!intake.includes('startsWith(github.event.comment.body'));
 for(const name of ['ZGMINI_AGENT_HANDOFF_RESULT_V1',
  'ZGMINI_AGENT_HANDOFF_DIAGNOSIS_V1','ZGMINI_HANDOFF_WORK_UPDATE_V1'])
   assert.ok(intake.includes("contains(github.event.comment.body, '"+name+"'"));

});


test('direct intake selection accepts exact owner workflow and original admissible events',()=>{
  const repository={full_name:HANDOFF_REPOSITORY,private:true};
  const issue={labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}]};
  const event={repository,issue,action:'opened'};
  const env={GITHUB_REPOSITORY:HANDOFF_REPOSITORY,GITHUB_EVENT_PATH:'event.json',
    GITHUB_WORKFLOW_REF:HANDOFF_REPOSITORY+'/.github/workflows/agent-handoff.yml@refs/heads/main',
    GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:owner,GITHUB_EVENT_NAME:'issues',
    GITHUB_JOB:'verify-and-select-after-intake'};
  assert.doesNotThrow(()=>validateTrigger(event,env));
  assert.doesNotThrow(()=>validateTrigger({...event,action:'labeled',label:{name:'agent-handoff'}},env));
  assert.throws(()=>validateTrigger({...event,action:'labeled',label:{name:'other'}},env));
  assert.throws(()=>validateTrigger({...event,issue:{labels:[]}},env));
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_ACTOR:'other'}));
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_REF:'refs/heads/dev'}));
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_WORKFLOW_REF:env.GITHUB_WORKFLOW_REF.replace('agent-handoff.yml','other.yml')}));
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_JOB:'unrelated-job'}));
  assert.throws(()=>validateTrigger({...event,repository:{...repository,private:false}},env));
  const commentEnv={...env,GITHUB_EVENT_NAME:'issue_comment'};
  for(const body of ['ZGMINI_AGENT_HANDOFF_RESULT_V1','ZGMINI_AGENT_HANDOFF_DIAGNOSIS_V1','ZGMINI_HANDOFF_WORK_UPDATE_V1'])
    assert.doesNotThrow(()=>validateTrigger({...event,action:'created',comment:{body}},commentEnv));
  assert.throws(()=>validateTrigger({...event,action:'created',comment:{body:'ordinary comment'}},commentEnv));
  assert.throws(()=>validateTrigger({...event,action:'created',issue:{...issue,pull_request:{}},comment:{body:'ZGMINI_AGENT_HANDOFF_RESULT_V1'}},commentEnv));
  assert.throws(()=>validateTrigger({...event,action:'created',issue:{labels:[{name:'agent-handoff'}]},comment:{body:'ZGMINI_HANDOFF_WORK_UPDATE_V1'}},commentEnv));
  assert.throws(()=>validateTrigger({...event,action:'edited',comment:{body:'ZGMINI_AGENT_HANDOFF_RESULT_V1'}},commentEnv));
});


test('failure-intake selector preserves authorized producer and historical manual origins',()=>{
  const repo=HANDOFF_REPOSITORY;
  const repository={full_name:repo,private:true};
  const pcRef=repo+'/.github/workflows/agent-handoff-pc-failure-intake.yml@refs/heads/main';
  const writerRef=repo+'/.github/workflows/agent-handoff-writer-b-failure-intake.yml@refs/heads/main';
  const env={GITHUB_REPOSITORY:repo,GITHUB_EVENT_PATH:'event.json',GITHUB_WORKFLOW_REF:pcRef,
    GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:owner,GITHUB_EVENT_NAME:'workflow_run',GITHUB_JOB:'verify-and-select-after-failure-intake'};
  const run={name:'ZGMINI PC Job',event:'issues',actor:{login:owner},
    head_repository:{full_name:repo},id:100,run_attempt:1,created_at:'2026-11-24T00:00:00Z',conclusion:'failure'};
  const event={repository,action:'completed',workflow_run:run};
  assert.doesNotThrow(()=>validateTrigger(event,env));
  assert.doesNotThrow(()=>validateTrigger({...event,workflow_run:{...run,conclusion:'success'}},env));
  for(const changed of [{conclusion:'skipped'},{actor:{login:'other'}},{event:'push'},{head_repository:{full_name:'other/repo'}},{name:'other'},{run_attempt:0}])
    assert.throws(()=>validateTrigger({...event,workflow_run:{...run,...changed}},env));
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_ACTOR:'other'}));
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_REF:'refs/heads/dev'}));
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_JOB:'other-job'}));
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_WORKFLOW_REF:writerRef}));
  const writer={...run,name:'ZGMINI Approved Writer B Source Overlay Once',head_sha:'a'.repeat(40),head_branch:'main'};
  const writerEnv={...env,GITHUB_WORKFLOW_REF:writerRef};
  assert.doesNotThrow(()=>validateTrigger({...event,workflow_run:writer},writerEnv));
  for(const changed of [{run_attempt:2},{head_branch:'dev'},{head_sha:'bad'}])
    assert.throws(()=>validateTrigger({...event,workflow_run:{...writer,...changed}},writerEnv));
  const manual={repository,sender:{login:owner},inputs:{confirmation:'reconcile-2307-resource-wait',mode:'preview'}};
  const manualEnv={...env,GITHUB_EVENT_NAME:'workflow_dispatch'};
  assert.doesNotThrow(()=>validateTrigger(manual,manualEnv));
  assert.doesNotThrow(()=>validateTrigger({...manual,inputs:{...manual.inputs,mode:'apply'}},manualEnv));
  assert.throws(()=>validateTrigger({...manual,inputs:{...manual.inputs,confirmation:'other'}},manualEnv));
  assert.throws(()=>validateTrigger(manual,{...manualEnv,GITHUB_WORKFLOW_REF:writerRef}));
  assert.throws(()=>validateTrigger({...manual,sender:{login:'other'}},manualEnv));
});


function noopFixture(n=2001){
 const {issue,route,request,issue_url}=fixture(n);
 const fresh={...issue,updated_at:'2026-11-24T00:00:00Z',comments:2};
 const receipt={user:{login:HANDOFF_BOT},issue_url,body:selectionReceipt(request,fingerprintHandoff(request))};
 return {fresh,comments:[route,receipt]};
}
function noopIO(items){
 return {listIssues:async()=>items.map(x=>x.fresh),
  readIssue:async n=>items.find(x=>x.fresh.number===n).fresh,
  readComments:async n=>items.find(x=>x.fresh.number===n).comments};
}
test('complete stable no-op proof only reuses exact authenticated prior selection receipts',async()=>{
 const a=noopFixture(),b=noopFixture(2002);
 assert.deepEqual(await verifyNoopSelection(noopIO([a,b])),{reusable:true,state:'SELECTION_REUSED_VERIFIED',scanned:2});
 assert.deepEqual(await verifyNoopSelection(noopIO([])),{reusable:true,state:'SELECTION_REUSED_VERIFIED',scanned:0});
 for(const comments of [[a.comments[0]],[a.comments[0],{...a.comments[1],user:{login:owner}}],[...a.comments,a.comments[1]]]){
  const item={fresh:{...a.fresh,comments:comments.length},comments};
  assert.equal((await verifyNoopSelection(noopIO([b,item]))).reusable,false);
 }
});
test('no-op proof falls back for inventory drift, count mismatch, unverified reads and bounds',async()=>{
 const a=noopFixture(),b=noopFixture(2002),io=noopIO([a]);
 assert.equal((await verifyNoopSelection({...io,readIssue:async()=>({...a.fresh,updated_at:'2026-11-24T00:01:00Z'})})).reusable,false);
 assert.equal((await verifyNoopSelection({...io,readComments:async()=>[a.comments[0]]})).reusable,false);
 assert.equal((await verifyNoopSelection({...io,readComments:async()=>{throw Error('HTTP_403')}})).reusable,false);
 assert.equal((await verifyNoopSelection({...io,listIssues:async()=>{throw Error('INCOMPLETE')}})).reusable,false);
 let listCalls=0;
 assert.equal((await verifyNoopSelection({...io,listIssues:async()=>++listCalls===1?[a.fresh]:[a.fresh,b.fresh]})).reusable,false);
 assert.equal((await verifyNoopSelection(noopIO([a,a]))).reusable,false);
 assert.equal((await verifyNoopSelection(noopIO(Array.from({length:11},(_,i)=>noopFixture(3000+i))))).reusable,false);
});
test('no-op proof only runs in the exact normal producer Job, never historical manual or selector',()=>{
 const repo=HANDOFF_REPOSITORY,repository={full_name:repo,private:true};
 const event={repository,action:'completed',workflow_run:{name:'ZGMINI PC Job',event:'issues',actor:{login:owner},head_repository:{full_name:repo},id:100,run_attempt:1,created_at:'2026-11-24T00:00:00Z',conclusion:'success'}};
 const env={GITHUB_REPOSITORY:repo,GITHUB_EVENT_PATH:'event.json',GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:owner,GITHUB_EVENT_NAME:'workflow_run',GITHUB_JOB:'enqueue-confirmed-failures',GITHUB_WORKFLOW_REF:repo+'/.github/workflows/agent-handoff-pc-failure-intake.yml@refs/heads/main'};
 assert.doesNotThrow(()=>validateNoopTrigger(event,env));
 assert.throws(()=>validateNoopTrigger(event,{...env,GITHUB_JOB:'verify-and-select-after-failure-intake'}));
 assert.throws(()=>validateNoopTrigger(event,{...env,GITHUB_EVENT_NAME:'workflow_dispatch'}));
 assert.throws(()=>validateNoopTrigger(event,{...env,GITHUB_ACTOR:'other'}));
 const writer={...event,workflow_run:{...event.workflow_run,name:'ZGMINI Approved Writer B Source Overlay Once',head_sha:'a'.repeat(40),head_branch:'main'}};
 const writerEnv={...env,GITHUB_JOB:'enqueue-verified-writer-b-failures',GITHUB_WORKFLOW_REF:repo+'/.github/workflows/agent-handoff-writer-b-failure-intake.yml@refs/heads/main'};
 assert.doesNotThrow(()=>validateNoopTrigger(writer,writerEnv));
 assert.throws(()=>validateNoopTrigger(event,writerEnv));
});


test('direct intake no-op proof is scoped to exact main workflow, job and event',()=>{
 const repo=HANDOFF_REPOSITORY,repository={full_name:repo,private:true};
 const issue={labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}]};
 const env={GITHUB_REPOSITORY:repo,GITHUB_EVENT_PATH:'event.json',GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:owner,GITHUB_EVENT_NAME:'issues',GITHUB_JOB:'route-sanitized-incident',GITHUB_WORKFLOW_REF:repo+'/.github/workflows/agent-handoff.yml@refs/heads/main'};
 const route={repository,issue,action:'opened'};
 assert.doesNotThrow(()=>validateNoopTrigger(route,env));
 assert.doesNotThrow(()=>validateNoopTrigger({...route,action:'labeled',label:{name:'agent-handoff'}},env));
 assert.throws(()=>validateNoopTrigger({...route,action:'labeled',label:{name:'other'}},env));
 assert.throws(()=>validateNoopTrigger(route,{...env,GITHUB_JOB:'record-work-progress'}));
 assert.throws(()=>validateNoopTrigger(route,{...env,GITHUB_JOB:'verify-and-select-after-intake'}));
 assert.throws(()=>validateNoopTrigger(route,{...env,GITHUB_REF:'refs/heads/other'}));
 assert.throws(()=>validateNoopTrigger({...route,repository:{...repository,private:false}},env));
 for(const [job,marker] of [['record-verified-return','ZGMINI_AGENT_HANDOFF_RESULT_V1'],['record-verified-return','ZGMINI_AGENT_HANDOFF_DIAGNOSIS_V1'],['record-work-progress','ZGMINI_HANDOFF_WORK_UPDATE_V1']]){
   const event={repository,issue,action:'created',comment:{body:marker}};
   const e={...env,GITHUB_EVENT_NAME:'issue_comment',GITHUB_JOB:job};
   assert.doesNotThrow(()=>validateNoopTrigger(event,e));
   assert.throws(()=>validateNoopTrigger(event,{...e,GITHUB_JOB:'route-sanitized-incident'}));
   assert.throws(()=>validateNoopTrigger(event,{...e,GITHUB_JOB:job==='record-work-progress'?'record-verified-return':'record-work-progress'}));
   assert.throws(()=>validateNoopTrigger({...event,issue:{...issue,pull_request:{}}},e));
   assert.throws(()=>validateNoopTrigger(event,{...e,GITHUB_ACTOR:'other'}));
 }
});
