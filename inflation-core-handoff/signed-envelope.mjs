// Exact W01 signed transfer envelope. SOURCE-ONLY: no key generation, I/O,
// approval issuance, Task scheduling, or installed signing key is provided.
// A trusted, PINNED receiver must supply a private signing key from its
// existing authorized secure store. Never accept a key from an Issue/manifest.
import {KeyObject,randomUUID,sign,createPrivateKey} from 'node:crypto';
import path from 'node:path';
import {assertAuthenticatedCoreHandoff} from './contract.mjs';
export const W01_HANDOFF_ENVELOPE_SCHEMA='ZGMINI_W01_CORE_HANDOFF_SIGNED_V1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const SHA40=/^[a-f0-9]{40}$/i;
const STOP='W01_CORE_HANDOFF_SIGNING_UNVERIFIED_STOP';
const fail=()=>{throw Object.assign(new Error(STOP),{code:STOP});};
// Canonical fixed-field string must stay byte-identical to the Core verifier.
export function coreHandoffSigningBytes(e){
 if(e?.schema!==W01_HANDOFF_ENVELOPE_SCHEMA||
  !UUID.test(e.requestId??'')||!UUID.test(e.nonce??'')||
  !SHA.test(e.manifestSha256??'')||!SHA40.test(e.controlSha??'')||
  !SHA40.test(e.sourceSha??'')||
  !Number.isSafeInteger(e.issueNumber)||e.issueNumber<1||
  !Number.isSafeInteger(e.issuedAt)||!Number.isSafeInteger(e.expiresAt)||
  e.issuedAt<1||e.expiresAt<=e.issuedAt||
  e.expiresAt-e.issuedAt>20*60*1000)fail();
 return Buffer.from(JSON.stringify([
  'ZGMINI/W01/CORE_HANDOFF/SIGNED_V1',
  e.schema,e.requestId,e.nonce,e.manifestSha256,e.controlSha,
  e.sourceSha,e.issueNumber,e.issuedAt,e.expiresAt
 ]),'utf8');
}
export function signCoreHandoff({authorization,privateKey,now=Date.now(),nonce=randomUUID()}={}){
 const auth=assertAuthenticatedCoreHandoff(authorization);
 if(!Number.isSafeInteger(now)||now<1||!UUID.test(nonce))fail();
 let key;
 try{key=privateKey instanceof KeyObject&&privateKey.type==='private'?
  privateKey:createPrivateKey(privateKey);}catch{fail();}
 if(key.asymmetricKeyType!=='ed25519')fail();
 const e={
  schema:W01_HANDOFF_ENVELOPE_SCHEMA,
  requestId:auth.request.requestId,
  nonce,manifestSha256:auth.request.approvalManifestSha256,
  controlSha:auth.controlSha,sourceSha:auth.manifest.sourceSha,
  issueNumber:auth.issueNumber,issuedAt:now,expiresAt:now+20*60*1000
 };
 const bytes=coreHandoffSigningBytes(e);
 const signature=sign(null,bytes,key).toString('base64');
 return Object.freeze({...e,signature});
}

/**
 * Create-only delivery of a signed V3 candidate under an approved fixed
 * data root. No request is executed or claimed by this function.
 * A trusted Windows controller must pass the canonical installed DATA_ROOT;
 * test substitution is not a permission grant. Never accept a path/filename
 * from GitHub Issue body. Source-only until installed and approved.
 */
export function stageSignedCoreHandoff({
 authorization,privateKey,approvedRoot,fsImpl,now=Date.now(),
 nonce=randomUUID(),
}={}){
 const auth=assertAuthenticatedCoreHandoff(authorization);
 if(typeof approvedRoot!=='string'||!fsImpl||
  typeof fsImpl.realpathSync!=='function'||
  typeof fsImpl.mkdirSync!=='function'||typeof fsImpl.lstatSync!=='function'||
  typeof fsImpl.openSync!=='function'||typeof fsImpl.writeSync!=='function'||
  typeof fsImpl.fsyncSync!=='function'||typeof fsImpl.closeSync!=='function'||
  typeof fsImpl.linkSync!=='function'||typeof fsImpl.unlinkSync!=='function')fail();
 const path=requirePath();
 // Root selection must be compiled into the trusted receiver; any
 // arbitrary root from an Issue or signed envelope is rejected upstream.
 let root;
 try{root=fsImpl.realpathSync(approvedRoot);}catch{fail();}
 if(root!==approvedRoot)fail(); // no junction/symlink for new staging root
 const signed=signCoreHandoff({authorization:auth,privateKey,now,nonce});
 const subdir=path.join(root,'inflation-causal-candidates-r1','core-handoff');
 // Never create parent directories or adopt an arbitrary alternate folder.
 try{
  const parent=path.dirname(subdir);
  const parentStat=fsImpl.lstatSync(parent);
  if(!parentStat.isDirectory()||parentStat.isSymbolicLink())fail();
  if(!fsImpl.existsSync(subdir))fsImpl.mkdirSync(subdir,{recursive:false});
  const dirStat=fsImpl.lstatSync(subdir);
  if(!dirStat.isDirectory()||dirStat.isSymbolicLink()||
   fsImpl.realpathSync(subdir)!==subdir)fail();
 }catch{fail();}
 const name=signed.requestId+'.signed.json';
 const target=path.join(subdir,name);
 const tmp=path.join(subdir,'.'+signed.nonce+'.tmp');
 const bytes=Buffer.from(JSON.stringify(signed)+'\n','utf8');
 if(bytes.length>2048)fail();
 let fd;
 try{
  fd=fsImpl.openSync(tmp,'wx');
  let at=0;
  while(at<bytes.length){
   const count=fsImpl.writeSync(fd,bytes,at,bytes.length-at,at);
   if(!Number.isSafeInteger(count)||count<=0)fail();
   at+=count;
  }
  fsImpl.fsyncSync(fd);fsImpl.closeSync(fd);fd=undefined;
  // Atomic create without replacing an existing request/unknown result.
  fsImpl.linkSync(tmp,target);
 }catch{
  if(fd!==undefined)try{fsImpl.closeSync(fd);}catch{}
  try{fsImpl.unlinkSync(tmp);}catch{}
  fail();
 }
 try{fsImpl.unlinkSync(tmp);}catch{fail();}
 const readback=fsImpl.readFileSync(target);
 if(!Buffer.isBuffer(readback)||!readback.equals(bytes))fail();
 return Object.freeze({status:'SIGNED_CANDIDATE_STAGED_NOT_EXECUTED',
  requestId:signed.requestId,bytes:bytes.length,providerCalls:0,
  operationalDataWrites:0});
}
