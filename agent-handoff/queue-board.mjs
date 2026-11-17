// Read-only queue control board. No API calls, GitHub writes, AI calls or PC I/O.
import {parseHandoff,fingerprintHandoff,routeHandoff} from './contract.mjs';
import {assessIncident,HANDOFF_OWNER,HANDOFF_BOT,HANDOFF_REPOSITORY} from './queue-selector.mjs';
import {WORK_SCHEMA,evaluateWorkUpdate} from './work-progress-contract.mjs';
import {assessPriority,hoursSince,sortAdvisoryQueue} from './queue-priority.mjs';

const URL=n=>'https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/'+n;
const FINAL_MARKERS=['HANDOFF_RESULT_RECORDED\n','HANDOFF_ORIGIN_RESULT_RECORDED\n'];
const fail=code=>{throw Error('HANDOFF_BOARD_'+code);};
const validMs=ms=>Number.isFinite(ms)&&ms>=Date.UTC(2020,0,1);
const author=x=>x?.user?.login;
function ownerWork(c){
  return author(c)===HANDOFF_OWNER&&typeof c.body==='string'&&
    c.body.startsWith('{"schema":"'+WORK_SCHEMA+'"');
}
function returned(c,issueNumber){
  return author(c)===HANDOFF_BOT&&c.issue_url===URL(issueNumber)&&
    FINAL_MARKERS.some(prefix=>c.body?.startsWith(prefix));
}

export const REVIEW_POLICY=Object.freeze({
  version:'HANDOFF_PROGRESS_AGE_REVIEW_R1',
  ackHours:24,workHours:48,evidenceHours:72
});

export function evaluateQueueItem(issue,comments,nowMs){
  if(!validMs(nowMs)||!issue||!Number.isSafeInteger(issue.number)||issue.number<1||
    !Array.isArray(comments)||comments.length>400)
    fail('INPUT_OR_CLOCK_INVALID');
  const priority=assessPriority(issue,nowMs);
  const decision=assessIncident(issue,comments);
  const base={issueNumber:issue.number,priority:priority.band,score:priority.score,
    priorityPolicy:priority.policy??null,kind:priority.kind??null,
    checkpoint:priority.checkpoint??null,role:priority.role,ageHours:priority.ageHours,
    evidenceState:decision.state,ownerAccountVerified:false,
    chatSessionVerified:false,pcOperationalWrites:0,aiCalls:0,
    runtimeVerified:false};
  if(!['READY','ALREADY_SELECTED'].includes(decision.state)){
    return Object.freeze({...base,status:'PROOF_REVIEW_REQUIRED',
      alert:'LEDGER_REVIEW_REQUIRED',lastProgressHours:null,receiptCount:0});
  }
  const finals=comments.filter(c=>returned(c,issue.number));
  if(finals.length>1)return Object.freeze({...base,status:'PROOF_REVIEW_REQUIRED',
    alert:'RESULT_RECEIPT_CONFLICT',lastProgressHours:null,receiptCount:finals.length});
  if(finals.length===1)return Object.freeze({...base,status:'RESULT_EVIDENCE_RECORDED',
    // A result marker may already have been verified by the independent broker,
    // but its mere presence is not proof of production runtime completion.
    alert:'RUNTIME_PROOF_SEPARATE',lastProgressHours:null,receiptCount:1});
  let status=decision.state==='READY'?'AWAITING_CANDIDATE_SELECTION':'PENDING_OWNER_ACK';
  let last=null;let lastTime=null;let receiptCount=0;
  const updateComments=comments.filter(ownerWork).sort((a,b)=>a.id-b.id);
  if(updateComments.length){
    if(decision.state!=='ALREADY_SELECTED')
      return Object.freeze({...base,status:'PROOF_REVIEW_REQUIRED',
        alert:'WORK_BEFORE_VERIFIED_SELECTION',lastProgressHours:null,receiptCount:0});
    for(const c of updateComments){
      if(!Number.isSafeInteger(c.id)||c.id<1||c.issue_url!==URL(issue.number))
        return Object.freeze({...base,status:'PROOF_REVIEW_REQUIRED',
          alert:'WORK_COMMENT_IDENTITY_CONFLICT',lastProgressHours:null,receiptCount});
      let proof;
      try{proof=evaluateWorkUpdate(issue,comments,c);}catch{
        return Object.freeze({...base,status:'PROOF_REVIEW_REQUIRED',
          alert:'WORK_TRANSITION_OR_RECEIPT_CONFLICT',lastProgressHours:null,receiptCount});
      }
      if(proof.state!=='ALREADY_RECORDED')
        return Object.freeze({...base,status:'PROOF_REVIEW_REQUIRED',
          alert:'WORK_RECEIPT_PENDING',lastProgressHours:null,receiptCount});
      last=proof.progressState;
      lastTime=c.created_at??null;
      receiptCount++;
    }
    status=last;
  }
  const idle=hoursSince(lastTime??issue.created_at,nowMs);
  let alert='NONE';
  if(status==='PENDING_OWNER_ACK'&&idle!==null&&idle>=REVIEW_POLICY.ackHours)
    alert='ACK_DELAY_REVIEW';
  else if(['ACKNOWLEDGED','WORKING'].includes(status)&&idle!==null&&idle>=REVIEW_POLICY.workHours)
    alert='WORK_INACTIVITY_REVIEW';
  else if(status==='WAITING_EVIDENCE'&&idle!==null&&idle>=REVIEW_POLICY.evidenceHours)
    alert='EVIDENCE_WAIT_REVIEW';
  return Object.freeze({...base,status,alert,lastProgressHours:idle,
    receiptCount,ownerAccountVerified:receiptCount>0});
}

export function compileQueueBoard(items,nowMs,
  {openHandoffIssueCount=Array.isArray(items)?items.length:0}={}){
  if(!validMs(nowMs)||!Array.isArray(items)||items.length>100||
    !Number.isSafeInteger(openHandoffIssueCount)||
    openHandoffIssueCount<items.length||openHandoffIssueCount>100)
    fail('INVENTORY_INVALID');
  const numbers=new Set();
  for(const item of items){
    const n=item?.issue?.number;
    if(!Number.isSafeInteger(n)||n<1||numbers.has(n))fail('DUPLICATE_OR_INVALID_ISSUE');
    numbers.add(n);
  }
  const ordered=sortAdvisoryQueue(items.map(x=>x.issue),nowMs);
  const byNumber=new Map(items.map(x=>[x.issue.number,x]));
  const records=ordered.map(issue=>{
    const x=byNumber.get(issue.number);
    return evaluateQueueItem(issue,x.comments,nowMs);
  });
  const statuses=Object.create(null),alerts=Object.create(null),roles=Object.create(null);
  for(const r of records){
    statuses[r.status]=(statuses[r.status]??0)+1;
    alerts[r.alert]=(alerts[r.alert]??0)+1;
    roles[r.role]=(roles[r.role]??0)+1;
  }
  return Object.freeze({schema:'ZGMINI_HANDOFF_BOARD_R1',asOf:new Date(nowMs).toISOString(),
    advisoryOnly:true,completeInventory:true,
    // Active pending is verified using owner/bot comment readback; open non-pending
    // is only a GitHub label inventory count, NOT proof of issue resolution.
    issueCount:records.length,pendingIssueCount:records.length,
    openHandoffIssueCount,nonPendingOpenIssueCount:openHandoffIssueCount-records.length,
    ackOnlyCount:records.filter(r=>r.status==='ACKNOWLEDGED').length,
    verifiedOwnerAccounts:records.filter(r=>r.ownerAccountVerified).length,
    reviewAlertCount:records.filter(r=>!['NONE','RUNTIME_PROOF_SEPARATE'].includes(r.alert)).length,
    statuses,alerts,roles,records,operationalWrites:0,aiCalls:0,automaticPcRetries:0});
}

export function renderBoardMarkdown(board){
  if(board.schema!=='ZGMINI_HANDOFF_BOARD_R1')fail('OUTPUT_SCHEMA');
  const out=['# ZGMINI 공통 대기열 관제','',
    '관측 기준 UTC: '+board.asOf,
    '원본: GitHub Issue 및 인증된 댓글 (읽기 전용 스냅샷)',
    '열린 자동 인계: **'+board.openHandoffIssueCount+'** · 현재 대기: **'+board.pendingIssueCount+
      '** · 대기 라벨 없는 열린 인계: **'+board.nonPendingOpenIssueCount+'**',
    '현재 대기 중 ACK 기록만 확인된 건: **'+board.ackOnlyCount+
      '** · 인증 계정 인수: **'+board.verifiedOwnerAccounts+
      '** · 확인 후보: **'+board.reviewAlertCount+'**',
    '','| 우선순위(참고) | Issue | 유형 | 역할 | 증거상태 | 마지막 진행 이후(h) | 확인사항 |',
    '|---|---|---|---|---|---:|---|'];
  for(const x of board.records){
    const ref='[#'+x.issueNumber+'](https://github.com/'+HANDOFF_REPOSITORY+
      '/issues/'+x.issueNumber+')';
    out.push('| '+x.priority+' ('+x.score+') | '+ref+' | '+(x.kind??'UNVERIFIED')+
      ' | '+x.role+' | '+x.status+' | '+(x.lastProgressHours??'—')+
      ' | '+x.alert+' |');
  }
  out.push('','- 우선순위는 오류 종류·단계·GitHub 생성 시각에 따른 **검토 순서**이며 실제 운영 영향이나 확정 긴급도가 아닙니다.',
    '- 인수 표시는 GitHub 계정 댓글 영수증만 확인합니다. 특정 일반챗 자동 실행·수신/운영 적용을 증명하지 않습니다.',
    '- 대기 라벨이 없는 열린 인계는 이력/별도 검토 대상으로 집계하며, 해제만으로 해결·운영 완료로 판정하지 않습니다.',
    '- 중앙 #68 댓글로 직접 접수된 공유 지원 요청은 별도의 실접수 원천이며 이 자동 인계 집계에 포함되지 않습니다.',
    '- 지연 표시는 '+REVIEW_POLICY.ackHours+'/'+REVIEW_POLICY.workHours+'/'+REVIEW_POLICY.evidenceHours+
      '시간 경과 검토 후보입니다. 계약상 SLA 위반이 아닙니다.',
    '- 이 스냅샷은 후보 선별·인수/결과 Workflow 성공 후, 수동 실행 또는 15분 간격 GitHub 예약 실행 시 갱신됩니다. 예약은 지연되거나 누락될 수 있습니다.');
  return out.join('\n')+'\n';
}
