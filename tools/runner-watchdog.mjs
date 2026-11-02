// Out-of-band recovery of the existing six-seat controller. No Core/DB access.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const control='E:/ZGmini/automation/pc-control';
const maintenance='E:/ZGmini/automation/pc-maintenance';
const home='E:/ZGmini/automation/pc-watchdog';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const node='E:/ZGmini/runtime/node.exe';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,x)=>{const tmp=p+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(x,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,p);};
export function alive(pid){if(!Number.isSafeInteger(pid)||pid<=0)return null;try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}}
export function decide({paused,owner,live,heartbeat,now=Date.now()}){
 if(paused)return 'PAUSED';
 if(owner&&live!==false)return live===true&&heartbeat&&now-Date.parse(heartbeat)<45000?'HEALTHY':'BLOCKED_LIVE_OR_UNKNOWN';
 return 'RECOVER';
}
export function archiveDeadLease(directory,isAlive=alive,destination=null){
 if(!fs.existsSync(directory))return null;
 const original=fs.readFileSync(path.join(directory,'owner.json'));
 const owner=JSON.parse(original);
 if(isAlive(owner.pid)!==false)throw Error('LEASE_OWNER_NOT_PROVEN_DEAD');
 if(!original.equals(fs.readFileSync(path.join(directory,'owner.json'))))throw Error('LEASE_OWNER_CHANGED');
 const archived=destination??directory+'.dead-'+Date.now()+'-'+randomUUID();
 fs.renameSync(directory,archived); // Preserve evidence; never delete a lock.
 return archived;
}
function workflowActive(){return JSON.parse(execFileSync(gh,['api','repos/ansqhd5774-Choi/zgmini-pc-control/actions/workflows/pc-job.yml'],{encoding:'utf8',windowsHide:true,timeout:20000})).state==='active';}
function verifyController(){
 const host=read(path.join(control,'host.json'));
 for(const [rel,hash] of Object.entries(host.controllerFiles)){
  const p=path.resolve(control,rel);
  if(!p.startsWith(path.resolve(control)+path.sep)||sha(fs.readFileSync(p))!==hash)throw Error('CONTROLLER_HASH_MISMATCH');
 }
 return host.controllerSourceSha;
}
export async function main(){
 const installed=read(path.join(home,'INSTALL.json'));
 if(sha(fs.readFileSync(new URL(import.meta.url)))!==installed.sha256)throw Error('WATCHDOG_SOURCE_DRIFT');
 fs.mkdirSync(home,{recursive:true});
 const lease=path.join(home,'receiver');
 if(fs.existsSync(lease)){
  const prior=read(path.join(lease,'owner.json'));
  if(alive(prior.pid)!==false){process.exitCode=10;return;}
  archiveDeadLease(lease);
 }
 fs.mkdirSync(lease);
 const nonce=randomUUID();
 write(path.join(lease,'owner.json'),{pid:process.pid,nonce,at:new Date().toISOString()});
 let history=fs.existsSync(path.join(home,'RESTART_HISTORY.json'))?read(path.join(home,'RESTART_HISTORY.json')):[];
 let healthySince=null;
 const status=(state,extra={})=>write(path.join(home,'STATUS.json'),{at:new Date().toISOString(),pid:process.pid,state,...extra});
 async function tick(){
  try{
   const ownerFile=path.join(control,'leases/supervisor/owner.json');
   const owner=fs.existsSync(ownerFile)?read(ownerFile):null;
   const hb=fs.existsSync(path.join(control,'SUPERVISOR_STATUS.json'))?read(path.join(control,'SUPERVISOR_STATUS.json')):null;
   const paused=fs.existsSync(path.join(home,'PAUSE'))||fs.existsSync(path.join(control,'DRAIN'))
    ||fs.existsSync(path.join(maintenance,'leases/controller-install'))
    ||fs.readdirSync(path.join(control,'leases')).some(x=>x!=='supervisor'&&!x.startsWith('supervisor.dead-'));
   const state=decide({paused,owner,live:owner?alive(owner.pid):false,heartbeat:hb?.pid===owner?.pid?hb?.at:null});
   if(state==='HEALTHY'){
    healthySince??=Date.now();
    if(Date.now()-healthySince>600000&&history.length){history=[];write(path.join(home,'RESTART_HISTORY.json'),history);}
    status(state,{supervisorPid:owner.pid,heartbeatAt:hb.at});return;
   }
   healthySince=null;
   if(state!=='RECOVER'){status(state,{supervisorPid:owner?.pid??null,heartbeatAt:hb?.at??null});return;}
   if(!workflowActive()){status('PAUSED_WORKFLOW');return;}
   history=history.filter(x=>Date.now()-x<3600000);
   if(history.length>=3){status('BLOCKED_RESTART_LIMIT');return;}
   const sourceSha=verifyController();
   // Recheck update and owner immediately before recovery; no process is killed.
   if(fs.existsSync(path.join(maintenance,'leases/controller-install'))){status('PAUSED');return;}
   fs.mkdirSync(path.join(home,'archives'),{recursive:true});
   const archived=archiveDeadLease(path.join(control,'leases/supervisor'),alive,path.join(home,'archives','supervisor-'+Date.now()+'-'+randomUUID()));
   history.push(Date.now());write(path.join(home,'RESTART_HISTORY.json'),history);
   const out=fs.openSync(path.join(home,'SUPERVISOR_OUTPUT.log'),'a');
   try{
    const child=spawn(node,[path.join(control,'controller/supervisor.mjs')],{cwd:control,windowsHide:true,detached:true,stdio:['ignore',out,out],env:{...process.env}});
    child.once('error',()=>status('BLOCKED_SPAWN_ERROR'));
    child.unref();status('STARTING',{supervisorPid:child.pid??null,sourceSha,archivedLease:archived});
   }finally{fs.closeSync(out);}
  }catch(e){status('BLOCKED',{code:/^[A-Z_]+$/.test(e.message)?e.message:'WATCHDOG_CHECK_FAILED'});}
 }
 await tick();setInterval(tick,15000);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.exitCode=1;});
