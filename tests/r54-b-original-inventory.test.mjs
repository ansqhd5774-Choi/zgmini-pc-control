import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectR54BOriginalSource,classifyR54PinnedHash,
 runR54BApprovedOneShot} from '../tools/update.mjs';
import {R54_B_SOURCE_FILES} from '../tools/maintenance-contract.mjs';
import {R54_B_OPERATION} from '../tools/maintenance-contract.mjs';
import {normalizedResult} from '../tools/maintenance-agent.mjs';

test('source inventory rejects unknown or absent R54 Writer root read-only',()=>{
 const root=path.join(os.tmpdir(),'r54-b-never-existent-'+process.pid);
 assert.throws(()=>inspectR54BOriginalSource({root}),/ENOENT/);
});

test('wrong installed bytes report all six files and preserve existing bytes',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-b-src-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const target=path.join(root,'scripts','pc-writer','theme-nine-r54-public-connect.mjs');
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,'not-the-approved-source');
 let blocked;
 try{inspectR54BOriginalSource({root});}catch(error){blocked=error;}
 assert.equal(blocked?.code,'R54_B_ORIGINAL_SOURCE_SHA_DRIFT');
 assert.equal(blocked.sourceInventory.length,6);
 assert.deepEqual(blocked.sourceInventory.map(x=>x.state),
  ['UNKNOWN','MISSING','MISSING','MISSING','MISSING','MISSING']);
 assert.deepEqual(blocked.sourceInventory.map(x=>x.path),
  R54_B_SOURCE_FILES.map(x=>x.path));
 assert.equal(fs.readFileSync(target,'utf8'),'not-the-approved-source');
});

test('old/next/unknown/missing classification never silently approves an unknown',()=>{
 const pin=R54_B_SOURCE_FILES[0];
 assert.equal(classifyR54PinnedHash(pin,pin.old),'OLD');
 assert.equal(classifyR54PinnedHash(pin,pin.next),'NEXT');
 assert.equal(classifyR54PinnedHash(pin,'f'.repeat(64)),'UNKNOWN');
 assert.equal(classifyR54PinnedHash(pin,null),'MISSING');
});

test('drift returns BLOCKED before Task, lock or Writer mutation',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-preflight-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const error=Object.assign(Error('R54_B_ORIGINAL_SOURCE_SHA_DRIFT'),{
  code:'R54_B_ORIGINAL_SOURCE_SHA_DRIFT',
  sourceInventory:R54_B_SOURCE_FILES.map(x=>({path:x.path,actual:null,
   state:'MISSING',expectedOld:x.old,approvedNext:x.next}))});
 const forbidden=()=>{throw Error('PREVALIDATION_WROTE_OPERATIONAL_STATE');};
 const result=await runR54BApprovedOneShot({
  requestId:'pc-1a3cd174-bb6e-4d0b-803d-e89cfc464286',writerRoot:root,
  backupBase:root,loadCandidates:()=>new Map(),
  inspectOriginal:()=>{throw error;},
  acquireInstall:forbidden,acquireWriter:forbidden,taskFactory:forbidden,
  applyFiles:forbidden,sourceScan:forbidden});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.firstFail,'R54_B_ORIGINAL_SOURCE_SHA_DRIFT');
 assert.equal(result.taskWrites,0);
 assert.equal(result.writerFilesChanged,0);
 assert.equal(result.sourceInventory.length,6);
});

test('source root symlink is not followed as a trusted installation',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-b-root-'));
 const alias=root+'-alias';
 fs.symlinkSync(root,alias,'dir');
 assert.throws(()=>inspectR54BOriginalSource({root:alias}),
  /R54_B_SOURCE_ROOT_REDIRECT/);
});

test('R54 B result returns the six validated rows and exact first failure',()=>{
 const rows=R54_B_SOURCE_FILES.map((x,i)=>({path:x.path,
  state:i===1?'UNKNOWN':'OLD',actual:i===1?'f'.repeat(64):x.old,
  expectedOld:x.old,approvedNext:x.next}));
 const request={requestId:'pc-1a3cd174-bb6e-4d0b-803d-e89cfc464286',
  targetControllerSha:'69c830275bd3fec75b17c8a98c46d689447fb1a7',
  operation:R54_B_OPERATION};
 const result=normalizedResult(request,{status:'BLOCKED',
  code:'R54_B_ORIGINAL_SOURCE_SHA_DRIFT',sourceInventory:rows,
  protectedStateUnchanged:true},'R54_B_ORIGINAL_SOURCE_SHA_DRIFT');
 assert.equal(result.firstFail,'R54_B_ORIGINAL_SOURCE_SHA_DRIFT');
 assert.equal(result.workflowEnabled,null);
 assert.equal(result.sourceInventory.length,6);
 rows[0].path='../../secret.env';
 const rejected=normalizedResult(request,{status:'BLOCKED',sourceInventory:rows},
  'R54_B_ORIGINAL_SOURCE_SHA_DRIFT');
 assert.equal('sourceInventory' in rejected,false);
});
