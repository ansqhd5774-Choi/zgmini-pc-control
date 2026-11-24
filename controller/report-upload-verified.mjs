// A damaged installed operations policy must not suppress the specific BLOCKED
// receipt produced by entry.mjs. This is NOT a general policy fallback: the
// destination, report budget, run identity and failure code are all fixed.
export function resolveUploadPolicy(policyBytes,{pointer,runId,attempt,seat}={}){
 let policy;
 try{
  policy=JSON.parse(policyBytes);
  if(policy&&typeof policy==='object'&&!Array.isArray(policy)&&
     policy.controlRepository==='ansqhd5774-Choi/zgmini-pc-control'&&
     Number.isSafeInteger(policy.maxReportBytes)&&policy.maxReportBytes>0)
   return policy;
 }catch{}
 const report=pointer?.report;
 const fields=['schema','jobId','status','code','lastPass','firstFail',
  'operationalWrites','providerCalls','d1Writes'];
 if(!report||typeof report!=='object'||Array.isArray(report)||
    Object.keys(report).sort().join('|')!==fields.sort().join('|')||
    report.lastPass!=='EVENT_RECEIVED'||
    report.firstFail!=='EVENT_OR_REQUEST_VALIDATION'||
    !Number.isSafeInteger(pointer?.issueNumber)||pointer.issueNumber<1||
    !/^\d{1,20}$/.test(String(runId??''))||
    !/^\d{1,3}$/.test(String(attempt??''))||
    !/^[1-6]$/.test(String(seat??''))||
    report?.schema!=='ZGMINI_PC_RESULT_V1'||
    report.jobId!==`run-${runId}-${attempt}-seat-${seat}`||
    report.status!=='BLOCKED'||report.code!=='CONTROLLER_POLICY_UNAVAILABLE'||
    report.operationalWrites!==0||report.providerCalls!==0||report.d1Writes!==0)
  throw Object.assign(Error('REPORT_POLICY_UNAVAILABLE'),{code:'REPORT_POLICY_UNAVAILABLE'});
 return {controlRepository:'ansqhd5774-Choi/zgmini-pc-control',maxReportBytes:32768};
}

/**
 * Verify both public job-result artifacts after each idempotent upload.
 * No filesystem access and no arbitrary path from an Issue payload.
 */
import {createHash} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};

// Only the fixed read-only source preflight can return hundreds of file digests.
// Keep the complete original in the local request ledger. The transport copy
// explicitly marks omitted inventories, preserving status/uncertainty/identity.
export function projectSourcePreflightReport(report){
 if(report?.operation!=='pc-source-preflight'||(!report.result&&!report.prior))return null;
 const projected=JSON.parse(JSON.stringify(report));
 const original=JSON.stringify(report);
 let omitted=0;
 const visit=part=>{
  if(!part||typeof part!=='object')return;
  for(const field of ['writerSourceInventory','moduleSourceInventory']){
   const inventory=part[field];
   if(!inventory||!Array.isArray(inventory.files))continue;
   const files=inventory.files;
   inventory.filesCount=files.length;
   inventory.filesSha256=createHash('sha256').update(JSON.stringify(files)).digest('hex');
   inventory.filesHashRepresentation='COMPACT_JSON_UTF8';
   inventory.filesTransfer='OMITTED_SUMMARY_ONLY';
   delete inventory.files;
   omitted+=files.length;
  }
 };
 visit(projected.result);
 visit(projected.result?.result);
 visit(projected.result?.historicalCheckoutCandidate);
 visit(projected.result?.result?.historicalCheckoutCandidate);
 let priorSummarized=false;
 if(projected.prior&&typeof projected.prior==='object'){
  const prior=projected.prior;
  projected.prior={status:prior.status??null,code:prior.code??null,
   transfer:'SUMMARY_ONLY_PRIOR',
   fullPriorSha256:createHash('sha256').update(JSON.stringify(prior)).digest('hex')};
  priorSummarized=true;
 }
 if(!omitted&&!priorSummarized)return null;
 projected.reportTransfer={status:'SUMMARY_ONLY',
  reason:'SOURCE_INVENTORY_EXCEEDS_REPORT_BUDGET',
  fullReportSha256:createHash('sha256').update(original).digest('hex'),
  hashRepresentation:'COMPACT_JSON_UTF8',
  fullReportBytes:Buffer.byteLength(original),
  omittedFileEntries:omitted,
  priorSummarized,
  originalStored:'PC_REQUEST_LEDGER',
  fullInventoryTransferVerified:false};
 return projected;
}

function render(report,maxReportBytes){
 const txt=Object.entries(report).filter(([key])=>!['result','prior'].includes(key))
  .map(([key,value])=>`${key}=${typeof value==='object'?JSON.stringify(value):value}`).join('\r\n')+'\r\n';
 let json=JSON.stringify(report,null,2)+'\n';
 if(Buffer.byteLength(json)+Buffer.byteLength(txt)>maxReportBytes)
  json=JSON.stringify(report)+'\n';
 return {json,txt};
}

// Preserve all fields for ordinary reports. Large fixed A source inventories
// have an explicitly labeled summary-only transport; never silently truncate.
// The exact strings are used for both GitHub files and the Issue comment.
export function renderBoundedReport(report,maxReportBytes){
 let {json,txt}=render(report,maxReportBytes);
 if(Buffer.byteLength(json)+Buffer.byteLength(txt)>maxReportBytes){
  const projected=projectSourcePreflightReport(report);
  if(projected)({json,txt}=render(projected,maxReportBytes));
 }
 if(!Number.isSafeInteger(maxReportBytes)||maxReportBytes<1||
    Buffer.byteLength(json)+Buffer.byteLength(txt)>maxReportBytes)fail('REPORT_SIZE');
 return {json,txt};
}

// A quoted marker or another account's comment is not this run's receipt.
// An existing bot receipt with the same exact first-line identity but different
// content is ambiguous: never overwrite or silently accept conflicting evidence.
export function hasVerifiedReportComment(comments,{marker,body}){
 const tagged=comments.filter(comment=>
  comment?.user?.login==='github-actions[bot]'&&
  typeof comment.body==='string'&&comment.body.startsWith(marker+'\n'));
 if(tagged.some(comment=>comment.body!==body))fail('REPORT_COMMENT_CONTENT_CHANGED');
 return tagged.length>0;
}

// POST 201 or an earlier matching comment lookup is not a published
// receipt. Confirm the exact bot comment is remotely readable before success.
// Retry only GET: a lost POST outcome must never trigger a duplicate POST.
export async function confirmVerifiedReportComment({readComments,marker,body,
 wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 for(let attempt=0;attempt<4;attempt++){
  try{
   if(hasVerifiedReportComment(await readComments(),{marker,body}))return true;
  }catch(error){
   // A changed receipt is evidence conflict, never an eventual-consistency miss.
   if(error?.code==='REPORT_COMMENT_CONTENT_CHANGED')throw error;
  }
  if(attempt<3)await wait(300*(attempt+1));
 }
 fail('REPORT_COMMENT_OUTCOME_UNKNOWN');
}

function verifyRemoteFile(response,bytes){
 if(response.status!==200)return false;
 const data=response.data;
 if(data?.type!=='file'||data?.encoding!=='base64'||typeof data.content!=='string')
  fail('REPORT_REMOTE_INVALID');
 // GitHub wraps valid base64 in CR/LF. Never accept arbitrary ignored
 // characters, impossible padding or noncanonical pad bits as verified bytes.
 const encoded=data.content.replace(/[\r\n]/g,'');
 if(!encoded||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
  fail('REPORT_REMOTE_INVALID');
 const remote=Buffer.from(encoded,'base64');
 if(remote.toString('base64')!==encoded)fail('REPORT_REMOTE_INVALID');
 if(!remote.equals(bytes))fail('REPORT_REMOTE_CONTENT_CHANGED');
 return true;
}

export async function uploadVerifiedReportPair({api,repository,runId,attempt,seat,json,txt,
 wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const base=`results/${runId}-${attempt}-seat-${seat}`;
 const links=[];
 for(const [extension,contents] of [['json',json],['txt',txt]]){
  const file=base+'.'+extension,resource='contents/'+file;
  const bytes=Buffer.from(contents,'utf8');
  let verified=false;
  for(let n=0;n<3&&!verified;n++){
   try{
    const existing=await api(resource);
    if(verifyRemoteFile(existing,bytes)){verified=true;break;}
    if(existing.status!==404)fail('REPORT_CONTENT_LOOKUP_FAILED');
    // A timed-out PUT can already have committed. Every attempt is followed
    // by a GET and a byte comparison; never infer success from HTTP 201/200.
    try{
     await api(resource,'PUT',{
      message:`report: PC job ${runId}-${attempt} seat ${seat}`,
      content:bytes.toString('base64'),branch:'main'});
    }catch{/* ambiguous PUT: the following readback resolves it */}
    const after=await api(resource);
    if(verifyRemoteFile(after,bytes)){verified=true;break;}
    if(after.status!==404)fail('REPORT_CONTENT_LOOKUP_FAILED');
   }catch(error){
    if(['REPORT_REMOTE_INVALID','REPORT_REMOTE_CONTENT_CHANGED'].includes(error?.code))
     throw error;
   }
   if(n<2)await wait(250*(n+1)+Number(seat)*80);
  }
  if(!verified)fail('REPORT_FILE_READBACK_NOT_VERIFIED');
  links.push(`https://github.com/${repository}/blob/main/${file}`);
 }
 return links;
}

