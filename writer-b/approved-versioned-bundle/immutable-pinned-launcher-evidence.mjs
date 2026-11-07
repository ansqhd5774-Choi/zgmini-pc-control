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
const escapeRx=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const utf8=bytes=>{
 need(Buffer.isBuffer(bytes)&&bytes.length>0&&
  Buffer.from(bytes.toString('utf8'),'utf8').equals(bytes));
 return bytes.toString('utf8');
};
const canonicalCommand=(bytes,home)=>{
 const value=utf8(bytes),prefix=home+'\\versions\\';
 const pattern=new RegExp(escapeRx(prefix)+'([0-9a-f]{16})\\\\','gi');
 const versions=[...value.matchAll(pattern)];
 need(versions.length===1);
 const item=versions[0],version=item[1].toLowerCase();
 // Exactly one pinned Node entrypoint: no dynamic ACTIVE_RUNTIME indirection.
 need(value.includes('E:\\ZGmini\\runtime\\node.exe')&&
  !value.includes('ACTIVE_RUNTIME')&&!value.includes('%VERSION%'));
 const replaced=value.slice(0,item.index)+prefix+'{VERSION}\\'+
  value.slice(item.index+item[0].length);
 return {version,normalized:replaced};
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
  typeof evidence.lockPathMarker==='string'&&
  evidence.lockPathMarker.includes('scheduled.lock')&&
  typeof evidence.exclusiveLockMarker==='string'&&
  evidence.exclusiveLockMarker.includes('wx')&&
  typeof evidence.dbSchemaMarker==='string'&&
  evidence.dbSchemaMarker.length>=12&&
  typeof evidence.checkpointMarker==='string'&&
  evidence.checkpointMarker.length>=12&&
  Array.isArray(evidence.oldFiles)&&evidence.oldFiles.length>0&&
  evidence.oldFiles.length<=256);
 const liveTask=await bridge.readTaskDefinition({profileId:manifest.profileId,
  taskName:manifest.activation.task.name});
 need(Buffer.isBuffer(liveTask?.xmlBytes)&&
  sha(liveTask.xmlBytes)===evidence.taskXmlSha256);
 const liveXml=utf8(liveTask.xmlBytes);
 const actions=[...liveXml.matchAll(/<Exec(?:\s[^>]*)?>([\s\S]*?)<\/Exec>/gi)];
 need(actions.length===1);
 const command=actions[0][1].match(/<Command>([^<]*)<\/Command>/i)?.[1]??'';
 const args=actions[0][1].match(/<Arguments>([^<]*)<\/Arguments>/i)?.[1]??'';
 need(/(?:^|\\)(?:wscript|cscript)(?:\.exe)?$/i.test(command)&&
  args.toLowerCase().includes((plan.home+'\\'+evidence.taskVbsName).toLowerCase()));
 const fixedVbs=await bridge.readLauncherBytes({profileId:manifest.profileId,
  launcherName:evidence.taskVbsName});
 need(Buffer.isBuffer(fixedVbs)&&sha(fixedVbs)===evidence.taskVbsSha256);
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
  const pathEnd='\\versions\\{VERSION}\\';
  const offset=newCmd.normalized.indexOf(pathEnd);
  need(offset>=0);
  const tail=newCmd.normalized.slice(offset+pathEnd.length);
  const script=tail.split('"')[0].replaceAll('\\','/');
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
 const beforeProgram=utf8(oldSource),afterProgram=utf8(newSource);
 for(const fragment of [evidence.lockPathMarker,evidence.exclusiveLockMarker,
  evidence.dbSchemaMarker,evidence.checkpointMarker]){
  need(beforeProgram.includes(fragment)&&afterProgram.includes(fragment));
 }
 // A committed external DB effect of an already-running process is never
 // reverted by file-CAS rollback. Only a pinned *identical* lock/schema model
 // can allow the in-flight old/new process overlap proposed by this strategy.
 return {strategy:'IMMUTABLE_VERSION_PINNED_LAUNCHER',
  evidenceSha256:approvedEvidenceSha256,oldVersion:evidence.oldVersion,
  newVersion:evidence.newVersion};
}
