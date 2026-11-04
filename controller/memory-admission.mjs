import os from 'node:os';
import {performance} from 'node:perf_hooks';

const MIB=1048576;
export const memoryAdmissionMinimum=(policy,operation)=>{
 const entry=policy.operations[operation];
 if(entry?.resource!=='heavy')return null;
 const minimum=entry.minimumFreeMiB??policy.minimumFreeMiBForHeavy;
 if(!Number.isInteger(minimum)||minimum<1)throw Object.assign(new Error('MEMORY_MINIMUM_INVALID'),{code:'MEMORY_MINIMUM_INVALID'});
 return minimum;
};

// The request lease remains owned, but heavy/seat leases have not yet been acquired.
// No worker or operational storage is touched during admission.
export async function waitForMemoryAdmission({
 minimumFreeMiB,
 timeoutMs=45000,
 intervalMs=3000,
 readFreeMiB=()=>Math.floor(os.freemem()/MIB),
 pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 onWaitBegin=()=>{},
 now=()=>performance.now()
}={}){
 if(!Number.isInteger(minimumFreeMiB)||minimumFreeMiB<1)throw Object.assign(new Error('MEMORY_MINIMUM_INVALID'),{code:'MEMORY_MINIMUM_INVALID'});
 if(!Number.isInteger(timeoutMs)||timeoutMs<0||timeoutMs>60000)throw Object.assign(new Error('MEMORY_WAIT_INVALID'),{code:'MEMORY_WAIT_INVALID'});
 if(!Number.isInteger(intervalMs)||intervalMs<1||intervalMs>10000)throw Object.assign(new Error('MEMORY_POLL_INVALID'),{code:'MEMORY_POLL_INVALID'});
 const started=now(),deadline=started+timeoutMs;
 let firstFreeMiB=null,freeMiB=null,minObservedMiB=Number.POSITIVE_INFINITY,samples=0,waiting=false;
 while(true){
  freeMiB=readFreeMiB();
  if(!Number.isFinite(freeMiB)||freeMiB<0)throw Object.assign(new Error('MEMORY_SAMPLE_INVALID'),{code:'MEMORY_SAMPLE_INVALID'});
  freeMiB=Math.floor(freeMiB);samples++;
  if(firstFreeMiB===null)firstFreeMiB=freeMiB;
  minObservedMiB=Math.min(minObservedMiB,freeMiB);
  const waitedMs=Math.max(0,now()-started);
  if(freeMiB>=minimumFreeMiB)return {admitted:true,minimumFreeMiB,firstFreeMiB,freeMiB,minObservedMiB,samples,waitedMs};
  if(now()>=deadline)return {admitted:false,minimumFreeMiB,firstFreeMiB,freeMiB,minObservedMiB,samples,waitedMs};
  if(!waiting){onWaitBegin();waiting=true;}
  await pause(Math.min(intervalMs,deadline-now()));
 }
}
