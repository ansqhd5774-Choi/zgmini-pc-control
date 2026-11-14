import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,classify} from '../watchdog-b/handoff-firstfail-readonly.mjs';
const body={schema:'ZGMINI_WATCHDOG_HANDOFF_FIRSTFAIL_A_V1',
 requestId:'pc-watchdog-handoff-a-810f1572-4a4d-40a9-b1fb-617c12474ae5',
 operation:'watchdog-handoff-status-readonly',handoffIssueNumber:1378};
const event={action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{title:'pc-watchdog-handoff-status-readonly',
 user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-maintenance'}]}};
test('fixed only #1378 first-fail A read, no arbitrary issue selection',()=>{
 assert.equal(validate(event,body),body.requestId);
 assert.throws(()=>validate(event,{...body,handoffIssueNumber:1379}),/WATCHDOG_HANDOFF_A_CONTRACT_DENIED/);
 assert.throws(()=>validate({...event,sender:{login:'other'}},body),/WATCHDOG_HANDOFF_A_EVENT_DENIED/);
});
test('no claim, old receiver and stale local checkout remain distinct actionable facts',()=>{
 const r=classify({watchStatus:{state:'HEALTHY'},
  watchRawValid:true,
  watchInstall:{scope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1'},
  receiver:{sourceSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0'},
  receiverStatus:{status:'LISTENING'},
  branch:'main',ancestor:false,controllerLock:false,stopRequest:false});
 assert.equal(r.claim,'NOT_CLAIMED');
 assert.equal(r.receiverSource,'PRIOR');
 assert.equal(r.checkout,'MAIN_TARGET_NOT_ANCESTOR');
 assert.equal(r.watchdog,'HEALTHY_NEW_SCOPE');
});
test('bounded claim and current Receiver status are never assumed to imply PASS',()=>{
 const req='pc-handoff-51fbf9ee-18ae-4f66-9dd5-737b355223aa';
 const r=classify({claim:{requestId:req,targetSha:'c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7',status:'RUNNING'},
  receiver:{sourceSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0'},
  bridge:{status:'BLOCKED',code:'HANDOFF_OPERATOR_SOURCE_NOT_ANCESTOR',issueNumber:1378},
  branch:'main',ancestor:true,controllerLock:true,stopRequest:true});
 assert.equal(r.claim,'RUNNING');
 assert.equal(r.receiverSource,'PRIOR');
 assert.equal(r.bridgeStatus,'BLOCKED');
 assert.equal(r.controllerInstallLock,'HELD');
 assert.equal(r.stopRequest,'PRESENT');
});
