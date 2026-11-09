import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script=fs.readFileSync(new URL('./core-lock-owner-probe.js',
 import.meta.url),'utf8');

function simulate({pid='521',enabled=true,engines=[100],rows=[
 {ProcessId:100,ParentProcessId:4,Name:'cmd.exe',CommandLine:'cmd /c'},
 {ProcessId:521,ParentProcessId:100,Name:'node.exe',
  CommandLine:'E:\\ZGmini\\runtime\\node.exe scripts\\pc-writer\\local-cycle.mjs'},
],wmiError=false}={}){
 const lines=[];
 function Enumerator(collection){
  let current=0;
  this.atEnd=()=>current>=collection.length;
  this.moveNext=()=>{current+=1;};
  this.item=()=>collection[current];
 }
 const sandbox={
  WScript:{Arguments:{length:1,Item:()=>pid},Echo:x=>lines.push(x)},
  ActiveXObject:function(name){
   assert.equal(name,'Schedule.Service');
   return {Connect(){},GetFolder(root){
    assert.equal(root,'\\');
    return {GetTask(name){
     assert.equal(name,'ZGMINI-PC-Local-Core');
     return {Enabled:enabled,GetInstances(){return {
      Count:engines.length,Item:n=>({EnginePID:engines[n-1]})};}};
    }};
   }};
  },
  GetObject:moniker=>{
   assert.equal(moniker,'winmgmts:root\\cimv2');
   if(wmiError)throw new Error('Access denied');
   return {ExecQuery:()=>rows};
  },
  Enumerator,
  isFinite,
 };
 vm.runInNewContext(script,sandbox,{timeout:2000});
 assert.equal(lines.length,1);
 assert.match(lines[0],/^\{"ok":(?:true|false),"linked":(?:true|false)\}$/);
 assert.doesNotMatch(lines[0],/node\.exe|local-cycle|ZGmini/);
 return JSON.parse(lines[0]);
}

test('active Task child owning live E: lock is linked',()=>{
 assert.deepEqual(simulate(),{ok:true,linked:true});
});

test('unrelated Node Core command line never becomes a Task-linked owner',()=>{
 assert.deepEqual(simulate({engines:[222]}),{ok:true,linked:false});
});

test('PID must be the actual local-cycle Node, not a Task parent',()=>{
 assert.deepEqual(simulate({pid:'100'}),{ok:true,linked:false});
});

test('non-numeric PID, disabled Task, and absent running instance stop',()=>{
 assert.deepEqual(simulate({pid:'1;rm'}),{ok:false,linked:false});
 assert.deepEqual(simulate({enabled:false}),{ok:true,linked:false});
 assert.deepEqual(simulate({engines:[]}),{ok:true,linked:false});
});

test('WMI failures return no sensitive metadata and do not authorize',()=>{
 assert.deepEqual(simulate({wmiError:true}),{ok:false,linked:false});
});
