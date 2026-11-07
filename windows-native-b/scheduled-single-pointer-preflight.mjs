// Read-only Windows preflight for the existing configured-theme ONE-CMD upgrade.
// This is not a B writer, does not grant activation authority, and deliberately
// does not claim a scheduler tick or old/new runtime compatibility proof.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const VERSION=/^[0-9a-f]{16}$/;
const SHA=/^[0-9a-f]{64}$/;
const HOME='E:\\ZGmini\\data\\pc-writer\\theme-config-tool';
const TASK='ZGMINI-PC-Configured-Themes';
const ACTIVE=path.win32.join(HOME,'ACTIVE_RUNTIME.json');
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const need=(ok,code)=>{if(!ok)fail(code);};
const normalizedBytes=bytes=>{
 need(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=32768,
  'B_SINGLE_POINTER_LAUNCHER_BYTES');
 const s=bytes.toString('utf8');
 need(Buffer.from(s,'utf8').equals(bytes),'B_SINGLE_POINTER_LAUNCHER_ENCODING');
 return s;
};
function cmdSignature(bytes,home){
 const value=normalizedBytes(bytes);
 const lines=value.split('\r\n');
 if(lines.at(-1)==='')lines.pop();
 need(lines.length===6&&lines[0]==='@echo off'&&
  lines[1]==='setlocal EnableExtensions DisableDelayedExpansion'&&
  lines[2]==='set "ZGMINI_DATA_ROOT=E:\\ZGmini\\data"'&&
  lines[4]==='set "RESULT=%ERRORLEVEL%"'&&
  lines[5]==='exit /b %RESULT%','B_SINGLE_POINTER_CMD_GRAMMAR');
 const prefix='"E:\\ZGmini\\runtime\\node.exe" "'+home+'\\versions\\';
 need(lines[3].startsWith(prefix),'B_SINGLE_POINTER_CMD_GRAMMAR');
 const rest=lines[3].slice(prefix.length);
 const rx=/^([0-9a-f]{16})\\scripts\\pc-writer\\theme-config-tool\.mjs" --scheduled >>"(.+)" 2>&1$/;
 const match=rx.exec(rest);
 need(match&&match[2]===home+'\\SCHEDULE_HISTORY.log',
  'B_SINGLE_POINTER_CMD_GRAMMAR');
 return {version:match[1],normalized:lines.map((line,i)=>
  i===3?prefix+'{VERSION}\\scripts\\pc-writer\\theme-config-tool.mjs" --scheduled >>"'+
   home+'\\SCHEDULE_HISTORY.log" 2>&1':line).join('\r\n')};
}
function decodeTaskXml(bytes){
 need(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=262144,
  'B_SINGLE_POINTER_TASK_XML_BYTES');
 if(bytes[0]===255&&bytes[1]===254){
  need(bytes.length%2===0,'B_SINGLE_POINTER_TASK_ENCODING');
  return bytes.subarray(2).toString('utf16le');
 }
 const text=bytes.toString('utf8');
 need(Buffer.from(text,'utf8').equals(bytes),
  'B_SINGLE_POINTER_TASK_ENCODING');
 return text.startsWith('\uFEFF')?text.slice(1):text;
}

/** Pure byte-level candidate check; separate trusted Runner proof is required. */
export function analyzeScheduledSinglePointer({approval,taskXmlBytes,
 oldCmdBytes,newCmdBytes,vbsBytes,home=HOME}={}){
 need(home===HOME,'B_SINGLE_POINTER_HOME_SCOPE');
 need(approval?.taskName===TASK&&VERSION.test(approval.oldVersion??'')&&
  VERSION.test(approval.newVersion??'')&&
  approval.oldVersion!==approval.newVersion&&
  SHA.test(approval.taskXmlSha256??'')&&
  SHA.test(approval.vbsSha256??'')&&
  SHA.test(approval.oldCmdSha256??'')&&
  SHA.test(approval.newCmdSha256??''),
  'B_SINGLE_POINTER_APPROVAL_SCOPE');
 need(digest(taskXmlBytes)===approval.taskXmlSha256&&
  digest(vbsBytes)===approval.vbsSha256&&
  digest(oldCmdBytes)===approval.oldCmdSha256&&
  digest(newCmdBytes)===approval.newCmdSha256,
  'B_SINGLE_POINTER_PIN_DRIFT');
 const xml=decodeTaskXml(taskXmlBytes);
 const actions=[...xml.matchAll(/<Exec(?:\s[^>]*)?>([\s\S]*?)<\/Exec>/gi)];
 need(actions.length===1,'B_SINGLE_POINTER_TASK_ACTION');
 const action=actions[0][1];
 const command=action.match(/<Command>([^<]+)<\/Command>/i)?.[1]??'';
 const args=action.match(/<Arguments>([^<]+)<\/Arguments>/i)?.[1]
  ?.replaceAll('&quot;','"').replaceAll('&amp;','&')??'';
 need(/^(?:[cC]:\\Windows\\System32\\)?(?:wscript|cscript)(?:\.exe)?$/i.test(command)&&
  args.toLowerCase()==='"'+home.toLowerCase()+'\\theme_scheduled.vbs"',
  'B_SINGLE_POINTER_TASK_ACTION');
 const vbs=normalizedBytes(vbsBytes).split('\r\n').filter((s,i,a)=>
  !(i===a.length-1&&s===''));
 need(vbs.length===4&&vbs[0]==='Option Explicit'&&
  vbs[1]==='Dim shell'&&vbs[2]==='Set shell = CreateObject("WScript.Shell")'&&
  vbs[3]==='WScript.Quit shell.Run("""'+home+'\\THEME_SCHEDULED.cmd""", 0, True)',
  'B_SINGLE_POINTER_VBS_DISPATCH');
 const old=cmdSignature(oldCmdBytes,home),next=cmdSignature(newCmdBytes,home);
 need(old.version===approval.oldVersion&&next.version===approval.newVersion&&
  old.normalized===next.normalized,'B_SINGLE_POINTER_CMD_DRIFT');
 return Object.freeze({status:'SINGLE_SCHEDULED_CMD_CANDIDATE_ONLY',
  taskName:TASK,oldVersion:old.version,newVersion:next.version,
  changedScheduledFiles:['THEME_SCHEDULED.cmd'],
  staticLauncherBytesVerified:true,taskXmlUnchangedExpected:true,
  runtimeCompatibilityProven:false,schedulerTickRaceProvenSafe:false,
  activationAllowed:false,
  firstFail:'B_NATIVE_TASK_TICK_COMPATIBILITY_PROOF_REQUIRED'});
}

/** Native exact-scope snapshot. It performs no writes and never opens a shell. */
export function inspectWindowsScheduledSinglePointer({approval,newCmdBytes,
 platform=process.platform,readFile=fs.readFileSync,
 lstat=fs.lstatSync,existsSync=fs.existsSync,
 readTaskXml=()=>execFileSync('schtasks.exe',
  ['/Query','/TN',TASK,'/XML'],
  {windowsHide:true,maxBuffer:262144,stdio:['ignore','pipe','pipe']}),
}={}){
 need(platform==='win32','B_NATIVE_WINDOWS_REQUIRED');
 need(Buffer.isBuffer(newCmdBytes),'B_NATIVE_APPROVED_AFTER_BYTES_REQUIRED');
 // The original package installer has two distinct operational modes:
 // first upgrade has one scheduled CMD, repeatable upgrade additionally
 // switches three manual CMDs and ACTIVE_RUNTIME.json. Never confuse them.
 need(!existsSync(ACTIVE),'B_NATIVE_REPEATABLE_RUNTIME_DIFFERENT_EFFECT');
 const scopedFile=(basename)=>{
  need(['THEME_SCHEDULED.cmd','THEME_SCHEDULED.vbs'].includes(basename),
   'B_NATIVE_READ_SCOPE');
  const target=path.win32.join(HOME,basename);
  const prefixes=['E:\\','E:\\ZGmini','E:\\ZGmini\\data',
   'E:\\ZGmini\\data\\pc-writer',HOME,target];
  for(const prefix of prefixes){
   const st=lstat(prefix);
   need(!st.isSymbolicLink()&&(prefix===target?st.isFile():st.isDirectory()),
    'B_NATIVE_REPARSE_OR_TYPE');
  }
  const bytes=readFile(target);
  need(Buffer.isBuffer(bytes),'B_NATIVE_READ_BYTES');return bytes;
 };
 const beforeXml=readTaskXml();
 const oldCmd=scopedFile('THEME_SCHEDULED.cmd');
 const vbs=scopedFile('THEME_SCHEDULED.vbs');
 const afterXml=readTaskXml();
 need(Buffer.isBuffer(beforeXml)&&Buffer.isBuffer(afterXml)&&
  beforeXml.equals(afterXml),'B_NATIVE_TASK_SNAPSHOT_DRIFT');
 const afterCmd=scopedFile('THEME_SCHEDULED.cmd');
 need(oldCmd.equals(afterCmd),'B_NATIVE_CMD_SNAPSHOT_DRIFT');
 need(!existsSync(ACTIVE),'B_NATIVE_RUNTIME_MODE_CHANGED_DURING_READ');
 return analyzeScheduledSinglePointer({approval,taskXmlBytes:beforeXml,
  oldCmdBytes:oldCmd,newCmdBytes,vbsBytes:vbs});
}

/** A/light inventory selector only; never authorizes either B effect. */
export function inspectWindowsConfiguredRuntimeMode({platform=process.platform,
 existsSync=fs.existsSync,lstat=fs.lstatSync}={}){
 need(platform==='win32','B_NATIVE_WINDOWS_REQUIRED');
 const active=existsSync(ACTIVE);
 const installed=path.win32.join(HOME,'INSTALL_RESULT.json');
 for(const file of active?[installed,ACTIVE]:[installed]){
  const stat=lstat(file);
  need(stat.isFile()&&!stat.isSymbolicLink(),
   'B_NATIVE_RUNTIME_MODE_FILE_REDIRECT');
 }
 return Object.freeze({status:'RUNTIME_MODE_INVENTORY_ONLY',
  mode:active?'REPEATABLE_ACTIVE_RUNTIME':'FIRST_SINGLE_CMD_UPGRADE',
  activationAllowed:false,operationalWrites:0});
}
