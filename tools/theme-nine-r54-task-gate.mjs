// R54 one-time Windows scheduled-task pause/restore policy.
// Source-only: the approved independent B host must supply trusted Windows
// adapters. No arbitrary commands, file paths, processes or task names here.
import {createHash} from 'node:crypto';
import {FILES} from './theme-nine-r54-sixfile-b.mjs';

export const R54_TASK_NAME='ZGMINI-PC-Theme-Nine-R54-Public';
export const R54_TASK_ACTION='E:\\ZGmini\\data\\pc-writer\\theme-nine-r54\\scripts\\pc-writer\\THEME_NINE_R54_PUBLIC_CYCLE.cmd';
export const R54_TASK_ACTION_SHA256='0dea186a956dbc1471a4063e8c64dd5a230549477860e699bbb450a06d4360f4';
export const R54_TASK_EXCEPTION='ONE_TIME_R54_TASK_PAUSE_RESTORE_B';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const assert=(condition,code)=>{if(!condition)fail(code);};
const normWin=x=>typeof x==='string'?x.replace(/\//g,'\\').toLowerCase():'';
const sameTask=x=>x?.name===R54_TASK_NAME&&
  normWin(x.actionPath)===normWin(R54_TASK_ACTION)&&
  x.actionSha256===R54_TASK_ACTION_SHA256&&
  typeof x.definitionDigest==='string'&&/^[a-f0-9]{64}$/.test(x.definitionDigest)&&
  Buffer.isBuffer(x.xml)&&x.xml.length>0&&x.xml.length<65536&&
  typeof x.enabled==='boolean';

function fileState(rows,kind){
 if(!Array.isArray(rows)||rows.length!==FILES.length)return false;
 const paths=new Set();
 for(const row of rows){
  if(typeof row?.path!=='string'||paths.has(row.path)||
    !/^[a-f0-9]{64}$/.test(row.old??'')||
    !/^[a-f0-9]{64}$/.test(row.next??'')||
    !/^[a-f0-9]{64}$/.test(row.actual??''))return false;
  paths.add(row.path);
  const expected=FILES.find(x=>x.path===row.path);
  if(!expected||expected.old!==row.old||expected.next!==row.next)return false;
  if(row.actual!==row[kind])return false;
 }
 return FILES.every(x=>paths.has(x.path));
}

/**
 * The B receiver must pass vetted fixed-function OS ports. A scheduler-disable
 * is not proof that a manual CMD invocation cannot occur: ports.closedRoutes
 * must verify the actual R54/source-writer collision window and descendants.
 * Other scheduled tasks may exist and run when they do not write this source.
 * `applySix` may only invoke the already SHA-pinned #320 six-file operation.
 */
export async function runApprovedR54TaskTransition({authorization,ports,
 applySix,maxDrainChecks=80,waitMs=1500}={}){
 assert(authorization?.grade==='B'&&authorization?.scope===R54_TASK_EXCEPTION&&
  authorization?.taskName===R54_TASK_NAME&&authorization?.singleUse===true&&
  authorization?.preserveTaskDefinition===true&&
  authorization?.allowForceTermination===false&&
  authorization?.allowOtherTaskChanges===false,
  'R54_TASK_B_EXCEPTION_REQUIRED');
 assert(ports&&typeof applySix==='function'&&Number.isInteger(maxDrainChecks)&&
  maxDrainChecks>=2&&maxDrainChecks<=180&&Number.isInteger(waitMs)&&
  waitMs>=0&&waitMs<=5000&&
  ['inspect','saveBaseline','disable','closedRoutes','readSixHashes',
    'restore','wait'].every(key=>typeof ports[key]==='function'),
  'R54_TASK_TRUSTED_HOST_PORTS_REQUIRED');

 let baseline,swapped=false;
 baseline=await ports.inspect();
 assert(sameTask(baseline),'R54_TASK_ORIGIN_UNVERIFIED');
 const originalBytes=Buffer.from(baseline.xml);
 const originalHash=sha256(originalBytes);
 assert(fileState(await ports.readSixHashes(),'old'),
  'R54_TASK_INSTALLED_SIX_ORIGINAL_SHA_DRIFT');
 // Durable, append-only backup and same-byte readback must precede disabling.
 const saved=await ports.saveBaseline({taskName:R54_TASK_NAME,
  xml:originalBytes,enabled:baseline.enabled,
  definitionDigest:baseline.definitionDigest,
  actionPath:R54_TASK_ACTION,actionSha256:R54_TASK_ACTION_SHA256});
 assert((saved?.writtenAndReadback===true&&saved.initialEnabled===baseline.enabled
   ||saved?.durableXmlBackupReadback===true&&saved.enabled===baseline.enabled)
   &&saved.xmlSha256===originalHash,
  'R54_TASK_BASELINE_NOT_DURABLE');

 if(baseline.enabled){
  const changed=await ports.disable(R54_TASK_NAME);
  // Unknown/ambiguous disable results are not retried or guessed.
  assert(changed?.success===true||changed?.enabled===false,
   'R54_TASK_DISABLE_OUTCOME_UNKNOWN');
 }
 let drained=false;
 for(let n=0;n<maxDrainChecks;n++){
  const current=await ports.inspect();
  assert(sameTask(current)&&current.enabled===false&&
    current.definitionDigest===baseline.definitionDigest,
    'R54_TASK_DISABLED_DEFINITION_DRIFT');
  const closed=await ports.closedRoutes();
  const verified=closed?.taskName===R54_TASK_NAME&&
    closed.schedulerStartDisabled===true&&
    closed.taskNotRunning===true&&closed.childProcessCount===0&&
    closed.conflictingSourceLaunches===0&&
    closed.installWindowExclusivityVerified===true&&
    closed.relevantLocksClear===true&&closed.exclusiveBLeaseHeld===true;
  if(verified){drained=true;break;}
  if(n+1<maxDrainChecks)await ports.wait(waitMs);
 }
 assert(drained,'R54_TASK_NATURAL_DRAIN_PENDING');
 // A prior idle snapshot is not a permanent guarantee. Recheck immediately
 // before touching source, while the same approved maintenance lease is held.
 const immediate=await ports.closedRoutes();
 assert(immediate?.taskName===R54_TASK_NAME&&
  immediate.schedulerStartDisabled===true&&immediate.taskNotRunning===true&&
  immediate.childProcessCount===0&&immediate.conflictingSourceLaunches===0&&
  immediate.installWindowExclusivityVerified===true&&
  immediate.relevantLocksClear===true&&immediate.exclusiveBLeaseHeld===true,
  'R54_TASK_INSTALL_WINDOW_COLLISION');
 assert(fileState(await ports.readSixHashes(),'old'),
  'R54_TASK_INSTALLED_CHANGED_WHILE_QUIESCING');

 let applyError;
 try{
  const result=await applySix();
  swapped=true;
  assert(result?.status==='SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED',
    'R54_TASK_SIXFILE_APPLY_NOT_VERIFIED');
  assert(fileState(await ports.readSixHashes(),'next'),
    'R54_TASK_POST_SWAP_SIX_SHA_UNVERIFIED');
 }catch(error){applyError=error;}
 // The task is never re-enabled if files are mixed/unknown. A verified
 // rollback to all six old hashes is safe to restore, but never auto-retry.
 const integrity=await ports.readSixHashes();
 const nextVerified=fileState(integrity,'next');
 const oldVerified=fileState(integrity,'old');
 assert(nextVerified||oldVerified,'R54_TASK_HOLD_DISABLED_MIXED_SOURCE');
 if(applyError&&!oldVerified)
  fail('R54_TASK_HOLD_DISABLED_UNCERTAIN_SWAP');
 if(applyError){
  const clear=await ports.closedRoutes();
  assert(clear?.taskName===R54_TASK_NAME&&
    clear.schedulerStartDisabled===true&&clear.taskNotRunning===true&&
    clear.childProcessCount===0&&clear.conflictingSourceLaunches===0&&
    clear.relevantLocksClear===true&&clear.exclusiveBLeaseHeld===true,
    'R54_TASK_HOLD_DISABLED_AFTER_ROLLBACK');
 }

 const originalState=await ports.inspect();
 assert(sameTask(originalState)&&originalState.enabled===false&&
  originalState.definitionDigest===baseline.definitionDigest,
  'R54_TASK_HOLD_DISABLED_BEFORE_RESTORE');
 const restored=await ports.restore({taskName:R54_TASK_NAME,
   enabled:baseline.enabled,originalXml:originalBytes,
   expectedXmlSha256:originalHash,writerSixHashVerified:nextVerified||oldVerified});
 assert(restored?.success===true||restored?.enabled===baseline.enabled&&
  restored?.definitionDigest===baseline.definitionDigest,
  'R54_TASK_RESTORE_OUTCOME_UNKNOWN');
 const after=await ports.inspect();
 assert(sameTask(after)&&after.enabled===baseline.enabled&&
  after.definitionDigest===baseline.definitionDigest&&
  // Task Scheduler can serialize equivalent XML with different byte layout.
  // Exact original bytes remain in the durable backup for recovery.
  'R54_TASK_RESTORE_READBACK_UNVERIFIED');
 if(applyError)fail('R54_TASK_SIXFILE_APPLY_FAILED_RESTORED');
 assert(swapped&&nextVerified,'R54_TASK_SWAP_UNVERIFIED');
 return {status:'R54_SIXFILE_AND_TASK_RESTORED_VERIFIED',
   taskName:R54_TASK_NAME,taskDefinitionSha256:originalHash,
   writerSixChanged:6,taskInitiallyEnabled:baseline.enabled,
   taskRestoredEnabled:after.enabled};
}

/**
 * Source-only candidate for the B host's `applySix` callback.
 * Atomic renaming of the pinned connector creates a temporary entry barrier:
 * all verified R54 entry routes require this exact file, so a new launch after
 * quarantine cannot load either the 5 old or 5 new support modules.
 * The B host must first hold the task-disabled lease from the wrapper above.
 * The Windows ports must use fixed paths and durable #320-style journaling;
 * the policy deliberately exposes no arbitrary command or file selector.
 */
export async function runR54QuarantinedConnectorSwap({gate,ports,
 maxDrainChecks=120,waitMs=1500}={}){
 const connector=FILES.find(x=>x.path.endsWith('/theme-nine-r54-public-connect.mjs'));
 assert(connector&&FILES.length===6,'R54_CONNECTOR_FIXED_SCOPE_INVALID');
 assert(gate?.taskName===R54_TASK_NAME&&gate.taskDisabledVerified===true&&
  gate.exclusiveBLeaseHeld===true&&gate.originalTaskXmlBackedUp===true&&
  gate.originalTaskStateBackedUp===true&&gate.knownRoutesAttested===true&&
  gate.preQuarantineNaturalDrainVerified===true,
  'R54_CONNECTOR_TASK_GATE_REQUIRED');
 assert(ports&&Number.isInteger(maxDrainChecks)&&maxDrainChecks>=2&&
  maxDrainChecks<=180&&Number.isInteger(waitMs)&&waitMs>=0&&waitMs<=5000&&
  ['readSixHashes','readBarrier','quarantineOriginalConnector','scanRunning',
   'swapFive','installNewConnector','rollbackFive','restoreOldConnector',
   'verifyEntrypoints','wait'].every(key=>typeof ports[key]==='function'),
  'R54_CONNECTOR_TRUSTED_PORTS_REQUIRED');
 const routes=await ports.verifyEntrypoints();
 assert(routes?.verifiedAllKnownPaths===true&&
  routes?.allR54RoutesLoadConnector===true&&
  routes?.unexpectedDirectEntryAbsent===true&&
  // R78/R80 and original setup CMD can rewrite source without loading the
  // connector; these lanes must be independently stopped/excluded by evidence.
  routes?.sourceRegeneratorEntrypointsExcluded===true&&
  routes?.otherSourceWriterProcessesAbsent===true,
  'R54_CONNECTOR_UNVERIFIED_BYPASS_ENTRY');
 assert(fileState(await ports.readSixHashes(),'old'),
  'R54_CONNECTOR_OLD_SIX_SHA_INVALID');

 // The quarantined file itself is one of the 6 SHA-pinned source files; the
 // trusted host writes its backup outside the source and verifies exact bytes.
 let quarantineAttempted=false,quarantined=false,newExposed=false;
 try{
  // A native rename may succeed even if the port throws before acknowledging.
  // Record the attempt *before* calling the port so catch must reconcile it.
  quarantineAttempted=true;
  const moved=await ports.quarantineOriginalConnector(connector);
  quarantined=true;
  assert(moved?.atomicRenameVerified===true&&moved?.backupSha256===connector.old,
    'R54_CONNECTOR_QUARANTINE_UNCERTAIN');
  let stable=0;
  for(let check=0;check<maxDrainChecks;check++){
    const barrier=await ports.readBarrier();
    assert(barrier?.connectorAbsent===true&&barrier?.originalBackupSha256===connector.old&&
      barrier?.fiveOriginalShaVerified===true&&barrier?.exclusiveBLeaseHeld===true&&
      barrier?.otherSourceWritersExcluded===true,
      'R54_CONNECTOR_BARRIER_DRIFT');
    const scan=await ports.scanRunning();
    const clear=scan?.taskDisabled===true&&scan?.activeR54ProcessCount===0&&
      scan?.activeDescendantCount===0&&scan?.otherExecutableEntrypointsAbsent===true;
    stable=clear?stable+1:0;
    if(stable>=2)break;
    if(check+1<maxDrainChecks)await ports.wait(waitMs);
  }
  assert(stable>=2,'R54_CONNECTOR_NATURAL_DRAIN_PENDING');
  // This callback must use #320's per-file CAS + backup + journal, but only
  // for the five support files. The connector stays absent throughout.
  const five=FILES.filter(x=>x.path!==connector.path);
  const swapped=await ports.swapFive(five);
  assert(swapped?.fiveNextShaVerified===true&&
    (await ports.readBarrier())?.connectorAbsent===true,
    'R54_CONNECTOR_FIVE_SWAP_NOT_VERIFIED');
  // Treat an ambiguous return as possibly exposed; hide it before rollback.
  newExposed=true;
  const installed=await ports.installNewConnector(connector);
  assert(installed?.atomicRenameVerified===true&&installed?.newSha256===connector.next,
    'R54_CONNECTOR_NEW_EXPOSURE_UNVERIFIED');
  assert(fileState(await ports.readSixHashes(),'next'),
    'R54_CONNECTOR_FINAL_SIX_SHA_UNVERIFIED');
  return {status:'SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED',changed:6,
   connectorQuarantinedDuringOtherFive:true,
   taskWrites:0,providerCalls:0,d1Writes:0,controllerWrites:0};
 }catch(error){
  // Never expose the original connector while the five may be mixed.
  // A trusted port must re-quarantine a newly exposed connector first.
  if(quarantineAttempted&&!quarantined){
   // No swapFive call has run yet. Reconcile the possibly completed rename
   // from independently read-back source bytes; never infer from a timeout.
   try{
    const barrier=await ports.readBarrier();
    assert(barrier?.exclusiveBLeaseHeld===true&&
      barrier?.otherSourceWritersExcluded===true,
      'R54_CONNECTOR_QUARANTINE_ATTEMPT_STATE_UNKNOWN');
    if(barrier.connectorAbsent===true){
     assert(barrier.originalBackupSha256===connector.old&&
       barrier.fiveOriginalShaVerified===true,
       'R54_CONNECTOR_QUARANTINE_ATTEMPT_STATE_UNKNOWN');
     const restored=await ports.restoreOldConnector(connector);
     assert(restored?.originalSha256===connector.old&&
       fileState(await ports.readSixHashes(),'old'),
       'R54_CONNECTOR_QUARANTINE_ATTEMPT_RESTORE_UNVERIFIED');
    }else{
     assert(barrier.connectorAbsent===false&&
       fileState(await ports.readSixHashes(),'old'),
       'R54_CONNECTOR_QUARANTINE_ATTEMPT_STATE_UNKNOWN');
    }
   }catch{fail('R54_CONNECTOR_HOLD_TASK_DISABLED_RECOVERY_REQUIRED');}
   fail('R54_CONNECTOR_SWAP_FAILED_ROLLED_BACK_NO_RETRY');
  }
  if(quarantined){
   try{
    if(newExposed){
      assert(typeof ports.quarantineNewConnector==='function',
        'R54_CONNECTOR_NEW_REQUARANTINE_REQUIRED');
      const hidden=await ports.quarantineNewConnector(connector);
      assert(hidden?.connectorAbsent===true,
        'R54_CONNECTOR_NEW_REQUARANTINE_REQUIRED');
    }
    const rolled=await ports.rollbackFive(FILES.filter(x=>x.path!==connector.path));
    assert(rolled?.fiveOldShaVerified===true,
      'R54_CONNECTOR_FIVE_ROLLBACK_UNVERIFIED');
    const restored=await ports.restoreOldConnector(connector);
    assert(restored?.originalSha256===connector.old,
      'R54_CONNECTOR_OLD_RESTORE_UNVERIFIED');
    assert(fileState(await ports.readSixHashes(),'old'),
      'R54_CONNECTOR_ROLLBACK_SIX_SHA_UNVERIFIED');
   }catch{fail('R54_CONNECTOR_HOLD_TASK_DISABLED_RECOVERY_REQUIRED');}
  }
  fail('R54_CONNECTOR_SWAP_FAILED_ROLLED_BACK_NO_RETRY');
 }
}
