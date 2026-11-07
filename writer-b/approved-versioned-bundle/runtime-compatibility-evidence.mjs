// Offline preflight of a proposed old/new runtime-compatibility transcript.
// STRICTLY SOURCE-ONLY. SHA agreement and self-reported PASS are not proof of
// actual execution. Real activation requires an independently authenticated
// existing Runner/receiver result ledger, which is NOT implemented here.
import {createHash} from 'node:crypto';

export const RUNTIME_PROOF_SCHEMA='ZGMINI_CROSS_VERSION_RUNTIME_PROOF_V1';
const sha=x=>createHash('sha256').update(x).digest('hex');
const SHA64=/^[0-9a-f]{64}$/;
const SHA40=/^[0-9a-f]{40}$/;
const VERSION=/^[0-9a-f]{16}$/;
const FILE=/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*\.(?:mjs|json|md)$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>{const e=Error(code);e.code=code;throw e;};
const need=(yes,code)=>{if(!yes)fail(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exactly=(x,keys,code)=>need(object(x)&&
 Object.keys(x).sort().join('|')===[...keys].sort().join('|'),code);
const asRaw=bytes=>{
 need(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=524288,
  'B_RUNTIME_PROOF_RAW');
 const decoded=bytes.toString('utf8');
 need(Buffer.from(decoded,'utf8').equals(bytes),'B_RUNTIME_PROOF_ENCODING');
 return decoded;
};
const fileInventory=(entries,code)=>{
 need(Array.isArray(entries)&&entries.length>0&&entries.length<=256,code);
 const seen=new Set();let total=0;
 for(const f of entries){
  exactly(f,['path','sha256','bytes'],code);
  need(FILE.test(f.path)&&SHA64.test(f.sha256)&&
   Number.isSafeInteger(f.bytes)&&f.bytes>=0&&
   !seen.has(f.path.toLowerCase())&&
   !f.path.split('/').some(seg=>/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(seg)),code);
  seen.add(f.path.toLowerCase());total+=f.bytes;
 }
 need(total<=33554432,code);
 return new Map(entries.map(f=>[f.path,f]));
};
const verifyDirection=(part,code)=>{
 exactly(part,['writer','reader','fixtureInputSha256','stateAfterWriteSha256',
  'readerObservedSha256','result'],'B_RUNTIME_PROOF_DIRECTION_FIELDS');
 need(['old','new'].includes(part.writer)&&['old','new'].includes(part.reader)&&
  part.writer!==part.reader&&SHA64.test(part.fixtureInputSha256)&&
  SHA64.test(part.stateAfterWriteSha256)&&
  SHA64.test(part.readerObservedSha256)&&
  part.readerObservedSha256===part.stateAfterWriteSha256&&part.result==='READ_OK',code);
};

/**
 * Only existing approved Receiver A/B source may supply `approvedProofSha256`
 * and future Runner ledger provenance. No external writes, code execution,
 * provider calls, signed keys or arbitrary commands are performed here.
 * `readImmutableFile` is OPTIONAL trusted read-only DI for byte comparison.
 * No result from this helper alone may authorize activation.
 */
export async function inspectCrossVersionRuntimeEvidence({
 rawProofBytes,approvedProofSha256,expected,readImmutableFile,
}={}){
 need(SHA64.test(approvedProofSha256??'')&&
  sha(rawProofBytes??Buffer.alloc(0))===approvedProofSha256,
  'B_RUNTIME_PROOF_PIN_MISMATCH');
 let proof;
 try{proof=JSON.parse(asRaw(rawProofBytes));}catch(e){
  if(e?.code)throw e;fail('B_RUNTIME_PROOF_JSON');
 }
 exactly(proof,['schema','identity','closure','crossReads','lock','effects',
  'provenance'],'B_RUNTIME_PROOF_FIELDS');
 need(proof.schema===RUNTIME_PROOF_SCHEMA,'B_RUNTIME_PROOF_SCHEMA');
 exactly(proof.identity,['profileId','oldVersion','newVersion',
  'oldSourceSha','newSourceSha','taskXmlSha256'],
 'B_RUNTIME_PROOF_IDENTITY');
 const id=proof.identity;
 need(id.profileId===expected?.profileId&&
  id.oldVersion===expected?.oldVersion&&
  id.newVersion===expected?.newVersion&&
  id.oldSourceSha===expected?.oldSourceSha&&
  id.newSourceSha===expected?.newSourceSha&&
  id.taskXmlSha256===expected?.taskXmlSha256&&
  VERSION.test(id.oldVersion)&&VERSION.test(id.newVersion)&&
  id.oldVersion!==id.newVersion&&SHA40.test(id.oldSourceSha)&&
  SHA40.test(id.newSourceSha)&&SHA64.test(id.taskXmlSha256),
  'B_RUNTIME_PROOF_IDENTITY_DRIFT');
 exactly(proof.closure,['oldFiles','newFiles','unresolvedDynamicFiles',
  'unresolvedImports','externalRuntimeFiles','analyzerSourceSha'],
 'B_RUNTIME_PROOF_CLOSURE_FIELDS');
 const oldFiles=fileInventory(proof.closure.oldFiles,'B_RUNTIME_PROOF_OLD_FILES');
 const newFiles=fileInventory(proof.closure.newFiles,'B_RUNTIME_PROOF_NEW_FILES');
 need(Array.isArray(proof.closure.unresolvedDynamicFiles)&&
  proof.closure.unresolvedDynamicFiles.length===0&&
  Array.isArray(proof.closure.unresolvedImports)&&
  proof.closure.unresolvedImports.length===0&&
  Array.isArray(proof.closure.externalRuntimeFiles)&&
  proof.closure.externalRuntimeFiles.length===0&&
  SHA40.test(proof.closure.analyzerSourceSha),
  'B_RUNTIME_PROOF_CLOSURE_UNKNOWN');
 for(const [version,files] of [['old',oldFiles],['new',newFiles]]){
  const pinned=expected?.[version+'Files'];
  const approved=fileInventory(pinned,'B_RUNTIME_PROOF_PINNED_FILES');
  for(const [key,entry] of files){
   const ref=approved.get(key);
   need(ref&&ref.sha256===entry.sha256&&ref.bytes===entry.bytes,
    'B_RUNTIME_PROOF_FILE_PIN_DRIFT');
  }
  if(typeof readImmutableFile==='function'){
   for(const entry of files.values()){
    const bytes=await readImmutableFile({version:id[version+'Version'],path:entry.path});
    need(Buffer.isBuffer(bytes)&&bytes.length===entry.bytes&&
     sha(bytes)===entry.sha256,'B_RUNTIME_PROOF_FILE_BYTES_DRIFT');
   }
  }
 }
 need(Array.isArray(proof.crossReads)&&proof.crossReads.length===2,
  'B_RUNTIME_PROOF_CROSS_READS');
 verifyDirection(proof.crossReads[0],'B_RUNTIME_PROOF_CROSS_READS');
 verifyDirection(proof.crossReads[1],'B_RUNTIME_PROOF_CROSS_READS');
 need(proof.crossReads[0].writer==='old'&&proof.crossReads[0].reader==='new'&&
  proof.crossReads[1].writer==='new'&&proof.crossReads[1].reader==='old',
  'B_RUNTIME_PROOF_CROSS_READS');
 exactly(proof.lock,['path','events'],'B_RUNTIME_PROOF_LOCK_FIELDS');
 need(proof.lock.path===expected?.sharedLockPath&&
  JSON.stringify(proof.lock.events)===JSON.stringify([
   'OLD_ACQUIRE_WX','NEW_DENIED_WHILE_OLD_HELD','OLD_RELEASE',
   'NEW_ACQUIRE_WX','OLD_DENIED_WHILE_NEW_HELD','NEW_RELEASE',
  ]),'B_RUNTIME_PROOF_LOCK_INTERLEAVING');
 exactly(proof.effects,['providerCalls','d1Writes','productionDbWrites',
  'externalNetworkCalls'],'B_RUNTIME_PROOF_EFFECT_FIELDS');
 need(Object.values(proof.effects).every(x=>x===0),
  'B_RUNTIME_PROOF_UNSAFE_EFFECT');
 exactly(proof.provenance,['runnerRequestId','runnerResultSha256',
  'harnessSourceSha','runtimeHostFingerprintSha256'],
 'B_RUNTIME_PROOF_PROVENANCE_FIELDS');
 need(UUID.test(proof.provenance.runnerRequestId)&&
  SHA64.test(proof.provenance.runnerResultSha256)&&
  SHA40.test(proof.provenance.harnessSourceSha)&&
  SHA64.test(proof.provenance.runtimeHostFingerprintSha256),
  'B_RUNTIME_PROOF_PROVENANCE_FIELDS');
 const exactClosure=oldFiles.size===newFiles.size&&
  [...oldFiles].every(([path,a])=>{
   const b=newFiles.get(path);return b&&a.sha256===b.sha256&&a.bytes===b.bytes;
  });
 // Hashes and transcript shape cannot prove an actual Runner executed it.
 // Existing trusted Runner result-ledger retrieval+verification is the next
 // integration step. Nothing here grants a B mutation capability.
 return Object.freeze({status:'OFFLINE_FORMAT_ONLY',
  compatibilityCandidate:exactClosure?'IDENTICAL_CLOSURE_FAST_PATH':
   'CROSS_READ_PROOF_CANDIDATE',
  closureByteReadbackVerified:typeof readImmutableFile==='function',
  rawProofSha256:approvedProofSha256,
  trustedRunnerProvenanceVerified:false,
  activationAllowed:false});
}
