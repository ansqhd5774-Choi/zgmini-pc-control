// W01 A4-07 common fixed A/light admission. No W01 parser logic duplicated.
// Only the exact B-registered 8-file source bundle may execute.
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {stageA401Bundle,A407_ENTRY} from './inflation-a401-private23-readonly.mjs';

const ORIGINAL=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
const CANDIDATE=['2','16','22','23','24','29'];
const SHA64=/^[a-f0-9]{64}$/;
const PIT='PIT_SNAPSHOT_AND_CHUNKS_HASH_MATCHED';
const MACRO='SQLITE_BODY_DOUBLE_READ_FINGERPRINT';
const FILE='SOURCE_FILE_DOUBLE_READ_FINGERPRINT';
const ARCHIVE='PARSED_AND_ARCHIVE_DOUBLE_READ_FINGERPRINT';
const SCE='SCE_PARSED_WITH_REFERENCE_FINGERPRINT';
const CAND='CANDIDATE_PARSED_AND_DOUBLE_READ_FINGERPRINT';
const ZERO=['providerCalls','d1Writes','sqliteWrites','sourceWrites','taskChanges','operationalWrites'];
const need=(test,code)=>{if(!test)throw Object.assign(new Error(code),{code});};
const stop=code=>({status:'BLOCKED',code,providerCalls:0,d1Writes:0,sqliteWrites:0,operationalWrites:0});
function proofFor(id,candidate){
 if(candidate)return [CAND];
 if(['12','13','14','19'].includes(id))return [PIT];
 if(id==='1')return [PIT,MACRO];
 if(id==='18')return [MACRO];
 if(['21','26'].includes(id))return [ARCHIVE];
 if(id==='31')return [SCE];
 return [FILE];
}
function safeRows(value,expected,candidate){
 need(Array.isArray(value)&&value.length===expected.length&&
  new Set(value.map(v=>v?.id)).size===expected.length&&
  value.every(v=>v&&expected.includes(v.id)&&SHA64.test(v.sha256??'')&&
   proofFor(v.id,candidate).includes(v.proof)),'A407_REPORT_IDS_OR_PROOF');
 const byId=new Map(value.map(v=>[v.id,v]));
 return expected.map(id=>{
  const v=byId.get(id),out={id,sha256:v.sha256,proof:v.proof};
  if(['21','26'].includes(id)&&!candidate){
   need(SHA64.test(v.archiveSha256??''),'A407_REPORT_ARCHIVE_HASH');
   out.archiveSha256=v.archiveSha256;
  }
  if(id==='31'&&!candidate){
   need(SHA64.test(v.metadataSha256??'')&&SHA64.test(v.archiveRefSha256??''),
    'A407_REPORT_SCE_HASH');
   out.metadataSha256=v.metadataSha256;out.archiveRefSha256=v.archiveRefSha256;
  }
  if(v.proof===PIT){
   need(Number.isSafeInteger(v.chunkCount)&&v.chunkCount>=1&&v.chunkCount<=100,
    'A407_REPORT_PIT_CHUNKS');
   out.chunkCount=v.chunkCount;
  }
  return out;
 });
}
export function summarizeA407(body){
 need(body&&body.status==='PASS'&&
  body.code==='A407_STORED_25_LOCAL_FINGERPRINTS_VERIFIED'&&
  body.expectedOriginal===19&&body.expectedCandidate===6&&
  body.originalVerified===19&&body.candidateVerified===6&&
  body.census==='MISSING'&&body.evidenceScope==='FIXED_PRIVATE_SOURCES_READONLY'&&
  ZERO.every(key=>body[key]===0),'A407_REPORT_INVALID');
 const original=safeRows(body.original,ORIGINAL,false);
 const candidate=safeRows(body.candidate,CANDIDATE,true);
 need(body.checkpoints&&typeof body.checkpoints==='object'&&
  ['inflation19','candidates7'].every(key=>
   SHA64.test(body.checkpoints[key]?.sha256??'')&&
   body.checkpoints[key]?.proof==='CHECKPOINT_FILE_DOUBLE_READ_FINGERPRINT'),
  'A407_REPORT_CHECKPOINT');
 return {status:'PASS',code:body.code,expectedOriginal:19,originalVerified:19,
  expectedCandidate:6,candidateVerified:6,census:'MISSING',original,candidate,
  checkpoints:{
   inflation19:{sha256:body.checkpoints.inflation19.sha256,proof:'CHECKPOINT_FILE_DOUBLE_READ_FINGERPRINT'},
   candidates7:{sha256:body.checkpoints.candidates7.sha256,proof:'CHECKPOINT_FILE_DOUBLE_READ_FINGERPRINT'}
  },evidenceScope:'FIXED_PRIVATE_SOURCES_READONLY',sqliteReadOnly:true,
  providerCalls:0,d1Writes:0,sqliteWrites:0,sourceWrites:0,taskChanges:0,operationalWrites:0};
}
export function inspectA407IntegrityReadonly(request,context,{run=spawnSync}={}){
 try{
  need(typeof context?.dataRoot==='string'&&
   path.win32.normalize(context.dataRoot).toLowerCase()===
    path.win32.normalize(String.raw`E:\ZGmini\data`).toLowerCase(),
   'A407_DATA_ROOT_DENIED');
  const staged=stageA401Bundle(request,context,A407_ENTRY);
  const env={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,
   PATH:path.dirname(process.execPath),TEMP:context.workspace,TMP:context.workspace};
  const r=run(process.execPath,['--max-old-space-size=128',staged.entry],{
   cwd:staged.cwd,env,windowsHide:true,shell:false,encoding:'utf8',
   timeout:45000,maxBuffer:32768});
  need(!r.error&&!r.signal&&[0,1].includes(r.status),'A407_CHILD_INCOMPLETE');
  const report=JSON.parse(r.stdout.trim());
  need(r.status===(report.status==='PASS'?0:1),'A407_CHILD_STATUS_MISMATCH');
  return summarizeA407(report);
 }catch(error){
  return stop(/^A407_[A-Z0-9_]+$/.test(error?.code??'')?error.code:
   'A407_READBACK_UNVERIFIED');
 }
}
