import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../controller/common.mjs';
import {RECOVERY,validateTrigger,verifyRetainedOriginal,
  verifyInstalledRuntime,recoverOriginal} from '../controller/report-recovery-3650-once.mjs';

const policy={controlRepository:RECOVERY.repository,maxReportBytes:32768};
const env={GITHUB_REPOSITORY:RECOVERY.repository,GITHUB_EVENT_NAME:'issue_comment',
  GITHUB_ACTOR:RECOVERY.actor,GITHUB_RUN_ID:'987654321',
  GITHUB_RUN_ATTEMPT:'1',RUNNER_NAME:'zgmini-pc-06'};
const event={action:'created',repository:{private:true,full_name:RECOVERY.repository},
  issue:{number:3650,user:{login:RECOVERY.actor}},
  comment:{user:{login:RECOVERY.actor},body:RECOVERY.trigger}};
const request={schema:'ZGMINI_PC_JOB_V1',requestId:RECOVERY.requestId,
  chatId:RECOVERY.chatId,
  operation:RECOVERY.operation,sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'main',sourceSha:RECOVERY.sourceSha};
const json=(file,obj)=>fs.writeFileSync(file,JSON.stringify(obj,null,2)+'\n');
const expectedText=report=>Object.entries(report)
  .filter(([k])=>!['result','prior'].includes(k))
  .map(([k,v])=>`${k}=${typeof v==='object'?JSON.stringify(v):v}`)
  .join('\r\n')+'\r\n';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-3650-recovery-'));
  for(const dir of ['jobs','reports','ledger','leases'])fs.mkdirSync(path.join(root,dir));
  const ws=path.join(root,'jobs',RECOVERY.jobId);
  fs.mkdirSync(ws);
  const result={status:'PASS',code:RECOVERY.resultCode,
    worker:'zgmini-migration-candidate-r5',domain:'zgmini.kr',
    deploymentIdentityVerified:true,domainVerified:true,
    expectedBuildVersionActive:false,sourceShaVerified:false,
    providerCalls:0,operationalWrites:0,d1Writes:0};
  const report={schema:'ZGMINI_PC_RESULT_V1',jobId:RECOVERY.jobId,
    requestId:RECOVERY.requestId,chatId:RECOVERY.chatId,
    operation:RECOVERY.operation,seat:6,
    status:'PASS',code:RECOVERY.resultCode,firstFail:null,
    lastPass:'ALLOWLISTED_OPERATION_COMPLETED',
    controlRepository:RECOVERY.repository,
    sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',
    requestedSourceSha:RECOVERY.sourceSha,
    actualExecutionSha:RECOVERY.originalExecutionSha,
    controlSourceSha:RECOVERY.originalExecutionSha,
    protectedStateUnchanged:true,reused:false,
    providerCalls:0,operationalWrites:0,d1Writes:0,
    result,finishedAt:'2026-11-06T17:31:00.000Z'};
  const files={
    pointer:path.join(root,'reports',`${RECOVERY.runId}-${RECOVERY.attempt}-${RECOVERY.seat}.json`),
    input:path.join(ws,'input.json'),
    worker:path.join(ws,'worker-result.json'),
    result:path.join(ws,'RESULT.json'),
    txt:path.join(ws,'RESULT.txt'),
    ledger:path.join(root,'ledger',RECOVERY.requestId+'.json')};
  json(files.pointer,{issueNumber:3650,report,workspace:ws,file:files.result});
  json(files.input,{request,context:{workspace:ws}});
  json(files.worker,result);
  json(files.result,report);
  fs.writeFileSync(files.txt,expectedText(report));
  json(files.ledger,{payloadSha:digest(JSON.stringify(request)),report});
  return {root,report,files,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

function fakeGithub({ambiguousPost=false}={}){
  const remote=new Map(),comments=[],calls=[];
  async function api(route,method='GET',body){
    calls.push({route,method});
    if(route===`issues/${RECOVERY.issueNumber}`&&method==='GET')
      return {status:200,data:{number:3650,user:{login:RECOVERY.actor},
        labels:[{name:'pc-job'}],body:JSON.stringify(request)}};
    if(route.startsWith(`issues/${RECOVERY.issueNumber}/comments?`))
      return {status:200,data:comments};
    if(route===`issues/${RECOVERY.issueNumber}/comments`&&method==='POST'){
      comments.push({user:{login:'github-actions[bot]'},body:body.body});
      if(ambiguousPost)throw new Error('SIMULATED_POST_TIMEOUT');
      return {status:201,data:{}};
    }
    if(route.startsWith('contents/results/')){
      if(method==='GET'){
        if(!remote.has(route))return {status:404,data:{}};
        return {status:200,data:{type:'file',encoding:'base64',
          content:remote.get(route).toString('base64')}};
      }
      if(method==='PUT'){
        remote.set(route,Buffer.from(body.content,'base64'));
        return {status:201,data:{}};
      }
    }
    throw new Error('UNEXPECTED_API_CALL '+method+' '+route);
  }
  return {api,remote,comments,calls};
}

const run=(f,g,options={})=>recoverOriginal({root:f.root,policy,event,env,api:g.api,...options});
const puts=g=>g.calls.filter(c=>c.method==='PUT');
const posts=g=>g.calls.filter(c=>c.method==='POST');

test('trigger author/repository/comment/issue/current run provenance strictly gated',()=>{
  validateTrigger(event,env);
  assert.throws(()=>validateTrigger({...event,issue:{...event.issue,number:3651}},env),
    {code:'RECOVERY_TRIGGER_DENIED'});
  assert.throws(()=>validateTrigger({...event,comment:{user:{login:'attacker'},body:RECOVERY.trigger}},env),
    {code:'RECOVERY_TRIGGER_DENIED'});
  assert.throws(()=>validateTrigger({...event,comment:{...event.comment,body:' /zgmini-recover-3650-once'}},env),
    {code:'RECOVERY_TRIGGER_DENIED'});
  assert.throws(()=>validateTrigger({...event,issue:{...event.issue,pull_request:{}}},env),
    {code:'RECOVERY_TRIGGER_DENIED'});
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_ACTOR:'github-actions[bot]'}),
    {code:'RECOVERY_EVENT_DENIED'});
  assert.throws(()=>validateTrigger(event,{...env,GITHUB_RUN_ID:RECOVERY.runId+'!' }),
    {code:'RECOVERY_RUN_ID_INVALID'});
});

test('original retained pointer, exact ledger and workspace PASS are proven',t=>{
  const f=fixture();t.after(f.cleanup);
  assert.deepEqual(verifyRetainedOriginal(f.root),f.report);
});

test('genuine first delivery uploads exactly two files and one bot comment; keeps originals',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  const result=await run(f,g);
  assert.deepEqual(result,{status:'DELIVERY_RECOVERED',originalRunId:RECOVERY.runId,
    originalIssueNumber:3650,resultFiles:2,providerCalls:0,workerExecutions:0});
  assert.equal(puts(g).length,2);
  assert.equal(posts(g).length,1);
  assert.equal(g.comments[0].user.login,'github-actions[bot]');
  assert.ok(fs.existsSync(f.files.pointer));
  assert.ok(fs.existsSync(f.files.ledger));
  assert.ok(fs.existsSync(f.files.result));
  assert.ok(g.calls.every(c=>c.route.startsWith('issues/')||c.route.startsWith('contents/results/')));
});

test('second attempt is idempotent: GET only and no new POST or PUT',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  await run(f,g);g.calls.length=0;
  assert.equal((await run(f,g)).status,'ALREADY_RECOVERED');
  assert.equal(puts(g).length,0);assert.equal(posts(g).length,0);
});

test('partial remote pair sends only missing TXT, leaves existing original JSON',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  await run(f,g);
  const missing=`contents/results/${RECOVERY.runId}-${RECOVERY.attempt}-seat-${RECOVERY.seat}.txt`;
  g.remote.delete(missing);g.comments.length=0;g.calls.length=0;
  assert.equal((await run(f,g)).status,'DELIVERY_RECOVERED');
  assert.deepEqual(puts(g).map(x=>x.route),[missing]);
  assert.equal(posts(g).length,1);
});

test('conflicting remote bytes fail closed without overwrite or comment',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  const jsonRoute=`contents/results/${RECOVERY.runId}-${RECOVERY.attempt}-seat-${RECOVERY.seat}.json`;
  g.remote.set(jsonRoute,Buffer.from('{"altered":true}\n'));
  await assert.rejects(run(f,g),{code:'REPORT_REMOTE_CONTENT_CHANGED'});
  assert.equal(puts(g).length,0);assert.equal(posts(g).length,0);
  assert.ok(fs.existsSync(f.files.pointer));
});

test('existing conflicting marker blocks before any GitHub result write',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  g.comments.push({user:{login:'github-actions[bot]'},body:RECOVERY.commentMarker+'\nWRONG'});
  await assert.rejects(run(f,g),{code:'RECOVERY_COMMENT_CONFLICT'});
  assert.equal(puts(g).length,0);assert.equal(posts(g).length,0);
});

test('ambiguous successful POST is confirmed by readback; no duplicate POST',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub({ambiguousPost:true});
  assert.equal((await run(f,g)).status,'DELIVERY_RECOVERED');
  assert.equal(posts(g).length,1);
});

test('a failed comment POST with no matching readback is outcome unknown and does not retry',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  const wrapped=async(route,method='GET',body)=>{
    if(method==='POST'){
      g.calls.push({route,method});
      throw new Error('SIMULATED_FAILED_POST');
    }
    return g.api(route,method,body);
  };
  await assert.rejects(recoverOriginal({root:f.root,policy,event,env,api:wrapped}),
    {code:'RECOVERY_COMMENT_OUTCOME_UNKNOWN'});
  assert.equal(posts(g).length,1);
  assert.ok(fs.existsSync(f.files.pointer));
});

test('missing pointer fails before any remote call',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  fs.unlinkSync(f.files.pointer);
  await assert.rejects(run(f,g),{code:'RECOVERY_FILE_MISSING'});
  assert.equal(g.calls.length,0);
});

test('ledger tampering or mismatched original status blocks before remote calls',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  const ledger=JSON.parse(fs.readFileSync(f.files.ledger,'utf8'));
  ledger.payloadSha='f'.repeat(64);json(f.files.ledger,ledger);
  await assert.rejects(run(f,g),{code:'RECOVERY_LEDGER_MISMATCH'});
  assert.equal(g.calls.length,0);
});

test('unexpected workspace entry and reparse/symlink do not pass',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  fs.writeFileSync(path.join(path.dirname(f.files.result),'extra.txt'),'bad');
  await assert.rejects(run(f,g),{code:'RECOVERY_WORKSPACE_UNEXPECTED'});
  fs.unlinkSync(path.join(path.dirname(f.files.result),'extra.txt'));
  const real=path.join(f.root,'reports','backup-result.json');
  fs.renameSync(f.files.result,real);
  // Even when Windows denies creating a symlink fixture, the missing original
  // RESULT.json must fail closed before any GitHub call.
  await assert.rejects(run(f,g),{code:'RECOVERY_WORKSPACE_UNEXPECTED'});
  try{
    fs.symlinkSync(real,f.files.result,'file');
  }catch(error){
    if(process.platform==='win32'&&error?.code==='EPERM'){
      t.diagnostic('Windows runner denied symlink fixture; missing-result guard verified');
      assert.equal(g.calls.length,0);
      return;
    }
    throw error;
  }
  await assert.rejects(run(f,g),{code:'RECOVERY_FILE_UNSAFE_FILE'});
  assert.equal(g.calls.length,0);
});

test('size overflow and report output with secret-named fields fail before remote write',async t=>{
  const f=fixture();t.after(f.cleanup);const g=fakeGithub();
  await assert.rejects(recoverOriginal({root:f.root,policy:{...policy,maxReportBytes:20},
    event,env,api:g.api}),{code:'REPORT_SIZE'});
  assert.equal(g.calls.length,0);
  // Recreate consistent local report, ledger and workspace; unsafe named key
  // is detected even though the metadata and A status are valid.
  f.report.result.accessToken='hidden';
  json(f.files.result,f.report);json(f.files.worker,f.report.result);
  json(f.files.pointer,{issueNumber:3650,report:f.report,
    workspace:path.dirname(f.files.result),file:f.files.result});
  fs.writeFileSync(f.files.txt,expectedText(f.report));
  await assert.rejects(run(f,g),{code:'RECOVERY_OUTPUT_UNSAFE'});
  assert.equal(g.calls.length,0);
});

test('source pinning rejects scratch execution; synthetic installed contract validates exact hash',t=>{
  const f=fixture();t.after(f.cleanup);
  assert.throws(()=>verifyInstalledRuntime({root:f.root}),{code:'RECOVERY_NOT_INSTALLED'});
  for(const dir of ['controller','config'])fs.mkdirSync(path.join(f.root,dir));
  const source=path.join(f.root,'controller','report-recovery-3650-once.mjs');
  fs.writeFileSync(source,'// fixture pinned source\n');
  json(path.join(f.root,'host.json'),{controllerFiles:{
    'controller/report-recovery-3650-once.mjs':digest(fs.readFileSync(source))}});
  json(path.join(f.root,'config','operations.json'),policy);
  assert.deepEqual(verifyInstalledRuntime({root:f.root,scriptPath:source}),{policy});
  fs.appendFileSync(source,'// tamper\n');
  assert.throws(()=>verifyInstalledRuntime({root:f.root,scriptPath:source}),
    {code:'RECOVERY_SOURCE_DRIFT'});
});


test('one-time #3650 recovery workflow is owner-only, original issue-only and upload-only',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/pc-report-recovery-3650-once.yml',import.meta.url),'utf8');
  assert.match(workflow,/issue_comment:/);
  assert.match(workflow,/github\.event\.repository\.private == true/);
  assert.match(workflow,/github\.actor == 'ansqhd5774-Choi'/);
  assert.match(workflow,/github\.event\.issue\.number == 3650/);
  assert.match(workflow,/github\.event\.issue\.pull_request == null/);
  assert.match(workflow,/github\.event\.comment\.user\.login == 'ansqhd5774-Choi'/);
  assert.match(workflow,/github\.event\.comment\.body == '\/zgmini-recover-3650-once'/);
  assert.match(workflow,/controller\\report-recovery-3650-once\.mjs/);
  assert.doesNotMatch(workflow,/controller\\entry\.mjs/);
  assert.doesNotMatch(workflow,/schedule:|workflow_dispatch:/);
  assert.match(workflow,/cancel-in-progress: false/);
  assert.equal(RECOVERY.issueNumber,3650);
});
