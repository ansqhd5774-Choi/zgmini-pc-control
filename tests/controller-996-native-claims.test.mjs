import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {create996NativeClaimStore} from '../tools/controller-996-native-claims.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const exactRequest='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const leases=path.join(root,'leases');fs.mkdirSync(leases);
 const original=path.join(leases,'controller-install');fs.mkdirSync(original);
 const ownerBytes=Buffer.from(JSON.stringify({pid:43210,nonce:'fixed-original-nonce'})+'\n');
 const markerBytes=Buffer.from(JSON.stringify({requestOwnerPid:43210,nonce:'fixed-original-nonce'})+'\n');
 fs.writeFileSync(path.join(original,'owner.json'),ownerBytes);
 fs.writeFileSync(path.join(original,'RECOVERY_REQUIRED.json'),markerBytes);
 const options={root,testOnly:true,now:()=> '2026-11-10T03:00:00.000Z',
  uuid:()=> 'fixed-recovery-nonce',isPidAlive:()=> false};
 return {root,leases,original,ownerSha:sha(ownerBytes),markerSha:sha(markerBytes),options};
}

test('constructor is read-only; claim is unique and has pinned owner',t=>{
 const f=fixture(t),s=create996NativeClaimStore(f.options);
 assert.equal(fs.existsSync(s.claimPaths.claim),false);
 const owner=s.reserveClaim();
 assert.equal(owner.requestId,exactRequest);
 assert.equal(owner.nonce,'fixed-recovery-nonce');
 assert.equal(s.ownClaimReadback().nonce,owner.nonce);
 assert.equal(fs.existsSync(f.original),true);
 assert.throws(()=>s.reserveClaim(),/C_RECOVERY_CLAIM_BUSY/);
});

test('durable marker uses exclusive create; restart cannot duplicate intent',t=>{
 const f=fixture(t),a=create996NativeClaimStore(f.options);
 a.reserveClaim();
 const digest=a.recordOnce('WORKFLOW_ENABLE_ATTEMPTED',{approvedScope:'test'});
 assert.match(digest,/^[a-f0-9]{64}$/);
 assert.equal(a.hasMarker('WORKFLOW_ENABLE_ATTEMPTED'),true);
 assert.throws(()=>a.recordOnce('WORKFLOW_ENABLE_ATTEMPTED'),/EEXIST/);
 const b=create996NativeClaimStore({...f.options,uuid:()=> 'new-process-nonce'});
 assert.throws(()=>b.reserveClaim(),/C_RECOVERY_CLAIM_BUSY/);
 assert.equal(fs.existsSync(path.join(a.claimPaths.claim,'WORKFLOW_ENABLE_ATTEMPTED.json')),true);
});

test('nonce tampering blocks every later durable transition',t=>{
 const f=fixture(t),s=create996NativeClaimStore(f.options);
 s.reserveClaim();
 const file=path.join(s.claimPaths.claim,'owner.json');
 const owner=JSON.parse(fs.readFileSync(file));owner.nonce='different-owner';
 fs.writeFileSync(file,JSON.stringify(owner));
 assert.throws(()=>s.recordOnce('PREPARED'),/C_OWN_CLAIM_OWNER_MISMATCH/);
 assert.equal(fs.existsSync(path.join(s.claimPaths.claim,'PREPARED.json')),false);
 assert.equal(fs.existsSync(f.original),true);
});

test('original install lease archive requires both earlier markers and pinned bytes',t=>{
 const f=fixture(t),s=create996NativeClaimStore(f.options);
 s.reserveClaim();
 const a={ownerSha:f.ownerSha,recoveryMarkerSha:f.markerSha};
 assert.throws(()=>s.archiveOriginalLease(a),/C_ORIGINAL_LEASE_ARCHIVE_INTENTS_MISSING/);
 s.recordOnce('PRE_ARCHIVE');
 s.recordOnce('ORIGINAL_LEASE_ARCHIVE_ATTEMPTED');
 assert.throws(()=>s.archiveOriginalLease({...a,ownerSha:'1'.repeat(64)}),
  /C_ORIGINAL_LEASE_CAS_MISMATCH/);
 assert.equal(s.archiveOriginalLease(a),true);
 assert.equal(fs.existsSync(f.original),false);
 assert.equal(fs.existsSync(s.claimPaths.originalArchived),true);
 assert.throws(()=>s.archiveOriginalLease(a),/C_ORIGINAL_LEASE_ARCHIVED_ALREADY/);
});

test('unknown/alive install lease owner blocks archive',t=>{
 const f=fixture(t),s=create996NativeClaimStore({...f.options,isPidAlive:()=> null});
 s.reserveClaim();s.recordOnce('PRE_ARCHIVE');s.recordOnce('ORIGINAL_LEASE_ARCHIVE_ATTEMPTED');
 assert.throws(()=>s.archiveOriginalLease({ownerSha:f.ownerSha,
  recoveryMarkerSha:f.markerSha}),/C_ORIGINAL_INSTALL_OWNER_ALIVE_OR_UNKNOWN/);
 assert.equal(fs.existsSync(f.original),true);
});

test('own claim archive requires successful COMPLETE and own intent; never deletes files',t=>{
 const f=fixture(t),s=create996NativeClaimStore(f.options);
 s.reserveClaim();s.recordOnce('PRE_ARCHIVE');s.recordOnce('ORIGINAL_LEASE_ARCHIVE_ATTEMPTED');
 s.archiveOriginalLease({ownerSha:f.ownerSha,recoveryMarkerSha:f.markerSha});
 assert.throws(()=>s.archiveOwnClaim(),/C_OWN_CLAIM_COMPLETE_INTENTS_MISSING/);
 s.recordOnce('COMPLETE',{status:'INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED'});
 s.recordOnce('OWN_CLAIM_ARCHIVE_ATTEMPTED');
 assert.equal(s.archiveOwnClaim(),true);
 assert.equal(fs.existsSync(s.claimPaths.claim),false);
 assert.equal(fs.existsSync(s.claimPaths.ownArchived),true);
 assert.equal(fs.existsSync(path.join(s.claimPaths.ownArchived,'WORKFLOW_ENABLE_ATTEMPTED.json')),false);
 assert.equal(fs.existsSync(s.claimPaths.originalArchived),true);
});

test('test root cannot be mistaken for a production Windows E: installation',()=>{
 assert.throws(()=>create996NativeClaimStore({root:'E:/ZGmini/automation/pc-maintenance',testOnly:true}),
  /C_TEST_ONLY_ROOT_REJECTED/);
 assert.throws(()=>create996NativeClaimStore({root:'/tmp',testOnly:true}),
  /C_TEST_ONLY_ROOT_REJECTED/);
 assert.throws(()=>create996NativeClaimStore({root:'/tmp'}),
  /C_ORIGINAL_WINDOWS_PC_REQUIRED/);
});

test('unrecognized intent name never creates a marker',t=>{
 const f=fixture(t),s=create996NativeClaimStore(f.options);s.reserveClaim();
 assert.throws(()=>s.recordOnce('ENABLE_WORKFLOW_NOW'),/C_MARKER_NOT_ALLOWED/);
 assert.equal(fs.readdirSync(s.claimPaths.claim).length,1);
});
