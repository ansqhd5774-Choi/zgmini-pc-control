import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {main,summarize996NativeCliResult,verify996NativeSourcePackage}
 from '../tools/controller-996-native-cli.mjs';

const toolDir=path.resolve(new URL('../tools/',import.meta.url).pathname);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function sourceFixture(t){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 const files=fs.readdirSync(toolDir).filter(name=>
  /^controller-996-.*\.mjs$/.test(name)||
  name==='controller-996-native-source-lock-r1.json');
 for(const name of files)fs.copyFileSync(path.join(toolDir,name),
  path.join(folder,name));
 return {folder,lockSha:sha256(fs.readFileSync(path.join(folder,
  'controller-996-native-source-lock-r1.json')))};
}

const valid={
 schema:'ZGMINI_CONTROLLER_996_NATIVE_OPERATOR_V1',
 status:'C_NATIVE_RECOVERY_PHYSICALLY_VERIFIED',
 code:'ORIGINAL_JOBS_OWNER_REPLAN_SEPARATE',
 physicalPostcheckVerified:true,simulated:false,retryAuthorized:false,
 controllerInstalls:0,originalPcJobRetries:0,issuePosts:0,
 ownerReplanRequired:2,workflowPutAttempts:1,backlogCloseAttempts:1,
 originalLeaseArchiveAttempts:1,ownClaimArchiveAttempts:1,
 nonce:'DO_NOT_LEAK',token:'DO_NOT_LEAK',secret:'DO_NOT_LEAK',
};

test('original Windows C run requires exact no-argument non-runner environment',
 async()=>{
  assert.notEqual(process.platform,'win32');
  const blocked=await main([]);
  assert.equal(blocked.status,'C_CLI_BLOCKED_UNTOUCHED');
  assert.equal(blocked.code,'C_CLI_ORIGINAL_WINDOWS_REQUIRED');
  assert.equal(blocked.executionAuthorized,false);
  assert.equal(blocked.retryAuthorized,false);
  assert.match(blocked.next,/REVIEW_SOURCE/);
 });

test('unknown/extra CLI arguments are rejected before any original-PC access',
 async()=>{
  const blocked=await main(['--commit','synthetic']);
  assert.equal(blocked.status,'C_CLI_BLOCKED_UNTOUCHED');
  assert.equal(blocked.code,'C_CLI_ARGUMENTS_FORBIDDEN');
 });

test('successful production-shaped result is reduced to public bounded fields',()=>{
 const receipt=summarize996NativeCliResult(valid);
 assert.equal(receipt.status,'C_NATIVE_RECOVERY_PHYSICALLY_VERIFIED');
 assert.equal(receipt.ownerReplanRequired,2);
 assert.equal(receipt.workflowPutAttempts,1);
 assert.equal(receipt.retryAuthorized,false);
 assert.equal(receipt.executionAuthorized,false);
 const printed=JSON.stringify(receipt);
 for(const secret of ['nonce','token','secret','DO_NOT_LEAK'])
  assert.ok(!printed.includes(secret));
});

test('a fake success without independent postcheck cannot reach success status',()=>{
 assert.throws(()=>summarize996NativeCliResult({...valid,
  physicalPostcheckVerified:false}),/C_CLI_OPERATOR_SUCCESS_RECEIPT_UNVERIFIED/);
 assert.throws(()=>summarize996NativeCliResult({...valid,
  simulated:true}),/C_CLI_OPERATOR_SUCCESS_RECEIPT_UNVERIFIED/);
 assert.throws(()=>summarize996NativeCliResult({...valid,
  issuePosts:1}),/C_CLI_OPERATOR_SUCCESS_RECEIPT_UNVERIFIED/);
});

test('uncertain lease archival is preserved without fabricated zero-write proof',()=>{
 const receipt=summarize996NativeCliResult({
  schema:'ZGMINI_CONTROLLER_996_NATIVE_OPERATOR_V1',
  status:'STATE_UNKNOWN_CHECK_ARCHIVED_ORIGINAL_LEASE',
  code:'C_ORIGINAL_LEASE_ARCHIVE_READBACK_FAILED',
  failedStep:'ORIGINAL_LEASE_ARCHIVE_ONCE',
  workflowPutAttempts:1,backlogCloseAttempts:1,
  originalLeaseArchiveAttempts:1,ownClaimArchiveAttempts:0,
 });
 assert.equal(receipt.status,'STATE_UNKNOWN_CHECK_ARCHIVED_ORIGINAL_LEASE');
 assert.equal(receipt.failedStep,'ORIGINAL_LEASE_ARCHIVE_ONCE');
 assert.match(receipt.next,/READ_ONLY_INSPECT/);
 assert.equal(receipt.retryAuthorized,false);
 assert.ok(!Object.hasOwn(receipt,'operationalWrites'));
});

test('unrecognized result schema/status cannot be interpreted as completion',()=>{
 assert.throws(()=>summarize996NativeCliResult({status:valid.status}),
  /C_CLI_OPERATOR_RESULT_UNVERIFIED/);
 assert.throws(()=>summarize996NativeCliResult({...valid,
  status:'SIMULATED_NATIVE_OPERATOR_SEQUENCE'}),
  /C_CLI_OPERATOR_RESULT_UNVERIFIED/);
});

test('native CLI and CMD retain explicit fixed scope without active import',()=>{
 const cli=fs.readFileSync(new URL('../tools/controller-996-native-cli.mjs',
  import.meta.url),'utf8');
 const cmd=fs.readFileSync(new URL('../tools/RUN_996_NATIVE_C_ONCE.cmd',
  import.meta.url),'utf8');
 assert.ok(cli.includes('7cff08ec6b27410baf10d8dc7130edb57b2de8c4'));
 assert.ok(cli.includes('GITHUB_ACTIONS')&&cli.includes('RUNNER_NAME'));
 assert.ok(cli.includes('args.length===0'));
 assert.ok(cli.includes('process.stdin.isTTY===true'));
 assert.ok(cli.includes('create996NativeOperator().run({manifestCommitSha:COMMIT})'));
 assert.ok(cli.includes('await import('));
 assert.ok(!cli.includes("from './controller-996-native-operator.mjs'"));
 assert.ok(cmd.includes('E:\\ZGmini\\runtime\\node.exe'));
 assert.ok(cmd.includes('DO NOT RE-RUN'));
 assert.ok(!cli.includes('execFileSync('));
 assert.ok(!cli.includes('fs.renameSync('));
 assert.ok(!cli.includes('workflow_dispatch'));
 assert.ok(!cmd.includes('schtasks /Create'));
});

test('all 17 static dependencies and exact source closure precheck before import',t=>{
 const fixture=sourceFixture(t);
 const check=verify996NativeSourcePackage({folder:fixture.folder,
  expectedLockSha256:fixture.lockSha,testOnly:true});
 assert.equal(check.status,'C_CLI_SOURCE_PACKAGE_17_DEPS_VERIFIED');
 assert.equal(check.modulesVerified,17);
 assert.equal(check.executionAuthorized,false);
});

test('any single altered source file refuses import',t=>{
 const fixture=sourceFixture(t);
 const target=path.join(fixture.folder,'controller-996-native-postcheck.mjs');
 fs.appendFileSync(target,'\n// TAMPERED\n');
 assert.throws(()=>verify996NativeSourcePackage({folder:fixture.folder,
  expectedLockSha256:fixture.lockSha,testOnly:true}),
  /C_CLI_PACKAGE_SOURCE_SHA_DRIFT/);
});

test('missing or extra package module blocks before import',t=>{
 const fixture=sourceFixture(t);
 const target=path.join(fixture.folder,'controller-996-native-postcheck.mjs');
 fs.unlinkSync(target);
 assert.throws(()=>verify996NativeSourcePackage({folder:fixture.folder,
  expectedLockSha256:fixture.lockSha,testOnly:true}),
  /C_CLI_PACKAGE_EXTRA_OR_MISSING_MODULE/);
 fs.writeFileSync(target,'// planted unpinned module');
 assert.throws(()=>verify996NativeSourcePackage({folder:fixture.folder,
  expectedLockSha256:fixture.lockSha,testOnly:true}),
  /C_CLI_PACKAGE_SOURCE_SHA_DRIFT/);
 fs.writeFileSync(path.join(fixture.folder,'controller-996-unknown.mjs'),'// extra');
 assert.throws(()=>verify996NativeSourcePackage({folder:fixture.folder,
  expectedLockSha256:fixture.lockSha,testOnly:true}),
  /C_CLI_PACKAGE_EXTRA_OR_MISSING_MODULE/);
});

test('lock hash substitution and injected unlisted import both fail closed',t=>{
 const fixture=sourceFixture(t);
 const lockPath=path.join(fixture.folder,
  'controller-996-native-source-lock-r1.json');
 const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
 lock.files['controller-996-native-operator.mjs'].sha256='0'.repeat(64);
 fs.writeFileSync(lockPath,JSON.stringify(lock));
 assert.throws(()=>verify996NativeSourcePackage({folder:fixture.folder,
  expectedLockSha256:fixture.lockSha,testOnly:true}),
  /C_CLI_SOURCE_LOCK_SHA_DRIFT/);
 const alteredLockSha=sha256(fs.readFileSync(lockPath));
 assert.throws(()=>verify996NativeSourcePackage({folder:fixture.folder,
  expectedLockSha256:alteredLockSha,testOnly:true}),
  /C_CLI_PACKAGE_SOURCE_SHA_DRIFT/);
});

test('a re-hashed foreign relative import is still forbidden by closure policy',t=>{
 const fixture=sourceFixture(t);
 const target=path.join(fixture.folder,'controller-996-backlog-plan.mjs');
 fs.appendFileSync(target,"\nimport sideEffect from '../../unlisted.mjs';\n");
 const lockPath=path.join(fixture.folder,
  'controller-996-native-source-lock-r1.json');
 const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
 lock.files['controller-996-backlog-plan.mjs'].sha256=
  sha256(fs.readFileSync(target));
 fs.writeFileSync(lockPath,JSON.stringify(lock));
 assert.throws(()=>verify996NativeSourcePackage({folder:fixture.folder,
  expectedLockSha256:sha256(fs.readFileSync(lockPath)),testOnly:true}),
  /C_CLI_PACKAGE_IMPORT_NOT_ALLOWED/);
});

test('CMD pins CLI hash and CLI pins entire dependency lock hash',()=>{
 const cliBytes=fs.readFileSync(path.join(toolDir,
  'controller-996-native-cli.mjs'));
 const cli=cliBytes.toString('utf8');
 const cmd=fs.readFileSync(path.join(toolDir,
  'RUN_996_NATIVE_C_ONCE.cmd'),'utf8');
 const lockBytes=fs.readFileSync(path.join(toolDir,
  'controller-996-native-source-lock-r1.json'));
 assert.ok(cli.includes("const LOCK_SHA256='"+sha256(lockBytes)+"'"));
 assert.ok(cmd.includes('set "ZGMINI_996_CLI_EXPECTED_SHA256='+
  sha256(cliBytes)+'"'));
 assert.ok(cmd.includes('Get-FileHash -Algorithm SHA256'));
 assert.ok(cmd.includes('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'));
 assert.ok(cmd.includes('goto :blocked_cli_integrity'));
 assert.ok(cmd.includes('set "NODE_OPTIONS="'));
 assert.ok(cmd.includes('set "NODE_PATH="'));
});

test('CMD calls the fixed system hasher directly without nested FOR /F quoting',()=>{
 const cmd=fs.readFileSync(path.join(toolDir,
  'RUN_996_NATIVE_C_ONCE.cmd'),'utf8');
 assert.ok(!/\bfor\s+\/f\b/i.test(cmd),
  'a nested FOR /F command substitution broke on original Windows');
 assert.ok(!cmd.includes('usebackq'));
 assert.ok(cmd.includes('"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -Command "try {'));
 assert.ok(cmd.includes('if ($actual -ieq $env:ZGMINI_996_CLI_EXPECTED_SHA256) { exit 0 } else { exit 1 }'));
 assert.ok(cmd.includes('catch { exit 2 }'));
 assert.ok(cmd.includes('if errorlevel 1 goto :blocked_cli_integrity'));
 const hashLine=cmd.split(/\r?\n/).find(line=>line.startsWith('"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile'));
 assert.ok(hashLine?.endsWith('catch { exit 2 }"'));
 const hashIndex=cmd.indexOf(hashLine);
 assert.ok(hashIndex>0&&hashIndex<cmd.indexOf('"%ZGMINI_996_NODE%" "%ZGMINI_996_SCRIPT%"'),
  'the read-only hash comparison must occur before Node execution');
});

test('verifier rejects non-test paths, and production cannot use test-only env escape',()=>{
 assert.throws(()=>verify996NativeSourcePackage({folder:toolDir,
  testOnly:true}),/C_CLI_TEST_SOURCE_ROOT_REJECTED/);
 assert.throws(()=>verify996NativeSourcePackage(),
  /C_CLI_SOURCE_LOCATION_OR_ENVIRONMENT_UNVERIFIED/);
});
