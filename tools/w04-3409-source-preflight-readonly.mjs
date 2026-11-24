// Fixed, read-only source-ancestry preflight for #3409. This runs inside
// the existing process-inventory A on operating PC; it is NOT an independent
// Windows recovery operator and never performs fetch, reset, or Git writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const REPO_ROOT='E:/ZGmini/projects/zgmini-pc-control';
const SOURCE='fcb098d20fb9a6c48f371786c69f7f1fdf5bc34a';
const TOOL_HASH='fdf3d2e1821e8429106072677f63f8abb86bf4d0d3ce16143da8ff08fb134e05';
const sha=/^[a-f0-9]{40}$/;
const digest=b=>createHash('sha256').update(b).digest('hex');
function query(args){
 // Fixed read-only git commands. No shell, no environment output, no fetch.
 try{
  const r=spawnSync('git',['--no-optional-locks','-C',REPO_ROOT,...args],
   {windowsHide:true,shell:false,encoding:'utf8',timeout:8000,maxBuffer:2048});
  return {exitCode:r.status===null?null:r.status,
   stdout:typeof r.stdout==='string'?r.stdout.trim():''};
 }catch{return {exitCode:null,stdout:''};}
}
export function classifyW043409SourcePreflight({head,objectExit,ancestorExit,toolHash,rootValid}={}){
 const valid=sha.test(head??'');
 const objectPresent=objectExit===0?true:objectExit===1||objectExit===128?false:null;
 const ancestor=ancestorExit===0?true:ancestorExit===1?false:null;
 const byteMatch=toolHash===null?null:toolHash===TOOL_HASH;
 let code='SOURCE_CHECK_UNVERIFIED';
 if(rootValid===false)code='SOURCE_REPOSITORY_MISMATCH';
 else if(valid&&objectPresent===false)code='SOURCE_OBJECT_ABSENT';
 else if(valid&&objectPresent===true&&ancestor===false)code='SOURCE_HEAD_NOT_DESCENDANT';
 else if(valid&&objectPresent===true&&ancestor===true&&byteMatch===false)
  code='SOURCE_TOOL_BYTES_MISMATCH';
 else if(rootValid===true&&valid&&objectPresent===true&&ancestor===true&&byteMatch===true)
  code='SOURCE_READY_IN_RUNNER_WORKSPACE';
 return {schema:'ZGMINI_W04_3409_SOURCE_PREFLIGHT_V1',
  scope:'OPERATING_PC_ACTIONS_WORKSPACE_NOT_INDEPENDENT_OPERATOR',
  status:code==='SOURCE_READY_IN_RUNNER_WORKSPACE'?'PASS':'UNVERIFIED',
  code,sourceSha:SOURCE,checkoutHead:valid?head:null,
  sourceObjectPresent:objectPresent,sourceAncestorOfHead:ancestor,
  toolBytesMatch:byteMatch,localRepoMatched:rootValid===true,
  operationalWrites:0,gitFetches:0};
}
export function inspectW043409SourcePreflightReadonly({runGit=query,readTool}={}){
 const inspectTool=readTool??(()=>{
  try{
   const p=path.join(REPO_ROOT,'tools','maintenance-recovery.mjs');
   const st=fs.lstatSync(p);
   if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>131072)return null;
   return digest(fs.readFileSync(p));
  }catch{return null;}
 });
 const top=runGit(['rev-parse','--show-toplevel']);
 const rootValid=top.exitCode===0&&
  top.stdout.replaceAll('\\','/').replace(/\/$/,'').toLowerCase()===REPO_ROOT.toLowerCase();
 const headRun=runGit(['rev-parse','--verify','HEAD^{commit}']);
 const head=headRun.exitCode===0?headRun.stdout:null;
 const object=runGit(['cat-file','-e',SOURCE+'^{commit}']);
 const ancestor=object.exitCode===0&&sha.test(head??'')?
  runGit(['merge-base','--is-ancestor',SOURCE,'HEAD']):{exitCode:null};
 return classifyW043409SourcePreflight({
  head,rootValid,objectExit:object.exitCode,ancestorExit:ancestor.exitCode,
  toolHash:inspectTool()
 });
}
