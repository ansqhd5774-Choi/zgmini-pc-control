import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectIntegrationTree as inspect} from '../ci-approval/integration-tree-evidence.mjs';
function fixture(){
 const head='a'.repeat(40),base='b'.repeat(40),tested='c'.repeat(40),blob='d'.repeat(40);
 const expected={runId:10,jobId:20,attempt:1,headSha:head,baseSha:base,workflowBlobSha:blob};
 const run={id:10,run_attempt:1,head_sha:head,path:'.github/workflows/controller-maintenance-source-tests.yml',event:'pull_request',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control'},status:'completed',conclusion:'success',pull_requests:[{head:{sha:'f'.repeat(40)},base:{sha:'f'.repeat(40)}}]};
 const job={id:20,run_id:10,run_attempt:1,head_sha:head,name:'source-only',status:'completed',conclusion:'success',steps:['Confirm source-only isolated CI host','Check CI scope selection regressions'].map(name=>({name,status:'completed',conclusion:'success'}))};
 const logs='2026-11-25T10:46:26.0962993Z [command]"C:\\Program Files\\Git\\cmd\\git.exe" checkout --progress --force '+tested+'\r\n2026-11-25T10:46:31.3494614Z CI_TESTED_INTEGRATION_SHA='+tested+'\r\n';
 const commit={sha:tested,tree:{sha:'e'.repeat(40)},parents:[{sha:base},{sha:head}]};
 return {expected,run,job,logs,commit,workflowBlobSha:blob};
}
const cases=[
 ['historical association metadata is not checkout proof',()=>{},'INTEGRATION_TREE_MATCH_ONLY'],
 ['wrong run head',v=>{v.run.head_sha='f'.repeat(40)},'REJECTED'],
 ['run failure',v=>{v.run.conclusion='failure'},'REJECTED'],
 ['wrong attempt',v=>{v.job.run_attempt=2},'REJECTED'],
 ['skipped isolation step',v=>{v.job.steps[0].conclusion='skipped'},'REJECTED'],
 ['missing logs',v=>{v.logs=''},'EVIDENCE_MISSING'],
 ['duplicate marker',v=>{v.logs+=v.logs.split('\r\n')[1]+'\n'},'REJECTED'],
 ['checkout mismatch',v=>{v.logs=v.logs.replace('force '+'c'.repeat(40),'force '+'f'.repeat(40))},'REJECTED'],
 ['wrong tested commit',v=>{v.commit.sha='f'.repeat(40)},'REJECTED'],
 ['wrong base parent',v=>{v.commit.parents[0].sha='f'.repeat(40)},'REJECTED'],
 ['wrong head parent',v=>{v.commit.parents[1].sha='f'.repeat(40)},'REJECTED'],
 ['workflow changed',v=>{v.workflowBlobSha='f'.repeat(40)},'REJECTED'],
 ['missing pin',v=>{delete v.expected.workflowBlobSha},'INVALID']
];
for(const [name,edit,state] of cases)test(name,()=>{const v=fixture();edit(v);const r=inspect(v);assert.equal(r.state,state);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);});
