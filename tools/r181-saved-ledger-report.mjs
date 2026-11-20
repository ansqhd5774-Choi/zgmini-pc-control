#!/usr/bin/env node
// Create-only, bounded readback of an authenticated one-shot R181 A receipt.
// No private source, ledger JSON, price bars, tokens or provider URLs leave PC.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authenticateSavedLedgerA,RESULT_SCHEMA,SYMBOLS,REPO}
 from './r181-saved-ledger-readonly.mjs';

const RUN=/^\d{1,18}$/;
const SHA40=/^[a-f0-9]{40}$/;
const CODES=/^R181_LEDGER_A_[A-Z0-9_]{3,100}$/;
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const base=(req,env)=>({schema:RESULT_SCHEMA,requestId:req.requestId,
 status:'STATE_UNKNOWN',code:'R181_LEDGER_A_RESULT_UNVERIFIED_STOP',
 runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
 sourcePinVerified:false,coverage:null,
 operationalWrites:0,providerCalls:0,sqliteOpened:false,d1Writes:0,
 retry:'DO_NOT_REEXECUTE'});
export function sanitizeSavedLedgerResult(raw,req,env){
 const out=base(req,env);
 if(raw?.schema!==RESULT_SCHEMA||
  (raw.requestId!==req.requestId&&raw.requestId!==null))return out;
 if(raw.status==='STOP'&&CODES.test(raw.code??''))return {...out,
  status:'STOP',code:raw.code};
 if(raw.status!=='PASS'||raw.code!=='R181_SAVED_LEDGER_READONLY'||
  raw.requestId!==req.requestId||raw.sourcePinVerified!==true||
  raw.controlSourceSha!==req.controlSourceSha||!SHA40.test(raw.controlSourceSha??''))
  return out;
 const c=raw.coverage;
 if(!c||c.schema!=='ZGMINI_R181_LEDGER_COVERAGE_V1'||
  !['LEDGER_REPORTED_COMPLETE','LEDGER_REPORTED_INCOMPLETE'].includes(c.coverageStatus)||
  !['LOCAL_PRIMARY_STORED','PRIMARY_RAW_STORED','NO_NEW_COMPLETE_PRIMARY_DATE',
    'STOP','OTHER_OR_UNKNOWN'].includes(c.reportedState)||
  !(c.reportedAt===null||
    typeof c.reportedAt==='string'&&c.reportedAt.length<=32&&
     !Number.isNaN(Date.parse(c.reportedAt)))||
  !(c.providerCalls===null||
    Number.isSafeInteger(c.providerCalls)&&c.providerCalls>=0&&c.providerCalls<=1000000)||
  c.fixedSymbolCount!==SYMBOLS.length||
  !Number.isInteger(c.matchingRows)||c.matchingRows<0||c.matchingRows>14||
  !Number.isInteger(c.unknownSymbolCount)||c.unknownSymbolCount<0||
  c.unknownSymbolCount>40||
  c.evidenceLevel!=='LEDGER_METADATA_ONLY_SQLITE_NOT_VERIFIED'||
  c.sqliteOpened!==false||c.rawShaVerified!==false||
  c.checkpointVerified!==false||c.providerCallsThisRun!==0||
  c.operationalWrites!==0||c.d1Writes!==0||
  !Array.isArray(c.symbols)||c.symbols.length!==SYMBOLS.length)return out;
 const symbols=[];
 for(let i=0;i<SYMBOLS.length;i++){
  const s=c.symbols[i];
  if(s?.symbol!==SYMBOLS[i]||
   !(s.bars===null||(Number.isSafeInteger(s.bars)&&s.bars>0&&s.bars<=1000000))||
   !(s.latest15NY===null||date(s.latest15NY)))return out;
  symbols.push({symbol:SYMBOLS[i],bars:s.bars,latest15NY:s.latest15NY});
 }
 const coverage={coverageStatus:c.coverageStatus,reportedState:c.reportedState,
  reportedAt:c.reportedAt,providerCalls:c.providerCalls,
  fixedSymbolCount:14,matchingRows:c.matchingRows,
  unknownSymbolCount:c.unknownSymbolCount,symbols,
  evidenceLevel:'LEDGER_METADATA_ONLY_SQLITE_NOT_VERIFIED',
  sqliteOpened:false,rawShaVerified:false,checkpointVerified:false};
 // Never turn a reported-complete status into a verified SQLite/raw result.
 if(coverage.coverageStatus==='LEDGER_REPORTED_COMPLETE'&&
  (['OTHER_OR_UNKNOWN','STOP'].includes(coverage.reportedState)||
   !coverage.reportedAt||
   !(coverage.providerCalls>0)||coverage.matchingRows!==14||
   coverage.unknownSymbolCount!==0||
   symbols.some(s=>s.bars===null||s.latest15NY===null)))return out;
 return {...out,status:'PASS',code:'R181_SAVED_LEDGER_READONLY',
  sourcePinVerified:true,coverage};
}
function txt(x){return [
 'REQUEST_ID='+x.requestId,'STATUS='+x.status,'CODE='+x.code,
 'RUN_ID='+(x.runId??'UNKNOWN'),
 'SOURCE_PIN_VERIFIED='+x.sourcePinVerified,
 'LEDGER_COVERAGE='+JSON.stringify(x.coverage??{}),
 'SQLITE_VERIFIED=false','RAW_SHA_VERIFIED=false',
 'CHECKPOINT_VERIFIED=false','PROVIDER_CALLS_THIS_RUN=0',
 'D1_WRITES=0','OPERATIONAL_WRITES=0','RETRY='+x.retry,''].join('\n');}
async function readback(fetchApi,url,headers,contents){
 try{
  const res=await fetchApi(url+'?ref=main',{method:'GET',headers});
  if(res.status!==200)return false;
  const data=await res.json();
  return data?.encoding==='base64'&&typeof data.content==='string'&&
   Buffer.from(data.content.replace(/\s/g,''),'base64').equals(Buffer.from(contents));
 }catch{return false;}
}
export async function reportSavedLedgerA({event,env,raw,fetchApi=fetch}){
 const req=authenticateSavedLedgerA(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  RUN.test(env.GITHUB_RUN_ID??''),'R181_LEDGER_A_REPORT_AUTH_STOP');
 let parsed=null;
 try{parsed=typeof raw==='string'&&Buffer.byteLength(raw)<=12000?JSON.parse(raw):null;}
 catch{}
 const out=sanitizeSavedLedgerResult(parsed,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-r181-saved-ledger-a'};
 let verified=0,created=0;
 for(const [ext,contents] of [
  ['json',JSON.stringify(out,null,2)+'\n'],['txt',txt(out)]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/r181-saved-ledger-'+req.requestId+'.'+ext;
  try{
   const response=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: one-shot W03 R181 saved ledger A',
     content:Buffer.from(contents).toString('base64')})});
   if(response.status===201)created++;
  }catch{/* unknown outcome: read back, never create another request */}
  if(await readback(fetchApi,url,headers,contents))verified++;
 }
 const status=verified===2?out.status:'STATE_UNKNOWN';
 const message='<!-- w03-r181-saved-ledger:'+req.requestId+' -->\n'+
  'W03 R181 fixed saved-ledger A: '+status+' / '+
  (verified===2?out.code:'R181_LEDGER_A_PAIR_UNVERIFIED')+'\n'+
  'JSON/TXT readback '+verified+'/2; created '+created+'/2; run '+
  (out.runId??'UNKNOWN')+'; provider/SQLite/D1/PC writes 0; no replay.\n';
 const result=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
   body:JSON.stringify({body:message})});
 need(result.status===201,'R181_LEDGER_A_REPORT_COMMENT_STOP');
 return {status,verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';
  try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
    'r181-saved-ledger-result.json'),'utf8');}catch{}
  const result=await reportSavedLedgerA({event,env,raw});
  process.stdout.write('R181_LEDGER_A_REPORT '+result.status+' '+result.verified+'/2\n');
 }catch{process.stderr.write('R181_LEDGER_A_REPORT_UNKNOWN_NO_RETRY\n');
  process.exitCode=1;}
}