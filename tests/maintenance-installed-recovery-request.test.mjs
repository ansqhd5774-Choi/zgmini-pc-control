import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createMaintenanceAgent} from '../tools/maintenance-agent.mjs';
import {
 INSTALLED_RECOVERY_OPERATION,INSTALLED_RECOVERY_ISSUE_TITLE,
 INSTALLED_RECOVERY_ORIGINAL_ID,INSTALLED_RECOVERY_SOURCE_SHA,
 INSTALLED_RECOVERY_CONTROLLER_SHA,INSTALLED_RECOVERY_MANIFEST_PATH,
 prepareInstalledRecoveryRequest,validateInstalledRecoveryIssueEnvelope,
} from '../tools/maintenance-contract.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control',ACTOR='ansqhd5774-Choi';
const digest=b=>createHash('sha256').update(b).digest('hex');
const approved=()=>Buffer.from(JSON.stringify({
 schema:'ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1',approved:true,
 operation:'RECONCILE_INSTALLED',requestId:INSTALLED_RECOVERY_ORIGINAL_ID,
 issueNumber:2960,sourceSha:INSTALLED_RECOVERY_SOURCE_SHA,
 targetControllerSha:INSTALLED_RECOVERY_CONTROLLER_SHA,
})+'\n');

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

function setup(t,{wrongApproval=false,throwAfterExec=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-installed-recovery-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const leaseRoot=path.join(root,'leases');fs.mkdirSync(leaseRoot);
 const manifest=approved(),request=prepareInstalledRecoveryRequest(manifest);
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
    if(resource.endsWith('/'+INSTALLED_RECOVERY_MANIFEST_PATH))
     return {stdout:JSON.stringify({type:'file',encoding:'base64',
      content:(wrongApproval?Buffer.from('{"approved":false}'):manifest).toString('base64')})};
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
   INSTALLED_RECOVERY_ORIGINAL_ID,'--source-sha',INSTALLED_RECOVERY_SOURCE_SHA]);
  assert.equal(opts.env.GITHUB_ACTIONS,undefined);
  assert.equal(opts.env.RUNNER_NAME,undefined);
  stats.recoveries++;
  if(throwAfterExec)throw Error('lost child response');
  return {stdout:JSON.stringify({
   status:'RECOVERED_INSTALLED_STATE',
   code:'INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN',
   requestId:INSTALLED_RECOVERY_ORIGINAL_ID,
   installedSha:INSTALLED_RECOVERY_CONTROLLER_SHA,leaseArchived:true,
  })};
 };
 const agent=createMaintenanceAgent({stateDir:root,leaseRoot,execFileImpl:fakeExec,
  verifyInstalledSource:()=>{}});
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
