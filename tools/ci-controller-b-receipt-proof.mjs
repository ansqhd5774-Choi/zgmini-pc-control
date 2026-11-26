// Owner-only two-run proof for the existing isolated CI Controller B receipt root.
// The publisher remains disabled; this file never creates an approval or B request.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {inspectCiControllerBReceiptRootReadonly} from './ci-controller-b-receipt-root-readonly.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ROOT='C:\\ProgramData\\ZGMINI-CI\\ControllerBReceipts';
const OWNER='ansqhd5774-Choi';
const HOST='DESKTOP-N62L0NG';
const RUNNER='zgmini-handoff-ci-spare-01';
const SCHEMA='ZGMINI_CI_RECEIPT_PROOF_REQUEST_V1';
const RECORD='ZGMINI_CI_RECEIPT_PROOF_RECORD_V1';
const TITLE='ci-controller-b-receipt-proof';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const result=(status,code,extra={})=>({
 schema:'ZGMINI_CI_RECEIPT_PROOF_RESULT_V1',status,code,
 writableVerified:false,durableAcrossRunsVerified:false,
 operationalWrites:0,providerCalls:0,d1Writes:0,
 automaticRetries:0,controllerBPublished:false,...extra
});
const hex=bytes=>createHash('sha256').update(bytes).digest('hex');
const only=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join('|')===keys.slice().sort().join('|');
function parse(event,ctx){
 if(ctx.eventName!=='issues'||ctx.repository!==REPO||ctx.actor!==OWNER||
    ctx.ref!=='refs/heads/main'||ctx.enabled!=='false'||
    ctx.hostname.toUpperCase()!==HOST||ctx.runnerName!==RUNNER||
    !id(ctx.runId)||ctx.attempt!==1||
    event?.action!=='opened'||event?.repository?.id!==1442936296||
    event?.repository?.full_name!==REPO||event?.repository?.private!==true||
    event?.sender?.login!==OWNER||event?.issue?.user?.login!==OWNER||
    event?.issue?.state!=='open'||event?.issue?.title!==TITLE||
    !id(event?.issue?.number))
  return {error:'CI_RECEIPT_PROOF_CONTEXT_DENIED'};
 let req;
 try{req=JSON.parse(event.issue.body);}catch{return {error:'CI_RECEIPT_PROOF_REQUEST_INVALID'};}
 if(!['write','verify'].includes(req?.phase)||req.schema!==SCHEMA||
    req.operation!=='ci-controller-b-receipt-proof'||!uuid(req.requestId))
  return {error:'CI_RECEIPT_PROOF_REQUEST_INVALID'};
 const fields=req.phase==='write'
  ?['schema','operation','phase','requestId']
  :['schema','operation','phase','requestId','sourceIssueNumber'];
 if(!only(req,fields))return {error:'CI_RECEIPT_PROOF_REQUEST_INVALID'};
 if(req.phase==='verify'&&(!id(req.sourceIssueNumber)||
    req.sourceIssueNumber>=event.issue.number))
  return {error:'CI_RECEIPT_PROOF_SOURCE_INVALID'};
 return {req,issueNumber:event.issue.number};
}
export function runCiReceiptProof({
 event,root,ctx,filesystem=fs,
 preflight=inspectCiControllerBReceiptRootReadonly,platform=process.platform,
 volatileRoots=[]
}={}){
 const parsed=parse(event,ctx||{});
 if(parsed.error)return result('BLOCKED',parsed.error);
 if(platform!=='win32'||typeof root!=='string'||
    path.win32.normalize(root).toLowerCase()!==ROOT.toLowerCase())
  return result('BLOCKED','CI_RECEIPT_PROOF_FIXED_ROOT_DENIED');
 const checked=preflight({root,volatileRoots,filesystem,platform});
 if(checked?.code!=='CI_RECEIPT_ROOT_DIRECTORY_PRESENT_READONLY'||
    checked?.configured!==true||checked?.directoryPresent!==true||
    checked?.readable!==true)
  return result('BLOCKED','CI_RECEIPT_PROOF_ROOT_NOT_VERIFIED');
 const {req,issueNumber}=parsed;
 const sourceIssueNumber=req.phase==='write'?issueNumber:req.sourceIssueNumber;
 const target=path.win32.join(ROOT,'.zgmini-ci-root-proof-'+sourceIssueNumber+'.json');
 if(req.phase==='write'){
  const record={schema:RECORD,issueNumber,runId:ctx.runId,attempt:1,
   requestId:req.requestId,host:HOST,runner:RUNNER};
  const bytes=Buffer.from(JSON.stringify(record)+'\n');
  if(bytes.length>512)return result('BLOCKED','CI_RECEIPT_PROOF_RECORD_TOO_LARGE');
  let fd;
  try{
   // Exclusive, no overwrites/deletes, no directory creation, no B effects.
   fd=filesystem.openSync(target,'wx',0o600);
   filesystem.writeFileSync(fd,bytes);
   filesystem.fsyncSync(fd);
   filesystem.closeSync(fd);fd=undefined;
   const observed=filesystem.readFileSync(target);
   if(!Buffer.isBuffer(observed)||!observed.equals(bytes))
    return result('STATE_UNKNOWN','CI_RECEIPT_PROOF_WRITE_READBACK_MISMATCH',
      {operationalWrites:1});
   return result('PARTIAL','CI_RECEIPT_PROOF_WRITE_READBACK_VERIFIED',{
    writableVerified:true,operationalWrites:1,sourceIssueNumber:issueNumber,
    sourceRunId:ctx.runId,recordSha256:hex(observed)});
  }catch(error){
   return result(error?.code==='EEXIST'||error?.code==='EACCES'?'BLOCKED':'STATE_UNKNOWN',
    error?.code==='EEXIST'?'CI_RECEIPT_PROOF_ALREADY_EXISTS_STOP':
    error?.code==='EACCES'?'CI_RECEIPT_PROOF_WRITE_DENIED':'CI_RECEIPT_PROOF_WRITE_UNVERIFIED');
  }finally{if(fd!==undefined){try{filesystem.closeSync(fd);}catch{}}}
 }
 try{
  // Do not follow a leaf alias even if every receipt-root parent is safe.
  const entry=filesystem.lstatSync(target);
  if(!entry.isFile()||entry.isSymbolicLink()||entry.size<=0||entry.size>512)
   return result('BLOCKED','CI_RECEIPT_PROOF_RECORD_INVALID');
  const bytes=filesystem.readFileSync(target);
  if(!Buffer.isBuffer(bytes)||bytes.length>512||bytes.length===0)
   return result('BLOCKED','CI_RECEIPT_PROOF_RECORD_INVALID');
  const record=JSON.parse(bytes.toString('utf8'));
  if(!only(record,['schema','issueNumber','runId','attempt','requestId','host','runner'])||
     record.schema!==RECORD||record.issueNumber!==sourceIssueNumber||
     !id(record.runId)||record.runId===ctx.runId||record.attempt!==1||
     !uuid(record.requestId)||record.host!==HOST||record.runner!==RUNNER)
   return result('BLOCKED','CI_RECEIPT_PROOF_RECORD_INVALID');
  const canonical=Buffer.from(JSON.stringify(record)+'\n');
  if(!bytes.equals(canonical))
   return result('BLOCKED','CI_RECEIPT_PROOF_RECORD_INVALID');
  return result('PASS','CI_RECEIPT_PROOF_CROSS_RUN_VERIFIED',{
   writableVerified:true,durableAcrossRunsVerified:true,
   sourceIssueNumber,sourceRunId:record.runId,verificationRunId:ctx.runId,
   recordSha256:hex(bytes)});
 }catch(error){
  return result(error?.code==='ENOENT'?'BLOCKED':'STATE_UNKNOWN',
   error?.code==='ENOENT'?'CI_RECEIPT_PROOF_SOURCE_ABSENT':'CI_RECEIPT_PROOF_READ_UNVERIFIED');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let event;
 try{event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));}
 catch{event=null;}
 const r=runCiReceiptProof({
  event,root:process.env.ZGMINI_CI_CONTROLLER_B_RECEIPT_ROOT,
  ctx:{eventName:process.env.GITHUB_EVENT_NAME,
   repository:process.env.GITHUB_REPOSITORY,actor:process.env.GITHUB_ACTOR,
   ref:process.env.GITHUB_REF,enabled:process.env.ZGMINI_CI_CONTROLLER_B_ENABLED,
   hostname:os.hostname(),runnerName:process.env.RUNNER_NAME,
   runId:Number(process.env.GITHUB_RUN_ID),attempt:Number(process.env.GITHUB_RUN_ATTEMPT)},
  volatileRoots:[process.env.RUNNER_TEMP,process.env.GITHUB_WORKSPACE,
   process.env.TEMP,process.env.TMP]
 });
 console.log(JSON.stringify(r));
 process.exitCode=r.code==='CI_RECEIPT_PROOF_WRITE_READBACK_VERIFIED'||
  r.code==='CI_RECEIPT_PROOF_CROSS_RUN_VERIFIED'?0:1;
}
