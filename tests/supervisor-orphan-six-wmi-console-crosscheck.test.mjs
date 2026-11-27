import test from 'node:test';
import assert from 'node:assert/strict';
import {
 projectPrivateOrphanWmiEvidence,readPrivateOrphanWmiEvidence
} from '../tools/supervisor-orphan-private-wmi.mjs';
import {
 projectOrphanConsoleCohort,readPrivateOrphanConsoleEvidence
} from '../tools/supervisor-orphan-console-readonly.mjs';
import {
 compareOrphanSixWmiAndConsoles,readPrivateOrphanSixCrosscheck
} from '../tools/supervisor-orphan-six-wmi-console-crosscheck.mjs';

const slash=String.fromCharCode(92);
const root=['E:','ZGmini','automation','pc-control'].join(slash);
const birth=new Date(Date.now()-3600000).toISOString();
const observed=new Date(Date.now()-250).toISOString();
const oldHeartbeat=new Date(Date.now()-120000).toISOString();
const exe=seat=>[root,'runners',String(seat).padStart(2,'0'),
 'bin','Runner.Listener.exe'].join(slash);
const wmiRows=()=>Array.from({length:6},(_,i)=>({
 pid:2201+i,name:'Runner.Listener.exe',
 executablePath:exe(i+1),sessionId:1,
 serviceAncestor:false,serviceObservationAvailable:true,
 startedAtUtc:birth
}));
const projectWmi=(rows=wmiRows())=>{
 const first=projectPrivateOrphanWmiEvidence(rows,{
  controllerRoot:root,canonicalize:x=>x,
  originalHeartbeatAt:oldHeartbeat,observedAt:observed
 });
 assert.equal(first.status,'PASS');
 return projectPrivateOrphanWmiEvidence(rows,{
  controllerRoot:root,canonicalize:x=>x,
  originalHeartbeatAt:oldHeartbeat,observedAt:observed,
  originalSeatPins:readPrivateOrphanWmiEvidence(first).rows
 });
};
const consoleRaw=()=>({
 schema:'ZGMINI_ORPHAN_CONSOLE_COHORT_A_V1',stable:true,
 inspectorPid:8800,
 rows:Array.from({length:6},(_,i)=>({
  seat:i+1,pid:2201+i,birth,
  mode:'ATTACHED',members:[2201+i,8800]
 }))
});
const projectConsole=(raw=consoleRaw())=>projectOrphanConsoleCohort(raw,{
 observedAtUtc:observed
});
test('same-host private WMI pins and console birth/group are linked; public remains sanitized',()=>{
 const w=projectWmi(),c=projectConsole();
 assert.equal(w.originalPinsCompared,true);
 assert.equal(c.distinctConsoleGroupCount,6);
 const proof=compareOrphanSixWmiAndConsoles(w,c);
 assert.equal(proof.status,'CANDIDATE_ONLY');
 assert.equal(proof.linkedSeatCount,6);
 assert.equal(proof.actuationAllowed,false);
 assert.equal(proof.runnerStopAuthorized,false);
 assert.equal(proof.signalEmitted,false);
 assert.equal(proof.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(proof),
  /220[1-6]|8800|startedAtUtc|E:\\|Runner.Listener|birth|privateOriginalSixSeatDigestSha256/);
 const privateResult=readPrivateOrphanSixCrosscheck(proof);
 assert.equal(privateResult.source,'PRIVATE_SAME_HOST_WMI_AND_EXCLUSIVE_CONSOLES');
 assert.equal(privateResult.seats.length,6);
 assert.match(privateResult.privateOriginalSixSeatDigestSha256,/^[a-f0-9]{64}$/);
 assert.equal(readPrivateOrphanSixCrosscheck({...proof}),null);
 assert.equal(readPrivateOrphanSixCrosscheck(JSON.parse(JSON.stringify(proof))),null);
});
test('private tuples inaccessible from public JSON or fabricated six-seat PASS',()=>{
 const c=projectConsole();
 assert.equal(readPrivateOrphanConsoleEvidence({...c}),null);
 assert.equal(readPrivateOrphanConsoleEvidence(JSON.parse(JSON.stringify(c))),null);
 assert.equal(compareOrphanSixWmiAndConsoles({status:'PASS'},c).status,'STATE_UNKNOWN');
 const genuine=projectWmi();
 assert.equal(compareOrphanSixWmiAndConsoles(genuine,{...c}).status,'STATE_UNKNOWN');
});
test('different PID, birth or nonexclusive console rejects cross-source proof',()=>{
 for(const mutation of [
  x=>{x.rows[0].pid=9999;x.rows[0].members=[9999,8800];},
  x=>{x.rows[0].birth=new Date(Date.parse(birth)+1).toISOString();},
  x=>{x.rows[0].members=[2201,9900,8800];},
  x=>{x.rows[0].members=[2201,2202,8800];},
  x=>{x.rows[1].seat=1;}
 ]){
  const raw=consoleRaw();mutation(raw);
  const result=compareOrphanSixWmiAndConsoles(projectWmi(),projectConsole(raw));
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.runnerStopAuthorized,false);
 }
});
test('no private console birth tuple cannot be used as a B original seat pin',()=>{
 const raw=consoleRaw();raw.rows.forEach(r=>delete r.birth);
 const c=projectConsole(raw);
 assert.equal(c.status,'PASS');
 assert.equal(readPrivateOrphanConsoleEvidence(c),null);
 assert.equal(compareOrphanSixWmiAndConsoles(projectWmi(),c).status,'STATE_UNKNOWN');
});
test('source with active Worker or unknown original heartbeat is not eligible',()=>{
 const worker={...wmiRows()[0],pid:3350,name:'Runner.Worker.exe',
  executablePath:exe(1).replace('Listener','Worker')};
 const withWorker=projectWmi([...wmiRows(),worker]);
 assert.equal(withWorker.workerCount,1);
 assert.equal(compareOrphanSixWmiAndConsoles(withWorker,projectConsole()).status,
  'STATE_UNKNOWN');
 const raw=consoleRaw();raw.stable=false;
 assert.equal(compareOrphanSixWmiAndConsoles(projectWmi(),projectConsole(raw)).status,
  'STATE_UNKNOWN');
});
test('expired same-host samples cannot authorize any live operation',()=>{
 const past=new Date(Date.now()-60000).toISOString();
 const w=projectWmi(),c=projectOrphanConsoleCohort(consoleRaw(),{
  observedAtUtc:past
 });
 assert.equal(compareOrphanSixWmiAndConsoles(w,c).status,'STATE_UNKNOWN');
});
