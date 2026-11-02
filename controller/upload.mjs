import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {need} from './common.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),policy=JSON.parse(fs.readFileSync(path.join(root,'config/operations.json')));
const token=process.env.GITHUB_TOKEN;need(token,'REPORT_AUTH_MISSING');need(process.env.GITHUB_REPOSITORY===policy.controlRepository,'REPORT_REPOSITORY');
const seat=process.env.RUNNER_NAME?.match(/^zgmini-pc-0([1-6])$/)?.[1],runId=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT||'1';
need(/^\d{1,20}$/.test(runId??'')&&/^[1-6]$/.test(seat??'')&&/^\d{1,3}$/.test(attempt),'REPORT_ID');
const pointer=JSON.parse(fs.readFileSync(path.join(root,'reports',`${runId}-${attempt}-${seat}.json`)));
const report=pointer.report,json=JSON.stringify(report,null,2)+'\n',txt=Object.entries(report).filter(([k])=>!['result','prior'].includes(k)).map(([k,v])=>`${k}=${typeof v==='object'?JSON.stringify(v):v}`).join('\r\n')+'\r\n';
need(Buffer.byteLength(json)+Buffer.byteLength(txt)<=policy.maxReportBytes,'REPORT_SIZE');need(Number.isSafeInteger(pointer.issueNumber),'REPORT_ISSUE');
const api=async(route,method='GET',body)=>{const response=await fetch('https://api.github.com/repos/'+policy.controlRepository+'/'+route,{method,headers:{accept:'application/vnd.github+json',authorization:'Bearer '+token,'x-github-api-version':'2022-11-28','content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});let data;try{data=await response.json();}catch{data={};}return {status:response.status,data};};
const base=`results/${runId}-${attempt}-seat-${seat}`;const files=[];
for(const [extension,content] of [['json',json],['txt',txt]]){
 const name=base+'.'+extension;let complete=false;
 for(let n=0;n<3&&!complete;n++){
  try{
   const existing=await api('contents/'+name);if(existing.status===200){need(Buffer.from(existing.data.content.replace(/\s/g,''),'base64').toString()===content,'REPORT_REMOTE_CONTENT_CHANGED');complete=true;break;}
   need(existing.status===404,'REPORT_CONTENT_LOOKUP_FAILED');
   const put=await api('contents/'+name,'PUT',{message:`report: PC job ${runId}-${attempt} seat ${seat}`,content:Buffer.from(content).toString('base64'),branch:'main'});
   if(put.status===201||put.status===200)complete=true;else if(put.status!==409&&put.status!==422)break;
  }catch(error){if(error.code==='REPORT_REMOTE_CONTENT_CHANGED')throw error;}
  if(!complete)await new Promise(r=>setTimeout(r,250*(n+1)+Number(seat)*80));
 }
 if(complete)files.push(`https://github.com/${policy.controlRepository}/blob/main/${name}`);
}
const marker=`<!-- zgmini-pc-result:${runId}:${attempt}:${seat} -->`,runUrl=`https://github.com/${policy.controlRepository}/actions/runs/${runId}`;
const body=`${marker}\n**${report.status} — ${report.code}**\n\n실행: ${runUrl}\n\n${files.map(x=>'- '+x).join('\n')}\n\nJSON 결과:\n\n\`\`\`json\n${json}\`\`\`\n\nTXT 결과:\n\n\`\`\`text\n${txt}\`\`\`\n`;
let comments=await api(`issues/${pointer.issueNumber}/comments?per_page=100`);need(comments.status===200,'REPORT_COMMENTS_LOOKUP_FAILED');
if(!comments.data.some(x=>x.body?.includes(marker))){try{const post=await api(`issues/${pointer.issueNumber}/comments`,'POST',{body});need(post.status===201,'REPORT_COMMENT_WRITE_FAILED');}catch(error){comments=await api(`issues/${pointer.issueNumber}/comments?per_page=100`);need(comments.status===200&&comments.data.some(x=>x.body?.includes(marker)),'REPORT_COMMENT_OUTCOME_UNKNOWN');}}
console.log(JSON.stringify({status:'REPORT_UPLOADED',issueNumber:pointer.issueNumber,resultFiles:files.length,artifactBytes:0,runUrl}));
