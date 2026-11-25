// Owner-side request submission. This is not a PC installer or approval source.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {prepareControllerUpdateRequest,validateMaintenanceRequest,validateUpdateRequest,
 CONTROL_ACTOR,CONTROL_REPOSITORY} from './maintenance-contract.mjs';

const TITLE='pc-controller-update',LABEL='pc-maintenance';
const fail=code=>{throw Error(code)};
export function prepareMaintenanceIssue(bytes,options){
 const request=prepareControllerUpdateRequest(bytes,options);
 return {repository_full_name:CONTROL_REPOSITORY,title:TITLE,
  labels:[LABEL],body:JSON.stringify(request)};
}
function requestOf(expected){
 if(expected?.repository_full_name!==CONTROL_REPOSITORY||expected.title!==TITLE||
  JSON.stringify(expected.labels)!==JSON.stringify([LABEL]))fail('MAINTENANCE_ENVELOPE_INVALID');
 return validateMaintenanceRequest(JSON.parse(expected.body),{actor:CONTROL_ACTOR});
}
export function verifyMaintenanceIssue(expected,actual,{allowClosed=false}={}){
 const request=requestOf(expected);
 if(!Number.isSafeInteger(actual?.number)||actual.number<=0||actual.pull_request)fail('MAINTENANCE_ISSUE_READBACK_TYPE_MISMATCH');
 if(actual.title!==expected.title)fail('MAINTENANCE_ISSUE_READBACK_TITLE_MISMATCH');
 if(actual.body!==expected.body)fail('MAINTENANCE_ISSUE_READBACK_BODY_MISMATCH');
 if((actual.user?.login??actual.author?.login)!==CONTROL_ACTOR)fail('MAINTENANCE_ISSUE_READBACK_ACTOR_MISMATCH');
 if(!(allowClosed?['open','OPEN','closed','CLOSED']:['open','OPEN']).includes(actual.state))fail('MAINTENANCE_ISSUE_READBACK_STATE_MISMATCH');
 if(!actual.labels?.some(x=>x.name===LABEL))fail('MAINTENANCE_ISSUE_READBACK_LABEL_MISSING');
 return {status:'REQUEST_READBACK_VERIFIED',requestId:request.requestId,
  issueNumber:actual.number,execution:'NOT_ASSERTED',next:'FOLLOW_ORIGINAL_REQUEST_ONLY'};
}
// Persist the exact request before the only POST. An uncertain POST is never
// retried; reconcile performs reads and retains the original requestId.
export async function submitMaintenanceIssue(expected,{createIssue,readIssue,saveReceipt}){
 requestOf(expected);
 const receipt={schema:'ZGMINI_MAINTENANCE_SUBMISSION_V1',phase:'CREATING',expected,issueNumber:null};
 await saveReceipt(receipt,{exclusive:true});
 let created;
 try{created=await createIssue(expected);}catch{
  receipt.phase='CREATION_UNKNOWN';await saveReceipt(receipt);
  return {status:'STATE_UNKNOWN',code:'MAINTENANCE_CREATE_OUTCOME_UNKNOWN',next:'RECONCILE_SAME_RECEIPT_NO_NEW_POST'};
 }
 if(Number.isSafeInteger(created?.number)&&created.number>0)receipt.issueNumber=created.number;
 receipt.phase='READBACK_PENDING';await saveReceipt(receipt);
 try{
  if(!receipt.issueNumber)fail('MAINTENANCE_CREATE_RESPONSE_UNVERIFIED');
  const verified=verifyMaintenanceIssue(expected,await readIssue(receipt.issueNumber));
  receipt.phase='READBACK_VERIFIED';await saveReceipt(receipt);return verified;
 }catch(error){
  return {status:'AUTOMATION_BLOCKED',code:'MAINTENANCE_CREATED_ISSUE_NOT_VERIFIED',
   firstFail:/^MAINTENANCE_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'MAINTENANCE_ISSUE_READ_FAILED',
   issueNumber:receipt.issueNumber,next:'RECONCILE_SAME_RECEIPT_NO_NEW_POST'};
 }
}
// Owner-side bridge for an exact prepared envelope. The existing main approval
// and current installed SHA are revalidated before the existing one-shot POST.
// CI candidates and preview status alone are not approval or actor identity.
export async function submitPreparedMaintenanceIssue(expected,{installedSha,readIdentity,readRepository,readManifest,...ports}){
 if(!expected||Object.keys(expected).length!==4||!['repository_full_name','title','labels','body'].every(k=>Object.hasOwn(expected,k)))fail('MAINTENANCE_PREPARED_ENVELOPE_INVALID');
 const snapshot=structuredClone(expected);
 const request=requestOf(snapshot);
 if((await readIdentity())?.login!==CONTROL_ACTOR||
    (await readRepository())?.private!==true)fail('MAINTENANCE_SUBMIT_IDENTITY_DENIED');
 const bytes=await readManifest(request.targetControllerSha);
 if(!Buffer.isBuffer(bytes))fail('MAINTENANCE_REMOTE_MANIFEST_BYTES_MISSING');
 validateUpdateRequest(request,bytes,{actor:CONTROL_ACTOR,installedSha});
 return submitMaintenanceIssue(snapshot,ports);
}
export async function reconcileMaintenanceIssue(receipt,{findIssues,readIssue,saveReceipt}){
 if(receipt?.schema!=='ZGMINI_MAINTENANCE_SUBMISSION_V1')fail('MAINTENANCE_RECEIPT_INVALID');
 const request=requestOf(receipt.expected);
 let issueNumber=receipt.issueNumber;
 if(!issueNumber){
  const candidates=await findIssues(request.requestId);
  const matches=candidates.filter(x=>!x.pull_request&&x.title===TITLE&&
   x.body===receipt.expected.body&&(x.user?.login??x.author?.login)===CONTROL_ACTOR);
  if(matches.length!==1)return {status:'STATE_UNKNOWN',code:matches.length?
   'MAINTENANCE_MULTIPLE_MATCHES_NO_REPOST':'MAINTENANCE_REQUEST_NOT_FOUND_NO_REPOST',
   next:'READ_ORIGINAL_CREATION_STATE_NO_NEW_POST'};
  issueNumber=matches[0].number;
 }
 // Reconciliation may happen after the original request completed and closed.
 // Closure is not a failed POST or permission to submit another request.
 const verified=verifyMaintenanceIssue(receipt.expected,await readIssue(issueNumber),{allowClosed:true});
 await saveReceipt({...receipt,issueNumber,phase:'READBACK_VERIFIED'});return verified;
}
function github(endpoint,{body}={}){
 const args=['api',endpoint,...(body?['--method','POST','--input','-']:[])];
 const raw=execFileSync('gh',args,{input:body?JSON.stringify(body):undefined,
  encoding:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:2*1024*1024});
 return JSON.parse(raw);
}
function argsOf(argv){
 const [mode,...rest]=argv;
 if(!['prepare','submit','submit-prepared','reconcile','verify'].includes(mode)||rest.length%2)fail('MAINTENANCE_REQUEST_USAGE');
 const options={};
 for(let i=0;i<rest.length;i+=2){
  if(!['--manifest-file','--target-sha','--installed-sha','--chat-id','--receipt-file','--issue-number','--prepared-file'].includes(rest[i])||
   Object.hasOwn(options,rest[i])||!rest[i+1]||rest[i+1].startsWith('--'))fail('MAINTENANCE_REQUEST_USAGE');
  options[rest[i]]=rest[i+1];
 }
 const allowed=mode==='verify'?['--issue-number']:mode==='reconcile'?['--receipt-file']:
  mode==='submit-prepared'?['--prepared-file','--installed-sha','--receipt-file']:
  ['--manifest-file','--target-sha','--installed-sha','--chat-id',...(mode==='submit'?['--receipt-file']:[])];
 if(Object.keys(options).some(k=>!allowed.includes(k)))fail('MAINTENANCE_REQUEST_USAGE');
 return {mode,options};
}
export async function main(argv=process.argv.slice(2)){
 const {mode,options:o}=argsOf(argv);
 if(mode==='verify'){
  if(!/^[1-9]\d*$/.test(o['--issue-number']??''))fail('MAINTENANCE_REQUEST_USAGE');
  const actual=github(`repos/${CONTROL_REPOSITORY}/issues/${o['--issue-number']}`);
  // Independent readback of an existing request, never submission or approval.
  const result=verifyMaintenanceIssue({repository_full_name:CONTROL_REPOSITORY,title:TITLE,labels:[LABEL],body:actual.body},actual,{allowClosed:true});
  return {...result,status:'EXISTING_REQUEST_ENVELOPE_VERIFIED',expectedOriginalBytes:'NOT_INDEPENDENTLY_PINNED'};
 }
 const receiptPath=o['--receipt-file']&&path.resolve(o['--receipt-file']);
 const saveReceipt=(receipt,{exclusive=false}={})=>{
  if(!receiptPath)fail('MAINTENANCE_RECEIPT_PATH_REQUIRED');
  fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:exclusive?'wx':'w'});
 };
 const readIssue=n=>github(`repos/${CONTROL_REPOSITORY}/issues/${n}`);
 if(mode==='reconcile'){
  if(!receiptPath)fail('MAINTENANCE_RECEIPT_PATH_REQUIRED');
  return reconcileMaintenanceIssue(JSON.parse(fs.readFileSync(receiptPath,'utf8')),{
   readIssue,saveReceipt,findIssues:requestId=>{
    const q=encodeURIComponent(`repo:${CONTROL_REPOSITORY} is:issue "${requestId}" in:body`);
    const result=github(`search/issues?q=${q}&per_page=100`);
    if(result.incomplete_results||result.total_count>100||!Array.isArray(result.items))fail('MAINTENANCE_SEARCH_INCOMPLETE_NO_REPOST');
    return result.items;
   }});
 }
 // Prefer immutable GitHub blob bytes to avoid Windows checkout CRLF drift.
 const readRemote=sha=>{
  const found=github(`repos/${CONTROL_REPOSITORY}/contents/approvals/controller-updates/${sha}.json?ref=main`);
  if(found.encoding!=='base64'||typeof found.content!=='string')fail('MAINTENANCE_REMOTE_MANIFEST_BYTES_MISSING');
  return Buffer.from(found.content,'base64');
 };
 if(mode==='submit-prepared'){
  if(!o['--prepared-file']||!o['--installed-sha']||!receiptPath)fail('MAINTENANCE_REQUEST_USAGE');
  if(fs.existsSync(receiptPath))fail('MAINTENANCE_RECEIPT_EXISTS_USE_RECONCILE');
  const expected=JSON.parse(fs.readFileSync(path.resolve(o['--prepared-file']),'utf8'));
  return submitPreparedMaintenanceIssue(expected,{installedSha:o['--installed-sha'],
   readIdentity:()=>github('user'),readRepository:()=>github(`repos/${CONTROL_REPOSITORY}`),
   readManifest:readRemote,saveReceipt,readIssue,
   createIssue:e=>github(`repos/${CONTROL_REPOSITORY}/issues`,{body:{title:e.title,labels:e.labels,body:e.body}})});
 }
 if(!o['--installed-sha']||Boolean(o['--manifest-file'])===Boolean(o['--target-sha']))fail('MAINTENANCE_REQUEST_USAGE');
 if(o['--target-sha']&&!/^[a-f0-9]{40}$/.test(o['--target-sha']))fail('MAINTENANCE_REQUEST_USAGE');
 const bytes=o['--target-sha']?readRemote(o['--target-sha']):fs.readFileSync(path.resolve(o['--manifest-file']));
 const expected=prepareMaintenanceIssue(bytes,{installedSha:o['--installed-sha'],chatId:o['--chat-id']});
 if(o['--target-sha']&&JSON.parse(expected.body).targetControllerSha!==o['--target-sha'])fail('MAINTENANCE_TARGET_MANIFEST_MISMATCH');
 if(mode==='prepare')return expected;
 if(!receiptPath)fail('MAINTENANCE_RECEIPT_PATH_REQUIRED');
 if(fs.existsSync(receiptPath))fail('MAINTENANCE_RECEIPT_EXISTS_USE_RECONCILE');
 if(github('user').login!==CONTROL_ACTOR||github(`repos/${CONTROL_REPOSITORY}`).private!==true)
  fail('MAINTENANCE_SUBMIT_IDENTITY_DENIED');
 const request=JSON.parse(expected.body);
 if(!readRemote(request.targetControllerSha).equals(bytes))
  fail('MAINTENANCE_REMOTE_MANIFEST_BYTES_MISMATCH');
 return submitMaintenanceIssue(expected,{saveReceipt,readIssue,
  createIssue:e=>github(`repos/${CONTROL_REPOSITORY}/issues`,{body:{title:e.title,labels:e.labels,body:e.body}})});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await main();console.log(JSON.stringify(result));
  if(['STATE_UNKNOWN','AUTOMATION_BLOCKED'].includes(result.status))process.exitCode=1;
 }catch(error){const raw=error?.code??error?.message;
  console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:/^[A-Z0-9_]{1,96}$/.test(raw??'')?raw:'MAINTENANCE_REQUEST_TOOL_FAILED',next:'INSPECT_EXISTING_RECEIPT_NO_BLIND_RETRY'}));process.exitCode=1;}
}
