/**
 * R17 fixed-scope Windows operating-source dry-run. NO mutation, no provider,
 * no database, no Core task editing. Not wired to the public A-grade pc-job.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {taskAction} from '../controller/pc-source-readonly.mjs';

export const R17_ROOT='E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release';
export const R17_APPROVED='a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e';
export const R17_PATCH_SHA='7db5c51e4b8c99ec3254af4dbf1c63965ae27035c783ab8775805a10589da401';
export const R17_BASE_FILES=Object.freeze({
 'scripts/pc-writer/local-cycle.mjs':'9c3fc7788907a2f8756b7ff82c372124a2e26253557b7db8a93eb6c8428eadee',
 'scripts/pc-writer/run-local.mjs':'4370f6f725b0a9ce3d093d3c94e766624f24e8a02896afb79b063d21a9747502',
 'scripts/pc-writer/quota-fetch.mjs':'6be2406ee68524c561f911c61b8f9d62ca604ec96f34bdb9752d78346acc3c13',
});
export const R17_MISSING=Object.freeze([
 'scripts/pc-writer/us-breadth-provisional-cycle.mjs',
 'scripts/pc-writer/us-breadth-provisional-publication.mjs',
 'lib/market-breadth/us-provisional-r1.mjs',
]);
export const R17_VBS_CHAIN=Object.freeze([
 {path:'data/pc-writer/archive-sidecar-r7/run-original-then-archive.vbs',
  sha256:'9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c'},
 {path:'data/pc-writer/cutover-evidence/inflation-r37-2026-10-20T19-39-19-549Z/run-local-core.vbs',
  sha256:'bb3e11c0b5c8da07162b1c824e7b52e7a7c2f987c079f29713211a2413932b01'},
]);
const decoded=bytes=>bytes.length>3&&bytes[1]===0&&bytes[3]===0?
 bytes.toString('utf16le'):bytes.toString('utf8');
export function assessR17TaskChain({action,launchers}={}){
 const first=R17_VBS_CHAIN[0],second=R17_VBS_CHAIN[1];
 if(!action||!Array.isArray(launchers)||launchers.length!==2)return false;
 if(!/[/\\]wscript\.exe$/i.test(action.command??''))return false;
 const arg=(action.arguments??'').trim().replace(/^"|"$/g,'');
 const normalized=path.win32.normalize(arg).toLowerCase();
 if(!normalized.endsWith(path.win32.normalize(first.path.replaceAll('/', '\\')).toLowerCase()))return false;
 if(launchers[0]?.sha256!==first.sha256||launchers[1]?.sha256!==second.sha256)return false;
 // Static chain only, never proof of which executable version is running.
 const firstText=launchers[0]?.text??'',secondText=launchers[1]?.text??'';
 return /run-local-core\.vbs/i.test(firstText)&&/local-cycle\.mjs/i.test(secondText);
}

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitBinary=()=>['C:\\Program Files\\Git\\cmd\\git.exe',
 'C:\\Program Files (x86)\\Git\\cmd\\git.exe'].find(fs.existsSync);

/** Pure, independently tested fail-closed admission. No source bytes in result. */
export function assessR17Evidence(e){
 const reasons=[];
 if(e?.head!==R17_APPROVED)reasons.push('OPERATING_SOURCE_SHA_MISMATCH');
 if(e?.dirty!==false)reasons.push('OPERATING_SOURCE_DIRTY_OR_UNVERIFIED');
 for(const [name,expected] of Object.entries(R17_BASE_FILES))
  if(e?.hashes?.[name]!==expected)reasons.push('BASE_FILE_SHA_MISMATCH:'+name);
 for(const name of R17_MISSING)
  if(e?.present?.[name]!==false)reasons.push('NEW_FILE_ALREADY_PRESENT_OR_UNKNOWN:'+name);
 if(e?.patchHash!==R17_PATCH_SHA)reasons.push('PR957_PATCH_HASH_UNVERIFIED');
 if(e?.patchApplies!==true)reasons.push('PR957_CONTEXT_CONFLICT_OR_UNVERIFIED');
 if(e?.quotaContract!==true)reasons.push('LOCAL_ALPACA_GUARD_UNVERIFIED');
 if(e?.taskLinked!==true)reasons.push('CORE_TASK_SOURCE_LINK_UNVERIFIED');
 return {status:reasons.length?'BLOCKED':'STATIC_PREFLIGHT_PASS',
  code:reasons[0]??'STATIC_PREFLIGHT_ONLY_NOT_B_APPROVAL',
  reasons,sourceHead:e?.head??null,
  checkedExistingFiles:Object.keys(R17_BASE_FILES).length,
  checkedNewFiles:R17_MISSING.length,
  runtimeSourceVerified:false,canInstall:false,providerCalls:0,sqliteWrites:0,d1Writes:0};
}

function textAt(root,name,cap=262144){
 const file=path.join(root,...name.split('/'));
 const actual=fs.realpathSync.native(file);
 const rel=path.relative(root,actual);
 if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('PATH_ESCAPES_APPROVED_ROOT');
 const stat=fs.statSync(actual);
 if(!stat.isFile()||stat.size>cap)throw Error('FILE_INVALID_OR_OVERSIZED');
 return fs.readFileSync(actual);
}
function git(root,args){
 const binary=gitBinary();if(!binary)throw Error('GIT_UNAVAILABLE');
 return execFileSync(binary,['--no-optional-locks','-C',root,...args],
  {encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
}
function staticQuotaContract(root){
 const fetchText=textAt(root,'scripts/pc-writer/quota-fetch.mjs').toString('utf8');
 const policyText=textAt(root,'scripts/pc-writer/quota-policy.mjs').toString('utf8');
 const ledgerText=textAt(root,'scripts/pc-writer/quota-ledger.mjs').toString('utf8');
 return /\bcreateQuotaFetch\b/.test(fetchText)&&
  /\bALPACA\b/.test(fetchText)&&
  /\bproviderForUrl\b/.test(fetchText)&&
  /perMinute\s*:\s*140\b/.test(policyText)&&
  /warningPerMinute\s*:\s*120\b/.test(policyText)&&
  /protectedRemaining\s*:\s*60\b/.test(policyText)&&
  /alwaysEnforce\s*:\s*true\b/.test(policyText)&&
  /alpacaQuotaLedgerPath/.test(ledgerText)&&
  /withAlpacaLock/.test(ledgerText)&&
  /alpacaReserve/.test(ledgerText);
}
/**
 * Live PC invocation is deliberate and read-only. This code cannot be called
 * through existing pc-job or pc-maintenance contracts; a separate reviewed,
 * approved fixed B-lane is required to run it on the user's PC.
 */
export function inspectR17Windows(){
 if(process.platform!=='win32')return {status:'BLOCKED',code:'WINDOWS_REQUIRED'};
 const patch=path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../approvals/us-breadth-r17-core-pr957.patch');
 const evidence={head:null,dirty:null,hashes:{},present:{},
  patchHash:null,patchApplies:false,quotaContract:false,taskLinked:false};
 try{
  const root=fs.realpathSync.native(R17_ROOT);
  if(path.win32.normalize(root).toLowerCase()!==
     path.win32.normalize(R17_ROOT).toLowerCase())
   throw Error('UNEXPECTED_SOURCE_JUNCTION');
  evidence.head=git(root,['rev-parse','--verify','HEAD']).trim().toLowerCase();
  evidence.dirty=git(root,['status','--porcelain','--untracked-files=no']).trim()==='';
  for(const name of Object.keys(R17_BASE_FILES))
   evidence.hashes[name]=digest(textAt(root,name));
  for(const name of R17_MISSING){
   const file=path.join(root,...name.split('/'));
   try{fs.lstatSync(file);evidence.present[name]=true;}
   catch(error){evidence.present[name]=error?.code==='ENOENT'?false:null;}
  }
  evidence.quotaContract=staticQuotaContract(root);
  const patchBytes=fs.readFileSync(patch);
  if(patchBytes.length>65536)throw Error('PATCH_TOO_LARGE');
  evidence.patchHash=digest(patchBytes);
  if(evidence.patchHash===R17_PATCH_SHA){
   try{git(root,['apply','--check','--whitespace=error',patch]);evidence.patchApplies=true;}
   catch{/* Real context conflicts are blockers; never force a patch. */}
  }
  // Only the exact observed VBS chain is admitted. Neither a Task working
  // directory nor a historical checkout by itself establishes live source.
  const task=execFileSync('schtasks.exe',
   ['/Query','/TN','ZGMINI-PC-Local-Core','/XML'],
   {windowsHide:true,timeout:10000,maxBuffer:262144});
  const action=taskAction(task);
  const launchers=R17_VBS_CHAIN.map(item=>{
   const bytes=textAt('E:\\ZGmini',item.path,65536);
   return {sha256:digest(bytes),text:decoded(bytes)};
  });
  evidence.taskLinked=assessR17TaskChain({action,launchers});
 }catch{/* Never disclose paths, source, credentials, command outputs or raw errors. */}
 return assessR17Evidence(evidence);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=inspectR17Windows();
 process.stdout.write(JSON.stringify(result)+'\n');
 if(result.status!=='STATIC_PREFLIGHT_PASS')process.exitCode=2;
}
