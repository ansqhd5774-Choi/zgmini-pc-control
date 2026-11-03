/**
 * R17 fixed-scope Windows operating-source dry-run. NO mutation, no provider,
 * no database, no Core task editing. Not wired to the public A-grade pc-job.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {taskAction} from './pc-source-readonly.mjs';

export const R17_ROOT='E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release';
export const R17_APPROVED='a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e';
export const R17_PATCH_SHA='7db5c51e4b8c99ec3254af4dbf1c63965ae27035c783ab8775805a10589da401';
const R17_PATCH_TEXT="diff --git a/scripts/pc-writer/local-cycle.mjs b/scripts/pc-writer/local-cycle.mjs\n--- a/scripts/pc-writer/local-cycle.mjs\n+++ b/scripts/pc-writer/local-cycle.mjs\n@@ -23,6 +23,29 @@ if(fs.existsSync(file)){\n fs.writeFileSync(file,JSON.stringify({pid:process.pid,at:Date.now()}),{flag:'wx'});\n try{\n  const lane=process.argv.includes('--korea')?'korea':'core';\n+ let usProvisional=null;\n+ let usProvisionalEarlyPublication=null;\n+ if(lane==='core'){\n+  // The existing Core task runs every five minutes; collect the completed\n+  // 15-minute IEX slot before potentially long general collection/publication.\n+  // The R17 collector owns its slot deduplication and never touches R1 history.\n+  const provisional=spawnSync(process.execPath,[path.join(here,'us-breadth-provisional-cycle.mjs')],\n+   {windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:5*60000});\n+  try{usProvisional=JSON.parse(provisional.stdout.toString());}\n+  catch{usProvisional={status:'EXECUTION_NOT_VERIFIED',exit:provisional.status??null};}\n+  // The existing Writer publishes the completed IEX slot immediately, before\n+  // potentially long Core collection/projections. Both paths remain inside\n+  // the existing Core lock and registered Task; no new scheduler is created.\n+  if(process.argv.includes('--publish')&&\n+    ['LOCAL_READY','ALREADY_ATTEMPTED_THIS_SLOT','FAILED_PREVIOUS_PROVISIONAL_PRESERVED'].includes(usProvisional.status)){\n+   const early=spawnSync(process.execPath,[path.join(here,'run-local.mjs'),'--publish','--us-provisional-only'],\n+    {windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:2*60000});\n+   try{usProvisionalEarlyPublication=JSON.parse(early.stdout.toString());}\n+   catch{usProvisionalEarlyPublication={status:'EXECUTION_NOT_VERIFIED'};}\n+   usProvisionalEarlyPublication.exit=early.status??null;\n+   if(early.error)usProvisionalEarlyPublication.error=early.error.code??'EXECUTION_FAILED';\n+  }\n+ }\n  const collection=spawnSync(process.execPath,[path.join(here,'collect-local.mjs'),...(lane==='korea'?['--korea']:[])],{windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:30*60000});\n  try{updateDataAlert(base,{key:'collection',failed:collection.status!==0});}catch{console.warn('LOCAL_DATA_ALERT_RECORD_FAILED');}\n  // A provider failure retains stored good data; publication still reads local storage.\n@@ -185,7 +208,7 @@ try{\n   sectors:sectorFearGreedR3Report?.sectors??null,\n   error:sectorFearGreedR3Report?.error??(sectorFearGreedR3?.error?.code??null),\n  }:{nonBlocking:true,status:'SKIPPED_KOREA_LANE'};\n- const report={at:new Date().toISOString(),lane,collectionExit:collection.status,collectionStatus:collectionReport?.status??null,supplyR10,alpacaIncremental,sp500Shadow,sectorFearGreed,researchBreadthR10V9Shadow,publicationExit:publication.status,publishRequested,publishSkipped,publicationPolicy,progressive,researchProspective,researchFundFlowProspective,researchBreadthProspective,researchEarningsR5OfficialRefresh,researchEarningsRiskProvisionalR23,researchEarningsR5Prospective,status:publication.status===0?(publicationPolicy.collectionDegraded?'COMPLETE_WITH_COLLECTION_GAPS':'COMPLETE'):'PUBLICATION_NOT_VERIFIED'};\n+ const report={at:new Date().toISOString(),lane,collectionExit:collection.status,collectionStatus:collectionReport?.status??null,supplyR10,alpacaIncremental,sp500Shadow,usProvisional,usProvisionalEarlyPublication,sectorFearGreed,researchBreadthR10V9Shadow,publicationExit:publication.status,publishRequested,publishSkipped,publicationPolicy,progressive,researchProspective,researchFundFlowProspective,researchBreadthProspective,researchEarningsR5OfficialRefresh,researchEarningsRiskProvisionalR23,researchEarningsR5Prospective,status:publication.status===0?(publicationPolicy.collectionDegraded?'COMPLETE_WITH_COLLECTION_GAPS':'COMPLETE'):'PUBLICATION_NOT_VERIFIED'};\n  save(path.join(base,'local-cycle-last-run.json'),report);console.log(JSON.stringify(report));\n  if(publishRequested)try{updateDataAlert(base,{key:'publication',failed:publication.status!==0});}catch{console.warn('LOCAL_DATA_ALERT_RECORD_FAILED');}\n  if(publication.status!==0)process.exitCode=1;\ndiff --git a/scripts/pc-writer/run-local.mjs b/scripts/pc-writer/run-local.mjs\n--- a/scripts/pc-writer/run-local.mjs\n+++ b/scripts/pc-writer/run-local.mjs\n@@ -38,6 +38,37 @@ if(publish){\n  if(blocked)throw Error(blocked.status);\n  execFileSync('git',['diff','--quiet','HEAD','--','worker','lib','scripts/pc-writer'],{cwd:root,stdio:'pipe',windowsHide:true});\n }\n+// A bounded, provisional-only invocation of the already approved Writer.\n+// It shares the normal source/config/clean checks above, but does not wait for\n+// Core SQLite projections, market publication, or the shared market lease.\n+// Only the independent IEX D1 key may be written; the normal Writer ledger is\n+// deliberately left to the full run-local invocation.\n+if(process.argv.includes('--us-provisional-only')){\n+ const report={at:new Date().toISOString(),source,lane:'US_IEX_PROVISIONAL_EARLY',status:'NOT_ATTEMPTED'};\n+ try{\n+  if(!publish)throw Error('US_PROVISIONAL_PUBLISH_FLAG_REQUIRED');\n+  const {prepareUsProvisional,publishUsProvisional}=await import('./us-breadth-provisional-publication.mjs');\n+  const prepared=prepareUsProvisional(base);\n+  report.inputStatus=prepared.status;\n+  if(prepared.prepared){\n+   const provisionalRemote=client(config,()=>credential(root),{onDiagnostic:diagnostic=>\n+    appendD1Diagnostic(base,{runAt:report.at,source},diagnostic)});\n+   report.publication=await publishUsProvisional(provisionalRemote,config.core,prepared);\n+   report.status=['VERIFIED','ALREADY_VERIFIED'].includes(report.publication.status)?'VERIFIED':report.publication.status;\n+   report.slotEndUtc=prepared.body.slotEndUtc;\n+   report.observedCount=prepared.body.observedCount;\n+   report.missingCount=prepared.body.missingCount;\n+  }else report.status='SKIPPED_NOT_READY';\n+ }catch(error){\n+  report.status='FAILED';\n+  report.error=/^[A-Z][A-Z0-9_]{1,100}$/.test(error?.message??'')?error.message:'US_PROVISIONAL_EARLY_PUBLICATION_FAILED';\n+  process.exitCode=1;\n+ }\n+ report.completedAt=new Date().toISOString();\n+ save(path.join(base,'local-us-breadth-provisional-early-last-run.json'),report);\n+ fs.writeSync(1,JSON.stringify(report)+'\\n');\n+ process.exit(process.exitCode??0);\n+}\n const seed=read(path.join(base,'local-seed-progress.json'));\n if(!Object.keys(seed).length||Object.values(seed).some(x=>!x.complete))throw Error('LOCAL_SEED_INCOMPLETE');\n const core=localDatabase(path.join(base,'storage','core.sqlite'));\n@@ -72,6 +103,11 @@ try{\n   const {prepareUsBreadth}=await import('./market-breadth-us-r1.mjs');\n   report.usBreadth=await prepareUsBreadth(core,{now:new Date(now)});\n  });\n+ // Separate IEX provisional sidecar. The calculation lane never calls Alpaca.\n+ await attemptOutput(report,'us-breadth-provisional-calculation',async()=>{\n+  const {prepareUsProvisional}=await import('./us-breadth-provisional-publication.mjs');\n+  report.usProvisional=prepareUsProvisional(base,{now});\n+ });\n  const marketReady=await attemptOutput(report,'market',async()=>{\n  const body=await calculateMarket(root,core,now);\n  // Reuse the published daily score history already read for the overall chart.\n@@ -228,6 +264,11 @@ try{\n    report.usBreadth.publication=await publishUsBreadth(remote,config.core,report.usBreadth,{now});\n   });\n   else report.usBreadth={...(report.usBreadth??{status:'UNAVAILABLE'}),publication:'SKIPPED_NOT_READY'};\n+  if(report.usProvisional?.prepared)await attemptOutput(report,'us-breadth-provisional-publication',async()=>{\n+   const {publishUsProvisional}=await import('./us-breadth-provisional-publication.mjs');\n+   report.usProvisional.publication=await publishUsProvisional(remote,config.core,report.usProvisional,{now});\n+  });\n+  else report.usProvisional={...(report.usProvisional??{status:'UNAVAILABLE'}),publication:'SKIPPED_NOT_READY'};\n   // Explicit allowlist: publish display outputs only, never provider input/history rows.\n   for(const {id,status} of report.projections){\n    if(status!=='LOCAL_READY')continue;\n";
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
 return {status:reasons.length?'BLOCKED':'PASS',
  code:reasons[0]??'R17_STATIC_PREFLIGHT_PASS_NOT_INSTALL_APPROVAL',
  reasons,sourceHead:e?.head??null,
  checkedExistingFiles:Object.keys(R17_BASE_FILES).length,
  checkedNewFiles:R17_MISSING.length,
  runtimeSourceVerified:false,canInstall:false,providerCalls:0,sqliteWrites:0,d1Writes:0};
}

/** Interrupted probe is a single bounded unknown, not multiple observed failures. */
export function summarizeR17Probe(evidence){
 const report=assessR17Evidence(evidence);
 const at=evidence?.stoppedAt;
 return at?{...report,code:'R17_PREFLIGHT_INTERRUPTED',
  reasons:['R17_PREFLIGHT_INTERRUPTED:'+at],stoppedAt:at}:report;
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
function git(root,args,input=null){
 const binary=gitBinary();if(!binary)throw Error('GIT_UNAVAILABLE');
 return execFileSync(binary,['--no-optional-locks','-c','core.fsmonitor=false',
   '-c','core.untrackedCache=false','-C',root,...args],
  {encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
   input:input??undefined});
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
export function isTrackedSourceDirty(status){
 return typeof status==='string'?status.trim().length>0:null;
}

/**
 * Live PC invocation is deliberate and read-only. This code cannot be called
 * through existing pc-job or pc-maintenance contracts; a separate reviewed,
 * approved fixed B-lane is required to run it on the user's PC.
 */
export function inspectR17Windows(){
 if(process.platform!=='win32')return {status:'BLOCKED',code:'WINDOWS_REQUIRED'};
 // Exact PR #957 two-file patch travels inside this approved controller module.
 const evidence={head:null,dirty:null,hashes:{},present:{},
  patchHash:null,patchApplies:false,quotaContract:false,taskLinked:false,stoppedAt:null};
 let step='SOURCE_ROOT';
 try{
  const root=fs.realpathSync.native(R17_ROOT);
  if(path.win32.normalize(root).toLowerCase()!==
     path.win32.normalize(R17_ROOT).toLowerCase())
   throw Error('UNEXPECTED_SOURCE_JUNCTION');
  step='GIT_HEAD';
  evidence.head=git(root,['rev-parse','--verify','HEAD']).trim().toLowerCase();
  step='GIT_STATUS';
  evidence.dirty=isTrackedSourceDirty(git(root,['status','--porcelain','--untracked-files=no']));
  step='BASE_FILE_HASHES';
  for(const name of Object.keys(R17_BASE_FILES))
   evidence.hashes[name]=digest(textAt(root,name));
  step='NEW_FILE_COLLISIONS';
  for(const name of R17_MISSING){
   const file=path.join(root,...name.split('/'));
   try{fs.lstatSync(file);evidence.present[name]=true;}
   catch(error){evidence.present[name]=error?.code==='ENOENT'?false:null;}
  }
  step='QUOTA_CONTRACT';
  evidence.quotaContract=staticQuotaContract(root);
  step='PATCH_HASH';
  const patchBytes=Buffer.from(R17_PATCH_TEXT,'utf8');
  if(patchBytes.length>65536)throw Error('PATCH_TOO_LARGE');
  evidence.patchHash=digest(patchBytes);
  if(evidence.patchHash===R17_PATCH_SHA){
   try{git(root,['apply','--check','--whitespace=error','-'],patchBytes);evidence.patchApplies=true;}
   catch{/* Real context conflicts are blockers; never force a patch. */}
  }
  // Only the exact observed VBS chain is admitted. Neither a Task working
  // directory nor a historical checkout by itself establishes live source.
  step='CORE_TASK_XML';
  const task=execFileSync(path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe'),
   ['/Query','/TN','ZGMINI-PC-Local-Core','/XML'],
   {windowsHide:true,timeout:10000,maxBuffer:262144});
  const action=taskAction(task);
  step='VBS_CHAIN';
  const launchers=R17_VBS_CHAIN.map(item=>{
   const bytes=textAt('E:\\ZGmini',item.path,65536);
   return {sha256:digest(bytes),text:decoded(bytes)};
  });
  evidence.taskLinked=assessR17TaskChain({action,launchers});
  step=null;
 }catch{/* Never disclose command outputs, paths or secrets. */
  evidence.stoppedAt=step;
 }
 return summarizeR17Probe(evidence);
}
