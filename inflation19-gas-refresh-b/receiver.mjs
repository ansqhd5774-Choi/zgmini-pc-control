// Candidate fixed B receiver; NOT deployed. One immutable Issue opens one
// preapproved, single-FRED-series bounded refresh. Never touches #251 marker.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseEnv} from 'node:util';
import {runGasRefresh,WRITER_HOME,GAS_RELATIVE,PRIOR_SHA_251,EXPECTED_DATE,EXPECTED_VALUE} from './gas-refresh.mjs';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const SOURCE_SHA='de262f47003e3c32fb685cf2c9b1e3edb1ec1b19';
export const TITLE='pc-inflation-gas-refresh-approved-once';
export const SCHEMA='ZGMINI_INFLATION_GAS_REFRESH_B_V1';
export const OPERATION='refresh-gas-dhhngsp-private-once';
export const APPROVAL='inflation19-gas-refresh-b/inflation-gas-refresh-b-approval.json';
export const RESULT='INFLATION_GAS_REFRESH_B_RESULT.json';
export const MARKER_ROOT=String.raw`E:\ZGmini\data\pc-writer\inflation-gas-refresh-20261105-guard`;
const WRITER_FILE=path.win32.join(WRITER_HOME,...GAS_RELATIVE.split('/'));
const SOURCE_FILES=Object.freeze({
 'scripts/inflation-causal-gas-electric.mjs':'3f729b8637337f86088d85f3e37c7921477681066c05422a6bcebd91d6a2c541',
 'scripts/pc-writer/quota-fetch.mjs':'c0b05af49be44989096d5d48286837af1fa02570efa256fab7a219b85271b478',
 'scripts/pc-writer/quota-ledger.mjs':'24aa7558917dfed86e3661a8b58bfaaf2642dcc26d98d1a39f7a5ab3b37bb1aa',
 'scripts/pc-writer/quota-policy.mjs':'0308da3589feabcf6c628a1d2a543f82f4fe7a39909e54cb68e0b50a645c0ede',
});
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQ=new RegExp(`^pc-infl-gas-refresh-${UUID}$`);
const CHAT=new RegExp(`^chat-${UUID}$`);
const stop=code=>{throw Error(code)};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const safeCode=e=>/^GAS_REFRESH_[A-Z0-9_]{2,70}$/.test(e?.message??'')?
 e.message:'GAS_REFRESH_UNEXPECTED_STOP';
function regular(file,max=8_000_000){
 const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||
  s.size<1||s.size>max)stop('GAS_REFRESH_FILE_SHAPE_DENIED');
 return fs.readFileSync(file);
}
function simpleDir(dir){const s=fs.lstatSync(dir);if(!s.isDirectory()||
 s.isSymbolicLink()||path.win32.normalize(fs.realpathSync.native(dir)).toLowerCase()!==
 path.win32.normalize(dir).toLowerCase())stop('GAS_REFRESH_DIR_DENIED');}

export function validateRequest(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  env.GITHUB_RUN_ATTEMPT!=='1'||event?.action!=='opened'||
  event?.repository?.private!==true||event?.repository?.full_name!==REPO||
  event?.issue?.user?.login!=='ansqhd5774-Choi'||
  event?.issue?.title!==TITLE)stop('GAS_REFRESH_ISSUE_DENIED');
 let b;try{b=JSON.parse(event.issue.body)}catch{stop('GAS_REFRESH_JSON_DENIED')}
 if(!b||Array.isArray(b)||Object.keys(b).sort().join('|')!==
  ['schema','operation','sourceSha','requestId','chatId'].sort().join('|')||
  b.schema!==SCHEMA||b.operation!==OPERATION||b.sourceSha!==SOURCE_SHA||
  !REQ.test(b.requestId)||!CHAT.test(b.chatId)||
  b.requestId.slice('pc-infl-gas-refresh-'.length)!==b.chatId.slice('chat-'.length))
   stop('GAS_REFRESH_REQUEST_DENIED');
 return b;
}
export function verifyManifest(approval){
 if(approval?.approved!==true||approval.schema!==SCHEMA||
  approval.scope!=='GAS_DHHNGSP_SINGLE_REFRESH_B'||
  approval.sourceRepository!==SOURCE_REPO||approval.sourceSha!==SOURCE_SHA||
  approval.writerHome!==WRITER_HOME||approval.priorGasSha256!==PRIOR_SHA_251||
  approval.outputRelative!==GAS_RELATIVE||approval.maxProviderRequests!==1||
  approval.expectedLatestObservation!==EXPECTED_DATE||
  approval.expectedValueForLatest!==EXPECTED_VALUE||
  approval.maxAutomaticRetries!==0||approval.allowCoreWrites!==false||
  approval.allowDbWrites!==false||approval.allowD1Writes!==false||
  approval.allowSchedulerChanges!==false||approval.allowRawPublic!==false||
  JSON.stringify(approval.sourceFileHashes)!==JSON.stringify(SOURCE_FILES)||
  approval.markerRoot!==MARKER_ROOT)
  stop('GAS_REFRESH_MANIFEST_DENIED');
 return true;
}
function sourceModule(base,relative){
 let parent=base;
 for(const part of relative.split('/').slice(0,-1)){
  parent=path.join(parent,part);simpleDir(parent);
 }
 const f=path.join(base,...relative.split('/'));
 const bytes=regular(f,250000);
 if(digest(bytes)!==SOURCE_FILES[relative])stop('GAS_REFRESH_SOURCE_FILE_DRIFT');
 return pathToFileURL(f).href;
}
export function validateBaseline({workspace,gitExe}){
 simpleDir(workspace);
 const source=path.join(workspace,'source');simpleDir(source);
 const git=gitExe??String.raw`C:\Program Files\Git\cmd\git.exe`;
 const head=execFileSync(git,['-c','core.fsmonitor=false','-C',source,'rev-parse','HEAD'],{
  encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1000,
  stdio:['ignore','pipe','ignore']}).trim();
 if(head!==SOURCE_SHA)stop('GAS_REFRESH_SOURCE_HEAD_DRIFT');
 for(const rel of Object.keys(SOURCE_FILES))sourceModule(source,rel);
 simpleDir(WRITER_HOME);
 if(digest(regular(WRITER_FILE))!==PRIOR_SHA_251)
  stop('GAS_REFRESH_PRIOR_SHA_DRIFT');
 return source;
}

// Never delete or reuse #251's global ONCE_STARTED marker. A distinct, fixed
// one-shot guard is created only AFTER all no-write preflight checks pass.
export function reserveRun(req){
 // Any already-existing backup indicates earlier or parallel intervention.
 // Consume neither marker nor provider quota in that case.
 const backup=WRITER_FILE+'.before-gas-refresh-20261105';
 if(fs.existsSync(backup))stop('GAS_REFRESH_BACKUP_ALREADY_EXISTS');
 if(!fs.existsSync(MARKER_ROOT))fs.mkdirSync(MARKER_ROOT);
 simpleDir(MARKER_ROOT);
 const marker=path.join(MARKER_ROOT,'ONCE_STARTED.json');
 try{fs.writeFileSync(marker,JSON.stringify({requestId:req.requestId,
  sourceSha:SOURCE_SHA,at:new Date().toISOString()}),{flag:'wx',mode:0o600})}
 catch(e){if(e?.code==='EEXIST')stop('GAS_REFRESH_ALREADY_ATTEMPTED');throw e}
 // Preserve exact old bytes for supervised recovery. Never auto-restore when
 // an execution might still be running or its side effects are uncertain.
 const old=regular(WRITER_FILE);
 if(digest(old)!==PRIOR_SHA_251)stop('GAS_REFRESH_PRIOR_SHA_DRIFT');
 try{fs.writeFileSync(backup,old,{flag:'wx',mode:0o600})}
 catch(e){if(e?.code==='EEXIST')stop('GAS_REFRESH_BACKUP_ALREADY_EXISTS');throw e}
 if(digest(regular(backup))!==PRIOR_SHA_251)stop('GAS_REFRESH_BACKUP_MISMATCH');
}

export async function execute({event,env,runner=runGasRefresh}={}){
 let report={schema:SCHEMA,status:'BLOCKED',code:'GAS_REFRESH_NOT_STARTED',
  sourceSha:SOURCE_SHA,providerCalls:0,coreWrites:0,dbWrites:0,d1Writes:0,
  schedulerWrites:0,oldMarkerModified:false};
 let effectsPossible=false;
 try{
  if(process.platform!=='win32')stop('GAS_REFRESH_WINDOWS_ONLY');
  const req=validateRequest(event,env);
  const ws=env.GITHUB_WORKSPACE;
  if(typeof ws!=='string'||!path.win32.isAbsolute(ws))
   stop('GAS_REFRESH_WORKSPACE_DENIED');
  simpleDir(ws);
  const manifest=JSON.parse(regular(path.join(ws,'control',APPROVAL),8000));
  verifyManifest(manifest);
  const source=validateBaseline({workspace:ws});
  const config=parseEnv(regular(path.join(WRITER_HOME,'providers.env'),100000).toString('utf8'));
  const key=config.FRED_API_KEY??config.FRED_KEY;
  if(typeof key!=='string'||!key.trim())stop('GAS_REFRESH_KEY_MISSING');
  const {collectGas}=await import(sourceModule(source,'scripts/inflation-causal-gas-electric.mjs'));
  const {createQuotaFetch}=await import(sourceModule(source,'scripts/pc-writer/quota-fetch.mjs'));
  const quota=createQuotaFetch({base:WRITER_HOME,originalFetch:fetch,mode:'enforce'});
  if(typeof quota?.fetch!=='function')stop('GAS_REFRESH_QUOTA_UNAVAILABLE');
  // Once an attempt to write the one-shot receipt begins, the runner must
  // regard every error as uncertain. A failed backup or collector is NOT a
  // safe reason to retry the provider call or delete the receipt.
  effectsPossible=true;
  report.providerCalls=null;
  reserveRun(req);
  const r=await runner({fredKey:key,quotaFetch:quota.fetch,collector:collectGas});
  if(r?.latest<EXPECTED_DATE||r?.expectedObservationValue!==EXPECTED_VALUE)
   stop('GAS_REFRESH_EXPECTED_OBSERVATION_MISSING');
  report={...report,...r,requestId:req.requestId,
   code:r.code==='UNCHANGED'?'GAS_REFRESH_UNCHANGED':'GAS_REFRESH_SAVED_READBACK',
   backupSha256:PRIOR_SHA_251};
 }catch(error){report={...report,status:effectsPossible?'STATE_UNKNOWN':'BLOCKED',
   code:safeCode(error)}}
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 // Upload is a separate token-bearing step. No token or network credentials
 // are passed to provider execution beyond the approved local FRED key.
 if(process.argv.length!==2)stop('GAS_REFRESH_ARGUMENTS_DENIED');
 let report;
 try{
  const event=JSON.parse(regular(process.env.GITHUB_EVENT_PATH,100000));
  report=await execute({event,env:process.env});
 }catch(error){report={schema:SCHEMA,status:'BLOCKED',code:safeCode(error)}}
 try{fs.writeFileSync(path.join(process.env.GITHUB_WORKSPACE,RESULT),
  JSON.stringify(report)+'\n',{flag:'wx',mode:0o600})}
 catch{process.stderr.write('GAS_REFRESH_RESULT_UNSAVED\n')}
 process.stdout.write(`STATUS=${report.status} CODE=${report.code}\n`);
 if(report.status!=='PASS')process.exitCode=1;
}
