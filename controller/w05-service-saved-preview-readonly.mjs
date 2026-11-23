// W05 stored WPSFD42 service preview adapter. Reuses the exact reviewed
// W05 calculator; it does not duplicate formulas or invoke BLS/Provider/D1.
// Source-only candidate: registration and PC installation require the existing
// independent owner approval, manifest, CAS, and rollback contracts.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const PROJECT='zgmini-earnings-history-pc-release';
const SCRIPT='EARNINGS_R4_C_READ_MODEL_PREVIEW_READONLY.mjs';
const DEPENDENCY='EARNINGS_R3D_STORED_BLS_CALC_READONLY.mjs';
const PINS=Object.freeze({
 [SCRIPT]:'0f04f4ab485ac49f224b93a398a85c0cbc9c139b22a47411e5fa151549362f72',
 [DEPENDENCY]:'b441a52551a015ab9522280ee7c3f620fc8efd967c8dd0e6e04865bb72c97b31',
});
const RAW='bls_ppi_services_index',YOY='bls_ppi_services_yoy_sa';
const SHA=/^[0-9a-f]{64}$/;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const noEffect=()=>({providerCalls:0,d1Writes:0,operationalWrites:0,sqliteWrites:0});
const unknown=code=>({status:'STATE_UNKNOWN',code,sqliteOpened:false,rows:[],...noEffect()});
const fail=code=>{throw Object.assign(Error(code),{code});};
const checked=(fsApi,file,kind,max)=>{
 const stat=fsApi.lstatSync(file);
 if(stat.isSymbolicLink()||(kind==='file'?!stat.isFile():!stat.isDirectory()))
  fail('W05_SERVICE_UNSAFE_PATH');
 if(kind==='file'&&(stat.size<1||stat.size>max))fail('W05_SERVICE_FILE_SIZE_INVALID');
};

// There are no Issue-derived paths or shell arguments. Test doubles can only
// enter through direct module calls, never through runOperation's request.
export async function inspectW05ServiceSavedPreview(dataRoot,{
 filesystem=fs,pins=PINS,
 openDb=file=>new DatabaseSync(file,{readOnly:true,timeout:4000}),
 loadModule=url=>import(url),
}={}){
 let db=null,sqliteOpened=false;
 try{
  if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
   fail('W05_SERVICE_DATA_ROOT_INVALID');
  checked(filesystem,dataRoot,'directory');
  const root=filesystem.realpathSync(dataRoot);
  if(path.basename(root).toLowerCase()!=='data'
   ||path.basename(path.dirname(root)).toLowerCase()!=='zgmini')
   fail('W05_SERVICE_DATA_ROOT_INVALID');
  const writer=path.join(root,'pc-writer');
  const storage=path.join(writer,'storage');
  const database=path.join(storage,'core.sqlite');
  checked(filesystem,writer,'directory');
  checked(filesystem,storage,'directory');
  checked(filesystem,database,'file',512*1024*1024*1024);
  const projects=path.join(path.dirname(root),'projects');
  const checkout=path.join(projects,PROJECT);
  const scripts=path.join(checkout,'scripts','pc-writer');
  for(const dir of [projects,checkout,path.join(checkout,'scripts'),scripts])
   checked(filesystem,dir,'directory');
  const files=[SCRIPT,DEPENDENCY].map(name=>path.join(scripts,name));
  const before=files.map((file,index)=>{
   checked(filesystem,file,'file',2_000_000);
   const sha=digest(filesystem.readFileSync(file));
   if(!SHA.test(pins[[SCRIPT,DEPENDENCY][index]]??'')||
      sha!==pins[[SCRIPT,DEPENDENCY][index]])fail('W05_SERVICE_SOURCE_BYTES_NOT_APPROVED');
   return sha;
  });
  const calc=await loadModule(pathToFileURL(files[0]).href);
  if(typeof calc?.buildServiceSourcePreview!=='function')
   fail('W05_SERVICE_CALCULATOR_MISSING');
  db=openDb(database);sqliteOpened=true;
  db.exec('PRAGMA query_only=ON');
  const {payload,diagnostics}=calc.buildServiceSourcePreview(db);
  db.close();db=null;
  // Detect source replacement between verification and use.
  if(files.some((file,index)=>digest(filesystem.readFileSync(file))!==before[index]))
   fail('W05_SERVICE_SOURCE_CHANGED_DURING_READ');
  if(!payload||!SHA.test(payload.sourceVersion??'')||
     !Number.isSafeInteger(payload.sourceStoredAt)||payload.sourceStoredAt<=0||
     !Array.isArray(payload.rows)||payload.rows.length!==2||
     new Set(payload.rows.map(row=>row.indicatorId)).size!==2||
     !payload.rows.some(row=>row.indicatorId===RAW)||
     !payload.rows.some(row=>row.indicatorId===YOY)||
     !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(payload.observedThroughBySeries?.WPSFD42??'')||
     !Array.isArray(diagnostics?.bySeries)||diagnostics.bySeries.length!==1||
     diagnostics.bySeries[0].seriesId!=='WPSFD42'||
     !SHA.test(diagnostics.bySeries[0].snapshotSha256??''))
   fail('W05_SERVICE_RESULT_CONTRACT_INVALID');
  const rows=[RAW,YOY].map(id=>{
   const row=payload.rows.find(x=>x.indicatorId===id);
   if(row.value!==null&&(!Number.isFinite(row.value)))fail('W05_SERVICE_RESULT_VALUE_INVALID');
   if(row.status!=='READY'&&row.status!=='PARTIAL')fail('W05_SERVICE_RESULT_STATUS_INVALID');
   if(row.observationPeriod!==payload.observedThroughBySeries.WPSFD42)
    fail('W05_SERVICE_OBSERVATION_DATE_MISMATCH');
   return {indicatorId:id,value:row.value,unit:row.unit,
    observationPeriod:row.observationPeriod,status:row.status,
    unavailableReason:row.unavailableReason??null};
  });
  const ready=rows.every(row=>row.status==='READY'&&row.value!==null);
  return {status:ready?'PASS':'STATE_UNKNOWN',
   code:ready?'W05_SERVICE_SAVED_PREVIEW_VERIFIED':'W05_SERVICE_SAVED_PREVIEW_PARTIAL',
   sqliteOpened,seriesId:'WPSFD42',sourceVersion:payload.sourceVersion,
   sourceStoredAt:payload.sourceStoredAt,
   sourceSnapshotSha256:diagnostics.bySeries[0].snapshotSha256,
   observationMonth:payload.observedThroughBySeries.WPSFD42,
   rows,sourceFileSha256:before,...noEffect()};
 }catch(error){
  const message=String(error?.code??error?.message??'');
  const code=/^(W05_SERVICE_|R4_)[A-Z0-9_]{1,90}$/.test(message)
   ?message:'W05_SERVICE_SAVED_PREVIEW_UNVERIFIED';
  return {...unknown(code),sqliteOpened};
 }finally{try{db?.close();}catch{}}
}
