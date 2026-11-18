// Passive GitHub Actions failure triage. Never executes commands from GitHub data.
// Observations are not root-cause proofs and never authorize a PC retry or code change.
export const SCOUT_POLICY=Object.freeze({
  version:'ZGMINI_PROACTIVE_DIAGNOSTICS_R1',
  lookbackDays:7,
  maxNewComments:3,
  maxRunInventory:400,
  maxJobsPerRun:100,
  ledgerIssueNumber:1743,
  schedule:'10,25,40,55 * * * *'
});
const dayMs=24*60*60*1000;
const stop=code=>{throw Error('PROACTIVE_DIAG_'+code);};
const isId=x=>Number.isSafeInteger(x)&&x>0;
const isAttempt=x=>Number.isSafeInteger(x)&&x>=1;
const validTime=(value,nowMs)=>{
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value))return null;
  const n=Date.parse(value);
  return Number.isFinite(n)&&n>=Date.UTC(2020,0,1)&&n<=nowMs+60000?n:null;
};
export function selectRecentFailures(runs,nowMs){
  if(!Array.isArray(runs)||runs.length>SCOUT_POLICY.maxRunInventory||
    !Number.isFinite(nowMs)||nowMs<Date.UTC(2020,0,1))stop('INVENTORY_OR_CLOCK_STOP');
  const cutoff=nowMs-SCOUT_POLICY.lookbackDays*dayMs;
  const keys=new Set();
  const recent=[];
  let excludedOld=0,excludedOther=0;
  for(const run of runs){
    if(!run||!isId(run.id)||!isAttempt(run.run_attempt))stop('RUN_IDENTITY_STOP');
    const key=run.id+':'+run.run_attempt;
    if(keys.has(key))stop('DUPLICATE_RUN_STOP');
    keys.add(key);
    const t=validTime(run.created_at,nowMs);
    if(t===null)stop('RUN_TIMESTAMP_STOP');
    if(t<cutoff){excludedOld++;continue;}
    if(run.status!=='completed'||!['failure','timed_out'].includes(run.conclusion)||
      run.name==='ZGMINI Proactive GitHub Diagnostics'){
      excludedOther++;continue;
    }
    recent.push({...run,_createdMs:t});
  }
  // Newest event ALWAYS first; no severity score may promote a historical run.
  recent.sort((a,b)=>b._createdMs-a._createdMs||b.id-a.id||
    b.run_attempt-a.run_attempt);
  return Object.freeze({
    lookbackDays:SCOUT_POLICY.lookbackDays,
    cutoff:new Date(cutoff).toISOString(),
    recent,excludedOld,excludedOther
  });
}
export function markerFor(run){
  if(!isId(run?.id)||!isAttempt(run?.run_attempt))stop('RUN_MARKER_STOP');
  return '<!-- ZGMINI_PROACTIVE_DIAG_R1 run:'+run.id+
    ' attempt:'+run.run_attempt+' -->';
}
const markerRegex=/^<!-- ZGMINI_PROACTIVE_DIAG_R1 run:(\d+) attempt:(\d+) -->$/m;
export function recordedFor(comments,run){
  if(!Array.isArray(comments)||comments.length>400)stop('COMMENTS_INCOMPLETE');
  const expected=markerFor(run);
  let count=0;
  for(const comment of comments){
    const body=comment?.body;
    if(typeof body!=='string')continue;
    const match=body.match(markerRegex);
    if(!match)continue;
    if(match[0]!==expected)continue;
    if(comment.user?.login!=='github-actions[bot]'||
      !isId(comment.id)||typeof comment.created_at!=='string')
      stop('LEDGER_AUTHOR_CONFLICT');
    count++;
  }
  if(count>1)stop('LEDGER_DUPLICATE_STOP');
  return count===1;
}
export function classifyLogs(text){
  if(typeof text!=='string')return [];
  const tests=[
    ['RATE_LIMIT_HINT',/\b(rate limit|HTTP 429|status 429|too many requests)\b/i],
    ['AUTHORIZATION_HINT',/\b(HTTP 401|HTTP 403|status 401|status 403|access denied|unauthorized)\b/i],
    ['NETWORK_TIMEOUT_HINT',/\b(ETIMEDOUT|ECONNRESET|socket hang up|network timeout)\b/i],
    ['MISSING_FILE_OR_MODULE_HINT',/\b(ENOENT|ERR_MODULE_NOT_FOUND|Cannot find module)\b/i],
    ['ASSERTION_HINT',/\b(AssertionError|not ok \d+|assert\.strictEqual)\b/i],
    ['UPSTREAM_5XX_HINT',/\b(HTTP 50[0-9]|status 50[0-9]|bad gateway|service unavailable)\b/i],
    ['DISK_SPACE_HINT',/\b(ENOSPC|no space left on device)\b/i]
  ];
  return tests.filter(([,r])=>r.test(text.slice(0,131072))).map(([name])=>name).slice(0,3);
}
export function assertSameRun(a,b){
  if(!a||!b||a.id!==b.id||a.run_attempt!==b.run_attempt||
    a.created_at!==b.created_at||a.head_sha!==b.head_sha||
    a.status!=='completed'||b.status!=='completed'||
    a.conclusion!==b.conclusion||
    !['failure','timed_out'].includes(b.conclusion))stop('SOURCE_RUN_DRIFT');
}
const hintAdvice={
  RATE_LIMIT_HINT:'공급자/호스트 요청 제한과 호출 빈도를 확인',
  AUTHORIZATION_HINT:'GitHub 권한 또는 인증 계약을 읽기 전용으로 대조',
  NETWORK_TIMEOUT_HINT:'원본 요청/응답 시간·연결 실패 증거를 비교',
  MISSING_FILE_OR_MODULE_HINT:'정확한 HEAD와 파일/모듈 경로를 대조',
  ASSERTION_HINT:'원본 커밋의 실패 테스트와 기대값을 검토',
  UPSTREAM_5XX_HINT:'외부 공급자 응답 상태와 재현 시각을 확인',
  DISK_SPACE_HINT:'해당 Runner 자원 상태를 별도 승인 경로로 확인'
};
export function buildDiagnosis(run,jobs,logHints,nowMs,options={}){
  if(!isId(run?.id)||!isAttempt(run?.run_attempt)||
    !Array.isArray(jobs)||jobs.length>SCOUT_POLICY.maxJobsPerRun||
    !Number.isFinite(nowMs))stop('DIAG_INPUT_INVALID');
  const failures=jobs.filter(j=>j?.conclusion==='failure'||j?.conclusion==='timed_out');
  for(const job of failures)if(!isId(job.id))stop('JOB_ID_INVALID');
  const ids=failures.slice(0,5).map(j=>'Job '+j.id).join(', ');
  const stepRefs=failures.slice(0,5).map(j=>{
    const steps=(Array.isArray(j.steps)?j.steps:[]).filter(s=>s.conclusion==='failure');
    return 'Job '+j.id+': '+(steps.length?steps.map(s=>'step '+s.number).join(', '):'실패 단계 미확인');
  });
  const hints=[...new Set((logHints||[]).filter(h=>Object.hasOwn(hintAdvice,h)))].slice(0,3);
  const recommendations=hints.length?hints.map(h=>'- '+h+': '+hintAdvice[h]):
    ['- 실패한 Job의 원본 로그 및 HEAD를 담당자가 직접 확인(원인 미확정)'];
  const sha=/^[a-f0-9]{40}$/.test(run.head_sha||'')?run.head_sha:'UNVERIFIED';
  const scope=run.event==='pull_request'?'PR/CI 검증 오류 후보':
    'GitHub Actions 실행 오류 후보(운영 PC 실패 단정 금지)';
  return [
    markerFor(run),
    '**ZGMINI 능동 진단 — 신규 GitHub 실행 실패 관측**',
    '',
    '- 원본 Run: https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/'+run.id,
    '- Run ID / attempt: '+run.id+' / '+run.run_attempt,
    '- 발생 시각(UTC): '+run.created_at,
    '- 관측 시각(UTC): '+new Date(nowMs).toISOString(),
    '- HEAD SHA: '+sha,
    '- 결론: '+run.conclusion+' (GitHub 제공)',
    '- 구분: '+scope,
    '- 실패 Job: '+(ids||'목록 확인 불가'),
    '- 실패 단계 위치: '+(stepRefs.join('; ')||'미확인'),
    '- 로그 신호(원인 확정 아님): '+(hints.join(', ')||'확인된 고정 패턴 없음'),
    '- 로그 접근: '+(options.logsUnavailable?'일부 조회 불가(원인 미확정)':'제한된 신호만 분류, 전문 미게시'),
    '',
    '**후속 검토 권고**',
    ...recommendations,
    '',
    '이 내용은 수정·재실행 지시가 아닌 참고용 읽기 진단입니다. 운영 PC, SQLite, D1 및 수집 작업은 변경하지 않았습니다.'
  ].join('\n');
}
