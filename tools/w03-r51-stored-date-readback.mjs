// W03 stage12: bounded metadata-only R51 provisional private source check.
// No provider, public API, raw prices, SQLite, D1, scheduler, or PC writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='w03-r51-stored-date-readback-once';
export const SCHEMA='ZGMINI_W03_R51_STORED_DATE_REQUEST_V1';
export const RESULT='ZGMINI_W03_R51_STORED_DATE_RESULT_V1';
export const APPROVAL='approvals/w03-r51-readback/20261118-stored-only.json';
const ROOT='E:\\ZGmini\\data';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HEX=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const R51=/^THEME_NINE_R51_PRIVATE_PROVISIONAL_(20\d\d-\d\d-\d\d)_(20\d\d-\d\d-\d\d)_([a-f0-9]{16})\.json$/;
const R48=/^THEME_NINE_R48_PRIVATE_CANDIDATE_(20\d\d-\d\d-\d\d)_([a-f0-9]{16})\.json$/;
const keys=(x,arr)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).sort().join('|')===[...arr].sort().join('|');
const reqKeys=['schema','operation','requestId','chatId','controlRepository','controlSourceSha','approvalManifestPath','approvalManifestSha256'];
const approvalKeys=['schema','status','scope','operation','dataRoot','maxFiles','allowProviderCalls','allowPublicGets','allowSqlite','allowPCWrites','allowD1','allowTaskChanges','maxRuns'];
const sha=v=>createHash('sha256').update(v).digest('hex');
const stop=x=>{throw Object.assign(new Error(x),{code:x});};
const check=(x,c='W03_R51_READBACK_CONTRACT_STOP')=>{if(!x)stop(c);};
const date=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\d$/.test(x)&&
 !Number.isNaN(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const same=(a,b)=>process.platform==='win32'?
 path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase():a===b;
function safeDir(loc){
 const st=fs.lstatSync(loc);
 check(st.isDirectory()&&!st.isSymbolicLink()&&
  same(fs.realpathSync.native(loc),path.resolve(loc)),'W03_R51_READBACK_DIRECTORY_STOP');
}
function safeFile(loc,max){
 const st=fs.lstatSync(loc);
 check(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max&&
  same(fs.realpathSync.native(loc),path.resolve(loc)),'W03_R51_READBACK_FILE_STOP');
 const b=fs.readFileSync(loc);
 check(b.length===st.size,'W03_R51_READBACK_FILE_DRIFT_STOP');
 return {bytes:b,sha256:sha(b),size:b.length};
}
export function authorize(event,env){
 check(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR==='ansqhd5774-Choi'&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.action==='opened'&&event.repository?.full_name===REPO&&
  event.repository.private===true&&event.sender?.login==='ansqhd5774-Choi'&&
  event.issue?.user?.login==='ansqhd5774-Choi'&&
  event.issue?.title===TITLE&&!event.issue.pull_request&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install'),
  'W03_R51_READBACK_EVENT_STOP');
 let r;try{r=JSON.parse(event.issue.body)}catch{stop('W03_R51_READBACK_JSON_STOP')}
 check(keys(r,reqKeys)&&r.schema===SCHEMA&&r.operation===TITLE&&
  UUID.test(r.requestId??'')&&UUID.test(r.chatId??'')&&
  r.controlRepository===REPO&&r.controlSourceSha===env.GITHUB_SHA&&
  r.approvalManifestPath===APPROVAL&&HEX.test(r.approvalManifestSha256??''),
  'W03_R51_READBACK_REQUEST_STOP');
 const loc=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..',APPROVAL);
 const a=safeFile(loc,4096);
 check(a.sha256===r.approvalManifestSha256,'W03_R51_READBACK_APPROVAL_SHA_STOP');
 let p;try{p=JSON.parse(a.bytes)}catch{stop('W03_R51_READBACK_APPROVAL_JSON_STOP')}
 check(keys(p,approvalKeys)&&p.schema==='ZGMINI_W03_R51_READBACK_APPROVAL_V1'&&
  p.status==='APPROVED_B'&&p.scope==='R51_SAVED_PRIVATE_DATE_SHA_READONLY'&&
  p.operation===TITLE&&p.dataRoot===ROOT&&p.maxFiles===512&&p.maxRuns===1&&
  p.allowProviderCalls===false&&p.allowPublicGets===false&&
  p.allowSqlite===false&&p.allowPCWrites===false&&
  p.allowD1===false&&p.allowTaskChanges===false,
  'W03_R51_READBACK_APPROVAL_SCOPE_STOP');
 return r;
}
function parentR48(dataRoot,confirmedDate,expected){
 const folder=path.join(dataRoot,'themes','legacy-nine-r48-private-candidate');
 safeDir(folder);
 const all=fs.readdirSync(folder,{withFileTypes:true});
 check(all.length<=4096,'W03_R51_READBACK_PARENT_LIST_STOP');
 const entries=all.filter(x=>x.isFile()&&R48.test(x.name)&&x.name.match(R48)[1]===confirmedDate);
 check(entries.length<=512,'W03_R51_READBACK_PARENT_LIMIT_STOP');
 for(const item of entries){
  const f=safeFile(path.join(folder,item.name),6*1048576);
  check(f.sha256.startsWith(item.name.match(R48)[2]),'W03_R51_READBACK_PARENT_FILE_SHA_STOP');
  let parsed;try{parsed=JSON.parse(f.bytes)}catch{stop('W03_R51_READBACK_PARENT_JSON_STOP')}
  if(parsed?.contract!=='THEME_NINE_R48_R47_PRIVATE_R37_CANDIDATE_V1'||
   parsed.observationDate!==confirmedDate||parsed.publicationAuthorized!==false)continue;
  if(sha(Buffer.from(JSON.stringify(parsed)))===expected)
   return {matched:true,fileSha256:f.sha256};
 }
 return {matched:false,fileSha256:null};
}
export function inspect({dataRoot=ROOT}={}){
 const base={schema:'ZGMINI_W03_R51_SAVED_PRIVATE_METADATA_V1',
  status:'STATE_UNKNOWN',code:'R51_SAVED_NOT_VERIFIED',candidateCount:0,
  latest:null,providerCalls:0,publicGets:0,sqliteOpened:false,
  pcWrites:0,d1Writes:0,publicationWrites:0,
  rawPagesRehashedNow:false,taskExecutionVerified:false};
 try{
  safeDir(dataRoot);
  const folder=path.join(dataRoot,'themes','legacy-nine-r51-private-provisional');
  if(!fs.existsSync(folder))return {...base,status:'NO_R51_CANDIDATE',code:'NO_R51_CANDIDATE'};
  safeDir(folder);
  const all=fs.readdirSync(folder,{withFileTypes:true});
  check(all.length<=4096,'W03_R51_READBACK_LIST_STOP');
  const names=all.filter(x=>x.isFile()&&R51.test(x.name));
  check(names.length<=512,'W03_R51_READBACK_LIST_LIMIT_STOP');
  if(!names.length)return {...base,status:'NO_R51_CANDIDATE',code:'NO_R51_CANDIDATE'};
  const ordered=names.map(x=>({name:x.name,m:x.name.match(R51),
    time:fs.lstatSync(path.join(folder,x.name)).mtimeMs}))
   .sort((a,b)=>b.m[1].localeCompare(a.m[1])||
    b.m[2].localeCompare(a.m[2])||b.time-a.time||a.name.localeCompare(b.name));
  const {name,m}=ordered[0];
  check(date(m[1])&&date(m[2]),'W03_R51_READBACK_DATE_STOP');
  const f=safeFile(path.join(folder,name),6*1048576);
  check(f.sha256.startsWith(m[3]),'W03_R51_READBACK_DIGEST_STOP');
  let rec;try{rec=JSON.parse(f.bytes)}catch{stop('W03_R51_READBACK_RESULT_JSON_STOP')}
  const points=rec?.provisional?.points;
  const falseFlags=['publicationAuthorized','upstreamCommercialRightsVerified',
   'derivedLicenseVerified','sourcePriceReconciled',
   'sourceManifestVerified','privateReplayVerified'];
  check(rec.contract==='THEME_NINE_R48_R47_PRIVATE_R37_CANDIDATE_V1'&&
   rec.status==='PRIVATE_CANDIDATE_NOT_PUBLISHED'&&
   rec.phase==='PROVISIONAL'&&rec.sourceStoredAt===null&&
   rec.publishedAt===null&&rec.observationDate===m[1]&&
   rec.ETFPositions===64&&rec.uniqueETFs===63&&
   falseFlags.every(k=>rec[k]===false)&&
   Array.isArray(rec.themes)&&rec.themes.length===9&&
   rec.themes.every(t=>Array.isArray(t.history)&&t.history.length===252&&
    t.history.at(-1)?.date===m[1]&&
    t.history.every((p,i)=>date(p?.date)&&
     (i===0||p.date>t.history[i-1].date)&&
     typeof p.score==='number'&&Number.isFinite(p.score)&&p.score>=0&&p.score<=100))&&
   Array.isArray(points)&&points.length>=1&&points.length<=32&&
   points.at(-1)?.date===m[2]&&
   points.every((p,i)=>date(p?.date)&&
    (i===0||p.date>points[i-1].date)&&
    p.scores&&typeof p.scores==='object'&&!Array.isArray(p.scores)&&
    Object.keys(p.scores).length>=1&&Object.keys(p.scores).length<=9&&
    Object.values(p.scores).every(s=>typeof s==='number'&&
      Number.isFinite(s)&&s>=0&&s<=100)),
   'W03_R51_READBACK_RESULT_CONTRACT_STOP');
  const lineage=rec.provisionalLineage;
  const mode=lineage?.source==='EXISTING_PUBLIC_PROVISIONAL_AS_PUBLISHED'?
   'PUBLIC_LEGACY_AS_IS':lineage?.source==='R47_R48_SAME_PRICE_MODE_EXISTING_SCORES'?
   'R32_DATED':null;
  check(mode&&HEX.test(lineage.confirmedCandidateSha256??'')&&
   (mode==='PUBLIC_LEGACY_AS_IS'?lineage.latestCandidateSha256===null:
    HEX.test(lineage.latestCandidateSha256??''))&&
   lineage.publicProvisionalEndDate===m[2],
   'W03_R51_READBACK_LINEAGE_STOP');
  const parent=parentR48(dataRoot,m[1],lineage.confirmedCandidateSha256);
  return {...base,status:parent.matched?'PASS':'PARTIAL',
    code:parent.matched?'R51_SAVED_R48_SHA_LINK_VERIFIED':'R51_R48_SOURCE_NOT_FOUND',
    candidateCount:names.length,
    latest:{confirmedDate:m[1],provisionalEndDate:m[2],
     candidateSha256:f.sha256,candidateBytes:f.size,
     provisionalDateCount:points.length,confirmedThemeCount:9,
     confirmedHistoryRows:2268,provisionalMode:mode,
     parentR48Matched:parent.matched,parentR48Sha256:parent.fileSha256,
     currentPublicDateVerified:false}};
 }catch(e){return {...base,status:'STOP',code:
  /^W03_R51_READBACK_[A-Z0-9_]+$/.test(e?.code??'')?e.code:
   'W03_R51_READBACK_UNEXPECTED_STOP'};}
}
export function execute({event,env,reader=inspect}={}){
 const r=authorize(event,env),data=reader();
 check(data?.schema==='ZGMINI_W03_R51_SAVED_PRIVATE_METADATA_V1'&&
  data.providerCalls===0&&data.publicGets===0&&
  data.sqliteOpened===false&&data.pcWrites===0&&
  data.d1Writes===0&&data.publicationWrites===0&&
  data.taskExecutionVerified===false&&data.rawPagesRehashedNow===false,
  'W03_R51_READBACK_OUTPUT_STOP');
 return {schema:RESULT,requestId:r.requestId,controlSha:env.GITHUB_SHA,
  status:data.status,code:data.code,metadata:data};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;
 try{result=execute({event:JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),
  env:process.env})}
 catch(e){result={schema:RESULT,requestId:null,controlSha:null,status:'STOP',
  code:/^W03_R51_READBACK_[A-Z0-9_]+$/.test(e?.code??'')?e.code:
   'W03_R51_READBACK_EXECUTE_STOP',metadata:null}}
 try{const t=process.env.RUNNER_TEMP;
  check(typeof t==='string'&&path.isAbsolute(t),'W03_R51_READBACK_TEMP_STOP');
  fs.writeFileSync(path.join(t,'w03-r51-readback.json'),JSON.stringify(result)+'\n',{flag:'wx'});
 }catch{process.exitCode=1}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status==='STOP')process.exitCode=1;
}
