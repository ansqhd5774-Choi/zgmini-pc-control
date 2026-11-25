import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {classifyMaintenancePostcheckLink as classify,
 summarizeMaintenancePostcheckLocalPointer as localPointer} from '../tools/maintenance-contract.mjs';

const id='pc-update-11111111-1111-4111-8111-111111111111';
const source='a'.repeat(40);
const created='2026-11-25T01:00:00Z';
const issue=()=>({number:42,title:`PC Update ${id} postcheck`,
 user:{login:'ansqhd5774-Choi'},created_at:created,
 labels:[{name:'pc-job'}],
 body:JSON.stringify({schema:'ZGMINI_PC_JOB_V1',
  requestId:id+'-postcheck',chatId:'chat-test',operation:'core-status',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha:source})});
const run=(overrides={})=>({id:777,event:'issues',name:'ZGMINI PC Job',
 display_title:`PC Update ${id} postcheck`,created_at:'2026-11-25T01:00:02Z',
 status:'completed',conclusion:'success',...overrides});
const job=(overrides={})=>({id:888,run_id:777,name:'approved-pc-job',
 status:'completed',conclusion:'success',steps:[
  {name:'Execute fixed host allowlist entry',conclusion:'success'},
  {name:'Upload sanitized TXT JSON and issue result',conclusion:'success'}],
 ...overrides});
const obs=(overrides={})=>({requestId:id,issueNumber:42,operation:'core-status',
 sourceBranch:'main',sourceSha:source,issue:issue(),runs:[run()],jobs:[job()],...overrides});
const result=(arg)=>classify(obs(arg));

test('no Run is observed as NO_RUN, not failed installation or synthetic PASS',()=>{
 assert.equal(result({runs:[],jobs:null}).state,'NO_RUN');
 assert.equal(result({runs:[],jobs:null}).next,'CHECK_EVENT_AND_WORKFLOW_CONTRACT_NO_REPOST');
});

test('a nonmatching Run or a Run predating the Issue is never attached',()=>{
 for(const r of [run({display_title:'same title for another request'}),
  run({event:'push'}),run({created_at:'2026-11-24T23:59:59Z'})]){
  assert.equal(result({runs:[r],jobs:null}).state,'NO_RUN');
 }
 assert.equal(result({runs:[run(),run({id:999})],jobs:null}).code,
  'POSTCHECK_RUN_IDENTITY_AMBIGUOUS');
});

test('unverified Issue identity never produces NO_RUN',()=>{
 const changed=issue();changed.body=JSON.stringify({...JSON.parse(changed.body),sourceSha:'b'.repeat(40)});
 assert.equal(result({issue:changed,runs:[]}).state,'STATE_UNKNOWN');
 assert.equal(result({issue:{...issue(),labels:[]},runs:[]}).state,'STATE_UNKNOWN');
 assert.equal(result({runs:null}).state,'STATE_UNKNOWN');
 assert.equal(result({sourceBranch:'wrong-branch',runs:[]}).state,'STATE_UNKNOWN');
});

test('Run gate skipped, Runner queue, and active job stay separate',()=>{
 assert.equal(result({runs:[run({status:'queued',conclusion:null})],jobs:null}).state,'RUNNER_QUEUE');
 assert.equal(result({jobs:[job({status:'queued',conclusion:null})]}).state,'RUNNER_QUEUE');
 assert.equal(result({jobs:[job({status:'in_progress',conclusion:null})]}).state,'RUNNING');
 assert.equal(result({jobs:[job({status:'completed',conclusion:'skipped'})]}).state,'SKIPPED_GATE');
});

test('entry step failure is not mislabeled upload-only failure',()=>{
 assert.equal(result({jobs:[job({conclusion:'failure',steps:[
  {name:'Execute fixed host allowlist entry',conclusion:'failure'}]})]}).state,
 'ENTRY_REJECT');
});

test('successful entry without receipt is UPLOAD_MISSING; do not rerun',()=>{
 const v=result({});
 assert.equal(v.state,'UPLOAD_MISSING');
 assert.equal(v.next,'RECOVER_EXISTING_LOCAL_RECEIPT_NO_REEXECUTION');
 assert.equal(v.runId,777);
 assert.equal(v.jobId,888);
});

test('missing or wrong job evidence is unknown, not fabricated success',()=>{
 assert.equal(result({jobs:null}).state,'STATE_UNKNOWN');
 assert.equal(result({jobs:[job({name:'other-job'})]}).state,'STATE_UNKNOWN');
 assert.equal(result({jobs:[job({run_id:999})]}).state,'STATE_UNKNOWN');
});

test('real updater persists exact Issue link through coordinator failure phase',()=>{
 const src=fs.readFileSync(fileURLToPath(new URL('../tools/update.mjs',import.meta.url)),'utf8');
 assert.match(src,/labels:\['pc-job'\]/);
 assert.match(src,/postcheckCreationAttempted:true/);
 assert.match(src,/postIssueNumber,postcheckLink:/);
 assert.match(src,/postcheckLink=prior\?\.postcheckLink\?\.requestId===request\.requestId/);
 assert.match(src,/classifyMaintenancePostcheckLink\(\{/);
 assert.match(src,/\{maxPages:3\}/);
 assert.match(src,/verifiedRunningPostcheckFailure\(\{/);
 assert.match(src,/state:'RESULT_REPORTED',code:'POSTCHECK_BOT_RESULT_OBSERVED'/);
});

test('workflow late-label branch stays opt-in and matches source entry contract',()=>{
 const workflow=fs.readFileSync(fileURLToPath(new URL('../.github/workflows/pc-job.yml',import.meta.url)),'utf8');
 const entry=fs.readFileSync(fileURLToPath(new URL('../controller/entry.mjs',import.meta.url)),'utf8');
 assert.match(workflow,/types: \[opened, labeled\]/);
 assert.match(workflow,/vars\.ZGMINI_PC_JOB_LATE_LABEL_ENABLED == 'true'/);
 assert.match(entry,/event\.action==='opened'/);
 assert.match(entry,/event\.action==='labeled'/);
 assert.match(entry,/event\.label\?\.name==='pc-job'/);
});

test('existing local pointer is correlated to exact postcheck run, source and Controller',()=>{
 const args={requestId:id,issueNumber:42,runId:777,attempt:1,seat:3,
  operation:'core-status',sourceBranch:'main',sourceSha:source,controllerSha:'b'.repeat(40)};
 const pointer={issueNumber:42,report:{schema:'ZGMINI_PC_RESULT_V1',
  jobId:'run-777-1-seat-3',requestId:id+'-postcheck',operation:'core-status',
  sourceBranch:'main',requestedSourceSha:source,controlSourceSha:'b'.repeat(40),
  status:'PASS',code:'CORE_READONLY_DIAGNOSIS',result:{private:'do not transmit'}}};
 const result=localPointer({...args,pointer});
 assert.deepEqual(result,{status:'LOCAL_RESULT_MATCHED',
  code:'POSTCHECK_EXISTING_LOCAL_RESULT_MATCHED',
  resultStatus:'PASS',resultCode:'CORE_READONLY_DIAGNOSIS'});
 assert.equal(JSON.stringify(result).includes('private'),false);
 for(const changed of [
  {...pointer,issueNumber:43},
  {...pointer,report:{...pointer.report,jobId:'run-778-1-seat-3'}},
  {...pointer,report:{...pointer.report,sourceBranch:'other'}},
  {...pointer,report:{...pointer.report,requestedSourceSha:'c'.repeat(40)}},
  {...pointer,report:{...pointer.report,controlSourceSha:'d'.repeat(40)}},
  {...pointer,report:{...pointer.report,status:'SYNTHETIC_PASS'}},
  null
 ])assert.equal(localPointer({...args,pointer:changed}).status,'LOCAL_RESULT_UNVERIFIED');
});

test('postcheck local report readback remains bounded and never triggers another job',()=>{
 const src=fs.readFileSync(fileURLToPath(new URL('../tools/update.mjs',import.meta.url)),'utf8');
 assert.match(src,/controlRoot,'reports'/);
 assert.match(src,/stat\.isFile\(\)&&!stat\.isSymbolicLink\(\)&&stat\.nlink===1/);
 assert.match(src,/stat\.size>0&&stat\.size<=131072/);
 assert.match(src,/summarizeMaintenancePostcheckLocalPointer\(\{/);
 assert.match(src,/VERIFY_AND_UPLOAD_EXISTING_RESULT_NO_REEXECUTION/);
});
