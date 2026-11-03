import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createMaintenanceAgent} from '../tools/maintenance-agent.mjs';
import {windowsSafePathKey} from '../tools/apply-r6-host-overlay-b.mjs';
import {
  validateR6HostIssueEnvelope,
  validateR6HostRegistrationRequest,
  R6_HOST_OPERATION,
  R6_HOST_SCHEMA,
  R6_HOST_SCOPE,
  R6_HOST_SOURCE_SHA,
  R6_HOST_SOURCE_MANIFEST_SHA256,
  R6_HOST_CANDIDATE_SHA256,
} from '../tools/maintenance-contract.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const CONTROLLER='a00020684a8986780db29390aeb7b85a6e2640ab';
const REQUEST_ID='pc-6b15c8c9-7d01-4f7e-a872-f25bc78a9164';
const CHAT_ID='chat-9d4d2a15-82e7-4ec4-aa61-66c2eaa9284e';
const HOST_ORIGINAL='1'.repeat(64);
const HOST_PROPOSED='2'.repeat(64);
const CONTEXT={controlRepository:REPO,actor:'ansqhd5774-Choi',
  allowedActors:['ansqhd5774-Choi'],installedSha:CONTROLLER};

test('R6 B backup path compares Windows separator aliases without accepting a different target',()=>{
  const slash='E:/ZGmini/automation/pc-control/backups';
  const backslash='E:\\ZGmini\\automation\\pc-control\\backups';
  assert.equal(windowsSafePathKey(slash),windowsSafePathKey(backslash));
  assert.notEqual(windowsSafePathKey(slash),windowsSafePathKey('E:/ZGmini/automation/pc-control/other'));
});

function manifest(overrides={}){
  const base={
    schema:R6_HOST_SCHEMA,
    scope:R6_HOST_SCOPE,
    sourceRepository:'ansqhd5774-Choi/zgmini',
    sourceBranch:'codex/employment-1y-reader-r1',
    sourceSha:R6_HOST_SOURCE_SHA,
    sourceManifestSha256:R6_HOST_SOURCE_MANIFEST_SHA256,
    installedControllerSha:CONTROLLER,
    hostOriginalSha256:HOST_ORIGINAL,
    proposedSha256:HOST_PROPOSED,
    hostPath:'E:/ZGmini/automation/pc-control/host.json',
    candidatePath:'E:/ZGmini/data/employment-r6-candidate-isolated-20261103/EMPLOYMENT_R6_CANDIDATE.sqlite',
    candidateSha256:R6_HOST_CANDIDATE_SHA256,
    stageBundle:`E:/ZGmini/automation/pc-control/source-bundles/r6-bundle-${R6_HOST_SOURCE_SHA}`,
    backupDirectory:`E:/ZGmini/automation/pc-control/backups/r6-host-${REQUEST_ID}`,
    approval:{grade:'B',scope:R6_HOST_SCOPE,
      ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/114'},
    checks:{status:'PASS',sourceManifestSha256:R6_HOST_SOURCE_MANIFEST_SHA256,fileCount:16},
    backup:{strategy:'VERSIONED_SNAPSHOT',
      rollback:{kind:'RESTORE_HOST_SHA256',sha256:HOST_ORIGINAL}},
  };
  return {...base,...overrides};
}

function envelope(bytes,overrides={}){
  return {
    schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId:REQUEST_ID,chatId:CHAT_ID,
    operation:R6_HOST_OPERATION,controlRepository:REPO,
    targetControllerSha:CONTROLLER,approvalManifestSha256:sha256(bytes),...overrides,
  };
}

function validPair(overrides={}){
  const bytes=Buffer.from(JSON.stringify(manifest(overrides))+'\n');
  return {bytes,request:envelope(bytes)};
}

test('R6 B host registration accepts only one pinned seven-key maintenance envelope',()=>{
  const {bytes,request}=validPair();
  const allowed=validateR6HostIssueEnvelope(request,CONTEXT);
  assert.equal(allowed.operation,R6_HOST_OPERATION);
  assert.equal(Object.keys(allowed).length,7);
  assert.equal(allowed.approvalManifestSha256,sha256(bytes));
  assert.throws(()=>validateR6HostIssueEnvelope({...request,command:'cmd /c whoami'},CONTEXT),
    /R6_HOST_ISSUE_FIELDS_INVALID/);
  assert.throws(()=>validateR6HostIssueEnvelope({...request,operation:'controller-update'},CONTEXT),
    /R6_HOST_OPERATION_NOT_ALLOWED/);
  assert.throws(()=>validateR6HostIssueEnvelope({...request,requestId:'bad'},CONTEXT),
    /R6_HOST_REQUEST_ID_INVALID/);
  assert.throws(()=>validateR6HostIssueEnvelope(request,{...CONTEXT,actor:'untrusted-user'}),
    /R6_HOST_ACTOR_NOT_ALLOWED/);
});

test('exact approval manifest bytes and actual installed Controller SHA are mandatory',()=>{
  const {bytes,request}=validPair();
  const approved=validateR6HostRegistrationRequest(request,bytes,CONTEXT);
  assert.equal(approved.request.requestId,REQUEST_ID);
  assert.equal(approved.manifest.installedControllerSha,CONTROLLER);
  assert.equal(approved.manifest.sourceSha,R6_HOST_SOURCE_SHA);
  assert.throws(()=>validateR6HostRegistrationRequest(request,Buffer.concat([bytes,Buffer.from(' ')]),CONTEXT),
    /R6_HOST_MANIFEST_PIN_MISMATCH/);
  assert.throws(()=>validateR6HostRegistrationRequest(request,bytes,
    {...CONTEXT,installedSha:'3'.repeat(40)}),/R6_HOST_INSTALLED_CONTROLLER_SHA_DRIFT/);
  assert.throws(()=>validateR6HostRegistrationRequest(
    {...request,targetControllerSha:'3'.repeat(40)},bytes,CONTEXT),
    /R6_HOST_INSTALLED_CONTROLLER_SHA_DRIFT/);
});

test('B grade, B scope, source closure, candidate and rollback are independently pinned',()=>{
  const checks=[
    [{approval:{grade:'A',scope:R6_HOST_SCOPE,
      ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/114'}},
      'R6_HOST_B_APPROVAL_REQUIRED'],
    [{approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',
      ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/114'}},
      'R6_HOST_B_APPROVAL_REQUIRED'],
    [{sourceManifestSha256:'0'.repeat(64)},'R6_HOST_SOURCE_PIN_MISMATCH'],
    [{sourceSha:'4'.repeat(40)},'R6_HOST_SOURCE_PIN_MISMATCH'],
    [{candidateSha256:'5'.repeat(64)},'R6_HOST_CANDIDATE_SHA_MISMATCH'],
    [{checks:{status:'PASS',sourceManifestSha256:R6_HOST_SOURCE_MANIFEST_SHA256,fileCount:15}},
      'R6_HOST_SOURCE_CHECKS_NOT_VERIFIED'],
    [{backup:{strategy:'VERSIONED_SNAPSHOT',
      rollback:{kind:'RESTORE_HOST_SHA256',sha256:'9'.repeat(64)}}},
      'R6_HOST_ROLLBACK_CONTRACT_INVALID'],
  ];
  for(const [override,error] of checks){
    const bytes=Buffer.from(JSON.stringify(manifest(override))+'\n');
    const request=envelope(bytes);
    assert.throws(()=>validateR6HostRegistrationRequest(request,bytes,CONTEXT),
      new RegExp(error),JSON.stringify(override));
  }
});

test('host-only paths and exact manifest fields reject Core/Task/extra write scope',()=>{
  const bad=[
    [{hostPath:'E:/ZGmini/data/pc-writer/storage/core.sqlite'},'R6_HOST_PATH_SCOPE_INVALID'],
    [{candidatePath:'E:/ZGmini/data/pc-writer/storage/core.sqlite'},'R6_HOST_PATH_SCOPE_INVALID'],
    [{stageBundle:'E:/ZGmini/automation/pc-control/controller'},'R6_HOST_PATH_SCOPE_INVALID'],
    [{backupDirectory:'E:/ZGmini/data/pc-writer'},'R6_HOST_PATH_SCOPE_INVALID'],
    [{coreTaskPath:'E:/ZGmini/anything'},'R6_HOST_MANIFEST_FIELDS_INVALID'],
  ];
  for(const [override,error] of bad){
    const bytes=Buffer.from(JSON.stringify(manifest(override))+'\n');
    const request=envelope(bytes);
    assert.throws(()=>validateR6HostRegistrationRequest(request,bytes,CONTEXT),
      new RegExp(error),JSON.stringify(override));
  }
});

test('approved host B manifest must produce a changed host with a rollback target',()=>{
  const bytes=Buffer.from(JSON.stringify(manifest({proposedSha256:HOST_ORIGINAL}))+'\n');
  assert.throws(()=>validateR6HostRegistrationRequest(envelope(bytes),bytes,CONTEXT),
    /R6_HOST_NO_EFFECT_OR_INVALID_PROPOSAL/);
});

function maintainerFixture(t,{outcome='PASS',applyLosesReply=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'r6-maintenance-admission-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'leases'));
  const {bytes,request}=validPair();
  const issue={number:1140,title:'pc-r6-host-register',state:'OPEN',
    body:JSON.stringify(request),author:{login:'ansqhd5774-Choi'},
    labels:[{name:'pc-maintenance'}],comments:[]};
  const stats={statusQueries:0,applyCalls:0,approvedReads:0,comments:0};
  const published=new Map();
  const fakeExec=async(file,args,options)=>{
    assert.equal(options.shell,false);
    if(file==='gh'||file.endsWith('/GitHub CLI/gh.exe')){
      if(args[0]==='issue'&&args[1]==='view')
        return {stdout:JSON.stringify(issue)};
      if(args[0]==='issue'&&args[1]==='comment'){
        stats.comments++;
        issue.comments.push({body:args[args.indexOf('--body')+1],
          author:{login:'ansqhd5774-Choi'}});
        return {stdout:''};
      }
      if(args[0]==='api'){
        const resource=args[1].split('?')[0];
        if(resource.includes('/contents/approvals/host-r6/')){
          stats.approvedReads++;
          assert.match(resource,/\/contents\/approvals\/host-r6\/afdd8fab1c03b321e4b8b0853bb236c0800a0a14\.json$/);
          return {stdout:JSON.stringify({type:'file',encoding:'base64',content:bytes.toString('base64')})};
        }
        if(resource.includes('/contents/results/maintenance-')){
          if(args.includes('--method')){
            assert.equal(args[args.indexOf('--method')+1],'PUT');
            const encoded=args.find(x=>x.startsWith('content='))?.slice(8);
            assert.ok(encoded);
            published.set(resource,Buffer.from(encoded,'base64'));
            return {stdout:JSON.stringify({content:{sha:'a'.repeat(40)}})};
          }
          if(!published.has(resource))throw Object.assign(Error('HTTP 404'),{code:'HTTP_404'});
          return {stdout:JSON.stringify({type:'file',encoding:'base64',
            content:published.get(resource).toString('base64')})};
        }
      }
      throw Error('unexpected gh invocation: '+args.join(' '));
    }
    assert.equal(file,process.execPath);
    assert.ok(args[0].endsWith('update.mjs'));
    assert.equal(options.env.GITHUB_ACTIONS,undefined);
    assert.equal(options.env.ZGMINI_PC_MAINTENANCE_MODE,'OUT_OF_BAND');
    if(args[1]==='host-r6-status'){
      stats.statusQueries++;
      return {stdout:JSON.stringify({status:'STATUS',actualControllerSha:CONTROLLER,
        installLock:{held:false},ledger:null})};
    }
    if(args[1]==='host-r6-apply'){
      stats.applyCalls++;
      assert.equal(args[args.indexOf('--request-id')+1],REQUEST_ID);
      const packageFile=args[args.indexOf('--manifest-file')+1];
      assert.equal(packageFile,path.join(root,'approved',REQUEST_ID+'.json'));
      const p=JSON.parse(fs.readFileSync(packageFile,'utf8'));
      assert.deepEqual(p.issue,request);
      assert.deepEqual(Buffer.from(p.manifestRawBase64,'base64'),bytes);
      if(applyLosesReply)throw Error('UNKNOWN_CONNECTION_OUTCOME');
      return {stdout:JSON.stringify({status:outcome,
        code:outcome==='PASS'?'R6_HOST_REGISTERED':'R6_HOST_RECOVERY_REQUIRED',
        actualControllerSha:CONTROLLER,protectedStateUnchanged:true,
        workflowEnabled:outcome==='PASS'})};
    }
    throw Error('unexpected updater command: '+args[1]);
  };
  const agent=createMaintenanceAgent({stateDir:root,leaseRoot:path.join(root,'leases'),
    leaseAttempts:1,leaseWaitMs:0,execFileImpl:fakeExec,verifyInstalledSource:()=>{}});
  return {agent,issue,root,stats,published};
}

test('R6 host B routes only to the independent updater and records Workflow restored on PASS',async t=>{
  const f=maintainerFixture(t);
  const result=await f.agent.processIssue(f.issue);
  assert.equal(result.status,'SUCCEEDED',JSON.stringify(result));
  assert.equal(f.stats.applyCalls,1);
  assert.equal(f.stats.approvedReads,1);
  const ledger=f.agent.loadLedger(REQUEST_ID);
  assert.equal(ledger.result.workflowEnabled,true);
  assert.equal(ledger.result.protectedStateUnchanged,true);
  const again=await f.agent.processIssue(f.issue);
  assert.equal(again.code,'DUPLICATE_REQUEST_SUPPRESSED');
  assert.equal(f.stats.applyCalls,1);
});

test('unknown B host apply result remains UNKNOWN and never triggers a second mutation',async t=>{
  const f=maintainerFixture(t,{applyLosesReply:true});
  const first=await f.agent.processIssue(f.issue);
  assert.equal(first.status,'UNKNOWN',JSON.stringify(first));
  assert.equal(f.stats.applyCalls,1);
  assert.equal(f.agent.loadLedger(REQUEST_ID).result.workflowEnabled,false);
  const second=await f.agent.processIssue(f.issue);
  assert.equal(second.code,'DUPLICATE_REQUEST_SUPPRESSED');
  assert.equal(f.stats.applyCalls,1);
});
