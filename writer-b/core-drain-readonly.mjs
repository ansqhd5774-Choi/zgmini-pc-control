// Reuse the approved Windows Core probe in a read-only A snapshot. Never
// expose the process command lines, XML, or lock contents to GitHub.
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(x,code)=>{if(!x)stop(code);};
const fields=['ok','enabled','state','instances','relatedProcesses','unknownProcessLines'];
export function summarizeCoreDrainProbe(stdout,cycleLockPresent){
 need(Buffer.isBuffer(stdout)&&stdout.length>4&&stdout.length<4000&&
  typeof cycleLockPresent==='boolean','WRITER_B_DRAIN_PROBE_BYTES_STOP');
 let probe;
 try{probe=JSON.parse(stdout.toString('utf8').trim());}
 catch{stop('WRITER_B_DRAIN_PROBE_JSON_STOP');}
 need(probe&&typeof probe==='object'&&!Array.isArray(probe)&&
  Object.keys(probe).length===fields.length&&fields.every(k=>Object.hasOwn(probe,k))&&
  probe.ok===true&&typeof probe.enabled==='boolean'&&
  ['state','instances','relatedProcesses','unknownProcessLines'].every(k=>
   Number.isSafeInteger(probe[k])&&probe[k]>=0&&probe[k]<=100000),
  'WRITER_B_DRAIN_PROBE_CONTRACT_STOP');
 const drainReadyIfDisabled=[1,3].includes(probe.state)&&
  probe.instances===0&&probe.relatedProcesses===0&&
  probe.unknownProcessLines===0&&!cycleLockPresent;
 return {status:'SNAPSHOT',enabled:probe.enabled,state:probe.state,
  instances:probe.instances,relatedProcesses:probe.relatedProcesses,
  unknownProcessLines:probe.unknownProcessLines,cycleLockPresent,
  drainReadyIfDisabled};
}

export function validateCoreDrainSummary(x){
 if(x?.status==='UNAVAILABLE'&&Object.keys(x).length===1)return true;
 if(!x||typeof x!=='object'||Array.isArray(x)||
  Object.keys(x).length!==8||x.status!=='SNAPSHOT'||
  typeof x.enabled!=='boolean'||typeof x.cycleLockPresent!=='boolean'||
  typeof x.drainReadyIfDisabled!=='boolean'||
  !['state','instances','relatedProcesses','unknownProcessLines'].every(k=>
   Number.isSafeInteger(x[k])&&x[k]>=0&&x[k]<=100000))return false;
 return x.drainReadyIfDisabled===([1,3].includes(x.state)&&
  x.instances===0&&x.relatedProcesses===0&&
  x.unknownProcessLines===0&&!x.cycleLockPresent);
}
