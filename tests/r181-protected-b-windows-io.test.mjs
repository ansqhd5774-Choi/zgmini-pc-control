import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeR181Acl,createR181ProtectedWindowsIo,
} from '../tools/r181-protected-b-windows-io.mjs';

const rejects=fn=>assert.throws(fn,e=>e?.code?.startsWith('R181_B_'));

test('ACL comparisons remove formatting indentation but never publish raw ACL text',()=>{
  const file='C:\\example\\source.mjs';
  const one=file+' BUILTIN\\Administrators:(I)(F)\r\n     NT AUTHORITY\\SYSTEM:(I)(F)\r\n';
  const two=file+' BUILTIN\\Administrators:(I)(F)\n        NT AUTHORITY\\SYSTEM:(I)(F)\n';
  assert.equal(normalizeR181Acl(one,file),normalizeR181Acl(two,file));
  rejects(()=>normalizeR181Acl('C:\\other\\source.mjs something',file));
  rejects(()=>normalizeR181Acl(file+' \r\n',file));
});

test('Windows IO is exact fixed-target and does nothing on construction',async()=>{
  if(process.platform!=='win32'){
    rejects(()=>createR181ProtectedWindowsIo());
    return;
  }
  const io=createR181ProtectedWindowsIo();
  assert.equal(Object.isFrozen(io),true);
  assert.deepEqual(Object.keys(io).sort(),[
    'acquireSharedWriterLease','backupAndVerify','claimOnce','journal',
    'readPinnedFile','releaseWriterLease','replaceAtomically','restoreAtomically',
  ].sort());
  // Never call acquireSharedWriterLease in source-only isolated CI.
  await assert.rejects(
    ()=>io.readPinnedFile('C:\\not-the-real-target.mjs'),
    e=>e?.code==='R181_B_SHARED_LEASE_DRIFT_STOP'
  );
  await assert.rejects(
    ()=>io.replaceAtomically('C:\\not-the-real-target.mjs',Buffer.from('x'),
      '00000000-0000-4000-8000-000000000001'),
    e=>e?.code==='R181_B_REQUEST_OWNER_STOP'
  );
});

test('importing the module never installs or registers a B operation',()=>{
  assert.equal(typeof createR181ProtectedWindowsIo,'function');
  assert.equal(typeof normalizeR181Acl,'function');
});
