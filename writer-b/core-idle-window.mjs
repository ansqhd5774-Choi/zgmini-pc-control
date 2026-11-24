// I/O-free, bounded natural-idle waiting policy for an approved Writer B.
// Live Windows probes, clock and sleeps are supplied by the adapter. This
// helper never modifies a Task, lock, source checkout, DB, or config.
export const MAX_CORE_IDLE_WAIT_MS=6*60000;
// A second wait occurs after isolated staging, inside the same 12-minute
// GitHub Actions job as preflight, rollback and final result reporting. Keep
// the late natural-idle window short so the bounded transaction can finish.
export const MAX_POST_PREPARE_IDLE_WAIT_MS=90000;
export const CORE_IDLE_POLL_MS=1500;
// A longer Core cycle may exceed the 360s reserved drain. The extended bound
// is explicitly selected by a distinct approved manifest mode; neither an
// existing approval nor NATURAL_IDLE is silently promoted.
export const EXTENDED_CORE_DRAIN_MS=20*60000;
const RESERVED_CORE_DRAIN_MS=Object.freeze({
 PAUSE_NEW_STARTS_DRAIN_360S_V1:360000,
 PAUSE_NEW_STARTS_DRAIN_1200S_V1:EXTENDED_CORE_DRAIN_MS,
});
export const isReservedCoreMaintenance=mode=>
 typeof mode==='string'&&Object.hasOwn(RESERVED_CORE_DRAIN_MS,mode);
export function coreDrainWaitMs(mode){
 if(mode===undefined)return 90000;
 if(!isReservedCoreMaintenance(mode))
  throw Object.assign(new Error('WRITER_B_MAINTENANCE_APPROVAL_STOP'),
   {code:'WRITER_B_MAINTENANCE_APPROVAL_STOP'});
 return RESERVED_CORE_DRAIN_MS[mode];
}
const stop=(code,idleObservation=null)=>{throw Object.assign(new Error(code),
 {code,...(idleObservation?{idleObservation}:{})});};
const need=(ok,code)=>{if(!ok)stop(code);};

export async function awaitNaturalCoreIdle({
 sample,wait,clock,isReady,blockCode
},{windowMs=MAX_CORE_IDLE_WAIT_MS}={}){
 need([sample,wait,clock,isReady,blockCode].every(f=>typeof f==='function')&&
  Number.isInteger(windowMs)&&windowMs>=1&&
  windowMs<=MAX_CORE_IDLE_WAIT_MS,
  'WRITER_B_CORE_IDLE_WAIT_CONTRACT_STOP');
 const begin=clock();
 need(Number.isFinite(begin),'WRITER_B_CORE_IDLE_CLOCK_STOP');
 const deadline=begin+windowMs;
 let consecutive=0,samples=0,last=null;
 let readySamples=0,activeSamples=0,otherSamples=0,maxReadyStreak=0;
 // The independent sample cap prevents infinite polling if a test/host clock
 // fails to advance, without turning an active Core into a verified idle.
 const cap=Math.ceil(windowMs/CORE_IDLE_POLL_MS)+2;
 while(clock()<deadline&&samples<cap){
  last=await sample();
  samples++;
  const ready=isReady(last?.probe,last?.lock);
  consecutive=ready?consecutive+1:0;
  if(ready){
   readySamples++;
   maxReadyStreak=Math.max(maxReadyStreak,consecutive);
  }else if(blockCode(last?.probe,last?.lock)===
    'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED')activeSamples++;
  else otherSamples++;
  if(consecutive>=2)return {status:'CORE_PREPAUSE_IDLE',samples};
  await wait(CORE_IDLE_POLL_MS);
 }
 const code=blockCode(last?.probe,last?.lock);
 stop(typeof code==='string'&&/^WRITER_B_CORE_[A-Z0-9_]+$/.test(code)?
  code:'WRITER_B_CORE_WINDOW_UNVERIFIED_DEFERRED',
  {windowMs,samples,readySamples,activeSamples,otherSamples,maxReadyStreak});
}
