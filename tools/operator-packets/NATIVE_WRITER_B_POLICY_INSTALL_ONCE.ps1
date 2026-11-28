#Requires -Version 5.1
# Independent elevated Owner only; never run in Actions or a Runner.
# First provisioning or exact, still-unactivated #4135 transport transition. Does not enable variables, dispatch, install Writer,
# change existing ACLs, stop processes, or modify any Task/Controller/data.
param(
 [Parameter(Mandatory=$true)][string]$ScopeFile,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ScopeSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^S-1-5-21-[0-9-]+$')][string]$RunnerSid,
 [Parameter(Mandatory=$true)][string]$OutputFile,
 [string]$ProofFile,
 [ValidatePattern('^[a-f0-9]{64}$')][string]$TransitionFromScopeSha256,
 [switch]$Apply
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# The reversible interval starts only after both exact directory renames succeed.
$transitionSwapped=$false
$transitionCommitted=$false
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
function New-PolicyFileAcl {
  # Set protected DACL AND administrator ownership at creation, not afterward.
  $security=[Security.AccessControl.FileSecurity]::new()
  $security.SetAccessRuleProtection($true,$false)
  $security.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
  foreach($entry in @(@('S-1-5-18','FullControl'),@('S-1-5-32-544','FullControl'),@($RunnerSid,'ReadAndExecute'))){
   $rule=[Security.AccessControl.FileSystemAccessRule]::new(
    [Security.Principal.SecurityIdentifier]::new($entry[0]),
    [Security.AccessControl.FileSystemRights]$entry[1],[Security.AccessControl.AccessControlType]::Allow)
   [void]$security.AddAccessRule($rule)
  }
  return $security
}
function Write-Once([string]$p,[byte[]]$bytes,[bool]$TrustedPolicyFile=$false){
 if($TrustedPolicyFile){
  $security=New-PolicyFileAcl
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
 if($ProofFile -and $TransitionFromScopeSha256){Stop-N 'NATIVE_POLICY_TRANSITION_MODE_STOP'}
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
 $transition=[bool]$TransitionFromScopeSha256
 $backup=$null
 function Restore-VerifiedTransitionPreimage {
  # A failed post-swap report is not a new grant. Never remove either tree.
  # The new tree is preserved separately, and the old one is restored only
  # when exact ACL, bytes, unconsumed claims and both roots can be re-read.
  if(Test-Path -LiteralPath $OutputFile){Stop-N 'NATIVE_POLICY_TRANSITION_RESULT_EXISTS_STOP'}
  if(-not (Test-Path -LiteralPath $root) -or -not (Test-Path -LiteralPath $backup)){
   Stop-N 'NATIVE_POLICY_TRANSITION_RECOVERY_REQUIRED'
  }
  $quarantine=$root+'.failed-'+$ScopeSha256
  if(Test-Path -LiteralPath $quarantine){Stop-N 'NATIVE_POLICY_TRANSITION_RECOVERY_REQUIRED'}
  Plain-Path $root
  Plain-Path $backup
  [void](Exact-Acl $root $scopeAcl)
  [void](Exact-Acl $backup $scopeAcl)
  $newNames=@(Get-ChildItem -LiteralPath $root -Force | ForEach-Object {$_.Name} | Sort-Object)
  if(($newNames -join '|') -cne 'ci-native-writer-b-approved.json' -and
     ($newNames -join '|') -cne 'ci-native-writer-b-approved.json|installation-observation.json'){
   Stop-N 'NATIVE_POLICY_TRANSITION_NEW_STATE_DRIFT_STOP'
  }
  $oldNames=@(Get-ChildItem -LiteralPath $backup -Force | ForEach-Object {$_.Name} | Sort-Object)
  if(($oldNames -join '|') -cne 'ci-native-writer-b-approved.json|installation-observation.json'){
   Stop-N 'NATIVE_POLICY_TRANSITION_BACKUP_DRIFT_STOP'
  }
  $newScope=[IO.Path]::Combine($root,'ci-native-writer-b-approved.json')
  $oldScope=[IO.Path]::Combine($backup,'ci-native-writer-b-approved.json')
  $oldObservation=[IO.Path]::Combine($backup,'installation-observation.json')
  foreach($file in @($newScope,$oldScope,$oldObservation)){
   $item=Get-Item -LiteralPath $file -Force
   if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
      $item.Length -lt 2 -or $item.Length -gt 131072){
    Stop-N 'NATIVE_POLICY_TRANSITION_FILE_DRIFT_STOP'
   }
   [void](Exact-Acl $file (New-PolicyFileAcl))
  }
  if((Hash-Bytes ([IO.File]::ReadAllBytes($newScope))) -cne $ScopeSha256 -or
     (Hash-Bytes ([IO.File]::ReadAllBytes($oldScope))) -cne $TransitionFromScopeSha256){
   Stop-N 'NATIVE_POLICY_TRANSITION_SCOPE_CAS_STOP'
  }
  $observed=Get-Content -LiteralPath $oldObservation -Raw|ConvertFrom-Json
  if($observed.host -cne $hostName -or $observed.status -cne 'SCOPE_INSTALLED_VERIFIED' -or
     $observed.scopeSha256 -cne $TransitionFromScopeSha256 -or
     $observed.aclVerified -ne $true -or $observed.reservedClaimAbsent -ne $true){
   Stop-N 'NATIVE_POLICY_TRANSITION_BACKUP_OBSERVATION_DRIFT_STOP'
  }
  if($newNames.Count -eq 2){
   $newObservation=[IO.Path]::Combine($root,'installation-observation.json')
   $item=Get-Item -LiteralPath $newObservation -Force
   if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
      $item.Length -lt 2 -or $item.Length -gt 131072){
    Stop-N 'NATIVE_POLICY_TRANSITION_NEW_OBSERVATION_DRIFT_STOP'
   }
   [void](Exact-Acl $newObservation (New-PolicyFileAcl))
   $state=Get-Content -LiteralPath $newObservation -Raw|ConvertFrom-Json
   if($state.host -cne $hostName -or $state.scopeSha256 -cne $ScopeSha256 -or
      $state.status -cne 'SCOPE_INSTALLED_VERIFIED'){
    Stop-N 'NATIVE_POLICY_TRANSITION_NEW_OBSERVATION_DRIFT_STOP'
   }
  }
  if($hostName -eq 'PC'){
   $live=Get-Content -LiteralPath 'E:\ZGmini\automation\pc-control\host.json' -Raw|ConvertFrom-Json
   if($live.controllerSourceSha -cne $p.installedControllerSha -or
      (Test-Path -LiteralPath 'E:\ZGmini\data\pc-writer\writer-b-install-once\db6a4814-d8ea-5343-9539-cf797835c231')){
    Stop-N 'NATIVE_POLICY_TRANSITION_CLAIM_OR_CONTROLLER_DRIFT_STOP'
   }
  }else{
   [void](Exact-Acl $receiptRoot (New-Acl 'Modify'))
   if(Test-Path -LiteralPath ([IO.Path]::Combine($receiptRoot,
      'native-287c32ba0ae695f2b17176b48bdbf1828797d04e53f5d6d346ae4f66c7b818b4.json'))){
    Stop-N 'NATIVE_POLICY_RESERVED_PUBLISHER_CLAIM_STOP'
   }
  }
  [IO.Directory]::Move($root,$quarantine)
  # If the second rename fails, preserve backup and quarantine for a manual
  # read-only reconcile. Do not silently move an unverified tree back.
  [IO.Directory]::Move($backup,$root)
  Plain-Path $root
  [void](Exact-Acl $root $scopeAcl)
  [void](Exact-Acl ([IO.Path]::Combine($root,'ci-native-writer-b-approved.json')) (New-PolicyFileAcl))
  if((Hash-Bytes ([IO.File]::ReadAllBytes([IO.Path]::Combine($root,
     'ci-native-writer-b-approved.json')))) -cne $TransitionFromScopeSha256){
   Stop-N 'NATIVE_POLICY_TRANSITION_RECOVERY_REQUIRED'
  }
  [void](Exact-Acl $quarantine $scopeAcl)
 }
 function Verify-TransitionPreimage {
  if($TransitionFromScopeSha256 -cne 'df097365ebc641a551f6e0b233ad333662f4ae12b82a2180cfb97637656f5736'){
   Stop-N 'NATIVE_POLICY_TRANSITION_PREIMAGE_STOP'
  }
  Plain-Path $root
  $oldAclText=Exact-Acl $root $scopeAcl
  $names=@(Get-ChildItem -LiteralPath $root -Force | ForEach-Object {$_.Name} | Sort-Object)
  if(($names -join '|') -cne 'ci-native-writer-b-approved.json|installation-observation.json'){
   Stop-N 'NATIVE_POLICY_TRANSITION_EXISTING_STATE_STOP'
  }
  $oldPath=[IO.Path]::Combine($root,'ci-native-writer-b-approved.json')
  $oldObservationPath=[IO.Path]::Combine($root,'installation-observation.json')
  foreach($oldFile in @($oldPath,$oldObservationPath)){
   $item=Get-Item -LiteralPath $oldFile -Force
   if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
    $item.Length -lt 2 -or $item.Length -gt 131072){Stop-N 'NATIVE_POLICY_TRANSITION_FILE_STOP'}
   [void](Exact-Acl $oldFile (New-PolicyFileAcl))
  }
  $oldBytes=[IO.File]::ReadAllBytes($oldPath)
  if((Hash-Bytes $oldBytes) -cne $TransitionFromScopeSha256){Stop-N 'NATIVE_POLICY_TRANSITION_SCOPE_CAS_STOP'}
  $oldScope=[Text.Encoding]::UTF8.GetString($oldBytes)|ConvertFrom-Json
  $old=$oldScope.policy
  $oldPolicyHash=Hash-Bytes ([Text.Encoding]::UTF8.GetBytes(($old|ConvertTo-Json -Depth 30 -Compress)))
  if($oldPolicyHash -cne '03460ff9cc6effa88162bc4369f248a055f2346d9997a2535ee9bba9cbf44828' -or
   $old.nativeWriterBControlSha -cne 'b2dead3c87f88b35f1a05de77d72f33e3a618a10' -or
   $old.sourceHeadSha -cne '55e40e183d5d85fa4897e6449f3c8a13161f9adf' -or
   $old.PSObject.Properties.Name -contains 'nativeWriterBControlMode' -or
   $p.PSObject.Properties.Name -notcontains 'nativeWriterBControlMode' -or
   $p.nativeWriterBControlMode -cne 'PINNED_CHECKOUT_V1' -or
   $p.policyRevision -notmatch '^[a-f0-9]{40}$' -or $p.policyRevision -ceq $old.policyRevision -or
   $p.nativeWriterBAdapterSha256 -notmatch '^[a-f0-9]{64}$' -or $p.nativeWriterBAdapterSha256 -ceq $old.nativeWriterBAdapterSha256 -or
   $p.receiverWorkflowBlobSha -notmatch '^[a-f0-9]{40}$' -or $p.receiverWorkflowBlobSha -ceq $old.receiverWorkflowBlobSha -or
   $scope.approvalBytesBase64 -cne $oldScope.approvalBytesBase64 -or
   $scope.requestBytesBase64 -cne $oldScope.requestBytesBase64){
   Stop-N 'NATIVE_POLICY_TRANSITION_EFFECT_DRIFT_STOP'
  }
  $mutable=@('policyRevision','nativeWriterBControlSha','nativeWriterBAdapterSha256','receiverWorkflowBlobSha')
  if(@($p.PSObject.Properties.Name).Count -ne (@($old.PSObject.Properties.Name).Count+1)){
   Stop-N 'NATIVE_POLICY_TRANSITION_EFFECT_DRIFT_STOP'
  }
  foreach($prop in $old.PSObject.Properties){
   if($p.PSObject.Properties.Name -notcontains $prop.Name -or
     ($prop.Name -notin $mutable -and
       ($prop.Value|ConvertTo-Json -Depth 30 -Compress) -cne ($p.PSObject.Properties[$prop.Name].Value|ConvertTo-Json -Depth 30 -Compress))){
    Stop-N 'NATIVE_POLICY_TRANSITION_EFFECT_DRIFT_STOP'
   }
  }
  $own=Get-Content -LiteralPath $oldObservationPath -Raw|ConvertFrom-Json
  if($own.host -cne $hostName -or $own.status -cne 'SCOPE_INSTALLED_VERIFIED' -or
   $own.scopeSha256 -cne $TransitionFromScopeSha256 -or $own.policySha256 -cne $oldPolicyHash -or
   $own.aclSha256 -cne (Hash-Bytes ([Text.Encoding]::UTF8.GetBytes($oldAclText))) -or
   $own.aclVerified -ne $true -or $own.independentOperatorVerified -ne $true -or $own.reservedClaimAbsent -ne $true){
   Stop-N 'NATIVE_POLICY_TRANSITION_OLD_OBSERVATION_STOP'
  }
 }
 if($transition){Verify-TransitionPreimage}
 elseif(Test-Path -LiteralPath $root){Stop-N 'NATIVE_POLICY_EXISTING_INSTALL_OR_OUTPUT_STOP'}
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
  $receiptAcl=New-Acl 'Modify'
  if($transition){
   Plain-Path $receiptRoot
   [void](Exact-Acl $receiptRoot $receiptAcl)
   if(Test-Path -LiteralPath ([IO.Path]::Combine($receiptRoot,'native-287c32ba0ae695f2b17176b48bdbf1828797d04e53f5d6d346ae4f66c7b818b4.json'))){
    Stop-N 'NATIVE_POLICY_RESERVED_PUBLISHER_CLAIM_STOP'
   }
  }else{
   if(Test-Path -LiteralPath $receiptRoot){Stop-N 'NATIVE_POLICY_RECEIPT_ROOT_EXISTS_STOP'}
   [void][IO.Directory]::CreateDirectory($receiptRoot,$receiptAcl)
   [void](Exact-Acl $receiptRoot $receiptAcl)
  }
 }
 $staging=$root+'.staging-'+[Guid]::NewGuid().ToString()
 [void][IO.Directory]::CreateDirectory($staging,$scopeAcl)
 $aclText=Exact-Acl $staging $scopeAcl
 Write-Once ([IO.Path]::Combine($staging,'ci-native-writer-b-approved.json')) $bytes $true
 $stored=[IO.File]::ReadAllBytes([IO.Path]::Combine($staging,'ci-native-writer-b-approved.json'))
 if((Hash-Bytes $stored) -cne $ScopeSha256){Stop-N 'NATIVE_POLICY_STAGING_READBACK_STOP'}
 # Same-volume no-overwrite rename: failed/terminated stage remains inspectable.
 # For the exact old unactivated scope only, preserve the original directory
 # and its protected observation as a separately named backup. No deletion.
 if($transition){
  Verify-TransitionPreimage
  if($hostName -eq 'PC'){
   $live=Get-Content -LiteralPath 'E:\ZGmini\automation\pc-control\host.json' -Raw|ConvertFrom-Json
   if($live.controllerSourceSha -cne $p.installedControllerSha){Stop-N 'NATIVE_POLICY_CONTROLLER_CAS_STOP'}
   if(Test-Path -LiteralPath 'E:\ZGmini\data\pc-writer\writer-b-install-once\db6a4814-d8ea-5343-9539-cf797835c231'){
    Stop-N 'NATIVE_POLICY_RESERVED_WRITER_CLAIM_STOP'
   }
  }elseif(Test-Path -LiteralPath ([IO.Path]::Combine($receiptRoot,'native-287c32ba0ae695f2b17176b48bdbf1828797d04e53f5d6d346ae4f66c7b818b4.json'))){
   Stop-N 'NATIVE_POLICY_RESERVED_PUBLISHER_CLAIM_STOP'
  }
  $backup=$root+'.backup-'+$TransitionFromScopeSha256
  if(Test-Path -LiteralPath $backup){Stop-N 'NATIVE_POLICY_TRANSITION_BACKUP_EXISTS_STOP'}
  [IO.Directory]::Move($root,$backup)
  try{[IO.Directory]::Move($staging,$root);$transitionSwapped=$true}catch{
   # Restore only the verified original when the new destination is absent.
   if(-not (Test-Path -LiteralPath $root)){
    [void](Exact-Acl $backup $scopeAcl)
    if((Hash-Bytes ([IO.File]::ReadAllBytes([IO.Path]::Combine($backup,'ci-native-writer-b-approved.json')))) -ceq $TransitionFromScopeSha256){
     [IO.Directory]::Move($backup,$root)
    }
   }
   Stop-N 'NATIVE_POLICY_TRANSITION_RENAME_STOP'
  }
 }else{[IO.Directory]::Move($staging,$root)}
 Plain-Path $root
 $aclText=Exact-Acl $root $scopeAcl
 if((Hash-Bytes ([IO.File]::ReadAllBytes([IO.Path]::Combine($root,'ci-native-writer-b-approved.json')))) -cne $ScopeSha256){
  Stop-N 'NATIVE_POLICY_FINAL_READBACK_STOP'
 }
 $report=[ordered]@{host=$hostName;status='SCOPE_INSTALLED_VERIFIED';aclVerified=$true;
  independentOperatorVerified=$true;reservedClaimAbsent=$true;scopeSha256=$ScopeSha256;
  policySha256=(Hash-Bytes ([Text.Encoding]::UTF8.GetBytes(($p|ConvertTo-Json -Depth 30 -Compress))));
  aclSha256=(Hash-Bytes ([Text.Encoding]::UTF8.GetBytes($aclText)));observedAt=[DateTime]::UtcNow.ToString('o')}
 if($transition){
  [void](Exact-Acl $backup $scopeAcl)
  if((Hash-Bytes ([IO.File]::ReadAllBytes([IO.Path]::Combine($backup,'ci-native-writer-b-approved.json')))) -cne $TransitionFromScopeSha256){Stop-N 'NATIVE_POLICY_TRANSITION_BACKUP_READBACK_STOP'}
  $report.Add('previousScopeSha256',$TransitionFromScopeSha256)
  $report.Add('backupVerified',$true)
 }
 Write-Once ([IO.Path]::Combine($root,'installation-observation.json')) ([Text.Encoding]::UTF8.GetBytes(($report|ConvertTo-Json -Compress))) $true
 Write-Once $OutputFile ([Text.Encoding]::UTF8.GetBytes(($report|ConvertTo-Json -Compress)))
 if($transition){$transitionCommitted=$true}
 Write-Output 'status=SCOPE_INSTALLED_VERIFIED'
 Write-Output 'variablesEnabled=false;dispatched=false;writerChanged=false'
 exit 0
}catch{
 $code=[string]$_.Exception.Message
 if($transitionSwapped -and -not $transitionCommitted){
  try{
   Restore-VerifiedTransitionPreimage
   $code='NATIVE_POLICY_TRANSITION_ROLLED_BACK_VERIFIED_STOP'
  }catch{
   $code='NATIVE_POLICY_TRANSITION_RECOVERY_REQUIRED'
  }
 }
 if($code -notmatch '^NATIVE_POLICY_[A-Z_]+$'){$code='NATIVE_POLICY_STATE_UNKNOWN'}
 Write-Output ('status=STOPPED;code='+$code)
 # Never delete partial state or retry a rename/write automatically.
 exit 1
}
