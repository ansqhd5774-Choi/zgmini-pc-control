// Pure, fail-closed scope contract for a proposed independently admitted R10
// PC Writer source B update. THIS FILE IS NOT WIRED TO AN OPERATING RECEIVER.
import {createHash} from 'node:crypto';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const SOURCE_COMMIT='c3683e5d8e2ff4658022064866658dab81222270';
export const ORIGINAL_PC_SOURCE='a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e';
export const PC_REPO=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const PC_HOME=String.raw`E:\ZGmini\data\pc-writer`;
export const RESERVATION_PATH='results/r10-source-b-global-once.json';
export const REQUEST_TITLE='pc-r10-source-approved-once';
export const REQUEST_LABEL='pc-r10-source-b-approved';
export const REQUEST_OPERATION='r10-two-source-files-approved-once';
export const REQUEST_SCHEMA='ZGMINI_R10_SOURCE_B_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_R10_SOURCE_B_APPROVAL_V1';
export const R10_B_FILES=Object.freeze({
 'lib/diagnostic-layer/asset-bubble-r10-raw-evidence-r1.mjs':
  '226579820995d4ab90c36bf0f8d966994ccea481e47d36902c31efc8479e9fae',
 'worker/asset-bubble-r10-raw-r1.mjs':
  'd962a8ac9e4941e02e2155d0c0f4324f1f1d6d3f07122c40e69caebed0d155a7',
});
export const PATHS=Object.freeze(Object.keys(R10_B_FILES));
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQUEST_ID=new RegExp('^pc-r10-source-'+UUID+'$');
const CHAT_ID=new RegExp('^chat-'+UUID+'$');
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exactKeys=(x,keys)=>isObj(x)&&Object.keys(x).length===keys.length&&
 keys.every(key=>Object.hasOwn(x,key));
const hashes=x=>exactKeys(x,PATHS)&&PATHS.every(p=>SHA64.test(x[p]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const stop=code=>{throw Object.assign(Error(code),{code})};

// Request has no paths, commands, free-form source ref or execution parameters.
export function validateR10BRequest(event,{manifestDigest}={}){
 if(event?.repository?.private!==true||event.repository.full_name!==CONTROL_REPO||
  event?.action!=='opened'||event?.sender?.login!=='ansqhd5774-Choi'||
  event?.issue?.user?.login!=='ansqhd5774-Choi'||
  event?.issue?.title!==REQUEST_TITLE||
  !event.issue.labels?.some(label=>label?.name===REQUEST_LABEL)||
  event.issue.pull_request||!Number.isSafeInteger(event.issue.number)||event.issue.number<1)
  stop('R10_B_ISSUE_IDENTITY_STOP');
 if(typeof event.issue.body!=='string'||Buffer.byteLength(event.issue.body)>4096)
  stop('R10_B_REQUEST_SIZE_STOP');
 let r;try{r=JSON.parse(event.issue.body)}catch{stop('R10_B_REQUEST_JSON_STOP')}
 const keys=['schema','requestId','chatId','operation','controlRepository',
  'sourceCommit','targetPcSourceSha','approvalManifestSha256'];
 if(!exactKeys(r,keys)||r.schema!==REQUEST_SCHEMA||
  !REQUEST_ID.test(r.requestId??'')||!CHAT_ID.test(r.chatId??'')||
  r.operation!==REQUEST_OPERATION||r.controlRepository!==CONTROL_REPO||
  r.sourceCommit!==SOURCE_COMMIT||!SHA40.test(r.targetPcSourceSha??'')||
  !SHA64.test(r.approvalManifestSha256??'')||
  (manifestDigest!==undefined&&manifestDigest!==r.approvalManifestSha256))
  stop('R10_B_REQUEST_SCOPE_STOP');
 return r;
}

export function validateR10BManifest(bytes,request){
 if(!Buffer.isBuffer(bytes)||bytes.length<256||bytes.length>16384||
  sha256(bytes)!==request?.approvalManifestSha256)
  stop('R10_B_APPROVAL_DIGEST_STOP');
 let m;try{m=JSON.parse(bytes.toString('utf8'))}
 catch{stop('R10_B_APPROVAL_JSON_STOP')}
 const keys=['schema','status','approvedScope','controlRepository','sourceRepository',
  'candidateSourceCommit','originalPcSourceSha','targetPcSourceSha','pcRepo',
  'pcHome','candidateFilesSha256','originalFilesSha256','originalConfigSha256',
  'rollbackBundleSha256','runtimeProvenanceSha256','runCount',
  'allowSourceFileChanges','allowConfigSourceChange','allowGitVersionChange',
  'allowTaskChanges','allowSchemaChanges','allowProviderCalls',
  'allowSqliteWrites','allowD1Writes','controlReservationPath'];
 if(!exactKeys(m,keys)||m.schema!==APPROVAL_SCHEMA||m.status!=='APPROVED_B'||
  m.approvedScope!=='ASSET_R10_TWO_RUNTIME_SOURCE_FILES_ONLY'||
  m.controlRepository!==CONTROL_REPO||m.sourceRepository!==SOURCE_REPO||
  m.candidateSourceCommit!==SOURCE_COMMIT||m.originalPcSourceSha!==ORIGINAL_PC_SOURCE||
  m.targetPcSourceSha!==request.targetPcSourceSha||
  m.targetPcSourceSha===ORIGINAL_PC_SOURCE||!SHA40.test(m.targetPcSourceSha)||
  m.pcRepo!==PC_REPO||m.pcHome!==PC_HOME||
  !same(m.candidateFilesSha256,R10_B_FILES)||!hashes(m.originalFilesSha256)||
  !SHA64.test(m.originalConfigSha256??'')||
  !SHA64.test(m.rollbackBundleSha256??'')||
  !SHA64.test(m.runtimeProvenanceSha256??'')||m.runCount!==1||
  !same(m.allowSourceFileChanges,PATHS)||m.allowConfigSourceChange!==true||
  m.allowGitVersionChange!==true||m.allowTaskChanges!==false||
  m.allowSchemaChanges!==false||m.allowProviderCalls!==false||
  m.allowSqliteWrites!==false||m.allowD1Writes!==false||
  m.controlReservationPath!==RESERVATION_PATH)
  stop('R10_B_APPROVAL_SCOPE_STOP');
 return m;
}

export function validateR10BDiff({files,fromSha,toSha,manifest}={}){
 if(fromSha!==ORIGINAL_PC_SOURCE||toSha!==manifest?.targetPcSourceSha||
  !Array.isArray(files)||files.length!==2||
  !same([...files].sort(),[...PATHS].sort()))
  stop('R10_B_NOT_EXACTLY_TWO_FILE_DIFF_STOP');
 return true;
}
