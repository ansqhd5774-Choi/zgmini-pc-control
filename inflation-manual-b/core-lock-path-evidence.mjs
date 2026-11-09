// Source-only, injected I/O for a bounded read-only Core/Korea lock-path audit.
// This is diagnostic evidence, NOT a B authorization or an executable PC job.
// The existing live-owner guard, Core lease and Writer lease remain unchanged.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DATA_ROOT,SOURCE_ROOT} from './contract.mjs';

export const CORE_LOCK_EVIDENCE_TASKS=Object.freeze({
 core:'ZGMINI-PC-Local-Core',
 korea:'ZGMINI-PC-Local-Korea',
});
const SOURCE_FILE=path.win32.join(SOURCE_ROOT,'scripts','pc-writer','local-cycle.mjs');
const REPORT_FILE=path.win32.join(DATA_ROOT,'local-cycle-last-run.json');
const SHA64=/^[0-9a-f]{64}$/;
const MAX_TASK=262_144,MAX_VBS=65_536,MAX_SOURCE=2_000_000,MAX_REPORT=16_384;
const MAX_AGE=24*60*60_000;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const norm=v=>path.win32.normalize(v).replace(/\\+$/,'').toLowerCase();
const stop=code=>Object.freeze({status:'UNVERIFIED',code,
 evidenceLevel:'STATIC_AND_RUNTIME_READONLY_SNAPSHOT',
 authorizesB:false,operationalWrites:0,providerCalls:0,d1Writes:0});

function exactBytes(bytes,limit){
 return Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=limit;
}
function decodeXml(bytes){
 if(!exactBytes(bytes,MAX_TASK))return null;
 if(bytes[0]===0xff&&bytes[1]===0xfe)
  return bytes.subarray(2).toString('utf16le').replace(/^\uFEFF/,'');
 if(bytes.length>3&&bytes[1]===0&&bytes[3]===0)
  return bytes.toString('utf16le').replace(/^\uFEFF/,'');
 return bytes.toString('utf8').replace(/^\uFEFF/,'');
}
function xmlField(xml,name){
 const match=xml.match(new RegExp(`<${name}>([^<]{1,1024})<\\/${name}>`,'i'));
 if(!match)return null;
 return match[1].replace(/&(quot|amp|apos|lt|gt);/g,(_,entity)=>({
  quot:'"',amp:'&',apos:"'",lt:'<',gt:'>'})[entity]);
}
function validPins(pins){
 if(!object(pins)||!SHA64.test(pins.sourceSha256??'')||
    !object(pins.tasks))return false;
 for(const lane of Object.keys(CORE_LOCK_EVIDENCE_TASKS)){
  const p=pins.tasks[lane];
  if(!object(p)||!SHA64.test(p.taskXmlSha256??'')||
     typeof p.principal!=='string'||p.principal.length<1||p.principal.length>256||
     typeof p.executable!=='string'||p.executable.length>512||
     !path.win32.isAbsolute(p.executable)||
     path.win32.basename(p.executable).toLowerCase()!=='wscript.exe'||
     typeof p.firstVbs!=='string'||p.firstVbs.length>512||
     !path.win32.isAbsolute(p.firstVbs)||!Array.isArray(p.vbs)||
     p.vbs.length<1||p.vbs.length>4)return false;
  const unique=new Set();
  for(const entry of p.vbs){
   if(!object(entry)||!path.win32.isAbsolute(entry.path??'')||
      !SHA64.test(entry.sha256??''))return false;
   const name=norm(entry.path);
   if(unique.has(name)||!name.startsWith(norm(DATA_ROOT)+'\\'))return false;
   unique.add(name);
  }
  if(norm(p.firstVbs)!==norm(p.vbs[0].path))return false;
 }
 return true;
}
function coreReport(bytes,mtimeMs,clock){
 if(!exactBytes(bytes,MAX_REPORT))return false;
 let report;
 try{report=JSON.parse(bytes.toString('utf8'));}catch{return false;}
 const at=Date.parse(report?.at);
 // A failed/degraded publication still writes the report from the same base.
 // Report status is PATH evidence only, not publication or Task-origin proof.
 return object(report)&&report.lane==='core'&&
  ['COMPLETE','COMPLETE_WITH_COLLECTION_GAPS','PUBLICATION_NOT_VERIFIED']
   .includes(report.status)&&
  typeof report.at==='string'&&Number.isFinite(at)&&
  Number.isFinite(mtimeMs)&&mtimeMs>=at-60_000&&
  Math.abs(mtimeMs-at)<=60*60_000&&
  at<=clock+60_000&&at>=clock-MAX_AGE;
}

/**
 * `io` is an already-approved, trusted READ-ONLY Windows adapter, not a tool
 * supplied by the Issue body. It must obtain effective homes from evidence of
 * EACH scheduled Task's actual runtime, not from the Runner's environment.
 * No Task, registry, process, filesystem or network write is performed here.
 *
 * Source-only: no installed PC A operation or Windows `io` implementation is
 * created by this file. Even a consistent result is diagnostic only: Task
 * runtime origin of the historical report and conditional VBS execution
 * still require review. Do NOT wire it as a replacement for the B gate.
 */
export async function inspectCoreLockPathEvidence({io,pins,clock=Date.now()}={}){
 if(!validPins(pins)||!object(io)||!Number.isFinite(clock)||
   !['readTaskXml','readFile','stat','realpath','effectiveTaskHomeEvidence']
    .every(name=>typeof io[name]==='function'))
  return stop('CORE_PATH_PROBE_CONTRACT_UNKNOWN');
 try{
  const canonicalData=norm(await io.realpath(DATA_ROOT));
  if(!path.win32.isAbsolute(canonicalData))
   return stop('CORE_PATH_DATA_CANONICAL_UNKNOWN');
  const sourceBytes=await io.readFile(SOURCE_FILE);
  if(!exactBytes(sourceBytes,MAX_SOURCE)||hash(sourceBytes)!==pins.sourceSha256)
   return stop('CORE_PATH_SOURCE_HASH_UNKNOWN');

  for(const lane of ['core','korea']){
   const p=pins.tasks[lane];
   const xmlBytes=await io.readTaskXml(CORE_LOCK_EVIDENCE_TASKS[lane]);
   const xml=decodeXml(xmlBytes);
   if(!xml||hash(xmlBytes)!==p.taskXmlSha256)
    return stop('CORE_PATH_TASK_XML_UNKNOWN');
   const principal=xmlField(xml,'UserId');
   const executable=xmlField(xml,'Command');
   const argumentsText=xmlField(xml,'Arguments');
   if(principal!==p.principal||!executable||!argumentsText||
      norm(executable)!==norm(p.executable)||
      argumentsText.trim()!==`"${p.firstVbs}"`)
    return stop('CORE_PATH_TASK_ACTION_OR_PRINCIPAL_UNKNOWN');
   for(const item of p.vbs){
    const bytes=await io.readFile(item.path);
    if(!exactBytes(bytes,MAX_VBS)||hash(bytes)!==item.sha256)
     return stop('CORE_PATH_LAUNCHER_HASH_UNKNOWN');
   }
   const home=await io.effectiveTaskHomeEvidence(CORE_LOCK_EVIDENCE_TASKS[lane]);
   // Userprofile, current Runner env, Task XML and launch-string inference
   // cannot attest the Task's effective ZGMINI_PC_HOME at execution time.
   if(!object(home)||home.method!=='OBSERVED_TASK_RUNTIME'||
      home.taskName!==CORE_LOCK_EVIDENCE_TASKS[lane]||
      typeof home.path!=='string'||!path.win32.isAbsolute(home.path))
    return stop('CORE_PATH_EFFECTIVE_HOME_UNATTESTED');
   const canonicalHome=norm(await io.realpath(home.path));
   if(canonicalHome!==canonicalData)
    return stop('CORE_PATH_EFFECTIVE_HOME_MISMATCH');
  }
  const reportBytes=await io.readFile(REPORT_FILE);
  const stats=await io.stat(REPORT_FILE);
  if(!coreReport(reportBytes,stats?.mtimeMs,clock))
   return stop('CORE_PATH_CORE_CHECKPOINT_UNVERIFIED');
  return Object.freeze({status:'EVIDENCE_CONSISTENT',
   code:'CORE_PATH_TWO_TASKS_CHECKED_REVIEW_REQUIRED',
   evidenceLevel:'TASK_RUNTIME_HOME_AND_FIXED_BYTES_WITH_CHECKPOINT',
   // Explicitly not a gate: no evidence here authenticates the process that
   // wrote the historical checkpoint or resolves conditional VBS control flow.
   authorizesB:false,operationalWrites:0,providerCalls:0,d1Writes:0});
 }catch{return stop('CORE_PATH_READONLY_INSPECTION_UNAVAILABLE');}
}
