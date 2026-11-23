// GitHub-only wide monitoring: observed evidence, not incident remediation.
import {createHash} from 'node:crypto';
export const WIDE_POLICY=Object.freeze({
  version:'ZGMINI_GITHUB_WIDE_SCOUT_R3',lookbackDays:7,
  maxRuns:1600,maxIssues:500,maxPulls:500,maxComments:350,
  maxFindings:25,minReportHours:6,ledgerIssue:1743,
  schedule:'14,29,44,59 * * * *'
});
export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi', BOT='github-actions[bot]';
const stop=c=>{throw Error('WIDE_SCOUT_'+c)};
const goodId=n=>Number.isSafeInteger(n)&&n>0;
const time=(s,now)=>{
  if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s))return null;
  const t=Date.parse(s);
  return Number.isFinite(t)&&t<=now+60000&&t>=Date.UTC(2020,0,1)?t:null;
};
const hours=(then,now)=>Math.floor((now-then)/3600000);
const issueUrl=n=>'https://github.com/'+CONTROL_REPO+'/issues/'+n;
const runUrl=n=>'https://github.com/'+CONTROL_REPO+'/actions/runs/'+n;
const labels=x=>Array.isArray(x)?x.map(y=>y?.name):[];
function validateArray(arr,max,kind){
  if(!Array.isArray(arr)||arr.length>max)stop(kind+'_INVENTORY');
}
function entry(kind,id,at,link,meaning){
  return {kind,id,at,link,meaning};
}
export function evaluateWideSnapshot({runs,issues,pulls,workflows,scheduleRunCount,complete,coverage=[]},now){
  if(!Number.isFinite(now)||now<Date.UTC(2020,0,1))stop('CLOCK');
  validateArray(runs,WIDE_POLICY.maxRuns,'RUN');
  validateArray(issues,WIDE_POLICY.maxIssues,'ISSUE');
  validateArray(pulls,WIDE_POLICY.maxPulls,'PR');
  validateArray(workflows,3,'WORKFLOW');
  if(workflows.length!==3||!Number.isSafeInteger(scheduleRunCount)||
      scheduleRunCount<0||!complete||typeof complete!=='object')stop('SCOPE');
  const cutoff=now-WIDE_POLICY.lookbackDays*86400000;
  if(!Array.isArray(coverage)||coverage.length>8)stop('COVERAGE_INVENTORY');
  const seenRuns=new Set(),seenIssues=new Set(),seenPrs=new Set();
  const observations=[];
  const invalid={runs:0,issues:0,pulls:0};
  let failed=0,stale=0,cancelled=0,actionRequired=0,old=0,issuesDue=0,prsDue=0;
  for(const r of runs){
    if(!goodId(r?.id)||seenRuns.has(r.id)||time(r.created_at,now)===null){invalid.runs++;continue;}
    seenRuns.add(r.id);
    const t=time(r.created_at,now);
    if(t<cutoff){old++;continue;}
    if(['failure','timed_out'].includes(r.conclusion)){failed++;continue;} // R1 owns detailed error triage
    if(r.status==='queued'||r.status==='in_progress'||r.status==='waiting'){
      const start=time(r.run_started_at,now)??t;
      if(hours(start,now)>=2){
        stale++;
        observations.push(entry('RUN_DELAY_REVIEW',r.id,t,runUrl(r.id),'2h+ GitHub status; not proven stuck'));
      }
    }else if(r.status==='completed'&&r.conclusion==='cancelled'){
      cancelled++;
      observations.push(entry('CANCELLED_RUN_REVIEW',r.id,t,runUrl(r.id),'Cancellation may be intentional'));
    }else if(r.conclusion==='action_required'||r.status==='action_required'){
      actionRequired++;
      observations.push(entry('ACTION_REQUIRED_REVIEW',r.id,t,runUrl(r.id),'Review GitHub approval/policy'));
    }
  }
  for(const x of issues){
    if(!goodId(x?.number)||seenIssues.has(x.number)||time(x.created_at,now)===null){invalid.issues++;continue;}
    seenIssues.add(x.number);
    const t=time(x.created_at,now);
    if(t<cutoff){old++;continue;}
    if(x.state!=='open'||x.pull_request||![OWNER,BOT].includes(x.user?.login))continue;
    if(!['agent-handoff','handoff-agent-pending'].every(k=>labels(x.labels).includes(k))||
      labels(x.labels).includes('handoff-duplicate'))continue;
    const last=time(x.updated_at,now);
    if(last!==null&&hours(last,now)>=24){
      issuesDue++;
      observations.push(entry('HANDOFF_AGE_REVIEW',x.number,t,issueUrl(x.number),
        'Updated 24h+ ago; receipt/owner status not independently verified'));
    }
  }
  for(const p of pulls){
    if(!goodId(p?.number)||seenPrs.has(p.number)||time(p.created_at,now)===null){invalid.pulls++;continue;}
    seenPrs.add(p.number);
    const t=time(p.created_at,now);
    if(t<cutoff){old++;continue;}
    if(p.state!=='open'||p.draft||p.user?.login!==OWNER)continue;
    const last=time(p.updated_at,now);
    if(last!==null&&hours(last,now)>=24&&labels(p.labels).includes('agent-handoff-ci')){
      prsDue++;
      observations.push(entry('PR_EVIDENCE_REVIEW',p.number,t,
        'https://github.com/'+CONTROL_REPO+'/pull/'+p.number,
        'Labeled handoff PR unchanged 24h+; not an approval failure'));
    }
  }
  const accepted=['agent-handoff-queue-board.yml','agent-handoff-proactive-diagnostics.yml',
    'agent-handoff-deep-diagnostics.yml'];
  const workflowStatus=[];
  for(let i=0;i<3;i++){
    const w=workflows[i];
    if(w?.file!==accepted[i]||typeof w.state!=='string')stop('WORKFLOW_IDENTITY');
    workflowStatus.push({file:w.file,state:w.state});
  }
  observations.sort((a,b)=>b.at-a.at||b.id-a.id);
  // A large number of possibly intentional PR/CI cancellations must not
  // hide the actual pending handoff/approval/delay IDs from a 25-row report.
  // Reserve up to four rows for actionable reviews, then fill the remainder
  // with newest observations. The final list is still newest-first.
  const actionable=new Set(['HANDOFF_AGE_REVIEW','PR_EVIDENCE_REVIEW',
    'ACTION_REQUIRED_REVIEW','RUN_DELAY_REVIEW']);
  const reserved=observations.filter(x=>actionable.has(x.kind)).slice(0,4);
  const reservedSet=new Set(reserved);
  const findings=[...reserved,...observations.filter(x=>!reservedSet.has(x))
    .slice(0,WIDE_POLICY.maxFindings-reserved.length)]
    .sort((a,b)=>b.at-a.at||b.id-a.id);
  return Object.freeze({
    version:WIDE_POLICY.version,cutoff:new Date(cutoff).toISOString(),
    inventory:{runs:runs.length,issues:issues.length,pulls:pulls.length,invalid,
      complete:{runs:complete.runs===true&&invalid.runs===0,issues:complete.issues===true&&invalid.issues===0,pulls:complete.pulls===true&&invalid.pulls===0},
      oldExcluded:old,statusCoverage:coverage.map(x=>({status:x.status,count:x.count,complete:x.complete===true}))},
    counts:{failedHandledByR1:failed,delayedRuns:stale,cancelled,actionRequired,
      pendingHandoffs:issuesDue,waitingPRs:prsDue},
    schedule:{observedRuns:scheduleRunCount,workflows:workflowStatus},
    findings,omittedFindings:Math.max(0,observations.length-findings.length),
    hasActionableReview:observations.length>0||workflowStatus.some(w=>w.state.startsWith('disabled'))||
      !complete.runs||!complete.issues||!complete.pulls||Object.values(invalid).some(n=>n>0),
    pcOperationalWrites:0,aiCalls:0,codeEdits:0
  });
}
const fingerprintData=report=>JSON.stringify([report.cutoff.slice(0,10),
  report.counts,report.findings.map(x=>[x.kind,x.id]),report.schedule.workflows,
  report.inventory.complete,report.inventory.invalid,report.inventory.statusCoverage]);
export function snapshotMarker(report){
  if(report?.version!==WIDE_POLICY.version)stop('REPORT_SCHEMA');
  return '<!-- ZGMINI_WIDE_SCOUT_R3 digest:'+
    createHash('sha256').update(fingerprintData(report)).digest('hex')+' -->';
}
const rx=/^<!-- ZGMINI_WIDE_SCOUT_R3 digest:([a-f0-9]{64}) -->$/m;
export function reportDecision(comments,report,now){
  validateArray(comments,WIDE_POLICY.maxComments,'LEDGER');
  const expected=snapshotMarker(report);
  let last=null,found=false;
  for(const c of comments){
    const match=typeof c?.body==='string'?c.body.match(rx):null;
    if(!match)continue;
    if(c.user?.login!==BOT||!goodId(c.id)||time(c.created_at,now)===null)
      stop('LEDGER_AUTHOR_CONFLICT');
    const t=time(c.created_at,now);
    if(last===null||t>last)last=t;
    if(match[0]===expected)found=true;
  }
  if(found)return 'DUPLICATE';
  if(last!==null&&now-last<WIDE_POLICY.minReportHours*3600000)return 'RATE_LIMIT';
  if(!report.hasActionableReview)return 'NO_FINDINGS';
  // This is a bounded cross-shard read window, not a per-shard write capacity.
  // Full shards rotate in scoutWide; do not globally block the next shard.
  return 'REPORT';
}
export function renderWideReport(report){
  if(report?.version!==WIDE_POLICY.version)stop('RENDER_SCHEMA');
  const rows=[
    snapshotMarker(report),
    '**ZGMINI 능동 탐색 R3 — GitHub 감시 범위 확대 (참고용)**',
    '', '- 기준: 최근 7일, 최신 기록 우선',
    '- 소스: '+CONTROL_REPO+' GitHub Actions · Issue · PR · Workflow 상태',
    '- 범위 완전성: Actions '+report.inventory.complete.runs+
      ' / Issue '+report.inventory.complete.issues+' / PR '+report.inventory.complete.pulls,
    '- 관측 건수: 실행 '+report.inventory.runs+' / Issue '+report.inventory.issues+
      ' / PR '+report.inventory.pulls,
    '- 7일 초과 제외: '+report.inventory.oldExcluded,
    '- 개별 자료 오류(나머지 계속 평가): '+JSON.stringify(report.inventory.invalid),
    '- 판정: '+(Object.values(report.inventory.complete).every(Boolean)?'OBSERVED':'INCOMPLETE_EVIDENCE'),
    '- 상태별 검색: '+(report.inventory.statusCoverage.length?report.inventory.statusCoverage.map(x=>x.status+'='+x.count+(x.complete?'':'(미완전)')).join(', '):'미제공'),
    '- 실패 및 시간 초과: '+report.counts.failedHandledByR1+' (개별 진단은 R1 담당)',
    '- 장시간 대기·실행 중: '+report.counts.delayedRuns,
    '- 취소된 실행: '+report.counts.cancelled,
    '- 승인·조치 필요 표시: '+report.counts.actionRequired,
    '- 미처리 핸드오프 검토 후보: '+report.counts.pendingHandoffs,
    '- PR 검토 지연 후보: '+report.counts.waitingPRs,
    '- schedule 관측 실행 수: '+report.schedule.observedRuns+' (0도 미작동 확정 아님)',
    '',
    '**Workflow 상태 (GitHub API 기반)**',
    ...report.schedule.workflows.map(x=>'- '+x.file+': '+x.state),
    '',
    '**최근 관찰 목록 (장애 확정 아님)**',
    ...report.findings.map(x=>'- '+x.kind+' [#'+x.id+']('+x.link+'): '+x.meaning),
    ...(report.omittedFindings?['- 표시 상한 초과 '+report.omittedFindings+'건 (원자료를 별도 조회)']:[]),
    '',
    '위 항목은 조사 후보이며 운영 PC 장애의 실제 존재/원인을 증명하지 않습니다.',
    '운영 PC·Controller·Writer·SQLite·D1 작업 실행 0 / 코드 수정 0 / AI 호출 0'
  ];
  return rows.join('\n');
}
