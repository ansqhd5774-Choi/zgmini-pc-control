import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOrphanRunnerPreservation as assess} from '../tools/supervisor-orphan-preservation.mjs';
const owner={pid:1234},heartbeat={pid:1234,children:Array.from({length:6},(_,i)=>({seat:i+1,pid:2000+i}))};
const rows={schema:'ZGMINI_R3_STANDBY_RUNNER_WMI_A_V1',
 evidence:'SINGLE_INSTANT_WMI_NOT_PROMOTION_AUTHORIZATION',status:'PASS',
 controllerListenerCount:6,controllerWorkerCount:1,unknownPathCount:0,
 unknownListenerCount:0,unknownWorkerCount:0,missingWmiPathCount:0,
 nonAbsoluteWmiPathCount:0,canonicalizationFailedCount:0};
test('exact orphan snapshot preserves six running listeners and forbids launch and lease transfer',()=>{
 const x=assess({supervisorOwner:owner,supervisorAlive:false,heartbeat,rows});
 assert.equal(x.status,'PRESERVE');assert.equal(x.maySpawn,false);
 assert.equal(x.mayTransferLease,false);assert.equal(x.adoptionImplemented,false);
});
test('real #4159 WMI unknown service Listener stays blocked even when 6 Controller Listeners are alive',()=>{
 const x=assess({supervisorOwner:owner,supervisorAlive:false,heartbeat,
  rows:{...rows,status:'STATE_UNKNOWN',unknownPathCount:1,
   unknownListenerCount:1,missingWmiPathCount:1}});
 assert.equal(x.status,'BLOCKED');assert.equal(x.code,'CONTROLLER_RUNNER_ATTRIBUTION_UNVERIFIED');
});
test('missing or live supervisor / incomplete or duplicated heartbeat never permits adoption',()=>{
 for(const override of [
  {supervisorAlive:true},{supervisorAlive:null},{supervisorOwner:null},
  {heartbeat:null},{heartbeat:{...heartbeat,pid:999}},
  {heartbeat:{...heartbeat,children:heartbeat.children.slice(1)}},
  {heartbeat:{...heartbeat,children:[...heartbeat.children.slice(0,5),heartbeat.children[0]]}},
  {heartbeat:{...heartbeat,children:[...heartbeat.children.slice(0,5),{seat:6,pid:2000}]}}
 ]){
  const x=assess({supervisorOwner:owner,supervisorAlive:false,heartbeat,rows,...override});
  assert.equal(x.status,'BLOCKED');assert.equal(x.maySpawn,false);
 }
});
test('incomplete WMI counts and missing attribution block without inferred zero',()=>{
 for(const override of [{controllerListenerCount:5},{controllerWorkerCount:null},
  {unknownPathCount:1},{canonicalizationFailedCount:1},{status:'STATE_UNKNOWN'},
  {schema:'OTHER'},{evidence:'PROMOTION_AUTHORIZED'}]){
  assert.equal(assess({supervisorOwner:owner,supervisorAlive:false,heartbeat,
   rows:{...rows,...override}}).status,'BLOCKED');
 }
});
test('the preservation classifier contains no process or lease mutation API',()=>{
 const output=assess({supervisorOwner:owner,supervisorAlive:false,heartbeat,rows});
 assert.deepEqual(Object.keys(output).sort(),[
  'adoptionImplemented','code','controllerListenerCount','controllerWorkerCount',
  'maySpawn','mayTransferLease','status'].sort());
});
