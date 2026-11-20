import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dedicatedPcRunnerRows,requireCompleteRunnerInventory} from '../tools/update.mjs';

const seats=()=>Array.from({length:6},(_,i)=>({
 name:`zgmini-pc-0${i+1}`,status:'online',busy:false,
}));

test('six dedicated seats are verified by unique name with independent spare present',()=>{
 const original=seats();
 const withSpare=[{name:'zgmini-handoff-ci-spare-01',status:'online',busy:false},...original];
 assert.deepEqual(dedicatedPcRunnerRows(original),original);
 assert.deepEqual(dedicatedPcRunnerRows(withSpare,{requireOnline:true,requireIdle:true}),original);
});

test('independent spare busy or offline does not block dedicated maintenance drain',()=>{
 const original=seats();
 const withSpare=[...original,{name:'zgmini-handoff-ci-spare-01',status:'offline',busy:true}];
 assert.deepEqual(dedicatedPcRunnerRows(withSpare,{requireOnline:true,requireIdle:true}),original);
});

test('missing or duplicate dedicated seat is never accepted',()=>{
 assert.equal(dedicatedPcRunnerRows(null),null);
 assert.equal(dedicatedPcRunnerRows([]),null);
 assert.equal(dedicatedPcRunnerRows(seats().slice(0,5)),null);
 assert.equal(dedicatedPcRunnerRows([...seats(),seats()[0]]),null);
 assert.equal(dedicatedPcRunnerRows([{name:'other'}]),null);
});

test('required online and idle flags only apply to the six dedicated seats',()=>{
 const offline=seats();
 offline[1].status='offline';
 assert.equal(dedicatedPcRunnerRows(offline,{requireOnline:true}),null);
 assert.equal(dedicatedPcRunnerRows(offline,{requireIdle:true})?.length,6);
 const busy=seats();
 busy[4].busy=true;
 assert.equal(dedicatedPcRunnerRows(busy,{requireIdle:true}),null);
 assert.equal(dedicatedPcRunnerRows(busy,{requireOnline:true})?.length,6);
});

test('complete repository Runner inventory selects only operating six',()=>{
 const original=seats();
 const withSpare=[{name:'zgmini-handoff-ci-spare-01',status:'offline',busy:true},...original];
 assert.deepEqual(requireCompleteRunnerInventory({total_count:7,runners:withSpare}),original);
});

test('partial Github API pages and missing total_count fail closed',()=>{
 for(const response of [null,{runners:seats()},
   {total_count:101,runners:seats()},
   {total_count:5,runners:seats()},
   {total_count:'6',runners:seats()}]){
  assert.throws(()=>requireCompleteRunnerInventory(response),
    {code:'RUNNER_INVENTORY_INCOMPLETE'});
 }
});

test('complete inventory still rejects duplicated or missing operating seats',()=>{
 for(const runners of [seats().slice(1),[...seats(),seats()[0]]]){
  assert.throws(()=>requireCompleteRunnerInventory({total_count:runners.length,runners}),
    {code:'RUNNER_SET_DRIFT'});
 }
});

test('unknown busy states in operating seats never pass an install precheck',()=>{
 for(const busy of [undefined,null,0,'false']){
  const rows=seats(); rows[0].busy=busy;
  assert.throws(()=>requireCompleteRunnerInventory({total_count:6,runners:rows}),
    {code:'RUNNER_STATE_INVALID'});
 }
});

// Guard the mutation ordering: a read failure must occur before a rollback
// disables intake. This source contract complements the inventory unit tests.
test('independent rollback preflights inventory before pausing intake',()=>{
 const source=readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 const start=source.indexOf('  restore:async()=>{');
 const end=source.indexOf('  verifyRestoredPrevious:async',start);
 assert.ok(start>=0&&end>start,'restore port must exist');
 const restore=source.slice(start,end);
 const read=restore.indexOf('if(recoveryOperator&&!pausedByUs)apiRunners();');
 const pause=restore.indexOf('openRollbackPause(');
 const disable=restore.indexOf("github('actions/workflows/pc-job.yml/disable','PUT')");
 assert.ok(read>=0&&pause>read&&disable>read,
  'independent recovery inventory preflight must precede intake mutation');
 assert.match(restore,/for\(let n=0;n<180;n\+\+\)\{\s*const rows=apiRunners\(\)/,
  'actual drain must still recheck fresh inventory');
});
