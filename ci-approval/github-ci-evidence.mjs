// Read-only evidence collection. Caller-provided expected identity is not a trust root.
// No publish or execution capability. Requires a separately verified trusted read adapter.
// A receipt does not verify executed checkout bytes, trusted workflow source, or business authorization.
export async function collectCiEvidence(expected,get){
 const repo='ansqhd5774-Choi/zgmini-pc-control';
 const result=(state,reason,details={})=>({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...details});
 const id=x=>Number.isSafeInteger(x)&&x>0;
 const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
 const name=x=>typeof x==='string'&&x.length>0&&x.length<=180;
 if(!expected||!id(expected.runId)||!id(expected.workflowId)||!id(expected.prNumber)||!id(expected.repositoryId)||
 !sha(expected.headSha)||!sha(expected.baseSha)||!/^\.github\/workflows\/[a-z0-9-]+\.yml$/.test(expected.workflowPath??'')||
 !name(expected.jobName)||!Array.isArray(expected.steps)||!expected.steps.length||expected.steps.length>30||
 !expected.steps.every(name)||new Set(expected.steps).size!==expected.steps.length)return result('INVALID','EXPECTED_IDENTITY_INVALID');
 if(typeof get!=='function')return result('EVIDENCE_MISSING','READ_ADAPTER_MISSING');
 const route='actions/runs/'+expected.runId;
 const match=r=>r?.id===expected.runId&&r.workflow_id===expected.workflowId&&r.path===expected.workflowPath&&
 r.event==='pull_request'&&r.repository?.full_name===repo&&r.repository?.private===true&&r.repository?.id===expected.repositoryId&&
 r.head_repository?.full_name===repo&&r.head_repository?.id===expected.repositoryId&&r.head_sha===expected.headSha&&
 id(r.run_attempt)&&Array.isArray(r.pull_requests)&&r.pull_requests.length===1&&r.pull_requests[0]?.number===expected.prNumber&&
 r.pull_requests[0]?.head?.sha===expected.headSha&&r.pull_requests[0]?.base?.sha===expected.baseSha&&
 r.pull_requests[0]?.base?.ref==='main'&&r.pull_requests[0]?.head?.repo?.id===expected.repositoryId&&r.pull_requests[0]?.base?.repo?.id===expected.repositoryId;
 try{
 const run=await get(route);
 if(!match(run))return result('REJECTED','RUN_IDENTITY_MISMATCH');
 if(run.status!=='completed')return result('PENDING','RUN_NOT_COMPLETED');
 if(run.conclusion!=='success')return result('REJECTED','RUN_NOT_SUCCESS');
 const jobs=await get(route+'/attempts/'+run.run_attempt+'/jobs?per_page=100');
 if(!Array.isArray(jobs?.jobs)||!id(jobs.total_count)||jobs.total_count>100||jobs.jobs.length!==jobs.total_count)return result('EVIDENCE_MISSING','JOBS_INCOMPLETE');
 const hits=jobs.jobs.filter(j=>j?.name===expected.jobName);
 if(hits.length!==1)return result('REJECTED','JOB_IDENTITY_AMBIGUOUS');
 const j=hits[0];
 if(!id(j.id)||j.run_id!==run.id||j.run_attempt!==run.run_attempt||j.head_sha!==expected.headSha||j.status!=='completed'||j.conclusion!=='success'||
 !Array.isArray(j.labels)||!['self-hosted','Windows','X64','zgmini-handoff-ci-isolated'].every(x=>j.labels.includes(x)))return result('REJECTED','JOB_IDENTITY_OR_RESULT_MISMATCH');
 if(!Array.isArray(j.steps)||!expected.steps.every(n=>{const s=j.steps.filter(x=>x?.name===n);return s.length===1&&s[0].status==='completed'&&s[0].conclusion==='success'}))return result('REJECTED','REQUIRED_STEP_NOT_SUCCESS');
 const last=await get(route);
 if(!match(last)||last.run_attempt!==run.run_attempt||last.status!=='completed'||last.conclusion!=='success')return result('EVIDENCE_MISSING','RUN_CHANGED_DURING_READ');
 return result('OBSERVED_CI_SUCCESS','RUN_JOB_STEPS_MATCH',{runId:run.id,attempt:run.run_attempt,jobId:j.id,headSha:run.head_sha,workflowId:run.workflow_id,prNumber:expected.prNumber});
 }catch{return result('EVIDENCE_MISSING','GITHUB_READ_FAILED')}
}
