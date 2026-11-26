import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOrphanSeatLineage as assess} from '../tools/supervisor-orphan-lineage.mjs';
const owner={pid:100,nonce:'12345678-1234-4234-8234-123456789abc'};
const heartbeat={pid:100,children:Array.from({length:6},(_,i)=>({seat:i+1,pid:200+i}))};
const root='E:\\\\ZGmini\\\\automation\\\\pc-control';
const rows=()=>heartbeat.children.flatMap(c=>[
 {pid:c.pid,ppid:100,name:'cmd.exe'},
 {pid:300+c.seat,ppid:c.pid,name:'Runner.Listener.exe',
  executablePath:root+'\\\\runners\\\\'+String(c.seat).padStart(2,'0')+'\\\\bin\\\\Runner.Listener.exe'}
]);
const run=override=>assess({owner,ownerAlive:false,heartbeat,processes:rows(),controllerRoot:root,...override});
test('six distinct existing Runner genealogies are observational, never adoption authority',()=>{
 const r=run();assert.equal(r.status,'LINEAGE_OBSERVED');
 assert.equal(r.mayAdopt,false);assert.equal(r.maySpawn,false);
 assert.equal(r.mayTransferLease,false);assert.equal(r.pidReuseExcluded,false);
});
test('dead cmd launcher without complete observed process chain cannot be inherited',()=>{
 const processes=rows().filter(x=>x.pid!==200);
 assert.equal(run({processes}).code,'ORPHAN_WRAPPER_GENEALOGY_UNVERIFIED');
});
test('missing, duplicate, extra or wrong-seat listeners refuse the claim',()=>{
 const base=rows();
 for(const processes of [
  base.filter(x=>x.pid!==301),
  [...base,{...base.find(x=>x.pid===301),pid:999}],
  [...base,{pid:999,ppid:100,name:'Runner.Listener.exe',executablePath:'C:\\\\service\\\\Runner.Listener.exe'}],
  base.map(x=>x.pid===301?{...x,ppid:205}:x)
 ]) assert.equal(run({processes}).status,'BLOCKED');
});
test('unverified owner, incomplete heartbeat and unknown executable path block',()=>{
 assert.equal(run({ownerAlive:null}).status,'BLOCKED');
 assert.equal(run({heartbeat:{...heartbeat,children:heartbeat.children.slice(1)}}).status,'BLOCKED');
 assert.equal(run({processes:rows().map(x=>x.pid===301?{...x,executablePath:null}:x)}).status,'BLOCKED');
});
test('pid/ppid records never certify transferable process handles',()=>{
 const r=run();assert.equal(r.ownerTransferProtocolImplemented,false);
 assert.equal(r.pidReuseExcluded,false);
});
