#!/usr/bin/env node
// Fixed, read-only Windows capability-registry inventory via the existing Runner.
// Never executes source from the Issue and never reads raw DB/provider secrets.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {selectPinnedCapabilityProfiles,inspectApprovedRuntimeInventory}
 from '../theme-generic-a/controller/approved-runtime-inventory-readonly.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const SOURCE_REPO='ansqhd5774-Choi/zgmini';
const OWNER='ansqhd5774-Choi';
const TITLE='pc-approved-runtime-a';
const OPERATION='approved-runtime-inventory-readonly';
const SCHEMA='ZGMINI_PC_APPROVED_RUNTIME_A_REQUEST_V1';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_KEYS=['schema','requestId','chatId','operation',
 'sourceRepository','sourceBranch','sourceSha','approvalManifestSha256'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));

export const A_RESULT='approved-runtime-a-once-result.json';
export const A_TITLE=TITLE;
export const A_OPERATION=OPERATION;
export const A_SCHEMA=SCHEMA;

export function verifyARequest(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===OWNER&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event?.sender?.login===OWNER&&event?.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&event.issue.title===TITLE&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'A_RUNTIME_OWNER_STOP');
 let req;try{req=JSON.parse(event.issue.body);}catch{fail('A_RUNTIME_REQUEST_JSON_STOP');}
 need(exact(req,REQUEST_KEYS)&&req.schema===SCHEMA&&
  UUID.test(req.requestId??'')&&UUID.test(req.chatId??'')&&
  req.operation===OPERATION&&req.sourceRepository===SOURCE_REPO&&
  typeof req.sourceBranch==='string'&&
  /^[A-Za-z0-9][A-Za-z0-9_./-]{0,159}$/.test(req.sourceBranch)&&
  !req.sourceBranch.split('/').includes('..')&&
  SHA40.test(req.sourceSha??'')&&SHA64.test(req.approvalManifestSha256??''),
  'A_RUNTIME_REQUEST_SCOPE_STOP');
 return req;
}
export function approvalPath(req){
 need(SHA64.test(req?.approvalManifestSha256??''),'A_RUNTIME_MANIFEST_PIN_STOP');
 return `approvals/approved-runtime-a/${req.approvalManifestSha256}.json`;
}
const gitBinary=()=>{
 const p=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(fs.existsSync);
 need(p,'A_RUNTIME_GIT_MISSING_STOP');return p;
};
function git(root,args,max=262144){
 const r=spawnSync(gitBinary(),['-C',root,...args],{encoding:'buffer',
  windowsHide:true,shell:false,timeout:15000,maxBuffer:max});
 need(r.status===0&&Buffer.isBuffer(r.stdout),'A_RUNTIME_GIT_BLOB_STOP');
 return r.stdout;
}
function worktreeEqualsBlob(bytes,blob){
 if(bytes.equals(blob))return true;
 return !blob.includes(13)&&bytes.equals(Buffer.from(blob.toString('utf8').replace(/\n/g,'\r\n')));
}
export function authorizeARegistry({event,env,raw,worktree,head}){
 const req=verifyARequest(event,env);
 need(head===env.GITHUB_SHA&&Buffer.isBuffer(raw)&&raw.length>16&&
  raw.length<=131072&&Buffer.isBuffer(worktree)&&worktreeEqualsBlob(worktree,raw)&&
  hash(raw)===req.approvalManifestSha256,'A_RUNTIME_REGISTRY_BYTES_STOP');
 let registry;try{registry=JSON.parse(raw.toString('utf8'));}
 catch{fail('A_RUNTIME_REGISTRY_JSON_STOP');}
 need(registry?.schema==='ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1'&&
  Array.isArray(registry.profiles)&&registry.profiles.length>0,
  'A_RUNTIME_REGISTRY_SCOPE_STOP');
 // This call validates every selector before any OS file/Task inspection.
 selectPinnedCapabilityProfiles({manifestBytes:raw,
  approvedManifestSha256:req.approvalManifestSha256,
  requestIdentity:registry.profiles[0].binding});
 // A stable registered path remains readable across routine source commits.
 // Source SHA from this Issue is a correlation field, not an A-permission Gate.
 const profiles=registry.profiles.filter(p=>
  p.binding.sourceRepository===req.sourceRepository&&
  p.binding.sourceBranch===req.sourceBranch);
 need(profiles.length>0,'A_RUNTIME_SOURCE_NOT_REGISTERED');
 return Object.freeze({req,profiles,registrySha256:hash(raw),
  controlSha:env.GITHUB_SHA,issueNumber:event.issue.number,
  registeredCount:registry.profiles.length});
}
export function loadARegistry({event,env,controlRoot,read=fs.readFileSync,
 gitHead=root=>git(root,['rev-parse','HEAD'],512).toString('utf8').trim(),
 gitBlob=(root,rel)=>git(root,['show',`HEAD:${rel}`])}={}){
 const req=verifyARequest(event,env);
 need(typeof controlRoot==='string'&&path.isAbsolute(controlRoot),
  'A_RUNTIME_CONTROL_ROOT_STOP');
 const rel=approvalPath(req);
 return authorizeARegistry({event,env,
  raw:gitBlob(controlRoot,rel),
  worktree:read(path.join(controlRoot,...rel.split('/'))),
  head:gitHead(controlRoot)});
}
function queryWindowsTask(name){
 const exe=path.join(process.env.SystemRoot??String.raw`C:\Windows`,
  'System32','schtasks.exe');
 need(fs.existsSync(exe),'A_RUNTIME_SCHTASKS_MISSING_STOP');
 const r=spawnSync(exe,['/Query','/TN',name,'/XML'],{
  windowsHide:true,shell:false,timeout:12000,maxBuffer:262144,encoding:'buffer'});
 need(r.status===0&&Buffer.isBuffer(r.stdout),'A_RUNTIME_SCHTASKS_QUERY_STOP');
 return r.stdout;
}
export function inspectApprovedA(auth,{dataRoot=String.raw`E:\ZGmini\data`,
 queryTask=queryWindowsTask,inspect=inspectApprovedRuntimeInventory}={}){
 need(auth?.profiles&&Array.isArray(auth.profiles),'A_RUNTIME_AUTH_MISSING');
 if(auth.profiles.length>4)return {status:'DONE',
  code:'A_RUNTIME_SUMMARY_ONLY',mode:'SUMMARY_ONLY',
  registeredCount:auth.registeredCount,selectedCount:auth.profiles.length,
  fileHashesComplete:false,taskChecksComplete:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const profiles=auth.profiles.map(profile=>{
  try{
   const report=inspect({dataRoot,profile,queryTask});
   let runtimeMode='NOT_APPLICABLE';
   const active=profile.files.find(x=>x.relativePath==='ACTIVE_RUNTIME.json');
   const installed=profile.files.find(x=>x.relativePath==='INSTALL_RESULT.json');
   if(active&&installed){
    // Never declare legacy vs repeatable while the installed preimage moves.
    // Second independent read detects a write between first mode and hashes.
    const second=inspect({dataRoot,profile,queryTask});
    const watched=profile.files.filter(x=>[
     'ACTIVE_RUNTIME.json','INSTALL_RESULT.json',
     'THEME_SCHEDULED.cmd','THEME_SCHEDULED.vbs'].includes(x.relativePath));
    const stable=watched.every(x=>JSON.stringify(report.files?.[x.key])===
     JSON.stringify(second.files?.[x.key]))&&
     profile.tasks.every(x=>JSON.stringify(report.tasks?.[x.key])===
      JSON.stringify(second.tasks?.[x.key]));
    if(!stable)return {profileId:profile.id,status:'BLOCKED',
     code:'A_RUNTIME_SNAPSHOT_CHANGED_DURING_READ',rootExists:report.rootExists,
     runtimeMode:'STATE_UNKNOWN_CHANGED_DURING_READ',files:{},tasks:{}};
    const activeState=report.files?.[active.key];
    const installedState=report.files?.[installed.key];
    // The production package runner chooses ACTIVE first when present.
    // INSTALL_RESULT is only the legacy/first-upgrade fallback, not an
    // additional requirement for an already configured repeatable runtime.
    runtimeMode=activeState?.exists===true?
     (activeState.sha256?'REPEATABLE_ACTIVE_RUNTIME':'ACTIVE_PREIMAGE_UNVERIFIED'):
     installedState?.exists!==true?'INSTALL_PREIMAGE_NOT_FOUND':
     !installedState.sha256?'INSTALL_PREIMAGE_UNVERIFIED':'FIRST_SINGLE_CMD_UPGRADE';
   }
   return {...report,runtimeMode};
  }catch{
   return {profileId:profile.id,status:'BLOCKED',code:'A_RUNTIME_READ_UNAVAILABLE',
    rootExists:null,runtimeMode:'STATE_UNKNOWN',files:{},tasks:{}};
  }
 });
 const blocked=profiles.filter(p=>p.status!=='DONE').length;
 const taskChecksComplete=blocked===0&&profiles.every(p=>
  Object.values(p.tasks??{}).every(x=>x.status==='XML_READ'&&
   x.expectedCommandPresent!==false&&x.expectedHourPresent!==false));
 return {status:'DONE',code:blocked?'A_RUNTIME_PARTIAL':'A_RUNTIME_FILE_AND_TASK_READONLY',
  mode:'DETAILED',registeredCount:auth.registeredCount,
  registrySha256:auth.registrySha256,controlSha:auth.controlSha,
  requestedSourceSha:auth.req.sourceSha,selectedCount:profiles.length,
  fileHashesComplete:blocked===0,taskChecksComplete,
  blockedProfiles:blocked,profiles,operationalWrites:0,providerCalls:0,d1Writes:0};
}
async function main(){
 need(process.platform==='win32','A_RUNTIME_WINDOWS_REQUIRED');
 const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const auth=loadARegistry({event,env,
  controlRoot:path.join(env.GITHUB_WORKSPACE??'','approved-a-control')});
 return {schema:'ZGMINI_APPROVED_RUNTIME_A_LOCAL_RESULT_V1',
  requestId:auth.req.requestId,...inspectApprovedA(auth)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let report;try{report=await main();}
 catch(e){report={status:'BLOCKED',code:/^A_RUNTIME_[A-Z0-9_]{1,100}$/.test(e.code??'')?
  e.code:'A_RUNTIME_READ_UNAVAILABLE',requestId:null,operationalWrites:0};}
 try{
  need(typeof process.env.RUNNER_TEMP==='string'&&path.isAbsolute(process.env.RUNNER_TEMP),
   'A_RUNTIME_TEMP_STOP');
  const bytes=JSON.stringify(report)+'\n';
  need(Buffer.byteLength(bytes)<=32768,'A_RUNTIME_REPORT_SIZE_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,A_RESULT),bytes,{flag:'wx'});
 }catch{process.exitCode=1;}
 console.log(`${report.status} ${report.code}`);
 if(report.status!=='DONE')process.exitCode=1;
}
