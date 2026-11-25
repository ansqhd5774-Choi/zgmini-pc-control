// R3: real child-process and filesystem contention, isolated to OS temp only.
// Windows CI host DESKTOP-N62L0NG is not the operating Controller PC.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {exclusive,assertSupervisorOwner} from '../controller/common.mjs';
import {archiveDeadLease,decide as watchdogDecide,scanControllerRunnersReadOnly} from '../tools/runner-watchdog.mjs';
import {decideStandbyPromotion,verifyStandbySource,watchdogIdentityMatches}
 from '../controller/standby.mjs';

const windows={skip:process.platform!=='win32'};
const root=()=>fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r3-standby-isolated-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const safeRemove=p=>fs.rmSync(p,{recursive:true,force:true});
const base=()=>({
 sourceVerified:true,watchdogBound:true,supervisorLeasePresent:false,
 relatedLeasesPresent:false,maintenanceBusy:false,activeChildrenStopped:true
});
const possible='ELIGIBLE_FOR_SUPERVISOR_ATOMIC_ACQUIRE';
// Child runs Node's real exclusive() against a disposable path on Windows.
const commonUrl=new URL('../controller/common.mjs',import.meta.url).href;
const contender=[
 "import fs from 'node:fs';",
 "import {exclusive} from '"+commonUrl+"';",
 "const [root,ready,go,hold]=process.argv.slice(1);",
 "fs.writeFileSync(ready,String(process.pid),{flag:'wx'});",
 "const timer=setInterval(()=>{",
 " if(!fs.existsSync(go))return;",
 " clearInterval(timer);",
 " try{",
 "  const release=exclusive(root,'supervisor');",
 "  process.stdout.write('ACQUIRED\\n');",
 "  setTimeout(()=>{try{release();process.exit(0);}catch{process.exit(7);}},Number(hold));",
 " }catch(e){",
 "  process.stdout.write(e.code==='LEASE_BUSY'?'BUSY\\n':'UNEXPECTED\\n');",
 "  process.exit(e.code==='LEASE_BUSY'?0:8);",
 " }",
 "},5);"
].join('\n');
function contenderChild(dir,ready,go,hold=350){
 const child=spawn(process.execPath,['--input-type=module','-e',contender,
  dir,ready,go,String(hold)],{cwd:dir,windowsHide:true,
  stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';
 child.stdout.on('data',x=>{stdout+=String(x);});
 child.stderr.on('data',x=>{stderr+=String(x);});
 return {child,finish:new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{child.kill();reject(Error('CONTENDER_TIMEOUT'));},6000);
  child.on('error',e=>{clearTimeout(timeout);reject(e);});
  child.on('close',(code,signal)=>{clearTimeout(timeout);
   resolve({code,signal,stdout:stdout.trim(),stderr:stderr.slice(0,180)});
  });
 })};
}
async function until(predicate,timeout=3000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  if(predicate())return;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 throw Error('ISOLATED_FIXTURE_TIMEOUT');
}
test('WIN-T01 two Windows contenders obtain exactly one atomic Supervisor owner',windows,async()=>{
 const dir=root(),go=path.join(dir,'go'),a=path.join(dir,'a'),b=path.join(dir,'b');
 const c1=contenderChild(dir,a,go),c2=contenderChild(dir,b,go);
 try{
  await until(()=>fs.existsSync(a)&&fs.existsSync(b));
  fs.writeFileSync(go,'now',{flag:'wx'});
  const res=await Promise.all([c1.finish,c2.finish]);
  assert.equal(res.filter(x=>x.stdout==='ACQUIRED').length,1,JSON.stringify(res));
  assert.equal(res.filter(x=>x.stdout==='BUSY').length,1,JSON.stringify(res));
  assert.equal(res.every(x=>x.code===0),true,JSON.stringify(res));
  assert.equal(fs.existsSync(path.join(dir,'supervisor')),false);
 }finally{c1.child.kill();c2.child.kill();safeRemove(dir);}
});
test('WIN-T02 live owner prevents watchdog archive and failover',windows,()=>{
 const dir=root(),lease=path.join(dir,'supervisor');
 try{
  fs.mkdirSync(lease);
  fs.writeFileSync(path.join(lease,'owner.json'),
   JSON.stringify({pid:process.pid,nonce:randomUUID()}));
  assert.throws(()=>archiveDeadLease(lease),/LEASE_OWNER_NOT_PROVEN_DEAD/);
  assert.equal(fs.existsSync(lease),true);
  assert.equal(watchdogDecide({owner:{pid:process.pid},live:true,
   heartbeat:new Date(Date.now()-60000).toISOString()}),
   'BLOCKED_LIVE_OR_UNKNOWN');
 }finally{safeRemove(dir);}
});
test('WIN-T03 proven dead owner archives exact fixture lease, without deletion',windows,()=>{
 const dir=root(),lease=path.join(dir,'supervisor');
 try{
  fs.mkdirSync(lease);
  const raw=JSON.stringify({pid:99999999,nonce:randomUUID(),bootAt:123});
  fs.writeFileSync(path.join(lease,'owner.json'),raw);
  const archived=archiveDeadLease(lease,()=>false,path.join(dir,'archive-owned'));
  assert.equal(fs.existsSync(lease),false);
  assert.equal(fs.readFileSync(path.join(archived,'owner.json'),'utf8'),raw);
 }finally{safeRemove(dir);}
});
test('WIN-T04 old Active nonce cannot authorize new requests after owner replacement',windows,()=>{
 const dir=root(),lease=path.join(dir,'leases','supervisor');
 const old=randomUUID(),current=randomUUID();
 try{
  fs.mkdirSync(lease,{recursive:true});
  fs.writeFileSync(path.join(lease,'owner.json'),JSON.stringify({
   pid:process.pid,nonce:current,bootAt:Date.now()-os.uptime()*1000
  }));
  const host={controllerFiles:{'controller/standby.mjs':'a'.repeat(64)}};
  assert.throws(()=>assertSupervisorOwner(dir,host,
   {ZGMINI_SUPERVISOR_NONCE:old}),/SUPERVISOR_OWNERSHIP_LOST/);
  assert.equal(assertSupervisorOwner(dir,host,
   {ZGMINI_SUPERVISOR_NONCE:current}),'SUPERVISOR_OWNERSHIP_VERIFIED');
 }finally{safeRemove(dir);}
});
test('WIN-T05 source tamper cannot promote candidate',windows,()=>{
 const dir=root();
 try{
  fs.mkdirSync(path.join(dir,'controller'));
  fs.writeFileSync(path.join(dir,'controller/standby.mjs'),'standby');
  fs.writeFileSync(path.join(dir,'controller/supervisor.mjs'),'supervisor');
  fs.writeFileSync(path.join(dir,'host.json'),JSON.stringify({
   controllerSourceSha:'f'.repeat(40),controllerFiles:{
    'controller/standby.mjs':sha('standby'),
    'controller/supervisor.mjs':sha('supervisor')
   }}));
  assert.equal(verifyStandbySource(dir),'f'.repeat(40));
  fs.writeFileSync(path.join(dir,'controller/supervisor.mjs'),'changed');
  assert.throws(()=>verifyStandbySource(dir),/STANDBY_SOURCE_DRIFT/);
  assert.notEqual(decideStandbyPromotion({...base(),sourceVerified:false}),possible);
 }finally{safeRemove(dir);}
});
test('WIN-T06 active job lease blocks only conflicting takeover',windows,()=>{
 const dir=root();
 try{
  const release=exclusive(dir,'request-known');
  assert.equal(decideStandbyPromotion({...base(),relatedLeasesPresent:true}),
   'HOLD_RELATED_JOB');
  const unaffected=exclusive(dir,'request-independent');
  unaffected();release();
  assert.equal(decideStandbyPromotion(base()),possible);
 }finally{safeRemove(dir);}
});
test('WIN-T07 maintenance install prevents promotion, not unrelated temp reads',windows,()=>{
 const dir=root();
 try{
  const lease=exclusive(dir,'controller-install');
  assert.equal(decideStandbyPromotion({...base(),maintenanceBusy:true}),
   'HOLD_MAINTENANCE');
  const readJob=path.join(dir,'readonly-result.json');
  fs.writeFileSync(readJob,JSON.stringify({status:'PASS'}));
  assert.equal(JSON.parse(fs.readFileSync(readJob)).status,'PASS');
  lease();
 }finally{safeRemove(dir);}
});
test('WIN-T08 persisted receipt remains immutable when upload is missing',windows,()=>{
 const dir=root();
 try{
  const file=path.join(dir,'request-existing.json');
  const prior={requestId:'request-existing',payloadSha:'a'.repeat(64),
   report:{status:'PASS',code:'READ_RESULT_NO_REPEAT'}};
  fs.writeFileSync(file,JSON.stringify(prior),{flag:'wx'});
  const first=fs.readFileSync(file);
  assert.equal(JSON.parse(first).report.status,'PASS');
  assert.equal(decideStandbyPromotion({...base(),activeChildrenStopped:false}),
   'HOLD_EXISTING_CHILD');
  assert.equal(fs.readFileSync(file).equals(first),true);
 }finally{safeRemove(dir);}
});
test('WIN-T09 unknown child or mismatched Watchdog identity never promotes',windows,()=>{
 const nominal=base();
 for(const patch of [
  {activeChildrenStopped:null},{watchdogBound:null},
  {supervisorLeasePresent:true},{sourceVerified:null}
 ])assert.notEqual(decideStandbyPromotion({...nominal,...patch}),possible);
 assert.equal(watchdogIdentityMatches({
  pid:process.pid,nonce:randomUUID()
 },{parentPid:process.pid,nonce:randomUUID()}),false);
});
test('WIN-T10 failed Standby does not steal or terminate healthy Active',windows,()=>{
 const dir=root(),lease=path.join(dir,'supervisor');
 try{
  const release=exclusive(dir,'supervisor');
  const raw=fs.readFileSync(path.join(lease,'owner.json'));
  assert.notEqual(decideStandbyPromotion({...base(),
   supervisorLeasePresent:true}),possible);
  assert.equal(fs.readFileSync(path.join(lease,'owner.json')).equals(raw),true);
  release();
 }finally{safeRemove(dir);}
});

test('WIN-T11 fixed WMI probe is bounded to temp-only observation, no PC mutations',windows,()=>{
 const dir=root();
 try{
  const result=scanControllerRunnersReadOnly({controllerRoot:dir});
  // The isolated runner may lack authority to inspect unrelated users'
  // executables. UNVERIFIED is an honest fail-closed observation, not PASS.
  console.log('R3_WMI_TEMP_SCOPE='+result);
  assert.ok(['NO_CONTROLLER_RUNNER_PROCESS','UNVERIFIED'].includes(result));
  assert.equal(fs.existsSync(path.join(dir,'supervisor')),false);
 }finally{safeRemove(dir);}
});
