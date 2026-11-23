// A-grade bounded BEA native private archive + attempt-journal reconciliation.
// Reads a fixed folder only. No provider, credentials, source installation or DB/D1 writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FIELDS=['TableName','SeriesCode','LineNumber','TimePeriod',
  'DataValue','CL_UNIT','UNIT_MULT'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const noEffects={providerCalls:0,sqliteWrites:0,d1Writes:0,operationalWrites:0,
  rawExposed:false};
const result=(status,code,details={})=>({status,code,
  attempts:0,markedAttempts:0,completedJournalAttempts:0,
  storedSourceCount:0,verifiedSourceCount:0,latest:null,
  ...noEffects,...details});
const fail=code=>{throw Object.assign(Error(code),{code});};
function directory(fsApi,parent,segment){
  const file=path.join(parent,segment);
  let st;
  try{st=fsApi.lstatSync(file);}catch(e){if(e?.code==='ENOENT')return null;throw e;}
  if(!st.isDirectory()||st.isSymbolicLink())fail('BEA_NIPA_READONLY_UNSAFE_DIRECTORY');
  const canonical=fsApi.realpathSync(file);
  if(path.dirname(canonical)!==fsApi.realpathSync(parent))
    fail('BEA_NIPA_READONLY_REDIRECTED_DIRECTORY');
  return canonical;
}
function regular(fsApi,file,max){
  const st=fsApi.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>max)
    fail('BEA_NIPA_READONLY_UNSAFE_FILE');
  return fsApi.readFileSync(file);
}
function parse(bytes){
  try{return JSON.parse(bytes.toString('utf8'));}
  catch{fail('BEA_NIPA_READONLY_INVALID_JSON');}
}
function inspectStore(fsApi,base){
  let folder=directory(fsApi,base,'raw');
  if(!folder)return [];
  folder=directory(fsApi,folder,'earnings-bea-unit-nipa-r1');
  if(!folder)return [];
  const names=fsApi.readdirSync(folder);
  if(names.length>64)fail('BEA_NIPA_READONLY_FILE_LIMIT');
  if(names.length===0)return [];
  if(names.some(n=>!SHA.test(n.slice(0,64))||
    !/^([a-f0-9]{64})\.(json|meta\.json)$/.test(n)))
    fail('BEA_NIPA_READONLY_UNEXPECTED_FILE');
  const shas=[...new Set(names.map(x=>x.slice(0,64)))];
  const sources=[];
  for(const sha of shas){
    const dataFile=sha+'.json',metaFile=sha+'.meta.json';
    if(!names.includes(dataFile)||!names.includes(metaFile))
      fail('BEA_NIPA_READONLY_INCOMPLETE_PAIR');
    const bytes=regular(fsApi,path.join(folder,dataFile),2_000_000);
    const mb=regular(fsApi,path.join(folder,metaFile),10_000);
    const meta=parse(mb),data=parse(bytes);
    if(digest(bytes)!==sha||
      meta?.schemaVersion!=='earnings-bea-unit-nipa-raw-r1-v1'||
      meta.transport!=='BEA_API_JSON'||
      meta.storageScope!=='BEA_NIPA_TARGET_FIELDS_ONLY'||
      meta.dataset!=='NIPA'||meta.tableName!=='T11500'||
      meta.seriesCode!=='A463RD'||meta.lineNumber!=='7'||
      meta.frequency!=='Q'||meta.sourceVersion!==sha||
      meta.file!==dataFile||meta.sourceByteLength!==bytes.length||
      !SHA.test(meta.sourceHttpSha256??'')||
      !Number.isSafeInteger(meta.sourceStoredAt)||meta.sourceStoredAt<=0||
      meta.sourceRetrievedAt!==new Date(meta.sourceStoredAt).toISOString()||
      !/^20\d{2}-(?:03-31|06-30|09-30|12-31)$/.test(meta.observedThrough??''))
      fail('BEA_NIPA_READONLY_METADATA_MISMATCH');
    const bea=data?.BEAAPI;
    if(!bea||Object.keys(bea).length!==1||
      !bea.Results||Object.keys(bea.Results).length!==1||
      !Array.isArray(bea.Results.Data)||bea.Results.Data.length<5||
      bea.Results.Data.length>40||
      bea.Results.Data.some(row=>!row||typeof row!=='object'||
        row.SeriesCode!=='A463RD'||String(row.LineNumber)!=='7'||
        Object.keys(row).some(k=>!FIELDS.includes(k))))
      fail('BEA_NIPA_READONLY_SOURCE_SCOPE_INVALID');
    sources.push({sourceVersion:sha,sourceHttpSha256:meta.sourceHttpSha256,
      sourceStoredAt:meta.sourceStoredAt,observedThrough:meta.observedThrough,
      rowCount:bea.Results.Data.length});
  }
  return sources;
}
function inspectAttempts(fsApi,base){
  const folder=directory(fsApi,base,'bea-nipa-source-b-once');
  if(!folder)return [];
  const requests=fsApi.readdirSync(folder);
  if(requests.length>32)fail('BEA_NIPA_READONLY_ATTEMPT_LIMIT');
  const out=[];
  for(const id of requests){
    if(!UUID.test(id))fail('BEA_NIPA_READONLY_REQUEST_NAME_INVALID');
    const attempt=directory(fsApi,folder,id);
    if(!attempt)fail('BEA_NIPA_READONLY_REQUEST_MISSING');
    const names=fsApi.readdirSync(attempt);
    if(names.length>5||!names.includes('journal.jsonl'))
      fail('BEA_NIPA_READONLY_JOURNAL_MISSING');
    const journal=regular(fsApi,path.join(attempt,'journal.jsonl'),8192)
      .toString('utf8').trim().split(/\r?\n/);
    if(journal.length<1||journal.length>8)fail('BEA_NIPA_READONLY_JOURNAL_INVALID');
    const rows=journal.map(line=>parse(Buffer.from(line)));
    if(rows[0]?.status!=='CLAIMED')fail('BEA_NIPA_READONLY_JOURNAL_INVALID');
    const marker=names.includes('attempt.json')?
      parse(regular(fsApi,path.join(attempt,'attempt.json'),2048)):null;
    if(marker&&(marker.schema!=='ZGMINI_BEA_NIPA_SINGLE_ATTEMPT_V1'||
      marker.requestId!==id||!SHA.test(marker.manifestSha256??'')||
      !/^[a-f0-9]{40}$/.test(marker.sourceSha??'')||
      !Number.isFinite(Date.parse(marker.attemptedAt))))
      fail('BEA_NIPA_READONLY_MARKER_INVALID');
    const completions=rows.slice(1).filter(x=>
      x?.phase==='BEA_NATIVE_ARCHIVE_READBACK_VERIFIED');
    if(completions.length>1||completions.some(x=>
      !SHA.test(x.sourceVersion??'')||!SHA.test(x.sourceHttpSha256??'')||
      !Number.isSafeInteger(x.sourceStoredAt)||
      !/^20\d{2}-(?:03-31|06-30|09-30|12-31)$/.test(x.observedThrough??'')))
      fail('BEA_NIPA_READONLY_CHECKPOINT_INVALID');
    out.push({requestId:id,markerPresent:!!marker,
      attemptedAt:marker?.attemptedAt??null,completion:completions[0]??null});
  }
  return out;
}
export function inspectBeaNipaCaptureReadonly(dataRoot,{filesystem=fs}={}){
  if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
    return result('STATE_UNKNOWN','BEA_NIPA_READONLY_ROOT_INVALID');
  try{
    const root=filesystem.realpathSync(dataRoot);
    if(path.basename(root).toLowerCase()!=='data'||
      path.basename(path.dirname(root)).toLowerCase()!=='zgmini')
      return result('STATE_UNKNOWN','BEA_NIPA_READONLY_ROOT_INVALID');
    const base=directory(filesystem,root,'pc-writer');
    if(!base)return result('STATE_UNKNOWN','BEA_NIPA_READONLY_BASE_MISSING');
    const attempts=inspectAttempts(filesystem,base);
    const sources=inspectStore(filesystem,base);
    const completions=attempts.filter(x=>x.completion!==null);
    for(const a of completions){
      const matching=sources.find(x=>x.sourceVersion===a.completion.sourceVersion);
      if(!matching||matching.sourceHttpSha256!==a.completion.sourceHttpSha256||
        matching.sourceStoredAt!==a.completion.sourceStoredAt||
        matching.observedThrough!==a.completion.observedThrough)
        fail('BEA_NIPA_READONLY_JOURNAL_ARCHIVE_MISMATCH');
    }
    const latest=sources.sort((a,b)=>b.sourceStoredAt-a.sourceStoredAt)[0]??null;
    return result('PASS',sources.length?
      'BEA_NIPA_PRIVATE_ARCHIVE_READBACK_VERIFIED':
      'BEA_NIPA_PRIVATE_ARCHIVE_NOT_STORED',{
      attempts:attempts.length,
      markedAttempts:attempts.filter(x=>x.markerPresent).length,
      completedJournalAttempts:completions.length,
      storedSourceCount:sources.length,verifiedSourceCount:sources.length,
      latest,attemptStatus:attempts.map(x=>({
        requestId:x.requestId,markerPresent:x.markerPresent,
        checkpointVerified:x.completion!==null
      }))
    });
  }catch(e){
    const code=/^BEA_NIPA_READONLY_[A-Z0-9_]+$/.test(e?.code??'')?
      e.code:'BEA_NIPA_READONLY_UNREADABLE';
    return result('STATE_UNKNOWN',code);
  }
}
