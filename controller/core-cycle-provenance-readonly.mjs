// Bounded, read-only independent corroboration of a naturally completed Core
// cycle. This never executes a Task, reads SQLite or invokes providers.
// The Core's in-cycle Windows TaskEngine/WMI witness is only accepted when the
// exact installed witness/entrypoint bytes and private child reports agree.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const BASE=String.raw`E:\ZGmini\data\pc-writer`;
const SOURCE=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const SHA40=/^[0-9a-f]{40}$/;
const SHA256=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROOF_FILES=Object.freeze([
 'core-cycle-id.mjs','core-origin-runtime.mjs','core-origin-wmi.mjs'
]);
const invalid=code=>({status:'STATE_UNKNOWN',code,runtimeSourceVerified:false,
 recentCoreSourceVerified:false,evidenceLevel:'HISTORICAL_CYCLE_UNVERIFIED',
 providerCalls:0,operationalWrites:0,d1Writes:0,sqliteOpened:false});
const epoch=value=>typeof value==='string'&&/^20\d\d-\d\d-\d\dT/.test(value)&&
 Number.isFinite(Date.parse(value))?Date.parse(value):null;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

export function verifyStoredCoreCycle({cycle,collection,writer,approvedSource,
 installedHashes,now=Date.now()}={}){
 if(!Number.isSafeInteger(now)||now<946684800000)return invalid('CORE_RECENT_CLOCK_INVALID');
 if(!cycle||!collection||!writer||!SHA40.test(approvedSource??'')||
  !UUID.test(cycle.coreCycleId??'')||cycle.lane!=='core'||
  collection.coreCycleId!==cycle.coreCycleId||writer.coreCycleId!==cycle.coreCycleId)
  return invalid('CORE_RECENT_CYCLE_ID_NOT_LINKED');
 if(cycle.coreOriginEvidence!=='TASK_ENGINE_WMI_CAPTURED_AT_START'||
  cycle.coreOriginCode!=='CORE_TASK_ENGINE_CAPTURED_AT_START'||
  !Number.isSafeInteger(cycle.coreNodeCreatedAtMs))
  return invalid('CORE_RECENT_TASK_ORIGIN_UNVERIFIED');
 const start=epoch(cycle.coreCycleStartedAt),end=epoch(cycle.at);
 const collected=epoch(collection.at),written=epoch(writer.at);
 if(start===null||end===null||collected===null||written===null||
  start>now+60000||now-end>3600000||end<start||
  cycle.coreNodeCreatedAtMs<start-30000||cycle.coreNodeCreatedAtMs>start+30000||
  collected<start-2000||collected>end+2000||
  written<start-2000||written>end+2000||
  written<collected-2000||end>now+60000)
  return invalid('CORE_RECENT_TIMELINE_UNVERIFIED');
 if(cycle.coreCheckoutSourceSha!==approvedSource||writer.source!==approvedSource)
  return invalid('CORE_RECENT_APPROVED_SOURCE_MISMATCH');
 if(!SHA256.test(cycle.coreEntrypointSha256??'')||
    !installedHashes||installedHashes['local-cycle.mjs']!==cycle.coreEntrypointSha256)
  return invalid('CORE_RECENT_ENTRYPOINT_BYTES_MISMATCH');
 for(const name of PROOF_FILES){
  if(!SHA256.test(cycle.coreProofFileSha256?.[name]??'')||
    installedHashes[name]!==cycle.coreProofFileSha256[name])
   return invalid('CORE_RECENT_PROBE_BYTES_MISMATCH');
 }
 return {status:'PASS',code:'CORE_RECENT_RUNTIME_SOURCE_VERIFIED',
  evidenceLevel:'NATURAL_TASK_ENGINE_WMI_CAPTURE_AND_SAVED_CYCLE_CROSSCHECK',
  runtimeSourceVerified:true,activeCoreSourceVerified:false,
  recentCoreSourceVerified:true,sourceSha:approvedSource,
  coreCycleId:cycle.coreCycleId,
  cycleFinishedAt:cycle.at,sourceFileHashesVerified:true,
  providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0};
}
const DEPLOY_SOURCE_FILES=Object.freeze([
 'local-cycle.mjs',...PROOF_FILES,
 'collect-local.mjs','run-local.mjs','collection-events.mjs'
]);
// Exact source-owned paths only; never writes to the checkout or probes a remote.
// This is a local-commit test, not a requirement that the SHA exists on GitHub.
export function verifyPinnedCheckoutGit({
 checkoutRoot=SOURCE,fileSystem=fs,exec=execFileSync,
}={}){
 const bins=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files (x86)\Git\cmd\git.exe`];
 const exe=bins.find(p=>fileSystem.existsSync(p));
 if(!exe)return {status:'UNVERIFIED',code:'CORE_RECENT_GIT_UNAVAILABLE'};
 const pre=['--no-optional-locks','-c','core.fsmonitor=false',
  '-c','core.untrackedCache=false','-C',checkoutRoot];
 const options={encoding:'utf8',windowsHide:true,timeout:8000,maxBuffer:32768,
  env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}};
 try{
  const head=exec(exe,[...pre,'rev-parse','--verify','HEAD'],options).trim().toLowerCase();
  if(!SHA40.test(head))return {status:'UNVERIFIED',code:'CORE_RECENT_HEAD_UNVERIFIED'};
  const tracked=exec(exe,[...pre,'status','--porcelain','--untracked-files=all','--',
   ...DEPLOY_SOURCE_FILES.map(n=>'scripts/pc-writer/'+n)],options);
  if(typeof tracked!=='string'||tracked.trim()!=='')
   return {status:'UNVERIFIED',code:'CORE_RECENT_SOURCE_DIRTY'};
  return {status:'PASS',head,code:'CORE_RECENT_CHECKOUT_CLEAN'};
 }catch{return {status:'UNVERIFIED',code:'CORE_RECENT_GIT_UNAVAILABLE'};}
}
function readBounded(root,relative,{fileSystem=fs,maxBytes=2_000_000}={}){
 try{
  const canonical=fileSystem.realpathSync.native??fileSystem.realpathSync;
  const base=canonical(root),f=path.join(root,relative);
  const st=fileSystem.lstatSync(f);
  if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>maxBytes)return null;
  const actual=canonical(f),rel=path.relative(base,actual);
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))return null;
  const bytes=fileSystem.readFileSync(f),after=fileSystem.lstatSync(f);
  if(!Buffer.isBuffer(bytes)||bytes.length!==st.size||after.size!==st.size||
     after.mtimeMs!==st.mtimeMs)return null;
  return bytes;
 }catch{return null;}
}
export function inspectStoredCoreCycleEvidence({
 dataRoot=BASE,checkoutRoot=SOURCE,fileSystem=fs,now=Date.now(),
 checkoutProof=verifyPinnedCheckoutGit,
}={}){
 const readJson=(root,file,maxBytes)=>{
  const bytes=readBounded(root,file,{fileSystem,maxBytes});
  if(!bytes)return null;
  try{const obj=JSON.parse(bytes.toString('utf8'));
   return obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:null;
  }catch{return null;}
 };
 const config=readJson(dataRoot,'config.json',131072);
 const cycle=readJson(dataRoot,'local-cycle-last-run.json',1_000_000);
 const collection=readJson(dataRoot,'local-collection-last-run.json',1_000_000);
 const writer=readJson(dataRoot,'local-writer-last-run.json',2_000_000);
 if(!config||!cycle||!collection||!writer)return invalid('CORE_RECENT_PRIVATE_LEDGER_UNAVAILABLE');
 const head=checkoutProof({checkoutRoot,fileSystem});
 if(head?.status!=='PASS'||head?.head!==config.source)
  return invalid(head?.status==='PASS'?'CORE_RECENT_HEAD_SOURCE_MISMATCH':
   head?.code??'CORE_RECENT_HEAD_UNVERIFIED');
 const installedHashes={};
 for(const name of ['local-cycle.mjs',...PROOF_FILES]){
  const bytes=readBounded(checkoutRoot,path.join('scripts','pc-writer',name),{
   fileSystem,maxBytes:1_000_000});
  if(!bytes)return invalid('CORE_RECENT_SOURCE_BYTES_UNAVAILABLE');
  installedHashes[name]=digest(bytes);
 }
 return verifyStoredCoreCycle({cycle,collection,writer,
  approvedSource:typeof config.source==='string'?config.source:null,
  installedHashes,now});
}
