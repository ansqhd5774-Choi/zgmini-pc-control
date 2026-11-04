// Isolated unapproved B candidate. No execution possible while manifest approved=false.
// Reuses the existing inflation19 PC preview and D1 CAS writer; never imports old #296 entry.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {KEY,runScopedOnce} from './inflation19-delta-b-contract.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const TITLE='pc-inflation19-wti-gas-delta-d1-b-once';
const SCHEMA='ZGMINI_INFL19_WTI_GAS_DELTA_B_V1';
const API='https://zgmini.kr/api/inflation-causal-inputs';
const VERSION=/^INFL19_PRESENTATION_[a-f0-9]{64}$/;
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const fail=code=>{throw Error(code)};
const safe=e=>/^[A-Z0-9_]{4,100}$/.test(e?.message??'')?e.message:'INFL19_DELTA_UNEXPECTED';
const regular=file=>{const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>100000)
  fail('INFL19_DELTA_FILE_DENIED');return fs.readFileSync(file,'utf8')};
const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:15000,
  windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();

export function verifyIssue(e,env) {
 if(process.platform!=='win32'||env.GITHUB_REPOSITORY!==REPO||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_EVENT_ACTION!=='opened'||env.GITHUB_RUN_ATTEMPT!=='1'||
  e?.action!=='opened'||e?.repository?.private!==true||e.repository.full_name!==REPO||
  e.issue?.user?.login!=='ansqhd5774-Choi'||e.issue.title!==TITLE)
  fail('INFL19_DELTA_ISSUE_DENIED');
 let q;try{q=JSON.parse(e.issue.body)}catch{fail('INFL19_DELTA_JSON_DENIED')}
 if(Object.keys(q??{}).sort().join('|')!==['schema','operation','sourceSha','requestId','chatId'].sort().join('|')||
  q.schema!==SCHEMA||q.operation!=='publish-pc-stored-wti-and-gas-public-d1-once'||
  !new RegExp('^pc-infl19-delta-'+uuid+'$').test(q.requestId??'')||
  !new RegExp('^chat-'+uuid+'$').test(q.chatId??'')||
  q.requestId.slice('pc-infl19-delta-'.length)!==q.chatId.slice('chat-'.length))
  fail('INFL19_DELTA_ISSUE_SCHEMA_DENIED');
 return q;
}
async function readPublic() {
 const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
 try {
  const r=await fetch(API,{redirect:'manual',signal:c.signal,cache:'no-store',headers:{accept:'application/json'}});
  if(r.status!==200||!String(r.headers.get('content-type')??'').includes('application/json'))
   fail('INFL19_DELTA_PUBLIC_HTTP_DENIED');
  const data=await r.text();if(data.length<100||data.length>60000)fail('INFL19_DELTA_PUBLIC_BODY_DENIED');
  return JSON.parse(data);
 } finally {clearTimeout(t)}
}
function reportName(issue){if(!Number.isSafeInteger(issue)||issue<1||issue>999999999)
 fail('INFL19_DELTA_ISSUE_NUMBER_DENIED');return `INFL19_DELTA_B_${issue}.json`}

export async function runReal(env=process.env) {
 const e=JSON.parse(regular(env.GITHUB_EVENT_PATH)),q=verifyIssue(e,env);
 const ws=env.GITHUB_WORKSPACE;
 if(!ws||!path.win32.isAbsolute(ws))fail('INFL19_DELTA_WORKSPACE_DENIED');
 const approval=JSON.parse(regular(path.join(ws,'control','infl19-d1-publish-candidate',
  'INFLATION19_DELTA_B_CANDIDATE_APPROVAL.json')));
 if(q.sourceSha!==approval.sourceSha)fail('INFL19_DELTA_REQUEST_SOURCE_DENIED');
 const source=path.join(ws,'source');
 const mod=async rel=>import(pathToFileURL(path.join(source,...rel.split('/'))).href);
 const [previewLib,contract,gate,d1,writer]=await Promise.all([
  mod('scripts/pc-writer/inflation-causal-public-preview-r1.mjs'),
  mod('worker/inflation-causal-public-r1.mjs'),
  mod('scripts/pc-writer/EARNINGS_R4_C_D1_DUAL_SOURCE_GATES.mjs'),
  mod('scripts/pc-writer/d1.mjs'),
  mod('scripts/pc-writer/inflation-causal-public-publish-r1.mjs')]);
 if(typeof writer.publishInflation19!=='function'||typeof contract.inflationCausalPublicWriter!=='function'||
  typeof previewLib.previewInflation19!=='function')fail('INFL19_DELTA_PUBLISHER_REUSE_DENIED');
 let db;
 const deps={
  async verifyProvenance(a) {
   if(a.sourceSha!==git(source,['rev-parse','HEAD'])||
    git(source,['branch','--show-current'])!=='main'||
    git(source,['rev-parse','refs/remotes/origin/main'])!==a.sourceSha||
    git(source,['status','--porcelain','--untracked-files=no','--','worker','scripts/pc-writer'])!=='')
    fail('INFL19_DELTA_MAIN_SOURCE_DENIED');
   const conf=JSON.parse(regular(path.join(a.approvedHome,'config.json')));
   const verified=gate.validateD1DualSource({config:conf,
    publisher:gate.inspectD1Source(source,{publisher:true}),
    operational:gate.inspectD1Source(a.operationalRoot)});
   if(verified.publisherSha!==a.sourceSha)fail('INFL19_DELTA_PROVENANCE_DENIED');
   this.config=conf;
  },
  async previewStored(){
   // Reuse the installed publisher's approved stored-only preflight; never call --apply,
   // because --apply recomputes the payload after the preflight scope check.
   const dry=await writer.publishInflation19({pcHome:approval.approvedHome,apply:false});
   if(dry.status!=='PASS_DRY_RUN'||dry.ready!==19||dry.providerCalls!==0||
    dry.coreWrites!==0||dry.dbWrites!==0||dry.d1Writes!==0)
    fail('INFL19_DELTA_EXISTING_PUBLISHER_PREFLIGHT_DENIED');
   const pinned=previewLib.previewInflation19(approval.approvedHome);
   if(pinned.ready!==19||pinned.payload?.sourceVersion!==dry.sourceVersion||
    pinned.payload?.sourceStoredAt!==dry.sourceStoredAt)
    fail('INFL19_DELTA_PC_INPUT_CHANGED_DURING_PREFLIGHT');
   return pinned;
  },
  readPublic,
  validate:contract.validateInflationCausalPublic,
  async verifyD1Binding(a){
   if(!fs.existsSync(a.operationalRoot))fail('INFL19_DELTA_OPERATIONAL_ROOT_DENIED');
   const client=d1.client(this.config,()=>d1.credential(a.operationalRoot));
   db=client.adapter(this.config.core,{allowWrites:true});
  },
  async reserveOnce(a){
   const marker=a.markerPath;
   if(!path.win32.isAbsolute(marker)||!marker.startsWith('E:\\ZGmini\\automation\\inflation19-public-delta-r1\\'))
    fail('INFL19_DELTA_MARKER_PATH_DENIED');
   fs.mkdirSync(path.dirname(marker),{recursive:true});
   // Consumes only this distinct scope; never erase or reuse #296 global marker.
   try {fs.writeFileSync(marker,JSON.stringify({requestId:q.requestId,at:new Date().toISOString()}),{flag:'wx'})}
   catch(x){fail(x?.code==='EEXIST'?'INFL19_DELTA_ALREADY_ATTEMPTED':'INFL19_DELTA_MARKER_DENIED')}
  },
  async writePinnedPayload(payload){
   if(!VERSION.test(payload.sourceVersion)||payload.indicators?.length!==19)
    fail('INFL19_DELTA_PINNED_PAYLOAD_DENIED');
   return contract.inflationCausalPublicWriter(db).write(payload);
  }
 };
 let out;
 try {out=await runScopedOnce({approval,deps,dryRun:false})}
 catch(err){out={status:'BLOCKED',code:safe(err),key:KEY,providerCalls:0,
  coreWrites:0,dbWrites:0,d1Writes:0,schedulerWrites:0}}
 const report={schema:SCHEMA,issueNumber:e.issue.number,requestId:q.requestId,
  runId:env.GITHUB_RUN_ID,...out};
 fs.writeFileSync(path.join(ws,reportName(e.issue.number)),JSON.stringify(report)+'\n',{flag:'wx'});
 return report;
}

export async function upload(env=process.env) {
 const e=JSON.parse(regular(env.GITHUB_EVENT_PATH)),q=verifyIssue(e,env);
 const report=JSON.parse(regular(path.join(env.GITHUB_WORKSPACE,reportName(e.issue.number))));
 if(!env.GITHUB_TOKEN||report.requestId!==q.requestId||report.issueNumber!==e.issue.number||
  report.runId!==env.GITHUB_RUN_ID||!['PASS','STATE_UNKNOWN','BLOCKED'].includes(report.status))
  fail('INFL19_DELTA_UNTRUSTED_RESULT');
 const message='Inflation WTI+gas D1 delta B: '+report.status+' ('+report.code+')\n'+JSON.stringify(report,null,2);
 const r=await fetch('https://api.github.com/repos/'+REPO+'/issues/'+e.issue.number+'/comments',{
  method:'POST',headers:{accept:'application/vnd.github+json',authorization:'Bearer '+env.GITHUB_TOKEN,
   'content-type':'application/json'},body:JSON.stringify({body:message})});
 if(!r.ok)fail('INFL19_DELTA_UPLOAD_DENIED');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 if(process.argv.length===3&&process.argv[2]==='--upload')await upload();
 else if(process.argv.length===2) {
  try {const x=await runReal();console.log('STATUS='+x.status+' CODE='+x.code);if(x.status!=='PASS')process.exitCode=1}
  catch(e){console.log('STATUS=BLOCKED CODE='+safe(e));process.exitCode=1}
 } else fail('INFL19_DELTA_ARGS_DENIED');
}
