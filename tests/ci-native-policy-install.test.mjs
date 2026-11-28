import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {makeIndependentPolicyScope,makeIndependentPolicyProof,verifyIndependentPolicyReceipt,
 verifyPolicyTransportTransition,verifyFirstScopeTransition,POLICY_INSTALL as F,policyDigest as hash} from '../ci-approval/native-policy-install.mjs';
import {verifyNativeInstalledProof} from '../ci-approval/native-publisher-entry.mjs';
function fixture(){
 const approvalBytes=fs.readFileSync(new URL('../'+F.approvalPath,import.meta.url));
 const requestBytes=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
  requestId:F.requestId,chatId:'a67cd0f6-508a-4a73-87e3-88174bd8e52e',operation:'pc-writer-source-install',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',approvalManifestPath:F.approvalPath,
  approvalManifestSha256:F.approvalSha256}));
 const policy={schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',enabled:true,effect:'B_WRITER_SOURCE',
  repositoryVisibility:'public',nativeWriterBExecutionEnabled:true,sourceAttempt:1,
  sourceRunMode:'EVENT_COMPLETION_V1',sourceWorkflowId:416355595,
  sourceWorkflowPath:'.github/workflows/controller-maintenance-source-tests.yml',
  receiverWorkflowPath:'.github/workflows/ci-approved-writer-b-once.yml',
  policyRevision:'a'.repeat(40),nativeWriterBControlSha:'a'.repeat(40),sourceHeadSha:'b'.repeat(40),
  installedControllerSha:'c'.repeat(40),sourceWorkflowBlobSha:'d'.repeat(40),
  receiverWorkflowBlobSha:'e'.repeat(40),nativeWriterBAdapterSha256:'f'.repeat(64),
  businessApprovalSha256:F.approvalSha256,approvedRequestSha256:F.requestSha256};
 const scope=makeIndependentPolicyScope({policy,approvalBytes,requestBytes});
 // Synthetic host observations are fixtures only, never installation evidence.
 const receipt={schema:'ZGMINI_NATIVE_POLICY_INSTALL_RECEIPT_V1',effect:'B_WRITER_SOURCE',
  requestId:F.requestId,status:'POLICY_INSTALLED_VERIFIED',nativePolicySha256:hash(JSON.stringify(policy)),
  actualControllerSha:policy.installedControllerSha,approvalSha256:F.approvalSha256,
  requestSha256:F.requestSha256,controllerChanged:false,writerChanged:false,
  variablesEnabled:false,dispatched:false,hosts:F.hosts.map(host=>({host,status:'SCOPE_INSTALLED_VERIFIED',
   aclVerified:true,independentOperatorVerified:true,reservedClaimAbsent:true,
   policySha256:hash(JSON.stringify(policy)),scopeSha256:hash(scope),aclSha256:'1'.repeat(64),
   observedAt:'2026-11-28T06:00:00Z'}))};
 return {policy,approvalBytes,requestBytes,scope,receipt};
}
test('fixed reserved request and approved manifest produce only the exact scope',()=>{
 const x=fixture();assert.equal(hash(x.requestBytes),F.requestSha256);
 assert.equal(JSON.parse(x.scope).policy.effect,'B_WRITER_SOURCE');
 assert.equal(Object.hasOwn(JSON.parse(x.scope),'installationReceipt'),false);
});
for(const [name,edit] of [
 ['approval drift',x=>x.approvalBytes=Buffer.from('other')],
 ['request drift',x=>x.requestBytes=Buffer.from('{}')],
 ['other effect',x=>x.policy.effect='A_READONLY'],
 ['private policy',x=>x.policy.repositoryVisibility='private'],
 ['past CI run',x=>x.policy.sourceRunId=123],
 ['other workflow',x=>x.policy.sourceWorkflowId=123]
])test('scope rejects '+name,()=>{const x=fixture();edit(x);assert.throws(()=>makeIndependentPolicyScope(x));});
for(const [name,edit] of [
 ['missing isolated host',x=>x.receipt.hosts.pop()],
 ['duplicate host',x=>x.receipt.hosts[1].host='PC'],
 ['unverified ACL',x=>x.receipt.hosts[0].aclVerified=false],
 ['existing claim',x=>x.receipt.hosts[1].reservedClaimAbsent=false],
 ['different installed bytes',x=>x.receipt.hosts[1].scopeSha256='2'.repeat(64)],
 ['controller effect',x=>x.receipt.controllerChanged=true],
 ['dispatch already made',x=>x.receipt.dispatched=true]
])test('receipt rejects '+name,()=>{const x=fixture();edit(x);assert.throws(()=>verifyIndependentPolicyReceipt(x.receipt,x.policy));});
test('publisher verifies genuine-format independent receipt without requiring Controller reinstall',async()=>{
 const x=fixture(),receiptBytes=Buffer.from(JSON.stringify(x.receipt));
 const proof=makeIndependentPolicyProof({...x,receiptBytes,installationRequestId:'native-policy-12345678-1234-4234-8234-123456789abc'});
 const policy=await verifyNativeInstalledProof('B_WRITER_SOURCE',proof,{getJson:async route=>{
  assert.equal(route,'contents/'+proof.installationReceiptPath+'?ref=main');
  return {type:'file',path:proof.installationReceiptPath,encoding:'base64',content:receiptBytes.toString('base64')};
 }});assert.deepEqual(policy,x.policy);
 await assert.rejects(()=>verifyNativeInstalledProof('A_READONLY',proof,{getJson:async()=>{throw Error('must not read')}}));
 await assert.rejects(()=>verifyNativeInstalledProof('B_WRITER_SOURCE',proof,{getJson:async()=>({type:'file',path:proof.installationReceiptPath,encoding:'base64',content:Buffer.from('{}').toString('base64')})}));
});
test('Windows installer refuses non-Apply invocation before reading files or creating state',
 {skip:process.platform!=='win32'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-policy-denial-'));
 const output=path.join(dir,'never-created.json');
 const script=new URL('../tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1',import.meta.url);
 const result=spawnSync('powershell.exe',['-NoProfile','-File',decodeURIComponent(script.pathname.slice(1)),
  '-ScopeFile',path.join(dir,'absent.json'),'-ScopeSha256','0'.repeat(64),
  '-RunnerSid','S-1-5-21-1-2-3-1001','-OutputFile',output],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,1);assert.match(result.stdout,/NATIVE_POLICY_INDEPENDENT_APPLY_REQUIRED/);
 assert.equal(fs.existsSync(output),false);fs.rmdirSync(dir);
});

test('transport-only transition preserves original exact business effect and source event',()=>{
 const x=fixture();
 const policy={...x.policy,policyRevision:'2'.repeat(40),nativeWriterBControlSha:'2'.repeat(40),
  nativeWriterBAdapterSha256:'3'.repeat(64),receiverWorkflowBlobSha:'4'.repeat(40),
  nativeWriterBControlMode:'PINNED_CHECKOUT_V1'};
 const next=makeIndependentPolicyScope({...x,policy});
 const v=verifyPolicyTransportTransition(x.scope,next);
 assert.equal(v.beforeScopeSha256,hash(x.scope));
 assert.equal(v.afterScopeSha256,hash(next));
 // A fixture can never become the exact deployed first-scope preimage.
 assert.throws(()=>verifyFirstScopeTransition(x.scope,next),/TRANSITION_PREIMAGE_STOP/);
 for(const edit of [
  p=>{p.sourceHeadSha='5'.repeat(40)},p=>{p.installedControllerSha='6'.repeat(40)},
  p=>{p.sourceWorkflowBlobSha='7'.repeat(40)},p=>{p.extra=true},
  p=>{delete p.nativeWriterBControlMode},p=>{p.nativeWriterBControlSha=p.policyRevision=x.policy.policyRevision}
 ]){
  const p={...policy};edit(p);
  assert.throws(()=>verifyPolicyTransportTransition(x.scope,makeIndependentPolicyScope({...x,policy:p})));
 }
});

test('new pinned policy receipt requires both preserved original host backups',()=>{
 const x=fixture(),policy={...x.policy,nativeWriterBControlMode:'PINNED_CHECKOUT_V1'};
 const receipt={...x.receipt,nativePolicySha256:hash(JSON.stringify(policy)),
  hosts:x.receipt.hosts.map(h=>({...h,policySha256:hash(JSON.stringify(policy))}))};
 assert.throws(()=>verifyIndependentPolicyReceipt(receipt,policy),/TRANSITION_HOST_BACKUP_STOP/);
 const old='df097365ebc641a551f6e0b233ad333662f4ae12b82a2180cfb97637656f5736';
 for(const h of receipt.hosts){h.previousScopeSha256=old;h.backupVerified=true}
 assert.equal(verifyIndependentPolicyReceipt(receipt,policy),receipt);
 receipt.hosts[1].backupVerified=false;
 assert.throws(()=>verifyIndependentPolicyReceipt(receipt,policy),/TRANSITION_HOST_BACKUP_STOP/);
});
test('Windows transition installer keeps elevated gate, exact preimage, protected backup and claims',()=>{
 const s=fs.readFileSync(new URL('../tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1',import.meta.url),'utf8');
 const apply=s.indexOf("if(-not $Apply");
 const admin=s.indexOf("NATIVE_POLICY_ADMIN_REQUIRED");
 const preimage=s.indexOf("function Verify-TransitionPreimage");
 const move=s.indexOf("[IO.Directory]::Move($root,$backup)");
 assert.ok(apply>=0&&admin>apply&&preimage>admin&&move>preimage);
 assert.match(s,/NATIVE_POLICY_TRANSITION_SCOPE_CAS_STOP/);
 assert.match(s,/NATIVE_POLICY_RESERVED_PUBLISHER_CLAIM_STOP/);
 assert.match(s,/NATIVE_POLICY_RESERVED_WRITER_CLAIM_STOP/);
 assert.match(s,/\[IO.Directory\]::Move\(\$backup,\$root\)/);
 assert.match(s,/Verify-TransitionPreimage \$backup/);
 assert.doesNotMatch(s,/Remove-Item|Set-ExecutionPolicy|Stop-Process/);
});

test('transition stages observation before the first rename and covers post-swap output errors',()=>{
 const s=fs.readFileSync(new URL('../tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1',import.meta.url),'utf8');
 assert.equal((s.match(/^param\(/gm)||[]).length,1);
 assert.equal((s.match(/^Set-StrictMode/gm)||[]).length,1);
 const stage=s.indexOf("Write-Once ([IO.Path]::Combine($staging,'installation-observation.json'))");
 const verify=s.indexOf('Verify-NewScope $staging',stage);
 const intent=s.indexOf('Write-Once $intentPath',verify);
 const move=s.indexOf('[IO.Directory]::Move($root,$backup)',intent);
 const swap=s.indexOf('[IO.Directory]::Move($staging,$root)',move);
 const output=s.indexOf('Write-Once $OutputFile $reportBytes',swap);
 const recovery=s.indexOf('Restore-VerifiedTransitionPreimage',s.indexOf('}catch{',output));
 const helper=s.slice(s.indexOf(' function Restore-VerifiedTransitionPreimage {'),s.indexOf(' # End compensation helpers.'));
 const guard=helper.indexOf('Test-Path -LiteralPath $OutputFile');
 const claim=helper.indexOf('Verify-TransitionClaimAbsent');
 const quarantine=helper.indexOf('[IO.Directory]::Move($root,$failed)');
 const restore=helper.indexOf('[IO.Directory]::Move($backup,$root)');
 assert.ok(stage>=0&&verify>stage&&intent>verify&&move>intent&&swap>move&&output>swap&&recovery>output);
 assert.ok(guard>=0&&claim>guard&&quarantine>claim&&restore>quarantine);
 assert.equal((helper.match(/Test-Path -LiteralPath \$OutputFile/g)||[]).length,2);
 assert.equal((helper.match(/Verify-TransitionClaimAbsent/g)||[]).length,2);
 assert.match(s,/NATIVE_POLICY_TRANSITION_RECOVERY_REQUIRED_STOP/);
 assert.match(s,/NATIVE_POLICY_TRANSITION_RESTORED_STOP/);
});

test('Windows parser and TEMP rollback guard refuse surviving output and claims', {skip:process.platform!=='win32'},t=>{
 const file=new URL('../tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1',import.meta.url);
 const s=fs.readFileSync(file,'utf8');
 const start=s.indexOf(' function Restore-VerifiedTransitionPreimage {');
 const end=s.indexOf(' # End compensation helpers.',start);
 assert.ok(start>=0&&end>start);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-policy-restore-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const literal=v=>v.replace(/'/g,"''");
 const target=literal(decodeURIComponent(file.pathname.slice(1)));
 const code=[
  "$ErrorActionPreference='Stop'",
  "$tokens=$null;$errors=$null",
  "[void][System.Management.Automation.Language.Parser]::ParseFile('"+target+"',[ref]$tokens,[ref]$errors)",
  "if($errors.Count -gt 0){throw 'INSTALLER_PARSE_FAILED'}",
  "$base='"+literal(dir)+"'",
  "$root=Join-Path $base 'active'",
  "$backup=Join-Path $base 'backup'",
  "$failed=Join-Path $base 'failed'",
  "$OutputFile=Join-Path $base 'result.json'",
  "$claim=Join-Path $base 'claim'",
  "function Stop-N([string]$code){throw $code}",
  "function Require-Unactivated {}",
  "function Verify-TransitionClaimAbsent {if(Test-Path -LiteralPath $claim){throw 'CLAIM_EXISTS'}}",
  "function Verify-TransitionPreimage([string]$dir){if([IO.File]::ReadAllText((Join-Path $dir 'scope')) -cne 'OLD'){throw 'OLD_DRIFT'}}",
  "function Verify-NewScope([string]$dir){if([IO.File]::ReadAllText((Join-Path $dir 'scope')) -cne 'NEW'){throw 'NEW_DRIFT'}}",
  s.slice(start,end),
  "[void][IO.Directory]::CreateDirectory($root)",
  "[void][IO.Directory]::CreateDirectory($backup)",
  "[IO.File]::WriteAllText((Join-Path $root 'scope'),'NEW')",
  "[IO.File]::WriteAllText((Join-Path $backup 'scope'),'OLD')",
  "function Check-Unchanged {if([IO.File]::ReadAllText((Join-Path $root 'scope')) -cne 'NEW' -or [IO.File]::ReadAllText((Join-Path $backup 'scope')) -cne 'OLD' -or (Test-Path $failed)){throw 'UNEXPECTED_MOVE'}}",
  "[IO.File]::WriteAllText($OutputFile,'{\"status\":\"SCOPE_INSTALLED_VERIFIED\"}')",
  "try{Restore-VerifiedTransitionPreimage;throw 'ACCEPTED_OUTPUT'}catch{if($_.Exception.Message -cne 'NATIVE_POLICY_TRANSITION_RESULT_EXISTS_STOP'){throw}}",
  "Check-Unchanged",
  "[IO.File]::Delete($OutputFile)",
  "[IO.File]::WriteAllText($claim,'claimed')",
  "try{Restore-VerifiedTransitionPreimage;throw 'ACCEPTED_CLAIM'}catch{if($_.Exception.Message -cne 'CLAIM_EXISTS'){throw}}",
  "Check-Unchanged",
  "[IO.File]::Delete($claim)",
  "Restore-VerifiedTransitionPreimage",
  "if([IO.File]::ReadAllText((Join-Path $root 'scope')) -cne 'OLD' -or [IO.File]::ReadAllText((Join-Path $failed 'scope')) -cne 'NEW' -or (Test-Path $backup)){throw 'RESTORE_FAILED'}",
  "Write-Output 'TEMP_RESTORE_PASS'"
 ].join('\n');
 // The fixture runs only extracted compensation code in a newly created TEMP
 // directory; ACL/claim/byte readers are fixture ports, not live host proof.
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],
  {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:65536});
 assert.equal(result.error,undefined);
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 assert.match(result.stdout,/TEMP_RESTORE_PASS/);
});

test('Owner policy lease and interrupted recovery stay within the fixed unactivated scope',()=>{
 const s=fs.readFileSync(new URL('../tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1',import.meta.url),'utf8');
 const lease=s.indexOf('$policyLease=[Threading.Mutex]::new');
 const wait=s.indexOf('$policyLease.WaitOne(0)',lease);
 const recover=s.indexOf('if($transition -and $RecoverIntent)',wait);
 const stage=s.indexOf("$staging=$root+'.staging-'",recover);
 const move=s.indexOf('[IO.Directory]::Move($root,$backup)',stage);
 const release=s.indexOf('$policyLease.ReleaseMutex()',move);
 assert.ok(lease>=0&&wait>lease&&recover>wait&&stage>recover&&move>stage&&release>move);
 assert.match(s,/NATIVE_POLICY_OWNER_LEASE_ACL_STOP/);
 assert.match(s,/NATIVE_POLICY_OWNER_LEASE_BUSY_STOP/);
 const recovery=s.slice(recover,stage);
 for(const check of [
  'Exact-Acl $intentPath','intent.requestId','intent.outputFile','intent.beforeScopeSha256',
  'intent.afterScopeSha256','intent.afterObservationSha256','Verify-TransitionClaimAbsent',
  'Restore-VerifiedTransitionPreimage','TRANSITION_OLD_SCOPE_VERIFIED'
 ])assert.ok(recovery.includes(check),check);
 assert.doesNotMatch(recovery,/Write-Once|CreateDirectory|SCOPE_INSTALLED_VERIFIED/);
 assert.match(s,/existingIntents.Count -ne 0/);
 const pack=fs.readFileSync(new URL('../tools/native-writer-b-policy-package.mjs',import.meta.url),'utf8');
 assert.match(pack,/merged.merge_commit_sha===reviewedControlSha/);
 assert.match(pack,/git\('rev-parse','HEAD'\)===controlHead/);
 assert.match(pack,/verifyPinnedDeployment\(preview.proposedPolicy/);
});
