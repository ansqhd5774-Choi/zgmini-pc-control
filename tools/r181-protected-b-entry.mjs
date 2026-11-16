#!/usr/bin/env node
// Exact R181 protected source B entry point, invoked only by the existing
// approved Writer B workflow with a separately merged B approval manifest.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {authorizeR181ProtectedB,runApprovedR181ProtectedB} from './r181-protected-b-transaction.mjs';
import {createR181ProtectedWindowsIo} from './r181-protected-b-windows-io.mjs';

const RESULT='r181-protected-b-result.json';
const PINNED_CODE_FILES=[
  'tools/r181-pinned-route-candidate.mjs',
  'tools/r181-protected-b-transaction.mjs',
  'tools/r181-protected-b-windows-io.mjs',
  'tools/r181-protected-b-entry.mjs',
  'tools/r181-protected-b-report.mjs',
  'r17-writer-b/r17-b-claim.mjs',
  '.github/workflows/pc-writer-b-source-once.yml',
];
const MANIFEST_PATH=/^approvals\/r181-protected-b\/r181-[a-z0-9-]{4,70}\.json$/;
const GIT_HEAD=/^[0-9a-f]{40}$/i;
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const code=e=>/^R181_(?:B_)?[A-Z0-9_]{3,100}$/.test(e?.code??'')?
  e.code:'R181_B_SETUP_UNEXPECTED_STOP';

function gitExecutable(){
  const exe=['C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe'].find(f=>fs.existsSync(f));
  need(!!exe,'R181_B_GIT_UNAVAILABLE_STOP');
  return exe;
}
function gitCall(controlRoot,args){
  const p=spawnSync(gitExecutable(),['-C',controlRoot,...args],
    {encoding:'utf8',shell:false,windowsHide:true,timeout:15000});
  return p;
}
function gitHead(controlRoot){
  const p=gitCall(controlRoot,['rev-parse','HEAD']);
  need(p.status===0&&GIT_HEAD.test(p.stdout.trim()),
    'R181_B_GIT_HEAD_STOP');
  return p.stdout.trim();
}
function verifyReviewedCode(root,approvedCodeSha){
  need(GIT_HEAD.test(approvedCodeSha??''),
    'R181_B_REVIEWED_CODE_PIN_STOP');
  need(gitCall(root,['merge-base','--is-ancestor',approvedCodeSha,'HEAD']).status===0,
    'R181_B_REVIEWED_CODE_NOT_ANCESTOR_STOP');
  // Immutable code base can precede a later merged approval file without
  // pinning the manifest to its own (impossible to precompute) commit SHA.
  need(gitCall(root,['diff','--quiet',approvedCodeSha,'HEAD','--',
      ...PINNED_CODE_FILES]).status===0,
    'R181_B_REVIEWED_CODE_CHANGED_STOP');
  need(gitCall(root,['diff','--quiet','HEAD','--',
      ...PINNED_CODE_FILES]).status===0,
    'R181_B_WORKTREE_CODE_CHANGED_STOP');
}
function manifestFromExactCheckout(root,relative){
  need(MANIFEST_PATH.test(relative),'R181_B_MANIFEST_PATH_STOP');
  need(gitCall(root,['ls-files','--error-unmatch','--',relative]).status===0,
    'R181_B_MANIFEST_NOT_COMMITTED_STOP');
  need(gitCall(root,['diff','--quiet','HEAD','--',relative]).status===0,
    'R181_B_MANIFEST_WORKTREE_CHANGED_STOP');
  const parent=path.join(root,'approvals','r181-protected-b');
  const file=path.join(root,...relative.split('/'));
  const parentStat=fs.lstatSync(parent),fileStat=fs.lstatSync(file);
  need(parentStat.isDirectory()&&!parentStat.isSymbolicLink()&&
    fileStat.isFile()&&!fileStat.isSymbolicLink()&&
    fileStat.size>=200&&fileStat.size<=4096,
    'R181_B_MANIFEST_FILE_STOP');
  need(fs.realpathSync.native(file).toLowerCase().startsWith(
    fs.realpathSync.native(parent).toLowerCase()+path.sep),
    'R181_B_MANIFEST_REDIRECT_STOP');
  return fs.readFileSync(file);
}
export async function runR181ApprovedEntry({event,env,controlRoot,
  head=gitHead,manifestReader=manifestFromExactCheckout,
  reviewedCode=verifyReviewedCode,
  makeWindowsIo=createR181ProtectedWindowsIo}={}){
  need(process.platform==='win32','R181_B_WINDOWS_ONLY_STOP');
  need(typeof controlRoot==='string'&&path.isAbsolute(controlRoot),
    'R181_B_CONTROL_CHECKOUT_STOP');
  need(head(controlRoot)===env?.GITHUB_SHA,'R181_B_CONTROL_HEAD_DRIFT_STOP');
  let request;
  try{request=JSON.parse(event?.issue?.body);}catch{
    stop('R181_B_REQUEST_JSON_DENIED');
  }
  need(MANIFEST_PATH.test(request?.approvalManifestPath??''),
    'R181_B_MANIFEST_PATH_STOP');
  const raw=manifestReader(controlRoot,request.approvalManifestPath);
  const proof=authorizeR181ProtectedB({event,env,manifestBytes:raw});
  reviewedCode(controlRoot,proof.approvedCodeSha);
  return {...await runApprovedR181ProtectedB(proof,makeWindowsIo()),
    requestId:proof.request.requestId,controlSha:proof.sourceSha,
    manifestSha256:proof.manifestSha256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let outcome;
  try{
    const env=process.env;
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    outcome=await runR181ApprovedEntry({event,env,
      controlRoot:path.join(env.GITHUB_WORKSPACE??'','writer-b-control')});
  }catch(error){
    outcome={status:'R181_B_SETUP_STOP',code:code(error),
      requestId:null,applied:false};
  }
  try{
    const temp=process.env.RUNNER_TEMP;
    need(typeof temp==='string'&&path.isAbsolute(temp),
      'R181_B_RESULT_TEMP_STOP');
    fs.writeFileSync(path.join(temp,RESULT),JSON.stringify(outcome)+'\n',
      {flag:'wx',encoding:'utf8'});
  }catch{process.exitCode=1;}
  process.stdout.write(outcome.status+' '+outcome.code+'\n');
  if(outcome.status!=='R181_B_APPLIED_VERIFIED')process.exitCode=1;
}
