import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprintHandoff, parseHandoff, routeHandoff} from '../agent-handoff/contract.mjs';
import {assessIncident, selectionReceipt, processQueue, SELECTION_MARKER,
  HANDOFF_BOT, HANDOFF_REPOSITORY} from '../agent-handoff/queue-selector.mjs';
import {validateTrigger} from '../agent-handoff/queue-dispatcher.mjs';

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
