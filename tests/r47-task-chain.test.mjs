import test from'node:test';import assert from'node:assert/strict';import path from'node:path';
import{R47_CHAIN_ROOT,R47_CHAIN_PINS,verifiedR47TaskRoute}from'../task-cmd-b/r47-task-chain.mjs';
const target=path.win32.join(R47_CHAIN_ROOT,'THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd');
function fixture(){const action=path.win32.join(R47_CHAIN_ROOT,'THEME_NINE_R73_SCHEDULED_PRIVATE.cmd');return{taskActionPath:action,taskChainProof:{kind:'PINNED_R73_R48_CHAIN',taskActionPath:action,targetPath:target,arguments:'',workingDirectory:'',files:{...R47_CHAIN_PINS}}};}
test('retains direct approved Task support and admits only the pinned observed R73/R48 chain',()=>{
 assert.equal(verifiedR47TaskRoute({taskActionPath:target},target),true);
 assert.equal(verifiedR47TaskRoute(fixture(),target),true);
 assert.equal(verifiedR47TaskRoute({...fixture(),taskChainProof:null},target),false);
});
for(const name of Object.keys(R47_CHAIN_PINS))test('rejects changed chain member '+name,()=>{const e=fixture();e.taskChainProof.files[name]='0'.repeat(64);assert.equal(verifiedR47TaskRoute(e,target),false);});
for(const[name,change]of Object.entries({action:e=>e.taskActionPath='E:/other.cmd',target:e=>e.taskChainProof.targetPath='E:/other.cmd',args:e=>e.taskChainProof.arguments='--other',directory:e=>e.taskChainProof.workingDirectory='C:/other',missing:e=>delete e.taskChainProof.files[Object.keys(R47_CHAIN_PINS)[0]],extra:e=>e.taskChainProof.files.other='a'.repeat(64),kind:e=>e.taskChainProof.kind='OBSERVED_NOT_PROVEN'}))test('rejects '+name,()=>{const e=fixture();change(e);assert.equal(verifiedR47TaskRoute(e,target),false);});
