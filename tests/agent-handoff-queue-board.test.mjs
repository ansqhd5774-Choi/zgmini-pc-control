import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHandoff,fingerprintHandoff,routeHandoff} from '../agent-handoff/contract.mjs';
import {assessPriority,sortAdvisoryQueue,hoursSince} from '../agent-handoff/queue-priority.mjs';
import {selectionReceipt,orderedPendingIssues,HANDOFF_REPOSITORY,HANDOFF_BOT,HANDOFF_OWNER} from '../agent-handoff/queue-selector.mjs';
import {WORK_SCHEMA,workReceipt} from '../agent-handoff/work-progress-contract.mjs';
import {evaluateQueueItem,compileQueueBoard,renderBoardMarkdown} from '../agent-handoff/queue-board.mjs';
import {validateBoardEvent,collectBoard,BOARD_CRON} from '../agent-handoff/queue-board-runner.mjs';

const now=Date.parse('2026-11-16T12:30:00Z');
const url=n=>'https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/'+n;
function fixture(id=3101,kind='COMMON_WRITER',checkpoint='OTHER',code='WRITER_B_PC_PREIMAGE_STOP',
  created='2026-11-15T00:00:00Z') {
  const obj={schema:'ZGMINI_AGENT_HANDOFF_V1',incidentId:'handoff-board-test-'+id,
    origin:{repository:HANDOFF_REPOSITORY,issueNumber:id-1,
      requestId:'board-request-'+id,chatId:'chat-board-'+id,
      branch:'main',sourceSha:'a'.repeat(40),checkpoint},
    failure:{kind,code,lastPass:'NOT_RECORDED',firstFail:'NOT_RECORDED',
      fileRefs:['results/board-fixture.json'],evidenceIssueNumber:id-1}};
  const parsed=parseHandoff(JSON.stringify(obj));
  const fp=fingerprintHandoff(parsed),routed=routeHandoff(parsed);
  const issue={number:id,repository:HANDOFF_REPOSITORY,title:'agent-handoff '+obj.incidentId,
    body:JSON.stringify(obj),state:'open',user:{login:HANDOFF_BOT},created_at:created,
    labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}]};
  const route={id:1,issue_url:url(id),user:{login:HANDOFF_BOT},
    body:['HANDOFF_ROUTED','incidentId: '+parsed.incidentId,
      'fingerprint: '+fp,'role: '+routed.role,
      'state: AWAITING_AGENT_CONFIGURATION','checkpoint: '+checkpoint,
      'PC retries: 0','operationalWrites: 0',
      'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'].join('\n')};
  const selected={id:2,issue_url:url(id),user:{login:HANDOFF_BOT},
    body:selectionReceipt(parsed,fp)};
  return {issue,parsed,fp,comments:[route,selected]};
}
function update(f,id,state,at) {
  const d={schema:WORK_SCHEMA,updateId:'work-'+f.issue.number+'-'+id+'-20261116',
    incidentId:f.parsed.incidentId,fingerprint:f.fp,
    role:routeHandoff(f.parsed).role,state};
  const c={id,issue_url:url(f.issue.number),user:{login:HANDOFF_OWNER},
    created_at:at,body:JSON.stringify(d)};
  const ack={id:id+1,issue_url:url(f.issue.number),user:{login:HANDOFF_BOT},
    body:workReceipt(d,id)};
  return [c,ack];
}

test('priority is an advisory policy, not an assertion of actual operational severity',()=>{
  const f=fixture(3101,'COMMON_CONTROLLER','INSTALL','BACKLOG_OR_RECOVERY_NOT_VERIFIED');
  const p=assessPriority(f.issue,now);
  assert.equal(p.band,'P1_REVIEW');
  assert.equal(p.role,'COMMON_PROCESS_OWNER');
  assert.equal(p.operationalSeverityVerified,false);
  assert.equal(p.ageHours,36);
  assert.equal(p.score,52+8+5+9);
});
test('role, checkpoint, age and stable tie-break give deterministic priority order',()=>{
  const controller=fixture(3120,'COMMON_CONTROLLER','INSTALL','RECOVERY_REQUIRED');
  const writer=fixture(3101);const feature=fixture(3102,'FEATURE','UI','FEATURE_VALIDATION_STOP');
  const out=sortAdvisoryQueue([feature.issue,writer.issue,controller.issue],now);
  assert.deepEqual(out.map(x=>x.number),[3120,3101,3102]);
  assert.deepEqual(orderedPendingIssues([feature.issue,writer.issue,controller.issue],now).map(x=>x.number),[3120,3101,3102]);
  const same=fixture(3103);
  assert.deepEqual(sortAdvisoryQueue([same.issue,writer.issue],now).map(x=>x.number),[3101,3103]);
});
test('invalid or missing timestamp cannot be mistaken for overdue',()=>{
  const f=fixture(3101);f.issue.created_at='untrusted-date';
  assert.equal(hoursSince('nonsense',now),null);
  assert.equal(assessPriority(f.issue,now).ageHours,null);
  assert.equal(evaluateQueueItem(f.issue,f.comments,now).alert,'NONE');
  assert.equal(hoursSince('2099-01-01T00:00:00Z',now),null);
  assert.throws(()=>sortAdvisoryQueue([{...f.issue},{...f.issue}],now),/IDENTITY_STOP/);
});
test('authentic selected but not yet acknowledged incident produces review warning at 24h',()=>{
  const f=fixture();
  const x=evaluateQueueItem(f.issue,f.comments,now);
  assert.equal(x.status,'PENDING_OWNER_ACK');
  assert.equal(x.alert,'ACK_DELAY_REVIEW');
  assert.equal(x.ownerAccountVerified,false);
  assert.equal(x.chatSessionVerified,false);
});
test('missing selector receipt is not a verified assignment or false ACK',()=>{
  const f=fixture();
  const x=evaluateQueueItem(f.issue,[f.comments[0]],now);
  assert.equal(x.status,'AWAITING_CANDIDATE_SELECTION');
  assert.equal(x.ownerAccountVerified,false);
});
test('verified owner ACK is not equivalent to AI execution, signed-in chat or runtime completion',()=>{
  const f=fixture();
  f.comments.push(...update(f,100,'ACKNOWLEDGED','2026-11-16T12:00:00Z'));
  const x=evaluateQueueItem(f.issue,f.comments,now);
  assert.equal(x.status,'ACKNOWLEDGED');
  assert.equal(x.receiptCount,1);
  assert.equal(x.ownerAccountVerified,true);
  assert.equal(x.chatSessionVerified,false);
  assert.equal(x.aiCalls,0);assert.equal(x.runtimeVerified,false);
  assert.equal(x.alert,'NONE');
});
test('verified WORKING then WAITING_EVIDENCE transition is tracked with last-source time',()=>{
  const f=fixture();
  f.comments.push(...update(f,100,'ACKNOWLEDGED','2026-11-12T00:00:00Z'),
    ...update(f,200,'WORKING','2026-11-13T00:00:00Z'),
    ...update(f,300,'WAITING_EVIDENCE','2026-11-13T00:00:00Z'));
  const x=evaluateQueueItem(f.issue,f.comments,now);
  assert.equal(x.status,'WAITING_EVIDENCE');
  assert.equal(x.receiptCount,3);
  assert.equal(x.alert,'EVIDENCE_WAIT_REVIEW');
});
test('unacknowledged work record or corrupted route cannot be counted as owner activity',()=>{
  const f=fixture(),[c]=update(f,100,'ACKNOWLEDGED','2026-11-16T00:00:00Z');
  assert.equal(evaluateQueueItem(f.issue,[...f.comments,c],now).status,'PROOF_REVIEW_REQUIRED');
  assert.equal(evaluateQueueItem(f.issue,[...f.comments,c],now).alert,'WORK_RECEIPT_PENDING');
  assert.equal(evaluateQueueItem(f.issue,[{...f.comments[0],body:'HANDOFF_ROUTED\nFORGED'},f.comments[1]],now).status,'PROOF_REVIEW_REQUIRED');
});
test('existing result bot comment means result evidence only, not runtime verification',()=>{
  const f=fixture();
  f.comments.push({user:{login:HANDOFF_BOT},issue_url:url(f.issue.number),
    body:'HANDOFF_RESULT_RECORDED\nresultId: result-board-existing'});
  const x=evaluateQueueItem(f.issue,f.comments,now);
  assert.equal(x.status,'RESULT_EVIDENCE_RECORDED');
  assert.equal(x.runtimeVerified,false);
  assert.equal(x.alert,'RUNTIME_PROOF_SEPARATE');
});
test('result conflict and owner work receipt corruption are visible as review problems',()=>{
  const f=fixture();let fake={user:{login:HANDOFF_BOT},issue_url:url(f.issue.number),
    body:'HANDOFF_RESULT_RECORDED\nresultId: result-test'};
  assert.equal(evaluateQueueItem(f.issue,[...f.comments,fake,fake],now).alert,'RESULT_RECEIPT_CONFLICT');
  const [c,receipt]=update(f,100,'ACKNOWLEDGED','2026-11-16T12:00:00Z');
  assert.equal(evaluateQueueItem(f.issue,[...f.comments,c,{...receipt,body:receipt.body.replace('ACKNOWLEDGED','WORKING')}],now).status,'PROOF_REVIEW_REQUIRED');
});
test('board returns complete deterministic aggregate and non-executable GitHub links',()=>{
  const a=fixture(3101);
  const b=fixture(3102,'COMMON_CONTROLLER','INSTALL','BACKLOG_OR_RECOVERY_NOT_VERIFIED');
  b.comments.push(...update(b,100,'ACKNOWLEDGED','2026-11-16T12:00:00Z'));
  const board=compileQueueBoard([{issue:a.issue,comments:a.comments},
    {issue:b.issue,comments:b.comments}],now);
  assert.equal(board.schema,'ZGMINI_HANDOFF_BOARD_R1');
  assert.equal(board.issueCount,2);assert.equal(board.verifiedOwnerAccounts,1);
  assert.equal(board.records[0].issueNumber,3102);
  assert.equal(board.operationalWrites,0);
  const md=renderBoardMarkdown(board);
  assert.match(md,/#3102/);
  assert.match(md,/15분 간격 GitHub 예약 실행/);
  assert.throws(()=>compileQueueBoard([{issue:a.issue,comments:a.comments},{issue:a.issue,comments:a.comments}],now),/DUPLICATE/);
});
test('runner requires authenticated workflow provenance and never grants arbitrary triggers',()=>{
  const event={repository:{full_name:HANDOFF_REPOSITORY,private:true},
    action:'completed',workflow_run:{name:'ZGMINI Handoff Queue Candidate Selector',
      conclusion:'success',actor:{login:HANDOFF_OWNER},head_branch:'main'}};
  const env={GITHUB_REPOSITORY:HANDOFF_REPOSITORY,GITHUB_EVENT_PATH:'event.json',
    GITHUB_EVENT_NAME:'workflow_run'};
  assert.doesNotThrow(()=>validateBoardEvent(event,env));
  assert.doesNotThrow(()=>validateBoardEvent({...event,workflow_run:{...event.workflow_run,name:'ZGMINI Agent Handoff Intake'}},env));
  assert.throws(()=>validateBoardEvent({...event,workflow_run:{...event.workflow_run,name:'Untrusted Pipeline'}},env),/RUN_PROVENANCE_STOP/);
  assert.throws(()=>validateBoardEvent({...event,workflow_run:{...event.workflow_run,actor:{login:'untrusted'}}},env),/RUN_PROVENANCE_STOP/);
  assert.throws(()=>validateBoardEvent({...event,workflow_run:{...event.workflow_run,head_branch:'other'}},env),/RUN_PROVENANCE_STOP/);
  assert.throws(()=>validateBoardEvent({...event,repository:{...event.repository,private:false}},env),/EVENT_SCOPE_STOP/);
  assert.doesNotThrow(()=>validateBoardEvent({repository:event.repository,sender:{login:HANDOFF_OWNER}},
    {...env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:HANDOFF_OWNER}));
  const scheduled={repository:event.repository,schedule:BOARD_CRON};
  const scheduleEnv={...env,GITHUB_EVENT_NAME:'schedule',GITHUB_REF:'refs/heads/main'};
  assert.doesNotThrow(()=>validateBoardEvent(scheduled,scheduleEnv));
  assert.throws(()=>validateBoardEvent({...scheduled,schedule:'* * * * *'},scheduleEnv),/SCHEDULE_PROVENANCE_STOP/);
  assert.throws(()=>validateBoardEvent(scheduled,{...scheduleEnv,GITHUB_REF:'refs/heads/dev'}),/SCHEDULE_PROVENANCE_STOP/);
  assert.throws(()=>validateBoardEvent({...scheduled,repository:{...scheduled.repository,private:false}},scheduleEnv),/EVENT_SCOPE_STOP/);
});
test('read-only collector uses exact inventory/readback and fails when issue changes',async()=>{
  const f=fixture();
  const io={listIssues:async()=>[structuredClone(f.issue)],
    readComments:async()=>structuredClone(f.comments),
    readIssue:async()=>structuredClone(f.issue)};
  const board=await collectBoard(io,now);
  assert.equal(board.issueCount,1);
  assert.equal(board.records[0].issueNumber,f.issue.number);
  await assert.rejects(()=>collectBoard({...io,readIssue:async()=>({...f.issue,state:'closed'})},now),
    /ISSUE_DRIFT_RESCAN_REQUIRED/);
});
test('board GitHub workflow is isolated, origin-guarded, read-only, and has a bounded schedule',()=>{
  const p=new URL('../.github/workflows/agent-handoff-queue-board.yml',import.meta.url);
  const flow=readFileSync(p,'utf8');
  assert.match(flow,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
  assert.match(flow,/issues: read/);
  assert.match(flow,/workflow_dispatch:/);
  assert.match(flow,/schedule:\s*\n\s*- cron: '7,22,37,52 \* \* \* \*'/);
  assert.match(flow,/github\.event_name == 'schedule'/);
  assert.match(flow,/ZGMINI Agent Handoff Intake/);
  assert.doesNotMatch(flow,/contents: write|issues: write|zgmini-pc-control\]/);
  assert.match(flow,/ZGMINI_AGENT_HANDOFF_ENABLED/);
  assert.match(flow,/node agent-handoff\/queue-board-runner.mjs/);
});
