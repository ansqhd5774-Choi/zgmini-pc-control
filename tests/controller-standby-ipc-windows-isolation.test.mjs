// R3: real Standby IPC and supervisor lease acquisition on isolated Windows.
// This fixture NEVER invokes installed Watchdog, operational Runner or Worker.
// Only copies of the tested modules inside a new OS TEMP directory may run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';

const win={skip:process.platform!=='win32'};
const hash=b=>createHash('sha256').update(b).digest('hex');
const tempPrefix='zgmini-r3-ipc-isolated-';
const originalStandby=fs.readFileSync(new URL('../controller/standby.mjs',import.meta.url),'utf8');
const originalCommon=fs.readFileSync(new URL('../controller/common.mjs',import.meta.url));
const mockSupervisor=[
 "import fs from 'node:fs';",
 "import path from 'node:path';",
 "import {fileURLToPath} from 'node:url';",
 "import {exclusive} from './common.mjs';",
 "const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));",
 "const release=exclusive(path.join(root,'leases'),'supervisor');",
 "const owner=JSON.parse(fs.readFileSync(path.join(root,'leases/supervisor/owner.json')));",
 "fs.writeFileSync(path.join(root,'PROMOTED.json'),JSON.stringify({pid:process.pid,ownerPid:owner.pid}),{flag:'wx'});",
 "process.on('exit',()=>{try{release();}catch{}});",
 "setInterval(()=>{},1000);"
].join('\n');

function fixture(){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),tempPrefix));
 const control=path.join(base,'pc-control');
 const watchdog=path.join(base,'pc-watchdog');
 const maintenance=path.join(base,'pc-maintenance');
 const controller=path.join(control,'controller');
 fs.mkdirSync(controller,{recursive:true});
 fs.mkdirSync(path.join(control,'leases'),{recursive:true});
 fs.mkdirSync(path.join(watchdog,'receiver'),{recursive:true});
 fs.mkdirSync(path.join(maintenance,'leases'),{recursive:true});
 const a="const watchdogHome='E:/ZGmini/automation/pc-watchdog';";
 const b="const maintenanceHome='E:/ZGmini/automation/pc-maintenance';";
 assert.equal(originalStandby.split(a).length,2,'watchdog path anchor changed');
 assert.equal(originalStandby.split(b).length,2,'maintenance path anchor changed');
 const cloned=originalStandby.replace(a,'const watchdogHome='+JSON.stringify(watchdog)+';')
  .replace(b,'const maintenanceHome='+JSON.stringify(maintenance)+';');
 assert.ok(!cloned.includes("const watchdogHome='E:/ZGmini"),'operating watchdog path leaked');
 assert.ok(!cloned.includes("const maintenanceHome='E:/ZGmini"),'operating maintainer path leaked');
 const standbyFile=path.join(controller,'standby.mjs');
 const supervisorFile=path.join(controller,'supervisor.mjs');
 const commonFile=path.join(controller,'common.mjs');
 fs.writeFileSync(standbyFile,cloned,{flag:'wx'});
 fs.writeFileSync(supervisorFile,mockSupervisor,{flag:'wx'});
 fs.writeFileSync(commonFile,originalCommon,{flag:'wx'});
 const sourceSha='7'.repeat(40);
 fs.writeFileSync(path.join(control,'host.json'),JSON.stringify({
  controllerSourceSha:sourceSha,
  controllerFiles:{
   'controller/standby.mjs':hash(cloned),
   'controller/supervisor.mjs':hash(mockSupervisor),
   'controller/common.mjs':hash(originalCommon)
  }
 }),{flag:'wx'});
 const nonce=randomUUID();
 fs.writeFileSync(path.join(watchdog,'receiver','owner.json'),JSON.stringify({
  pid:process.pid,nonce
 }),{flag:'wx'});
 return {base,control,watchdog,maintenance,standbyFile,sourceSha,nonce};
}

function startCandidate(fx,overrides={}){
 const env={...process.env,GITHUB_ACTIONS:'',RUNNER_NAME:'',
  ZGMINI_WATCHDOG_NONCE:fx.nonce,
  ZGMINI_WATCHDOG_PID:String(process.pid),...overrides};
 const child=spawn(process.execPath,[fx.standbyFile],{
  cwd:fx.control,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env
 });
 const messages=[];let err='';
 child.on('message',m=>messages.push(m));
 child.stderr.on('data',b=>{err+=String(b);});
 const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 return {child,messages,closed,error:()=>err.slice(0,200)};
}
async function waitFor(condition,what,timeout=6500){
 const begin=Date.now();
 while(Date.now()-begin<timeout){
  const result=condition();
  if(result)return result;
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 throw Error('STANDBY_ISOLATED_TIMEOUT_'+what);
}
const saw=(c,type)=>c.messages.find(m=>m?.type===type);
async function cleanup(fx,...candidates){
 for(const c of candidates)c?.child?.kill();
 await Promise.all(candidates.map(async c=>{
  if(!c)return;
  await Promise.race([c.closed,new Promise(resolve=>setTimeout(resolve,1200))]);
 }));
 fs.rmSync(fx.base,{recursive:true,force:true});
}
test('IPC-T01 READY is truly passive, Watchdog IPC PROMOTE acquires exact temp Supervisor lease',win,async()=>{
 const fx=fixture(),c=startCandidate(fx);
 try{
  await waitFor(()=>saw(c,'READY'),'READY');
  assert.equal(saw(c,'READY').pid,c.child.pid);
  assert.equal(saw(c,'READY').sourceSha,fx.sourceSha);
  assert.equal(fs.existsSync(path.join(fx.control,'leases','supervisor')),false);
  assert.equal(fs.existsSync(path.join(fx.control,'PROMOTED.json')),false);
  c.child.send({type:'PROMOTE',oldChildrenStopped:true});
  await waitFor(()=>saw(c,'PROMOTION_ATTEMPTED'),'ATTEMPTED');
  await waitFor(()=>fs.existsSync(path.join(fx.control,'PROMOTED.json')),'ATOMIC_LEASE');
  const owner=JSON.parse(fs.readFileSync(path.join(fx.control,'leases','supervisor','owner.json')));
  const marker=JSON.parse(fs.readFileSync(path.join(fx.control,'PROMOTED.json')));
  assert.equal(owner.pid,c.child.pid);
  assert.equal(marker.ownerPid,owner.pid);
  assert.equal(saw(c,'PROMOTION_FAILED'),undefined);
 }finally{await cleanup(fx,c);}
});
test('IPC-T02 candidate holds and exits without lease when Watchdog has not proved old children',win,async()=>{
 const fx=fixture(),c=startCandidate(fx);
 try{
  await waitFor(()=>saw(c,'READY'),'READY');
  c.child.send({type:'PROMOTE',oldChildrenStopped:false});
  const result=await waitFor(()=>saw(c,'PROMOTION_BLOCKED'),'BLOCKED');
  assert.equal(result.code,'HOLD_EXISTING_CHILD');
  await c.closed;
  assert.equal(fs.existsSync(path.join(fx.control,'leases','supervisor')),false);
  assert.equal(fs.existsSync(path.join(fx.control,'PROMOTED.json')),false);
 }finally{await cleanup(fx,c);}
});
test('IPC-T03 existing Active lease blocks one-shot promotion and preserves owner bytes',win,async()=>{
 const fx=fixture();
 const lease=path.join(fx.control,'leases','supervisor');
 fs.mkdirSync(lease);
 const original=JSON.stringify({pid:process.pid,nonce:randomUUID()});
 fs.writeFileSync(path.join(lease,'owner.json'),original,{flag:'wx'});
 const c=startCandidate(fx);
 try{
  await waitFor(()=>saw(c,'READY'),'READY');
  c.child.send({type:'PROMOTE',oldChildrenStopped:true});
  const result=await waitFor(()=>saw(c,'PROMOTION_BLOCKED'),'BLOCKED_OWNER');
  assert.equal(result.code,'HOLD_EXISTING_OWNER');
  assert.equal(fs.readFileSync(path.join(lease,'owner.json'),'utf8'),original);
  assert.equal(fs.existsSync(path.join(fx.control,'PROMOTED.json')),false);
 }finally{await cleanup(fx,c);}
});
test('IPC-T04 mismatched Watchdog identity fails closed before READY, without touching lease',win,async()=>{
 const fx=fixture(),c=startCandidate(fx,{ZGMINI_WATCHDOG_NONCE:randomUUID()});
 try{
  const result=await c.closed;
  assert.notEqual(result.code,0);
  assert.equal(saw(c,'READY'),undefined);
  assert.equal(fs.existsSync(path.join(fx.control,'leases','supervisor')),false);
 }finally{await cleanup(fx,c);}
});
test('IPC-T05 two READY candidates race, but exact temp supervisor lease has only one owner',win,async()=>{
 const fx=fixture(),a=startCandidate(fx),b=startCandidate(fx);
 try{
  await waitFor(()=>saw(a,'READY')&&saw(b,'READY'),'BOTH_READY');
  assert.equal(fs.existsSync(path.join(fx.control,'leases','supervisor')),false);
  a.child.send({type:'PROMOTE',oldChildrenStopped:true});
  b.child.send({type:'PROMOTE',oldChildrenStopped:true});
  // The second candidate may be rejected at the preflight owner check,
  // OR both may pass preflight and the atomic mkdir rejects one of them.
  // These are both safe, valid schedules; do not require two attempts.
  await waitFor(()=>saw(a,'PROMOTION_ATTEMPTED')||saw(b,'PROMOTION_ATTEMPTED'),'ONE_ATTEMPT');
  await waitFor(()=>fs.existsSync(path.join(fx.control,'PROMOTED.json')),'ONE_OWNER');
  const owner=JSON.parse(fs.readFileSync(path.join(fx.control,'leases','supervisor','owner.json')));
  assert.ok([a.child.pid,b.child.pid].includes(owner.pid));
  const loser=owner.pid===a.child.pid?b:a;
  await waitFor(()=>saw(loser,'PROMOTION_FAILED')||saw(loser,'PROMOTION_BLOCKED'),'SECOND_REJECTED');
  assert.equal(saw(loser,'PROMOTION_ATTEMPTED')===undefined||
    saw(loser,'PROMOTION_FAILED')!==undefined,true);
  assert.equal(fs.readdirSync(path.join(fx.control,'leases')).filter(x=>x==='supervisor').length,1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(fx.control,'PROMOTED.json'))).ownerPid,owner.pid);
 }finally{await cleanup(fx,a,b);}
});
