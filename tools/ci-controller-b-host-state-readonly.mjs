// Fixed isolated-publisher observation. Never installs policy or submits B.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {installedControllerBPolicy} from './maintenance-contract.mjs';
const ROOT='E:/ZGmini/automation/pc-maintenance';
const RECEIPTS='C:/ProgramData/ZGMINI-CI/ControllerBReceipts';
const FILES=['maintenance-contract.mjs','maintenance-apply.mjs','maintenance-agent.mjs',
 'maintenance-lock.mjs','update.mjs','maintenance-ancestry.vbs','source-bundle-register.mjs'].map(n=>'tools/'+n);
const hash=b=>createHash('sha256').update(b).digest('hex');
const state=(io,p)=>{try{const s=io.lstatSync(p);return s.isSymbolicLink()?'ALIAS':s.isDirectory()?'DIRECTORY':'OTHER';}catch(e){return e.code==='ENOENT'?'ABSENT':'UNREADABLE';}};
export function observePublisherHostState(io=fs){
 const out={schema:'ZGMINI_CI_CONTROLLER_B_HOST_STATE_READONLY_V1',
  status:'READ_ONLY_OBSERVED',maintenanceRootState:state(io,ROOT),
  receiptRootState:state(io,RECEIPTS),manifestState:'NOT_READ',manifestSha256:null,
  installedSourceSha:null,runtimeFileCount:0,matchingRuntimeFiles:0,
  policySchema:null,policyState:'UNVERIFIED',workflowId:null,workflowBlobSha:null,
  grant:null,executionAuthorized:false,operationalWrites:0,providerCalls:0,d1Writes:0};
 if(out.maintenanceRootState!=='DIRECTORY')return out;
 try{
  if(path.win32.normalize(io.realpathSync(ROOT)).toLowerCase()!==path.win32.normalize(ROOT).toLowerCase())return {...out,maintenanceRootState:'ALIAS'};
  const p=ROOT+'/MAINTENANCE_INSTALL.json',st=io.lstatSync(p);
  if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size<2||st.size>131072)return {...out,manifestState:'INVALID_FILE'};
  const bytes=io.readFileSync(p),m=JSON.parse(bytes.toString('utf8'));
  out.manifestState='READ';out.manifestSha256=hash(bytes);
  out.installedSourceSha=/^[a-f0-9]{40}$/.test(m.sourceSha??'')?m.sourceSha:null;
  out.runtimeFileCount=Object.keys(m.files??{}).length;
  for(const rel of FILES){try{const f=ROOT+'/'+rel,s=io.lstatSync(f);if(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size>0&&s.size<=1048576&&hash(io.readFileSync(f))===m.files?.[rel])out.matchingRuntimeFiles++;}catch{}}
  if(!Object.hasOwn(m,'ciControllerBPolicy')){out.policyState='ABSENT';return out;}
  try{
   const p=installedControllerBPolicy(m);
   out.policySchema=m.ciControllerBPolicy.schema;
   out.policyState='VALID_FORMAT_ONLY';out.workflowId=p.workflowId;out.workflowBlobSha=p.workflowBlobSha;
   if(p.repositoryVisibility==='public')out.grant={installedSha:p.installedSha,targetSha:p.targetSha,manifestSha256:p.manifestSha256};
  }catch{out.policyState='INVALID';}
  return out;
 }catch(e){return {...out,manifestState:e.code==='ENOENT'?'ABSENT':'UNREADABLE_OR_INVALID'};}
}
export function requireReadonlyOwnerContext(event,env,host){
 const i=event?.issue,r=event?.repository;
 if(host!=='DESKTOP-N62L0NG'||env.RUNNER_NAME!=='zgmini-handoff-ci-spare-01'||
  env.GITHUB_EVENT_NAME!=='issues'||env.GITHUB_ACTOR!=='ansqhd5774-Choi'||env.GITHUB_RUN_ATTEMPT!=='1'||
  r?.id!==1442936296||r.full_name!=='ansqhd5774-Choi/zgmini-pc-control'||r.private!==false||r.owner?.id!==327938088||
  event?.action!=='opened'||event.sender?.id!==327938088||i?.user?.id!==327938088||
  !Number.isSafeInteger(i?.number)||i.number<1||i.state!=='open'||i.pull_request||
  i.title!=='ci-controller-b-state-readonly'||i.body!=='{"schema":"ZGMINI_CI_CONTROLLER_B_STATE_READONLY_V1","role":"handoff"}')
  throw Error('CI_HOST_STATE_CONTEXT_DENIED');
 return true;
}
export async function main(){
 const e=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 requireReadonlyOwnerContext(e,process.env,os.hostname().toUpperCase());
 const expected=process.env.ZGMINI_CI_STATE_SOURCE_SHA;
 const actual=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
 if(!/^[a-f0-9]{40}$/.test(expected??'')||actual!==expected)throw Error('CI_HOST_STATE_SOURCE_DENIED');
 const report={...observePublisherHostState(),observedAtUtc:new Date().toISOString(),sourceSha:actual,runId:process.env.GITHUB_RUN_ID};
 const response=await fetch('https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/issues/'+e.issue.number+'/comments',{
  method:'POST',headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'},
  body:JSON.stringify({body:'CI 격리 호스트 고정 읽기 결과\n```json\n'+JSON.stringify(report,null,2)+'\n```'}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('CI_HOST_STATE_REPORT_UNVERIFIED');
 console.log(JSON.stringify(report));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}catch{console.log(JSON.stringify({status:'BLOCKED',code:'CI_HOST_STATE_READ_UNVERIFIED',executionAuthorized:false,operationalWrites:0}));process.exitCode=1;}
}
