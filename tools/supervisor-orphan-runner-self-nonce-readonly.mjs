// Same-process Runner job environment comparison only. This cannot inspect
// the environment of an already running Runner.Listener.exe from another PID.
// It is a read-only diagnostic candidate, NOT a signed proof of inheritance,
// a new pc-job operation, a bypass of assertSupervisorOwner or a B recovery.
// A workflow/job may inject its own env; successful comparison is NEVER
// sufficient evidence of original six-Runner lineage or adoption authority.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,timingSafeEqual} from 'node:crypto';

const ROOT='E:/ZGmini/automation/pc-control';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sha64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const uuid4=s=>typeof s==='string'&&
 /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
const pid=n=>Number.isSafeInteger(n)&&n>0;
const stamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const base=Object.freeze({
 schema:'ZGMINI_ORPHAN_RUNNER_SELF_NONCE_READONLY_V1',
 scope:'SELF_ENV_ONLY_NOT_LISTENER_INHERITANCE_PROOF',
 effectAuthorized:false,adoptionAuthorized:false,
 sixRunnerLineageVerified:false,nonceInheritanceVerified:false,
 leaseMutationAuthorized:false,supervisorSpawnAuthorized:false,
 runnerTerminationAuthorized:false,operationalWrites:0,
 providerCalls:0,d1Writes:0,nonceExposed:false
});
const deny=code=>Object.freeze({...base,status:'STATE_UNKNOWN',code,seat:null});
const observed=seat=>Object.freeze({...base,status:'OBSERVED',
 code:'RUNNER_SELF_NONCE_EQUALS_ORIGINAL_OWNER_ONLY',seat});
const boundedRead=(io,rel,max)=>{
 const full=path.join(ROOT,rel);
 const before=io.lstatSync(full);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||
    !Number.isSafeInteger(before.size)||before.size<20||before.size>max)
  throw Error('FILE_UNSAFE');
 const bytes=io.readFileSync(full);
 const after=io.lstatSync(full);
 if(!Buffer.isBuffer(bytes)||bytes.length!==before.size||
    !after.isFile()||after.isSymbolicLink()||after.nlink!==1||
    after.size!==before.size)
  throw Error('FILE_UNVERIFIED');
 return bytes;
};
const sameSecret=(a,b)=>{
 // Fixed-format UUIDs only, and never materialize a comparison transcript.
 if(!uuid4(a)||!uuid4(b))return false;
 const left=Buffer.from(a.toLowerCase()),right=Buffer.from(b.toLowerCase());
 return left.length===right.length&&timingSafeEqual(left,right);
};
function livePid(p){
 try{process.kill(p,0);return true;}
 catch(e){return e?.code==='ESRCH'?false:null;}
}

// Pure projection for isolated tests. No input contents or SHA are returned.
// Caller-supplied job env, process details, or preimage hashes never form an
// authenticated approval and are not accepted by the operating B contract.
export function assessOrphanRunnerSelfNonce({
 env,hostBytes,ownerBytes,statusBytes,expected,
 oldOwnerAlive,bootAt,now=Date.now()
}={}){
 if(!Number.isFinite(now)||!Number.isFinite(bootAt)||!env||
    !sha64(expected?.hostSha256)||!sha64(expected?.ownerSha256)||
    !sha64(expected?.heartbeatSha256))
  return deny('RUNNER_SELF_PREIMAGE_SCOPE_UNVERIFIED');
 if(!Buffer.isBuffer(hostBytes)||!Buffer.isBuffer(ownerBytes)||
    !Buffer.isBuffer(statusBytes)||
    sha(hostBytes)!==expected.hostSha256||
    sha(ownerBytes)!==expected.ownerSha256||
    sha(statusBytes)!==expected.heartbeatSha256)
  return deny('RUNNER_SELF_PREIMAGE_RAW_CAS_CHANGED');
 const match=/^zgmini-pc-0([1-6])$/.exec(env.RUNNER_NAME??'');
 if(!match||env.GITHUB_REPOSITORY!=='ansqhd5774-Choi/zgmini-pc-control'||
    env.GITHUB_ACTIONS!=='true')
  return deny('RUNNER_SELF_JOB_CONTEXT_UNVERIFIED');
 let host,owner,heartbeat;
 try{
  host=JSON.parse(hostBytes.toString('utf8'));
  owner=JSON.parse(ownerBytes.toString('utf8'));
  heartbeat=JSON.parse(statusBytes.toString('utf8'));
 }catch{return deny('RUNNER_SELF_ORIGINAL_JSON_UNVERIFIED');}
 if(!/^[a-f0-9]{40}$/.test(host?.controllerSourceSha??'')||
    !sha64(host?.controllerFiles?.['controller/supervisor.mjs'])||
    !pid(owner?.pid)||!uuid4(owner?.nonce)||
    !Number.isFinite(owner?.bootAt)||
    Math.abs(bootAt-owner.bootAt)>10000||
    oldOwnerAlive!==false)
  return deny('RUNNER_SELF_OLD_OWNER_OR_BOOT_UNVERIFIED');
 const children=heartbeat?.children;
 if(heartbeat?.pid!==owner.pid||
    heartbeat.sourceSha!==host.controllerSourceSha||
    !stamp(heartbeat.at)||Date.parse(heartbeat.at)>now||
    !Array.isArray(children)||children.length!==6)
  return deny('RUNNER_SELF_ORIGINAL_HEARTBEAT_UNVERIFIED');
 const seats=new Set(),wrappers=new Set();
 for(const child of children){
  if(!Number.isInteger(child?.seat)||child.seat<1||child.seat>6||
     !pid(child.pid)||seats.has(child.seat)||wrappers.has(child.pid)||
     child.alive!==true)
   return deny('RUNNER_SELF_ORIGINAL_SIX_WRAPPERS_UNVERIFIED');
  seats.add(child.seat);wrappers.add(child.pid);
 }
 if(!sameSecret(env.ZGMINI_SUPERVISOR_NONCE,owner.nonce))
  return deny('RUNNER_SELF_PROCESS_NONCE_MISMATCH');
 return observed(Number(match[1]));
}

// Only the current job's OWN process.env is read, never the Listener's memory
// or arbitrary other PID's environment. Fixed path and fixed Windows host,
// no Issue-provided path/script/PID, no public token, process or parent IDs.
// This function is NOT connected to the installed pc-job/maintenance path.
export function inspectOrphanRunnerSelfNonceReadonly({
 filesystem=fs,env=process.env,platform=process.platform,
 hostname=os.hostname(),uptime=os.uptime,
 now=()=>Date.now(),pidAlive=livePid,expected
}={}){
 if(platform!=='win32'||String(hostname).toUpperCase()!=='PC'||
    typeof uptime!=='function'||typeof now!=='function'||
    typeof pidAlive!=='function')
  return deny('RUNNER_SELF_CANONICAL_WINDOWS_HOST_REQUIRED');
 let ownerBytes,hostBytes,statusBytes;
 try{
  ownerBytes=boundedRead(filesystem,'leases/supervisor/owner.json',8192);
  hostBytes=boundedRead(filesystem,'host.json',65536);
  statusBytes=boundedRead(filesystem,'SUPERVISOR_STATUS.json',16384);
  // Same raw byte preimage must be observed twice before reporting a result.
  if(sha(ownerBytes)!==sha(boundedRead(filesystem,
      'leases/supervisor/owner.json',8192))||
     sha(hostBytes)!==sha(boundedRead(filesystem,'host.json',65536))||
     sha(statusBytes)!==sha(boundedRead(filesystem,
      'SUPERVISOR_STATUS.json',16384)))
   return deny('RUNNER_SELF_PREIMAGE_CHANGED_DURING_READ');
  const owner=JSON.parse(ownerBytes.toString('utf8'));
  const alive=pid(owner?.pid)?pidAlive(owner.pid):null;
  const instant=now(),bootAt=instant-uptime()*1000;
  return assessOrphanRunnerSelfNonce({
   env,ownerBytes,hostBytes,statusBytes,expected,
   oldOwnerAlive:alive,bootAt,now:instant
  });
 }catch{return deny('RUNNER_SELF_FIXED_READ_UNVERIFIED');}
}
