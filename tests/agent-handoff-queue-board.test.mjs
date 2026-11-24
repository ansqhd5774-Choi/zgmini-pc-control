import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHandoff,fingerprintHandoff,routeHandoff} from '../agent-handoff/contract.mjs';
import {assessPriority,sortAdvisoryQueue,hoursSince} from '../agent-handoff/queue-priority.mjs';
import {selectionReceipt,orderedPendingIssues,HANDOFF_REPOSITORY,HANDOFF_BOT,HANDOFF_OWNER} from '../agent-handoff/queue-selector.mjs';
import {WORK_SCHEMA,workReceipt} from '../agent-handoff/work-progress-contract.mjs';
import {evaluateQueueItem,compileQueueBoard,renderBoardMarkdown,ownerExecutionPlan} from '../agent-handoff/queue-board.mjs';
import {validateBoardEvent,collectBoard,BOARD_CRON,pages,mapBounded} from '../agent-handoff/queue-board-runner.mjs';

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

test('previously selected incident remains actionable until an authenticated owner ACK',()=>{
  const f=fixture();
  const board=compileQueueBoard([{issue:f.issue,comments:f.comments}],now);
  const plan=ownerExecutionPlan(board);
  assert.equal(plan.state,'OWNER_ACTION_REQUIRED');
  assert.deepEqual(plan.ownerActionRequired,[f.issue.number]);
  assert.equal(plan.thisProcessExecutesAi,false);
  assert.equal(plan.processorAvailability,'NOT_ATTESTED');
});

test('verified owner ACK leaves unclaimed queue without pretending automatic AI execution',()=>{
  const f=fixture();const comments=[...f.comments,...update(f,100,'ACKNOWLEDGED','2026-11-16T00:00:00Z')];
  const plan=ownerExecutionPlan(compileQueueBoard([{issue:f.issue,comments}],now));
  assert.deepEqual(plan.ownerActionRequired,[]);
  assert.deepEqual(plan.acknowledged,[f.issue.number]);
  assert.deepEqual(plan.working,[]);
});

test('missing owner receipt remains proof review rather than acknowledged/working',()=>{
  const f=fixture();const [c]=update(f,100,'ACKNOWLEDGED','2026-11-16T00:00:00Z');
  const plan=ownerExecutionPlan(compileQueueBoard([{issue:f.issue,comments:[...f.comments,c]}],now));
  assert.deepEqual(plan.proofReviewRequired,[f.issue.number]);
  assert.deepEqual(plan.acknowledged,[]);
  assert.throws(()=>ownerExecutionPlan({records:[]}),/EXECUTION_PLAN_INPUT/);
});

test('verified diagnostic return is a query receipt, not incident or runtime resolution',()=>{
 const f=fixture();const receipt={id:999,user:{login:HANDOFF_BOT},
  issue_url:url(f.issue.number),body:'HANDOFF_DIAGNOSIS_RETURNED_V1\nincidentResolution: NOT_ASSERTED'};
 const board=compileQueueBoard([{issue:f.issue,comments:[...f.comments,receipt]}],now);
 assert.equal(board.records[0].status,'DIAGNOSIS_EVIDENCE_RECORDED');
 assert.equal(board.records[0].runtimeVerified,false);
 assert.equal(board.records[0].alert,'INCIDENT_RESOLUTION_SEPARATE');
 assert.deepEqual(ownerExecutionPlan(board).resultRecorded,[f.issue.number]);
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
  assert.equal(board.openHandoffIssueCount,2);
  assert.equal(board.pendingIssueCount,2);
  assert.equal(board.nonPendingOpenIssueCount,0);
  assert.equal(board.ackOnlyCount,1);
  assert.equal(board.records[0].issueNumber,3102);
  assert.equal(board.operationalWrites,0);
  const md=renderBoardMarkdown(board);
  assert.match(md,/#3102/);
  assert.match(md,/15분 간격 GitHub 예약 실행/);
  assert.match(md,/열린 agent-handoff 이슈: \*\*2\*\*/);
  assert.match(md,/현재 대기: \*\*2\*\*/);
  assert.match(md,/중앙 #68 댓글로 직접 접수된 공유 지원 요청/);
  assert.throws(()=>compileQueueBoard([{issue:a.issue,comments:a.comments},{issue:a.issue,comments:a.comments}],now),/DUPLICATE/);
});
test('runner requires authenticated workflow provenance and never grants arbitrary triggers',()=>{
  const event={repository:{full_name:HANDOFF_REPOSITORY,private:true},
    action:'completed',workflow_run:{name:'ZGMINI Handoff Queue Candidate Selector',
      conclusion:'success',actor:{login:HANDOFF_OWNER},head_branch:'main'}};
  const env={GITHUB_REPOSITORY:HANDOFF_REPOSITORY,GITHUB_EVENT_PATH:'event.json',
    GITHUB_EVENT_NAME:'workflow_run'};
  assert.doesNotThrow(()=>validateBoardEvent(event,env));
  assert.throws(()=>validateBoardEvent({...event,workflow_run:{...event.workflow_run,name:'ZGMINI Agent Handoff Intake'}},env),/RUN_PROVENANCE_STOP/);
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
  const partial=await collectBoard({...io,
    readIssue:async()=>({...f.issue,state:'closed'})},now);
  assert.equal(partial.issueCount,1);
  assert.equal(partial.unverifiedIssueCount,1);
  assert.equal(partial.evidenceComplete,false);
  assert.equal(partial.records[0].status,'PROOF_REVIEW_REQUIRED');
  assert.equal(partial.unverifiedIssues[0].reason,'ISSUE_DRIFT_RESCAN_REQUIRED');
});
test('owner-authored handoff with verified bot route can have descriptive title without claiming job started',()=>{
  const f=fixture(3194);
  f.issue.user={login:HANDOFF_OWNER};
  f.issue.title='[W03→총괄] descriptive human issue title';
  const row=evaluateQueueItem(f.issue,f.comments,now);
  assert.equal(row.status,'PENDING_OWNER_ACK');
  assert.equal(row.evidenceState,'ALREADY_SELECTED');
  assert.equal(row.ownerAccountVerified,false);
  assert.equal(row.runtimeVerified,false);
  const board=compileQueueBoard([{issue:f.issue,comments:f.comments}],now);
  const markdown=renderBoardMarkdown(board);
  assert.match(markdown,/ALREADY_SELECTED/);
  assert.match(markdown,/검증 원인/);
  assert.equal(board.pendingIssueCount,1);
  assert.equal(board.ackOnlyCount,0);
});

test('open history and current pending are counted separately without false completion',async()=>{
  const pending=fixture(3110);
  const nonPending=fixture(3111);
  nonPending.issue.labels=[{name:'agent-handoff'}];
  let commentReads=0,issueReads=0;
  const io={listIssues:async()=>[structuredClone(nonPending.issue),structuredClone(pending.issue)],
    readComments:async n=>{commentReads++;assert.equal(n,pending.issue.number);
      return structuredClone(pending.comments);},
    readIssue:async n=>{issueReads++;assert.equal(n,pending.issue.number);
      return structuredClone(pending.issue);}};
  const board=await collectBoard(io,now);
  assert.equal(board.openHandoffIssueCount,2);
  assert.equal(board.pendingIssueCount,1);
  assert.equal(board.nonPendingOpenIssueCount,1);
  assert.equal(board.issueCount,1);
  assert.equal(board.records[0].issueNumber,pending.issue.number);
  assert.equal(commentReads,1);
  assert.equal(issueReads,1);
  const markdown=renderBoardMarkdown(board);
  assert.match(markdown,/대기 라벨이 없는 열린 인계/);
  assert.doesNotMatch(markdown,/해결 완료: \*\*1\*\*/);
  const outOfScope={...nonPending.issue,labels:[]};
  await assert.rejects(()=>collectBoard({...io,listIssues:async()=>[outOfScope]},now),
    /INCIDENT_INVENTORY_OUT_OF_SCOPE/);
});

test('board GitHub workflow is isolated, origin-guarded, read-only, and has a bounded schedule',()=>{
  const p=new URL('../.github/workflows/agent-handoff-queue-board.yml',import.meta.url);
  const flow=readFileSync(p,'utf8');
  assert.match(flow,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
  assert.match(flow,/issues: read/);
  assert.match(flow,/workflow_dispatch:/);
  assert.match(flow,/schedule:\s*\n\s*- cron: '7,22,37,52 \* \* \* \*'/);
  assert.match(flow,/github\.event_name == 'schedule'/);
  assert.doesNotMatch(flow,/^  workflow_run:/m);
  assert.doesNotMatch(flow,/github\.event\.workflow_run/);
  assert.doesNotMatch(flow,/ZGMINI Agent Handoff Intake/);
  assert.doesNotMatch(flow,/contents: write|issues: write|zgmini-pc-control\]/);
  assert.match(flow,/ZGMINI_AGENT_HANDOFF_ENABLED/);
  assert.match(flow,/node agent-handoff\/queue-board-runner.mjs/);
});

test('verified 120 pending Issues are not stopped by the historical 100 cap',async()=>{
  const fixtures=Array.from({length:120},(_,i)=>fixture(4000+i));
  const source=new Map(fixtures.map(f=>[f.issue.number,f]));
  const b=await collectBoard({
    listIssues:async()=>fixtures.map(f=>structuredClone(f.issue)),
    readComments:async n=>structuredClone(source.get(n).comments),
    readIssue:async n=>structuredClone(source.get(n).issue)
  },now);
  assert.equal(b.issueCount,120);
  assert.equal(b.openHandoffIssueCount,120);
  assert.equal(b.unverifiedIssueCount,0);
  assert.equal(b.completeInventory,true);
  assert.equal(b.evidenceComplete,true);
});

test('one Issue transient GET error does not discard verified peer rows',async()=>{
  const a=fixture(4101),b=fixture(4102);
  const board=await collectBoard({
    listIssues:async()=>[a.issue,b.issue],
    readComments:async n=>{
      if(n===4101)throw Error('HANDOFF_BOARD_RUNNER_GITHUB_HTTP_503');
      return b.comments;
    },
    readIssue:async n=>n===4101?a.issue:b.issue
  },now);
  assert.equal(board.issueCount,2);
  assert.equal(board.unverifiedIssueCount,1);
  assert.equal(board.evidenceComplete,false);
  assert.equal(board.unverifiedIssues[0].issueNumber,4101);
  assert.equal(board.records.find(x=>x.issueNumber===4102).status,'PENDING_OWNER_ACK');
  assert.equal(board.records.find(x=>x.issueNumber===4101).status,'PROOF_REVIEW_REQUIRED');
  assert.match(renderBoardMarkdown(board),/개별 증거 미확인/);
});

test('authenticated queue-board evidence survives more than 400 unrelated comments',async()=>{
  const a=fixture(4201),b=fixture(4202);
  const unrelated=Array.from({length:405},(_,i)=>({
    id:i+100,user:{login:'other-user'},issue_url:url(4201),body:'discussion '+i
  }));
  const board=await collectBoard({
    listIssues:async()=>[a.issue,b.issue],
    readComments:async n=>n===4201?[...a.comments,...unrelated]:b.comments,
    readIssue:async n=>n===4201?a.issue:b.issue
  },now);
  assert.equal(board.unverifiedIssueCount,0);
  assert.equal(board.evidenceComplete,true);
  assert.equal(board.records.find(x=>x.issueNumber===4201).status,'PENDING_OWNER_ACK');
  assert.equal(board.records.find(x=>x.issueNumber===4202).status,'PENDING_OWNER_ACK');
});

test('global GitHub 401/403 is never disguised as a partial Issue failure',async()=>{
  for(const status of [401,403]){
    const f=fixture();
    await assert.rejects(()=>collectBoard({
      listIssues:async()=>[f.issue],
      readComments:async()=>{throw Error('HANDOFF_BOARD_RUNNER_GITHUB_HTTP_'+status);},
      readIssue:async()=>f.issue
    },now),new RegExp('GITHUB_HTTP_'+status));
  }
});

test('complete pagination continues beyond 100 and stops on a full last page',async()=>{
  const seen=[];
  const data=Array.from({length:250},(_,i)=>({number:i+1}));
  const rows=await pages('issues?state=open',5,async resource=>{
    const page=Number(resource.match(/page=(\d+)$/)?.[1]);
    seen.push(page);return data.slice((page-1)*100,page*100);
  });
  assert.equal(rows.length,250);
  assert.deepEqual(seen,[1,2,3]);
  await assert.rejects(()=>pages('issues',2,async()=>data.slice(0,100)),
    /PAGINATION_INCOMPLETE/);
  await assert.rejects(()=>pages('issues',2,async()=>({bad:true})),
    /INVALID_PAGE/);
});

test('bounded read pool preserves original ordering and caps parallel reads',async()=>{
  let active=0,peak=0;
  const values=await mapBounded(Array.from({length:17},(_,i)=>i),async n=>{
    active++;peak=Math.max(peak,active);
    await Promise.resolve();
    active--;return n*2;
  },4);
  assert.equal(peak,4);
  assert.deepEqual(values,Array.from({length:17},(_,i)=>i*2));
});

test('006 exact full page boundary needs an empty lookahead and is complete',async()=>{
 const items=Array.from({length:200},(_,i)=>({number:i+1}));
 const seen=[];
 const rows=await pages('issues',2,async resource=>{
  const n=Number(resource.match(/page=(\d+)$/)?.[1]);
  seen.push(n);return items.slice((n-1)*100,n*100);
 });
 assert.equal(rows.length,200);
 assert.deepEqual(seen,[1,2,3]);
});


test('board renders next action without manufacturing owner acknowledgement',()=>{
 const f=fixture();const board=compileQueueBoard([{issue:f.issue,comments:f.comments}],now);
 const text=renderBoardMarkdown(board);
 assert.match(text,/다음 행동/);assert.match(text,/정형 인수 영수증 미확인/);
 assert.equal(board.records[0].ownerAccountVerified,false);
 assert.equal(board.records[0].status,'PENDING_OWNER_ACK');
});


test('ordinary Owner notes and origin links are visible without upgrading pending to ACK or success',()=>{
 const f=fixture();f.comments.push({id:55,user:{login:HANDOFF_OWNER},issue_url:url(f.issue.number),body:'후속 설치가 성공했다는 설명이며 자동 판정 근거는 아님'});
 const board=compileQueueBoard([{issue:f.issue,comments:f.comments}],now),row=board.records[0];
 assert.equal(row.originIssueNumber,f.issue.number-1);assert.equal(row.ownerNoteCount,1);
 assert.equal(row.latestOwnerNoteId,55);assert.equal(row.status,'PENDING_OWNER_ACK');
 assert.equal(row.ownerAccountVerified,false);assert.equal(row.runtimeVerified,false);
 const text=renderBoardMarkdown(board);
 assert.ok(text.includes('/issues/'+(f.issue.number-1)+')'));
 assert.ok(text.includes('#issuecomment-55'));assert.match(text,/실제 미처리를 뜻하지 않습니다/);
 assert.match(text,/일반챗 자동 호출은 이 관제의 지원 기능이 아닙니다/);
 assert.equal(text.includes('후속 설치가 성공했다는 설명'),false);
});
test('other identities, wrong issue URLs and unsafe note IDs are not owner-note evidence',()=>{
 const f=fixture();f.comments.push(
  {id:55,user:{login:'outsider'},issue_url:url(f.issue.number),body:'done'},
  {id:56,user:{login:HANDOFF_OWNER},issue_url:url(f.issue.number+1),body:'done'},
  {id:'57',user:{login:HANDOFF_OWNER},issue_url:url(f.issue.number),body:'done'});
 const row=evaluateQueueItem(f.issue,f.comments,now);
 assert.equal(row.ownerNoteCount,0);assert.equal(row.latestOwnerNoteId,null);
 assert.equal(row.status,'PENDING_OWNER_ACK');
});
test('adding review references never changes selector execution plan or grants mutation',()=>{
 const f=fixture();const before=compileQueueBoard([{issue:f.issue,comments:f.comments}],now);
 f.comments.push({id:70,user:{login:HANDOFF_OWNER},issue_url:url(f.issue.number),body:'작업 중'});
 const after=compileQueueBoard([{issue:f.issue,comments:f.comments}],now);
 assert.deepEqual(ownerExecutionPlan(after),ownerExecutionPlan(before));
 assert.equal(after.operationalWrites,0);assert.equal(after.aiCalls,0);assert.equal(after.automaticPcRetries,0);
});


test('after-selection board accepts only the reviewed main job and authorized selector origins',()=>{
  const repository={full_name:HANDOFF_REPOSITORY,private:true};
  const env={GITHUB_REPOSITORY:HANDOFF_REPOSITORY,GITHUB_EVENT_PATH:'event.json',
    GITHUB_JOB:'authenticated-readonly-board-after-selection',
    GITHUB_WORKFLOW_REF:HANDOFF_REPOSITORY+'/.github/workflows/agent-handoff-candidate-selector.yml@refs/heads/main',
    GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_run'};
  const run={repository,action:'completed',workflow_run:{name:'ZGMINI Agent Handoff Intake',
    conclusion:'success',actor:{login:HANDOFF_OWNER}}};
  for(const name of ['ZGMINI Agent Handoff Intake','ZGMINI Agent Handoff PC Failure Intake','ZGMINI Agent Handoff Writer B Failure Intake'])
    assert.doesNotThrow(()=>validateBoardEvent({...run,workflow_run:{...run.workflow_run,name}},env));
  for(const conclusion of ['skipped','failure','cancelled'])
    assert.throws(()=>validateBoardEvent({...run,workflow_run:{...run.workflow_run,conclusion}},env),/AFTER_SELECTION_RUN_STOP/);
  assert.throws(()=>validateBoardEvent({...run,workflow_run:{...run.workflow_run,name:'Other'}},env),/AFTER_SELECTION_RUN_STOP/);
  assert.throws(()=>validateBoardEvent({...run,workflow_run:{...run.workflow_run,actor:{login:'other'}}},env),/AFTER_SELECTION_RUN_STOP/);
  assert.throws(()=>validateBoardEvent(run,{...env,GITHUB_REF:'refs/heads/dev'}),/AFTER_SELECTION_SCOPE_STOP/);
  assert.throws(()=>validateBoardEvent(run,{...env,GITHUB_WORKFLOW_REF:env.GITHUB_WORKFLOW_REF.replace('candidate-selector','queue-board')}),/AFTER_SELECTION_SCOPE_STOP/);
  assert.throws(()=>validateBoardEvent(run,{...env,GITHUB_JOB:'unrelated-job'}),/RUN_PROVENANCE_STOP/);
  const manual={repository,sender:{login:HANDOFF_OWNER}};
  const manualEnv={...env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:HANDOFF_OWNER};
  assert.doesNotThrow(()=>validateBoardEvent(manual,manualEnv));
  assert.throws(()=>validateBoardEvent({...manual,sender:{login:'other'}},manualEnv),/DISPATCH_OWNER_STOP/);
  const push={repository,ref:'refs/heads/main',deleted:false};
  const pushEnv={...env,GITHUB_EVENT_NAME:'push',GITHUB_ACTOR:HANDOFF_OWNER};
  assert.doesNotThrow(()=>validateBoardEvent(push,pushEnv));
  assert.throws(()=>validateBoardEvent({...push,deleted:true},pushEnv),/AFTER_SELECTION_PUSH_STOP/);
  assert.throws(()=>validateBoardEvent(push,{...pushEnv,GITHUB_ACTOR:'other'}),/AFTER_SELECTION_PUSH_STOP/);
  assert.throws(()=>validateBoardEvent({...run,repository:{...repository,private:false}},env),/EVENT_SCOPE_STOP/);
});


test('direct intake board preserves original event scope after selection',()=>{
  const repository={full_name:HANDOFF_REPOSITORY,private:true};
  const owner=HANDOFF_OWNER;
  const issue={labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}]};
  const event={repository,issue,action:'opened'};
  const env={GITHUB_REPOSITORY:HANDOFF_REPOSITORY,GITHUB_EVENT_PATH:'event.json',
    GITHUB_WORKFLOW_REF:HANDOFF_REPOSITORY+'/.github/workflows/agent-handoff.yml@refs/heads/main',
    GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:owner,GITHUB_EVENT_NAME:'issues',
    GITHUB_JOB:'authenticated-readonly-board-after-selection'};
  assert.doesNotThrow(()=>validateBoardEvent(event,env));
  assert.doesNotThrow(()=>validateBoardEvent({...event,action:'labeled',label:{name:'agent-handoff'}},env));
  assert.throws(()=>validateBoardEvent({...event,action:'labeled',label:{name:'other'}},env));
  assert.throws(()=>validateBoardEvent({...event,issue:{labels:[]}},env));
  assert.throws(()=>validateBoardEvent(event,{...env,GITHUB_ACTOR:'other'}));
  assert.throws(()=>validateBoardEvent(event,{...env,GITHUB_REF:'refs/heads/dev'}));
  assert.throws(()=>validateBoardEvent(event,{...env,GITHUB_WORKFLOW_REF:env.GITHUB_WORKFLOW_REF.replace('agent-handoff.yml','other.yml')}));
  assert.throws(()=>validateBoardEvent(event,{...env,GITHUB_JOB:'unrelated-job'}));
  assert.throws(()=>validateBoardEvent({...event,repository:{...repository,private:false}},env));
  const commentEnv={...env,GITHUB_EVENT_NAME:'issue_comment'};
  for(const body of ['ZGMINI_AGENT_HANDOFF_RESULT_V1','ZGMINI_AGENT_HANDOFF_DIAGNOSIS_V1','ZGMINI_HANDOFF_WORK_UPDATE_V1'])
    assert.doesNotThrow(()=>validateBoardEvent({...event,action:'created',comment:{body}},commentEnv));
  assert.throws(()=>validateBoardEvent({...event,action:'created',comment:{body:'ordinary comment'}},commentEnv));
  assert.throws(()=>validateBoardEvent({...event,action:'created',issue:{...issue,pull_request:{}},comment:{body:'ZGMINI_AGENT_HANDOFF_RESULT_V1'}},commentEnv));
  assert.throws(()=>validateBoardEvent({...event,action:'created',issue:{labels:[{name:'agent-handoff'}]},comment:{body:'ZGMINI_HANDOFF_WORK_UPDATE_V1'}},commentEnv));
  assert.throws(()=>validateBoardEvent({...event,action:'edited',comment:{body:'ZGMINI_AGENT_HANDOFF_RESULT_V1'}},commentEnv));
});
