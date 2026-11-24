// CNN R10 Sidecar: pinned, bounded Git-input comparison only.
// It does not execute the Sidecar, alter the live checkout or infer the
// historical first-failing predicate from a later snapshot.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFixedReadonlyBytes} from '../controller/fixed-readonly-bytes.mjs';
import {inspectSidecarSourceGate} from '../controller/fear-greed-archive-readonly.mjs';

const DATA_ROOT='E:/ZGmini/data';
const CHECKOUT='E:/ZGmini/projects/zgmini-earnings-history-pc-release';
const ARCHIVE_SHA='ce07af0b5e8d17625644e204f2815c1f754aff2468bc5434ac13c0dadcecd907';
const SHA40=/^[a-f0-9]{40}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const unknown=code=>({
 schema:'ZGMINI_CNN_GIT_INPUTS_READONLY_V1',status:'STATE_UNKNOWN',code,
 evidence:'CURRENT_CHECKOUT_INPUTS_NOT_HISTORICAL_FAILURE_PROOF',
 historicalFalsePredicate:'UNVERIFIED',sidecarRuntimeSourceRoot:'UNVERIFIED',
 operationalWrites:0,providerCalls:0,d1Writes:0
});
const pickSource=v=>typeof v==='string'&&SHA40.test(v)?v:null;

export function projectCnnGitInputs({
 sourcePinned=false,guardCandidatesVerified=false,ledgerStable=false,
 ledgerReason=null,sourceHead=null,sourceHeadStable=false,
 approvedConfigSource=null,configStable=false,branch=null,
 trackedStatus=null,scriptText=null
}={}){
 if(!sourcePinned||!guardCandidatesVerified||!ledgerStable||!configStable||
    !sourceHeadStable||!pickSource(sourceHead)||!pickSource(approvedConfigSource)||
    typeof trackedStatus!=='string'||trackedStatus.length>32768||
    typeof branch!=='string'||typeof scriptText!=='string')
  return unknown('CNN_GIT_INPUTS_INCOMPLETE');
 const clean=trackedStatus.trim()==='';
 return {
  schema:'ZGMINI_CNN_GIT_INPUTS_READONLY_V1',
  status:'PASS',code:'CNN_GIT_INPUT_SNAPSHOT_CAPTURED',
  evidence:'CURRENT_CHECKOUT_INPUTS_NOT_HISTORICAL_FAILURE_PROOF',
  knownCheckoutSourceHead:sourceHead,
  approvedConfigSource,
  headMatchesApprovedSource:sourceHead===approvedConfigSource,
  trackedTreeClean:clean,
  branchClass:branch==='main'?'MAIN':branch==='HEAD'?'DETACHED':'OTHER',
  // A literal checkout reference is indicative only: dynamic resolution is
  // possible even if a literal basename is absent.
  sidecarLiteralCheckoutReference:scriptText.toLowerCase().includes(
   'zgmini-earnings-history-pc-release')?'PRESENT':'NOT_FOUND',
  sidecarRuntimeSourceRoot:'UNVERIFIED',
  ledgerReasonClass:ledgerReason==='SOURCE SHA'?'SOURCE_SHA_BLOCKED':'OTHER_OR_UNKNOWN',
  sourcePinVerified:true,ledgerSnapshotStable:true,configSnapshotStable:true,
  historicalFalsePredicate:'UNVERIFIED',
  operationalWrites:0,providerCalls:0,d1Writes:0
 };
}

export function inspectCnnGitInputsReadonly(){
 const root=DATA_ROOT,checkout=CHECKOUT;
 const file=path.join(root,'pc-writer','archive-sidecar-r7','archive-run.mjs');
 const ledger=path.join(root,'pc-writer','archive-sidecar-r7','last-run.json');
 const config=path.join(root,'pc-writer','config.json');
 let realRoot,realCheckout;
 try{
  realRoot=fs.realpathSync.native(root);
  realCheckout=fs.realpathSync.native(checkout);
  // Junctions may be legitimate: validate the fixed root's resolved identity
  // through bounded file reads rather than demanding unchanged path spelling.
  if(!fs.statSync(realRoot).isDirectory()||
     !fs.statSync(realCheckout).isDirectory()||
     !fs.existsSync(path.join(checkout,'.git')))
   return unknown('CNN_FIXED_ROOT_UNVERIFIED');
 }catch{return unknown('CNN_FIXED_ROOT_UNAVAILABLE');}
 const bounded=(p,max)=>readFixedReadonlyBytes(p,{
  verifiedRoot:realRoot,minBytes:2,maxBytes:max
 });
 const archive=bounded(file,131072);
 if(!archive.ok||sha(archive.bytes)!==ARCHIVE_SHA)
  return unknown('CNN_ARCHIVE_R10_PIN_UNVERIFIED');
 const beforeLedger=bounded(ledger,65536),beforeConfig=bounded(config,131072);
 if(!beforeLedger.ok||!beforeConfig.ok)
  return unknown('CNN_GUARD_INPUT_FILES_UNAVAILABLE');
 const guard=inspectSidecarSourceGate(root);
 const expected=[
  ['archive-run.mjs',19,'GIT_REFERENCE'],
  ['archive-run.mjs',21,'GIT_REFERENCE'],
  ['archive-run.mjs',23,'CLEAN_TREE_REFERENCE']
 ];
 const guardCandidatesVerified=guard.ledgerStatus==='READ'&&
  guard.scriptStatus?.length===4&&guard.scriptStatus.every(x=>
   x.status==='MATCH'&&x.modifiedAfterLedger===false)&&
  expected.every(([file,line,kind])=>guard.sourceGuardCandidates?.some(x=>
   x.file===file&&x.line===line&&x.kind===kind));
 if(!guardCandidatesVerified)return unknown('CNN_GUARD_SIGNATURE_UNVERIFIED');
 let approvedConfigSource,ledgerReason;
 try{
  const c=JSON.parse(beforeConfig.bytes.toString('utf8'));
  const l=JSON.parse(beforeLedger.bytes.toString('utf8'));
  approvedConfigSource=pickSource(c?.source);
  const raw=[l?.reason,l?.blockedBy,l?.result?.reason,l?.archive?.reason]
   .find(x=>typeof x==='string');
  ledgerReason=typeof raw==='string'&&raw.length<=256?
   raw.toUpperCase().trim().replace(/\s+/g,' '):null;
 }catch{return unknown('CNN_GUARD_INPUT_JSON_UNVERIFIED');}
 const binaries=[
  'C:/Program Files/Git/cmd/git.exe','C:/Program Files/Git/bin/git.exe'
 ];
 const bin=binaries.find(x=>fs.existsSync(x));
 if(!bin)return unknown('CNN_FIXED_GIT_UNAVAILABLE');
 const git=args=>{
  const r=spawnSync(bin,['-C',checkout,'-c','core.fsmonitor=false',...args],{
   shell:false,windowsHide:true,encoding:'utf8',timeout:12000,maxBuffer:32768,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}
  });
  if(r.error||r.status!==0||typeof r.stdout!=='string'||r.stdout.length>32768)
   return null;
  return r.stdout.trim();
 };
 const sourceHead=git(['rev-parse','--verify','HEAD']);
 const branch=git(['rev-parse','--abbrev-ref','HEAD']);
 const trackedStatus=git(['status','--porcelain','--untracked-files=no']);
 const sourceHeadAfter=git(['rev-parse','--verify','HEAD']);
 const afterLedger=bounded(ledger,65536),afterConfig=bounded(config,131072);
 if(!afterLedger.ok||!afterConfig.ok)return unknown('CNN_GUARD_INPUT_CHANGED_OR_UNREADABLE');
 const ledgerStable=sha(beforeLedger.bytes)===sha(afterLedger.bytes);
 const configStable=sha(beforeConfig.bytes)===sha(afterConfig.bytes);
 return projectCnnGitInputs({
  sourcePinned:true,guardCandidatesVerified,
  ledgerStable,ledgerReason,sourceHead,
  sourceHeadStable:!!sourceHead&&sourceHead===sourceHeadAfter,
  approvedConfigSource,configStable,branch,trackedStatus,
  scriptText:archive.bytes.toString('utf8')
 });
}
