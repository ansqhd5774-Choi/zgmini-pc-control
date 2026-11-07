// One stable A/light Controller receiver. The requester supplies no paths,
// profile IDs, Task names, registry bytes, or trusted hashes.
import fs from 'node:fs';
import path from 'node:path';
import {inspectApprovedRuntimeRegistry} from './approved-runtime-inventory-readonly.mjs';

// A fixed external B-owned registry, not a file under the Controller checkout.
// New profiles update registry + B-approved PIN, never Controller source files.
const MANIFEST_RELATIVE=['pc-writer','controller-approvals',
 'approved-runtime-inventory-profiles.json'];
const PIN=/^[a-f0-9]{64}$/;
const blocked=code=>({status:'BLOCKED',code,actualExecutionSha:null,
 operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false,
 mutationStarted:false,affectedScope:'OWN_REQUEST_ONLY'});

/**
 * Only the installed Controller passes `host` and `dataRoot`.
 * `host.approvedRuntimeInventorySha256` is B-approved local host state and
 * MUST be maintained independently of registry file content and Issue JSON.
 * No other `host` property is treated as a selectable path or operation.
 */
export function runApprovedRuntimeInventory({request,dataRoot,host,queryTask}={}){
 if(!PIN.test(host?.approvedRuntimeInventorySha256??''))
  return blocked('APPROVED_INVENTORY_NOT_REGISTERED');
 // Constant trusted-data-root-relative target; no Issue/host path selection.
 if(typeof dataRoot!=='string' || !path.isAbsolute(dataRoot))
  return blocked('APPROVED_INVENTORY_REGISTRY_UNAVAILABLE');
 let root;
 try{root=fs.realpathSync(dataRoot);}catch{
  return blocked('APPROVED_INVENTORY_REGISTRY_UNAVAILABLE');
 }
 let dir=root;
 for(const segment of MANIFEST_RELATIVE.slice(0,-1)){
  dir=path.join(dir,segment);
  let entry;
  try{entry=fs.lstatSync(dir);}catch(error){
   return blocked(error.code==='ENOENT'?'APPROVED_INVENTORY_REGISTRY_ABSENT':
    'APPROVED_INVENTORY_REGISTRY_UNAVAILABLE');
  }
  if(entry.isSymbolicLink() || !entry.isDirectory())
   return blocked('APPROVED_INVENTORY_REGISTRY_INVALID');
  let real;
  try{real=fs.realpathSync(dir);}catch{
   return blocked('APPROVED_INVENTORY_REGISTRY_UNAVAILABLE');
  }
  if(process.platform==='win32'?real.toLowerCase()!==dir.toLowerCase():real!==dir)
   return blocked('APPROVED_INVENTORY_REGISTRY_INVALID');
 }
 const target=path.join(root,...MANIFEST_RELATIVE);
 let entry;
 try{entry=fs.lstatSync(target);}catch(error){
  return blocked(error.code==='ENOENT'?'APPROVED_INVENTORY_REGISTRY_ABSENT':
   'APPROVED_INVENTORY_REGISTRY_UNAVAILABLE');
 }
 if(!entry.isFile() || entry.isSymbolicLink() || entry.size>128*1024 || entry.size<16)
  return blocked('APPROVED_INVENTORY_REGISTRY_INVALID');
 try{
  const real=fs.realpathSync(target);
  const relative=path.relative(root,real);
  if(relative.startsWith('..') || path.isAbsolute(relative) ||
     (process.platform==='win32' ? real.toLowerCase()!==target.toLowerCase() : real!==target))
   return blocked('APPROVED_INVENTORY_REGISTRY_INVALID');
  const bytes=fs.readFileSync(target);
  const inventory=inspectApprovedRuntimeRegistry({dataRoot,queryTask,manifestBytes:bytes,
   approvedManifestSha256:host.approvedRuntimeInventorySha256,requestIdentity:request});
  return {...inventory,status:'PASS',actualExecutionSha:null};
 }catch(error){
  const code=String(error?.code??'');
  if(code==='INVENTORY_MANIFEST_APPROVAL_MISMATCH')
   return blocked('APPROVED_INVENTORY_REGISTRY_DRIFT');
  if(code==='INVENTORY_REPORT_OVERSIZED')
   return blocked('APPROVED_INVENTORY_REPORT_TOO_LARGE');
  if(code==='INVENTORY_SOURCE_UNREGISTERED')
   return blocked('APPROVED_INVENTORY_SOURCE_UNREGISTERED');
  if(code==='INVENTORY_PROFILE_SELECTION_OVERSIZED')
   return blocked('APPROVED_INVENTORY_SELECTION_TOO_LARGE');
  if(code==='INVENTORY_REPARSE_OR_TYPE_DENIED')
   return blocked('APPROVED_INVENTORY_PATH_PROTECTION_STOP');
  return blocked('APPROVED_INVENTORY_REGISTRY_INVALID');
 }
}
