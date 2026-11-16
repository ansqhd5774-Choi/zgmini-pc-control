// R2 bounded evidence assessment for already routed GitHub handoff issues.
// Never executes user supplied code, shell commands, or PC jobs.
import {parseHandoff,fingerprintHandoff} from './contract.mjs';
import {assessIncident,HANDOFF_REPOSITORY,HANDOFF_OWNER,HANDOFF_BOT} from './queue-selector.mjs';

export const DEEP_POLICY=Object.freeze({
  version:'ZGMINI_HANDOFF_DEEP_DIAG_R2',
  ledgerIssueNumber:1743,lookbackDays:7,maxIssues:100,
  maxNewReports:3,maxComments:400,maxSourceFiles:3,maxHistory:50,
  schedule:'12,27,42,57 * * * *'
});
const fail=x=>{throw Error('HANDOFF_DEEP_'+x);};
const positive=x=>Number.isSafeInteger(x)&&x>0;
const utc=(s,now)=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s)&&
  Number.isFinite(Date.parse(s))&&Date.parse(s)<=now+60000&&Date.parse(s)>=Date.UTC(2020,0,1)
  ?Date.parse(s):null;
const markerPattern=/^<!-- ZGMINI_HANDOFF_DEEP_DIAG_R2 issue:(\d+) fingerprint:([a-f0-9]{64}) -->$/m;
const allowSource=x=>x==='SAME_BLOB'||x==='CHANGED_BLOB'||x==='UNAVAILABLE';

export function selectRecentHandoffs(issues,now){
  if(!Array.isArray(issues)||issues.length>DEEP_POLICY.maxIssues||!Number.isFinite(now))fail('INVENTORY_STOP');
  const cutoff=now-DEEP_POLICY.lookbackDays*86400000;
  const ids=new Set(),selected=[];
  for(const issue of issues){
    if(!positive(issue?.number)||ids.has(issue.number))fail('ISSUE_ID_STOP');
    ids.add(issue.number);
    const t=utc(issue.created_at,now);
    if(t===null)fail('ISSUE_CLOCK_STOP');
    if(issue.state!=='open'||issue.pull_request)continue;
    if(!Array.isArray(issue.labels)||!['agent-handoff','handoff-agent-pending']
      .every(x=>issue.labels.some(y=>y?.name===x)))continue;
    if(t>=cutoff)selected.push({...issue,_createdMs:t});
  }
  selected.sort((a,b)=>b._createdMs-a._createdMs||b.number-a.number);
  return {cutoff:new Date(cutoff).toISOString(),selected};
}
export function verifyHandoff(issue,comments){
  if(!issue||!positive(issue.number)||!Array.isArray(comments)||comments.length>DEEP_POLICY.maxComments)
    fail('ISSUE_OR_COMMENT_STOP');
  const checked=assessIncident({...issue,repository:HANDOFF_REPOSITORY},comments);
  if(checked.state!=='ALREADY_SELECTED')fail('HANDOFF_RECEIPT_'+checked.state);
  const request=parseHandoff(issue.body);
  if(issue.user?.login!==HANDOFF_OWNER&&issue.user?.login!==HANDOFF_BOT)fail('ISSUE_AUTHOR_STOP');
  return request;
}
export function reportMarker(issue,request){
  if(!positive(issue?.number))fail('MARKER_ISSUE_STOP');
  return '<!-- ZGMINI_HANDOFF_DEEP_DIAG_R2 issue:'+issue.number+
    ' fingerprint:'+fingerprintHandoff(request)+' -->';
}
export function alreadyReported(comments,issue,request){
  if(!Array.isArray(comments)||comments.length>DEEP_POLICY.maxComments)fail('LEDGER_INCOMPLETE');
  const expected=reportMarker(issue,request);
  let count=0;
  for(const c of comments){
    const match=typeof c?.body==='string'?c.body.match(markerPattern):null;
    if(!match||match[0]!==expected)continue;
    if(c.user?.login!==HANDOFF_BOT||!positive(c.id)||utc(c.created_at,Date.now())===null)
      fail('LEDGER_MARKER_AUTHOR_STOP');
    count++;
  }
  if(count>1)fail('LEDGER_DUPLICATE_STOP');
  return count===1;
}
export function sourceAssessment(request,files,headSha){
  if(!/^[a-f0-9]{40}$/.test(headSha||'')||!Array.isArray(files))fail('SOURCE_PROOF_STOP');
  const expected=request.failure.fileRefs.slice(0,DEEP_POLICY.maxSourceFiles);
  if(files.length!==expected.length||files.some((f,i)=>f?.path!==expected[i]||
    !allowSource(f.status)))fail('SOURCE_RESULT_CONTRACT_STOP');
  return {comparedTo:headSha,states:files,omitted:request.failure.fileRefs.length-expected.length};
}
const codeHints=Object.freeze({
  WRITER_B_PC_PREIMAGE_STOP:['설치 전 원본(preimage) 불일치 또는 검사 중단 후보',
    '실제 PC 원본 SHA·승인 manifest·잠금 상태를 원담당의 읽기 전용 진단과 대조'],
  WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP:['Writer import 의존성 누락 후보',
    '정확한 설치 HEAD·모듈 참조·격리 회귀 fixture를 비교'],
  BACKLOG_OR_RECOVERY_NOT_VERIFIED:['Controller 복구 상태 미검증',
    '현재 Controller 소스와 복구 증거를 별도 A급 진단으로 대조']
});
export function simulateOptions(request,source,originVerified){
  const hasUnavailable=source.states.some(x=>x.status==='UNAVAILABLE')||source.omitted>0;
  const unknown=!originVerified||hasUnavailable;
  // This is a deterministic decision-table simulation, never a runtime replay.
  return Object.freeze([
    {case:'원본 증거 없이 동일 작업 재시도',result:'BLOCK',reason:'재실행은 진단 PC 권한 밖'},
    {case:'소스 비교·원본 영수증 기반 정적 검토',
      result:unknown?'INSUFFICIENT_EVIDENCE':'REVIEWABLE',
      reason:unknown?'원본/소스 증거가 일부 미확인':'정적 검토는 가능하나 수정 성공 미증명'},
    {case:'수정 후보를 격리 fixture 테스트로 검증',
      result:'OWNER_ACTION_REQUIRED',reason:'정확한 패치와 독립 테스트 없이는 실제 성공률을 수치화할 수 없음'},
    {case:'Controller·Writer 운영 설치',result:'NOT_AUTHORIZED',
      reason:'원담당의 별도 승인 및 현장 검증 필요'}
  ]);
}
export function analyzeRecentHistory(runs,request,now){
  if(runs===null)return {availability:'UNAVAILABLE',success:0,failed:0,latestSuccess:null};
  if(!Array.isArray(runs)||runs.length>DEEP_POLICY.maxHistory)fail('HISTORY_INVENTORY_STOP');
  const cutoff=now-DEEP_POLICY.lookbackDays*86400000;
  let success=0,failed=0,latest=null;
  for(const run of runs){
    const t=utc(run?.created_at,now);
    if(t===null||run.head_sha!==request.origin.sourceSha||t<cutoff)continue;
    if(run.status!=='completed')continue;
    if(run.conclusion==='success'){success++;if(!latest||t>latest.t)latest={id:run.id,t};}
    if(['failure','timed_out'].includes(run.conclusion))failed++;
  }
  return {availability:'PRESENT',success,failed,latestSuccess:latest?.id??null};
}
export function buildDeepReport(issue,request,evidence,now){
  if(!positive(issue?.number)||!Number.isFinite(now)||!evidence?.source||
    !Array.isArray(evidence.originComments)||evidence.originComments.length>DEEP_POLICY.maxComments)
    fail('REPORT_EVIDENCE_STOP');
  const origin=evidence.origin;
  const originVerified=origin?.number===request.origin.issueNumber&&
    ['open','closed'].includes(origin.state)&&
    [HANDOFF_OWNER,HANDOFF_BOT].includes(origin.user?.login)&&
    !origin.pull_request;
  const source=sourceAssessment(request,evidence.source.files,evidence.source.mainSha);
  const history=analyzeRecentHistory(evidence.history,request,now);
  const hints=codeHints[request.failure.code]??[
    '실패 코드만으로 원인을 특정할 수 없음','원본 Run·이전 성공 결과·정확한 HEAD의 실패 조건을 비교'];
  const simulation=simulateOptions(request,source,originVerified);
  const count=source.states.reduce((acc,f)=>(acc[f.status]++,acc),
    {SAME_BLOB:0,CHANGED_BLOB:0,UNAVAILABLE:0});
  const originBotEvidence=evidence.originComments.filter(c=>c?.user?.login===HANDOFF_BOT&&
    typeof c.body==='string'&&/^(HANDOFF_RESULT_RECORDED|HANDOFF_ORIGIN_RESULT_RECORDED|PC_JOB_RESULT)/.test(c.body)).length;
  const status=originVerified?'ORIGIN_METADATA_VERIFIED':'ORIGIN_UNVERIFIED';
  const issueUrl='https://github.com/'+HANDOFF_REPOSITORY+'/issues/';
  return [
    reportMarker(issue,request),
    '**ZGMINI 공통 대기열 — 정밀 증거·조건부 시뮬레이션 R2**','',
    '- 인계 Issue: '+issueUrl+issue.number,
    '- 원본 Issue: https://github.com/'+request.origin.repository+'/issues/'+request.origin.issueNumber,
    '- 접수 시각(UTC): '+issue.created_at,
    '- 조사 시각(UTC): '+new Date(now).toISOString(),
    '- 원본 증거: '+status+' · 원본 댓글 '+evidence.originComments.length+'건 · 봇 결과 형식 후보 '+originBotEvidence+'건 (실행 성공 증명 아님)',
    '- 장애 유형 / 코드: '+request.failure.kind+' / '+request.failure.code,
    '- 체크포인트: '+request.origin.checkpoint,
    '- 정밀 진단 등급: '+(originVerified&&source.states.every(s=>s.status!=='UNAVAILABLE')&&source.omitted===0?
      'STATIC_EVIDENCE_REVIEW':'INSUFFICIENT_EVIDENCE'),
    '',
    '**소스 정적 비교 (내용·비밀정보 미게시)**',
    '- 접수 시점의 고정 소스 SHA: '+request.origin.sourceSha,
    '- 비교 대상 main SHA: '+source.comparedTo,
    '- 소스 파일: 동일 '+count.SAME_BLOB+' / 변경 '+count.CHANGED_BLOB+
      ' / 미확인 '+count.UNAVAILABLE+' / 상한 초과 미검사 '+source.omitted,
    '- 비교는 Git blob 바이트 동일성만 의미하며 실제 운영 PC 파일 검증이 아님',
    '',
    '**과거 7일 관련 실행 비교**',
    '- 동일 SHA의 Actions 실행: 성공 '+history.success+' / 실패·시간초과 '+history.failed+
      ' (조회 상태 '+history.availability+')',
    '- 최근 성공 참고 Run: '+(history.latestSuccess?
      'https://github.com/'+HANDOFF_REPOSITORY+'/actions/runs/'+history.latestSuccess:'없음 또는 미확인'),
    '- 같은 SHA의 다른 Workflow 성공은 이 장애의 해결 증거가 아님',
    '',
    '**원인 후보와 해결 방향 (확정 아님)**',
    '- 원인 후보: '+hints[0],
    '- 원담당 권고: '+hints[1],
    '',
    '**승인·증거 조건별 결정표 시뮬레이션 (PC 실행 없음)**',
    ...simulation.map(s=>'- '+s.case+': '+s.result+' — '+s.reason),
    '',
    '**결과 인계**',
    '- 담당 역할: '+(request.failure.kind==='FEATURE'?'ORIGIN_FUNCTION_OWNER':'COMMON_PROCESS_OWNER'),
    '- 이 진단 댓글은 원담당 참고 자료. 코드 수정·자동 재시도·배포 승인·실제 복구 완료를 뜻하지 않음.',
    '- 운영 PC/SQLite/D1 변경 0 · AI 호출 0 · 원본 수집 재실행 0'
  ].join('\n');
}
