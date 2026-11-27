// CNN Sidecar B: source-only, fail-closed authorization and transaction contract.
// Not a pc-job handler; no general command, path, shell, or provider access.
import {createHash} from 'node:crypto';

export const TARGET='E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\archive-run.mjs';
export const PREIMAGE='ce07af0b5e8d17625644e204f2815c1f754aff2468bc5434ac13c0dadcecd907';
export const SCHEMA='ZGMINI_CNN_SIDECAR_ONEFILE_B_V1';
// Explicit successor of the already-installed R3 bytes only. V1 is unchanged.
export const SUCCESSOR_SCHEMA='ZGMINI_CNN_SIDECAR_ONEFILE_B_V2';
// Pin-only successor to the *currently installed*, reviewed V2 bytes.
// V1 and V2 retain their exact original preimage and authorization guards.
export const NEXT_SUCCESSOR_SCHEMA='ZGMINI_CNN_SIDECAR_ONEFILE_B_V3';
export const R3_AFTER='583297b451f168a32a2a5de4b0b04c9b14449aab9a041c954a420203cf04f188';
const R3_SOURCE='e4b768530335182f422ebd51d163a6f5b754361c';
export const V2_AFTER='eb3c43bf8fba6ea4e51f3e84b77f9ec13000db9d9e38077ffd914950d7080b6b';
const V2_SOURCE='393cee0da46515ff056543173fcd1253a858b3d7';
const sha64=/^[0-9a-f]{64}$/;
const sha40=/^[0-9a-f]{40}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const check=(ok,code)=>{if(!ok)fail(code);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

// The approved AFTER bytes must be supplied by an independently reviewed,
// byte-hash-pinned source; this contract never synthesizes or edits CNN guards.
export function validateManifest(m){
 check(exact(m,['schema','status','requestId','target','beforeSha256',
  'afterSha256','approvedContentSha256','approvedSourceSha','installedHead',
  'installedConfigSource','taskDefinitionSha256','wrapperSha256',
  'allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskChanges',
  'runCount']),'SIDECAR_B_FIELDS_STOP');
 const legacy=m.schema===SCHEMA,successor=m.schema===SUCCESSOR_SCHEMA,
  next=m.schema===NEXT_SUCCESSOR_SCHEMA;
 check((legacy||successor||next)&&m.status==='APPROVED_B'&&
  uuid.test(m.requestId)&&m.target===TARGET&&
  m.beforeSha256===(legacy?PREIMAGE:successor?R3_AFTER:V2_AFTER)&&sha64.test(m.afterSha256)&&
  m.afterSha256!==m.beforeSha256&&m.approvedContentSha256===m.afterSha256&&
  (!successor||(m.afterSha256!==PREIMAGE&&m.installedHead===m.installedConfigSource&&m.installedHead!==R3_SOURCE))&&
  (!next||(m.installedHead===m.installedConfigSource&&m.installedHead!==V2_SOURCE))&&
  sha40.test(m.approvedSourceSha)&&sha40.test(m.installedHead)&&
  sha40.test(m.installedConfigSource)&&sha64.test(m.taskDefinitionSha256)&&
  sha64.test(m.wrapperSha256)&&m.runCount===1&&
  ['allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskChanges']
   .every(k=>m[k]===false),'SIDECAR_B_SCOPE_STOP');
 return m;
}

export function verifyObservation(m,o){
 validateManifest(m);
 check(exact(o,['target','regularFile','realPathMatches','beforeSha256',
  'head','configSource','taskDefinitionSha256','wrapperSha256','active',
  'leaseOwned','sharedInstallLockOwned','sourceApproved']),'SIDECAR_B_OBSERVATION_FIELDS_STOP');
 check(o.target===TARGET&&o.regularFile===true&&o.realPathMatches===true,
  'SIDECAR_B_PATH_STOP');
 check(o.beforeSha256===m.beforeSha256,'SIDECAR_B_PREIMAGE_STOP');
 check(o.head===m.installedHead&&o.configSource===m.installedConfigSource&&
  o.taskDefinitionSha256===m.taskDefinitionSha256&&
  o.wrapperSha256===m.wrapperSha256&&o.sourceApproved===true,
  'SIDECAR_B_LINEAGE_STOP');
 check(o.active===false&&o.leaseOwned===true&&
  o.sharedInstallLockOwned===true,'SIDECAR_B_RESOURCE_STOP');
 return o;
}

// A successor may change exactly the previous reviewed Sidecar source pin.
// Reverse substitution must reproduce its entire old approved byte image.
// This never permits changing executable logic, source paths or safety guards.
export function verifyCandidateBytes(m,bytes){
 validateManifest(m);
 check(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=131072&&
  sha256(bytes)===m.afterSha256,'SIDECAR_B_CANDIDATE_HASH_STOP');
 if(m.schema===SUCCESSOR_SCHEMA||m.schema===NEXT_SUCCESSOR_SCHEMA){
  const text=bytes.toString('utf8');
  const priorSource=m.schema===SUCCESSOR_SCHEMA?R3_SOURCE:V2_SOURCE;
  const priorBytes=m.schema===SUCCESSOR_SCHEMA?R3_AFTER:V2_AFTER;
  const pin=`const APPROVED='${m.installedHead}';`;
  check(Buffer.from(text,'utf8').equals(bytes)&&text.split(pin).length===2&&
   sha256(Buffer.from(text.replace(pin,`const APPROVED='${priorSource}';`),'utf8'))===priorBytes,
   'SIDECAR_B_SUCCESSOR_SOURCE_PIN_STOP');
 }
 return bytes;
}

// Caller MUST be the independently approved Windows B receiver. Never pass an
// issue body or arbitrary request payload as 'io'. Persisted claim/backup,
// lock, atomicReplace and readback must be performed on the real PC by adapter.
export async function applyOneFile(m,approvedBytes,io){
 verifyCandidateBytes(m,approvedBytes);
 check(io&&['acquire','observe','claimOnce','backup','atomicReplace',
  'readbackSha256','restoreBackup','release'].every(k=>typeof io[k]==='function'),
  'SIDECAR_B_ADAPTER_STOP');
 let locked=false,backupMade=false,replacementAttempted=false;
 try{
  await io.acquire(m.requestId);locked=true;
  verifyObservation(m,await io.observe());
  await io.claimOnce(m.requestId);
  await io.backup(m.beforeSha256);backupMade=true;
  // Fail closed on changing target or lease after backup.
  verifyObservation(m,await io.observe());
  replacementAttempted=true;
  await io.atomicReplace(approvedBytes,m.beforeSha256,m.afterSha256);
  check(await io.readbackSha256()===m.afterSha256,'SIDECAR_B_READBACK_STOP');
  return {status:'APPLIED_SOURCE_ONLY',requestId:m.requestId,
   beforeSha256:m.beforeSha256,afterSha256:m.afterSha256};
 }catch(error){
  if(locked&&backupMade&&replacementAttempted){
   try{
    await io.restoreBackup(m.beforeSha256);
    check(await io.readbackSha256()===m.beforeSha256,'SIDECAR_B_ROLLBACK_READBACK_STOP');
   }catch{fail('SIDECAR_B_RECOVERY_UNVERIFIED_STOP');}
  }
  throw error;
 }finally{
  if(locked)await io.release(m.requestId);
 }
}
