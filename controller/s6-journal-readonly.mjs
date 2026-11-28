import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {need} from './common.mjs';

const S6_JOURNAL_REQUEST='pc-s6-d7c0a971-5219-4a3a-9dce-30b0543b0e72';
const S6_JOURNAL_APPROVAL_SHA='b8fed5bebec6a473730ed0b09ede5b5dc173db53af5cfc1e619e34a45bb8aefd';
// Second exact S6 B outcome (#4069) needs its own read-only local claim/phase.
// Reuse the original inspection contract; never accept an Issue-selected target.
const S6_CURRENT_JOURNAL_REQUEST='pc-s6-63afb126-72dc-4ec5-a721-4819771fa9ee';
const S6_CURRENT_JOURNAL_APPROVAL_SHA='1fceeba061f7f8731811220b27cac245bd91d44e87d68935cd8475117f094141';
const S6_JOURNAL_SCOPES=Object.freeze({
 ORIGINAL:Object.freeze({requestId:S6_JOURNAL_REQUEST,approvalSha:S6_JOURNAL_APPROVAL_SHA}),
 CURRENT:Object.freeze({requestId:S6_CURRENT_JOURNAL_REQUEST,approvalSha:S6_CURRENT_JOURNAL_APPROVAL_SHA})
});
const s6JournalScope=scope=>Object.hasOwn(S6_JOURNAL_SCOPES,scope)?
 S6_JOURNAL_SCOPES[scope]:null;

// Same bounded window contract as maintenance journal; no updater dependency.
function backlogPauseWindows(state){
 need(state?.schema==='ZGMINI_PC_BACKLOG_V1','BACKLOG_STATE_INVALID');
 const windows=Array.isArray(state.windows)?state.windows:
  [{pausedAt:state.pausedAt,resumedAt:state.resumedAt}];
 need(windows.length>=1&&windows.length<=8,'BACKLOG_WINDOWS_INVALID');
 for(const window of windows){
  const start=Date.parse(window?.pausedAt??''),end=window?.resumedAt==null?null:Date.parse(window.resumedAt);
  need(Number.isFinite(start)&&(end===null||(Number.isFinite(end)&&end>=start)),
   'BACKLOG_WINDOW_INVALID');
 }
 return windows;
}

/**
 * Only the immutable #3947/#4069 S6 one-shot journals are read. This is an A
 * observation of a failed/unknown B effect, NOT a replay or recovery port.
 * Never return the claim nonce, owner PID, raw hashes, arbitrary paths or
 * raw phase files. A live healthy Controller does not establish promotion.
 */
const S6_JOURNAL_PHASES=new Set([
 'CLAIMED','INSTALL_LEASE_ACQUIRE_ATTEMPT','INSTALL_LEASE_ACQUIRED',
 'INTAKE_PAUSE_ATTEMPT','INTAKE_PAUSED','DRAINED','OLD_TREE_STOP_ATTEMPT',
 'OLD_TREE_STOP_SUBMITTED','OLD_TREE_STOP_VERIFIED',
 'INTAKE_RESUME_ATTEMPT','INTAKE_RESUMED','OWNED_LEASE_RELEASE_ATTEMPT',
 'OWNED_LEASE_RELEASED','WATCHDOG_RELEASE_OBSERVED',
 'FAST_PROMOTION_OBSERVED','WATCHDOG_RELEASE_OUTCOME_UNVERIFIED',
 'BACKLOG_RECONCILE_ATTEMPT','BACKLOG_RECONCILED',
 'PROMOTED_READBACK_VERIFIED','RECOVERY_REQUIRED'
]);
// S6 #4069 and issue #4078 are immutable fixed targets. This is a
// diagnostic time-window comparison only: never replay an Issue or infer
// worker PASS from a backlog journal state.
export function projectS64078BacklogReadonly(backlog){
 const out={originalIssueNumber:4078,pauseWindowContainsIssueOpenedAt:null,
  windowCount:null,replayLedgerStatus:'UNVERIFIED',executionEstablished:false};
 if(backlog===null)return {...out,replayLedgerStatus:'BACKLOG_ABSENT'};
 if(backlog?.schema!=='ZGMINI_PC_BACKLOG_V1'||
    backlog.requestId!==S6_CURRENT_JOURNAL_REQUEST)return out;
 let windows;
 try{windows=backlogPauseWindows(backlog);}
 catch{return out;}
 const count=windows.length;
 if(windows.some(w=>w.resumedAt===null))
  return {...out,windowCount:count,replayLedgerStatus:'WINDOW_NOT_CLOSED'};
 const issueOpened=Date.parse('2026-11-26T19:14:52Z');
 const overlaps=windows.some(w=>issueOpened>=Date.parse(w.pausedAt)-2000&&
   issueOpened<=Date.parse(w.resumedAt));
 const replays=backlog.replays;
 if(replays!==undefined&&(replays===null||typeof replays!=='object'||
    Array.isArray(replays)))return {...out,windowCount:count,
     pauseWindowContainsIssueOpenedAt:overlaps};
 const record=replays?.['4078'];
 const permitted=new Set(['POSTING','DONE','SKIPPED_RESULT_PRESENT','REJECTED_INVALID_ORIGINAL']);
 const state=record===undefined?'NOT_RECORDED':
  record&&typeof record==='object'&&permitted.has(record.status)?
   record.status:'UNVERIFIED';
 return {...out,windowCount:count,pauseWindowContainsIssueOpenedAt:overlaps,
  replayLedgerStatus:state};
}
export function projectS6OnceJournalReadonly(raw,{scope='ORIGINAL'}={}){
 const fixed=s6JournalScope(scope);
 const base={schema:'ZGMINI_S6_ONCE_JOURNAL_A_V1',
  requestId:fixed?.requestId??null,status:'STATE_UNKNOWN',
  code:'S6_ONCE_JOURNAL_UNVERIFIED',claimPresent:null,
  journalPhase:null,failedAt:null,failedCode:null,
  mutationAttempted:null,leaseReleaseAcknowledged:null,
  priorOwnerByteMatch:null,backlogState:'UNVERIFIED',
  effectExecuted:null,successEstablished:false,
  recoveryAuthorized:false,originalRequestRetried:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const invalid=(code)=>({...base,code});
  if(!fixed)return invalid('S6_ONCE_FIXED_SCOPE_DENIED');
 if(raw?.approvalValid!==true||typeof raw.ownerByteMatch!=='boolean')
  return invalid('S6_ONCE_APPROVAL_OR_OWNER_CAS_UNVERIFIED');
 const owner={priorOwnerByteMatch:raw.ownerByteMatch};
 if(raw.claimPresent===false&&raw.journal===null&&raw.backlog===null)
  return {...base,...owner,status:'READ_ONLY_OBSERVED',
   code:'S6_ONCE_CLAIM_ABSENT_AT_OBSERVATION',claimPresent:false,
   backlogState:'ABSENT'};
 if(raw.claimPresent!==true)
  return invalid('S6_ONCE_CLAIM_STATUS_UNVERIFIED');
 if(raw.claimValid!==true)
  return invalid('S6_ONCE_CLAIM_IDENTITY_UNVERIFIED');
 const journal=raw.journal;
 if(journal===null)
  return {...base,...owner,claimPresent:true,
   code:'S6_ONCE_CLAIM_WITHOUT_JOURNAL',
   backlogState:raw.backlog===null?'ABSENT':'UNVERIFIED'};
 if(journal?.schema!=='ZGMINI_S6_ONCE_JOURNAL_V1'||
    journal.requestId!==fixed.requestId||
    !S6_JOURNAL_PHASES.has(journal.phase))
  return invalid('S6_ONCE_JOURNAL_IDENTITY_UNVERIFIED');
 const failedAt=typeof journal.failedAt==='string'&&
  S6_JOURNAL_PHASES.has(journal.failedAt)?journal.failedAt:null;
 const failedCode=typeof journal.code==='string'&&
  /^S6_[A-Z0-9_]{1,90}$/.test(journal.code)?journal.code:null;
 const backlog=raw.backlog;
 if(backlog!==null&&(backlog.schema!=='ZGMINI_PC_BACKLOG_V1'||
    backlog.requestId!==fixed.requestId||
    !Array.isArray(backlog.windows)||backlog.windows.length<1||
    typeof backlog.pausedAt!=='string'))
  return invalid('S6_ONCE_BACKLOG_IDENTITY_UNVERIFIED');
 const backlogState=backlog===null?'ABSENT':
  backlog.resumedAt?'RESUMED':'PAUSED';
 return {...base,...owner,status:'READ_ONLY_OBSERVED',
  code:'S6_ONCE_JOURNAL_PHASE_OBSERVED',claimPresent:true,
  journalPhase:journal.phase,failedAt,failedCode,
  mutationAttempted:typeof journal.mutationAttempted==='boolean'?
   journal.mutationAttempted:null,
  leaseReleaseAcknowledged:
   typeof journal.leaseReleaseAcknowledged==='boolean'?
   journal.leaseReleaseAcknowledged:null,
  backlogState,
  ...(scope==='CURRENT'?{backlog4078:projectS64078BacklogReadonly(backlog)}:{})};
}
/**
 * Check exact immutable GitHub approval bytes in a reusable Windows checkout.
 * Git's existing worktree can retain CRLF when .gitattributes is introduced
 * after the original checkout. Only CRLF -> LF canonicalization is permitted,
 * and only when the original approved SHA-256 then matches exactly.
 * This is read-only diagnostic evidence, NOT an alternate B authorization.
 */
export function s6OncePinnedApprovalCheckoutBytes(raw,{scope='ORIGINAL'}={}){
 const fixed=s6JournalScope(scope);
 if(!fixed||!Buffer.isBuffer(raw)||raw.length<1||raw.length>32768)return null;
 const digest=b=>createHash('sha256').update(b).digest('hex');
 if(digest(raw)===fixed.approvalSha)return raw;
 const canonical=[];
 let changed=false;
 for(let i=0;i<raw.length;i++){
  const b=raw[i];
  if(b===13){
   if(raw[i+1]!==10)return null;
   changed=true;
   continue;
  }
  canonical.push(b);
 }
 if(!changed)return null;
 const bytes=Buffer.from(canonical);
 return digest(bytes)===fixed.approvalSha?bytes:null;
}

export function inspectS6OnceJournalReadonly({
 io=fs,maintenanceHome='E:/ZGmini/automation/pc-maintenance',
 controllerHome='E:/ZGmini/automation/pc-control',
 sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),
  scope='ORIGINAL'
}={}){
 const fixed=s6JournalScope(scope);
  const unknown=code=>({...projectS6OnceJournalReadonly(null,{scope}),code});
  if(!fixed)return unknown('S6_ONCE_FIXED_SCOPE_DENIED');
 let stage='APPROVAL';
 try{
  const file=(p,max=32768)=>{
   const st=io.lstatSync(p);
   if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
      st.size<1||st.size>max)throw Error('S6_A_FIXED_FILE_UNVERIFIED');
   const bytes=io.readFileSync(p);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)
    throw Error('S6_A_FIXED_BYTES_CHANGED');
   return bytes;
  };
  const read=p=>JSON.parse(file(p).toString('utf8'));
  const approvalFile=path.join(sourceRoot,'approvals/controller-s6',
   fixed.approvalSha+'.json');
  const bytes=s6OncePinnedApprovalCheckoutBytes(file(approvalFile),{scope});
  const sha=x=>createHash('sha256').update(x).digest('hex');
  if(bytes===null)
   return unknown('S6_ONCE_APPROVAL_BYTES_UNVERIFIED');
  const approved=JSON.parse(bytes.toString('utf8'));
  if(approved.schema!=='ZGMINI_PC_S6_ONCE_B_APPROVAL_V1'||
     approved.requestId!==fixed.requestId||
     approved.approval?.approved!==true||
     !/^[a-f0-9]{64}$/.test(approved.ownerSha256??''))
   return unknown('S6_ONCE_APPROVAL_IDENTITY_UNVERIFIED');
  stage='CONTROLLER_OWNER';
  const originalOwner=file(path.join(controllerHome,'leases/supervisor/owner.json'));
  const ownerByteMatch=sha(originalOwner)===approved.ownerSha256;
  stage='LEDGER_DIR';
  const ledger=path.join(maintenanceHome,'ledger');
  const ls=io.lstatSync(ledger);
  if(!ls.isDirectory()||ls.isSymbolicLink())
   return unknown('S6_ONCE_LEDGER_ROOT_UNVERIFIED');
  const owned=path.join(ledger,'S6_ONCE_'+fixed.requestId);
  let dir;
  try{dir=io.lstatSync(owned);}
  catch(error){
   if(error?.code==='ENOENT')
    return projectS6OnceJournalReadonly({approvalValid:true,
     ownerByteMatch,claimPresent:false,journal:null,backlog:null},{scope});
   throw error;
  }
  if(!dir.isDirectory()||dir.isSymbolicLink())
   return unknown('S6_ONCE_CLAIM_DIR_UNVERIFIED');
  stage='CLAIM';
  const claim=read(path.join(owned,'claim.json'));
  const claimValid=claim.schema==='ZGMINI_S6_CLAIM_V1'&&
   claim.requestId===fixed.requestId&&
   typeof claim.nonce==='string'&&/^[0-9a-f-]{36}$/.test(claim.nonce);
  const optional=(name,stageName)=>{
   stage=stageName;
   try{return read(path.join(owned,name));}
   catch(error){if(error?.code==='ENOENT')return null;throw error;}
  };
  const journal=optional('journal.json','JOURNAL');
  const backlog=optional('backlog.json','BACKLOG');
  return projectS6OnceJournalReadonly({approvalValid:true,
   ownerByteMatch,claimPresent:true,claimValid,journal,backlog},{scope});
 }catch{return unknown('S6_ONCE_'+stage+'_READ_UNVERIFIED');}
}


// PASS attests only the previously observed failure/resume state.
// Complete bounded evidence stays in the existing local Controller ledger.
export function inspectS64069ReconciliationReadonly(options={}){
 const evidence=inspectS6OnceJournalReadonly({
  sourceRoot:'E:/ZGmini/projects/zgmini-pc-control',...options,scope:'CURRENT'});
 const matched=evidence.status==='READ_ONLY_OBSERVED'&&
  evidence.claimPresent===true&&evidence.journalPhase==='RECOVERY_REQUIRED'&&
  evidence.failedAt==='WATCHDOG_RELEASE_OUTCOME_UNVERIFIED'&&
  evidence.failedCode==='S6_PORT_PROMOTION_UNVERIFIED'&&
  evidence.mutationAttempted===true&&evidence.leaseReleaseAcknowledged===true&&
  evidence.backlogState==='RESUMED'&&evidence.successEstablished===false&&
  evidence.backlog4078?.pauseWindowContainsIssueOpenedAt===true&&
  ['NOT_RECORDED','POSTING','DONE','SKIPPED_RESULT_PRESENT','REJECTED_INVALID_ORIGINAL'].includes(evidence.backlog4078?.replayLedgerStatus);
 return {status:matched?'PASS':'STATE_UNKNOWN',
  code:matched?'S6_4069_PRIOR_FAILURE_RESUME_CONFIRMED':'S6_4069_CURRENT_RECONCILIATION_UNVERIFIED',
  evidence,originalS6SuccessEstablished:false,originalRequestRetried:false,
  operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false};
}
