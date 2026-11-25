// Observe the tested integration tree, not mutable PR association metadata.
// Caller must separately establish trusted read provenance and workflow pin.
// This module neither authenticates business approval nor grants execution.
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const repo='ansqhd5774-Choi/zgmini-pc-control';
const workflow='.github/workflows/controller-maintenance-source-tests.yml';
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
export function inspectIntegrationTree({expected,run,job,logs,commit,workflowBlobSha}={}){
 if(!expected||!id(expected.runId)||!id(expected.jobId)||!id(expected.attempt)||!sha(expected.headSha)||!sha(expected.baseSha)||!sha(expected.workflowBlobSha))
  return out('INVALID','EXPECTED_IDENTITY_INVALID');
 if(run?.id!==expected.runId||run.run_attempt!==expected.attempt||run.head_sha!==expected.headSha||run.path!==workflow||run.event!=='pull_request'||run.repository?.full_name!==repo||run.status!=='completed'||run.conclusion!=='success')
  return out('REJECTED','RUN_IDENTITY_OR_RESULT_MISMATCH');
 if(job?.id!==expected.jobId||job.run_id!==run.id||job.run_attempt!==expected.attempt||job.head_sha!==expected.headSha||job.name!=='source-only'||job.status!=='completed'||job.conclusion!=='success')
  return out('REJECTED','JOB_IDENTITY_OR_RESULT_MISMATCH');
 if(!Array.isArray(job.steps)||!['Confirm source-only isolated CI host','Check CI scope selection regressions'].every(name=>{const hits=job.steps.filter(s=>s?.name===name);return hits.length===1&&hits[0].status==='completed'&&hits[0].conclusion==='success'}))
  return out('REJECTED','REQUIRED_STEP_NOT_SUCCESS');
 if(typeof logs!=='string'||logs.length===0||logs.length>16000000)return out('EVIDENCE_MISSING','JOB_LOGS_MISSING');
 const marker=[],checkout=[];
 for(const line of logs.split(/\r?\n/)){
  const m=line.match(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z CI_TESTED_INTEGRATION_SHA=([a-f0-9]{40})$/);
  if(m)marker.push(m[1]);
  const c=line.match(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z \[command\].*\bcheckout --progress --force ([a-f0-9]{40})$/);
  if(c)checkout.push(c[1]);
 }
 if(marker.length!==1||checkout.length!==1||marker[0]!==checkout[0])return out('REJECTED','CHECKOUT_MARKER_MISMATCH');
 const tested=marker[0];
 if(commit?.sha!==tested||!sha(commit.tree?.sha)||!Array.isArray(commit.parents)||commit.parents.length!==2||commit.parents[0]?.sha!==expected.baseSha||commit.parents[1]?.sha!==expected.headSha)
  return out('REJECTED','INTEGRATION_PARENT_MISMATCH');
 if(workflowBlobSha!==expected.workflowBlobSha)return out('REJECTED','WORKFLOW_PIN_MISMATCH');
 return out('INTEGRATION_TREE_MATCH_ONLY','NOT_AUTHORITY_OR_CURRENTNESS',{runId:run.id,jobId:job.id,attempt:expected.attempt,testedSha:tested,treeSha:commit.tree.sha,baseSha:expected.baseSha,headSha:expected.headSha,workflowBlobSha});
}
