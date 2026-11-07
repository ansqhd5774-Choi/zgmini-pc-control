#!/usr/bin/env node
// A-grade fixed read-only preview; no arbitrary shell, PC source writes,
// provider calls, config writes, or Task mutation.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {previewWriterInsertions,validatePreviewSpec,sha256} from './insert-preview-readonly.mjs';
import {summarizeCoreDrainProbe} from './core-drain-readonly.mjs';

export const REQUEST_SCHEMA='ZGMINI_WRITER_B_INSERT_PREVIEW_REQUEST_V1';
export const ISSUE_TITLE='pc-writer-insert-preview';
export const ISSUE_LABEL='pc-writer-insert-preview';
const CONTROL='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/i,SHA64=/^[a-f0-9]{64}$/i;
const PATH=/^approvals\/writer-previews\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const BIN={
 git:[String.raw`C:\Program Files\Git\cmd\git.exe`,
      String.raw`C:\Program Files\Git\bin\git.exe`].find(fs.existsSync),
 schtasks:String.raw`C:\Windows\System32\schtasks.exe`,
 cscript:String.raw`C:\Windows\System32\cscript.exe`,
};
const CORE_CYCLE_LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const run=(binary,args,{cwd}={})=>{
 need(binary&&fs.existsSync(binary),'WRITER_B_PREVIEW_EXECUTABLE_STOP');
 const r=spawnSync(binary,args,{cwd,encoding:null,windowsHide:true,shell:false,
  timeout:15000,maxBuffer:500000,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',
   GIT_TERMINAL_PROMPT:'0'}});
 need(!r.error&&r.status===0,'WRITER_B_PREVIEW_EXECUTION_STOP');
 return r.stdout;
};
const git=(root,args)=>run(BIN.git,['-C',root,'--no-optional-locks',
 '-c','core.fsmonitor=false',...args]).toString('utf8').trim();
const normal=p=>path.win32.normalize(p.replace(/^\\\\\?\\/,'')).toLowerCase();
const rootCanonical=p=>{
 const resolved=fs.realpathSync.native(p);
 need(normal(resolved)===normal(p)&&
  normal(resolved).startsWith('e:\\zgmini\\projects\\'),
  'WRITER_B_PREVIEW_SOURCE_ROOT_STOP');
 return p;
};
const safeFile=(root,relative)=>{
 const file=path.win32.join(root,...relative.split('/'));
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&
  stat.size>0&&stat.size<=2_000_000,
  'WRITER_B_PREVIEW_FILE_SCOPE_STOP');
 need(normal(fs.realpathSync.native(file))===normal(file),
  'WRITER_B_PREVIEW_FILE_REALPATH_STOP');
 return fs.readFileSync(file);
};

export function authorizePreviewRequest(event,env){
 need(env?.GITHUB_REPOSITORY===CONTROL&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===OWNER&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===CONTROL&&event.repository.private===true&&
  event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&
  event.issue.title===ISSUE_TITLE&&
  event.issue.labels?.some(x=>x.name===ISSUE_LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'WRITER_B_PREVIEW_ISSUE_AUTH_STOP');
 let req;
 try{req=JSON.parse(event.issue.body);}catch{stop('WRITER_B_PREVIEW_REQUEST_JSON_STOP');}
 need(exact(req,['schema','requestId','chatId','operation',
  'previewSpecPath','previewSpecSha256'])&&
  req.schema===REQUEST_SCHEMA&&UUID.test(req.requestId)&&UUID.test(req.chatId)&&
  req.operation==='pc-writer-insert-preview'&&
  PATH.test(req.previewSpecPath)&&SHA64.test(req.previewSpecSha256),
  'WRITER_B_PREVIEW_REQUEST_STOP');
 return req;
}

function preview({event,env}){
 need(process.platform==='win32','WRITER_B_PREVIEW_WINDOWS_ONLY');
 const req=authorizePreviewRequest(event,env);
 const control=path.join(env.GITHUB_WORKSPACE,'writer-preview-control');
 const head=git(control,['rev-parse','HEAD']);
 need(head===env.GITHUB_SHA,'WRITER_B_PREVIEW_CONTROL_HEAD_STOP');
 const root=path.join(control,'approvals','writer-previews');
 const relative=req.previewSpecPath.slice('approvals/writer-previews/'.length);
 const target=path.join(root,relative);
 const bytes=safeFile(root,relative);
 need(normal(fs.realpathSync.native(root)).startsWith(
  normal(fs.realpathSync.native(control))+'\\')&&
  sha256(bytes)===req.previewSpecSha256,
  'WRITER_B_PREVIEW_SPEC_SHA_STOP');
 let spec;
 try{spec=JSON.parse(bytes.toString('utf8'));}catch{stop('WRITER_B_PREVIEW_SPEC_JSON_STOP');}
 validatePreviewSpec(spec);
 const result=previewWriterInsertions(spec,{
  canonicalize:rootCanonical,
  head:r=>git(r,['rev-parse','HEAD']),
  configSource:()=>{
   const filename=String.raw`E:\ZGmini\data\pc-writer\config.json`;
   const raw=fs.readFileSync(filename);
   need(raw.length<131072,'WRITER_B_PREVIEW_CONFIG_BYTES_STOP');
   const config=JSON.parse(raw.toString('utf8'));
   return config.source;
  },
  isTargetClean:(r,p)=>git(r,['status','--porcelain=v1',
    '--untracked-files=all','--',p])==='',
  readTarget:(r,p)=>safeFile(r,p),
  taskXml:()=>run(BIN.schtasks,['/Query','/TN','ZGMINI-PC-Local-Core','/XML']),
 });
 // A drain snapshot is diagnostic only: it cannot turn a safe insertion
 // preview into a blocking gate or mutate the Core scheduler or lock.
 let coreDrain={status:'UNAVAILABLE'};
 try{
  const probe=path.join(control,'r17-writer-b','r17-b-windows-probe.js');
  const stat=fs.lstatSync(probe);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<8192&&
   normal(fs.realpathSync.native(probe))===normal(probe),
   'WRITER_B_DRAIN_PROBE_SCOPE_STOP');
  coreDrain=summarizeCoreDrainProbe(run(BIN.cscript,['//NoLogo',probe]),
   fs.existsSync(CORE_CYCLE_LOCK));
 }catch{}
 return {schema:'ZGMINI_WRITER_B_INSERT_PREVIEW_RESULT_V1',
  requestId:req.requestId,chatId:req.chatId,issueNumber:event.issue.number,
  ...result,coreDrain};
}
function resultPath(env){
 need(/^\d{1,18}$/.test(env.GITHUB_RUN_ID??'')&&
  typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
  'WRITER_B_PREVIEW_RESULT_PATH_STOP');
 return path.join(env.RUNNER_TEMP,'writer-b-insert-preview-'+env.GITHUB_RUN_ID+'.json');
}
export {resultPath};
async function main(){
 const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 let result;
 try{result=preview({event,env});}
 catch(e){
  const code=/^WRITER_B_(?:PREVIEW|INSERT)_[A-Z0-9_]+$/.test(e?.code??'')?
   e.code:'WRITER_B_PREVIEW_UNEXPECTED_STOP';
  let req={};
  try{req=authorizePreviewRequest(event,env);}catch{}
  result={schema:'ZGMINI_WRITER_B_INSERT_PREVIEW_RESULT_V1',
   requestId:req.requestId??null,chatId:req.chatId??null,
   issueNumber:event?.issue?.number??null,status:'BLOCKED',code,
   pcSourceWrites:0,taskWrites:0,dbWrites:0,d1Writes:0,providerCalls:0};
 }
 try{fs.writeFileSync(resultPath(env),JSON.stringify(result)+'\n',{flag:'wx'});}
 catch{process.exitCode=1;return;}
 if(result.status!=='PASS_READONLY')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main();
