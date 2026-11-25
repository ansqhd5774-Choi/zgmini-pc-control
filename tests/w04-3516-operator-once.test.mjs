import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
 FIXED,assertOperatorScope,assertOrigin,validateApproval,verifyCas,verifyStagedFiles,
 validateRecoveryResult,validateSourceReceipt,sanitizedChildEnvironment,
 operatorInstalledFileMaxBytes
} from '../tools/operator-packets/w04-3516-recovery-once.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const approval=JSON.parse(fs.readFileSync(new URL(
 '../approvals/maintenance-recoveries/pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1.installed.json',
 import.meta.url),'utf8'));
const candidate=JSON.parse(fs.readFileSync(new URL(
 '../approvals/maintenance-recoveries/candidates/pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1.installed.json',
 import.meta.url),'utf8'));

test('fixed #3516 operator scope matches merged V1 approval and exact independent A',()=>{
 assert.equal(FIXED.original,'pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1');
 assert.equal(FIXED.approvedSource,'ec9009be720f3da33c3300a81aaf54be1e18c683');
 assert.equal(FIXED.controller,'83679b013ac9a9820331d93311ec97e572b18e13');
 assert.equal(FIXED.release,'462ac071676a2361f92efb7d51e88659743dc63a');
 assert.equal(FIXED.approvalSha256,hash(fs.readFileSync(new URL('../'+FIXED.approval,import.meta.url))));
 assert.equal(candidate.approved,false);
 assert.equal(approval.approved,true);
 assert.deepEqual({...approval,approved:false,note:candidate.note},candidate);
 assert.equal(validateApproval(approval),true);
 assert.equal(approval.proof.runId,45579963186);
 assert.equal(approval.proof.jobId,139087219551);
});
test('wrong scope, original ID, changed source and tampered proof are denied',()=>{
 for(const mutation of [
  a=>({...a,approved:false}),
  a=>({...a,schema:'ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V2'}),
  a=>({...a,requestId:'pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0'}),
  a=>({...a,sourceSha:'0'.repeat(40)}),
  a=>({...a,proof:{...a.proof,issueNumber:3409}}),
  a=>({...a,proof:{...a.proof,resultSha256:'f'.repeat(64)}}),
  a=>({...a,casDigests:{...a.casDigests,unapproved:'f'.repeat(64)}}),
  a=>({...a,files:[...a.files,{path:'controller/entry.mjs',sha256:'f'.repeat(64)}]})
 ])assert.throws(()=>validateApproval(mutation(approval)),/OPERATOR_APPROVAL_SCOPE_INVALID/);
});
test('only a real non-Runner Windows operator can enter the recovery path',()=>{
 assert.equal(assertOperatorScope({platform:'win32',env:{TEMP:'C:\\Temp'}}),true);
 for(const scope of [
  {platform:'linux',env:{TEMP:'C:\\Temp'}},
  {platform:'win32',env:{TEMP:'C:\\Temp',GITHUB_ACTIONS:'true'}},
  {platform:'win32',env:{TEMP:'C:\\Temp',RUNNER_NAME:'zgmini-pc-05'}}
 ])assert.throws(()=>assertOperatorScope(scope),/OPERATOR_INTERACTIVE_WINDOWS_REQUIRED/);
 assert.throws(()=>assertOperatorScope({platform:'win32',env:{TEMP:'relative'}}),/OPERATOR_TEMP_UNAVAILABLE/);
 assert.equal(assertOrigin('https://github.com/ansqhd5774-Choi/zgmini-pc-control.git'),true);
 assert.throws(()=>assertOrigin('https://token@github.com/ansqhd5774-Choi/zgmini-pc-control.git'),
  /OPERATOR_GIT_ORIGIN_MISMATCH/);
});
test('exact seven-file live CAS gate is read-only and fails closed',()=>{
 const fake={...approval,
  casDigests:Object.fromEntries(Object.keys(approval.casDigests).map(k=>[k,hash(Buffer.from(k))])),
  approvedCurrentWriterConfigSha256:hash(Buffer.from('writerSha256'))};
 const paths=[];
 const read=(file,max)=>{const stem=String(file);
  const key=stem.includes('/leases/controller-install/owner.json')?'ownerSha256':
   stem.includes('/leases/controller-install/RECOVERY_REQUIRED.json')?'markerSha256':
   stem.includes('/backlog/')?'backlogSha256':
   stem.includes('/snapshot/host.json')?'snapshotSha256':
   stem.includes('/PROTECTED_BEFORE.json')?'protectionSha256':
   stem.endsWith('/pc-writer/config.json')?'writerSha256':'ledgerSha256';
  paths.push([stem,max]);return Buffer.from(key);
 };
 assert.equal(verifyCas(fake,{read}),true);
 assert.equal(paths.length,7);
 assert.throws(()=>verifyCas(fake,{read:()=>Buffer.from('changed')}),/OPERATOR_LEDGER_CAS_DRIFT/);
});
test('four fixed source paths require both pinned source and release bytes',()=>{
 const buf=Buffer.from('mock approved source');
 const a={...approval,files:approval.files.map(x=>({...x,sha256:hash(buf)}))};
 const read=()=>buf,pinned=()=>buf;
 assert.equal(verifyStagedFiles(a,{read,pinned}),true);
 assert.throws(()=>verifyStagedFiles(a,{read,pinned:()=>Buffer.from('unapproved')}),
  /OPERATOR_STAGED_SOURCE_DRIFT/);
 assert.throws(()=>verifyStagedFiles(a,{read:()=>Buffer.from('drift'),pinned}),
  /OPERATOR_STAGED_SOURCE_DRIFT/);
});
test('archive result must match #3516 original target and authorized 7 CAS',()=>{
 const result={status:'RECOVERED_INSTALLED_STATE',
  code:'INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN',
  requestId:FIXED.original,sourceSha:FIXED.approvedSource,installedSha:FIXED.controller,
  leaseArchived:true,historicalPostcheck:'OUTCOME_UNKNOWN',historicalLedgerPreserved:true,
  originalRequestRetried:false,controllerChanged:false,writerChanged:false,workflowChanged:false,
  dbD1Writes:0,casDigests:{...approval.casDigests}};
 assert.equal(validateRecoveryResult(result,approval),true);
 for(const value of [
  {...result,leaseArchived:false},
  {...result,originalRequestRetried:true},
  {...result,sourceSha:'0'.repeat(40)},
  {...result,casDigests:{...result.casDigests,writerSha256:'f'.repeat(64)}},
  {...result,historicalPostcheck:'PASS'}
 ])assert.throws(()=>validateRecoveryResult(value,approval),/OPERATOR_RECOVERY_RESULT_UNVERIFIED/);
});
test('source preparation, environment and installed file size reject unsafe scope',()=>{
 const receipt={status:'SOURCE_PREPARED_ONLY',code:'EXACT_RELEASE_WORKTREE_CAS_VERIFIED',
  requestId:FIXED.original,sourceSha:FIXED.approvedSource,stagedHead:FIXED.release,
  recoveryExecuted:false,controllerWrites:0,leaseWrites:0};
 assert.equal(validateSourceReceipt(receipt),true);
 assert.throws(()=>validateSourceReceipt({...receipt,recoveryExecuted:true}),
  /OPERATOR_SOURCE_PREP_RESULT_INVALID/);
 const clean=sanitizedChildEnvironment({TEMP:'C:\\Temp',PATH:'C:\\evil',
  GIT_CONFIG_COUNT:'1',NODE_OPTIONS:'--require C:\\evil',ComSpec:'C:\\evil'});
 assert.equal(Object.hasOwn(clean,'NODE_OPTIONS'),false);
 assert.equal(Object.hasOwn(clean,'GIT_CONFIG_COUNT'),false);
 assert.equal(Object.hasOwn(clean,'PATH'),false);
 assert.equal(clean.ComSpec,'C:\\Windows\\System32\\cmd.exe');
 assert.equal(operatorInstalledFileMaxBytes('tools/update.mjs'),262144);
});
test('exact recovery packet is single attempt and never executes arbitrary shell',()=>{
 const src=fs.readFileSync(new URL(
  '../tools/operator-packets/w04-3516-recovery-once.mjs',import.meta.url),'utf8');
 assert.match(src,/FIXED\.approvalSha256/);
 assert.match(src,/verifyStagedFiles\(approval\)/);
 assert.match(src,/verifyCas\(approval\)/);
 assert.match(src,/validateRecoveryResult\(result,approval\)/);
 assert.match(src,/verifyArchive\(result,approval\)/);
 assert.match(src,/OPERATOR_PREVIOUS_ATTEMPT_RECONCILE_FIRST/);
 assert.match(src,/RECOVERY_ATTEMPTS=1/);
 assert.match(src,/GIT_OPTIONAL_LOCKS/);
 assert.ok(src.indexOf('validateSourceReceipt(prepared)')<
  src.indexOf("'reconcile-installed','--request-id'"));
 assert.doesNotMatch(src,/\['reset'|\['clean'|fs\.rmSync|fs\.unlinkSync|shell:\s*true/);
});
