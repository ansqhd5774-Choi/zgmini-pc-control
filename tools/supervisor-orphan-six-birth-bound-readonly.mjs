// Fixed operating Windows A observation of existing six Listener birth times.
// The two private WMI snapshots are bound to the same historic owner/host/
// heartbeat raw preimage. They never prove an inherited nonce, original launch
// handle, new Owner lease, B approval, R6 readiness, or authority to adopt.
// No PIDs, paths, timestamps, owner bytes, SHA, nonce or env values are emitted.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectOrphanOwnerPreimageReadonly}
 from './supervisor-orphan-owner-preimage-readonly.mjs';
import {inspectPrivateOrphanWmiReadonly,readPrivateOrphanWmiEvidence}
 from './supervisor-orphan-private-wmi.mjs';

const ROOT='E:/ZGmini/automation/pc-control';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const isSha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const base=Object.freeze({
 schema:'ZGMINI_ORPHAN_SIX_BIRTH_BOUND_A_READONLY_V1',
 scope:'TWO_PRIVATE_WMI_OBSERVATIONS_NOT_ORIGINAL_LAUNCH_PROOF',
 exactSeatCount:0,allSixOlderThanOriginalHeartbeat:false,
 twoSnapshotSeatIdentityStable:false,
 privateOriginalLaunchProven:false,nonceInheritanceVerified:false,
 adoptionAuthorized:false,effectAuthorized:false,
 supervisorSpawnAuthorized:false,leaseMutationAuthorized:false,
 runnerStopAuthorized:false,heartbeatWriteAuthorized:false,
 operationalWrites:0,providerCalls:0,d1Writes:0,
 processIdsExposed:false,processBirthsExposed:false,pathsExposed:false,
 nonceExposed:false
});
const unknown=code=>Object.freeze({...base,status:'STATE_UNKNOWN',code});
const pass=()=>Object.freeze({...base,status:'PASS',
 code:'ORPHAN_SIX_WMI_BIRTH_PREHEARTBEAT_TWO_OBSERVATIONS',
 exactSeatCount:6,allSixOlderThanOriginalHeartbeat:true,
 twoSnapshotSeatIdentityStable:true});

function readFixedHeartbeat(filesystem=fs){
 const file=path.join(ROOT,'SUPERVISOR_STATUS.json');
 const before=filesystem.lstatSync(file);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||
    before.size<20||before.size>16384)
  throw Error('ORPHAN_SIX_BIRTH_STATUS_FILE_UNSAFE');
 const bytes=filesystem.readFileSync(file);
 const after=filesystem.lstatSync(file);
 if(!Buffer.isBuffer(bytes)||before.size!==bytes.length||
    !after.isFile()||after.isSymbolicLink()||after.nlink!==1||
    after.size!==before.size)
  throw Error('ORPHAN_SIX_BIRTH_STATUS_FILE_CHANGED');
 return bytes;
}
const preimageMatches=(v,p)=>
 v?.status==='PASS'&&v.preimageStable===true&&
 v.oldOwnerDeadVerified===true&&v.bootEpochMatch===true&&
 v.sixHistoricalSeatsVerified===true&&
 v.ownerHeartbeatIdentityMatch===true&&
 v.existingOwnerNonceWellFormed===true&&
 v.ownerRecordSha256===p.ownerSha256&&
 v.hostManifestSha256===p.hostSha256&&v.heartbeatSha256===p.heartbeatSha256;

// Private source snapshots come from the same WeakMap-producing WMI helper.
// Results can never be converted into a B attestation by publishing booleans.
export function inspectOrphanSixBirthBoundReadonly({
 expected,filesystem=fs,
 inspectPreimage=inspectOrphanOwnerPreimageReadonly,
 captureWmi=inspectPrivateOrphanWmiReadonly
}={}){
 if(!isSha(expected?.ownerSha256)||!isSha(expected?.hostSha256)||
    !isSha(expected?.heartbeatSha256)||
    typeof inspectPreimage!=='function'||typeof captureWmi!=='function')
  return unknown('ORPHAN_SIX_BIRTH_FIXED_PREIMAGE_REQUIRED');
 try{
  const original=inspectPreimage();
  if(!preimageMatches(original,expected))
   return unknown('ORPHAN_SIX_BIRTH_OWNER_PREIMAGE_UNVERIFIED');
  const heartbeat=readFixedHeartbeat(filesystem);
  if(sha(heartbeat)!==expected.heartbeatSha256)
   return unknown('ORPHAN_SIX_BIRTH_HEARTBEAT_CAS_CHANGED');
  const data=JSON.parse(heartbeat.toString('utf8'));
  const at=data?.at;
  if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||
     !Array.isArray(data.children)||data.children.length!==6)
   return unknown('ORPHAN_SIX_BIRTH_ORIGINAL_HEARTBEAT_INVALID');

  const first=captureWmi({originalHeartbeatAt:at});
  const pin=readPrivateOrphanWmiEvidence(first);
  if(first?.status!=='PASS'||first.exactSeatCount!==6||
     first.originalPinsCompared!==false||!pin||
     pin.source!=='WIN32_PROCESS_PRIVATE_SAME_HOST'||
     !Array.isArray(pin.rows)||pin.rows.length!==6)
   return unknown('ORPHAN_SIX_BIRTH_PRIVATE_WMI_FIRST_UNVERIFIED');
  // Do not serialize or retain PIDs in any public receipt. This private pin
  // exists solely to compare two actual Windows process-birth observations.
  const second=captureWmi({originalHeartbeatAt:at,
   originalSeatPins:pin.rows});
  if(second?.status!=='PASS'||second.exactSeatCount!==6||
     second.originalPinsCompared!==true||
     !readPrivateOrphanWmiEvidence(second))
   return unknown('ORPHAN_SIX_BIRTH_PRIVATE_WMI_SECOND_CHANGED');
  if(sha(readFixedHeartbeat(filesystem))!==expected.heartbeatSha256||
     !preimageMatches(inspectPreimage(),expected))
   return unknown('ORPHAN_SIX_BIRTH_PREIMAGE_DRIFT_DURING_WMI');
  return pass();
 }catch{return unknown('ORPHAN_SIX_BIRTH_LOCAL_READ_UNVERIFIED');}
}
