import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {classifyPostSwitchEvidence, verifyControllerFiles} from '../tools/controller-postswitch-evidence.mjs';

const sha256 = b => createHash('sha256').update(b).digest('hex');
const before = 'c09bf6a6f66f229016135020d6ba553ba9a94676';
const after = 'badad9124157879d7a645b64f2768113d632355b';
function valid() {
  return {
    ledger: {status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',firstFail:'INTAKE_RESUMED',intakePaused:false,
      code:'BACKLOG_ORIGINAL_REQUEST_INVALID',postIssueNumber:null,
      installedShaBefore:before,targetSha:after},
    currentSha:after,currentBytesVerified:true,snapshotSha:before,snapshotBytesVerified:true,
    ownerIdentityVerified:true,ownerAlive:false,protectionVerified:true,
    backlogVerified:true,pauseWindowsClosed:true,workflow:'active',
    runnerSetVerified:true,supervisorVerified:true,otherControlLeaseCount:2,
  };
}

test('valid post-switch evidence remains read-only and eligible for a *plan*, never automatic action', () => {
  const result = classifyPostSwitchEvidence(valid());
  assert.equal(result.status, 'READONLY_POSTSWITCH_EVIDENCE_VERIFIED');
  assert.equal(result.code, 'POSTSWITCH_EVIDENCE_VERIFIED');
  assert.equal(Object.values(result.checks).every(Boolean), true);
  assert.match(result.next, /NO_AUTOMATIC_EXECUTION/);
});

test('historical ledger workflow false does not substitute for current live workflow', () => {
  const evidence = valid(); evidence.ledger.workflowEnabled = false;
  assert.equal(classifyPostSwitchEvidence(evidence).checks.LIVE_WORKFLOW_ACTIVE, true);
  evidence.workflow = 'disabled_manually';
  assert.equal(classifyPostSwitchEvidence(evidence).checks.LIVE_WORKFLOW_ACTIVE, false);
});

test('irrelevant independent control leases do not make a read-only snapshot fail', () => {
  const evidence = valid(); evidence.otherControlLeaseCount = 3;
  assert.equal(classifyPostSwitchEvidence(evidence).status, 'READONLY_POSTSWITCH_EVIDENCE_VERIFIED');
});

test('each missing protection, snapshot, owner, workflow, backlog and supervisor proof fails closed', () => {
  const variants = [
    ['protectionVerified',false,'PROTECTION_UNCHANGED'],
    ['snapshotBytesVerified',false,'BACKUP_VERIFIED'],
    ['currentBytesVerified',false,'TARGET_SWITCHED'],
    ['ownerAlive',true,'OWNER_DEAD_AND_MATCHED'],
    ['pauseWindowsClosed',false,'BACKLOG_CLOSED'],
    ['runnerSetVerified',false,'RUNNERS_ONLINE'],
    ['supervisorVerified',false,'SUPERVISOR_FRESH'],
  ];
  for (const [name,value,failed] of variants) {
    const evidence = valid(); evidence[name] = value;
    const result = classifyPostSwitchEvidence(evidence);
    assert.equal(result.status, 'RECOVERY_REQUIRED', name);
    assert.equal(result.checks[failed], false, name);
  }
});

test('a different phase, original code or previously created postcheck cannot pass', () => {
  for (const [key,value] of [['firstFail','SWITCHED'],['code','BACKLOG_REPLAY_OUTCOME_UNKNOWN'],
    ['postIssueNumber',123456]]) {
    const evidence=valid(); evidence.ledger[key]=value;
    assert.equal(classifyPostSwitchEvidence(evidence).checks.ORIGINAL_LEDGER,false,key);
  }
});

test('unchanged old version is not a post-switch incident', () => {
  const evidence=valid(); evidence.currentSha=before;
  assert.equal(classifyPostSwitchEvidence(evidence).checks.TARGET_SWITCHED,false);
});

test('controller manifest hashes validate actual bytes and reject path substitution', () => {
  const names=['controller/common.mjs','controller/supervisor.mjs','controller/operations.mjs',
    'controller/reader.mjs','config/operations.json'];
  const bytes=new Map(names.map(name=>[path.join('/verified',name),Buffer.from(name)]));
  const host={controllerSourceSha:after,
    controllerFiles:Object.fromEntries(names.map(name=>[name,sha256(Buffer.from(name))]))};
  const read=key=>{if(!bytes.has(key))throw Error('missing');return bytes.get(key);};
  assert.equal(verifyControllerFiles(host,'/verified',read),true);
  assert.equal(verifyControllerFiles({...host,controllerFiles:{...host.controllerFiles,
    '../secret.env':sha256('bad')}},'/verified',read),false);
  bytes.set(path.join('/verified',names[0]),Buffer.from('tampered'));
  assert.equal(verifyControllerFiles(host,'/verified',read),false);
});

test('missing, malformed or short file inventory does not pass', () => {
  assert.equal(verifyControllerFiles(null,'/verified'),false);
  assert.equal(verifyControllerFiles({controllerSourceSha:after,controllerFiles:{}},'/verified'),false);
  assert.equal(verifyControllerFiles({controllerSourceSha:'bad',controllerFiles:{}},'/verified'),false);
});

test('38-file host inventory checks all bytes, including the only changed controller file', () => {
  const mandatory=['config/operations.json','controller/common.mjs','controller/engine.mjs',
    'controller/entry.mjs','controller/fear-greed-archive-readonly.mjs',
    'controller/operations.mjs','controller/supervisor.mjs',
    'controller/upload.mjs','controller/worker.mjs'];
  const additional=['controller/theme-l7-runtime-readonly.mjs',
    ...Array.from({length:28},(_,i)=>`controller/extra-readonly-${i}.mjs`)];
  const all=[...mandatory,...additional];
  assert.equal(all.length,38);
  const entries=new Map(all.map(name=>[path.join('/snapshot',name),Buffer.from(name)]));
  const host={controllerSourceSha:after,controllerFiles:Object.fromEntries(
    all.map(name=>[name,sha256(Buffer.from(name))]))};
  const reader=file=>{if(!entries.has(file))throw Error('missing');return entries.get(file);};
  assert.equal(verifyControllerFiles(host,'/snapshot',reader),true);
  entries.set(path.join('/snapshot',additional[0]),Buffer.from('changed-file-corrupted'));
  assert.equal(verifyControllerFiles(host,'/snapshot',reader),false);
});
