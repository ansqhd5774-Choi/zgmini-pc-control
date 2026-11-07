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

function verifyRemoteFile(response,bytes){
 if(response.status!==200)return false;
 const data=response.data;
 if(data?.type!=='file'||data?.encoding!=='base64'||typeof data.content!=='string')
  fail('REPORT_REMOTE_INVALID');
 const remote=Buffer.from(data.content.replace(/\s/g,''),'base64');
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

