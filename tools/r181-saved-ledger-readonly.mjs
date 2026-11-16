// W03: fixed one-shot read of R181 already-saved ledger metadata.
// No provider requests, SQLite access, task start, collector execution or D1 writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const OP='r181-saved-ledger-readonly';
export const REQUEST_SCHEMA='ZGMINI_R181_SAVED_LEDGER_A_V1';
export const RESULT_SCHEMA='ZGMINI_R181_SAVED_LEDGER_RESULT_V1';
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const ROOT='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167';
export const SOURCE_SHA='be0303b112d6f4471137aa134bf98f696a8a8dfe60d1d13502646c5e0b509d62';
export const HELPER_SHA='1779d0141bb8ef7eaeb6ccfa3fc6616ad6baa83f3a81f9e59089ac2761e0d171';
export const SYMBOLS=Object.freeze(['SPY','BOTZ','ROBO','SKYY','CLOU','DRIV','NLR','URA','ITA','SHLD','FINX','ARKF','CIBR','BUG']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/;
const HASH=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const allowedRequest=['schema','requestId','chatId','operation','controlRepository','controlSourceSha','cycleSha256','primaryHelperSha256'];
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x?x:null;
const stamp=x=>typeof x==='string'&&x.length<=40&&Number.isFinite(Date.parse(x))?
 new Date(x).toISOString():null;

export function authenticateSavedLedgerA(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR===OWNER&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&event.issue.title===OP&&
  event.issue.labels?.some(l=>l.name==='pc-writer-b-install')&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'R181_LEDGER_A_EVENT_DENIED');
 let req;
 try{req=JSON.parse(event.issue.body);}catch{fail('R181_LEDGER_A_REQUEST_JSON_STOP');}
 need(req&&Object.getPrototypeOf(req)===Object.prototype&&
  Object.keys(req).sort().join(',')===allowedRequest.slice().sort().join(',')&&
  req.schema===REQUEST_SCHEMA&&req.operation===OP&&
  req.controlRepository===REPO&&req.controlSourceSha===env.GITHUB_SHA&&
  req.cycleSha256===SOURCE_SHA&&req.primaryHelperSha256===HELPER_SHA&&
  UUID.test(req.requestId??'')&&UUID.test(req.chatId??''),
  'R181_LEDGER_A_REQUEST_DENIED');
 return Object.freeze(req);
}

export function assessSavedR181Ledger(raw){
 const at=stamp(raw?.at);
 const providerCalls=Number.isSafeInteger(raw?.providerCalls)&&
  raw.providerCalls>=0&&raw.providerCalls<=1000000?raw.providerCalls:null;
 const coverage=raw?.coverage;
 const validCoverage=coverage&&typeof coverage==='object'&&!Array.isArray(coverage)&&
  Object.getPrototypeOf(coverage)===Object.prototype&&Object.keys(coverage).length<=40;
 const keys=validCoverage?Object.keys(coverage):[];
 const symbols=SYMBOLS.map(symbol=>{
  const e=validCoverage&&Object.hasOwn(coverage,symbol)?coverage[symbol]:null;
  return {symbol,bars:Number.isSafeInteger(e?.bars)&&e.bars>0&&e.bars<=1000000?
    e.bars:null,latest15NY:date(e?.latest15NY)};
 });
 const reportedState=raw?.status==='LOCAL_PRIMARY_STORED'?'LOCAL_PRIMARY_STORED':
  raw?.status==='PRIMARY_RAW_STORED'?'PRIMARY_RAW_STORED':
  raw?.status==='NO_NEW_COMPLETE_PRIMARY_DATE'?'NO_NEW_COMPLETE_PRIMARY_DATE':
  'OTHER_OR_UNKNOWN';
 const complete=reportedState!=='OTHER_OR_UNKNOWN'&&at!==null&&
  providerCalls!==null&&providerCalls>0&&validCoverage&&
  keys.length===SYMBOLS.length&&keys.every(key=>SYMBOLS.includes(key))&&
  symbols.every(e=>e.bars!==null&&e.latest15NY!==null);
 return {schema:'ZGMINI_R181_LEDGER_COVERAGE_V1',
  coverageStatus:complete?'LEDGER_REPORTED_COMPLETE':'LEDGER_REPORTED_INCOMPLETE',
  reportedState,reportedAt:at,providerCalls,
  fixedSymbolCount:SYMBOLS.length,
  matchingRows:symbols.filter(e=>e.bars!==null&&e.latest15NY!==null).length,
  unknownSymbolCount:keys.filter(key=>!SYMBOLS.includes(key)).length,
  symbols,evidenceLevel:'LEDGER_METADATA_ONLY_SQLITE_NOT_VERIFIED',
  sqliteOpened:false,rawShaVerified:false,checkpointVerified:false,
  providerCallsThisRun:0,operationalWrites:0,d1Writes:0};
}

function fixedFile(name,size,pin,{read=fs.readFileSync,stat=fs.lstatSync,real=fs.realpathSync.native}={}){
 const file=path.win32.join(ROOT,name);
 const info=stat(file);
 need(info.isFile()&&!info.isSymbolicLink()&&info.size===size,
  'R181_LEDGER_A_SOURCE_SCOPE_STOP');
 need(path.win32.dirname(real(file)).toLowerCase()===real(ROOT).toLowerCase(),
  'R181_LEDGER_A_SOURCE_REDIRECT_STOP');
 const a=read(file),b=read(file);
 need(Buffer.isBuffer(a)&&Buffer.isBuffer(b)&&a.equals(b)&&
  a.length===size&&HASH(a)===pin,
  'R181_LEDGER_A_SOURCE_PIN_STOP');
}
export function readPinnedSavedR181Ledger(io={}){
 need(process.platform==='win32','R181_LEDGER_A_WINDOWS_ONLY_STOP');
 fixedFile('r181-primary-cycle.mjs',7089,SOURCE_SHA,io);
 fixedFile('r181-primary.mjs',4331,HELPER_SHA,io);
 const file=path.win32.join(ROOT,'R181_PRIMARY_LAST_RUN.json');
 const stat=(io.stat??fs.lstatSync)(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=65536,
  'R181_LEDGER_A_LEDGER_SCOPE_STOP');
 const real=io.real??fs.realpathSync.native;
 need(path.win32.dirname(real(file)).toLowerCase()===real(ROOT).toLowerCase(),
  'R181_LEDGER_A_LEDGER_REDIRECT_STOP');
 const read=io.read??fs.readFileSync;
 const a=read(file),b=read(file);
 need(Buffer.isBuffer(a)&&Buffer.isBuffer(b)&&a.equals(b)&&a.length===stat.size,
  'R181_LEDGER_A_LEDGER_CHANGED_STOP');
 let raw;try{raw=JSON.parse(a.toString('utf8'));}catch{
  fail('R181_LEDGER_A_LEDGER_JSON_STOP');}
 need(raw&&Object.getPrototypeOf(raw)===Object.prototype,
  'R181_LEDGER_A_LEDGER_SHAPE_STOP');
 return assessSavedR181Ledger(raw);
}
export function executeSavedLedgerA({event,env,inspect=readPinnedSavedR181Ledger}={}){
 const req=authenticateSavedLedgerA(event,env);
 const coverage=inspect();
 need(coverage?.schema==='ZGMINI_R181_LEDGER_COVERAGE_V1'&&
  coverage.providerCallsThisRun===0&&coverage.operationalWrites===0&&
  coverage.d1Writes===0&&coverage.sqliteOpened===false,
  'R181_LEDGER_A_RESULT_CONTRACT_STOP');
 return {schema:RESULT_SCHEMA,status:'PASS',
  code:'R181_SAVED_LEDGER_READONLY',requestId:req.requestId,
  sourcePinVerified:true,controlSourceSha:env.GITHUB_SHA,coverage};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let out;
 try{
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  out=executeSavedLedgerA({event,env:process.env});
 }catch(e){
  out={schema:RESULT_SCHEMA,status:'STOP',
   code:/^R181_LEDGER_A_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
    e.code:'R181_LEDGER_A_UNCLASSIFIED_STOP',
   requestId:null,sourcePinVerified:false,coverage:null};
 }
 try{
  need(typeof process.env.RUNNER_TEMP==='string'&&path.isAbsolute(process.env.RUNNER_TEMP),
   'R181_LEDGER_A_TEMP_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'r181-saved-ledger-result.json'),
    JSON.stringify(out)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(out.status+' '+out.code+'\n');
 if(out.status!=='PASS')process.exitCode=1;
}