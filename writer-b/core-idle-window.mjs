// I/O-free, bounded natural-idle waiting policy for an approved Writer B.
// Live Windows probes, clock and sleeps are supplied by the adapter. This
// helper never modifies a Task, lock, source checkout, DB, or config.
export const MAX_CORE_IDLE_WAIT_MS=6*60000;
// A second wait occurs after isolated staging, inside the same 12-minute
// GitHub Actions job as preflight, rollback and final result reporting. Keep
// the late natural-idle window short so the bounded transaction can finish.
export const MAX_POST_PREPARE_IDLE_WAIT_MS=90000;
export const CORE_IDLE_POLL_MS=1500;
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
 let lastBlocker=null;
 // The independent sample cap prevents infinite polling if a test/host clock
 // fails to advance, without turning an active Core into a verified idle.
 const cap=Math.ceil(windowMs/CORE_IDLE_POLL_MS)+2;
 while(clock()<deadline&&samples<cap){
  last=await sample();
  samples++;
  // Bounded numeric-only diagnostic; never include command lines, PIDs or paths.
  const p=last?.probe;
  lastBlocker=typeof p?.enabled==='boolean'&&
   [p.state,p.instances,p.relatedProcesses,p.unknownProcessLines]
    .every(n=>Number.isSafeInteger(n)&&n>=0)&&
   typeof last?.lock==='boolean'?
   {enabled:p.enabled,state:p.state,instances:p.instances,
    relatedProcesses:p.relatedProcesses,
    unknownProcessLines:p.unknownProcessLines,cycleLockPresent:last.lock}:null;
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
  {windowMs,samples,readySamples,activeSamples,otherSamples,maxReadyStreak,
   ...(lastBlocker?{lastBlocker}:{})});
}
