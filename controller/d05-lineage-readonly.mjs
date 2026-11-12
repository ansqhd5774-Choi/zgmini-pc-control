import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {TextDecoder} from 'node:util';

// Fixed PC-local metadata path. Never accept a path, glob, or SQL from an Issue.
const LEDGER_PARTS=['pc-writer','score-lineage','d05-composite-events-v1.jsonl'];
const EVENT_SCHEMA='D05_COMPOSITE_INPUT_LINEAGE_LOCAL_V1';
const MAX_LEDGER_BYTES=64*1024*1024;
const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const SOURCE_KEYS=['macro','credit','supply','fundFlows','bisDsr','bisTc','rates'];
const BATCH_KEY=/^[A-Za-z0-9._:-]{1,128}$/;

function exactIsoDate(value){
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/.test(value))return false;
 const ms=Date.parse(value);
 return Number.isFinite(ms)&&new Date(ms).toISOString()===value;
}

function validDay(value){
 if(value===null)return true;
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;
 const ms=Date.parse(value+'T00:00:00.000Z');
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value;
}

function fixedError(code,exists=false){
 return {status:'UNPROVEN',code,exists,eventCount:null,distinctCalculatedDates:null,
  evidenceLevel:'SELF_CONSISTENT_LOCAL_LEDGER_ONLY_NOT_LIVE_EXECUTION',
  earliestCalculatedAt:null,latestCalculatedAt:null,latestRecordedAt:null,
  currentApprovedSourceEventCount:null,byteLength:null,sha256:null,
  aclEvidence:'NOT_VERIFIED_BY_NODE_FS',backupEvidence:'NOT_VERIFIED',
  operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false};
}

/** Read-only, bounded and sanitized evidence for D05 local JSONL.
 * Never returns an event, batch key, score, source hash, or file-system ACL text.
 * A distinct Windows ACL/backup check is still required for privacy proof.
 */
export function inspectD05LineageReadonly(dataRoot,{fileSystem=fs,approvedSourceSha=null,
 maxLedgerBytes=MAX_LEDGER_BYTES}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)||
    !Number.isSafeInteger(maxLedgerBytes)||maxLedgerBytes<1||maxLedgerBytes>MAX_LEDGER_BYTES||
    (approvedSourceSha!==null&&!SHA40.test(approvedSourceSha)))
  return fixedError('D05_READONLY_INPUT_INVALID');
 const directory=path.join(dataRoot,...LEDGER_PARTS.slice(0,2));
 const ledger=path.join(directory,LEDGER_PARTS[2]);
 let handle;
 try{
  if(!fileSystem.lstatSync(dataRoot).isDirectory())return fixedError('D05_DATA_ROOT_UNPROVEN');
  if(!fileSystem.lstatSync(path.join(dataRoot,'pc-writer')).isDirectory())
   return fixedError('D05_WRITER_ROOT_UNPROVEN');
  const parent=fileSystem.lstatSync(directory);
  if(!parent.isDirectory()||parent.isSymbolicLink())return fixedError('D05_LEDGER_DIRECTORY_UNPROVEN');
  const leaf=fileSystem.lstatSync(ledger,{bigint:true});
  if(!leaf.isFile()||leaf.isSymbolicLink())return fixedError('D05_LEDGER_FILE_UNPROVEN',true);
  handle=fileSystem.openSync(ledger,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
  const before=fileSystem.fstatSync(handle,{bigint:true});
  if(!before.isFile()||before.size>BigInt(maxLedgerBytes))
   return fixedError('D05_LEDGER_SIZE_UNPROVEN',true);
  if(leaf.dev!==before.dev||leaf.ino!==before.ino)
   return fixedError('D05_LEDGER_PATH_REPLACED',true);
  const bytes=fileSystem.readFileSync(handle);
  const after=fileSystem.fstatSync(handle,{bigint:true});
  const namedAfter=fileSystem.lstatSync(ledger,{bigint:true});
  if(!namedAfter.isFile()||namedAfter.isSymbolicLink()||
     before.size!==after.size||before.mtimeNs!==after.mtimeNs||
     before.ino!==after.ino||before.dev!==after.dev||
     after.ino!==namedAfter.ino||after.dev!==namedAfter.dev||
     BigInt(bytes.length)!==before.size)
   return fixedError('D05_LEDGER_CHANGED_WHILE_READING',true);
  if(!bytes.length)return {...fixedError('D05_LEDGER_EMPTY',true),eventCount:0,byteLength:0};
  if(bytes[bytes.length-1]!==10)return fixedError('D05_LEDGER_PARTIAL_LINE',true);
  let decoded;
  try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{
   return fixedError('D05_LEDGER_UTF8_UNPROVEN',true);
  }
  const lines=decoded.slice(0,-1).split('\n');
  if(!lines.length||lines.some(line=>!line||Buffer.byteLength(line)>8192))
   return fixedError('D05_LEDGER_ROW_UNPROVEN',true);
  let earliest=null,latest=null,latestRecorded=null,currentCount=0;
  const ids=new Set(),dates=new Set();
  for(const line of lines){
   let row;
   try{row=JSON.parse(line);}catch{return fixedError('D05_LEDGER_ROW_UNPROVEN',true);}
   const {status,recordedAt,stableEvidenceDigestSha256,...stable}=row??{};
   const internallyConsistent=SHA256.test(stableEvidenceDigestSha256??'')&&
    createHash('sha256').update(JSON.stringify(stable)).digest('hex')===stableEvidenceDigestSha256;
   if(row?.schema!==EVENT_SCHEMA||status!=='PREPARED_LOCAL_ONLY'||
      !exactIsoDate(row.calculatedAt)||!exactIsoDate(row.recordedAt)||
      !validDay(row.asOfDate??null)||Date.parse(row.recordedAt)<Date.parse(row.calculatedAt)||
      row.eventId!==`D05/CM-R1/${row.calculatedAt}`||
      row.archiveKey!==`composite-observed:${row.calculatedAt.slice(0,10)}`||
      row.archiveStoredAt!==Date.parse(row.calculatedAt)||
      typeof row.score!=='number'||!Number.isFinite(row.score)||row.score<0||row.score>100||
      !/^[a-f0-9]{8}$/.test(row.outputSignature??'')||
      !SHA40.test(row.approvedSourceSha??'')||!SHA40.test(row.runtimeSourceSha??'')||
      !internallyConsistent||row.inputScope!=='SELECTED_7_BATCHES_ONLY'||
      row.inputStatus!=='LOCAL_SELECTED_7_MATCHED'||
      !['DIRECT_ID_AND_EXACT_ROW_MATCH','POST_SELECTION_UNIQUE_MATCH'].includes(row.selectionEvidence)||
      row.selectionEvidence!==(row.sources?.every(s=>s?.selectionWitness==='READER_DIRECT_ID')
       ?'DIRECT_ID_AND_EXACT_ROW_MATCH':'POST_SELECTION_UNIQUE_MATCH')||
      !Array.isArray(row.sources)||row.sources.length!==SOURCE_KEYS.length||
      row.sources.some((s,i)=>s?.sourceKey!==SOURCE_KEYS[i]||
       typeof s.batchKey!=='string'||!BATCH_KEY.test(s.batchKey)||
       !s.batchKey.startsWith(SOURCE_KEYS[i]+':')||
       !SHA256.test(s.storedBodySha256??'')||!Number.isSafeInteger(s.storedAt)||
       s.storedAt<0||s.storedAt>row.archiveStoredAt||
       !['READER_DIRECT_ID','POST_SELECTION_MATCH_ONLY'].includes(s.selectionWitness))||
      row.effectiveUseVerified!==false||row.completeD05InputLineage!==false||
      row.publicD1Verified!==false||ids.has(row.eventId))
    return fixedError('D05_LEDGER_ROW_UNPROVEN',true);
   ids.add(row.eventId);dates.add(row.calculatedAt.slice(0,10));
   if(earliest===null||row.calculatedAt<earliest)earliest=row.calculatedAt;
   if(latest===null||row.calculatedAt>latest)latest=row.calculatedAt;
   if(latestRecorded===null||row.recordedAt>latestRecorded)latestRecorded=row.recordedAt;
   if(approvedSourceSha!==null&&row.approvedSourceSha===approvedSourceSha&&
      row.runtimeSourceSha===approvedSourceSha)currentCount++;
  }
  return {status:'PASS',code:'D05_LEDGER_SANITIZED_READONLY_VERIFIED',exists:true,
   evidenceLevel:'SELF_CONSISTENT_LOCAL_LEDGER_ONLY_NOT_LIVE_EXECUTION',
   eventCount:lines.length,distinctCalculatedDates:dates.size,
   earliestCalculatedAt:earliest,latestCalculatedAt:latest,latestRecordedAt:latestRecorded,
   currentApprovedSourceEventCount:approvedSourceSha===null?null:currentCount,
   byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
   aclEvidence:'NOT_VERIFIED_BY_NODE_FS',backupEvidence:'NOT_VERIFIED',
   operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false};
 }catch(error){
  if(error?.code==='ENOENT'){
   if(!fileSystem.existsSync(dataRoot))return fixedError('D05_DATA_ROOT_ABSENT');
   if(!fileSystem.existsSync(path.join(dataRoot,'pc-writer')))
    return fixedError('D05_WRITER_ROOT_ABSENT');
   return fixedError('D05_LEDGER_ABSENT');
  }
  return fixedError('D05_LEDGER_IO_UNPROVEN');
 }finally{if(handle!==undefined)try{fileSystem.closeSync(handle);}catch{}}
}

/** Keep the pc-job envelope aligned with the sanitized ledger verdict.
 * A successful A-grade transport is not proof that a private D05 ledger exists.
 * Preserve the fixed internal failure code without exposing private content.
 */
export function summarizeD05LineageOperation(lineage){
 const verified=lineage?.status==='PASS'&&
  lineage.code==='D05_LEDGER_SANITIZED_READONLY_VERIFIED';
 return {status:verified?'PASS':'BLOCKED',
  code:verified?'D05_READONLY_DIAGNOSIS':
   typeof lineage?.code==='string'&&/^D05_[A-Z0-9_]{1,80}$/.test(lineage.code)
    ?lineage.code:'D05_LINEAGE_UNPROVEN',
  lineage,providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0};
}
