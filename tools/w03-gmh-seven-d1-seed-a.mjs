// W03 one-shot D1 READ only: compare immutable GMH-only private 7x252
// against the existing approved legacy seed and prior rolling, without writing
// either row or exposing any prices, secrets, or full score histories.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {verifyCandidate,APPROVED_SOURCE_SHA,REPO}
 from './w03-gmh-seven-manual-once.mjs';
import {readSavedCandidate,validateCandidate,PRIVATE_SHA,MANIFEST_SHA}
 from './w03-gmh-seven-public-compat-a.mjs';

export { REPO };
export const TITLE='w03-gmh-seven-d1-seed-readonly';
export const SCHEMA='ZGMINI_W03_GMH_D1_SEED_REQUEST_V1';
export const OUTPUT='ZGMINI_W03_GMH_D1_SEED_RESULT_V1';
const SEED_KEY='public:theme-etf-only:r1';
const ROLLING_KEY='theme-etf-only-rolling';
const R32_KEY='theme-legacy-nine-r37';
const R32_VERSION='THEME_LEGACY_NINE_R37_PUBLIC_V1';
const R32_METHOD='ETF_ONLY_T40_R20_V40_ADAPTIVE_R2_DATED_ISSUER_AUM_R32';
const METHOD='ETF_ONLY_T40_R20_V40_PAIR50';
const SEED_VERSION='THEME_ETF_ONLY_R144_252_PUBLIC_V1';
const ROLLING_VERSION='THEME_ETF_ROLLING_R178';
const CONFIG='E:\\ZGmini\\data\\pc-writer\\config.json';
const OWNER='ansqhd5774-Choi';
const SHA40=/^[a-f0-9]{40}$/;
const HEX64=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const day=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const score=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&
 a.length===b.length&&a.every((x,i)=>x===b[i]);
const keys=['schema','operation','requestId','chatId','controlRepository',
 'controlSourceSha','candidateSourceSha','expectedManifestSha256',
 'expectedPrivateOutputSha256'];
export function authorize(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR===OWNER&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&event.issue.title===TITLE&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install'),
  'W03_GMH_D1_EVENT_STOP');
 let req;try{req=JSON.parse(event.issue.body);}catch{fail('W03_GMH_D1_JSON_STOP')}
 need(req&&typeof req==='object'&&!Array.isArray(req)&&
  Object.keys(req).length===keys.length&&keys.every(k=>Object.hasOwn(req,k))&&
  req.schema===SCHEMA&&req.operation===TITLE&&UUID.test(req.requestId??'')&&
  UUID.test(req.chatId??'')&&req.controlRepository===REPO&&
  req.controlSourceSha===env.GITHUB_SHA&&
  req.candidateSourceSha===APPROVED_SOURCE_SHA&&
  req.expectedManifestSha256===MANIFEST_SHA&&
  req.expectedPrivateOutputSha256===PRIVATE_SHA,
  'W03_GMH_D1_REQUEST_STOP');
 return Object.freeze(req);
}
function readPcBinding(){
 need(process.platform==='win32','W03_GMH_D1_WINDOWS_ONLY_STOP');
 const pcRoot=fs.realpathSync.native('E:\\ZGmini\\data\\pc-writer'),
  file=path.join(pcRoot,'config.json'),st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>10&&st.size<65536&&
  fs.realpathSync.native(file).toLowerCase().startsWith(pcRoot.toLowerCase()+path.sep),
  'W03_GMH_D1_CONFIG_SCOPE_STOP');
 const a=fs.readFileSync(file),b=fs.readFileSync(file);
 need(a.equals(b),'W03_GMH_D1_CONFIG_CHANGED_STOP');
 let config;try{config=JSON.parse(a.toString('utf8'));}
 catch{fail('W03_GMH_D1_CONFIG_JSON_STOP');}
 need(config?.enabled===true&&config.collectionTarget==='pc'&&
  SHA40.test(config.source??'')&&/^[a-f0-9]{32}$/.test(config.account??'')&&
  UUID.test(config.core??'')&&UUID.test(config.history??''),
  'W03_GMH_D1_CONFIG_BINDING_STOP');
 return {account:config.account,core:config.core,history:config.history};
}
const safeJson=(row,size=700000)=>{
 if(!row||typeof row.body!=='string'||Buffer.byteLength(row.body)>size)
  return null;
 try{return JSON.parse(row.body)}catch{return null}
};
const status=x=>['READY','UNAVAILABLE'].includes(x)?x:'OTHER_OR_UNKNOWN';
function validSeed(seed,reference){
 if(seed?.status!=='READY'||seed.version!==SEED_VERSION||
  seed.methodologyVersion!==METHOD||!day(seed.observationDate)||
  !Array.isArray(seed.themes)||seed.themes.length!==7)return false;
 for(let i=0;i<7;i++){
  const a=seed.themes[i],b=reference.themes[i];
  if(a?.theme!==b.theme||!same(a.etfs,b.etfs)||!Array.isArray(a.history)||
   a.history.length!==252||a.history.some((p,j)=>!day(p?.date)||!score(p?.score)||
   j>0&&p.date<=a.history[j-1].date))return false;
 }
 return true;
}
function seedHash(seed){
 return SHA(Buffer.from(JSON.stringify(seed.themes.map(t=>({
  theme:t.theme,etfs:t.etfs,history:t.history
 })))));
}
export function compareD1Seed(candidate,seedRow,rollingRow,r32Row=null){
 validateCandidate(candidate);
 const seed=safeJson(seedRow),rolling=safeJson(rollingRow),
  r32=safeJson(r32Row,1_000_000);
 const valid=validSeed(seed,candidate),rollingPresent=rollingRow!==null;
 let compared=0,shared=new Set(),mismatches=0,maxDiff=0;
 if(valid)for(let i=0;i<7;i++){
  const old=new Map(seed.themes[i].history.map(p=>[p.date,p.score]));
  for(const p of candidate.themes[i].history){
   if(!old.has(p.date))continue;
   compared++;shared.add(p.date);
   const d=Math.abs(old.get(p.date)-p.score);
   if(d>0.00001)mismatches++;
   if(d>maxDiff)maxDiff=d;
  }
 }
 const oldHash=valid?seedHash(seed):null;
 const rollingBaseMatches=rollingPresent&&oldHash&&
  HEX64.test(rolling?.baseHash??'')?rolling.baseHash===oldHash:null;
 const lastRow=rolling?.lineage;
 const r32History252Valid=Array.isArray(r32?.themes)&&
  r32.themes.length===9&&r32.themes.every(t=>Array.isArray(t?.history)&&
   t.history.length===252&&t.history.every((p,i)=>
    day(p?.date)&&score(p?.score)&&
    (i===0||p.date>t.history[i-1].date)));
 // Independent R32 methodology must not be treated as PAIR50 parity.

 const result={
  schema:'ZGMINI_W03_GMH_D1_SEED_FACTS_V1',
  source:'EXISTING_PC_D1_CORE_READ_ONLY',
  observationDate:'2026-11-13',
  inputManifestSha256:MANIFEST_SHA,
  privateOutputSha256:PRIVATE_SHA,
  seedPresent:seedRow!==null,seedSchemaValid:valid,
  seedStoredAt:Number.isSafeInteger(Number(seedRow?.stored_at))?
   Number(seedRow.stored_at):null,
  seedObservationDate:valid?seed.observationDate:null,
  seedBodySha256:seedRow&&typeof seedRow.body==='string'?
   SHA(Buffer.from(seedRow.body)):null,
  seedHistoryHash:oldHash,
  overlapDates:shared.size,comparedScores:compared,mismatchedScores:mismatches,
  maxScoreDifference:compared?Number(maxDiff.toFixed(5)):null,
  rollingPresent,rollingSchema:rolling?.version===ROLLING_VERSION?
   'R178':'OTHER_OR_UNKNOWN',
  rollingStatus:status(rolling?.status),
  rollingStoredAt:Number.isSafeInteger(Number(rollingRow?.stored_at))?
   Number(rollingRow.stored_at):null,
  rollingObservationDate:day(rolling?.observationDate)?
   rolling.observationDate:null,
  rollingBaseHashMatches:rollingBaseMatches,
  rollingPrimaryGmh:rolling?.lineage?.primarySource===
   'GETMARKETHISTORY_1H_CLOSE',
  rollingSecondaryNone:lastRow?.secondarySource===null,
  r32Present:r32Row!==null,
  r32Status:status(r32?.status),
  r32VersionMatch:r32?.version===R32_VERSION,
  r32MethodologyMatch:r32?.methodologyVersion===R32_METHOD,
  r32ObservationDate:day(r32?.observationDate)?r32.observationDate:null,
  r32StoredAt:Number.isSafeInteger(Number(r32Row?.stored_at))?
   Number(r32Row.stored_at):null,
  r32BodySha256:r32Row&&typeof r32Row.body==='string'?
   SHA(Buffer.from(r32Row.body)):null,
  r32History252Valid,
  publicationAuthorized:false,d1SeedCasVerified:false,
  r32NonRegressionVerified:false,
  d1ReadOnly:true,providerCalls:0,d1Writes:0,publicWrites:0
 };
 // D1 read identifies current immutable seed but cannot itself authorize CAS
 // or certify both the immutable seed and a now-stale R32 public overlay.
 return result;
}
export async function readActualD1({sourceRoot,imports}={}){
 need(process.platform==='win32','W03_GMH_D1_WINDOWS_ONLY_STOP');
 verifyCandidate({sourceRoot});
 const modulePath=path.join(sourceRoot,'scripts','pc-writer','d1.mjs');
 const file=fs.lstatSync(modulePath),real=fs.realpathSync.native(modulePath),
  root=fs.realpathSync.native(sourceRoot);
 need(file.isFile()&&!file.isSymbolicLink()&&file.size>1000&&
  file.size<100000&&real.toLowerCase().startsWith(root.toLowerCase()+path.sep),
  'W03_GMH_D1_SOURCE_SCOPE_STOP');
 const mod=imports??await import(pathToFileURL(modulePath).href);
 need(typeof mod.credential==='function'&&typeof mod.client==='function',
  'W03_GMH_D1_CLIENT_CONTRACT_STOP');
 const binding=readPcBinding();
 let token;
 try{token=mod.credential(sourceRoot,{apiToken:null,
  file:path.join(os.homedir(),
   'AppData/Roaming/xdg.config/.wrangler/config/default.toml'),
  refresh:()=>fail('W03_GMH_D1_OAUTH_REFRESH_FORBIDDEN_STOP')});}
 catch{fail('W03_GMH_D1_AUTH_UNAVAILABLE_NO_REFRESH_STOP');}
 // Exactly three fixed SELECTs in a single read-class D1 query batch.
 // Read R32 model separately without altering legacy seed or rolling.
 const statements=[
  {sql:'SELECT body,stored_at FROM market_public_snapshots_v1 WHERE snapshot_key=?',
   params:[SEED_KEY]},
  {sql:"SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key='current'",
   params:[ROLLING_KEY]},
  {sql:"SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key='current'",
   params:[R32_KEY]}
 ];
 let rows;
 try{rows=await mod.client(binding,token).request(binding.core,statements);}
 catch{fail('W03_GMH_D1_READ_UNAVAILABLE_NO_REPLAY_STOP');}
 need(Array.isArray(rows)&&rows.length===3&&
  rows.every(x=>Array.isArray(x?.results)),
  'W03_GMH_D1_RESULT_CONTRACT_STOP');
 return {seed:rows[0].results[0]??null,
  rolling:rows[1].results[0]??null,
  r32:rows[2].results[0]??null};
}
export async function execute({event,env,sourceRoot,
 load=readSavedCandidate,query=readActualD1}={}){
 const req=authorize(event,env);
 need(process.platform==='win32','W03_GMH_D1_WINDOWS_ONLY_STOP');
 const candidate=load(),data=await query({sourceRoot});
 const facts=compareD1Seed(candidate,data.seed,data.rolling,data.r32);
 return {schema:OUTPUT,status:'PASS',code:'W03_GMH_D1_EXISTING_SEED_READONLY',
  requestId:req.requestId,runId:env.GITHUB_RUN_ID??null,
  controlSha:env.GITHUB_SHA,
  facts,providerCalls:0,d1Writes:0,publicWrites:0,rawPricesExposed:false,
  retry:'NO_AUTOMATIC_REEXECUTION'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let out;
 try{
  const env=process.env,event=JSON.parse(
   fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  out=await execute({event,env,
   sourceRoot:path.join(env.GITHUB_WORKSPACE??'','w03-gmh-source')});
 }catch(e){
  out={schema:OUTPUT,status:'STOP',requestId:null,
   code:/^W03_GMH_D1_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
    e.code:'W03_GMH_D1_UNCLASSIFIED_STOP',facts:null};
 }
 try{
  if(!process.env.RUNNER_TEMP||!path.isAbsolute(process.env.RUNNER_TEMP))
   fail('W03_GMH_D1_TEMP_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'w03-gmh-d1-seed-result.json'),
   JSON.stringify(out)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(out.status+' '+out.code+'\n');
 if(out.status!=='PASS')process.exitCode=1;
}
