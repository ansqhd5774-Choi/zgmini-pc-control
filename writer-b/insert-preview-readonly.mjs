// Reusable A-grade, read-only preview of a pre-approved Writer insertion.
// All filesystem access is injected; the Windows entry binds it to fixed
// Git/Task executables and an exact PC source checkout.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {applyApprovedInsertions,validateInsertions,insertionAnchorIndices} from './insert-only-patch.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const SHA40=/^[a-f0-9]{40}$/i,SHA64=/^[a-f0-9]{64}$/i;
const ROOT=/^E:\\ZGmini\\projects\\[a-z0-9][a-z0-9._-]{0,79}(?:\\[a-z0-9][a-z0-9._-]{0,79}){0,2}$/i;
// Keep the established scripts/pc-writer preview scope unchanged.
// R54 needs two fixed shared modules for a source-only SHA preview. Do not
// widen this read-only capability to arbitrary lib/worker paths.
const FILE=/^scripts\/pc-writer\/[a-z0-9][a-z0-9._-]{0,127}\.mjs$/i;
const R54_PREVIEW_FILES=new Set([
 'lib/market-score/composite-model-r1.mjs',
 'worker/market-operational-store.mjs',
]);
export const approvedPreviewFile=value=>typeof value==='string'&&
 (FILE.test(value)||R54_PREVIEW_FILES.has(value));
export const PREVIEW_SCHEMA='ZGMINI_WRITER_B_INSERT_PREVIEW_SPEC_V1';
export const sha256=b=>createHash('sha256').update(b).digest('hex');

export function validatePreviewSpec(spec){
 need(spec&&typeof spec==='object'&&!Array.isArray(spec)&&
  Object.keys(spec).length===6&&
  ['schema','sourceRoot','baseHead','filePath','beforeSha256','insertions']
   .every(k=>Object.hasOwn(spec,k))&&
  spec.schema===PREVIEW_SCHEMA&&ROOT.test(spec.sourceRoot??'')&&
  SHA40.test(spec.baseHead??'')&&approvedPreviewFile(spec.filePath)&&
  !spec.filePath.includes('..')&&SHA64.test(spec.beforeSha256??''),
  'WRITER_B_PREVIEW_SPEC_STOP');
 validateInsertions(spec.insertions);
 return spec;
}

// The returned result contains only identity, bounded digests, and counts.
// It never returns original source, config, Task XML, or insertion text.
export function previewWriterInsertions(spec,{
 canonicalize,head,configSource,isTargetClean,readTarget,taskXml
}={}){
 validatePreviewSpec(spec);
 need([canonicalize,head,configSource,isTargetClean,readTarget,taskXml]
  .every(x=>typeof x==='function'),'WRITER_B_PREVIEW_DEPENDENCIES_STOP');
 const root=canonicalize(spec.sourceRoot);
 need(root.toLowerCase()===spec.sourceRoot.toLowerCase(),
  'WRITER_B_PREVIEW_SOURCE_ROOT_STOP');
 need(head(root)===spec.baseHead&&configSource()===spec.baseHead,
  'WRITER_B_PREVIEW_SOURCE_HEAD_STOP');
 need(isTargetClean(root,spec.filePath)===true,
  'WRITER_B_PREVIEW_DIRTY_TARGET_STOP');
 const source=readTarget(root,spec.filePath);
 need(Buffer.isBuffer(source)&&sha256(source)===spec.beforeSha256,
  'WRITER_B_PREVIEW_PREIMAGE_SHA_STOP');
 let projected;
 try{projected=applyApprovedInsertions(source,spec.insertions,{filePath:spec.filePath});}
 catch(error){
  if(error?.code!=='WRITER_B_INSERT_ANCHOR_MATCH_STOP')throw error;
  // Bounded cardinality only, never source lines, URL, keys, or anchor text.
  // These counts are diagnostic and cannot authorize a looser insertion.
  const lines=source.toString('utf8').split(/\r\n|\n/);
  const anchorEvidence=spec.insertions.map((op,index)=>({
   index,
   exactCount:Math.min(3,insertionAnchorIndices(lines,op.anchor,{filePath:spec.filePath}).length),
   trimmedCount:Math.min(3,op.anchor.startsWith('@zgmini:sec-core:')
    ?insertionAnchorIndices(lines,op.anchor,{filePath:spec.filePath}).length
    :lines.filter(line=>line.trim()===op.anchor.trim()).length)
  }));
  return {status:'BLOCKED',code:error.code,filePath:spec.filePath,
   baseHead:spec.baseHead,beforeSha256:spec.beforeSha256,anchorEvidence,
   evidenceLevel:'PC_EXACT_PREIMAGE_ANCHOR_CARDINALITY_ONLY',
   pcSourceWrites:0,taskWrites:0,dbWrites:0,d1Writes:0,providerCalls:0};
 }
 const xml=taskXml();
 need(Buffer.isBuffer(xml)&&xml.length>=5&&xml.length<=200_000,
  'WRITER_B_PREVIEW_TASK_XML_STOP');
 return {status:'PASS_READONLY',code:'WRITER_B_INSERT_PREVIEW_VERIFIED',
  filePath:spec.filePath,baseHead:spec.baseHead,
  beforeSha256:spec.beforeSha256,afterSha256:sha256(projected),
  taskXmlSha256:sha256(xml),insertions:spec.insertions.length,
  evidenceLevel:'PC_CANDIDATE_FILE_HASH_AND_TASK_XML_READONLY',
  pcSourceWrites:0,taskWrites:0,dbWrites:0,d1Writes:0,providerCalls:0};
}
