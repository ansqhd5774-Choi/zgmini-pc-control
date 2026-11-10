// #996 original Windows PC: a supplementary READ-ONLY protected-state probe.
// This records current item-level SHA values; it CANNOT reconstruct a missing
// pre-pause baseline or prove that unrelated actors never changed these items.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {REQUEST_996,ORIGINAL_ROOTS} from './controller-996-windows-observer.mjs';

const ORIGINAL_FINGERPRINT=
 '877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const names=['config.json','quota-runner.cmd','run-local.cmd'];
const tasks=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(condition,code)=>{if(!condition)throw Object.assign(Error(code),{code});};

function readWriterFile(root,name){
 need(fs.lstatSync(root).isDirectory()&&!fs.lstatSync(root).isSymbolicLink(),
  'WRITER_ROOT_UNSAFE');
 const target=path.join(root,name);
 need(fs.lstatSync(target).isFile()&&!fs.lstatSync(target).isSymbolicLink(),
  'WRITER_PROTECTED_FILE_UNSAFE');
 need(fs.statSync(target).size<=2_000_000,'WRITER_PROTECTED_FILE_TOO_LARGE');
 return fs.readFileSync(target);
}
function readWindowsTask(name){
 need(tasks.includes(name),'TASK_UNEXPECTED_NAME');
 const exe=path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe');
 return execFileSync(exe,['/Query','/TN',name,'/XML'],{
  windowsHide:true,timeout:15000,maxBuffer:2e6});
}
function readTaskEnabled(xml){
 // schtasks.exe may produce UTF-16LE when stdout is captured on Windows.
 const isUtf16Le=(xml[0]===0xff&&xml[1]===0xfe)||
  (xml.length>4&&xml[1]===0&&xml[3]===0);
 const text=isUtf16Le?xml.toString('utf16le').replace(/^\uFEFF/,''):
  xml.toString('utf8').replace(/^\uFEFF/,'');
 const settings=/<Settings(?:\s[^>]*)?>([\s\S]*?)<\/Settings>/i.exec(text)?.[1];
 if(settings===undefined)return null;
 const enabled=/<Enabled>\s*(true|false)\s*<\/Enabled>/i.exec(settings)?.[1];
 // XML Schema defaults <Settings><Enabled> to true when omitted; the complete
 // XML byte hash is still required for future pre/post comparison.
 return enabled===undefined?true:enabled.toLowerCase()==='true';
}

export function collect996ProtectedItems({writerRoot=ORIGINAL_ROOTS.writer,
 readFile=readWriterFile,readTask=readWindowsTask,
 now=()=>new Date().toISOString(),expectedFingerprint=ORIGINAL_FINGERPRINT}={}){
 const files={},taskDigests={},taskEnabled={};
 for(const name of names){
  const bytes=readFile(writerRoot,name);
  need(Buffer.isBuffer(bytes),'WRITER_PROTECTED_BYTES_INVALID');
  files[name]=sha(bytes);
 }
 for(const name of tasks){
  const bytes=readTask(name);
  need(Buffer.isBuffer(bytes),'PROTECTED_TASK_BYTES_INVALID');
  taskDigests[name]=sha(bytes);
  taskEnabled[name]=readTaskEnabled(bytes);
 }
 const protectionNow={files,tasks:taskDigests};
 const fingerprint=sha(Buffer.from(JSON.stringify(protectionNow)));
 const complete=names.every(name=>typeof files[name]==='string')&&
  tasks.every(name=>typeof taskDigests[name]==='string'&&
   typeof taskEnabled[name]==='boolean');
 return {
  schema:'ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1',
  requestId:REQUEST_996.requestId,issueNumber:996,observedAt:now(),
  status:complete&&fingerprint===expectedFingerprint?
   'CURRENT_ITEMS_MATCH_OBSERVATION':'CURRENT_ITEMS_DIFFER_OR_UNPROVEN',
  items:{files,taskSha256:taskDigests,taskEnabled},
  currentFingerprint:fingerprint,originalObservationFingerprint:expectedFingerprint,
  fingerprintMatch:fingerprint===expectedFingerprint,allFivePresent:complete,
  historicalBaselineAvailable:false,allActorsImmutableProven:false,
  operationalWrites:0,issuePosts:0,pcRetries:0,executionAuthorized:false,
 };
}

export function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
  !process.env.RUNNER_NAME,'ORIGINAL_WINDOWS_OPERATOR_REQUIRED');
 need(args.length===0,'READONLY_FIXED_USAGE');
 return collect996ProtectedItems();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(main(),null,2));}
 catch(e){console.log(JSON.stringify({
  schema:'ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1',
  status:'STATE_UNKNOWN',code:/^[A-Z0-9_]+$/.test(e.code??'')?
   e.code:'PROTECTED_ITEMS_READ_FAILED',operationalWrites:0,issuePosts:0,
  pcRetries:0,executionAuthorized:false}));process.exitCode=2;}
}
