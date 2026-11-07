#!/usr/bin/env node
// Read-only approval lookup for a single owner-opened generic Writer B Issue.
// GitHub Actions consumes only the exact pinned candidate SHA emitted here.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {authorizeWriterBIssue} from './contract.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const SHA40=/^[a-f0-9]{40}$/i;
const APPROVAL_PATH=/^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const SAFE_STOP=/^WRITER_B_[A-Z0-9_]{1,100}$/;
const RUN_ID=/^\d{1,18}$/;

// A failed approval check still needs an exact, bounded remote error code.
// Store only the code under a run-scoped create-only TEMP path; never an
// untrusted event, manifest, credential, or raw exception message.
export function writePreflightStopEvidence({env,code,fsOps=fs}){
 const runId=env?.GITHUB_RUN_ID,runnerTemp=env?.RUNNER_TEMP;
 if(!RUN_ID.test(runId??'')||typeof runnerTemp!=='string'||
   !path.isAbsolute(runnerTemp))return false;
 const safeCode=SAFE_STOP.test(code??'')?code:
  'WRITER_B_APPROVAL_PREFLIGHT_UNEXPECTED_STOP';
 fsOps.writeFileSync(path.join(runnerTemp,`writer-b-preflight-stop-${runId}.json`),
  JSON.stringify({status:'WRITER_B_SETUP_STOP',code:safeCode,runId})+'\n',
  {encoding:'utf8',flag:'wx'});
 return true;
}

export function approvalPathFromIssue(event){
 let body;
 try{body=JSON.parse(event?.issue?.body);}catch{stop('WRITER_B_APPROVAL_REQUEST_JSON_STOP');}
 need(APPROVAL_PATH.test(body?.approvalManifestPath??''),
   'WRITER_B_APPROVAL_PATH_STOP');
 return body.approvalManifestPath;
}

export function verifyReadOnlyPreflight({event,env,manifestBytes,controlHead}){
 need(SHA40.test(controlHead??'')&&env?.GITHUB_SHA===controlHead,
   'WRITER_B_CONTROL_SOURCE_DRIFT_STOP');
 return authorizeWriterBIssue({event,env,manifestBytes});
}

function trustedManifestFile(controlRoot,relative){
 const approvedRoot=path.join(controlRoot,'approvals','writer-updates');
 const rootStat=fs.lstatSync(approvedRoot);
 need(rootStat.isDirectory()&&!rootStat.isSymbolicLink(),
   'WRITER_B_APPROVAL_DIRECTORY_SCOPE_STOP');
 const rootReal=fs.realpathSync.native(approvedRoot);
 const controlReal=fs.realpathSync.native(controlRoot).toLowerCase()+path.sep;
 need(rootReal.toLowerCase().startsWith(controlReal),
   'WRITER_B_APPROVAL_DIRECTORY_ESCAPE_STOP');
 const target=path.join(controlRoot,...relative.split('/'));
 const stat=fs.lstatSync(target);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>200&&stat.size<=65536&&
   fs.realpathSync.native(target).toLowerCase().startsWith(
     rootReal.toLowerCase()+path.sep),'WRITER_B_APPROVAL_FILE_SCOPE_STOP');
 return fs.readFileSync(target);
}

export function preflightWriterBFromWorkspace({env=process.env,readFile=fs.readFileSync,
  getControlHead,controlRoot,manifestReader=trustedManifestFile}={}){
 need(process.platform==='win32'&&typeof controlRoot==='string'&&
   controlRoot.length>0,'WRITER_B_WINDOWS_PREFLIGHT_HOST_STOP');
 const event=JSON.parse(readFile(env.GITHUB_EVENT_PATH,'utf8'));
 const relative=approvalPathFromIssue(event);
 const controlHead=getControlHead(controlRoot);
 const authorization=verifyReadOnlyPreflight({event,env,
   manifestBytes:manifestReader(controlRoot,relative),controlHead});
 return authorization;
}

function gitHead(checkout){
 const git=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(x=>fs.existsSync(x));
 need(typeof git==='string','WRITER_B_GIT_EXE_STOP');
 const result=spawnSync(git,['-C',checkout,'rev-parse','HEAD'],{
   encoding:'utf8',shell:false,windowsHide:true,timeout:15000});
 need(result.status===0&&SHA40.test(result.stdout.trim()),
   'WRITER_B_CONTROL_HEAD_READ_STOP');
 return result.stdout.trim();
}

async function main(){
 const env=process.env;
 const auth=preflightWriterBFromWorkspace({env,
   controlRoot:path.join(env.GITHUB_WORKSPACE??'','writer-b-control'),
   getControlHead:gitHead});
 need(typeof env.GITHUB_OUTPUT==='string'&&env.GITHUB_OUTPUT.length>0,
   'WRITER_B_GITHUB_OUTPUT_MISSING_STOP');
 fs.appendFileSync(env.GITHUB_OUTPUT,
   `candidateSourceSha=${auth.manifest.candidateSourceSha}\n`,{encoding:'utf8'});
 process.stdout.write('WRITER_B_APPROVAL_PREFLIGHT_VERIFIED\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}catch(error){
  const code=SAFE_STOP.test(error?.code??'')?error.code:
   'WRITER_B_APPROVAL_PREFLIGHT_UNEXPECTED_STOP';
  try{writePreflightStopEvidence({env:process.env,code});}catch{}
  process.stderr.write(code+'\n');
  process.exitCode=1;
 }
}
