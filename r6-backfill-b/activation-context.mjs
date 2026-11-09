// Trusted-activation checkout validation for the future R6 B Windows host.
// SOURCE ONLY: this is a read-only proof, not permission to open SQLite,
// acquire a Core lock, contact a provider, publish or upload an artifact.
//
// Trust split avoids self-referential Git SHA pins:
//   H = previously reviewed R6 host control SHA (r6-control checkout)
//   S = approved R6 feature SHA (r6-source checkout)
//   M = raw immutable effect manifest SHA256 (activation checkout)
//   A = later reviewed *workflow activation* SHA from github.sha.
// The A checkout, NOT Issue text or env var pins, provides exact H/S/M.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateR6OneShotRequest,verifyR6OneShotApprovalBytes} from './contract.mjs';

const ACTIVATION_SCHEMA='ZGMINI_R6_B_WORKFLOW_APPROVAL_PINS_V1';
const PINS_NAME='r6-backfill-b/activation-pins.json';
const MANIFEST_NAME='r6-backfill-b/approved-effect-manifest.json';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');

function readRegular(io,file,maxBytes) {
  let stat,bytes;
  try {
    stat=io.lstatSync(file);
    if(stat.isSymbolicLink()||!stat.isFile()||stat.size<=0||stat.size>maxBytes)
      fail('R6_B_ACTIVATION_FILE_SHAPE_STOP');
    bytes=io.readFileSync(file);
  } catch(cause) {fail(cause?.code?.startsWith('R6_B_')?cause.code:'R6_B_ACTIVATION_FILE_UNAVAILABLE');}
  if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>maxBytes)
    fail('R6_B_ACTIVATION_FILE_READ_STOP');
  return bytes;
}

export function inspectR6ActivationCheckout({event,env,io=fs,gitInspect,
  platform=process.platform,fixture=false}={}) {
  // Refusing early protects even the read-only probes from forged Issue data.
  if(platform!=='win32'&&!fixture)fail('R6_B_WINDOWS_ONLY_STOP');
  if(env?.GITHUB_REPOSITORY!=='ansqhd5774-Choi/zgmini-pc-control'||
     env?.GITHUB_ACTOR!=='ansqhd5774-Choi'||env?.GITHUB_EVENT_NAME!=='issues'||
     env?.GITHUB_EVENT_ACTION!=='opened'||env?.GITHUB_RUN_ATTEMPT!=='1'||
     !SHA40.test(env?.GITHUB_SHA??'')||
     event?.repository?.private!==true||
     event?.repository?.full_name!==env.GITHUB_REPOSITORY||
     event?.sender?.login!=='ansqhd5774-Choi'||
     event?.issue?.user?.login!=='ansqhd5774-Choi'||
     event?.action!=='opened') fail('R6_B_ACTIVATION_EVENT_STOP');
  if(typeof env?.GITHUB_WORKSPACE!=='string'||!path.isAbsolute(env.GITHUB_WORKSPACE))
    fail('R6_B_WORKSPACE_UNVERIFIED');
  const activated=path.join(env.GITHUB_WORKSPACE,'r6-activation');
  let workspaceReal,activatedReal;
  try {
    if(!io.lstatSync(env.GITHUB_WORKSPACE).isDirectory()||
       !io.lstatSync(activated).isDirectory()||
       io.lstatSync(activated).isSymbolicLink())fail('R6_B_ACTIVATION_CHECKOUT_SHAPE_STOP');
    workspaceReal=io.realpathSync.native(env.GITHUB_WORKSPACE);
    activatedReal=io.realpathSync.native(activated);
  }catch(cause){fail(cause?.code?.startsWith('R6_B_')?cause.code:'R6_B_ACTIVATION_CHECKOUT_UNAVAILABLE');}
  const rel=path.relative(workspaceReal,activatedReal);
  if(rel!== 'r6-activation')fail('R6_B_ACTIVATION_CHECKOUT_ESCAPE_STOP');
  // The two approved files must also stay under a real directory within the
  // reviewed activation checkout. A leaf-only lstat would follow a symlink or
  // Windows directory junction named r6-backfill-b to arbitrary host files.
  const artifacts=path.join(activatedReal,'r6-backfill-b');
  let artifactsReal;
  try{
    const info=io.lstatSync(artifacts);
    if(!info.isDirectory()||info.isSymbolicLink())
      fail('R6_B_ACTIVATION_ARTIFACT_PARENT_SHAPE_STOP');
    artifactsReal=io.realpathSync.native(artifacts);
  }catch(cause){fail(cause?.code?.startsWith('R6_B_')?cause.code:
    'R6_B_ACTIVATION_ARTIFACT_PARENT_UNAVAILABLE');}
  if(path.relative(activatedReal,artifactsReal)!=='r6-backfill-b')
    fail('R6_B_ACTIVATION_ARTIFACT_PARENT_ESCAPE_STOP');
  if(typeof gitInspect!=='function')fail('R6_B_ACTIVATION_GIT_INSPECTOR_MISSING');
  const checked=gitInspect(activatedReal);
  if(!SHA40.test(checked?.head??'')||checked.head!==env.GITHUB_SHA||checked.dirty!==false)
    fail('R6_B_ACTIVATION_SHA_OR_DIRTY_STOP');

  const pinsBytes=readRegular(io,path.join(activatedReal,PINS_NAME),2048);
  let file;
  try{file=JSON.parse(Buffer.from(pinsBytes).toString('utf8'));}
  catch{fail('R6_B_ACTIVATION_PINS_JSON_STOP');}
  if(!file||typeof file!=='object'||Array.isArray(file)||
     Object.keys(file).sort().join('|')!==
       ['schema','controlSha','sourceSha','approvalManifestSha256'].sort().join('|')||
     file.schema!==ACTIVATION_SCHEMA||!SHA40.test(file.controlSha)||
     !SHA40.test(file.sourceSha)||!SHA64.test(file.approvalManifestSha256))
    fail('R6_B_ACTIVATION_PINS_CONTRACT_STOP');
  const pins={controlSha:file.controlSha,sourceSha:file.sourceSha,
    approvalManifestSha256:file.approvalManifestSha256};
  const manifestBytes=readRegular(io,path.join(activatedReal,MANIFEST_NAME),8192);
  if(sha256(manifestBytes)!==pins.approvalManifestSha256)
    fail('R6_B_ACTIVATION_MANIFEST_HASH_STOP');
  // Contract validates exact 18-field scope; Issue fields can only match
  // already independently pinned H/S/M, never widen them.
  const request=validateR6OneShotRequest(event,env,pins);
  const manifest=verifyR6OneShotApprovalBytes(manifestBytes,pins);
  return {schema:'ZGMINI_R6_B_ACTIVATION_PROOF_V1',
    status:'ACTIVATION_READONLY_VERIFIED_NOT_EXECUTABLE',requestId:request.requestId,
    pins,manifestBytes,manifest,activationSha:env.GITHUB_SHA,
    verifiedCheckoutRoot:activatedReal,executable:false};
}

// Git commands never use a shell, supply untrusted arguments or mutate refs.
function realGitInspect(root) {
  const head=execFileSync('git',['-C',root,'rev-parse','HEAD'],{
    encoding:'utf8',windowsHide:true,timeout:15000}).trim();
  const status=execFileSync('git',['-C',root,'status','--porcelain','--untracked-files=all'],{
    encoding:'utf8',windowsHide:true,timeout:15000});
  return {head,dirty:status.trim().length>0};
}

export function readR6BActivationFromTrustedWorkflow() {
  if(process.platform!=='win32')fail('R6_B_WINDOWS_ONLY_STOP');
  const eventPath=process.env.GITHUB_EVENT_PATH;
  if(typeof eventPath!=='string'||!path.isAbsolute(eventPath))
    fail('R6_B_GITHUB_EVENT_PATH_UNVERIFIED');
  let event;
  try{event=JSON.parse(fs.readFileSync(eventPath,'utf8'));}
  catch{fail('R6_B_GITHUB_EVENT_UNREADABLE');}
  return inspectR6ActivationCheckout({event,env:process.env,io:fs,
    gitInspect:realGitInspect,platform:process.platform});
}
