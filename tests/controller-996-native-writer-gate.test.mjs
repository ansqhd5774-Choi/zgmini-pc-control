import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {create996NativeCooperativeWriterGate}
 from '../tools/controller-996-native-writer-gate.mjs';

const requestId='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const source='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const nonce='e10b854e-2db9-4bc2-b858-bb3f72e557e5';
const paths=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
 'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
 'tools/update.mjs','tools/maintenance-ancestry.vbs',
 'tools/source-bundle-register.mjs'];
const hash=x=>createHash('sha256').update(x).digest('hex');

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const write=(file,bytes)=>{
  const dst=path.join(root,file);fs.mkdirSync(path.dirname(dst),{recursive:true});
  const content=Buffer.isBuffer(bytes)?bytes:Buffer.from(JSON.stringify(bytes)+'\n');
  fs.writeFileSync(dst,content);return hash(content);
 };
 const hashes={};
 hashes.ledger=write(`ledger/${requestId}.json`,{requestId,status:'RECOVERY_REQUIRED',firstFail:'INTAKE_PAUSED'});
 hashes.owner=write('leases/controller-install/owner.json',{pid:777777,nonce});
 hashes.marker=write('leases/controller-install/RECOVERY_REQUIRED.json',{requestOwnerPid:777777,nonce});
 hashes.backlog=write(`backlog/${requestId}.json`,{requestId,resumedAt:null});
 const sourceBytes=Object.fromEntries(paths.map(rel=>[rel,Buffer.from('fixture:'+rel+'\n')]));
 const fileMap=Object.fromEntries(paths.map(rel=>[rel,write(rel,sourceBytes[rel])]));
 hashes.maintainer=write('MAINTENANCE_INSTALL.json',{
  schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha:source,files:fileMap});
 let own={requestId,nonce,pid:process.pid};let dead=true;
 const create=()=>create996NativeCooperativeWriterGate({root,testOnly:true,
  expectedDigests:hashes,claimStore:{ownClaimReadback:()=>own},
  sourceRead:(s,rel)=>{assert.equal(s,source);return sourceBytes[rel];},
  isPidAlive:()=>dead?false:true});
 const prove=()=>create().proveExclusiveWriter({requestId,ownerNonce:nonce});
 return {root,write,hashes,sourceBytes,fileMap,prove,create,
  setOwn:v=>{own=v;},setDead:v=>{dead=v;}};
}

test('pinned original dead install owner, owned C claim and verified installed source prove cooperating Writer contract only',t=>{
 const f=fixture(t);
 assert.equal(f.prove(),true);
 assert.equal(f.create().proveExclusiveWriter({requestId,ownerNonce:nonce}),true);
});

test('original request, current self claim and source ownership are mandatory',t=>{
 const f=fixture(t);
 for(const args of [{requestId:'other',ownerNonce:nonce},
  {requestId,ownerNonce:'not-a-nonce'}])
  assert.throws(()=>f.create().proveExclusiveWriter(args),/C_WRITER_REQUEST_OR_NONCE_INVALID/);
 f.setOwn({requestId,nonce:'different',pid:process.pid});
 assert.throws(()=>f.prove(),/C_WRITER_OWN_CLAIM_NOT_CURRENT/);
 f.setOwn({requestId,nonce,pid:process.pid+1});
 assert.throws(()=>f.prove(),/C_WRITER_OWN_CLAIM_NOT_CURRENT/);
});

test('live or unknowable original owner cannot be treated as dead',t=>{
 const f=fixture(t);f.setDead(false);
 assert.throws(()=>f.prove(),/C_WRITER_ORIGINAL_OWNER_ALIVE_OR_UNVERIFIED/);
});

test('any original backlog, ledger, lease or maintainer digest drift blocks before writes',t=>{
 for(const rel of [`ledger/${requestId}.json`,
  'leases/controller-install/owner.json',
  'leases/controller-install/RECOVERY_REQUIRED.json',
  `backlog/${requestId}.json`,'MAINTENANCE_INSTALL.json']){
  const f=fixture(t);f.write(rel,{});
  assert.throws(()=>f.prove(),/C_WRITER_PINNED_ORIGINAL_DRIFT/);
 }
});

test('rechecked backlog source between callbacks stops a concurrent writer',t=>{
 const f=fixture(t);assert.equal(f.prove(),true);
 f.write(`backlog/${requestId}.json`,{requestId,resumedAt:'2026-11-10T04:09:00Z'});
 assert.throws(()=>f.prove(),/C_WRITER_PINNED_ORIGINAL_DRIFT/);
});

test('every installed cooperating Writer source must match manifest and fixed Git source',t=>{
 for(const rel of paths){
  const f=fixture(t);f.write(rel,Buffer.from('tampered code'));
  assert.throws(()=>f.prove(),/C_WRITER_INSTALLED_CODE_DRIFT/);
 }
});

test('symlink redirection and unknown maintenance manifest layout are never accepted',t=>{
 const f=fixture(t);
 const target=path.join(f.root,'tools/update.mjs');
 const elsewhere=path.join(f.root,'external.mjs');fs.writeFileSync(elsewhere,'test');
 fs.unlinkSync(target);fs.symlinkSync(elsewhere,target);
 assert.throws(()=>f.prove(),/C_WRITER_PATH_REDIRECT/);
 const x=fixture(t);const badManifest={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha:source,files:{'tools/update.mjs':'a'.repeat(64)}};
 x.hashes.maintainer=x.write('MAINTENANCE_INSTALL.json',badManifest);
 assert.throws(()=>x.prove(),/C_WRITER_INSTALLED_SOURCE_MANIFEST_DRIFT/);
});

test('normal Linux fixture cannot enable production original Windows mode',t=>{
 const f=fixture(t);
 assert.throws(()=>create996NativeCooperativeWriterGate({root:f.root,
  claimStore:{ownClaimReadback:()=>({requestId,nonce,pid:process.pid})}}),
 /C_WRITER_ORIGINAL_WINDOWS_REQUIRED/);
});
