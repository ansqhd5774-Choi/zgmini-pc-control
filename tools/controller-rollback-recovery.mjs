// Fixed-root, exact-approval operator entry for interrupted partial switches.
import fs from'node:fs';import path from'node:path';import{execFileSync}from'node:child_process';
import{fileURLToPath}from'node:url';import{createHash,randomUUID}from'node:crypto';
const root='E:/ZGmini/automation/pc-maintenance',control='E:/ZGmini/automation/pc-control';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digest=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p));
const need=(b,c)=>{if(!b)throw Object.assign(Error(c),{code:c});};
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};
// Authentication is from the existing GitHub CLI credentials on the independent
// Windows operator, never from caller-supplied event or arbitrary URLs. This pure
// result validator is fail-closed, and does not grant rollback permission alone.
const PC_REPO='ansqhd5774-Choi/zgmini-pc-control';
import {validateConfirmedPostcheckFailure} from './maintenance-contract.mjs';
export {validateConfirmedPostcheckFailure};
export function retainRollbackClaim(result,archived){
 return result?.mutationStarted===true&&!(archived===true&&result.status==='ROLLED_BACK'&&result.leaseArchived===true);
}
export function validateStalledClaim({requestId,approval,claimBytes,recordBytes,backlogBytes,ownerAlive}){
 const spec=approval.resumeClaim,owner=JSON.parse(claimBytes),prior=JSON.parse(recordBytes);
 need(spec&&spec.ownerSha256===digest(claimBytes)&&spec.recordSha256===digest(recordBytes)&&
  spec.backlogSha256===digest(backlogBytes),'ROLLBACK_STALLED_CLAIM_HASH_MISMATCH');
 need(owner.requestId===requestId&&Number.isSafeInteger(owner.pid)&&owner.pid>0&&
  /^[a-f0-9-]{36}$/.test(owner.nonce??'')&&ownerAlive===false,'ROLLBACK_STALLED_OWNER_UNVERIFIED');
 need(prior.requestId===requestId&&prior.schema==='ZGMINI_PC_ROLLBACK_RECONCILIATION_V1'&&
  prior.status==='RECOVERY_REQUIRED'&&prior.originalPhase==='SWITCHED'&&
  prior.code==='ROLLBACK_SUPERVISOR_SOURCE_UNKNOWN'&&prior.failureOperation==='restore'&&
  prior.actualInstalledSha===null,'ROLLBACK_STALLED_PHASE_UNSUPPORTED');
 return true;
}
export async function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'ROLLBACK_OPERATOR_WINDOWS_REQUIRED');
 need(args.length===4&&args[0]==='--request-id'&&/^pc-[a-z0-9-]{8,76}$/.test(args[1])&&args[2]==='--source-sha'&&/^[a-f0-9]{40}$/.test(args[3]),'ROLLBACK_USAGE');
 const id=args[1],source=args[3],g=a=>execFileSync('git',a,{cwd:repo,windowsHide:true,maxBuffer:4e6});
 const rel='approvals/maintenance-recoveries/'+id+'.rollback.json',raw=fs.readFileSync(path.join(repo,rel));
 need(digest(raw)===digest(g(['show','HEAD:'+rel])),'ROLLBACK_APPROVAL_UNCOMMITTED');g(['merge-base','--is-ancestor',source,'HEAD']);
 const approval=JSON.parse(raw),ledgerFile=path.join(root,'ledger',id+'.json'),ledgerBytes=fs.readFileSync(ledgerFile),ledger=JSON.parse(ledgerBytes);
 const required=['tools/controller-rollback-recovery.mjs','tools/update.mjs','tools/maintenance-apply.mjs','tools/maintenance-contract.mjs','tools/maintenance-lock.mjs'];
 need(Array.isArray(approval.files)&&approval.files.length===required.length&&required.every(p=>approval.files.filter(x=>x.path===p).length===1),'ROLLBACK_FILES_REQUIRED');
 for(const f of approval.files)need(required.includes(f.path)&&/^[a-f0-9]{64}$/.test(f.sha256)&&digest(g(['show',source+':'+f.path]))===f.sha256&&digest(fs.readFileSync(path.join(repo,f.path)))===f.sha256,'ROLLBACK_SOURCE_DRIFT');
 const {loadAuthenticatedApprovedPackage,makePorts}=await import('./update.mjs');
 const {reconcileInterruptedRollback}=await import('./maintenance-apply.mjs');
 const dir=path.join(root,'leases/controller-install'),ownerBytes=fs.readFileSync(path.join(dir,'owner.json')),markerBytes=fs.readFileSync(path.join(dir,'RECOVERY_REQUIRED.json'));
 const owner=JSON.parse(ownerBytes),marker=JSON.parse(markerBytes);
 const snapshot=path.join(control,'backups','controller-update-'+id,'snapshot','host.json');
 const baseline=path.join(control,'backups','controller-update-'+id,'PROTECTED_BEFORE.json');
 need(approval.schema==='ZGMINI_PC_ROLLBACK_APPROVAL_V1'&&approval.approved===true&&approval.requestId===id&&approval.sourceSha===source&&
  approval.toolSha256===digest(g(['show',source+':tools/controller-rollback-recovery.mjs']))&&approval.toolSha256===digest(fs.readFileSync(fileURLToPath(import.meta.url)))&&
  approval.ledgerSha256===digest(ledgerBytes)&&approval.ownerSha256===digest(ownerBytes)&&approval.markerSha256===digest(markerBytes)&&
  approval.snapshotHostSha256===digest(fs.readFileSync(snapshot))&&approval.protectionSha256===digest(fs.readFileSync(baseline)),'ROLLBACK_APPROVAL_MISMATCH');
 need(ledger.requestId===id&&Number.isSafeInteger(owner.pid)&&owner.pid>0&&marker.requestOwnerPid===owner.pid&&marker.nonce===owner.nonce&&alive(owner.pid)===false,'ROLLBACK_OWNER_NOT_PROVEN_DEAD');
 const data=await loadAuthenticatedApprovedPackage(id,path.join(root,'approved',id+'.json'),{recovery:true});
 need(data.manifest.installedSha===ledger.installedShaBefore&&data.manifest.targetSha===ledger.targetSha,'ROLLBACK_ORIGINAL_TARGET_MISMATCH');
 // A confirmed postcheck is required only for the historically uncertain
 // POSTCHECK_PENDING phase. Verify live GitHub issue/run/job evidence and the
 // *current* Writer config CAS BEFORE creating any recovery claim or pausing
 // the normal intake. Missing approval/evidence is a safe no-effect stop.
 const recoveryOptions={recoveryOperator:true,
  approvedRecoveryWriterConfigSha256:approval.approvedCurrentWriterConfigSha256??null};
 let confirmedPostcheck=false;
 if(ledger.status==='RECOVERY_REQUIRED'&&ledger.firstFail==='POSTCHECK_PENDING'){
  const spec=approval.confirmedPostcheckFailure;
  need(spec&&Number.isSafeInteger(spec.issueNumber)&&
   Number.isSafeInteger(spec.runId)&&Number.isSafeInteger(spec.jobId),
   'ROLLBACK_POSTCHECK_APPROVAL_REQUIRED');
  need(/^[a-f0-9]{64}$/.test(approval.approvedCurrentWriterConfigSha256??''),
   'ROLLBACK_WRITER_CONFIG_CAS_REQUIRED');
  const writerPath='E:/ZGmini/data/pc-writer/config.json';
  need(digest(fs.readFileSync(writerPath))===approval.approvedCurrentWriterConfigSha256,
   'ROLLBACK_WRITER_CONFIG_CAS_CHANGED');
  const ghbin='C:/Program Files/GitHub CLI/gh.exe';
  const githubRead=rel=>JSON.parse(execFileSync(ghbin,
   ['api','repos/'+PC_REPO+'/'+rel],{windowsHide:true,timeout:30000,
    encoding:'utf8',maxBuffer:2e6}));
  let evidence;try{
   evidence={issue:githubRead('issues/'+spec.issueNumber),
    run:githubRead('actions/runs/'+spec.runId),
    job:githubRead('actions/jobs/'+spec.jobId)};
  }catch{throw Object.assign(Error('ROLLBACK_POSTCHECK_READBACK_UNAVAILABLE'),
   {code:'ROLLBACK_POSTCHECK_READBACK_UNAVAILABLE'});}
  confirmedPostcheck=validateConfirmedPostcheckFailure({
   original:ledger,manifest:data.manifest,approval,...evidence});
  need(confirmedPostcheck,'ROLLBACK_POSTCHECK_EVIDENCE_UNVERIFIED');
 }
 const attachRecoveryPort=ports=>{
  if(confirmedPostcheck)ports.confirmPostcheckFailure=async original=>
   original===ledger&&confirmedPostcheck;
  return ports;
 };
 const claim=path.join(root,'leases/controller-recovery');
 if(fs.existsSync(claim)){
  const spec=approval.resumeClaim;
  need(spec&&typeof spec.recordName==='string'&&
   spec.recordName.startsWith(id+'-rollback-')&&/^[a-z0-9-]+\.json$/.test(spec.recordName),
   'ROLLBACK_STALLED_APPROVAL_REQUIRED');
  const claimBytes=fs.readFileSync(path.join(claim,'owner.json')),
   recordBytes=fs.readFileSync(path.join(root,'recovery',spec.recordName)),
   backlogBytes=fs.readFileSync(path.join(root,'backlog',id+'.json'));
  const priorOwner=JSON.parse(claimBytes);
  validateStalledClaim({requestId:id,approval,claimBytes,recordBytes,backlogBytes,ownerAlive:alive(priorOwner.pid)});
  // This is a separately approved continuation after a guard stopped before
  // restore. Prove original live snapshot, disabled intake and protection first.
  const {ports:basePorts}=makePorts(data,data.issueNumber,recoveryOptions);
  const ports=attachRecoveryPort(basePorts);
  await ports.prepareRecovery();
  need(await ports.verifyRestoredPrevious(ledger.installedShaBefore)===true,'ROLLBACK_STALLED_SNAPSHOT_UNVERIFIED');
  const reservation=path.join(root,'leases/controller-recovery-reentry');fs.mkdirSync(reservation);
  try{
   need(fs.readFileSync(path.join(claim,'owner.json')).equals(claimBytes)&&
    fs.readFileSync(path.join(root,'recovery',spec.recordName)).equals(recordBytes)&&
    fs.readFileSync(path.join(root,'backlog',id+'.json')).equals(backlogBytes)&&
    fs.readFileSync(ledgerFile).equals(ledgerBytes)&&alive(priorOwner.pid)===false,
    'ROLLBACK_STALLED_EVIDENCE_CHANGED');
   const destination=path.resolve(root,'recovery',id+'-dead-recovery-claim-'+randomUUID()+'.lease');
   need(destination.startsWith(path.resolve(root,'recovery')+path.sep)&&
    fs.lstatSync(claim).isDirectory()&&!fs.lstatSync(claim).isSymbolicLink(),'ROLLBACK_STALLED_PATH_INVALID');
   fs.renameSync(claim,destination);
   fs.mkdirSync(claim); // A new atomic owner; retain the old complete claim.
  }finally{fs.rmdirSync(reservation);}
 }else fs.mkdirSync(claim);
 const claimFile=path.join(claim,'owner.json'),nonce=randomUUID();
 fs.writeFileSync(claimFile,JSON.stringify({pid:process.pid,nonce,requestId:id}),{flag:'wx'});
 const reports=path.join(root,'recovery');fs.mkdirSync(reports,{recursive:true});
 const record=path.join(reports,id+'-rollback-'+nonce+'.json');let keep=false,archived=false;
 const persist=async r=>{if(r.mutationStarted)keep=retainRollbackClaim(r,archived);const temp=record+'.tmp';fs.writeFileSync(temp,JSON.stringify(r,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,record);};
 try{
  need(fs.readFileSync(path.join(dir,'owner.json')).equals(ownerBytes)&&fs.readFileSync(ledgerFile).equals(ledgerBytes)&&alive(owner.pid)===false,'ROLLBACK_EVIDENCE_CHANGED');
  const {ports:basePorts}=makePorts(data,data.issueNumber,recoveryOptions);
  const ports=attachRecoveryPort(basePorts);
  const r=await reconcileInterruptedRollback(ledger,ports,persist);
  if(r.status==='ROLLED_BACK'){
   need(fs.readFileSync(path.join(dir,'owner.json')).equals(ownerBytes)&&fs.readFileSync(path.join(dir,'RECOVERY_REQUIRED.json')).equals(markerBytes)&&fs.readFileSync(ledgerFile).equals(ledgerBytes),'ROLLBACK_EVIDENCE_CHANGED');
   fs.renameSync(dir,path.join(reports,id+'-rollback-'+nonce+'.lease'));keep=false;archived=true;
   await persist({...r,leaseArchived:true,originalLedgerPreserved:true});
  }
  try{execFileSync('C:/Program Files/GitHub CLI/gh.exe',['issue','comment',String(data.issueNumber),'--repo','ansqhd5774-Choi/zgmini-pc-control','--body-file',record],{windowsHide:true,timeout:30000,stdio:'pipe'});}catch{}
  return {...r,leaseArchived:archived,originalLedgerPreserved:true};
 }finally{if(!keep){need(read(claimFile).nonce===nonce,'ROLLBACK_CLAIM_CHANGED');fs.unlinkSync(claimFile);fs.rmdirSync(claim);}}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const r=await main();console.log(JSON.stringify(r));if(r.status!=='ROLLED_BACK')process.exitCode=2;}
 catch(e){console.log(JSON.stringify({status:'RECOVERY_REQUIRED',code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'ROLLBACK_INSPECTION_FAILED',next:'INSPECT_ORIGINAL_LEDGER_RECOVERY_RECORD_AND_CLAIM_NO_RETRY'}));process.exitCode=2;}
}
