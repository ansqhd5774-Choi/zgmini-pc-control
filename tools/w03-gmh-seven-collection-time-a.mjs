// W03 immutable GMH 14-symbol collection-time proof, existing Writer B one-shot
// read-only lane. No installed PC source/DB/D1/provider/public/Task mutations.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readSavedCandidate,MANIFEST_SHA,PRIVATE_SHA}
 from './w03-gmh-seven-public-compat-a.mjs';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='w03-gmh-seven-collection-time-readonly';
export const SCHEMA='ZGMINI_W03_GMH_TIME_REQUEST_V1';
export const OUTPUT='ZGMINI_W03_GMH_TIME_RESULT_V1';
export const SOURCE_SHA='2ca21bdcc603d80eb79156c4cca1cd9f4dc2b3cf';
export const CHECKPOINT_SHA=
 '3ddc25440fe93a8301f0f6f9d6d82dc34867fc6852198f4ac90a03828eba0336';
const OWNER='ansqhd5774-Choi';
const ROOT='E:\\ZGmini\\data';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(good,code)=>{if(!good)fail(code);};
const BLOB_PATHS=Object.freeze({
 'scripts/pc-writer/theme-gmh-seven-pc-parity-r1.mjs':
  '45393297c47f5e54145cce14e6c488a97a2c5652',
 'scripts/pc-writer/theme-gmh-seven-saved-input-r1.mjs':
  'c637e6ac66a9742554b312dc59702b3a485c4bfc',
 'scripts/pc-writer/theme-gmh-seven-private-bridge.mjs':
  'a91c6a78c1cf436acf66164bce4d8bedcdbb78b2',
 'scripts/pc-writer/theme-seven-gmh-history-r1.mjs':
  'c8d3ea62c6c5f7aa65020c97b2d72cb217061a82',
 'scripts/pc-writer/theme-optional-score-r188.mjs':
  '4be861428316e8056325f7d00e97b0deaa13ef04',
 'worker/theme-etf-only-public.mjs':
  'bb3f56c5f3a62b7dfa4aae19a1b18381611e6335'
});
const CONTROL_PATHS=Object.freeze([
 '.github/workflows/pc-writer-b-source-once.yml',
 'shared-resource/issue-admission.mjs',
 'tools/w03-gmh-seven-collection-time-a.mjs',
 'tools/w03-gmh-seven-collection-time-preflight.mjs',
 'tools/w03-gmh-seven-collection-time-report.mjs'
]);
const blobHash=bytes=>createHash('sha1').update(
 'blob '+bytes.length+'\0').update(bytes).digest('hex');
function gitExec(root,args){
 const git=['C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe'].find(fs.existsSync);
 if(!git)return {status:-1};
 return spawnSync(git,['-C',root,...args],{
  shell:false,windowsHide:true,timeout:15000,encoding:'utf8'});
}
// Safe event pin drift, only if an ancestor and *all* executable/guard bytes
// are unchanged. This is the same bounded pattern as approved W03 V2.
export function compatibleControlSha(pinned,actual,run=gitExec){
 if(!SHA40.test(pinned??'')||!SHA40.test(actual??''))return false;
 if(pinned===actual)return true;
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const runGit=args=>run(root,args);
 const head=runGit(['rev-parse','HEAD']);
 return head?.status===0&&head.stdout?.trim()===actual&&
  runGit(['merge-base','--is-ancestor',pinned,actual])?.status===0&&
  runGit(['diff','--quiet',pinned,actual,'--',...CONTROL_PATHS])?.status===0&&
  runGit(['diff','--quiet','HEAD','--',...CONTROL_PATHS])?.status===0;
}
export function identifySafeReceipt(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR===OWNER&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&event.issue.title===TITLE&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&
  event.issue.labels?.some(l=>l.name==='pc-writer-b-install'),
  'W03_GMH_TIME_EVENT_STOP');
 let req;try{req=JSON.parse(event.issue.body);}catch{
  fail('W03_GMH_TIME_JSON_STOP');}
 const keys=['schema','operation','requestId','chatId',
  'controlRepository','controlSourceSha','candidateSourceSha',
  'expectedManifestSha256','expectedCheckpointSha256',
  'expectedPrivateArtifactSha256'];
 need(req&&typeof req==='object'&&!Array.isArray(req)&&
  Object.keys(req).length===keys.length&&keys.every(k=>Object.hasOwn(req,k))&&
  req.schema===SCHEMA&&req.operation===TITLE&&
  UUID.test(req.requestId??'')&&UUID.test(req.chatId??'')&&
  req.controlRepository===REPO&&SHA40.test(req.controlSourceSha??'')&&
  req.candidateSourceSha===SOURCE_SHA&&
  req.expectedManifestSha256===MANIFEST_SHA&&
  req.expectedCheckpointSha256===CHECKPOINT_SHA&&
  req.expectedPrivateArtifactSha256===PRIVATE_SHA,
  'W03_GMH_TIME_REQUEST_STOP');
 return Object.freeze(req);
}
export function authorize(event,env,{allowDrift=compatibleControlSha}={}){
 const req=identifySafeReceipt(event,env);
 need(req.controlSourceSha===env.GITHUB_SHA||
  allowDrift(req.controlSourceSha,env.GITHUB_SHA),
  'W03_GMH_TIME_CONTROL_DRIFT_STOP');
 return req;
}
export function verifyCandidateSource(sourceRoot,{
 platform=process.platform,files=fs,git=gitExec
}={}){
 need(platform==='win32'&&typeof sourceRoot==='string'&&
  path.isAbsolute(sourceRoot),'W03_GMH_TIME_WINDOWS_SOURCE_STOP');
 const root=files.realpathSync.native(sourceRoot);
 const checked=git(root,['rev-parse','HEAD']);
 need(checked?.status===0&&checked.stdout?.trim()===SOURCE_SHA,
  'W03_GMH_TIME_SOURCE_PIN_STOP');
 for(const [rel,expected] of Object.entries(BLOB_PATHS)){
  const file=path.join(root,...rel.split('/'));
  const before=files.lstatSync(file),real=files.realpathSync.native(file);
  const within=path.relative(root,real);
  need(before.isFile()&&!before.isSymbolicLink()&&
   within!==''&&within!=='..'&&!within.startsWith('..'+path.sep)&&
   !path.isAbsolute(within)&&before.size>0&&before.size<=90000,
   'W03_GMH_TIME_SOURCE_SCOPE_STOP');
  const bytes=files.readFileSync(file),after=files.lstatSync(file);
  need(before.size===bytes.length&&after.size===before.size&&
   after.mtimeMs===before.mtimeMs&&blobHash(bytes)===expected,
   'W03_GMH_TIME_SOURCE_BLOB_STOP');
 }
 return root;
}
async function approvedReader(sourceRoot){
 const mod=await import(pathToFileURL(path.join(sourceRoot,
  'scripts','pc-writer','theme-gmh-seven-pc-parity-r1.mjs')).href);
 const att=await import(pathToFileURL(path.join(sourceRoot,
  'scripts','pc-writer','theme-gmh-seven-saved-input-r1.mjs')).href);
 need(typeof mod.readPcSavedGmhSeven==='function'&&
  typeof att.attestSavedGmhSevenCollectionTime==='function',
  'W03_GMH_TIME_SOURCE_EXPORT_STOP');
 return {
  saved:mod.readPcSavedGmhSeven({dataRoot:ROOT}),
  attest:att.attestSavedGmhSevenCollectionTime
 };
}
export async function execute({event,env,platform=process.platform,
 verify=verifyCandidateSource,load=readSavedCandidate,
 read=approvedReader,now=Date.now}={}){
 const req=authorize(event,env);
 need(platform==='win32','W03_GMH_TIME_WINDOWS_ONLY_STOP');
 const source=verify(path.join(env.GITHUB_WORKSPACE??'','w03-gmh-source'));
 const privateScore=load();
 const {saved,attest}=await read(source);
 need(saved?.manifestSha256===MANIFEST_SHA&&
  saved.checkpointSha256===CHECKPOINT_SHA&&
  typeof privateScore?.observationDate==='string'&&
  privateScore.rawManifestSha256===MANIFEST_SHA,
  'W03_GMH_TIME_SOURCE_LINEAGE_STOP');
 const evidence=attest({...saved,observationDate:privateScore.observationDate,
  now:now()});
 need(evidence?.status==='GMH_SEVEN_SOURCE_REQUEST_TIME_ATTESTED_READONLY'&&
  evidence.observationDate==='2026-11-13'&&
  evidence.rawManifestSha256===MANIFEST_SHA&&
  evidence.checkpointSha256===CHECKPOINT_SHA&&
  evidence.verifiedSymbols===14&&evidence.checkedRawPages===30&&
  Number.isSafeInteger(evidence.coveringPages)&&
  evidence.coveringPages>=14&&evidence.coveringPages<=30&&
  evidence.sourceTimestampBasis==='MANIFEST_GET_REQUEST_AT'&&
  evidence.sourceTimestampIsFileCommitTime===false&&
  evidence.rawFilesRehashedInMemory===true&&
  evidence.providerCalls===0&&evidence.sqliteWrites===0&&
  evidence.d1Writes===0&&evidence.publicWrites===0&&
  evidence.publicationAuthorized===false&&
  evidence.upstreamCommercialRightsVerified===false&&
  evidence.derivedLicenseVerified===false,
  'W03_GMH_TIME_ATTESTATION_CONTRACT_STOP');
 const t=Date.parse(evidence.sourceStoredAt);
 need(typeof evidence.sourceStoredAt==='string'&&
  Number.isFinite(t)&&
  evidence.sourceStoredAt===new Date(t).toISOString()&&
  t>=Date.parse('2026-11-13T00:00:00Z')&&t<=now(),
  'W03_GMH_TIME_SOURCE_TIME_INVALID_STOP');
 const facts=Object.freeze({
  schema:'ZGMINI_W03_GMH_TIME_FACTS_V1',
  observationDate:evidence.observationDate,
  sourceStoredAt:evidence.sourceStoredAt,
  sourceTimestampBasis:evidence.sourceTimestampBasis,
  inputManifestSha256:MANIFEST_SHA,
  checkpointSha256:CHECKPOINT_SHA,
  privateArtifactSha256:PRIVATE_SHA,
  verifiedSymbols:14,rawPagesVerified:30,
  coveringPages:evidence.coveringPages,
  rawFilesRehashed:true,
  sourceTimestampIsFileCommitTime:false,
  publicationAuthorized:false,rightsVerified:false,
  d1SeedCasVerified:false,r32NonRegressionVerified:false,
  providerCalls:0,sqliteWrites:0,d1Writes:0,publicWrites:0
 });
 return {schema:OUTPUT,status:'PASS',code:'W03_GMH_TIME_MANIFEST_ATTESTED_READONLY',
  requestId:req.requestId,controlSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID??null,
  candidateSourceSha:SOURCE_SHA,facts,
  rawPricesExposed:false,providerCalls:0,d1Writes:0,publicWrites:0,
  retry:'NO_AUTOMATIC_REEXECUTION'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(
   env.GITHUB_EVENT_PATH,'utf8'));
  result=await execute({event,env});
 }catch(e){
  const safe=/^W03_(?:GMH_TIME|SAVED|PC_PARITY)_[A-Z0-9_]{3,100}$/.test(e?.code??'');
  result={schema:OUTPUT,status:'STOP',
   code:safe?e.code:'W03_GMH_TIME_UNCLASSIFIED_STOP',
   requestId:null,facts:null};
 }
 try{
  const temp=process.env.RUNNER_TEMP;
  need(typeof temp==='string'&&path.isAbsolute(temp),
   'W03_GMH_TIME_RESULT_TEMP_STOP');
  fs.writeFileSync(path.join(temp,'w03-gmh-collection-time-result.json'),
   JSON.stringify(result)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status!=='PASS')process.exitCode=1;
}
