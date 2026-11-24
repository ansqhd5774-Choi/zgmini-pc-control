import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {need,exclusive,readAllPages} from './common.mjs';
import {renderBoundedReport,uploadVerifiedReportPair,resolveUploadPolicy,hasVerifiedReportComment} from './report-upload-verified.mjs';
import {cleanupVerifiedJobTemps} from './report-temp-retention.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token=process.env.GITHUB_TOKEN;need(token,'REPORT_AUTH_MISSING');
const seat=process.env.RUNNER_NAME?.match(/^zgmini-pc-0([1-6])$/)?.[1],runId=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT||'1';
need(/^\d{1,20}$/.test(runId??'')&&/^[1-6]$/.test(seat??'')&&/^\d{1,3}$/.test(attempt),'REPORT_ID');
const pointer=JSON.parse(fs.readFileSync(path.join(root,'reports',`${runId}-${attempt}-${seat}.json`)));
let policyBytes=null;try{policyBytes=fs.readFileSync(path.join(root,'config/operations.json'));}catch{}
const policy=resolveUploadPolicy(policyBytes,{pointer,runId,attempt,seat});
need(process.env.GITHUB_REPOSITORY===policy.controlRepository,'REPORT_REPOSITORY');
const report=pointer.report,{json,txt}=renderBoundedReport(report,policy.maxReportBytes);
need(Number.isSafeInteger(pointer.issueNumber),'REPORT_ISSUE');
const api=async(route,method='GET',body)=>{const response=await fetch('https://api.github.com/repos/'+policy.controlRepository+'/'+route,{method,headers:{accept:'application/vnd.github+json',authorization:'Bearer '+token,'x-github-api-version':'2022-11-28','content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});let data;try{data=await response.json();}catch{data={};}return {status:response.status,data};};
let releaseUpload;for(let n=0;n<120&&!releaseUpload;n++){try{releaseUpload=exclusive(path.join(root,'leases'),'result-upload');}catch(error){if(error.code!=='LEASE_BUSY')throw error;await new Promise(r=>setTimeout(r,500));}}need(releaseUpload,'REPORT_UPLOAD_QUEUE_TIMEOUT');
try{
const files=await uploadVerifiedReportPair({api,repository:policy.controlRepository,runId,attempt,seat,json,txt});
const marker=`<!-- zgmini-pc-result:${runId}:${attempt}:${seat} -->`,runUrl=`https://github.com/${policy.controlRepository}/actions/runs/${runId}`;
const transfer=JSON.parse(json).reportTransfer;
const scopeNotice=transfer?.status==='SUMMARY_ONLY'?
 '\n\n**전송 범위: SUMMARY_ONLY — 파일별 목록은 PC 원장에만 보존. 이 댓글은 전체 inventory/해시의 원격 검증 증거가 아닙니다.**':'';
const body=`${marker}\n**${report.status} — ${report.code}**${scopeNotice}\n\n실행: ${runUrl}\n\n${files.map(x=>'- '+x).join('\n')}\n\nJSON 결과:\n\n\`\`\`json\n${json}\`\`\`\n\nTXT 결과:\n\n\`\`\`text\n${txt}\`\`\`\n`;
const allComments=()=>readAllPages(async page=>{const r=await api(`issues/${pointer.issueNumber}/comments?per_page=100&page=${page}`);need(r.status===200,'REPORT_COMMENTS_LOOKUP_FAILED');return r.data;});
let comments=await allComments();
if(!hasVerifiedReportComment(comments,{marker,body})){try{const post=await api(`issues/${pointer.issueNumber}/comments`,'POST',{body});need(post.status===201,'REPORT_COMMENT_WRITE_FAILED');}catch(error){comments=await allComments();need(hasVerifiedReportComment(comments,{marker,body}),'REPORT_COMMENT_OUTCOME_UNKNOWN');}}
console.log(JSON.stringify({status:'REPORT_UPLOADED',issueNumber:pointer.issueNumber,resultFiles:files.length,artifactBytes:0,runUrl}));
// The report is already published. An optional cleanup failure cannot cause a
// duplicate execution, retroactively fail upload, or remove recovery evidence.
let commentVerified=false;
try{commentVerified=(await allComments()).some(x=>x.user?.login==='github-actions[bot]'&&x.body===body);}catch{}
const cleanup=cleanupVerifiedJobTemps({root,runId,attempt,seat,issueNumber:pointer.issueNumber,
 report,remoteFilesVerified:files.length===2,commentVerified});
console.log(JSON.stringify({tempCleanup:cleanup.status,code:cleanup.code??null,removedFiles:cleanup.files??0}));
}finally{releaseUpload();}


