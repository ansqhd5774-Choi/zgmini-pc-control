// Read-only support may return real PC evidence without inventing a code PR.
// This receipt attests a fixed query, never incident resolution or write consent.
import {parseHandoff,fingerprintHandoff} from './contract.mjs';
export const DIAGNOSIS_SCHEMA='ZGMINI_AGENT_HANDOFF_DIAGNOSIS_V1';
export const DIAGNOSIS_RECEIPT='HANDOFF_DIAGNOSIS_RETURNED_V1';
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
const READS=new Set(['runner-smoke','core-status','writer-install-preimage-readonly']);
const need=(ok,code)=>{if(!ok)throw Error('HANDOFF_DIAGNOSIS_'+code);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function parseDiagnosis(body){
 need(typeof body==='string'&&body.length<=1024,'BODY');let x;
 try{x=JSON.parse(body);}catch{need(false,'JSON');}
 need(exact(x,['schema','resultId','incidentId','fingerprint','evidenceIssueNumber'])&&
  x.schema===DIAGNOSIS_SCHEMA&&/^result-[a-z0-9-]{12,80}$/.test(x.resultId??'')&&
  /^handoff-[a-z0-9-]{12,80}$/.test(x.incidentId??'')&&
  /^[a-f0-9]{64}$/.test(x.fingerprint??'')&&
  Number.isSafeInteger(x.evidenceIssueNumber)&&x.evidenceIssueNumber>0,'FIELDS');
 return Object.freeze(x);
}
function ownerRequest(issue){
 need(issue?.user?.login===OWNER&&!issue.pull_request&&
  issue.labels?.some(x=>x.name==='pc-job'),'REQUEST_OWNER');
 let x;try{x=JSON.parse(issue.body);}catch{need(false,'REQUEST_JSON');}
 need(x.schema==='ZGMINI_PC_JOB_V1'&&READS.has(x.operation)&&
  /^[a-z0-9-]{8,80}$/.test(x.requestId??'')&&
  ['ansqhd5774-Choi/zgmini',REPO].includes(x.sourceRepository),'REQUEST_SCOPE');
 return x;
}
export function verifyDiagnosis({incident,result,origin,evidence,report,txt,run,comments}){
 const h=parseHandoff(incident.body);
 need(h.failure.kind!=='FEATURE'&&h.origin.repository===REPO&&
  h.incidentId===result.incidentId&&fingerprintHandoff(h)===result.fingerprint,'INCIDENT_BINDING');
 need(origin.number===h.origin.issueNumber&&evidence.number===result.evidenceIssueNumber,'ISSUE_BINDING');
 const old=ownerRequest(origin),q=ownerRequest(evidence);
 need(old.requestId===h.origin.requestId&&old.chatId===h.origin.chatId&&
  old.sourceSha===h.origin.sourceSha&&old.sourceBranch===h.origin.branch&&
  q.operation===old.operation&&q.sourceRepository===old.sourceRepository,'ORIGIN_BINDING');
 if(q.operation==='writer-install-preimage-readonly')need(
  q.preimageManifestPath===old.preimageManifestPath&&
  q.preimageManifestSha256===old.preimageManifestSha256,'READ_SCOPE_CHANGED');
 const limited=report?.status==='STATE_UNKNOWN'&&
  report.code==='READONLY_RESULT_PROTECTION_UNVERIFIED'&&report.workerOutcome?.status==='PASS';
 need(report?.schema==='ZGMINI_PC_RESULT_V1'&&(report.status==='PASS'||limited)&&
  report.requestId===q.requestId&&report.chatId===q.chatId&&report.operation===q.operation&&
  report.requestedSourceSha===q.sourceSha&&report.sourceRepository===q.sourceRepository&&
  report.sourceBranch===q.sourceBranch&&report.operationalWrites===0&&
  report.providerCalls===0&&report.d1Writes===0&&report.sqliteOpened===false&&
  report.result?.status==='PASS'&&report.result?.code===
    (limited?report.workerOutcome.code:report.code)&&
  Number.isInteger(report.seat)&&report.seat>=1&&report.seat<=6,'REPORT_SCOPE');
 need(limited?report.protectedStateUnchanged===null:
  report.protectedStateUnchanged===true,'PROTECTION_CLAIM');
 need(run?.status==='completed'&&run.conclusion==='success'&&run.run_attempt===1&&
  run.repository?.full_name===REPO&&run.actor?.login===OWNER&&run.event==='issues'&&
  run.name==='ZGMINI PC Job'&&
  report.jobId===`run-${run.id}-1-seat-${report.seat}`,'RUN_BINDING');
 const marker=`<!-- zgmini-pc-result:${run.id}:1:${report.seat} -->`;
 const bot=comments.filter(c=>c.user?.login==='github-actions[bot]'&&
  c.issue_url===`https://api.github.com/repos/${REPO}/issues/${evidence.number}`&&
  c.body?.startsWith(marker));
 need(bot.length===1,'PC_RECEIPT');
 const payload=bot[0].body.match(/```json\s*([\s\S]*?)```/);
 let embedded;try{embedded=JSON.parse(payload?.[1]);}catch{need(false,'PC_RECEIPT_JSON');}
 need(JSON.stringify(embedded)===JSON.stringify(report),'PC_RECEIPT_READBACK');
 need(typeof txt==='string'&&txt.includes(`requestId=${q.requestId}`)&&
  txt.includes(`jobId=${report.jobId}`)&&txt.includes(`status=${report.status}`),
  'TXT_READBACK');
 return [DIAGNOSIS_RECEIPT,`resultId: ${result.resultId}`,`incidentId: ${h.incidentId}`,
  `fingerprint: ${result.fingerprint}`,`originIssue: ${origin.number}`,
  `evidenceIssue: ${evidence.number}`,`requestId: ${q.requestId}`,`runId: ${run.id}`,
  `operation: ${q.operation}`,`code: ${report.result.code}`,
  `proof: ${limited?'READ_VERIFIED_PROTECTION_UNVERIFIED':'READ_AND_PROTECTION_VERIFIED'}`,
  'runtimeScope: FIXED_READONLY_QUERY_ONLY','incidentResolution: NOT_ASSERTED',
  'ownerChatReceived: UNKNOWN','operationalWrites: 0','automaticPcRetries: 0'].join('\n');
}
