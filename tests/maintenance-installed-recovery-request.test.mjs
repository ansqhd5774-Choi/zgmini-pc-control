import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
 createMaintenanceAgent,INSTALLED_RECOVERY_OPERATION,INSTALLED_RECOVERY_ISSUE_TITLE,
 INSTALLED_RECOVERY_ORIGINAL_ID,INSTALLED_RECOVERY_SOURCE_SHA,
 INSTALLED_RECOVERY_CONTROLLER_SHA,INSTALLED_RECOVERY_MANIFEST_PATH,
 W04_INSTALLED_RECOVERY_ORIGINAL_ID,W04_INSTALLED_RECOVERY_SOURCE_SHA,
 W04_INSTALLED_RECOVERY_CONTROLLER_SHA,
 W04_3516_RECOVERY_ORIGINAL_ID,W04_3516_RECOVERY_SOURCE_SHA,
 W04_3516_RECOVERY_CONTROLLER_SHA,verifyInstalledRecoveryLocalSource,
 prepareInstalledRecoveryRequest,validateInstalledRecoveryIssueEnvelope,
} from '../tools/maintenance-agent.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control',ACTOR='ansqhd5774-Choi';
const digest=b=>createHash('sha256').update(b).digest('hex');
const approved=(mutate=x=>x,which='legacy')=>{
 const w04=which==='w04',w043516=which==='w043516';
 const casKeys=['ledgerSha256','ownerSha256','markerSha256','backlogSha256',
  'snapshotSha256','protectionSha256','writerSha256'];
 const casDigests=Object.fromEntries(casKeys.map(k=>[k,'a'.repeat(64)]));
 const files=['tools/maintenance-recovery.mjs','tools/update.mjs',
  'tools/maintenance-contract.mjs','controller/fixed-readonly-bytes.mjs']
  .map(p=>({path:p,sha256:'b'.repeat(64)}));
 const payload={
  schema:'ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1',approved:true,
  operation:'RECONCILE_INSTALLED',
  requestId:w043516?W04_3516_RECOVERY_ORIGINAL_ID:w04?W04_INSTALLED_RECOVERY_ORIGINAL_ID:INSTALLED_RECOVERY_ORIGINAL_ID,
  issueNumber:w043516?3516:w04?3409:2960,
  sourceSha:w043516?W04_3516_RECOVERY_SOURCE_SHA:w04?W04_INSTALLED_RECOVERY_SOURCE_SHA:INSTALLED_RECOVERY_SOURCE_SHA,
  targetControllerSha:w043516?W04_3516_RECOVERY_CONTROLLER_SHA:w04?W04_INSTALLED_RECOVERY_CONTROLLER_SHA:INSTALLED_RECOVERY_CONTROLLER_SHA,
  approvedCurrentWriterConfigSha256:casDigests.writerSha256,
  files,casDigests,proof:{
   issueNumber:w043516?3528:w04?3438:2982,
   runId:w043516?45579963186:w04?45457196689:45186420113,
   jobId:w043516?139087219551:w04?138669741465:137733094098,
   runnerName:w043516?'zgmini-pc-03':w04?'zgmini-pc-03':'zgmini-pc-04',
   resultPath:w043516?'results/pc-process-inventory-45579963186-1-operating.json':
    w04?'results/45457196689-1-seat-3.json':'results/45186420113-1-seat-4.json',
   resultSha256:'c'.repeat(64),
  },
 };
 return Buffer.from(JSON.stringify(mutate(payload))+'\n');
};

test('fixed admission disallows original ID reuse, changed effect, target or actor',()=>{
 const raw=approved(),req=prepareInstalledRecoveryRequest(raw);
 assert.equal(req.operation,INSTALLED_RECOVERY_OPERATION);
 assert.equal(req.approvalManifestSha256,digest(raw));
 assert.equal(req.targetControllerSha,INSTALLED_RECOVERY_CONTROLLER_SHA);
 assert.notEqual(req.requestId,INSTALLED_RECOVERY_ORIGINAL_ID);
 const check=x=>validateInstalledRecoveryIssueEnvelope(x,{actor:ACTOR});
 assert.equal(check(req).requestId,req.requestId);
 for(const change of [
  {requestId:INSTALLED_RECOVERY_ORIGINAL_ID},
  {operation:'controller-update'},
  {targetControllerSha:'0'.repeat(40)},
  {unexpected:true},
 ])assert.throws(()=>check({...req,...change}));
 assert.throws(()=>validateInstalledRecoveryIssueEnvelope(req,{actor:'untrusted'}));
 assert.throws(()=>prepareInstalledRecoveryRequest(Buffer.from(JSON.stringify({
  ...JSON.parse(raw),approved:false
 }))));
});

function setup(t,{wrongApproval=false,throwAfterExec=false,approvalMutation=null,encodedMutation=null,
 which='legacy',sourceReady=true}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-installed-recovery-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const leaseRoot=path.join(root,'leases');fs.mkdirSync(leaseRoot);
 const manifest=approved(approvalMutation??(x=>x),which),request=prepareInstalledRecoveryRequest(manifest);
 const fixed=which==='w043516'?{
  originalId:W04_3516_RECOVERY_ORIGINAL_ID,sourceSha:W04_3516_RECOVERY_SOURCE_SHA,
  controllerSha:W04_3516_RECOVERY_CONTROLLER_SHA,
  path:'approvals/maintenance-recoveries/'+W04_3516_RECOVERY_ORIGINAL_ID+'.installed.json'
 }:which==='w04'?{
  originalId:W04_INSTALLED_RECOVERY_ORIGINAL_ID,sourceSha:W04_INSTALLED_RECOVERY_SOURCE_SHA,
  controllerSha:W04_INSTALLED_RECOVERY_CONTROLLER_SHA,
  path:'approvals/maintenance-recoveries/'+W04_INSTALLED_RECOVERY_ORIGINAL_ID+'.installed.json',
 }:{
  originalId:INSTALLED_RECOVERY_ORIGINAL_ID,sourceSha:INSTALLED_RECOVERY_SOURCE_SHA,
  controllerSha:INSTALLED_RECOVERY_CONTROLLER_SHA,path:INSTALLED_RECOVERY_MANIFEST_PATH,
 };
 const issue={number:4001,title:INSTALLED_RECOVERY_ISSUE_TITLE,state:'OPEN',
  body:JSON.stringify(request),author:{login:ACTOR},
  labels:[{name:'pc-maintenance'}],comments:[]};
 const remote=new Map(),calls=[],stats={recoveries:0,uploads:0};
 const fakeExec=async(file,args,opts)=>{
  calls.push({file,args,opts});
  assert.equal(opts.shell,false);
  if(file.endsWith('gh.exe')){
   if(args[0]==='repo'&&args[1]==='view')
    return {stdout:JSON.stringify({isPrivate:true,nameWithOwner:REPO})};
   if(args[0]==='issue'&&args[1]==='list')
    return {stdout:JSON.stringify([{number:issue.number,title:issue.title,updatedAt:'2026-11-24T00:00:00Z'}])};
   if(args[0]==='issue'&&args[1]==='view')
    return {stdout:JSON.stringify(issue)};
   if(args[0]==='issue'&&args[1]==='comment'){
    issue.comments.push({body:args[args.indexOf('--body')+1],author:{login:ACTOR}});
    return {stdout:''};
   }
   if(args[0]==='api'){
    const resource=args[1].split('?')[0];
    if(resource.endsWith('/'+fixed.path))
     return {stdout:JSON.stringify({type:'file',encoding:'base64',
      content:(encodedMutation??(x=>x))((wrongApproval?Buffer.from('{"approved":false}'):manifest).toString('base64'))})};
    assert.match(resource,/\/contents\/results\/maintenance-/);
    if(args.includes('--method')){
     stats.uploads++;
     const encoded=args.find(x=>x.startsWith('content=')).slice(8);
     remote.set(resource,Buffer.from(encoded,'base64'));
     return {stdout:JSON.stringify({content:{sha:digest(remote.get(resource))}})};
    }
    if(!remote.has(resource))throw Object.assign(Error('missing'),{code:'HTTP_404'});
    return {stdout:JSON.stringify({type:'file',encoding:'base64',
     content:remote.get(resource).toString('base64')})};
   }
   throw Error('unexpected GitHub call');
  }
  assert.equal(file,process.execPath);
  assert.equal(args[0],'E:/ZGmini/projects/zgmini-pc-control/tools/maintenance-recovery.mjs');
  assert.deepEqual(args.slice(1),['reconcile-installed','--request-id',
   fixed.originalId,'--source-sha',fixed.sourceSha]);
  assert.equal(opts.env.GITHUB_ACTIONS,undefined);
  assert.equal(opts.env.RUNNER_NAME,undefined);
  stats.recoveries++;
  if(throwAfterExec)throw Error('lost child response');
  return {stdout:JSON.stringify({
   status:'RECOVERED_INSTALLED_STATE',
   code:'INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN',
   requestId:fixed.originalId,
   installedSha:fixed.controllerSha,leaseArchived:true,
  })};
 };
 const agent=createMaintenanceAgent({stateDir:root,leaseRoot,execFileImpl:fakeExec,
  verifyInstalledSource:()=>{},verifyRecoverySource:()=>sourceReady});
 return {agent,issue,request,stats,calls,remote,root};
}

test('independent recovery reaches fixed Windows child exactly once and publishes receipt',async t=>{
 const f=setup(t);
 const first=await f.agent.pollOnce();
 assert.equal(first[0].status,'SUCCEEDED',JSON.stringify(first));
 assert.equal(f.stats.recoveries,1);
 const ledger=f.agent.loadLedger(f.request.requestId);
 assert.equal(ledger.result.code,'INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN');
 assert.equal(ledger.reportUploadStatus,'VERIFIED');
 assert.equal(f.stats.uploads,2);
 await f.agent.pollOnce();
 assert.equal(f.stats.recoveries,1);
});

test('approval drift blocks before lease claim or any recovery child',async t=>{
 const f=setup(t,{wrongApproval:true});
 const results=await f.agent.pollOnce();
 assert.equal(results[0].status,'BLOCKED');
 assert.equal(f.stats.recoveries,0);
 assert.equal(f.agent.loadLedger(f.request.requestId),null);
});

test('lost child response stays UNKNOWN and does not auto-replay',async t=>{
 const f=setup(t,{throwAfterExec:true});
 const first=await f.agent.pollOnce();
 assert.equal(first[0].status,'UNKNOWN');
 assert.equal(f.stats.recoveries,1);
 await f.agent.pollOnce();
 assert.equal(f.stats.recoveries,1);
 assert.equal(f.agent.loadLedger(f.request.requestId).status,'UNKNOWN');
});

test('a second request ID cannot repeat a recovered effect',async t=>{
 const f=setup(t);
 await f.agent.processIssue(f.issue);
 const secondRequest=prepareInstalledRecoveryRequest(approved());
 const second={...f.issue,number:4002,body:JSON.stringify(secondRequest),comments:[]};
 const other=await f.agent.processIssue(second);
 assert.equal(other.status,'BLOCKED');
 assert.equal(other.code,'INSTALLED_RECOVERY_EFFECT_CLAIM_UNAVAILABLE');
 assert.equal(f.stats.recoveries,1);
});

test('incomplete but correctly hashed approval is rejected before the one-shot claim',async t=>{
 for(const mutate of [
  x=>({...x,casDigests:{...x.casDigests,ownerSha256:undefined}}),
  x=>({...x,files:x.files.slice(1)}),
  x=>({...x,approvedCurrentWriterConfigSha256:'d'.repeat(64)}),
  x=>({...x,proof:{...x.proof,runId:123}}),
 ]){
  await t.test('invalid structural scope',async t2=>{
   const f=setup(t2,{approvalMutation:mutate});
   const result=await f.agent.pollOnce();
   assert.equal(result[0].status,'BLOCKED',JSON.stringify(result));
   assert.equal(result[0].code,'INSTALLED_RECOVERY_APPROVAL_SCOPE_INVALID');
   assert.equal(f.stats.recoveries,0);
   assert.equal(f.agent.loadLedger(f.request.requestId),null);
  });
 }
});

test('W04 exact approval routes to the existing independent recovery child once',async t=>{
 const f=setup(t,{which:'w04'});
 const first=await f.agent.pollOnce();
 assert.equal(first[0].status,'SUCCEEDED',JSON.stringify(first));
 assert.equal(f.stats.recoveries,1);
 assert.equal(first[0].originalRequestId,W04_INSTALLED_RECOVERY_ORIGINAL_ID);
 assert.equal(f.agent.loadLedger(f.request.requestId).result.status,'SUCCEEDED');
 await f.agent.pollOnce();assert.equal(f.stats.recoveries,1);
});

test('W04 source absent prevents one-shot claim and leaves retryable block',async t=>{
 const f=setup(t,{which:'w04',sourceReady:false});
 const result=await f.agent.pollOnce();
 assert.equal(result[0].status,'BLOCKED');
 assert.equal(result[0].code,'INSTALLED_RECOVERY_LOCAL_SOURCE_UNAVAILABLE');
 assert.equal(result[0].executionStarted,false);
 assert.equal(f.stats.recoveries,0);
 assert.equal(f.agent.loadLedger(f.request.requestId),null);
 const files=fs.readdirSync(path.join(f.root,'requests'));
 assert.equal(files.some(v=>v.startsWith('effect-')),false);
});

test('W04 changed proof is rejected before operator source preclaim',async t=>{
 const f=setup(t,{which:'w04',
  approvalMutation:x=>({...x,proof:{...x.proof,runId:45186420113}})});
 const result=await f.agent.pollOnce();
 assert.equal(result[0].code,'INSTALLED_RECOVERY_APPROVAL_SCOPE_INVALID');
 assert.equal(f.stats.recoveries,0);
});

test('W04 approval cannot impersonate the legacy fixed case',()=>{
 const raw=JSON.parse(approved(x=>x,'w04'));
 for(const mutated of [
  {...raw,sourceSha:INSTALLED_RECOVERY_SOURCE_SHA},
  {...raw,requestId:INSTALLED_RECOVERY_ORIGINAL_ID},
  {...raw,issueNumber:2960},
 ]){
  assert.throws(()=>prepareInstalledRecoveryRequest(Buffer.from(JSON.stringify(mutated))));
 }
});

test('source preclaim checks exact local file bytes and git ancestor without writes',()=>{
 const content=Buffer.from('pinned-tool');
 const hash=digest(content), fixed={sourceSha:W04_INSTALLED_RECOVERY_SOURCE_SHA};
 const manifest={files:[{path:'tools/maintenance-recovery.mjs',sha256:hash}]};
 const calls=[];
 const inspect=opts=>verifyInstalledRecoveryLocalSource(fixed,manifest,{
  readFile:()=>content,lstat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:content.length}),
  git:args=>{calls.push(args);
   if(args.includes('merge-base'))return Buffer.alloc(0);
   if(args.includes('show'))return opts?.badBlob?Buffer.from('other'):content;
   throw Error('UNEXPECTED_GIT');
  },
 });
 assert.equal(inspect(),true);
 assert.equal(calls.length,2);
 assert.equal(calls[0].includes('--is-ancestor'),true);
 assert.equal(inspect({badBlob:true}),false);
 assert.equal(verifyInstalledRecoveryLocalSource(fixed,manifest,{
  readFile:()=>Buffer.from('drift'),
  lstat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:5}),
  git:()=>{throw Error('SHOULD_NOT_RUN_GIT');},
 }),false);
});

test('GitHub API base64 corruption is blocked even when permissive decoding would match approved bytes',async t=>{
 const f=setup(t,{encodedMutation:encoded=>encoded.slice(0,8)+'?'+encoded.slice(8)});
 const result=await f.agent.pollOnce();
 assert.equal(result[0].status,'BLOCKED',JSON.stringify(result));
 assert.equal(result[0].code,'INSTALLED_RECOVERY_APPROVAL_INVALID');
 assert.equal(f.stats.recoveries,0);
 assert.equal(f.agent.loadLedger(f.request.requestId),null);
});

test('GitHub API line-wrapped base64 remains valid under strict decoding',async t=>{
 const f=setup(t,{encodedMutation:encoded=>encoded.match(/.{1,65}/g).join('\n')});
 const result=await f.agent.pollOnce();
 assert.equal(result[0].status,'SUCCEEDED',JSON.stringify(result));
 assert.equal(f.stats.recoveries,1);
});

test('#3516 is admitted only with exact approved manifest and independent A scope',async t=>{
 const f=setup(t,{which:'w043516'});
 const before=await f.agent.pollOnce();
 assert.equal(before[0].status,'SUCCEEDED',JSON.stringify(before));
 assert.equal(f.stats.recoveries,1);
 assert.equal(before[0].originalRequestId,W04_3516_RECOVERY_ORIGINAL_ID);
 await f.agent.pollOnce();
 assert.equal(f.stats.recoveries,1);
});

test('#3516 cannot substitute unrelated A proof, CAS or stale source',async t=>{
 for(const mutation of [
  x=>({...x,proof:{...x.proof,runId:45457196689}}),
  x=>({...x,proof:{...x.proof,issueNumber:3438}}),
  x=>({...x,casDigests:{...x.casDigests,writerSha256:'d'.repeat(64)}}),
 ])await t.test('manifest fails before one-shot claim',async t2=>{
  const f=setup(t2,{which:'w043516',approvalMutation:mutation});
  const out=await f.agent.pollOnce();
  assert.equal(out[0].status,'BLOCKED');
  assert.equal(out[0].code,'INSTALLED_RECOVERY_APPROVAL_SCOPE_INVALID');
  assert.equal(f.stats.recoveries,0);
  assert.equal(f.agent.loadLedger(f.request.requestId),null);
 });
 for(const mutation of [
  x=>({...x,sourceSha:W04_INSTALLED_RECOVERY_SOURCE_SHA}),
  x=>({...x,requestId:W04_INSTALLED_RECOVERY_ORIGINAL_ID}),
  x=>({...x,targetControllerSha:W04_INSTALLED_RECOVERY_CONTROLLER_SHA}),
 ])assert.throws(()=>prepareInstalledRecoveryRequest(approved(mutation,'w043516')));
 const absent=setup(t,{which:'w043516',sourceReady:false});
 const result=await absent.agent.pollOnce();
 assert.equal(result[0].status,'BLOCKED');
 assert.equal(result[0].code,'INSTALLED_RECOVERY_LOCAL_SOURCE_UNAVAILABLE');
 assert.equal(absent.stats.recoveries,0);
 assert.equal(absent.agent.loadLedger(absent.request.requestId),null);
});

test('#3516 never shares the prior #3409 recovery effect identifier',()=>{
 assert.notEqual(W04_3516_RECOVERY_ORIGINAL_ID,W04_INSTALLED_RECOVERY_ORIGINAL_ID);
 assert.notEqual(W04_3516_RECOVERY_SOURCE_SHA,W04_INSTALLED_RECOVERY_SOURCE_SHA);
 assert.notEqual(W04_3516_RECOVERY_CONTROLLER_SHA,W04_INSTALLED_RECOVERY_CONTROLLER_SHA);
 assert.equal(W04_3516_RECOVERY_SOURCE_SHA,'a730a06305810b15a197925c07746757da60ad52');
});
