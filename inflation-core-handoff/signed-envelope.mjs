// Exact W01 signed transfer envelope. SOURCE-ONLY: no key generation, I/O,
// approval issuance, Task scheduling, or installed signing key is provided.
// A trusted, PINNED receiver must supply a private signing key from its
// existing authorized secure store. Never accept a key from an Issue/manifest.
import {randomUUID,sign,createPrivateKey} from 'node:crypto';
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
 try{key=createPrivateKey(privateKey);}catch{fail();}
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
