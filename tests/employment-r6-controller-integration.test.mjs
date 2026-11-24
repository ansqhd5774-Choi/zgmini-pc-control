import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {runOperation} from '../controller/operations.mjs';
import {executeJob} from '../controller/engine.mjs';

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
