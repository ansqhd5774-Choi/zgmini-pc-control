import test from 'node:test';
// Reuse existing standby CI; this preflight has no Windows operating effects.
import './supervisor-orphan-readonly.test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {decideStandbyPromotion as decide,watchdogIdentityMatches,
 verifyStandbySource} from '../controller/standby.mjs';
import {assertSupervisorOwner} from '../controller/common.mjs';
import {provenOldRunnerExit,classifyRunnerExecutableProof,verifiedColdStandbyStart,selectStandbyCandidate,canReconcileExitedPendingPromotion} from '../tools/runner-watchdog.mjs';

const eligible=()=>({
 sourceVerified:true,watchdogBound:true,supervisorLeasePresent:false,
 relatedLeasesPresent:false,maintenanceBusy:false,activeChildrenStopped:true
});
const ok='ELIGIBLE_FOR_SUPERVISOR_ATOMIC_ACQUIRE';
test('standby is eligible only when Watchdog proved every protection boundary',()=>{
 assert.equal(decide(eligible()),ok);
 for(const [key,expected] of [
  ['sourceVerified','HOLD_SOURCE_UNVERIFIED'],
  ['watchdogBound','HOLD_WATCHDOG_IDENTITY'],
  ['supervisorLeasePresent','HOLD_EXISTING_OWNER'],
  ['relatedLeasesPresent','HOLD_RELATED_JOB'],
  ['maintenanceBusy','HOLD_MAINTENANCE'],
  ['activeChildrenStopped','HOLD_EXISTING_CHILD']
 ]){
  const x=eligible();x[key]=key==='supervisorLeasePresent'||
   key==='relatedLeasesPresent'||key==='maintenanceBusy'?true:false;
  assert.equal(decide(x),expected,key);
 }
});
test('unknown source, Watchdog, owner or children never promotes',()=>{
 for(const key of Object.keys(eligible())){
  const x=eligible();x[key]=null;
  assert.notEqual(decide(x),ok,key);
 }
});
test('exited standby promotion may clear the fence only with exact zero-owner and six-seat exit proof',()=>{
 const pending={child:{pid:77101},promoting:true,ready:false,slot:1};
 const heartbeat={pid:77000,children:Array.from({length:6},(_,i)=>({
  seat:i+1,pid:77010+i
 }))};
 const proof='NO_CONTROLLER_RUNNER_PROCESS';
 const stopped=()=>false;
 const ok=opts=>canReconcileExitedPendingPromotion({
  pending,owner:null,heartbeat,runnerExecutableProof:proof,pidAlive:stopped,...opts
 });
 assert.equal(ok(),true);
 assert.equal(ok({pending:null}),false);
 assert.equal(ok({pending:{...pending,promoting:false}}),false);
 assert.equal(ok({pending:{...pending,child:{pid:0}}}),false);
 assert.equal(ok({owner:{pid:77000}}),false);
 assert.equal(ok({heartbeat:null}),false);
 assert.equal(ok({heartbeat:{...heartbeat,children:heartbeat.children.slice(0,5)}}),false);
 assert.equal(ok({runnerExecutableProof:'ACTIVE_RUNNER_PROCESS'}),false);
 assert.equal(ok({runnerExecutableProof:'UNVERIFIED'}),false);
 assert.equal(ok({pidAlive:pid=>pid===77101?true:false}),false);
 assert.equal(ok({pidAlive:pid=>pid===77101?null:false}),false);
 assert.equal(ok({pidAlive:pid=>pid===77000?true:false}),false);
 assert.equal(ok({pidAlive:pid=>pid===77015?true:false}),false);
 // The coordinator must not re-elect if it cannot prove this exact exit.
 const source=fs.readFileSync(new URL('../tools/runner-watchdog.mjs',import.meta.url),'utf8');
 assert.match(source,/const safe=canReconcileExitedPendingPromotion\(/);
 assert.match(source,/if\(!safe\)\{\s*status\('BLOCKED_STANDBY_PROMOTION_OUTCOME_UNKNOWN'\);return;/);
 assert.ok(source.indexOf('const safe=canReconcileExitedPendingPromotion(')<
  source.indexOf('promotionPending=null;',source.indexOf('const safe=canReconcileExitedPendingPromotion(')));
 assert.match(source,/if\(standbyMode&&!verifiedColdStandbyStart/);
 assert.match(source,/scanControllerRunnersReadOnly\(\)!=='NO_CONTROLLER_RUNNER_PROCESS'/);
});

test('no second independent standby leader election or Runner launch',()=>{
 const src=fs.readFileSync(new URL('../controller/standby.mjs',import.meta.url),'utf8');
 assert.match(src,/typeof process\.send!=='function'/);
 assert.match(src,/message\?\.type!=='PROMOTE'/);
 assert.match(src,/await import\('\.\/supervisor\.mjs'\)/);
 assert.doesNotMatch(src,/taskkill\.exe|core\.lock|workflow_dispatch|run\.cmd/);
});
test('only exact owned Watchdog IPC identity can instruct candidate',()=>{
 const nonce=randomUUID(),owner={pid:1234,nonce};
 assert.equal(watchdogIdentityMatches(owner,{parentPid:1234,nonce}),true);
 assert.equal(watchdogIdentityMatches(owner,{parentPid:1235,nonce}),false);
 assert.equal(watchdogIdentityMatches(owner,{parentPid:1234,nonce:randomUUID()}),false);
 assert.equal(watchdogIdentityMatches(null,{parentPid:1234,nonce}),false);
});
test('source verification is tied to exact installed host manifest',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-standby-src-'));
 const sha=b=>createHash('sha256').update(b).digest('hex');
 try{
  fs.mkdirSync(path.join(dir,'controller'));
  fs.writeFileSync(path.join(dir,'controller/standby.mjs'),'standby');
  fs.writeFileSync(path.join(dir,'controller/supervisor.mjs'),'supervisor');
  const host={controllerSourceSha:'a'.repeat(40),
   controllerFiles:{'controller/standby.mjs':sha('standby'),
    'controller/supervisor.mjs':sha('supervisor')}};
  fs.writeFileSync(path.join(dir,'host.json'),JSON.stringify(host));
  assert.equal(verifyStandbySource(dir),host.controllerSourceSha);
  fs.writeFileSync(path.join(dir,'controller/standby.mjs'),'tampered');
  assert.throws(()=>verifyStandbySource(dir),/STANDBY_SOURCE_DRIFT/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('legacy Supervisor job entry stays unchanged until attested R3 install',()=>{
 assert.equal(assertSupervisorOwner('/tmp/unused',{controllerFiles:{}}),
  'LEGACY_CONTROLLER_UNCHANGED');
});
test('current owner nonce must match on every new job entry',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-standby-owner-'));
 const nonce=randomUUID();
 const host={controllerFiles:{'controller/standby.mjs':'a'.repeat(64)}};
 try{
  fs.mkdirSync(path.join(dir,'leases','supervisor'),{recursive:true});
  const f=path.join(dir,'leases/supervisor/owner.json');
  fs.writeFileSync(f,JSON.stringify({pid:process.pid,nonce,
   bootAt:Date.now()-os.uptime()*1000}));
  assert.equal(assertSupervisorOwner(dir,host,{ZGMINI_SUPERVISOR_NONCE:nonce}),
   'SUPERVISOR_OWNERSHIP_VERIFIED');
  assert.throws(()=>assertSupervisorOwner(dir,host,{ZGMINI_SUPERVISOR_NONCE:randomUUID()}),
   /SUPERVISOR_OWNERSHIP_LOST/);
  assert.throws(()=>assertSupervisorOwner(dir,host,{}),
   /SUPERVISOR_OWNERSHIP_UNVERIFIED/);
  fs.writeFileSync(f,JSON.stringify({pid:process.pid,nonce,bootAt:Date.now()-86400000}));
  assert.throws(()=>assertSupervisorOwner(dir,host,{ZGMINI_SUPERVISOR_NONCE:nonce}),
   /SUPERVISOR_OWNERSHIP_LOST/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('run entry and Worker path both check supervisor ownership',()=>{
 const entry=fs.readFileSync(new URL('../controller/entry.mjs',import.meta.url),'utf8');
 const engine=fs.readFileSync(new URL('../controller/engine.mjs',import.meta.url),'utf8');
 const supervisor=fs.readFileSync(new URL('../controller/supervisor.mjs',import.meta.url),'utf8');
 assert.match(entry,/assertSupervisorOwner\(root,host\)/);
 assert.match(engine,/preflightOperation='SUPERVISOR_OWNERSHIP';assertSupervisorOwner\(root,host\)/);
 assert.ok(engine.indexOf("preflightOperation='SUPERVISOR_OWNERSHIP'")<
  engine.indexOf("preflightOperation='WORKER_EXECUTION'"));
 assert.match(supervisor,/ZGMINI_SUPERVISOR_NONCE:leaseNonce/);
});
test('Watchdog stays sole recovery authority; standby is opt-in after B install',()=>{
 const src=fs.readFileSync(new URL('../tools/runner-watchdog.mjs',import.meta.url),'utf8');
 assert.match(src,/installed\.standby\?\.mode==='ACTIVE_1_STANDBY_1'/);
 assert.match(src,/installed\.standby\?\.approved===true/);
 assert.match(src,/archiveDeadLease\(path\.join\(control,'leases\/supervisor'\)/);
 assert.match(src,/candidate\.child\.send\(\{type:'PROMOTE',oldChildrenStopped:true\}/);
 assert.match(src,/BLOCKED_OLD_RUNNER_CHILD_UNVERIFIED/);
 assert.match(src,/if\(standbyMode\)\{/);
});
test('active maintenance and existing related work prevent standby promotion',()=>{
 for(const overrides of [
  {maintenanceBusy:true},
  {relatedLeasesPresent:true},
  {supervisorLeasePresent:true},
  {activeChildrenStopped:false}
 ]){
  assert.notEqual(decide({...eligible(),...overrides}),ok);
 }
});
test('Watchdog still leaves old registration path intact without standby activation',()=>{
 const src=fs.readFileSync(new URL('../tools/runner-watchdog.mjs',import.meta.url),'utf8');
 assert.match(src,/if\(standbyMode\)\{[\s\S]*?return;[\s\S]*?const out=fs\.openSync\(path\.join\(home,'SUPERVISOR_OUTPUT\.log'\)/);
 assert.match(src,/const child=spawn\(node,\[path\.join\(control,'controller\/supervisor\.mjs'\)\]/);
});

test('Standby never promotes from missing, partial or ambiguous Runner heartbeat',()=>{
 const owner={pid:8810,nonce:randomUUID()};
 const children=Array.from({length:6},(_,i)=>({seat:i+1,pid:10010+i,alive:false}));
 const hb={pid:8810,children};
 const exited=()=>false;
 assert.equal(provenOldRunnerExit({owner,heartbeat:hb,pidAlive:exited}),true);
 assert.equal(provenOldRunnerExit({owner,heartbeat:null,pidAlive:exited}),false);
 // Clean startup without a prior lease is safe only with a complete
 // historical six-seat heartbeat and a proven-dead prior Supervisor PID.
 assert.equal(provenOldRunnerExit({owner:null,heartbeat:hb,pidAlive:exited}),true);
 assert.equal(provenOldRunnerExit({owner:null,heartbeat:hb,pidAlive:pid=>
  pid===8810?true:false}),false);
 assert.equal(provenOldRunnerExit({owner:null,heartbeat:hb,pidAlive:pid=>
  pid===8810?null:false}),false);
 assert.equal(provenOldRunnerExit({owner,heartbeat:{pid:8810,children:[]},pidAlive:exited}),false);
 assert.equal(provenOldRunnerExit({owner,heartbeat:{pid:8810,children:children.slice(0,5)},pidAlive:exited}),false);
 assert.equal(provenOldRunnerExit({owner,heartbeat:{pid:8811,children},pidAlive:exited}),false);
 const duplicate=children.map(x=>({...x}));duplicate[5].seat=1;
 assert.equal(provenOldRunnerExit({owner,heartbeat:{pid:8810,children:duplicate},pidAlive:exited}),false);
 const duplicatePid=children.map(x=>({...x}));duplicatePid[5].pid=10010;
 assert.equal(provenOldRunnerExit({owner,heartbeat:{pid:8810,children:duplicatePid},pidAlive:exited}),false);
 assert.equal(provenOldRunnerExit({owner,heartbeat:hb,pidAlive:pid=>pid===10014?true:false}),false);
 assert.equal(provenOldRunnerExit({owner,heartbeat:hb,pidAlive:pid=>pid===10014?null:false}),false);
});
test('Watchdog promotion must call exact six-seat exit proof, not accept empty heartbeat',()=>{
 const source=fs.readFileSync(new URL('../tools/runner-watchdog.mjs',import.meta.url),'utf8');
 assert.match(source,/if\(standbyMode&&!verifiedColdStandbyStart\(\{owner,heartbeat:hb\}\)&&\s*!provenOldRunnerExit\(\{owner,heartbeat:hb\}\)\)/);
 assert.match(source,/heartbeat\.children\.length!==6/);
});

test('promoted Supervisor cannot leak Watchdog IPC nonce to Runner job environments',()=>{
 const src=fs.readFileSync(new URL('../controller/standby.mjs',import.meta.url),'utf8');
 const authenticated=src.indexOf("STANDBY_WATCHDOG_IDENTITY_UNVERIFIED");
 const clearNonce=src.indexOf('delete process.env.ZGMINI_WATCHDOG_NONCE;');
 const clearPid=src.indexOf('delete process.env.ZGMINI_WATCHDOG_PID;');
 const importSupervisor=src.indexOf("await import('./supervisor.mjs')");
 assert.ok(authenticated>=0&&clearNonce>authenticated);
 assert.ok(clearPid>authenticated&&clearPid<importSupervisor);
 assert.ok(clearNonce<importSupervisor);
});

test('dead six cmd launchers do not prove that actual Runner.Listener stopped',()=>{
 const root='E:\\ZGmini\\automation\\pc-control';
 const canonicalize=p=>p;
 const options={controllerRoot:root,canonicalize};
 const old={pid:7240};
 const children=Array.from({length:6},(_,i)=>({seat:i+1,pid:9400+i}));
 const heartbeat={pid:7240,children};
 assert.equal(provenOldRunnerExit({owner:old,heartbeat,pidAlive:()=>false}),true);
 const oldListener=[{pid:19001,name:'Runner.Listener.exe',
  executablePath:'E:\\ZGmini\\automation\\pc-control\\runners\\01\\bin\\Runner.Listener.exe'}];
 assert.equal(classifyRunnerExecutableProof(oldListener,options),'ACTIVE_RUNNER_PROCESS');
 assert.equal(classifyRunnerExecutableProof([],options),'NO_CONTROLLER_RUNNER_PROCESS');
});
test('WMI executable proof is scoped to approved Controller runners with alias resolution',()=>{
 const root='E:\\ZGmini\\automation\\pc-control';
 const options={controllerRoot:root,canonicalize:p=>
  p.replace(/^C:\\Junction\\pc-control/i,root)};
 assert.equal(classifyRunnerExecutableProof([{pid:199,name:'Runner.Listener.exe',
  executablePath:'C:\\Junction\\pc-control\\runners\\06\\bin\\Runner.Listener.exe'}],options),
  'ACTIVE_RUNNER_PROCESS');
 assert.equal(classifyRunnerExecutableProof([{pid:299,name:'Runner.Worker.exe',
  executablePath:'E:\\ZGmini\\automation\\pc-control\\runners\\03\\bin\\Runner.Worker.exe'}],options),
  'ACTIVE_RUNNER_PROCESS');
 assert.equal(classifyRunnerExecutableProof([{pid:900,name:'Runner.Listener.exe',
  executablePath:'D:\\OtherApp\\runner\\bin\\Runner.Listener.exe'}],options),
  'NO_CONTROLLER_RUNNER_PROCESS');
});
test('WMI source missing, inaccessible or untrusted process identity never certifies exit',()=>{
 const options={controllerRoot:'E:\\ZGmini\\automation\\pc-control',canonicalize:p=>p};
 for(const rows of [null,{},[{pid:1,name:'Runner.Listener.exe',executablePath:''}],
  [{pid:0,name:'Runner.Listener.exe',executablePath:'C:\\other.exe'}],
  [{pid:1,name:'not-a-runner.exe',executablePath:'C:\\other.exe'}],
  Array.from({length:257},(_,i)=>({pid:i+1,name:'Runner.Listener.exe',
   executablePath:'D:\\OtherApp\\runner\\bin\\Runner.Listener.exe'}))]){
  assert.equal(classifyRunnerExecutableProof(rows,options),'UNVERIFIED');
 }
 assert.equal(classifyRunnerExecutableProof([{pid:1,name:'Runner.Listener.exe',
  executablePath:'D:\\OtherApp\\runner\\bin\\Runner.Listener.exe'}],
  {...options,canonicalize:()=>{throw Error('ACCESS_DENIED');}}),'UNVERIFIED');
 const source=fs.readFileSync(new URL('../tools/runner-watchdog.mjs',import.meta.url),'utf8');
 assert.match(source,/if\(standbyMode&&scanControllerRunnersReadOnly\(\)!=='NO_CONTROLLER_RUNNER_PROCESS'\)/);
});

test('lease-absent clean startup still requires old heartbeat and WMI absence',()=>{
 const heartbeat={pid:4050,children:Array.from({length:6},(_,i)=>({
  seat:i+1,pid:5000+i
 }))};
 const oldExited=()=>false;
 assert.equal(provenOldRunnerExit({owner:null,heartbeat,pidAlive:oldExited}),true);
 assert.equal(provenOldRunnerExit({owner:null,heartbeat:null,pidAlive:oldExited}),false);
 const controllerRoot='E:\\ZGmini\\automation\\pc-control';
 const others=[{pid:5001,name:'Runner.Worker.exe',
  executablePath:'E:\\ZGmini\\automation\\pc-control\\runners\\03\\bin\\Runner.Worker.exe'}];
 assert.equal(classifyRunnerExecutableProof(others,{
  controllerRoot,canonicalize:p=>p}),'ACTIVE_RUNNER_PROCESS');
});

test('Standby initial boot permits only true absent owner and heartbeat pair',()=>{
 assert.equal(verifiedColdStandbyStart({owner:null,heartbeat:null}),true);
 for(const pair of [
  {owner:undefined,heartbeat:null},{owner:null,heartbeat:undefined},
  {owner:{pid:1},heartbeat:null},{owner:null,heartbeat:{pid:1}},
  {owner:{pid:1},heartbeat:{pid:1}},{}
 ])assert.equal(verifiedColdStandbyStart(pair),false);
 // No old owner or heartbeat is not an unconditional promotion:
 // the independent WMI check and Standby's atomic lease still gate it.
 const src=fs.readFileSync(new URL('../tools/runner-watchdog.mjs',import.meta.url),'utf8');
 assert.match(src,/if\(standbyMode&&!verifiedColdStandbyStart\(\{owner,heartbeat:hb\}\)&&/);
 assert.match(src,/scanControllerRunnersReadOnly\(\)!=='NO_CONTROLLER_RUNNER_PROCESS'/);
 assert.match(src,/archiveDeadLease\(path\.join\(control,'leases\/supervisor'\)/);
});


test('WMI missing-path service exception requires a unique registered session-0 Listener',()=>{
 const opts={controllerRoot:'E:\\ZGmini\\automation\\pc-control',canonicalize:p=>p};
 const service={pid:12301,name:'Runner.Listener.exe',executablePath:'',
  sessionId:0,serviceAncestor:true,serviceObservationAvailable:true};
 const expected='NO_CONTROLLER_RUNNER_PROCESS';
 assert.equal(classifyRunnerExecutableProof([service],opts),expected);
 const external={pid:12302,name:'Runner.Listener.exe',
  executablePath:'D:\\Other\\runner\\bin\\Runner.Listener.exe'};
 assert.equal(classifyRunnerExecutableProof([service,external],opts),expected);
 const active={pid:12303,name:'Runner.Listener.exe',
  executablePath:'E:\\ZGmini\\automation\\pc-control\\runners\\02\\bin\\Runner.Listener.exe'};
 assert.equal(classifyRunnerExecutableProof([service,active],opts),'ACTIVE_RUNNER_PROCESS');
 const forbidden=[
  {...service,sessionId:1},
  {...service,serviceAncestor:false},
  {...service,serviceObservationAvailable:false},
  {...service,serviceObservationAvailable:undefined},
  {...service,executablePath:null},
  {...service,executablePath:'relative.exe'},
  {...service,name:'Runner.Worker.exe'},
  {...service,pid:0},
  {...service,serviceAncestor:null}
 ];
 for(const bad of forbidden)
  assert.equal(classifyRunnerExecutableProof([bad],opts),'UNVERIFIED');
 assert.equal(classifyRunnerExecutableProof([service,{...service,pid:12304}],opts),
  'UNVERIFIED');
 assert.equal(classifyRunnerExecutableProof([service,{...service}],opts),'UNVERIFIED');
});

test('Standby Watchdog service lineage WMI source is strict read-only and bounded',()=>{
 const source=fs.readFileSync(new URL('../tools/runner-watchdog.mjs',import.meta.url),'utf8');
 assert.match(source,/Get-CimInstance -ClassName Win32_Process -ErrorAction Stop/);
 assert.match(source,/Get-CimInstance -ClassName Win32_Service -Filter/);
 assert.match(source,/PROCESS_SCOPE_EXCEEDED/);
 assert.match(source,/serviceObservationAvailable===true/);
 assert.match(source,/row\.sessionId===0/);
 assert.match(source,/serviceExceptions>1/);
 assert.match(source,/scanControllerRunnersReadOnly\(\)!=='NO_CONTROLLER_RUNNER_PROCESS'/);
});

test('dual passive candidates have one deterministic Watchdog promotion selection',()=>{
 const a={child:{pid:32001},ready:true,promoting:false,slot:1};
 const b={child:{pid:32002},ready:true,promoting:false,slot:2};
 assert.equal(selectStandbyCandidate(a,b,{dual:true}),a);
 assert.equal(selectStandbyCandidate(a,b,{dual:false}),a);
 assert.equal(selectStandbyCandidate(null,b,{dual:false}),null);
 assert.equal(selectStandbyCandidate(null,b,{dual:true}),b);
 assert.equal(selectStandbyCandidate({...a,ready:false},b,{dual:true}),b);
 assert.equal(selectStandbyCandidate({...a,promoting:true},b,{dual:true}),b);
 assert.equal(selectStandbyCandidate({...a,child:{pid:0}},b,{dual:true}),b);
 assert.equal(selectStandbyCandidate({...a,child:null},b,{dual:true}),b);
 assert.equal(selectStandbyCandidate({...a,ready:null},{...b,ready:null},{dual:true}),null);
 assert.equal(selectStandbyCandidate(a,b,{dual:true,promotionPending:a}),null);
 assert.equal(selectStandbyCandidate(a,b,{dual:true,promotionPending:b}),null);
 assert.equal(selectStandbyCandidate(null,null,{dual:true}),null);
});
test('dual mode is separately approved; legacy R4 does not start second candidate',()=>{
 const src=fs.readFileSync(new URL('../tools/runner-watchdog.mjs',import.meta.url),'utf8');
 assert.match(src,/installed\.standby\?\.mode==='ACTIVE_1_STANDBY_2'/);
 assert.match(src,/installed\.standby\?\.mode==='ACTIVE_1_STANDBY_1'/);
 assert.match(src,/standby2Mode\?\[1,2\]:\[1\]/);
 assert.match(src,/if\(!standbyMode\|\|promotionPending\)return/);
 assert.match(src,/selectStandbyCandidate\(standby,secondStandby/);
 assert.match(src,/if\(standbyMode&&promotionPending\)/);
 assert.match(src,/BLOCKED_STANDBY_PROMOTION_OUTCOME_UNKNOWN/);
 assert.match(src,/if\(promotionPending\.child\.pid!==owner\.pid\)/);
 assert.match(src,/standbyReadyCount:/);
 // The existing healthy Active continues to be reported healthy even if
 // our attempted standby candidate failed the ownership attribution.
 assert.ok(src.includes("standbyPromotionStatus:'UNVERIFIED_OWNER_MISMATCH'"));
 assert.doesNotMatch(src,/status\('BLOCKED_STANDBY_PROMOTION_OWNER_UNVERIFIED'/);
 assert.doesNotMatch(src,/taskkill\.exe/);
});
