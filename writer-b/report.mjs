#!/usr/bin/env node
// One-shot, bounded create-only GitHub result recovery for generic Writer B.
// Reporter has token access, but cannot call the Windows installer.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTROL_REPO,ACTOR,ISSUE_LABEL,ISSUE_TITLE,
 REQUEST_SCHEMA,OPERATION} from './contract.mjs';
import {safeWriterBImportDiagnostic,
 safeWriterBImportDiagnosticBatch} from './import-availability.mjs';
import {safeWriterBPreimageCheck,safeWriterBIdleObservation} from './installer.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE=/^WRITER_B_[A-Z0-9_]{1,100}$/;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};

export function readWriterBLocalResult({env,fsOps=fs}){
 let result;
 try{result=fsOps.readFileSync(path.join(env.RUNNER_TEMP??'',
  'writer-b-install-result.json'),'utf8');return result;}catch{}
 // The install step was skipped after a failed approval preflight. A
 // run-specific, bounded diagnostic is safe to forward as a SETUP_STOP only.
 const runId=env?.GITHUB_RUN_ID,runnerTemp=env?.RUNNER_TEMP;
 if(!/^\d{1,18}$/.test(runId??'')||typeof runnerTemp!=='string'||
   !path.isAbsolute(runnerTemp))return '{}';
 try{
  const raw=fsOps.readFileSync(path.join(runnerTemp,
   `writer-b-preflight-stop-${runId}.json`),'utf8');
  if(Buffer.byteLength(raw)>512)return '{}';
  const proof=JSON.parse(raw);
  if(proof.status==='WRITER_B_SETUP_STOP'&&proof.runId===runId&&
    CODE.test(proof.code??''))return raw;
 }catch{}
 return '{}';
}

export function validateWriterBReportEvent(event,env){
 need(env?.GITHUB_REPOSITORY===CONTROL_REPO&&env.GITHUB_ACTOR===ACTOR&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
  /^\d{1,18}$/.test(env.GITHUB_RUN_ID??'')&&
  event?.repository?.full_name===CONTROL_REPO&&event.repository.private===true&&
  event?.sender?.login===ACTOR&&event?.issue?.user?.login===ACTOR&&
  event.issue.title===ISSUE_TITLE&&
  event.issue.labels?.some(x=>x.name===ISSUE_LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&
  !event.issue.pull_request,'WRITER_B_REPORT_EVENT_STOP');
 let request;
 try{request=JSON.parse(event.issue.body);}catch{stop('WRITER_B_REPORT_REQUEST_JSON_STOP');}
 need(request?.schema===REQUEST_SCHEMA&&request.operation===OPERATION&&
  request.controlRepository===CONTROL_REPO&&UUID.test(request.requestId??'')&&
  UUID.test(request.chatId??'')&&SHA64.test(request.approvalManifestSha256??''),
  'WRITER_B_REPORT_REQUEST_STOP');
 return request;
}

export function sanitizeWriterBResult(raw,requestId,runId,approvedManifestSha256){
 const base={schema:'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1',requestId,
  status:'WRITER_B_STATE_UNKNOWN',code:'WRITER_B_RESULT_UNVERIFIED_STOP',
  sourceSha:null,mode:null,localOnly:null,baseHead:null,
  candidateSourceSha:null,manifestSha256:null,baseTreeOid:null,
  preparedTreeOid:null,provenanceSha256:null,
  runId:/^\d{1,18}$/.test(runId??'')?runId:null,
  retry:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return base;
 if(raw.status==='WRITER_B_SETUP_STOP'&&CODE.test(raw.code??''))
  return {...base,status:raw.status,code:raw.code};
 if(raw.requestId!==requestId)return base;
 if(raw.status==='WRITER_B_INSTALLED_VERIFIED'&&SHA40.test(raw.sourceSha??'')&&
  raw.mode==='LOCAL_OVERLAY'&&raw.localOnly===true&&
  SHA40.test(raw.baseHead??'')&&SHA40.test(raw.candidateSourceSha??'')&&
  SHA40.test(raw.baseTreeOid??'')&&SHA40.test(raw.preparedTreeOid??'')&&
  SHA64.test(approvedManifestSha256??'')&&
  raw.manifestSha256===approvedManifestSha256&&
  SHA64.test(raw.provenanceSha256??'')&&
  Array.isArray(raw.changedPaths)&&raw.changedPaths.length>0&&
  raw.changedPaths.length<=32&&raw.changedPaths.every(x=>
   typeof x==='string'&&/^(?:scripts\/pc-writer|lib|worker)\//.test(x)))
  return {...base,status:raw.status,code:'WRITER_B_INSTALL_VERIFIED',
   sourceSha:raw.sourceSha,changedPaths:raw.changedPaths,
   mode:'LOCAL_OVERLAY',localOnly:true,baseHead:raw.baseHead,
   candidateSourceSha:raw.candidateSourceSha,
   manifestSha256:raw.manifestSha256,baseTreeOid:raw.baseTreeOid,
   preparedTreeOid:raw.preparedTreeOid,provenanceSha256:raw.provenanceSha256};
  if(['WRITER_B_PREFLIGHT_STOP','WRITER_B_INSTALL_STOP_RESTORED',
   'WRITER_B_RECOVERY_REQUIRED'].includes(raw.status)&&CODE.test(raw.code??'')){
   // A post-claim STOP is safe to report as restored only if the installer
   // verified the original task/config/source. Otherwise keep it UNKNOWN.
   if(raw.status==='WRITER_B_INSTALL_STOP_RESTORED'&&
     raw.recovery!=='ORIGINAL_VERIFIED')return base;
   if(raw.status==='WRITER_B_RECOVERY_REQUIRED'&&
     !['RECONCILE_EXACT_REQUEST_NO_RETRY',
       'READ_ONLY_RECONCILE_LOCK_AND_SOURCE'].includes(raw.recovery))
     return {...base,status:'WRITER_B_RECOVERY_REQUIRED',code:raw.code,
       recovery:'RECONCILE_EXACT_REQUEST_NO_RETRY'};
  const diagnostic=raw.status==='WRITER_B_PREFLIGHT_STOP'?
   safeWriterBImportDiagnostic(raw):null;
   const batch=raw.status==='WRITER_B_PREFLIGHT_STOP'?
    safeWriterBImportDiagnosticBatch(raw):null;
  const preimageCheck=raw.status==='WRITER_B_PREFLIGHT_STOP'?
   safeWriterBPreimageCheck(raw):null;
  const idleObservation=safeWriterBIdleObservation(raw);
  return {...base,status:raw.status,code:raw.code,
    ...(diagnostic?{diagnostic}:{}),...(batch??{}),
    ...(preimageCheck?{preimageCheck}:{}),
    ...(idleObservation?{idleObservation}:{}),
    ...(raw.status==='WRITER_B_INSTALL_STOP_RESTORED'?
     {recovery:'ORIGINAL_VERIFIED'}:{}),
    ...(raw.status==='WRITER_B_RECOVERY_REQUIRED'?
     {recovery:raw.recovery}:{})};
 }
 return base;
}

function textResult(result){return [
 `REQUEST_ID=${result.requestId}`,`STATUS=${result.status}`,
 `CODE=${result.code}`,`SOURCE_SHA=${result.sourceSha??'NONE'}`,
 ...(result.preimageCheck?[`PREIMAGE_CHECK=${result.preimageCheck}`]:[]),
 ...(result.idleObservation?[
  `IDLE_WINDOW_MS=${result.idleObservation.windowMs}`,
  `IDLE_SAMPLES=${result.idleObservation.samples}`,
  `IDLE_READY_SAMPLES=${result.idleObservation.readySamples}`,
  `IDLE_ACTIVE_SAMPLES=${result.idleObservation.activeSamples}`,
  `IDLE_OTHER_SAMPLES=${result.idleObservation.otherSamples}`,
  `IDLE_MAX_READY_STREAK=${result.idleObservation.maxReadyStreak}`,
  ...(result.idleObservation.lastBlocker?[
   `IDLE_LAST_TASK_ENABLED=${result.idleObservation.lastBlocker.enabled}`,
   `IDLE_LAST_TASK_STATE=${result.idleObservation.lastBlocker.state}`,
   `IDLE_LAST_TASK_INSTANCES=${result.idleObservation.lastBlocker.instances}`,
   `IDLE_LAST_RELATED_PROCESSES=${result.idleObservation.lastBlocker.relatedProcesses}`,
   `IDLE_LAST_UNKNOWN_PROCESSES=${result.idleObservation.lastBlocker.unknownProcessLines}`,
   `IDLE_LAST_CORE_LOCK=${result.idleObservation.lastBlocker.cycleLockPresent}`,
  ]:[]),
 ]:[]),
 ...(result.diagnostic?[
  `IMPORT_SOURCE_KIND=${result.diagnostic.sourceKind}`,
  `IMPORT_SOURCE_PATH=${result.diagnostic.sourcePath}`,
  `IMPORT_DEPENDENCY_PATH=${result.diagnostic.dependencyPath}`,
  `IMPORT_REASON=${result.diagnostic.reason}`,
 ]:[]),
  ...(result.diagnostics?[
   `IMPORT_DIAGNOSTICS_RECORDED=${result.diagnostics.length}`,
   `IMPORT_DIAGNOSTICS_OMITTED=${result.diagnosticsOmitted}`,
   ...result.diagnostics.flatMap((d,i)=>[
    `IMPORT_${i+1}_SOURCE_PATH=${d.sourcePath}`,
    `IMPORT_${i+1}_DEPENDENCY_PATH=${d.dependencyPath}`,
    `IMPORT_${i+1}_REASON=${d.reason}`,
   ]),
  ]:[]),
 `SOURCE_MODE=${result.mode??'UNKNOWN'}`,
 `LOCAL_ONLY=${result.localOnly===true?'true':'UNKNOWN'}`,
 `BASE_HEAD=${result.baseHead??'NONE'}`,
 `CANDIDATE_SOURCE_SHA=${result.candidateSourceSha??'NONE'}`,
 `MANIFEST_SHA256=${result.manifestSha256??'NONE'}`,
 `BASE_TREE_OID=${result.baseTreeOid??'NONE'}`,
 `PREPARED_TREE_OID=${result.preparedTreeOid??'NONE'}`,
 `PROVENANCE_SHA256=${result.provenanceSha256??'NONE'}`,
  `RECOVERY=${result.recovery??'NONE'}`,
 `RUN_ID=${result.runId??'UNKNOWN'}`,
 'RETRY=READ_ONLY_RECONCILE_NO_REEXECUTE','',
].join('\n');}

async function readback(apiFetch,url,headers,expected){
 try{
  const response=await apiFetch(url+'?ref=main',{method:'GET',headers});
  if(response.status!==200)return false;
  const json=await response.json();
  return json?.encoding==='base64'&&typeof json.content==='string'&&
   Buffer.from(json.content.replace(/\s/g,''),'base64').equals(Buffer.from(expected));
 }catch{return false;}
}

function reportHeaders(env){return {
 accept:'application/vnd.github+json',
 authorization:'Bearer '+env.GITHUB_TOKEN,
 'x-github-api-version':'2022-11-28','content-type':'application/json',
 'user-agent':'zgmini-writer-b-source-once'};}

async function reportRejectedRequest({event,env,rawResult,apiFetch}){
 // The trusted Issue origin was already checked by the strict validator.
 // Only the run-local preflight contract STOP may receive this receipt.
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'WRITER_B_REPORT_TOKEN_STOP');
 let proof;
 try{proof=typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=512?
  JSON.parse(rawResult):null;}catch{proof=null;}
 need(proof?.status==='WRITER_B_SETUP_STOP'&&
  proof.code==='WRITER_B_REQUEST_CONTRACT_STOP'&&
  proof.runId===env.GITHUB_RUN_ID,'WRITER_B_REPORT_REJECTION_PROOF_STOP');
 // Never reflect the invalid request body, source paths or token into GitHub.
 // No result pair is fabricated when the request never passed admission.
 const comment=`<!-- zgmini-writer-b-request-rejected:${env.GITHUB_RUN_ID} -->\n`+
  'Writer B request: **REJECTED_BEFORE_PC** (WRITER_B_REQUEST_CONTRACT_STOP)\n'+
  'PC_INSTALL: NOT_EXECUTED; RESULT_PAIR: NOT_CREATED_INVALID_REQUEST\n'+
  `RUN_ID: ${env.GITHUB_RUN_ID}; RETRY: NO_REEXECUTE\n`;
 const response=await apiFetch(
  `https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,
  {method:'POST',headers:reportHeaders(env),body:JSON.stringify({body:comment})});
 need(response.status===201,'WRITER_B_REPORT_COMMENT_STOP');
 return {status:'WRITER_B_SETUP_STOP',code:'WRITER_B_REQUEST_CONTRACT_STOP',
  deliveryStatus:'REQUEST_REJECTED_BEFORE_PC',created:0,verified:0};
}

// Presentation only: consume the already sanitized result, never raw exception text.
// Existing receipt lines and JSON/TXT bytes remain the machine-readable authority.
export function writerBCommentSummary(result,verified){
 const out=['','### 작업 결과와 다음 행동',''];
 if(verified!==2)return out.concat([
  '- 완료 범위: 원격 결과 파일 확인 미완료. 설치 성공·실패를 확정하지 않습니다.',
  '- 다음 행동: 기존 요청의 로컬 결과와 원격 JSON/TXT를 대조합니다. 설치를 다시 실행하지 않습니다.'
 ]).join('\n');
 const installed=result.status==='WRITER_B_INSTALLED_VERIFIED';
 const restored=result.status==='WRITER_B_INSTALL_STOP_RESTORED';
 const recovery=result.status==='WRITER_B_RECOVERY_REQUIRED';
 const preflight=result.status==='WRITER_B_PREFLIGHT_STOP';
 out.push('- 완료 범위: '+(installed?'Writer 파일 설치와 설치기 사후 검증 완료. 실제 계산·D1 게시·API/화면 완료는 별도입니다.':
  restored?'설치 중단 후 원본 복구 확인. 요청한 설치는 미완료입니다.':
  recovery?'복구 상태 확인 필요. 설치·원본 복구 완료로 판정하지 않습니다.':
  preflight?'설치 전 검사에서 중단. 요청한 설치는 미완료입니다.':'실행 결과 미확정.'));
 const gate=safeWriterBPreimageCheck(result);
 if(gate)out.push('- 최초 차단 조건: `'+gate+'` (기존 원본 비교 검사).');
 const diagnostic=safeWriterBImportDiagnostic(result);
 if(diagnostic)out.push('- 확인된 의존성: `'+diagnostic.sourcePath+'` → `'+diagnostic.dependencyPath+'` / `'+diagnostic.reason+'`.');
 const idle=safeWriterBIdleObservation(result);
 if(idle)out.push('- 유휴 관측: '+idle.samples+'회 중 실행 중 '+idle.activeSamples+'회, 준비 '+idle.readySamples+'회, 미확인 '+idle.otherSamples+'회.');
 let next=installed?'기존 기능 담당자가 설치된 경로에서 원래 승인 업무를 실행하고 실제 저장·게시 결과를 확인합니다.':
  recovery||!preflight&&!restored?'현재 요청의 원장·잠금·설치 상태를 먼저 대조합니다. 결과 확인 전 설치 재실행은 하지 않습니다.':
  restored?'복구된 원본을 유지하고 기록된 실패 조건을 수정한 뒤 기존 승인 범위에서 재개합니다.':
  gate==='HEAD'||gate==='CONFIG_SOURCE'?'현재 소스와 승인 명세의 기준 SHA를 대조해 달라진 범위만 정리합니다. 원본을 과거 SHA로 강제 되돌리지 않습니다.':
  gate?'표시된 원본 비교 조건을 현재 승인 명세와 대조해 해당 불일치만 수정합니다.':
  diagnostic?'표시된 누락·읽기 실패 의존성을 승인 파일 구성과 대조하고 연결부만 수정합니다.':
  idle?'현재 실행의 정상 종료와 기존 유지보수 진입 경로를 확인합니다. 같은 유휴 대기를 반복하거나 Core를 강제 종료하지 않습니다.':
  '연결된 기존 결과 파일의 실패 코드를 확인하고 해당 조건만 수정합니다. 근거 없이 같은 설치를 반복하지 않습니다.';
 out.push('- 다음 행동: '+next);
 if(gate)out.push('- 증거 한계: 이 결과에는 기대값·실측값 상세가 포함되지 않습니다. 오류명만으로 실패 파일이나 실제 SHA를 추정하지 않습니다.');
 return out.join('\n');
}

export async function uploadWriterBReport({event,env,rawResult,apiFetch=fetch}){
 let req;
 try{req=validateWriterBReportEvent(event,env);}catch(error){
  if(error?.code!=='WRITER_B_REPORT_REQUEST_STOP')throw error;
  return reportRejectedRequest({event,env,rawResult,apiFetch});
 }
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'WRITER_B_REPORT_TOKEN_STOP');
 let parsed;
 try{parsed=typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=8192?
  JSON.parse(rawResult):null;}catch{parsed=null;}
 const result=sanitizeWriterBResult(parsed,req.requestId,env.GITHUB_RUN_ID,
  req.approvalManifestSha256);
 const json=JSON.stringify(result,null,2)+'\n';
 const txt=textResult(result);
  const headers=reportHeaders(env);
 let created=0,verified=0;
 for(const [ext,content] of [['json',json],['txt',txt]]){
  const url=`https://api.github.com/repos/${CONTROL_REPO}/contents/`+
    `results/writer-b-source-install-${req.requestId}.${ext}`;
  try{
   const response=await apiFetch(url,{method:'PUT',headers,
    body:JSON.stringify({message:'chore(writer-b): record exact one-shot result',
     content:Buffer.from(content).toString('base64')})});
   if(response.status===201)created++;
  }catch{/* Ambiguous PUT must never automatically retry. */}
  if(await readback(apiFetch,url,headers,content))verified++;
 }
 // The Windows installer may have succeeded locally, but a partial/unknown
 // remote evidence pair is NOT a verified GitHub installation record.
 // Never misreport delivery failure as installer rollback or auto-retry.
 const deliveryStatus=verified===2?'RESULT_PAIR_READBACK_VERIFIED':
  'RESULT_DELIVERY_UNVERIFIED';
 const publicStatus=verified===2?result.status:'WRITER_B_STATE_UNKNOWN';
 const publicCode=verified===2?result.code:'WRITER_B_RESULT_PAIR_READBACK_STOP';
 const comment=`<!-- zgmini-writer-b-install:${req.requestId} -->\n`+
  `Writer B evidence: **${publicStatus}** (${publicCode})\n`+
  `DELIVERY: ${deliveryStatus}\n`+
  `LOCAL_ONLY: ${verified===2&&result.localOnly===true?'true':'UNKNOWN'}; `+
  `REMOTE_SOURCE: NOT_PUBLISHED_BY_INSTALLER\n`+
  `RESULT_CREATED: ${created}/2; RESULT_READBACK: ${verified}/2\n`+
  `RUN_ID: ${result.runId??'UNKNOWN'}; RETRY: NO_REEXECUTE\n`+
  writerBCommentSummary(result,verified)+'\n\n'+
  `실행: https://github.com/${CONTROL_REPO}/actions/runs/${result.runId}\n`+
  `결과: [JSON](https://github.com/${CONTROL_REPO}/blob/main/results/writer-b-source-install-${req.requestId}.json) · `+
  `[TXT](https://github.com/${CONTROL_REPO}/blob/main/results/writer-b-source-install-${req.requestId}.txt)\n`;
 const reply=await apiFetch(
  `https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,
  {method:'POST',headers,body:JSON.stringify({body:comment})});
 need(reply.status===201,'WRITER_B_REPORT_COMMENT_STOP');
 return {status:result.status,code:result.code,deliveryStatus,created,verified};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const result=readWriterBLocalResult({env});
  const report=await uploadWriterBReport({event,env,rawResult:result});
  process.stdout.write(`WRITER_B_REPORT ${report.deliveryStatus} `+
   `CREATED=${report.created}/2 READBACK=${report.verified}/2\n`);
 }catch{
  process.stderr.write('WRITER_B_REPORT_UNVERIFIED_READ_ONLY_RECONCILE\n');
  process.exitCode=1;
 }
}
