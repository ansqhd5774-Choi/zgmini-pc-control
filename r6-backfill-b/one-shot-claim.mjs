// Persistent R6 B approval-specific, no-retry claim. SOURCE ONLY: invoking
// this function is an approved B effect and must occur only inside the trusted
// Windows host after immutable approval, existing Core DB, exclusive lock and
// BLS coverage checks. The approved manifest hash, not a fresh Issue UUID,
// identifies the one permitted execution.
import fs from 'node:fs';
import path from 'node:path';
import {APPROVED_R6_CORE_BASE} from './core-lane-lock.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256=/^[a-f0-9]{64}$/;
const error=code=>Object.assign(Error(code),{code});
const claimName=hash=>`employment-r6-b-once-${hash}.json`;

function claim({base,requestId,approvalManifestSha256,heldCoreLock,
  io,pid,now,fixture=false}){
  if (!UUID.test(requestId??'') || !SHA256.test(approvalManifestSha256??''))
    throw error('R6_B_ONESHOT_ID_OR_APPROVAL_INVALID');
  if (heldCoreLock?.verifyHeld?.()!==true)
    throw error('R6_B_ONESHOT_CORE_LOCK_NOT_HELD');
  if (!fixture && process.platform!=='win32')throw error('R6_B_WINDOWS_ONLY_STOP');
  if (!fixture && path.win32.normalize(base).toLowerCase()!==
      path.win32.normalize(APPROVED_R6_CORE_BASE).toLowerCase())
    throw error('R6_B_ONESHOT_BASE_UNAPPROVED');
  if (!Number.isSafeInteger(pid)||pid<=0||!Number.isSafeInteger(now)||now<=0)
    throw error('R6_B_ONESHOT_CLOCK_INVALID');
  let dir;
  try {
    const stat=io.lstatSync(base);
    if (!stat.isDirectory()||stat.isSymbolicLink())
      throw error('R6_B_ONESHOT_BASE_SHAPE_STOP');
    dir=io.realpathSync.native(base);
  } catch (cause) {
    throw error(cause?.code==='R6_B_ONESHOT_BASE_SHAPE_STOP'?cause.code:'R6_B_ONESHOT_BASE_MISSING');
  }
  if (!fixture && path.win32.normalize(dir).toLowerCase()!==
      path.win32.normalize(APPROVED_R6_CORE_BASE).toLowerCase())
    throw error('R6_B_ONESHOT_REALPATH_STOP');

  const file=path.join(dir,claimName(approvalManifestSha256));
  const bytes=JSON.stringify({schema:'ZGMINI_R6_B_ONESHOT_CLAIM_V1',
    approvalManifestSha256,requestId,pid,claimedAt:new Date(now).toISOString(),
    state:'CLAIMED_NO_RETRY'})+'\n';
  let fd;
  try {fd=io.openSync(file,'wx',0o600);} catch (cause) {
    throw error(cause?.code==='EEXIST'?'R6_B_ONESHOT_ALREADY_CLAIMED':'R6_B_ONESHOT_CREATE_FAILED');
  }
  try {
    io.writeFileSync(fd,bytes,'utf8');
    io.fsyncSync(fd);
  } catch {
    // A partial durable file blocks future attempts: never auto-delete it or
    // return CLAIMED if its journal write was not proven.
    throw error('R6_B_ONESHOT_CLAIM_STATE_UNKNOWN');
  } finally {io.closeSync(fd);}
  try {
    if (io.readFileSync(file,'utf8')!==bytes)
      throw error('R6_B_ONESHOT_READBACK_MISMATCH');
  } catch {
    throw error('R6_B_ONESHOT_CLAIM_STATE_UNKNOWN');
  }
  if (heldCoreLock?.verifyHeld?.()!==true)
    throw error('R6_B_ONESHOT_CLAIM_STATE_UNKNOWN');
  return {status:'CLAIMED_NO_RETRY',requestId,approvalManifestSha256};
}

export function claimApprovedR6BOnce({requestId,approvalManifestSha256,heldCoreLock}={}){
  return claim({base:APPROVED_R6_CORE_BASE,requestId,approvalManifestSha256,
    heldCoreLock,io:fs,pid:process.pid,now:Date.now()});
}

export function claimR6BOnceFixture({base,requestId,approvalManifestSha256,
  heldCoreLock,io=fs,pid=process.pid,now=Date.now()}={}){
  return claim({base,requestId,approvalManifestSha256,heldCoreLock,io,pid,now,fixture:true});
}
