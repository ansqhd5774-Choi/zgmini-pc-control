// Fixed, one-request, read-only reconciliation of the 19 approved inflation
// presentation rows on the PC and the already-published public API.
// Never prints values, source files, credentials, or provider raw observations.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='pc-inflation19-pc-public-diff-readonly-once';
export const SCHEMA='ZGMINI_INFL19_PC_PUBLIC_DIFF_A_V1';
export const SOURCE_SHA='480ff36b9431d563b9836f44f093c3f606b7ddf7';
export const HOME=String.raw`E:\ZGmini\data\pc-writer`;
export const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
export const API='https://zgmini.kr/api/inflation-causal-inputs';
export const KEY='detail:inflation-causal-public-19:r1';
export const APPROVAL='INFLATION19_PUBLIC_DIFF_A_APPROVAL.json';
export const HASHES=Object.freeze({
 'scripts/pc-writer/inflation-causal-public-preview-r1.mjs':'bc458372f86faf061306ae50e2bc806534f80e4458e45dc7901a3e09cfab86cc',
 'lib/inflation-causal-public-catalog.mjs':'db4e05baaa62b51a0a783ce66466c18bb02a924894fc3aca605f473cbe3632e5',
 'worker/inflation-causal-public-r1.mjs':'86c5003c3b37cac16e3e5e9b5ed610f9e00f29ee6005cb2abb91fb04abea951f',
});
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQUEST=new RegExp('^pc-infl19-diff-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const FIELDS=['status','value','previousValue','observationDate',
 'previousObservationDate','availableAt','sourceStoredAt','history'];
const IDS=new Set(['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31']);
const stop=code=>{throw Error(code)};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function regular(file,max=100000){
 const stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>max)
  stop('INFLDIFF_FILE_DENIED');
 return fs.readFileSync(file);
}
function directory(file){
 const stat=fs.lstatSync(file);
 if(!stat.isDirectory()||stat.isSymbolicLink())stop('INFLDIFF_DIRECTORY_DENIED');
}
export function reportName(number){
 if(!Number.isSafeInteger(number)||number<1||number>999999999)
  stop('INFLDIFF_ISSUE_NUMBER_DENIED');
 return `INFL19_PC_PUBLIC_DIFF_${number}.json`;
}
export function verifyRequest(event,env,{platform=process.platform}={}){
 if(platform!=='win32'||env.GITHUB_REPOSITORY!==REPO||
  env.GITHUB_ACTOR!=='ansqhd5774-Choi'||env.GITHUB_EVENT_NAME!=='issues'||
  env.GITHUB_EVENT_ACTION!=='opened'||env.GITHUB_RUN_ATTEMPT!=='1'||
  event?.action!=='opened'||event?.repository?.private!==true||
  event.repository.full_name!==REPO||event.issue?.user?.login!=='ansqhd5774-Choi'||
  event.issue.title!==TITLE)stop('INFLDIFF_ISSUE_DENIED');
 reportName(event.issue.number);
 let body;try{body=JSON.parse(event.issue.body)}catch{stop('INFLDIFF_JSON_DENIED')}
 if(!body||Array.isArray(body)||Object.keys(body).sort().join('|')!==
  ['schema','operation','sourceSha','requestId','chatId'].sort().join('|')||
  body.schema!==SCHEMA||body.operation!=='compare-private-pc-to-public-api-readonly-once'||
  body.sourceSha!==SOURCE_SHA||!REQUEST.test(body.requestId)||!CHAT.test(body.chatId)||
  body.requestId.slice('pc-infl19-diff-'.length)!==body.chatId.slice('chat-'.length))
  stop('INFLDIFF_REQUEST_DENIED');
 return body;
}
function sourceFrom(workspace){
 directory(workspace);
 const approval=JSON.parse(regular(path.join(workspace,'control',APPROVAL),7000));
 if(approval.schema!=='ZGMINI_INFL19_PC_PUBLIC_DIFF_A_APPROVAL_V1'||
  approval.scope!=='PC_19_VS_PUBLIC_API_READONLY_ONE_REQUEST'||
  approval.sourceRepository!=='ansqhd5774-Choi/zgmini'||
  approval.sourceSha!==SOURCE_SHA||approval.approvedHome!==HOME||
  approval.publicApi!==API||approval.key!==KEY||approval.maxPublicGets!==1||
  approval.maxProviderRequests!==0||approval.maxD1Writes!==0||
  approval.allowCoreWrites!==false||approval.allowDbWrites!==false||
  approval.allowSchedulerWrites!==false||approval.maxAutomaticRetries!==0||
  JSON.stringify(approval.sourceFileHashes)!==JSON.stringify(HASHES))
  stop('INFLDIFF_APPROVAL_DENIED');
 const source=path.join(workspace,'source');directory(source);
 const git=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files (x86)\Git\cmd\git.exe`].find(fs.existsSync);
 if(!git)stop('INFLDIFF_GIT_DENIED');
 const actual=execFileSync(git,['-c','core.fsmonitor=false','-C',source,'rev-parse','HEAD'],
  {encoding:'utf8',timeout:15000,windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();
 if(actual!==SOURCE_SHA)stop('INFLDIFF_SOURCE_SHA_DENIED');
 for(const [relative,expected] of Object.entries(HASHES)){
  const file=path.join(source,...relative.split('/'));
  if(hash(regular(file,50000))!==expected)stop('INFLDIFF_SOURCE_HASH_DENIED');
 }
 directory(HOME);
 // Check the approved Node executable without loading its full binary into memory.
 const nodeStat=fs.lstatSync(NODE);
 if(!nodeStat.isFile()||nodeStat.isSymbolicLink()||
  nodeStat.size<1||nodeStat.size>200000000)stop('INFLDIFF_NODE_DENIED');
 return source;
}

export function comparePayloads(pc,publicData,{validate,now=Date.now()}={}){
 if(typeof validate!=='function')stop('INFLDIFF_VALIDATOR_MISSING');
 try{validate(pc,{now});validate(publicData,{now});}
 catch{stop('INFLDIFF_PUBLIC_CONTRACT_DENIED')}
 if(pc?.status!=='READY'||publicData?.status!=='READY'||
  pc.score!==null||publicData.score!==null||
  pc.indicators?.length!==19||publicData.indicators?.length!==19||
  !/^INFL19_PRESENTATION_[a-f0-9]{64}$/.test(pc.sourceVersion)||
  !/^INFL19_PRESENTATION_[a-f0-9]{64}$/.test(publicData.sourceVersion)||
  !Number.isSafeInteger(pc.sourceStoredAt)||!Number.isSafeInteger(publicData.sourceStoredAt))
  stop('INFLDIFF_READY_REQUIRED');
 const changedIds=[],changedFieldNames={};
 for(let i=0;i<19;i++){
  const a=pc.indicators[i],b=publicData.indicators[i];
  if(a.id!==b.id||a.series!==b.series||a.unit!==b.unit||
   a.status!=='READY'||b.status!=='READY')stop('INFLDIFF_IDENTITY_DENIED');
  const fields=FIELDS.filter(field=>JSON.stringify(a[field]??null)!==JSON.stringify(b[field]??null));
  if(fields.length){changedIds.push(a.id);changedFieldNames[a.id]=fields;}
 }
 const topLevelChangedFields=pc.sourceStoredAt===publicData.sourceStoredAt?[]:['sourceStoredAt'];
 const versionsEqual=pc.sourceVersion===publicData.sourceVersion;
 if(versionsEqual&&changedIds.length)stop('INFLDIFF_VERSION_COLLISION');
 if(!versionsEqual&&!changedIds.length)stop('INFLDIFF_VERSION_UNEXPLAINED');
 const changed=changedIds.length>0||topLevelChangedFields.length>0;
 const metadataOnly=changed&&Object.values(changedFieldNames).every(fields=>
  fields.every(field=>field==='sourceStoredAt'||field==='availableAt'));
 const diffClass=!changed?'MATCH':metadataOnly?'METADATA_ONLY':'DATA_OR_HISTORY';
 return {status:'PASS',code:changed?'INFLDIFF_CHANGED':'INFLDIFF_MATCH',
  changedIds,changedFieldNames,topLevelChangedFields,diffClass,
  pcSourceVersion:pc.sourceVersion,publicSourceVersion:publicData.sourceVersion,
  pcSourceStoredAt:pc.sourceStoredAt,publicSourceStoredAt:publicData.sourceStoredAt,
  providerCalls:0,coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0};
}
export async function readPublic(fetcher=fetch){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
 try{
  const response=await fetcher(API,{redirect:'manual',signal:c.signal,
   headers:{accept:'application/json'},cache:'no-store'});
  if(response.status!==200||!String(response.headers?.get('content-type')??'')
   .toLowerCase().startsWith('application/json'))stop('INFLDIFF_PUBLIC_HTTP_DENIED');
  const length=Number(response.headers?.get('content-length')??0);
  if(length>60000)stop('INFLDIFF_PUBLIC_BODY_DENIED');
  if(!response.body?.getReader)stop('INFLDIFF_PUBLIC_BODY_DENIED');
  const reader=response.body.getReader(),chunks=[];let size=0;
  while(true){
   const part=await reader.read();if(part.done)break;
   size+=part.value.byteLength;
   if(size>60000){await reader.cancel();stop('INFLDIFF_PUBLIC_BODY_DENIED');}
   chunks.push(Buffer.from(part.value));
  }
  const body=Buffer.concat(chunks).toString('utf8');
  if(body.length<100||body.length>60000)stop('INFLDIFF_PUBLIC_BODY_DENIED');
  try{return JSON.parse(body)}catch{stop('INFLDIFF_PUBLIC_JSON_DENIED')}
 }finally{clearTimeout(timer)}
}

const cleanedCode=e=>/^INFLDIFF_[A-Z0-9_]{3,80}$/.test(e?.message??'')?
 e.message:'INFLDIFF_UNEXPECTED';
export async function execute(env=process.env,{fetcher=fetch}={}){
 let issue=null,report={schema:SCHEMA,status:'BLOCKED',code:'INFLDIFF_NOT_STARTED',
  changedIds:[],changedFieldNames:{},topLevelChangedFields:[],diffClass:null,
  pcSourceVersion:null,publicSourceVersion:null,
  pcSourceStoredAt:null,publicSourceStoredAt:null,
  providerCalls:0,coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0};
 try{
  const event=JSON.parse(regular(env.GITHUB_EVENT_PATH,100000));
  const q=verifyRequest(event,env);issue=event.issue.number;
  report={...report,issueNumber:issue,requestId:q.requestId,runId:env.GITHUB_RUN_ID};
  const ws=env.GITHUB_WORKSPACE;
  if(!ws||!path.win32.isAbsolute(ws))stop('INFLDIFF_WORKSPACE_DENIED');
  const source=sourceFrom(ws);
  const previewModule=await import(pathToFileURL(path.join(source,'scripts','pc-writer',
   'inflation-causal-public-preview-r1.mjs')).href);
  const contract=await import(pathToFileURL(path.join(source,'worker',
   'inflation-causal-public-r1.mjs')).href);
  const preview=previewModule.previewInflation19(HOME);
  if(preview.status!=='PASS_READONLY'||preview.ready!==19||preview.payload?.status!=='READY'||
   preview.providerCalls!==0||preview.dbWrites!==0||preview.d1Writes!==0||
   preview.coreWrites!==0||preview.schedulerWrites!==0)
   stop('INFLDIFF_PC_PREVIEW_DENIED');
  const publicData=await readPublic(fetcher);
  const diff=comparePayloads(preview.payload,publicData,{validate:contract.validateInflationCausalPublic});
  report={...report,...diff,lastPass:'PC_AND_PUBLIC_READONLY_VALIDATED'};
 }catch(e){report={...report,status:'BLOCKED',code:cleanedCode(e),firstFail:'PC_PUBLIC_DIFF'};}
 if(issue!==null){
  try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,reportName(issue)),
   JSON.stringify(report)+'\n',{flag:'wx'});}
  catch{report.status='STATE_UNKNOWN';report.code='INFLDIFF_REPORT_SAVE_UNKNOWN';}
 }
 console.log('STATUS='+report.status+' CODE='+report.code+' CHANGED='+report.changedIds.length);
 if(report.status!=='PASS')process.exitCode=1;
 return report;
}
export function sanitizeReport(report){
 const changed=report?.changedIds?.length>0||report?.topLevelChangedFields?.length>0;
 const metadataOnly=changed&&Object.values(report?.changedFieldNames??{}).every(fields=>
  Array.isArray(fields)&&fields.every(f=>f==='sourceStoredAt'||f==='availableAt'));
 const expectedClass=!changed?'MATCH':metadataOnly?'METADATA_ONLY':'DATA_OR_HISTORY';
 if(report?.schema!==SCHEMA||!['PASS','BLOCKED','STATE_UNKNOWN'].includes(report.status)||
  !/^INFLDIFF_[A-Z0-9_]{3,80}$/.test(report.code??'')||
  !Array.isArray(report.changedIds)||report.changedIds.length>19||
  new Set(report.changedIds).size!==report.changedIds.length||
  report.changedIds.some(id=>!IDS.has(id))||
  !report.changedFieldNames||typeof report.changedFieldNames!=='object'||
  Array.isArray(report.changedFieldNames)||
  Object.keys(report.changedFieldNames).sort().join('|')!==report.changedIds.slice().sort().join('|')||
  Object.entries(report.changedFieldNames).some(([,fields])=>!Array.isArray(fields)||
   !fields.length||new Set(fields).size!==fields.length||fields.some(field=>!FIELDS.includes(field)))||
  !Array.isArray(report.topLevelChangedFields)||
  report.topLevelChangedFields.some(field=>field!=='sourceStoredAt')||
  ![null,'MATCH','METADATA_ONLY','DATA_OR_HISTORY'].includes(report.diffClass)||
  ![report.pcSourceVersion,report.publicSourceVersion].every(x=>x===null||
   /^INFL19_PRESENTATION_[a-f0-9]{64}$/.test(x))||
  ![report.pcSourceStoredAt,report.publicSourceStoredAt].every(x=>x===null||
   (Number.isSafeInteger(x)&&x>0&&x<=Date.now()+60000))||
  report.providerCalls!==0||report.coreWrites!==0||report.dbWrites!==0||
  report.d1Writes!==0||report.schedulerWrites!==0||
  ![report.lastPass,report.firstFail].every(x=>x===undefined||x===null||
   /^[A-Z][A-Z0-9_]{2,80}$/.test(x))||
  (report.status==='PASS'&&(!report.diffClass||!report.pcSourceVersion||
   !report.publicSourceVersion||report.pcSourceStoredAt===null||
   report.publicSourceStoredAt===null||report.diffClass!==expectedClass||
   report.code!==(changed?'INFLDIFF_CHANGED':'INFLDIFF_MATCH'))))
  stop('INFLDIFF_REPORT_DENIED');
 return {schema:SCHEMA,status:report.status,code:report.code,
  issueNumber:report.issueNumber,requestId:report.requestId,
  changedIds:report.changedIds,changedFieldNames:report.changedFieldNames,
  topLevelChangedFields:report.topLevelChangedFields,diffClass:report.diffClass,
  pcSourceVersion:report.pcSourceVersion,publicSourceVersion:report.publicSourceVersion,
  pcSourceStoredAt:report.pcSourceStoredAt,publicSourceStoredAt:report.publicSourceStoredAt,
  providerCalls:0,coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0,
  lastPass:report.lastPass??null,firstFail:report.firstFail??null};
}
export async function upload(env=process.env,fetcher=fetch){
 const event=JSON.parse(regular(env.GITHUB_EVENT_PATH,100000));
 const q=verifyRequest(event,env);
 const ws=env.GITHUB_WORKSPACE;
 if(!ws||!path.win32.isAbsolute(ws))stop('INFLDIFF_WORKSPACE_DENIED');
 const report=JSON.parse(regular(path.join(ws,reportName(event.issue.number)),20000));
 if(report.schema!==SCHEMA||report.issueNumber!==event.issue.number||
  report.requestId!==q.requestId||report.runId!==env.GITHUB_RUN_ID||
  !['PASS','BLOCKED','STATE_UNKNOWN'].includes(report.status)||!env.GITHUB_TOKEN)
  stop('INFLDIFF_REPORT_DENIED');
 const safe=sanitizeReport(report);
 const response=await fetcher('https://api.github.com/repos/'+REPO+'/issues/'+event.issue.number+'/comments',{
  method:'POST',headers:{accept:'application/vnd.github+json',
   authorization:'Bearer '+env.GITHUB_TOKEN,'content-type':'application/json'},
  body:JSON.stringify({body:'Inflation 19 PC/public read-only diff: '+safe.status+' ('+safe.code+')\n```json\n'+JSON.stringify(safe,null,2)+'\n```'})});
 if(!response.ok)stop('INFLDIFF_COMMENT_UPLOAD_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--upload'&&process.argv.length===3)await upload();
 else if(process.argv.length===2)await execute();
 else stop('INFLDIFF_ARGUMENTS_DENIED');
}
