// R6 B host Core lane lock, SOURCE ONLY. No caller may force-release an
// existing local-cycle.lock. This protects the actual PC Core runner and the
// R6 one-shot from writing the same existing SQLite files concurrently.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const APPROVED_R6_CORE_BASE = String.raw`E:\ZGmini\data\pc-writer`;
export const APPROVED_R6_CORE_LOCK = String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LOCK_OWNER = 'EMPLOYMENT_R6_B_ONE_SHOT';
const error = code => Object.assign(new Error(code), { code });

function sameFileIdentity(a, b) {
  // Under NTFS the device/inode pair identifies the file we exclusively
  // created. Some filesystems report ino=0; the nonce check remains required.
  return a?.dev === b?.dev && a?.ino === b?.ino;
}

function safeRelease({io, file, original, bytes}) {
  let actual, disk;
  try {
    actual = io.lstatSync(file);
    if (!actual.isFile() || !sameFileIdentity(original, actual))
      return {released:false, code:'R6_B_CORE_LOCK_IDENTITY_CHANGED'};
    disk = io.readFileSync(file, 'utf8');
  } catch {
    return {released:false, code:'R6_B_CORE_LOCK_UNREADABLE'};
  }
  if (disk !== bytes)
    return {released:false, code:'R6_B_CORE_LOCK_CONTENT_CHANGED'};
  try {
    io.unlinkSync(file);
    return {released:true, code:'R6_B_CORE_LOCK_RELEASED'};
  } catch {
    return {released:false, code:'R6_B_CORE_LOCK_RELEASE_FAILED'};
  }
}

function acquire({requestId,base,io,pid,now,nonce,fixture}) {
  if (!UUID.test(requestId ?? '') || !UUID.test(nonce ?? '') ||
      !Number.isSafeInteger(pid) || pid <= 0 ||
      !Number.isSafeInteger(now) || now <= 0)
    throw error('R6_B_CORE_LOCK_INPUT_INVALID');
  if (fixture !== true) {
    if (process.platform !== 'win32') throw error('R6_B_WINDOWS_ONLY_STOP');
    if (path.win32.normalize(base).toLowerCase() !==
        path.win32.normalize(APPROVED_R6_CORE_BASE).toLowerCase())
      throw error('R6_B_CORE_BASE_NOT_APPROVED');
  }
  let dir;
  try {
    const stat = io.lstatSync(base);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw error('R6_B_CORE_BASE_SHAPE_STOP');
    dir = io.realpathSync.native(base);
  } catch (cause) {
    throw error(cause?.code === 'R6_B_CORE_BASE_SHAPE_STOP' ? cause.code : 'R6_B_CORE_BASE_MISSING');
  }
  if (fixture !== true &&
      path.win32.normalize(dir).toLowerCase() !==
        path.win32.normalize(APPROVED_R6_CORE_BASE).toLowerCase())
    throw error('R6_B_CORE_BASE_REALPATH_STOP');

  const file = path.join(dir, 'local-cycle.lock');
  if (fixture !== true &&
      path.win32.normalize(file).toLowerCase() !==
        path.win32.normalize(APPROVED_R6_CORE_LOCK).toLowerCase())
    throw error('R6_B_CORE_LOCK_PATH_STOP');
  // Keep the fields the pre-existing local-cycle.mjs consumer reads, while
  // adding a nonce so this B host can remove ONLY its own lock.
  const bytes = JSON.stringify({pid,at:now,owner:LOCK_OWNER,requestId,nonce});
  let handle;
  try {
    handle = io.openSync(file, 'wx', 0o600);
  } catch (cause) {
    throw error(cause?.code === 'EEXIST' ? 'R6_B_CORE_LOCK_OCCUPIED' : 'R6_B_CORE_LOCK_CREATE_FAILED');
  }
  let closed = false;
  try {
    io.writeFileSync(handle, bytes, 'utf8');
    io.fsyncSync(handle);
    io.closeSync(handle);
    closed = true;
    const original = io.lstatSync(file);
    if (!original.isFile() || io.readFileSync(file,'utf8') !== bytes)
      throw error('R6_B_CORE_LOCK_READBACK_FAILED');
    let finished = false;
    return Object.freeze({
      file,
      requestId,
      release() {
        if (finished) return {released:false,code:'R6_B_CORE_LOCK_ALREADY_RELEASED'};
        const released = safeRelease({io,file,original,bytes});
        if (released.released) finished = true;
        return released;
      },
      // Read-back is required before each sensitive stage; if another process
      // corrupts/replaces the file, do not call the provider or local SQLite.
      verifyHeld() {
        try {
          const actual = io.lstatSync(file);
          return actual.isFile() && sameFileIdentity(original,actual) &&
            io.readFileSync(file,'utf8') === bytes;
        } catch { return false; }
      },
    });
  } catch (cause) {
    if (!closed) try { io.closeSync(handle); } catch {}
    // A failed fsync/read-back is an unknown lock effect. Do not delete the
    // file without a verified identity and matching content.
    throw error(cause?.code?.startsWith('R6_B_') ? cause.code : 'R6_B_CORE_LOCK_DURABILITY_UNKNOWN');
  }
}

// PRODUCTION entry: only this function is permitted to hold the Core lock;
// fixture injection is never exposed through the Windows runtime adapter.
export function acquireApprovedR6CoreLaneLock(requestId) {
  return acquire({requestId,base:APPROVED_R6_CORE_BASE,io:fs,
    pid:process.pid,now:Date.now(),nonce:randomUUID(),fixture:false});
}

// Explicitly test-only. Never use as authorization or a B host operation.
export function acquireR6CoreLaneLockFixture({requestId,base,io=fs,
  pid=process.pid,now=Date.now(),nonce=randomUUID()}={}) {
  return acquire({requestId,base,io,pid,now,nonce,fixture:true});
}
