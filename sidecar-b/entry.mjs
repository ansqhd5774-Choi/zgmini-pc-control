#!/usr/bin/env node
// Fixed Windows CNN Sidecar B execution entry, not a generic PC command.
// Validates committed approval + exact candidate commit/bytes BEFORE OS I/O.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readCommittedSidecarApproval} from './trusted-approval.mjs';
import {readPinnedSidecarCandidate} from './pinned-candidate.mjs';
import {createOperatingSidecarProbe} from './operating-probe.mjs';
import {awaitNaturalSidecarIdle} from './natural-idle-window.mjs';
import {receiveApprovedSidecarB} from './receiver.mjs';
import {sha256,TARGET} from './contract.mjs';

const STOP=c=>{throw Object.assign(Error(c),{code:c});};
const need=(ok,c)=>{if(!ok)STOP(c);};
const cleanCode=e=>/^SIDECAR_B_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
 e.code:'SIDECAR_B_OPERATION_UNVERIFIED_STOP';
export async function executeSidecarB({event,env,controlRoot,candidateRoot}){
 need(process.platform==='win32','SIDECAR_B_WINDOWS_ONLY_STOP');
 const proof=readCommittedSidecarApproval({event,env,controlRoot});
 const approvedBytes=readPinnedSidecarCandidate({
  candidateRoot,manifest:proof.manifest
 });
 const rawManifest=fs.readFileSync(path.join(controlRoot,
  ...proof.request.approvalManifestPath.split('/')));
 need(sha256(rawManifest)===proof.manifestSha256,
  'SIDECAR_B_APPROVAL_READBACK_STOP');
 // Read-only natural drain occurs before any shared installation lease.
 await awaitNaturalSidecarIdle();
 const observeProtected=createOperatingSidecarProbe({
  manifest:proof.manifest,requestId:proof.request.requestId,
  sourceApproved:true
 });
 const applied=await receiveApprovedSidecarB({
  event,env,controlHead:env.GITHUB_SHA,manifestBytes:rawManifest,
  approvedBytes,observeProtected
 });
 need(applied.status==='APPLIED_SOURCE_ONLY'&&
  sha256(fs.readFileSync(TARGET))===proof.manifest.afterSha256,
  'SIDECAR_B_POSTINSTALL_READBACK_STOP');
 return {schema:'ZGMINI_CNN_SIDECAR_B_RESULT_V1',
  status:'SIDECAR_B_APPLIED_VERIFIED',code:'SIDECAR_B_EXACT_FILE_READBACK_PASS',
  applied:true,changedFileCount:1,requestId:proof.request.requestId,
  controlSha:env.GITHUB_SHA,
  beforeSha256:proof.manifest.beforeSha256,
  afterSha256:proof.manifest.afterSha256,
  manifestSha256:proof.manifestSha256,backupVerified:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const env=process.env;
 let result={schema:'ZGMINI_CNN_SIDECAR_B_RESULT_V1',
  status:'SIDECAR_B_STATE_UNKNOWN',
  code:'SIDECAR_B_OPERATION_UNVERIFIED_STOP',applied:false,
  changedFileCount:0,requestId:null,controlSha:null,
  beforeSha256:null,afterSha256:null,manifestSha256:null,
  backupVerified:false};
 try{
  need(typeof env.GITHUB_EVENT_PATH==='string'&&
   typeof env.GITHUB_WORKSPACE==='string'&&
   typeof env.RUNNER_TEMP==='string'&&
   path.isAbsolute(env.RUNNER_TEMP),'SIDECAR_B_ENTRY_ENV_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  result=await executeSidecarB({event,env,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'cnn-b-control'),
   candidateRoot:path.join(env.GITHUB_WORKSPACE,'cnn-b-candidate')});
 }catch(e){
  result={...result,status:cleanCode(e)==='SIDECAR_B_RECOVERY_UNVERIFIED_STOP'?
   'SIDECAR_B_RECOVERY_REQUIRED':'SIDECAR_B_PREFLIGHT_OR_RUNTIME_STOP',
   code:cleanCode(e),
   ...(e?.idleObservation&&
     cleanCode(e)==='SIDECAR_B_PROBE_RESOURCE_STOP'?
     {idleObservation:e.idleObservation}:{})};
 }
 try{
  const file=path.join(env.RUNNER_TEMP,'cnn-sidecar-b-result.json');
  fs.writeFileSync(file,JSON.stringify(result)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.applied!==true)process.exitCode=1;
}
