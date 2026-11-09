import test from 'node:test';
import assert from 'node:assert/strict';
import {INCIDENT,MATERIAL_KEYS,TOOL_PATHS,WRITER_TRANSITION,
  validatePostSwitchApproval} from '../tools/controller-postswitch-approval.mjs';
import {runApprovedPostSwitch} from '../tools/controller-postswitch-operator.mjs';

const id=INCIDENT.requestId,old=INCIDENT.oldSha,target=INCIDENT.newSha;
const source='a'.repeat(40),postSource='b'.repeat(40);
const material=Object.fromEntries(MATERIAL_KEYS.map((k,i)=>[k,String(i+1).repeat(64)]));
const evidence=()=>({status:'READONLY_POSTSWITCH_EVIDENCE_VERIFIED',
  requestId:id,actualControllerSha:target,installedShaBefore:old,
  materialHashes:{...material},checks:{
    ORIGINAL_LEDGER:true,TARGET_SWITCHED:true,BACKUP_VERIFIED:true,
    OWNER_DEAD_AND_MATCHED:true,PROTECTION_UNCHANGED:true,
    PROTECTION_CONTRACT_VERIFIED:false,BACKLOG_CLOSED:true,
    LIVE_WORKFLOW_ACTIVE:true,RUNNERS_ONLINE:true,SUPERVISOR_FRESH:true}});
const ledger=()=>({requestId:id,issueNumber:917,
  status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
  firstFail:'INTAKE_RESUMED',code:'BACKLOG_ORIGINAL_REQUEST_INVALID',
  intakePaused:false,postIssueNumber:null,installedShaBefore:old,targetSha:target});
const approval=()=>({schema:'ZGMINI_PC_POSTSWITCH_RECOVERY_APPROVAL_V1',
  approved:true,operation:'FORWARD_POSTSWITCH_917',requestId:id,issueNumber:917,
  sourceSha:source,installedShaBefore:old,targetControllerSha:target,
  evidenceHashes:{...material},
  toolHashes:Object.fromEntries(TOOL_PATHS.map(k=>[k,'f'.repeat(64)])),
  expectedBacklogIssues:[919],
  postcheck:{operation:'core-status',sourceRepository:'ansqhd5774-Choi/zgmini',
    sourceBranch:'main',sourceSha:postSource}});
const goodPorts=()=>{
  const events=[];return {events,
    verifyPreconditions:async()=>{events.push('preflight');return {verified:true};},
    acquireClaim:async()=>{events.push('claim');return {acquired:true,exclusive:true,preexisting:false};},
    verifyOriginalUnchanged:async()=>{events.push('original');return true;},
    persist:async r=>{events.push('persist:'+r.code);},
    reconcileBacklog:async()=>{events.push('backlog');return {verified:true,outcomeUnknown:false};},
    postcheck:async()=>{events.push('postcheck');return {status:'PASS',
      actualExecutionSha:target,protectedStateUnchanged:true,
      runnerSetVerified:true,postSourceVerified:true,outcomeUnknown:false};},
    verifyFinal:async()=>{events.push('final');return {currentSourceSha:target,
      protectedStateUnchanged:true,workflowActive:true,supervisorVerified:true,
      backlogVerified:true,runnerSetVerified:true};},
    archiveLease:async()=>{events.push('archive');return {verified:true,
      originalPreserved:true,archiveVerified:true,claimPreserved:true,
      archiveName:'controller-install.lease'};},
  };};

test('exact approved source, preimages, tools and postcheck are required',()=>{
  assert.equal(validatePostSwitchApproval(approval(),{requestId:id,sourceSha:source,evidence:evidence()}).approved,true);
  const wrong=[
    {...approval(),approved:false},
    {...approval(),issueNumber:996},
    {...approval(),operation:'ROLLBACK'},
    {...approval(),evidenceHashes:{...material,owner:'0'.repeat(64)}},
    {...approval(),toolHashes:{...approval().toolHashes,extra:'f'.repeat(64)}},
    {...approval(),expectedBacklogIssues:[919,920]},
    {...approval(),postcheck:{...approval().postcheck,operation:'source-audit'}},
    {...approval(),unexpected:'bad'},
  ];
  for(const item of wrong)assert.throws(()=>
    validatePostSwitchApproval(item,{requestId:id,sourceSha:source,evidence:evidence()}));
});

test('normal path persists intents before effects and finishes only after archive',async()=>{
  const p=goodPorts();
  const r=await runApprovedPostSwitch({approval:approval(),ledger:ledger(),
    evidence:evidence(),sourceSha:source,ports:p});
  assert.equal(r.status,'RECOVERY_COMPLETED');
  const before=(x,y)=>assert.ok(p.events.indexOf(x)<p.events.indexOf(y),x+' before '+y);
  before('claim','persist:FORWARD_PREPARED');
  before('persist:FORWARD_BACKLOG_REPLAY_STARTED','backlog');
  before('persist:FORWARD_POSTCHECK_STARTED','postcheck');
  before('persist:POSTSWITCH_LEASE_ARCHIVE_INTENT','archive');
  before('archive','persist:POSTSWITCH_FORWARD_RECOVERY_COMPLETED');
});

test('backlog ACK uncertainty keeps original lease and recovery claim',async()=>{
  const p=goodPorts();
  p.reconcileBacklog=async()=>({verified:false,outcomeUnknown:true});
  const r=await runApprovedPostSwitch({approval:approval(),ledger:ledger(),
    evidence:evidence(),sourceSha:source,ports:p});
  assert.equal(r.status,'RECOVERY_REQUIRED');
  assert.equal(r.code,'FORWARD_BACKLOG_NOT_VERIFIED');
  assert.equal(p.events.includes('archive'),false);
});

test('postcheck failure and original drift never archive',async()=>{
  for(const mode of ['post','drift']){
    const p=goodPorts();
    if(mode==='post')p.postcheck=async()=>({status:'FAIL'});
    else p.verifyOriginalUnchanged=async()=>false;
    const r=await runApprovedPostSwitch({approval:approval(),ledger:ledger(),
      evidence:evidence(),sourceSha:source,ports:p});
    assert.equal(r.status,'RECOVERY_REQUIRED');
    assert.equal(p.events.includes('archive'),false);
  }
});

test('archive uncertainty cannot be reported as completed',async()=>{
  const p=goodPorts();
  p.archiveLease=async()=>{throw Object.assign(new Error('stopped'),{code:'ARCHIVE_STOP'});};
  const r=await runApprovedPostSwitch({approval:approval(),ledger:ledger(),
    evidence:evidence(),sourceSha:source,ports:p});
  assert.equal(r.status,'RECOVERY_REQUIRED');
  assert.equal(r.code,'ARCHIVE_STOP');
  assert.equal(r.leaseArchived,false);
});

test('missing, extra or untrusted ports stop before the first effect',async()=>{
  const p=goodPorts();delete p.verifyFinal;
  await assert.rejects(()=>runApprovedPostSwitch({approval:approval(),ledger:ledger(),
    evidence:evidence(),sourceSha:source,ports:p}),/POSTSWITCH_OPERATOR_PORT_MISSING/);
  assert.deepEqual(p.events,[]);
});

test('explicit C-grade Writer transition preserves historical unchanged=false',async()=>{
  const p=goodPorts();
  const ev=evidence();
  ev.checks.PROTECTION_UNCHANGED=false;
  ev.checks.PROTECTION_CONTRACT_VERIFIED=true;
  const ap={...approval(),writerTransition:{...WRITER_TRANSITION}};
  p.verifyFinal=async()=>{p.events.push('final');return {
    currentSourceSha:target,protectedStateUnchanged:false,protectionContractVerified:true,
    workflowActive:true,supervisorVerified:true,backlogVerified:true,runnerSetVerified:true};};
  const outcome=await runApprovedPostSwitch({approval:ap,ledger:ledger(),
    evidence:ev,sourceSha:source,ports:p});
  assert.equal(outcome.status,'RECOVERY_COMPLETED');
  assert.equal(ev.checks.PROTECTION_UNCHANGED,false);
  assert.ok(p.events.includes('archive'));
});

test('Writer config transition drift at final readback prevents lease archive',async()=>{
  const p=goodPorts();
  const ev=evidence();
  ev.checks.PROTECTION_UNCHANGED=false;
  ev.checks.PROTECTION_CONTRACT_VERIFIED=true;
  const ap={...approval(),writerTransition:{...WRITER_TRANSITION}};
  p.verifyFinal=async()=>{p.events.push('final');return {
    currentSourceSha:target,protectedStateUnchanged:false,protectionContractVerified:false,
    workflowActive:true,supervisorVerified:true,backlogVerified:true,runnerSetVerified:true};};
  const outcome=await runApprovedPostSwitch({approval:ap,ledger:ledger(),
    evidence:ev,sourceSha:source,ports:p});
  assert.equal(outcome.status,'RECOVERY_REQUIRED');
  assert.equal(outcome.code,'FORWARD_FINAL_READBACK_FAILED');
  assert.equal(p.events.includes('archive'),false);
});
