// Fixed R10 A/light inventory of two executable-source bytes. No source loading,
// provider access, SQLite, D1 or task mutation. A Task chain inferred from
// script text is not proof of the actually running Core process.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectPcSource} from './pc-source-readonly.mjs';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';

export const R10_SOURCE_FILES=Object.freeze([
 'lib/diagnostic-layer/asset-bubble-r10-raw-evidence-r1.mjs',
 'worker/asset-bubble-r10-raw-r1.mjs',
]);
const SHA40=/^[a-f0-9]{40}$/;
const MAX_FILE_BYTES=1_048_576;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(root,file)=>{
 const relative=path.relative(root,file);
 return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)
  &&!path.isAbsolute(relative);
};
const safeSha=x=>typeof x==='string'&&SHA40.test(x)?x:null;

function readApprovedSha(dataRoot,{fileSystem=fs}={}){
 const p=path.join(dataRoot,'pc-writer','config.json');
 const read=readFixedReadonlyBytes(p,{fileSystem,verifiedRoot:dataRoot,
  minBytes:2,maxBytes:65_536});
 if(!read.ok)return null;
 try{
  const config=JSON.parse(read.bytes.toString('utf8'));
  return safeSha(config?.source);
 }catch{return null;}
}

/** Tests may inject the existing source inspector, FS and platform gate.
 *  Production always passes only the fixed dataRoot and Core Task XML.
 */
export function inspectAssetR10SourceBytes(dataRoot,{coreTaskXml,
 fileSystem=fs,inspectSource=inspectPcSource,strictPlatform=true}={}){
 const result={status:'BLOCKED',code:'ASSET_R10_SOURCE_PATH_UNVERIFIED',
  evidenceLevel:'READONLY_SOURCE_BYTES_NOT_LIVE_PROCESS',
  pcOperationalApprovedSha:null,lastWriterSourceSha:null,
  coreTaskSourceLinked:false,runtimeSourceVerified:false,
  sourceCandidate:null,files:R10_SOURCE_FILES.map(file=>({path:file,
   exists:false,sha256:null})),sourceIdentityConsistent:false,
  operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return result;
 if(strictPlatform&&process.platform!=='win32')return result;
 let data,root;
 try{
  data=fileSystem.realpathSync.native(dataRoot);
  root=path.dirname(data);
  if(path.basename(data).toLowerCase()!=='data'||
    path.basename(root).toLowerCase()!=='zgmini'||
    (strictPlatform&&path.parse(root).root.toLowerCase()!=='e:\\'))return result;
 }catch{return result;}
 result.pcOperationalApprovedSha=readApprovedSha(data,{fileSystem});
 let trace;
 try{trace=inspectSource({dataRoot:data,coreTaskXml});}
 catch{return {...result,code:'ASSET_R10_TASK_TRACE_UNVERIFIED'};}
 const writer=trace?.lastWriterEvidence;
 result.lastWriterSourceSha=safeSha(writer?.sourceHead);
 const direct=trace?.sourceResolved===true&&safeSha(trace?.sourceHead);
 const historical=trace?.historicalCheckoutCandidate;
 const candidate=direct?{
  sourceRoot:trace.sourceRoot,head:trace.sourceHead,
  clean:Array.isArray(trace.trackedDirty)&&trace.trackedDirty.length===0,
  type:'CORE_TASK_STATIC_CHAIN',
 }:historical?.gitVerified===true&&safeSha(historical.head)?{
  sourceRoot:historical.sourceRoot,head:historical.head,
  clean:historical.trackedDirty===false,
  type:'HISTORICAL_CHECKOUT_ONLY',
 }:null;
 result.coreTaskSourceLinked=!!direct;
 if(!candidate||typeof candidate.sourceRoot!=='string'||
  !/^projects\/[A-Za-z0-9_.\-/]+$/.test(candidate.sourceRoot)||
  candidate.sourceRoot.split('/').includes('..')){
  result.code='ASSET_R10_CHECKOUT_NOT_RESOLVED';return result;
 }
 const selected=path.resolve(root,...candidate.sourceRoot.split('/'));
 let real;
 try{
  real=fileSystem.realpathSync.native(selected);
  if(!inside(root,real)||!fileSystem.statSync(real).isDirectory())
   throw Error('OUTSIDE');
 }catch{result.code='ASSET_R10_CHECKOUT_PATH_UNVERIFIED';return result;}
 result.sourceCandidate={type:candidate.type,
  path:candidate.sourceRoot,head:candidate.head,trackedClean:candidate.clean};
 result.sourceIdentityConsistent=Boolean(candidate.clean&&
  result.pcOperationalApprovedSha===candidate.head&&
  result.lastWriterSourceSha===candidate.head&&writer?.status==='VERIFIED');
 result.files=R10_SOURCE_FILES.map(relative=>{
  const file=path.join(real,...relative.split('/'));
  try{
   const read=readFixedReadonlyBytes(file,{fileSystem,verifiedRoot:real,
    maxBytes:MAX_FILE_BYTES});
   if(!read.ok)throw Error('UNSAFE');
   return {path:relative,exists:true,sha256:sha256(read.bytes)};
  }catch{return {path:relative,exists:false,sha256:null};}
 });
 result.status='PASS';
 result.code='ASSET_R10_SOURCE_BYTES_READONLY';
 return result;
}

