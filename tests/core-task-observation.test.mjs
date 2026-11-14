import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {classifyCoreSnapshot} from '../controller/core-runtime-source-readonly.mjs';

test('running with invisible instances remains unknown and never claims stopped',()=>{
 const result=classifyCoreSnapshot({ok:true,engines:[],processes:[],runningInstances:0,
  taskStateBefore:4,taskStateAfter:4});
 assert.equal(result.code,'CORE_TASK_RUNNING_INSTANCE_UNOBSERVABLE');
 assert.equal(result.status,'STATE_UNKNOWN');assert.equal(result.runtimeSourceVerified,false);
 assert.equal(result.taskObservation.stoppedProven,false);
});
test('completion, ready and missing engine use separate inconclusive codes',()=>{
 for(const [before,after,count,code] of [[4,3,0,'CORE_TASK_STATE_CHANGED_DURING_PROBE'],
  [3,3,0,'CORE_TASK_NOT_RUNNING_AT_SNAPSHOT'],[4,4,1,'CORE_TASK_ENGINE_PID_UNAVAILABLE']]){
  const result=classifyCoreSnapshot({ok:true,engines:[],processes:[],runningInstances:count,
   taskStateBefore:before,taskStateAfter:after});
  assert.equal(result.code,code);assert.equal(result.status,'STATE_UNKNOWN');
 }
});
test('real JScript captures both task states without starting any process',()=>{
 const source=fs.readFileSync(new URL('../controller/core-runtime-source-wmi.mjs',import.meta.url),'utf8');
 let index=0,printed='';
 const task={GetInstances:()=>({Count:0})};
 Object.defineProperty(task,'State',{get:()=>[4,3][index++]});
 const context={ActiveXObject:function(){return {Connect(){},GetFolder:()=>({GetTask:()=>task})};},
  GetObject:()=>({ExecQuery:()=>[]}),Enumerator:function(){this.atEnd=()=>true;},
  WScript:{Echo:x=>{printed=x;},Quit:()=>{throw Error('UNEXPECTED_EXIT');}}};
 vm.runInNewContext(source,context,{timeout:1000});
 const result=JSON.parse(printed);
 assert.equal(result.taskStateBefore,4);assert.equal(result.taskStateAfter,3);
 assert.equal(classifyCoreSnapshot(result).code,'CORE_TASK_STATE_CHANGED_DURING_PROBE');
});
