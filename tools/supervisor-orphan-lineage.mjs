// Verifies only the six-seat process genealogy, never authorizes takeover.
// An exited cmd wrapper makes genealogy unverifiable even if Listener is online.
const validPid=x=>Number.isSafeInteger(x)&&x>0;
const blocked=code=>({status:'BLOCKED',code,mayAdopt:false,maySpawn:false,mayTransferLease:false});
export function assessOrphanSeatLineage({owner,ownerAlive,heartbeat,processes,controllerRoot}={}){
 if(ownerAlive!==false||!validPid(owner?.pid)||typeof owner?.nonce!=='string'
   ||owner.nonce.length<16)return blocked('ORPHAN_OLD_OWNER_IDENTITY_UNVERIFIED');
 if(heartbeat?.pid!==owner.pid||!Array.isArray(heartbeat.children)
   ||heartbeat.children.length!==6)return blocked('ORPHAN_SIX_SEAT_HEARTBEAT_UNVERIFIED');
 if(!Array.isArray(processes)||processes.length>4096||typeof controllerRoot!=='string'||!(controllerRoot.length>3&&/^[A-Za-z]$/.test(controllerRoot[0])&&controllerRoot[1]===':'&&controllerRoot[2]===String.fromCharCode(92)))return blocked('ORPHAN_PROCESS_SNAPSHOT_UNVERIFIED');
   ||!/^[a-z]:\\\\/i.test(controllerRoot))return blocked('ORPHAN_PROCESS_SNAPSHOT_UNVERIFIED');
 const normalizedRoot=(controllerRoot.endsWith(String.fromCharCode(92))?controllerRoot.slice(0,-1):controllerRoot).toLowerCase();
 const processByPid=new Map(),seats=new Set(),wrappers=new Set();
 for(const row of processes){
  if(!validPid(row?.pid)||!Number.isSafeInteger(row?.ppid)||row.ppid<0
     ||processByPid.has(row.pid)||typeof row.name!=='string')
   return blocked('ORPHAN_PROCESS_SNAPSHOT_UNVERIFIED');
  processByPid.set(row.pid,row);
 }
 for(const child of heartbeat.children){
  if(!Number.isSafeInteger(child?.seat)||child.seat<1||child.seat>6
    ||!validPid(child.pid)||seats.has(child.seat)||wrappers.has(child.pid))
   return blocked('ORPHAN_SEAT_IDENTITY_UNVERIFIED');
  seats.add(child.seat);wrappers.add(child.pid);
  const wrapper=processByPid.get(child.pid);
  if(!wrapper||!/^cmd.exe$/i.test(wrapper.name))
   return blocked('ORPHAN_WRAPPER_GENEALOGY_UNVERIFIED');
 }
 const listenerSeats=new Set();
 for(const proc of processes){
  if(!/^Runner\\.Listener\\.exe$/i.test(proc.name))continue;
  if(typeof proc.executablePath!=='string')return blocked('ORPHAN_LISTENER_PATH_UNVERIFIED');
  const absolute=proc.executablePath.toLowerCase().replace(/\\\\/g,'\\\\');
  let matchedSeat=null;
  for(let seat=1;seat<=6;seat++){
   const sub=normalizedRoot+'\\\\runners\\\\'+String(seat).padStart(2,'0')+'\\\\';
   if(absolute.startsWith(sub)){matchedSeat=seat;break;}
  }
  // Extra listeners, even service-owned, cannot silently be mapped.
  if(matchedSeat===null)return blocked('ORPHAN_EXTRA_LISTENER_UNVERIFIED');
  if(listenerSeats.has(matchedSeat))return blocked('ORPHAN_DUPLICATE_SEAT_LISTENER');
  const wrapperPid=heartbeat.children.find(x=>x.seat===matchedSeat).pid;
  const visited=new Set();let p=proc.ppid,linked=false;
  for(let depth=0;depth<16&&p>0;depth++){
   if(visited.has(p))return blocked('ORPHAN_PARENT_CYCLE');
   visited.add(p);
   if(p===wrapperPid){linked=true;break;}
   p=processByPid.get(p)?.ppid??0;
  }
  if(!linked)return blocked('ORPHAN_LISTENER_ANCESTRY_UNVERIFIED');
  listenerSeats.add(matchedSeat);
 }
 if(listenerSeats.size!==6)return blocked('ORPHAN_LISTENER_COUNT_UNVERIFIED');
 return {status:'LINEAGE_OBSERVED',code:'ORPHAN_PROCESS_GRAPH_ONLY',
  seats:6,mayAdopt:false,maySpawn:false,mayTransferLease:false,
  // PID/PPID path linkage is not a non-reuseable process-handle witness.
  pidReuseExcluded:false,ownerTransferProtocolImplemented:false};
}
