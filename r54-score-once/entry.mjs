// R54 R47/R48/R51 score replay and reader eligibility preflight ONLY.
// No stage/collector/publisher calls, no PC-data writes, no provider or D1 access.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const TITLE='pc-theme-r54-score-replay-once';
export const SCHEMA='ZGMINI_THEME_R54_SCORE_REPLAY_ONCE_V1';
export const PUBLIC_SHA='5ee597cc6c0da9f38ab54c8aeb46b89f60a1ef36';
export const ADAPTER_SHA='77c6cc43a2450f34a7cfe81f39040807e727f1cf';
export const ADAPTER_BYTES_SHA='13027dcc945d06e63f3445b11bed30ec7e65dd3bf16c2728b63034e50f31e46c';
export const ROOT=String.raw`E:\ZGmini\data`;
const APPROVAL='THEME_R54_SCORE_REPLAY_B_APPROVAL.json';
const CONSENT='ACCEPT_R54_ANONYMOUS_DERIVED_RISK_20261028';
const NOW_WINDOW=8*86400000;
const SHA64=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const REQ=new RegExp('^pc-theme-r54-score-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const CAND=/^THEME_NINE_R48_PRIVATE_CANDIDATE_(20\d\d-\d\d-\d\d)_([a-f0-9]{16})\.json$/;
const R51=/^THEME_NINE_R51_PRIVATE_PROVISIONAL_20\d\d-\d\d-\d\d_20\d\d-\d\d-\d\d_[a-f0-9]{16}\.json$/;
const code=e=>{
 const raw=String(e?.code??e?.message??'');
 if(/^R54_SCORE_[A-Z0-9_]{2,70}$/.test(raw))return raw;
 for(const [before,after] of [
  ['THEME_NINE_R54_','R54_SCORE_R54_'],
  ['THEME_NINE_R51_','R54_SCORE_R51_'],
  ['THEME_NINE_R48_','R54_SCORE_R48_'],
  ['THEME_NINE_R47_','R54_SCORE_R47_'],
  ['THEME_NINE_R37_','R54_SCORE_R37_'],
 ])if(raw.startsWith(before)&&/^[A-Z0-9_]{2,54}$/.test(raw.slice(before.length)))
  return after+raw.slice(before.length);
 return 'R54_SCORE_UNEXPECTED_STOP';
};
const stop=s=>{throw Object.assign(new Error(s),{code:s});};
const sha=b=>createHash('sha256').update(b).digest('hex');
const self=fileURLToPath(import.meta.url);
const goodDate=d=>typeof d==='string'&&/^20\d\d-\d\d-\d\d$/.test(d)&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const basename=n=>typeof n==='string'&&/^[A-Za-z0-9_.-]{1,120}$/.test(n)?n:null;
const issueNumber=n=>Number.isSafeInteger(n)&&n>0&&n<1e9?n:stop('R54_SCORE_ISSUE_NUMBER_DENIED');
const resultFile=n=>`THEME_R54_SCORE_REPLAY_${issueNumber(n)}.json`;
const compactNum=n=>Number.isSafeInteger(n)&&n>=0&&n<10000?n:null;
function regular(file,max=32768){
 const st=fs.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)
  stop('R54_SCORE_UNSAFE_FILE');
 const bytes=fs.readFileSync(file);
 if(bytes.length>max)stop('R54_SCORE_SIZE_DENIED');
 return bytes;
}
function safeRelative(base,rel,max){
 const file=path.resolve(base,rel),r=path.relative(base,file);
 if(!r||r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))
  stop('R54_SCORE_PATH_ESCAPE');
 let part=base;
 for(const n of r.split(path.sep)){part=path.join(part,n);
  if(fs.lstatSync(part).isSymbolicLink())stop('R54_SCORE_SOURCE_REDIRECT');}
 return regular(file,max);
}
function workspace(env){
 if(typeof env.GITHUB_WORKSPACE!=='string'||!path.isAbsolute(env.GITHUB_WORKSPACE))
  stop('R54_SCORE_WORKSPACE_DENIED');
 return fs.realpathSync.native(env.GITHUB_WORKSPACE);
}
const eventFrom=env=>JSON.parse(regular(env.GITHUB_EVENT_PATH,100000).toString('utf8'));
export function validateRequest(event,env){
 if(env.GITHUB_REPOSITORY!==CONTROL_REPO||env.GITHUB_ACTOR!==OWNER||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||
  event?.action!=='opened'||event?.repository?.private!==true||
  event?.repository?.full_name!==CONTROL_REPO||event?.issue?.user?.login!==OWNER||
  event?.issue?.title!==TITLE||!Number.isSafeInteger(event.issue.number)||
  event?.issue?.labels?.some(x=>['pc-job','pc-maintenance'].includes(x.name)))
  stop('R54_SCORE_ISSUE_AUTH_DENIED');
 if(typeof event.issue.body!=='string'||event.issue.body.length>4096)
  stop('R54_SCORE_REQUEST_SIZE_DENIED');
 let r;try{r=JSON.parse(event.issue.body);}catch{stop('R54_SCORE_REQUEST_JSON_DENIED');}
 if(!r||typeof r!=='object'||Array.isArray(r)||
  Object.keys(r).sort().join('|')!==['schema','operation','requestId','chatId','controlSha','publicSha','adapterSha'].sort().join('|')||
  r.schema!==SCHEMA||r.operation!=='theme-nine-r54-score-replay-once'||
  r.controlSha!==env.GITHUB_SHA||!SHA40.test(env.GITHUB_SHA??'')||
  r.publicSha!==PUBLIC_SHA||r.adapterSha!==ADAPTER_SHA||
  !REQ.test(r.requestId)||!CHAT.test(r.chatId)||
  r.requestId.slice('pc-theme-r54-score-'.length)!==r.chatId.slice('chat-'.length))
  stop('R54_SCORE_REQUEST_DENIED');
 return r;
}
export function verifyApproval(base){
 const j=JSON.parse(safeRelative(base,'control/'+APPROVAL,4096).toString('utf8'));
 if(j?.schema!=='ZGMINI_THEME_R54_SCORE_REPLAY_B_APPROVAL_V1'||
   j?.grade!=='B'||j?.scope!=='PRIVATE_R54_SCORE_REPLAY_NO_WRITE_ONCE'||
   j?.publicSha!==PUBLIC_SHA||j?.adapterSha!==ADAPTER_SHA||
   j?.adapterBytesSha256!==ADAPTER_BYTES_SHA||
   j?.dataRoot!==ROOT||j?.minimumFreeMiB!==1536||
   j?.timeoutSeconds!==240||j?.maxProviderRequests!==0||
   j?.maxPublicBaseGets!==1||j?.maxAutomaticRetries!==0||
   j?.pcDataWrites!==false||j?.sqliteWrites!==false||j?.d1Writes!==false||
   j?.schedulerWrites!==false||!SHA64.test(j?.scriptSha256??''))
  stop('R54_SCORE_APPROVAL_DENIED');
 if(sha(fs.readFileSync(self))!==j.scriptSha256)
  stop('R54_SCORE_SCRIPT_SHA_DENIED');
 if(sha(safeRelative(base,'adapter/controller/theme-nine-r54-evidence-readonly.mjs',32000))!==ADAPTER_BYTES_SHA)
  stop('R54_SCORE_ADAPTER_SHA_DENIED');
 return j;
}
function selectedCandidate(evidence,publicBase){
 if(evidence?.status!=='PASS'||evidence.providerCalls!==0||
   evidence.operationalWrites!==0||evidence.d1Writes!==0||
   evidence.sqliteOpened!==false)stop('R54_SCORE_RAW_EVIDENCE_INVALID');
 const anchor=publicBase?.confirmedObservationDate??publicBase?.observationDate;
 if(publicBase?.status!=='READY'||!goodDate(anchor)||!Array.isArray(publicBase.themes)||
   publicBase.themes.length!==10||!Array.isArray(publicBase?.provisional?.points)||
   publicBase.provisional.points.length<1)
  stop('R54_SCORE_PUBLIC_BASE_DENIED');
 const options=(evidence.r48?.candidates??[]).filter(x=>CAND.test(x?.filename??'')&&
   goodDate(x.date)&&x.date>=anchor&&
   x.baseline?.status==='VERIFIED_PREFIX'&&x.baseline?.rawStatus==='RAW_VERIFIED'&&
   (x.delta?.status==='NOT_REQUIRED'||(x.delta?.status==='VERIFIED_PREFIX'&&
    x.delta.rawStatus==='RAW_VERIFIED'))).sort((a,b)=>a.date.localeCompare(b.date));
 if(!options.length)stop('R54_SCORE_NO_RAW_VERIFIED_CANDIDATE');
 const latest=options.at(-1);
 if(options.filter(x=>x.date===latest.date).length!==1)
  stop('R54_SCORE_CANDIDATE_DATE_AMBIGUOUS');
 return latest;
}
function readConfirmed(root,ref){
 const name=ref.filename;
 if(!basename(name)||!CAND.test(name))stop('R54_SCORE_CANDIDATE_NAME_DENIED');
 const bytes=safeRelative(root,'themes/legacy-nine-r48-private-candidate/'+name,4*1024*1024);
 if(sha(bytes).slice(0,16)!==CAND.exec(name)[2])
  stop('R54_SCORE_CANDIDATE_BYTES_SHA_DENIED');
 let obj;try{obj=JSON.parse(bytes.toString('utf8'));}catch{stop('R54_SCORE_CANDIDATE_JSON_DENIED');}
 if(obj?.observationDate!==ref.date||obj.phase!=='CONFIRMED')
  stop('R54_SCORE_CANDIDATE_DATE_DENIED');
 return obj;
}
function r51Saved(root){
 const dir=path.join(root,'themes','legacy-nine-r51-private-provisional');
 try{
  if(!fs.lstatSync(dir).isDirectory()||fs.lstatSync(dir).isSymbolicLink())
   return {status:'UNSAFE_DIRECTORY'};
  const all=fs.readdirSync(dir);
  if(all.length>4096)return {status:'DIRECTORY_LIMIT'};
  const names=all.filter(x=>R51.test(x)).sort();
  return {status:'READY',candidateCount:names.length,lastNames:names.slice(-4)};
 }catch{return {status:'UNAVAILABLE'};}
}
function installedSources(root){
 const app=path.join(root,'pc-writer','theme-nine-r54');
 const files={
  r54Connect:'scripts/pc-writer/theme-nine-r54-public-connect.mjs',
  r51Stage:'scripts/pc-writer/theme-nine-r51-stage-current.mjs',
  r51Overlay:'scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs',
  r54PublicRecord:'scripts/pc-writer/theme-nine-r54-public-record.mjs',
  r48D1Publisher:'scripts/pc-writer/theme-nine-r48-d1-publication.mjs',
  r37Reader:'worker/theme-nine-r37-public.mjs',
 };
 const out={};
 for(const [key,relative] of Object.entries(files)){
  try{
   const file=path.join(app,...relative.split('/'));
   const bytes=regular(file,120*1024);
   out[key]={status:'READ',sha256:sha(bytes),modifiedAt:fs.statSync(file).mtime.toISOString()};
  }catch{out[key]={status:'UNAVAILABLE'};}
 }
 return out;
}
async function publicBaseGet(fetcher){
 const response=await fetcher('https://zgmini.kr/api/theme-fear-greed/?publication-base=1&r54_score_once=1',
  {method:'GET',redirect:'error',headers:{accept:'application/json','cache-control':'no-cache'},
   signal:AbortSignal.timeout(20000)});
 if(!response.ok)stop('R54_SCORE_PUBLIC_API_HTTP_DENIED');
 return response.json();
}
const resultBase=env=>({schema:SCHEMA,status:'BLOCKED',code:'R54_SCORE_NOT_STARTED',
 controlSha:env.GITHUB_SHA??null,publicSha:PUBLIC_SHA,adapterSha:ADAPTER_SHA,
 runId:String(env.GITHUB_RUN_ID??''),providerCalls:0,publicBaseGets:0,
 pcDataWrites:0,sqliteOpened:false,sqliteWrites:0,d1Writes:0,schedulerWrites:0});
export async function execute({env=process.env,platform=process.platform,
 freeMiB=Math.floor(os.freemem()/1048576),fetcher=fetch,
 loader=async file=>import(pathToFileURL(file).href),
 dataRoot=ROOT,now=Date.now()}={}){
 let report=resultBase(env),n=null,publicGets=0;
 try{
  if(platform!=='win32')stop('R54_SCORE_WINDOWS_ONLY');
  const event=eventFrom(env),r=validateRequest(event,env);
  n=event.issue.number;
  report={...report,issueNumber:n,requestId:r.requestId,chatId:r.chatId};
  const base=workspace(env);verifyApproval(base);
  if(freeMiB<1536)stop('R54_SCORE_RESOURCE_WAIT_MEMORY');
  const adapter=await loader(path.join(base,'adapter/controller/theme-nine-r54-evidence-readonly.mjs'));
  const connect=await loader(path.join(base,'source/scripts/pc-writer/theme-nine-r54-public-connect.mjs'));
  const overlayModule=await loader(path.join(base,'source/scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs'));
  const recordModule=await loader(path.join(base,'source/scripts/pc-writer/theme-nine-r54-public-record.mjs'));
  if(typeof adapter?.inspectThemeNineR54Evidence!=='function'||
     typeof connect?.verifyNineR54PrivatePair!=='function'||
     typeof overlayModule?.buildNineR51ExistingPublicProvisionalOverlay!=='function'||
     typeof recordModule?.buildNineR54PublicRecord!=='function')
    stop('R54_SCORE_SOURCE_MODULE_MISSING');
  const evidence=adapter.inspectThemeNineR54Evidence(dataRoot);
  publicGets++;
  const publicBase=await publicBaseGet(fetcher);
  const chosen=selectedCandidate(evidence,publicBase);
  const candidate=readConfirmed(dataRoot,chosen);
  const config=path.join(base,'source/config');
  const replay=connect.verifyNineR54PrivatePair({dataRoot,configDirectory:config,candidate});
  if(replay?.source?.latestSpySessionDate!==candidate.observationDate)
   stop('R54_SCORE_SOURCE_SESSION_MISMATCH');
  const stat=fs.statSync(replay.sourceFile);
  if(stat.mtimeMs>now||now-stat.mtimeMs>=NOW_WINDOW)
   stop('R54_SCORE_SOURCE_STALE');
  const saved=r51Saved(dataRoot);
  const installed=installedSources(dataRoot);
  const independent=candidate.observationDate>
   (publicBase.confirmedObservationDate??publicBase.observationDate);
  const overlay=overlayModule.buildNineR51ExistingPublicProvisionalOverlay({
   confirmed:candidate,publicBase,independentAnchor:independent});
  const consentPath=path.join(dataRoot,'pc-writer','theme-nine-r54','PUBLISHER_CONSENT_R54.txt');
  const consent=regular(consentPath,256).toString('utf8').trim();
  if(consent!==CONSENT)stop('R54_SCORE_PUBLISHER_CONSENT_MISSING');
  const candidateBytes=Buffer.from(JSON.stringify(overlay,null,2)+'\n');
  const eligible=recordModule.buildNineR54PublicRecord({candidate:overlay,
   candidateSha256:sha(candidateBytes),publicBase,sourceStoredAt:stat.mtime.toISOString(),
   sourceManifestVerified:true,privateReplayVerified:true,publisherConsent:true,now});
  if(eligible?.observationDate!==candidate.observationDate||eligible.themes?.length!==9)
   stop('R54_SCORE_PUBLIC_ELIGIBILITY_INVALID');
  report={...report,status:'PASS',code:'R54_SCORE_REPLAY_ELIGIBLE_IN_MEMORY_NOT_PUBLISHED',
   publicBaseGets:publicGets,evidence:{sourceDate:candidate.observationDate,
    candidateFile:basename(chosen.filename),candidateSha256:sha(candidateBytes),
    baselineManifestSha256:chosen.baseline.expectedSha256??null,
    deltaManifestSha256:chosen.delta.expectedSha256??null,
    rawVerified:true,privateR47Replay:true,historyRows:9*252,
    publicConfirmedBefore:publicBase.confirmedObservationDate??publicBase.observationDate,
    publicProvisionalDates:publicBase.provisional.points.map(x=>x.date).slice(0,32),
    retainedProvisionalDateCount:overlay.provisional.points.length,
    r51SavedStatus:saved.status,r51SavedCount:compactNum(saved.candidateCount),
    installedSources:installed,
    scorePublicationAllowedByReader:true,actualD1Checked:false}};
 }catch(e){report={...report,status:'BLOCKED',code:code(e),publicBaseGets:publicGets};}
 if(n!==null){
  try{
   fs.writeFileSync(path.join(workspace(env),resultFile(n)),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
   fs.writeFileSync(path.join(workspace(env),resultFile(n).replace('.json','.txt')),
    `STATUS=${report.status} CODE=${report.code} ISSUE=${n}\n`,{flag:'wx'});
  }catch{report={...report,status:'BLOCKED',code:'R54_SCORE_RESULT_SAVE_DENIED'};}
 }
 process.stdout.write(`STATUS=${report.status} CODE=${report.code} D1_WRITES=0\n`);
 return report;
}
export async function upload(env=process.env,fetcher=fetch){
 const event=eventFrom(env),request=validateRequest(event,env),base=workspace(env);
 verifyApproval(base);
 const r=JSON.parse(safeRelative(base,resultFile(event.issue.number),8192).toString('utf8'));
 if(r?.schema!==SCHEMA||r.issueNumber!==event.issue.number||
  r.requestId!==request.requestId||r.chatId!==request.chatId||
  r.controlSha!==env.GITHUB_SHA||r.publicSha!==PUBLIC_SHA||
  r.adapterSha!==ADAPTER_SHA||r.runId!==String(env.GITHUB_RUN_ID??'')||
  !['PASS','BLOCKED'].includes(r.status)||!/^R54_SCORE_[A-Z0-9_]{2,70}$/.test(r.code??'')||
  !env.GITHUB_TOKEN)stop('R54_SCORE_RESULT_UNTRUSTED');
 const approved={schema:SCHEMA,status:r.status,code:r.code,
  requestId:r.requestId,controlSha:r.controlSha,publicSha:PUBLIC_SHA,
  adapterSha:ADAPTER_SHA,evidence:r.evidence??null,providerCalls:0,
  publicBaseGets:r.publicBaseGets??0,pcDataWrites:0,sqliteWrites:0,d1Writes:0,
  schedulerWrites:0};
 const body=`R54 점수·공개 Reader 적격성 읽기 전용 검증: **${r.status}** (${r.code})\n\n`+
  '```json\n'+JSON.stringify(approved,null,2)+'\n```';
 if(body.length>12000)stop('R54_SCORE_OUTPUT_LIMIT');
 const res=await fetcher(`https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:{authorization:`Bearer ${env.GITHUB_TOKEN}`,
   accept:'application/vnd.github+json','content-type':'application/json'},
  body:JSON.stringify({body})});
 if(!res.ok)stop('R54_SCORE_UPLOAD_FAILED');
 return {status:'UPLOADED',issueNumber:event.issue.number};
}
if(process.argv[1]&&path.resolve(process.argv[1])===self){
 if(process.argv.length===2){const result=await execute();if(result.status!=='PASS')process.exitCode=1;}
 else if(process.argv.length===3&&process.argv[2]==='--upload')await upload();
 else stop('R54_SCORE_ARGUMENTS_DENIED');
}
