#!/usr/bin/env node
// Independent owner Windows READ-ONLY W06 V3 snapshot for a Public repository.
// Not a B admission, receiver, approval, deployment or installation entry.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ROOT='E:/ZGmini/projects/zgmini-pc-control';
const REL='sidecar-b/public-v3-independent-preimage-readonly.mjs';
const GH='C:/Program Files/GitHub CLI/gh.exe';
const CSCRIPT='C:/Windows/System32/cscript.exe';
const ANCESTRY='E:/ZGmini/automation/pc-maintenance/tools/maintenance-ancestry.vbs';
const OWNER_ID=327938088;
const REPO_ID=1442936296;
const INSTALLED_V2='eb3c43bf8fba6ea4e51f3e84b77f9ec13000db9d9e38077ffd914950d7080b6b';
const WRITER_HEAD='c8ed53a3991212dd1778742cda8a86ac133e0796';
const TASK_SHA='dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028';
const WRAPPER_SHA='9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c';
const SOURCE_FILES=Object.freeze([
 REL,'sidecar-b/operating-probe.mjs','sidecar-b/contract.mjs',
 'writer-b/windows-guards.mjs','controller/pc-source-readonly.mjs',
 'tools/maintenance-lock.mjs','r17-writer-b/r17-b-windows-probe.js'
]);
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const sha=b=>createHash('sha256').update(b).digest('hex');

const empty=(status,code)=>({
 schema:'ZGMINI_W06_PUBLIC_V3_INDEPENDENT_READONLY_V1',
 status,code,executionAuthorized:false,approvalGranted:false,
 operationalWrites:0,providerCalls:0,d1Writes:0
});

// Pure projection: it never acquires a lease, grants B, or infers that an idle
// instant remains idle when a later installer runs.
export function assessPublicV3PreimageReadonly(e){
 if(e?.ownerVerified!==true)
  return empty('BLOCKED','W06_PUBLIC_OWNER_UNVERIFIED');
 if(e?.independentOperatorVerified!==true)
  return empty('BLOCKED','W06_INDEPENDENT_WINDOWS_UNVERIFIED');
 if(e?.sourceVerified!==true)
  return empty('BLOCKED','W06_PUBLIC_READONLY_SOURCE_UNVERIFIED');
 const p=e?.preimage;
 if(p?.status!=='PASS'||p?.code!=='CNN_B_V3_PREIMAGE_PINS_COLLECTED'||
    p.beforeSha256!==INSTALLED_V2||p.head!==WRITER_HEAD||
    p.configSource!==WRITER_HEAD||
    p.taskDefinitionSha256!==TASK_SHA||
    p.wrapperSha256!==WRAPPER_SHA)
  return empty('STATE_UNKNOWN','W06_V3_LIVE_PREIMAGE_UNVERIFIED');
 const r=e?.resources;
 if(r?.status!=='PASS'||r?.code!=='CNN_B_RESOURCE_SNAPSHOT_COLLECTED'||
    !['boolean'].includes(typeof r.coreQuiet)||
    typeof r.sidecarActive!=='boolean'||
    typeof r.controllerInstallBusy!=='boolean'||
    typeof r.sharedWriterLockPresent!=='boolean')
  return empty('STATE_UNKNOWN','W06_V3_RESOURCES_UNVERIFIED');
 if(r.controllerInstallBusy||r.sharedWriterLockPresent)
  return empty('DEFERRED','W06_V3_SHARED_INSTALL_BUSY');
 if(!r.coreQuiet||r.sidecarActive)
  return empty('DEFERRED','W06_V3_NATURAL_CORE_ACTIVE');
 return {...empty('PASS','W06_V3_PREIMAGE_AND_IDLE_READONLY_ONLY'),
  observedHead:p.head,beforeSha256:p.beforeSha256,
  taskDefinitionSha256:p.taskDefinitionSha256,
  wrapperSha256:p.wrapperSha256};
}

function api(route){
 const raw=execFileSync(GH,['api',route],{
  encoding:'utf8',windowsHide:true,timeout:25000,maxBuffer:262144
 });
 return JSON.parse(raw);
}
function fixedFile(relative){
 const filename=path.join(ROOT,...relative.split('/'));
 const st=fs.lstatSync(filename);
 need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&
  st.size>0&&st.size<=262144,'W06_PUBLIC_READONLY_FILE_TYPE_STOP');
 const expected=path.win32.normalize(filename).toLowerCase();
 const actual=path.win32.normalize(fs.realpathSync.native(filename)).toLowerCase();
 need(actual===expected,'W06_PUBLIC_READONLY_REDIRECT_STOP');
 return fs.readFileSync(filename);
}
function verifySource(){
 const owner=api('user'),repo=api('repos/'+REPO);
 need(owner?.id===OWNER_ID&&owner?.login==='ansqhd5774-Choi'&&
  repo?.id===REPO_ID&&repo?.owner?.id===OWNER_ID&&
  repo?.full_name===REPO&&repo?.private===false,
  'W06_PUBLIC_OWNER_STOP');
 for(const [number,merge] of [
  [4277,'2521a73bdaf267f37d330f753134dd0e93d9035c'],
  [4281,'71a90d6f9b82606ea660de20d6f151af78d320f4']
 ]){
  const pr=api('repos/'+REPO+'/pulls/'+number);
  need(pr?.merged===true&&pr?.merge_commit_sha===merge,
   'W06_PUBLIC_SOURCE_LINEAGE_STOP');
  const compare=api('repos/'+REPO+'/compare/'+merge+'...main');
  need(compare?.behind_by===0&&compare?.merge_base_commit?.sha===merge,
   'W06_PUBLIC_SOURCE_LINEAGE_STOP');
 }
 for(const rel of SOURCE_FILES){
  const remote=api('repos/'+REPO+'/contents/'+rel+'?ref=main');
  need(remote?.type==='file'&&remote?.encoding==='base64'&&
   typeof remote.content==='string',
   'W06_PUBLIC_READONLY_REMOTE_SOURCE_STOP');
  need(sha(fixedFile(rel))===sha(Buffer.from(remote.content,'base64')),
   'W06_PUBLIC_READONLY_SOURCE_CAS_STOP');
 }
}
function verifyIndependent(){
 need(process.platform==='win32'&&os.hostname().toUpperCase()==='PC'&&
  !process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME&&
  !process.env.GITHUB_RUN_ID,
  'W06_INDEPENDENT_WINDOWS_REQUIRED');
 need(path.win32.normalize(path.resolve(fileURLToPath(import.meta.url))).toLowerCase()===
  path.win32.normalize(path.resolve(ROOT,REL)).toLowerCase(),
  'W06_INDEPENDENT_ENTRY_PATH_STOP');
 const result=execFileSync(CSCRIPT,
  ['//NoLogo',ANCESTRY,'OPERATOR',String(process.pid),'0'],
  {encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:4096}).trim();
 need(result==='INDEPENDENT_OPERATOR',
  'W06_INDEPENDENT_OWNER_ANCESTRY_STOP');
}
export async function main(){
 verifyIndependent();
 verifySource();
 // All local modules (including transitive imports and COM probe script) have
 // been compared against the authenticated Public main before evaluation.
 const {inspectSidecarBManifestPreimageReadonly,
  inspectSidecarBResourceFlagsReadonly}=
  await import('./operating-probe.mjs');
 return {...assessPublicV3PreimageReadonly({
  ownerVerified:true,independentOperatorVerified:true,sourceVerified:true,
  preimage:inspectSidecarBManifestPreimageReadonly(),
  resources:inspectSidecarBResourceFlagsReadonly()
 }),observedAtUtc:new Date().toISOString()};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await main()));}
 catch(e){console.log(JSON.stringify(
  empty('BLOCKED',/^W06_[A-Z0-9_]{4,90}$/.test(e?.code??'')?
   e.code:'W06_PUBLIC_V3_READONLY_UNVERIFIED')));
  process.exitCode=2;}
}
