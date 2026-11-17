import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'task-cmd-b','r47-task-probe.js');
function simulateProbe({count=0,processes=[],taskEnabled=true,wmiError=false}={}){
 const source=fs.readFileSync(file,'utf8');
 const output=[],calls=[];
 const slash=String.fromCharCode(92);
 const task={Enabled:taskEnabled,State:3,GetInstances:()=>({Count:count})};
 const sandbox={
  ActiveXObject:name=>{
   assert.equal(name,'Schedule.Service');return{
    Connect(){},
    GetFolder(folder){calls.push(['folder',folder]);assert.equal(folder,slash);
     return {GetTask(taskName){
      assert.equal(taskName,'ZGMINI-PC-Theme-Nine-R47-Private');return task;
     }};
    }
   };
  },
  GetObject:ns=>{
   calls.push(['wmi',ns]);
   assert.equal(ns,'winmgmts:root'+slash+'cimv2');
   if(wmiError)throw Error('READ_DENIED_CANARY_PRIVATE');
   return {ExecQuery(query){
    assert.equal(query,'SELECT Name,CommandLine FROM Win32_Process');
    return processes;
   }};
  },
  Enumerator:class{
   constructor(items){this.items=items;this.i=0}
   atEnd(){return this.i>=this.items.length}
   moveNext(){this.i++}
   item(){return this.items[this.i]}
  },
  WScript:{
   Echo:line=>output.push(line),
   Quit:code=>{calls.push(['quit',code])}
  },
 };
 vm.runInNewContext(source,sandbox,{timeout:2000});
 return {output,calls};
}
test('R47 WSH probe uses exactly one Task root separator and one WMI namespace separator',()=>{
 const r=simulateProbe();
 assert.deepEqual(JSON.parse(r.output[0]),{
  ok:true,enabled:true,state:3,instances:0,relatedProcesses:0,
  unknownProcessLines:0
 });
 assert.equal(r.calls[0][1],String.fromCharCode(92));
 assert.equal(r.calls[1][1],'winmgmts:root'+String.fromCharCode(92)+'cimv2');
});
test('R47 WSH probe counts active approved command and uncertain protected CMD without leaking strings',()=>{
 const r=simulateProbe({count:1,processes:[
  {Name:'cmd.exe',CommandLine:'cmd.exe /c E:/ZGmini/data/pc-writer/theme-nine-r48/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd'},
  {Name:'wscript.exe',CommandLine:null},
  {Name:'other.exe',CommandLine:'SENSITIVE_TOKEN_CANARY'}
 ]});
 const x=JSON.parse(r.output[0]);
 assert.equal(x.instances,1);
 assert.equal(x.relatedProcesses,1);
 assert.equal(x.unknownProcessLines,1);
 assert.equal(r.output[0].includes('SENSITIVE_TOKEN_CANARY'),false);
});
test('R47 WSH probe fails closed without leaking WMI error or command-line data',()=>{
 const r=simulateProbe({wmiError:true});
 assert.deepEqual(JSON.parse(r.output[0]),{
  ok:false,code:'TASK_CMD_B_READONLY_PROBE_STOP'
 });
 assert.equal(r.calls.some(x=>x[0]==='quit'&&x[1]===2),true);
 assert.equal(r.output[0].includes('READ_DENIED_CANARY_PRIVATE'),false);
});
