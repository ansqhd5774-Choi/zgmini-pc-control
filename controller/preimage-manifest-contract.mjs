// Fixed A/read-only scope manifests. Issue inputs may select an approved
// GitHub blob by path + digest, never supply operational paths themselves.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const requireThat=(ok,code)=>{if(!ok)fail(code);};
const exact=(value,keys)=>!!value&&typeof value==='object'&&
 !Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
export const PREIMAGE_MANIFEST_PREFIX='approvals/writer-preimage/';
export const PREIMAGE_SOURCE_ROOT='projects/zgmini-earnings-history-pc-release';
const SCOPE_PATH=/^approvals\/writer-preimage\/[a-z0-9][a-z0-9-]{3,79}\.json$/;
const RELATIVE_FILE=/^(?:lib|worker|scripts\/pc-writer)\/[a-zA-Z0-9][a-zA-Z0-9_./-]{0,150}\.mjs$/;
// Only these two W06 .ts dependencies may be attested by the A preimage scope.
const CNN_TS_DEPENDENCIES=new Set([
 'worker/feed-collectors/fear-greed.ts',
 'worker/public-feed-collectors.ts',
]);
const STAGED_SCHEMA='ZGMINI_WRITER_PREIMAGE_STAGED_V1';
const APPROVAL_SCHEMA='ZGMINI_WRITER_PREIMAGE_SCOPE_APPROVAL_V1';
const STAGE_CODES=new Set(['PREIMAGE_STAGE_AUTH_UNAVAILABLE','PREIMAGE_STAGE_FETCH_STOP',
 'PREIMAGE_STAGE_MANIFEST_HASH_STOP','PREIMAGE_STAGE_MANIFEST_SCOPE_STOP',
 'PREIMAGE_STAGE_EVENT_STOP','PREIMAGE_STAGE_OUTPUT_STOP',
 'PREIMAGE_STAGE_SOURCE_NOT_ATTESTED']);

export function isSafePreimagePath(value){
 return typeof value==='string'&&(RELATIVE_FILE.test(value)||CNN_TS_DEPENDENCIES.has(value))&&value.length<=180&&
  !value.split('/').some(s=>!s||s==='.'||s==='..');
}
export function validatePreimageApproval(bytes,{expectedSha256,manifestPath}={}){
 requireThat(Buffer.isBuffer(bytes)&&bytes.length>30&&bytes.length<=16_384,
  'PREIMAGE_STAGE_MANIFEST_SCOPE_STOP');
 requireThat(typeof manifestPath==='string'&&SCOPE_PATH.test(manifestPath),
  'PREIMAGE_STAGE_MANIFEST_SCOPE_STOP');
 requireThat(typeof expectedSha256==='string'&&/^[0-9a-f]{64}$/.test(expectedSha256)&&
  sha256(bytes)===expectedSha256,'PREIMAGE_STAGE_MANIFEST_HASH_STOP');
 let manifest;
 try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{fail('PREIMAGE_STAGE_MANIFEST_SCOPE_STOP');}
 requireThat(exact(manifest,['schema','status','scope','sourceRoot','files','allowOtherPaths'])&&
  manifest.schema===APPROVAL_SCHEMA&&manifest.status==='APPROVED_A_READONLY'&&
  manifest.scope==='PC_WRITER_APPROVED_SOURCE_PREIMAGE'&&
  manifest.sourceRoot===PREIMAGE_SOURCE_ROOT&&manifest.allowOtherPaths===false&&
  Array.isArray(manifest.files)&&manifest.files.length>=1&&manifest.files.length<=32,
  'PREIMAGE_STAGE_MANIFEST_SCOPE_STOP');
 const seen=new Set();
 for(const item of manifest.files){
  requireThat(exact(item,['path','change'])&&isSafePreimagePath(item.path)&&
   ['M','A'].includes(item.change),'PREIMAGE_STAGE_MANIFEST_SCOPE_STOP');
  const key=item.path.toLowerCase();
  requireThat(!seen.has(key),'PREIMAGE_STAGE_MANIFEST_SCOPE_STOP');seen.add(key);
 }
 return {scope:'APPROVED_MANIFEST',sourceRoot:PREIMAGE_SOURCE_ROOT,
  files:manifest.files.map(x=>({path:x.path,change:x.change})),
  manifestSha256:expectedSha256,manifestPath};
}

export function preimageStageFile(env){
 const run=String(env?.GITHUB_RUN_ID??''),attempt=String(env?.GITHUB_RUN_ATTEMPT??'1');
 requireThat(/^\d{1,18}$/.test(run)&&/^[1-9]\d{0,4}$/.test(attempt)&&
  typeof env?.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
  'PREIMAGE_STAGE_EVENT_STOP');
 return path.join(env.RUNNER_TEMP,`zgmini-preimage-${run}-${attempt}.json`);
}

export function readStagedPreimageScope({env,request,fileSystem=fs}={}){
 if(!Object.hasOwn(request,'preimageManifestPath'))return null;
 const location=preimageStageFile(env);
 let value;
 try{
  const stat=fileSystem.lstatSync(location);
  requireThat(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>10&&stat.size<32_768,
   'PREIMAGE_STAGE_OUTPUT_STOP');
  value=JSON.parse(fileSystem.readFileSync(location,'utf8'));
 }catch{fail('PREIMAGE_STAGE_OUTPUT_STOP');}
 if(value.status==='BLOCKED'){
  fail(STAGE_CODES.has(value.code)?value.code:'PREIMAGE_STAGE_OUTPUT_STOP');
 }
 requireThat(exact(value,['schema','status','requestId','githubSha','manifestPath',
  'manifestSha256','manifestBase64'])&&value.schema===STAGED_SCHEMA&&
  value.status==='READY'&&value.requestId===request.requestId&&
  value.manifestPath===request.preimageManifestPath&&
  value.manifestSha256===request.preimageManifestSha256&&
  /^[0-9a-f]{40}$/.test(value.githubSha)&&
  value.githubSha===String(env.GITHUB_SHA??'').toLowerCase()&&
  typeof value.manifestBase64==='string'&&value.manifestBase64.length<22_000,
  'PREIMAGE_STAGE_OUTPUT_STOP');
 const bytes=Buffer.from(value.manifestBase64,'base64');
 requireThat(bytes.toString('base64')===value.manifestBase64,
  'PREIMAGE_STAGE_OUTPUT_STOP');
 return validatePreimageApproval(bytes,{expectedSha256:request.preimageManifestSha256,
  manifestPath:request.preimageManifestPath});
}

export function stagedPayload({request,githubSha,bytes}){
 requireThat(/^[0-9a-f]{40}$/.test(githubSha),'PREIMAGE_STAGE_EVENT_STOP');
 validatePreimageApproval(bytes,{expectedSha256:request.preimageManifestSha256,
  manifestPath:request.preimageManifestPath});
 return {schema:STAGED_SCHEMA,status:'READY',requestId:request.requestId,
  githubSha,manifestPath:request.preimageManifestPath,
  manifestSha256:request.preimageManifestSha256,
  manifestBase64:bytes.toString('base64')};
}

export function blockedPayload(code){
 return {status:'BLOCKED',code:STAGE_CODES.has(code)?code:'PREIMAGE_STAGE_OUTPUT_STOP'};
}
