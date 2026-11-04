// R54 six-file SHA-pinned B source promotion library (source-only draft).
// NOT an installed receiver, arbitrary shell runner, or operational approval.
// An independently approved B host must enforce issue/actor/manifest, task-idle,
// exclusive maintenance lease, exact live source hashes and reviewer consent.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const R54_B_SCHEMA='ZGMINI_R54_SIXFILE_SOURCE_B_PROTOTYPE_V1';
export const FILES=Object.freeze([
 Object.freeze({path:'scripts/pc-writer/theme-nine-r54-public-connect.mjs',
  old:'c6e4699d62bdef991911561623e37c205fd8bb6e5aa69907c3e93e36908fd31e',
  next:'8698389663d2e71c5684c4bcc2dd1e9b0a68d06cc002769b1d2a8e3e68289d3d'}),
 Object.freeze({path:'scripts/pc-writer/theme-nine-r51-stage-current.mjs',
  old:'fe079b1e2e5d2f824f6e0ff251bd2a01677fe1a477072c619b614402fbd90ae4',
  next:'5a50761756be6081c71df7aa30869ed43547fbb867e476b7c581072939c27560'}),
 Object.freeze({path:'scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs',
  old:'dfc326e2738c1b8b82451510104ac6ad502e2a9876e0a3a76d939c412e907bb7',
  next:'7378d04bccea4c68ab93ce3b1b829b5bc0a742db49b88d1e7530482c4ea8b6cc'}),
 Object.freeze({path:'scripts/pc-writer/theme-nine-r54-public-record.mjs',
  old:'f2a688da40d7b5ee90ed2a27a40af05b9c63116284930f1cc26041064737d012',
  next:'85686106412b2c4a5af51ce5de6b844729bad02441cf9bab1e51ae369a3a4a27'}),
 Object.freeze({path:'scripts/pc-writer/theme-nine-r48-d1-publication.mjs',
  old:'7a10fe41710dbc1a21c9f3e343c538cd96b6c5695b683f04dce48af85ede6e7e',
  next:'fc55ee3a2c998a4dfa7c5edd9230a68fab3954dd745b39bbe39a6177363bf45a'}),
 Object.freeze({path:'worker/theme-nine-r37-public.mjs',
  old:'e6768dd37ebe65b9015aeb37b4a088c568ab839f085936cec8305c56ea36ce33',
  next:'30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85'}),
]);

export const digest=b=>createHash('sha256').update(b).digest('hex');
function fail(code){throw Object.assign(new Error(code),{code});}
function assert(ok,code){if(!ok)fail(code)}
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function file(root,rel){
 const base=fs.realpathSync.native(root);
 assert(fs.statSync(base).isDirectory(),'R54_B_ROOT_NOT_DIRECTORY');
 const parts=rel.split('/');
 assert(parts.length>=2&&parts.every(p=>/^[\w.-]+$/.test(p)&&p!=='.'&&p!=='..'),
  'R54_B_BAD_PATH');
 let current=base;
 for(const segment of parts){
  current=path.join(current,segment);
  const st=fs.lstatSync(current);
  assert(!st.isSymbolicLink(),'R54_B_REDIRECT_DENIED');
 }
 const real=fs.realpathSync.native(current);
 assert(real.toLowerCase().startsWith(base.toLowerCase()+path.sep.toLowerCase())&&
  fs.statSync(real).isFile(),'R54_B_OUTSIDE_ROOT');
 return real;
}

function artifact(target,type,next){return `${target}.R54_B_${type}_${next.slice(0,12)}`;}
function readHash(filePath){return digest(fs.readFileSync(filePath));}
const JOURNAL_SCHEMA='ZGMINI_R54_SIXFILE_B_JOURNAL_V1';
function journalFile(journalRoot,requestId,installedRoot){
 assert(typeof requestId==='string'&&/^pc-[a-z0-9-]{8,76}$/.test(requestId),
  'R54_B_REQUEST_ID_REQUIRED');
 assert(typeof journalRoot==='string'&&path.isAbsolute(journalRoot),
  'R54_B_JOURNAL_ROOT_REQUIRED');
 const root=fs.realpathSync.native(journalRoot);
 assert(fs.statSync(root).isDirectory(),'R54_B_JOURNAL_ROOT_INVALID');
 if(installedRoot!==undefined){
  const installed=fs.realpathSync.native(installedRoot).toLowerCase();
  const actual=root.toLowerCase();
  assert(actual!==installed&&!actual.startsWith(installed+path.sep.toLowerCase()),
   'R54_B_JOURNAL_INSIDE_SOURCE_DENIED');
 }
 return path.join(root,`R54_B_SIXFILE_${requestId}.jsonl`);
}
function journalLastState(journalRoot,requestId,installedRoot){
 const journal=journalFile(journalRoot,requestId,installedRoot);
 if(!fs.existsSync(journal))return null;
 assert(!fs.lstatSync(journal).isSymbolicLink(),'R54_B_JOURNAL_REDIRECT_DENIED');
 const bytes=fs.readFileSync(journal);
 assert(bytes.length>0&&bytes.length<=64*1024,'R54_B_JOURNAL_INVALID');
 const value=bytes.toString('utf8');
 assert(value.endsWith('\n'),'R54_B_JOURNAL_INCOMPLETE');
 let previous=null;
 for(const line of value.trimEnd().split('\n')){
  let record;
  try{record=JSON.parse(line);}catch{fail('R54_B_JOURNAL_INVALID')}
  assert(record.schema===JOURNAL_SCHEMA&&
   ['STAGING','STAGED','SWAP_STARTED','FILE_APPLIED','STAGING_FAILED',
    'CAS_BLOCKED','SWAP_INTERRUPTED','ROLLED_BACK_VERIFIED',
    'RECOVERY_REQUIRED','SUCCEEDED'].includes(record.phase)&&
   Number.isSafeInteger(record.seq)&&record.seq===(previous?.seq??-1)+1&&
   (record.file===null||FILES.some(x=>x.path===record.file)),
   'R54_B_JOURNAL_INVALID');
  previous=record;
 }
 return previous.phase;
}
export const readR54RecoveryJournalStatus=journalLastState;
function sourceRows({installedRoot,candidateRoot}){
 return FILES.map(spec=>{
  const target=file(installedRoot,spec.path),candidate=file(candidateRoot,spec.path);
  const oldHash=readHash(target),newHash=readHash(candidate);
  assert(newHash===spec.next,'R54_B_CANDIDATE_SHA_DENIED');
  assert(oldHash===spec.old||oldHash===spec.next,'R54_B_INSTALLED_SHA_UNKNOWN');
  const stage=artifact(target,'STAGED',spec.next);
  const backup=artifact(target,'BACKUP',spec.next);
  const rejected=artifact(target,'REJECTED',spec.next);
  assert(!fs.existsSync(stage)&&!fs.existsSync(rejected),
   'R54_B_STAGE_OR_REJECTED_PRESENT');
  if(fs.existsSync(backup)){
   assert(oldHash===spec.next&&readHash(backup)===spec.old,
    'R54_B_BACKUP_CONFLICT');
  }
  return {...spec,target,candidate,oldHash,stage,backup,rejected};
 });
}

/** Read-only; caller must supply the exact approved B manifest and lease proof. */
export function preflight({installedRoot,candidateRoot,manifest,gate,
 journalRoot,requestId}={}){
 assert(manifest?.schema===R54_B_SCHEMA&&manifest?.status==='APPROVED_B'&&
  manifest.scope==='R54_FIXED_SIXFILE_SOURCE_ONLY'&&manifest.runCount===1&&
  manifest.noProviderCalls===true&&manifest.noD1Writes===true&&
  manifest.noTaskChanges===true&&manifest.noControllerChanges===true&&
  eq(manifest.files,FILES),'R54_B_MANIFEST_SCOPE_DENIED');
 assert(gate?.publisherConsentVerified===true&&gate?.taskIdleVerified===true&&
  gate?.maintenanceLeaseVerified===true&&gate?.activeR54ProcessAbsent===true&&
  gate?.sourceRootVerified===true&&gate?.scoreReplayApproved===true&&
  typeof gate?.observedAt==='string'&&
  Number.isFinite(Date.parse(gate.observedAt))&&
  Math.abs(Date.now()-Date.parse(gate.observedAt))<60000,
  'R54_B_RUNTIME_GATE_REQUIRED');
 const journalPhase=journalLastState(journalRoot,requestId,installedRoot);
 const rows=sourceRows({installedRoot,candidateRoot});
 assert(journalPhase===null||journalPhase==='SUCCEEDED'&&
  rows.every(x=>x.oldHash===x.next),
  'R54_B_PRIOR_JOURNAL_REQUIRES_RECONCILIATION');
 assert(rows.every(x=>x.oldHash===x.old)||rows.every(x=>x.oldHash===x.next),
  'R54_B_MIXED_SOURCE_VERSION_STOP');
 const already=rows.every(x=>x.oldHash===x.next);
 assert(already||rows.every(x=>!fs.existsSync(x.backup)),
  'R54_B_OLD_SOURCE_BACKUP_PRESENT');
 return {status:already?'ALREADY_INSTALLED':'READY_TO_STAGE',
  expectedChangedFiles:already?0:FILES.length,
  hashes:rows.map(x=>({path:x.path,old:x.oldHash,target:x.next})),rows};
}

function copyAndSync(source,dest){
 fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL);
 const fd=fs.openSync(dest,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd)}
}

/**
 * B-only prototype: two phases. Stage all 6 and hash-check before any swap;
 * preserve each old file as an immutable backup; on failed swap, preserve the
 * rejected new file and restore all originals. Never removes files.
 * Caller must hold an exclusive validated B maintenance lease until return.
 */
export function applyApprovedSix({installedRoot,candidateRoot,manifest,gate,
 journalRoot,requestId,
 runtimeProbe,beforeSwap=()=>{}}={}){
 assert(typeof runtimeProbe==='function','R54_B_RUNTIME_REPROBE_REQUIRED');
 const check=preflight({installedRoot,candidateRoot,manifest,gate,journalRoot,requestId});
 if(check.status==='ALREADY_INSTALLED')return {status:'ALREADY_INSTALLED',changed:0};
 const rows=check.rows;
 const fd=fs.openSync(journalFile(journalRoot,requestId,installedRoot),'wx',0o600);
 let seq=0;
 const record=(phase,file=null)=>{
  fs.writeSync(fd,JSON.stringify({schema:JOURNAL_SCHEMA,seq:seq++,phase,file})+'\n');
  fs.fsyncSync(fd);
 };
 try{
 record('STAGING');
 // Phase 1: all candidate copies validated and staged. Live code is untouched.
 try{
  for(const x of rows){
   copyAndSync(x.candidate,x.stage);
   assert(readHash(x.stage)===x.next,'R54_B_STAGE_SHA_STOP');
  }
 }catch{
  record('STAGING_FAILED');
  fail('R54_B_STAGE_RECONCILE_REQUIRED');
 }
 record('STAGED');
 // Validate every live source SHA again immediately before the first swap.
 if(!rows.every(x=>readHash(x.target)===x.old)){
  record('CAS_BLOCKED');
  fail('R54_B_CAS_CHANGED_BEFORE_SWAP');
 }
 const started=[];
 try{
  // Phase 2: fixed-order replacement, no arbitrary path or shell expansion.
  for(const x of rows){
   const live=runtimeProbe(x.path);
   assert(live?.publisherConsentVerified===true&&
    live.taskIdleVerified===true&&live.maintenanceLeaseVerified===true&&
    live.activeR54ProcessAbsent===true&&live.sourceRootVerified===true&&
    typeof live.observedAt==='string'&&
    Number.isFinite(Date.parse(live.observedAt))&&
    Math.abs(Date.now()-Date.parse(live.observedAt))<60000,
    'R54_B_RUNTIME_REPROBE_FAILED');
   beforeSwap(x.path);
   assert(readHash(x.target)===x.old,'R54_B_CAS_CHANGED_DURING_SWAP');
   record('SWAP_STARTED',x.path);
   fs.renameSync(x.target,x.backup);
   started.push(x);
   fs.renameSync(x.stage,x.target);
   assert(readHash(x.target)===x.next,'R54_B_TARGET_READBACK_SHA');
   record('FILE_APPLIED',x.path);
  }
 }catch(error){
  // Recovery must never depend on the journal remaining writable.
  // A full disk or fsync error can occur at precisely this phase.
  let journalUncertain=false;
  try{record('SWAP_INTERRUPTED')}catch{journalUncertain=true}
  const notRestored=[];
  for(const x of [...started].reverse()){
   try{
    if(fs.existsSync(x.target))fs.renameSync(x.target,x.rejected);
    copyAndSync(x.backup,x.target); // Backup stays recoverable.
    if(readHash(x.target)!==x.old)throw new Error('RESTORE_SHA');
   }catch{notRestored.push(x.path)}
  }
  if(notRestored.length){
   try{record('RECOVERY_REQUIRED')}catch{/* retained for external reconciliation */}
   fail('R54_B_RESTORE_REQUIRED');
  }
  if(journalUncertain){
   try{record('RECOVERY_REQUIRED')}catch{/* ledger may be incomplete */}
   fail('R54_B_JOURNAL_RECOVERY_REQUIRED');
  }
  try{record('ROLLED_BACK_VERIFIED')}
  catch{fail('R54_B_JOURNAL_RECOVERY_REQUIRED')}
  throw error;
 }
 record('SUCCEEDED');
 return {status:'SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED',changed:FILES.length,
  backupsPreserved:FILES.length,operationalWrites:FILES.length,
  providerCalls:0,d1Writes:0,controllerWrites:0,taskWrites:0};
 }finally{fs.closeSync(fd)}
}

