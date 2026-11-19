#!/usr/bin/env node
// Exact one-shot W05 BLS WPSFD42 collection into existing SQLite, after reviewed B approval.
// No dynamic command, Core Scheduler mutation, D1, GitHub token in child, or source deployment.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {
 CONTROL_REPO, MANIFEST, SOURCE_ROOT,DATA_ROOT,INSTALLED_SHA,FILES,
 validateIssue,validateApproval,sha256,expect,fail,sanitizedCode,
} from './contract.mjs';
const CONTROL_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SCRIPT='scripts/pc-writer/EARNINGS_R3C_BLS_STORE_ONCE.mjs';
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const DB=path.join(DATA_ROOT,'storage','core.sqlite');
const RESULT_NAME='W05_R304_B_RESULT.json';
const ATTEMPT=path.join(DATA_ROOT,'w05-r304-bls-service-one-shot.json');
const GIT=[String.raw`C:\Program Files\Git\cmd\git.exe`,
 String.raw`C:\Program Files (x86)\Git\cmd\git.exe`];
const SAFE_ENV=['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','TEMP','TMP',
 'APPDATA','LOCALAPPDATA','USERPROFILE'];
function secureRegular(file,maxBytes=300000){
 const stat=fs.lstatSync(file);
 expect(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>=1&&stat.size<=maxBytes,
  'W05_B_FILE_SHAPE_STOP');
 return fs.readFileSync(file);
}
function sha40(value){return typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);}
function gitHead(dir){
 const binary=GIT.find(fs.existsSync);
 expect(binary,'W05_B_GIT_UNAVAILABLE_STOP');
 const value=execFileSync(binary,['-C',dir,'-c','core.fsmonitor=false','rev-parse','HEAD'],
  {encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:200,stdio:['ignore','pipe','ignore']}).trim();
 expect(sha40(value),'W05_B_GIT_HEAD_STOP');
 return value;
}
export function assertInstalledSource({sourceRoot=SOURCE_ROOT}={}){
 expect(process.platform==='win32','W05_B_WINDOWS_REQUIRED');
 expect(fs.statSync(sourceRoot).isDirectory(),'W05_B_SOURCE_ROOT_STOP');
 const head=gitHead(sourceRoot);
 expect(head===INSTALLED_SHA,'W05_B_INSTALLED_SOURCE_SHA_DRIFT_STOP');
 const cfg=JSON.parse(secureRegular(path.join(DATA_ROOT,'config.json'),100000).toString('utf8'));
 expect(cfg.source===INSTALLED_SHA,'W05_B_CONFIG_SOURCE_DRIFT_STOP');
 for(const [relative,expected] of Object.entries(FILES)){
  const file=path.join(sourceRoot,...relative.split('/'));
  expect(sha256(secureRegular(file))===expected,'W05_B_FILE_HASH_DRIFT_STOP');
 }
 return path.join(sourceRoot,...SCRIPT.split('/'));
}
export function readbackServiceSnapshot(dbPath=DB){
 const db=new DatabaseSync(dbPath,{readOnly:true,timeout:5000});
 try{
  db.exec('PRAGMA query_only=ON');
  const snap=db.prepare(`SELECT snapshot_sha256,chunk_hashes_json,row_count,retrieved_at,
   status,history_mode,latest_observation_date,provenance_json
   FROM api_history_snapshots_v1
   WHERE provider='BLS' AND dataset='WPSFD42'
   ORDER BY retrieved_at DESC LIMIT 1`).get();
  expect(snap&&/^[a-f0-9]{64}$/.test(snap.snapshot_sha256)&&
   Number.isInteger(snap.row_count)&&snap.row_count>=1&&
   snap.status==='READY_DIRECT_BLS'&&snap.history_mode==='EARNINGS_COMPANION_R3C_BLS_DIRECT_V1'&&
   /^\d{4}-(0[1-9]|1[0-2])-01$/.test(snap.latest_observation_date)&&
   Number.isFinite(Date.parse(snap.retrieved_at)), 'W05_B_SQLITE_SNAPSHOT_READBACK_STOP');
  const hashes=JSON.parse(snap.chunk_hashes_json);
  const provenance=JSON.parse(snap.provenance_json);
  expect(Array.isArray(hashes)&&hashes.length===1&&
   /^[a-f0-9]{64}$/.test(hashes[0])&&
   provenance?.authority==='US_BLS'&&provenance?.seriesID==='WPSFD42'&&
   provenance?.contract==='EARNINGS_COMPANION_R3C_BLS_DIRECT_V1'&&
   provenance?.retrievedAt===snap.retrieved_at,'W05_B_SNAPSHOT_LINEAGE_STOP');
  const chunk=db.prepare(`SELECT payload_json,row_count,first_seen_at
   FROM api_history_chunks_v1
   WHERE provider='BLS' AND dataset='WPSFD42' AND chunk_sha256=?`).get(hashes[0]);
  expect(chunk?.row_count===snap.row_count&&sha256(Buffer.from(chunk.payload_json,'utf8'))===hashes[0]&&
   typeof chunk.first_seen_at==='string'&&Number.isFinite(Date.parse(chunk.first_seen_at))&&
   Date.parse(chunk.first_seen_at)<=Date.parse(snap.retrieved_at),
   'W05_B_SQLITE_CHUNK_READBACK_STOP');
  const expectedSnapshot=sha256(Buffer.from(JSON.stringify({
   contract:'EARNINGS_COMPANION_R3C_BLS_DIRECT_V1',provider:'BLS',
   dataset:'WPSFD42',frequency:'MONTHLY',seasonalAdjustment:'SA',chunks:hashes
  }),'utf8'));
  expect(snap.snapshot_sha256===expectedSnapshot,'W05_B_SNAPSHOT_SHA_READBACK_STOP');
  const rows=JSON.parse(chunk.payload_json);
  expect(Array.isArray(rows)&&rows.length===snap.row_count&&
   rows.every(x=>x.seriesID==='WPSFD42'&&Number.isFinite(x.value)),
   'W05_B_SQLITE_ROWS_READBACK_STOP');
  return {series:'WPSFD42',rows:snap.row_count,observationAt:snap.latest_observation_date,
   retrievedAt:snap.retrieved_at,firstSeenAt:chunk.first_seen_at,snapshotSha256:snap.snapshot_sha256,chunkSha256:hashes[0]};
 }finally{db.close()}
}
function childEnv(env){
 const out=Object.fromEntries(SAFE_ENV.filter(k=>typeof env[k]==='string')
  .map(k=>[k,env[k]]));
 return {...out,ZGMINI_PC_HOME:DATA_ROOT};
}
export function validateChildSummary(stdout){
 expect(typeof stdout==='string'&&stdout.length<1600,
  'W05_B_CHILD_OUTPUT_STOP');
 const lines=stdout.trim().split(/\r?\n/);
 expect(lines.length===2&&lines[1]==='RESULT=PASS_R3C_MANUAL_BLS_PERSISTED'&&
   /^TXT_CREATED=EARNINGS_BLS_SERVICE_R1_RESULT_\d{8}-\d{6}Z\.txt$/.test(lines[0]),
   'W05_B_CHILD_RESULT_UNVERIFIED_STOP');
 return lines[0].slice('TXT_CREATED='.length);
}
function safeReport(report,env){
 const dir=env.RUNNER_TEMP;
 expect(typeof dir==='string'&&path.isAbsolute(dir),'W05_B_RUNNER_TEMP_STOP');
 fs.writeFileSync(path.join(dir,RESULT_NAME),JSON.stringify(report)+'\n',{flag:'wx'});
}
export function execute(env=process.env){
 let report={schema:'ZGMINI_W05_R304_SERVICE_B_RESULT_V1',
  status:'BLOCKED',code:'W05_B_NOT_STARTED',requestId:null,
  sourceSha:INSTALLED_SHA,provider:'BLS',series:'WPSFD42',
  providerCalls:'NOT_CONFIRMED',dbWrites:'NOT_CONFIRMED',d1Writes:0,
  schedulerChanges:0,automaticRetries:0};
 let attempted=false;
 try{
  expect(process.platform==='win32','W05_B_WINDOWS_REQUIRED');
  const event=JSON.parse(secureRegular(env.GITHUB_EVENT_PATH,100000).toString('utf8'));
  const request=validateIssue(event,env);
  report.requestId=request.requestId;
  const raw=secureRegular(path.join(CONTROL_ROOT,...MANIFEST.split('/')),12000);
  validateApproval(raw,request);
  const installed=assertInstalledSource();
  expect(fs.existsSync(NODE)&&fs.existsSync(DB),'W05_B_INSTALLED_RUNTIME_MISSING_STOP');
  expect(!fs.existsSync(ATTEMPT),'W05_B_ALREADY_ATTEMPTED_STOP');
  // Create-only durable attempted marker before any provider request; never auto-retry.
  fs.writeFileSync(ATTEMPT,JSON.stringify({schema:'ZGMINI_W05_R304_ONE_ATTEMPT_V1',
   requestId:request.requestId,sourceSha:INSTALLED_SHA,startedAt:new Date().toISOString()})+'\n',
   {flag:'wx'});attempted=true;
  const child=spawnSync(NODE,[installed,'--services-only','--apply',
   '--confirm-service-sqlite-append'],{
    env:childEnv(env),cwd:path.dirname(installed),shell:false,windowsHide:true,
    encoding:'utf8',timeout:120000,maxBuffer:4096,stdio:['ignore','pipe','pipe']});
  if(child.error||child.signal){
   report.status='STATE_UNKNOWN';report.code='W05_B_CHILD_TERMINATION_UNVERIFIED_STOP';
  }else if(child.status!==0){
   report.status='STATE_UNKNOWN';report.code='W05_B_COLLECTOR_AFTER_ATTEMPT_UNVERIFIED_STOP';
  }else{
   const name=validateChildSummary(child.stdout);
   const txt=secureRegular(path.join(env.TEMP||os.tmpdir(),name),4000).toString('utf8');
   expect(txt.includes('MODE=MANUAL_CONFIRMED_SERVICE_APPEND')&&
    txt.includes('SERIES=WPSFD42')&&txt.includes('API_REQUESTS=1')&&
    txt.includes('DB_TRANSACTION_COMMITTED=YES')&&
    txt.includes('SERIES_READBACK_VERIFIED=1')&&
    txt.includes('RESULT=PASS_R3C_MANUAL_BLS_PERSISTED'),
    'W05_B_CHILD_LOG_VERIFY_STOP');
   const saved=readbackServiceSnapshot();
   report={...report,...saved,status:'PASS',code:'W05_B_SERVICE_SQLITE_READBACK_VERIFIED',
    providerCalls:1,dbWrites:'COMMITTED_IDEMPOTENT',d1Writes:0};
  }
 }catch(e){
  if(attempted){report.status='STATE_UNKNOWN';}
  report.code= /^W05_B_[A-Z0-9_]+$/.test(e?.code??'')?
   sanitizedCode(e.code):'W05_B_EXECUTION_UNVERIFIED_STOP';
 }
 try{safeReport(report,env)}catch{process.stderr.write('W05_B_RESULT_LOCAL_SAVE_STOP\n');process.exitCode=1}
 process.stdout.write(`W05_B_STATUS=${report.status} CODE=${report.code}\n`);
 if(report.status!=='PASS')process.exitCode=1;
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==2)fail('W05_B_ARGUMENTS_STOP');
 execute();
}
