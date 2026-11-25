import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectCiEvidence} from '../ci-approval/github-ci-evidence.mjs';
function fixtures(){
 const repo='ansqhd5774-Choi/zgmini-pc-control',head='a'.repeat(40),base='b'.repeat(40);
 const expected={runId:10,workflowId:20,prNumber:30,repositoryId:40,headSha:head,baseSha:base,workflowPath:'.github/workflows/pc-secret-scan.yml',jobName:'secret-scan',steps:['Scan','Lint']};
 const ref={id:40,full_name:repo,private:true};
 const run={id:10,workflow_id:20,path:expected.workflowPath,event:'pull_request',repository:ref,head_repository:ref,head_sha:head,run_attempt:1,status:'completed',conclusion:'success',pull_requests:[{number:30,head:{sha:head,repo:{id:40}},base:{sha:base,ref:'main',repo:{id:40}}}]};
 const job={id:50,name:'secret-scan',run_id:10,run_attempt:1,head_sha:head,status:'completed',conclusion:'success',labels:['self-hosted','Windows','X64','zgmini-handoff-ci-isolated'],steps:['Scan','Lint'].map(name=>({name,status:'completed',conclusion:'success'}))};
 const cases=[];const clone=x=>JSON.parse(JSON.stringify(x));
 const add=(name,edit,state)=>{const v=clone({expected,run,jobs:{total_count:1,jobs:[job]},last:null});edit(v);cases.push({name,v,state})};
 add('matching CI receipt',()=>{},'OBSERVED_CI_SUCCESS');
 add('queued run',v=>{v.run.status='queued';v.run.conclusion=null},'PENDING');
 add('failed run',v=>{v.run.conclusion='failure'},'REJECTED');
 add('wrong workflow',v=>{v.run.workflow_id=99},'REJECTED');
 add('wrong head',v=>{v.run.head_sha='c'.repeat(40)},'REJECTED');
 add('wrong base',v=>{v.run.pull_requests[0].base.sha='c'.repeat(40)},'REJECTED');
 add('wrong PR',v=>{v.run.pull_requests[0].number=31},'REJECTED');
 add('wrong repository',v=>{v.run.head_repository.id=99},'REJECTED');
 add('incomplete jobs',v=>{v.jobs.total_count=2},'EVIDENCE_MISSING');
 add('duplicate job',v=>{v.jobs.jobs.push(clone(v.jobs.jobs[0]));v.jobs.total_count=2},'REJECTED');
 add('wrong attempt',v=>{v.jobs.jobs[0].run_attempt=2},'REJECTED');
 add('wrong runner',v=>{v.jobs.jobs[0].labels=['self-hosted','Windows','X64','zgmini-pc-control']},'REJECTED');
 add('skipped step',v=>{v.jobs.jobs[0].steps[0].conclusion='skipped'},'REJECTED');
 add('missing step',v=>{v.jobs.jobs[0].steps.pop()},'REJECTED');
 add('duplicate step',v=>{v.jobs.jobs[0].steps.push(clone(v.jobs.jobs[0].steps[0]))},'REJECTED');
 add('rerun during observation',v=>{v.last={...v.run,run_attempt:2}},'EVIDENCE_MISSING');
 add('bad expected identity',v=>{v.expected.runId=0},'INVALID');
 return cases;
}
async function exercise(c,fn){let reads=0;return await fn(c.v.expected,async route=>route.includes('/jobs?')?c.v.jobs:(++reads===1?c.v.run:c.v.last??c.v.run))}
for(const c of fixtures())test(c.name,async()=>{const r=await exercise(c,collectCiEvidence);assert.equal(r.state,c.state);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);});
