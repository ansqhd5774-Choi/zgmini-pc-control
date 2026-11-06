// Immutable, local-only synthetic overlay provenance. This is not a remote
// GitHub commit publication and must never try to push the prepared commit.
import fs from 'node:fs';
import {sha256,assertAuthenticatedWriterBIssue} from './contract.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};

export function buildLocalOverlayProvenance({auth,prepared,baseTreeOid,preparedTreeOid}){
 assertAuthenticatedWriterBIssue(auth);
 const m=auth.manifest;
 need(SHA40.test(baseTreeOid??'')&&SHA40.test(preparedTreeOid??'')&&
  baseTreeOid!==preparedTreeOid&&SHA40.test(prepared?.sha??'')&&
  prepared.sha!==m.baseHead&&prepared.parent===m.baseHead&&
  prepared.sourceRef===`refs/heads/writer-b/${auth.requestId}`&&
  Array.isArray(prepared.changedPaths)&&
  prepared.changedPaths.length===m.files.length&&
  m.files.every(f=>prepared.changedPaths.includes(f.path)&&
   prepared.sha256?.[f.path]===f.afterSha256)&&
  SHA64.test(auth.manifestSha256??''),
  'WRITER_B_LOCAL_PROVENANCE_CONTRACT_STOP');
 const record={schema:'ZGMINI_PC_WRITER_B_LOCAL_OVERLAY_PROVENANCE_V1',
  mode:'LOCAL_OVERLAY',localOnly:true,
  requestId:auth.requestId,manifestSha:auth.manifestSha256,
  baseHead:m.baseHead,baseTreeOid,candidateSourceSha:m.candidateSourceSha,
  preparedLocalSha:prepared.sha,preparedTreeOid,localRef:prepared.sourceRef,
  changedPaths:m.files.map(f=>f.path),
  fileHashes:m.files.map(f=>({path:f.path,change:f.change,
   beforeSha256:f.beforeSha256,afterSha256:f.afterSha256})),
 };
 const bytes=Buffer.from(JSON.stringify(record)+'\n','utf8');
 need(bytes.length<=65536,'WRITER_B_LOCAL_PROVENANCE_SIZE_STOP');
 return {record,bytes,sha256:sha256(bytes)};
}

export function writeImmutableLocalProvenance({file,bytes,fsOps=fs}){
 need(typeof file==='string'&&Buffer.isBuffer(bytes)&&
  bytes.length>100&&bytes.length<=65536,
  'WRITER_B_LOCAL_PROVENANCE_WRITE_CONTRACT_STOP');
 // Exclusive create + flush/readback before the coordinator may pause Core.
 const fd=fsOps.openSync(file,'wx');
 try{
  need(fsOps.writeSync(fd,bytes)===bytes.length,
   'WRITER_B_LOCAL_PROVENANCE_WRITE_STOP');
  fsOps.fsyncSync(fd);
 }finally{fsOps.closeSync(fd);}
 need(fsOps.readFileSync(file).equals(bytes),
  'WRITER_B_LOCAL_PROVENANCE_READBACK_STOP');
 return sha256(bytes);
}
