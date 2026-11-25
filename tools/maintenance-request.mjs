// Owner-side request submission. This is not a PC installer or approval source.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {prepareControllerUpdateRequest,validateMaintenanceRequest,validateUpdateRequest,
 CONTROL_ACTOR,CONTROL_REPOSITORY,CI_CONTROLLER_ACTOR,controllerBReceiptMarker} from './maintenance-contract.mjs';

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
export async function submitMaintenanceIssue(expected,ports){
 return submitExactEnvelope(expected,ports,verifyMaintenanceIssue);
}
async function submitExactEnvelope(expected,{createIssue,readIssue,saveReceipt},verifyReadback){
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
  const verified=verifyReadback(expected,await readIssue(receipt.issueNumber));
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
export async function resolveControllerApprovalCI(approvalRef,{runId,readRun,listRuns,readApprovalPr,approvalState='MERGED'}={}){
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
 const stateMatches=approvalState==='MERGED'?pr?.merged===true:
  approvalState==='OPEN'?pr?.state==='open'&&pr.merged===false&&pr.draft===false:false;
 if(pr?.number!==number||!stateMatches||pr.base?.ref!=='main'||
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
// CI publisher for an EXISTING independently approved manifest only. It does
// not create business authorization, invent a live installed SHA, or activate
// the receiver. The fixed reviewed workflow must supply authenticated GitHub
// read ports and an exclusive durable per-effect receipt store.
const digest=b=>createHash('sha256').update(b).digest('hex');
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const ownerIdentity=x=>x?.login===CONTROL_ACTOR&&x.id===327938088&&x.type==='User';
const botIdentity=x=>x?.login===CI_CONTROLLER_ACTOR&&x.id===41898282&&x.type==='Bot';
function verifyCiIssue(expected,actual){
 if(!botIdentity(actual?.user))fail('MAINTENANCE_ISSUE_READBACK_ACTOR_MISMATCH');
 if(!Number.isSafeInteger(actual.number)||actual.number<=0||actual.pull_request||
    actual.title!==TITLE||actual.body!==expected.body||actual.state!=='open'||
    !actual.labels?.some(x=>x.name===LABEL))fail('MAINTENANCE_CI_ISSUE_READBACK_MISMATCH');
 return {status:'REQUEST_READBACK_VERIFIED',requestId:requestOf(expected).requestId,
  issueNumber:actual.number,execution:'NOT_ASSERTED',next:'FOLLOW_ORIGINAL_REQUEST_ONLY'};
}
// Existing exclusive receipt semantics, keyed by exact effect rather than
// invocation. The root must already exist, be separately registered for the
// isolated host and survive workflow checkout/cleanup. No automatic directory
// creation, TTL, deletion, or relocation of unresolved claims.
export function createCiEffectReceiptStore(root){
 if(typeof root!=='string'||!path.isAbsolute(root))fail('MAINTENANCE_CI_RECEIPT_ROOT_UNVERIFIED');
 const stat=fs.lstatSync(root);
 if(!stat.isDirectory()||stat.isSymbolicLink())fail('MAINTENANCE_CI_RECEIPT_ROOT_UNVERIFIED');
 const resolved=fs.realpathSync(root);
 const sameRoot=()=>{if(fs.realpathSync(root)!==resolved||!fs.lstatSync(root).isDirectory()||
   fs.lstatSync(root).isSymbolicLink())fail('MAINTENANCE_CI_RECEIPT_ROOT_DRIFT');};
 const fileFor=effectKey=>{
  if(typeof effectKey!=='string'||!/^[a-f0-9]{64}$/.test(effectKey))fail('MAINTENANCE_CI_EFFECT_KEY_INVALID');
  sameRoot();return path.join(resolved,effectKey+'.json');
 };
 function loadReceipt(effectKey){
  const file=fileFor(effectKey);let st;
  try{st=fs.lstatSync(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}
  if(!st.isFile()||st.isSymbolicLink()||st.size>65536||st.size===0)fail('MAINTENANCE_CI_RECEIPT_UNVERIFIED');
  const receipt=JSON.parse(fs.readFileSync(file,'utf8'));
  if(receipt?.schema!=='ZGMINI_MAINTENANCE_SUBMISSION_V1')fail('MAINTENANCE_CI_RECEIPT_UNVERIFIED');
  requestOf(receipt.expected);
  return receipt;
 }
 function saveReceipt(effectKey,receipt,{exclusive=false}={}){
  const file=fileFor(effectKey);
  if(receipt?.schema!=='ZGMINI_MAINTENANCE_SUBMISSION_V1')fail('MAINTENANCE_CI_RECEIPT_UNVERIFIED');
  requestOf(receipt.expected);
  const body=JSON.stringify(receipt,null,2)+'\n';
  if(Buffer.byteLength(body)>65536)fail('MAINTENANCE_CI_RECEIPT_UNVERIFIED');
  if(exclusive){
   const fd=fs.openSync(file,'wx',0o600);
   try{fs.writeFileSync(fd,body,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   return;
  }
  const previous=loadReceipt(effectKey);
  if(!previous||previous.expected.body!==receipt.expected.body||
     (previous.issueNumber!==null&&previous.issueNumber!==receipt.issueNumber))
   fail('MAINTENANCE_CI_RECEIPT_IDENTITY_DRIFT');
  // If interruption occurs before rename, the original CREATING receipt
  // remains; no process may treat that as a new submission.
  const temp=file+'.'+process.pid+'.tmp';
  const fd=fs.openSync(temp,'wx',0o600);
  try{fs.writeFileSync(fd,body,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temp,file);
 }
 return Object.freeze({loadReceipt,saveReceipt});
}
export async function submitExistingControllerApprovalFromCi({targetSha,approvalSha256,runId,attempt},ports){
 if(!sha40(targetSha)||typeof approvalSha256!=='string'||!/^[a-f0-9]{64}$/.test(approvalSha256)||
    !Number.isSafeInteger(runId)||runId<=0||!Number.isSafeInteger(attempt)||attempt<=0)
  fail('MAINTENANCE_CI_PUBLISH_INPUT_INVALID');
 const repo=await ports.readRepository();
 if(repo?.id!==1442936296||repo.full_name!==CONTROL_REPOSITORY||repo.private!==true||
    !ownerIdentity(repo.owner))fail('MAINTENANCE_CI_REPOSITORY_DENIED');
 const bytes=await ports.readManifest(targetSha);
 if(!Buffer.isBuffer(bytes)||digest(bytes)!==approvalSha256)fail('MAINTENANCE_CI_MANIFEST_PIN_MISMATCH');
 const manifest=JSON.parse(bytes.toString('utf8'));
 // This is schema validation, not a live CAS assertion. Both receiver and
 // updater independently read the actual installed SHA before any mutation.
 const expected=prepareMaintenanceIssue(bytes,{installedSha:manifest.installedSha,chatId:'chat-ci-'+runId+'-'+attempt});
 const q=JSON.parse(expected.body);
 if(q.targetControllerSha!==targetSha||manifest.purpose!=='pc-controller-maintenance'||
    manifest.controllerOnlyInstall!==true||!manifest.selectiveSource||
    !manifest.allowFiles.every(f=>/^controller\/[a-z][a-z0-9-]*\.mjs$/.test(f.path)))
  fail('MAINTENANCE_CI_PILOT_SCOPE_DENIED');
 const prNumber=Number(manifest.approval.ref.split('/').at(-1));
 const pr=await ports.readApprovalPr(prNumber);
 // Preserve the historical owner-approved path. Automated publication is
 // not a new grant: only a pinned original business authorization and exact
 // reconstruction of both approved files can replace the manual merger check.
 const ownerMerged=ownerIdentity(pr?.merged_by);
 if(pr?.number!==prNumber||pr.merged!==true||pr.base?.ref!=='main'||
    pr.base?.repo?.full_name!==CONTROL_REPOSITORY||pr.head?.repo?.full_name!==CONTROL_REPOSITORY||
    (!ownerMerged&&!botIdentity(pr.merged_by))||!sha40(pr.merge_commit_sha))
  fail('MAINTENANCE_CI_EXISTING_APPROVAL_PROVENANCE_DENIED');
 const approvedBytes=await ports.readMergedManifest(targetSha,pr.merge_commit_sha);
 if(!Buffer.isBuffer(approvedBytes)||!approvedBytes.equals(bytes))
  fail('MAINTENANCE_CI_EXISTING_APPROVAL_BYTES_MISMATCH');
 if(ownerMerged){
  await resolveControllerApprovalCI(manifest.approval.ref,{readApprovalPr:ports.readApprovalPr,
   listRuns:ports.listRuns,readRun:ports.readRun});
 }else{
  // This port is supplied by the independently reviewed fixed publisher,
  // not by the approval PR, manifest or Issue. No production context is
  // configured yet; the automatic branch therefore fails closed by default.
  if(typeof ports.readAutoApprovalContext!=='function')
   fail('MAINTENANCE_CI_AUTO_APPROVAL_CONTEXT_REQUIRED');
  const ctx=await ports.readAutoApprovalContext(targetSha,prNumber);
  if(!ctx?.policy||!ctx.delegation||!Number.isSafeInteger(ctx.policy.sourcePrNumber)||
     ctx.policy.sourcePrNumber<=0||typeof ctx.readFileBytes!=='function'||typeof ctx.getJson!=='function')
   fail('MAINTENANCE_CI_AUTO_APPROVAL_CONTEXT_REQUIRED');
  const {prepareSelectiveApprovalPublication}=await import('../ci-approval/controller-candidate-review.mjs');
  const plan=Object.fromEntries(['installedSha','targetSha','allowFiles','purpose','postOperation','postSourceBranch','postSourceSha'].map(k=>[k,manifest[k]]));
  const prepared=await prepareSelectiveApprovalPublication({
   plan,delegation:{...ctx.delegation,now:new Date().toISOString().replace(/\.\d{3}Z$/,'Z')},
   sourcePrNumber:ctx.policy.sourcePrNumber,approvalPrNumber:prNumber,
   sourceMainSha:manifest.selectiveSource.mainSha,policy:ctx.policy,
   getJson:ctx.getJson,readFileBytes:ctx.readFileBytes,readJobLogs:ctx.readJobLogs});
  if(prepared.state!=='SELECTIVE_APPROVAL_FILES_PREPARED'||prepared.files.length!==2||
     !prepared.files[0].bytes.equals(bytes))
   fail('MAINTENANCE_CI_AUTO_APPROVAL_RECONSTRUCTION_DENIED');
  // The original source CI is independently verified during reconstruction.
  // Only the two new generated JSON files may be present in the automated
  // approval PR. Do not require a second PR workflow for those files.
  await requireExactApprovalPair(ports,prNumber,prepared.files);
  const pin=prepared.files[1];
  for(const revision of [pr.merge_commit_sha,'main']){
   const actual=await ctx.readFileBytes(CONTROL_REPOSITORY,revision,pin.path);
   if(!Buffer.isBuffer(actual)||!actual.equals(pin.bytes))
    fail('MAINTENANCE_CI_AUTO_APPROVAL_PIN_MISMATCH');
  }
 }
 // The effect key is independent of a retry, approval publication event, or
 // mutable chat trace. The existing receiver-side effect claim still applies.
 const effectKey=digest(JSON.stringify([CONTROL_REPOSITORY,manifest.installedSha,targetSha]));
 const old=await ports.loadReceipt(effectKey);
 if(old!==null)return {status:'STATE_UNKNOWN',code:'MAINTENANCE_CI_EXISTING_RECEIPT_NO_REPOST',effectKey,
  issueNumber:Number.isSafeInteger(old?.issueNumber)?old.issueNumber:null,next:'RECONCILE_SAME_RECEIPT_NO_NEW_POST'};
 const prior=await ports.findPriorRequests(targetSha);
 if(!Array.isArray(prior))fail('MAINTENANCE_CI_PRIOR_REQUEST_READ_UNVERIFIED');
 const matches=prior.filter(x=>{
  if(x?.pull_request||x?.title!==TITLE||!(ownerIdentity(x.user)||botIdentity(x.user)))return false;
  try{return JSON.parse(x.body).targetControllerSha===targetSha;}catch{return false;}
 });
 if(matches.length){
  // The target SHA alone is not an effect identity. Only the exact approval
  // manifest and structural request fields (excluding per-run trace IDs) may
  // reuse a historical owner/bot request as a successful CI outcome.
  const exact=matches.every(x=>{
   try{
    const previous=JSON.parse(x.body);
    return Number.isSafeInteger(x.number)&&x.number>0&&
     ['open','closed'].includes(x.state)&&
     x.labels?.some(label=>label.name===LABEL)&&
     Object.keys(previous).length===Object.keys(q).length&&
     typeof previous.requestId==='string'&&previous.requestId.startsWith('pc-update-')&&
     typeof previous.chatId==='string'&&previous.chatId.startsWith('chat-')&&
     ['schema','operation','controlRepository','targetControllerSha','approvalManifestSha256']
      .every(key=>previous[key]===q[key]);
   }catch{return false;}
  });
  const issueNumbers=matches.map(x=>x.number).filter(Number.isSafeInteger);
  if(!exact)return {status:'STATE_UNKNOWN',code:'MAINTENANCE_CI_PRIOR_EFFECT_UNVERIFIED_NO_REPOST',
   effectKey,issueNumbers,next:'INSPECT_ORIGINAL_REQUEST_NO_NEW_POST'};
  return {status:'EXISTING_REQUEST_REUSED',effectKey,issueNumbers,
   next:'FOLLOW_ORIGINAL_REQUEST_ONLY'};
 }
 const current=await ports.readManifest(targetSha);
 if(!Buffer.isBuffer(current)||!current.equals(bytes))fail('MAINTENANCE_CI_MANIFEST_PIN_MISMATCH');
 const result=await submitExactEnvelope(expected,{createIssue:ports.createIssue,readIssue:ports.readIssue,
  saveReceipt:(receipt,options)=>ports.saveReceipt(effectKey,receipt,options)},verifyCiIssue);
 if(result.status!=='REQUEST_READBACK_VERIFIED')return {...result,effectKey};
 // Only the exact new successful run emits this receipt; historical requests
 // and uncertain POSTs are never given fresh execution identity.
 return {...result,effectKey,receiptMarker:controllerBReceiptMarker(result.issueNumber,Buffer.from(expected.body))};
}
async function requireExactApprovalPair(ports,number,expected){
 if(typeof ports.readApprovalPrFiles!=='function')fail('MAINTENANCE_CI_MERGE_DIFF_DENIED');
 const files=await ports.readApprovalPrFiles(number),wanted=expected.map(f=>f.path).sort();
 if(!Array.isArray(files)||files.length!==2||files.some(f=>f.status!=='added')||
    JSON.stringify(files.map(f=>f.filename).sort())!==JSON.stringify(wanted))
  fail('MAINTENANCE_CI_MERGE_DIFF_DENIED');
}
// A prepared approval PR contains only the reconstructed metadata pair.
// Original source CI remains mandatory in prepareSelectiveApprovalPublication.
// A redundant PR workflow for these generated JSON files could require human
// approval when the PR was made with GITHUB_TOKEN. Preserve the merged PR,
// Pin, GitHub branch rules, head CAS, main readback and runtime safeguards.
export async function mergeAndSubmitPreparedControllerApproval({targetSha,approvalPrNumber,runId,attempt},ports){
 if(!sha40(targetSha)||!Number.isSafeInteger(approvalPrNumber)||approvalPrNumber<=0||
    !Number.isSafeInteger(runId)||runId<=0||!Number.isSafeInteger(attempt)||attempt<=0)
  fail('MAINTENANCE_CI_MERGE_INPUT_INVALID');
 if(typeof ports.readAutoApprovalContext!=='function'||typeof ports.readApprovalPrFiles!=='function'||
    typeof ports.mergeApprovalPr!=='function')
  fail('MAINTENANCE_CI_AUTO_APPROVAL_CONTEXT_REQUIRED');
 const repository=await ports.readRepository();
 if(repository?.id!==1442936296||repository.full_name!==CONTROL_REPOSITORY||repository.private!==true||
    !ownerIdentity(repository.owner))fail('MAINTENANCE_CI_REPOSITORY_DENIED');
 const pr=await ports.readApprovalPr(approvalPrNumber);
 if(pr?.number!==approvalPrNumber||pr.base?.ref!=='main'||
    pr.base?.repo?.full_name!==CONTROL_REPOSITORY||pr.head?.repo?.full_name!==CONTROL_REPOSITORY||
    !sha40(pr.head?.sha)||
    !(pr.merged===true||(pr.state==='open'&&pr.merged===false&&pr.draft===false)))
  fail('MAINTENANCE_CI_MERGE_PR_DENIED');
 const ctx=await ports.readAutoApprovalContext(targetSha,approvalPrNumber);
 if(!ctx?.policy||!ctx.delegation||!Number.isSafeInteger(ctx.policy.sourcePrNumber)||
    ctx.policy.sourcePrNumber<=0||typeof ctx.getJson!=='function'||
    typeof ctx.readFileBytes!=='function'||typeof ctx.readJobLogs!=='function')
  fail('MAINTENANCE_CI_AUTO_APPROVAL_CONTEXT_REQUIRED');
 const manifestPath='approvals/controller-updates/'+targetSha+'.json';
 const candidateBytes=await ctx.readFileBytes(CONTROL_REPOSITORY,pr.head.sha,manifestPath);
 if(!Buffer.isBuffer(candidateBytes)||candidateBytes.length===0||candidateBytes.length>32768)
  fail('MAINTENANCE_CI_MERGE_MANIFEST_UNVERIFIED');
 const manifest=JSON.parse(candidateBytes.toString('utf8'));
 if(manifest.targetSha!==targetSha||manifest.approval?.ref!=='https://github.com/'+CONTROL_REPOSITORY+'/pull/'+approvalPrNumber)
  fail('MAINTENANCE_CI_MERGE_MANIFEST_UNVERIFIED');
 const {prepareSelectiveApprovalPublication}=await import('../ci-approval/controller-candidate-review.mjs');
 const plan=Object.fromEntries(['installedSha','targetSha','allowFiles','purpose','postOperation','postSourceBranch','postSourceSha'].map(k=>[k,manifest[k]]));
 const prepared=await prepareSelectiveApprovalPublication({
  plan,delegation:{...ctx.delegation,now:new Date().toISOString().replace(/\.\d{3}Z$/,'Z')},
  sourcePrNumber:ctx.policy.sourcePrNumber,approvalPrNumber,
  sourceMainSha:manifest.selectiveSource?.mainSha,policy:ctx.policy,
  getJson:ctx.getJson,readFileBytes:ctx.readFileBytes,readJobLogs:ctx.readJobLogs});
 if(prepared.state!=='SELECTIVE_APPROVAL_FILES_PREPARED'||prepared.files.length!==2||
    !prepared.files[0].bytes.equals(candidateBytes))
  fail('MAINTENANCE_CI_AUTO_APPROVAL_RECONSTRUCTION_DENIED');
 // Restrict publication to the exact two new files. Never merge unrelated
 // code, workflow, permission or existing approval changes on this path.
 await requireExactApprovalPair(ports,approvalPrNumber,prepared.files);
 for(const f of prepared.files){
  const actual=await ctx.readFileBytes(CONTROL_REPOSITORY,pr.head.sha,f.path);
  if(!Buffer.isBuffer(actual)||!actual.equals(f.bytes))fail('MAINTENANCE_CI_MERGE_FILE_MISMATCH');
 }
 // The candidate contains no source changes. The original source CI and
 // both immutable publication file bytes were checked in this same job.
 const current=await ports.readApprovalPr(approvalPrNumber);
 if(current?.head?.sha!==pr.head.sha||current?.base?.ref!=='main')
  fail('MAINTENANCE_CI_MERGE_HEAD_DRIFT');
 let merged=current;
 if(!merged.merged){
  if(merged.state!=='open'||merged.draft!==false||pr.merged)
   fail('MAINTENANCE_CI_MERGE_PR_DENIED');
  // GitHub's merge API must use this exact head SHA. The PR is itself the
  // one-time merge effect; do not issue a second merge after an uncertain
  // response in this invocation. Always reconcile the exact PR by readback.
  try{await ports.mergeApprovalPr(approvalPrNumber,pr.head.sha);}catch{}
  try{merged=await ports.readApprovalPr(approvalPrNumber);}catch{
   return {status:'STATE_UNKNOWN',code:'MAINTENANCE_CI_MERGE_OUTCOME_UNKNOWN',approvalPrNumber,next:'RECONCILE_ORIGINAL_PR'};
  }
 }
 if(merged?.number!==approvalPrNumber||merged.merged!==true||merged.head?.sha!==pr.head.sha||
    !sha40(merged.merge_commit_sha)||!(ownerIdentity(merged.merged_by)||botIdentity(merged.merged_by)))
  return {status:'STATE_UNKNOWN',code:'MAINTENANCE_CI_MERGE_OUTCOME_UNKNOWN',approvalPrNumber,next:'RECONCILE_ORIGINAL_PR'};
 // Independently read both merged and current main bytes before invoking
 // the same exact single-POST submission path. No new push event is needed.
 for(const f of prepared.files)for(const revision of [merged.merge_commit_sha,'main']){
  const actual=await ctx.readFileBytes(CONTROL_REPOSITORY,revision,f.path);
  if(!Buffer.isBuffer(actual)||!actual.equals(f.bytes))
   return {status:'STATE_UNKNOWN',code:'MAINTENANCE_CI_MERGE_READBACK_MISMATCH',approvalPrNumber,next:'RECONCILE_ORIGINAL_PR'};
 }
 return submitExistingControllerApprovalFromCi({targetSha,approvalSha256:prepared.files[0].sha256,runId,attempt},ports);
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
