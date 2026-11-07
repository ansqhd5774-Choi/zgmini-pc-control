// PREPRODUCTION verifier for a second, narrowly approved B activation model.
// Proof data MUST be anchored by the authenticated approval digest. No Task
// controls or PC I/O are exposed here; the registered receiver owns reads.
import {createHash} from 'node:crypto';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{const e=Error('B_WINDOWS_PINNED_LAUNCHER_NOT_PROVEN');
 e.code='B_WINDOWS_PINNED_LAUNCHER_NOT_PROVEN';throw e;};
const need=ok=>{if(!ok)fail();};
const SHA64=/^[0-9a-f]{64}$/;
const VERSION=/^[0-9a-f]{16}$/;
const pathRx=/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*\.(?:mjs|json|md)$/i;
const scriptRx=/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*\.mjs$/i;
const utf8=bytes=>{
 need(Buffer.isBuffer(bytes)&&bytes.length>0&&
  Buffer.from(bytes.toString('utf8'),'utf8').equals(bytes));
 return bytes.toString('utf8');
};
const taskXmlText=bytes=>{
 need(Buffer.isBuffer(bytes)&&bytes.length>0);
 if(bytes.length>=2&&bytes[0]===255&&bytes[1]===254){
  need((bytes.length-2)%2===0);
  const body=bytes.subarray(2),s=body.toString('utf16le');
  need(Buffer.from(s,'utf16le').equals(body));return s;
 }
 if(bytes.length>=4&&bytes[0]===60&&bytes[1]===0&&bytes[2]===63&&bytes[3]===0){
  need(bytes.length%2===0);
  const s=bytes.toString('utf16le');
  need(Buffer.from(s,'utf16le').equals(bytes));return s;
 }
 const s=utf8(bytes);return s.startsWith('\uFEFF')?s.slice(1):s;
};
const canonicalCommand=(bytes,home)=>{
 const value=utf8(bytes);
 // Exact generated Windows CMD grammar, no comments, CALL, IF, FOR, ECHO,
 // second Node invocation, shell extension or arbitrary extra command.
 need(!value.includes('\r\r')&&!value.includes('\0'));
 const lines=value.split('\r\n');
 if(lines.at(-1)==='')lines.pop();
 need((lines.length===6||lines.length===7)&&
  lines[0]==='@echo off'&&
  lines[1]==='setlocal EnableExtensions DisableDelayedExpansion'&&
  lines[4]==='set "RESULT=%ERRORLEVEL%"'&&
  lines.at(-1)==='exit /b %RESULT%');
 const dataRoot=home.slice(0,home.toLowerCase().indexOf('\\pc-writer\\'));
 need(dataRoot.length>0&&lines[2]===`set "ZGMINI_DATA_ROOT=${dataRoot}"`);
 const prefix='"E:\\ZGmini\\runtime\\node.exe" "'+home+'\\versions\\';
 need(lines[3].startsWith(prefix));
 const fragment=lines[3].slice(prefix.length);
 const match=fragment.match(/^([0-9a-f]{16})\\([a-z0-9_./\\-]+\.mjs)"(.*)$/i);
 need(match!==null);
 const version=match[1].toLowerCase(),script=match[2].replaceAll('\\','/'),
  suffix=match[3];
 need(scriptRx.test(script));
 const mode=/^ --scheduled >>"(.+)" 2>&1$/.exec(suffix);
 if(mode){
  need(lines.length===6&&mode[1]===home+'\\SCHEDULE_HISTORY.log');
 }else{
  need(lines.length===7&&lines[5]==='pause'&&
   [' --import "%~1"',' --interactive-cycle',' --list'].includes(suffix));
 }
 const normalized=lines.map((line,index)=>index===3?
  prefix+'{VERSION}\\'+match[2]+'"'+suffix:line).join('\r\n');
 return {version,normalized,script,mode:mode?'scheduled':'manual'};
};

/** Returns VERIFIED only after byte/hash checks, not boolean attestations. */
export async function verifyImmutablePinnedLauncherEvidence({
 evidenceRawBytes,approvedEvidenceSha256,approvedLauncherNames,
 manifest,plan,bridge,lock,
}={}){
 need(SHA64.test(approvedEvidenceSha256??'')&&
  Buffer.isBuffer(evidenceRawBytes)&&evidenceRawBytes.length<=262144&&
  sha(evidenceRawBytes)===approvedEvidenceSha256);
 let evidence;
 try{evidence=JSON.parse(utf8(evidenceRawBytes));}catch{fail();}
 need(evidence?.schema==='ZGMINI_IMMUTABLE_PINNED_LAUNCHER_EVIDENCE_V1'&&
  evidence.profileId===manifest.profileId&&
  evidence.sourceSha===manifest.sourceSha&&
  evidence.taskXmlSha256===manifest.activation.task.beforeXmlSha256&&
  evidence.newVersion===manifest.bundle.version&&
  VERSION.test(evidence.oldVersion??'')&&
  evidence.oldVersion!==evidence.newVersion&&
  typeof evidence.taskVbsName==='string'&&
  /^[a-z0-9][a-z0-9._-]*\.vbs$/i.test(evidence.taskVbsName)&&
  Array.isArray(approvedLauncherNames)&&
  approvedLauncherNames.some(name=>
   name.toLowerCase()===evidence.taskVbsName.toLowerCase())&&
  !manifest.activation.launchers.some(item=>
   item.name.toLowerCase()===evidence.taskVbsName.toLowerCase())&&
  SHA64.test(evidence.taskVbsSha256??'')&&
  Array.isArray(evidence.oldFiles)&&evidence.oldFiles.length>0&&
  evidence.oldFiles.length<=256);
 const liveTask=await bridge.readTaskDefinition({profileId:manifest.profileId,
  taskName:manifest.activation.task.name});
 need(Buffer.isBuffer(liveTask?.xmlBytes)&&
  sha(liveTask.xmlBytes)===evidence.taskXmlSha256);
 const liveXml=taskXmlText(liveTask.xmlBytes);
 const actions=[...liveXml.matchAll(/<Exec(?:\s[^>]*)?>([\s\S]*?)<\/Exec>/gi)];
 need(actions.length===1);
 const command=actions[0][1].match(/<Command>([^<]*)<\/Command>/i)?.[1]??'';
 const args=actions[0][1].match(/<Arguments>([^<]*)<\/Arguments>/i)?.[1]??'';
 const parsedArgs=args.replaceAll('&quot;','"').replaceAll('&amp;','&');
 need(/^(?:(?:[cC]:\\Windows\\System32\\)?)(?:wscript|cscript)(?:\.exe)?$/i.test(command)&&
  parsedArgs.toLowerCase()==='"'+(plan.home+'\\'+evidence.taskVbsName).toLowerCase()+'"');
 const fixedVbs=await bridge.readLauncherBytes({profileId:manifest.profileId,
  launcherName:evidence.taskVbsName});
 need(Buffer.isBuffer(fixedVbs)&&sha(fixedVbs)===evidence.taskVbsSha256);
 const fixedVbsLines=utf8(fixedVbs).split('\r\n');
 if(fixedVbsLines.at(-1)==='')fixedVbsLines.pop();
 const scheduledCmd=evidence.taskVbsName.replace(/\.vbs$/i,'.cmd');
 need(fixedVbsLines.length===4&&
  fixedVbsLines[0]==='Option Explicit'&&
  fixedVbsLines[1]==='Dim shell'&&
  fixedVbsLines[2]==='Set shell = CreateObject("WScript.Shell")'&&
  fixedVbsLines[3]===
   'WScript.Quit shell.Run("""'+plan.home+'\\'+scheduledCmd+'""", 0, True)'&&
  manifest.activation.launchers.some(item=>item.name===scheduledCmd));
 const oldFiles=evidence.oldFiles;
 const seen=new Set();
 let totalOld=0;
 for(const item of oldFiles){
  need(item&&pathRx.test(item.path??'')&&VERSION.test(evidence.oldVersion)&&
   SHA64.test(item.sha256??'')&&Number.isSafeInteger(item.bytes)&&item.bytes>=0&&
   !seen.has(item.path.toLowerCase())&&
   !item.path.split('/').some(seg=>/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(seg)));
  seen.add(item.path.toLowerCase());
  totalOld+=item.bytes;
 }
 need(totalOld<=33554432);
 const fileListSha256=sha(Buffer.from(JSON.stringify([...oldFiles].sort((a,b)=>
  a.path<b.path?-1:a.path>b.path?1:0))));
 const old=await bridge.inspectImmutableVersion({lock,
  profileId:manifest.profileId,version:evidence.oldVersion,
  approvedFiles:oldFiles,fileListSha256});
 need(old?.exists===true&&old.exactVerified===true&&
  old.fileListSha256===fileListSha256&&old.fileCount===oldFiles.length);
 need(Array.isArray(evidence.launcherNames)&&
  evidence.launcherNames.length===manifest.activation.launchers.length&&
  new Set(evidence.launcherNames.map(x=>x.toLowerCase())).size===
   evidence.launcherNames.length);
 let executedPath=null;
 for(const item of manifest.activation.launchers){
  need(evidence.launcherNames.some(name=>name===item.name)&&
   item.name.toLowerCase().endsWith('.cmd'));
  const before=await bridge.readLauncherBytes({profileId:manifest.profileId,
   launcherName:item.name});
  const after=await bridge.readApprovedActivationBytes({
   sourceSha:manifest.sourceSha,kind:'launcher',name:item.name});
  need(Buffer.isBuffer(before)&&sha(before)===item.beforeSha256&&
   Buffer.isBuffer(after)&&sha(after)===item.afterSha256);
  const oldCmd=canonicalCommand(before,plan.home),newCmd=canonicalCommand(after,plan.home);
  need(oldCmd.version===evidence.oldVersion&&
   newCmd.version===evidence.newVersion&&
   oldCmd.normalized===newCmd.normalized);
  // Same normalized CMD => all Node binary, flags, environment, source path,
  // and argument bytes remain unchanged; only immutable version differs.
  const script=newCmd.script;
  need(scriptRx.test(script)&&manifest.bundle.files.some(f=>f.path===script)&&
   oldFiles.some(f=>f.path===script));
  if(executedPath!==null)need(executedPath===script);
  executedPath=script;
 }
 need(executedPath!==null);
 const oldSource=await bridge.readInstalledVersionFile({
  profileId:manifest.profileId,version:evidence.oldVersion,path:executedPath});
 const newSource=await bridge.readPinnedSourceBlob({
  sourceSha:manifest.sourceSha,branch:manifest.sourceBranch,path:executedPath});
 const oldEntry=oldFiles.find(f=>f.path===executedPath);
 const newEntry=manifest.bundle.files.find(f=>f.path===executedPath);
 need(Buffer.isBuffer(oldSource)&&oldSource.length===oldEntry.bytes&&
  sha(oldSource)===oldEntry.sha256&&Buffer.isBuffer(newSource)&&
  newSource.length===newEntry.bytes&&sha(newSource)===newEntry.sha256);
 // Source bytes/CLI shape are proven, but matching string markers in source
 // (possibly comments) DO NOT prove that both entrypoint call paths honor the
 // same exclusive lock or cross-read DB/checkpoint schema. That still needs an
 // independently approved old/new live-fixture compatibility transcript.
 return {strategy:'IMMUTABLE_VERSION_PINNED_LAUNCHER_CANDIDATE_ONLY',
  evidenceSha256:approvedEvidenceSha256,oldVersion:evidence.oldVersion,
  newVersion:evidence.newVersion,runtimeCompatibilityProven:false};
}
