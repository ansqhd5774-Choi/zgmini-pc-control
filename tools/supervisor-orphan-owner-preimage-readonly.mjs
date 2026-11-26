// Fixed operating PC orphan Supervisor preimage: hashes and aggregate booleans.
// No request-controlled paths, nonce, PID, command line or environment output.
// This does not authorize lease, Supervisor, Watchdog or Runner mutations.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT='E:/ZGmini/automation/pc-control';
const MAINTENANCE_ROOT='E:/ZGmini/automation/pc-maintenance';
const sha=b=>createHash('sha256').update(b).digest('hex');
const digest40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const isPid=x=>Number.isSafeInteger(x)&&x>0;
const denial=code=>({
 schema:'ZGMINI_ORPHAN_OWNER_CAS_READONLY_V1',status:'STATE_UNKNOWN',code,
 ownerRecordSha256:null,hostManifestSha256:null,heartbeatSha256:null,
 controllerSourceSha:null,oldOwnerDeadVerified:false,bootEpochMatch:false,
 sixHistoricalSeatsVerified:false,ownerHeartbeatIdentityMatch:false,
 existingOwnerNonceWellFormed:false,relatedLeaseCount:null,
 installLeaseHeld:null,preimageStable:false,
 effectAuthorized:false,supervisorSpawnAuthorized:false,
 runnerTerminationAuthorized:false,leaseMutationAuthorized:false,
 operationalWrites:0,providerCalls:0,d1Writes:0
});
export function projectOrphanOwnerPreimage({
 ownerBytes,hostBytes,heartbeatBytes,secondOwnerBytes,secondHostBytes,
 secondHeartbeatBytes,relatedLeaseNames,installLeaseHeld,pidProbe,
 now=Date.now(),bootAt
}={}){
 if(!Buffer.isBuffer(ownerBytes)||ownerBytes.length<20||ownerBytes.length>8192||
    !Buffer.isBuffer(hostBytes)||hostBytes.length<20||hostBytes.length>65536||
    !Buffer.isBuffer(heartbeatBytes)||heartbeatBytes.length<20||
    heartbeatBytes.length>16384||
    !Buffer.isBuffer(secondOwnerBytes)||!Buffer.isBuffer(secondHostBytes)||
    !Buffer.isBuffer(secondHeartbeatBytes))
  return denial('ORPHAN_OWNER_CAS_BYTES_UNVERIFIED');
 const stable=ownerBytes.equals(secondOwnerBytes)&&hostBytes.equals(secondHostBytes)&&
   heartbeatBytes.equals(secondHeartbeatBytes);
 if(!stable)return denial('ORPHAN_OWNER_CAS_CHANGED_DURING_READ');
 let owner,host,hb;
 try{
  owner=JSON.parse(ownerBytes.toString('utf8'));
  host=JSON.parse(hostBytes.toString('utf8'));
  hb=JSON.parse(heartbeatBytes.toString('utf8'));
 }catch{return denial('ORPHAN_OWNER_CAS_JSON_UNVERIFIED');}
 const source=host?.controllerSourceSha;
 if(!digest40(source)||!isPid(owner?.pid)||
    !Number.isFinite(owner?.bootAt)||!Number.isFinite(bootAt)||
    typeof owner?.nonce!=='string'||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(owner.nonce))
  return denial('ORPHAN_OWNER_CAS_IDENTITY_UNVERIFIED');
 if(!Array.isArray(relatedLeaseNames)||relatedLeaseNames.length>256||
    relatedLeaseNames.some(n=>typeof n!=='string'||n.length>128)||
    typeof installLeaseHeld!=='boolean'||typeof pidProbe!=='function')
  return denial('ORPHAN_OWNER_CAS_LOCK_OBSERVATION_UNVERIFIED');
 let alive;
 try{alive=pidProbe(owner.pid);}catch{alive=null;}
 if(![true,false].includes(alive))return denial('ORPHAN_OWNER_PID_LIVENESS_UNVERIFIED');
 const children=hb?.children,uniqueSeats=new Set(),uniquePids=new Set();
 if(Array.isArray(children)&&children.length===6)for(const c of children){
  if(!Number.isSafeInteger(c?.seat)||c.seat<1||c.seat>6||
     !isPid(c?.pid)||uniqueSeats.has(c.seat)||uniquePids.has(c.pid))
   break;
  uniqueSeats.add(c.seat);uniquePids.add(c.pid);
 }
 const hbAge=typeof hb?.at==='string'?now-Date.parse(hb.at):NaN;
 const related=relatedLeaseNames.filter(n=>n!=='supervisor'&&
   !n.startsWith('supervisor.dead-')).length;
 return {
  schema:'ZGMINI_ORPHAN_OWNER_CAS_READONLY_V1',
  status:'PASS',code:'ORPHAN_OWNER_CAS_PREIMAGE_OBSERVED',
  ownerRecordSha256:sha(ownerBytes),hostManifestSha256:sha(hostBytes),
  heartbeatSha256:sha(heartbeatBytes),controllerSourceSha:source,
  oldOwnerDeadVerified:alive===false,
  bootEpochMatch:Math.abs(owner.bootAt-bootAt)<10000,
  sixHistoricalSeatsVerified:uniqueSeats.size===6,
  ownerHeartbeatIdentityMatch:hb?.pid===owner.pid&&hb?.sourceSha===source,
  existingOwnerNonceWellFormed:true,
  oldHeartbeatAgeSeconds:Number.isFinite(hbAge)&&hbAge>=0?
    Math.round(hbAge/1000):null,
  relatedLeaseCount:related,installLeaseHeld,
  preimageStable:true,effectAuthorized:false,
  supervisorSpawnAuthorized:false,runnerTerminationAuthorized:false,
  leaseMutationAuthorized:false,operationalWrites:0,providerCalls:0,d1Writes:0
 };
}
export function inspectOrphanOwnerPreimageReadonly({
 filesystem=fs,platform=process.platform,hostname=os.hostname(),
 currentBootAt=Date.now()-os.uptime()*1000,
 pidProbe=pid=>{try{process.kill(pid,0);return true;}
  catch(e){return e?.code==='ESRCH'?false:null;}},
 now=Date.now()
}={}){
 if(platform!=='win32'||String(hostname).toUpperCase()!=='PC')
  return denial('ORPHAN_OWNER_CANONICAL_WINDOWS_HOST_REQUIRED');
 const files=[
  path.join(ROOT,'leases','supervisor','owner.json'),
  path.join(ROOT,'host.json'),
  path.join(ROOT,'SUPERVISOR_STATUS.json')
 ];
 const readExact=file=>{
  const stat=filesystem.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||
    stat.size<20||stat.size>65536)
   throw Error('ORPHAN_OWNER_CAS_PATH_UNVERIFIED');
  return filesystem.readFileSync(file);
 };
 try{
  const first=files.map(readExact);
  const leaseNames=filesystem.readdirSync(path.join(ROOT,'leases'));
  const installLeaseHeld=filesystem.existsSync(path.join(MAINTENANCE_ROOT,
    'leases','controller-install'));
  const second=files.map(readExact);
  return projectOrphanOwnerPreimage({
   ownerBytes:first[0],hostBytes:first[1],heartbeatBytes:first[2],
   secondOwnerBytes:second[0],secondHostBytes:second[1],
   secondHeartbeatBytes:second[2],relatedLeaseNames:leaseNames,
   installLeaseHeld,pidProbe,now,bootAt:currentBootAt
  });
 }catch{return denial('ORPHAN_OWNER_CAS_LOCAL_READ_UNVERIFIED');}
}
