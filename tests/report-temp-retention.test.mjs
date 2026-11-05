import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {cleanupVerifiedJobTemps} from '../controller/report-temp-retention.mjs';

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-temp-retention-test-'));
 for(const dir of ['jobs','reports','ledger','leases'])fs.mkdirSync(path.join(root,dir));
 const runId='12345',attempt='1',seat='2',issueNumber=77;
 const jobId=`run-${runId}-${attempt}-seat-${seat}`,requestId='pc-aabbccdd-1234';
 const report={schema:'ZGMINI_PC_RESULT_V1',jobId,requestId,status:'PASS',
  code:'CORE_READONLY_DIAGNOSIS',firstFail:null,protectedStateUnchanged:true,
  actualExecutionSha:'a'.repeat(40)};
 const workspace=path.join(root,'jobs',jobId),file=path.join(workspace,'RESULT.json');
 fs.mkdirSync(workspace);
 for(const name of ['input.json','worker-result.json','RESULT.json','RESULT.txt'])
  fs.writeFileSync(path.join(workspace,name),name==='RESULT.json'?JSON.stringify(report):'fixture');
 const pointer=path.join(root,'reports',`${runId}-${attempt}-${seat}.json`);
 fs.writeFileSync(pointer,JSON.stringify({issueNumber,report,file,workspace}));
 const ledger=path.join(root,'ledger',requestId+'.json');
 fs.writeFileSync(ledger,JSON.stringify({payloadSha:'b'.repeat(64),report}));
 const options={root,runId,attempt,seat,issueNumber,report,remoteFilesVerified:true,commentVerified:true};
 return {root,workspace,pointer,ledger,report,options,
  dispose:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('cleans only exact successful run temp files; preserves ledger and unrelated run',()=>{
 const f=fixture();
 try{
  const another=path.join(f.root,'jobs','run-999-1-seat-1');
  fs.mkdirSync(another);fs.writeFileSync(path.join(another,'KEEP'),'keep');
  assert.deepEqual(cleanupVerifiedJobTemps(f.options),{status:'CLEANED',files:5});
  assert.equal(fs.existsSync(f.workspace),false);
  assert.equal(fs.existsSync(f.pointer),false);
  assert.equal(fs.existsSync(f.ledger),true);
  assert.equal(fs.readFileSync(path.join(another,'KEEP'),'utf8'),'keep');
 }finally{f.dispose();}
});

test('requires GitHub pair and exact bot comment readback',()=>{
 const f=fixture();
 try{
  assert.equal(cleanupVerifiedJobTemps({...f.options,remoteFilesVerified:false}).code,'REMOTE_RESULT_UNVERIFIED');
  assert.equal(cleanupVerifiedJobTemps({...f.options,commentVerified:false}).code,'REMOTE_RESULT_UNVERIFIED');
  assert.equal(fs.existsSync(f.pointer),true);
  assert.equal(fs.existsSync(f.workspace),true);
 }finally{f.dispose();}
});

test('never cleans blocked, unknown, reused or recovery-required results',()=>{
 for(const alteration of [{status:'BLOCKED'},{status:'STATE_UNKNOWN'},{reused:true},
  {resourceLeasesRetained:true},{firstFail:'ALLOWLISTED_OPERATION'}]){
  const f=fixture();
  try{
   const result=cleanupVerifiedJobTemps({...f.options,report:{...f.report,...alteration}});
   assert.equal(result.code,'NONTERMINAL_OR_UNSAFE_RESULT');
   assert.equal(fs.existsSync(f.workspace),true);
  }finally{f.dispose();}
 }
});

test('active request or seat lease defers cleanup without touching owner state',()=>{
 for(const name of ['request-pc-aabbccdd-1234','seat-2']){
  const f=fixture();
  try{
   const lease=path.join(f.root,'leases',name);fs.mkdirSync(lease);
   fs.writeFileSync(path.join(lease,'owner.json'),'lease');
   assert.equal(cleanupVerifiedJobTemps(f.options).code,'ACTIVE_REQUEST_OR_SEAT_LEASE');
   assert.equal(fs.readFileSync(path.join(lease,'owner.json'),'utf8'),'lease');
   assert.equal(fs.existsSync(f.pointer),true);
  }finally{f.dispose();}
 }
});

test('dangling lease symlink still counts as a held or unsafe lease',t=>{
 const f=fixture();
 try{
  try{fs.symlinkSync(path.join(f.root,'MISSING'),path.join(f.root,'leases','seat-2'),'dir');}
  catch(error){if(['EPERM','EACCES'].includes(error.code)){t.skip('symlink privilege unavailable');return;}throw error;}
  assert.equal(cleanupVerifiedJobTemps(f.options).code,'ACTIVE_REQUEST_OR_SEAT_LEASE');
  assert.equal(fs.existsSync(f.pointer),true);
 }finally{f.dispose();}
});

test('mismatched pointer, ledger or workspace result fails closed',()=>{
 for(const which of ['pointer','ledger','RESULT.json']){
  const f=fixture();
  try{
   const target=which==='pointer'?f.pointer:which==='ledger'?f.ledger:path.join(f.workspace,which);
   const source=JSON.parse(fs.readFileSync(target,'utf8'));
   if(which==='pointer')source.issueNumber=78;
   else if(which==='ledger')source.report.code='OTHER';
   else source.status='FAIL';
   fs.writeFileSync(target,JSON.stringify(source));
   const result=cleanupVerifiedJobTemps(f.options);
   assert.match(result.code,/MISMATCH/);
   assert.equal(fs.existsSync(f.pointer),true);
   assert.equal(fs.existsSync(f.workspace),true);
  }finally{f.dispose();}
 }
});

test('unexpected or recovery marker file prevents any deletion',()=>{
 for(const name of ['EXTRA','RECOVERY_REQUIRED.json']){
  const f=fixture();
  try{
   fs.writeFileSync(path.join(f.workspace,name),'not a standard temporary file');
   assert.equal(cleanupVerifiedJobTemps(f.options).code,'WORKSPACE_FILES_UNEXPECTED');
   assert.equal(fs.existsSync(f.pointer),true);
   assert.equal(fs.existsSync(f.workspace),true);
  }finally{f.dispose();}
 }
});

test('symlinked temp file is never followed or deleted',t=>{
 const f=fixture();
 try{
  const outside=path.join(f.root,'KEEP.txt');
  fs.writeFileSync(outside,'keep');
  fs.unlinkSync(path.join(f.workspace,'RESULT.txt'));
  try{fs.symlinkSync(outside,path.join(f.workspace,'RESULT.txt'));}
  catch(error){if(['EPERM','EACCES'].includes(error.code)){t.skip('symlink privilege unavailable');return;}throw error;}
  assert.equal(cleanupVerifiedJobTemps(f.options).code,'TEMP_CLEANUP_DEFERRED');
  assert.equal(fs.readFileSync(outside,'utf8'),'keep');
  assert.equal(fs.existsSync(f.pointer),true);
 }finally{f.dispose();}
});

test('invalid identities and absent files cannot trigger broad cleanup',()=>{
 const f=fixture();
 try{
  assert.equal(cleanupVerifiedJobTemps({...f.options,runId:'../other'}).code,'RUN_IDENTITY_INVALID');
  assert.equal(cleanupVerifiedJobTemps({...f.options,issueNumber:0}).code,'RUN_IDENTITY_INVALID');
  fs.unlinkSync(f.pointer);
  assert.equal(cleanupVerifiedJobTemps(f.options).code,'TEMP_CLEANUP_DEFERRED');
  assert.equal(fs.existsSync(f.workspace),true);
  assert.equal(fs.existsSync(f.ledger),true);
 }finally{f.dispose();}
});
