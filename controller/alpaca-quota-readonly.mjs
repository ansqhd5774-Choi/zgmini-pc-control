import fs from 'node:fs';
import path from 'node:path';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';

const WINDOW_MS=60_000;
const HARD_CAP=140;
const WARNING_AT=120;
const MAX_LEDGER_BYTES=32_768;
const SCOPE='READ_ONLY_NO_PROVIDER_NO_SQLITE_NO_PUBLICATION';

const result=(status,code,details={})=>({status,code,scope:SCOPE,accountWide30Percent:'UNVERIFIED',baseAgreement:'UNVERIFIED',
 operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false,...details});

function readLedger(dataRoot){
 // A fixed host-owned path only: request JSON cannot select a filename.
 const root=path.join(dataRoot,'pc-writer');
 for(const directory of [dataRoot,root]){
  let stat;
  try{stat=fs.lstatSync(directory);}catch{return {error:'ALPACA_BASE_UNAVAILABLE'};}
  if(!stat.isDirectory()||stat.isSymbolicLink())return {error:'ALPACA_BASE_UNVERIFIED'};
 }
 const file=path.join(root,'alpaca-quota-ledger.json');
 const read=readFixedReadonlyBytes(file,{verifiedRoot:root,maxBytes:MAX_LEDGER_BYTES});
 if(!read.ok){
  const errors={MISSING:'ALPACA_LEDGER_ABSENT',UNREADABLE:'ALPACA_LEDGER_UNREADABLE',
   UNSAFE_FILE:'ALPACA_LEDGER_UNSAFE_FILE',SIZE_INVALID:'ALPACA_LEDGER_SIZE_INVALID',
   CHANGED_DURING_READ:'ALPACA_LEDGER_CHANGED_DURING_READ',
   SHORT_READ:'ALPACA_LEDGER_SHORT_READ'};
  return {error:errors[read.reason]??'ALPACA_LEDGER_UNREADABLE'};
 }
 const content=read.bytes.toString('utf8');
 let value;
 try{value=JSON.parse(content);}catch{return {error:'ALPACA_LEDGER_INVALID'};}
 if(!value||value.version!==1||!Array.isArray(value.requestTimes)||
    !value.requestTimes.every(x=>Number.isSafeInteger(x)&&x>=0)||
    (value.lastRemoteLimit!=null&&(!Number.isSafeInteger(value.lastRemoteLimit)||value.lastRemoteLimit<=0))||
    (value.lastRemoteRemaining!=null&&(!Number.isSafeInteger(value.lastRemoteRemaining)||value.lastRemoteRemaining<0))||
    (value.lastRemoteLimit!=null&&value.lastRemoteRemaining!=null&&value.lastRemoteRemaining>value.lastRemoteLimit)||
    (value.lastRemoteResetAt!=null&&(!Number.isSafeInteger(value.lastRemoteResetAt)||value.lastRemoteResetAt<0)))
   return {error:'ALPACA_LEDGER_INVALID'};
 return {value};
}

export function inspectAlpacaQuotaReadonly(dataRoot,{now=Date.now()}={}){
 if(!Number.isSafeInteger(now)||now<0)return result('BLOCKED','ALPACA_CLOCK_INVALID');
 const {error,value}=readLedger(dataRoot);
 if(error)return result('BLOCKED',error);
 if(value.requestTimes.some(x=>x>now+1_000))return result('BLOCKED','ALPACA_CLOCK_DRIFT');
 // Match the live reservation guard: up to 1s future skew is accepted and
 // still counts toward the cap, rather than being treated as a free slot.
 const count=value.requestTimes.filter(x=>x>=now-WINDOW_MS).length;
 const windowState=count>HARD_CAP?'OVER_LIMIT':count===HARD_CAP?'LIMIT_REACHED':
  count>=WARNING_AT?'WARNING':'AVAILABLE';
 const reset=value.lastRemoteResetAt;
 const remoteActive=Number.isSafeInteger(reset)&&reset>now&&reset<=now+24*60*60*1000;
 const limit=remoteActive?value.lastRemoteLimit:null;
 const remaining=remoteActive?value.lastRemoteRemaining:null;
 const remoteReserve=Math.max(60,limit==null?0:Math.ceil(limit*0.3));
 const remoteProtect=remaining!=null&&remaining<=remoteReserve;
 // Last remote fields can also be synthesized after HTTP 429; the current
 // ledger schema cannot prove that an actual response header was observed.
 const observed={windowMs:WINDOW_MS,recentReservations:count,warningAt:WARNING_AT,
  hardCap:HARD_CAP,windowState,localRemaining:Math.max(0,HARD_CAP-count),
  lastStatus:Number.isInteger(value.lastStatus)&&value.lastStatus>=100&&value.lastStatus<=599?value.lastStatus:null,
  remoteLedgerHint:{active:remoteActive,limit:limit??null,remaining:remaining??null,
   resetAt:remoteActive?new Date(reset).toISOString():null,reserve:remoteReserve,
   state:remoteProtect?'REMOTE_RESERVE_REACHED':remoteActive?'REMOTE_LEDGER_HINT':'REMOTE_HEADER_UNOBSERVED',
   headerProvenance:'NOT_PROVABLE_FROM_LEDGER'},
  requestEvidence:count===0?'NO_LIVE_TRAFFIC_EVIDENCE':'LOCAL_RESERVATIONS_OBSERVED',
  decision:count>=HARD_CAP||remoteProtect?'STOP':'WITHIN_LOCAL_GUARD'};
 if(count>HARD_CAP)return result('FAIL','ALPACA_LOCAL_140_EXCEEDED',{quota:observed});
 return result('PASS','ALPACA_QUOTA_READONLY_DIAGNOSIS',{quota:observed});
}

