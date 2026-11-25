// Fixed A/light ER1 December evidence. Metadata only: no vendor rows,
// tokens, provider calls, SQL writes, dynamic input paths or score decisions.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const MONTH='2026-12';
const DAYS=Object.freeze(Array.from({length:31},(_,i)=>
  `${MONTH}-${String(i+1).padStart(2,'0')}`));
const SYMBOLS=Object.freeze(['TOL','CASY']);
const FOLDERS=Object.freeze(['dec31-symbol-probe','dec31-symbol-batch-a',
  'nov30-er1-probe','nov30-er1-batch20','nov30-er1-full']);
const MAX_FILE=2_500_000;
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const validDate=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\d$/.test(x)&&
  !Number.isNaN(Date.parse(x+'T00:00:00Z'));
const safeFolder=folder=>{try{const s=fs.lstatSync(folder);
  return s.isDirectory()&&!s.isSymbolicLink();
 }catch{return false;}};
function safeRead(filename,root){
 let stat;try{stat=fs.lstatSync(filename)}
 catch(e){return {state:e?.code==='ENOENT'?'MISSING':'READ_ERROR'};}
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||
   stat.size>MAX_FILE)return {state:'UNSAFE_FILE'};
 try{
  const base=fs.realpathSync.native(root);
  const real=fs.realpathSync.native(filename);
  const rel=path.relative(base,real);
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||
    path.isAbsolute(rel))return {state:'UNSAFE_PATH'};
  return {state:'READ',body:JSON.parse(fs.readFileSync(filename,'utf8'))};
 }catch{return {state:'INVALID_JSON_OR_PATH'};}
}
function dayShape(o,day){
 return o&&validTime(o.storedAt)&&o.body?.date===day&&
  ['pre','after','notSupplied'].every(k=>Array.isArray(o.body[k]));
}
function sqliteDay(row,day,now){
 if(!row)return 'MISSING';
 if(!Number.isSafeInteger(row.stored_at)||row.stored_at<1||
   row.stored_at>now+300000||typeof row.body!=='string'||
   Buffer.byteLength(row.body,'utf8')>MAX_FILE)return 'INVALID';
 try{
  const v=JSON.parse(row.body);
  if(v?.requestedDate!==day||typeof v.text!=='string'||
    Buffer.byteLength(v.text,'utf8')>MAX_FILE)return 'INVALID';
  const raw=JSON.parse(v.text);
  return raw?.date===day&&
   ['pre','after','notSupplied'].every(k=>Array.isArray(raw[k]))?
    'SHAPE_VALID':'INVALID';
 }catch{return 'INVALID';}
}
function readSqlite(home,now,openDatabase){
 const filename=path.join(home,'storage','core.sqlite');
 let stat;try{stat=fs.lstatSync(filename)}catch(e){
  return {state:e?.code==='ENOENT'?'DB_MISSING':'DB_UNAVAILABLE',
   validDays:null,missingDays:null,invalidDays:null};}
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||
   stat.size>2_000_000_000)return {state:'DB_UNSAFE',
    validDays:null,missingDays:null,invalidDays:null};
 let db;
 try{
  const root=fs.realpathSync.native(home);
  const rel=path.relative(root,fs.realpathSync.native(filename));
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||
   path.isAbsolute(rel))return {state:'DB_UNSAFE',
    validDays:null,missingDays:null,invalidDays:null};
  db=openDatabase(filename);
  db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=3000');
  const query=db.prepare("SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='input' AND snapshot_key='current' AND feed_key=?");
  const missingDays=[],invalidDays=[];let validDays=0;
  for(const day of DAYS){
   const status=sqliteDay(query.get('release-calendar:earnings-api:'+day),day,now);
   if(status==='SHAPE_VALID')validDays++;
   else if(status==='MISSING')missingDays.push(day);
   else invalidDays.push(day);
  }
  return {state:'READ',validDays,missingDays,invalidDays};
 }catch{return {state:'DB_READ_FAILED',
  validDays:null,missingDays:null,invalidDays:null};}
 finally{try{db?.close()}catch{}}
}
function readDays(input){
 const folder=path.join(input,'dec31-forward-days');
 if(!safeFolder(folder))return {state:'ARCHIVE_UNAVAILABLE',
  validDays:null,missingDays:null,invalidDays:null};
 const missingDays=[],invalidDays=[];let validDays=0;
 for(const day of DAYS){
  const item=safeRead(path.join(folder,day+'.json'),input);
  if(item.state==='MISSING')missingDays.push(day);
  else if(item.state==='READ'&&dayShape(item.body,day))validDays++;
  else invalidDays.push(day);
 }
 return {state:'READ',validDays,missingDays,invalidDays};
}
function readSymbols(input){
 const rows={};
 for(const symbol of SYMBOLS){
  const validFolders=[],emptyFolders=[],invalidFolders=[];
  for(const folder of FOLDERS){
   const dir=path.join(input,folder);
   if(!safeFolder(dir))continue;
   const item=safeRead(path.join(dir,symbol+'.json'),input);
   if(item.state==='MISSING')continue;
   const v=item.body;
   // The approved /v1/earnings parser accepts an empty result array.
   // An empty saved response proves a file exists, not an actual event.
   if(item.state==='READ'&&validTime(v?.storedAt)&&Array.isArray(v?.body)&&
     v.body.length<=1000&&
     v.body.every(x=>x?.symbol===symbol&&validDate(x.date))){
     validFolders.push(folder);
     if(v.body.length===0)emptyFolders.push(folder);
   }else invalidFolders.push(folder);
  }
  rows[symbol]={state:invalidFolders.length?'INVALID_ARCHIVE':
   validFolders.length===0?'NOT_FOUND_IN_FIXED_FOLDERS':
   validFolders.length===emptyFolders.length?'SHAPE_VALID_EMPTY':'SHAPE_VALID',
   validFolders,emptyFolders,invalidFolders};
 }
 return rows;
}
export function inspectER1DecemberSavedEvidence(dataRoot,{now=Date.now(),
 openDatabase=filename=>new DatabaseSync(filename,{readOnly:true,timeout:1000})}={}){
 const report={status:'STATE_UNKNOWN',code:'ER1_DEC31_EVIDENCE_UNAVAILABLE',
  month:MONTH,inspectionScope:'FIXED_LOCAL_METADATA_ONLY',
  sqlite:{state:'NOT_READ'},privateDays:{state:'NOT_READ'},symbols:null,
  sourceEligibilityVerified:false,actualValuesVerified:false,
  monthlyCalculationVerified:false,providerCalls:0,dbWrites:0,d1Writes:0,
  operationalWrites:0};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)||
  !Number.isSafeInteger(now)||now<1)return report;
 const home=path.join(dataRoot,'pc-writer');
 const input=path.join(home,'er1-input');
 if(![dataRoot,home,input].every(safeFolder))return report;
 report.sqlite=readSqlite(home,now,openDatabase);
 report.privateDays=readDays(input);
 report.symbols=readSymbols(input);
 report.status='PASS';
 report.code='ER1_DEC31_FIXED_METADATA_READONLY';
 return report;
}
