// Fixed C996 R5 read-only ACL discovery. Never changes ownership, DACL or token.
// Do not publish identities, raw security descriptors, paths or exception text.
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export const ACL_IDS=Object.freeze(['OWNER_PROFILE','OWNER_TEMP','R5_ROOT','ISO_ATTEMPT']);
const PS_EXE='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
function fixedPowerShell(paths){
 const assignments=ACL_IDS.map((id,i)=>{
  const literal=paths[i].replaceAll("'","''");
  return "  @('"+id+"','"+literal+"')";
 }).join(",\n");
 return [
  "$ErrorActionPreference='Stop'",
  "$owner='ansqh'",
  "$name=[Security.Principal.WindowsIdentity]::GetCurrent().Name",
  "$matchesOwner=($name -ieq $owner -or $name.EndsWith('\\'+$owner,[StringComparison]::OrdinalIgnoreCase))",
  "$entries=@(",
  assignments,
  ")",
  "$out=@()",
  "foreach($e in $entries){",
  " $state='UNAVAILABLE'",
  " try {",
  "  $null=Get-Acl -LiteralPath $e[1] -ErrorAction Stop",
  "  $state='ACL_READABLE'",
  " } catch {",
  "  if($_.Exception -is [System.UnauthorizedAccessException] -or",
  "   $_.CategoryInfo.Category -eq [System.Management.Automation.ErrorCategory]::PermissionDenied){",
  "   $state='ACCESS_DENIED'",
  "  } elseif($_.Exception -is [System.Management.Automation.ItemNotFoundException]){",
  "   $state='NOT_FOUND'",
  "  }",
  " }",
  " $out+=@{id=$e[0];status=$state}",
  "}",
  "@{schema='C996_R5_ACL_BOUNDARY_V1';runnerUserMatchesFixedOwner=[bool]$matchesOwner;entries=$out}",
  " | ConvertTo-Json -Compress -Depth 4",
 ].join("\n");
}
export function parseAclBoundary(output){
 let v;
 try{v=JSON.parse(output)}catch{return null}
 if(v?.schema!=='C996_R5_ACL_BOUNDARY_V1'||
  typeof v.runnerUserMatchesFixedOwner!=='boolean'||
  !Array.isArray(v.entries)||v.entries.length!==ACL_IDS.length)return null;
 const entries=v.entries.map((x,i)=>{
  if(x?.id!==ACL_IDS[i]||!['ACL_READABLE','ACCESS_DENIED','NOT_FOUND','UNAVAILABLE'].includes(x.status))
   return null;
  return {id:x.id,status:x.status};
 });
 if(entries.some(x=>!x))return null;
 return {schema:'C996_R5_ACL_BOUNDARY_V1',
  runnerUserMatchesFixedOwner:v.runnerUserMatchesFixedOwner,entries};
}
export function probeFixedAclBoundary({
 platform=process.platform,spawn=spawnSync,ownerProfile,ownerTemp,r5Root,attempt
}={}){
 if(platform!=='win32')return {status:'NOT_WINDOWS'};
 const all=[ownerProfile,ownerTemp,r5Root,attempt];
 if(all.some(v=>typeof v!=='string'))return {status:'FIXED_PATHS_INVALID'};
 const fixed='C:\\Users\\ansqh';
 if(path.win32.normalize(ownerProfile).toLowerCase()!==fixed.toLowerCase()||
  !path.win32.normalize(ownerTemp).toLowerCase().startsWith((fixed+'\\').toLowerCase())||
  !path.win32.normalize(r5Root).toLowerCase().startsWith((ownerTemp+'\\').toLowerCase())||
  !path.win32.normalize(attempt).toLowerCase().startsWith((r5Root+'\\').toLowerCase()))
   return {status:'FIXED_PATHS_INVALID'};
 const script=fixedPowerShell(all);
 let child;
 try{
  child=spawn(PS_EXE,['-NoProfile','-NonInteractive','-EncodedCommand',
   Buffer.from(script,'utf16le').toString('base64')],{
   encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:4096,
   shell:false,stdio:['ignore','pipe','ignore']});
 }catch{return {status:'ACL_QUERY_UNAVAILABLE'}}
 if(child?.error||child?.status!==0)return {status:'ACL_QUERY_UNAVAILABLE'};
 const parsed=parseAclBoundary(child.stdout);
 return parsed?{status:'SCOPED_ACL_OBSERVED',...parsed}:{status:'ACL_RESPONSE_INVALID'};
}
