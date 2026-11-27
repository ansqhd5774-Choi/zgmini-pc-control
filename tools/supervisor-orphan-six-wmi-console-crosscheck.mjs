// Cross-check SAME six original Windows Runner.Listener birth identities across
// fixed private WMI and fixed ConsoleProcessList observations. READ ONLY.
// Public summary is never a Controller B authorization or a recovery actuator.
import {createHash} from 'node:crypto';
import {readPrivateOrphanWmiEvidence}
 from './supervisor-orphan-private-wmi.mjs';
import {readPrivateOrphanConsoleEvidence}
 from './supervisor-orphan-console-readonly.mjs';

const privateProof=new WeakMap();
const base=Object.freeze({
 schema:'ZGMINI_ORPHAN_SIX_PRIVATE_CROSSCHECK_V1',
 actuationAllowed:false,runnerStopAuthorized:false,
 ownerAdoptionAuthorized:false,watchdogPromotionAuthorized:false,
 operationalWrites:0,signalEmitted:false
});
const unknown=code=>Object.freeze({...base,status:'STATE_UNKNOWN',
 code,linkedSeatCount:0});
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function readPrivateOrphanSixCrosscheck(summary){
 return privateProof.get(summary)??null;
}
export function compareOrphanSixWmiAndConsoles(wmi,consoleRead,{
 now=Date.now()
}={}){
 if(wmi?.status!=='PASS'||consoleRead?.status!=='PASS'||
    consoleRead?.distinctConsoleGroupCount!==6||
    consoleRead?.sharedListenerConsoleGroupCount!==0||
    consoleRead?.extraConsoleMemberCount!==0||
    consoleRead?.maxConsoleMemberCount!==1||
    wmi?.exactSeatCount!==6||wmi?.workerCount!==0||
    wmi?.originalPinsCompared!==true)
  return unknown('ORPHAN_SIX_CROSSCHECK_SOURCE_SCOPE_UNVERIFIED');
 const a=readPrivateOrphanWmiEvidence(wmi);
 const b=readPrivateOrphanConsoleEvidence(consoleRead);
 if(!a||!b||a.source!=='WIN32_PROCESS_PRIVATE_SAME_HOST'||
    a.originalPinsCompared!==true||
    a.completeControllerRootsVerified!==true||
    a.extraControllerListenerCount!==0||
    a.unknownControllerPathCount!==0||
    !Array.isArray(a.rows)||a.rows.length!==6||
    !Array.isArray(a.workers)||a.workers.length!==0||
    !Array.isArray(b.rows)||b.rows.length!==6)
  return unknown('ORPHAN_SIX_CROSSCHECK_PRIVATE_DATA_UNAVAILABLE');
 if(!validTime(a.observedAt)||!validTime(b.observedAtUtc)||
    !Number.isFinite(now)||Date.parse(a.observedAt)>now||
    Date.parse(b.observedAtUtc)>now||
    now-Date.parse(a.observedAt)>45000||
    now-Date.parse(b.observedAtUtc)>45000||
    Math.abs(Date.parse(a.observedAt)-Date.parse(b.observedAtUtc))>25000)
  return unknown('ORPHAN_SIX_CROSSCHECK_STALE_OBSERVATIONS');
 const pairs=[...a.rows].sort((x,y)=>x.seat-y.seat);
 const consoleRows=[...b.rows].sort((x,y)=>x.seat-y.seat);
 const fingerprints=[];
 for(let i=0;i<6;i++){
  const w=pairs[i],c=consoleRows[i];
  if(w?.seat!==i+1||c?.seat!==i+1||
     !Number.isSafeInteger(w.pid)||w.pid<=0||
     !Number.isSafeInteger(c.pid)||c.pid!==w.pid||
     !validTime(w.startedAtUtc)||!validTime(c.startedAtUtc)||
     Date.parse(w.startedAtUtc)!==Date.parse(c.startedAtUtc)||
     !/^[a-f0-9]{64}$/.test(w.canonicalPathSha256??'')||
     !Array.isArray(c.members)||c.members.length!==1||
     c.members[0]!==w.pid)
   return unknown('ORPHAN_SIX_CROSSCHECK_PID_BIRTH_OR_CONSOLE_CHANGED');
  fingerprints.push([i+1,w.pid,w.startedAtUtc,w.canonicalPathSha256]);
 }
 // These identities stay in the private process only; never serialize
 // raw PID, birth, filepath, hash tuple or the underlying WeakMap.
 const digest=createHash('sha256').update(JSON.stringify(fingerprints)).digest('hex');
 const proof=Object.freeze({...base,status:'CANDIDATE_ONLY',
  code:'ORPHAN_SIX_SIX_PRIVATE_IDENTITIES_CROSSCHECKED',
  linkedSeatCount:6});
 privateProof.set(proof,Object.freeze({
  source:'PRIVATE_SAME_HOST_WMI_AND_EXCLUSIVE_CONSOLES',
  privateOriginalSixSeatDigestSha256:digest,
  observedAtUtc:b.observedAtUtc,wmiObservedAtUtc:a.observedAt,
  seats:Object.freeze(pairs.map(p=>Object.freeze({...p})))
 }));
 return proof;
}
