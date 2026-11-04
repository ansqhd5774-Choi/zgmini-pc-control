// R17 #268 post-cancellation evidence only. No operating writes or API calls.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const TARGET_REQUEST='pc-r17-28dde04f-ad24-4603-89d3-801f874852f1';
export const TARGET_RUN='41786730527';
export const ONE_SHOT_DIAGNOSTIC_ID='pc-9a847b47-9ebd-4c1a-9883-028fc0c2ed97';
export const ROOT=String.raw`E:\ZGmini`;
export const SOURCE=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const BASE_SHA='a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e';
export const BASE_HASHES=Object.freeze({
 'scripts/pc-writer/local-cycle.mjs':'9c3fc7788907a2f8756b7ff82c372124a2e26253557b7db8a93eb6c8428eadee',
 'scripts/pc-writer/run-local.mjs':'4370f6f725b0a9ce3d093d3c94e766624f24e8a02896afb79b063d21a9747502',
});
export const EXPECTED_TASK_HASH='dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028';
const RESULT_ROOT=String.raw`E:\ZGmini\automation\r17-writer-b-preflight`;
const NAMES=Object.keys(BASE_HASHES);
const SHA40=/^[a-f0-9]{40}$/;
const digest=x=>createHash('sha256').update(x).digest('hex');

/** The expected patched SHA is derived from verified ORIGINAL bytes, never a guess. */
export function applyFixedPatch(patchText,originals){
 const sections=patchText.split(/(?=^diff --git )/m).filter(Boolean);
 if(sections.length!==2||patchText.includes('\r'))throw Error('PATCH_SCOPE_UNVERIFIED');
 const out={};
 for(const section of sections){
  const lines=section.split('\n');
  const first=/^diff --git a\/(\S+) b\/(\S+)$/.exec(lines[0]);
  if(!first||first[1]!==first[2]||!NAMES.includes(first[1])||out[first[1]])throw Error('PATCH_SCOPE_UNVERIFIED');
  const filename=first[1],original=originals[filename];
  if(typeof original!=='string')throw Error('BASE_UNVERIFIED');
  const crlf=original.includes('\r\n');
  if(crlf&&/(^|[^\r])\n/.test(original))throw Error('MIXED_EOL_UNVERIFIED');
  const source=original.replace(/\r\n/g,'\n').split('\n'),result=[];
  let i=lines.findIndex(x=>/^@@ -/.test(x)),cursor=0,delta=0;
  if(i<0||!lines.includes(`--- a/${filename}`)||!lines.includes(`+++ b/${filename}`))throw Error('PATCH_HEADER_UNVERIFIED');
  while(i<lines.length&&/^@@ -/.test(lines[i])){
   const h=/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i]);
   if(!h)throw Error('PATCH_HUNK_UNVERIFIED');
   const before=[],after=[];const at=Number(h[1])-1;
   if(Number(h[3])-1!==at+delta)throw Error('PATCH_OFFSET_UNVERIFIED');
   i++;
   while(i<lines.length&&!/^@@ -/.test(lines[i])&&!/^diff --git /.test(lines[i])){
    if(!lines[i]){i++;break;}
    const mode=lines[i][0],body=lines[i].slice(1);
    if(!' +-'.includes(mode))throw Error('PATCH_LINE_UNVERIFIED');
    if(mode!=='+' )before.push(body);
    if(mode!=='-')after.push(body);
    i++;
   }
   if(!before.length||before.length!==Number(h[2]??1)||after.length!==Number(h[4]??1))throw Error('PATCH_COUNT_UNVERIFIED');
   let found=at;
   const matches=k=>k>=cursor&&k+before.length<=source.length&&before.every((b,j)=>source[k+j]===b);
   if(!matches(found)){
    const possible=[];
    for(let k=Math.max(cursor,at-250);k<=Math.min(source.length-before.length,at+250);k++){
     if(matches(k))possible.push(k);
     if(possible.length>1)break;
    }
    if(possible.length!==1)throw Error('PATCH_CONTEXT_UNVERIFIED');
    found=possible[0];
   }
   result.push(...source.slice(cursor,found),...after);
   cursor=found+before.length;
   delta+=after.length-before.length;
   while(i<lines.length&&!lines[i])i++;
  }
  if(lines.slice(i).some(line=>line.trim()))throw Error('PATCH_TRAILING_CONTENT_UNVERIFIED');
  result.push(...source.slice(cursor));
  out[filename]=result.join(crlf?'\r\n':'\n');
 }
 if(!NAMES.every(n=>Object.hasOwn(out,n)))throw Error('PATCH_FILESET_UNVERIFIED');
 return Object.fromEntries(NAMES.map(n=>[n,digest(Buffer.from(out[n],'utf8'))]));
}

/** A conservative classification. Unknown provenance is never converted to PASS. */
export function classifyEvidence(e){
 if(e.process?.active===true)return {status:'INSUFFICIENT_EVIDENCE',code:'R17_268_ACTIVE_PROCESS_STOP'};
 if(e.lease?.active===true)return {status:'INSUFFICIENT_EVIDENCE',code:'R17_268_ACTIVE_LEASE_STOP'};
 const changes=[];
 for(const n of NAMES){
  const row=e.sources?.[n];
  if(!row?.sha256)continue;
  if(row.sha256!==BASE_HASHES[n])changes.push({file:n,kind:row.sha256===e.targetSha256?.[n]?'APPROVED_PATCH_PRESENT':'UNATTRIBUTED_SOURCE_DRIFT'});
 }
 if(changes.length&&e.operatingSourceIdentified!==true)
  return {status:'INSUFFICIENT_EVIDENCE',code:'R17_268_CANDIDATE_DRIFT_EXECUTION_PATH_UNVERIFIED',
   candidateChanges:changes,attributedTo268:false};
 if(changes.length)return {status:'CHANGED',code:'R17_268_SOURCE_CHANGE_OBSERVED',changes,attributedTo268:false};
 if(e.configSource&&e.configSource!==BASE_SHA)return {status:'CHANGED',code:'R17_268_CONFIG_PIN_CHANGED',attributedTo268:false};
 if(e.taskHash&&e.taskHash!==EXPECTED_TASK_HASH)return {status:'CHANGED',code:'R17_268_TASK_CHANGED',attributedTo268:false};
 const complete=NAMES.every(n=>e.sources?.[n]?.sha256===BASE_HASHES[n])&&
  e.configSource===BASE_SHA&&e.taskHash===EXPECTED_TASK_HASH&&
  e.preflight?.requestId===TARGET_REQUEST&&e.preflight?.terminal===true&&
  e.operatingSourceIdentified===true&&e.runtimeSourceVerified===true&&e.process?.verified===true&&e.process.active===false&&
  e.lease?.verified===true&&e.lease.active===false&&e.checkpointsBaselineMatched===true;
 return complete?{status:'NO_CHANGE_CONFIRMED',code:'R17_268_OPERATIONAL_STATE_UNCHANGED'}:
  {status:'INSUFFICIENT_EVIDENCE',code:'R17_268_LAST_STEP_OR_BASELINE_UNVERIFIED'};
}

// Portable fixture entry: the production caller provides only pinned, audited
// dependencies; never receive a user-provided path, query or command.
export function summarizeEvidence(e){
 const {status:assessment,code:assessmentCode,...details}=classifyEvidence(e);
 const admission=assessment==='NO_CHANGE_CONFIRMED'?'PASS':'BLOCKED';
 const admissionCode=assessment==='NO_CHANGE_CONFIRMED'?'R17_268_NO_CHANGE_CONFIRMED':
  assessment==='CHANGED'?'R17_268_OPERATIONAL_CHANGE_BLOCKED':'R17_268_EVIDENCE_INSUFFICIENT_BLOCKED';
 return {schema:'ZGMINI_R17_268_POSTCANCEL_READONLY_V1',requestId:TARGET_REQUEST,
  oldRunId:TARGET_RUN,status:admission,code:admissionCode,
  assessment,assessmentCode,...details,source:e.sources,expectedPatchedSha256:e.targetSha256??null,
  taskSha256:e.taskHash??null,expectedTaskSha256:EXPECTED_TASK_HASH,
  configSourceSha:e.configSource??null,preflight:e.preflight??null,
  process:e.process??{verified:false},lease:e.lease??{verified:false},
  operatingSourceIdentified:e.operatingSourceIdentified===true,
  checkpointEvidence:e.checkpointEvidence??null,
  providerCalls:0,dbD1Writes:0,operationalWrites:0};
}

/** Protected, bounded reads only. Never follows a junction outside E:\ZGmini. */
function regularFile(filename,maxBytes=2_000_000){
 const expectedRoot=fs.realpathSync.native(ROOT).toLowerCase();
 const resolved=fs.realpathSync.native(filename).toLowerCase();
 const relative=path.relative(expectedRoot,resolved);
 if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('OUTSIDE_APPROVED_PC_ROOT');
 const stat=fs.lstatSync(filename);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<=0||stat.size>maxBytes)throw Error('INVALID_READONLY_FILE');
 return fs.readFileSync(filename);
}

const code=x=>typeof x==='string'&&/^[A-Z0-9_:-]{1,100}$/.test(x)?x:null;
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?x:null;
const sourceFilename=n=>path.join(SOURCE,...n.split('/'));
function readPreviousRequest(){
 const result={requestId:TARGET_REQUEST,terminal:false,status:'UNKNOWN',code:null,lastStep:null,source:'R17_DEDICATED_PREFLIGHT_RESULT'};
 const file=path.join(RESULT_ROOT,`R17_B_PREFLIGHT_${TARGET_REQUEST}.json`);
 try{
  const r=JSON.parse(regularFile(file,32768).toString('utf8'));
  if(r.requestId!==TARGET_REQUEST)return {...result,code:'REQUEST_ID_MISMATCH'};
  if(r.runId!==undefined&&String(r.runId)!==TARGET_RUN)return {...result,code:'RUN_ID_MISMATCH'};
  return {...result,terminal:['PASS','BLOCKED'].includes(r.status),status:code(r.status),code:code(r.code),
   lastStep:code(r.lastStep??r.stage??r.phase)};
 }catch{return result;}
}
function readConfigData(dataRoot){
 try{
  const bytes=regularFile(path.join(dataRoot,'pc-writer','config.json'),65536);
  const c=JSON.parse(bytes.toString('utf8'));
  const x=c?.source;
  return {sha256:digest(bytes),sourceSha:[x?.sha,x?.commit,x?.commitSha,x,c.sourceSha].find(v=>typeof v==='string'&&SHA40.test(v))??null};
 }catch{return {sha256:null,sourceSha:null};}
}
function readCheckpoints(dataRoot){
 const out={};
 for(const name of ['local-cycle-last-run.json','local-collection-last-run.json','local-writer-last-run.json']){
  try{
   const f=path.join(dataRoot,'pc-writer',name);
   const bytes=regularFile(f,131072),meta=fs.statSync(f),r=JSON.parse(bytes.toString('utf8'));
   out[name]={exists:true,sha256:digest(bytes),modifiedAt:meta.mtime.toISOString(),status:code(r?.status)};
  }catch{out[name]={exists:false,sha256:null};}
 }
 return out;
}

// Static process visibility: WMIC may be unavailable on recent Windows.
// Command-line text is *never* exposed, only verified target matches.
function readR17Process(){
 const wmic=String.raw`C:\Windows\System32\wbem\WMIC.exe`;
 try{
  if(!fs.existsSync(wmic))return {verified:false,active:null,code:'WMI_UNAVAILABLE'};
  const raw=execFileSync(wmic,['process','where',"CommandLine like '%r17-writer-b%'",'get','ProcessId,CommandLine','/format:csv'],
   {encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:262144});
  const targets=raw.split(/\r?\n/).filter(l=>/r17-writer-b[\\/]entry\.mjs/i.test(l));
  // Negative text search cannot prove that all descendants of #268 exited.
  return {verified:targets.length>0,active:targets.length>0,matchingProcessCount:targets.length,
   code:targets.length?'MATCHING_R17_PROCESS_PRESENT':'NO_REQUEST_CORRELATED_PROCESS_NEGATIVE_PROOF'};
 }catch{return {verified:false,active:null,code:'PROCESS_QUERY_UNVERIFIED'};}
}
function readKnownLease(){
 // #268 is a dedicated Actions workflow, not a controller/engine.mjs pc-job.
 // An absent controller request lease is not proof that the GitHub job ended.
 const owner=path.join(ROOT,'automation','pc-control','leases',`request-${TARGET_REQUEST}`,'owner.json');
 try{
  const lease=JSON.parse(regularFile(owner,8192).toString('utf8'));
  const pid=lease?.pid;
  if(!Number.isSafeInteger(pid)||pid<=0)return {verified:false,active:null,code:'LEASE_PID_UNVERIFIED'};
  try{process.kill(pid,0);return {verified:true,active:true};}
  catch(e){return e.code==='ESRCH'?{verified:true,active:false}:{verified:false,active:null};}
 }catch{return {verified:false,active:null,code:'NO_DEDICATED_REQUEST_LEASE_EVIDENCE'};}
}

/** Only the approved revision and two approved paths can be read from Git. */
function readApprovedGitOriginal(name){
 if(!NAMES.includes(name))throw Error('GIT_SOURCE_NOT_ALLOWED');
 const binary=[String.raw`C:\Program Files\Git\cmd\git.exe`,String.raw`C:\Program Files (x86)\Git\cmd\git.exe`].find(fs.existsSync);
 if(!binary)throw Error('GIT_UNAVAILABLE');
 const raw=execFileSync(binary,['--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false',
  '-C',SOURCE,'show',`${BASE_SHA}:${name}`],
 {windowsHide:true,timeout:15000,maxBuffer:2097152,
  env:{SystemRoot:process.env.SystemRoot,PATH:path.dirname(binary),GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
 if(!Buffer.isBuffer(raw)||raw.length<1||raw.length>2097152)throw Error('GIT_SOURCE_UNVERIFIED');
 return raw;
}

/** Run only through a fixed, installed A-grade operation. No paths from Issue JSON. */
export function inspectR17PostCancel(dataRoot,{coreTaskXml,sourceTrace,patchText,readOriginal}={}){
 if(process.platform!=='win32')return {status:'INSUFFICIENT_EVIDENCE',code:'WINDOWS_PC_REQUIRED',requestId:TARGET_REQUEST};
 const errors=[],sources={},sourceBytes={};
 if(typeof dataRoot!=='string'||path.resolve(dataRoot).toLowerCase()!==path.join(ROOT,'data').toLowerCase())
  return {status:'INSUFFICIENT_EVIDENCE',code:'DATA_ROOT_NOT_APPROVED',requestId:TARGET_REQUEST};
 for(const name of NAMES){
  try{const raw=regularFile(sourceFilename(name));sources[name]={sha256:digest(raw),exists:true};sourceBytes[name]=raw;}
  catch{sources[name]={sha256:null,exists:false};errors.push('SOURCE_UNREADABLE');}
 }
 const config=readConfigData(dataRoot),checkpoints=readCheckpoints(dataRoot);
 const taskHash=Buffer.isBuffer(coreTaskXml)||typeof coreTaskXml==='string'?digest(coreTaskXml):null;
 const preflight=readPreviousRequest(),processEvidence=readR17Process(),lease=readKnownLease();
 let targetSha256=null;
 if(typeof patchText==='string'){
  try{
   const originals={};
   for(const name of NAMES){
    if(sources[name].sha256===BASE_HASHES[name])originals[name]=sourceBytes[name].toString('utf8');
    else {
     const original=(typeof readOriginal==='function'?readOriginal:readApprovedGitOriginal)(name);
     const variants=[original,Buffer.from(original.toString('utf8').replace(/\r?\n/g,'\r\n'),'utf8')];
     const approved=variants.find(b=>Buffer.isBuffer(b)&&digest(b)===BASE_HASHES[name]);
     if(!approved)throw Error('APPROVED_ORIGINAL_UNVERIFIED');
     originals[name]=approved.toString('utf8');
    }
   }
   targetSha256=applyFixedPatch(patchText,originals);
  }catch{errors.push('PATCH_TARGET_UNVERIFIED');}
 }
 const result=summarizeEvidence({sources,targetSha256,configSource:config.sourceSha,taskHash,
  preflight,process:processEvidence,lease,
  operatingSourceIdentified:sourceTrace?.sourceResolved===true&&
   sourceTrace?.sourceRoot==='projects/zgmini-earnings-history-pc-release',
  runtimeSourceVerified:sourceTrace?.runtimeSourceVerified===true&&sourceTrace?.sourceHead===BASE_SHA,
  checkpointsBaselineMatched:false, // No reliable pre-#268 checkpoint baseline is currently established.
  checkpointEvidence:checkpoints});
 return {...result,configSha256:config.sha256,
  sourceEvidenceLevel:sourceTrace?.sourceResolved===true?'CORE_TASK_STATIC_LAUNCHER':'HISTORICAL_OR_UNVERIFIED',
  diagnostics:[...new Set(errors)].slice(0,5),
  lastPCStep:preflight.lastStep??(preflight.terminal?'PREFLIGHT_RESULT_PERSISTED':'UNVERIFIED_NO_REQUEST_SCOPED_LEDGER'),
  pcSourceWrites:0,configWrites:0,taskWrites:0};
}
