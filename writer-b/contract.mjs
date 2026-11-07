// Shared, source-only Writer B authorization and file-scope contract.
// This module never executes a shell, opens a PC file or applies a change.
import {createHash} from 'node:crypto';
import {validateInsertions} from './insert-only-patch.mjs';

export const OPERATION='pc-writer-source-install';
export const ISSUE_TITLE='pc-writer-source-install';
export const ISSUE_LABEL='pc-writer-b-install';
export const REQUEST_SCHEMA='ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1';
export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_REPO='ansqhd5774-Choi/zgmini';
export const ACTOR='ansqhd5774-Choi';
export const SCOPE='PC_WRITER_APPROVED_FILE_OVERLAY_ONLY';

const SHA40=/^[0-9a-f]{40}$/i;
const SHA64=/^[0-9a-f]{64}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANIFEST_PATH=/^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const RELATIVE=/^(?:scripts\/pc-writer|lib|worker)\/(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*\.mjs$/i;
const FORBIDDEN_SEGMENTS=new Set(['.','..']);
// Process-local provenance seal: the transaction must not accept fabricated
// {registeredB:true,exactOneShot:true} flags from arbitrary caller JSON.
// A future trusted Windows B adapter must fetch approved manifest bytes from
// the pinned control source, authorize the Issue, and call the coordinator in
// the SAME Node process. This does not by itself install/register that adapter.
const VERIFIED_ISSUES=new WeakSet();
const REQUEST_KEYS=['schema','requestId','chatId','operation','controlRepository',
  'approvalManifestPath','approvalManifestSha256'];
const APPROVAL_KEYS=['schema','status','scope','sourceRepository','sourceBranch',
  'candidateSourceSha','baseHead','baseConfigSourceSha','sourceRoot','configPath',
  'coreTask','files','protectedFiles','runtimeDependencies',
  'runCount','allowProviderCalls','allowDbChanges',
  'allowD1Writes','allowTaskDefinitionChanges','allowOtherSourceChanges'];
const FILE_KEYS=['path','change','beforeSha256','afterSha256'];
const INSERT_FILE_KEYS=[...FILE_KEYS,'candidateSha256','insertions'];
const PROTECTED_KEYS=['path','sha256'];
const RUNTIME_KEYS=['taskXmlSha256','consumers'];
const CONSUMER_KEYS=['id','kind','path','sha256','dependsOn'];
const RUNTIME_FILE=/^[CE]:\\ZGmini\\data\\pc-writer\\(?:[a-z0-9][a-z0-9._-]*\\){0,5}[a-z0-9][a-z0-9._-]*\.(?:vbs|cmd|mjs|json)$/i;
const ENTRYPOINTS=new Set(['scripts/pc-writer/run-local.mjs',
 'scripts/pc-writer/local-cycle.mjs']);

const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&
  keys.every(key=>Object.hasOwn(x,key));
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(condition,code)=>{if(!condition)fail(code);};
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function isScopedWriterPath(file){
 if(typeof file!=='string'||file.length>180||!RELATIVE.test(file)||
    file.includes('\\')||file.includes('//'))return false;
 return file.split('/').every(seg=>!FORBIDDEN_SEGMENTS.has(seg)&&!seg.startsWith('.'));
}

export function validateWriterBManifest(manifest){
 need(exact(manifest,APPROVAL_KEYS),'WRITER_B_MANIFEST_FIELDS_STOP');
 need(manifest.schema===APPROVAL_SCHEMA&&manifest.status==='APPROVED_B'&&
   manifest.scope===SCOPE&&manifest.runCount===1&&
   manifest.sourceRepository===SOURCE_REPO&&
   /^[a-z0-9][a-z0-9._/-]{0,127}$/i.test(manifest.sourceBranch)&&
   !manifest.sourceBranch.includes('..')&&!manifest.sourceBranch.endsWith('/')&&
   SHA40.test(manifest.candidateSourceSha)&&SHA40.test(manifest.baseHead)&&
   manifest.baseHead===manifest.baseConfigSourceSha&&
   /^E:\\ZGmini\\projects\\[a-z0-9][a-z0-9._-]{0,79}(?:\\[a-z0-9][a-z0-9._-]{0,79}){0,2}$/i
     .test(manifest.sourceRoot)&&
   manifest.configPath==='E:\\ZGmini\\data\\pc-writer\\config.json'&&
   manifest.coreTask==='ZGMINI-PC-Local-Core',
   'WRITER_B_SOURCE_CONTRACT_STOP');
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
   'allowTaskDefinitionChanges','allowOtherSourceChanges'])
  need(manifest[key]===false,'WRITER_B_SIDE_EFFECT_SCOPE_STOP');
 need(Array.isArray(manifest.files)&&manifest.files.length>=1&&
   manifest.files.length<=32&&Array.isArray(manifest.protectedFiles)&&
   manifest.protectedFiles.length<=128,'WRITER_B_FILE_COUNT_STOP');
 const seen=new Set();
 for(const entry of manifest.files){
  const insertMode=Object.hasOwn(entry??{},'insertions');
  need((insertMode?exact(entry,INSERT_FILE_KEYS):exact(entry,FILE_KEYS))&&
    isScopedWriterPath(entry.path)&&
    (entry.change==='M'||entry.change==='A')&&SHA64.test(entry.afterSha256)&&
    (entry.change==='M'?SHA64.test(entry.beforeSha256):entry.beforeSha256===null),
    'WRITER_B_FILE_CONTRACT_STOP');
  if(insertMode){
   need(entry.change==='M'&&SHA64.test(entry.candidateSha256),
    'WRITER_B_INSERT_TARGET_SCOPE_STOP');
   validateInsertions(entry.insertions);
  }
  const norm=entry.path.toLowerCase();
  need(!seen.has(norm),'WRITER_B_FILE_DUPLICATE_STOP');seen.add(norm);
  need(entry.beforeSha256!==entry.afterSha256,'WRITER_B_NOOP_FILE_STOP');
 }
 for(const entry of manifest.protectedFiles){
  need(exact(entry,PROTECTED_KEYS)&&isScopedWriterPath(entry.path)&&
    SHA64.test(entry.sha256),'WRITER_B_PROTECTED_CONTRACT_STOP');
  const norm=entry.path.toLowerCase();
  need(!seen.has(norm),'WRITER_B_PROTECTED_OVERLAP_STOP');seen.add(norm);
 }
 // This is a bounded read-only attestation list, not a license to execute
 // launchers or inspect every file on the PC. The A inventory must enumerate
 // the actually affected VBS/CMD/Sidecar source consumers before approval.
 const deps=manifest.runtimeDependencies;
 need(exact(deps,RUNTIME_KEYS)&&
  (deps.taskXmlSha256===null||SHA64.test(deps.taskXmlSha256??''))&&
  Array.isArray(deps.consumers)&&deps.consumers.length<=24,
  'WRITER_B_RUNTIME_DEPENDENCIES_STOP');
 const declared=new Set();
 for(const entry of deps.consumers){
  need(exact(entry,CONSUMER_KEYS)&&
   /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(entry.id??'')&&
   (entry.kind==='LAUNCHER'||entry.kind==='SIDECAR_SOURCE')&&
   typeof entry.path==='string'&&entry.path.length<=240&&
   RUNTIME_FILE.test(entry.path)&&!entry.path.split('\\').some(x=>x==='..')&&
   SHA64.test(entry.sha256??'')&&Array.isArray(entry.dependsOn)&&
   entry.dependsOn.length>=1&&entry.dependsOn.length<=manifest.files.length&&
   entry.dependsOn.every(p=>manifest.files.some(file=>file.path===p))&&
   new Set(entry.dependsOn).size===entry.dependsOn.length,
   'WRITER_B_RUNTIME_CONSUMER_STOP');
  const id=entry.id.toLowerCase(),file=entry.path.toLowerCase();
  need(!declared.has(id)&&!declared.has(file),'WRITER_B_RUNTIME_DUPLICATE_STOP');
  declared.add(id);declared.add(file);
 }
 if(manifest.files.some(f=>ENTRYPOINTS.has(f.path.toLowerCase())))
  need(SHA64.test(deps.taskXmlSha256??'')&&deps.consumers.length>=1&&
   deps.consumers.some(x=>x.kind==='LAUNCHER'),
   'WRITER_B_ENTRYPOINT_CONSUMER_MISSING_STOP');
 return manifest;
}

export function authorizeWriterBIssue({event,env,manifestBytes}){
 need(env?.GITHUB_REPOSITORY===CONTROL_REPO&&env?.GITHUB_EVENT_NAME==='issues'&&
   env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===ACTOR&&
   env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
   event?.repository?.full_name===CONTROL_REPO&&event.repository.private===true&&
   event?.sender?.login===ACTOR&&event?.issue?.user?.login===ACTOR&&
   !event.issue.pull_request&&event.issue.title===ISSUE_TITLE&&
   event.issue.labels?.some(x=>x.name===ISSUE_LABEL)&&
   Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
   'WRITER_B_ISSUE_AUTH_STOP');
 let request;
 try{request=JSON.parse(event.issue.body);}catch{fail('WRITER_B_ISSUE_JSON_STOP');}
 need(exact(request,REQUEST_KEYS)&&request.schema===REQUEST_SCHEMA&&
   UUID.test(request.requestId)&&UUID.test(request.chatId)&&
   request.operation===OPERATION&&request.controlRepository===CONTROL_REPO&&
   MANIFEST_PATH.test(request.approvalManifestPath)&&
   SHA64.test(request.approvalManifestSha256),
   'WRITER_B_REQUEST_CONTRACT_STOP');
 need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>200&&
   manifestBytes.length<=65536&&
   sha256(manifestBytes)===request.approvalManifestSha256,
   'WRITER_B_MANIFEST_HASH_STOP');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'));}
 catch{fail('WRITER_B_MANIFEST_JSON_STOP');}
 validateWriterBManifest(manifest);
 for(const entry of manifest.files){
  if(Object.hasOwn(entry,'insertions')){
   for(const insertion of entry.insertions)Object.freeze(insertion);
   Object.freeze(entry.insertions);
  }
  Object.freeze(entry);
 }
 for(const entry of manifest.protectedFiles)Object.freeze(entry);
 for(const entry of manifest.runtimeDependencies.consumers){
  Object.freeze(entry.dependsOn);Object.freeze(entry);
 }
 Object.freeze(manifest.files);Object.freeze(manifest.protectedFiles);
 Object.freeze(manifest.runtimeDependencies.consumers);
 Object.freeze(manifest.runtimeDependencies);
 Object.freeze(manifest);
 const authorization=Object.freeze({requestId:request.requestId,chatId:request.chatId,
   manifest,manifestSha256:request.approvalManifestSha256,
   manifestPath:request.approvalManifestPath,controlSha:env.GITHUB_SHA,
   issueNumber:event.issue.number});
 VERIFIED_ISSUES.add(authorization);
 return authorization;
}

export function assertAuthenticatedWriterBIssue(authorization){
 need(object(authorization)&&VERIFIED_ISSUES.has(authorization),
   'WRITER_B_UNVERIFIED_ISSUE_STOP');
 return authorization;
}

export function expectedFileMap(manifest){
 validateWriterBManifest(manifest);
 return Object.fromEntries(manifest.files.map(entry=>[entry.path,entry]));
}

