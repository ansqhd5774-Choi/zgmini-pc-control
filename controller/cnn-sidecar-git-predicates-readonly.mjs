// One bounded operating-PC source-state read. This is NOT Sidecar execution,
// a source approval, or a replacement for its original fail-closed guards.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const ARCHIVE_SHA='ce07af0b5e8d17625644e204f2815c1f754aff2468bc5434ac13c0dadcecd907';
const CHECKOUT='zgmini-earnings-history-pc-release';
const SHA40=/^[a-f0-9]{40}$/i;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const safeSha=value=>typeof value==='string'&&SHA40.test(value)?value.toLowerCase():null;
const UNKNOWN='UNVERIFIED';
const inside=(root,file)=>{
 const rel=path.relative(root,file);
 return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);
};
const fixedRead=(file,root,maximum)=>{
 try{
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>maximum)return null;
  const canonicalRoot=fs.realpathSync.native(root);
  const canonicalFile=fs.realpathSync.native(file);
  if(!inside(canonicalRoot,canonicalFile))return null;
  const bytes=fs.readFileSync(file);
  return bytes.length===stat.size?bytes:null;
 }catch{return null;}
};
const safeJson=bytes=>{
 if(!bytes)return null;
 try{
  const parsed=JSON.parse(bytes.toString('utf8'));
  return parsed&&!Array.isArray(parsed)&&typeof parsed==='object'?parsed:null;
 }catch{return null;}
};
function gitRead(checkout,args){
 const installed=process.platform==='win32'?
  ['C:\\Program Files\\Git\\cmd\\git.exe',
   'C:\\Program Files (x86)\\Git\\cmd\\git.exe'].find(fs.existsSync):'git';
 if(!installed)throw Error('GIT_NOT_INSTALLED');
 return execFileSync(installed,['--no-optional-locks','-c','core.fsmonitor=false',
  '-c','core.untrackedCache=false','-C',checkout,...args],{
  encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536,
  env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
}
// Values are derived from independently fixed files/Git reads. No source
// statement is executed or inferred to have raised the observed ledger reason.
export function projectCnnGitEvidence(raw){
 const head=safeSha(raw?.head),approved=safeSha(raw?.approved),
  checkpoint=safeSha(raw?.checkpoint);
 const pin=raw?.sourcePin===true,stable=raw?.ledgerStable===true;
 const gitVerified=raw?.gitVerified===true&&head!==null&&
  (raw?.trackedClean===true||raw?.trackedClean===false);
 const configVerified=approved!==null,verified=pin&&stable&&gitVerified&&configVerified;
 const mismatch=gitVerified&&configVerified?head!==approved:null;
 const trackedDirty=gitVerified?!raw.trackedClean:null;
 const wholeTreeClean=gitVerified&&typeof raw?.wholeTreeClean==='boolean'?
  raw.wholeTreeClean:null;
 return {
  schema:'ZGMINI_CNN_GIT_PREDICATES_READONLY_V1',
  status:verified?'PASS':'STATE_UNKNOWN',
  code:verified?'CNN_GIT_PREDICATE_EVIDENCE_COLLECTED':'CNN_GIT_PREDICATES_UNVERIFIED',
  evidence:'INDEPENDENT_CHECKOUT_SNAPSHOT_NOT_SIDECAR_ERROR_SITE',
  sourcePinVerified:pin,ledgerStable:stable,
  ledgerBlocked:raw?.ledgerStatus==='BLOCKED'?true:
   raw?.ledgerStatus==='PASS'?false:null,
  gitCheckoutVerified:gitVerified,configSourceVerified:configVerified,
  gitHeadMatchesConfig:mismatch===null?null:!mismatch,
  trackedTreeClean:gitVerified?raw.trackedClean:null,
  wholeTreeClean,
  untrackedOnlyDirty:trackedDirty===false&&wholeTreeClean===false?true:
   wholeTreeClean===null?null:false,
  // A bounded lexical clue, not proof the Sidecar executed this branch.
  sourceStatusGuardClass:pin&&[
   'TRACKED_ONLY','UNTRACKED_INCLUDED','DEFAULT_OR_UNKNOWN','NOT_FOUND'
  ].includes(raw?.sourceStatusGuardClass)?raw.sourceStatusGuardClass:'UNVERIFIED',
  gitHeadMatchesCheckpoint:head&&checkpoint?head===checkpoint:null,
  // The pinned script can compute the checkout at runtime; a static source
  // mention is a clue only, not proof of its actual Git cwd.
  pinnedScriptMentionsCheckout:pin?
   (raw?.mentionsCheckout===true?true:raw?.mentionsCheckout===false?false:null):null,
  sourceGuardCandidatesVerified:pin&&raw?.guardSites===true,
  // A head mismatch / dirty worktree may be relevant, but not necessarily
  // the predicate which generated the ledger's SOURCE SHA reason.
  failurePredicateResolved:false,sidecarFailureResolved:false,
  operationalWrites:0,providerCalls:0,d1Writes:0,
 };
}
export function inspectCnnGitPredicatesReadonly(dataRoot,{strictPlatform=true,
 git=gitRead}={}){
 const root=path.resolve(dataRoot);
 const empty={sourcePin:false,ledgerStable:false,ledgerStatus:null,head:null,
  approved:null,checkpoint:null,gitVerified:false,trackedClean:null,
  mentionsCheckout:null,guardSites:false,wholeTreeClean:null,
  sourceStatusGuardClass:'UNVERIFIED'};
 if((strictPlatform&&(process.platform!=='win32'||
      path.normalize(root).toLowerCase()!==path.normalize('E:\\ZGmini\\data').toLowerCase()))
    ||typeof git!=='function')return projectCnnGitEvidence(empty);
 const sidecar=path.join(root,'pc-writer','archive-sidecar-r7');
 const script=path.join(sidecar,'archive-run.mjs');
 const initial=fixedRead(script,root,131072);
 if(!initial||sha(initial)!==ARCHIVE_SHA)return projectCnnGitEvidence(empty);
 empty.sourcePin=true;
 const lines=initial.toString('utf8').split(/\r?\n/);
 empty.guardSites=lines.length>=23&&
  [18,20,22].every(i=>/(?:\bif\b|\bneed\b|\bcheck\b|\bassert\b|\bfail\b|\bstop\b)/i.test(lines[i]));
 empty.mentionsCheckout=initial.toString('utf8').toLowerCase().includes(CHECKOUT);
 // Only the three pinned candidate guards are relevant. This classifier
 // returns no private code, options, file names or command arguments.
 const window=lines.slice(18,27).join(' ');
 const hasStatus=/\bstatus\b/i.test(window)&&/porcelain/i.test(window);
 empty.sourceStatusGuardClass=!hasStatus?'NOT_FOUND':
  /--untracked-files\s*(?:=|[\x27\x22, ]+)\s*no\b/i.test(window)?'TRACKED_ONLY':
  /--untracked-files\s*(?:=|[\x27\x22, ]+)\s*(?:normal|all)\b/i.test(window)?'UNTRACKED_INCLUDED':
  'DEFAULT_OR_UNKNOWN';
 const ledgerFile=path.join(sidecar,'last-run.json');
 const ledger1=fixedRead(ledgerFile,root,65536);
 const ledger2=fixedRead(ledgerFile,root,65536);
 const script2=fixedRead(script,root,131072);
 empty.ledgerStable=!!ledger1&&!!ledger2&&!!script2&&
  sha(ledger1)===sha(ledger2)&&sha(initial)===sha(script2);
 if(empty.ledgerStable){
  const ledger=safeJson(ledger2);
  const current=[ledger,ledger?.result,ledger?.archive,ledger?.lastRun]
   .find(x=>x&&typeof x==='object'&&typeof x.status==='string');
  empty.ledgerStatus=['BLOCKED','PASS'].includes(current?.status)?current.status:null;
 }
 const config=safeJson(fixedRead(path.join(root,'pc-writer','config.json'),root,131072));
 empty.approved=[config?.source?.sha,config?.source?.commit,
  config?.source?.commitSha,config?.source,config?.sourceSha].map(safeSha).find(Boolean)??null;
 const checkpoint=safeJson(fixedRead(path.join(root,'pc-writer','local-writer-last-run.json'),
  root,131072));
 empty.checkpoint=safeSha(checkpoint?.source);
 const checkout=path.join(path.dirname(root),'projects',CHECKOUT);
 try{
  const real=fs.realpathSync.native(checkout);
  const parent=fs.realpathSync.native(path.dirname(root));
  const mark=fs.lstatSync(path.join(real,'.git'));
  const sourceFile=fs.lstatSync(path.join(real,'scripts','pc-writer','local-cycle.mjs'));
  if(!inside(parent,real)||!fs.lstatSync(real).isDirectory()||
   fs.lstatSync(real).isSymbolicLink()||
   (!mark.isDirectory()&&!mark.isFile())||mark.isSymbolicLink()||
   !sourceFile.isFile()||sourceFile.isSymbolicLink())throw Error('UNVERIFIED_CHECKOUT');
  const head=git(real,['rev-parse','--verify','HEAD']).trim();
  const status=git(real,['status','--porcelain','--untracked-files=no']);
  // Compare the exact same fixed checkout with untracked content included.
  // Never return status text or filenames.
  let wholeTreeStatus=null;
  try{wholeTreeStatus=git(real,['status','--porcelain','--untracked-files=all']);}
  catch{}
  if(safeSha(head)&&typeof status==='string'&&status.length<=65536){
   empty.gitVerified=true;empty.head=head;
   empty.trackedClean=status.trim().length===0;
   if(typeof wholeTreeStatus==='string'&&wholeTreeStatus.length<=65536)
    empty.wholeTreeClean=wholeTreeStatus.trim().length===0;
  }
 }catch{}
 return projectCnnGitEvidence(empty);
}
