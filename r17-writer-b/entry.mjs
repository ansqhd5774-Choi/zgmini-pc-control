#!/usr/bin/env node
// Read-only PC preflight. This file is a SCRATCH DESIGN, never installed/triggered.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateEvent,validateManifest,buildCandidateOverlay,overlayFromPatchedBytes,digest,OLD,ADDED,FIVE,stop} from './contract.mjs';

const NODE_ENV_KEYS=['SystemRoot','WINDIR','PATH','Path','PATHEXT','ComSpec',
  'USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP'];
const safeEnv=env=>Object.fromEntries(NODE_ENV_KEYS.filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));
const ROOT_RESULT=String.raw`E:\ZGmini\automation\r17-writer-b-preflight`;
const GIT_CANDIDATES=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files (x86)\Git\cmd\git.exe`];
const SCHTASKS=String.raw`C:\Windows\System32\schtasks.exe`;
const REPORT_CODES=new Set([
  'R17_B_PREFLIGHT_PASS','R17_B_UNEXPECTED_STOP','R17_B_EVENT_CONTEXT_STOP',
  'R17_B_ISSUE_AUTHORIZATION_STOP','R17_B_REQUEST_SIZE_STOP',
  'R17_B_REQUEST_JSON_STOP','R17_B_REQUEST_SCHEMA_STOP','R17_B_APPROVAL_BYTES_STOP',
  'R17_B_APPROVAL_JSON_STOP','R17_B_APPROVAL_SCOPE_STOP','R17_B_PLATFORM_STOP',
  'R17_B_WORKSPACE_STOP','R17_B_CONTROL_SOURCE_STOP','R17_B_PC_ROOT_STOP',
  'R17_B_PC_SOURCE_DRIFT_STOP','R17_B_PC_DIRTY_STOP','R17_B_CONFIG_PIN_STOP',
  'R17_B_EXISTING_SHA_STOP','R17_B_NEW_FILE_PRESENT_STOP',
  'R17_B_CANDIDATE_SHA_STOP','R17_B_PATCH_SHA_STOP','R17_B_PATCH_APPLY_STOP',
  'R17_B_PATCH_FILESET_STOP','R17_B_PATCH_FORMAT_STOP','R17_B_PATCH_HEADER_STOP',
  'R17_B_PATCH_BASE_MISSING_STOP','R17_B_PATCH_HUNK_STOP','R17_B_PATCH_OFFSET_STOP',
  'R17_B_PATCH_CONTEXT_STOP','R17_B_PATCH_LINE_STOP','R17_B_PATCH_HUNK_COUNT_STOP',
  'R17_B_PATCH_TARGET_MISMATCH_STOP','R17_B_TASK_IDENTITY_STOP',
  'R17_B_IMPORT_RESOLUTION_STOP','R17_B_IMPORT_BUDGET_STOP','R17_B_SOURCE_FILE_STOP',
]);
const codeOf=e=>REPORT_CODES.has(e?.code)?e.code:'R17_B_UNEXPECTED_STOP';
const safeImportDiagnostic=error=>{
 const d=error?.diagnostic;
 const safePath=p=>typeof p==='string'&&p.length>=1&&p.length<=180&&
   /^(?:scripts|lib|worker)\/[A-Za-z0-9_./-]+$/.test(p);
 if(error?.code!=='R17_B_IMPORT_RESOLUTION_STOP'||!d||
   !['OVERLAY','PC_BASE'].includes(d.sourceKind)||
   !['MISSING','ESCAPE','READ_FAILURE','INVALID_BUFFER'].includes(d.reason)||
   !safePath(d.sourcePath)||!safePath(d.dependencyPath))
   return null;
 return {sourceKind:d.sourceKind,sourcePath:d.sourcePath,
   dependencyPath:d.dependencyPath,reason:d.reason};
};
function importStop(sourcePath,dependencyPath,reason,sourceKind){
 const error=Object.assign(new Error('R17_B_IMPORT_RESOLUTION_STOP'),{
   code:'R17_B_IMPORT_RESOLUTION_STOP',
   diagnostic:{sourceKind,sourcePath,dependencyPath,reason},
 });
 throw error;
}
const safePatchDiagnostic=error=>{
  const d=error?.diagnostic;
  if(error?.code!=='R17_B_PATCH_CONTEXT_STOP'||!d||
    !['local-cycle','run-local'].includes(d.file)||
    !['MIXED_EOL','NO_MATCH','MULTIPLE_MATCH'].includes(d.reason)||
    !(d.hunkOldStart===null||
      (Number.isSafeInteger(d.hunkOldStart)&&d.hunkOldStart>=1&&d.hunkOldStart<=10_000))||
    ![null,0,2].includes(d.matchCount)||d.nativeGitApplyCheck!=='PASS')
      return null;
  return {file:d.file,hunkOldStart:d.hunkOldStart,reason:d.reason,
    matchCount:d.matchCount,nativeGitApplyCheck:'PASS'};
};

function regular(base,relative,max=2_000_000){
  const full=path.join(base,...relative.split('/'));
  let st;try{st=fs.lstatSync(full)}catch{stop('R17_B_SOURCE_FILE_STOP')}
  if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>max)
    stop('R17_B_SOURCE_FILE_STOP');
  const realBase=fs.realpathSync.native(base).toLowerCase()+path.sep;
  if(!fs.realpathSync.native(full).toLowerCase().startsWith(realBase))
    stop('R17_B_SOURCE_FILE_STOP');
  return fs.readFileSync(full);
}

/** Static closure of relative imports only; never import/execute candidate code. */
export function verifyImports(pcRoot,overlaid,readBase,{maxFiles=500}={}){
  const queue=[...FIVE],seen=new Set();
  let examined=0;
  while(queue.length){
    const file=queue.shift();
    if(seen.has(file))continue;
    if(++examined>maxFiles)stop('R17_B_IMPORT_BUDGET_STOP');
    seen.add(file);
    let buf;
    const sourceKind=overlaid.has(file)?'OVERLAY':'PC_BASE';
    try{buf=overlaid.get(file)??readBase(pcRoot,file)}
    catch{importStop(file,file,'READ_FAILURE',sourceKind)}
    if(!Buffer.isBuffer(buf)||buf.length>2_000_000)
      importStop(file,file,'INVALID_BUFFER',sourceKind);
    if(!/\.(?:mjs|cjs|js|ts|tsx)$/.test(file))continue;
    const src=buf.toString('utf8');
    const pattern=/(?:\bfrom\s*|\bimport\s*(?:\(|\s)|\brequire\s*\()\s*['"](\.[^'"]+)['"]/g;
    // JSDoc's import('./types') is type metadata, never a runtime module.
    const jsdoc=[...src.matchAll(/\/\*\*[\s\S]*?\*\//g)]
      .map(m=>[m.index,m.index+m[0].length]);
    for(const match of src.matchAll(pattern)){
      if(jsdoc.some(([first,last])=>match.index>=first&&match.index<last))continue;
      const base=path.posix.dirname(file),candidate=path.posix.normalize(path.posix.join(base,match[1]));
      if(candidate==='..'||candidate.startsWith('../')||path.posix.isAbsolute(candidate))
        importStop(file,candidate,'ESCAPE',sourceKind);
      const variants=/\.[a-z]+$/i.test(candidate)?[candidate]:
        [candidate+'.mjs',candidate+'.js',candidate+'.ts',candidate+'.tsx',candidate+'/index.mjs'];
      const resolved=variants.find(v=>overlaid.has(v)||readBase(pcRoot,v,true));
      if(!resolved)importStop(file,candidate,'MISSING',sourceKind);
      queue.push(resolved);
    }
  }
  return {verifiedImportFiles:seen.size};
}

export function runReadOnly({event,env,controlRoot,candidateRoot,taskXml,readPcFile,
  inspectAbsence,gitCommit,gitStatus,gitApplyCheck,resolveRealRoot,
  readApproval=()=>regular(controlRoot,'r17-writer-b/approval/R17_WRITER_B_PREFLIGHT_APPROVAL.json',16_384),
  readConfig=(base)=>JSON.parse(fs.readFileSync(path.join(base,'config.json'),'utf8')),
  readCandidate=p=>regular(candidateRoot,p),
  readPatch=()=>regular(controlRoot,'r17-writer-b/approval/R17_A23_REBASE.patch',2_000_000),
  makeOverlay=buildCandidateOverlay,
  hash=digest}={}){
  const request=validateEvent(event,env);
  const rawManifest=readApproval();
  const manifest=validateManifest(rawManifest,request);
  if(gitCommit(controlRoot)!==env.R17_CONTROL_SHA||gitCommit(candidateRoot)!==request.candidateSourceSha||
     gitStatus(controlRoot)||gitStatus(candidateRoot))stop('R17_B_CONTROL_SOURCE_STOP');
  const pcRoot=resolveRealRoot(manifest.pcSourceRoot);
  if(!pcRoot.toLowerCase().startsWith('e:\\zgmini\\projects\\'))
    stop('R17_B_PC_ROOT_STOP');
  if(gitCommit(pcRoot)!==manifest.installedHeadSha)stop('R17_B_PC_SOURCE_DRIFT_STOP');
  if(gitStatus(pcRoot))stop('R17_B_PC_DIRTY_STOP');
  const config=readConfig(manifest.pcDataRoot);
  if(config?.source!==manifest.approvedConfigSourceSha)stop('R17_B_CONFIG_PIN_STOP');
  if(hash(taskXml())!==manifest.coreTaskXmlSha256)stop('R17_B_TASK_IDENTITY_STOP');

  const originals={},originalBuffers={};
  for(const p of OLD){
    const bytes=readPcFile(pcRoot,p);
    if(hash(bytes)!==manifest.beforeSha256[p])stop('R17_B_EXISTING_SHA_STOP');
    originalBuffers[p]=bytes;
    originals[p]=bytes.toString('utf8');
  }
  for(const p of ADDED)if(!inspectAbsence(pcRoot,p))stop('R17_B_NEW_FILE_PRESENT_STOP');
  // Only three new blobs are taken from public PR; OLD comes from exact a23
  // original bytes + the separately reviewed private two-file patch.
  const newFiles=Object.fromEntries(ADDED.map(p=>[p,readCandidate(p)]));
  const patch=readPatch();
  if(hash(patch)!==manifest.patchSha256)stop('R17_B_PATCH_SHA_STOP');
  // Native Git's check is read-only. Compare its outcome before the separate
  // strict in-memory parser, so a parser-only mismatch is distinguishable.
  if(!gitApplyCheck(pcRoot,path.join(controlRoot,'r17-writer-b','approval','R17_A23_REBASE.patch')))
    stop('R17_B_PATCH_APPLY_STOP');
  let candidate;
  try{
    candidate=makeOverlay({originals,originalBuffers,
      patchBytes:patch,newFiles,newSha256:manifest.newSha256});
  }catch(error){
    if(error?.code==='R17_B_PATCH_CONTEXT_STOP'&&error?.diagnostic)
      error.diagnostic.nativeGitApplyCheck='PASS';
    throw error;
  }
  const {overlay,oldTargetSha256}=candidate;
  const imports=verifyImports(pcRoot,overlay,(root,p,probe=false)=>{
    if(probe){try{const st=fs.lstatSync(path.join(root,...p.split('/')));return st.isFile()&&!st.isSymbolicLink()}catch{return false}}
    return regular(root,p);
  });
  return {requestId:request.requestId,runId:env.GITHUB_RUN_ID,
    runAttempt:1,issueNumber:event.issue.number,status:'PASS',
    code:'R17_B_PREFLIGHT_PASS',installedHeadMatched:true,
    configPinMatched:true,taskXmlMatched:true,existingHashesMatched:2,
    newlyAbsent:3,candidateHashesMatched:3,patchMatched:true,
    oldTargetSha256,
    ...imports,importCheckScope:'STATIC_AND_LITERAL_RELATIVE_IMPORTS_ONLY',
    providerCalls:0,d1Writes:0,pcSourceWrites:0,
    operationalConfigWrites:0,taskWrites:0};
}

const fixedGit=()=>GIT_CANDIDATES.find(x=>fs.existsSync(x))??stop('R17_B_PLATFORM_STOP');
const command=(exe,args,env)=>execFileSync(exe,args,{encoding:'utf8',windowsHide:true,
  timeout:15_000,maxBuffer:100_000,env:safeEnv(env)});
const gitCmd=(root,args,env)=>command(fixedGit(),['-c','core.fsmonitor=false','-C',root,...args],env).trim();

function nativeOverlayInIsolatedWorkspace({workspace,originalBuffers,newFiles,newSha256,env}){
  // All writes are to one newly created child of this job's checked workspace.
  // Nothing is applied to E: operational source, local DB or scheduler.
  const root=fs.realpathSync.native(workspace);
  const scratch=fs.mkdtempSync(path.join(root,'r17-approved-overlay-'));
  try{
    const target=fs.realpathSync.native(scratch);
    if(!target.toLowerCase().startsWith(root.toLowerCase()+path.sep))
      stop('R17_B_WORKSPACE_STOP');
    for(const p of OLD){
      const buffer=originalBuffers[p];
      if(!Buffer.isBuffer(buffer)||buffer.length<1||buffer.length>2_000_000)
        stop('R17_B_PATCH_BASE_MISSING_STOP');
      const file=path.join(scratch,...p.split('/'));
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,buffer,{flag:'wx'});
    }
    const approved=path.join(workspace,'r17-control','r17-writer-b',
      'approval','R17_A23_REBASE.patch');
    try{
      gitCmd(scratch,['apply','--check','--whitespace=error',approved],env);
      gitCmd(scratch,['apply','--whitespace=error',approved],env);
    }catch{stop('R17_B_PATCH_APPLY_STOP')}
    const patchedOld=Object.fromEntries(OLD.map(p=>[p,regular(scratch,p)]));
    return overlayFromPatchedBytes({patchedOld,newFiles,newSha256});
  }finally{
    // scratch is a validated, newly created, request-local leaf directory.
    fs.rmSync(scratch,{recursive:true,force:true});
  }
}

function main(){
  const env=process.env;
  if(process.platform!=='win32')stop('R17_B_PLATFORM_STOP');
  const ws=env.GITHUB_WORKSPACE;
  if(!ws||!path.isAbsolute(ws)||!fs.existsSync(ws))stop('R17_B_WORKSPACE_STOP');
  const checked=fs.realpathSync.native(ws).toLowerCase()+path.sep;
  for(const child of ['r17-control','r17-source']){
    const physical=fs.realpathSync.native(path.join(ws,child)).toLowerCase();
    if(!physical.startsWith(checked))stop('R17_B_WORKSPACE_STOP');
  }
  let event,requestId=null;
  try{
    event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    // Only requestId is reported from untrusted body after the full contract validates.
    requestId=validateEvent(event,env).requestId;
  }catch(error){
    process.exitCode=1;
    return persist({status:'BLOCKED',code:codeOf(error),runId:env.GITHUB_RUN_ID??'unknown'});
  }
  let report;
  try{
    report=runReadOnly({event,env,controlRoot:path.join(ws,'r17-control'),
      candidateRoot:path.join(ws,'r17-source'),
      gitCommit:root=>gitCmd(root,['rev-parse','HEAD'],env),
      gitStatus:root=>gitCmd(root,['status','--porcelain','--untracked-files=all'],env),
      gitApplyCheck:(root,p)=>{try{gitCmd(root,['apply','--check','--whitespace=error',p],env);return true}catch{return false}},
      resolveRealRoot:root=>fs.realpathSync.native(root),
      readPcFile:(root,p)=>regular(root,p),
      makeOverlay:inputs=>{
        // Structural/hunk gate compares LF logical lines only; the canonical
        // installed byte sequences remain untouched and are applied by Git below.
        const normalized=Object.fromEntries(OLD.map(p=>
          [p,inputs.originals[p].replace(/\r\n/g,'\n')]));
        buildCandidateOverlay({originals:normalized,patchBytes:inputs.patchBytes,
          newFiles:inputs.newFiles,newSha256:inputs.newSha256});
        return nativeOverlayInIsolatedWorkspace({
          workspace:ws,originalBuffers:inputs.originalBuffers,
          newFiles:inputs.newFiles,newSha256:inputs.newSha256,env,
        });
      },
      inspectAbsence:(root,p)=>!fs.existsSync(path.join(root,...p.split('/'))),
      taskXml:()=>execFileSync(SCHTASKS,['/Query','/TN','ZGMINI-PC-Local-Core','/XML'],
        {windowsHide:true,timeout:15_000,maxBuffer:100_000,env:safeEnv(env)}),
    });
  }catch(error){const diagnostic=safePatchDiagnostic(error)??safeImportDiagnostic(error);
    report={requestId,runId:env.GITHUB_RUN_ID,
      status:'BLOCKED',code:codeOf(error),
      ...(diagnostic?{diagnostic}:{}),
      providerCalls:0,d1Writes:0,pcSourceWrites:0,
      operationalConfigWrites:0,taskWrites:0};}
  persist(report,requestId);
  if(report.status!=='PASS')process.exitCode=1;
}
function persist(report,requestId='untrusted'){
  fs.mkdirSync(ROOT_RESULT,{recursive:true});
  const id=/^pc-r17-[0-9a-f-]{36}$/.test(requestId??'')?requestId:
    /^\d{1,18}$/.test(process.env.GITHUB_RUN_ID??'')?`run-${process.env.GITHUB_RUN_ID}`:'invalid';
  const data={schema:'ZGMINI_R17_WRITER_B_PREFLIGHT_RESULT_V1',...report};
  fs.writeFileSync(path.join(ROOT_RESULT,`R17_B_PREFLIGHT_${id}.json`),
    JSON.stringify(data,null,2)+'\n',{flag:'wx'});
  const txt=`REQUEST_ID=${data.requestId??'UNKNOWN'}\nSTATUS=${data.status}\nCODE=${data.code}\n`+
    `RUN_ID=${data.runId??'UNKNOWN'}\nPROVIDER_CALLS=0\nD1_WRITES=0\nPC_SOURCE_WRITES=0\n`+
    `CONFIG_WRITES=0\nTASK_WRITES=0\nRETRY=NEVER_INSPECT_LEDGER_FIRST\n`;
  fs.writeFileSync(path.join(ROOT_RESULT,`R17_B_PREFLIGHT_${id}.txt`),txt,{flag:'wx'});
  process.stdout.write(`R17_PREFLIGHT STATUS=${data.status} CODE=${data.code}\n`);
  return data;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
