#!/usr/bin/env node
// Approved, private-only B one-shot. Never a pc-job operation or generic shell.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const SOURCE_SHA='7e29fd7a4035951006b2515bb1f0561942704b60';
export const REQUEST_TITLE='pc-ai-software-v2-register-approved-once';
export const REQUEST_SCOPE='AI_SOFTWARE_V2_PRIVATE_REGISTER_ONCE';
export const REQUEST_SCHEMA='ZGMINI_AI_SOFTWARE_V2_REGISTER_REQUEST_V1';
export const FILES=Object.freeze({
 'config/theme-ai-software-v2.json':'a09f5e65c4aa74d2bd79730d558c40df286651b6e2a41a1d5fb1a5c56d6c192d',
 'theme-evidence/ai-software-selection.json':'362d0766b7049970b8dc8eb13dba8579096efbe0f8fcb66b25477b0260a49aa0',
 'theme-evidence/ai-software-aum.json':'0eaf631b3c2d629bbf24650c81075b767619385f45431b146ce5d4e6f496f701',
});
export const DATA_ROOT=String.raw`E:\ZGmini\data`;
export const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
export const LEDGER=String.raw`E:\ZGmini\automation\ai-software-v2-registration`;
export const RESERVATION='results/ai-software-v2-register-once-reservation.json';
const EXPECTED_LOGIN='ansqhd5774-Choi';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const REQUEST_ID=/^pc-ai-software-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH_FILE_KEYS=Object.keys(FILES);
const approvalField={
  'config/theme-ai-software-v2.json':'definitionSha256',
  'theme-evidence/ai-software-selection.json':'selectionSha256',
  'theme-evidence/ai-software-aum.json':'aumSha256',
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{const e=new Error(code);e.code=code;throw e};
const requireCheck=(condition,code)=>{if(!condition)fail(code)};
const safeCode=e=>/^AI_V2_[A-Z0-9_]{1,80}$/.test(String(e?.code??''))?e.code:'AI_V2_UNEXPECTED_ERROR';
const sameLogin=login=>String(login??'').toLowerCase()===EXPECTED_LOGIN.toLowerCase();

export function validateRequest(event,env){
 requireCheck(event?.action==='opened'&&event?.repository?.private===true&&
  event?.repository?.full_name===CONTROL_REPO&&env?.GITHUB_REPOSITORY===CONTROL_REPO&&
  sameLogin(event?.sender?.login)&&sameLogin(event?.issue?.user?.login)&&
  event?.issue?.title===REQUEST_TITLE&&Number.isSafeInteger(event?.issue?.number)&&
  event.issue.number>0,'AI_V2_ISSUE_OR_ACTOR_DENIED');
 let request;
 try{request=JSON.parse(event.issue.body)}catch{fail('AI_V2_REQUEST_JSON_DENIED')}
 requireCheck(request&&typeof request==='object'&&!Array.isArray(request)&&
  Object.keys(request).length===7&&
  ['schema','requestId','scope','sourceSha',...Object.values(approvalField)]
   .every(key=>Object.hasOwn(request,key)),'AI_V2_REQUEST_FIELDS_DENIED');
 requireCheck(request.schema===REQUEST_SCHEMA&&REQUEST_ID.test(request.requestId)&&
  request.scope===REQUEST_SCOPE&&request.sourceSha===SOURCE_SHA&&
  HASH_FILE_KEYS.every(file=>request[approvalField[file]]===FILES[file]),
  'AI_V2_REQUEST_SCOPE_OR_HASH_DENIED');
 return request;
}

function requireFile(file,{maxBytes=2_000_000}={}){
 const stat=fs.lstatSync(file);
 requireCheck(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=maxBytes,
  'AI_V2_FILE_SHAPE_DENIED');
 return fs.readFileSync(file);
}
function requireDirectory(dir){
 const stat=fs.lstatSync(dir);
 requireCheck(stat.isDirectory()&&!stat.isSymbolicLink(),'AI_V2_DIRECTORY_REDIRECT');
 const real=fs.realpathSync.native(dir);
 requireCheck(path.win32.normalize(real).toLowerCase()===path.win32.normalize(dir).toLowerCase(),
  'AI_V2_DIRECTORY_REALPATH_MISMATCH');
 return dir;
}
function ensureOwnDirectory(base,relative){
 requireDirectory(base);
 let dir=base;
 for(const part of relative.split('/')){
  requireCheck(/^[a-zA-Z0-9_.-]+$/.test(part)&&part!=='.'&&part!=='..',
   'AI_V2_DIRECTORY_NAME_DENIED');
  dir=path.join(dir,part);
  if(!fs.existsSync(dir))fs.mkdirSync(dir);
  requireDirectory(dir);
 }
 return dir;
}
function gitBinary(){
 const candidates=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files (x86)\Git\cmd\git.exe`];
 const executable=candidates.find(file=>fs.existsSync(file));
 requireCheck(Boolean(executable),'AI_V2_GIT_UNAVAILABLE');
 return executable;
}
function gitValue(git,folder,args){
 return execFileSync(git,['-c','core.fsmonitor=false','-C',folder,...args],{
  encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:8192}).trim();
}
// Installed bundles are dependency closures; do not assume a fixed folder list,
// module count, or extension. Enforce containment and every installed byte hash.
export function validatedManifestEntries(manifest){
 requireCheck(manifest&&typeof manifest==='object'&&!Array.isArray(manifest),
  'AI_V2_INSTALL_MANIFEST_INVALID');
 const entries=Object.entries(manifest);
 requireCheck(entries.length>=3&&entries.length<=300&&entries.every(([relative,sha])=>
  typeof relative==='string'&&relative.length<=220&&
  /^[a-zA-Z0-9][a-zA-Z0-9/_.-]+$/.test(relative)&&
  !relative.split('/').some(p=>!p||p==='.'||p==='..')&&SHA64.test(sha)),
  'AI_V2_INSTALLED_FILE_LIST_DENIED');
 return entries;
}
export function inspectInstalledCapability(cliText,registryText){
 return {cliRegisterMarker:cliText.includes("mode==='--register'"),
  registryV2Marker:registryText.includes('ZGMINI_THEME_CONFIG_V2')};
}
// The immutable INSTALL_RESULT can describe the original V1 bundle while
// THEME_SCHEDULED.cmd has already been switched to a staged V2 bundle.
// Diagnostic only: do not execute an unmanifested active candidate.
export function inspectScheduledLauncher(script,home,taskXml,vbsText){
 const matches=[...script.matchAll(/versions\\([a-f0-9]{16})\\scripts\\pc-writer\\theme-config-tool\.mjs/g)];
 if(matches.length!==1)return {activeRuntimeProbe:'LAUNCHER_PATH_UNRECOGNIZED'};
 const version=matches[0][1];
 const runner=path.win32.join(home,'versions',version,'scripts','pc-writer','theme-config-tool.mjs');
 const expected=`"E:\\ZGmini\\runtime\\node.exe" "${runner}" --scheduled >>"${path.win32.join(home,'SCHEDULE_HISTORY.log')}" 2>&1`;
 const commandMatch=script.split(/\r?\n/).includes(expected);
 const taskMatches=typeof taskXml==='string'&&taskXml.includes(path.win32.join(home,'THEME_SCHEDULED.vbs'));
 const vbsMatches=typeof vbsText==='string'&&vbsText.includes(path.win32.join(home,'THEME_SCHEDULED.cmd'));
 return {activeRuntimeProbe:commandMatch&&taskMatches&&vbsMatches?'LINKED':'LINKAGE_UNVERIFIED',
  activeToolVersion:version,activeCommandMatches:commandMatch,activeTaskMatches:taskMatches,activeVbsMatches:vbsMatches};
}
function readActiveConfiguredDiagnostic(home){
 try{
  const cmd=fs.readFileSync(path.join(home,'THEME_SCHEDULED.cmd'),'utf8');
  const vbs=fs.readFileSync(path.join(home,'THEME_SCHEDULED.vbs'),'utf8');
  const xml=execFileSync('schtasks.exe',['/Query','/TN','ZGMINI-PC-Configured-Themes','/XML'],
   {encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
  const active=inspectScheduledLauncher(cmd,home,xml,vbs);
  if(active.activeRuntimeProbe!=='LINKED')return active;
  const versionRoot=requireDirectory(path.join(home,'versions',active.activeToolVersion));
  const cli=requireFile(path.join(versionRoot,'scripts','pc-writer','theme-config-tool.mjs'),{maxBytes:2_000_000});
  const registry=requireFile(path.join(versionRoot,'scripts','pc-writer','theme-config-registry.mjs'),{maxBytes:2_000_000});
  const flags=inspectInstalledCapability(cli.toString('utf8'),registry.toString('utf8'));
  return {...active,activeCliRegisterMarker:flags.cliRegisterMarker,
   activeRegistryV2Marker:flags.registryV2Marker,
   activeCliSha256:hash(cli),activeRegistrySha256:hash(registry)};
 }catch{return {activeRuntimeProbe:'READ_ONLY_PROBE_UNAVAILABLE'};}
}
function assertCheckout({workspace,env}){
 requireCheck(process.platform==='win32'&&typeof workspace==='string'&&
  path.win32.isAbsolute(workspace)&&SHA40.test(env?.GITHUB_SHA??''),
  'AI_V2_WINDOWS_OR_WORKSPACE_DENIED');
 const ctrl=requireDirectory(path.join(workspace,'ai-v2-control'));
 const source=requireDirectory(path.join(workspace,'ai-v2-source'));
 const realWorkspace=fs.realpathSync.native(workspace).toLowerCase()+path.sep;
 requireCheck([ctrl,source].every(dir=>fs.realpathSync.native(dir).toLowerCase().startsWith(realWorkspace)),
  'AI_V2_CHECKOUT_ESCAPE_DENIED');
 const git=gitBinary();
 requireCheck(gitValue(git,ctrl,['rev-parse','HEAD'])===env.GITHUB_SHA&&
  gitValue(git,source,['rev-parse','HEAD'])===SOURCE_SHA&&
  !gitValue(git,ctrl,['status','--porcelain','--untracked-files=no'])&&
  !gitValue(git,source,['status','--porcelain','--untracked-files=no']),
  'AI_V2_CHECKOUT_SHA_OR_DIRTY_DENIED');
 return source;
}

export function checkedSourceFiles(source){
 const out={};
 for(const relative of HASH_FILE_KEYS){
  const file=path.join(source,...relative.split('/'));
  const bytes=requireFile(file,{maxBytes:100_000});
  requireCheck(hash(bytes)===FILES[relative],'AI_V2_APPROVED_SOURCE_SHA_MISMATCH');
  out[relative]=bytes;
 }
 const definition=JSON.parse(out['config/theme-ai-software-v2.json'].toString('utf8'));
 requireCheck(definition.schema==='ZGMINI_THEME_CONFIG_V2'&&definition.id==='ai-software'&&
  definition.label==='AI 소프트웨어'&&definition.profile===
  'ETF_ONLY_T40_R20_V40_ADAPTIVE_R2_DATED_ISSUER_AUM_R32'&&
  JSON.stringify(definition.etfs)===JSON.stringify(['WISE','IGV','XSW','AIQ'])&&
  definition.selectionEvidence?.sha256===FILES['theme-evidence/ai-software-selection.json']&&
  definition.aumEvidence?.sha256===FILES['theme-evidence/ai-software-aum.json'],
  'AI_V2_DEFINITION_IDENTITY_DENIED');
 return {out,definition};
}

function installedCommonTool(){
 const home=path.join(DATA_ROOT,'pc-writer','theme-config-tool');
 requireDirectory(home);
 const install=JSON.parse(requireFile(path.join(home,'INSTALL_RESULT.json'),{maxBytes:100_000}).toString('utf8'));
 requireCheck(install?.status==='CONFIG_TOOL_INSTALLED'&&/^[a-f0-9]{16}$/.test(install.version??'')&&
  SHA40.test(install.sourceSha??'')&&
  path.win32.normalize(install.home??'').toLowerCase()===path.win32.normalize(home).toLowerCase()&&
  install.manifest&&typeof install.manifest==='object','AI_V2_INSTALL_MANIFEST_INVALID');
 const root=requireDirectory(path.join(home,'versions',install.version));
 const entries=validatedManifestEntries(install.manifest);
 for(const [relative,sha] of entries){
  const file=path.resolve(root,...relative.split('/'));
  requireCheck(file.toLowerCase().startsWith(root.toLowerCase()+path.sep),
   'AI_V2_INSTALLED_PATH_ESCAPE');
  requireCheck(fs.realpathSync.native(file).toLowerCase().startsWith(root.toLowerCase()+path.sep),
   'AI_V2_INSTALLED_REALPATH_ESCAPE');
  requireCheck(hash(requireFile(file,{maxBytes:2_000_000}))===sha,'AI_V2_INSTALLED_FILE_HASH_MISMATCH');
 }
 const cliRelative='scripts/pc-writer/theme-config-tool.mjs';
 const registryRelative='scripts/pc-writer/theme-config-registry.mjs';
 requireCheck(entries.some(([r])=>r===cliRelative)&&entries.some(([r])=>r===registryRelative),
  'AI_V2_COMMON_REGISTER_TOOL_MISSING');
 const cli=path.join(root,...cliRelative.split('/'));
 const flags=inspectInstalledCapability(fs.readFileSync(cli,'utf8'),
  fs.readFileSync(path.join(root,...registryRelative.split('/')),'utf8'));
 if(!flags.cliRegisterMarker||!flags.registryV2Marker){
  const err=new Error('AI_V2_COMMON_V2_CAPABILITY_MISSING');
  err.code='AI_V2_COMMON_V2_CAPABILITY_MISSING';
  err.diagnostic={installedToolSourceSha:install.sourceSha,
   installedToolVersion:install.version,
   cliManifestSha256:install.manifest[cliRelative],
   registryManifestSha256:install.manifest[registryRelative],...flags,
   ...readActiveConfiguredDiagnostic(home)};
  throw err;
 }
 requireFile(NODE,{maxBytes:200_000_000});
 return {cli,installSourceSha:install.sourceSha,version:install.version};
}
function existingFileMatches(file,bytes){
 if(!fs.existsSync(file))return false;
 requireCheck(hash(requireFile(file,{maxBytes:100_000}))===hash(bytes),
  'AI_V2_EXISTING_CONTENT_CONFLICT');
 return true;
}
function preflightTargets(inputs){
 requireDirectory(DATA_ROOT);
 const selection=path.join(DATA_ROOT,'theme-evidence','ai-software-selection.json');
 const aum=path.join(DATA_ROOT,'theme-evidence','ai-software-aum.json');
 const directory=path.join(DATA_ROOT,'theme-evidence');
 if(fs.existsSync(directory))requireDirectory(directory);
 const defsDir=path.join(DATA_ROOT,'theme-config','definitions');
 if(fs.existsSync(path.join(DATA_ROOT,'theme-config')))requireDirectory(path.join(DATA_ROOT,'theme-config'));
 if(fs.existsSync(defsDir))requireDirectory(defsDir);
 const definitionDest=path.join(defsDir,'ai-software.json');
 const canonical=Buffer.from(JSON.stringify(inputs.definition,null,2)+'\n');
 const existing={
  selection:existingFileMatches(selection,inputs.out['theme-evidence/ai-software-selection.json']),
  aum:existingFileMatches(aum,inputs.out['theme-evidence/ai-software-aum.json']),
  registered:existingFileMatches(definitionDest,canonical),
 };
 return {selection,aum,definitionDest,canonical,existing};
}

function sanitizedChildEnv(env){
 const keys=['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec','TEMP','TMP','APPDATA','LOCALAPPDATA'];
 return {...Object.fromEntries(keys.filter(k=>typeof env[k]==='string').map(k=>[k,env[k]])),
  ZGMINI_DATA_ROOT:DATA_ROOT};
}
async function githubCreateOnly(relative,body,env){
 requireCheck(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>20,
  'AI_V2_GITHUB_RESERVATION_AUTH_MISSING');
 let response;
 try{response=await fetch(`https://api.github.com/repos/${CONTROL_REPO}/contents/${relative}`,{
  method:'PUT',headers:{accept:'application/vnd.github+json',
   authorization:`Bearer ${env.GITHUB_TOKEN}`,'x-github-api-version':'2022-11-28',
   'content-type':'application/json','user-agent':'zgmini-ai-software-register-once'},
  body:JSON.stringify({message:'chore(ai-software): record approved one-shot',
   content:Buffer.from(body).toString('base64')})})}
 catch{fail('AI_V2_GITHUB_CREATE_STATE_UNKNOWN')}
 if(response.status===201)return true;
 if(response.status===409||response.status===422)fail('AI_V2_ONESHOT_ALREADY_RESERVED');
 fail('AI_V2_GITHUB_CREATE_NOT_VERIFIED');
}
const resultPath=requestId=>path.join(LEDGER,'results',requestId+'.json');
function resultStatus(status,code,request,extra={}){
 return {schema:'ZGMINI_AI_SOFTWARE_V2_PRIVATE_REGISTER_RESULT_V1',requestId:request?.requestId??null,
  status,code,sourceSha:SOURCE_SHA,definitionSha256:FILES['config/theme-ai-software-v2.json'],
  selectionSha256:FILES['theme-evidence/ai-software-selection.json'],
  aumSha256:FILES['theme-evidence/ai-software-aum.json'],
  providerCalls:0,d1Writes:0,schedulerWrites:0,publicWrites:0,
  registered:status==='PASS',...extra};
}
async function execute(event,env){
 const request=validateRequest(event,env);
 let begun=false;
 try{
  const source=assertCheckout({workspace:env.GITHUB_WORKSPACE,env});
  const inputs=checkedSourceFiles(source);
  const tool=installedCommonTool();
  const targets=preflightTargets(inputs);
  const approval={schema:'ZGMINI_AI_SOFTWARE_V2_REGISTER_APPROVAL_V1',
   requestId:request.requestId,issueNumber:event.issue.number,
   scope:REQUEST_SCOPE,sourceSha:SOURCE_SHA,
   approvedFiles:FILES,state:'EXECUTION_STARTED_NO_AUTO_RETRY'};
  // Cross-runner create-only reservation before ANY operational file write.
  await githubCreateOnly(RESERVATION,JSON.stringify(approval)+'\n',env);
  begun=true;
  const receiptHome=ensureOwnDirectory(String.raw`E:\ZGmini\automation`,'ai-software-v2-registration');
  ensureOwnDirectory(receiptHome,'results');
  const marker=path.join(receiptHome,'ATTEMPT_STARTED.json');
  fs.writeFileSync(marker,JSON.stringify({requestId:request.requestId,
   issueNumber:event.issue.number,sourceSha:SOURCE_SHA,at:new Date().toISOString()})+'\n',{flag:'wx'});
  const evidenceDir=ensureOwnDirectory(DATA_ROOT,'theme-evidence');
  for(const [name,bytes] of [
   ['ai-software-selection.json',inputs.out['theme-evidence/ai-software-selection.json']],
   ['ai-software-aum.json',inputs.out['theme-evidence/ai-software-aum.json']]]){
   const file=path.join(evidenceDir,name);
   if(!fs.existsSync(file))fs.writeFileSync(file,bytes,{flag:'wx'});
   requireCheck(hash(requireFile(file,{maxBytes:100_000}))===hash(bytes),
    'AI_V2_EVIDENCE_READBACK_FAILED');
  }
  let registration='ALREADY_REGISTERED_VERIFIED_NO_CLI';
  if(!targets.existing.registered){
   // Invoke ONLY the existing installed common register command, once.
   const invocation=spawnSync(NODE,[tool.cli,'--register',
    path.join(source,'config','theme-ai-software-v2.json')],{
    shell:false,windowsHide:true,encoding:'utf8',timeout:90_000,maxBuffer:16384,
    env:sanitizedChildEnv(env),cwd:DATA_ROOT});
   requireCheck(invocation.status===0&&!invocation.error,'AI_V2_COMMON_REGISTER_EXECUTION_FAILED');
   let cliResult;
   try{cliResult=JSON.parse(invocation.stdout)}catch{fail('AI_V2_COMMON_REGISTER_OUTPUT_INVALID')}
   requireCheck(cliResult?.status==='REGISTERED_PRIVATE_ONLY'&&cliResult.id==='ai-software',
    'AI_V2_COMMON_REGISTER_STATUS_UNEXPECTED');
   registration=cliResult.status;
  }
  requireCheck(hash(requireFile(targets.definitionDest,{maxBytes:8192}))===hash(targets.canonical),
   'AI_V2_DEFINITION_READBACK_FAILED');
  return resultStatus('PASS','AI_V2_PRIVATE_REGISTRATION_VERIFIED',request,{
   registrationStatus:registration,installedToolSourceSha:tool.installSourceSha,
   installedToolVersion:tool.version,registered:true});
 }catch(e){return resultStatus(begun?'STATE_UNKNOWN':'BLOCKED',safeCode(e),request,
   {registered:'UNKNOWN',requiresInspection:begun,...(e?.diagnostic??{})})}
}

async function writeLocalResult(report){
 try{
  const parent=ensureOwnDirectory(String.raw`E:\ZGmini\automation`,'ai-software-v2-registration');
  ensureOwnDirectory(parent,'results');
  fs.writeFileSync(resultPath(report.requestId),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 }catch{process.stderr.write('AI_V2_RESULT_LOCAL_WRITE_FAILED\n');process.exitCode=1}
}

async function uploadReport(event,env){
 const request=validateRequest(event,env);
 let report;
 try{report=JSON.parse(fs.readFileSync(resultPath(request.requestId),'utf8'))}catch{}
 if(report?.requestId!==request.requestId||!['PASS','BLOCKED','STATE_UNKNOWN'].includes(report?.status)||
  !/^AI_V2_[A-Z0-9_]+$/.test(report?.code??'')){
  report=resultStatus('STATE_UNKNOWN','AI_V2_RESULT_MISSING_OR_INVALID',request,{registered:'UNKNOWN'});
 }
 const safe={schema:report.schema,requestId:request.requestId,status:report.status,code:report.code,
  sourceSha:SOURCE_SHA,definitionSha256:FILES['config/theme-ai-software-v2.json'],
  registrationStatus:/^[A-Z_]+$/.test(report.registrationStatus??'')?report.registrationStatus:null,
  installedToolSourceSha:SHA40.test(report.installedToolSourceSha??'')?report.installedToolSourceSha:null,
  installedToolVersion:/^[a-f0-9]{16}$/.test(report.installedToolVersion??'')?report.installedToolVersion:null,
  cliManifestSha256:SHA64.test(report.cliManifestSha256??'')?report.cliManifestSha256:null,
  registryManifestSha256:SHA64.test(report.registryManifestSha256??'')?report.registryManifestSha256:null,
  cliRegisterMarker:typeof report.cliRegisterMarker==='boolean'?report.cliRegisterMarker:null,
  registryV2Marker:typeof report.registryV2Marker==='boolean'?report.registryV2Marker:null,
  activeRuntimeProbe:/^(LINKED|LINKAGE_UNVERIFIED|LAUNCHER_PATH_UNRECOGNIZED|READ_ONLY_PROBE_UNAVAILABLE)$/.test(report.activeRuntimeProbe??'')?report.activeRuntimeProbe:null,
  activeToolVersion:/^[a-f0-9]{16}$/.test(report.activeToolVersion??'')?report.activeToolVersion:null,
  activeCommandMatches:typeof report.activeCommandMatches==='boolean'?report.activeCommandMatches:null,
  activeTaskMatches:typeof report.activeTaskMatches==='boolean'?report.activeTaskMatches:null,
  activeVbsMatches:typeof report.activeVbsMatches==='boolean'?report.activeVbsMatches:null,
  activeCliRegisterMarker:typeof report.activeCliRegisterMarker==='boolean'?report.activeCliRegisterMarker:null,
  activeRegistryV2Marker:typeof report.activeRegistryV2Marker==='boolean'?report.activeRegistryV2Marker:null,
  activeCliSha256:SHA64.test(report.activeCliSha256??'')?report.activeCliSha256:null,
  activeRegistrySha256:SHA64.test(report.activeRegistrySha256??'')?report.activeRegistrySha256:null,
  providerCalls:0,d1Writes:0,schedulerWrites:0,publicWrites:0,
  registered:report.status==='PASS',next:report.status==='PASS'?'PRIVATE_PLAN_AND_STORED_CYCLE':
   'INSPECT_PC_REGISTRATION_BEFORE_ANY_RETRY'};
 const json=JSON.stringify(safe,null,2)+'\n';
 const txt=`REQUEST_ID=${safe.requestId}\nSTATUS=${safe.status}\nCODE=${safe.code}\n`+
  `REGISTRATION=${safe.registrationStatus??'UNKNOWN'}\nPROVIDER_CALLS=0\nD1_WRITES=0\n`+
  `SCHEDULER_WRITES=0\nNEXT=${safe.next}\n`;
 const token=env.GITHUB_TOKEN;
 requireCheck(typeof token==='string'&&token.length>20,'AI_V2_REPORT_AUTH_MISSING');
 let uploads=0;
 for(const [file,bytes] of [
  [`results/ai-software-v2-${request.requestId}.json`,json],
  [`results/ai-software-v2-${request.requestId}.txt`,txt]]){
   try{await githubCreateOnly(file,bytes,env);uploads++}catch{/* Issue comment is the fallback. */}
 }
 const url=`https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`;
 const response=await fetch(url,{method:'POST',headers:{accept:'application/vnd.github+json',
  authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28',
  'content-type':'application/json','user-agent':'zgmini-ai-software-register-once'},
  body:JSON.stringify({body:`AI 소프트웨어 V2 비공개 등록: **${safe.status}** (${safe.code})\n`+
   `검증 결과 파일: ${uploads}/2\n\n\`\`\`json\n${json.trim()}\n\`\`\``})});
 requireCheck(response.ok,'AI_V2_ISSUE_RESULT_COMMENT_FAILED');
 process.stdout.write(`AI_V2_REPORT=${safe.status} UPLOADED=${uploads}/2\n`);
}

async function main(){
 let event;
 try{
  requireCheck(process.platform==='win32'&&process.env.GITHUB_EVENT_PATH&&
   path.isAbsolute(process.env.GITHUB_EVENT_PATH),'AI_V2_EVENT_FILE_UNAVAILABLE');
  event=JSON.parse(requireFile(process.env.GITHUB_EVENT_PATH,{maxBytes:100_000}).toString('utf8'));
  const command=process.argv[2];
  requireCheck(['--execute','--report'].includes(command)&&process.argv.length===3,
   'AI_V2_MODE_DENIED');
  if(command==='--report')return await uploadReport(event,process.env);
  const result=await execute(event,process.env);
  await writeLocalResult(result);
  process.stdout.write(`AI_V2_STATUS=${result.status} CODE=${result.code}\n`);
  if(result.status!=='PASS')process.exitCode=1;
 }catch(e){process.stderr.write(`AI_V2_STOP=${safeCode(e)}\n`);process.exitCode=1}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
