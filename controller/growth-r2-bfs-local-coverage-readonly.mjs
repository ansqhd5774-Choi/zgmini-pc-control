// Fixed-path operating-PC SQLite A readback. This is NOT Cloudflare D1 and
// cannot certify that remote D1 or the public dashboard was refreshed.
// No user-controlled SQL/path, raw observation, account token or DB write.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const IDS=Object.freeze(['G060','G061','G062']);
const SCHEMA='ZGMINI_GROWTH_R2_BFS_LOCAL_SQLITE_COVERAGE_RO_V1';
const SCOPE='PC_LOCAL_SQLITE_ONLY_NOT_REMOTE_D1';
const MAX_FILE_BYTES=64*1024**3;
const validMonth=x=>typeof x==='string'&&/^20\d{2}-(?:0[1-9]|1[0-2])-01$/.test(x);
const count=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const blank=()=>IDS.map(id=>({id,chartLatest:null,chartRows:null,
 forwardLatest:null,forwardRows:null}));
const fail=(code,opened=false)=>({schema:SCHEMA,scope:SCOPE,
 status:'STATE_UNKNOWN',code,series:blank(),
 providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:opened});
const SQL=`SELECT candidate_id,pit_eligible,
 MAX(observation_date) AS latest_month,COUNT(*) AS n
 FROM growth_r2_feature_history_v1
 WHERE candidate_id IN ('G060','G061','G062') AND (
 (pit_eligible=0 AND feature_revision='GROWTH_R2_CHART_HISTORY_R1') OR
 (pit_eligible=1 AND provider='Census BFS' AND feature_revision='G12_HARMONIZED_FEATURE_R1')
 ) GROUP BY candidate_id,pit_eligible ORDER BY candidate_id,pit_eligible`;
export function inspectGrowthR2BfsLocalCoverage(dataRoot,{
 fileSystem=fs,openDatabase=f=>new DatabaseSync(f,{readOnly:true,timeout:4000}),
 now=Date.now()
}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)||
   !Number.isSafeInteger(now)||now<0)return fail('INVALID_ROOT_OR_CLOCK');
 let file;
 try{
  const root=fileSystem.realpathSync(dataRoot);
  if(path.basename(root).toLowerCase()!=='data'||
     path.basename(path.dirname(root)).toLowerCase()!=='zgmini'||
     root!==path.resolve(dataRoot))return fail('ROOT_NOT_APPROVED');
  const levels=[root,path.join(root,'pc-writer'),
   path.join(root,'pc-writer','storage')];
  for(const dir of levels){
   const st=fileSystem.lstatSync(dir);
   if(!st.isDirectory()||st.isSymbolicLink())return fail('UNSAFE_DIRECTORY');
  }
  file=path.join(levels.at(-1),'core.sqlite');
  const st=fileSystem.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size<100||
    st.size>MAX_FILE_BYTES||fileSystem.realpathSync(file)!==path.resolve(file))
   return fail('UNSAFE_DB_FILE');
 }catch{return fail('LOCAL_DB_UNAVAILABLE');}
 let db;
 try{
  db=openDatabase(file);
  db.exec('PRAGMA query_only=ON');
  db.exec('PRAGMA busy_timeout=4000');
  const found=db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='growth_r2_feature_history_v1'").get()?.n;
  if(found!==1)return fail('GROWTH_CHART_TABLE_ABSENT',true);
  const rows=db.prepare(SQL).all();
  if(!Array.isArray(rows)||rows.length>6)return fail('INVALID_QUERY_RESULT',true);
  const out=blank(),seen=new Set();
  for(const row of rows){
   const id=row?.candidate_id,flag=row?.pit_eligible;
   const key=id+':'+flag,n=count(row?.n),date=row?.latest_month;
   if(!IDS.includes(id)||![0,1].includes(flag)||seen.has(key)||
     n===null||!validMonth(date)||Date.parse(date+'T00:00:00Z')>now)
    return fail('INVALID_BFS_COVERAGE',true);
   seen.add(key);
   const entry=out.find(x=>x.id===id);
   if(flag===0){entry.chartLatest=date;entry.chartRows=n;}
   else{entry.forwardLatest=date;entry.forwardRows=n;}
  }
  return {schema:SCHEMA,scope:SCOPE,status:'PASS',
   code:'BFS_LOCAL_COVERAGE_READONLY',series:out,
   providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:true};
 }catch{return fail('LOCAL_DB_QUERY_FAILED',!!db);}
 finally{try{db?.close();}catch{}}
}
