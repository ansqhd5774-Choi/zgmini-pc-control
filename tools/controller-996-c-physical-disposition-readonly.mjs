// #996 interrupted C disposition classifier — PURE, INJECTED SNAPSHOTS ONLY.
// This module does not read a disk, inspect a real process, authenticate an
// owner, contact GitHub, grant consent, or perform any recovery side effect.
// Even a matched disposition is NOT an authenticated original-Windows CAS.

const ORIGINAL='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const HEX=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const UUID=x=>typeof x==='string'&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keys=o=>Object.keys(o).sort();
const OLD=['owner.json','PREPARED.json',
  'WORKFLOW_ENABLE_ATTEMPTED.json','BACKLOG_CLOSE_ATTEMPTED.json'];
const INSTALL=['owner.json','RECOVERY_REQUIRED.json'];
const PATHS=['oldC','oldCArchive','continuation','continuationArchive',
  'install','installArchive'];
const PHASE=Object.freeze({
  ORIGINAL:'ORIGINAL_OLD_C_AND_INSTALL_HELD',
  CLAIMED:'ORIGINAL_WITH_CONTINUATION_CLAIM_RESERVED',
  AFTER_OLD:'AFTER_OLD_C_ARCHIVED_INSTALL_HELD',
  AFTER_READY:'AFTER_OLD_C_ARCHIVED_READY_NOT_YET_ARCHIVED',
  AFTER_CONT:'AFTER_CONTINUATION_ARCHIVED_READY_INSTALL_HELD',
  AFTER_INSTALL:'AFTER_INSTALL_ARCHIVED',
});

function result(phase,code){
  return Object.freeze({
    schema:'ZGMINI_CONTROLLER_996_C_PHYSICAL_DISPOSITION_READONLY_V1',
    status:phase?'C_DISPOSITION_SNAPSHOT_CLASSIFIED_ONLY':
      'C_DISPOSITION_SNAPSHOT_BLOCKED',
    phase:phase??'UNKNOWN',code,
    independentAuthentication:false,
    liveOriginalPcVerified:false,
    executionAuthorized:false,
    productionExecutable:false,
    operationalWrites:0,workflowPuts:0,backlogWrites:0,
    issuePosts:0,pcRetries:0,cleanupPerformed:false,
  });
}
const stop=code=>result(null,code);

function inventoryIsPinned(files,expected){
  return files!==null&&typeof files==='object'&&!Array.isArray(files)&&
    same(keys(files),keys(expected))&&
    Object.entries(files).every(([name,hash])=>
      Object.hasOwn(expected,name)&&HEX(hash)&&hash===expected[name]);
}
function exactPins(map,required,optional=[]){
  if(!map||typeof map!=='object'||Array.isArray(map)||
    !required.every(k=>HEX(map[k]))||
    keys(map).some(k=>!required.includes(k)&&!optional.includes(k)))return false;
  return Object.values(map).every(HEX);
}
function present(paths,name){return paths[name].present===true;}
function fits(paths,name,pins){
  return present(paths,name)&&inventoryIsPinned(paths[name].files,pins);
}
function absent(paths,name){
  return paths[name].present===false&&paths[name].files===null;
}

/**
 * Classify ONE externally supplied, supposedly stable snapshot. `pins` must
 * be pinned by a separate trusted acquisition process; passing both objects
 * does not authenticate either. No branch of this function approves a move.
 *
 * `snapshot.paths` has six {present:boolean,files:object|null} entries.
 * `pins` has original oldC/install inventories, continuation pre-READY
 * inventory and the READY marker + source-lock SHA256. A READY inventory
 * must equal pre-READY plus exactly one READY marker.
 */
export function classify996CPhysicalDisposition({snapshot,pins}={}){
  if(snapshot?.schema!=='ZGMINI_CONTROLLER_996_C_PHYSICAL_SNAPSHOT_V1'||
    snapshot.originalRequestId!==ORIGINAL||
    !UUID(snapshot.continuationRequestId)||
    snapshot.continuationRequestId===ORIGINAL||
    snapshot.readOnly!==true||snapshot.twoSnapshotsIdentical!==true||
    snapshot.fresh!==true)return stop('C_DISPOSITION_INPUT_OR_CAS_UNVERIFIED');

  const c=snapshot.conflicts;
  if(c?.workflowState!=='active'||c.protectionVerified!==true||
    c.scope!=='CONTROLLER_INSTALL_AND_C_RECOVERY_LEASES'||
    c.foreignInstallOwnerCount!==0||c.otherContinuationCount!==0||
    c.twoSnapshotsIdentical!==true||c.fresh!==true)
    return stop('C_DISPOSITION_CONFLICT_OR_PROTECTION_UNKNOWN');

  if(!exactPins(pins?.oldC,OLD)||keys(pins.oldC).length!==OLD.length||
    !exactPins(pins?.install,INSTALL)||
    keys(pins.install).length!==INSTALL.length||
    !exactPins(pins?.continuationBeforeReady,
      ['owner.json','PREPARED.json'],['OLD_C_CLAIM_ARCHIVE_ATTEMPTED.json'])||
    ![2,3].includes(keys(pins.continuationBeforeReady).length)||
    !HEX(pins?.readySha256)||!HEX(pins?.sourceLockSha256))
    return stop('C_DISPOSITION_PINS_INVALID');

  const paths=snapshot.paths;
  if(!paths||typeof paths!=='object'||Array.isArray(paths)||
    !same(keys(paths),PATHS.slice().sort())||
    PATHS.some(p=>paths[p]?.present!==true&&paths[p]?.present!==false))
    return stop('C_DISPOSITION_PATH_SHAPE_UNKNOWN');

  // A path must never claim absence while carrying an inventory, or presence
  // without an independently hashable inventory.
  if(PATHS.some(p=>present(paths,p)?
    !paths[p].files||typeof paths[p].files!=='object'||
      Array.isArray(paths[p].files):!absent(paths,p)))
    return stop('C_DISPOSITION_PATH_INVENTORY_UNKNOWN');

  // Duplicate source and archive of one logical claim is a collision. Do
  // not decide which copy should survive, adopt, delete, or repair either.
  if([['oldC','oldCArchive'],['continuation','continuationArchive'],
    ['install','installArchive']].some(([a,b])=>
    present(paths,a)&&present(paths,b)))
    return stop('C_DISPOSITION_SOURCE_ARCHIVE_COLLISION');

  const contReady={...pins.continuationBeforeReady,
    'READY_TO_RELEASE_INSTALL.json':pins.readySha256};
  for(const [name,expected] of [
    ['oldC',pins.oldC],['oldCArchive',pins.oldC],
    ['install',pins.install],['installArchive',pins.install],
  ]){
    if(present(paths,name)&&!fits(paths,name,expected))
      return stop('C_DISPOSITION_ORIGINAL_PIN_DRIFT');
  }
  for(const name of ['continuation','continuationArchive']){
    if(present(paths,name)&&
      !inventoryIsPinned(paths[name].files,pins.continuationBeforeReady)&&
      !inventoryIsPinned(paths[name].files,contReady))
      return stop('C_DISPOSITION_CONTINUATION_PIN_DRIFT');
  }

  const withContinuation=present(paths,'continuation')||
    present(paths,'continuationArchive');
  const withReady=(present(paths,'continuation')&&
    inventoryIsPinned(paths.continuation.files,contReady))||
    (present(paths,'continuationArchive')&&
    inventoryIsPinned(paths.continuationArchive.files,contReady));
  if(withContinuation){
    const owner=snapshot.continuationOwner;
    if(owner?.requestId!==snapshot.continuationRequestId||
      owner.originalRequestId!==ORIGINAL||
      typeof owner.nonce!=='string'||owner.nonce.length<8||
      owner.nonce.length>128)
      return stop('C_DISPOSITION_CONTINUATION_OWNER_INVALID');
    if(withReady){
      const ready=snapshot.ready;
      if(ready?.schema!=='ZGMINI_996_CONTINUATION_READY_V1'||
        ready.name!=='READY_TO_RELEASE_INSTALL'||
        ready.requestId!==owner.requestId||
        ready.originalRequestId!==ORIGINAL||
        ready.ownerNonce!==owner.nonce||
        ready.sourceLockSha256!==pins.sourceLockSha256||
        ready.oldCArchiveOwnerSha256!==pins.oldC['owner.json']||
        ready.installOwnerSha256!==pins.install['owner.json']||
        ready.installRecoverySha256!==pins.install['RECOVERY_REQUIRED.json']||
        ready.finalReleasePending!==true)
        return stop('C_DISPOSITION_READY_PROOF_INVALID');
    }else if(snapshot.ready!==null){
      return stop('C_DISPOSITION_UNPINNED_READY_PRESENT');
    }
  }else if(snapshot.continuationOwner!==null||snapshot.ready!==null){
    return stop('C_DISPOSITION_ORPHAN_CONTINUATION_EVIDENCE');
  }

  const flags=PATHS.map(k=>Number(present(paths,k))).join('');
  const state={
    '100010':PHASE.ORIGINAL,
    '101010':PHASE.CLAIMED,
    '011010':PHASE.AFTER_OLD,
    '010110':PHASE.AFTER_CONT,
    '010101':PHASE.AFTER_INSTALL,
  }[flags];
  if(!state)return stop('C_DISPOSITION_PARTIAL_OR_UNKNOWN');
  if(state===PHASE.ORIGINAL)return result(state,'READONLY_ORIGINAL_PAIR_OBSERVED');
  if(state===PHASE.CLAIMED||state===PHASE.AFTER_OLD){
    if(withReady){
      if(state!==PHASE.AFTER_OLD)
        return stop('C_DISPOSITION_READY_BEFORE_OLD_ARCHIVE');
      return result(PHASE.AFTER_READY,'READONLY_READY_PRE_CONTINUATION_OBSERVED');
    }
    return result(state,'READONLY_PRE_FINAL_RELEASE_OBSERVED');
  }
  if(!withReady)return stop('C_DISPOSITION_FINAL_STAGE_WITHOUT_READY');
  return result(state,state===PHASE.AFTER_CONT?
    'READONLY_INSTALL_BARRIER_RETAINED':'READONLY_INSTALL_ARCHIVED_NO_AUTO_RETRY');
}

export const C996PhysicalDispositionPhases=PHASE;
