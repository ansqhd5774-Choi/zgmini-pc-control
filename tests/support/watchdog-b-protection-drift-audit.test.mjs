// Support-only: synthetic hashes, no Windows PC reads or live B replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compareWatchdogProtectionSnapshots as audit}
  from './watchdog-b-protection-drift-audit.mjs';
const h=n=>String(n).repeat(64);
const before=()=>({
 'ZGMINI-PC-Local-Core':h('a'),
 'ZGMINI-PC-Local-Korea':h('b'),
 'ZGMINI-PC-Iran-Progress-R13':'APPROVED_RETIRED_ABSENT',
 'E:/ZGmini/data/pc-writer/config.json':h('c'),
 'E:/ZGmini/data/pc-writer/quota-runner.cmd':h('d'),
 'E:/ZGmini/data/pc-writer/run-local.cmd':h('e'),
 'E:/ZGmini/automation/pc-control/host.json':h('f'),
});
const labels=['CORE_TASK_XML','KOREA_TASK_XML','RETIRED_TASK_ABSENCE',
 'WRITER_CONFIG','WRITER_QUOTA_SCRIPT','WRITER_LOCAL_SCRIPT',
 'CONTROLLER_HOST_MANIFEST'];
test('identical snapshots: no drift',()=>{
 const p=before(),res=audit(p,{...p});
 assert.equal(res.status,'NO_DRIFT');
 assert.equal(res.guardWouldFail,false);
 assert.equal(res.readOnly,true);
});
test('all value differences are reported by category without old or new hash',()=>{
 const p=before(),n={...p};
 for(const k of Object.keys(n)){if(k.endsWith('Iran-Progress-R13'))continue;n[k]=h('1');}
 const r=audit(p,n);
 assert.equal(r.status,'PROTECTED_VALUE_OR_PRESENCE_DRIFT');
 assert.equal(r.counts.changed,6);
 assert.ok(r.details.every(x=>labels.includes(x.category)));
 const serialized=JSON.stringify(r);
 for(const k of Object.keys(p))assert.equal(serialized.includes(k),false);
 for(const value of Object.values(p))if(value.length===64)
   assert.equal(serialized.includes(value),false);
});
test('a fixed task field absent yields invalid, not a safe no-drift',()=>{
 const a=before(),b={...a};delete b['ZGMINI-PC-Local-Core'];
 assert.equal(audit(a,b).status,'SNAPSHOT_INVALID');
});
test('retired task proof is mandatory and cannot be silently replaced',()=>{
 const a=before(),b={...a};
 b['ZGMINI-PC-Iran-Progress-R13']='unknown';
 assert.equal(audit(a,b).status,'SNAPSHOT_INVALID');
});
test('previously absent optional Writer file is classified as newly present',()=>{
 const a=before(),b={...a};delete a['E:/ZGmini/data/pc-writer/quota-runner.cmd'];
 const result=audit(a,b);
 assert.equal(result.counts.added,1);
 assert.equal(result.status,'PROTECTED_VALUE_OR_PRESENCE_DRIFT');
});
test('removed protected file is distinct from changed hash',()=>{
 const a=before(),b={...a};delete b['E:/ZGmini/data/pc-writer/run-local.cmd'];
 const result=audit(a,b);
 assert.equal(result.counts.missing,1);
 assert.equal(result.counts.changed,0);
});
test('two absent optional paths are not a mismatch',()=>{
 const a=before(),b=before();
 delete a['E:/ZGmini/data/pc-writer/run-local.cmd'];
 delete b['E:/ZGmini/data/pc-writer/run-local.cmd'];
 assert.equal(audit(a,b).status,'NO_DRIFT');
});
test('JSON serialization key insertion order alone can reject exact same state',()=>{
 const p=before(),reordered=Object.fromEntries(Object.entries(p).reverse());
 const r=audit(p,reordered);
 assert.equal(r.status,'ORDER_ONLY_SERIALIZATION_DRIFT');
 assert.equal(r.guardWouldFail,true);
 assert.equal(r.counts.changed,0);
});
test('unexpected keys are redacted and invalid',()=>{
 const a=before(),b={...a,'SecretToken':'do-not-display'};
 const r=audit(a,b);
 assert.equal(r.status,'SNAPSHOT_INVALID');
 assert.equal(r.unexpectedKeyCount,1);
 assert.equal(JSON.stringify(r).includes('SecretToken'),false);
 assert.equal(JSON.stringify(r).includes('do-not-display'),false);
});
test('prototype pollution style entries are rejected or ignored, not leaked',()=>{
 const a=before(),b=Object.create({secret:'bad'});
 Object.assign(b,a);
 assert.equal(audit(a,b).status,'SNAPSHOT_INVALID');
});
test('null, array, empty, invalid hash format fail closed',()=>{
 const p=before();
 for(const candidate of [null,[],{},{
   ...p,'E:/ZGmini/automation/pc-control/host.json':'wrong'
 }]) assert.equal(audit(p,candidate).status,'SNAPSHOT_INVALID');
});
test('no snapshot values, hashes or raw XML are present in result',()=>{
 const a=before(),b={...a};
 b['E:/ZGmini/data/pc-writer/config.json']=h('9');
 const str=JSON.stringify(audit(a,b));
 assert.ok(!str.includes(h('9')));
 assert.ok(!str.includes(h('c')));
 assert.ok(str.includes('WRITER_CONFIG'));
});
test('all six hash fields independently classify true drift',()=>{
 let n=0;
 for(const key of Object.keys(before())){
  if(key.includes('Iran-Progress-R13'))continue;
  const p=before(),b={...p};b[key]=h('0');
  const r=audit(p,b);
  assert.equal(r.counts.changed,1);
  assert.equal(r.status,'PROTECTED_VALUE_OR_PRESENCE_DRIFT');
  n++;
 }
 assert.equal(n,6);
});
