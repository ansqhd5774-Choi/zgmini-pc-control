// Source-only orphan inventory gate. Never claims the Supervisor lease,
// spawns a Runner, or authorizes Watchdog/standby activation.
const validPid=x=>Number.isSafeInteger(x)&&x>0;
const fail=code=>({status:'BLOCKED',code,maySpawn:false,mayTransferLease:false});
export function assessOrphanRunnerPreservation({supervisorOwner,supervisorAlive,heartbeat,rows,controllerRoot,canonicalize}={}){
 if(supervisorAlive!==false||!validPid(supervisorOwner?.pid))
  return fail('SUPERVISOR_DEATH_UNVERIFIED');
 if(heartbeat?.pid!==supervisorOwner.pid||!Array.isArray(heartbeat.children)
   ||heartbeat.children.length!==6)return fail('OLD_SUPERVISOR_LINEAGE_UNVERIFIED');
 const seats=new Set(),children=new Set();
 for(const entry of heartbeat.children){
  if(!Number.isInteger(entry?.seat)||entry.seat<1||entry.seat>6
    ||!validPid(entry.pid)||seats.has(entry.seat)||children.has(entry.pid))
   return fail('OLD_SUPERVISOR_SIX_SEAT_LINEAGE_INVALID');
  seats.add(entry.seat);children.add(entry.pid);
 }
 // WMI rows must be an independent, bounded, complete, single-instant
 // Controller-specific classification. Bare process counts are insufficient.
 if(!rows||rows.schema!=='ZGMINI_R3_STANDBY_RUNNER_WMI_A_V1'
   ||rows.evidence!=='SINGLE_INSTANT_WMI_NOT_PROMOTION_AUTHORIZATION'
   ||rows.controllerListenerCount!==6||rows.controllerWorkerCount<0
   ||rows.unknownPathCount!==0||rows.unknownListenerCount!==0
   ||rows.unknownWorkerCount!==0||rows.missingWmiPathCount!==0
   ||rows.nonAbsoluteWmiPathCount!==0||rows.canonicalizationFailedCount!==0
   ||rows.status!=='PASS')return fail('CONTROLLER_RUNNER_ATTRIBUTION_UNVERIFIED');
 // Source-only protection classification, not a live adoption permit:
 // orphaned Listener processes are still serving the original owner.
 return {status:'PRESERVE',code:'ORPHANED_SIX_RUNNERS_MUST_NOT_RESPAWN',
  controllerListenerCount:6,controllerWorkerCount:rows.controllerWorkerCount,
  maySpawn:false,mayTransferLease:false,adoptionImplemented:false};
}
