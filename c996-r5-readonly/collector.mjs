// #996 queue-PC source-only readback; never installs, mounts, commits, discards or boots.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import readline from 'node:readline';
import {pathToFileURL} from 'node:url';

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
const MAX_LOG_BYTES = 64 * 1024 * 1024;
const MAX_LOGS = 16;

export function allowedLogName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9_.-]{1,96}\.log$/i.test(name) &&
    (/\.dism\.log$/i.test(name) || /^(?:DISM|MOUNT|UNMOUNT|COMMIT|IMAGE|WIM)[A-Za-z0-9_.-]*\.log$/i.test(name));
}
export function eventCode(line) {
  if (typeof line !== 'string') return null;
  if (/\/Unmount-Image[^\r\n]*\/Commit|DismUnmountImageHandle[^\r\n]*commit/i.test(line)) return 'COMMIT_REQUEST';
  if (/\/Mount-Image|DismMountImage/i.test(line)) return 'MOUNT_REQUEST';
  if (/\b(?:metadata|meta-data|image information|image info|editionid|installationtype|languages)\b/i.test(line)) return 'METADATA_MENTION';
  if (/\b(?:error\s*[:#=]?\s*(?:0x[0-9a-f]+|[1-9][0-9]*)|failed\s+to|HRESULT\s*[:=]\s*0x[0-9a-f]+)\b/i.test(line)) return 'ERROR_MENTION';
  if (/The operation completed successfully|successfully committed/i.test(line)) return 'OPERATION_SUCCESS';
  return null;
}
export function logTimestamp(line) {
  const m = typeof line === 'string' && line.match(/\[(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})\]/);
  return m ? m[1] : null;
}
export function classification(files, logs) {
  const commitEvidence = logs.some(x => x.counts?.COMMIT_REQUEST > 0 || /COMMIT/i.test(x.name||''));
  return commitEvidence ? 'LOGS_PRESENT_STAGE_UNPROVEN' : 'COMMIT_LOG_NOT_ESTABLISHED';
}
function codeOf(e) { return e && typeof e.code === 'string' ? e.code.slice(0,50) : 'UNEXPECTED_ERROR'; }
function statNoLink(p) {
  // Reject reparse/junction traversal in every known path ancestor, not just leaf.
  let cur = path.win32.resolve(p);
  while (true) {
    const s = fs.lstatSync(cur);
    if (s.isSymbolicLink()) throw Object.assign(new Error('REPARSE_LINK_STOP'),{code:'REPARSE_LINK_STOP'});
    const parent=path.win32.dirname(cur);
    if (parent===cur) return fs.lstatSync(p);
    cur=parent;
  }
}
function safeInputFile(p) {
  // Fixed paths only; caller never supplies a path or traversal component.
  const s = statNoLink(p);
  if (!s.isFile()) throw Object.assign(new Error('NOT_A_REGULAR_FILE'),{code:'NOT_A_REGULAR_FILE'});
  return s;
}
async function hashFile(p) {
  const s = safeInputFile(p), h = crypto.createHash('sha256');
  let bytes=0;
  for await (const b of fs.createReadStream(p)) {bytes+=b.length;h.update(b);}
  return {bytes,sha256:h.digest('hex'),mtimeMs:s.mtimeMs};
}
async function validatePins() {
  const items=[];
  for (const entry of FIXED) {
    const v=await hashFile(entry.file);
    items.push({id:entry.id,matched:v.bytes===entry.bytes && v.sha256===entry.sha,bytes:v.bytes,sha256:v.sha256});
    if (!items.at(-1).matched) throw Object.assign(new Error('PIN_MISMATCH'),{code:'PIN_MISMATCH'});
  }
  return items;
}
async function metadataFile(x) {
  try {
    const s=safeInputFile(x.file);
    if (s.size>16*1024*1024) return {id:x.id,status:'TOO_LARGE',bytes:s.size};
    const h=await hashFile(x.file);
    return {id:x.id,status:'PRESENT',bytes:h.bytes,sha256:h.sha256};
  } catch(e) {if(e.code==='ENOENT') return {id:x.id,status:'MISSING'}; throw e;}
}
function selectLogs() {
  const selected=[];
  for (const {id,dir} of LOG_DIRS) {
    try {
      const s=statNoLink(dir);
      if (!s.isDirectory()) throw Object.assign(new Error('INVALID_LOG_DIRECTORY'),{code:'INVALID_LOG_DIRECTORY'});
      const names=fs.readdirSync(dir);
      for (const name of names) if (allowedLogName(name)) {
        const p=path.win32.join(dir,name);
        const st=safeInputFile(p);
        if (st.size>MAX_LOG_BYTES) throw Object.assign(new Error('LOG_TOO_LARGE'),{code:'LOG_TOO_LARGE'});
        selected.push({id,name,absolute:p,size:st.size});
      }
    } catch(e) {if(e.code!=='ENOENT') throw e;}
  }
  if (selected.length>MAX_LOGS) throw Object.assign(new Error('LOG_COUNT_LIMIT'),{code:'LOG_COUNT_LIMIT'});
  return selected;
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
      const code=eventCode(line);
      if (code) {
        counts[code]=(counts[code]||0)+1;
        if (events.length<8) events.push({line:lines,code,at:logTimestamp(line)});
      }
    }
  } finally {rl.close();stream.destroy();}
  const h=await hashFile(x.absolute);
  if(h.bytes!==preHash.bytes || h.sha256!==preHash.sha256) throw Object.assign(new Error('LOG_CHANGED_DURING_READ'),{code:'LOG_CHANGED_DURING_READ'});
  return {directory:x.id,name:x.name,bytes:h.bytes,sha256:h.sha256,lines,counts,events};
}
function createReportBase(){return {schema:'C996_R5_LOG_EVIDENCE_READONLY_V1',host:TARGET_HOST,runId:crypto.randomUUID(),status:'STOPPED',code:'NOT_RUN',imageMetadata:'IMAGE_METADATA_DRIFT_CONFIRMED',rootCauseStage:'UNKNOWN',isoOnlyPassPreserved:true,operationalWrites:0,discardAttempts:0,isoAttempts:0,rawLogIncluded:false,inputs:[],fixedEvidence:[],logs:[]};}
async function main() {
  const report=createReportBase();
  let out=null;
  try {
    if(process.platform!=='win32'||os.hostname().toUpperCase()!==TARGET_HOST||process.arch!=='x64') throw Object.assign(new Error('WRONG_HOST'),{code:'WRONG_HOST'});
    // R5 input paths stay pinned under the original user TEMP. A self-hosted
    // Runner may use a different Windows identity and therefore a different
    // OS TEMP; use it only for NEW diagnostic output, never as an input root.
    const outputTemp=path.win32.resolve(os.tmpdir());
    if(!/^C:\\\\[^\\]+/i.test(outputTemp) || outputTemp===path.win32.parse(outputTemp).root)
      throw Object.assign(new Error('OUTPUT_TEMP_NOT_C_DRIVE'),{code:'OUTPUT_TEMP_NOT_C_DRIVE'});
    const outputBaseStat=statNoLink(outputTemp);
    if(!outputBaseStat.isDirectory())
      throw Object.assign(new Error('OUTPUT_TEMP_NOT_DIRECTORY'),{code:'OUTPUT_TEMP_NOT_DIRECTORY'});
    out=path.win32.join(outputTemp,'C996_R5_READONLY_'+report.runId.replaceAll('-',''));
    fs.mkdirSync(out,{recursive:false});
    report.inputs=await validatePins();
    for(const x of FIXED_TXT) report.fixedEvidence.push(await metadataFile(x));
    const selected=selectLogs();
    for(const x of selected) report.logs.push(await inspectLog(x));
    const after=await validatePins();
    if(after.some((x,i)=>x.sha256!==report.inputs[i].sha256)) throw Object.assign(new Error('POST_HASH_MISMATCH'),{code:'POST_HASH_MISMATCH'});
    report.inputHashesUnchanged=after.length;
    report.code=classification(report.fixedEvidence,report.logs);
    report.status=report.code==='LOGS_PRESENT_STAGE_UNPROVEN'?'COMPLETE':'PARTIAL';
  } catch(e) {
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
