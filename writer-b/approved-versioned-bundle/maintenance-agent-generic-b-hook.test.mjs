import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeMaintenanceAgentGenericBHook}
 from './maintenance-agent-generic-b-hook.mjs';
import {GENERIC_B_TITLE} from './approved-generic-b-route.mjs';

test('legacy controller/R6/R54/source-bundle requests remain untouched',async()=>{
 const calls=[];
 const hook=makeMaintenanceAgentGenericBHook({approvedRoute:{
  receive:async item=>{calls.push(item);return {status:'PASS'};}}});
 for(const title of ['pc-controller-update','pc-r6-host-register',
  'pc-theme-nine-r54-sixfile-install','pc-source-bundle-register']){
  assert.deepEqual(await hook.dispatch({title}),{handled:false});
 }
 assert.equal(calls.length,0);
});

test('single approved generic route is dispatched without Issue-selected CLI',async()=>{
 const issue={title:GENERIC_B_TITLE,number:810};
 const hook=makeMaintenanceAgentGenericBHook({approvedRoute:{
  receive:async({issue:received})=>{
   assert.equal(received,issue);return {status:'STATE_UNKNOWN',
    retainLockForRecovery:true};}}});
 assert.deepEqual(await hook.dispatch(issue),{
  handled:true,result:{status:'STATE_UNKNOWN',retainLockForRecovery:true}});
});

test('uninstalled generic route cannot create any effective hook',()=>{
 assert.throws(()=>makeMaintenanceAgentGenericBHook(),
  {code:'B_MAINTENANCE_HOOK_ROUTE_NOT_INSTALLED'});
});
