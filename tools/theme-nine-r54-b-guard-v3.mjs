// SOURCE-ONLY contract proposal for one R54 B-grade Windows transaction.
// This file deliberately registers NO operation and grants NO host authority.
// It must not be imported from the installed maintainer until the same
// fail-closed host preflight/lease/journal has been integrated and tested.
import {createHash} from 'node:crypto';

const freezeRows=rows=>Object.freeze(rows.map(row=>Object.freeze({...row})));
const sha256=s=>createHash('sha256').update(s).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const canonical=x=>JSON.stringify(x);

export const R54_B_V3_SCHEMA='ZGMINI_R54_GUARD_AND_SIX_ONESHOT_B_V3';
export const R54_B_V3_SCOPE='R54_GUARD_BOOTSTRAP_AND_FIXED_SIX';
export const R54_B_GUARD_SOURCE_COMMIT='e65224bd01899616eb97cb696c72c6a586840ba1';
export const R54_B_HISTORIC_TASK_CMD_SHA256=
 '0dea186a956dbc1471a4063e8c64dd5a230549477860e699bbb450a06d4360f4';
export const R54_B_V3_TASK=Object.freeze({
 name:'ZGMINI-PC-Theme-Nine-R54-Public',
 disableCount:1,restoreCount:1,preserveOriginalXml:true,
 preserveOriginalEnabledState:true,waitForNaturalExit:true,
 noForceTermination:true,noOtherTaskChanges:true,
 restoreOnlyAfterAllSourceIntegrity:true,noAutomaticRetry:true,
});

// All old hashes are historical candidate expectations, NOT actual Windows
// attestations. The B host must compare the installed E: bytes immediately
// before any Task or source mutation and refuse any mismatch or ambiguity.
export const R54_B_GUARD_BOOTSTRAP=Object.freeze({
  lease:Object.freeze({
   path:'scripts/pc-writer/r54-source-lease.mjs',
   expectedOldState:'ABSENT',
   nextSha256:'297eda7b8b028d74c1525d83b095e28f3cf2f56f1ff9bf569f73fd74636f29c6',
   sharedLockDir:'E:/ZGmini/data/pc-writer/theme-nine-r54/R54_B_SOURCE_EXCLUSIVE.lock',
  }),
  directSourceMutators:freezeRows([
   {path:'scripts/pc-writer/theme-ten-r78-repair-and-retry.mjs',
    oldSha256:'8e6548196fc253701a141a4a60f812eec3c07f77b8f2ed300fe39215a48fa1d3',
    nextSha256:'0b688e3477e9155567e9d93d98dd0baf3a77f5419ed903c56aaf3624ffcf424c'},
   {path:'scripts/pc-writer/theme-ten-r80-rebase-once.mjs',
    oldSha256:'78541f9d6f097b3009afee626488a0e164a6f9837e450d57745c958d748455f2',
    nextSha256:'cf9883b512e4528ce2e29fcf7c95b2c9a7125802932454656df81bad97abf3c3'},
  ]),
  connector:Object.freeze({
   path:'scripts/pc-writer/theme-nine-r54-public-connect.mjs',
   originalSha256:'c6e4699d62bdef991911561623e37c205fd8bb6e5aa69907c3e93e36908fd31e',
   guardedInterimSha256:'a16c97ff9e29210a367a076d1a16a5e883a299b737ad588989ddfe95cbecd201',
   guardedFinalSha256:'2bebba925eb367de5e15fb9ed62161b01243b76e1cdfb9a804246b1cb0c13f5d',
  }),
});

export const R54_B_V3_SIX_FILES=freezeRows([
 {path:'scripts/pc-writer/theme-nine-r54-public-connect.mjs',
  original:'c6e4699d62bdef991911561623e37c205fd8bb6e5aa69907c3e93e36908fd31e',
  beforeFinal:'a16c97ff9e29210a367a076d1a16a5e883a299b737ad588989ddfe95cbecd201',
  next:'2bebba925eb367de5e15fb9ed62161b01243b76e1cdfb9a804246b1cb0c13f5d'},
 {path:'scripts/pc-writer/theme-nine-r51-stage-current.mjs',
  original:'fe079b1e2e5d2f824f6e0ff251bd2a01677fe1a477072c619b614402fbd90ae4',
  beforeFinal:'fe079b1e2e5d2f824f6e0ff251bd2a01677fe1a477072c619b614402fbd90ae4',
  next:'5a50761756be6081c71df7aa30869ed43547fbb867e476b7c581072939c27560'},
 {path:'scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs',
  original:'dfc326e2738c1b8b82451510104ac6ad502e2a9876e0a3a76d939c412e907bb7',
  beforeFinal:'dfc326e2738c1b8b82451510104ac6ad502e2a9876e0a3a76d939c412e907bb7',
  next:'7378d04bccea4c68ab93ce3b1b829b5bc0a742db49b88d1e7530482c4ea8b6cc'},
 {path:'scripts/pc-writer/theme-nine-r54-public-record.mjs',
  original:'f2a688da40d7b5ee90ed2a27a40af05b9c63116284930f1cc26041064737d012',
  beforeFinal:'f2a688da40d7b5ee90ed2a27a40af05b9c63116284930f1cc26041064737d012',
  next:'85686106412b2c4a5af51ce5de6b844729bad02441cf9bab1e51ae369a3a4a27'},
 {path:'scripts/pc-writer/theme-nine-r48-d1-publication.mjs',
  original:'7a10fe41710dbc1a21c9f3e343c538cd96b6c5695b683f04dce48af85ede6e7e',
  beforeFinal:'7a10fe41710dbc1a21c9f3e343c538cd96b6c5695b683f04dce48af85ede6e7e',
  next:'fc55ee3a2c998a4dfa7c5edd9230a68fab3954dd745b39bbe39a6177363bf45a'},
 {path:'worker/theme-nine-r37-public.mjs',
  original:'e6768dd37ebe65b9015aeb37b4a088c568ab839f085936cec8305c56ea36ce33',
  beforeFinal:'e6768dd37ebe65b9015aeb37b4a088c568ab839f085936cec8305c56ea36ce33',
  next:'30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85'},
]);

// Two source stages, exactly ONE Task hold. A journal must attest each step:
// source-before, initial task XML+state, disable, natural drain, verified
// manual route freeze, shared lease acquired, helper/mutators/interim guard,
// six-file CAS, full rollback if needed, restore Task, release lease.
export const R54_B_V3_SEQUENCE=Object.freeze([
 'VERIFY_ORIGINAL_WINDOWS_BYTES_AND_TASK',
 'SAVE_TASK_XML_AND_ENABLED',
 'DISABLE_EXACT_TASK_ONCE',
 'WAIT_NATURAL_PARENT_CHILD_DRAIN_AND_MANUAL_FREEZE',
 'ACQUIRE_SHARED_B_LEASE',
 'INSTALL_LEASE_AND_MUTATOR_GUARDS',
 'SWAP_ORIGINAL_TO_GUARDED_INTERIM',
 'CAS_GUARDED_INTERIM_AND_OTHER_FIVE_TO_FINAL',
 'VERIFY_FINAL_HELPER_MUTATORS_AND_SIX_FILES',
 'RESTORE_EXACT_TASK_ONCE',
 'RELEASE_B_LEASE',
]);

const V3_ISSUABLE=Object.freeze({
 schema:R54_B_V3_SCHEMA,
 status:'DRAFT_NOT_INSTALLABLE',
 scope:R54_B_V3_SCOPE,
 runCount:1,
 noProviderCalls:true,
 noD1Writes:true,
 noControllerChanges:true,
 noOtherTaskChanges:true,
 sourceGuardCommit:R54_B_GUARD_SOURCE_COMMIT,
 taskStateException:R54_B_V3_TASK,
 guardBootstrap:R54_B_GUARD_BOOTSTRAP,
 sixFiles:R54_B_V3_SIX_FILES,
 sequence:R54_B_V3_SEQUENCE,
});

export function r54Bv3DraftManifest(){return structuredClone(V3_ISSUABLE);}

/** Pure schema and exact SHA/transition validation; never authorizes install. */
export function validateR54Bv3DraftManifest(value){
 if(value===null||typeof value!=='object'||Array.isArray(value)||
  canonical(value)!==canonical(V3_ISSUABLE))fail('R54_B_V3_MANIFEST_EXACT_CONTRACT_DENIED');
 return Object.freeze({status:'DRAFT_VALIDATED_NOT_APPROVED',
  sha256:sha256(Buffer.from(canonical(value)))});
}

/**
 * Validate a READ-ONLY Windows inventory *claim*. This never authenticates
 * its collector, so it must not be promoted to an executable gate by itself.
 * The independent B receiver must capture actual file bytes/Task XML on E:
 * from an approved, measured Windows adapter and compare them with this map.
 */
export function compareR54Bv3OriginalInventory({task,files,leaseState}={}){
 const sha=/^[a-f0-9]{64}$/;
 if(task?.name!==R54_B_V3_TASK.name||typeof task.enabled!=='boolean'
  ||!sha.test(task.xmlSha256??'')
  ||task.actionCmdSha256!==R54_B_HISTORIC_TASK_CMD_SHA256
  ||task.actionPathVerified!==true||task.xmlBackupReadbackVerified!==true)
  fail('R54_B_V3_TASK_BASELINE_UNVERIFIED');
 if(leaseState!=='ABSENT')fail('R54_B_V3_INITIAL_LEASE_STATE_UNKNOWN');
 const rows=[
  ...R54_B_V3_SIX_FILES.map(x=>({path:x.path,sha256:x.original})),
  {path:R54_B_GUARD_BOOTSTRAP.lease.path,sha256:null},
  ...R54_B_GUARD_BOOTSTRAP.directSourceMutators.map(x=>({path:x.path,sha256:x.oldSha256})),
 ];
 if(!Array.isArray(files)||files.length!==rows.length||
  canonical(files)!==canonical(rows))fail('R54_B_V3_ORIGINAL_SOURCE_DRIFT');
 return Object.freeze({status:'BASELINE_CLAIM_MATCH_NOT_OS_ATTESTED',
  checkedFiles:rows.length,taskOriginallyEnabled:task.enabled});
}
