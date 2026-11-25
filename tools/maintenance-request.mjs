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
// Shared read-only CI discovery for approval publication and the regular submitter.
// A matching CI run is not a business approval, an execution credential or a live CAS.
export async function resolveControllerApprovalCI(approvalRef,{runId,readRun,listRuns,readApprovalPr}={}){
 if((runId!==undefined&&(!Number.isSafeInteger(runId)||runId<=0))||typeof readRun!=='function'||
    (runId===undefined&&typeof listRuns!=='function'))
  fail('MAINTENANCE_CI_RUN_REQUIRED');
 // The relevant CI run must be tied to the exact approved source PR.
 // Selective install target is not itself a PR HEAD. Its existing manifest
 // and pin checks stay with the independent maintenance receiver.
 const match=typeof approvalRef==='string'&&approvalRef.match(/^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/([1-9]\d*)$/);
 const number=match?Number(match[1]):0;
 if(!Number.isSafeInteger(number)||number<=0||typeof readApprovalPr!=='function')
  fail('MAINTENANCE_CI_APPROVAL_PR_REQUIRED');
 const pr=await readApprovalPr(number);
 if(pr?.number!==number||pr.merged!==true||pr.base?.ref!=='main'||
    pr.base?.repo?.full_name!==CONTROL_REPOSITORY||
    pr.head?.repo?.full_name!==CONTROL_REPOSITORY||
    !/^[a-f0-9]{40}$/.test(pr.head?.sha??''))
  fail('MAINTENANCE_CI_APPROVAL_SOURCE_MISMATCH');
 const matches=run=>Number.isSafeInteger(run?.id)&&run.id>0&&run.workflow_id===416355595&&
    run.path==='.github/workflows/controller-maintenance-source-tests.yml'&&
    run.event==='pull_request'&&run.status==='completed'&&run.conclusion==='success'&&
    run.repository?.id===1442936296&&run.repository?.full_name===CONTROL_REPOSITORY&&
    run.head_repository?.id===1442936296&&run.head_sha===pr.head.sha;
 // A main approval publication may not carry a source CI run ID. Find
 // positive evidence for its exact PR head, then independently re-read it.
 if(runId===undefined){
  const listing=await listRuns(pr.head.sha);
  if(!Array.isArray(listing?.workflow_runs))fail('MAINTENANCE_CI_RUN_LIST_UNVERIFIED');
  const selected=listing.workflow_runs.filter(matches).sort((a,b)=>b.id-a.id)[0];
  if(!selected)fail('MAINTENANCE_CI_SUCCESS_NOT_FOUND');
  runId=selected.id;
 }
 const run=await readRun(runId);
 if(!matches(run)||run.id!==runId)
  fail('MAINTENANCE_CI_APPROVAL_SOURCE_MISMATCH');
 return Object.freeze({approvalPr:number,headSha:pr.head.sha,runId:run.id});
}
// CI submission integration for an explicitly selected, already-approved
// Controller request. Runs only through an independently authenticated owner
// submitter; never use the PR runner token as owner or infer authority from CI.
// The source approval and final PC-side CAS/effect claim remain unchanged.
// Read an existing exact request before a CI retry with a missing local receipt.
// Search can recover positive evidence, not prove absence or replace the atomic
// receipt and receiver-side effect claim. Never turn a closed request into a retry.
export async function recoverExistingCiRequest(expected,{findIssues,readIssue,saveReceipt}){
 const request=requestOf(expected);
 const candidates=await findIssues(request.requestId);
 if(!Array.isArray(candidates))fail('MAINTENANCE_SEARCH_INCOMPLETE_NO_REPOST');
 const matches=candidates.filter(x=>{
  if(x?.pull_request||(x?.user?.login??x?.author?.login)!==CONTROL_ACTOR)return false;
  try{return JSON.parse(x.body).requestId===request.requestId;}catch{return false;}
 });
 if(matches.length===0)return null;
 if(matches.length!==1||matches[0].body!==expected.body||matches[0].title!==expected.title)
  return {status:'STATE_UNKNOWN',code:'MAINTENANCE_EXISTING_REQUEST_CONFLICT',next:'READ_ORIGINAL_CREATION_STATE_NO_NEW_POST'};
 const issueNumber=matches[0].number;
 if(!Number.isSafeInteger(issueNumber)||issueNumber<=0)fail('MAINTENANCE_ISSUE_READBACK_TYPE_MISMATCH');
 const verified=verifyMaintenanceIssue(expected,await readIssue(issueNumber),{allowClosed:true});
 await saveReceipt({schema:'ZGMINI_MAINTENANCE_SUBMISSION_V1',phase:'READBACK_VERIFIED',expected,issueNumber},{exclusive:true});
 return {...verified,recoveredExistingRequest:true};
}
export async function submitCiPreparedMaintenanceIssue(expected,{runId,readRun,listRuns,...ports}={}){
 if((runId!==undefined&&(!Number.isSafeInteger(runId)||runId<=0))||typeof readRun!=='function'||
    (runId===undefined&&typeof listRuns!=='function'))
  fail('MAINTENANCE_CI_RUN_REQUIRED');
 const snapshot=structuredClone(expected);
 const request=requestOf(snapshot);
 if((await ports.readIdentity())?.login!==CONTROL_ACTOR||
    (await ports.readRepository())?.private!==true)
  fail('MAINTENANCE_SUBMIT_IDENTITY_DENIED');
 if(typeof ports.findIssues==='function'){
  const existing=await recoverExistingCiRequest(snapshot,ports);
  if(existing)return existing;
 }
 const bytes=await ports.readManifest(request.targetControllerSha);
 if(!Buffer.isBuffer(bytes))fail('MAINTENANCE_REMOTE_MANIFEST_BYTES_MISSING');
 const {manifest}=validateUpdateRequest(request,bytes,{actor:CONTROL_ACTOR,installedSha:ports.installedSha});
 await resolveControllerApprovalCI(manifest.approval.ref,{runId,readRun,listRuns,readApprovalPr:ports.readApprovalPr});
 // Existing submitter re-reads main manifest and checks owner identity and
 // exact request before its original atomic receipt and only POST.
 // A moved or altered approval cannot reuse the prior CI evidence.
 return submitPreparedMaintenanceIssue(snapshot,ports);
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
 if(!['prepare','submit','submit-prepared','submit-ci-prepared','reconcile','verify'].includes(mode)||rest.length%2)fail('MAINTENANCE_REQUEST_USAGE');
 const options={};
 for(let i=0;i<rest.length;i+=2){
  if(!['--manifest-file','--target-sha','--installed-sha','--chat-id','--receipt-file','--issue-number','--prepared-file','--run-id'].includes(rest[i])||
   Object.hasOwn(options,rest[i])||!rest[i+1]||rest[i+1].startsWith('--'))fail('MAINTENANCE_REQUEST_USAGE');
  options[rest[i]]=rest[i+1];
 }
 const allowed=mode==='verify'?['--issue-number']:mode==='reconcile'?['--receipt-file']:
  mode==='submit-ci-prepared'?['--prepared-file','--installed-sha','--receipt-file','--run-id']:
  mode==='submit-prepared'?['--prepared-file','--installed-sha','--receipt-file']:
  ['--manifest-file','--target-sha','--installed-sha','--chat-id',...(mode==='submit'?['--receipt-file']:[])];
 if(Object.keys(options).some(k=>!allowed.includes(k)))fail('MAINTENANCE_REQUEST_USAGE');
 return {mode,options};
}
export async function main(argv=process.argv.slice(2),{githubApi=github}={}){
 const {mode,options:o}=argsOf(argv);
 if(mode==='verify'){
  if(!/^[1-9]\d*$/.test(o['--issue-number']??''))fail('MAINTENANCE_REQUEST_USAGE');
  const actual=githubApi(`repos/${CONTROL_REPOSITORY}/issues/${o['--issue-number']}`);
  // Independent readback of an existing request, never submission or approval.
  const result=verifyMaintenanceIssue({repository_full_name:CONTROL_REPOSITORY,title:TITLE,labels:[LABEL],body:actual.body},actual,{allowClosed:true});
  return {...result,status:'EXISTING_REQUEST_ENVELOPE_VERIFIED',expectedOriginalBytes:'NOT_INDEPENDENTLY_PINNED'};
 }
 const receiptPath=o['--receipt-file']&&path.resolve(o['--receipt-file']);
 const saveReceipt=(receipt,{exclusive=false}={})=>{
  if(!receiptPath)fail('MAINTENANCE_RECEIPT_PATH_REQUIRED');
  fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:exclusive?'wx':'w'});
 };
 const readIssue=n=>githubApi(`repos/${CONTROL_REPOSITORY}/issues/${n}`);
 const findIssues=requestId=>{
  const q=encodeURIComponent(`repo:${CONTROL_REPOSITORY} is:issue "${requestId}" in:body`);
  const result=githubApi(`search/issues?q=${q}&per_page=100`);
  if(result.incomplete_results||result.total_count>100||!Array.isArray(result.items))fail('MAINTENANCE_SEARCH_INCOMPLETE_NO_REPOST');
  return result.items;
 };
 if(mode==='reconcile'){
  if(!receiptPath)fail('MAINTENANCE_RECEIPT_PATH_REQUIRED');
  return reconcileMaintenanceIssue(JSON.parse(fs.readFileSync(receiptPath,'utf8')),{readIssue,saveReceipt,findIssues});
 }
 // Prefer immutable GitHub blob bytes to avoid Windows checkout CRLF drift.
 const readRemote=sha=>{
  const found=githubApi(`repos/${CONTROL_REPOSITORY}/contents/approvals/controller-updates/${sha}.json?ref=main`);
  if(found.encoding!=='base64'||typeof found.content!=='string')fail('MAINTENANCE_REMOTE_MANIFEST_BYTES_MISSING');
  return Buffer.from(found.content,'base64');
 };
 if(['submit-prepared','submit-ci-prepared'].includes(mode)){
  if(!o['--prepared-file']||!o['--installed-sha']||!receiptPath)fail('MAINTENANCE_REQUEST_USAGE');
  const ci=mode==='submit-ci-prepared';
  if(ci&&((o['--run-id']!==undefined&&(!/^[1-9]\d*$/.test(o['--run-id'])||
   !Number.isSafeInteger(Number(o['--run-id']))))||!/^[a-f0-9]{40}$/.test(o['--installed-sha'])))
   fail('MAINTENANCE_REQUEST_USAGE');
  if(fs.existsSync(receiptPath))fail('MAINTENANCE_RECEIPT_EXISTS_USE_RECONCILE');
  const expected=JSON.parse(fs.readFileSync(path.resolve(o['--prepared-file']),'utf8'));
  const ports={installedSha:o['--installed-sha'],
   readIdentity:()=>githubApi('user'),readRepository:()=>githubApi(`repos/${CONTROL_REPOSITORY}`),
   readManifest:readRemote,saveReceipt,readIssue,
   createIssue:e=>githubApi(`repos/${CONTROL_REPOSITORY}/issues`,{body:{title:e.title,labels:e.labels,body:e.body}})};
  if(ci)return submitCiPreparedMaintenanceIssue(expected,{...ports,findIssues,
   runId:o['--run-id']===undefined?undefined:Number(o['--run-id']),
   readApprovalPr:n=>githubApi(`repos/${CONTROL_REPOSITORY}/pulls/${n}`),
   listRuns:head=>githubApi(`repos/${CONTROL_REPOSITORY}/actions/workflows/416355595/runs?head_sha=${head}&event=pull_request&status=success&per_page=100`),
   readRun:n=>githubApi(`repos/${CONTROL_REPOSITORY}/actions/runs/${n}`)});
  return submitPreparedMaintenanceIssue(expected,ports);
 }
 if(!o['--installed-sha']||Boolean(o['--manifest-file'])===Boolean(o['--target-sha']))fail('MAINTENANCE_REQUEST_USAGE');
 if(o['--target-sha']&&!/^[a-f0-9]{40}$/.test(o['--target-sha']))fail('MAINTENANCE_REQUEST_USAGE');
 const bytes=o['--target-sha']?readRemote(o['--target-sha']):fs.readFileSync(path.resolve(o['--manifest-file']));
 const expected=prepareMaintenanceIssue(bytes,{installedSha:o['--installed-sha'],chatId:o['--chat-id']});
 if(o['--target-sha']&&JSON.parse(expected.body).targetControllerSha!==o['--target-sha'])fail('MAINTENANCE_TARGET_MANIFEST_MISMATCH');
 if(mode==='prepare')return expected;
 if(!receiptPath)fail('MAINTENANCE_RECEIPT_PATH_REQUIRED');
 if(fs.existsSync(receiptPath))fail('MAINTENANCE_RECEIPT_EXISTS_USE_RECONCILE');
 if(githubApi('user').login!==CONTROL_ACTOR||githubApi(`repos/${CONTROL_REPOSITORY}`).private!==true)
  fail('MAINTENANCE_SUBMIT_IDENTITY_DENIED');
 const request=JSON.parse(expected.body);
 if(!readRemote(request.targetControllerSha).equals(bytes))
  fail('MAINTENANCE_REMOTE_MANIFEST_BYTES_MISMATCH');
 return submitMaintenanceIssue(expected,{saveReceipt,readIssue,
  createIssue:e=>githubApi(`repos/${CONTROL_REPOSITORY}/issues`,{body:{title:e.title,labels:e.labels,body:e.body}})});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await main();console.log(JSON.stringify(result));
  if(['STATE_UNKNOWN','AUTOMATION_BLOCKED'].includes(result.status))process.exitCode=1;
 }catch(error){const raw=error?.code??error?.message;
  console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:/^[A-Z0-9_]{1,96}$/.test(raw??'')?raw:'MAINTENANCE_REQUEST_TOOL_FAILED',next:'INSPECT_EXISTING_RECEIPT_NO_BLIND_RETRY'}));process.exitCode=1;}
}
