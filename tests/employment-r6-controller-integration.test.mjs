import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {runOperation} from '../controller/operations.mjs';
import {executeJob} from '../controller/engine.mjs';
import {validateRequest} from '../controller/common.mjs';
import {renderBoundedReport,uploadVerifiedReportPair} from '../controller/report-upload-verified.mjs';
import {validatePublicationRequest} from '../tools/publication-contract.mjs';

const SHA='a'.repeat(40),CONTROL_SHA='b'.repeat(40);
const ENTRY='scripts/pc-writer/employment-r6-runner-stage.mjs';
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const childSource=`import fs from 'node:fs';import path from 'node:path';
const a=process.argv.slice(2),val=x=>a[a.indexOf(x)+1];
const output=val('--output-dir');
fs.writeFileSync(path.join(output,'EMPLOYMENT_R6_RUNNER_fixture.json'),JSON.stringify({
 kind:'EMPLOYMENT_R6_RUNNER_READONLY_REPORT_V1',status:'PASS',
 code:'EMPLOYMENT_R6_READONLY_STAGE_COMPLETED',sqliteOpened:true,
 providerCalls:0,d1Writes:0,promotionApproved:false,publicationStatus:'NOT_REQUESTED',
 summary:{sourceFeatures:29},pit:{coreCurrentKeysMissingHistory:1},
 indicators:Array.from({length:29},(_,i)=>({id:'FEATURE_'+i,rawStatus:'READY',
  chartStatus:'READY',scoreStatus:'READY'})),
 bodyDigest:'c'.repeat(64),walPreflight:{coreWalMode:false}
}));`;

function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-integration-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const dataRoot=path.join(root,'data'),bundle=path.join(root,'bundle');
 const core=path.join(dataRoot,'pc-writer','storage','core.sqlite');
 const candidate=path.join(root,'candidate','EMPLOYMENT_R6_CANDIDATE.sqlite');
 const entry=path.join(bundle,'source',ENTRY);
 for(const p of [core,candidate,entry])fs.mkdirSync(path.dirname(p),{recursive:true});
 fs.writeFileSync(core,'synthetic only');fs.writeFileSync(candidate,'synthetic candidate');
 fs.writeFileSync(entry,childSource);
 const files={[ENTRY]:digest(Buffer.from(childSource))};
 const manifest=Buffer.from(JSON.stringify({files})+'\n');
 fs.writeFileSync(path.join(bundle,'manifest.json'),manifest);
 const host={dataRoot,controllerSourceSha:CONTROL_SHA,employmentR6CandidatePath:candidate,
  approvedSources:{[SHA]:{root:bundle,branch:'codex/employment-1y-reader-r1',
   entrypoint:ENTRY,manifestSha256:digest(manifest)}}};
 const policy={schema:'ZGMINI_PC_OPERATIONS_V1',controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  sourceRepository:'ansqhd5774-Choi/zgmini',allowedActors:['ansqhd5774-Choi'],seats:6,
  mutationsEnabled:false,maxAutomaticRetries:0,maxHeavyJobs:1,minimumFreeMiBForHeavy:1,
  operations:{'employment-r6-candidate-stage-readonly':{grade:'A',resource:'heavy',timeoutSeconds:20,minimumFreeMiB:1}}};
 const request={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-00000000-0000-4000-8000-000000000001',
  chatId:'chat-00000000-0000-4000-8000-000000000001',
  operation:'employment-r6-candidate-stage-readonly',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'codex/employment-1y-reader-r1',sourceSha:SHA};
 return {root,dataRoot,host,policy,request,core,candidate};
}

test('new operation uses approved host paths and projects only bounded R6 summary',async t=>{
 const f=setup(t),workspace=path.join(f.root,'run');fs.mkdirSync(workspace);
 const r=await runOperation(f.request,{...f,workspace});
 assert.equal(r.status,'PASS');
 assert.equal(r.actualExecutionSha,SHA);
 assert.equal(r.summary.sourceFeatures,29);
 assert.equal(r.sqliteOpened,true);
 assert.equal(JSON.stringify(r).includes('synthetic candidate'),false);
 assert.equal(fs.readFileSync(f.core,'utf8'),'synthetic only');
 assert.equal(fs.readFileSync(f.candidate,'utf8'),'synthetic candidate');
});

test('engine distinguishes Controller SHA from actually executed R6 bundle SHA',async t=>{
 const f=setup(t),out=await executeJob(f.request,{root:f.root,host:f.host,policy:f.policy,
  seat:1,runId:'4151000',queryTask:()=>Buffer.from('fixture task XML')});
 assert.equal(out.report.status,'PASS');
 assert.equal(out.report.controlSourceSha,CONTROL_SHA);
 assert.equal(out.report.actualExecutionSha,SHA);
 assert.equal(out.report.sqliteOpened,true);
 assert.equal(out.report.protectedStateUnchanged,true);
 assert.equal(out.report.operationalWrites,0);
});

test('unapproved SHA is BLOCKED without falsely claiming Controller SHA executed',async t=>{
 const f=setup(t),bad={...f.request,sourceSha:'d'.repeat(40)};
 const out=await executeJob(bad,{root:f.root,host:f.host,policy:f.policy,
  seat:2,runId:'4151001',queryTask:()=>Buffer.from('fixture task XML')});
 assert.equal(out.report.status,'BLOCKED');
 assert.equal(out.report.code,'R6_BUNDLE_NOT_APPROVED');
 assert.equal(out.report.controlSourceSha,CONTROL_SHA);
 assert.equal(out.report.actualExecutionSha,null);
 assert.equal(out.report.sqliteOpened,false);
 assert.equal(out.report.protectedStateUnchanged,true);
});


test('isolated issue admission to Controller/Writer result reaches exact JSON/TXT receipt, not D1',async t=>{
 const f=setup(t),runId='4151002',attempt='1',seat='3';
 const issue={number:9201,user:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-job'}],body:JSON.stringify(f.request)};
 assert.equal(issue.user.login,'ansqhd5774-Choi');
 assert.ok(issue.labels.some(label=>label.name==='pc-job'));
 const admitted=validateRequest(JSON.parse(issue.body),f.policy);
 const outcome=await executeJob(admitted,{root:f.root,host:f.host,policy:f.policy,
  seat:Number(seat),runId,attempt,queryTask:()=>Buffer.from('fixture task XML')});
 assert.equal(outcome.report.status,'PASS');
 assert.equal(outcome.report.actualExecutionSha,SHA);
 assert.equal(outcome.report.controlSourceSha,CONTROL_SHA);
 assert.equal(outcome.report.protectedStateUnchanged,true);
 assert.equal(outcome.report.operationalWrites,0);
 assert.equal(outcome.report.providerCalls,0);
 assert.equal(outcome.report.d1Writes,0);
 assert.equal(fs.readFileSync(f.core,'utf8'),'synthetic only');
 assert.equal(fs.readFileSync(f.candidate,'utf8'),'synthetic candidate');
 const pointer=JSON.parse(fs.readFileSync(outcome.file,'utf8'));
 assert.equal(pointer.jobId,`run-${runId}-1-seat-${seat}`);
 const {json,txt}=renderBoundedReport(pointer,32768);
 const remote=new Map(),calls=[];
 const api=async(route,method='GET',body)=>{
  calls.push({route,method});
  if(method==='PUT'){
   remote.set(route,Buffer.from(body.content,'base64'));
   return {status:201,data:{}};
  }
  if(!remote.has(route))return {status:404,data:{}};
  return {status:200,data:{type:'file',encoding:'base64',
   content:remote.get(route).toString('base64')}};
 };
 const opts={api,repository:'ansqhd5774-Choi/zgmini-pc-control',
  runId,attempt,seat,json,txt,wait:async()=>{}};
 const links=await uploadVerifiedReportPair(opts);
 assert.equal(links.length,2);
 const resultBase=`contents/results/${runId}-${attempt}-seat-${seat}`;
 assert.equal(remote.get(resultBase+'.json').toString('utf8'),json);
 assert.equal(remote.get(resultBase+'.txt').toString('utf8'),txt);
 assert.equal(JSON.parse(json).actualExecutionSha,SHA);
 assert.equal(calls.filter(call=>call.method==='PUT').length,2);
 assert.equal(calls.filter(call=>call.method==='GET').length,4);
 await uploadVerifiedReportPair(opts);
 assert.equal(calls.filter(call=>call.method==='PUT').length,2,
  'repeated receipt must not cause a new write');
 assert.throws(()=>validatePublicationRequest(issue.body,{
  actor:'ansqhd5774-Choi',repository:'ansqhd5774-Choi/zgmini-pc-control',
  privateRepository:true,eventName:'issues',eventAction:'opened',
  labels:['pc-job']}),/PUBLICATION_EVENT_NOT_AUTHORIZED/,
  'an A request must not be accepted as an approved D1 publication');
});
test('blocked unapproved source preserves no-write receipt and refuses conflicting remote bytes',async t=>{
 const f=setup(t),runId='4151003',seat='4',request={...f.request,sourceSha:'d'.repeat(40)};
 const out=await executeJob(validateRequest(request,f.policy),{
  root:f.root,host:f.host,policy:f.policy,seat:Number(seat),runId,
  queryTask:()=>Buffer.from('fixture task XML')});
 assert.equal(out.report.status,'BLOCKED');
 assert.equal(out.report.code,'R6_BUNDLE_NOT_APPROVED');
 assert.equal(out.report.actualExecutionSha,null);
 assert.equal(out.report.operationalWrites,0);
 assert.equal(out.report.d1Writes,0);
 assert.equal(out.report.protectedStateUnchanged,true);
 const {json,txt}=renderBoundedReport(out.report,32768);
 const key=`contents/results/${runId}-1-seat-${seat}.json`;
 const operations=[];
 const api=async(route,method='GET')=>{
  operations.push({route,method});
  return route===key?{status:200,data:{type:'file',encoding:'base64',
   content:Buffer.from('different receipt').toString('base64')}}:
   {status:404,data:{}};
 };
 await assert.rejects(uploadVerifiedReportPair({api,
  repository:'ansqhd5774-Choi/zgmini-pc-control',
  runId,attempt:'1',seat,json,txt,wait:async()=>{}}),
 {code:'REPORT_REMOTE_CONTENT_CHANGED'});
 assert.equal(operations.some(call=>call.method==='PUT'),false);
 assert.equal(fs.readFileSync(f.core,'utf8'),'synthetic only');
 assert.equal(fs.readFileSync(f.candidate,'utf8'),'synthetic candidate');
});
