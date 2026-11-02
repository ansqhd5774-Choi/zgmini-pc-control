import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {test} from "node:test";

import {
  CONTROL_ACTOR,CONTROL_REPOSITORY,MAINTENANCE_ISSUE_SCHEMA,UPDATE_SCHEMA,
  manifestFingerprint,validateMaintenanceRequest,validateUpdateRequest,
  validateControllerConfigTransition,
  requestFingerprint,dedupeUpdateRequest,newUpdateLedger,transitionLedger,
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
