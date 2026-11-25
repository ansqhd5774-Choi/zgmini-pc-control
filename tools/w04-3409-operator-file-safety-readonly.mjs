// Fixed #3409 operator preflight-file diagnosis, A-grade read-only.
// Reflect the existing operator readStrict() predicate without weakening it.
// No free-form paths, contents, user identity, or lease writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readFixedReadonlyBytes} from '../controller/fixed-readonly-bytes.mjs';

export const MAINTENANCE='E:/ZGmini/automation/pc-maintenance';
const SAFE_REL=new Set([
 'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
 'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
 'tools/update.mjs','tools/maintenance-ancestry.vbs',
 'tools/source-bundle-register.mjs'
]);
const label=(stat,maxBytes)=>{
 if(!stat.isFile()||stat.isSymbolicLink())return 'NOT_REGULAR_OR_LINK';
 if(!Number.isSafeInteger(stat.size)||stat.size<=0||stat.size>maxBytes)
  return 'SIZE_INVALID';
 if(stat.nlink!==1)return 'LINK_COUNT_REJECTED';
 return 'SAFE_BY_EXISTING_PREDICATE';
};
export function classify3409OperatorReadStrictFile(file,maxBytes,{stat=fs.lstatSync}={}){
 try{return label(stat(file),maxBytes);}
 catch(e){return e?.code==='ENOENT'?'FILE_MISSING':'STAT_UNVERIFIED';}
}
const unknown=code=>({
 schema:'ZGMINI_W04_3409_OPERATOR_FILE_DIAG_V1',
 status:'UNVERIFIED',code,firstReject:null,files:[],
 operationalWrites:0,providerCalls:0,d1Writes:0
});
export function inspect3409OperatorFileSafetyReadonly({
 root=MAINTENANCE,fileSystem=fs,read=readFixedReadonlyBytes
}={}){
 const manifestPath=path.join(root,'MAINTENANCE_INSTALL.json');
 const manifestState=classify3409OperatorReadStrictFile(manifestPath,32768,
  {stat:p=>fileSystem.lstatSync(p)});
 let manifest;
 try{
  const x=read(manifestPath,{verifiedRoot:root,minBytes:1,maxBytes:32768});
  if(x?.ok!==true||!Buffer.isBuffer(x.bytes))
   return {...unknown('OPERATOR_MANIFEST_READ_UNVERIFIED'),
    firstReject:manifestState==='SAFE_BY_EXISTING_PREDICATE'?null:
     'INSTALL_MANIFEST'};
  manifest=JSON.parse(x.bytes.toString('utf8'));
 }catch{
  return {...unknown('OPERATOR_MANIFEST_PARSE_UNVERIFIED'),
   firstReject:manifestState==='SAFE_BY_EXISTING_PREDICATE'?null:'INSTALL_MANIFEST'};
 }
 const files=Object.keys(manifest?.files??{});
 if(manifest?.schema!=='ZGMINI_PC_MAINTENANCE_INSTALL_V1'||
  files.length<6||files.length>9||
  files.some(name=>!SAFE_REL.has(name)))
  return unknown('OPERATOR_MANIFEST_FILE_SCOPE_UNVERIFIED');
 const candidates=[
  {key:'INSTALL_MANIFEST',state:manifestState},
  ...files.map(rel=>({key:rel,state:classify3409OperatorReadStrictFile(
   path.join(root,rel),131072,{stat:p=>fileSystem.lstatSync(p)})}))
 ];
 // Additional fixed-path readback for the corrected one-click packet.
 // This is an A-grade observation, NOT the C-grade independent ancestry proof.
 // The original diagnostic above is retained unchanged for prior evidence.
 const inspected=files.map(rel=>{
  const file=path.join(root,rel);
  const maxBytes=rel==='tools/update.mjs'?262144:131072;
  const state=classify3409OperatorReadStrictFile(file,maxBytes,
   {stat:p=>fileSystem.lstatSync(p)});
  if(state!=='SAFE_BY_EXISTING_PREDICATE')return {key:rel,state};
  if(!/^[a-f0-9]{64}$/.test(manifest.files[rel]??''))
   return {key:rel,state:'MANIFEST_DIGEST_INVALID'};
  try{
   const result=read(file,{verifiedRoot:root,minBytes:1,maxBytes});
   if(result?.ok!==true||!Buffer.isBuffer(result.bytes))
    return {key:rel,state:'FILE_READ_UNVERIFIED'};
   const observed=createHash('sha256').update(result.bytes).digest('hex');
   return {key:rel,state:observed===manifest.files[rel]
    ?'MANIFEST_HASH_MATCH':'MANIFEST_HASH_MISMATCH'};
  }catch{return {key:rel,state:'FILE_READ_UNVERIFIED'};}
 });
 const first=inspected.find(x=>x.state!=='MANIFEST_HASH_MATCH');
 const correctedPacketReadback={
  status:first?'PREFLIGHT_UNVERIFIED':'PREFLIGHT_FILE_BYTES_MATCH',
  code:first?'OPERATOR_PACKET_FILE_READBACK_REJECTED':'OPERATOR_PACKET_FILE_READBACK_MATCH',
  firstReject:first?.key??null,
  files:inspected,
  // This is the installed file size, not document contents or a credential.
  observedUpdateBytes:(()=>{
   try{
    const st=fileSystem.lstatSync(path.join(root,'tools/update.mjs'));
    return Number.isSafeInteger(st.size)?st.size:null;
   }catch{return null;}
  })(),
  operationalWrites:0
 };
 const bad=candidates.find(x=>x.state!=='SAFE_BY_EXISTING_PREDICATE');
 return {schema:'ZGMINI_W04_3409_OPERATOR_FILE_DIAG_V1',
  status:bad?'PREFLIGHT_REJECTED':'PREFLIGHT_FILES_OK',
  code:bad?'OPERATOR_FILE_PRECHECK_REJECTED':'OPERATOR_FILE_PREDICATES_MATCH',
  firstReject:bad?.key??null,files:candidates,correctedPacketReadback,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}
