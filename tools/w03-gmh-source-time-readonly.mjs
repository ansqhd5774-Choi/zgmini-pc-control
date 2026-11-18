import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const OPERATION='w03-gmh-source-time-readonly';
export const REQUEST_SCHEMA='ZGMINI_GMH_SOURCE_TIME_REQUEST_V1';
export const SOURCE='2ca21bdcc603d80eb79156c4cca1cd9f4dc2b3cf';
export const PINS=Object.freeze({manifest:'82f380e346e350c276c4b532353ddc3112dbfa5f90c8d1590c25e22ec064bc0a',checkpoint:'3ddc25440fe93a8301f0f6f9d6d82dc34867fc6852198f4ac90a03828eba0336',private:'9f5fa50f294224b273b0eee6e4d1ad96afc1b37a61774d1543ffa1f62a'});
const ROOT=String.raw`E:\ZGmini\data\themes\theme-legacy-seven`;
const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c});};
export function authorize(event,env){
 need(env.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&env.GITHUB_ACTOR===OWNER&&event.repository?.full_name===REPO&&event.repository.private===true&&event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&event.issue.title===OPERATION&&!event.issue.pull_request&&Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&event.issue.labels?.some(x=>x.name==='pc-writer-b-install'),'GMH_TIME_EVENT_STOP');
 const r=JSON.parse(event.issue.body),keys=['schema','requestId','chatId','operation','controlRepository','candidateSourceSha','expectedManifestSha256','expectedCheckpointSha256','expectedPrivateSha256'];
 need(r&&Object.keys(r).length===keys.length&&keys.every(k=>Object.hasOwn(r,k))&&r.schema===REQUEST_SCHEMA&&UUID.test(r.requestId)&&UUID.test(r.chatId)&&r.operation===OPERATION&&r.controlRepository===REPO&&r.candidateSourceSha===SOURCE&&r.expectedManifestSha256===PINS.manifest&&r.expectedCheckpointSha256===PINS.checkpoint&&r.expectedPrivateSha256===PINS.private,'GMH_TIME_REQUEST_STOP');return r;
}
export function readFile(root,rel,max,expected=null){
 need(typeof rel==='string'&&!path.isAbsolute(rel)&&!rel.split(/[\\/]/).some(p=>p==='..'),'GMH_TIME_PATH_STOP');
 const file=path.join(root,rel),a=fs.lstatSync(file),real=fs.realpathSync.native(file),base=fs.realpathSync.native(root);
 need(a.isFile()&&!a.isSymbolicLink()&&a.size>0&&a.size<=max&&real.toLowerCase().startsWith(base.toLowerCase()+path.sep),'GMH_TIME_FILE_STOP');
 const bytes=fs.readFileSync(file),b=fs.lstatSync(file);need(a.size===bytes.length&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&(!expected||sha(bytes)===expected),'GMH_TIME_SHA_OR_CONCURRENT_STOP');return bytes;
}
export function readInputs(){
 const manifestBytes=readFile(ROOT,'raw-manifest.json',4000000,PINS.manifest),checkpointBytes=readFile(ROOT,'state/manual-3670716504a1b129.json',2000000,PINS.checkpoint);
 const privateBytes=readFile(ROOT,'derived/seven-gmh-'+PINS.private.slice(0,16)+'.json',500000,PINS.private),p=JSON.parse(privateBytes);
 need(p.status==='PRIVATE_GMH_ONLY_7X252_NOT_PUBLISHED'&&p.inputProvider==='GETMARKETHISTORY_FREE_HOURLY_ONLY'&&p.rawManifestSha256===PINS.manifest&&p.observationDate==='2026-11-13'&&p.publicationAuthorized===false,'GMH_TIME_PRIVATE_IDENTITY_STOP');
 const m=JSON.parse(manifestBytes);need(Array.isArray(m.files)&&m.files.length===30,'GMH_TIME_PAGE_COUNT_STOP');
 const rawPages=m.files.map(e=>{need(/^raw\/[A-Z][A-Z0-9.]{0,11}_[a-f0-9]{64}\.jsonl$/.test(e.path)&&/^[a-f0-9]{64}$/.test(e.sha256),'GMH_TIME_RAW_PATH_STOP');return {path:e.path,bytes:readFile(ROOT,e.path,6000000,e.sha256)};});
 return {manifestBytes,manifestSha256:PINS.manifest,checkpointBytes,checkpointSha256:PINS.checkpoint,rawPages,observationDate:p.observationDate};
}
export function safeResult(value,request){
 const base={schema:'ZGMINI_GMH_SOURCE_TIME_RESULT_V1',candidateSourceSha:SOURCE,requestId:request.requestId,status:'STATE_UNKNOWN',code:'GMH_TIME_ATTESTATION_NOT_VERIFIED',publicationAuthorized:false,providerCalls:0,sqliteWrites:0,d1Writes:0,publicWrites:0,sourceWrites:0,schedulerWrites:0};
 if(value?.status!=='GMH_SEVEN_SOURCE_REQUEST_TIME_ATTESTED_READONLY'||value.observationDate!=='2026-11-13'||value.rawManifestSha256!==PINS.manifest||value.checkpointSha256!==PINS.checkpoint||value.verifiedSymbols!==14||value.checkedRawPages!==30||value.sourceTimestampBasis!=='MANIFEST_GET_REQUEST_AT'||value.sourceTimestampIsFileCommitTime!==false||value.rawFilesRehashedInMemory!==true||!Number.isFinite(Date.parse(value.sourceStoredAt))||Date.parse(value.sourceStoredAt)<Date.parse('2026-11-13T00:00:00Z')||Date.parse(value.sourceStoredAt)>Date.now()||value.providerCalls!==0||value.sqliteWrites!==0||value.d1Writes!==0||value.publicWrites!==0||value.schedulerWrites!==0||value.publicationAuthorized!==false)return base;
 return {...base,status:'PASS',code:'GMH_TIME_SOURCE_RECEIPTS_SHA_ATTESTED',observationDate:value.observationDate,sourceStoredAt:value.sourceStoredAt,sourceTimestampBasis:value.sourceTimestampBasis,sourceTimestampIsFileCommitTime:false,manifestSha256:PINS.manifest,checkpointSha256:PINS.checkpoint,privateSha256:PINS.private,verifiedSymbols:14,rawPagesVerified:30,coveringPages:value.coveringPages,derivedLicenseVerified:false,upstreamCommercialRightsVerified:false};
}
export async function run(request,{attest,inputs=readInputs}={}){need(typeof attest==='function','GMH_TIME_SOURCE_EXPORT_STOP');return safeResult(await attest(inputs()),request);}
function git(root,args){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-C',root,...args],{encoding:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:10000});need(r.status===0&&!r.error,'GMH_TIME_SOURCE_GIT_STOP');return r.stdout.trim();}
export async function nativeRun(request,root){
 need(process.platform==='win32'&&git(root,['rev-parse','HEAD'])===SOURCE,'GMH_TIME_PINNED_SOURCE_STOP');
 need(git(root,['status','--porcelain','--untracked-files=all','--','scripts/pc-writer'])==='','GMH_TIME_SOURCE_DIRTY_STOP');
 const rel='scripts/pc-writer/theme-gmh-seven-saved-input-r1.mjs',target=path.join(root,...rel.split('/'));
 const st=fs.lstatSync(target);need(st.isFile()&&!st.isSymbolicLink()&&fs.realpathSync.native(target).toLowerCase().startsWith(fs.realpathSync.native(root).toLowerCase()+path.sep),'GMH_TIME_SOURCE_PATH_STOP');
 const mod=await import(pathToFileURL(target).href);return run(request,{attest:mod.attestSavedGmhSevenCollectionTime});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;try{const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),request=authorize(event,process.env);if(process.argv[2]==='--preflight'){console.log('GMH_TIME_REQUEST_VERIFIED');}else{need(process.argv[2]==='--read','GMH_TIME_MODE_STOP');result=await nativeRun(request,path.join(process.env.GITHUB_WORKSPACE,'gmh-attested-source'));}}catch(e){result={status:'STOP',code:/^(?:GMH_TIME_|W03_SAVED_)[A-Z0-9_]+$/.test(e.code??'')?e.code:'GMH_TIME_SOURCE_ATTESTATION_FAILED',publicationAuthorized:false,providerCalls:0,d1Writes:0};}
 if(result){fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'gmh-source-time-result.json'),JSON.stringify(result)+'\n',{flag:'wx'});console.log(result.status+' '+result.code);if(result.status!=='PASS')process.exitCode=1;}
}
