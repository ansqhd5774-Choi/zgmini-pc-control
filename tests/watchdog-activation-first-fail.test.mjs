import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyA,classifyActivation} from '../watchdog-b/activation-first-fail-readonly.mjs';
const requestId='pc-watchdog-activation-a-c6d327a1-d5a4-4d23-8dbb-1c4c3eef8194';
const body={schema:'ZGMINI_WATCHDOG_ACTIVATION_FIRST_FAIL_A_V1',
 requestId,operation:'watchdog-activation-first-fail-readonly',failedIssueNumber:1381};
const event={action:'opened',
 repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
 sender:{login:'ansqhd5774-Choi'},
 issue:{title:'pc-watchdog-activation-first-fail-readonly',
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-maintenance'}]}};
test('fixed first-fail query is authenticated and restricted to consumed #1381',()=>{
 assert.equal(verifyA(event,body),requestId);
 assert.throws(()=>verifyA(event,{...body,failedIssueNumber:1378}),
  /WATCHDOG_ACTIVATION_A_REQUEST/);
 assert.throws(()=>verifyA({...event,sender:{login:'other'}},body),
  /WATCHDOG_ACTIVATION_A_EVENT/);
});
test('absent durable claim confirms no activation was invoked by consumed B',()=>{
 assert.deepEqual(classifyActivation({claim:null,newSourceValid:true,attest:false,probe:false}),
  {stage:'PRECLAIM',effect:'NO_CLAIM_NO_ACTIVATION',
   source:'STAGED',origin:'NOT_ATTESTED',probe:'DENIED',guard:'NO_STOP_MARKER'});
});
test('consumed claim remains uncertain unless a different healthy Guardian-backed process is proven',()=>{
 const claim={schema:'ZGMINI_PC_WATCHDOG_ACTIVATION_B_RESULT_V1',
  requestId:'pc-watchdog-activate-5ee17f39-2dfd-4d2f-919a-947ea87e1fb4',
  status:'RUNNING',oldPid:111,oldNonce:'nonce-old'};
 let actual=classifyActivation({claim,oldKnown:true,
  currentOwner:{pid:111,nonce:'nonce-old'},
  currentStatus:{pid:111,state:'HEALTHY'},newSourceValid:true,attest:true,probe:true});
 assert.equal(actual.effect,'SAME_OLD_PROCESS');
 actual=classifyActivation({claim,oldKnown:true,
  currentOwner:{pid:112,nonce:'nonce-new'},
  currentStatus:{pid:112,state:'HEALTHY'},newSourceValid:true,attest:true,probe:false});
 assert.equal(actual.effect,'NEW_WATCHDOG_ATTESTED');
 assert.throws(()=>classifyActivation({claim:{...claim,requestId:'other'}}),
  /WATCHDOG_ACTIVATION_A_LEDGER_INVALID/);
});
