// Fixed read-only R47 Task Exec identity preflight. This does not grant B
// installation permission or relax the direct-Task-action CAS protection.
// Never emit XML, raw Command/Arguments, environment or arbitrary paths.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {TextDecoder} from 'node:util';
import {taskAction} from './pc-source-readonly.mjs';

export const R47_TASK='ZGMINI-PC-Theme-Nine-R47-Private';
export const R47_TARGET=String.raw`E:\ZGmini\data\pc-writer\theme-nine-r48\THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd`;
export const R47_EXPECTED_TASK_SHA='bf3207ab2274d1248e7bd8c953cea2fd3bd277b8bd70bb1c2494339a06e0a4be';
export const R47_BEFORE_SHA='2e0fc3e358feff70103d1e9025ce0944132b7b10a2159900f9479b9860550888';
const ROOT=String.raw`E:\ZGmini\data\pc-writer`;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const normalized=value=>path.win32.normalize(String(value).replace(/^"([^"]+)"$/,'$1')).toLowerCase();
const base=()=>({status:'STATE_UNKNOWN',code:'R47_TASK_ACTION_UNVERIFIED',
 scope:'FIXED_R47_TASK_AND_CMD_READONLY',task:R47_TASK,
 commandKind:'UNKNOWN',argumentsPresent:null,workingDirectoryPresent:null,
 targetReferencedCanonical:'UNKNOWN',targetLiteralInArguments:null,
 taskXmlSha256MatchesApproved:null,installedCmdSha256MatchesBefore:null,
 directActionVerified:false,authorizesB:false,providerCalls:0,
 sqliteOpened:false,d1Writes:0,operationalWrites:0});

function readInstalledCmd(){
 const st=fs.lstatSync(R47_TARGET);
 if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>1024*1024)
  throw Error('INVALID_CMD_FILE');
 const root=normalized(fs.realpathSync.native(ROOT));
 const resolved=normalized(fs.realpathSync.native(R47_TARGET));
 if(!resolved.startsWith(root+'\\'))throw Error('CMD_OUTSIDE_ROOT');
 const bytes=fs.readFileSync(R47_TARGET);
 if(bytes.length!==st.size)throw Error('CMD_READ_DRIFT');
 return sha(bytes);
}
function readTaskXml(){
 const exe=path.win32.join(process.env.SystemRoot||String.raw`C:\Windows`,'System32','schtasks.exe');
 const p=spawnSync(exe,['/Query','/TN',R47_TASK,'/XML'],{
  shell:false,windowsHide:true,encoding:null,timeout:12000,maxBuffer:262144});
 if(p.error||p.signal||p.status!==0||!Buffer.isBuffer(p.stdout))
  throw Error('TASK_QUERY_UNAVAILABLE');
 return p.stdout;
}
function decodeFixedXml(raw){
 // Task Scheduler XML can be UTF-8 or UTF-16. No raw XML or parser errors
 // ever leave this fixed A output.
 let encoding='utf-8';
 if(raw[0]===255&&raw[1]===254)encoding='utf-16le';
 else if(raw[0]===254&&raw[1]===255)encoding='utf-16be';
 else if(raw[0]===60&&raw[1]===0)encoding='utf-16le';
 else if(raw[0]===0&&raw[1]===60)encoding='utf-16be';
 const value=new TextDecoder(encoding,{fatal:true}).decode(raw);
 if(!/^\s*(?:<\?xml\b|<Task\b)/.test(value))throw Error('BAD_XML');
 return value;
}
function checkedExec(xml){
 const actions=[...xml.matchAll(/<Actions(?:\s[^>]*)?>([\s\S]*?)<\/Actions>/gi)];
 if(actions.length!==1)throw Error('ACTION_COUNT');
 const execs=[...actions[0][1].matchAll(/<Exec(?:\s[^>]*)?>([\s\S]*?)<\/Exec>/gi)];
 if(execs.length!==1||actions[0][1].trim()!==execs[0][0])
  throw Error('EXEC_COUNT');
 const e=execs[0][0];
 if([...e.matchAll(/<Command>/gi)].length!==1||
    [...e.matchAll(/<Arguments>/gi)].length>1||
    [...e.matchAll(/<WorkingDirectory>/gi)].length>1)
  throw Error('ACTION_FIELDS');
 const action=taskAction(e);
 if(!action.command||action.command.length>2048||
    action.arguments.length>4096||action.workingDirectory.length>2048)
  throw Error('ACTION_SIZE');
 return action;
}
function knownLauncher(command){
 const normalizedCommand=normalized(command);
 const file=path.win32.basename(normalizedCommand);
 return ['cmd.exe','wscript.exe','cscript.exe'].includes(file)&&
  (normalizedCommand===file||
   normalizedCommand==='c:\\windows\\system32\\'+file);
}
function literalTargetInArgs(args){
 // Textual occurrence is only a clue; never a proof of execution through
 // a launcher or a reason to relax the original direct-action guard.
 const a=String(args).replaceAll('/','\\').toLowerCase();
 const target=normalized(R47_TARGET);
 let idx=a.indexOf(target);
 while(idx!==-1){
  const before=idx===0?' ':a[idx-1],after=a[idx+target.length]??' ';
  if(/[\s"'(]/.test(before)&&/[\s"')]/.test(after))return true;
  idx=a.indexOf(target,idx+target.length);
 }
 return false;
}
export function inspectR47TaskActionReadonly({
 platform=process.platform,queryTask=readTaskXml,installedHash=readInstalledCmd
}={}){
 const out=base();
 if(platform!=='win32')return {...out,code:'R47_WINDOWS_REQUIRED'};
 let raw,action;
 try{
  raw=queryTask(R47_TASK);
  if(!Buffer.isBuffer(raw)||raw.length<5||raw.length>262144)throw Error('XML_BYTES');
  action=checkedExec(decodeFixedXml(raw));
 }catch{return {...out,code:'R47_TASK_XML_UNVERIFIED'};}
 const direct=normalized(action.command)===normalized(R47_TARGET);
 const kind=direct?'DIRECT_TARGET':knownLauncher(action.command)?'KNOWN_LAUNCHER':'OTHER';
 const evidence={...out,status:'PASS',code:'R47_TASK_ACTION_READONLY_CLASSIFIED',
  commandKind:kind,argumentsPresent:action.arguments.length>0,
  workingDirectoryPresent:action.workingDirectory.length>0,
  targetReferencedCanonical:direct?true:'UNKNOWN',
  targetLiteralInArguments:literalTargetInArgs(action.arguments),
  taskXmlSha256MatchesApproved:sha(raw)===R47_EXPECTED_TASK_SHA,
  directActionVerified:direct};
 try{
  const digest=installedHash(R47_TARGET);
  if(typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))throw Error('CMD_HASH');
  return {...evidence,installedCmdSha256MatchesBefore:digest===R47_BEFORE_SHA};
 }catch{return {...evidence,status:'STATE_UNKNOWN',code:'R47_CMD_PREIMAGE_UNVERIFIED'};}
}
