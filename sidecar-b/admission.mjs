// Exact origin + byte-pinned approval admission for CNN Sidecar B.
// Never reads or modifies operational files. Receiver must supply a trusted
// pinned-control-checkout manifest and an independently attested PC observation.
import {sha256,validateManifest} from './contract.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
export const TITLE='cnn-sidecar-onefile-b-install';
export const LABEL='pc-writer-b-install';
export const REQUEST_SCHEMA='ZGMINI_CNN_SIDECAR_ONEFILE_B_REQUEST_V1';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const PATH=/^approvals\/sidecar-b\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function authorizeSidecarIssue({event,env,manifestBytes,controlHead}){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===OWNER&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
  env.GITHUB_SHA===controlHead&&event?.repository?.full_name===REPO&&
  event.repository.private===true&&event.sender?.login===OWNER&&
  event.issue?.user?.login===OWNER&&!event.issue.pull_request&&
  event.issue.title===TITLE&&
  event.issue.labels?.some(x=>x.name===LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'SIDECAR_B_EVENT_ORIGIN_STOP');
 let request;
 try{request=JSON.parse(event.issue.body);}catch{stop('SIDECAR_B_REQUEST_JSON_STOP');}
 need(exact(request,['schema','requestId','approvalManifestPath',
  'approvalManifestSha256','controlHead'])&&
  request.schema===REQUEST_SCHEMA&&
  typeof request.requestId==='string'&&
  PATH.test(request.approvalManifestPath??'')&&
  SHA64.test(request.approvalManifestSha256??'')&&
  request.controlHead===controlHead,'SIDECAR_B_REQUEST_SCOPE_STOP');
 need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>200&&
  manifestBytes.length<=8192&&
  sha256(manifestBytes)===request.approvalManifestSha256,
  'SIDECAR_B_APPROVAL_BYTES_STOP');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'));}catch{
  stop('SIDECAR_B_APPROVAL_JSON_STOP');
 }
 validateManifest(manifest);
 need(manifest.requestId===request.requestId,
  'SIDECAR_B_REQUEST_MANIFEST_STOP');
 return {request,manifest,manifestSha256:sha256(manifestBytes)};
}
