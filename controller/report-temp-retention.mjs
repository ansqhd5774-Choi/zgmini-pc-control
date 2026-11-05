import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';

// Run only after both GitHub files and the bot comment have been read back.
// This module never deletes an operational ledger, lease, backup, or older run.
const skipped=code=>({status:'SKIPPED',code});
const samePath=(a,b)=>process.platform==='win32'
 ?path.normalize(a).toLowerCase()===path.normalize(b).toLowerCase()
 :path.normalize(a)===path.normalize(b);
const safeId=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{7,79}$/.test(s);
const pathEntryExists=file=>{
 try{fs.lstatSync(file);return true;}
 catch(error){if(error.code==='ENOENT')return false;throw error;}
};

function normalPath(file,kind){
 const stat=fs.lstatSync(file);
 if(stat.isSymbolicLink()||(kind==='directory'?!stat.isDirectory():!stat.isFile()))
  throw Error('UNSAFE_PATH_TYPE');
 return fs.realpathSync(file);
}

function loadJsonFile(file){
 normalPath(file,'file');
 return JSON.parse(fs.readFileSync(file,'utf8'));
}

export function cleanupVerifiedJobTemps({
 root,runId,attempt,seat,issueNumber,report,remoteFilesVerified=false,commentVerified=false
}){
 if(!remoteFilesVerified||!commentVerified)return skipped('REMOTE_RESULT_UNVERIFIED');
 if(!/^\d{1,20}$/.test(String(runId))||!/^\d{1,3}$/.test(String(attempt))||
  !/^[1-6]$/.test(String(seat))||!Number.isSafeInteger(issueNumber)||issueNumber<1)
  return skipped('RUN_IDENTITY_INVALID');
 const jobId=`run-${runId}-${attempt}-seat-${seat}`;
 if(report?.schema!=='ZGMINI_PC_RESULT_V1'||report.jobId!==jobId||
  !safeId(report.requestId)||report.status!=='PASS'||report.firstFail!==null||
  report.protectedStateUnchanged!==true||report.reused===true||
  report.resourceLeasesRetained===true||!/^([a-f0-9]{40})$/.test(report.actualExecutionSha??''))
  return skipped('NONTERMINAL_OR_UNSAFE_RESULT');

 try{
  const rootReal=fs.realpathSync(root);
  const jobsRoot=path.join(root,'jobs'),reportsRoot=path.join(root,'reports');
  const ledgerRoot=path.join(root,'ledger'),leasesRoot=path.join(root,'leases');
  for(const [dir,name] of [[jobsRoot,'jobs'],[reportsRoot,'reports'],[ledgerRoot,'ledger'],[leasesRoot,'leases']]){
   const real=normalPath(dir,'directory');
   if(!samePath(real,path.join(rootReal,name)))return skipped('UNSAFE_ROOT_LAYOUT');
  }
  // Another execution/upload for the same request or seat must not be cleaned.
  if(pathEntryExists(path.join(leasesRoot,'request-'+report.requestId))||
   pathEntryExists(path.join(leasesRoot,'seat-'+seat)))
   return skipped('ACTIVE_REQUEST_OR_SEAT_LEASE');

  const workspace=path.join(jobsRoot,jobId);
  if(!samePath(normalPath(workspace,'directory'),path.join(rootReal,'jobs',jobId)))
   return skipped('UNSAFE_WORKSPACE_PATH');
  const pointerFile=path.join(reportsRoot,`${runId}-${attempt}-${seat}.json`);
  if(!samePath(normalPath(pointerFile,'file'),path.join(rootReal,'reports',path.basename(pointerFile))))
   return skipped('UNSAFE_POINTER_PATH');
  const pointer=loadJsonFile(pointerFile);
  if(pointer.issueNumber!==issueNumber||pointer.report?.jobId!==jobId||
   pointer.report.requestId!==report.requestId||pointer.report.status!=='PASS'||
   pointer.report.code!==report.code||pointer.report.actualExecutionSha!==report.actualExecutionSha||
   !isDeepStrictEqual(pointer.report,report)||
   !samePath(pointer.workspace??'',workspace)||
   !samePath(pointer.file??'',path.join(workspace,'RESULT.json')))
   return skipped('POINTER_RESULT_MISMATCH');

  const ledgerFile=path.join(ledgerRoot,report.requestId+'.json'),ledger=loadJsonFile(ledgerFile);
  if(!/^[a-f0-9]{64}$/.test(ledger.payloadSha??'')||
   ledger.report?.jobId!==jobId||ledger.report.requestId!==report.requestId||
   ledger.report.status!=='PASS'||ledger.report.code!==report.code||
   ledger.report.protectedStateUnchanged!==true||
   ledger.report.actualExecutionSha!==report.actualExecutionSha)
   return skipped('LEDGER_RESULT_MISMATCH');

  const expected=['input.json','worker-result.json','RESULT.json','RESULT.txt'];
  const entries=fs.readdirSync(workspace);
  if(entries.length!==expected.length||expected.some(name=>!entries.includes(name)))
   return skipped('WORKSPACE_FILES_UNEXPECTED');
  for(const name of expected){
   const file=path.join(workspace,name);
   if(!samePath(normalPath(file,'file'),path.join(rootReal,'jobs',jobId,name)))
    return skipped('WORKSPACE_FILE_UNSAFE');
  }
  const result=loadJsonFile(path.join(workspace,'RESULT.json'));
  const workerResult=loadJsonFile(path.join(workspace,'worker-result.json'));
  if(!isDeepStrictEqual(result,report)||
   !isDeepStrictEqual(workerResult,report.result))
   return skipped('WORKSPACE_RESULT_MISMATCH');

  // Remove the pointer last: an interrupted cleanup remains inspectable.
  for(const name of expected)fs.unlinkSync(path.join(workspace,name));
  fs.rmdirSync(workspace);
  fs.unlinkSync(pointerFile);
  return {status:'CLEANED',files:5};
 }catch{
  // Fail closed. A cleanup problem cannot turn an already-published report
  // into an execution failure or trigger a repeat of the original operation.
  return skipped('TEMP_CLEANUP_DEFERRED');
 }
}
