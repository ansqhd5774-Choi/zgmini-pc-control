import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {run996NativeOwnerCOnce,require996OwnerArchiveReceipt} from '../tools/controller-996-c-native-owner-operator.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(dir,
  '../tools/controller-996-c-native-owner-operator.mjs'),'utf8');

test('outside original Windows, no consent or caller flag can cross first write',async()=>{
  assert.notEqual(process.platform,'win32');
  for(const args of [undefined,{},
    {manifestCommitSha:'a'.repeat(40)},
    {manifestCommitSha:'a'.repeat(40),testOnly:true,
      approved:true,executionAuthorized:true,
      root:'/tmp/zgmini-996-test-unauthorized'}]){
    const result=await run996NativeOwnerCOnce(args);
    assert.equal(result.status,'BLOCKED_BEFORE_C_WRITE');
    assert.equal(result.code,'C_996_OWNER_ORIGINAL_WINDOWS_ONLY');
    assert.equal(result.executionAuthorized,false);
    assert.equal(result.cleanupPerformed,false);
    assert.equal(result.originalRequestRetries,0);
    assert.equal(result.workflowPuts,0);
    assert.equal(result.backlogWrites,0);
    assert.equal(result.issuePosts,0);
  }
});

test('operator is only a conditional source candidate, not old C runner',()=>{
  const guard=source.indexOf("need(false,'C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED')");
  const importAt=source.indexOf("import('./controller-996-c-installed-gh-get-readonly.mjs')");
  assert.ok(guard>0&&importAt>guard,
    'unconditional review hold must run before any local dependency import');
  assert.match(source,/C_996_OWNER_MANIFEST_COMMIT_REQUIRED/);
  assert.match(source,/create996ContinuationConsentEvidenceReader/);
  assert.match(source,/checkSourceBundle\(manifest,manifestCommitSha\)/);
  assert.match(source,/sha\(operator\)===manifest\.operatorSha256/);
  assert.match(source,/sha\(packageBytes\)===manifest\.packageSha256/);
  assert.match(source,/sha\(lockBytes\)===manifest\.sourceLockSha256/);
  assert.match(source,/collect996OriginalCPrewriteReadOnly/);
  assert.match(source,/inspect996COriginalStageReadOnly/);
  assert.match(source,/SetFileInformationByHandle\(sourceHandle,3,/);
  assert.match(source,/pins\.Count==seen\.Count/);
  assert.match(source,/ComputeHash\(s\)/);
  assert.match(source,/OPEN_REPARSE_POINT/);
  assert.match(source,/value\["ownerNonce"\]==nonce/);
  assert.match(source,/Process\.GetProcessById\(pid\)/);
  assert.match(source,/SameSnapshot\(post,snap\)/);
  assert.match(source,/ownerMode:'DEAD_OLD'/);
  assert.match(source,/ownerMode:'DEAD_INSTALL'/);
  assert.match(source,/ownerMode:'LIVE_NEW',actorPid:process\.pid,nonce/);
  assert.match(source,/CREATE_AND_PRESERVE_FIXED_C_RESERVATION_VIA_ATOMIC_PROPOSAL_MOVE/);
  assert.match(source,/steps\[2\]\.name==='install'/);
  assert.match(source,/automaticRetry:false/);
  assert.doesNotMatch(source,/'-ExecutionPolicy'\s*,\s*'(?:Bypass|Unrestricted)'/i);
  assert.doesNotMatch(source,/\b(?:rmSync|unlinkSync|rmdirSync|renameSync)\s*\(/);
  assert.doesNotMatch(source,/export\s+(?:async\s+)?function\s+execute996COperator/);
});

test('native post-move receipt requires the exact pinned child inventory',()=>{
  const pins={'owner.json':'a'.repeat(64),
    'READY_TO_RELEASE_INSTALL.json':'b'.repeat(64)};
  const file=(last,sha)=>({identity:'00000001:000000000000000'+last,
    sha256:sha,size:31});
  const receipt={ok:true,sourceHandleBound:true,noReplace:true,
    parentIdentity:'00000001:0000000000000001',
    snapshot:{identity:'00000001:0000000000000002',files:{
      'owner.json':file('3',pins['owner.json']),
      'READY_TO_RELEASE_INSTALL.json':file('4',pins['READY_TO_RELEASE_INSTALL.json']),
    }}};
  assert.doesNotThrow(()=>require996OwnerArchiveReceipt(receipt,pins));
  const cases=[
    {...receipt,snapshot:null},
    {...receipt,parentIdentity:null},
    {...receipt,snapshot:{...receipt.snapshot,files:{
      'owner.json':receipt.snapshot.files['owner.json']}}},
    {...receipt,snapshot:{...receipt.snapshot,files:{...receipt.snapshot.files,
      'extra.json':file('5','c'.repeat(64))}}},
    {...receipt,snapshot:{...receipt.snapshot,files:{...receipt.snapshot.files,
      'owner.json':{...receipt.snapshot.files['owner.json'],sha256:'c'.repeat(64)}}}},
    {...receipt,snapshot:{...receipt.snapshot,files:{...receipt.snapshot.files,
      'owner.json':{...receipt.snapshot.files['owner.json'],size:0}}}},
    {...receipt,snapshot:{...receipt.snapshot,files:{...receipt.snapshot.files,
      'owner.json':{...receipt.snapshot.files['owner.json'],identity:
        receipt.snapshot.files['READY_TO_RELEASE_INSTALL.json'].identity}}}},
  ];
  for(const candidate of cases){
    assert.throws(()=>require996OwnerArchiveReceipt(candidate,pins),
      {code:'C_996_OWNER_NATIVE_POSTMOVE_RECEIPT_DRIFT'});
  }
  assert.throws(()=>require996OwnerArchiveReceipt(
    {...receipt,ok:false,code:'C996_NATIVE_LOCKED_MOVE_UNSUPPORTED'},pins),
    {code:'C996_NATIVE_LOCKED_MOVE_UNSUPPORTED'});
  assert.throws(()=>require996OwnerArchiveReceipt(receipt,{}),
    {code:'C_996_OWNER_NATIVE_POSTMOVE_RECEIPT_DRIFT'});
});
