// Owner-side submission of an already approved, exact Writer B request.
// Does not issue approvals, infer live PC state, or impersonate a workflow event.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {ACTOR,CONTROL_REPO,ISSUE_TITLE,ISSUE_LABEL,EXTENDED_DRAIN_LABEL,DRAIN_1200_LABEL,validateWriterBRequestManifest} from '../writer-b/contract.mjs';
const fail=code=>{throw Error(code)};
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(v=>Object.hasOwn(x,v));
const id=x=>Number.isSafeInteger(x)&&x>0;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const sha=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
function requestOf(e){
 if(!exact(e,['repository_full_name','title','labels','body'])||e.repository_full_name!==CONTROL_REPO||e.title!==ISSUE_TITLE||!Array.isArray(e.labels)||typeof e.body!=='string'||e.body.length>4096)fail('WRITER_PREPARED_ENVELOPE_INVALID');
 if(e.labels.length<1||e.labels.length>2||e.labels[0]!==ISSUE_LABEL||new Set(e.labels).size!==e.labels.length||e.labels.some(x=>![ISSUE_LABEL,EXTENDED_DRAIN_LABEL,DRAIN_1200_LABEL].includes(x)))fail('WRITER_PREPARED_LABEL_INVALID');
 let q;try{q=JSON.parse(e.body)}catch{fail('WRITER_PREPARED_BODY_INVALID')}
 if(!uuid(q?.requestId)||typeof q.approvalManifestPath!=='string'||!/^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/.test(q.approvalManifestPath))fail('WRITER_PREPARED_REQUEST_INVALID');
 return q;
}
export function verifyWriterSubmission(expected,actual){
 const request=requestOf(expected);
 if(!id(actual?.number)||actual.pull_request||actual.title!==expected.title||actual.body!==expected.body||actual.user?.login!==ACTOR||!['open','closed'].includes(actual.state)||!Array.isArray(actual.labels)||!expected.labels.every(name=>actual.labels.some(l=>l.name===name))||[EXTENDED_DRAIN_LABEL,DRAIN_1200_LABEL].some(name=>actual.labels.some(l=>l.name===name)!==expected.labels.includes(name)))fail('WRITER_SUBMISSION_READBACK_MISMATCH');
 return {status:'REQUEST_READBACK_VERIFIED',requestId:request.requestId,issueNumber:actual.number,execution:'NOT_ASSERTED',next:'FOLLOW_ORIGINAL_REQUEST_ONLY'};
}
export async function submitPreparedWriterIssue(expected,{observedHead,observedConfigSha,readIdentity,readRepository,readManifest,saveReceipt,createIssue,readIssue}){
 const e=structuredClone(expected),q=requestOf(e);
 if((await readIdentity())?.login!==ACTOR||(await readRepository())?.private!==true)fail('WRITER_SUBMIT_IDENTITY_DENIED');
 const bytes=await readManifest(q.approvalManifestPath);
 const {manifest}=validateWriterBRequestManifest({body:e.body,labels:e.labels.map(name=>({name})),manifestBytes:bytes});
 if(!sha(observedHead)||observedHead!==manifest.baseHead||observedConfigSha!==manifest.baseConfigSourceSha)fail('WRITER_SUBMIT_LOCAL_CAS_MISMATCH');
 const receipt={schema:'ZGMINI_WRITER_SUBMISSION_V1',phase:'CREATING',expected:e,issueNumber:null};
 await saveReceipt(receipt,{exclusive:true});
 let created;
 try{created=await createIssue(e)}catch{
  await saveReceipt({...receipt,phase:'CREATION_UNKNOWN'});
  return {status:'STATE_UNKNOWN',code:'WRITER_CREATE_OUTCOME_UNKNOWN',next:'RECONCILE_SAME_RECEIPT_NO_NEW_POST'};
 }
 if(id(created?.number))receipt.issueNumber=created.number;
 await saveReceipt({...receipt,phase:'READBACK_PENDING'});
 try{
  if(!receipt.issueNumber)fail('WRITER_CREATE_RESPONSE_UNVERIFIED');
  const verified=verifyWriterSubmission(e,await readIssue(receipt.issueNumber));
  await saveReceipt({...receipt,phase:'READBACK_VERIFIED'});return verified;
 }catch{return {status:'AUTOMATION_BLOCKED',code:'WRITER_CREATED_ISSUE_NOT_VERIFIED',issueNumber:receipt.issueNumber,next:'RECONCILE_SAME_RECEIPT_NO_NEW_POST'};}
}
export async function reconcileWriterSubmission(receipt,{findIssues,readIssue,saveReceipt}){
 if(receipt?.schema!=='ZGMINI_WRITER_SUBMISSION_V1')fail('WRITER_RECEIPT_INVALID');
 const q=requestOf(receipt.expected);let n=receipt.issueNumber;
 if(!n){
  const items=await findIssues(q.requestId);
  const matches=items.filter(x=>!x.pull_request&&x.title===receipt.expected.title&&x.body===receipt.expected.body&&x.user?.login===ACTOR);
  if(matches.length!==1)return {status:'STATE_UNKNOWN',code:'WRITER_ORIGINAL_REQUEST_NOT_UNIQUE',next:'READ_ORIGINAL_CREATION_STATE_NO_NEW_POST'};
  n=matches[0].number;
 }
 const verified=verifyWriterSubmission(receipt.expected,await readIssue(n));
 await saveReceipt({...receipt,issueNumber:n,phase:'READBACK_VERIFIED'});return verified;
}
function github(endpoint,{body}={}){
 return JSON.parse(execFileSync('gh',['api',endpoint,...(body?['--method','POST','--input','-']:[])],{input:body?JSON.stringify(body):undefined,encoding:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:2*1024*1024}));
}
export async function main(argv=process.argv.slice(2)){
 const [mode,...rest]=argv;if(!['submit-prepared','reconcile'].includes(mode)||rest.length%2)fail('WRITER_REQUEST_USAGE');
 const o={};const allowed=mode==='reconcile'?['--receipt-file']:['--prepared-file','--observed-head','--observed-config-sha','--receipt-directory'];
 for(let i=0;i<rest.length;i+=2){if(!allowed.includes(rest[i])||Object.hasOwn(o,rest[i])||!rest[i+1]||rest[i+1].startsWith('--'))fail('WRITER_REQUEST_USAGE');o[rest[i]]=rest[i+1];}
 if(!allowed.every(k=>Object.hasOwn(o,k)))fail('WRITER_REQUEST_USAGE');
 let receiptPath;
 const saveReceipt=(r,{exclusive=false}={})=>fs.writeFileSync(receiptPath,JSON.stringify(r,null,2)+'\n',{flag:exclusive?'wx':'w'});
 const readIssue=n=>github('repos/'+CONTROL_REPO+'/issues/'+n);
 if(mode==='reconcile'){
  receiptPath=path.resolve(o['--receipt-file']);
  return reconcileWriterSubmission(JSON.parse(fs.readFileSync(receiptPath,'utf8')),{saveReceipt,readIssue,findIssues:requestId=>{
   const q=encodeURIComponent('repo:'+CONTROL_REPO+' is:issue "'+requestId+'" in:body');
   const r=github('search/issues?q='+q+'&per_page=100');
   if(r.incomplete_results||r.total_count>100||!Array.isArray(r.items))fail('WRITER_SEARCH_INCOMPLETE_NO_REPOST');return r.items;
  }});
 }
 if(!sha(o['--observed-head'])||!sha(o['--observed-config-sha']))fail('WRITER_REQUEST_USAGE');
 const e=JSON.parse(fs.readFileSync(path.resolve(o['--prepared-file']),'utf8')),q=requestOf(e);
 receiptPath=path.join(path.resolve(o['--receipt-directory']),'writer-'+q.requestId.toLowerCase()+'.json');
 if(fs.existsSync(receiptPath))fail('WRITER_RECEIPT_EXISTS_USE_RECONCILE');
 return submitPreparedWriterIssue(e,{observedHead:o['--observed-head'],observedConfigSha:o['--observed-config-sha'],
  readIdentity:()=>github('user'),readRepository:()=>github('repos/'+CONTROL_REPO),
  readManifest:p=>{const r=github('repos/'+CONTROL_REPO+'/contents/'+p+'?ref=main');if(r.encoding!=='base64'||typeof r.content!=='string')fail('WRITER_REMOTE_MANIFEST_BYTES_MISSING');return Buffer.from(r.content,'base64');},
  saveReceipt,readIssue,createIssue:x=>github('repos/'+CONTROL_REPO+'/issues',{body:{title:x.title,labels:x.labels,body:x.body}})});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const r=await main();console.log(JSON.stringify(r));if(r.status!=='REQUEST_READBACK_VERIFIED')process.exitCode=1;}
 catch(e){const code=e?.code??e?.message;console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:/^[A-Z0-9_]{1,96}$/.test(code??'')?code:'WRITER_REQUEST_TOOL_FAILED',next:'INSPECT_EXISTING_RECEIPT_NO_BLIND_RETRY'}));process.exitCode=1;}
}
