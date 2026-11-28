#Requires -Version 5.1
# Independent elevated Owner only; never run in Actions or a Runner.
# First provisioning only. Does not enable variables, dispatch, install Writer,
# change existing ACLs, stop processes, or modify any Task/Controller/data.
param(
 [Parameter(Mandatory=$true)][string]$ScopeFile,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ScopeSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^S-1-5-21-[0-9-]+$')][string]$RunnerSid,
 [Parameter(Mandatory=$true)][string]$OutputFile,
 [string]$ProofFile,
 [switch]$Apply
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Stop-N([string]$code){throw $code}
function Plain-Path([string]$p){
 for($cur=[IO.Path]::GetFullPath($p);$cur;$cur=[IO.Path]::GetDirectoryName($cur)){
  $item=Get-Item -LiteralPath $cur -Force
  if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){
   Stop-N 'NATIVE_POLICY_PARENT_ALIAS_STOP'
  }
 }
}
function Hash-Bytes([byte[]]$b){
 $h=[Security.Cryptography.SHA256]::Create()
 try{return ([BitConverter]::ToString($h.ComputeHash($b))).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}
}
function New-Acl([string]$rights){
 $acl=[Security.AccessControl.DirectorySecurity]::new()
 $acl.SetAccessRuleProtection($true,$false)
 $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
 foreach($entry in @(@('S-1-5-18','FullControl'),@('S-1-5-32-544','FullControl'),@($RunnerSid,$rights))){
  $rule=[Security.AccessControl.FileSystemAccessRule]::new(
   [Security.Principal.SecurityIdentifier]::new($entry[0]),
   [Security.AccessControl.FileSystemRights]$entry[1],
   [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',
   [Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
  [void]$acl.AddAccessRule($rule)
 }
 return $acl
}
function Exact-Acl([string]$p,$expected){
 $actual=Get-Acl -LiteralPath $p
 if(-not $actual.AreAccessRulesProtected -or
  $actual.GetSecurityDescriptorSddlForm('Access,Owner') -cne $expected.GetSecurityDescriptorSddlForm('Access,Owner')){
  Stop-N 'NATIVE_POLICY_ACL_READBACK_STOP'
 }
 return $actual.GetSecurityDescriptorSddlForm('Access,Owner')
}
function Write-Once([string]$p,[byte[]]$bytes,[bool]$TrustedPolicyFile=$false){
 if($TrustedPolicyFile){
  # Set protected DACL AND administrator ownership at creation, not afterward.
  # Otherwise a same-SID Runner could change the new file's DACL as its owner.
  $security=[Security.AccessControl.FileSecurity]::new()
  $security.SetAccessRuleProtection($true,$false)
  $security.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
  foreach($entry in @(@('S-1-5-18','FullControl'),@('S-1-5-32-544','FullControl'),@($RunnerSid,'ReadAndExecute'))){
   $rule=[Security.AccessControl.FileSystemAccessRule]::new(
    [Security.Principal.SecurityIdentifier]::new($entry[0]),
    [Security.AccessControl.FileSystemRights]$entry[1],[Security.AccessControl.AccessControlType]::Allow)
   [void]$security.AddAccessRule($rule)
  }
  $stream=[IO.FileStream]::new($p,[IO.FileMode]::CreateNew,
   [Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$security)
 }else{
  $stream=[IO.FileStream]::new($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 }
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
try{
 if($PSVersionTable.PSEdition -ne 'Desktop'){
  Stop-N 'NATIVE_POLICY_WINDOWS_POWERSHELL_REQUIRED'
 }
 if(-not $Apply -or $env:GITHUB_ACTIONS -or $env:RUNNER_NAME -or -not [Environment]::UserInteractive){
  Stop-N 'NATIVE_POLICY_INDEPENDENT_APPLY_REQUIRED'
 }
 $principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
 if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  Stop-N 'NATIVE_POLICY_ADMIN_REQUIRED'
 }
 $hostName=[Environment]::MachineName.ToUpperInvariant()
 if($hostName -notin @('PC','DESKTOP-N62L0NG')){Stop-N 'NATIVE_POLICY_HOST_STOP'}
 # Require the supplied ACL identity to be the actual existing Runner account.
 $listeners=@(Get-CimInstance Win32_Process -Filter "Name='Runner.Listener.exe'")
 $matched=$false
 if($hostName -eq 'DESKTOP-N62L0NG'){
  $services=@(Get-CimInstance Win32_Service|Where-Object {
   $_.Name -ceq 'actions.runner.ansqhd5774-Choi-zgmini-pc-control.zgmini-handoff-ci-spare-01' -and $_.State -eq 'Running'
  })
  if($services.Count -ne 1){Stop-N 'NATIVE_POLICY_RUNNER_SERVICE_STOP'}
  $account=[string]$services[0].StartName
  if($account.StartsWith('.\')){$account=$hostName+'\'+$account.Substring(2)}
  $serviceSid=([Security.Principal.NTAccount]::new($account)).Translate([Security.Principal.SecurityIdentifier]).Value
  if($serviceSid -cne $RunnerSid){Stop-N 'NATIVE_POLICY_RUNNER_SID_STOP'}
  $matched=$true
 }
 foreach($listener in $listeners){
  $command=[string]$listener.CommandLine
  if($hostName -eq 'PC' -and $command -match '(?i)ZGmini\\automation\\pc-control\\runners\\'){
   $owner=Invoke-CimMethod -InputObject $listener -MethodName GetOwnerSid
   if($owner.ReturnValue -ne 0 -or $owner.Sid -cne $RunnerSid){Stop-N 'NATIVE_POLICY_RUNNER_SID_STOP'}
   $matched=$true
  }
 }
 if(-not $matched){Stop-N 'NATIVE_POLICY_RUNNER_NOT_OBSERVED_STOP'}
 $bytes=[IO.File]::ReadAllBytes($ScopeFile)
 if($bytes.Length -gt 131072 -or (Hash-Bytes $bytes) -cne $ScopeSha256){Stop-N 'NATIVE_POLICY_SCOPE_SHA_STOP'}
 $scope=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json
 $p=$scope.policy
 $approval=[Convert]::FromBase64String($scope.approvalBytesBase64)
 $requestBytes=[Convert]::FromBase64String($scope.requestBytesBase64)
 $request=[Text.Encoding]::UTF8.GetString($requestBytes)|ConvertFrom-Json
 if($scope.schema -cne 'ZGMINI_CI_NATIVE_READONLY_SCOPE_V1' -or
  (Hash-Bytes $approval) -cne 'c4f58408f4360f7d03b9c359cda78ce4602c447d86ff15ad538cdb57d820acda' -or
  (Hash-Bytes $requestBytes) -cne '15fe91a91915e10551698de38200ff7c1f354fdae61ce117248b31182c8f35fa' -or
  $request.requestId -cne 'db6a4814-d8ea-5343-9539-cf797835c231' -or
  $p.effect -cne 'B_WRITER_SOURCE' -or $p.repositoryVisibility -cne 'public' -or
  $p.enabled -ne $true -or $p.nativeWriterBExecutionEnabled -ne $true -or
  $p.sourceRunMode -cne 'EVENT_COMPLETION_V1' -or $p.sourceAttempt -ne 1 -or
  $p.sourceWorkflowId -ne 416355595 -or
  $p.sourceWorkflowPath -cne '.github/workflows/controller-maintenance-source-tests.yml' -or
  $p.receiverWorkflowPath -cne '.github/workflows/ci-approved-writer-b-once.yml' -or
  $p.businessApprovalSha256 -cne (Hash-Bytes $approval) -or
  $p.approvedRequestSha256 -cne (Hash-Bytes $requestBytes) -or
  $p.policyRevision -cne $p.nativeWriterBControlSha){Stop-N 'NATIVE_POLICY_APPROVED_SCOPE_STOP'}
 $root=if($hostName -eq 'PC'){'E:\ZGmini\data\pc-writer\ci-native'}else{'C:\ProgramData\ZGMINI-CI\NativeWriterBPolicy'}
 $parent=[IO.Path]::GetDirectoryName($root)
 Plain-Path $parent
 if(Test-Path -LiteralPath $OutputFile){Stop-N 'NATIVE_POLICY_EXISTING_OUTPUT_STOP'}
 $scopeAcl=New-Acl 'ReadAndExecute'
 if($ProofFile){
  Plain-Path $root
  [void](Exact-Acl $root $scopeAcl)
  if((Hash-Bytes ([IO.File]::ReadAllBytes([IO.Path]::Combine($root,'ci-native-writer-b-approved.json')))) -cne $ScopeSha256){
   Stop-N 'NATIVE_POLICY_INSTALLED_SCOPE_DRIFT_STOP'
  }
  $proofBytes=[IO.File]::ReadAllBytes($ProofFile)
  $proof=[Text.Encoding]::UTF8.GetString($proofBytes)|ConvertFrom-Json
  $policyHash=Hash-Bytes ([Text.Encoding]::UTF8.GetBytes(($p|ConvertTo-Json -Depth 30 -Compress)))
  if($proof.schema -cne 'ZGMINI_CI_NATIVE_POLICY_INSTALLED_PROOF_V1' -or
   $proof.effect -cne 'B_WRITER_SOURCE' -or $proof.nativePolicySha256 -cne $policyHash -or
   ($proof.policy|ConvertTo-Json -Depth 30 -Compress) -cne ($p|ConvertTo-Json -Depth 30 -Compress) -or
   $proof.installationRequestId -notmatch '^native-policy-[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' -or
   $proof.installationReceiptPath -cne ('results/'+$proof.installationRequestId+'.json')){
   Stop-N 'NATIVE_POLICY_PROOF_SCOPE_STOP'
  }
  # Independently read the real published receipt; never turn caller JSON into proof.
  $gh=(Get-Command gh.exe -ErrorAction Stop).Source
  $remoteText=& $gh api ('repos/ansqhd5774-Choi/zgmini-pc-control/contents/'+$proof.installationReceiptPath+'?ref=main')
  if($LASTEXITCODE -ne 0){Stop-N 'NATIVE_POLICY_REMOTE_RECEIPT_STOP'}
  $remote=($remoteText -join "`n")|ConvertFrom-Json
  if($remote.type -cne 'file' -or $remote.path -cne $proof.installationReceiptPath){Stop-N 'NATIVE_POLICY_REMOTE_PATH_STOP'}
  $raw=[Convert]::FromBase64String($remote.content)
  if((Hash-Bytes $raw) -cne $proof.installationReceiptSha256){Stop-N 'NATIVE_POLICY_REMOTE_SHA_STOP'}
  $receipt=[Text.Encoding]::UTF8.GetString($raw)|ConvertFrom-Json
  if($receipt.schema -cne 'ZGMINI_NATIVE_POLICY_INSTALL_RECEIPT_V1' -or
   $receipt.nativePolicySha256 -cne $policyHash -or $receipt.status -cne 'POLICY_INSTALLED_VERIFIED' -or
   $receipt.requestId -cne $request.requestId -or $receipt.hosts.Count -ne 2){Stop-N 'NATIVE_POLICY_REMOTE_EFFECT_STOP'}
  foreach($expectedHost in @('PC','DESKTOP-N62L0NG')){
   $reports=@($receipt.hosts|Where-Object {$_.host -ceq $expectedHost})
   if($reports.Count -ne 1 -or $reports[0].scopeSha256 -cne $ScopeSha256 -or
    $reports[0].status -cne 'SCOPE_INSTALLED_VERIFIED' -or $reports[0].aclVerified -ne $true -or
    $reports[0].reservedClaimAbsent -ne $true -or $reports[0].independentOperatorVerified -ne $true){
    Stop-N 'NATIVE_POLICY_REMOTE_HOSTS_STOP'
   }
  }
  $own=$receipt.hosts|Where-Object {$_.host -ceq $hostName}
  $ownStored=Get-Content -LiteralPath ([IO.Path]::Combine($root,'installation-observation.json')) -Raw|ConvertFrom-Json
  if(($own|ConvertTo-Json -Depth 30 -Compress) -cne ($ownStored|ConvertTo-Json -Depth 30 -Compress)){
   Stop-N 'NATIVE_POLICY_OWN_OBSERVATION_CAS_STOP'
  }
  Write-Once ([IO.Path]::Combine($root,'ci-native-writer-b-installed-proof.json')) $proofBytes $true
  if((Hash-Bytes ([IO.File]::ReadAllBytes([IO.Path]::Combine($root,'ci-native-writer-b-installed-proof.json')))) -cne (Hash-Bytes $proofBytes)){
   Stop-N 'NATIVE_POLICY_PROOF_READBACK_STOP'
  }
  $finalReport=[ordered]@{host=$hostName;status='POLICY_PROOF_INSTALLED_VERIFIED';
   scopeSha256=$ScopeSha256;proofSha256=(Hash-Bytes $proofBytes);aclVerified=$true;
   variablesEnabled=$false;dispatched=$false}
  Write-Once $OutputFile ([Text.Encoding]::UTF8.GetBytes(($finalReport|ConvertTo-Json -Compress)))
  Write-Output 'status=POLICY_PROOF_INSTALLED_VERIFIED'
  exit 0
 }
 if(Test-Path -LiteralPath $root){
  Stop-N 'NATIVE_POLICY_EXISTING_INSTALL_OR_OUTPUT_STOP'
 }
 if($hostName -eq 'PC'){
  $hostFile='E:\ZGmini\automation\pc-control\host.json'
  $hostData=Get-Content -LiteralPath $hostFile -Raw|ConvertFrom-Json
  # host.json source is the Controller installed source, never Writer source.
  $installed=$hostData.controllerSourceSha
  if($installed -cne $p.installedControllerSha){Stop-N 'NATIVE_POLICY_CONTROLLER_CAS_STOP'}
  if(Test-Path -LiteralPath 'E:\ZGmini\data\pc-writer\writer-b-install-once\db6a4814-d8ea-5343-9539-cf797835c231'){
   Stop-N 'NATIVE_POLICY_RESERVED_WRITER_CLAIM_STOP'
  }
 }
 if($hostName -eq 'DESKTOP-N62L0NG'){
  $receiptRoot='C:\ProgramData\ZGMINI-CI\NativeWriterBReceipts'
  if(Test-Path -LiteralPath $receiptRoot){Stop-N 'NATIVE_POLICY_RECEIPT_ROOT_EXISTS_STOP'}
  $receiptAcl=New-Acl 'Modify'
  [void][IO.Directory]::CreateDirectory($receiptRoot,$receiptAcl)
  [void](Exact-Acl $receiptRoot $receiptAcl)
 }
 $staging=$root+'.staging-'+[Guid]::NewGuid().ToString()
 [void][IO.Directory]::CreateDirectory($staging,$scopeAcl)
 $aclText=Exact-Acl $staging $scopeAcl
 Write-Once ([IO.Path]::Combine($staging,'ci-native-writer-b-approved.json')) $bytes $true
 $stored=[IO.File]::ReadAllBytes([IO.Path]::Combine($staging,'ci-native-writer-b-approved.json'))
 if((Hash-Bytes $stored) -cne $ScopeSha256){Stop-N 'NATIVE_POLICY_STAGING_READBACK_STOP'}
 # Same-volume no-overwrite rename: failed/terminated stage remains inspectable.
 [IO.Directory]::Move($staging,$root)
 Plain-Path $root
 $aclText=Exact-Acl $root $scopeAcl
 if((Hash-Bytes ([IO.File]::ReadAllBytes([IO.Path]::Combine($root,'ci-native-writer-b-approved.json')))) -cne $ScopeSha256){
  Stop-N 'NATIVE_POLICY_FINAL_READBACK_STOP'
 }
 $report=[ordered]@{host=$hostName;status='SCOPE_INSTALLED_VERIFIED';aclVerified=$true;
  independentOperatorVerified=$true;reservedClaimAbsent=$true;scopeSha256=$ScopeSha256;
  policySha256=(Hash-Bytes ([Text.Encoding]::UTF8.GetBytes(($p|ConvertTo-Json -Depth 30 -Compress))));
  aclSha256=(Hash-Bytes ([Text.Encoding]::UTF8.GetBytes($aclText)));observedAt=[DateTime]::UtcNow.ToString('o')}
 Write-Once ([IO.Path]::Combine($root,'installation-observation.json')) ([Text.Encoding]::UTF8.GetBytes(($report|ConvertTo-Json -Compress))) $true
 Write-Once $OutputFile ([Text.Encoding]::UTF8.GetBytes(($report|ConvertTo-Json -Compress)))
 Write-Output 'status=SCOPE_INSTALLED_VERIFIED'
 Write-Output 'variablesEnabled=false;dispatched=false;writerChanged=false'
 exit 0
}catch{
 $code=[string]$_.Exception.Message
 if($code -notmatch '^NATIVE_POLICY_[A-Z_]+$'){$code='NATIVE_POLICY_STATE_UNKNOWN'}
 Write-Output ('status=STOPPED;code='+$code)
 # Never delete partial state or retry a rename/write automatically.
 exit 1
}
