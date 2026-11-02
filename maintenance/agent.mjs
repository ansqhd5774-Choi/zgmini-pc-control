// Installed independently at E:/ZGmini/automation/pc-control-maintenance.
// This fixed Scheduled Task is NOT a child of any GitHub Actions Runner.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const settings=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
for(const name of ['agent.mjs','contract.mjs','processor.mjs']){
 if(settings.files?.[name]!==digest(fs.readFileSync(path.join(root,name)))){
  console.error(JSON.stringify({status:'AUTOMATION_BLOCKED',code:'MAINTENANCE_SOURCE_DRIFT'}));
  process.exit(1);
 }
}
const {processUpdate}=await import('./processor.mjs');
const {CONTROL_REPOSITORY,UPDATE_LABEL}=await import('./contract.mjs');
const control='E:/ZGmini/automation/pc-control';
const repo='E:/ZGmini/projects/zgmini-pc-control';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const node='E:/ZGmini/runtime/node.exe';
const taskExe=path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe');
const codes=/^[A-Z0-9_]{1,80}$/;
const need=(condition,code)=>{if(!condition)throw Object.assign(Error(code),{code});};
const write=(file,value)=>{const t=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(t,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(t,file);};
const git=(args,opts={})=>execFileSync('git',['-C',repo,...args],{windowsHide:true,timeout:opts.timeout??45000,maxBuffer:8000000,encoding:opts.binary?undefined:'utf8'});
function api(route,method='GET',value){
 const args=['api','-X',method,'repos/'+CONTROL_REPOSITORY+'/'+route];
 if(value!==undefined)args.push('--input','-');
 const output=execFileSync(gh,args,{windowsHide:true,timeout:30000,maxBuffer:6000000,
   encoding:'utf8',input:value===undefined?undefined:JSON.stringify(value)});
 return output?.trim()?JSON.parse(output):null;
}
function page(label){
 const all=[];
 for(let p=1;p<=20;p++){
  const rows=api('issues?state=open&labels='+encodeURIComponent(label)+'&per_page=100&page='+p);
  need(Array.isArray(rows),'ISSUE_QUERY_FAILED');all.push(...rows.filter(x=>!x.pull_request));
  if(rows.length<100)return all;
 }
 throw Object.assign(Error('ISSUE_PAGE_LIMIT_STOP'),{code:'ISSUE_PAGE_LIMIT_STOP'});
}
function readHost(){
 const host=JSON.parse(fs.readFileSync(path.join(control,'host.json'),'utf8'));
 const manifestValid=Object.entries(host.controllerFiles).every(([rel,sha])=>{
  if(!/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel))return false;
  const file=path.join(control,rel);return fs.existsSync(file)&&digest(fs.readFileSync(file))===sha;
 });
 return {sha:host.controllerSourceSha,manifestValid,protectedSha:protectedHash()};
}
function protectedHash(){
 const files={},tasks={};
 for(const name of ['config.json','quota-runner.cmd','run-local.cmd']){
  const file=path.join('E:/ZGmini/data/pc-writer',name);
  if(fs.existsSync(file))files[name]=digest(fs.readFileSync(file));
 }
 for(const task of ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Iran-Progress-R13']){
  tasks[task]=digest(execFileSync(taskExe,['/Query','/TN',task,'/XML'],{windowsHide:true,timeout:12000,maxBuffer:262144}));
 }
 return digest(JSON.stringify({files,tasks}));
}
function runners(){
 const data=api('actions/runners?per_page=100');
 need(data?.runners?.length===6,'RUNNER_REGISTRATION_COUNT');
 const names=data.runners.map(x=>x.name).sort();
 need(names.every((x,i)=>x===`zgmini-pc-${String(i+1).padStart(2,'0')}`),'RUNNER_IDENTITY_CHANGED');
 return data.runners;
}
function workflowEnabled(){return api('actions/workflows/pc-job.yml')?.state==='active';}
function inspectChanges(request){
 const remote=git(['remote','get-url','origin']).trim();
 need(['https://github.com/'+CONTROL_REPOSITORY+'.git','git@github.com:'+CONTROL_REPOSITORY+'.git'].includes(remote),'CONTROL_REMOTE_NOT_APPROVED');
 git(['fetch','--no-tags','origin','main'],{timeout:90000});
 need(git(['cat-file','-t',request.targetSha]).trim()==='commit','TARGET_NOT_A_COMMIT');
 try{git(['merge-base','--is-ancestor',request.targetSha,'refs/remotes/origin/main']);}
 catch{throw Object.assign(Error('TARGET_NOT_IN_CONTROL_MAIN'),{code:'TARGET_NOT_IN_CONTROL_MAIN'});}
 const resultMutations=git(['diff','--name-status','--no-renames','--diff-filter=DMR',request.installedSha,request.targetSha,'--','results/']);
 need(!resultMutations.trim(),'EXISTING_REPORTS_MODIFIED');
 const lines=git(['diff','--name-status','--no-renames',request.installedSha,request.targetSha,'--','.',':(exclude)results/**']).trim().split(/\r?\n/).filter(Boolean);
 need(lines.length<=100,'CONTROL_CODE_DIFF_TOO_LARGE');
 return lines.map(line=>{
  const m=/^([AMD])\t([^\t\r\n]+)$/.exec(line);need(m,'CONTROL_DIFF_UNEXPECTED');
  const [_,status,file]=m;
  if(status==='D')return {path:file,status};
  const bytes=git(['show',request.targetSha+':'+file],{binary:true});
  return {path:file,status,sha256:digest(bytes)};
 });
}
function isIdle(){
 try{
  if(runners().some(x=>x.status!=='online'||x.busy))return {ok:false,code:'RUNNER_OFFLINE_OR_BUSY'};
  if(api('actions/runs?status=in_progress&per_page=1')?.total_count>0||api('actions/runs?status=queued&per_page=1')?.total_count>0)return {ok:false,code:'CONTROL_ACTIONS_BUSY'};
  if(fs.readdirSync(path.join(control,'leases')).some(x=>x!=='supervisor'))return {ok:false,code:'CONTROL_LEASES_BUSY'};
  return {ok:true};
 }catch{return {ok:false,code:'IDLE_EVIDENCE_UNAVAILABLE'};}
}
function auditApplied(request,record){
 const installed=readHost(),items=runners();
 // After reconnection, legitimate queued work may make a Runner busy immediately.
 const six=items.length===6&&items.every(x=>x.status==='online');
 const protectedOk=!!record.protectedBeforeSha256&&record.protectedBeforeSha256===installed.protectedSha;
 const enabled=workflowEnabled();
 return {verified:installed.sha===request.targetSha&&installed.manifestValid&&six&&protectedOk&&enabled,
  actualInstalledSha:installed.sha,runnerCount:six?6:null,protectedStateUnchanged:protectedOk,workflowEnabled:enabled};
}
function apply(request,record){
 need(isIdle().ok,'RUNNER_IDLE_GATE_CHANGED');
 const output=execFileSync(node,[path.join(repo,'tools/update.mjs')],{cwd:repo,windowsHide:true,
   env:{...process.env,ZGMINI_CONTROL_UPDATE_TARGET_SHA:request.targetSha},
   timeout:240000,maxBuffer:100000,encoding:'utf8'});
 const receipt=JSON.parse(output.trim());
 need(receipt.status==='CONTROLLER_UPDATED_SIX_RECONNECTED'&&receipt.controlSourceSha===request.targetSha&&receipt.protectedStateUnchanged===true,'UPDATE_RECEIPT_INVALID');
 const audited=auditApplied(request,record);
 return {...audited,backup:receipt.backup??null,code:'CONTROLLER_UPDATED_SIX_RECONNECTED'};
}
function hasResultComment(n){
 const comments=api(`issues/${n}/comments?per_page=100`);
 need(Array.isArray(comments),'COMMENT_LOOKUP_FAILED');
 return comments.some(x=>x.body?.includes('<!-- zgmini-pc-result:'));
}
function replayPending(record){
 const min=Date.parse(record.appliedAt),max=Date.parse(record.applyFinishedAt??new Date().toISOString());
 need(Number.isFinite(min)&&Number.isFinite(max)&&max>=min,'REPLAY_WINDOW_INVALID');
 let count=0;
 for(const issue of page('pc-job')){
  const at=Date.parse(issue.created_at);
  if(!(at>=min-2000&&at<=max+1000))continue;
  const labels=issue.labels?.map(x=>x.name)??[];
  if(labels.includes('pc-job-replay')||hasResultComment(issue.number))continue;
  api(`issues/${issue.number}/labels`,'POST',{labels:['pc-job-replay']});count++;
 }
 return count;
}
function acquire(){
 const lock=path.join(root,'agent-lease');
 try{fs.mkdirSync(lock);}catch(error){
  if(error.code!=='EEXIST')throw error;
  const file=path.join(lock,'owner.json');let owner;
  try{owner=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return false;}
  if(!Number.isSafeInteger(owner.pid)||Date.now()-Date.parse(owner.at)<120000)return false;
  const previousBoot=Number(owner.bootAt),currentBoot=Date.now()-os.uptime()*1000;
  if(!(Number.isFinite(previousBoot)&&Math.abs(previousBoot-currentBoot)>10000)){
   try{process.kill(owner.pid,0);return false;}catch(e){if(e.code!=='ESRCH')return false;}
  }
  // Own isolated maintenance lease only; never touch Core or Runner leases.
  fs.renameSync(lock,path.join(root,'stale-agent-lease-'+Date.now()));fs.mkdirSync(lock);
 }
 const nonce=randomUUID();write(path.join(lock,'owner.json'),{pid:process.pid,nonce,at:new Date().toISOString(),bootAt:Date.now()-os.uptime()*1000});
 return ()=>{const file=path.join(lock,'owner.json');const now=JSON.parse(fs.readFileSync(file));
   if(now.nonce!==nonce)throw Error('MAINTENANCE_LEASE_OWNER_CHANGED');fs.unlinkSync(file);fs.rmdirSync(lock);};
}
async function publish(n,result){
 const requestId=result.requestId;
 need(/^[a-z0-9-]{8,80}$/.test(requestId),'PUBLISH_REQUEST_ID');
 const json=JSON.stringify(result,null,2)+'\n';
 const txt=Object.entries(result).map(([k,v])=>`${k}=${v??'null'}`).join('\r\n')+'\r\n';
 need(Buffer.byteLength(json)+Buffer.byteLength(txt)<32768,'UPDATE_REPORT_TOO_LARGE');
 const links=[];
 for(const [extension,body] of [['json',json],['txt',txt]]){
  const file=`results/controller-update-${requestId}.${extension}`;
  const existing=(()=>{try{return api('contents/'+file);}catch{return null;}})();
  if(existing?.content){need(Buffer.from(existing.content.replace(/\s/g,''),'base64').toString()===body,'UPDATE_RESULT_CHANGED');}
  else {
   let success=false;
   for(let attempt=0;attempt<3&&!success;attempt++){
    try{api('contents/'+file,'PUT',{message:`report: controller update ${requestId}`,content:Buffer.from(body).toString('base64'),branch:'main'});success=true;}
    catch{const confirmed=(()=>{try{return api('contents/'+file);}catch{return null;}})();
      if(confirmed?.content&&Buffer.from(confirmed.content.replace(/\s/g,''),'base64').toString()===body)success=true;
    }
   }
   if(!success)continue;
  }
  links.push(`https://github.com/${CONTROL_REPOSITORY}/blob/main/${file}`);
 }
 need(links.length===2,'UPDATE_RESULT_FILES_PENDING');
 const marker=`<!-- zgmini-controller-update:${requestId} -->`;
 const comments=api(`issues/${n}/comments?per_page=100`);
 need(Array.isArray(comments),'UPDATE_COMMENT_LOOKUP');
 if(!comments.some(x=>x.body?.includes(marker))){
  const body=[marker,`**${result.status} — ${result.code}**`,...links.map(x=>'- '+x),'', 'JSON:', '```json',json,'```','TXT:','```text',txt,'```'].join('\n');
  try{api(`issues/${n}/comments`,'POST',{body});}
  catch{need(api(`issues/${n}/comments?per_page=100`)?.some(x=>x.body?.includes(marker)),'UPDATE_COMMENT_OUTCOME_UNKNOWN');}
 }
}
const ledgerRoot=path.join(root,'ledger');
fs.mkdirSync(ledgerRoot,{recursive:true});
const io={approvedBootstrapTargetSha:settings.approvedBootstrapTargetSha,
 load:id=>{const file=path.join(ledgerRoot,id+'.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;},
 save:r=>write(path.join(ledgerRoot,r.requestId+'.json'),r),
 inspectInstalled:async()=>readHost(),inspectChanges:async request=>inspectChanges(request),
 isIdle:async()=>isIdle(),apply:async(request)=>apply(request,io.load(request.requestId)),
 auditApplied:async(request,record)=>auditApplied(request,record),
 replayPending:async(record)=>replayPending(record),publish};

const release=acquire();
if(!release){console.log(JSON.stringify({status:'MAINTENANCE_ALREADY_RUNNING'}));process.exit(0);}
try{
 need(settings.schema==='ZGMINI_PC_MAINTENANCE_BOOTSTRAP_V1'&&settings.controlRepository===CONTROL_REPOSITORY,'MAINTENANCE_CONFIG');
 const updates=page(UPDATE_LABEL);
 for(const issue of updates){
  const result=await processUpdate({number:issue.number,actor:issue.user?.login,labels:issue.labels?.map(x=>x.name),body:issue.body},io);
  if(result.status==='BLOCKED'&&!result.requestId)await publishInvalid(issue.number,result);
  if(result.status==='WAITING'){
   const marker=`<!-- zgmini-controller-update-waiting:${result.requestId} -->`;
   const comments=api(`issues/${issue.number}/comments?per_page=100`);
   if(Array.isArray(comments)&&!comments.some(x=>x.body?.includes(marker)))
    api(`issues/${issue.number}/comments`,'POST',{body:`${marker}\nWAITING — ${result.code}\nrequestId=${result.requestId}\nNo controller update has been reported as complete.`});
  }
  if(['PASS','BLOCKED','FAIL'].includes(result.status)&&
    ((result.requestId&&io.load(result.requestId)?.published===true)||(!result.requestId)))
    api(`issues/${issue.number}`,'PATCH',{state:'closed'});
  console.log(JSON.stringify({issueNumber:issue.number,status:result.status,code:result.code,actualInstalledSha:result.actualInstalledSha??null}));
  if(result.phase==='APPLYING'||result.phase==='APPLIED_PENDING_REPLAY'||result.status==='WAITING')break; // one update at a time
 }
}catch(error){console.error(JSON.stringify({status:'AUTOMATION_BLOCKED',code:codes.test(error.code??'')?error.code:'MAINTENANCE_AGENT_ERROR'}));process.exitCode=1;}
finally{release();}

async function publishInvalid(n,r){
 const marker='<!-- zgmini-controller-update-invalid -->';
 const comments=api(`issues/${n}/comments?per_page=100`);
 if(Array.isArray(comments)&&!comments.some(x=>x.body?.includes(marker)))api(`issues/${n}/comments`,'POST',{body:`${marker}\nBLOCKED — ${r.code}\nNo controller change was requested or executed.`});
}
