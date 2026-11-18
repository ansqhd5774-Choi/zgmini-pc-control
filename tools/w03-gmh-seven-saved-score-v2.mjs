// W03 extension for EXISTING w03-gmh-seven-private-score-once B lane.
// New source is fixed to reviewed main SHA, no caller-supplied path/command.
// Never invokes a provider or D1. Preserve old V1 B authorization separately.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const APPROVED_SAVED_SOURCE_SHA='0dcc572ca27f311e60baec826d0e75557e0185a8';
export const SAVED_SCHEMA='ZGMINI_W03_GMH_SEVEN_PRIVATE_SCORE_REQUEST_V2';
const REQUIRED_FILES=Object.freeze({
 'scripts/pc-writer/theme-gmh-seven-pc-parity-r1.mjs':
  '45393297c47f5e54145cce14e6c488a97a2c5652',
 'scripts/pc-writer/theme-gmh-seven-saved-input-r1.mjs':
  'c03539ae586740465c6b618c059e1dbef96062ee',
 'scripts/pc-writer/theme-gmh-seven-private-bridge.mjs':
  '78b85895cfc8160371403d01081d906d485df3c6',
 'scripts/pc-writer/theme-seven-gmh-history-r1.mjs':
  'c8d3ea62c6c5f7aa65020c97b2d72cb217061a82',
 'scripts/pc-writer/theme-optional-score-r188.mjs':
  '4be861428316e8056325f7d00e97b0deaa13ef04',
 'worker/theme-etf-only-public.mjs':
  'bb3f56c5f3a62b7dfa4aae19a1b18381611e6335',
});
const root='E:\ZGmini\data',node='E:\ZGmini\runtime\node.exe';
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const need=(x,c)=>{if(!x)fail(c);};
const HEX40=/^[a-f0-9]{40}$/;
const HEX64=/^[a-f0-9]{64}$/;
const gitBlob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function exactHead(sourceRoot){
 const git=['C:\Program Files\Git\cmd\git.exe',
  'C:\Program Files\Git\bin\git.exe'].find(x=>fs.existsSync(x));
 need(git,'W03_GMH_SCORE_V2_GIT_MISSING_STOP');
 const r=spawnSync(git,['-C',sourceRoot,'rev-parse','HEAD'],{
  shell:false,windowsHide:true,timeout:15000,encoding:'utf8'});
 need(r.status===0&&HEX40.test(r.stdout?.trim()??''),
  'W03_GMH_SCORE_V2_SOURCE_HEAD_UNKNOWN');
 return r.stdout.trim();
}
export function verifySavedCandidate({sourceRoot,head=exactHead,
 platform=process.platform,files=fs}={}){
 need(platform==='win32'&&typeof sourceRoot==='string'&&
  path.isAbsolute(sourceRoot),'W03_GMH_SCORE_V2_WINDOWS_SOURCE_STOP');
 const canonical=files.realpathSync.native(sourceRoot);
 need(head(canonical)===APPROVED_SAVED_SOURCE_SHA,
  'W03_GMH_SCORE_V2_PINNED_SOURCE_STOP');
 for(const [rel,digest] of Object.entries(REQUIRED_FILES)){
  const target=path.join(canonical,...rel.split('/'));
  const pre=files.lstatSync(target),real=files.realpathSync.native(target);
  const within=path.relative(canonical,real);
  need(pre.isFile()&&!pre.isSymbolicLink()&&
   within!==''&&within!=='..'&&!within.startsWith('..'+path.sep)&&
   !path.isAbsolute(within)&&pre.size>0&&pre.size<90000,
   'W03_GMH_SCORE_V2_REQUIRED_SOURCE_STOP');
  const bytes=files.readFileSync(target),post=files.lstatSync(target);
  need(bytes.length===pre.size&&pre.mtimeMs===post.mtimeMs&&
   gitBlob(bytes)===digest,
   'W03_GMH_SCORE_V2_SOURCE_BLOB_DRIFT');
 }
 return path.join(canonical,'scripts','pc-writer','theme-gmh-seven-pc-parity-r1.mjs');
}
export function launchSavedScore(script,{platform=process.platform,
 fileExists=fs.existsSync,spawn=spawnSync}={}){
 need(platform==='win32'&&fileExists(node)&&
  typeof script==='string'&&path.isAbsolute(script),
  'W03_GMH_SCORE_V2_PC_RUNTIME_STOP');
 const r=spawn(node,[script,'--pc-private-score-once'],{
  cwd:path.dirname(script),shell:false,windowsHide:true,
  timeout:420000,maxBuffer:6000,encoding:'utf8',
  env:{SystemRoot:process.env.SystemRoot??'C:\Windows',
   PATH:process.env.PATH??'',ZGMINI_DATA_ROOT:root}
 });
 let value;
 try{value=JSON.parse(r.stdout.trim());}catch{
  return {status:'STOP',code:'W03_GMH_SCORE_V2_CHILD_OUTPUT_STOP'};
 }
 const good=r.status===0&&
  value?.schema==='ZGMINI_W03_GMH_SEVEN_PC_PARITY_V1'&&
  value.status==='PRIVATE_GMH_7X252_PARITY_VERIFIED_NOT_PUBLISHED'&&
  value.sourceProvider==='GETMARKETHISTORY_1H_PRIVATE'&&
  /^\d{4}-\d\d-\d\d$/.test(value.observationDate??'')&&
  Number.isSafeInteger(value.commonSessionCount)&&
  value.commonSessionCount>=628&&value.commonSessionCount<=1500&&
  value.historyPoints===1764&&
  Number.isSafeInteger(value.rawPagesVerified)&&
  value.rawPagesVerified>=14&&value.rawPagesVerified<=256&&
  HEX64.test(value.rawManifestSha256??'')&&
  HEX64.test(value.checkpointSha256??'')&&
  HEX64.test(value.privateArtifactSha256??'')&&
  value.localSaved===true&&
  value.providerCalls===0&&value.d1Writes===0&&
  value.publicWrites===0&&value.schedulerWrites===0&&
  value.publicationAuthorized===false&&
  value.upstreamCommercialRightsVerified===false&&
  value.derivedLicenseVerified===false;
 return good?{
  status:'PASS',code:'W03_GMH_SCORE_SAVED_7X252_VERIFIED',
  observationDate:value.observationDate,
  commonSessionCount:value.commonSessionCount,
  historyPoints:1764,rawPagesVerified:value.rawPagesVerified,
  inputManifestSha256:value.rawManifestSha256,
  checkpointSha256:value.checkpointSha256,
  privateArtifactSha256:value.privateArtifactSha256,
  localSaved:true,providerCalls:0,d1Writes:0,publicWrites:0
 }:{
  status:'STOP',code:'W03_GMH_SCORE_V2_PRIVATE_INPUT_NOT_VERIFIED'
 };
}
