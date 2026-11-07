import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createMaintenanceAgent} from '../tools/maintenance-agent.mjs';

const trusted={number:801,title:'pc-approved-runtime-b',state:'OPEN',
 author:{login:'ansqhd5774-Choi'},
 labels:[{name:'pc-maintenance'},{name:'pc-approved-runtime-b'}],
 body:'{}'};

function fixture(t,hook=null){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-generic-route-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const leaseRoot=path.join(root,'lease');fs.mkdirSync(leaseRoot);
 let external=0;
 const agent=createMaintenanceAgent({stateDir:root,leaseRoot,
  approvedGenericBHook:hook,execFileImpl:async()=>{
   external++;throw Error('unexpected PC/GitHub effect');
  }});
 return {agent,external:()=>external};
}

test('new generic B title without an installed approved hook is bounded BLOCKED, zero effects',async t=>{
 const x=fixture(t);
 const result=await x.agent.processIssue(trusted);
 assert.deepEqual(result,{status:'BLOCKED',code:'B_ROUTE_NOT_INSTALLED',issueNumber:801});
 assert.equal(x.external(),0);
});

test('approved hook is opt-in and receives only the trusted new title',async t=>{
 let called=0;
 const x=fixture(t,{dispatch:async issue=>{
  called++;assert.equal(issue, trusted);
  return {handled:true,result:{status:'BLOCKED',code:'B_ROUTE_APPROVAL_REQUIRED'}};
 }});
 const result=await x.agent.processIssue(trusted);
 assert.equal(result.code,'B_ROUTE_APPROVAL_REQUIRED');
 assert.equal(called,1);assert.equal(x.external(),0);
});

test('untrusted issue actor does not reach the new hook',async t=>{
 let called=0;
 const x=fixture(t,{dispatch:async()=>{called++;return {handled:true,result:{status:'PASS'}};}});
 const result=await x.agent.processIssue({...trusted,author:{login:'untrusted'}});
 assert.equal(result.status,'IGNORED');assert.equal(called,0);assert.equal(x.external(),0);
});
