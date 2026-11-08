#!/usr/bin/env node
// Fixed owner-only read-only Windows compatibility proof. No install hook.
// `--pin` and `--run` are literal workflow arguments, never Issue commands.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isApprovedConfiguredRuntime,verifyPinnedSourceCheckout}
  from './approval-contract.mjs';
import {runWindowsCrossVersionProof}
  from '../writer-b/approved-versioned-bundle/windows-cross-version-proof.mjs';
import {reportProofFromRunner} from './proof-only-report.mjs';

export const PROOF_RESULT='configured-runtime-proof-once-result.json';
export const PROOF_SCHEMA='ZGMINI_CONFIGURED_RUNTIME_WINDOWS_PROOF_RESULT_V1';
// V1 remains valid for historical #845 evidence. New runs include a real CLI
// entrypoint regression and use the extended V2 evidence contract.
export const PROOF_CLI_SCHEMA='ZGMINI_CONFIGURED_RUNTIME_WINDOWS_PROOF_RESULT_V2';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const USER='ansqhd5774-Choi';
const TITLE='pc-configured-runtime-proof';
const REQUEST_SCHEMA='ZGMINI_CONFIGURED_RUNTIME_PROOF_REQUEST_V1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const exact=(v,keys)=>v!==null&&typeof v==='object'&&
  !Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&
  Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const KEYS=['schema','requestId','chatId','operation',
  'controlRepository','approvalManifestSha256'];
const HOME='E:/ZGmini/data/pc-writer/theme-config-tool';
const DATA_ROOT='E:/ZGmini/data';
const MANUAL=['THEME_REGISTER.cmd','THEME_LIST.cmd','THEME_UPDATE.cmd'];
const SOURCE_REPO='ansqhd5774-Choi/zgmini';
const BUILDER='scripts/pc-writer/theme-config-package-build.mjs';
const INSPECTOR='scripts/pc-writer/theme-config-package-runner.mjs';

function fileBytes(file){
  const st=fs.lstatSync(file);
  need(st.isFile()&&!st.isSymbolicLink(),'PROOF_FILE_REDIRECT');
  return fs.readFileSync(file);
}
function git(root,args){
  const binary=[String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files\Git\bin\git.exe`]
    .find(p=>fs.existsSync(p));
  need(binary,'PROOF_GIT_UNAVAILABLE');
  const r=spawnSync(binary,['-C',root,...args],{shell:false,
    windowsHide:true,encoding:'buffer',timeout:15000,maxBuffer:300000});
  need(r.status===0&&Buffer.isBuffer(r.stdout),'PROOF_GIT_ORIGIN_STOP');
  return r.stdout;
}
const controlRoot=env=>path.join(env.GITHUB_WORKSPACE??'',
  'generic-b-control');
const sourceRoot=env=>path.join(env.GITHUB_WORKSPACE??'',
  'configured-feature-source');

export function verifyProofIssue(event,env){
  need(env?.GITHUB_REPOSITORY===REPO&&
    env.GITHUB_EVENT_NAME==='issues'&&
    env.GITHUB_EVENT_ACTION==='opened'&&
    env.GITHUB_ACTOR===USER&&env.GITHUB_RUN_ATTEMPT==='1'&&
    SHA40.test(env.GITHUB_SHA??'')&&
    /^[0-9]{1,18}$/.test(env.GITHUB_RUN_ID??'')&&
    event?.repository?.full_name===REPO&&
    event.repository.private===true&&
    event.sender?.login===USER&&event.issue?.user?.login===USER&&
    !event.issue.pull_request&&event.issue.title===TITLE&&
    Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'PROOF_OWNER_ISSUE_DENIED');
  let request;
  try{request=JSON.parse(event.issue.body);}catch{fail('PROOF_JSON_STOP');}
  need(exact(request,KEYS)&&request.schema===REQUEST_SCHEMA&&
    UUID.test(request.requestId??'')&&UUID.test(request.chatId??'')&&
    request.operation===TITLE&&request.controlRepository===REPO&&
    SHA64.test(request.approvalManifestSha256??''),
  'PROOF_REQUEST_SCOPE_STOP');
  return request;
}

export function loadProofApproval({event,env,root=controlRoot(env),
  head=(r)=>git(r,['rev-parse','HEAD']).toString('utf8').trim(),
  blob=(r,p)=>git(r,['show','HEAD:'+p]),
  read=fileBytes}={}){
  const request=verifyProofIssue(event,env);
  need(path.isAbsolute(root)&&head(root)===env.GITHUB_SHA,
    'PROOF_CONTROL_SHA_DRIFT');
  const relative='approvals/approved-runtime-b/'+
    request.approvalManifestSha256+'.json';
  const original=blob(root,relative),working=read(path.join(root,
    ...relative.split('/')));
  const same=original.equals(working)||!original.includes(13)&&
    working.equals(Buffer.from(original.toString('utf8')
      .replaceAll('\n','\r\n')));
  need(original.length>100&&original.length<8192&&same&&
    sha(original)===request.approvalManifestSha256,
  'PROOF_APPROVAL_ORIGIN_DRIFT');
  let manifest;
  try{manifest=JSON.parse(original.toString('utf8'));}
  catch{fail('PROOF_APPROVAL_JSON_STOP');}
  need(isApprovedConfiguredRuntime(manifest)&&
    manifest.sourceRepository===SOURCE_REPO&&
    manifest.runtimeMode==='REPEATABLE_ACTIVE_RUNTIME',
  'PROOF_APPROVAL_SCOPE_STOP');
  return Object.freeze({request,manifest,
    approvalSha256:request.approvalManifestSha256});
}

function readPreimage(){
  const active=fileBytes(path.join(HOME,'ACTIVE_RUNTIME.json'));
  const installed=fileBytes(path.join(HOME,'INSTALL_RESULT.json'));
  const manual=MANUAL.map(name=>[name,sha(fileBytes(path.join(HOME,name)))]);
  return {active,installedSha256:sha(installed),manual};
}

// Execute only the repository-pinned Node regression, NEVER the operational
// Writer B CLI directly. The test itself launches the real CLI import graph
// with mocked Git/Windows inputs and stops before any operational effect.
export function proveReadOnlyCliEntrypoint({env=process.env,
  platform=process.platform,runNode=spawnSync}={}){
  need(platform==='win32'&&typeof env.RUNNER_TEMP==='string'&&
    path.isAbsolute(env.RUNNER_TEMP)&&fs.existsSync(env.RUNNER_TEMP),
  'PROOF_CLI_TEMP_REQUIRED');
  const testFile=fileURLToPath(new URL('./approval-cycle.test.mjs',import.meta.url));
  const testSha256=sha(fileBytes(testFile));
  // Do not hand the child workflow tokens or provider credentials.
  const childEnv={PATH:env.PATH??process.env.PATH??'',
    SystemRoot:env.SystemRoot??process.env.SystemRoot??String.raw`C:\Windows`,
    TEMP:env.RUNNER_TEMP,TMP:env.RUNNER_TEMP,
    CYCLE_TEST_TEMP_BASE:env.RUNNER_TEMP};
  const child=runNode(process.execPath,['--test',testFile],{
    env:childEnv,encoding:'utf8',shell:false,windowsHide:true,
    timeout:15000,maxBuffer:65536});
  const exitCode=Number.isInteger(child?.status)&&child.status>=0&&
    child.status<=255?child.status:null;
  if(child?.error||child?.signal||exitCode!==0){
    const code=exitCode===13?'PROOF_CLI_UNSETTLED_AWAIT_STOP':
      'PROOF_CLI_ENTRYPOINT_STOP';
    throw Object.assign(Error(code),{code,nodeExitCode:exitCode});
  }
  return Object.freeze({status:'PASS',testSha256,childExitCode:0,
    fixtureRoot:'RUNNER_TEMP',operationWrites:0});
}

export async function proveWithoutInstall({auth,env=process.env,
  loadModule=(root,rel)=>import(pathToFileURL(path.join(root,
    ...rel.split('/'))).href),
  inspectProof=runWindowsCrossVersionProof,
  checkCli=proveReadOnlyCliEntrypoint}={}){
  need(process.platform==='win32'&&
    typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
  'PROOF_WINDOWS_TEMP_REQUIRED');
  const feature=sourceRoot(env);
  verifyPinnedSourceCheckout({manifest:auth.manifest},{sourceRoot:feature});
  const cliEntrypointProof=checkCli({env});
  need(cliEntrypointProof?.status==='PASS'&&
    SHA64.test(cliEntrypointProof.testSha256??'')&&
    cliEntrypointProof.childExitCode===0&&
    cliEntrypointProof.fixtureRoot==='RUNNER_TEMP'&&
    cliEntrypointProof.operationWrites===0,
  'PROOF_CLI_EVIDENCE_INVALID');
  const builder=await loadModule(feature,BUILDER);
  const inspector=await loadModule(feature,INSPECTOR);
  need(typeof builder.buildConfiguredPackage==='function'&&
    typeof inspector.inspectConfiguredPackage==='function',
  'PROOF_PINNED_MODULE_EXPORT_STOP');
  const output=fs.mkdtempSync(path.join(env.RUNNER_TEMP,
    'zgmini-readonly-proof-bundle-'));
  const built=builder.buildConfiguredPackage({
    sourceSha:auth.manifest.sourceSha,outputDir:output});
  need(built?.status==='PACKAGE_BUILT_NO_PC_WRITES'&&
    built.sourceSha===auth.manifest.sourceSha&&
    built.manifestSha256===auth.manifest.packageManifestSha256&&
    built.packageRoot.startsWith(output+path.sep),
  'PROOF_PACKAGE_PIN_DRIFT');
  const before=inspector.inspectConfiguredPackage({
    packageRoot:built.packageRoot,dataRoot:DATA_ROOT});
  const pre=readPreimage(),expected=auth.manifest.runtimePreimage;
  need(before.taskState===3&&
    before.sourceSha===auth.manifest.sourceSha&&
    before.oldCmdSha256===expected.scheduledCmdSha256&&
    before.oldVbsSha256===expected.scheduledVbsSha256&&
    before.taskXmlSha256===expected.taskXmlSha256&&
    sha(pre.active)===expected.activeRuntimeSha256,
  'PROOF_WINDOWS_PREIMAGE_DRIFT');
  const compatible=await inspectProof({
    approval:{sourceSha:auth.manifest.sourceSha},current:before,
    sourceRoot:feature,packageRoot:built.packageRoot,
    oldActiveBytes:pre.active,runnerTemp:env.RUNNER_TEMP});
  const after=inspector.inspectConfiguredPackage({
    packageRoot:built.packageRoot,dataRoot:DATA_ROOT});
  const post=readPreimage();
  need(after.oldVersion===before.oldVersion&&
    after.taskXmlSha256===before.taskXmlSha256&&
    after.oldCmdSha256===before.oldCmdSha256&&
    after.oldVbsSha256===before.oldVbsSha256&&
    sha(post.active)===sha(pre.active)&&
    post.installedSha256===pre.installedSha256&&
    JSON.stringify(post.manual)===JSON.stringify(pre.manual),
  'PROOF_POSTREAD_OPERATIONAL_DRIFT');
  need(compatible?.trustedRunnerVerified===true&&
    SHA64.test(compatible.evidenceSha256??'')&&
    compatible.oldVersion===before.oldVersion&&
    compatible.newSourceSha===auth.manifest.sourceSha,
  'PROOF_CROSS_VERSION_UNVERIFIED');
  return {schema:PROOF_CLI_SCHEMA,status:'PROOF_PASS',
    requestId:auth.request.requestId,sourceSha:auth.manifest.sourceSha,
    manifestSha256:auth.manifest.packageManifestSha256,
    approvalSha256:auth.approvalSha256,
    activeRuntimeSha256:sha(pre.active),taskXmlSha256:before.taskXmlSha256,
    evidenceSha256:compatible.evidenceSha256,
    transcript:compatible.transcript,cliEntrypointProof,operationWrites:0};
}

async function main(){
  const mode=process.argv[2];
  need(['--pin','--run','--report'].includes(mode)&&
    process.argv.length===3,'PROOF_FIXED_MODE_ONLY');
  if(mode==='--report'){
    return reportProofFromRunner();
  }
  need(process.platform==='win32','PROOF_WINDOWS_REQUIRED');
  const env=process.env;
  const event=JSON.parse(fileBytes(env.GITHUB_EVENT_PATH).toString('utf8'));
  const auth=loadProofApproval({event,env});
  if(mode==='--pin'){
    need(typeof env.GITHUB_OUTPUT==='string'&&
      path.isAbsolute(env.GITHUB_OUTPUT),'PROOF_OUTPUT_REQUIRED');
    fs.appendFileSync(env.GITHUB_OUTPUT,
      `sourceSha=${auth.manifest.sourceSha}\n`);
    return {status:'PROOF_PINNED_NO_OPERATION'};
  }
  let result;
  try{result=await proveWithoutInstall({auth,env});}
  catch(error){result={schema:PROOF_CLI_SCHEMA,status:'PROOF_BLOCKED',
    requestId:auth.request.requestId,sourceSha:auth.manifest.sourceSha,
    manifestSha256:auth.manifest.packageManifestSha256,
    approvalSha256:auth.approvalSha256,
    code:/^(?:B_|PACKAGE_|PROOF_)[A-Z0-9_]{3,100}$/.test(error?.code??'')?
      error.code:'PROOF_READONLY_RUN_STOP',
    cliNodeExitCode:Number.isInteger(error?.nodeExitCode)&&
      error.nodeExitCode>=0&&error.nodeExitCode<=255?
      error.nodeExitCode:null,operationWrites:0};}
  fs.writeFileSync(path.join(env.RUNNER_TEMP,PROOF_RESULT),
    JSON.stringify(result)+'\n',{flag:'wx'});
  if(result.status!=='PROOF_PASS')process.exitCode=1;
  return {status:result.status};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const r=await main();process.stdout.write(r.status+'\n');}
  catch(error){
    process.stderr.write(/^[A-Z0-9_]{3,120}$/.test(error?.code??'')?
      error.code+'\n':'PROOF_UNVERIFIED\n');
    process.exitCode=1;
  }
}
