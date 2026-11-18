// W03 R47: bounded private result-pair readback only. Never reads raw prices,
// executes a collector/scorer, touches SQLite, publishes or changes Task state.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='w03-r47-private-readback-once';
export const SCHEMA='ZGMINI_W03_R47_PRIVATE_READBACK_REQUEST_V1';
export const RESULT_SCHEMA='ZGMINI_W03_R47_PRIVATE_READBACK_RESULT_V1';
export const CMD_SHA='b75f7e2cb253b6abb327096e19c49d676c8c75b25bb816ca82756815aec91639';
export const ROSTER_SHA='e2ea97ce0ed0bf15cb083237d63d3cf520e090d8bd229a837bad393c3f8b0c6c';
const ROOT=String.raw`E:\ZGmini\data`;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA40=/^[a-f0-9]{40}$/;
const HEX=/^[a-f0-9]{64}$/;
const NAME=/^THEME_NINE_R47_PRIVATE_(\d{4}-\d{2}-\d{2})_([a-f0-9]{16})_ETF\.json$/;
const REQUEST_KEYS=['schema','operation','requestId','chatId','controlRepository','controlSourceSha','expectedInstalledCmdSha256'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(v,code)=>{if(!v)stop(code);};
const sameKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join('|')===[...keys].sort().join('|');
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&
 Number.isFinite(Date.parse(v+'T00:00:00Z'))&&
 new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const win=x=>path.win32.normalize(x).toLowerCase();

export function authorize(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR==='ansqhd5774-Choi'&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login==='ansqhd5774-Choi'&&
  event.issue?.user?.login==='ansqhd5774-Choi'&&!event.issue.pull_request&&
  event.issue.title===TITLE&&Number.isSafeInteger(event.issue.number)&&
  event.issue.number>0&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install'),
  'W03_R47_READBACK_EVENT_STOP');
 let r;try{r=JSON.parse(event.issue.body);}catch{stop('W03_R47_READBACK_REQUEST_JSON_STOP');}
 need(sameKeys(r,REQUEST_KEYS)&&r.schema===SCHEMA&&r.operation===TITLE&&
  r.controlRepository===REPO&&r.controlSourceSha===env.GITHUB_SHA&&
  r.expectedInstalledCmdSha256===CMD_SHA&&UUID.test(r.requestId??'')&&
  UUID.test(r.chatId??''),
  'W03_R47_READBACK_REQUEST_STOP');
 return r;
}
function fixedRoot(root){
 const wanted=path.resolve(root);
 const actual=fs.realpathSync.native(root);
 need(win(actual)===win(wanted),'W03_R47_READBACK_ROOT_REDIRECT_STOP');
 return actual;
}
function regular(file,max){
 const st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,
  'W03_R47_READBACK_FILE_SCOPE_STOP');
 const actual=fs.realpathSync.native(file);
 need(win(actual)===win(path.resolve(file)),'W03_R47_READBACK_FILE_REDIRECT_STOP');
 const bytes=fs.readFileSync(file);
 need(bytes.length===st.size,'W03_R47_READBACK_FILE_DRIFT_STOP');
 return {bytes,sha256:sha(bytes),mtimeMs:st.mtimeMs};
}
function manifest(root,subdir){
 const dir=path.join(root,'themes',subdir);
 const file=path.join(dir,'raw-manifest.json');
 return regular(file,8*1024*1024).sha256;
}
function readJsonPair(root,firstName,baselineHash,deltaHash){
 const folder=path.join(root,'themes','legacy-nine-r47-private');
 const m=firstName.match(NAME);
 need(m&&date(m[1]),'W03_R47_READBACK_NAME_STOP');
 const a=regular(path.join(folder,firstName),16*1024*1024);
 const bName=firstName.replace(/_ETF\.json$/,'_NINE.json');
 const b=regular(path.join(folder,bName),8*1024*1024);
 need(sha(Buffer.concat([a.bytes,b.bytes])).slice(0,16)===m[2],
  'W03_R47_READBACK_PAIR_DIGEST_STOP');
 let score,theme;
 try{score=JSON.parse(a.bytes),theme=JSON.parse(b.bytes);}
 catch{stop('W03_R47_READBACK_PAIR_JSON_STOP');}
 const source=score?.source;
 need(score?.contract==='THEME_NINE_R47_PRIVATE_INCREMENTAL_INDIVIDUAL_V1'&&
  theme?.contract==='THEME_NINE_R47_PRIVATE_RECURRING_NINE_THEME_SHADOW_V1'&&
  score.publicationAuthorized===false&&theme.publicationAuthorized===false&&
  score.approvedFormula==='EXACT_EXISTING_THEME_OPTIONAL_ADAPTIVE_R2_T40_R20_V40'&&
  theme.aggregation==='EXACT_EXISTING_R32_DATE_REDUCER'&&
  theme.counts?.themes===9&&theme.counts?.approvedETFPositions===64&&
  theme.counts?.uniqueApprovedETFs===63&&theme.counts?.tradingDates===252&&
  score.counts?.themes===9&&score.counts?.approvedETFPositions===64&&
  score.counts?.uniqueApprovedETFs===63&&
  theme.benchmarkDate===m[1]&&source?.latestSpySessionDate===m[1]&&
  JSON.stringify(source)===JSON.stringify(theme.source)&&
  source?.rosterSha256===ROSTER_SHA&&HEX.test(source?.baselineManifestSha256??'')&&
  (source.deltaManifestSha256===null||HEX.test(source.deltaManifestSha256))&&
  Array.isArray(source.deltaCompletedWindows)&&
  source.deltaCompletedWindows.length<=200&&
  Number.isSafeInteger(source.deltaVerifiedPageReferences)&&
  source.deltaVerifiedPageReferences>=0,
  'W03_R47_READBACK_RESULT_CONTRACT_STOP');
 const matching=source.baselineManifestSha256===baselineHash&&
  source.deltaManifestSha256===deltaHash;
 return {status:matching?'PRIVATE_RESULT_PAIR_AND_MANIFEST_SHA_VERIFIED':
  'PRIVATE_RESULT_SOURCE_MANIFEST_CHANGED',
  benchmarkDate:m[1],scoreSha256:a.sha256,themeSha256:b.sha256,
  outputDigest16:m[2],scoreBytes:a.bytes.length,themeBytes:b.bytes.length,
  sourceBaselineSha256:source.baselineManifestSha256,
  sourceDeltaSha256:source.deltaManifestSha256,
  completedWindowCount:source.deltaCompletedWindows.length,
  verifiedPageReferencesAtCalculation:source.deltaVerifiedPageReferences,
  sourceCurrentManifestMatch:matching,
  sourceRawPagesRehashedNow:false,
  providerCalls:0,dbWrites:0,d1Writes:0,
  publicationAuthorized:false};
}
export function inspectR47PrivateSaved({dataRoot=ROOT}={}){
 const result={schema:'ZGMINI_W03_R47_PRIVATE_SHADOW_METADATA_V1',
  status:'STATE_UNKNOWN',code:'R47_PRIVATE_READBACK_NOT_VERIFIED',
  candidateCount:0,latest:null,sourceRawPagesRehashedNow:false,
  providerCalls:0,sqliteOpened:false,pcWrites:0,d1Writes:0,
  taskRunVerified:false};
 try{
  const root=fixedRoot(dataRoot);
  const dir=path.join(root,'themes','legacy-nine-r47-private');
  if(!fs.existsSync(dir))return {...result,status:'NO_PRIVATE_SHADOW',
   code:'R47_PRIVATE_SHADOW_NOT_FOUND'};
  const st=fs.lstatSync(dir);
  need(st.isDirectory()&&!st.isSymbolicLink()&&
   win(fs.realpathSync.native(dir))===win(path.resolve(dir)),
   'W03_R47_READBACK_DIRECTORY_STOP');
  const all=fs.readdirSync(dir,{withFileTypes:true});
  need(all.length<=4096,'W03_R47_READBACK_DIRECTORY_LIMIT_STOP');
  const names=all.map(x=>x.name).filter(x=>NAME.test(x));
  if(!names.length)return {...result,status:'NO_PRIVATE_SHADOW',
   code:'R47_PRIVATE_SHADOW_NOT_FOUND'};
  need(names.length<=512,'W03_R47_READBACK_PAIR_LIMIT_STOP');
  const pairs=names.map(n=>{const m=n.match(NAME);
   return {name:n,date:m[1],mtimeMs:fs.lstatSync(path.join(dir,n)).mtimeMs};});
  pairs.sort((a,b)=>b.date.localeCompare(a.date)||b.mtimeMs-a.mtimeMs||a.name.localeCompare(b.name));
  const baselineHash=manifest(root,'legacy-nine-r23');
  const deltaDir=path.join(root,'themes','legacy-nine-r35-delta');
  const deltaHash=fs.existsSync(deltaDir)?
   manifest(root,'legacy-nine-r35-delta'):null;
  const latest=readJsonPair(root,pairs[0].name,baselineHash,deltaHash);
  return {...result,status:latest.status,code:latest.status,
   candidateCount:pairs.length,latest};
 }catch(error){
  return {...result,status:'STOP',code:/^W03_R47_READBACK_[A-Z0-9_]+$/.test(error?.code??'')?
   error.code:'W03_R47_READBACK_UNEXPECTED_STOP'};
 }
}
export function execute({event,env,inspect=inspectR47PrivateSaved}={}){
 const r=authorize(event,env),payload=inspect();
 need(payload?.schema==='ZGMINI_W03_R47_PRIVATE_SHADOW_METADATA_V1'&&
  payload.providerCalls===0&&payload.sqliteOpened===false&&
  payload.pcWrites===0&&payload.d1Writes===0&&
  payload.taskRunVerified===false,
  'W03_R47_READBACK_OUTPUT_SCOPE_STOP');
 return {schema:RESULT_SCHEMA,requestId:r.requestId,controlSha:env.GITHUB_SHA,
  status:payload.status,code:payload.code,metadata:payload};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let record;
 try{const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  record=execute({event,env:process.env});}
 catch(error){record={schema:RESULT_SCHEMA,requestId:null,controlSha:null,
   status:'STOP',code:/^W03_R47_READBACK_[A-Z0-9_]+$/.test(error?.code??'')?
    error.code:'W03_R47_READBACK_UNEXPECTED_STOP',metadata:null};}
 try{
  const tmp=process.env.RUNNER_TEMP;
  need(typeof tmp==='string'&&path.isAbsolute(tmp),
   'W03_R47_READBACK_TEMP_STOP');
  fs.writeFileSync(path.join(tmp,'w03-r47-private-readback-result.json'),
   JSON.stringify(record)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(record.status+' '+record.code+'\n');
 if(record.status==='STOP')process.exitCode=1;
}
