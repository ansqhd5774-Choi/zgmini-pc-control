/**
 * Verify both public job-result artifacts after each idempotent upload.
 * No filesystem access and no arbitrary path from an Issue payload.
 */
const fail=code=>{throw Object.assign(new Error(code),{code});};

// Keep every report field and the existing 32 KiB combined limit. Only remove
// presentation whitespace when the normal pretty JSON would exceed that limit.
// The exact returned strings are used by both the GitHub files and the comment.
export function renderBoundedReport(report,maxReportBytes){
 const txt=Object.entries(report).filter(([key])=>!['result','prior'].includes(key))
  .map(([key,value])=>`${key}=${typeof value==='object'?JSON.stringify(value):value}`).join('\r\n')+'\r\n';
 let json=JSON.stringify(report,null,2)+'\n';
 if(Buffer.byteLength(json)+Buffer.byteLength(txt)>maxReportBytes)
  json=JSON.stringify(report)+'\n';
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
