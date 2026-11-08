// A/light: fixed, bounded pre-install byte evidence for already approved Writer B
// scopes. Neither the Issue nor the caller can supply paths or commands.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectPcSource} from './pc-source-readonly.mjs';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const SHA40=/^[0-9a-f]{40}$/i;
const MAX_BYTES=2_000_000;
const CHECKOUT='projects/zgmini-earnings-history-pc-release';
export const CALENDAR_PREIMAGE_FILES=Object.freeze([
 'lib/market-calendar-company-ko.mjs',
 'lib/market-calendar-issuer-alias-coverage.mjs',
 'scripts/pc-writer/market-calendar-er1-auto-output.mjs',
]);
export const EMPLOYMENT_R6_PREIMAGE_FILES=Object.freeze([
 'lib/market-score/employment-r4-bed-provider.mjs',
 'lib/market-score/employment-r4-shadow-store.mjs',
 'lib/market-score/employment-r6-collector.mjs',
 'lib/market-score/employment-r6-contract.mjs',
 'lib/market-score/employment-r6-feature-engine.mjs',
 'lib/market-score/employment-r6-observation-reader.mjs',
 'lib/market-score/employment-r6-provider.mjs',
 'lib/market-score/employment-r6-scheduler.mjs',
 'lib/market-score/employment-r6-store.mjs',
 'scripts/pc-writer/collect-local.mjs',
 'scripts/pc-writer/run-local.mjs',
 'lib/market-score/employment-r6-one-year-read-model.mjs',
 'lib/market-score/employment-r6-window.mjs',
 'scripts/pc-writer/employment-r6-auto-collection.mjs',
 'scripts/pc-writer/employment-r6-auto-publication.mjs',
 'scripts/pc-writer/employment-r6-candidate-locator.mjs',
 'scripts/pc-writer/employment-r6-one-year-stage.mjs',
 'scripts/pc-writer/employment-r6-pit-coverage.mjs',
 'worker/employment-r6-public-display.mjs',
]);
const sourceState=(value)=>typeof value==='string'&&SHA40.test(value)?value.toLowerCase():null;
const empty=(path,expectedEffect)=>({path,expectedEffect,exists:null,sha256:null,
  state:'NOT_OBSERVED',trackedDirty:null});
const inside=(root,file)=>{const rel=path.relative(root,file);
 return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
const safeOption=value=>value===true?'ENABLED':value===false?'DISABLED':
 value===undefined?'ABSENT':'UNRECOGNIZED';

/** Return only the two public opt-in states; never return the rest of config. */
export function readR6OptInStatus(dataRoot,{fileSystem=fs}={}){
 const states={employmentR6AutoCollection:'UNKNOWN',
  employmentR6OneYearAutoPublication:'UNKNOWN'};
 const bytes=readFixedReadonlyBytes(path.join(dataRoot,'pc-writer','config.json'),
  {fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131_072});
 if(!bytes.ok)return {status:'STATE_UNKNOWN',keys:states,configSha256:null,reason:bytes.reason};
 try{
  const config=JSON.parse(bytes.bytes.toString('utf8'));
  if(!config||typeof config!=='object'||Array.isArray(config))
   return {status:'STATE_UNKNOWN',keys:states,configSha256:null,reason:'CONFIG_INVALID'};
  return {status:'PASS',configSha256:sha256(bytes.bytes),keys:{
   employmentR6AutoCollection:safeOption(config.employmentR6AutoCollection),
   employmentR6OneYearAutoPublication:safeOption(config.employmentR6OneYearAutoPublication),
  },reason:null};
 }catch{return {status:'STATE_UNKNOWN',keys:states,configSha256:null,reason:'CONFIG_INVALID'};}
}

/** The caller may inject fixture dependencies, but never a file list. */
export function inspectWriterInstallPreimage(dataRoot,{coreTaskXml,
 fileSystem=fs,inspectSource=inspectPcSource,strictPlatform=true}={}){
 const result={status:'STATE_UNKNOWN',code:'WRITER_PREIMAGE_SOURCE_UNVERIFIED',
  observedAt:new Date().toISOString(),
  evidenceLevel:'FIXED_CHECKOUT_NOT_LIVE_CORE_PROCESS',runtimeSourceVerified:false,
  sourceRoot:null,sourceHead:null,approvedConfigSource:null,checkpointSource:null,
  sourceIdentityConsistent:false,coreTaskSourceLinked:false,
  taskLaunchers:[],
  r6Config:{status:'STATE_UNKNOWN',configSha256:null,
   keys:{employmentR6AutoCollection:'UNKNOWN',
   employmentR6OneYearAutoPublication:'UNKNOWN'}},
  calendar:CALENDAR_PREIMAGE_FILES.map(p=>empty(p,p===CALENDAR_PREIMAGE_FILES[2]?'M':'A')),
  employmentR6:EMPLOYMENT_R6_PREIMAGE_FILES.map((p,i)=>empty(p,i<11?'M':'A')),
  operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)||
    (strictPlatform&&process.platform!=='win32'))return result;
 let data,base;
 try{
  data=fileSystem.realpathSync.native(dataRoot);
  base=path.dirname(data);
  if(path.basename(data).toLowerCase()!=='data'||
     path.basename(base).toLowerCase()!=='zgmini'||
     (strictPlatform&&path.parse(base).root.toLowerCase()!=='e:\\'))return result;
 }catch{return result;}
 result.r6Config=readR6OptInStatus(data,{fileSystem});
 let trace;
 try{trace=inspectSource({dataRoot:data,coreTaskXml});}
 catch{return {...result,code:'WRITER_PREIMAGE_TASK_TRACE_UNAVAILABLE'};}
 result.taskLaunchers=(trace?.tracedLaunchers??[])
  .filter(x=>typeof x?.path==='string'&&/^[a-z0-9._\/-]{1,180}$/i.test(x.path)&&
   /^[0-9a-f]{64}$/i.test(x.sha256??''))
  .slice(0,8).map(x=>({path:x.path,sha256:x.sha256}));
 const direct=trace?.sourceResolved===true&&sourceState(trace?.sourceHead);
 const historical=trace?.historicalCheckoutCandidate;
 const candidate=direct?{
   relative:trace.sourceRoot,head:trace.sourceHead,clean:Array.isArray(trace.trackedDirty)&&
    trace.trackedDirty.length===0&&trace.trackedDirtyTruncated!==true,
   dirtyPaths:Array.isArray(trace.trackedDirty)?trace.trackedDirty:[],
   dirtyComplete:trace.trackedDirtyTruncated!==true,
   type:'TASK_STATIC_CHAIN',
  }:historical?.gitVerified===true&&sourceState(historical.head)?{
   relative:historical.sourceRoot,head:historical.head,
   clean:historical.trackedDirty===false,dirtyPaths:[],
   dirtyComplete:historical.trackedDirty===false,type:'HISTORICAL_CHECKOUT',
  }:null;
 if(!candidate||candidate.relative!==CHECKOUT)
  return {...result,code:'WRITER_PREIMAGE_CHECKOUT_NOT_CORROBORATED'};
 const candidatePath=path.resolve(base,...CHECKOUT.split('/'));
 let source;
 try{
  source=fileSystem.realpathSync.native(candidatePath);
  if(!inside(base,source)||!fileSystem.lstatSync(source).isDirectory()||
     fileSystem.lstatSync(source).isSymbolicLink())throw Error('INVALID');
 }catch{return {...result,code:'WRITER_PREIMAGE_CHECKOUT_PATH_UNVERIFIED'};}
 const configSource=sourceState(trace?.configApprovedSha);
 const checkpointSource=sourceState(trace?.lastWriterEvidence?.sourceHead);
 result.sourceRoot=CHECKOUT;result.sourceHead=sourceState(candidate.head);
 result.approvedConfigSource=configSource;result.checkpointSource=checkpointSource;
 result.coreTaskSourceLinked=!!direct;
 result.sourceIdentityConsistent=Boolean(candidate.clean&&configSource===result.sourceHead&&
  checkpointSource===result.sourceHead&&trace?.lastWriterEvidence?.status==='VERIFIED');
  function filesFor(filenames,isModified){
  return filenames.map((relative,index)=>{
   const expectedEffect=isModified(relative,index)?'M':'A';
   const item={...empty(relative,expectedEffect),
    gitTracked:'UNKNOWN',existingAdditionCollision:false};
   const filename=path.join(source,...relative.split('/'));
   const read=readFixedReadonlyBytes(filename,{fileSystem,verifiedRoot:source,
    maxBytes:MAX_BYTES});
   if(!read.ok){item.state=read.reason==='MISSING'?'ABSENT':read.reason;
    item.exists=read.reason==='MISSING'?false:null;return item;}
   item.state='PRESENT';item.exists=true;item.sha256=sha256(read.bytes);
   if(candidate.dirtyComplete&&expectedEffect==='M')
    item.trackedDirty=candidate.dirtyPaths.includes(relative);
   if(expectedEffect==='A')item.existingAdditionCollision=true;
   return item;
  });
 }
 result.calendar=filesFor(CALENDAR_PREIMAGE_FILES,(_,i)=>i===2);
 result.employmentR6=filesFor(EMPLOYMENT_R6_PREIMAGE_FILES,(_,i)=>i<11);
 result.status='PASS';result.code='WRITER_FIXED_PREIMAGE_READONLY';
 return result;
}
