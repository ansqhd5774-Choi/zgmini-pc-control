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
 assert.match(s,/NATIVE_POLICY_TRANSITION_BACKUP_READBACK_STOP/);
 assert.doesNotMatch(s,/Remove-Item|Set-ExecutionPolicy|Stop-Process/);
});

test('post-swap Owner failure is fail-closed and only compensates verified preimages',()=>{
 const s=fs.readFileSync(new URL('../tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1',import.meta.url),'utf8');
 const swapped=s.indexOf('$transitionSwapped=$true');
 const committed=s.indexOf('$transitionCommitted=$true');
 const catchFinal=s.lastIndexOf('}catch{');
 const compensator=s.indexOf('function Restore-VerifiedTransitionPreimage');
 assert.ok(compensator>0&&swapped>compensator&&committed>swapped&&catchFinal>committed);
 const body=s.slice(compensator,s.indexOf('function Verify-TransitionPreimage',compensator));
 for(const needle of [
  "Test-Path -LiteralPath $OutputFile",
  "Exact-Acl $root $scopeAcl",
  "Exact-Acl $backup $scopeAcl",
  "NATIVE_POLICY_TRANSITION_NEW_STATE_DRIFT_STOP",
  "NATIVE_POLICY_TRANSITION_BACKUP_DRIFT_STOP",
  "NATIVE_POLICY_TRANSITION_SCOPE_CAS_STOP",
  "NATIVE_POLICY_TRANSITION_BACKUP_OBSERVATION_DRIFT_STOP",
  "NATIVE_POLICY_RESERVED_PUBLISHER_CLAIM_STOP",
  "[IO.Directory]::Move($root,$quarantine)",
  "[IO.Directory]::Move($backup,$root)"
 ])assert.ok(body.includes(needle),'missing protected rollback condition: '+needle);
 assert.ok(body.indexOf('[IO.Directory]::Move($root,$quarantine)')<
  body.indexOf('[IO.Directory]::Move($backup,$root)'));
 assert.match(s.slice(catchFinal),/if\(\$transitionSwapped -and -not \$transitionCommitted\)/);
 assert.match(s.slice(catchFinal),/Restore-VerifiedTransitionPreimage/);
 assert.match(s.slice(catchFinal),/NATIVE_POLICY_TRANSITION_RECOVERY_REQUIRED/);
 assert.doesNotMatch(body,/Remove-Item|Set-ExecutionPolicy|Stop-Process/);
});

test('Windows PowerShell 5.1 parses the protected transition and preserves isolated rollback',
 {skip:process.platform!=='win32'},t=>{
 const file=new URL('../tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1',import.meta.url);
 const original=fs.readFileSync(file,'utf8');
 const start=original.indexOf('function Restore-VerifiedTransitionPreimage');
 const end=original.indexOf('function Verify-TransitionPreimage',start);
 assert.ok(start>=0&&end>start);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'native-policy-rollback-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const literal=temp.replace(/'/g,"''");
 const target=decodeURIComponent(file.pathname.slice(1)).replace(/'/g,"''");
 const helper=original.slice(start,end);
 const code=[
  "$ErrorActionPreference='Stop'",
  "$parseTokens=$null;$parseErrors=$null",
  "[void][System.Management.Automation.Language.Parser]::ParseFile('"+target+"',[ref]$parseTokens,[ref]$parseErrors)",
  "if($parseErrors.Count -gt 0){throw 'NATIVE_POLICY_PARSE_FAILED'}",
  "function Stop-N([string]$code){throw $code}",
  "function Plain-Path([string]$p){if(-not (Test-Path -LiteralPath $p -PathType Container)){throw 'PATH_MISSING'}}",
  "function Exact-Acl([string]$p,$expected){if(-not (Test-Path -LiteralPath $p)){throw 'ACL_PATH_MISSING'};return 'fixture'}",
  "function New-PolicyFileAcl {return 'fixture'}",
  "function New-Acl([string]$rights){return 'fixture'}",
  "function Hash-Bytes([byte[]]$b){$text=[Text.Encoding]::UTF8.GetString($b);if($text -ceq 'OLD'){return ('a'*64)};if($text -ceq 'NEW'){return ('b'*64)};throw 'HASH_DRIFT'}",
  helper,
  "$homeRoot='"+literal+"'",
  "$root=Join-Path $homeRoot 'active'",
  "$backup=$root+'.backup-'+('a'*64)",
  "$receiptRoot=Join-Path $homeRoot 'receipts'",
  "$OutputFile=Join-Path $homeRoot 'result.json'",
  "$ScopeSha256='b'*64",
  "$TransitionFromScopeSha256='a'*64",
  "$hostName='DESKTOP-N62L0NG'",
  "$scopeAcl='fixture'",
  "function Make-Fixture {",
  "  if(Test-Path $root){[IO.Directory]::Delete($root,$true)}",
  "  if(Test-Path $backup){[IO.Directory]::Delete($backup,$true)}",
  "  $quarantine=$root+'.failed-'+$ScopeSha256",
  "  if(Test-Path $quarantine){[IO.Directory]::Delete($quarantine,$true)}",
  "  [void][IO.Directory]::CreateDirectory($root)",
  "  [void][IO.Directory]::CreateDirectory($backup)",
  "  [void][IO.Directory]::CreateDirectory($receiptRoot)",
  "  [IO.File]::WriteAllText((Join-Path $root 'ci-native-writer-b-approved.json'),'NEW')",
  "  [IO.File]::WriteAllText((Join-Path $backup 'ci-native-writer-b-approved.json'),'OLD')",
  "  $state=@{host=$hostName;status='SCOPE_INSTALLED_VERIFIED';scopeSha256=$TransitionFromScopeSha256;aclVerified=$true;reservedClaimAbsent=$true}|ConvertTo-Json -Compress",
  "  [IO.File]::WriteAllText((Join-Path $backup 'installation-observation.json'),$state)",
  "}",
  "Make-Fixture",
  "[IO.File]::WriteAllText($OutputFile,'partial result')",
  "try{Restore-VerifiedTransitionPreimage;throw 'ACCEPTED_PARTIAL_RESULT'}catch{if($_.Exception.Message -notmatch 'RESULT_EXISTS_STOP'){throw}}",
  "if((Test-Path $backup) -ne $true -or (Test-Path $root) -ne $true){throw 'PARTIAL_REPORT_MUTATED_ROOTS'}",
  "[IO.File]::Delete($OutputFile)",
  "[IO.File]::WriteAllText((Join-Path $root 'ci-native-writer-b-approved.json'),'DRIFT')",
  "try{Restore-VerifiedTransitionPreimage;throw 'ACCEPTED_DRIFT'}catch{if($_.Exception.Message -notmatch 'HASH_DRIFT'){throw}}",
  "if((Test-Path $backup) -ne $true -or (Test-Path $root) -ne $true){throw 'DRIFT_MUTATED_ROOTS'}",
  "Make-Fixture",
  "$claim=Join-Path $receiptRoot 'native-287c32ba0ae695f2b17176b48bdbf1828797d04e53f5d6d346ae4f66c7b818b4.json'",
  "[IO.File]::WriteAllText($claim,'claimed')",
  "try{Restore-VerifiedTransitionPreimage;throw 'ACCEPTED_CLAIM'}catch{if($_.Exception.Message -notmatch 'PUBLISHER_CLAIM_STOP'){throw}}",
  "if((Test-Path $backup) -ne $true -or (Test-Path $root) -ne $true){throw 'CLAIM_MUTATED_ROOTS'}",
  "[IO.File]::Delete($claim)",
  "Restore-VerifiedTransitionPreimage",
  "if([IO.File]::ReadAllText((Join-Path $root 'ci-native-writer-b-approved.json')) -cne 'OLD'){throw 'BACKUP_NOT_RESTORED'}",
  "if([IO.File]::ReadAllText((Join-Path ($root+'.failed-'+$ScopeSha256) 'ci-native-writer-b-approved.json')) -cne 'NEW'){throw 'NEW_TREE_LOST'}",
  "if(Test-Path $backup){throw 'BACKUP_RENAME_NOT_COMPLETED'}",
  "Write-Output 'ISOLATED_ROLLBACK_PASS'"
 ].join(';');
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],
  {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:65536});
 assert.equal(result.error,undefined);
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 assert.match(result.stdout,/ISOLATED_ROLLBACK_PASS/);
});
