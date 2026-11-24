import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readPinnedSidecarCandidate} from './pinned-candidate.mjs';
import {SCHEMA,TARGET,PREIMAGE,sha256} from './contract.mjs';
const WIN=process.platform==='win32';
const sourceSha='a'.repeat(40);
const data=Buffer.from('// isolated approved candidate bytes\n');
const manifest={schema:SCHEMA,status:'APPROVED_B',
 requestId:'8f265fcb-45b7-43b8-acd2-40976524db91',
 target:TARGET,beforeSha256:PREIMAGE,
 afterSha256:sha256(data),approvedContentSha256:sha256(data),
 approvedSourceSha:sourceSha,installedHead:sourceSha,
 installedConfigSource:sourceSha,taskDefinitionSha256:'b'.repeat(64),
 wrapperSha256:'b'.repeat(64),runCount:1,
 allowProviderCalls:false,allowDbChanges:false,
 allowD1Writes:false,allowTaskChanges:false};
function make(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cnn-approved-source-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const parent=path.join(root,'sidecar-b','approved');
 fs.mkdirSync(parent,{recursive:true});
 const file=path.join(parent,'archive-run.mjs');
 fs.writeFileSync(file,data);
 const git=(_root,args)=>({status:0,stdout:args[0]==='rev-parse'?sourceSha:''});
 const read=(changes={})=>readPinnedSidecarCandidate({
  candidateRoot:root,manifest,runGit:git,...changes});
 return {root,file,git,read};
}
test('candidate module refuses non-Windows execution',()=>{
 if(!WIN)assert.throws(()=>readPinnedSidecarCandidate({
  candidateRoot:os.tmpdir(),manifest
 }),e=>e.code==='SIDECAR_B_CANDIDATE_ROOT_STOP');
});
test('exact committed clean candidate source and bytes pass',
 {skip:!WIN},t=>{
 const f=make(t);assert.deepEqual(f.read(),data);
});
test('candidate commit drift and untracked candidate reject',
 {skip:!WIN},t=>{
 const f=make(t);
 assert.throws(()=>f.read({runGit:(_root,args)=>({
  status:0,stdout:args[0]==='rev-parse'?'f'.repeat(40):''
 })}),e=>e.code==='SIDECAR_B_CANDIDATE_SOURCE_STOP');
 assert.throws(()=>f.read({runGit:(_root,args)=>({
  status:args[0]==='ls-files'?1:0,
  stdout:args[0]==='rev-parse'?sourceSha:''
 })}),e=>e.code==='SIDECAR_B_CANDIDATE_UNTRACKED_STOP');
});
test('source bytes changed after approval and dirty worktree reject',
 {skip:!WIN},t=>{
 const f=make(t);
 fs.writeFileSync(f.file,Buffer.from('not approved'));
 assert.throws(()=>f.read(),e=>e.code==='SIDECAR_B_CANDIDATE_HASH_STOP');
 fs.writeFileSync(f.file,data);
 assert.throws(()=>f.read({runGit:(_root,args)=>({
  status:args[0]==='diff'?1:0,
  stdout:args[0]==='rev-parse'?sourceSha:''
 })}),e=>e.code==='SIDECAR_B_CANDIDATE_DIRTY_STOP');
});
