// Pure admission contract for a separate, explicitly approved ER1 B one-shot.
// This file NEVER downloads, executes, or edits operational files.
import {createHash} from 'node:crypto';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const ACTOR='ansqhd5774-Choi';
export const ER1_SOURCE_SHA='e2179295e456a3963e09d82ae282e4ba6848352c';
export const ISSUE_LABEL='pc-er1-approved';
export const ISSUE_TITLE='pc-er1-approved-one-shot';
export const OPERATION='er1-saved-score-and-d1-publish-once';
export const GLOBAL_RESERVATION_PATH='results/er1-b-global-once.json';
export const REQUEST_SCHEMA='ZGMINI_ER1_PC_B_JOB_V1';
export const APPROVAL_SCHEMA='ER1_PC_OPERATION_APPROVAL_V1';
export const UUID_RE='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const SOURCE_FILES=Object.freeze([
 'lib/market-calendar-er1-earnings-score.mjs',
 'lib/market-calendar-er1-public-display.mjs',
 'scripts/pc-writer/market-calendar-er1-saved-score.mjs',
 'tools/market-calendar-er1/ER1_PC_MANUAL_PUBLISH.mjs',
 'tools/market-calendar-er1/ER1_PC_OPERATION_ONCE.mjs',
]);

const REQUEST_KEYS=Object.freeze([
 'schema','requestId','chatId','operation','controlRepository',
 'candidateSourceSha','approvalManifestSha256',
]);
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const REQUEST_RE=new RegExp(`^pc-er1-${UUID_RE}$`);
const CHAT_RE=new RegExp(`^chat-${UUID_RE}$`);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const fail=code=>{throw Object.assign(new Error(code),{code})};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value,expected)=>record(value)&&
 Object.keys(value).length===expected.length&&
 expected.every(key=>Object.hasOwn(value,key));

export function validateIssue(event,env){
 if(env?.GITHUB_REPOSITORY!==CONTROL_REPO||env?.GITHUB_ACTOR!==ACTOR||
   env?.GITHUB_EVENT_NAME!=='issues'||env?.GITHUB_EVENT_ACTION!=='opened'||
   !/^zgmini-pc-0[1-6]$/.test(env?.RUNNER_NAME??''))fail('ER1_B_TRUSTED_RUNNER_EVENT_REQUIRED');
 if(event?.repository?.private!==true||event?.repository?.full_name!==CONTROL_REPO||
   event?.action!=='opened'||event?.sender?.login!==ACTOR||
   event?.issue?.user?.login!==ACTOR||
   event?.issue?.title!==ISSUE_TITLE||event?.issue?.pull_request||
   !Number.isSafeInteger(event?.issue?.number)||event.issue.number<1||
   !event.issue.labels?.some(x=>x?.name===ISSUE_LABEL))
  fail('ER1_B_ISSUE_AUTHORIZATION_STOP');
 const body=event.issue.body;
 if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>4096)
  fail('ER1_B_REQUEST_SIZE_STOP');
 let request;
 try{request=JSON.parse(body)}catch{fail('ER1_B_REQUEST_JSON_STOP')}
 if(!exactKeys(request,REQUEST_KEYS)||request.schema!==REQUEST_SCHEMA||
  !REQUEST_RE.test(request.requestId)||!CHAT_RE.test(request.chatId)||
  request.operation!==OPERATION||request.controlRepository!==CONTROL_REPO||
  request.candidateSourceSha!==ER1_SOURCE_SHA||!SHA64.test(request.approvalManifestSha256))
  fail('ER1_B_REQUEST_SCHEMA_STOP');
 return request;
}

export function validateApprovalBytes(raw,request){
 if(!Buffer.isBuffer(raw)||raw.length<100||raw.length>16384)
  fail('ER1_B_MANIFEST_SIZE_STOP');
 if(sha256(raw)!==request.approvalManifestSha256)
  fail('ER1_B_APPROVAL_HASH_STOP');
 let manifest;
 try{manifest=JSON.parse(raw.toString('utf8'))}catch{fail('ER1_B_APPROVAL_JSON_STOP')}
 if(!record(manifest)||manifest.schema!==APPROVAL_SCHEMA||
  manifest.status!=='APPROVED_B'||
  manifest.approvedScope!=='ER1_SAVED_SCORE_AND_D1_ONE_SHOT'||
  manifest.candidateSourceSha!==ER1_SOURCE_SHA||
  !SHA40.test(manifest.pcOperationalSourceSha)||
  !SHA64.test(manifest.pcD1Sha256)||
  manifest.pcHome!==String.raw`E:\ZGmini\data\pc-writer`||
  manifest.dataRoot!==String.raw`E:\ZGmini\data`||
  manifest.probeUrl!==
   'https://zgmini.kr/api/earnings-calendar-display?start=2026-11-02&end=2026-11-02'||
  manifest.readerHeader!=='ZGMINI-ER1-97'||
  manifest.allowProviderRequests!==false||
  manifest.allowCoreChanges!==false||
  manifest.allowSchemaChanges!==false||manifest.runCount!==1||
  manifest.controlLedgerPath!==GLOBAL_RESERVATION_PATH||
  manifest.allowControlLedgerWrite!==true||
  !exactKeys(manifest.sourceSha256,SOURCE_FILES)||
  !SOURCE_FILES.every(p=>SHA64.test(manifest.sourceSha256[p])))
  fail('ER1_B_APPROVAL_SCOPE_STOP');
 return manifest;
}

export function validateBundleHashes({manifest,readFile,root,pathJoin}){
 for(const relative of SOURCE_FILES){
  const full=pathJoin(root,...relative.split('/'));
  let bytes;
  try{bytes=readFile(full)}catch{fail('ER1_B_PACKAGE_FILE_MISSING_STOP')}
  if(sha256(bytes)!==manifest.sourceSha256[relative])
   fail('ER1_B_PACKAGE_SOURCE_DRIFT_STOP');
 }
 return true;
}

export function safeCandidateResult(raw,exitCode){
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>4096)
  return {status:'STATE_UNKNOWN',code:'ER1_B_CANDIDATE_REPORT_INVALID'};
 const fields=Object.fromEntries(raw.trim().split(/\r?\n/).map(line=>{
  const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];
 }).filter(x=>x[0]&&x[1]));
 if(exitCode===0&&fields.STATUS==='PASS'&&
  ['ER1_D1_PUBLISHED_AND_READBACK','ER1_ALREADY_PUBLISHED'].includes(fields.CODE)&&
  ((fields.CODE==='ER1_D1_PUBLISHED_AND_READBACK'&&fields.D1_WRITES==='1')||
   (fields.CODE==='ER1_ALREADY_PUBLISHED'&&fields.D1_WRITES==='0'))&&
  fields.PROVIDER_REQUESTS==='0'&&fields.RAW_EARNINGS_EXPORTED==='NO')
  return {status:'PASS',code:fields.CODE,d1Writes:Number(fields.D1_WRITES)};
 if(exitCode!==0&&fields.STATUS==='BLOCKED'&&
  /^ER1_[A-Z0-9_]+$/.test(fields.CODE??'')&&fields.D1_WRITES==='0')
  return {status:'BLOCKED',code:fields.CODE,d1Writes:0};
 return {status:'STATE_UNKNOWN',code:'ER1_B_EXECUTION_UNVERIFIED'};
}
