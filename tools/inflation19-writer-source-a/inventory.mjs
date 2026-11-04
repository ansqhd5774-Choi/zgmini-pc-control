// Read-only, purpose-bound candidate. NOT installed or enabled on any Runner.
// Collects only PC Writer source identity needed to prepare an exact B manifest.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const SCHEMA='ZGMINI_INFL19_WRITER_SOURCE_INVENTORY_A_V1';
export const TASK='ZGMINI-PC-Local-Core';
export const PC_DATA=String.raw`E:\ZGmini\data\pc-writer`;
const CORE_VBS=String.raw`E:\ZGmini\data\pc-writer\run-local-core.vbs`;
export const FILES=Object.freeze([
 'scripts/pc-writer/run-local.mjs',
 'scripts/pc-writer/inflation-causal-public-auto-publication-r1.mjs',
 'scripts/pc-writer/inflation-causal-public-auto-publication-r1.test.mjs',
]);
const TASK_SCRIPTS=/\\scripts\\pc-writer\\(?:run-local|local-cycle)\.mjs$/i;
const GIT_CANDIDATES=[String.raw`C:\Program Files\Git\cmd\git.exe`,
 String.raw`C:\Program Files (x86)\Git\cmd\git.exe`];
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const digest=b=>createHash('sha256').update(b).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code})};
const bounded=(b,n,code)=>{
 if(!Buffer.isBuffer(b)||b.length<1||b.length>n)stop(code);
 return b;
};

// Win32 realpath may be \\?\E:\...; never report a C: junction as the source.
export function canonicalWindows(p){
 if(typeof p!=='string'||p.length>512)stop('INFL19_A_PATH_DENIED');
 const normalized=path.win32.normalize(p.replace(/^\\\\\?\\/,'')).toLowerCase();
 if(!/^[a-z]:\\/.test(normalized)||normalized.startsWith('\\\\'))
  stop('INFL19_A_PATH_DENIED');
 return normalized;
}

export function sourceRootFromRealScript(real){
 const p=canonicalWindows(real);
 if(!TASK_SCRIPTS.test(p))stop('INFL19_A_SCRIPT_NOT_WRITER');
 const suffix=/\\scripts\\pc-writer\\(?:run-local|local-cycle)\.mjs$/i.exec(p)[0];
 const root=p.slice(0,-suffix.length);
 if(!root.startsWith('e:\\zgmini\\projects\\')||
    root==='e:\\zgmini\\projects' || /\\\.(?:\\|$)/.test(root)||
    root.split('\\').some(s=>s==='..'))stop('INFL19_A_SOURCE_ROOT_DENIED');
 return root;
}

function xmlText(value){
 return value.replace(/&quot;/g,'"').replace(/&apos;/g,"'")
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
}
function xmlUtf(bytes){
 bounded(bytes,200_000,'INFL19_A_TASK_XML_DENIED');
 if(bytes[0]===0xff&&bytes[1]===0xfe)return bytes.subarray(2).toString('utf16le');
 if(bytes[0]===0xfe&&bytes[1]===0xff)stop('INFL19_A_XML_ENCODING_UNSUPPORTED');
 if(bytes[0]===0x3c&&bytes[1]===0&&bytes[3]===0)
  return bytes.toString('utf16le');
 return bytes.toString('utf8').replace(/^\ufeff/,'');
}
function xmlTag(block,tag){
 const matches=[...block.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`,'gi'))];
 if(matches.length!==1)stop('INFL19_A_TASK_ACTION_AMBIGUOUS');
 return xmlText(matches[0][1]);
}

// Extract the documented direct Node or install-local.mjs-generated WScript
// action. Any other dispatcher/launcher requires separate human inspection.
export function parseCoreTaskXml(raw){
 const xml=xmlUtf(raw);
 const actions=[...xml.matchAll(/<Actions(?:\s[^>]*)?>([\s\S]*?)<\/Actions>/gi)];
 if(actions.length!==1)stop('INFL19_A_TASK_ACTION_AMBIGUOUS');
 const execs=[...actions[0][1].matchAll(/<Exec(?:\s[^>]*)?>([\s\S]*?)<\/Exec>/gi)];
 if(execs.length!==1)stop('INFL19_A_TASK_ACTION_AMBIGUOUS');
 const cmd=xmlTag(execs[0][1],'Command');
 const args=/<Arguments>/i.test(execs[0][1])?xmlTag(execs[0][1],'Arguments'):'';
 if(cmd.length>2048||args.length>4096)stop('INFL19_A_TASK_ACTION_DENIED');
 const refs=[...`${cmd} ${args}`.matchAll(/(?:[a-z]:\\[^"'\r\n]*?\\scripts\\pc-writer\\(?:run-local|local-cycle)\.mjs)/gi)]
  .map(m=>path.win32.normalize(m[0].trim()));
 const scripts=[...new Set(refs.map(s=>s.toLowerCase()))];
 const actionExe=path.win32.basename(cmd).toLowerCase();
 if(scripts.length===1&&actionExe==='node.exe')
  return {kind:'direct-mjs',script:refs[0],taskXmlSha256:digest(raw),actionExe};
 if(scripts.length>1)stop('INFL19_A_TASK_ACTION_AMBIGUOUS');
 if(actionExe!=='wscript.exe')stop('INFL19_A_SCRIPT_REFERENCE_UNRESOLVED');
 const m=/^"([a-z]:\\[^"\r\n]+\\run-local-core\.vbs)"$/i.exec(args.trim());
 if(!m)stop('INFL19_A_SCRIPT_REFERENCE_UNRESOLVED');
 return {kind:'vbs',launcher:m[1],taskXmlSha256:digest(raw),actionExe};
}

// Exact generated VBS template from scripts/pc-writer/install-local.mjs:
// WScript.Quit shell.Run(""node"" "".../local-cycle.mjs"" --publish", 0, True)
// This reads VBS as DATA. It does not execute or rewrite the launcher.
export function parseApprovedCoreVbs(bytes){
 bounded(bytes,16_384,'INFL19_A_LAUNCHER_BYTES_DENIED');
 const src=bytes.toString('utf8').replace(/^\ufeff/,'');
 const m=/^Set shell = CreateObject\("WScript\.Shell"\)\r?\nWScript\.Quit shell\.Run\("([\s\S]*?)", 0, True\)\r?\n?$/.exec(src);
 if(!m)stop('INFL19_A_LAUNCHER_FORMAT_UNSUPPORTED');
 const cmd=m[1].replaceAll('""','"');
 const invocation=/^"[^"\r\n]+\\node(?:\.exe)?" "([a-z]:\\[^"\r\n]+\\scripts\\pc-writer\\local-cycle\.mjs)" --publish$/i.exec(cmd);
 if(!invocation)stop('INFL19_A_LAUNCHER_FORMAT_UNSUPPORTED');
 return invocation[1];
}

export function inventoryReadOnly({taskXml,resolveRealPath,readConfig,gitRoot,gitHead,
 targetFilesDirty,readTarget,readTargetExists,readLauncher}={}){
 if([taskXml,resolveRealPath,readConfig,gitRoot,gitHead,targetFilesDirty,
     readTarget,readTargetExists,readLauncher].some(x=>typeof x!=='function'))
  stop('INFL19_A_DEPENDENCY_DENIED');
 const action=parseCoreTaskXml(taskXml());
 const config=readConfig(PC_DATA);
 if(!config||!SHA40.test(config.source))stop('INFL19_A_CONFIG_SOURCE_DENIED');
 let script=action.script;
 if(action.kind==='vbs'){
  const real=canonicalWindows(resolveRealPath(action.launcher));
  if(real!==canonicalWindows(CORE_VBS))stop('INFL19_A_LAUNCHER_PATH_DENIED');
  const launcher=bounded(readLauncher(action.launcher),16_384,'INFL19_A_LAUNCHER_BYTES_DENIED');
  try{script=parseApprovedCoreVbs(launcher)}catch(e){
   if(e?.code!=='INFL19_A_LAUNCHER_FORMAT_UNSUPPORTED')throw e;
   return {schema:SCHEMA,status:'BLOCKED',code:e.code,
    configApprovedSha:config.source,taskXmlSha256:action.taskXmlSha256,
    actionExe:action.actionExe,launcherSha256:digest(launcher),
    providerCalls:0,d1Writes:0,pcSourceWrites:0,configWrites:0,taskWrites:0};
  }
 }
 const sourceRoot=sourceRootFromRealScript(resolveRealPath(script));
 if(canonicalWindows(gitRoot(sourceRoot))!==sourceRoot)
  stop('INFL19_A_NOT_CHECKOUT_ROOT');
 const head=gitHead(sourceRoot);
 if(!SHA40.test(head))stop('INFL19_A_GIT_HEAD_DENIED');
 const dirty=targetFilesDirty(sourceRoot);
 if(typeof dirty!=='boolean')stop('INFL19_A_GIT_DIRTY_DENIED');
 const hashes={};
 for(const rel of FILES){
  if(!readTargetExists(sourceRoot,rel)){
   if(rel===FILES[0])stop('INFL19_A_WRITER_ENTRY_MISSING');
   hashes[rel]={status:'ABSENT'};continue;
  }
  hashes[rel]={status:'PRESENT',sha256:digest(bounded(readTarget(sourceRoot,rel),
   2_000_000,'INFL19_A_TARGET_BYTES_DENIED'))};
  if(!SHA64.test(hashes[rel].sha256))stop('INFL19_A_HASH_DENIED');
 }
 return {schema:SCHEMA,status:'PASS_READONLY',code:'INFL19_A_SOURCE_IDENTITY_OBSERVED',
  sourceRoot,sourceHeadSha:head,targetFilesDirty:dirty,
  configApprovedSha:config.source,configMatchesHead:config.source===head,
  taskXmlSha256:action.taskXmlSha256,actionExe:action.actionExe,
  scriptBasename:path.win32.basename(script).toLowerCase(),files:hashes,
  evidenceLevel:'TASK_XML_AND_FILESYSTEM_GIT_READONLY_NOT_CORE_RUNTIME',
  providerCalls:0,d1Writes:0,pcSourceWrites:0,configWrites:0,taskWrites:0};
}

const minimalEnv=env=>({...Object.fromEntries(['SystemRoot','WINDIR','PATH','Path','PATHEXT',
 'ComSpec','USERPROFILE','TEMP','TMP'].filter(k=>typeof env[k]==='string')
 .map(k=>[k,env[k]])),
 // `git status` must not refresh/write the operational .git/index.
 GIT_OPTIONAL_LOCKS:'0'});
function gitCommand(root,args){
 const bin=GIT_CANDIDATES.find(f=>fs.existsSync(f));
 if(!bin)stop('INFL19_A_GIT_UNAVAILABLE');
 return execFileSync(bin,['-c','core.fsmonitor=false','-C',root,...args],{
  encoding:'utf8',windowsHide:true,timeout:12_000,maxBuffer:100_000,
  env:minimalEnv(process.env)}).trim();
}
function realFile(full,root){
 const real=canonicalWindows(fs.realpathSync.native(full));
 const base=canonicalWindows(fs.realpathSync.native(root));
 if(!real.startsWith(base+'\\'))stop('INFL19_A_TARGET_ESCAPES_SOURCE');
 const st=fs.lstatSync(full);
 if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>2_000_000)
  stop('INFL19_A_TARGET_NOT_REGULAR');
 return fs.readFileSync(full);
}
function main(){
 if(process.platform!=='win32')stop('INFL19_A_WINDOWS_ONLY');
 const schtasks=String.raw`C:\Windows\System32\schtasks.exe`;
 const taskXml=()=>execFileSync(schtasks,['/Query','/TN',TASK,'/XML'],{
  windowsHide:true,timeout:12_000,maxBuffer:200_000,env:minimalEnv(process.env)});
 try{
  const report=inventoryReadOnly({taskXml,resolveRealPath:p=>fs.realpathSync.native(p),
   readConfig:root=>{
    const f=path.win32.join(root,'config.json');
    const b=bounded(fs.readFileSync(f),100_000,'INFL19_A_CONFIG_BYTES_DENIED');
    const c=JSON.parse(b.toString('utf8'));return {source:c.source};
   },gitRoot:root=>gitCommand(root,['rev-parse','--show-toplevel']),
   gitHead:root=>gitCommand(root,['rev-parse','HEAD']),
   targetFilesDirty:root=>gitCommand(root,['status','--porcelain','--untracked-files=normal',
    '--',...FILES])!=='',
   readLauncher:full=>{
    const st=fs.lstatSync(full);
    if(!st.isFile()||st.isSymbolicLink())stop('INFL19_A_LAUNCHER_NOT_REGULAR');
    return bounded(fs.readFileSync(full),16_384,'INFL19_A_LAUNCHER_BYTES_DENIED');
   },
   readTargetExists:(root,rel)=>{
    try{fs.lstatSync(path.win32.join(root,...rel.split('/')));return true}
    catch(e){if(e?.code==='ENOENT')return false;throw e}
   },
   readTarget:(root,rel)=>realFile(path.win32.join(root,...rel.split('/')),root)});
  process.stdout.write(JSON.stringify(report)+'\n');
 }catch(e){
  // Exclude raw exceptions: paths, Git stderr, config, and tokens must not leak.
  const code=/^INFL19_A_[A-Z_]+$/.test(e?.code??'')?e.code:'INFL19_A_UNEXPECTED_STOP';
  process.stdout.write(JSON.stringify({schema:SCHEMA,status:'BLOCKED',code,
   providerCalls:0,d1Writes:0,pcSourceWrites:0,configWrites:0,taskWrites:0})+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
