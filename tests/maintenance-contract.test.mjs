import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {test} from "node:test";
import fs from 'node:fs';

import {
  CONTROL_ACTOR,CONTROL_REPOSITORY,MAINTENANCE_ISSUE_SCHEMA,UPDATE_SCHEMA,
  manifestFingerprint,validateMaintenanceRequest,validateUpdateRequest,
  validateControllerConfigTransition,controllerAdmissionForPurpose,
  requestFingerprint,dedupeUpdateRequest,newUpdateLedger,transitionLedger,
  validateInfrastructureDelta,validateControllerOnlyInstallDelta,
  deployableControllerTreePaths,isControllerSourceTestPath,
  prepareControllerUpdateRequest,selectPreservedRecoveryProtection,
  recoveryProtectedSnapshotStillPinned,
} from "../tools/maintenance-contract.mjs";

const OLD="c491d95fdb594a729f08deff68d86e04c18a9544";
const NEXT="b".repeat(40);
const POST="6f70c04ced91aebbe8ec543f33a4d95c052d73e6";
const HASH_A="a".repeat(64),HASH_B="b".repeat(64),HASH_C="c".repeat(64);
const digest=v=>createHash("sha256").update(v).digest("hex");
const clone=x=>JSON.parse(JSON.stringify(x));

function fixture(){
  const allowFiles=[
    {path:"controller/fear-greed-archive-readonly.mjs",sha256:HASH_B},
    {path:"controller/operations.mjs",sha256:HASH_A},
  ];
  const manifest={
    schema:UPDATE_SCHEMA,installedSha:OLD,targetSha:NEXT,allowFiles,
    purpose:"employment-r6-readonly-adapter",
    approval:{grade:"B",ref:"https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/28",scope:"EMPLOYMENT_R6_READONLY_RUNNER"},
    checks:{targetSha:NEXT,status:"PASS",manifestSha256:manifestFingerprint(allowFiles).sha256},
    backup:{strategy:"VERSIONED_SNAPSHOT",rollback:{kind:"RESTORE_INSTALLED_SHA",sha:OLD}},
    postOperation:"core-status",
    postSourceBranch:"codex/employment-1y-reader-r1",postSourceSha:POST,
  };
  const bytes=Buffer.from(JSON.stringify(manifest)+"\n");
  const issue={
    schema:MAINTENANCE_ISSUE_SCHEMA,
    requestId:"pc-update-12345678-1234-4234-9234-1234567890ab",
    chatId:"chat-12345678-1234-4234-9234-1234567890ab",
    operation:"controller-update",controlRepository:CONTROL_REPOSITORY,
    targetControllerSha:NEXT,approvalManifestSha256:digest(bytes),
  };
  const context={actor:CONTROL_ACTOR,allowedActors:[CONTROL_ACTOR],
    controlRepository:CONTROL_REPOSITORY,installedSha:OLD,approvedTargets:[NEXT]};
  return {manifest,bytes,issue,context};
}
const repin=(f)=>{f.bytes=Buffer.from(JSON.stringify(f.manifest)+"\n");f.issue.approvalManifestSha256=digest(f.bytes);return f;};
const admitted=f=>validateUpdateRequest(f.issue,f.bytes,f.context);

test('client constructor generates distinct valid IDs and exact manifest pin without installing',()=>{
 const f=fixture(),a=prepareControllerUpdateRequest(f.bytes,{installedSha:OLD}),
  b=prepareControllerUpdateRequest(f.bytes,{installedSha:OLD,chatId:a.chatId});
 assert.notEqual(a.requestId,b.requestId);assert.equal(a.chatId,b.chatId);
 assert.equal(a.approvalManifestSha256,digest(f.bytes));
 assert.equal(validateUpdateRequest(a,f.bytes,f.context).manifest.targetSha,NEXT);
 assert.throws(()=>prepareControllerUpdateRequest(f.bytes,{installedSha:NEXT}),/INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>prepareControllerUpdateRequest(f.bytes,{installedSha:OLD,chatId:'chat-../bad'}),/CHAT_ID_INVALID/);
});

test('safe existing conversation labels are accepted without weakening actor or approval validation',()=>{
 const f=fixture();f.issue.chatId='chat-controller-w04-wal-safe-20261119-r24';
 assert.equal(admitted(f).request.chatId,f.issue.chatId);
 const q=prepareControllerUpdateRequest(f.bytes,{installedSha:OLD,chatId:f.issue.chatId});
 assert.equal(q.chatId,f.issue.chatId);
 assert.throws(()=>validateUpdateRequest(q,f.bytes,{...f.context,actor:'another-user'}),/ACTOR_NOT_ALLOWED/);
 const original=f.issue.chatId;
 for(const x of ['chat-../bad','chat-a\nCODE: PASS','chat-'+('a'.repeat(76)),'https://example.org/x']){
  f.issue.chatId=x;assert.throws(()=>admitted(f),/CHAT_ID_INVALID/);
 }
 f.issue.chatId=original;f.manifest.approval.grade='A';repin(f);
 assert.throws(()=>admitted(f),/B_APPROVAL_REQUIRED/);
});

test('previous full-repo infrastructure gate blocks unrelated merged workflows, selective mode admits exact A-only installed diff',()=>{
  const changed=['.github/workflows/pc-er1-nov30-batch20.yml',
    '.github/workflows/pc-inflation-gas-refresh-approved-once.yml',
    'controller/market-calendar-er1-nov30-availability-readonly.mjs'];
  const allowFiles=[{path:changed[2],sha256:HASH_A}];
  assert.throws(()=>validateInfrastructureDelta(changed,null,()=>Buffer.alloc(0)),
    /UNAPPROVED_INFRA_CHANGE/);
  assert.equal(validateControllerOnlyInstallDelta(changed,allowFiles),true);
  // The allowFiles comparison is *not* relaxed for selected Controller bytes.
  assert.throws(()=>validateControllerOnlyInstallDelta(changed,[]),
    /ALLOWFILE_DIFF_MISMATCH/);
  assert.throws(()=>validateControllerOnlyInstallDelta([...changed,
    'controller/engine.mjs'],allowFiles),/ALLOWFILE_DIFF_MISMATCH/);
  assert.throws(()=>validateControllerOnlyInstallDelta([...changed,
    '.github/workflows/pc-job.yml'],allowFiles),
    /CONTROLLER_ONLY_LIVE_WORKFLOW_CHANGED/);
  assert.throws(()=>validateControllerOnlyInstallDelta(['../evil'],allowFiles),
    /CONTROLLER_ONLY_DIFF_INVALID/);
});

test('only exact colocated .test.mjs stays in Git/CI; updater stages deployment modules exclusively',()=>{
  const sourceOnly='controller/inflation-core-lock-observation-readonly.test.mjs';
  const paths=['config/operations.json','controller/common.mjs',
    'controller/engine.mjs','controller/entry.mjs','controller/operations.mjs',
    sourceOnly];
  assert.equal(isControllerSourceTestPath(sourceOnly),true);
  assert.equal(isControllerSourceTestPath('controller/engine.mjs'),false);
  assert.equal(isControllerSourceTestPath('controller/nested/other.test.mjs'),false);
  assert.equal(isControllerSourceTestPath('controller/engine.spec.mjs'),false);
  assert.deepEqual(deployableControllerTreePaths(paths),paths.slice(0,-1));
  assert.throws(()=>deployableControllerTreePaths([...paths,'controller/engine.spec.mjs']),
    /TARGET_TREE_PATH/);
  assert.throws(()=>deployableControllerTreePaths([...paths,'controller/nested/other.test.mjs']),
    /TARGET_TREE_PATH/);
  assert.throws(()=>deployableControllerTreePaths([...paths,sourceOnly]),
    /TARGET_TREE_PATH/);
  assert.throws(()=>deployableControllerTreePaths([sourceOnly]),
    /TARGET_TREE_PATH/);
  const installed=[{path:'config/operations.json',sha256:HASH_A},
    {path:'controller/operations.mjs',sha256:HASH_B}];
  assert.equal(validateControllerOnlyInstallDelta([...installed.map(f=>f.path),
    sourceOnly,'.github/workflows/other-source-only.yml'],installed),true);
  assert.throws(()=>validateControllerOnlyInstallDelta([...installed.map(f=>f.path),
    sourceOnly,'controller/unknown.mjs'],installed),/ALLOWFILE_DIFF_MISMATCH/);
  assert.throws(()=>validateControllerOnlyInstallDelta([...installed.map(f=>f.path),
    '.github/workflows/pc-job.yml'],installed),
    /CONTROLLER_ONLY_LIVE_WORKFLOW_CHANGED/);
  const updater=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
  assert.match(updater,/deployableControllerTreePaths\(listing\)/);
  assert.match(updater,/plannedFiles=deployed/);
  assert.doesNotMatch(updater,/plannedFiles=listing/);
});

test('scope-only Controller B manifest is explicit and rejects wrong grade, profile, or mixed infrastructure acceptance',()=>{
  const f=fixture();f.manifest.purpose='pc-controller-maintenance';
  f.manifest.approval.scope='PC_CONTROL_CONTROLLER_UPDATE';
  f.manifest.controllerOnlyInstall=true;repin(f);
  assert.equal(admitted(f).manifest.controllerOnlyInstall,true);
  for(const wrong of [false,'true',null]){
    const x=fixture();x.manifest.purpose='pc-controller-maintenance';
    x.manifest.approval.scope='PC_CONTROL_CONTROLLER_UPDATE';
    x.manifest.controllerOnlyInstall=wrong;repin(x);
    assert.throws(()=>admitted(x),/CONTROLLER_ONLY_INSTALL_SCOPE_INVALID/);
  }
  const heavy=fixture();heavy.manifest.controllerOnlyInstall=true;repin(heavy);
  assert.throws(()=>admitted(heavy),/CONTROLLER_ONLY_INSTALL_SCOPE_INVALID/);
  const both=fixture();both.manifest.purpose='pc-controller-maintenance';
  both.manifest.approval.scope='PC_CONTROL_CONTROLLER_UPDATE';
  both.manifest.controllerOnlyInstall=true;
  both.manifest.infrastructureEvidence={schema:'ZGMINI_NON_DEPLOYED_INFRA_ACK_V1',
    approvalRef:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/414',
    files:[{path:'.github/workflows/other.yml',sha256:HASH_A}]};repin(both);
  assert.throws(()=>admitted(both),/CONTROLLER_ONLY_INSTALL_SCOPE_INVALID/);
});

test('regular maintenance updater uses scoped gate without modifying backup, rollback or six Runner transitions',()=>{
  const updater=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
  assert.match(updater,/manifest\.controllerOnlyInstall===true[\s\S]*?validateControllerOnlyInstallDelta\(diff,manifest\.allowFiles\)/);
  assert.match(updater,/else\s+validateInfrastructureDelta\(diff,manifest\.infrastructureEvidence/);
  assert.match(updater,/VERSIONED_SNAPSHOT/);
  assert.match(updater,/waitForReconnect/);
  assert.match(updater,/protectedSnapshot\(\)/);
});

test('B-readonly manifest cannot change existing operations, six seats or protected settings',()=>{
  const previous={schema:'ZGMINI_PC_OPERATIONS_V1',controlRepository:CONTROL_REPOSITORY,
    sourceRepository:'ansqhd5774-Choi/zgmini',allowedActors:[CONTROL_ACTOR],
    seats:6,mutationsEnabled:false,maxHeavyJobs:1,artifactUploadEnabled:false,
    operations:{'core-status':{grade:'A',timeoutSeconds:60,resource:'light'}}};
  const next=clone(previous);next.operations['fear-greed-archive-status']={grade:'A',timeoutSeconds:60,resource:'light'};
  assert.equal(validateControllerConfigTransition(previous,next),true);
  const fewer=clone(next);fewer.seats=1;
  assert.throws(()=>validateControllerConfigTransition(previous,fewer),/CONTROLLER_CONFIG_WRITE_OR_SEATS_CHANGED/);
  const writing=clone(next);writing.mutationsEnabled=true;
  assert.throws(()=>validateControllerConfigTransition(previous,writing),/CONTROLLER_CONFIG_WRITE_OR_SEATS_CHANGED/);
  const elevated=clone(next);elevated.operations['core-status'].grade='B';
  assert.throws(()=>validateControllerConfigTransition(previous,elevated),/CONTROLLER_EXISTING_OPERATION_CHANGED/);
  const provider=clone(next);provider.sourceRepository='unapproved/provider';
  assert.throws(()=>validateControllerConfigTransition(previous,provider),/CONTROLLER_CONFIG_PROTECTED_POLICY_CHANGED/);
  const newElevated=clone(next);newElevated.operations['fear-greed-archive-status'].grade='B';
  assert.throws(()=>validateControllerConfigTransition(previous,newElevated),/CONTROLLER_NEW_OPERATION_NOT_READONLY_A/);
});

test("valid 7-key Issue, pinned B-grade manifest and normalized path order",()=>{
  const f=fixture(),v=admitted(f);
  assert.equal(Object.keys(v.request).length,7);
  assert.equal(v.manifest.targetSha,NEXT);
  assert.deepEqual(v.manifest.allowFiles.map(x=>x.path),[
    "controller/fear-greed-archive-readonly.mjs","controller/operations.mjs",
  ]);
  assert.equal(v.manifest.postSourceSha,POST);
  assert.match(requestFingerprint(v),/^[a-f0-9]{64}$/);
});

test("new readonly module names use the exact approved manifest without maintainer filename edits",()=>{
 const f=fixture();f.manifest.allowFiles.push({path:'controller/employment-r6-readonly.mjs',sha256:'d'.repeat(64)});f.manifest.checks.manifestSha256=manifestFingerprint(f.manifest.allowFiles).sha256;repin(f);
 const accepted=admitted(f);assert.ok(accepted.manifest.allowFiles.some(x=>x.path==='controller/employment-r6-readonly.mjs'));
 const changed=fixture();changed.manifest.allowFiles.push({path:'controller/new-diagnostic.mjs',sha256:'d'.repeat(64)});changed.manifest.checks.manifestSha256=manifestFingerprint(changed.manifest.allowFiles).sha256;repin(changed);
 changed.manifest.allowFiles.at(-1).sha256='e'.repeat(64);
 changed.bytes=Buffer.from(JSON.stringify(changed.manifest)+'\n');
 assert.throws(()=>admitted(changed),/MANIFEST|CHECKS|HASH/);
});

test("Issue fails closed on extra or missing keys",()=>{
  const f=fixture();f.issue.command="cmd /c whoami";
  assert.throws(()=>validateMaintenanceRequest(f.issue,f.context),/UPDATE_ISSUE_FIELDS_INVALID/);
  delete f.issue.command;delete f.issue.chatId;
  assert.throws(()=>validateMaintenanceRequest(f.issue,f.context),/UPDATE_ISSUE_FIELDS_INVALID/);
});

test("only fixed control repository and independently authenticated actor are allowed",()=>{
  const f=fixture();
  assert.throws(()=>validateMaintenanceRequest(f.issue,{...f.context,actor:"not-authorized"}),/UPDATE_ACTOR_NOT_ALLOWED/);
  assert.throws(()=>validateMaintenanceRequest(f.issue,{...f.context,allowedActors:[]}),/UPDATE_ACTOR_NOT_ALLOWED/);
  f.issue.controlRepository="attacker/repo";
  assert.throws(()=>validateMaintenanceRequest(f.issue,f.context),/UPDATE_CONTROL_REPOSITORY_NOT_ALLOWED/);
});

test("malformed IDs, operation and source SHA reject before execution",()=>{
  for(const [field,value,code] of [
    ["requestId","pc-update-../../abc","UPDATE_REQUEST_ID_INVALID"],
    ["chatId","https://example.org/x","UPDATE_CHAT_ID_INVALID"],
    ["operation","cmd.exe","UPDATE_OPERATION_NOT_ALLOWED"],
    ["targetControllerSha","main","UPDATE_TARGET_SHA_INVALID"],
  ]){
    const f=fixture();f.issue[field]=value;
    assert.throws(()=>validateMaintenanceRequest(f.issue,f.context),new RegExp(code));
  }
});

test("manifest pin binds exact bytes, not just parsed JSON",()=>{
  const f=fixture();f.bytes=Buffer.from(JSON.stringify(f.manifest));
  assert.throws(()=>admitted(f),/UPDATE_MANIFEST_PIN_MISMATCH/);
  const x=fixture();x.manifest.purpose="pc-controller-maintenance";
  x.bytes=Buffer.from(JSON.stringify(x.manifest)+"\n");
  assert.throws(()=>admitted(x),/UPDATE_MANIFEST_PIN_MISMATCH/);
});

test("manifest must be raw UTF-8 bytes and bounded, no massive payload",()=>{
  const f=fixture();
  assert.throws(()=>validateUpdateRequest(f.issue,f.manifest,f.context),/UPDATE_MANIFEST_BYTES_REQUIRED/);
  const huge=Buffer.alloc(32769,"x");f.issue.approvalManifestSha256=digest(huge);
  assert.throws(()=>validateUpdateRequest(f.issue,huge,f.context),/UPDATE_MANIFEST_TOO_LARGE/);
});

test("unapproved target, actual installed source drift and target=installed block",()=>{
  const f=fixture();
  assert.throws(()=>admitted({...f,context:{...f.context,approvedTargets:[]}}),/UPDATE_TARGET_NOT_APPROVED/);
  assert.throws(()=>admitted({...f,context:{...f.context,installedSha:HASH_A.slice(0,40)}}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
  f.manifest.targetSha=OLD;f.issue.targetControllerSha=OLD;repin(f);
  assert.throws(()=>admitted(f),/UPDATE_TARGET_EQUALS_INSTALLED/);
});

test("unapproved file paths, URL, traversal, ADS and duplicates all block",()=>{
  for(const path of ["../controller/engine.mjs","C:\\Windows\\cmd.exe",
    "controller/engine.mjs:stream","https://example.org/script.js",
    ".github/workflows/pc-job.yml","controller/ENGINE.mjs"]){
    const f=fixture();f.manifest.allowFiles[0].path=path;repin(f);
    assert.throws(()=>admitted(f),/UPDATE_FILE_PATH_NOT_ALLOWED/);
  }
  const f=fixture();f.manifest.allowFiles[1].path=f.manifest.allowFiles[0].path;repin(f);
  assert.throws(()=>admitted(f),/UPDATE_FILE_PATH_NOT_ALLOWED/);
});

test("manifest file digests and exact nested keys are mandatory",()=>{
  const f=fixture();f.manifest.allowFiles[0].sha256="b".repeat(63);repin(f);
  assert.throws(()=>admitted(f),/UPDATE_FILE_SHA256_INVALID/);
  const x=fixture();x.manifest.allowFiles[0].args=["--publish"];repin(x);
  assert.throws(()=>admitted(x),/UPDATE_FILE_ENTRY_INVALID/);
});

test("manifest purpose, B approval reference and scope must all match",()=>{
  const changes=[
    ["purpose","https://evil.example/",/UPDATE_PURPOSE_NOT_ALLOWED/],
    ["approval.grade","A",/UPDATE_B_APPROVAL_REQUIRED/],
    ["approval.ref","https://example.com",/UPDATE_B_APPROVAL_REQUIRED/],
    ["approval.scope","PC_CONTROL_CONTROLLER_UPDATE",/UPDATE_B_APPROVAL_REQUIRED/],
  ];
  for(const [key,value,regex] of changes){
    const f=fixture();const keys=key.split(".");if(keys.length===1)f.manifest[key]=value;
    else f.manifest[keys[0]][keys[1]]=value;
    repin(f);assert.throws(()=>admitted(f),regex);
  }
});

test("target tests must be PASS for exact SHA and exact file manifest",()=>{
  for(const [key,value] of [["status","FAIL"],["targetSha",OLD],["manifestSha256",HASH_C]]){
    const f=fixture();f.manifest.checks[key]=value;repin(f);
    assert.throws(()=>admitted(f),/UPDATE_TARGET_CHECKS_NOT_VERIFIED/);
  }
});

test("backup and rollback point to currently installed immutable SHA",()=>{
  for(const change of [
    m=>m.backup.strategy="IN_PLACE_DELETE",
    m=>m.backup.rollback.kind="RUN_CMD",
    m=>m.backup.rollback.sha=NEXT,
  ]){
    const f=fixture();change(f.manifest);repin(f);
    assert.throws(()=>admitted(f),/UPDATE_ROLLBACK_NOT_VERIFIED/);
  }
});

test("postcheck commands and source references reject arbitrary executables/URLs",()=>{
  const f=fixture();f.manifest.postOperation="powershell -c Invoke-WebRequest";repin(f);
  assert.throws(()=>admitted(f),/UPDATE_POST_OPERATION_NOT_ALLOWED/);
  const x=fixture();x.manifest.postSourceBranch="https://evil.example";repin(x);
  assert.throws(()=>admitted(x),/UPDATE_POST_SOURCE_BRANCH_INVALID/);
  const y=fixture();y.manifest.postSourceSha="HEAD";repin(y);
  assert.throws(()=>admitted(y),/UPDATE_POST_SOURCE_SHA_INVALID/);
});

test("dedupe reuses exact request without executing, rejects payload drift",()=>{
  const v=admitted(fixture());
  const ledger=newUpdateLedger(v);
  assert.equal(dedupeUpdateRequest(null,v).status,"NEW");
  assert.equal(dedupeUpdateRequest(ledger,v).status,"DUPLICATE_REUSED_NO_EXECUTION");
  const f=fixture();f.manifest.postSourceSha=HASH_A.slice(0,40);repin(f);
  // New signed manifest with same requestId must never reuse old ledger entry.
  const changed=admitted(f);
  assert.throws(()=>dedupeUpdateRequest(ledger,changed),/DUPLICATE_REQUEST_PAYLOAD_CHANGED/);
});

test("complete evidence-backed update transition commits only after postcheck",()=>{
  const validated=admitted(fixture());
  let state=newUpdateLedger(validated);
  state=transitionLedger(state,"PREFLIGHT_PASS",{
    installedSha:OLD,manifestSha256:validated.manifest.checks.manifestSha256,
    protectedBeforeSha256:HASH_A,
  });
  assert.equal(state.phase,"PREFLIGHT_VERIFIED");
  state=transitionLedger(state,"BACKUP_PASS",{backupSha256:HASH_B,rollbackSha:OLD});
  assert.equal(state.phase,"BACKUP_VERIFIED");
  state=transitionLedger(state,"APPLY_PASS",{actualInstalledSha:NEXT,protectedAfterSha256:HASH_A});
  assert.equal(state.phase,"APPLIED");
  state=transitionLedger(state,"POSTCHECK_PASS",{
    status:"PASS",actualExecutionSha:NEXT,postOperation:"core-status",requestedSourceSha:POST,
  });
  assert.equal(state.phase,"POSTCHECK_VERIFIED");
  state=transitionLedger(state,"COMMIT",{});
  assert.equal(state.phase,"COMMITTED");
  assert.equal(state.lastPass,"UPDATE_COMMITTED");
});

test("an independent public diagnostic SHA cannot be confused with the controller SHA",()=>{
  const validated=admitted(fixture());
  let state=newUpdateLedger(validated);
  state=transitionLedger(state,"PREFLIGHT_PASS",{
    installedSha:OLD,manifestSha256:validated.manifest.checks.manifestSha256,
    protectedBeforeSha256:HASH_A,
  });
  state=transitionLedger(state,"BACKUP_PASS",{backupSha256:HASH_B,rollbackSha:OLD});
  state=transitionLedger(state,"APPLY_PASS",{actualInstalledSha:NEXT,protectedAfterSha256:HASH_A});
  const result=transitionLedger(state,"POSTCHECK_PASS",{
    status:"PASS",actualExecutionSha:NEXT,postOperation:"core-status",requestedSourceSha:OLD,
  });
  assert.equal(result.phase,"ROLLBACK_REQUIRED");
  assert.equal(result.firstFail,"UPDATE_POSTCHECK_FAILED");
});

test("attempted early commit and out-of-order state changes are blocked",()=>{
  const state=newUpdateLedger(admitted(fixture()));
  assert.throws(()=>transitionLedger(state,"COMMIT",{}),/UPDATE_TRANSITION_NOT_ALLOWED/);
  assert.throws(()=>transitionLedger(state,"APPLY_PASS",{actualInstalledSha:NEXT,protectedAfterSha256:HASH_A}),
    /UPDATE_TRANSITION_NOT_ALLOWED/);
  assert.throws(()=>transitionLedger(state,"PREFLIGHT_PASS",{installedSha:NEXT,manifestSha256:HASH_A,protectedBeforeSha256:HASH_A}),
    /UPDATE_PREFLIGHT_SOURCE_DRIFT/);
});

test("postinstall protected-state drift demands rollback; verified restore ends safely",()=>{
  const v=admitted(fixture());let s=newUpdateLedger(v);
  s=transitionLedger(s,"PREFLIGHT_PASS",{installedSha:OLD,manifestSha256:v.manifest.checks.manifestSha256,protectedBeforeSha256:HASH_A});
  s=transitionLedger(s,"BACKUP_PASS",{backupSha256:HASH_B,rollbackSha:OLD});
  s=transitionLedger(s,"APPLY_PASS",{actualInstalledSha:NEXT,protectedAfterSha256:HASH_B});
  assert.equal(s.phase,"ROLLBACK_REQUIRED");
  assert.equal(s.firstFail,"UPDATE_PROTECTED_STATE_DRIFT");
  assert.throws(()=>transitionLedger(s,"ROLLBACK_PASS",{restoredSha:NEXT,protectedAfterRollbackSha256:HASH_A}),
    /UPDATE_ROLLBACK_READBACK_FAILED/);
  s=transitionLedger(s,"ROLLBACK_PASS",{restoredSha:OLD,protectedAfterRollbackSha256:HASH_A});
  assert.equal(s.phase,"ROLLED_BACK");
  assert.equal(s.lastPass,"ROLLBACK_VERIFIED");
});

test("failure before installation is BLOCKED, postinstall failure requires rollback",()=>{
  const v=admitted(fixture());
  const early=transitionLedger(newUpdateLedger(v),"FAIL",{code:"RESOURCE_WAIT_MEMORY"});
  assert.equal(early.phase,"BLOCKED");
  assert.equal(early.firstFail,"RESOURCE_WAIT_MEMORY");
  assert.throws(()=>transitionLedger(early,"PREFLIGHT_PASS",{}),/UPDATE_TRANSITION_NOT_ALLOWED/);
  let s=newUpdateLedger(v);
  s=transitionLedger(s,"PREFLIGHT_PASS",{installedSha:OLD,manifestSha256:v.manifest.checks.manifestSha256,protectedBeforeSha256:HASH_A});
  s=transitionLedger(s,"BACKUP_PASS",{backupSha256:HASH_B,rollbackSha:OLD});
  s=transitionLedger(s,"APPLY_PASS",{actualInstalledSha:NEXT,protectedAfterSha256:HASH_A});
  s=transitionLedger(s,"FAIL",{code:"POSTCHECK_TIMEOUT"});
  assert.equal(s.phase,"ROLLBACK_REQUIRED");
});

test("arbitrary uppercase exception text cannot leak through the ledger failure code",()=>{
  const state=newUpdateLedger(admitted(fixture()));
  const bad=transitionLedger(state,"FAIL",{code:"PRIVATE_CUSTOMER_SECRET_TOKEN"});
  assert.equal(bad.phase,"BLOCKED");
  assert.equal(bad.firstFail,"UPDATE_FAILURE_UNCLASSIFIED");
  assert.doesNotMatch(JSON.stringify(bad),/PRIVATE_CUSTOMER_SECRET_TOKEN/);
});

test("legacy R6 manifest keeps its narrow scope while default remains light",()=>{
  const previous={schema:'ZGMINI_PC_OPERATIONS_V1',controlRepository:CONTROL_REPOSITORY,
    sourceRepository:'ansqhd5774-Choi/zgmini',allowedActors:[CONTROL_ACTOR],
    seats:6,mutationsEnabled:false,maxHeavyJobs:1,
    minimumFreeMiBForHeavy:1536,artifactUploadEnabled:false,
    operations:{'core-status':{grade:'A',timeoutSeconds:60,resource:'light'}}};
  const next=clone(previous);
  const name='employment-r6-candidate-stage-readonly';
  const policy={grade:'A',resource:'heavy',timeoutSeconds:240,minimumFreeMiB:1536};
  next.operations[name]=policy;
  const legacy=controllerAdmissionForPurpose('employment-r6-readonly-adapter');
  assert.equal(validateControllerConfigTransition(previous,next,legacy),true);
  assert.throws(()=>validateControllerConfigTransition(previous,next),/CONTROLLER_NEW_OPERATION_NOT_READONLY_A/);
  const cases=[
    ['other name',other=>{other.operations['employment-r6-candidate-stage']={...policy};delete other.operations[name];}],
    ['wrong grade',other=>{other.operations[name].grade='B';}],
    ['light downgrade',other=>{other.operations[name].resource='light';}],
    ['longer timeout',other=>{other.operations[name].timeoutSeconds=241;}],
    ['shorter timeout',other=>{other.operations[name].timeoutSeconds=239;}],
    ['lower memory gate',other=>{other.operations[name].minimumFreeMiB=1024;}],
    ['higher memory gate',other=>{other.operations[name].minimumFreeMiB=2048;}],
    ['missing memory gate',other=>{delete other.operations[name].minimumFreeMiB;}],
    ['extra executable argument',other=>{other.operations[name].command='anything';}],
    ['second unapproved heavy operation',other=>{other.operations['other-readonly']={...policy};}],
  ];
  for(const [label,change] of cases){
    const altered=clone(next);change(altered);
    assert.throws(()=>validateControllerConfigTransition(previous,altered,legacy),
      /CONTROLLER_NEW_OPERATION_NOT_READONLY_A/,label);
  }
  const writes=clone(next);writes.mutationsEnabled=true;
  assert.throws(()=>validateControllerConfigTransition(previous,writes),
    /CONTROLLER_CONFIG_WRITE_OR_SEATS_CHANGED/);
  const bypass=clone(next);bypass.maxHeavyJobs=2;
  assert.throws(()=>validateControllerConfigTransition(previous,bypass),
    /CONTROLLER_CONFIG_PROTECTED_POLICY_CHANGED/);
  const mutateExisting=clone(next);mutateExisting.operations['core-status'].timeoutSeconds=90;
  assert.throws(()=>validateControllerConfigTransition(previous,mutateExisting),
    /CONTROLLER_EXISTING_OPERATION_CHANGED/);
});

test('common signed heavy purpose accepts multiple feature names without changing shared safety policy',()=>{
 const previous={seats:6,mutationsEnabled:false,maxHeavyJobs:1,minimumFreeMiBForHeavy:1536,
  operations:{'core-status':{grade:'A',resource:'light',timeoutSeconds:60}}};
 const next=clone(previous);
 for(const name of ['theme-history-readonly','market-snapshot-audit','employment-r6-candidate-stage-readonly'])
  next.operations[name]={grade:'A',resource:'heavy',timeoutSeconds:240,minimumFreeMiB:1536};
 const profile=controllerAdmissionForPurpose('pc-controller-heavy-readonly');
 assert.equal(validateControllerConfigTransition(previous,next,profile),true);
 for(const patch of [{grade:'B'},{timeoutSeconds:241},{minimumFreeMiB:1024},{command:'shell'}]){
  const bad=clone(next);Object.assign(bad.operations['theme-history-readonly'],patch);
  assert.throws(()=>validateControllerConfigTransition(previous,bad,profile),/CONTROLLER_NEW_OPERATION_NOT_READONLY_A/);
 }
 const bad=clone(next);bad.maxHeavyJobs=2;
 assert.throws(()=>validateControllerConfigTransition(previous,bad,profile),/CONTROLLER_CONFIG_PROTECTED_POLICY_CHANGED/);
});
test('common heavy purpose requires its exact B scope and raw manifest pin',()=>{
 const f=fixture();f.manifest.purpose='pc-controller-heavy-readonly';
 f.manifest.approval.scope='PC_CONTROL_HEAVY_READONLY_UPDATE';repin(f);
 assert.equal(admitted(f).manifest.purpose,'pc-controller-heavy-readonly');
 f.manifest.approval.scope='PC_CONTROL_CONTROLLER_UPDATE';repin(f);
 assert.throws(()=>admitted(f),/UPDATE_B_APPROVAL_REQUIRED/);
});

test('moderate readonly is a distinct B approval scope, not a generic resource bypass',()=>{
 const f=fixture();f.manifest.purpose='pc-controller-moderate-readonly';
 f.manifest.approval.scope='PC_CONTROL_MODERATE_READONLY_UPDATE';repin(f);
 assert.equal(admitted(f).manifest.purpose,'pc-controller-moderate-readonly');
 const wrong=fixture();wrong.manifest.purpose='pc-controller-moderate-readonly';
 wrong.manifest.approval.scope='PC_CONTROL_HEAVY_READONLY_UPDATE';repin(wrong);
 assert.throws(()=>admitted(wrong),/UPDATE_B_APPROVAL_REQUIRED/);
 const post=fixture();post.manifest.postOperation='source-audit';repin(post);
 assert.equal(admitted(post).manifest.postOperation,'source-audit');
});



test('postcheck recovery retains approved Writer config CAS while all other protection remains fixed',()=>{
 const historic={files:{'config.json':'a'.repeat(64),'quota-runner.cmd':'b'.repeat(64),
  'run-local.cmd':'c'.repeat(64)},tasks:{'ZGMINI-PC-Local-Core':'core',
  'ZGMINI-PC-Local-Korea':'korea','ZGMINI-PC-Iran-Progress-R13':'retired'}};
 const current=clone(historic);
 current.files['config.json']='d'.repeat(64);
 const preserved=selectPreservedRecoveryProtection(historic,current,
  {approvedCurrentWriterConfigSha256:'d'.repeat(64)});
 assert.equal(preserved.allowed,true);
 assert.equal(preserved.code,'RECOVERY_CURRENT_WRITER_CONFIG_PRESERVED');
 assert.equal(preserved.preservedWriterConfig,true);
 assert.deepEqual(preserved.baseline,current);
 assert.equal(historic.files['config.json'],'a'.repeat(64));
 for(const pin of [null,'e'.repeat(64),'d'.repeat(63),'INVALID']){
  assert.equal(selectPreservedRecoveryProtection(historic,current,
   {approvedCurrentWriterConfigSha256:pin}).allowed,false);
 }
 const taskDrift=clone(current);taskDrift.tasks['ZGMINI-PC-Local-Core']='modified';
 assert.equal(selectPreservedRecoveryProtection(historic,taskDrift,
  {approvedCurrentWriterConfigSha256:'d'.repeat(64)}).code,
  'RECOVERY_OTHER_PROTECTED_STATE_DRIFT');
 const unrelated=clone(current);unrelated.files['quota-runner.cmd']='x'.repeat(64);
 assert.equal(selectPreservedRecoveryProtection(historic,unrelated,
  {approvedCurrentWriterConfigSha256:'d'.repeat(64)}).allowed,false);
 const missing=clone(current);delete missing.files['config.json'];
 assert.equal(selectPreservedRecoveryProtection(historic,missing,
  {approvedCurrentWriterConfigSha256:'d'.repeat(64)}).allowed,false);
 assert.equal(selectPreservedRecoveryProtection(historic,current,
  {approvedCurrentWriterConfigSha256:'d'.repeat(64)}).baseline,current);
 const unchanged=selectPreservedRecoveryProtection(historic,clone(historic));
 assert.equal(unchanged.allowed,true);
 assert.equal(unchanged.preservedWriterConfig,false);
 // A pinned recovery must not silently bypass its approved CAS when a Writer
 // configuration changes back to the historic value.
 assert.equal(selectPreservedRecoveryProtection(historic,clone(historic),
  {approvedCurrentWriterConfigSha256:'d'.repeat(64)}).code,
  'RECOVERY_WRITER_CONFIG_CAS_NOT_VERIFIED');
 assert.equal(selectPreservedRecoveryProtection(historic,clone(historic),
  {approvedCurrentWriterConfigSha256:'a'.repeat(64)}).allowed,true);
 assert.equal(selectPreservedRecoveryProtection({files:null,tasks:{}},current).allowed,false);
});

test('independent recovery protection CAS stays strict at pre-pause and pre-switch',()=>{
 const pinned={files:{'config.json':'a'.repeat(64),'run-local.cmd':'b'.repeat(64)},
  tasks:{'ZGMINI-PC-Local-Core':'c'.repeat(64),'ZGMINI-PC-Local-Korea':'d'.repeat(64)}};
 const exact=clone(pinned);
 assert.equal(recoveryProtectedSnapshotStillPinned(pinned,exact),true);
 assert.equal(recoveryProtectedSnapshotStillPinned(pinned,{...pinned,
  files:{...pinned.files,'config.json':'e'.repeat(64)}}),false);
 assert.equal(recoveryProtectedSnapshotStillPinned(pinned,{...pinned,
  tasks:{...pinned.tasks,'ZGMINI-PC-Local-Korea':'e'.repeat(64)}}),false);
 assert.equal(recoveryProtectedSnapshotStillPinned(pinned,{...pinned,
  files:{...pinned.files,unexpected:'e'.repeat(64)}}),false);
 for(const bad of [null,undefined,[],{}, {files:null,tasks:{}},
   {files:{},tasks:null}]){
  assert.equal(recoveryProtectedSnapshotStillPinned(pinned,bad),false);
  assert.equal(recoveryProtectedSnapshotStillPinned(bad,pinned),false);
 }
 // A successful snapshot comparison cannot mutate the frozen original.
 assert.deepEqual(exact,pinned);
});

test('#3409 maintainer handoff V2 pins only existing-approved three-file delta',async()=>{
 const {requireHandoffApproval,approvedRuntimeChanges,handoffFilePlan,nextRuntimeFiles}=
  await import('../tools/handoff-maintenance.mjs');
 const target='9a0378ffb96aa9f1403f74c189d3c39b30e4604e';
 const before='e34a20062e3ef3b77c78af0b4881c15609b36eb1';
 const root='../approvals/maintenance-handoffs/';
 const read=name=>JSON.parse(fs.readFileSync(new URL(root+name+'.json',import.meta.url),'utf8'));
 const old=read(before),next=read(target);
 assert.equal(old.targetSha,before);
 assert.equal(next.schema,'ZGMINI_MAINTENANCE_HANDOFF_V2');
 assert.equal(next.transition,'SEVEN_TO_SEVEN');
 assert.equal(next.installedSha,before);
 assert.equal(next.targetSha,target);
 assert.equal(next.approved,true);
 assert.equal(next.scope,'COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE');
 assert.equal(next.checks.windowsHandoffExecuted,false);
 assert.equal(requireHandoffApproval(next,target,before),'SEVEN_TO_SEVEN');
 assert.deepEqual(Object.keys(next.files),Object.keys(old.files));
 for(const hash of Object.values(next.files))assert.match(hash,/^[a-f0-9]{64}$/);
 const changed=['tools/maintenance-contract.mjs','tools/maintenance-agent.mjs','tools/update.mjs'];
 const installedRuntime=Object.fromEntries(nextRuntimeFiles.map(path=>[path,old.files[path]]));
 assert.equal(Object.keys(installedRuntime).length,7);
 assert.deepEqual(approvedRuntimeChanges('SEVEN_TO_SEVEN',installedRuntime,next.files),changed);
 assert.deepEqual(handoffFilePlan('SEVEN_TO_SEVEN',installedRuntime,next.files).writes,changed);
 assert.deepEqual(next.runtimeChangedFiles,changed);
 assert.throws(()=>requireHandoffApproval(next,target,'a'.repeat(40)),/HANDOFF_APPROVAL_REQUIRED/);
 assert.throws(()=>requireHandoffApproval({...next,approved:false},target,before),
  /HANDOFF_APPROVAL_REQUIRED/);
 assert.throws(()=>requireHandoffApproval(next,before,before),/HANDOFF_APPROVAL_REQUIRED/);
});

test('independent handoff installs fixed CI workload pin only when explicitly approved',async()=>{
 const {approvedHandoffCiPolicy}=await import('../tools/handoff-maintenance.mjs');
 const before={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha:'a'.repeat(40),startupSha256:'d'.repeat(64),
  files:Object.fromEntries(['a','b','c','d','e','f','g'].map(x=>['tools/'+x+'.mjs','e'.repeat(64)]))};
 const next={...before,sourceSha:'b'.repeat(40)};
 const policy={schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V1',enabled:true,workflowId:42,
  workflowBlobSha:'c'.repeat(40),workflowPath:'.github/workflows/ci-approval-controller-b.yml'};
 const approval={schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SEVEN_TO_SEVEN',
  installedSha:before.sourceSha,targetSha:next.sourceSha,approved:true,ciControllerBPolicy:policy};
 // Without an explicit policy field, an ordinary handoff cannot enable CI.
 const ordinary=structuredClone(approval);delete ordinary.ciControllerBPolicy;
 assert.equal(approvedHandoffCiPolicy(before,ordinary,next),undefined);
 const selected=approvedHandoffCiPolicy(before,approval,next);
 assert.deepEqual(selected,policy);
 assert.notEqual(selected,policy);
 for(const edit of [
  x=>x.approved=false,
  x=>x.installedSha='f'.repeat(40),
  x=>x.targetSha='f'.repeat(40),
  x=>x.transition='SIX_TO_SEVEN',
  x=>x.ciControllerBPolicy.workflowBlobSha='invalid',
  x=>x.ciControllerBPolicy.enabled=false
 ]){
  const bad=structuredClone(approval);edit(bad);
  assert.throws(()=>approvedHandoffCiPolicy(before,bad,next),/HANDOFF_CI_POLICY_/);
 }
 // A future approved handoff must preserve already installed policy unless
 // its own exact approved manifest explicitly changes that policy field.
 assert.deepEqual(approvedHandoffCiPolicy({...before,ciControllerBPolicy:policy},ordinary,next),policy);
});

test('optional CI policy approval is prevalidated before receiver stop or any file replacement',()=>{
 const source=fs.readFileSync(new URL('../tools/handoff-maintenance.mjs',import.meta.url),'utf8');
 const begin=source.indexOf('export async function main(');
 assert.ok(begin>=0);
 const body=source.slice(begin);
 const gate=body.indexOf('const approvedCiPolicy=approvedHandoffCiPolicy(');
 const stop=body.indexOf("fs.writeFileSync(root+'/STOP_REQUEST.json'");
 const backup=body.indexOf('fs.mkdirSync(backup,{recursive:true})');
 const replaced=body.indexOf('for(const rel of filePlan.writes)');
 const manifest=body.indexOf("fs.writeFileSync(root+'/MAINTENANCE_INSTALL.json'");
 assert.ok(gate>=0&&stop>=0&&backup>=0&&replaced>=0&&manifest>=0);
 assert.ok(gate<stop&&gate<backup&&gate<replaced&&gate<manifest);
 assert.equal(body.slice(replaced,manifest).includes('approvedHandoffCiPolicy('),false);
});
