// W03 11/68: verify actual R48 private-only candidate and exact R47
// ETF/NINE source pair. Fixed local files, bounded read-only, no source execution.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='w03-r48-private-readback-once';
export const SCHEMA='ZGMINI_W03_R48_PRIVATE_READBACK_REQUEST_V1';
export const RESULT='ZGMINI_W03_R48_PRIVATE_READBACK_RESULT_V1';
export const APPROVAL='approvals/w03-r48-readback/20261118-private-candidate-readonly.json';
const ROOT=String.raw`E:\ZGmini\data`;
const APPROVAL_FIELDS=['schema','status','scope','operation','dataRoot',
 'maxCandidateFiles','providerCallsAllowed','rawDataExportAllowed',
 'sqliteAccessAllowed','pcWritesAllowed','d1WritesAllowed',
 'taskChangesAllowed','maxRuns'];
const REQUEST_FIELDS=['schema','operation','requestId','chatId',
 'controlRepository','controlSourceSha','approvalManifestPath','approvalManifestSha256'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HEX=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const R48=/^THEME_NINE_R48_PRIVATE_CANDIDATE_(\d{4}-\d{2}-\d{2})_([a-f0-9]{16})\.json$/;
const R47=/^THEME_NINE_R47_PRIVATE_(\d{4}-\d{2}-\d{2})_([a-f0-9]{16})_ETF\.json$/;
const BATCH_9='THEME_NINE_R48_R47_PRIVATE_R37_CANDIDATE_V1';
const MODE='RAW_UNADJUSTED_1H_NOT_OFFICIAL_CLOSE';
const FORMULA='ETF_ONLY_T40_R20_V40_ADAPTIVE_R2_DATED_ISSUER_AUM_R32';
const ROSTER='e2ea97ce0ed0bf15cb083237d63d3cf520e090d8bd229a837bad393c3f8b0c6c';
const sha=x=>createHash('sha256').update(x).digest('hex');
const stop=x=>{throw Object.assign(new Error(x),{code:x});};
const require=x=>{if(!x)stop('W03_R48_READBACK_INPUT_OR_CONTRACT_STOP');};
const keys=(x,a)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).sort().join('|')===[...a].sort().join('|');
const day=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const win=x=>path.win32.normalize(x).toLowerCase();
const same=(a,b)=>process.platform==='win32'?win(a)===win(b):a===b;

export function authorize(event,env){
 require(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR==='ansqhd5774-Choi'&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.action==='opened'&&event?.repository?.full_name===REPO&&
  event.repository.private===true&&event.sender?.login==='ansqhd5774-Choi'&&
  event.issue?.user?.login==='ansqhd5774-Choi'&&
  event.issue?.title===TITLE&&!event.issue.pull_request&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install'));
 let req;try{req=JSON.parse(event.issue.body);}catch{stop('W03_R48_READBACK_REQUEST_JSON_STOP');}
 require(keys(req,REQUEST_FIELDS)&&req.schema===SCHEMA&&req.operation===TITLE&&
  UUID.test(req.requestId??'')&&UUID.test(req.chatId??'')&&
  req.controlRepository===REPO&&req.controlSourceSha===env.GITHUB_SHA&&
  req.approvalManifestPath===APPROVAL&&HEX.test(req.approvalManifestSha256??''));
 const loc=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..',APPROVAL);
 const bytes=regular(loc,4096);
 require(bytes.sha===req.approvalManifestSha256);
 let approval;try{approval=JSON.parse(bytes.body);}catch{stop('W03_R48_READBACK_APPROVAL_JSON_STOP');}
 require(keys(approval,APPROVAL_FIELDS)&&
  approval.schema==='ZGMINI_W03_R48_PRIVATE_READBACK_APPROVAL_V1'&&
  approval.status==='APPROVED_B'&&
  approval.scope==='PRIVATE_R48_CANDIDATE_SHA_R47_PAIR_READONLY_ONCE'&&
  approval.operation===TITLE&&approval.dataRoot===ROOT&&
  approval.maxCandidateFiles===512&&approval.maxRuns===1&&
  approval.providerCallsAllowed===false&&approval.rawDataExportAllowed===false&&
  approval.sqliteAccessAllowed===false&&approval.pcWritesAllowed===false&&
  approval.d1WritesAllowed===false&&approval.taskChangesAllowed===false);
 return req;
}
function canonicalDir(dir){
 const stat=fs.lstatSync(dir);
 require(stat.isDirectory()&&!stat.isSymbolicLink()&&
  same(fs.realpathSync.native(dir),path.resolve(dir)));
 return dir;
}
function regular(loc,max){
 const st=fs.lstatSync(loc);
 require(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max&&
  same(fs.realpathSync.native(loc),path.resolve(loc)));
 const body=fs.readFileSync(loc);
 require(body.length===st.size);
 return {body,sha:sha(body),bytes:body.length};
}
function candidateMeta(home,name){
 const f=regular(path.join(home,name),6*1024*1024);
 const m=name.match(R48);
 require(m&&day(m[1])&&f.sha.startsWith(m[2]));
 let c;try{c=JSON.parse(f.body);}catch{stop('W03_R48_READBACK_CANDIDATE_JSON_STOP');}
 require(c?.contract===BATCH_9&&c.status==='PRIVATE_CANDIDATE_NOT_PUBLISHED'&&
  c.publicationAuthorized===false&&c.upstreamCommercialRightsVerified===false&&
  c.derivedLicenseVerified===false&&c.sourcePriceReconciled===false&&
  c.sourceManifestVerified===false&&c.privateReplayVerified===false&&
  c.sourcePriceMode===MODE&&c.methodologyVersion===FORMULA&&
  c.rosterSha256===ROSTER&&c.phase==='CONFIRMED'&&
  c.observationDate===m[1]&&c.sourceStoredAt===null&&c.publishedAt===null&&
  c.baselineManifestSha256&&HEX.test(c.baselineManifestSha256)&&
  (c.deltaManifestSha256===null||HEX.test(c.deltaManifestSha256))&&
  HEX.test(c.r25InputSha256??'')&&HEX.test(c.shadowSha256??'')&&
  HEX.test(c.rawManifestSha256??'')&&
  c.ETFPositions===64&&c.uniqueETFs===63&&
  Array.isArray(c.themes)&&c.themes.length===9);
 const names=new Set();
 for(const t of c.themes){
  require(typeof t?.theme==='string'&&t.theme.length>0&&
   t.theme.length<129&&!names.has(t.theme)&&
   Array.isArray(t.history)&&t.history.length===252&&
   typeof t.score==='number'&&t.score>=0&&t.score<=100);
  names.add(t.theme);
  let previous='';
  for(const r of t.history){
   require(day(r?.date)&&r.date>previous&&
    typeof r.score==='number'&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100);
   previous=r.date;
  }
  require(t.history.at(-1)?.date===m[1]&&t.history.at(-1)?.score===t.score);
 }
 return {date:m[1],sha:f.sha,bytes:f.bytes,c};
}
function findParent(root,date,c){
 const home=canonicalDir(path.join(root,'themes','legacy-nine-r47-private'));
 const files=fs.readdirSync(home,{withFileTypes:true});
 require(files.length<=4096);
 const sameDate=files.filter(f=>f.isFile()&&R47.test(f.name)&&
  f.name.slice('THEME_NINE_R47_PRIVATE_'.length).startsWith(date+'_'));
 require(sameDate.length<=512);
 for(const entry of sameDate){
  const a=regular(path.join(home,entry.name),12*1024*1024);
  if(a.sha!==c.r25InputSha256)continue;
  const partner=entry.name.replace(/_ETF\.json$/,'_NINE.json');
  const b=regular(path.join(home,partner),4*1024*1024);
  if(b.sha!==c.shadowSha256)continue;
  const expected=entry.name.match(R47);
  require(sha(Buffer.concat([a.body,b.body])).startsWith(expected[2]));
  let source;try{source=JSON.parse(b.body).source;}catch{
   stop('W03_R48_READBACK_PARENT_SOURCE_JSON_STOP');
  }
  require(source?.baselineManifestSha256===c.baselineManifestSha256&&
   source.deltaManifestSha256===c.deltaManifestSha256&&
   source.latestSpySessionDate===date&&Array.isArray(source.deltaCompletedWindows)&&
   source.deltaCompletedWindows.length<=200);
  const descriptor=sha(Buffer.from(JSON.stringify({
   baselineManifestSha256:source.baselineManifestSha256,
   deltaManifestSha256:source.deltaManifestSha256,
   deltaCompletedWindows:source.deltaCompletedWindows
  })));
  require(descriptor===c.rawManifestSha256);
  return {found:true,r47EtfSha:a.sha,r47NineSha:b.sha,
   rawManifestSummarySha:c.rawManifestSha256,
   completedWindowCount:source.deltaCompletedWindows.length};
 }
 return {found:false};
}
export function inspect({dataRoot=ROOT}={}){
 const empty={schema:'ZGMINI_W03_R48_PRIVATE_OBSERVATION_V1',
  status:'STATE_UNKNOWN',code:'W03_R48_READBACK_NO_PROOF',
  candidateCount:0,latestR47Date:null,latest:null,rawPagesRehashedNow:false,
  taskExecutionVerified:false,providerCalls:0,sqliteOpened:false,pcWrites:0,
  d1Writes:0,publicationWrites:0};
 try{
  canonicalDir(dataRoot);
  const candidateDir=path.join(dataRoot,'themes','legacy-nine-r48-private-candidate');
  if(!fs.existsSync(candidateDir))return {...empty,status:'NO_R48_CANDIDATE',
   code:'NO_R48_CANDIDATE'};
  canonicalDir(candidateDir);
  const sourceDir=canonicalDir(path.join(dataRoot,'themes','legacy-nine-r47-private'));
  const r47Files=fs.readdirSync(sourceDir);
  require(r47Files.length<=4096);
  const r47Dates=r47Files.map(f=>f.match(R47)?.[1]).filter(day);
  const latestR47Date=r47Dates.length?r47Dates.sort().at(-1):null;
  const files=fs.readdirSync(candidateDir,{withFileTypes:true});
  require(files.length<=4096);
  const choices=files.filter(x=>x.isFile()&&R48.test(x.name));
  if(!choices.length)return {...empty,status:'NO_R48_CANDIDATE',
   code:'NO_R48_CANDIDATE',latestR47Date};
  require(choices.length<=512);
  const ordered=choices.map(x=>({name:x.name,date:x.name.match(R48)[1],
   modified:fs.lstatSync(path.join(candidateDir,x.name)).mtimeMs}))
   .sort((a,b)=>b.date.localeCompare(a.date)||b.modified-a.modified||a.name.localeCompare(b.name));
  const latest=candidateMeta(candidateDir,ordered[0].name);
  const parent=findParent(dataRoot,latest.date,latest.c);
  const baseline=regular(path.join(dataRoot,'themes','legacy-nine-r23','raw-manifest.json'),8*1024*1024);
  const delta=regular(path.join(dataRoot,'themes','legacy-nine-r35-delta','raw-manifest.json'),8*1024*1024);
  const sourceMatch=latest.c.baselineManifestSha256===baseline.sha&&
   latest.c.deltaManifestSha256===delta.sha;
  const dateMatch=latest.date===latestR47Date;
  const code=!parent.found?'R48_PARENT_PAIR_NOT_FOUND':
   !sourceMatch?'R48_SOURCE_MANIFEST_CHANGED':
   !dateMatch?'R48_STALE_VS_LATEST_R47':
   'R48_CURRENT_PRIVATE_CANDIDATE_SHA_VERIFIED';
  const status=code==='R48_CURRENT_PRIVATE_CANDIDATE_SHA_VERIFIED'?'PASS':'PARTIAL';
  return {...empty,status,code,candidateCount:choices.length,latestR47Date,
   latest:{date:latest.date,candidateSha256:latest.sha,
    candidateBytes:latest.bytes,privateThemes:9,privateHistoryRows:2268,
    parentPairMatched:parent.found,currentSourceManifestMatched:sourceMatch,
    latestR47DateMatched:dateMatch,
    r47EtfSha256:parent.r47EtfSha??null,
    r47NineSha256:parent.r47NineSha??null,
    sourceSummarySha256:parent.rawManifestSummarySha??null,
    completedWindowCount:parent.completedWindowCount??null}};
 }catch(error){return {...empty,status:'STOP',code:
  /^W03_R48_READBACK_[A-Z0-9_]+$/.test(error?.code??'')?error.code:
  'W03_R48_READBACK_UNEXPECTED_STOP'};}
}
export function execute({event,env,reader=inspect}={}){
 const req=authorize(event,env),data=reader();
 require(data.schema==='ZGMINI_W03_R48_PRIVATE_OBSERVATION_V1'&&
  data.rawPagesRehashedNow===false&&data.taskExecutionVerified===false&&
  data.providerCalls===0&&data.sqliteOpened===false&&
  data.pcWrites===0&&data.d1Writes===0&&data.publicationWrites===0);
 return {schema:RESULT,requestId:req.requestId,controlSha:env.GITHUB_SHA,
  status:data.status,code:data.code,details:data};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;
 try{result=execute({event:JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),
  env:process.env});}
 catch(e){result={schema:RESULT,requestId:null,controlSha:null,status:'STOP',
  code:/^W03_R48_READBACK_[A-Z0-9_]+$/.test(e?.code??'')?e.code:
   'W03_R48_READBACK_EXECUTE_UNEXPECTED_STOP',details:null};}
 try{require(typeof process.env.RUNNER_TEMP==='string'&&
  path.isAbsolute(process.env.RUNNER_TEMP));
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'w03-r48-readback.json'),
   JSON.stringify(result)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status==='STOP')process.exitCode=1;
}
