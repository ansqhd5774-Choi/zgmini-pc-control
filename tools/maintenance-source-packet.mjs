#!/usr/bin/env node
// Immutable, source-only package for approved #3516 installed-state recovery.
// Runs in the isolated GitHub CI checkout, never on the operating Controller.
// Produces source bytes for the separately authorized independent Windows C
// operator; it never runs maintenance-recovery.mjs or changes a lease.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const FIXED=Object.freeze({
 repository:'ansqhd5774-Choi/zgmini-pc-control',
 requestId:'pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1',
 sourceSha:'ec9009be720f3da33c3300a81aaf54be1e18c683',
 controllerSha:'83679b013ac9a9820331d93311ec97e572b18e13',
 approval:'approvals/maintenance-recoveries/pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1.installed.json',
 proof:'results/pc-process-inventory-45579963186-1-operating.json',
 sourceFiles:Object.freeze([
  'tools/maintenance-recovery.mjs','tools/update.mjs',
  'tools/maintenance-contract.mjs','controller/fixed-readonly-bytes.mjs'
 ])
});
const digest=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const validSha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const maxBytes=p=>p==='tools/update.mjs'?262144:131072;

export function validateRecoverySourcePacket({approvalRaw,sourceFiles,proofRaw,
 sourceAncestor,headSha}={}){
 need(Buffer.isBuffer(approvalRaw)&&approvalRaw.length>0&&approvalRaw.length<=32768,
  'SOURCE_PACKET_APPROVAL_BYTES_UNSAFE');
 let approval;
 try{approval=JSON.parse(approvalRaw.toString('utf8'));}catch{fail('SOURCE_PACKET_APPROVAL_JSON_INVALID');}
 need(approval.schema==='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1'&&
  approval.operation==='RECONCILE_INSTALLED'&&approval.approved===true&&
  approval.issueNumber===3516&&approval.requestId===FIXED.requestId&&
  approval.sourceSha===FIXED.sourceSha&&
  approval.targetControllerSha===FIXED.controllerSha,
  'SOURCE_PACKET_APPROVAL_IDENTITY_MISMATCH');
 need(Array.isArray(approval.files)&&approval.files.length===FIXED.sourceFiles.length&&
  approval.files.every((f,i)=>f?.path===FIXED.sourceFiles[i]&&validSha(f.sha256)),
  'SOURCE_PACKET_APPROVED_FILES_INVALID');
 need(approval.casDigests&&Object.keys(approval.casDigests).length===7&&
  ['ledger','owner','marker','backlog','snapshot','protection','writer'].every(
   key=>validSha(approval.casDigests[key+'Sha256']))&&
  approval.approvedCurrentWriterConfigSha256===approval.casDigests.writerSha256,
  'SOURCE_PACKET_CAS_SCOPE_INVALID');
 need(approval.proof?.issueNumber===3528&&approval.proof.runId===45579963186&&
  approval.proof.jobId===139087219551&&approval.proof.runnerName==='zgmini-pc-03'&&
  approval.proof.resultPath===FIXED.proof&&validSha(approval.proof.resultSha256),
  'SOURCE_PACKET_A_PROOF_SCOPE_INVALID');
 need(sourceAncestor===true&&/^[a-f0-9]{40}$/.test(headSha??''),
  'SOURCE_PACKET_ANCESTRY_NOT_VERIFIED');
 need(sourceFiles&&typeof sourceFiles==='object'&&!Array.isArray(sourceFiles)&&
  Object.keys(sourceFiles).length===FIXED.sourceFiles.length,
  'SOURCE_PACKET_SOURCE_SET_INVALID');
 for(const f of approval.files){
  const buf=sourceFiles[f.path];
  need(Buffer.isBuffer(buf)&&buf.length>0&&buf.length<=maxBytes(f.path),
   'SOURCE_PACKET_FILE_SIZE_INCOMPATIBLE');
  need(digest(buf)===f.sha256,'SOURCE_PACKET_FILE_SHA_MISMATCH');
 }
 need(Buffer.isBuffer(proofRaw)&&proofRaw.length>0&&proofRaw.length<=131072&&
  digest(proofRaw)===approval.proof.resultSha256,
  'SOURCE_PACKET_A_PROOF_BYTES_MISMATCH');
 const proof=JSON.parse(proofRaw.toString('utf8'));
 need(proof.schema==='ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1'&&
  proof.issueNumber===3528&&proof.runId==='45579963186'&&
  proof.status==='PASS'&&proof.code==='W04_3516_STATUS_OBSERVED'&&
  proof.w043516MaintenanceStatus?.actualControllerSha===FIXED.controllerSha&&
  proof.w043516MaintenanceStatus?.historicalRequest?.code==='POSTCHECK_OUTCOME_UNKNOWN'&&
  proof.w043516MaintenanceStatus?.recoveryCas?.recoveryEligible===false&&
  Object.keys(approval.casDigests).every(k=>
   proof.w043516MaintenanceStatus.recoveryCas.casDigests[k]===approval.casDigests[k]),
  'SOURCE_PACKET_A_PROOF_CONTRACT_MISMATCH');
 return {schema:'ZGMINI_APPROVED_RECOVERY_SOURCE_PACKET_V1',
  status:'SOURCE_PREPARED_ONLY',code:'IMMUTABLE_SOURCE_BYTES_CAS_COMPATIBLE',
  requestId:FIXED.requestId,sourceSha:FIXED.sourceSha,checkoutHead:headSha,
  approvalSha256:digest(approvalRaw),proofSha256:digest(proofRaw),
  sourceFiles:approval.files.map(f=>({...f,sizeBytes:sourceFiles[f.path].length})),
  verifiedFrom:'PINNED_GIT_OBJECTS_NOT_OPERATING_PC',
  recoveryExecuted:false,leaseWrites:0,controllerWrites:0,dbD1Writes:0};
}

function git(root,args){
 return execFileSync('git',['--no-optional-locks','-C',root,...args],
  {windowsHide:true,shell:false,encoding:null,timeout:20000,maxBuffer:4e6,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
}
export function prepareSourceOnly({root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),
 outputDir=process.env.RUNNER_TEMP&&path.join(process.env.RUNNER_TEMP,'ZGMINI_3516_SOURCE_ONLY')}={}){
 need(process.env.GITHUB_ACTIONS==='true'&&typeof process.env.RUNNER_TEMP==='string'&&
  process.env.RUNNER_TEMP.length>0&&path.isAbsolute(process.env.RUNNER_TEMP),
  'SOURCE_PACKET_ISOLATED_CI_REQUIRED');
 need(typeof root==='string'&&typeof outputDir==='string'&&path.isAbsolute(outputDir)&&
  path.dirname(outputDir)===path.resolve(process.env.RUNNER_TEMP)&&
  !fs.existsSync(outputDir),'SOURCE_PACKET_OUTPUT_SCOPE_INVALID');
 const remote=git(root,['remote','get-url','origin']).toString().trim();
 need(/^(?:https:\/\/github\.com\/|git@github\.com:)ansqhd5774-Choi\/zgmini-pc-control(?:\.git)?$/.test(remote),
  'SOURCE_PACKET_GIT_ORIGIN_MISMATCH');
 const head=git(root,['rev-parse','--verify','HEAD^{commit}']).toString().trim();
 try{git(root,['cat-file','-e',FIXED.sourceSha+'^{commit}']);}
 catch{fail('SOURCE_PACKET_PINNED_GIT_OBJECT_ABSENT');}
 let ancestor=true;
 try{git(root,['merge-base','--is-ancestor',FIXED.sourceSha,'HEAD']);}
 catch{ancestor=false;}
 const approvalRaw=git(root,['show','HEAD:'+FIXED.approval]);
 const proofRaw=git(root,['show','HEAD:'+FIXED.proof]);
 const sourceFiles=Object.fromEntries(FIXED.sourceFiles.map(
  rel=>[rel,git(root,['show',FIXED.sourceSha+':'+rel])]));
 const result=validateRecoverySourcePacket({approvalRaw,sourceFiles,proofRaw,
  sourceAncestor:ancestor,headSha:head});
 // CI is deliberately the only writer: stage source bytes, not an executable
 // C operator, and never access the running PC or its recovery lease.
 fs.mkdirSync(outputDir,{recursive:false});
 for(const [rel,bytes]of [...Object.entries(sourceFiles),[FIXED.approval,approvalRaw]]){
  const p=path.join(outputDir,rel);
  fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,bytes,{flag:'wx'});
 }
 fs.writeFileSync(path.join(outputDir,'source-packet.json'),
  JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return {...result,outputDir};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  need(process.argv.length===3&&process.argv[2]==='--prepare-3516',
   'SOURCE_PACKET_USAGE_INVALID');
  const result=prepareSourceOnly();
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch(error){
  process.stderr.write(JSON.stringify({status:'BLOCKED',
   code:/^SOURCE_PACKET_[A-Z0-9_]+$/.test(error?.code??'')?
    error.code:'SOURCE_PACKET_UNVERIFIED'})+'\n');
  process.exitCode=2;
 }
}
