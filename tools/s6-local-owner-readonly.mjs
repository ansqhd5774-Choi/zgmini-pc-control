#!/usr/bin/env node
// Fixed local-only Owner observation of #4069/#4078/#3767.
// No Issue dispatch, upload, install, recovery, lease acquisition or process stop.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ROOT='E:/ZGmini/projects/zgmini-pc-control';
const REL='tools/s6-local-owner-readonly.mjs';
const GH='C:/Program Files/GitHub CLI/gh.exe';
const CSCRIPT='C:/Windows/System32/cscript.exe';
const ANCESTRY='E:/ZGmini/automation/pc-maintenance/tools/maintenance-ancestry.vbs';
const WATCHDOG='E:/ZGmini/automation/pc-watchdog';
const SOURCE_FILES=[REL,'tools/s6-4078-windows-local-readonly.mjs',
 'tools/s6-4078-backlog-only-plan.mjs','tools/runner-watchdog.mjs',
 'controller/s6-journal-readonly.mjs','controller/common.mjs'];
const REQUEST='pc-s6-63afb126-72dc-4ec5-a721-4819771fa9ee';
const PHASES=new Set(['CLAIMED','INSTALL_LEASE_ACQUIRE_ATTEMPT',
 'INSTALL_LEASE_ACQUIRED','INTAKE_PAUSE_ATTEMPT','INTAKE_PAUSED','DRAINED',
 'OLD_TREE_STOP_ATTEMPT','OLD_TREE_STOP_SUBMITTED','OLD_TREE_STOP_VERIFIED',
 'INTAKE_RESUME_ATTEMPT','INTAKE_RESUMED','OWNED_LEASE_RELEASE_ATTEMPT',
 'OWNED_LEASE_RELEASED','WATCHDOG_RELEASE_OBSERVED','FAST_PROMOTION_OBSERVED',
 'WATCHDOG_RELEASE_OUTCOME_UNVERIFIED','BACKLOG_RECONCILE_ATTEMPT',
 'BACKLOG_RECONCILED','PROMOTED_READBACK_VERIFIED','RECOVERY_REQUIRED']);
const CLASSIFICATIONS=new Set(['UNVERIFIED','ACTIVE_RUNNER_PROCESS','NO_CONTROLLER_RUNNER_PROCESS']);
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
const bool=v=>typeof v==='boolean'?v:null;
const phase=v=>PHASES.has(v)?v:null;
const base=()=>({schema:'ZGMINI_S6_LOCAL_OWNER_READONLY_V1',
 mutationAuthorized:false,promotionApproved:false,executionEstablished:false,
 originalRequestRetried:false,operationalWrites:0,publicUpload:false});

// Only fixed enums/booleans leave this projection, never original bytes,
// arbitrary journal strings, owner IDs, nonces, PIDs, paths or raw hashes.
export function projectLocalS6(sample,projectBacklog){
 const unknown={status:'STATE_UNKNOWN',journalPhase:null,failedAt:null,
  originalFailureMatches:null,leaseReleaseAcknowledged:null,
  originalOwnerMatchesCurrent:null,pauseWindowContainsIssueOpenedAt:null,
  replayLedgerStatus:'UNVERIFIED'};
 try{
  if(sample?.status!=='READ_ONLY_OBSERVED'||
    sample?.code!=='S6_4078_LOCAL_BYTES_SAMPLED')return unknown;
  const l=sample.localReadback;
  if(typeof l?.journalBefore!=='string'||typeof l?.backlogBefore!=='string'||
     l.journalBefore!==l.journalAfter||l.backlogBefore!==l.backlogAfter||
     sha(l.journalBefore)!==l.journalSha256||sha(l.backlogBefore)!==l.backlogSha256)
   return unknown;
  const j=JSON.parse(l.journalBefore),b=JSON.parse(l.backlogBefore);
  if(j?.schema!=='ZGMINI_S6_ONCE_JOURNAL_V1'||j.requestId!==REQUEST||
     !phase(j.phase)||b?.schema!=='ZGMINI_PC_BACKLOG_V1'||b.requestId!==REQUEST||
     typeof projectBacklog!=='function')return unknown;
  // Reuse the current Controller's bounded legacy/window and replay contract.
  // Missing historical replays is different from a malformed replay object.
  const observed=projectBacklog(b);
  const replay=observed?.replayLedgerStatus;
  if(!['NOT_RECORDED','POSTING','DONE','SKIPPED_RESULT_PRESENT',
    'REJECTED_INVALID_ORIGINAL','WINDOW_NOT_CLOSED','UNVERIFIED'].includes(replay))return unknown;
  return {status:'READ_ONLY_OBSERVED',journalPhase:j.phase,failedAt:phase(j.failedAt),
   originalFailureMatches:j.code==='S6_PORT_PROMOTION_UNVERIFIED',
   leaseReleaseAcknowledged:bool(j.leaseReleaseAcknowledged),
   originalOwnerMatchesCurrent:bool(sample.originalOwnerMatchesCurrent),
   pauseWindowContainsIssueOpenedAt:bool(observed.pauseWindowContainsIssueOpenedAt),
   replayLedgerStatus:replay};
 }catch{return unknown;}
}

export function projectWmiObservation(value,installedSourceMatch){
 return {referenceClassification:CLASSIFICATIONS.has(value)?value:'UNVERIFIED',
  installedSourceMatch:bool(installedSourceMatch),
  // Byte identity is not proof of a past promotion or live process ancestry.
  historicalPromotionVerified:false,liveWatchdogExecutionVerified:false};
}

function fixedBytes(file,max=262144){
 const st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size>0&&st.size<=max,
  'S6_LOCAL_FIXED_FILE_UNVERIFIED');
 need(path.win32.normalize(fs.realpathSync.native(file)).toLowerCase()===
  path.win32.normalize(file).toLowerCase(),'S6_LOCAL_FIXED_PATH_REDIRECT');
 const data=fs.readFileSync(file);
 need(data.length===st.size,'S6_LOCAL_FIXED_READ_CHANGED');return data;
}
function api(route){
 return JSON.parse(execFileSync(GH,['api',route],{
  encoding:'utf8',windowsHide:true,timeout:25000,maxBuffer:1048576
 }));
}
function remoteBytes(rel,ref){
 const f=api('repos/'+REPO+'/contents/'+rel+'?ref='+ref);
 need(f?.type==='file'&&f.encoding==='base64'&&typeof f.content==='string',
  'S6_LOCAL_REMOTE_SOURCE_UNVERIFIED');
 return Buffer.from(f.content,'base64');
}
function verifyOwnerSource(){
 need(process.platform==='win32'&&os.hostname().toUpperCase()==='PC'&&
  !process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME&&!process.env.GITHUB_RUN_ID,
  'S6_LOCAL_INDEPENDENT_WINDOWS_REQUIRED');
 need(path.win32.normalize(path.resolve(fileURLToPath(import.meta.url))).toLowerCase()===
  path.win32.normalize(path.resolve(ROOT,REL)).toLowerCase(),
  'S6_LOCAL_ENTRY_PATH_UNVERIFIED');
 const u=api('user'),r=api('repos/'+REPO);
 need(u?.id===327938088&&u.login==='ansqhd5774-Choi'&&
  r?.id===1442936296&&r.owner?.id===327938088&&r.full_name===REPO&&r.private===false,
  'S6_LOCAL_GITHUB_OWNER_UNVERIFIED');
 const head=api('repos/'+REPO+'/git/ref/heads/main')?.object?.sha;
 need(/^[a-f0-9]{40}$/.test(head??''),'S6_LOCAL_MAIN_REF_UNVERIFIED');
 const sources=new Map();
 for(const rel of SOURCE_FILES){
  const raw=fixedBytes(path.join(ROOT,rel));
  need(raw.equals(remoteBytes(rel,head)),'S6_LOCAL_REVIEWED_SOURCE_DRIFT');
  sources.set(rel,raw);
 }
 need(fixedBytes(ANCESTRY).equals(remoteBytes('tools/maintenance-ancestry.vbs',head)),
  'S6_LOCAL_OPERATOR_PROOF_SOURCE_DRIFT');
 const proof=execFileSync(CSCRIPT,['//NoLogo',ANCESTRY,'OPERATOR',String(process.pid),'0'],
  {encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:4096}).trim();
 need(proof==='INDEPENDENT_OPERATOR','S6_LOCAL_OWNER_ANCESTRY_UNVERIFIED');
 return {head,sources};
}
function installedMatch(reference){
 try{
  const manifest=JSON.parse(fixedBytes(path.join(WATCHDOG,'INSTALL.json'),32768));
  const bytes=fixedBytes(path.join(WATCHDOG,'runner-watchdog.mjs'));
  return /^[a-f0-9]{64}$/.test(manifest.sha256??'')&&
   sha(bytes)===manifest.sha256&&bytes.equals(reference);
 }catch{return null;}
}

export async function main(){
 const {head,sources}=verifyOwnerSource();
 const {readS64078LocalBytes}=await import('./s6-4078-windows-local-readonly.mjs');
 const {scanControllerRunnersReadOnly}=await import('./runner-watchdog.mjs');
 const {projectS64078BacklogReadonly}=await import('../controller/s6-journal-readonly.mjs');
 const s6=projectLocalS6(readS64078LocalBytes(),projectS64078BacklogReadonly);
 const ref=sources.get('tools/runner-watchdog.mjs');
 const before=installedMatch(ref);
 const wmi=scanControllerRunnersReadOnly();
 const after=installedMatch(ref);
 const wmiObservation=projectWmiObservation(wmi,before===after?before:null);
 return {...base(),status:s6.status==='READ_ONLY_OBSERVED'||
  wmiObservation.referenceClassification!=='UNVERIFIED'?'READ_ONLY_OBSERVED':'STATE_UNKNOWN',ownerVerified:true,
  independentOperatorVerified:true,reviewedSourceSha:head,
  observedAtUtc:new Date().toISOString(),s6,wmi:wmiObservation};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{need(process.argv.length===2,'S6_LOCAL_ARGUMENTS_DENIED');console.log(JSON.stringify(await main()));}
 catch(e){console.log(JSON.stringify({...base(),status:'BLOCKED',
  code:/^S6_LOCAL_[A-Z0-9_]+$/.test(e?.code??'')?e.code:'S6_LOCAL_READONLY_UNVERIFIED'}));
  process.exitCode=2;}
}
