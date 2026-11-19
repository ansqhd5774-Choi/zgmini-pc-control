// #996 queue-PC source-only readback; never installs, mounts, commits, discards or boots.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import readline from 'node:readline';
import {pathToFileURL} from 'node:url';
import {probeFixedAclBoundary} from './acl-boundary.mjs';

export const TARGET_HOST = 'DESKTOP-N62L0NG';
const TEMP = 'C:\\Users\\ansqh\\AppData\\Local\\Temp';
const ROOT = path.win32.join(TEMP, 'C996_ISO_R5_80f18cafcbd44c82af95082138eb51e7');
const ATTEMPT = path.win32.join(ROOT, 'ISO_ATTEMPT_187cd12b4d2a4789b9ef549ba9cda886');
const ADK = 'C:\\Program Files (x86)\\Windows Kits\\10\\Assessment and Deployment Kit\\Windows Preinstallation Environment\\amd64\\en-us\\winpe.wim';
const FIXED = Object.freeze([
  {id:'ADK_WIM',file:ADK,bytes:340134390,sha:'fbcbdb1c6651ab3a69384e9d4f95f2c02321318603849453b252e21e827c8197'},
  {id:'FINAL_WIM',file:path.win32.join(ATTEMPT,'WinPE_amd64','media','sources','boot.wim'),bytes:341652286,sha:'e1397e3ea4e49ee08981fc210415b66b534b2358343ce7e985b996df84d17dbe'},
  {id:'TEST_ISO',file:path.win32.join(ATTEMPT,'iso','C996_WINPE_CNG_TEST_ONLY.iso'),bytes:399980544,sha:'63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588'},
  {id:'BIOS_BCD',file:path.win32.join(ATTEMPT,'WinPE_amd64','media','Boot','BCD'),bytes:16384,sha:'ba146660b06aedbea6e5892378569507c7c3b9387c7bd06a33d58d0fb7dfaa94'},
  {id:'UEFI_BCD',file:path.win32.join(ATTEMPT,'WinPE_amd64','media','EFI','Microsoft','Boot','BCD'),bytes:16384,sha:'877fa52824b660d096aa79263bb150058ea77b1d59f8fc4804ae2fa42708b2a9'}
]);
const FIXED_TXT = Object.freeze([
  {id:'ISO_RESULT',file:path.win32.join(ATTEMPT,'result.json')},
  {id:'FINAL_INDEX_1',file:path.win32.join(ATTEMPT,'FINAL_INDEX_1.txt')},
  {id:'MAKE_ISO',file:path.win32.join(ATTEMPT,'make-iso.txt')},
  {id:'MOUNT_STATUS',file:path.win32.join(ATTEMPT,'MOUNT_STATUS.txt')},
  {id:'DISCARD_RESULT',file:path.win32.join(ROOT,'cleanup-result.json')},
  {id:'ISO_PASS',file:path.win32.join(ROOT,'ISO_ONLY_PASS.json')}
]);
const LOG_DIRS = Object.freeze([
  {id:'R5_ROOT',dir:ROOT},
  {id:'ISO_ATTEMPT',dir:ATTEMPT},
  {id:'ISO_LOGS',dir:path.win32.join(ATTEMPT,'logs')},
  {id:'R5_LOGS',dir:path.win32.join(ROOT,'logs')}
]);
export function fixedAclTargets(){
 return {ownerProfile:path.win32.resolve(TEMP,'..','..','..'),
  ownerTemp:TEMP,r5Root:ROOT,attempt:ATTEMPT};
}
const MAX_LOG_BYTES = 64 * 1024 * 1024;
const MAX_LOGS = 16;

export function allowedLogName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9_.-]{1,96}\.log$/i.test(name) &&
    (/\.dism\.log$/i.test(name) || /^(?:DISM|MOUNT|UNMOUNT|COMMIT|IMAGE|WIM)[A-Za-z0-9_.-]*\.log$/i.test(name));
}
export function eventCodes(line) {
 if (typeof line !== 'string') return [];
 const result=[];
 if (/\/Unmount-Image[^\r\n]*\/Commit|DismUnmountImageHandle[^\r\n]*commit/i.test(line)) result.push('COMMIT_REQUEST');
 if (/\/Mount-Image|DismMountImage/i.test(line)) result.push('MOUNT_REQUEST');
 if (/\b(?:metadata|meta-data|image information|image info|editionid|installationtype|languages)\b/i.test(line)) result.push('METADATA_MENTION');
 if (/\b(?:error\s*[:#=]?\s*(?:0x[0-9a-f]+|[1-9][0-9]*)|failed\s+to|HRESULT\s*[:=]\s*0x[0-9a-f]+)\b/i.test(line)) result.push('ERROR_MENTION');
 if (/The operation completed successfully|successfully committed/i.test(line)) result.push('OPERATION_SUCCESS');
 return result;
}
// Backwards compatible single-event view; the collector uses every event.
export function eventCode(line) { return eventCodes(line)[0]??null; }
export function logTimestamp(line) {
  const m = typeof line === 'string' && line.match(/\[(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})\]/);
  return m ? m[1] : null;
}
export function classification(files, logs) {
  const commitEvidence = logs.some(x => x.counts?.COMMIT_REQUEST > 0);
  return commitEvidence ? 'LOGS_PRESENT_STAGE_UNPROVEN' : 'COMMIT_LOG_NOT_ESTABLISHED';
}
function codeOf(e) { return e && typeof e.code === 'string' ? e.code.slice(0,50) : 'UNEXPECTED_ERROR'; }
export function statNoLink(p,progress=()=>{}) {
  // Existing no-follow validation is unchanged. Report only bounded relative
  // depth and operation, never a raw path or OS error message.
  let cur = path.win32.resolve(p), depth=0;
  while (true) {
    progress('PATH_LSTAT',depth);
    const s = fs.lstatSync(cur);
    if (s.isSymbolicLink()) throw Object.assign(new Error('REPARSE_LINK_STOP'),{code:'REPARSE_LINK_STOP'});
    const parent=path.win32.dirname(cur);
    if (parent===cur) {
      progress('LEAF_RECHECK',0);
      return fs.lstatSync(p);
    }
    cur=parent;depth++;
  }
}
function safeInputFile(p,progress=()=>{}) {
  // Fixed paths only; caller never supplies a path or traversal component.
  const s = statNoLink(p,progress);
  if (!s.isFile()) throw Object.assign(new Error('NOT_A_REGULAR_FILE'),{code:'NOT_A_REGULAR_FILE'});
  return s;
}
async function hashFile(p,progress=()=>{}) {
  const s = safeInputFile(p,progress), h = crypto.createHash('sha256');
  let bytes=0;
  progress('STREAM_READ',null);
  for await (const b of fs.createReadStream(p)) {bytes+=b.length;h.update(b);}
  progress('HASH_COMPLETE',null);
  return {bytes,sha256:h.digest('hex'),mtimeMs:s.mtimeMs};
}
async function validatePins(onAttempt=()=>{},onProgress=()=>{},onlyIds=null) {
 const items=[];
 for (const entry of FIXED) {
  if(onlyIds!==null&&!onlyIds.includes(entry.id))continue;
  onAttempt(entry.id);
  let lastOperation=null,lastDepth=null;
  try {
   const v=await hashFile(entry.file,(operation,depth)=>{
    lastOperation=operation;lastDepth=depth;onProgress(operation,depth);
   });
   items.push({id:entry.id,matched:v.bytes===entry.bytes&&v.sha256===entry.sha,
    bytes:v.bytes,sha256:v.sha256,status:v.bytes===entry.bytes&&v.sha256===entry.sha?'MATCHED':'MISMATCH'});
  } catch(e) {
   // A denied image does not erase other input results or prevent log diagnosis.
   items.push({id:entry.id,matched:false,status:'UNVERIFIED',code:codeOf(e),
    inspectOperation:lastOperation,inspectDepth:lastDepth});
  }
 }
 return items;
}
async function metadataFile(x) {
 try {
  const s=safeInputFile(x.file);
  if (s.size>16*1024*1024) return {id:x.id,status:'TOO_LARGE',bytes:s.size};
  const h=await hashFile(x.file);
  return {id:x.id,status:'PRESENT',bytes:h.bytes,sha256:h.sha256};
 } catch(e) {
  return {id:x.id,status:e.code==='ENOENT'?'MISSING':'UNVERIFIED',
   ...(e.code==='ENOENT'?{}:{code:codeOf(e)})};
 }
}
function selectLogs() {
 const selected=[],errors=[];
 let omitted=0;
 for (const {id,dir} of LOG_DIRS) {
  try {
   const s=statNoLink(dir);
   if(!s.isDirectory())throw Object.assign(Error('INVALID_LOG_DIRECTORY'),{code:'INVALID_LOG_DIRECTORY'});
   const names=fs.readdirSync(dir).sort();
   for(const name of names) if(allowedLogName(name)) {
    try {
     const p=path.win32.join(dir,name),st=safeInputFile(p);
     if(st.size>MAX_LOG_BYTES){omitted++;errors.push({directory:id,code:'LOG_TOO_LARGE'});continue;}
     if(selected.length>=MAX_LOGS){omitted++;continue;}
     selected.push({id,name,absolute:p,size:st.size});
    }catch(e){omitted++;errors.push({directory:id,code:codeOf(e)});}
   }
  }catch(e){if(e.code!=='ENOENT')errors.push({directory:id,code:codeOf(e)});}
 }
 return {selected,omitted,errors:errors.slice(0,16)};
}
async function inspectLog(x) {
  const counts={}, events=[];let lines=0;
  const preHash=await hashFile(x.absolute);
  const stream=fs.createReadStream(x.absolute,{encoding:'utf8'});
  const rl=readline.createInterface({input:stream,crlfDelay:Infinity});
  try {
    for await (const line of rl) {
      lines++;
      if (line.length>65536) throw Object.assign(new Error('LOG_LINE_LIMIT'),{code:'LOG_LINE_LIMIT'});
      for (const code of eventCodes(line)) {
        counts[code]=(counts[code]||0)+1;
        if(events.length<8) events.push({line:lines,code,at:logTimestamp(line)});
      }
    }
  } finally {rl.close();stream.destroy();}
  const h=await hashFile(x.absolute);
  if(h.bytes!==preHash.bytes || h.sha256!==preHash.sha256) throw Object.assign(new Error('LOG_CHANGED_DURING_READ'),{code:'LOG_CHANGED_DURING_READ'});
  return {directory:x.id,name:x.name,bytes:h.bytes,sha256:h.sha256,lines,counts,events};
}
export function createReportBase(){return {schema:'C996_R5_LOG_EVIDENCE_READONLY_V1',host:TARGET_HOST,runId:crypto.randomUUID(),status:'STOPPED',code:'NOT_RUN',imageMetadata:'NOT_DETERMINED_BY_THIS_RUN',rootCauseStage:'UNKNOWN',isoOnlyPassPreserved:true,operationalWrites:0,discardAttempts:0,isoAttempts:0,rawLogIncluded:false,inputs:[],fixedEvidence:[],logs:[],logErrors:[],logOmitted:0,
  inputHashesUnchanged:0,inputChecksComplete:false,logScanComplete:false,aclBoundary:null};}
export async function collectIndependentEvidence(report,{pins=validatePins,
 metadata=metadataFile,discover=selectLogs,inspect=inspectLog}={}) {
 report.inspectStep='PRE_INPUT_HASH';
 report.inputs=await pins(id=>{report.inspectId=id},(operation,depth)=>{
  report.inspectOperation=operation;report.inspectDepth=depth;
 });
 report.inspectStep='EVIDENCE_METADATA';report.inspectId=null;
 report.inspectOperation=null;report.inspectDepth=null;
 for(const entry of FIXED_TXT) {
  report.inspectId=entry.id;
  report.fixedEvidence.push(await metadata(entry));
 }
 report.inspectStep='LOG_DISCOVERY';report.inspectId=null;
 report.inspectOperation=null;report.inspectDepth=null;
 let discovery;
 try{discovery=discover()}catch(e){
  discovery={selected:[],omitted:0,errors:[{directory:'R5_ROOT',code:codeOf(e)}]};
 }
 report.logErrors.push(...discovery.errors);
 report.logOmitted=discovery.omitted;
 report.inspectStep='LOG_READ';report.inspectId=null;
 for(const entry of discovery.selected) {
  report.inspectId=entry.id;
  try {report.logs.push(await inspect(entry));}
  catch(e){report.logErrors.push({directory:entry.id,code:codeOf(e)});}
 }
 report.inspectStep='POST_INPUT_HASH';report.inspectId=null;
 report.inspectOperation=null;report.inspectDepth=null;
 const prior=report.inputs.filter(x=>x.matched).map(x=>x.id);
 const after=await pins(id=>{report.inspectId=id},(operation,depth)=>{
  report.inspectOperation=operation;report.inspectDepth=depth;
 },prior);
 report.inputHashesUnchanged=prior.filter(id=>{
  const before=report.inputs.find(x=>x.id===id),last=after.find(x=>x.id===id);
  return last?.matched===true&&last.sha256===before.sha256&&last.bytes===before.bytes;
 }).length;
 report.inputChecksComplete=report.inputs.length===FIXED.length&&
  report.inputs.every(x=>x.matched===true)&&report.inputHashesUnchanged===FIXED.length;
 report.logScanComplete=report.logOmitted===0&&report.logErrors.length===0;
 report.inspectStep='DONE';report.inspectId=null;
 report.inspectOperation=null;report.inspectDepth=null;
 // A readable COMMIT filename or an inaccessible image is never proof of effect.
 const logCode=classification(report.fixedEvidence,report.logs);
 report.code=!report.inputChecksComplete?'INPUT_INTEGRITY_UNVERIFIED':
  !report.logScanComplete?'LOG_SCAN_INCOMPLETE':logCode;
 report.status=report.inputChecksComplete&&report.logScanComplete&&
  logCode==='LOGS_PRESENT_STAGE_UNPROVEN'?'COMPLETE':'PARTIAL';
 return report;
}
async function main() {
 const report=createReportBase();
 let out=null;
 try {
  if(process.platform!=='win32'||os.hostname().toUpperCase()!==TARGET_HOST||process.arch!=='x64')
   throw Object.assign(new Error('WRONG_HOST'),{code:'WRONG_HOST'});
  // Source input files remain fixed; only output is created in the runner's TEMP.
  const outputTemp=path.win32.resolve(os.tmpdir());
  if(outputTemp.slice(0,3).toUpperCase()!=='C:\\'||outputTemp===path.win32.parse(outputTemp).root)
   throw Object.assign(new Error('OUTPUT_TEMP_NOT_C_DRIVE'),{code:'OUTPUT_TEMP_NOT_C_DRIVE'});
  if(!statNoLink(outputTemp).isDirectory())
   throw Object.assign(new Error('OUTPUT_TEMP_NOT_DIRECTORY'),{code:'OUTPUT_TEMP_NOT_DIRECTORY'});
  out=path.win32.join(outputTemp,'C996_R5_READONLY_'+report.runId.replaceAll('-',''));
  fs.mkdirSync(out,{recursive:false});
  await collectIndependentEvidence(report);
  if(report.inputs.some(x=>x.code==='EPERM'||x.code==='EACCES')||
   report.logErrors.some(x=>x.code==='EPERM'||x.code==='EACCES')){
   report.aclBoundary=probeFixedAclBoundary(fixedAclTargets());
  }
 }catch(e){
  report.status='STOPPED';report.code=codeOf(e);
 }
  if(out) {
    let json=JSON.stringify(report,null,2)+'\n';
    if (Buffer.byteLength(json,'utf8')>32768) {
      report.logs=report.logs.map(({directory,name,bytes,sha256,counts})=>({directory,name,bytes,sha256,counts}));
      report.status='PARTIAL';report.code='REPORT_SIZE_LIMIT';
      json=JSON.stringify(report,null,2)+'\n';
    }
    if (Buffer.byteLength(json,'utf8')>32768) {
      report.logs=[];report.status='PARTIAL';report.code='REPORT_SIZE_LIMIT';
      json=JSON.stringify(report,null,2)+'\n';
    }
    const txt=['schema='+report.schema,'host='+report.host,'status='+report.status,'code='+report.code,'inputs='+report.inputs.filter(x=>x.matched).length+'/5','logs='+report.logs.length,'rootCauseStage=UNKNOWN','operationalWrites=0','rawLogIncluded=false','See JSON for sanitized counts; do not upload raw DISM logs.',''].join('\r\n');
    fs.writeFileSync(path.win32.join(out,'summary.json'),json,{flag:'wx'});
    fs.writeFileSync(path.win32.join(out,'summary.txt'),txt,{flag:'wx'});
    console.log('C996_READONLY '+report.status+' code='+report.code+' logs='+report.logs.length);
    console.log('RESULT_DIR='+out);
  } else console.error('C996_READONLY STOPPED code='+report.code+'; no files written');
  if(report.status!=='COMPLETE') process.exitCode=2;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) await main();
