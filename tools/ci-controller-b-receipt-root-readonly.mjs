// Existing isolated Runner A probe: observe the configured CI Controller B receipt
// directory without creating files, asserting write permission or returning paths.
// A single read cannot establish cross-run durability or B publication authority.
import fs from 'node:fs';
import path from 'node:path';

const base=Object.freeze({
 schema:'ZGMINI_CI_CONTROLLER_B_RECEIPT_ROOT_READONLY_V1',
 configured:false,directoryPresent:false,readable:false,
 writableVerified:false,durableAcrossRunsVerified:false,
 executionAuthorized:false,operationalWrites:0,providerCalls:0,d1Writes:0,
});
const result=(status,code,extra={})=>({...base,status,code,...extra});
const within=(parent,child)=>{
 const p=path.win32.normalize(parent).toLowerCase().replace(/[\\/]+$/,'');
 const c=path.win32.normalize(child).toLowerCase().replace(/[\\/]+$/,'');
 return c===p||c.startsWith(p+'\\');
};
export function inspectCiControllerBReceiptRootReadonly({
 root,volatileRoots=[],filesystem=fs,platform=process.platform
}={}){
 if(platform!=='win32')return result('BLOCKED','CI_RECEIPT_WINDOWS_REQUIRED');
 if(typeof root!=='string'||root.length===0)
  return result('STATE_UNKNOWN','CI_RECEIPT_ROOT_NOT_CONFIGURED');
 if(root.length>260||root.includes('\0')||root.includes('"')||
    !/^[a-zA-Z]:[\\/]/.test(root)||!path.win32.isAbsolute(root))
  return result('BLOCKED','CI_RECEIPT_ROOT_PATH_UNSAFE',{configured:true});
 const normalized=path.win32.normalize(root);
 if(path.win32.parse(normalized).root.toLowerCase()===normalized.toLowerCase())
  return result('BLOCKED','CI_RECEIPT_ROOT_PATH_UNSAFE',{configured:true});
 if(volatileRoots.some(p=>typeof p==='string'&&p.length>0&&
   path.win32.isAbsolute(p)&&within(p,normalized)))
  return result('BLOCKED','CI_RECEIPT_ROOT_VOLATILE',{configured:true});
 try{
  let current=normalized;
  // Reject aliases at the leaf and every existing parent, including junctions.
  for(;;){
   const stat=filesystem.lstatSync(current);
   if(!stat.isDirectory()||stat.isSymbolicLink())
    return result('BLOCKED','CI_RECEIPT_ROOT_PATH_ALIAS',{configured:true});
   const parent=path.win32.dirname(current);
   if(parent===current)break;
   current=parent;
  }
  const real=typeof filesystem.realpathSync.native==='function'
   ?filesystem.realpathSync.native(normalized)
   :filesystem.realpathSync(normalized);
  if(path.win32.normalize(real).toLowerCase()!==normalized.toLowerCase())
   return result('BLOCKED','CI_RECEIPT_ROOT_PATH_ALIAS',{configured:true});
  filesystem.readdirSync(normalized); // No filenames are returned or logged.
  return result('PARTIAL','CI_RECEIPT_ROOT_DIRECTORY_PRESENT_READONLY',{
   configured:true,directoryPresent:true,readable:true});
 }catch(error){
  return result('STATE_UNKNOWN',
   error?.code==='ENOENT'?'CI_RECEIPT_ROOT_DIRECTORY_ABSENT':
   'CI_RECEIPT_ROOT_READ_UNVERIFIED',{configured:true});
 }
}
