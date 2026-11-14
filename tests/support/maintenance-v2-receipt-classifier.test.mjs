// ZGMINI support-only tests. No production files, receiver, GitHub workflow or PC job.
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHandoffReceipt} from './maintenance-v2-receipt-classifier.mjs';

const old='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const target='c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7';
const full={
  attemptObserved:true,journalPresent:true,journalStatus:'PASS',installedSourceSha:target,
  runtimeHashesVerified:true,receiverOriginVerified:true,protectionPreserved:true,
  runnerSeatsVerified:true,installLeaseClear:true,remoteReportPresent:true,
  ownerReceiptVerified:true,
};
const cases=[
  ['no authenticated attempt',{},'NOT_RUN_UNCONFIRMED'],
  ['null input',null,'INVALID_EVIDENCE'],
  ['malformed evidence',{attemptObserved:'yes'},'INVALID_EVIDENCE'],
  ['not-run contradictory STOP',{attemptObserved:false,stopRequestPresent:true},'EVIDENCE_CONFLICT'],
  ['journal contradiction',{attemptObserved:true,journalPresent:false,journalStatus:'PASS'},'EVIDENCE_CONFLICT'],
  ['all independently authenticated checks',full,'HANDOFF_VERIFIED'],
  ['owner attestation missing',{...full,ownerReceiptVerified:null},'PASS_EVIDENCE_INCOMPLETE'],
  ['old source with PASS',{...full,installedSourceSha:old},'EVIDENCE_CONFLICT'],
  ['missing receiver origin',{...full,receiverOriginVerified:null},'PASS_BUT_RECEIVER_UNVERIFIED'],
  ['false receiver origin',{...full,receiverOriginVerified:false},'PASS_BUT_RECEIVER_UNVERIFIED'],
  ['runtime hashes missing',{...full,runtimeHashesVerified:null},'PASS_EVIDENCE_INCOMPLETE'],
  ['original protections missing',{...full,protectionPreserved:null},'PASS_EVIDENCE_INCOMPLETE'],
  ['lease clearance missing',{...full,installLeaseClear:null},'PASS_EVIDENCE_INCOMPLETE'],
  ['remote receipt unknown',{...full,remoteReportPresent:null},'PASS_REMOTE_RECEIPT_UNCONFIRMED'],
  ['local PASS remote upload gap',{...full,remoteReportPresent:false},'UPLOAD_GAP'],
  ['recovery journal',{attemptObserved:true,journalPresent:true,journalStatus:'RECOVERY_REQUIRED'},'RECOVERY_REQUIRED'],
  ['rollback needs reattestation',{attemptObserved:true,journalPresent:true,journalStatus:'ROLLED_BACK'},'ROLLBACK_REATTESTATION_REQUIRED'],
  ['operation running',{attemptObserved:true,journalPresent:true,journalStatus:'RUNNING',operatorAlive:true},'HANDOFF_IN_PROGRESS'],
  ['stale running journal',{attemptObserved:true,journalPresent:true,journalStatus:'RUNNING',operatorAlive:false},'INCOMPLETE_JOURNAL'],
  ['STOP may be late',{attemptObserved:true,journalPresent:false,stopRequestPresent:true,priorReceiverAlive:true},'STOP_PENDING_OR_TIMEOUT'],
  ['stopped without journal',{attemptObserved:true,journalPresent:false,stopHandledPresent:true,priorReceiverAlive:false},'STOPPED_PREJOURNAL_UNKNOWN'],
  ['preflight blocked with verified untouched state',{
    attemptObserved:true,journalPresent:true,journalStatus:'BLOCKED',priorReceiverAlive:true,
    stopRequestPresent:false,stopHandledPresent:false,installedSourceSha:old,
    protectionPreserved:true,ownerReceiptVerified:true
  },'PREFLIGHT_BLOCKED_UNTOUCHED'],
  ['blocked without evidence',{attemptObserved:true,journalPresent:true,journalStatus:'BLOCKED'},'BLOCKED_SIDE_EFFECTS_UNKNOWN'],
  ['attempt observed but status missing',{attemptObserved:true},'STATE_UNKNOWN'],
  ['journal exists status unknown',{attemptObserved:true,journalPresent:true},'JOURNAL_STATUS_UNKNOWN'],
  ['wrong but well-formed target',{...full,installedSourceSha:'a'.repeat(40)},'EVIDENCE_CONFLICT'],
  ['owner attestation false',{...full,ownerReceiptVerified:false},'PASS_EVIDENCE_INCOMPLETE']
];
for(const [name,receipt,expected] of cases){
  test(name,()=>{
    const output=classifyHandoffReceipt(receipt);
    assert.equal(output.status,expected);
    assert.equal(output.operationalPass,expected==='HANDOFF_VERIFIED');
  });
}
test('256 combinations of 8 independent proof gates never produce false PASS',()=>{
  const flags=['journalPresent','runtimeHashesVerified','receiverOriginVerified',
    'protectionPreserved','runnerSeatsVerified','installLeaseClear',
    'remoteReportPresent','ownerReceiptVerified'];
  let positives=0;
  for(let n=0;n<(1<<flags.length);n++){
    const e={...full};
    flags.forEach((flag,i)=>{e[flag]=Boolean(n&(1<<i));});
    const result=classifyHandoffReceipt(e);
    if(result.operationalPass)positives++;
    assert.equal(result.operationalPass,n===(1<<flags.length)-1,JSON.stringify(e));
  }
  assert.equal(positives,1);
});
