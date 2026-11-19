import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseHandoff} from './contract.mjs';
import {assessIncident} from './queue-selector.mjs';
import {DIAGNOSIS_SCHEMA,DIAGNOSIS_RECEIPT,REPO,OWNER,parseDiagnosis,verifyDiagnosis} from './diagnosis-result.mjs';
const API=`https://api.github.com/repos/${REPO}`;
const need=(x,c)=>{if(!x)throw Error('DIAGNOSIS_BROKER_'+c);};
async function api(p,body){
 need(process.env.GITHUB_TOKEN,'TOKEN');
 const r=await fetch(API+p,{method:body?'POST':'GET',headers:{
  Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json',
  ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 need(r.ok,`HTTP_${r.status}`);return r.json();
}
async function comments(n){
 const all=[];for(let p=1;p<=4;p++){
  const rows=await api(`/issues/${n}/comments?per_page=100&page=${p}`);
  need(Array.isArray(rows),'COMMENTS');all.push(...rows);if(rows.length<100)return all;
 }need(false,'COMMENT_LIMIT');
}
function matched(rows,n,body){
 const found=rows.filter(c=>c.user?.login==='github-actions[bot]'&&
  c.body?.startsWith(DIAGNOSIS_RECEIPT+'\n'));
 need(found.length<=1&&found.every(c=>c.issue_url===`${API}/issues/${n}`&&c.body===body),
  'RECEIPT_CONFLICT');return found.length===1;
}
export async function returnDiagnosis(event,env,io){
 need(env.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issue_comment'&&
  env.GITHUB_ACTOR===OWNER&&event.action==='created'&&
  event.repository?.private===true&&event.repository.full_name===REPO&&
  event.comment?.user?.login===OWNER&&!event.issue.pull_request&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,'EVENT');
 const result=parseDiagnosis(event.comment.body),n=event.issue.number;
 const incident=await io.issue(n),rows=await io.comments(n);
 need(rows.filter(c=>c.id===event.comment.id&&c.user?.login===OWNER&&
  c.body===event.comment.body&&c.issue_url===`${API}/issues/${n}`).length===1,'SOURCE_COMMENT');
 const decision=assessIncident({...incident,repository:REPO},rows);
 need(decision.state==='ALREADY_SELECTED','INCIDENT_SELECTION');
 const h=parseHandoff(incident.body);
 const origin=await io.issue(h.origin.issueNumber),evidence=await io.issue(result.evidenceIssueNumber);
 const pcComments=await io.comments(evidence.number);
 const receipts=pcComments.filter(c=>c.user?.login==='github-actions[bot]'&&
  /^<!-- zgmini-pc-result:[1-9][0-9]*:1:[1-6] -->\n/.test(c.body??''));
 need(receipts.length===1,'PC_RECEIPT');
 const ids=receipts[0].body.match(/^<!-- zgmini-pc-result:([1-9][0-9]*):1:([1-6]) -->/);
 const stem=`results/${ids[1]}-1-seat-${ids[2]}`;
 const report=JSON.parse(await io.file(stem+'.json')),txt=await io.file(stem+'.txt');
 const receipt=verifyDiagnosis({incident,result,origin,evidence,report,txt,
  run:await io.run(ids[1]),comments:pcComments});
 // Read-only evidence can change; recheck origin/scope immediately before
 // posting. A result receipt grants no later PC write authority.
 for(const original of [incident,origin,evidence]){
  const fresh=await io.issue(original.number);
  need(fresh.body===original.body&&fresh.user?.login===original.user?.login&&
   JSON.stringify(fresh.labels?.map(x=>x.name).sort())===
    JSON.stringify(original.labels?.map(x=>x.name).sort()),'ISSUE_DRIFT');
 }
 for(const target of [n,origin.number]){
  if(matched(await io.comments(target),target,receipt))continue;
  try{await io.post(target,receipt);}catch{
   need(matched(await io.comments(target),target,receipt),'POST_OUTCOME_UNKNOWN');
  }
  need(matched(await io.comments(target),target,receipt),'READBACK');
 }
 return {state:'DIAGNOSIS_RETURNED_TO_ORIGIN',incident:n,origin:origin.number,
  evidenceIssue:result.evidenceIssueNumber,operationalWrites:0,aiCalls:0};
}
export async function main(env=process.env){
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const out=await returnDiagnosis(event,env,{
  issue:n=>api(`/issues/${n}`),comments,run:n=>api(`/actions/runs/${n}`),
  file:async p=>{const f=await api(`/contents/${p}?ref=main`);
   need(f.encoding==='base64'&&typeof f.content==='string'&&f.size<=65536,'RESULT_FILE');
   return Buffer.from(f.content,'base64').toString('utf8');},
  post:(n,body)=>api(`/issues/${n}/comments`,{body}),
 });process.stdout.write(JSON.stringify(out)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
