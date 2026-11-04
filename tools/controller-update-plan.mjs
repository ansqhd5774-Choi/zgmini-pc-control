#!/usr/bin/env node
// Read-only candidate analysis. This NEVER approves, installs, posts an Issue,
// changes a Git ref, or reads operational data. Target file bytes come from Git.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const SHA40=/^[a-f0-9]{40}$/;
const sha256=x=>createHash('sha256').update(x).digest('hex');
const allowedController=p=>p==='config/operations.json'||
  /^controller\/[a-z][a-z0-9-]*\.mjs$/.test(p);
const safePath=p=>typeof p==='string'&&p.length>0&&!p.startsWith('/')&&
  !p.includes('\\')&&!p.split('/').some(t=>t==='.'||t==='..'||t==='');

export function analyzeControllerDelta({installedSha,targetSha,changedPaths,readTargetFile}){
  if(!SHA40.test(installedSha??'')||!SHA40.test(targetSha??'')||
    installedSha===targetSha)throw Error('CONTROLLER_PLAN_SHA_INVALID');
  if(!Array.isArray(changedPaths)||typeof readTargetFile!=='function')
    throw Error('CONTROLLER_PLAN_INPUT_INVALID');
  const seen=new Set(),allowFiles=[],infrastructureFiles=[],otherChanges=[],needsReview=[];
  for(const p of changedPaths){
    if(!safePath(p)||seen.has(p))throw Error('CONTROLLER_PLAN_PATH_INVALID');
    seen.add(p);
    if(p.startsWith('controller/')||p.startsWith('config/')){
      if(!allowedController(p)){needsReview.push(p);continue;}
      let bytes;try{bytes=readTargetFile(p);}catch{throw Error('CONTROLLER_PLAN_TARGET_FILE_UNAVAILABLE');}
      if(!Buffer.isBuffer(bytes))throw Error('CONTROLLER_PLAN_TARGET_BYTES_INVALID');
      allowFiles.push({path:p,sha256:sha256(bytes)});
    }else if(p.startsWith('.github/workflows/')||p.startsWith('scripts/')){
      let bytes;try{bytes=readTargetFile(p);}catch{throw Error('CONTROLLER_PLAN_INFRA_FILE_UNAVAILABLE');}
      if(!Buffer.isBuffer(bytes))throw Error('CONTROLLER_PLAN_TARGET_BYTES_INVALID');
      infrastructureFiles.push({path:p,sha256:sha256(bytes)});
    }else if(p.startsWith('tools/')){
      otherChanges.push({path:p,category:'MAINTENANCE_SOURCE_SEPARATE_HANDOFF'});
    }else if(/^(docs|tests|results|approvals)\//.test(p)){
      otherChanges.push({path:p,category:'NOT_INSTALLED_WITH_CONTROLLER'});
    }else{
      needsReview.push(p);
    }
  }
  allowFiles.sort((a,b)=>a.path.localeCompare(b.path));
  infrastructureFiles.sort((a,b)=>a.path.localeCompare(b.path));
  otherChanges.sort((a,b)=>a.path.localeCompare(b.path));
  needsReview.sort();
  return {
    schema:'ZGMINI_CONTROLLER_UPDATE_PLAN_V1',
    status:needsReview.length?'REVIEW_UNCLASSIFIED_CHANGE':'DRAFT_NOT_APPROVED',
    installedSha,targetSha,allowFiles,infrastructureFiles,otherChanges,needsReview,
    requiresControllerInstall:allowFiles.length>0,
    requiresInfrastructureApproval:infrastructureFiles.length>0,
    requiresSeparateMaintenanceHandoff:otherChanges.some(x=>x.category==='MAINTENANCE_SOURCE_SEPARATE_HANDOFF'),
    note:'This is source-only evidence, not B approval, PC installation, or runtime verification',
  };
}

const git=(args,encoding='utf8')=>execFileSync('git',args,{
  cwd:process.cwd(),encoding,timeout:120000,maxBuffer:8e6,windowsHide:true,
});
const checkAncestor=(oldSha,newSha)=>{try{
  git(['merge-base','--is-ancestor',oldSha,newSha]);return true;
}catch{return false;}};

export function planFromGit(args=process.argv.slice(2)){
  if(args.length!==4||args[0]!=='--installed-sha'||args[2]!=='--target-sha')
    throw Error('CONTROLLER_PLAN_USAGE');
  const installedSha=args[1],targetSha=args[3];
  if(!SHA40.test(installedSha??'')||!SHA40.test(targetSha??''))
    throw Error('CONTROLLER_PLAN_SHA_INVALID');
  if(!checkAncestor(installedSha,targetSha))throw Error('CONTROLLER_PLAN_TARGET_NOT_DESCENDANT');
  if(!checkAncestor(targetSha,'refs/remotes/origin/main'))
    throw Error('CONTROLLER_PLAN_TARGET_NOT_ON_LOCAL_MAIN');
  const changedPaths=git(['diff','--name-only',installedSha,targetSha,'--']).trim().split(/\r?\n/).filter(Boolean);
  const result=analyzeControllerDelta({installedSha,targetSha,changedPaths,
    readTargetFile:p=>git(['show',targetSha+':'+p],null)});
  return {...result,localOriginMainSha:git(['rev-parse','refs/remotes/origin/main']).trim(),
    requiresFreshRemoteAndLivePCCheck:true};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.stdout.write(JSON.stringify(planFromGit(),null,2)+'\n');}
  catch(error){process.stderr.write(JSON.stringify({
    status:'BLOCKED',code:/^[A-Z0-9_]{1,80}$/.test(error?.message??'')
      ?error.message:'CONTROLLER_PLAN_FAILED'})+'\n');process.exitCode=1;}
}
