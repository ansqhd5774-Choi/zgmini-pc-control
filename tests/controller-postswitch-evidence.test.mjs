import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {classifyPostSwitchEvidence, verifyControllerFiles,
  verifyExactPostSwitchInventory,verifySourceBytes,
  verifySupervisorSnapshot,verifyNamedPcRunnersOnline,
  verifyWriterProtectionTransition} from '../tools/controller-postswitch-evidence.mjs';

const sha256 = b => createHash('sha256').update(b).digest('hex');
const before = 'c09bf6a6f66f229016135020d6ba553ba9a94676';
const after = 'badad9124157879d7a645b64f2768113d632355b';
const seats = () => Array.from({length: 6}, (_, i) =>
  ({name:`zgmini-pc-0${i + 1}`,status:'online'}));

test('six named PC seats remain healthy with independently registered spare runner', () => {
  assert.equal(verifyNamedPcRunnersOnline(seats()), true);
  assert.equal(verifyNamedPcRunnersOnline([
    {name:'zgmini-handoff-ci-spare-01',status:'online'},...seats()]), true);
});

test('missing, offline, duplicate and malformed dedicated seats fail closed', () => {
  assert.equal(verifyNamedPcRunnersOnline(null), false);
  assert.equal(verifyNamedPcRunnersOnline(seats().slice(0, 5)), false);
  assert.equal(verifyNamedPcRunnersOnline(seats().map((x,i) =>
    i === 2 ? {...x,status:'offline'} : x)), false);
  assert.equal(verifyNamedPcRunnersOnline([...seats(),seats()[0]]), false);
});
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
  assert.equal(Object.entries(result.checks).every(([key,ok]) =>
    key === 'PROTECTION_CONTRACT_VERIFIED' || ok), true);
  assert.match(result.next, /NO_AUTOMATIC_EXECUTION/);
});

const writerTransition=()=>({
  baselineConfigSha256:'a648e80310f50cf68475195e21a750647629c48b584333520260827c6ff5a037',
  currentConfigSha256:'e3e5b6de45cdb63de4056a56784e46c9b0fb8546462089cb5b98c8d42496110c',
  approvedSourceSha:'70d2d1dbd8180255133bdd7fc925ae07bb8d6cc9',
  writerBResultBlobSha:'e07389fb660359352109146175eb8fa3f7ae0798',
  writerAResultBlobSha:'6baf4fd2d8d6067bc178b7f79a95c4381771c512',
});
function approvedWriterFixture() {
  const t=writerTransition();
  return {
    transition:t,
    baseline:{files:{'config.json':t.baselineConfigSha256,
      'quota-runner.cmd':sha256('quota'),'run-local.cmd':sha256('run')},
      tasks:{'ZGMINI-PC-Local-Core':sha256('core'),
        'ZGMINI-PC-Local-Korea':sha256('korea'),
        'ZGMINI-PC-Iran-Progress-R13':'APPROVED_RETIRED_ABSENT'}},
    current:null,
    writerB:{schema:'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1',
      requestId:'b14af1b2-9a23-4f5a-9239-218498ddb403',
      status:'WRITER_B_INSTALLED_VERIFIED',code:'WRITER_B_INSTALL_VERIFIED',
      sourceSha:t.approvedSourceSha,mode:'LOCAL_OVERLAY',localOnly:true,
      manifestSha256:'593004aa6b0c5c6471a691faebd9c98f142af4990580a8b1d5a0619d829b2e6f',
      changedPaths:['scripts/pc-writer/release-calendar.mjs',
        'lib/treasury-auction-history-source.mjs',
        'lib/treasury-auction-history.mjs',
        'lib/treasury-auction-history-taws.mjs']},
    writerA:{schema:'ZGMINI_PC_RESULT_V1',
      requestId:'pc-4b53b63d-cf6f-4898-806d-f6774b63009c',
      operation:'writer-install-preimage-readonly',status:'PASS',
      code:'WRITER_FIXED_PREIMAGE_READONLY',operationalWrites:0,
      providerCalls:0,d1Writes:0,sqliteOpened:false,protectedStateUnchanged:true,
      result:{status:'PASS',sourceIdentityConsistent:true,
        sourceHead:t.approvedSourceSha,approvedConfigSource:t.approvedSourceSha,
        checkpointSource:t.approvedSourceSha,
        r6Config:{status:'PASS',configSha256:t.currentConfigSha256}}},
    writerBBlobSha:t.writerBResultBlobSha,writerABlobSha:t.writerAResultBlobSha,
  };
}
function completeWriterFixture() {
  const data=approvedWriterFixture();
  data.current=structuredClone(data.baseline);
  data.current.files['config.json']=data.transition.currentConfigSha256;
  return data;
}
test('explicit Writer transition validates independent A and B evidence without rewriting #917 baseline',()=>{
  const data=completeWriterFixture();
  assert.equal(verifyWriterProtectionTransition(data),true);
  assert.equal(data.baseline.files['config.json'],data.transition.baselineConfigSha256);
  const evidence=valid();
  evidence.protectionVerified=false;
  evidence.protectionContractVerified=true;
  const decision=classifyPostSwitchEvidence(evidence);
  assert.equal(decision.status,'READONLY_POSTSWITCH_EVIDENCE_VERIFIED');
  assert.equal(decision.checks.PROTECTION_UNCHANGED,false);
  assert.equal(decision.checks.PROTECTION_CONTRACT_VERIFIED,true);
});
test('no C-grade contract means historical Writer config drift remains blocked',()=>{
  const evidence=valid();evidence.protectionVerified=false;
  assert.equal(classifyPostSwitchEvidence(evidence).status,'RECOVERY_REQUIRED');
  assert.equal(classifyPostSwitchEvidence(evidence).code,'PROTECTION_UNCHANGED');
});
test('Writer config transition rejects changed digest and extra approval field',()=>{
  for(const mutate of [
    x=>{x.current.files['config.json']=sha256('unknown config');},
    x=>{x.transition.currentConfigSha256=sha256('unapproved');},
    x=>{x.transition.unapprovedBypass=true;},
    x=>{x.baseline.files['config.json']=sha256('modified historical snapshot');},
  ]){
    const d=completeWriterFixture();mutate(d);
    assert.equal(verifyWriterProtectionTransition(d),false);
  }
});
test('Writer transition rejects unrelated files, Task or retired-Iran modifications',()=>{
  for(const mutate of [
    x=>{x.current.files['quota-runner.cmd']=sha256('altered');},
    x=>{delete x.current.files['run-local.cmd'];},
    x=>{x.current.files['another.cmd']=sha256('new');},
    x=>{x.current.tasks['ZGMINI-PC-Local-Core']=sha256('altered');},
    x=>{x.current.tasks['ZGMINI-PC-Local-Korea']=sha256('altered');},
    x=>{x.current.tasks['ZGMINI-PC-Iran-Progress-R13']=sha256('active');},
    x=>{delete x.current.tasks['ZGMINI-PC-Iran-Progress-R13'];},
  ]) {
    const d=completeWriterFixture();mutate(d);
    assert.equal(verifyWriterProtectionTransition(d),false);
  }
});
test('Writer transition rejects forged or stale A/B proof and blob identities',()=>{
  for(const mutate of [
    x=>{x.writerBBlobSha='f'.repeat(40);},
    x=>{x.writerABlobSha='f'.repeat(40);},
    x=>{x.writerB.status='RECOVERY_REQUIRED';},
    x=>{x.writerB.sourceSha='a'.repeat(40);},
    x=>{x.writerB.manifestSha256='f'.repeat(64);},
    x=>{x.writerB.changedPaths.pop();},
    x=>{x.writerA.status='FAIL';},
    x=>{x.writerA.operation='writer-install';},
    x=>{x.writerA.operationalWrites=1;},
    x=>{x.writerA.protectedStateUnchanged=false;},
    x=>{x.writerA.result.sourceIdentityConsistent=false;},
    x=>{x.writerA.result.approvedConfigSource='f'.repeat(40);},
    x=>{x.writerA.result.r6Config.configSha256='f'.repeat(64);},
  ]) {
    const d=completeWriterFixture();mutate(d);
    assert.equal(verifyWriterProtectionTransition(d),false);
  }
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

test('C-grade inventory requires exact 38 manifest paths and both source trees',()=>{
  const all=['config/operations.json',...Array.from({length:37},(_,i)=>
    `controller/test-module-${i}.mjs`)];
  const host={controllerSourceSha:after,controllerFiles:Object.fromEntries(
    all.map(name=>[name,sha256(name)]))};
  const backup={...host,controllerSourceSha:before};
  assert.equal(verifyExactPostSwitchInventory(host,backup,all,all),true);
  const short=all.slice(0,-1);
  assert.equal(verifyExactPostSwitchInventory(host,backup,short,short),false);
  assert.equal(verifyExactPostSwitchInventory({...host,controllerFiles:Object.fromEntries(
    short.map(name=>[name,sha256(name)]))},backup,all,all),false);
  assert.equal(verifyExactPostSwitchInventory(host,backup,all,
    [...short,'controller/foreign-file.mjs']),false);
  assert.equal(verifyExactPostSwitchInventory(host,backup,[...all,all[0]],all),false);
});

test('all 38 declared SHA-256 values also match the exact Git SHA blobs',()=>{
  const names=['config/operations.json',...Array.from({length:37},(_,i)=>
    `controller/source-file-${i}.mjs`)];
  const host={controllerSourceSha:after,controllerFiles:Object.fromEntries(
    names.map(name=>[name,sha256(`${after}:${name}`)]))};
  const read=(sha,rel)=>Buffer.from(`${sha}:${rel}`);
  assert.equal(verifySourceBytes(host,after,read),true);
  assert.equal(verifySourceBytes(host,before,read),false);
  const corrupted='controller/source-file-15.mjs';
  assert.equal(verifySourceBytes(host,after,(sha,rel)=>
    Buffer.from(rel===corrupted?'corrupted':`${sha}:${rel}`)),false);
});

test('live supervisor must own six distinct alive child seats and a fresh listener status',()=>{
  const now=Date.parse('2026-11-09T14:40:45Z');
  const status={at:'2026-11-09T14:40:44Z',pid:300,sourceSha:after,
    mode:'LISTENING',children:Array.from({length:6},(_,i)=>({
      seat:i+1,pid:301+i,alive:true}))};
  const owner={pid:300,nonce:'11111111-2222-3333-4444-555555555555',bootAt:now-123400};
  const params={targetSha:after,now,bootAt:owner.bootAt,livePid:()=>true};
  assert.equal(verifySupervisorSnapshot(status,owner,params),true);
  assert.equal(verifySupervisorSnapshot({...status,mode:'DRAIN'},owner,params),false);
  assert.equal(verifySupervisorSnapshot({...status,at:'2026-11-09T14:38:00Z'},owner,params),false);
  assert.equal(verifySupervisorSnapshot(status,{...owner,pid:999},params),false);
  assert.equal(verifySupervisorSnapshot(status,{...owner,bootAt:1},params),false);
  assert.equal(verifySupervisorSnapshot({...status,children:status.children.map(
    (x,i)=>({...x,seat:i===5?5:x.seat}))},owner,params),false);
  assert.equal(verifySupervisorSnapshot({...status,children:status.children.map(
    (x,i)=>({...x,alive:i!==4}))},owner,params),false);
  assert.equal(verifySupervisorSnapshot(status,owner,{...params,livePid:pid=>pid!==305}),false);
});
