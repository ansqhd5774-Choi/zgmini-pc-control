#!/usr/bin/env node
// Candidate independent Windows Writer B lane. No installed maintainer needed.
// Runtime intentionally BLOCKS until the fixed, reviewed native bridge exists.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {runApprovedRegistryCas,PIN_CAS_SCHEMA,PIN_CAS_SCOPE}
  from '../writer-b/approved-versioned-bundle/approved-registry-cas.mjs';
import {runVersionedBundleTransaction}
  from '../writer-b/approved-versioned-bundle/versioned-bundle-transaction.mjs';
import {SCHEMA as BUNDLE_SCHEMA,SCOPE as BUNDLE_SCOPE}
  from '../writer-b/approved-versioned-bundle/versioned-bundle-plan.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ACTOR='ansqhd5774-Choi';
const TITLE='pc-approved-runtime-b';
const LABEL='pc-writer-b-install';
const OPERATION='pc-approved-runtime-b';
const SCHEMA='ZGMINI_PC_APPROVED_RUNTIME_B_ACTIONS_REQUEST_V1';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&
  keys.every(x=>Object.hasOwn(v,x));
const REQUEST_KEYS=['schema','requestId','chatId','operation','controlRepository',
  'approvalManifestSha256'];

export const DIRECT_B_RESULT='approved-runtime-b-once-result.json';
export const DIRECT_B_TITLE=TITLE;
export const DIRECT_B_OPERATION=OPERATION;
export const DIRECT_B_REQUEST_SCHEMA=SCHEMA;

export function verifyOpenedOwnerIssue(event,env){
  need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
    env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===ACTOR&&
    env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
    event?.repository?.full_name===REPO&&event.repository.private===true&&
    event?.sender?.login===ACTOR&&event?.issue?.user?.login===ACTOR&&
    !event.issue.pull_request&&event.issue.title===TITLE&&
    event.issue.labels?.some(x=>x.name===LABEL)&&
    Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
    'DIRECT_B_ISSUE_OWNER_STOP');
  let request;
  try{request=JSON.parse(event.issue.body);}catch{fail('DIRECT_B_ISSUE_JSON_STOP');}
  need(exact(request,REQUEST_KEYS)&&request.schema===SCHEMA&&
    UUID.test(request.requestId??'')&&UUID.test(request.chatId??'')&&
    request.operation===OPERATION&&request.controlRepository===REPO&&
    SHA64.test(request.approvalManifestSha256??''),
    'DIRECT_B_REQUEST_SCOPE_STOP');
  return request;
}

export function approvalPathFor(request){
  need(SHA64.test(request?.approvalManifestSha256??''),
    'DIRECT_B_APPROVAL_PIN_STOP');
  return `approvals/approved-runtime-b/${request.approvalManifestSha256}.json`;
}

function gitBinary(){
  const found=[String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files\Git\bin\git.exe`].find(x=>fs.existsSync(x));
  need(found,'DIRECT_B_GIT_MISSING_STOP');return found;
}
function git(root,args,max=300000){
  const r=spawnSync(gitBinary(),['-C',root,...args],{encoding:'buffer',
    shell:false,windowsHide:true,timeout:15000,maxBuffer:max});
  need(r.status===0&&Buffer.isBuffer(r.stdout),'DIRECT_B_GIT_BLOB_STOP');
  return r.stdout;
}
function equalWorktree(worktree,blob){
  if(worktree.equals(blob))return true;
  return !blob.includes(13)&&worktree.equals(Buffer.from(blob.toString('utf8').replace(/\n/g,'\r\n')));
}

// These read hooks are fixed source/OS methods, never supplied by the Issue.
export function authorizeApprovedRaw({event,env,raw,worktree,actualHead}){
  const request=verifyOpenedOwnerIssue(event,env);
  need(actualHead===env.GITHUB_SHA,'DIRECT_B_CONTROL_COMMIT_STOP');
  need(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=262144&&
    Buffer.isBuffer(worktree)&&equalWorktree(worktree,raw)&&
    sha(raw)===request.approvalManifestSha256,
    'DIRECT_B_APPROVAL_BYTES_STOP');
  let manifest;
  try{manifest=JSON.parse(raw.toString('utf8'));}catch{fail('DIRECT_B_APPROVAL_JSON_STOP');}
  const isPin=manifest?.schema===PIN_CAS_SCHEMA;
  const isBundle=manifest?.schema===BUNDLE_SCHEMA;
  need((isPin&&manifest.scope===PIN_CAS_SCOPE&&manifest.status==='APPROVED_B')||
    (isBundle&&manifest.scope===BUNDLE_SCOPE&&manifest.status==='APPROVED'),
    'DIRECT_B_EFFECT_SCOPE_STOP');
  need(SHA40.test(manifest.sourceSha??'')&&
    typeof manifest.profileId==='string'&&manifest.profileId.length>0,
    'DIRECT_B_APPROVED_SOURCE_STOP');
  return Object.freeze({request,manifest,raw,issueNumber:event.issue.number,
    controlSha:env.GITHUB_SHA,approvalPath:approvalPathFor(request),
    mode:isPin?'PIN_REGISTRY_CAS':'VERSIONED_BUNDLE_ACTIVATE'});
}

export function loadApprovedRaw({event,env,controlRoot,
  readFile=fs.readFileSync,gitHead=(root)=>git(root,['rev-parse','HEAD'],512).toString('utf8').trim(),
  gitBlob=(root,rel)=>git(root,['show',`HEAD:${rel}`])}={}){
  const request=verifyOpenedOwnerIssue(event,env);
  need(typeof controlRoot==='string'&&path.isAbsolute(controlRoot),
    'DIRECT_B_CONTROL_ROOT_STOP');
  const relative=approvalPathFor(request);
  const file=path.join(controlRoot,...relative.split('/'));
  const worktree=readFile(file);
  const raw=gitBlob(controlRoot,relative);
  return authorizeApprovedRaw({event,env,raw,worktree,
    actualHead:gitHead(controlRoot)});
}

export async function applyApprovedOnce(auth,{makeApprovedNativeAdapter=null,
  pinRunner=runApprovedRegistryCas,bundleRunner=runVersionedBundleTransaction}={}){
  // No default OS adapter: using an uninstalled B source must not grant effects.
  need(typeof makeApprovedNativeAdapter==='function',
    'DIRECT_B_NATIVE_BRIDGE_NOT_INSTALLED');
  const capability=await makeApprovedNativeAdapter({auth});
  need(capability?.originVerified===true&&
    capability?.effect===auth.mode&&capability?.sourceSha===auth.manifest.sourceSha&&
    typeof capability.adapter==='object',
    'DIRECT_B_NATIVE_BRIDGE_UNVERIFIED');
  let outcome;
  if(auth.mode==='PIN_REGISTRY_CAS'){
    outcome=await pinRunner({approvalRaw:auth.raw,
      pinnedApproval:{requestId:auth.request.requestId,
        profileId:auth.manifest.profileId,sourceSha:auth.manifest.sourceSha,
        rawApprovalSha256:sha(auth.raw)},adapter:capability.adapter});
  }else{
    need(capability.trustedProfiles!==undefined,'DIRECT_B_REGISTRY_PIN_NOT_INSTALLED');
    outcome=await bundleRunner({rawManifest:auth.raw,
      pinnedApproval:{requestId:auth.request.requestId,
        rawManifestSha256:sha(auth.raw),approvalRef:auth.approvalPath,
        sourceSha:auth.manifest.sourceSha,profileId:auth.manifest.profileId},
      trustedProfiles:capability.trustedProfiles,adapter:capability.adapter});
  }
  // Do not treat a local PASS as public verified 2/2 report.
  return {status:outcome?.status==='PASS'?'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED':
    outcome?.status==='STATE_UNKNOWN'?'DIRECT_B_EFFECT_UNKNOWN':
    'DIRECT_B_EFFECT_BLOCKED',
    code:outcome?.status==='STATE_UNKNOWN'?'DIRECT_B_STATE_UNKNOWN':
      outcome?.status==='PASS'?'DIRECT_B_LOCAL_EFFECT_PASS':'DIRECT_B_EFFECT_STOP',
    requestId:auth.request.requestId,manifestSha256:sha(auth.raw),
    controlSha:auth.controlSha,sourceSha:auth.manifest.sourceSha,
    mode:auth.mode,reportStatus:outcome?.reportStatus??'INCOMPLETE',
    operationSucceeded:outcome?.status==='PASS'};
}

async function main(){
  need(process.platform==='win32','DIRECT_B_WINDOWS_REQUIRED');
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const controlRoot=path.join(env.GITHUB_WORKSPACE??'','generic-b-control');
  const auth=loadApprovedRaw({event,env,controlRoot});
  // The sole native factory is code in the fixed reviewed checkout. Issue body
  // cannot select modules, paths, commands, targets or bridge capabilities.
  const fixedBridge=new URL('./native-adapter.mjs',import.meta.url);
  if(!fs.existsSync(fileURLToPath(fixedBridge)))return applyApprovedOnce(auth);
  const native=await import(fixedBridge.href);
  need(typeof native.makeApprovedNativeAdapter==='function',
    'DIRECT_B_NATIVE_BRIDGE_INCOMPLETE');
  return applyApprovedOnce(auth,{
    makeApprovedNativeAdapter:native.makeApprovedNativeAdapter});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let result;
  try{result=await main();}catch(error){
    result={status:'DIRECT_B_PREFLIGHT_STOP',
      code:/^DIRECT_B_[A-Z0-9_]{1,100}$/.test(error?.code??'')?
        error.code:'DIRECT_B_UNEXPECTED_STOP',requestId:null};
  }
  try{
    need(typeof process.env.RUNNER_TEMP==='string'&&
      path.isAbsolute(process.env.RUNNER_TEMP),'DIRECT_B_TEMP_STOP');
    fs.writeFileSync(path.join(process.env.RUNNER_TEMP,DIRECT_B_RESULT),
      JSON.stringify(result)+'\n',{flag:'wx'});
  }catch{process.exitCode=1;}
  process.stdout.write(`${result.status} ${result.code}\n`);
  if(result.status!=='DIRECT_B_EFFECT_PASS_NOT_PUBLISHED')process.exitCode=1;
}
