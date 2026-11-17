import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pinnedR47CandidateBlobOid,verifiedR47CandidateSource}
 from '../task-cmd-b/candidate-source-provenance.mjs';

import assert from 'node:assert/strict';
import {makeR47WindowsAdapter,runPinnedR47WindowsB}
 from '../task-cmd-b/windows-adapter.mjs';
import {prepareR47SourcePin} from '../task-cmd-b/source-pin.mjs';
test('Windows entrypoints import, but arbitrary request cannot receive Task I/O',()=>{
 assert.equal(typeof runPinnedR47WindowsB,'function');
 assert.equal(typeof prepareR47SourcePin,'function');
 assert.throws(()=>makeR47WindowsAdapter({
  manifest:{status:'APPROVED_B',task:'ZGMINI-PC-Theme-Nine-R47-Private'},
  requestId:'fake'
 },{candidateRoot:'X:/untrusted'}),{
  code:'TASK_CMD_B_APPROVAL_NOT_AUTHENTICATED_STOP'});
});
test('source pin rejects unapproved Issue body before opening a PC file',()=>{
 assert.throws(()=>prepareR47SourcePin({
  controlRoot:'X:/nonexistent',event:{issue:{body:'{}'}},env:{}
 }),{code:'TASK_CMD_B_APPROVAL_PATH_STOP'});
});

const hash=b=>createHash('sha256').update(b).digest('hex');
const sourcePath='scripts/pc-writer/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd';
function fixture(){
 const bytes=Buffer.from('@echo off\r\necho pinned\r\n');
 const sourceSha='a'.repeat(40),blobOid='b'.repeat(40);
 const m={sourceSha,sourcePath,afterSha256:hash(bytes)};
 const proof={initialHead:sourceSha,finalHead:sourceSha,
  treeEntry:`100644 blob ${blobOid}\t${sourcePath}`,blobOid,
  pathStatus:'',gitBlob:bytes,worktreeBytes:Buffer.from(bytes)};
 return {m,proof};
}
test('exact pinned blob plus unchanged on-disk CMD is accepted',()=>{
 const {m,proof}=fixture();
 assert.deepEqual(verifiedR47CandidateSource(m,proof),proof.worktreeBytes);
});
test('unrelated dirty workspace entries are not an authorization input',()=>{
 const {m,proof}=fixture();
 // Full git status can be dirty; exact approved CMD status remains clean.
 const unrelatedGlobalStatus='?? unrelated-generated-report.json';
 assert.notEqual(unrelatedGlobalStatus,'');
 assert.deepEqual(verifiedR47CandidateSource(m,proof),proof.worktreeBytes);
});
test('tracked mode and path must be exact regular approved CMD blob',()=>{
 const {m,proof}=fixture();
 for(const treeEntry of [
  `120000 blob ${proof.blobOid}\t${sourcePath}`,
  `100755 blob ${proof.blobOid}\t${sourcePath}`,
  `100644 blob ${proof.blobOid}\tother.cmd`,
  '',
 ])assert.throws(()=>pinnedR47CandidateBlobOid(treeEntry,m.sourcePath),
  {code:'TASK_CMD_B_CANDIDATE_GIT_MODE_STOP'});
});
test('HEAD must stay pinned both before and after candidate inspection',()=>{
 const {m,proof}=fixture();
 for(const prop of ['initialHead','finalHead']){
  assert.throws(()=>verifiedR47CandidateSource(m,{...proof,[prop]:'c'.repeat(40)}),
   {code:'TASK_CMD_B_CANDIDATE_HEAD_DRIFT_STOP'});
 }
});
test('tracked CMD status modification remains fail-closed',()=>{
 const {m,proof}=fixture();
 for(const status of [' M scripts/pc-writer/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd',
  '?? scripts/pc-writer/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd']){
  assert.throws(()=>verifiedR47CandidateSource(m,{...proof,pathStatus:status}),
   {code:'TASK_CMD_B_CANDIDATE_SOURCE_DRIFT_STOP'});
 }
});
test('Git object ID and immutable Git blob must match the approved file',()=>{
 const {m,proof}=fixture();
 assert.throws(()=>verifiedR47CandidateSource(m,{...proof,blobOid:'c'.repeat(40)}),
  {code:'TASK_CMD_B_CANDIDATE_GIT_BLOB_STOP'});
 assert.throws(()=>verifiedR47CandidateSource(m,{...proof,gitBlob:Buffer.from('different')}),
  {code:'TASK_CMD_B_CANDIDATE_GIT_BLOB_STOP'});
});
test('working bytes must match both Git blob and approved afterSHA',()=>{
 const {m,proof}=fixture();
 assert.throws(()=>verifiedR47CandidateSource(m,
  {...proof,worktreeBytes:Buffer.from('changed')}),
  {code:'TASK_CMD_B_CANDIDATE_WORKTREE_DRIFT_STOP'});
});
test('real Git: untracked sibling leaves approved CMD path clean; edits do not',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r47-candidate-proof-'));
 const git=(...args)=>{
  const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',shell:false});
  assert.equal(r.status,0,r.stderr);
  return r.stdout.trim();
 };
 try{
  git('init','-q');
  git('config','core.autocrlf','false');
  const file=path.join(root,...sourcePath.split('/'));
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const bytes=Buffer.from('@echo off\r\necho fixture\r\n');
  fs.writeFileSync(file,bytes);
  git('add','--',sourcePath);
  git('-c','user.name=R47-Test','-c','user.email=r47@example.invalid',
   'commit','-q','-m','isolated test fixture');
  const sourceSha=git('rev-parse','HEAD');
  const treeEntry=git('ls-tree','HEAD','--',sourcePath);
  const blobOid=pinnedR47CandidateBlobOid(treeEntry,sourcePath);
  const blob=spawnSync('git',['-C',root,'cat-file','blob',blobOid],{encoding:null});
  assert.equal(blob.status,0);
  const m={sourceSha,sourcePath,afterSha256:hash(bytes)};
  const evidence=()=>({initialHead:git('rev-parse','HEAD'),
   finalHead:git('rev-parse','HEAD'),treeEntry,blobOid,gitBlob:blob.stdout,
   pathStatus:git('status','--porcelain=v1','--untracked-files=all','--',sourcePath),
   worktreeBytes:fs.readFileSync(file)});
  fs.writeFileSync(path.join(root,'unrelated-report.txt'),'not an approved effect');
  assert.notEqual(git('status','--porcelain=v1','--untracked-files=all'),'');
  assert.equal(evidence().pathStatus,'');
  assert.deepEqual(verifiedR47CandidateSource(m,evidence()),bytes);
  fs.appendFileSync(file,'modified');
  assert.notEqual(evidence().pathStatus,'');
  assert.throws(()=>verifiedR47CandidateSource(m,evidence()),
   {code:'TASK_CMD_B_CANDIDATE_SOURCE_DRIFT_STOP'});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
