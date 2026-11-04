import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const script=fs.readFileSync(new URL('./r17-b-windows-probe.js',import.meta.url),'utf8');

function runProbe({fail=false,enabled=true,state=3,processes=[]}={}){
  const stdout=[];const exits=[];
  const task={Enabled:enabled,State:state,GetInstances(){return {Count:0};}};
  const service={Connect(){if(fail)throw new Error('REDACT THIS');},
    GetFolder(){return {GetTask(){return task;}}}};
  function Enumerator(items){let idx=0;this.atEnd=()=>idx>=items.length;
    this.moveNext=()=>{idx++;};this.item=()=>items[idx];}
  const context={JSON:undefined,
    ActiveXObject:function(name){assert.equal(name,'Schedule.Service');return service;},
    GetObject(){return {ExecQuery(){return processes;}}},Enumerator,
    WScript:{Echo(message){stdout.push(message);},Quit(code){exits.push(code);}}};
  vm.runInNewContext(script,context,{timeout:1000});
  return {stdout,exits};
}

test('normal result is strict JSON without a JSON global or user text output',()=>{
  const run=runProbe({state:4,processes:[
    {CommandLine:'node local-cycle.mjs --secret=DO-NOT-ECHO'},
    {CommandLine:null},
    {CommandLine:'cmd harmless'}]});
  assert.equal(run.stdout.length,1);
  assert.deepEqual(JSON.parse(run.stdout[0]),{ok:true,enabled:true,state:4,
    instances:0,relatedProcesses:1,unknownProcessLines:1});
  assert.doesNotMatch(run.stdout[0],/DO-NOT-ECHO|local-cycle|secret/i);
  assert.deepEqual(run.exits,[]);
});

test('COM failure prints fixed JSON and exits 2 even without a JSON global',()=>{
  const run=runProbe({fail:true});
  assert.deepEqual(run.stdout,['{"ok":false,"code":"R17_B_WINDOWS_PROBE_STOP"}']);
  assert.deepEqual(run.exits,[2]);
  assert.doesNotMatch(run.stdout[0],/REDACT/);
});

test('normal false state stays a boolean, not a string',()=>{
  const run=runProbe({enabled:false,state:1});
  assert.equal(JSON.parse(run.stdout[0]).enabled,false);
  assert.equal(JSON.parse(run.stdout[0]).state,1);
});
