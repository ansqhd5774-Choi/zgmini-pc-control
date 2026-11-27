import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {classifyMaintenancePostcheckLink as classify,
 selectMaintenancePostcheckRun as select,
 summarizeMaintenancePostcheckLocalPointer as localPointer,
 summarizeMaintenancePublicPostcheckLedger as publicLedger,
 classifyMaintenancePostcheckWorkflowRegistration as registration} from '../tools/maintenance-contract.mjs';

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
  run({event:'push'}),run({created_at:'2026-11-24T23:59:59Z'}),
  run({created_at:'2026-11-25T01:15:01Z'})]){
  assert.equal(result({runs:[r],jobs:null}).state,'NO_RUN');
 }
 assert.equal(result({runs:[run(),run({id:999})],jobs:null}).code,
  'POSTCHECK_RUN_IDENTITY_AMBIGUOUS');
});

test('paired opened/labeled Runs select only the unique non-skipped Run',()=>{
 const active=run({status:'completed',conclusion:'success'});
 const skipped=run({id:778,created_at:'2026-11-25T01:00:03Z',
  status:'completed',conclusion:'skipped'});
 assert.equal(select([active,skipped])?.id,777);
 assert.equal(select([skipped,active])?.id,777);
 assert.equal(result({runs:[active,skipped],jobs:[job()]}).state,'UPLOAD_MISSING');
 assert.equal(result({runs:[skipped,active],jobs:[job()]}).runId,777);
 // When the actionable Run is the second event, its own Job must be selected.
 const later=run({id:779,created_at:'2026-11-25T01:00:04Z'});
 assert.equal(result({runs:[skipped,later],jobs:[job({id:889,run_id:779})]}).runId,779);
 assert.equal(result({runs:[skipped,run({id:779,status:'queued',conclusion:null})],jobs:null}).state,
  'RUNNER_QUEUE');
});

test('paired executable or unverifiable Runs remain ambiguous and never authorize replay',()=>{
 assert.equal(select([run(),run({id:999})]),null);
 assert.equal(select([run({status:'completed',conclusion:'skipped'}),
  run({id:999,status:'completed',conclusion:'skipped'})]),null);
 assert.equal(result({runs:[run(),run({id:999})],jobs:[job()]}).code,
  'POSTCHECK_RUN_IDENTITY_AMBIGUOUS');
 assert.equal(result({runs:[run(),run({id:999}),run({id:1000})],jobs:[job()]}).state,
  'STATE_UNKNOWN');
 assert.equal(select([run({id:0})]),null);
 assert.equal(result({runs:[],jobs:null}).state,'NO_RUN');
 const src=fs.readFileSync(fileURLToPath(new URL('../tools/update.mjs',import.meta.url)),'utf8');
 assert.match(src,/const selected=selectMaintenancePostcheckRun\(linkedRuns\)/);
});

test('run at exactly existing 15-minute provenance boundary remains eligible',()=>{
 assert.equal(result({runs:[run({created_at:'2026-11-25T01:15:00Z'})]}).runId,777);
});

test('GitHub lookup is bounded by the same original postcheck provenance window',()=>{
 const src=fs.readFileSync(fileURLToPath(new URL('../tools/update.mjs',import.meta.url)),'utf8');
 assert.match(src,/const untilAt=openedAt\+900000/);
 assert.match(src,/encodeURIComponent\(window\)/);
 assert.doesNotMatch(src,/encodeURIComponent\('>='\+liveIssue\.created_at\)/);
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
 const common=fs.readFileSync(fileURLToPath(new URL('../controller/common.mjs',import.meta.url)),'utf8');
 assert.match(workflow,/types: \[opened, labeled\]/);
 assert.match(workflow,/vars\.ZGMINI_PC_JOB_LATE_LABEL_ENABLED == 'true'/);
 // Since Public owner identity was centralized in attestOwnerPcJobEvent,
 // verify the active entry calls the shared authorization, not stale inline text.
 assert.match(entry,/attestOwnerPcJobEvent\(event,process\.env,policy\)/);
 assert.match(common,/event\.action==='opened'/);
 assert.match(common,/event\.action==='labeled'&&event\.label\?\.name==='pc-job'/);
 assert.match(common,/event\.issue\.user\.id===ownerId/);
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

test('NO_RUN workflow registration distinguishes active, disabled and unverifiable',()=>{
 const workflow={id:128,name:'ZGMINI PC Job',
  path:'.github/workflows/pc-job.yml',state:'active'};
 assert.deepEqual(registration(workflow),{
  schema:'ZGMINI_POSTCHECK_WORKFLOW_REGISTRATION_V1',
  workflowState:'ACTIVE',code:'POSTCHECK_WORKFLOW_ACTIVE_WITHOUT_RUN',
  workflowId:128});
 assert.equal(registration({...workflow,state:'disabled_manually'}).workflowState,
  'DISABLED');
 assert.equal(registration({...workflow,state:'disabled_inactivity'}).workflowState,
  'DISABLED');
 for(const w of [null,{}, {...workflow,id:0},
   {...workflow,path:'.github/workflows/other.yml'},
   {...workflow,name:'Unrelated Workflow'},
   {...workflow,state:'deleted'}]){
  const observed=registration(w);
  assert.equal(observed.workflowState,'UNVERIFIED');
  assert.equal(observed.workflowId,null);
 }
});

test('updater reads registration only after NO_RUN and preserves original execution semantics',()=>{
 const src=fs.readFileSync(fileURLToPath(new URL('../tools/update.mjs',import.meta.url)),'utf8');
 const classifyAt=src.indexOf('const link=classifyMaintenancePostcheckLink({');
 const onlyNoRun=src.indexOf("if(link.state==='NO_RUN'){",classifyAt);
 const workflowLookup=src.indexOf("github('actions/workflows/pc-job.yml')",onlyNoRun);
 const localReceiptAt=src.indexOf("if(['ENTRY_REJECT','UPLOAD_MISSING'].includes",workflowLookup);
 assert.ok(classifyAt>=0&&onlyNoRun>classifyAt&&workflowLookup>onlyNoRun&&
  localReceiptAt>workflowLookup);
 assert.match(src,/classifyMaintenancePostcheckWorkflowRegistration\(registration\)/);
 assert.match(src,/Object\.entries\(prior\)\.filter\(\(\[key\]\)=>key!=='observedAtUtc'\)/);
 assert.match(src,/JSON\.stringify\(comparable\)!==JSON\.stringify\(link\)/);
 // Read-only observation must not activate late-label intake or replay the job.
 const block=src.slice(onlyNoRun,localReceiptAt);
 assert.doesNotMatch(block,/issues','POST'|workflow_dispatch|PATCH|repost|resumeIntake/);
});

test('early bot receipt links only its exact completed Run/Job identity',()=>{
 const report={schema:'ZGMINI_PC_RESULT_V1',jobId:'run-777-1-seat-2',
  requestId:id+'-postcheck',operation:'core-status',
  sourceBranch:'main',requestedSourceSha:source,controlSourceSha:'b'.repeat(40),
  status:'PASS',code:'CORE_READONLY_DIAGNOSIS'};
 const params={pointer:{issueNumber:42,report},requestId:id,issueNumber:42,
  runId:777,attempt:1,seat:2,operation:'core-status',
  sourceBranch:'main',sourceSha:source,controllerSha:'b'.repeat(40)};
 assert.equal(localPointer(params).status,'LOCAL_RESULT_MATCHED');
 for(const changed of [
  {...params,runId:778},{...params,attempt:2},{...params,seat:3},
  {...params,issueNumber:43},{...params,controllerSha:'c'.repeat(40)},
  {...params,pointer:{issueNumber:42,report:{...report,requestedSourceSha:'c'.repeat(40)}}},
  {...params,pointer:{issueNumber:42,report:{...report,jobId:'run-778-1-seat-2'}}},
 ])assert.equal(localPointer(changed).status,'LOCAL_RESULT_UNVERIFIED');
});

test('postcheck result publication makes one bounded read-only Run/Job receipt correlation',()=>{
 const src=fs.readFileSync(fileURLToPath(new URL('../tools/update.mjs',import.meta.url)),'utf8');
 const helper=src.indexOf('const lookupPostcheckRunAndJobs=()=>{');
 const comment=src.indexOf('let reportedRunJobLinked=false,reportedRunId=null,reportedJobId=null');
 const periodic=src.indexOf('if(n%5===0){',comment);
 assert.ok(helper>0&&comment>helper&&periodic>comment);
 const block=src.slice(comment,src.indexOf('const current=json(ledgerFile);',comment));
 assert.match(block,/lookupPostcheckRunAndJobs\(\)/);
 assert.match(block,/\['UPLOAD_MISSING','RUNNING'\]\.includes\(linked\.state\)/);
 assert.match(block,/runner_name\?\.match\(\/\^zgmini-pc-0/);
 assert.match(block,/pointer:\{issueNumber:postIssueNumber,report:result\}/);
 assert.match(block,/proof\.status==='LOCAL_RESULT_MATCHED'/);
 assert.doesNotMatch(block,/issues','POST'|workflow_dispatch|resumeIntake|repost/);
 const written=src.slice(src.indexOf('const current=json(ledgerFile);',comment),
  src.indexOf('return {status:result.status',comment));
 assert.match(written,/reportedRunJobLinked,/);
 assert.match(written,/runId:reportedRunJobLinked\?reportedRunId:/);
 assert.match(written,/jobId:reportedRunJobLinked\?reportedJobId:/);
 assert.match(src,/const untilAt=openedAt\+900000/);
 assert.match(src,/maxPages:3/);
});


test('public A postcheck binds one runnable fixed Job and ignores skipped Private-only Job',()=>{
 const legacy=job({status:'completed',conclusion:'skipped'});
 const pub=job({id:889,name:'public-approved-a',status:'completed',conclusion:'success'});
 const both=result({jobs:[legacy,pub]});
 assert.equal(both.state,'UPLOAD_MISSING');
 assert.equal(both.runId,777);
 assert.equal(both.jobId,889);
 assert.equal(result({jobs:[legacy]}).state,'SKIPPED_GATE');
 assert.equal(result({jobs:[pub]}).jobId,889);
 assert.equal(result({jobs:[job(),pub]}).code,'POSTCHECK_JOB_IDENTITY_UNVERIFIED');
 assert.equal(result({jobs:[pub,{...pub,id:890}]}).code,'POSTCHECK_JOB_IDENTITY_UNVERIFIED');
 const pending=job({id:891,name:'public-approved-a',status:'in_progress',conclusion:null});
 assert.equal(result({jobs:[legacy,pending]}).state,'RUNNING');
 assert.equal(result({jobs:[legacy,pending]}).jobId,891);
});

test('public summary is accepted only with exact protected full-result ledger and verified execution lineage',()=>{
 const controllerSha='b'.repeat(40),reportId='run-777-1-seat-3';
 const originalIssue=issue(),request=JSON.parse(originalIssue.body);
 const report={schema:'ZGMINI_PC_RESULT_V1',jobId:reportId,
  requestId:id+'-postcheck',operation:'core-status',seat:3,
  sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'main',requestedSourceSha:source,
  controlSourceSha:controllerSha,actualExecutionSha:controllerSha,
  status:'PASS',code:'CORE_READONLY_DIAGNOSIS',firstFail:null,
  protectedStateUnchanged:true,reused:false,
  result:{secret:'must remain on operating PC'}};
 const safe={schema:'ZGMINI_PC_RESULT_V1',jobId:reportId,
  requestId:id+'-postcheck',operation:'core-status',seat:3,
  status:'PASS',code:'PUBLIC_RESULT_CODE_REDACTED',
  actualExecutionSha:controllerSha,
  reportTransfer:{status:'SUMMARY_ONLY',code:'PUBLIC_REPOSITORY_REDACTED'}};
 const ledger={payloadSha:createHash('sha256').update(JSON.stringify(request)).digest('hex'),report};
 const params={publicReport:safe,ledger,issueBody:originalIssue.body,
  requestId:id,issueNumber:42,runId:777,attempt:1,seat:3,
  operation:'core-status',sourceBranch:'main',sourceSha:source,controllerSha};
 const ok=publicLedger(params);
 assert.deepEqual(ok,{status:'LOCAL_RESULT_MATCHED',
  code:'POSTCHECK_PUBLIC_LEDGER_AND_SAFE_RECEIPT_VERIFIED',
  postSourceVerified:true,actualExecutionSha:controllerSha});
 assert.equal(JSON.stringify(ok).includes('secret'),false);
 for(const mutate of [
  p=>p.ledger.report.controlSourceSha='d'.repeat(40),
  p=>p.ledger.report.requestedSourceSha='d'.repeat(40),
  p=>p.ledger.report.sourceRepository='attacker/repository',
  p=>p.ledger.report.actualExecutionSha='d'.repeat(40),
  p=>p.ledger.report.reused=true,
  p=>p.ledger.report.protectedStateUnchanged=false,
  p=>p.ledger.report.firstFail='INCOMPLETE',
  p=>p.ledger.report.status='FAIL',
  p=>p.ledger.payloadSha='0'.repeat(64),
  p=>p.publicReport.actualExecutionSha='d'.repeat(40),
  p=>p.publicReport.code='CORE_READONLY_DIAGNOSIS',
  p=>p.publicReport.status='FAIL',
  p=>p.publicReport.reportTransfer.status='FULL_PRIVATE',
  p=>p.publicReport.secret='not safe',
  p=>p.seat=2,
  p=>p.runId=778,
  p=>p.issueBody=JSON.stringify({...request,sourceSha:'d'.repeat(40)}),
 ]){
  const altered=structuredClone(params);mutate(altered);
  assert.equal(publicLedger(altered).status,'LOCAL_RESULT_UNVERIFIED');
  assert.equal(publicLedger(altered).postSourceVerified,false);
 }
});

test('installed Public postcheck code cannot promote redacted bot receipt without local ledger',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL('../tools/update.mjs',import.meta.url)),'utf8');
 assert.match(source,/summarizeMaintenancePublicPostcheckLedger\(\{/);
 assert.match(source,/ledgerPath=path\.join\(controlRoot,'ledger',issue\.requestId\+'-postcheck\.json'\)/);
 assert.match(source,/stat\.isFile\(\)&&!stat\.isSymbolicLink\(\)&&stat\.nlink===1/);
 assert.match(source,/if\(publicSafeReceipt&&!publicLocalAttested\)continue/);
 assert.match(source,/\['approved-pc-job','public-approved-a'\]\.includes\(j\.name\)/);
 assert.match(source,/if\(proof\.status==='LOCAL_RESULT_MATCHED'\)/);
 assert.doesNotMatch(source,/console\.log\(JSON\.stringify\(localLedger\)\)/);
});
