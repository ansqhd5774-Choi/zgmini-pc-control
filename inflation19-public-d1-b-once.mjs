import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='pc-inflation19-public-d1-publish-once';
export const SCHEMA='ZGMINI_INFLATION_19_PUBLIC_D1_V1';
export const SOURCE_SHA='fe2410e7d1fa95aba51f4c7aba0ac3b62c1aadb5';
export const KEY='detail:inflation-causal-public-19:r1';
export const ENTRY='scripts/pc-writer/inflation-causal-public-publish-r1.mjs';
export const PUBLISHER_SHA256='5449d755a476c52343924b6fbf1fb55a92a48c63972d8451035fff20b0846198';
export const HOME='E:\\ZGmini\\data\\pc-writer';
export const NODE='E:\\ZGmini\\runtime\\node.exe';
export const OP_ROOT='E:\\ZGmini\\projects\\zgmini';
export const MARKER='E:\\ZGmini\\automation\\inflation19-public-r1\\ONE_SHOT_STARTED.json';
const APPROVAL='INFLATION19_PUBLIC_D1_B_APPROVAL.json';
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQUEST=new RegExp('^pc-infl19-public-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const stop=s=>{throw Error(s)};
const digest=b=>createHash('sha256').update(b).digest('hex');
const safe=e=>/^[A-Z][A-Z0-9_]{3,100}$/.test(e?.message??'')?e.message:'INFL19_PUBLISH_UNEXPECTED';
function regular(file,max=100000){
 const st=fs.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)stop('INFL19_PUBLISH_FILE_DENIED');
 return fs.readFileSync(file);
}
export function verifyRequest(event,env){
 if(process.platform!=='win32'||env.GITHUB_REPOSITORY!==REPO||
  env.GITHUB_ACTOR!=='ansqhd5774-Choi'||env.GITHUB_EVENT_NAME!=='issues'||
  env.GITHUB_EVENT_ACTION!=='opened'||env.GITHUB_RUN_ATTEMPT!=='1'||
  event?.action!=='opened'||event?.repository?.private!==true||
  event.repository.full_name!==REPO||event.issue?.user?.login!=='ansqhd5774-Choi'||
  event.issue.title!==TITLE)stop('INFL19_PUBLISH_ISSUE_DENIED');
 let q;try{q=JSON.parse(event.issue.body)}catch{stop('INFL19_PUBLISH_JSON_DENIED')}
 if(!q||Object.keys(q).sort().join('|')!==
  ['schema','operation','sourceSha','requestId','chatId'].sort().join('|')||
  q.schema!==SCHEMA||q.operation!=='publish-stored-19-summary-only-once'||
  q.sourceSha!==SOURCE_SHA||!REQUEST.test(q.requestId)||!CHAT.test(q.chatId)||
  q.requestId.slice('pc-infl19-public-'.length)!==q.chatId.slice('chat-'.length))
  stop('INFL19_PUBLISH_SCHEMA_DENIED');
 return q;
}
function git(root,args){
 return execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,timeout:15000,stdio:['ignore','pipe','ignore']}).trim();
}
function sourceFrom(ws){
 const a=JSON.parse(regular(path.join(ws,'control',APPROVAL),6000));
 if(a.schema!=='ZGMINI_INFLATION_19_PUBLIC_D1_APPROVAL_V1'||
  a.sourceSha!==SOURCE_SHA||a.key!==KEY||a.publisherSha256!==PUBLISHER_SHA256||
  a.publisherPath!==ENTRY||a.approvedHome!==HOME||a.maxProviderRequests!==0||
  a.maxD1Writes!==1||a.allowCoreWrites!==false||a.allowScoreWrites!==false||
  a.allowSchedulerWrites!==false||a.allowDirectDeploy!==false)
  stop('INFL19_PUBLISH_APPROVAL_DENIED');
 const root=path.join(ws,'source'),entry=path.join(root,...ENTRY.split('/'));
 if(git(root,['rev-parse','HEAD'])!==SOURCE_SHA||
  git(root,['branch','--show-current'])!=='main'||
  git(root,['rev-parse','refs/remotes/origin/main'])!==SOURCE_SHA||
  git(root,['status','--porcelain','--untracked-files=no','--','worker','scripts/pc-writer'])!==''||
  digest(regular(entry,30000))!==PUBLISHER_SHA256)
  stop('INFL19_PUBLISH_SOURCE_DENIED');
 return {root,entry};
}
function executionEnv(env){
 const keys=['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','APPDATA','LOCALAPPDATA','TEMP','TMP','USERPROFILE','HOME'];
 const out=Object.fromEntries(keys.filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));
 out.ZGMINI_PC_HOME=HOME;
 out.ZGMINI_INFLATION_OPERATIONAL_ROOT=env.ZGMINI_EARNINGS_C_OPERATIONAL_ROOT||OP_ROOT;
 return out;
}
function child(source,env,args,timeout){
 const p=spawnSync(NODE,[source.entry,...args],{cwd:source.root,env,encoding:'utf8',windowsHide:true,shell:false,timeout,maxBuffer:8192});
 if(p.error||p.signal)stop('INFL19_PUBLISH_CHILD_OUTCOME_UNKNOWN');
 let data;try{data=JSON.parse(p.stdout.trim())}catch{stop('INFL19_PUBLISH_CHILD_JSON_DENIED')}
 return {exit:p.status,data};
}
async function routeGate(){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
 try{
  const r=await fetch('https://zgmini.kr/api/inflation-causal-inputs',{redirect:'manual',signal:c.signal,headers:{accept:'application/json'}});
  if(r.status!==200)stop('INFL19_PUBLISH_ROUTE_NOT_DEPLOYED');
  const body=await r.json();
  if(!['PENDING','PARTIAL','READY'].includes(body?.status))stop('INFL19_PUBLISH_ROUTE_CONTRACT_DENIED');
 }finally{clearTimeout(timer)}
}
const reportFile=n=>'INFL19_PUBLIC_D1_'+n+'.json';
export async function execute(env=process.env){
 let report={schema:SCHEMA,status:'BLOCKED',code:'INFL19_PUBLISH_NOT_STARTED',sourceSha:SOURCE_SHA,
  ready:null,key:KEY,sourceVersion:null,sourceStoredAt:null,d1Readback:null,
  providerCalls:0,coreWrites:0,scoreWrites:0,d1Writes:0,schedulerWrites:0};
 let issue;
 try{
  const event=JSON.parse(regular(env.GITHUB_EVENT_PATH,100000)),q=verifyRequest(event,env);
  issue=event.issue.number;report={...report,issueNumber:issue,requestId:q.requestId,runId:env.GITHUB_RUN_ID};
  const ws=env.GITHUB_WORKSPACE;if(!ws||!path.isAbsolute(ws))stop('INFL19_PUBLISH_WORKSPACE_DENIED');
  const source=sourceFrom(ws),operational=env.ZGMINI_EARNINGS_C_OPERATIONAL_ROOT||OP_ROOT;
  if(!fs.existsSync(operational)||!fs.lstatSync(operational).isDirectory())
   stop('INFL19_PUBLISH_OPERATIONAL_ROOT_UNAVAILABLE');
  await routeGate();
  const e=executionEnv(env),pre=child(source,e,['--dry-run'],90000);
  if(pre.exit!==0||pre.data?.status!=='PASS_DRY_RUN'||pre.data.ready!==19||
   pre.data.providerCalls!==0||pre.data.dbWrites!==0||pre.data.d1Writes!==0||
   !/^INFL19_PRESENTATION_[a-f0-9]{64}$/.test(pre.data.sourceVersion??''))
   stop('INFL19_PUBLISH_PREFLIGHT_NOT_READY');
  // Validate the same approved PC operational SHA and the clean main publisher
  // BEFORE consuming the one-shot marker or attempting any D1 mutation.
  const gateModule=await import(pathToFileURL(path.join(source.root,
   'scripts','pc-writer','EARNINGS_R4_C_D1_DUAL_SOURCE_GATES.mjs')).href);
  const config=JSON.parse(regular(path.join(HOME,'config.json'),100000));
  gateModule.validateD1DualSource({config,
   publisher:gateModule.inspectD1Source(source.root,{publisher:true}),
   operational:gateModule.inspectD1Source(operational)});
  report={...report,ready:19,sourceVersion:pre.data.sourceVersion,
   sourceStoredAt:pre.data.sourceStoredAt,lastPass:'PC_19_AND_PUBLIC_ROUTE'};
  fs.mkdirSync(path.dirname(MARKER),{recursive:true});
  try{fs.writeFileSync(MARKER,JSON.stringify({requestId:q.requestId,sourceSha:SOURCE_SHA,at:new Date().toISOString()}),{flag:'wx'})}
  catch(x){stop(x?.code==='EEXIST'?'INFL19_PUBLISH_ALREADY_ATTEMPTED':'INFL19_PUBLISH_MARKER_DENIED')}
  report.stage='D1_WRITE_STARTED';
  const applied=child(source,e,['--apply','--confirm-inflation-causal-public-r1'],240000);
  if(applied.exit!==0||!['READBACK_VERIFIED','ALREADY_STORED'].includes(applied.data?.status)||
   applied.data.key!==KEY||applied.data.ready!==19){
   report.status='STATE_UNKNOWN';
   report.code=/^[A-Z0-9_]{4,100}$/.test(applied.data?.code??'')?applied.data.code:'INFL19_PUBLISH_D1_UNVERIFIED';
  }else{
   report={...report,status:'PASS',code:applied.data.code,sourceVersion:applied.data.sourceVersion,
    sourceStoredAt:applied.data.sourceStoredAt,d1Writes:applied.data.d1Writes,
    d1Readback:applied.data.status,stage:'DONE',lastPass:'D1_READBACK_VERIFIED'};
  }
 }catch(x){report.code=safe(x);if(report.stage==='D1_WRITE_STARTED')report.status='STATE_UNKNOWN'}
 if(issue){try{fs.writeFileSync(path.join(env.GITHUB_WORKSPACE,reportFile(issue)),JSON.stringify(report)+'\n',{flag:'wx'})}
  catch{report.status='STATE_UNKNOWN';report.code='INFL19_PUBLISH_RESULT_UNKNOWN';}}
 console.log('STATUS='+report.status+' CODE='+report.code+' READY='+String(report.ready));
 if(report.status!=='PASS')process.exitCode=1;
}
export async function upload(env=process.env,fetcher=fetch){
 const event=JSON.parse(regular(env.GITHUB_EVENT_PATH,100000)),q=verifyRequest(event,env);
 const report=JSON.parse(regular(path.join(env.GITHUB_WORKSPACE,reportFile(event.issue.number)),20000));
 if(!env.GITHUB_TOKEN||report.schema!==SCHEMA||report.issueNumber!==event.issue.number||
  report.requestId!==q.requestId||report.runId!==env.GITHUB_RUN_ID||
  !['PASS','BLOCKED','STATE_UNKNOWN'].includes(report.status))
  stop('INFL19_PUBLISH_UNTRUSTED_REPORT');
 const body='Inflation 19 public summary D1 one-shot: '+report.status+' ('+report.code+')\n'+JSON.stringify(report,null,2);
 const res=await fetcher('https://api.github.com/repos/'+REPO+'/issues/'+event.issue.number+'/comments',{
  method:'POST',headers:{accept:'application/vnd.github+json',authorization:'Bearer '+env.GITHUB_TOKEN,'content-type':'application/json'},
  body:JSON.stringify({body})});
 if(!res.ok)stop('INFL19_PUBLISH_COMMENT_UPLOAD_FAILED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--upload'&&process.argv.length===3)await upload();
 else if(process.argv.length===2)await execute();
 else stop('INFL19_PUBLISH_ARGUMENTS_DENIED');
}
