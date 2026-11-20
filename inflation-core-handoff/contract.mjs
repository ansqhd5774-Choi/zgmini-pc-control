// W01 Core-owned execution: SOURCE-ONLY explicit V3 admission contract.
// This is NOT an approval, installed receiver, Core transport or Issue ingress.
// Reuses the existing W01 official-static source/target and trust model.
// V1/V2 external-B authorization remains unchanged and cannot be promoted.
import {createHash} from 'node:crypto';
import {
 CONTROL_REPO,OWNER,SCOPE,SOURCE_ROOT,DATA_ROOT,
 URLS,TARGETS,MAX_BYTES,
} from '../inflation-manual-b/contract.mjs';

export const CORE_HANDOFF_REQUEST_SCHEMA='ZGMINI_INFLATION_CORE_HANDOFF_REQUEST_V1';
export const CORE_HANDOFF_APPROVAL_SCHEMA='ZGMINI_INFLATION_CORE_HANDOFF_APPROVAL_V3';
export const CORE_HANDOFF_ISSUE_TITLE='pc-inflation-core-owned-official-once';
export const CORE_HANDOFF_ISSUE_LABEL='pc-writer-b-install';
export const CORE_HANDOFF_OPERATION='inflation-core-owned-official';
export const CORE_HANDOFF_MODE='CURRENT_CORE_OWNED_LOCK';
export const CORE_HANDOFF_DELIVERY='AUTHENTICATED_EXISTING_CORE_ONLY';
export const CORE_HANDOFF_SOURCE_FILES=Object.freeze([
 'scripts/pc-writer/local-cycle.mjs',
 'scripts/pc-writer/core-lock-owned-witness.mjs',
 'scripts/pc-writer/inflation-core-owned-lock-proof.mjs',
 'scripts/pc-writer/inflation-core-owned-static-once.mjs',
 'scripts/pc-writer/inflation-core-owned-static-ops.mjs',
 'scripts/pc-writer/inflation-causal-candidate-manual-official-r1.mjs',
 'scripts/pc-writer/inflation-causal-candidate-manual-official-store-r1.mjs',
 'lib/diagnostic-layer/xlsx-lite.mjs',
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const FILE=/^approvals\/inflation-core-handoff\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const REQUEST_KEYS=['schema','requestId','chatId','operation','controlRepository',
 'approvalManifestPath','approvalManifestSha256'];
const MANIFEST_KEYS=['schema','status','scope','sourceRoot','dataRoot',
 'coreExecution','delivery','runCount','sourceSha','sourceFiles','providerUrls',
 'targetFiles','maxBytes','timeoutMs','allowDbWrites','allowD1Writes',
 'allowTaskChanges','allowSourceChanges','allowOtherWrites'];
const authenticated=new WeakSet();
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>isObject(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const sameMap=(a,b)=>exact(a,Object.keys(b))&&
 Object.entries(b).every(([k,v])=>a[k]===v);
const sha256=b=>createHash('sha256').update(b).digest('hex');
function approveManifest(m){
 need(exact(m,MANIFEST_KEYS)&&m.schema===CORE_HANDOFF_APPROVAL_SCHEMA&&
  m.status==='APPROVED_B'&&m.scope===SCOPE&&m.sourceRoot===SOURCE_ROOT&&
  m.dataRoot===DATA_ROOT&&m.coreExecution===CORE_HANDOFF_MODE&&
  m.delivery===CORE_HANDOFF_DELIVERY&&m.runCount===1&&
  m.timeoutMs===40_000&&SHA40.test(m.sourceSha??'')&&
  sameMap(m.providerUrls,URLS)&&sameMap(m.targetFiles,TARGETS)&&
  sameMap(m.maxBytes,MAX_BYTES)&&
  ['allowDbWrites','allowD1Writes','allowTaskChanges',
   'allowSourceChanges','allowOtherWrites'].every(k=>m[k]===false),
  'INFL_CORE_HANDOFF_MANIFEST_EFFECT_STOP');
 need(Array.isArray(m.sourceFiles)&&
  m.sourceFiles.length===CORE_HANDOFF_SOURCE_FILES.length&&
  m.sourceFiles.every((x,i)=>exact(x,['path','sha256'])&&
   x.path===CORE_HANDOFF_SOURCE_FILES[i]&&SHA64.test(x.sha256??'')),
  'INFL_CORE_HANDOFF_SOURCE_CLOSURE_STOP');
 return m;
}
function eventRequest(event,env){
 need(env?.GITHUB_REPOSITORY===CONTROL_REPO&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_ACTOR===OWNER&&env.GITHUB_RUN_ATTEMPT==='1'&&
  SHA40.test(env.GITHUB_SHA??'')&&event?.action==='opened'&&
  event.repository?.full_name===CONTROL_REPO&&
  event.repository.private===true&&event.sender?.login===OWNER&&
  event.issue?.user?.login===OWNER&&!event.issue.pull_request&&
  event.issue.title===CORE_HANDOFF_ISSUE_TITLE&&
  event.issue.labels?.some(x=>x.name===CORE_HANDOFF_ISSUE_LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'INFL_CORE_HANDOFF_EVENT_AUTH_STOP');
 let req;
 try{req=JSON.parse(event.issue.body);}catch{stop('INFL_CORE_HANDOFF_REQUEST_JSON_STOP');}
 need(exact(req,REQUEST_KEYS)&&req.schema===CORE_HANDOFF_REQUEST_SCHEMA&&
  req.operation===CORE_HANDOFF_OPERATION&&req.controlRepository===CONTROL_REPO&&
  UUID.test(req.requestId??'')&&UUID.test(req.chatId??'')&&
  FILE.test(req.approvalManifestPath??'')&&
  SHA64.test(req.approvalManifestSha256??''),
  'INFL_CORE_HANDOFF_REQUEST_SCOPE_STOP');
 return req;
}
// Only call from a pinned, trusted GitHub Issue Windows receiver after
// verifying immutable git HEAD manifest bytes and worktree preimage.
export function authorizeCoreOwnedHandoff({event,env,manifestBytes}={}){
 const req=eventRequest(event,env);
 need(Buffer.isBuffer(manifestBytes)&&
  manifestBytes.length>=250&&manifestBytes.length<=8192&&
  sha256(manifestBytes)===req.approvalManifestSha256,
  'INFL_CORE_HANDOFF_MANIFEST_HASH_STOP');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'));}catch{
  stop('INFL_CORE_HANDOFF_MANIFEST_JSON_STOP');
 }
 approveManifest(manifest);
 const authorization=Object.freeze({
  request:Object.freeze(req),manifest:Object.freeze(manifest),
  issueNumber:event.issue.number,controlSha:env.GITHUB_SHA,
 });
 authenticated.add(authorization);
 return authorization;
}
export function assertAuthenticatedCoreHandoff(value){
 need(isObject(value)&&authenticated.has(value),
  'INFL_CORE_HANDOFF_AUTH_OBJECT_STOP');
 return value;
}
// No envelope can be constructed from an arbitrary flag/request JSON.
// Receiver and actual Core-side transport still require an explicit approved
// implementation and owner-proven readback; this module does not emit files.

/**
 * Boundary for the existing zgmini Core-owned coordinator, not an executable
 * message or a transferable grant. Only a branded auth from the trusted,
 * pinned receiver can be projected to the coordinator's exact fields.
 */
export function projectCoreOwnedTransactionApproval(auth){
 const checked=assertAuthenticatedCoreHandoff(auth);
 const m=checked.manifest;
 return Object.freeze({
  status:m.status,scope:m.scope,
  requestId:checked.request.requestId,
  manifestSha256:checked.request.approvalManifestSha256,
  runCount:m.runCount,coreExecution:m.coreExecution,
  exactOfficialSources:sameMap(m.providerUrls,URLS)&&
   sameMap(m.maxBytes,MAX_BYTES),
  exactTwoTargets:sameMap(m.targetFiles,TARGETS),
  dbWrites:m.allowDbWrites, d1Writes:m.allowD1Writes,
  taskChanges:m.allowTaskChanges,sourceChanges:m.allowSourceChanges,
 });
}
