// R10-7 CHANGED SOURCE ENFORCEMENT; runtime sidecar, no repo or schema modifications
// Runs after an existing approved PC collection cycle. Does not collect or
// calculate inputs, change source SHA/config, or create scheduler jobs.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {CNN_KEY,CNN_VERSION,COMP_PREFIX,COMPOSITE_VERSION,cnnGroup,cnnMerge,compositeSample,compositeMerge} from './archive-core-r10.mjs';
import {captureVerifiedCheck,publishVerifiedChecks} from './verified-checks-r10.mjs';
const APPROVED='c8ed53a3991212dd1778742cda8a86ac133e0796';
const SRC='E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release';
const HOME='E:\\ZGmini\\data\\pc-writer';
const out=path.join(HOME,'archive-sidecar-r7','last-run.json');
const now=()=>Date.now();
function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'));}
function fileOrNull(f){try{return readJson(f)}catch{return null}}
function approvedCheck(){
 if(!fs.existsSync(path.join(SRC,'.git'))&&!fs.existsSync(path.join(SRC,'.git','HEAD')))throw Error('SOURCE_REPO_NOT_FOUND');
 const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:SRC,encoding:'utf8',windowsHide:true}).trim();
 if(sha!==APPROVED)throw Error('SOURCE_SHA_CHANGED');
 const diff=execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:SRC,encoding:'utf8',windowsHide:true}).trim();
 if(diff)throw Error('SOURCE_DIRTY');
 const cfg=readJson(path.join(HOME,'config.json'));
 if(cfg.source!==APPROVED||cfg.enabled!==true||cfg.collectionTarget!=='pc')throw Error('CONFIG_APPROVAL_MISMATCH');
 return cfg;
}
function activeCycle(){
 const lock=fileOrNull(path.join(HOME,'local-cycle.lock'));
 if(!lock?.pid)return false;
 try{process.kill(Number(lock.pid),0);return true}catch(e){return e.code!=='ESRCH'}
}
function get(db,sql,params=[]){return db.prepare(sql).get(...params)??null}
function all(db,sql,params=[]){return db.prepare(sql).all(...params)}
function count(db,sql){return get(db,sql)?.n??0}
function write(db,sql,params){return db.prepare(sql).run(...params)}
function saveArchive(db,table,key,body,storedAt){
 const encoded=JSON.stringify(body);
 if(Buffer.byteLength(encoded)>1800000)throw Error('ARCHIVE_DAY_SIZE_LIMIT');
 if(table==='CNN')write(db,"INSERT INTO public_feed_snapshots_v1(kind,feed_key,snapshot_key,body,stored_at) VALUES('output',?,?,?,?) ON CONFLICT(kind,feed_key,snapshot_key) DO UPDATE SET body=excluded.body,stored_at=excluded.stored_at WHERE excluded.stored_at>=public_feed_snapshots_v1.stored_at",[CNN_KEY,key,encoded,storedAt]);
 else write(db,"INSERT INTO market_public_snapshots_v1(snapshot_key,body,stored_at) VALUES(?,?,?) ON CONFLICT(snapshot_key) DO UPDATE SET body=excluded.body,stored_at=excluded.stored_at WHERE excluded.stored_at>=market_public_snapshots_v1.stored_at",[key,encoded,storedAt]);
 const row=table==='CNN'?get(db,"SELECT body FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key=?",[CNN_KEY,key]):get(db,"SELECT body FROM market_public_snapshots_v1 WHERE snapshot_key=?",[key]);
 if(row?.body!==encoded)throw Error('LOCAL_READBACK_MISMATCH');
}
async function publish(db,cfg,report){
 // Existing configured publication must be stable before this independent lane.
 const ledger=fileOrNull(path.join(HOME,'local-publication-ledger.json'));
 const writer=fileOrNull(path.join(HOME,'local-writer-last-run.json'));
 if(ledger?.status!=='VERIFIED'||ledger.source!==APPROVED||writer?.status!=='VERIFIED'||writer.source!==APPROVED){report.publication='WAIT_APPROVED_WRITER';return}
 if(activeCycle()){report.publication='SKIP_ACTIVE_CYCLE';return}
 const d1=await import(pathToFileURL(path.join(SRC,'scripts','pc-writer','d1.mjs')).href);
 const remote=d1.client(cfg,()=>d1.credential(SRC));
 const existingCnn=await remote.query(cfg.core,"SELECT snapshot_key,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=?",[CNN_KEY]);
 const savedCnn=new Map((existingCnn.results??[]).map(row=>[row.snapshot_key,row.stored_at]));
 const cnnRows=all(db,"SELECT snapshot_key,body,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? ORDER BY snapshot_key ASC",[CNN_KEY]);
 let cnnPublished=0,compositePublished=0;
 for(const row of cnnRows.filter(row=>!savedCnn.has(row.snapshot_key)||savedCnn.get(row.snapshot_key)<row.stored_at).slice(0,24)){
  const value=JSON.parse(row.body);if(value.version!==CNN_VERSION||value.date!==row.snapshot_key||!Array.isArray(value.observations))throw Error('CNN_LOCAL_INVALID');
  let failure=null;
  try{await remote.request(cfg.core,[{sql:"INSERT INTO public_feed_snapshots_v1(kind,feed_key,snapshot_key,body,stored_at) VALUES('output',?,?,?,?) ON CONFLICT(kind,feed_key,snapshot_key) DO UPDATE SET body=excluded.body,stored_at=excluded.stored_at WHERE excluded.stored_at>public_feed_snapshots_v1.stored_at",params:[CNN_KEY,row.snapshot_key,row.body,row.stored_at]}])}catch(e){failure=e}
  const checked=(await remote.query(cfg.core,"SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key=?",[CNN_KEY,row.snapshot_key])).results?.[0];
  if(checked?.body!==row.body||checked.stored_at!==row.stored_at)throw failure??Error('CNN_REMOTE_READBACK_MISMATCH');
  cnnPublished++;
 }
 const remoteMarket=(await remote.query(cfg.core,"SELECT stored_at FROM market_public_snapshots_v1 WHERE snapshot_key='current'")).results?.[0];
 if(Number.isSafeInteger(remoteMarket?.stored_at)){
  const savedComp=new Map((await remote.query(cfg.core,"SELECT snapshot_key,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key LIKE 'composite-observed:%'")).results?.map(row=>[row.snapshot_key,row.stored_at])??[]);
  const compRows=all(db,"SELECT snapshot_key,body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key LIKE 'composite-observed:%' ORDER BY snapshot_key ASC");
  for(const row of compRows.filter(row=>row.stored_at<=remoteMarket.stored_at&&(!savedComp.has(row.snapshot_key)||savedComp.get(row.snapshot_key)<row.stored_at)).slice(0,24)){
   const value=JSON.parse(row.body);if(value.version!==COMPOSITE_VERSION||COMP_PREFIX+value.date!==row.snapshot_key||!Array.isArray(value.points))throw Error('COMPOSITE_LOCAL_INVALID');
   let failure=null;
   try{await remote.request(cfg.core,[{sql:"INSERT INTO market_public_snapshots_v1(snapshot_key,body,stored_at) VALUES(?,?,?) ON CONFLICT(snapshot_key) DO UPDATE SET body=excluded.body,stored_at=excluded.stored_at WHERE excluded.stored_at>market_public_snapshots_v1.stored_at",params:[row.snapshot_key,row.body,row.stored_at]}])}catch(e){failure=e}
   const checked=(await remote.query(cfg.core,"SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key=?",[row.snapshot_key])).results?.[0];
   if(checked?.body!==row.body||checked.stored_at!==row.stored_at)throw failure??Error('COMPOSITE_REMOTE_READBACK_MISMATCH');
   compositePublished++;
  }
 }
 try{report.cnnChecksPublication=await publishVerifiedChecks(db,remote,cfg.core)}catch(error){report.cnnChecksPublication={status:'FAILED',reason:'CNN_R9_REMOTE_READBACK_FAILED'}}
 report.publication='D1_READBACK';report.cnnPublishedDays=cnnPublished;report.compositePublishedDays=compositePublished;
}
export async function run({dryRun=false,publishRemote=true}={}){
 const report={version:'ZGMINI_ARCHIVE_ACTIVATION_R7',at:new Date().toISOString(),status:'CHECKING',mode:dryRun?'READ_ONLY':'ARCHIVE_LOCAL_AND_D1',approvedSha:APPROVED,providerCalls:0,sourceChanges:0,configChanges:0,taskChanges:0};
 let db;
 try{
  const cfg=approvedCheck();
  if(!dryRun && activeCycle()){report.status='SKIPPED_ACTIVE_CYCLE';return report}
  db=new DatabaseSync(path.join(HOME,'storage','core.sqlite'),{readOnly:dryRun});
  db.exec('PRAGMA busy_timeout=3000');
  const cnn=get(db,"SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key='fear-greed' AND snapshot_key='current'");
  const market=get(db,"SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key='current'");
  report.cnnInput=cnn?'PRESENT':'MISSING';report.compositeInput=market?'PRESENT':'MISSING';
  report.cnnDaysBefore=count(db,"SELECT COUNT(*) AS n FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key='fear-greed-observed'");
  report.compositeDaysBefore=count(db,"SELECT COUNT(*) AS n FROM market_public_snapshots_v1 WHERE snapshot_key LIKE 'composite-observed:%'");
  let cnnAdded=0,compAdded=0;
  if(cnn){
   const groups=cnnGroup(JSON.parse(cnn.body),now());
   report.cnnVerifiedDays=groups.size;
   for(const [date,points] of groups){
    const old=get(db,"SELECT body FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key=?",[CNN_KEY,date]);
    const merged=cnnMerge(old?JSON.parse(old.body):null,date,points,now());
    if(merged.changed){cnnAdded++;if(!dryRun)saveArchive(db,'CNN',date,merged.body,now())}
   }
  }
  if(market){
   const sample=compositeSample(JSON.parse(market.body),market.stored_at,now());
   report.compositeVerified=Boolean(sample);
   if(sample){
    const date=sample.calculatedAt.slice(0,10),key=COMP_PREFIX+date;
    const old=get(db,"SELECT body FROM market_public_snapshots_v1 WHERE snapshot_key=?",[key]);
    // R10: consult the latest verified point from the previous UTC day.
const previousDay=old?null:get(db,"SELECT body FROM market_public_snapshots_v1 WHERE snapshot_key LIKE ? AND snapshot_key<? ORDER BY snapshot_key DESC LIMIT 1",[COMP_PREFIX+'%',key]);
const lastAcrossDay=previousDay?JSON.parse(previousDay.body).points?.at(-1):null;
const merged=compositeMerge(old?JSON.parse(old.body):null,date,sample,lastAcrossDay);
    if(merged.changed){compAdded++;if(!dryRun)saveArchive(db,'COMPOSITE',key,merged.body,market.stored_at)}
   }
  }
  try{report.cnnChecks=await captureVerifiedCheck(db,cnn,now(),{dryRun})}catch(error){report.cnnChecks={status:'FAILED',reason:'CNN_R9_LOCAL_ARCHIVE_FAILED'}}
  report.cnnDaysChanged=cnnAdded;report.compositeDaysChanged=compAdded;
  report.cnnDaysAfter=dryRun?report.cnnDaysBefore:count(db,"SELECT COUNT(*) AS n FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key='fear-greed-observed'");
  report.compositeDaysAfter=dryRun?report.compositeDaysBefore:count(db,"SELECT COUNT(*) AS n FROM market_public_snapshots_v1 WHERE snapshot_key LIKE 'composite-observed:%'");
  if(dryRun){report.status='PREFLIGHT_PASS';return report}
  if(publishRemote){try{await publish(db,cfg,report)}catch(e){report.publication='FAILED';report.publicationError=/^[A-Z0-9_]+$/.test(e?.message??'')?e.message:e?.code??'D1_ERROR';}}
  report.status=report.publication==='FAILED'?'LOCAL_STORED_REMOTE_FAILED':'LOCAL_STORED';
  return report;
 }catch(e){report.status='BLOCKED';report.reason=/^[A-Z0-9_]+$/.test(e?.message??'')?e.message:e?.code??'ARCHIVE_EXECUTION_FAILED';return report}
 finally{if(db)db.close();if(!dryRun&&fs.existsSync(path.dirname(out))){try{const tmp=out+'.tmp';fs.writeFileSync(tmp,JSON.stringify(report,null,2));fs.renameSync(tmp,out)}catch{}}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const result=await run({dryRun:process.argv.includes('--dry-run'),publishRemote:!process.argv.includes('--local-only')});
 if(!process.argv.includes('--quiet'))console.log(JSON.stringify(result));
 if(result.status==='BLOCKED'||result.status==='LOCAL_STORED_REMOTE_FAILED')process.exitCode=2;
}
