// Fixed, single-use READ-ONLY Windows Actions host for D+30. Not an installer,
// Issue router, new scheduler or approval to update any operational source.
// Only a separately authorized existing workflow may invoke this module.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D30_INSTALL_CONTRACT} from './contract.mjs';
import {D30_WINDOWS_SOURCE_ROOT,runD30WindowsReadOnlyPreview}
  from './windows-preview.mjs';
import {createD30FeatureBReadOnlyHost} from './windows-b-probe-host.mjs';
import {inspectD30WindowsBReadOnlyPreflight}
  from './windows-b-preflight.mjs';

const OWNER='ansqhd5774-Choi';
const CONTROL=`${OWNER}/zgmini-pc-control`;
const SOURCE=D30_INSTALL_CONTRACT.sourceRepository;
const BASE=D30_INSTALL_CONTRACT.historicPublicSourceSha;
const TARGET=D30_INSTALL_CONTRACT.sourceHead;
const TITLE='pc-calendar-d30-readonly-preview-once';
const SCHEMA='ZGMINI_CALENDAR_D30_READONLY_PREVIEW_V1';
const OPERATION='calendar-d30-readonly-preview-once';
const SHA40=/^[a-f0-9]{40}$/;
const PATHS=D30_INSTALL_CONTRACT.operationalFiles.map(f=>f.path);
const SOURCE_ROOT=D30_WINDOWS_SOURCE_ROOT;
const MAX_FILE_BYTES=2_000_000;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};

// GitHub's issue webhook contains repository/installation metadata beyond the
// small approved Issue body. Do not reject a normal event at an arbitrary 8 KiB.
export function parseD30ReadOnlyIssueEvent(bytes){
  need(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<MAX_FILE_BYTES,
    'ER1_D30_PREVIEW_EVENT_FILE_STOP');
  try{return JSON.parse(bytes.toString('utf8'));}
  catch{stop('ER1_D30_PREVIEW_EVENT_FILE_STOP');}
}

/** Pure event gate, unit-testable without Windows, runner, or network. */
export function validateD30ReadOnlyIssue({env,event,controlHead}={}){
  need(env?.GITHUB_REPOSITORY===CONTROL&&env?.GITHUB_ACTOR===OWNER&&
    env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
    env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
    controlHead===env.GITHUB_SHA,
  'ER1_D30_PREVIEW_EVENT_STOP');
  need(event?.action==='opened'&&event?.repository?.private===true&&
    event.repository.full_name===CONTROL&&
    event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
    event.issue?.title===TITLE&&!event.issue.pull_request&&
    typeof event.issue.body==='string'&&event.issue.body.length<=2048,
  'ER1_D30_PREVIEW_ISSUE_STOP');
  let body;
  try{body=JSON.parse(event.issue.body);}catch{stop('ER1_D30_PREVIEW_REQUEST_STOP');}
  const keys=['baseHead','candidateHead','controlSha','operation','requestId','schema'];
  need(body&&typeof body==='object'&&!Array.isArray(body)&&
    Object.keys(body).sort().join('|')===keys.join('|')&&
    body.schema===SCHEMA&&body.operation===OPERATION&&
    body.controlSha===env.GITHUB_SHA&&body.candidateHead===TARGET&&
    body.baseHead===BASE&&
    /^pc-calendar-d30-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.requestId??''),
  'ER1_D30_PREVIEW_REQUEST_STOP');
  return {requestId:body.requestId,controlHead:env.GITHUB_SHA};
}

function safeDir(dir){
  need(typeof dir==='string'&&path.win32.isAbsolute(dir),
    'ER1_D30_PREVIEW_FIXED_PATH_STOP');
  const s=fs.lstatSync(dir);
  need(s.isDirectory()&&!s.isSymbolicLink(),
    'ER1_D30_PREVIEW_FIXED_PATH_STOP');
  return fs.realpathSync.native(dir);
}
function safeFile(file,root){
  const st=fs.lstatSync(file);
  need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<MAX_FILE_BYTES,
    'ER1_D30_PREVIEW_FILE_STOP');
  const real=fs.realpathSync.native(file).toLowerCase();
  const boundary=fs.realpathSync.native(root).toLowerCase()+path.win32.sep;
  need(real.startsWith(boundary),'ER1_D30_PREVIEW_PATH_ESCAPE_STOP');
  return fs.readFileSync(file);
}
function findGit(){
  const dirs=[String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files\Git\bin\git.exe`];
  const found=dirs.find(p=>{
    try{const s=fs.lstatSync(p);return s.isFile()&&!s.isSymbolicLink();}
    catch{return false;}
  });
  need(found,'ER1_D30_PREVIEW_FIXED_GIT_MISSING');
  return found;
}
function git(gitExe,checkout,args){
  const r=spawnSync(gitExe,['-C',checkout,'-c','core.fsmonitor=false',
    '-c','core.autocrlf=false',...args],{shell:false,windowsHide:true,
    timeout:30_000,maxBuffer:MAX_FILE_BYTES+2048,encoding:null,
    env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0',
      GIT_CONFIG_NOSYSTEM:'1'}});
  need(!r.error&&r.status===0&&Buffer.isBuffer(r.stdout),
    'ER1_D30_PREVIEW_GIT_READ_STOP');
  return r.stdout;
}
function gitHead(gitExe,checkout){
  const sha=git(gitExe,checkout,['rev-parse','HEAD']).toString('utf8').trim();
  need(SHA40.test(sha),'ER1_D30_PREVIEW_GIT_HEAD_STOP');
  return sha;
}
function assertCheckoutIdentity(gitExe,checkout,sha,repository){
  need(gitHead(gitExe,checkout)===sha,'ER1_D30_PREVIEW_EXACT_CHECKOUT_STOP');
  // Prevent a same-SHA lookalike directory: read only the fixed Git remote URL.
  const remote=git(gitExe,checkout,['remote','get-url','origin']).toString('utf8').trim();
  const accepted=[`https://github.com/${repository}`,
    `https://github.com/${repository}.git`,
    `git@github.com:${repository}.git`];
  need(accepted.includes(remote),'ER1_D30_PREVIEW_CHECKOUT_REPOSITORY_STOP');
}

/**
 * The source provenance inquiry intentionally remains separate: existing A
 * Runtime/Task/config/checkpoint evidence must be supplied by its authorized
 * installed operation. This host never fabricates VERIFIED from git HEAD.
 */
export async function runD30ReadOnlyWindowsHost({env=process.env}={}){
  const safeStop=code=>({status:'READ_ONLY_PREVIEW_BLOCKED',code,
    sourceWrites:0,dbWrites:0,taskChanges:0});
  try{
    need(process.platform==='win32','ER1_D30_PREVIEW_WINDOWS_ONLY');
    need(typeof env.GITHUB_WORKSPACE==='string'&&
      path.win32.isAbsolute(env.GITHUB_WORKSPACE)&&
      typeof env.RUNNER_TEMP==='string'&&path.win32.isAbsolute(env.RUNNER_TEMP),
    'ER1_D30_PREVIEW_WORKSPACE_STOP');
    const work=safeDir(env.GITHUB_WORKSPACE);
    const temp=safeDir(env.RUNNER_TEMP);
    const control=safeDir(path.win32.join(work,'control'));
    const gitExe=findGit();
    const controlHead=gitHead(gitExe,control);
    need(typeof env.GITHUB_EVENT_PATH==='string'&&
      path.win32.isAbsolute(env.GITHUB_EVENT_PATH),
    'ER1_D30_PREVIEW_EVENT_FILE_STOP');
    const eventBytes=safeFile(env.GITHUB_EVENT_PATH,path.win32.dirname(env.GITHUB_EVENT_PATH));
    const event=parseD30ReadOnlyIssueEvent(eventBytes);
    const trustedRequest=validateD30ReadOnlyIssue({env,event,controlHead});
    assertCheckoutIdentity(gitExe,control,controlHead,CONTROL);
    // No operating-source directory or file is inspected before the event,
    // actor and checkout identity have passed the trusted read-only gate.
    const base=safeDir(path.win32.join(work,'d30-base'));
    const candidate=safeDir(path.win32.join(work,'d30-candidate'));
    const operating=safeDir(SOURCE_ROOT);
    assertCheckoutIdentity(gitExe,base,BASE,SOURCE);
    assertCheckoutIdentity(gitExe,candidate,TARGET,SOURCE);

    const host={
      async inspectTrustedControl(){return {repository:CONTROL,
        head:controlHead,authenticated:true,readOnlyAuthorized:true};},
      async inspectCandidateCheckout(){return {repository:SOURCE,
        head:TARGET,objectsAvailable:true};},
      async readGitBlob(revision,rel){
        need(PATHS.includes(rel),'ER1_D30_PREVIEW_GIT_SCOPE_STOP');
        const checkout=revision===BASE?base:revision===TARGET?candidate:null;
        need(checkout,'ER1_D30_PREVIEW_GIT_REVISION_STOP');
        return git(gitExe,checkout,['show',`HEAD:${rel}`]);
      },
      async readWindowsFile(absolute){
        const expected=PATHS.map(rel=>path.win32.join(SOURCE_ROOT,...rel.split('/')));
        need(expected.includes(absolute),'ER1_D30_PREVIEW_PC_SCOPE_STOP');
        return safeFile(absolute,operating);
      },
      // Reuse this authenticated, already installed one-shot read-only route.
      // It inspects only the fixed operational source and never executes B.
      async inspectSourceProvenance(){
        const probeHost=createD30FeatureBReadOnlyHost({evidenceId:{
          issue:event.issue.number,requestId:trustedRequest.requestId}});
        const proof=await inspectD30WindowsBReadOnlyPreflight({host:probeHost});
        if(proof.status!=='READ_ONLY_B_PREFLIGHT_SOURCE_VERIFIED')
          return {preflightStatus:proof.status,preflightCode:proof.code,
            ...(proof.taskChainReason?{preflightReason:proof.taskChainReason}:{}),
            ...(proof.registeredConfigurationStatus?{
              registeredConfigurationStatus:proof.registeredConfigurationStatus,
              registeredBeforeSourceSha:proof.registeredBeforeSourceSha,
              registeredExactThreePreimages:proof.registeredExactThreePreimages,
              registeredTaskXmlMatchesHistoricB:proof.registeredTaskXmlMatchesHistoricB}:{}),
          };
        return {preflightStatus:proof.status,sourceRoot:SOURCE_ROOT,
          runtimeSourceVerified:false,
          evidenceLevel:'REGISTERED_CORE_SOURCE_PROVENANCE_VERIFIED',
          operationalSourceSha:proof.beforeSourceSha,gitVerified:true,
          taskLauncherSourceVerified:true,configSourceMatchesHead:true,
          writerCheckpointMatchesHead:proof.lastRunSourceStatus==='MATCH',
          lastRunSourceStatus:proof.lastRunSourceStatus,
          trackedDirty:proof.threeFileTrackedOverlayObserved,
          sourceTrackedDirtyScope:'PINNED_TARGET_3FILES',
          pinnedOverlayVerified:true,
          evidenceIssue:proof.preflightEvidenceIssue,
          evidenceRequestId:trustedRequest.requestId,
          sidecarSourceBinding:proof.sidecarSourceBinding};
      },
    };
    const report=await runD30WindowsReadOnlyPreview({host,gitExe,tempRoot:temp});
    need(Buffer.byteLength(JSON.stringify(report),'utf8')<32_768,
      'ER1_D30_PREVIEW_REPORT_SIZE_STOP');
    return report;
  }catch(e){
    const allowed=/^ER1_D30_[A-Z0-9_]+$/;
    return safeStop(allowed.test(e?.code??'')?e.code:'ER1_D30_PREVIEW_HOST_STOP');
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  runD30ReadOnlyWindowsHost().then(result=>{
    const line=JSON.stringify(result);
    if(Buffer.byteLength(line,'utf8')<32_768)process.stdout.write(line+'\n');
    else process.stdout.write(JSON.stringify({status:'READ_ONLY_PREVIEW_BLOCKED',
      code:'ER1_D30_PREVIEW_REPORT_SIZE_STOP',sourceWrites:0})+'\n');
    if(result.status!=='READ_ONLY_PREVIEW_VERIFIED')process.exitCode=1;
  }).catch(()=>{
    process.stdout.write(JSON.stringify({status:'READ_ONLY_PREVIEW_BLOCKED',
      code:'ER1_D30_PREVIEW_HOST_STOP',sourceWrites:0})+'\n');
    process.exitCode=1;
  });
}
