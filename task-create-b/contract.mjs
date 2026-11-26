// Source-only, fixed-effect W06 Task creation contract. No Windows I/O here.
// The receiver must read the manifest from its exact committed control checkout.
import {createHash} from 'node:crypto';

export const ISSUE_TITLE='pc-writer-task-create-once';
export const ISSUE_LABEL='pc-writer-task-create-b';
export const REQUEST_SCHEMA='ZGMINI_PC_TASK_CREATE_B_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_PC_TASK_CREATE_B_APPROVAL_V1';
export const RESULT_SCHEMA='ZGMINI_PC_TASK_CREATE_B_RESULT_V1';
export const TASK='ZGMINI-PC-CNN-Minute';
export const INSTALLED_SOURCE='393cee0da46515ff056543173fcd1253a858b3d7';
export const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const WRAPPER=String.raw`E:\ZGmini\data\pc-writer\run-local-cnn-minute.vbs`;
const OWNER='ansqhd5774-Choi';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const H64=/^[a-f0-9]{64}$/;
const keys=(v,required)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===required.length&&required.every(k=>Object.hasOwn(v,k));
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const check=(v,c)=>{if(!v)stop(c);};
const sha=value=>createHash('sha256').update(value).digest('hex');
const authorized=new WeakSet();
export const sha256=sha;

// This is deliberately NOT a generic Task/command/URL authorization surface.
// Future capabilities must use the same independently approved effect contract.
const REQUEST_KEYS=['schema','requestId','operation','approvalManifestPath',
 'approvalManifestSha256'];
const MANIFEST_KEYS=['schema','status','scope','taskName','installedSourceSha',
 'candidateSourceSha','candidateFileSha256','sourceRoot','wrapperPath','launcherSha256','disabledTemplateSha256',
 'enabledTemplateSha256','coreTaskXmlSha256','sidecarSourceSha256',
 'allowCnnHttpRequests','allowSqliteObservationWrites',
 'allowD1PublicProjectionWrites','allowOtherTaskChanges','runCount'];

export function authorizeTaskCreateB({event,manifestBytes,manifestCommitted=false}={}){
 const issue=event?.issue;
 check(event?.action==='opened'&&issue?.title===ISSUE_TITLE&&
  issue?.user?.login?.toLowerCase()===OWNER.toLowerCase()&&
  issue?.labels?.some(x=>x?.name===ISSUE_LABEL)&&manifestCommitted===true,
  'TASK_CREATE_B_OWNER_OR_COMMIT_STOP');
 let request,manifest;
 try{request=JSON.parse(issue.body);manifest=JSON.parse(manifestBytes.toString('utf8'));}
 catch{stop('TASK_CREATE_B_REQUEST_OR_MANIFEST_JSON_STOP');}
 check(keys(request,REQUEST_KEYS)&&request.schema===REQUEST_SCHEMA&&
  request.operation==='task-create-once'&&UUID.test(request.requestId??'')&&
  /^approvals\/task-create-b\/w06-cnn-minute-[a-z0-9-]{8,60}\.json$/.test(request.approvalManifestPath??'')&&
  H64.test(request.approvalManifestSha256??'')&&
  Buffer.isBuffer(manifestBytes)&&manifestBytes.length<8192&&
  sha(manifestBytes)===request.approvalManifestSha256,
  'TASK_CREATE_B_REQUEST_SCOPE_STOP');
 check(keys(manifest,MANIFEST_KEYS)&&
  manifest.schema===APPROVAL_SCHEMA&&manifest.status==='APPROVED_B'&&
  manifest.scope==='W06_ONE_TASK_CREATE_AND_ENABLE_WITH_CNN_RUNTIME_EFFECTS'&&
  manifest.taskName===TASK&&manifest.installedSourceSha===INSTALLED_SOURCE&&
  /^[a-f0-9]{40}$/.test(manifest.candidateSourceSha??'')&&
  H64.test(manifest.candidateFileSha256??'')&&
  manifest.sourceRoot===SOURCE_ROOT&&manifest.wrapperPath===WRAPPER&&
  H64.test(manifest.launcherSha256??'')&&
  H64.test(manifest.disabledTemplateSha256??'')&&
  H64.test(manifest.enabledTemplateSha256??'')&&
  H64.test(manifest.coreTaskXmlSha256??'')&&
  H64.test(manifest.sidecarSourceSha256??'')&&
  manifest.allowCnnHttpRequests===true&&
  manifest.allowSqliteObservationWrites===true&&
  manifest.allowD1PublicProjectionWrites===true&&
  manifest.allowOtherTaskChanges===false&&manifest.runCount===1,
  'TASK_CREATE_B_APPROVAL_SCOPE_STOP');
 const proof=Object.freeze({request:Object.freeze(request),manifest:Object.freeze(manifest)});
 authorized.add(proof);
 return proof;
}

export function verifyTaskCreateBPreimage(proof,preimage){
 check(authorized.has(proof),'TASK_CREATE_B_AUTH_REQUIRED');
 const m=proof.manifest;
 check(preimage?.taskExists===false&&preimage?.wrapperExists===false&&
  preimage.installedSourceSha===m.installedSourceSha&&
  preimage.configSourceSha===m.installedSourceSha&&
  preimage.coreTaskXmlSha256===m.coreTaskXmlSha256&&
  preimage.sidecarSourceSha256===m.sidecarSourceSha256&&
  preimage.coreTaskEnabled===true&&
  preimage.unrelatedTaskMutation===false,
  'TASK_CREATE_B_PREIMAGE_STOP');
 return true;
}

// Hash an exact XML template without exporting the operating user's principal
// or fixing the minute-boundary start time in a public approval manifest.
export function normalizedW06TaskTemplate(raw){
 check(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=131072&&
  raw.length%2===0,'TASK_CREATE_B_XML_BYTES_STOP');
 const xml=raw.toString('utf16le');
 check(Buffer.from(xml,'utf16le').equals(raw),'TASK_CREATE_B_XML_ENCODING_STOP');
 const dates=[...xml.matchAll(/<StartBoundary>([^<]+)<\/StartBoundary>/g)];
 const users=[...xml.matchAll(/<UserId>([^<]+)<\/UserId>/g)];
 check(dates.length===1&&users.length===1&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:00(?:\.000)?Z$/.test(dates[0][1])&&
  Number.isFinite(Date.parse(dates[0][1]))&&users[0][1].length<=512,
  'TASK_CREATE_B_XML_DYNAMIC_SCOPE_STOP');
 const template=xml.replace(dates[0][0],
  '<StartBoundary>{{UTC_MINUTE}}</StartBoundary>')
  .replace(users[0][0],'<UserId>{{OPERATING_PRINCIPAL}}</UserId>');
 return sha(Buffer.from(template,'utf16le'));
}

export function verifyTaskCreateBCandidate(proof,candidate){
 check(authorized.has(proof),'TASK_CREATE_B_AUTH_REQUIRED');
 const m=proof.manifest;
 check(Buffer.isBuffer(candidate?.launcher)&&candidate.launcher.length<=8192&&
  Buffer.isBuffer(candidate?.disabledXml)&&Buffer.isBuffer(candidate?.enabledXml)&&
  sha(candidate.launcher)===m.launcherSha256&&
  normalizedW06TaskTemplate(candidate.disabledXml)===m.disabledTemplateSha256&&
  normalizedW06TaskTemplate(candidate.enabledXml)===m.enabledTemplateSha256,
  'TASK_CREATE_B_CANDIDATE_HASH_STOP');
 const xml=candidate.enabledXml.toString('utf16le');
 const disabled=candidate.disabledXml.toString('utf16le');
 const wrapper=candidate.launcher.toString('utf8');
 const update=xml.replace(/(<Settings>[\s\S]*?<Enabled>)true(<\/Enabled>)/,
  '$1false$2');
 check(update!==xml&&disabled===update&&
  xml.includes('<Interval>PT1M</Interval>')&&
  xml.includes('<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>')&&
  xml.includes('<ExecutionTimeLimit>PT30M</ExecutionTimeLimit>')&&
  xml.includes('<Settings>')&&xml.includes('<Enabled>true</Enabled>')&&
  disabled.includes('<Enabled>false</Enabled>')&&
  xml.includes('run-local-cnn-minute.vbs')&&
  wrapper.includes('local-cycle.mjs')&&
  wrapper.includes('--cnn-minute --publish')&&
  !wrapper.includes('schtasks')&&
  !wrapper.includes('--korea'),
  'TASK_CREATE_B_CANDIDATE_SCOPE_STOP');
 return true;
}
