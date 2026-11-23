// W05: execute only the B-approved, hash-verified R4 service-only reader.
// The immutable candidate is copied to a disposable job workspace so the
// original CLI's JSON/TXT files never modify operational source or SQLite.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {need} from './common.mjs';

export const W05_ENTRY='scripts/pc-writer/EARNINGS_R4_C_READ_MODEL_PREVIEW_READONLY.mjs';
export const W05_DEP='scripts/pc-writer/EARNINGS_R3D_STORED_BLS_CALC_READONLY.mjs';
export const W05_FILES=Object.freeze([W05_ENTRY,W05_DEP]);
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;

function safeFile(root,relative){
 const candidate=path.resolve(root,...relative.split('/'));
 need(candidate.startsWith(root+path.sep),'W05_BUNDLE_PATH_ESCAPE');
 need(!fs.lstatSync(candidate).isSymbolicLink(),'W05_BUNDLE_SYMLINK');
 const real=fs.realpathSync(candidate);
 need(real.startsWith(root+path.sep)&&fs.statSync(real).isFile(),
  'W05_BUNDLE_FILE_NOT_REGULAR');
 return fs.readFileSync(real);
}

export function verifyW05ServiceBundle({request,host}){
 need(request?.sourceRepository==='ansqhd5774-Choi/zgmini','W05_SOURCE_REPOSITORY_DENIED');
 need(SHA40.test(request.sourceSha??''),'W05_SOURCE_SHA_INVALID');
 const approved=host?.approvedSources?.[request.sourceSha];
 if(!approved)return null; // absence is an approval-stage block, not a PC failure
 need(typeof approved.branch==='string'&&approved.branch===request.sourceBranch,
  'W05_APPROVED_BRANCH_MISMATCH');
 need(approved.entrypoint===W05_ENTRY,'W05_APPROVED_ENTRYPOINT_MISMATCH');
 need(typeof approved.root==='string'&&path.isAbsolute(approved.root),
  'W05_APPROVED_ROOT_INVALID');
 need(SHA64.test(approved.manifestSha256??''),'W05_APPROVED_MANIFEST_SHA_INVALID');
 const root=fs.realpathSync(approved.root);
 need(fs.statSync(root).isDirectory(),'W05_APPROVED_ROOT_NOT_DIRECTORY');
 const bytes=safeFile(root,'manifest.json');
 need(sha256(bytes)===approved.manifestSha256,'W05_APPROVED_MANIFEST_DRIFT');
 let manifest;
 try{manifest=JSON.parse(bytes.toString('utf8'));}
 catch{need(false,'W05_APPROVED_MANIFEST_INVALID');}
 need(manifest?.schema==='ZGMINI_PC_SOURCE_BUNDLE_MANIFEST_V1' &&
  manifest.sourceRepository==='ansqhd5774-Choi/zgmini' &&
  manifest.sourceSha===request.sourceSha &&
  manifest.sourceBranch===request.sourceBranch &&
  manifest.entrypoint===W05_ENTRY,'W05_APPROVED_MANIFEST_IDENTITY');
 const files=manifest.files;
 need(files&&typeof files==='object'&&!Array.isArray(files) &&
  Object.keys(files).length===2 && W05_FILES.every(file=>SHA64.test(files[file]??'')),
  'W05_APPROVED_FILE_SCOPE_INVALID');
 const sources=W05_FILES.map(file=>{
  const bytes=safeFile(path.join(root,'source'),file);
  need(sha256(bytes)===files[file],'W05_APPROVED_FILE_DRIFT');
  return {file,bytes};
 });
 return {sourceSha:request.sourceSha,sources};
}

export function interpretW05ServicePreview(payload,txt){
 need(payload?.schemaVersion==='earnings-companion-c-r4-v1' &&
  payload?.historicalMode==='CURRENT_RETRIEVAL_NOT_PIT' &&
  Array.isArray(payload.rows)&&payload.rows.length===2 &&
  payload.coverage?.configured===2,'W05_SERVICE_PAYLOAD_CONTRACT');
 const expected=['bls_ppi_services_yoy_sa','bls_ppi_services_index'];
 const rows=payload.rows.map((row,i)=>{
  need(row?.indicatorId===expected[i]&&row.seriesId==='WPSFD42' &&
   ['READY','PARTIAL'].includes(row.status) &&
   ['INDEX','PERCENT'].includes(row.unit) &&
   row.unit===(i===0?'PERCENT':'INDEX') &&
   /^\d{4}-(0[1-9]|1[0-2])$/.test(row.observationPeriod??'') &&
   (row.value===null || (typeof row.value==='number'&&Number.isFinite(row.value))),
   'W05_SERVICE_ROW_CONTRACT');
  return {indicatorId:row.indicatorId,kind:row.kind,period:row.observationPeriod,
   value:row.value,unit:row.unit,status:row.status};
 });
 need(rows[0].period===rows[1].period,'W05_SERVICE_PERIOD_MISMATCH');
 need(SHA64.test(payload.sourceVersion??'') &&
  Number.isSafeInteger(payload.sourceStoredAt)&&payload.sourceStoredAt>0,
  'W05_SERVICE_SOURCE_PROVENANCE_INVALID');
 for(const marker of ['API_REQUESTS=0','SQLITE_WRITES=0','D1_WRITES=0',
  'SCHEDULER_CHANGED=NO','PUBLICATION_PERFORMED=NO']){
  need(txt.split(/\r?\n/).includes(marker),'W05_READONLY_REPORT_INCOMPLETE');
 }
 const snapshot=txt.match(/^BLS_WPSFD42_SNAPSHOT_SHA256=([a-f0-9]{64})$/m)?.[1];
 need(snapshot&&txt.includes('SOURCE_VERSION='+payload.sourceVersion),
  'W05_SERVICE_SNAPSHOT_PROVENANCE_MISSING');
 const complete=payload.status==='READY'&&rows.every(row=>row.status==='READY'&&
  row.value!==null)&&payload.coverage.ready===2;
 need(['READY','PARTIAL'].includes(payload.status),'W05_SERVICE_STATUS_INVALID');
 return {status:complete?'PASS':'BLOCKED',
  code:complete?'W05_SERVICE_STORED_CALC_VERIFIED':'W05_SERVICE_STORED_CALC_PARTIAL',
  sourceSnapshotSha256:snapshot,sourceVersion:payload.sourceVersion,
  sourceStoredAt:payload.sourceStoredAt,observationPeriod:rows[0].period,
  rows,providerCalls:0,sqliteOpened:true,operationalWrites:0,d1Writes:0};
}

// Parent A/light worker has a 90-second limit; reserve time for engine postchecks.
export const W05_CHILD_TIMEOUT_MS=55000;
async function spawnBounded(entry,env,timeoutMs=W05_CHILD_TIMEOUT_MS,spawnImpl=spawn){
 return await new Promise(resolve=>{
  const child=spawnImpl(process.execPath,['--max-old-space-size=160',entry,'--service-only'],
   {cwd:path.dirname(entry),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let bytes=0,overflow=false,timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeoutMs);
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{
   bytes+=chunk.length;
   if(bytes>16384){overflow=true;child.kill();}
  });
  child.on('error',()=>{clearTimeout(timer);resolve({exitCode:-1,overflow,timedOut});});
  child.on('close',code=>{clearTimeout(timer);resolve({exitCode:code,overflow,timedOut});});
 });
}

export async function runW05ServiceStoredReadonly({request,host,dataRoot,workspace,
 spawnImpl=spawn}={}){
 const approved=verifyW05ServiceBundle({request,host});
 if(!approved)return {status:'BLOCKED',code:'W05_B_APPROVED_SOURCE_NOT_STAGED',
  candidateExecuted:false,providerCalls:0,d1Writes:0,operationalWrites:0};
 need(typeof dataRoot==='string'&&path.isAbsolute(dataRoot),
  'W05_DATA_ROOT_INVALID');
 need(typeof workspace==='string'&&path.isAbsolute(workspace),
  'W05_WORKSPACE_INVALID');
 const dbRoot=fs.realpathSync(path.join(dataRoot,'pc-writer'));
 need(fs.statSync(dbRoot).isDirectory(),'W05_DB_ROOT_UNAVAILABLE');
 const outputDir=path.join(workspace,'w05-service-source','scripts','pc-writer');
 fs.mkdirSync(outputDir,{recursive:true});
 for(const item of approved.sources){
  const target=path.join(workspace,'w05-service-source',...item.file.split('/'));
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,item.bytes,{flag:'wx'});
 }
 const tmp=path.join(workspace,'w05-service-tmp');
 fs.mkdirSync(tmp);
 const env={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,
  PATH:path.dirname(process.execPath),TEMP:tmp,TMP:tmp,
  ZGMINI_PC_HOME:dbRoot};
 const entry=path.join(outputDir,path.basename(W05_ENTRY));
 const child=await spawnBounded(entry,env,W05_CHILD_TIMEOUT_MS,spawnImpl);
 need(!child.timedOut,'W05_SERVICE_CALC_TIMEOUT');
 need(!child.overflow,'W05_SERVICE_CALC_OUTPUT_OVERFLOW');
 const names=fs.readdirSync(outputDir);
 const jsonNames=names.filter(name=>/^EARNINGS_R4_C_SERVICE_ONLY_READ_MODEL_PREVIEW_RESULT_\d{8}-\d{6}Z\.json$/.test(name));
 const txtNames=names.filter(name=>/^EARNINGS_R4_C_SERVICE_ONLY_READ_MODEL_PREVIEW_RESULT_\d{8}-\d{6}Z\.txt$/.test(name));
 need(jsonNames.length<=1&&txtNames.length===1,'W05_SERVICE_RESULT_FILE_SCOPE');
 const txtName=txtNames[0];
 need(fs.statSync(path.join(outputDir,txtName)).size<=65536,'W05_SERVICE_TXT_TOO_LARGE');
 const txt=fs.readFileSync(path.join(outputDir,txtName),'utf8');
 if(child.exitCode!==0){
  const code=txt.match(/^ERROR=([A-Z0-9_]{3,100})$/m)?.[1]||'W05_SERVICE_CALC_EXECUTION_FAILED';
  const missing=['R4_SERVICE_SOURCE_NOT_STORED','PC_SQLITE_FILE_MISSING'].includes(code);
  return {status:missing?'BLOCKED':'FAIL',code,candidateExecuted:true,
   actualExecutionSha:approved.sourceSha,providerCalls:0,d1Writes:0,operationalWrites:0};
 }
 need(jsonNames.length===1&&jsonNames[0]===txtName.slice(0,-4)+'.json',
  'W05_SERVICE_RESULT_PAIR_MISMATCH');
 const jsonFile=path.join(outputDir,jsonNames[0]);
 need(fs.statSync(jsonFile).size<=131072,'W05_SERVICE_JSON_TOO_LARGE');
 const payload=JSON.parse(fs.readFileSync(jsonFile,'utf8'));
 return {...interpretW05ServicePreview(payload,txt),candidateExecuted:true,
  actualExecutionSha:approved.sourceSha,executionMode:'APPROVED_STORED_SERVICE_ONLY'};
}
