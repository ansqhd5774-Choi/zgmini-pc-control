import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {test} from "node:test";
import {execFileSync} from "node:child_process";
import {requireHandoffApproval,handoffFilePlan,nextRuntimeFiles} from "../tools/handoff-maintenance.mjs";

import {createMaintenanceAgent,failedUpdaterResult,normalizedResult,attachApprovedNativeBReceipt,parseS6NonzeroRecoveryReport} from "../tools/maintenance-agent.mjs";
import {prepareMaintenanceIssue,submitExistingControllerApprovalFromCi} from '../tools/maintenance-request.mjs';
import {readIndependentlyInstalledControllerBPublisherPolicy,readAuthenticatedControllerBPublisherWorkflow,readAuthenticatedPublicBPublisherSourceAncestry,observeCompletedRun,observePublishedControllerApprovals,observeLateOwnerMergedControllerApproval,publishExistingControllerApprovals,publishLateOwnerMergedControllerApproval,publishConfiguredControllerApproval} from '../ci-approval/completed-run-intake.mjs';

test('pre-install child rejection retains exact safe code and current installed SHA',()=>{
 const r=failedUpdaterResult({requestId:'fixture',targetControllerSha:'b'.repeat(40)},
  {stdout:JSON.stringify({status:'AUTOMATION_BLOCKED',code:'SUPERVISOR_NOT_HEALTHY',failureStage:'PRE_INSTALL'})},
  {ledger:null,installLock:{held:false},actualControllerSha:'a'.repeat(40)});
 assert.equal(r.status,'BLOCKED');assert.equal(r.code,'SUPERVISOR_NOT_HEALTHY');assert.equal(r.actualControllerSha,'a'.repeat(40));
});
test('unknown stage never claims untouched install and never copies arbitrary stdout',()=>{
 const r=failedUpdaterResult({requestId:'fixture'}, {stdout:'sensitive arbitrary text'}, {ledger:null,installLock:{held:false}});
 assert.equal(r.status,'UNKNOWN');assert.equal(r.code,'UPDATE_OUTCOME_UNKNOWN');assert.ok(!JSON.stringify(r).includes('sensitive'));
 const exact=failedUpdaterResult({requestId:'fixture'},{stdout:JSON.stringify({status:'AUTOMATION_BLOCKED',code:'SUPERVISOR_NOT_HEALTHY'})},{ledger:null,installLock:{held:false}});
 assert.equal(exact.status,'UNKNOWN');assert.equal(exact.code,'SUPERVISOR_NOT_HEALTHY');
});
import {manifestFingerprint,validateUpdateRequest,R54_B_SOURCE_FILES,R54_B_OPERATION,R54_B_ISSUE_TITLE,
  installedControllerBPolicy,verifyControllerBIdentity,authenticateControllerBIssue,
  controllerBReceiptMarker,CI_CONTROLLER_ACTOR} from "../tools/maintenance-contract.mjs";

const REPO="ansqhd5774-Choi/zgmini-pc-control";
const ACTOR="ansqhd5774-Choi";
const INSTALLED="a".repeat(40),TARGET="b".repeat(40);
const REQUEST_ID="pc-11223344-5566-4788-9aab-ccddeeff0011";
const CHAT_ID="chat-22334455-6677-4889-9aab-ddeeff001122";
const digest=value=>crypto.createHash("sha256").update(value).digest("hex");

function sampleRequest(){
  // Deliberately not sorted: updater must receive the exact pinned JSON order.
  const allowFiles=[
    {path:"controller/supervisor.mjs",sha256:"d".repeat(64)},
    {path:"controller/operations.mjs",sha256:"c".repeat(64)},
  ];
  const manifest={
    schema:"ZGMINI_PC_UPDATE_V1",installedSha:INSTALLED,targetSha:TARGET,
    allowFiles,purpose:"pc-controller-maintenance",
    approval:{grade:"B",ref:"https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/28",
      scope:"PC_CONTROL_CONTROLLER_UPDATE"},
    checks:{targetSha:TARGET,status:"PASS",manifestSha256:manifestFingerprint(allowFiles).sha256},
    backup:{strategy:"VERSIONED_SNAPSHOT",rollback:{kind:"RESTORE_INSTALLED_SHA",sha:INSTALLED}},
    postOperation:"core-status",postSourceBranch:"main",postSourceSha:TARGET,
  };
  const rawManifest=Buffer.from(JSON.stringify(manifest));
  const issue={
    schema:"ZGMINI_PC_MAINTENANCE_REQUEST_V1",requestId:REQUEST_ID,chatId:CHAT_ID,
    operation:"controller-update",controlRepository:REPO,targetControllerSha:TARGET,
    approvalManifestSha256:digest(rawManifest),
  };
  return {issue,manifest,rawManifest};
}

function fixture(t,{privateRepo=true,actor=ACTOR,labels=["pc-maintenance"],
  title="pc-controller-update",issuePatch={},manifestPatch={},
  applyError=null,applyResult=null,afterTimeout=null,commentError=null,
  uploadFailure=null,uploadAfterCommitError=null,installLock={held:false},
  verifyInstalledSource=()=>{},statusFaults={},preexistingLedger=null,
  extraIssueSummaries=[],extraIssueDetails=[],progressError=null,
  s6RawManifest=null,s6Status=null,s6ApplyResult=null,s6ApplyError=null,
  s6ApplyRaw=null,publicMetadataPatch={},requestPatch={},
  publicCiProof=null,installedCiPolicy=null}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"zgmini-maintainer-agent-test-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const leaseRoot=path.join(root,"leases");fs.mkdirSync(leaseRoot);
  const example=sampleRequest();
  const manifest={...example.manifest,...manifestPatch};
  const rawManifest=Buffer.from(JSON.stringify(manifest));
  const request={...example.issue,approvalManifestSha256:digest(rawManifest),...requestPatch};
  const issue={number:72,title,state:"OPEN",body:JSON.stringify(request),
    author:{login:actor},labels:labels.map(name=>({name})),comments:[],...issuePatch};
  if(installedCiPolicy){
    const installed=typeof installedCiPolicy==='function'?
      installedCiPolicy(issue,rawManifest):installedCiPolicy;
    fs.writeFileSync(path.join(root,'MAINTENANCE_INSTALL.json'),JSON.stringify(installed));
  }
  const calls=[],remote=new Map(),stats={applies:0,statusQueries:0,comments:0,
    manifestReads:0,uploadWrites:0,uploadReads:0,issueViews:0};
  const applied=applyResult??{status:"SUCCEEDED",code:"UPDATE_COMMITTED",lastPass:"UPDATE_COMMITTED",
    firstFail:"NONE",actualControllerSha:TARGET,recoverySha:null,
    protectedStateUnchanged:true,workflowEnabled:false};
  const fakeExec=async(file,args,options)=>{
    calls.push({file,args:[...args],options});
    assert.equal(options.shell,false);
    if(file==="gh"||file.endsWith("/GitHub CLI/gh.exe")){
      if(args[0]==="repo"&&args[1]==="view"){
        return {stdout:JSON.stringify({isPrivate:privateRepo,nameWithOwner:REPO})};
      }
      if(args[0]==="issue"&&args[1]==="list"){
        assert.equal(args[args.indexOf('--json')+1],'number,title,updatedAt');
        return {stdout:JSON.stringify([{number:issue.number,title:issue.title,
          updatedAt:issue.updatedAt},...extraIssueSummaries])};
      }
      if(args[0]==="issue"&&args[1]==="view"){
        stats.issueViews++;
        const number=Number(args[2]);
        return {stdout:JSON.stringify(extraIssueDetails.find(row=>row.number===number)??issue)};
      }
      if(args[0]==="api"){
        if(publicCiProof&&args[1]===`repos/${REPO}/issues/${issue.number}`){
          return {stdout:JSON.stringify({...publicCiProof.actual,number:issue.number,
            body:issue.body})};
        }
        if(publicCiProof&&args[1].startsWith(`repos/${REPO}/actions/jobs/`)
          &&args[1].endsWith('/logs')){
          const jobId=Number(args[1].split('/').at(-2));
          return {stdout:publicCiProof.readJobLogs(jobId,issue)};
        }
        if(publicCiProof&&(args[1].startsWith(`repos/${REPO}/actions/runs/`)
          ||args[1].startsWith(`repos/${REPO}/contents/.github/workflows/`))){
          const response=await publicCiProof.getJson(args[1].slice(`repos/${REPO}/`.length));
          return {stdout:JSON.stringify(response)};
        }
        if(args[1]==="repos/"+REPO)
          return {stdout:JSON.stringify({id:1442936296,full_name:REPO,
            owner:{id:327938088,login:ACTOR},private:false,...publicMetadataPatch})};
        if(args[1].includes("/contents/approvals/controller-s6/")){
          stats.manifestReads++;
          if(s6RawManifest===null)throw Error('HTTP_404');
          return {stdout:JSON.stringify({type:'file',encoding:'base64',
            content:Buffer.from(s6RawManifest).toString('base64')})};
        }
        if(args[1].includes("/contents/results/maintenance-")){
          const resource=args[1].split("?")[0];
          stats.uploadReads+=args.includes("--method")?0:1;
          const lock=path.join(leaseRoot,"result-upload","owner.json");
          assert.equal(fs.existsSync(lock),true);
          const owner=JSON.parse(fs.readFileSync(lock,"utf8"));
          assert.equal(owner.pid,process.pid);
          assert.match(owner.nonce,/^[a-f0-9-]{36}$/);
          assert.equal(typeof owner.bootAt,"number");
          if(args.includes("--method")){
            assert.equal(args[args.indexOf("--method")+1],"PUT");
            stats.uploadWrites++;
            if(uploadFailure)throw uploadFailure;
            const encoded=args.find(x=>x.startsWith("content="))?.slice(8);
            assert.ok(encoded);
            if(remote.has(resource))throw Object.assign(Error("Conflict (HTTP 409)"),{code:"HTTP_409"});
            remote.set(resource,Buffer.from(encoded,"base64"));
            if(uploadAfterCommitError)throw uploadAfterCommitError;
            return {stdout:JSON.stringify({content:{sha:digest(remote.get(resource))}})};
          }
          if(!remote.has(resource))throw Object.assign(Error("Not Found (HTTP 404)"),{code:"HTTP_404"});
          return {stdout:JSON.stringify({type:"file",encoding:"base64",
            content:remote.get(resource).toString("base64")})};
        }
        stats.manifestReads++;
        assert.match(args[1],/\/contents\/approvals\/controller-updates\/[a-f0-9]{40}\.json\?ref=main$/);
        return {stdout:JSON.stringify({encoding:"base64",type:"file",content:rawManifest.toString("base64")})};
      }
      if(args[0]==="issue"&&args[1]==="comment"){
        assert.equal(args[args.indexOf("--repo")+1],REPO);
        const body=args[args.indexOf("--body")+1];
        if(body.includes('zgmini-pc-maintenance-progress:')){
          stats.progressComments=(stats.progressComments??0)+1;
          assert.ok(options.timeout<=3000);
          if(progressError)throw progressError;
          issue.comments.push({body,author:{login:ACTOR}});
          return {stdout:''};
        }
        stats.comments++;
        assert.match(body,/zgmini-pc-maintenance-(?:result|upload|rejected):/);
        if(commentError){issue.comments.push({body,author:{login:ACTOR}});throw commentError;}
        issue.comments.push({body,author:{login:ACTOR}});
        return {stdout:""};
      }
      throw Error("unexpected GitHub CLI args: "+args.join(" "));
    }
    assert.equal(file,process.execPath);
    assert.ok(args[0].endsWith("update.mjs"));
    assert.equal(options.env.GITHUB_ACTIONS,undefined);
    assert.equal(options.env.GITHUB_TOKEN,undefined);
    assert.equal(options.env.ZGMINI_PC_MAINTENANCE_MODE,"OUT_OF_BAND");
    if(args[1]==="s6-once-status"){
      stats.statusQueries++;
      if(s6Status===null)throw Error('S6_ONCE_STATUS_NOT_AVAILABLE');
      return {stdout:JSON.stringify(s6Status)};
    }
    if(args[1]==="status"){
      stats.statusQueries++;
      return {stdout:JSON.stringify({status:"STATUS",actualControllerSha:INSTALLED,
        ledger:stats.applies?afterTimeout:preexistingLedger,installLock,...statusFaults})};
    }
    if(args[1]==='s6-once-apply'){
      stats.applies++;
      const approvedFile=args[args.indexOf('--manifest-file')+1];
      assert.equal(args[args.indexOf('--request-id')+1],
        JSON.parse(issue.body).requestId);
      assert.equal(approvedFile,path.join(root,'approved',
        JSON.parse(issue.body).requestId+'.json'));
      const pkg=JSON.parse(fs.readFileSync(approvedFile,'utf8'));
      assert.deepEqual(pkg.issue,JSON.parse(issue.body));
      assert.equal(pkg.actor,ACTOR);
      assert.equal(pkg.issueNumber,issue.number);
      assert.equal(pkg.manifestRawBase64,Buffer.from(s6RawManifest).toString('base64'));
      assert.deepEqual(pkg.manifest,JSON.parse(Buffer.from(s6RawManifest).toString('utf8')));
      if(s6ApplyError)throw s6ApplyError;
      if(s6ApplyRaw!==null)return {stdout:s6ApplyRaw};
      return {stdout:JSON.stringify(s6ApplyResult??{
        schema:'ZGMINI_S6_ONCE_RESULT_V1',status:'POSTCHECK_PENDING',
        code:'S6_ONCE_PROMOTION_OBSERVED_A_JOB_PENDING',
        requestId:JSON.parse(issue.body).requestId,
        failoverTested:false,promotionApproved:false,
        leaseReleaseAcknowledged:true,lastPhase:'PROMOTED_READBACK_VERIFIED'
      })};
    }
    if(args[1]==="apply"){
      stats.applies++;
      assert.equal(args[args.indexOf("--request-id")+1],request.requestId);
      const packageFile=args[args.indexOf("--manifest-file")+1];
      assert.ok(packageFile.startsWith(path.join(root,"approved")+path.sep));
      const packaged=JSON.parse(fs.readFileSync(packageFile,"utf8"));
      assert.deepEqual(packaged.issue,request);
      assert.deepEqual(packaged.manifest,manifest);
      assert.deepEqual(Buffer.from(packaged.manifestRawBase64,"base64"),rawManifest);
      assert.equal(packaged.issueNumber,issue.number);
      assert.equal(packaged.actor,publicCiProof?CI_CONTROLLER_ACTOR:actor);
      if(applyError)throw applyError;
      return {stdout:JSON.stringify(applied)};
    }
    throw Error("unexpected updater command");
  };
  const agent=createMaintenanceAgent({stateDir:root,leaseRoot,
    leaseAttempts:1,leaseWaitMs:0,execFileImpl:fakeExec,verifyInstalledSource});
  return {root,leaseRoot,agent,stats,remote,calls,issue,request,manifest,rawManifest,fakeExec};
}

test('common generated envelope is accepted by the real receiver and applies once',async t=>{
 const f=fixture(t);
 const envelope=prepareMaintenanceIssue(f.rawManifest,{installedSha:INSTALLED});
 Object.assign(f.request,JSON.parse(envelope.body));
 Object.assign(f.issue,{title:envelope.title,body:envelope.body,labels:envelope.labels.map(name=>({name}))});
 const result=await f.agent.pollOnce();
 assert.equal(result[0].status,'SUCCEEDED');assert.equal(f.stats.applies,1);
 assert.equal(f.agent.loadLedger(f.request.requestId).requestId,f.request.requestId);
 await f.agent.pollOnce();assert.equal(f.stats.applies,1);
});

test('accepted receipt failure is non-blocking and never creates another apply or receipt on poll',async t=>{
 const f=fixture(t,{progressError:Object.assign(Error('network timeout'),{code:'ETIMEDOUT'})});
 const first=await f.agent.pollOnce();
 assert.equal(first[0].status,'SUCCEEDED');assert.equal(f.stats.applies,1);
 assert.equal(f.agent.loadLedger(REQUEST_ID).progressReceiptStatus,'UNCONFIRMED');
 await f.agent.pollOnce();assert.equal(f.stats.progressComments,1);assert.equal(f.stats.applies,1);
});

test("authorized private-repo issue uploads redacted TXT/JSON without E report accumulation",async t=>{
  const f=fixture(t);
  const result=await f.agent.pollOnce();
  assert.equal(result.length,1);
  assert.equal(result[0].status,"SUCCEEDED",JSON.stringify(result[0]));
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.progressComments,1);
  assert.equal(f.stats.comments,1);
  assert.equal(f.stats.uploadWrites,2);
  assert.equal(f.remote.size,2);
  assert.equal(f.agent.loadLedger(REQUEST_ID).reportUploadStatus,"VERIFIED");
  assert.equal(fs.existsSync(path.join(f.leaseRoot,"result-upload")),false);
  const reportFile=path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.json`);
  const remoteJson=`repos/${REPO}/contents/results/maintenance-${REQUEST_ID}.json`;
  const remoteTxt=`repos/${REPO}/contents/results/maintenance-${REQUEST_ID}.txt`;
  const report=JSON.parse(f.remote.get(remoteJson).toString("utf8"));
  assert.equal(report.status,"SUCCEEDED");
  assert.equal(report.code,"UPDATE_COMMITTED");
  assert.equal(report.actualControllerSha,TARGET);
  assert.equal(report.protectedStateUnchanged,true);
  assert.equal(report.workflowEnabled,false);
  assert.equal(fs.existsSync(reportFile),false);
  assert.equal(fs.existsSync(reportFile.replace(/\.json$/,".txt")),false);
  const text=[f.remote.get(remoteJson).toString("utf8"),
    f.remote.get(remoteTxt).toString("utf8"),f.issue.comments[0].body].join("\n");
  assert.doesNotMatch(text,/approved\/|private-|GH_TOKEN|\.sqlite|manifestRawBase64|allowFiles/);
  const repeat=await f.agent.pollOnce();
  assert.equal(repeat[0].code,"DUPLICATE_REQUEST_SUPPRESSED");
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.comments,1);
  assert.equal(f.stats.uploadWrites,2);
});

test('unrelated open maintenance Issues are skipped before individual GitHub reads',async t=>{
 const f=fixture(t,{extraIssueSummaries:[
   {number:73,title:'unrelated-diagnostic'},{number:74,title:'another-maintenance-task'}]});
 const result=await f.agent.pollOnce();
 assert.equal(result.length,1);
 assert.equal(result[0].status,'SUCCEEDED');
 assert.equal(f.stats.applies,1);
 assert.equal(f.calls.filter(c=>c.args[0]==='issue'&&c.args[1]==='view'&&
   ['73','74'].includes(c.args[2])).length,0);
});

test("38 settled Issues skip repeated full GitHub reads while the newest new Issue runs first",async t=>{
  const updatedAt="2026-11-06T07:30:00Z";
  const extraIssueDetails=[],extraIssueSummaries=[];
  const f=fixture(t,{issuePatch:{number:200,updatedAt},
    extraIssueDetails,extraIssueSummaries});
  for(let i=0;i<38;i++){
    const number=100+i,requestId="pc-"+crypto.randomUUID();
    const request={...f.request,requestId};
    const body=JSON.stringify(request);
    const detail={number,title:"pc-controller-update",state:"OPEN",body,
      author:{login:ACTOR},labels:[{name:"pc-maintenance"}],comments:[],updatedAt};
    extraIssueDetails.push(detail);
    extraIssueSummaries.push({number,title:detail.title,updatedAt});
    const ledger={schema:"ZGMINI_PC_MAINTENANCE_LEDGER_V1",requestId,
      issueNumber:number,actor:ACTOR,fingerprint:digest(JSON.stringify(request)),
      bodyDigest:digest(body),targetControllerSha:TARGET,status:"SUCCEEDED",
      result:{schema:"ZGMINI_PC_MAINTENANCE_RESULT_V1",requestId,
        targetControllerSha:TARGET,status:"SUCCEEDED",code:"UPDATE_COMMITTED"},
      reportUploadStatus:"VERIFIED",commentPosted:true,commentUploadStatus:"VERIFIED"};
    fs.writeFileSync(path.join(f.root,"requests",digest(requestId)+".json"),
      JSON.stringify(ledger));
  }
  const first=await f.agent.pollOnce();
  assert.equal(first.length,39);
  assert.equal(first[0].requestId,REQUEST_ID,"new Issue #200 is served before settled #137");
  assert.equal(first.filter(row=>row.code==="DUPLICATE_REQUEST_SUPPRESSED").length,38);
  assert.equal(f.stats.applies,1);
  const viewsBefore=f.stats.issueViews;
  const second=await f.agent.pollOnce();
  assert.deepEqual(second,[],"fully delivered unchanged Issues do not require reprocessing");
  assert.equal(f.stats.issueViews,viewsBefore,"no 38 repeated gh issue view calls");
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.comments,1);
});

test("Issue updatedAt change invalidates settled cache and catches edited payload",async t=>{
  const f=fixture(t,{issuePatch:{updatedAt:"2026-11-06T07:30:00Z"}});
  await f.agent.pollOnce();
  const before=f.stats.issueViews;
  assert.deepEqual(await f.agent.pollOnce(),[]);
  assert.equal(f.stats.issueViews,before);
  f.issue.body=" \n"+f.issue.body;
  f.issue.updatedAt="2026-11-06T07:31:00Z";
  const changed=await f.agent.pollOnce();
  assert.equal(changed[0].code,"REQUEST_ID_REUSE_CONFLICT");
  assert.equal(f.stats.applies,1);
});

test("incomplete or suspicious settled ledger never enters the fast-path",async t=>{
  for(const mutate of [
    entry=>({...entry,reportUploadStatus:"REPORT_UPLOAD_PENDING"}),
    entry=>({...entry,commentPosted:false}),
    entry=>({...entry,status:"UNKNOWN",result:{...entry.result,status:"UNKNOWN"}}),
    entry=>({...entry,commentUploadStatus:"REPORT_UPLOAD_PENDING",deliveryCommentPosted:false}),
    entry=>({...entry,commentUploadStatus:undefined}),
    entry=>({...entry,issueNumber:999}),
  ]){
    const f=fixture(t,{issuePatch:{updatedAt:"2026-11-06T07:30:00Z"}});
    await f.agent.pollOnce();
    const ledgerFile=path.join(f.root,"requests",digest(REQUEST_ID)+".json");
    const original=JSON.parse(fs.readFileSync(ledgerFile,"utf8"));
    fs.writeFileSync(ledgerFile,JSON.stringify(mutate(original)));
    const before=f.stats.issueViews;
    await f.agent.pollOnce();
    assert.ok(f.stats.issueViews>before,"uncertain ledger requires full Issue read");
    assert.equal(f.stats.applies,1);
  }
});

test("an active global install lease keeps another request queued without claiming it",async t=>{
 const f=fixture(t,{installLock:{held:true,recoveryRequired:false,ownerPid:999}});
 const result=await f.agent.pollOnce();
 assert.equal(result[0].status,"QUEUED");
 assert.equal(result[0].code,"MAINTENANCE_INSTALL_IN_PROGRESS");
 assert.equal(f.stats.applies,0);
 assert.equal(f.agent.loadLedger(REQUEST_ID),null);
});
test("unreadable updater journal cannot be treated as a new request",async t=>{
 const f=fixture(t,{statusFaults:{ledgerReadbackCode:'UPDATE_LEDGER_UNAVAILABLE'}});
 const result=await f.agent.pollOnce();
 assert.equal(result[0].status,'BLOCKED');
 assert.equal(result[0].code,'UPDATE_STATUS_RECOVERY_REQUIRED');
 assert.equal(f.stats.applies,0);
});
test("pre-existing updater ledger without receiver claim requires reconciliation",async t=>{
 const f=fixture(t,{preexistingLedger:{status:'RUNNING',requestId:REQUEST_ID}});
 const result=await f.agent.pollOnce();
 assert.equal(result[0].status,'BLOCKED');
 assert.equal(result[0].code,'UPDATE_EXISTING_LEDGER_RECONCILE_FIRST');
 assert.equal(f.stats.applies,0);
});
test("drifted immutable updater source never reaches an executable process",async t=>{
 const f=fixture(t,{verifyInstalledSource:()=>{throw Error('MAINTENANCE_SELF_DRIFT');}});
 const result=await f.agent.pollOnce();
 assert.equal(result[0].status,'BLOCKED');
 assert.equal(f.stats.applies,0);
 assert.equal(f.stats.statusQueries,0);
 assert.equal(f.calls.some(x=>x.file===process.execPath),false);
});
test("crash after claim but before updater ledger becomes visible UNKNOWN, never re-installs",async t=>{
 const f=fixture(t),fingerprint=digest(JSON.stringify(f.request));
 const ledger={schema:'ZGMINI_PC_MAINTENANCE_LEDGER_V1',requestId:REQUEST_ID,issueNumber:72,
   actor:ACTOR,fingerprint,bodyDigest:digest(f.issue.body),status:'RUNNING',
   createdAt:new Date(Date.now()-300000).toISOString(),result:null};
 const file=path.join(f.root,'requests',digest(REQUEST_ID)+'.json');
 fs.writeFileSync(file,JSON.stringify(ledger)+'\n');
 const result=await f.agent.pollOnce();
 assert.equal(result[0].status,'UNKNOWN');assert.equal(f.stats.applies,0);
 assert.equal(f.agent.loadLedger(REQUEST_ID).result.code,'UPDATE_OUTCOME_UNKNOWN');
});

test("public owner intake reads source only and cannot apply B",async t=>{
  const f=fixture(t,{privateRepo:false});
  const output=await f.agent.pollOnce();
  assert.equal(output[0].status,'PUBLIC_SOURCE_ONLY');
  assert.equal(output[0].code,'PUBLIC_B_EFFECT_HELD');
  assert.equal(output[1].status,'BLOCKED');
  assert.equal(output[1].code,'PUBLIC_B_EFFECT_SEPARATE_AUTH_REQUIRED');
  assert.equal(output[1].effectAuthorized,false);
  const direct=await f.agent.processIssue(f.issue);
  assert.equal(direct.code,'PUBLIC_B_EFFECT_SEPARATE_AUTH_REQUIRED');
  assert.equal(direct.operationalWrites,0);
  assert.equal(f.stats.applies,0);
  assert.equal(f.stats.manifestReads,0);
  assert.equal(f.stats.uploadWrites,0);
  assert.equal(f.stats.comments,0);
  assert.equal(f.agent.loadLedger(REQUEST_ID),null);
  assert.ok(f.calls.every(call=>call.file.endsWith('gh.exe')));
});

test("public maintainer rejects spoofed canonical repo metadata before intake",async t=>{
 for(const publicMetadataPatch of [
  {id:1},{full_name:'attacker/repo'},{private:true},
  {owner:{id:987654,login:ACTOR}},
  {owner:{id:327938088,login:'attacker'}}
 ]){
  const f=fixture(t,{privateRepo:false,publicMetadataPatch});
  await assert.rejects(f.agent.pollOnce(),/GITHUB_PUBLIC_REPOSITORY_IDENTITY_UNVERIFIED/);
  assert.equal(f.stats.issueViews,0);
  assert.equal(f.stats.applies,0);
  assert.equal(f.stats.manifestReads,0);
 }
});

test("non-owner actor, missing label, title mismatch and closed issue are ignored",async t=>{
  for(const variant of [
    {actor:"attacker"},{labels:["bug"]},{title:"please-run-powershell"},
    {issuePatch:{state:"CLOSED"}},
  ]){
    const f=fixture(t,variant);
    const output=await f.agent.pollOnce();
    if(variant.title)assert.deepEqual(output,[]);
    else assert.equal(output[0].status,"IGNORED");
    assert.equal(f.stats.applies,0);
    assert.equal(f.stats.manifestReads,0);
  }
});

test("Issue body cannot add shell, file, path, token or URL fields",async t=>{
  const f=fixture(t);
  const body=JSON.parse(f.issue.body);
  body.command="powershell -Command Remove-Item E:\\Core";
  body.path="E:\\Private\\core.sqlite";
  body.url="https://attacker.example/fetch";
  f.issue.body=JSON.stringify(body);
  const output=await f.agent.pollOnce();
  assert.equal(output[0].status,"BLOCKED");
  assert.equal(output[0].code,"ISSUE_CONTRACT_INVALID");
  assert.equal(f.stats.applies,0);
  assert.equal(f.stats.manifestReads,0);
});

test('trusted malformed correlation ID gets one exact admission rejection and can be corrected',async t=>{
 const f=fixture(t);f.issue.body=JSON.stringify({...f.request,chatId:'chat-invalid/../../label'});
 const first=await f.agent.pollOnce();
 assert.equal(first[0].code,'UPDATE_CHAT_ID_INVALID');
 assert.equal(first[0].phase,'REQUEST_ADMISSION');assert.equal(first[0].executionStarted,false);
 assert.equal(first[0].feedback,'VERIFIED');assert.equal(f.stats.comments,1);
 assert.match(f.issue.comments[0].body,/REQUEST_REJECTED_BEFORE_EXECUTION/);
 assert.match(f.issue.comments[0].body,/CODE: UPDATE_CHAT_ID_INVALID/);
 assert.equal(f.stats.applies,0);assert.equal(f.stats.manifestReads,0);
 await f.agent.pollOnce();assert.equal(f.stats.comments,1);
 f.issue.body=JSON.stringify(f.request);const fixed=await f.agent.pollOnce();
 assert.equal(fixed[0].status,'SUCCEEDED');assert.equal(f.stats.applies,1);
});

test('admission rejection reconciles lost delivery without leaking malformed request text',async t=>{
 const f=fixture(t,{commentError:Error('lost response')});
 f.issue.body='{SECRET_MUST_NOT_BE_RETURNED';
 const first=await f.agent.pollOnce();
 assert.equal(first[0].feedback,'VERIFIED');assert.equal(f.stats.applies,0);
 assert.doesNotMatch(f.issue.comments[0].body,/SECRET_MUST_NOT_BE_RETURNED/);
 await f.agent.pollOnce();assert.equal(f.stats.comments,1);
});

test("duplicate JSON security keys are rejected, including JSON.parse last-key-wins",async t=>{
  const f=fixture(t);
  f.issue.body=f.issue.body.replace(/}$/,',"operation":"controller-update"}');
  assert.equal(JSON.parse(f.issue.body).operation,"controller-update");
  const output=await f.agent.pollOnce();
  assert.equal(output[0].code,"ISSUE_CONTRACT_INVALID");
  assert.equal(f.stats.applies,0);
  assert.equal(f.stats.manifestReads,0);
  const escaped=fixture(t);
  escaped.issue.body=escaped.issue.body.replace(/}$/,
    ',"oper\\u0061tion":"controller-update"}');
  assert.equal(JSON.parse(escaped.issue.body).operation,"controller-update");
  const second=await escaped.agent.pollOnce();
  assert.equal(second[0].code,"ISSUE_CONTRACT_INVALID");
  assert.equal(escaped.stats.applies,0);
});

test("same request ID with edited issue payload is blocked without a second installation",async t=>{
  const f=fixture(t);
  await f.agent.pollOnce();
  f.issue.body=" \n"+f.issue.body;
  const output=await f.agent.pollOnce();
  assert.equal(output[0].code,"REQUEST_ID_REUSE_CONFLICT");
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.comments,1);
});

test("a new maintainer process reuses durable ledger without recreating E reports",async t=>{
  const f=fixture(t);
  await f.agent.pollOnce();
  assert.equal(f.agent.loadLedger(REQUEST_ID).commentPosted,true);
  f.issue.comments.length=0;
  const txt=path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.txt`);
  assert.equal(fs.existsSync(txt),false);
  const restarted=createMaintenanceAgent({stateDir:f.root,leaseRoot:f.leaseRoot,
    leaseAttempts:1,leaseWaitMs:0,execFileImpl:f.fakeExec});
  const again=await restarted.pollOnce();
  assert.equal(again[0].code,"DUPLICATE_REQUEST_SUPPRESSED");
  assert.equal(fs.existsSync(txt),false);
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.comments,1);
});

test("manifest byte-pin mismatch or missing independent installed SHA blocks before apply",async t=>{
  const f=fixture(t);
  const body=JSON.parse(f.issue.body);
  body.approvalManifestSha256="0".repeat(64);
  f.issue.body=JSON.stringify(body);
  const output=await f.agent.pollOnce();
  assert.equal(output[0].status,"BLOCKED");
  assert.equal(output[0].code,"APPROVAL_MANIFEST_HASH_MISMATCH");
  assert.equal(f.stats.applies,0);
  assert.equal(f.stats.comments,1);
  assert.equal(f.agent.loadLedger(REQUEST_ID).status,"BLOCKED");
  const repeat=await f.agent.pollOnce();
  assert.equal(repeat[0].code,"DUPLICATE_REQUEST_SUPPRESSED");
  assert.equal(f.stats.manifestReads,1);
  assert.equal(f.stats.comments,1);
});

test("occupied upload lease keeps only durable ledger in PENDING, then retries upload only",async t=>{
  const f=fixture(t);
  const lock=path.join(f.leaseRoot,"result-upload");
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock,"owner.json"),JSON.stringify({pid:9999,nonce:"another-job"}));
  const first=await f.agent.pollOnce();
  assert.equal(first[0].status,"SUCCEEDED");
  assert.equal(first[0].reportUploadStatus,"REPORT_UPLOAD_PENDING");
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.uploadWrites,0);
  assert.equal(f.stats.comments,1);
  assert.match(f.issue.comments.find(c=>c.body.includes('zgmini-pc-maintenance-result:')).body,/REPORT_UPLOAD: REPORT_UPLOAD_PENDING/);
  assert.equal(fs.existsSync(path.join(lock,"owner.json")),true);
  assert.equal(fs.existsSync(path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.json`)),false);
  assert.equal(fs.existsSync(path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.txt`)),false);
  assert.equal(f.agent.loadLedger(REQUEST_ID).result.status,"SUCCEEDED");
  fs.unlinkSync(path.join(lock,"owner.json"));fs.rmdirSync(lock);
  const again=await f.agent.pollOnce();
  assert.equal(again[0].reportUploadStatus,"VERIFIED");
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.uploadWrites,2);
  assert.equal(f.stats.comments,2); // one idempotent delivery-completion marker
  assert.match(f.issue.comments.find(c=>c.body.includes('zgmini-pc-maintenance-upload:')).body,/REPORT_UPLOAD_VERIFIED/);
  await f.agent.pollOnce();
  assert.equal(f.stats.comments,2);
});

test("a restarted maintainer resumes a PENDING upload from ledger without E report files",async t=>{
  const f=fixture(t);
  const lock=path.join(f.leaseRoot,"result-upload");
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock,"owner.json"),JSON.stringify({pid:9999,nonce:"another-job"}));
  const first=await f.agent.pollOnce();
  assert.equal(first[0].reportUploadStatus,"REPORT_UPLOAD_PENDING");
  assert.equal(f.stats.applies,1);
  assert.equal(fs.existsSync(path.join(f.root,"reports")),false);
  fs.unlinkSync(path.join(lock,"owner.json"));fs.rmdirSync(lock);
  const restarted=createMaintenanceAgent({stateDir:f.root,leaseRoot:f.leaseRoot,
    leaseAttempts:1,leaseWaitMs:0,execFileImpl:f.fakeExec});
  const again=await restarted.pollOnce();
  assert.equal(again[0].reportUploadStatus,"VERIFIED");
  assert.equal(f.stats.applies,1);
  assert.equal(f.remote.size,2);
  assert.equal(restarted.loadLedger(REQUEST_ID).reportUploadStatus,"VERIFIED");
  assert.equal(fs.existsSync(path.join(f.root,"reports")),false);
});

test("preexisting E historical reports are preserved until separately approved cleanup",async t=>{
  const f=fixture(t);
  const historical=path.join(f.root,"reports","MAINTENANCE_pc-old-report.json");
  fs.mkdirSync(path.dirname(historical));
  fs.writeFileSync(historical,"historical recovery evidence\n");
  await f.agent.pollOnce();
  await f.agent.pollOnce();
  assert.equal(fs.readFileSync(historical,"utf8"),"historical recovery evidence\n");
  assert.equal(fs.readdirSync(path.dirname(historical)).length,1);
});

test("uncertain PENDING old local report copies are never deleted or overwritten",async t=>{
  const f=fixture(t);
  const reports=path.join(f.root,"reports");
  fs.mkdirSync(reports);
  const json=path.join(reports,`MAINTENANCE_${REQUEST_ID}.json`);
  const txt=path.join(reports,`MAINTENANCE_${REQUEST_ID}.txt`);
  fs.writeFileSync(json,"legacy pending json\n");
  fs.writeFileSync(txt,"legacy pending text\n");
  const lock=path.join(f.leaseRoot,"result-upload");
  fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,"owner.json"),"other process\n");
  const pending=await f.agent.pollOnce();
  assert.equal(pending[0].reportUploadStatus,"REPORT_UPLOAD_PENDING");
  assert.equal(fs.readFileSync(json,"utf8"),"legacy pending json\n");
  assert.equal(fs.readFileSync(txt,"utf8"),"legacy pending text\n");
  fs.unlinkSync(path.join(lock,"owner.json"));fs.rmdirSync(lock);
  const verified=await f.agent.pollOnce();
  assert.equal(verified[0].reportUploadStatus,"VERIFIED");
  assert.equal(fs.readFileSync(json,"utf8"),"legacy pending json\n");
  assert.equal(fs.readFileSync(txt,"utf8"),"legacy pending text\n");
});

test("restarted R54 B pending ledger reuploads all six pinned drift hashes without E logs",async t=>{
  const f=fixture(t);
  const request={...f.request,operation:R54_B_OPERATION};
  f.issue.title=R54_B_ISSUE_TITLE;
  f.issue.body=JSON.stringify(request);
  const sourceInventory=R54_B_SOURCE_FILES.map((pin,i)=>({
    path:pin.path,
    state:i===2?'UNKNOWN':'OLD',
    actual:i===2?'e'.repeat(64):pin.old,
    expectedOld:pin.old,
    approvedNext:pin.next,
  }));
  const result=normalizedResult(request,{
    status:'BLOCKED',code:'R54_B_ORIGINAL_SOURCE_SHA_DRIFT',
    firstFail:'R54_B_ORIGINAL_SOURCE_SHA_DRIFT',sourceInventory,
    actualControllerSha:TARGET,workflowEnabled:null,
  },'R54_B_ORIGINAL_SOURCE_SHA_DRIFT');
  assert.equal(result.sourceInventory?.length,6);
  const ledger={schema:'ZGMINI_PC_MAINTENANCE_LEDGER_V1',requestId:request.requestId,
    issueNumber:f.issue.number,actor:ACTOR,fingerprint:digest(JSON.stringify(request)),
    bodyDigest:digest(f.issue.body),targetControllerSha:TARGET,status:'BLOCKED',
    createdAt:new Date().toISOString(),result,
    reportUploadStatus:'REPORT_UPLOAD_PENDING',reportUploadCode:'REPORT_UPLOAD_PENDING',
    commentPosted:true,commentUploadStatus:'REPORT_UPLOAD_PENDING'};
  const requests=path.join(f.root,'requests');fs.mkdirSync(requests,{recursive:true});
  fs.writeFileSync(path.join(requests,digest(request.requestId)+'.json'),
    JSON.stringify(ledger,null,2)+'\n');
  const restarted=createMaintenanceAgent({stateDir:f.root,leaseRoot:f.leaseRoot,
    leaseAttempts:1,leaseWaitMs:0,execFileImpl:f.fakeExec});
  const first=await restarted.pollOnce();
  assert.equal(first[0].code,'DUPLICATE_REQUEST_SUPPRESSED');
  assert.equal(first[0].reportUploadStatus,'VERIFIED');
  const jsonKey=`repos/${REPO}/contents/results/maintenance-${REQUEST_ID}.json`;
  const txtKey=`repos/${REPO}/contents/results/maintenance-${REQUEST_ID}.txt`;
  const remote=JSON.parse(f.remote.get(jsonKey).toString('utf8'));
  assert.equal(remote.sourceInventory.length,6);
  assert.deepEqual(remote.sourceInventory,sourceInventory);
  assert.equal(remote.workflowEnabled,null);
  assert.match(f.remote.get(txtKey).toString('utf8'),
    /R54_SOURCE_DRIFT: scripts\/pc-writer\/theme-nine-r51-provisional-overlay\.mjs UNKNOWN e{64}/);
  assert.equal(f.stats.applies,0);
  assert.equal(f.stats.uploadWrites,2);
  assert.equal(fs.existsSync(path.join(f.root,'reports')),false);
  assert.equal(f.issue.comments.length,1);
  assert.match(f.issue.comments[0].body,/REPORT_UPLOAD_VERIFIED/);
  const second=await restarted.pollOnce();
  assert.equal(second[0].reportUploadStatus,'VERIFIED');
  assert.equal(f.stats.uploadWrites,2);
});

test("existing different bytes at fixed result path STOP without overwrite or repeated upload attempts",async t=>{
  const f=fixture(t);
  const resource=`repos/${REPO}/contents/results/maintenance-${REQUEST_ID}.json`;
  const conflicting=Buffer.from("an older unrelated report");
  f.remote.set(resource,conflicting);
  const first=await f.agent.pollOnce();
  assert.equal(first[0].reportUploadStatus,"REPORT_UPLOAD_BLOCKED");
  assert.equal(f.agent.loadLedger(REQUEST_ID).reportUploadCode,"REPORT_REMOTE_CONTENT_CONFLICT");
  assert.equal(f.stats.uploadWrites,0);
  assert.deepEqual(f.remote.get(resource),conflicting);
  assert.equal(f.stats.comments,1);
  await f.agent.pollOnce();
  assert.equal(f.stats.uploadWrites,0);
  assert.deepEqual(f.remote.get(resource),conflicting);
});

test("ambiguous GitHub PUT timeout is reconciled by GET byte-for-byte readback",async t=>{
  const f=fixture(t,{uploadAfterCommitError:Object.assign(Error("timeout"),{code:"ETIMEDOUT"})});
  const result=await f.agent.pollOnce();
  assert.equal(result[0].reportUploadStatus,"VERIFIED");
  assert.equal(f.stats.uploadWrites,2);
  assert.equal(f.remote.size,2);
  assert.equal(f.stats.comments,1);
});

test("failed GitHub PUT keeps durable ledger and Issue comment, no E reports or success claim",async t=>{
  const f=fixture(t,{uploadFailure:Object.assign(Error("offline"),{code:"ETIMEDOUT"})});
  const first=await f.agent.pollOnce();
  assert.equal(first[0].reportUploadStatus,"REPORT_UPLOAD_PENDING");
  assert.equal(f.stats.uploadWrites,1);
  assert.equal(f.stats.comments,1);
  assert.match(f.issue.comments.find(c=>c.body.includes('zgmini-pc-maintenance-result:')).body,/REPORT_UPLOAD: REPORT_UPLOAD_PENDING/);
  assert.equal(f.agent.loadLedger(REQUEST_ID).reportUploadStatus,"REPORT_UPLOAD_PENDING");
  assert.equal(fs.existsSync(path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.json`)),false);
  assert.equal(fs.existsSync(path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.txt`)),false);
  assert.equal(f.agent.loadLedger(REQUEST_ID).result.status,"SUCCEEDED");
});

test("timed-out apply rechecks updater ledger and never repeats installation",async t=>{
  const timeout=Object.assign(Error("child killed while applying"),{code:"ETIMEDOUT"});
  const post={result:{status:"SUCCEEDED",code:"UPDATE_COMMITTED",
    actualControllerSha:TARGET,protectedStateUnchanged:true,workflowEnabled:false}};
  const f=fixture(t,{applyError:timeout,afterTimeout:post});
  const output=await f.agent.pollOnce();
  assert.equal(output[0].status,"SUCCEEDED");
  assert.equal(f.stats.statusQueries,2);
  assert.equal(f.stats.applies,1);
  await f.agent.pollOnce();
  assert.equal(f.stats.applies,1);
});

test("ambiguous timeout without verifiable status becomes UNKNOWN and never reruns",async t=>{
  const f=fixture(t,{applyError:Object.assign(Error("timeout"),{code:"ETIMEDOUT"})});
  const result=await f.agent.pollOnce();
  assert.equal(result[0].status,"UNKNOWN");
  assert.equal(result[0].code,"UPDATE_OUTCOME_UNKNOWN");
  assert.equal(f.stats.applies,1);
  const repeat=await f.agent.pollOnce();
  assert.equal(repeat[0].code,"DUPLICATE_REQUEST_SUPPRESSED");
  assert.equal(f.stats.applies,1);
});

test('child pre-install rejection is recovered from stdout without repeating apply',async t=>{
 const error=Object.assign(Error('child failed'),{stdout:JSON.stringify({status:'AUTOMATION_BLOCKED',code:'SUPERVISOR_NOT_HEALTHY',failureStage:'PRE_INSTALL'})});
 const f=fixture(t,{applyError:error});const r=await f.agent.pollOnce();
 assert.equal(r[0].code,'SUPERVISOR_NOT_HEALTHY');assert.equal(r[0].status,'BLOCKED');
 await f.agent.pollOnce();assert.equal(f.stats.applies,1);
});

test("timed-out comment is observed by marker; retry never posts duplicate comment",async t=>{
  const f=fixture(t,{commentError:Object.assign(Error("network timeout"),{code:"ETIMEDOUT"})});
  const first=await f.agent.pollOnce();
  assert.equal(first[0].status,"SUCCEEDED");
  assert.equal(f.stats.comments,1);
  await f.agent.pollOnce();
  assert.equal(f.stats.comments,1);
  assert.equal(f.stats.applies,1);
});

test("an untrusted comment spoofing the result marker cannot suppress the authorized report",async t=>{
  const f=fixture(t);
  f.issue.comments.push({body:`<!-- zgmini-pc-maintenance-result:${REQUEST_ID} -->`,
    author:{login:"untrusted-collaborator"}});
  const first=await f.agent.pollOnce();
  assert.equal(first[0].status,"SUCCEEDED");
  assert.equal(f.stats.comments,1);
  assert.equal(f.stats.applies,1);
  await f.agent.pollOnce();
  assert.equal(f.stats.comments,1);
});

test("coordinator PASS, ROLLED_BACK and RECOVERY_REQUIRED map to safe comment outcomes",async t=>{
  const cases=[
    [{status:"PASS",code:"APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED",
      actualInstalledSha:TARGET,protectedStateUnchanged:true},"SUCCEEDED",TARGET],
    [{status:"ROLLED_BACK",code:"POSTCHECK_NOT_VERIFIED",actualInstalledSha:INSTALLED},
      "FAILED",INSTALLED],
    [{status:"RECOVERY_REQUIRED",code:"INTERRUPTED_INSTALL_REQUIRES_RECONCILIATION",
      actualInstalledSha:null},"UNKNOWN",null],
  ];
  for(const [applyResult,expected,actual] of cases){
    const f=fixture(t,{applyResult});
    const result=await f.agent.pollOnce();
    assert.equal(result[0].status,expected);
    const report=f.agent.loadLedger(REQUEST_ID).result;
    assert.equal(report.status,expected);
    assert.equal(report.actualControllerSha,actual);
  }
});


test('safe measured idle retry survives final maintenance result normalization',()=>{
 const request={requestId:REQUEST_ID,targetControllerSha:TARGET,operation:'controller-update'};
 const sample={status:'PASS',code:'APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED',
  supervisorIdleWait:{retryCount:2,elapsedMs:6000,observedBusy:true}};
 assert.deepEqual(normalizedResult(request,sample).supervisorIdleWait,sample.supervisorIdleWait);
 assert.equal(Object.hasOwn(normalizedResult(request,{...sample,
  supervisorIdleWait:{retryCount:-1,elapsedMs:0,observedBusy:true}}),'supervisorIdleWait'),false);
 assert.equal(Object.hasOwn(normalizedResult(request,{...sample,
  supervisorIdleWait:{retryCount:1,elapsedMs:Infinity,observedBusy:true}}),'supervisorIdleWait'),false);
 assert.equal(Object.hasOwn(normalizedResult(request,{...sample,status:'RECOVERY_REQUIRED'}),'supervisorIdleWait'),false);
});

test('bounded Busy refusal telemetry survives normalization without implying success',()=>{
 const request={requestId:REQUEST_ID,targetControllerSha:TARGET,operation:'controller-update'};
 const sample={status:'BLOCKED',code:'RUNNERS_NOT_IDLE',failureOperation:'stopOwnSupervisor',
  supervisorIdleWait:{retryCount:10,elapsedMs:30000,observedBusy:true}};
 const out=normalizedResult(request,sample);
 assert.equal(out.status,'BLOCKED');
 assert.deepEqual(out.supervisorIdleWait,sample.supervisorIdleWait);
 assert.equal(Object.hasOwn(normalizedResult(request,{...sample,code:'SUPERVISOR_OWNER_CHANGED'}),
  'supervisorIdleWait'),false);
 assert.equal(Object.hasOwn(normalizedResult(request,{...sample,
  supervisorIdleWait:{retryCount:-1,elapsedMs:30000,observedBusy:true}}),
  'supervisorIdleWait'),false);
 assert.deepEqual(normalizedResult(request,{...sample,status:'RECOVERY_REQUIRED',
  firstFail:'BACKED_UP'}).supervisorIdleWait,sample.supervisorIdleWait);
});

test('unknown controller recovery does not assert disabled workflow',()=>{
 const request={requestId:REQUEST_ID,targetControllerSha:TARGET,operation:'controller-update'};
 const raw={status:'RECOVERY_REQUIRED',code:'BACKLOG_ORIGINAL_REQUEST_INVALID',
   lastPass:'RECOVERY_REQUIRED',firstFail:'INTAKE_RESUMED',actualInstalledSha:TARGET};
 const unknown=normalizedResult(request,raw);
 assert.equal(unknown.status,'UNKNOWN');
 assert.equal(unknown.code,'BACKLOG_ORIGINAL_REQUEST_INVALID');
 assert.equal(unknown.actualControllerSha,TARGET);
 assert.equal(unknown.workflowEnabled,null);
 assert.equal(unknown.protectedStateUnchanged,null);
 const explicitlyDrifted=normalizedResult(request,{...raw,protectedStateUnchanged:false});
 assert.equal(explicitlyDrifted.protectedStateUnchanged,false);
 const explicitlyPreserved=normalizedResult(request,{...raw,protectedStateUnchanged:true});
 assert.equal(explicitlyPreserved.protectedStateUnchanged,true);
 const confirmedDisabled=normalizedResult(request,{...raw,workflowEnabled:false});
 assert.equal(confirmedDisabled.workflowEnabled,false);
 const confirmedActive=normalizedResult(request,{...raw,workflowEnabled:true});
 assert.equal(confirmedActive.workflowEnabled,true);
});

test('candidate failure and verified operational rollback are independently reported',()=>{
 const request={requestId:'pc-update-fixture',targetControllerSha:'b'.repeat(40)};
 const raw={status:'ROLLED_BACK',actualInstalledSha:'a'.repeat(40),recoverySha:'a'.repeat(40),
  code:'POSTCHECK_EXECUTION_FAILED_VERIFIED',originalFailureCode:'POSTCHECK_EXECUTION_FAILED_VERIFIED',
  rollbackFailureCode:null,protectedStateUnchanged:true,workflowEnabled:true};
 const out=normalizedResult(request,raw);assert.equal(out.status,'FAILED');
 assert.equal(out.operationalRecovery,'PREVIOUS_VERSION_VERIFIED');
 assert.equal(out.originalFailureCode,raw.originalFailureCode);assert.equal(out.rollbackFailureCode,null);
 assert.equal(normalizedResult(request,{...raw,protectedStateUnchanged:false}).operationalRecovery,'UNVERIFIED');
 assert.equal(normalizedResult(request,{...raw,recoverySha:'c'.repeat(40)}).operationalRecovery,'UNVERIFIED');
});

test("two request IDs for one approved controller effect admit exactly one updater",async t=>{
 const f=fixture(t);
 const first=await f.agent.processIssue(f.issue);
 assert.equal(first.status,"SUCCEEDED");
 assert.equal(f.stats.applies,1);
 const duplicateId="pc-99999999-8888-4777-9666-555555555555";
 const duplicate={...f.issue,number:73,body:JSON.stringify({
  ...JSON.parse(f.issue.body),requestId:duplicateId,
  chatId:"chat-77777777-6666-4555-9444-333333333333"
 }),comments:[]};
 const second=await f.agent.processIssue(duplicate);
 assert.equal(second.status,"BLOCKED");
 assert.equal(second.code,"DUPLICATE_EFFECT_SUPPRESSED");
 assert.equal(second.originalIssueNumber,f.issue.number);
 assert.equal(second.originalRequestId,f.request.requestId);
 assert.equal(second.operationalWrites,0);
 assert.equal(f.stats.applies,1);
 assert.equal(fs.existsSync(path.join(f.root,"approved",duplicateId+".json")),false);
 // The original request, unlike a second ID, retains its same effect claim.
 assert.equal((await f.agent.processIssue(f.issue)).code,
  "DUPLICATE_REQUEST_SUPPRESSED");
 assert.equal(f.stats.applies,1);
});

test("same-effect simultaneous submission uses existing ledger atomic claim",async t=>{
 const f=fixture(t);
 const secondId="pc-88888888-7777-4666-9555-444444444444";
 const duplicate={...f.issue,number:74,body:JSON.stringify({
  ...JSON.parse(f.issue.body),requestId:secondId
 }),comments:[]};
 const outcomes=await Promise.all([f.agent.processIssue(f.issue),
  f.agent.processIssue(duplicate)]);
 assert.equal(outcomes.filter(x=>x.code==="DUPLICATE_EFFECT_SUPPRESSED").length,1);
 assert.equal(outcomes.filter(x=>x.status==="SUCCEEDED").length,1);
 assert.equal(f.stats.applies,1);
});


function s6AgentCase(){
 const manifest={
  schema:'ZGMINI_PC_S6_ONCE_B_APPROVAL_V1',operation:'controller-s6-failover-once',
  requestId:'pc-s6-12345678-abcd-4def-8123-123456789abc',
  installedControllerSha:INSTALLED,installedMaintainerSha:TARGET,
  watchdogSourceSha256:'3'.repeat(64),protectedSha256:'4'.repeat(64),
  ownerSha256:'5'.repeat(64),watchdogPid:23001,standbyPids:[23002,23003],
  approval:{approved:true,grade:'B',
   scope:'EXACT_ONE_SUPERVISOR_TREE_STOP_WITH_WATCHDOG_AUTO_PROMOTION',
   ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4000'},
  effect:{mode:'SINGLE_S6_FAILOVER',stop:'OLD_OWNED_SUPERVISOR_TREE_ONLY',
   promotion:'EXISTING_WATCHDOG_ONE_READY_STANDBY',
   independentMaintainer:true,noArbitraryCommands:true,
   noAutomaticRetry:true,noForcedRollback:true,
   preserveWorkersAndLedger:true,preserveProtectedSourceAndDb:true,
   postcheck:'EXISTING_A_JOB_WITH_READBACK'}
 };
 const raw=Buffer.from(JSON.stringify(manifest)+'\n');
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:manifest.requestId,chatId:'chat-s6-once-preflight-test-20261126',
  operation:manifest.operation,controlRepository:REPO,
  targetControllerSha:INSTALLED,approvalManifestSha256:digest(raw)};
 const live={
  installedControllerSha:INSTALLED,installedMaintainerSha:TARGET,
  watchdogSourceSha256:manifest.watchdogSourceSha256,
  protectedSha256:manifest.protectedSha256,ownerSha256:manifest.ownerSha256,
  watchdogPid:23001,standbyPids:[23002,23003]
 };
 const status={status:'READONLY',code:'S6_ONCE_LIVE_PREIMAGE_OBSERVED',
  requestId:request.requestId,actualControllerSha:INSTALLED,
  installAttempted:false,operationalWrites:0,installLock:{held:false},s6Live:live};
 return {request,raw,status};
}
test('S6 exact Owner B Issue executes pinned standalone updater once and retains A postcheck pending',async t=>{
 const s6=s6AgentCase();
 const f=fixture(t,{title:'pc-controller-s6-once',
  issuePatch:{body:JSON.stringify(s6.request)},s6RawManifest:s6.raw,s6Status:s6.status});
 const row=(await f.agent.pollOnce())[0];
 assert.equal(row.status,'UNKNOWN'); // Actual A postcheck has not run.
 assert.equal(row.code,'S6_ONCE_PROMOTION_OBSERVED_A_JOB_PENDING');
 assert.equal(row.s6ExecutionStatus,'POSTCHECK_PENDING');
 assert.equal(f.stats.applies,1);
 assert.equal(f.stats.statusQueries,1);
 assert.equal(f.stats.manifestReads,1);
 const saved=f.agent.loadLedger(s6.request.requestId);
 assert.equal(saved.status,'UNKNOWN');
 assert.equal(saved.result.s6ExecutionStatus,'POSTCHECK_PENDING');
 assert.equal(saved.result.s6LeaseReleaseAcknowledged,true);
 assert.equal(saved.result.s6LastPhase,'PROMOTED_READBACK_VERIFIED');
 assert.equal(saved.result.status,'UNKNOWN');
 assert.equal(saved.result.code,'S6_ONCE_PROMOTION_OBSERVED_A_JOB_PENDING');
 // The durable ledger is normalized a second time before GitHub JSON/TXT
 // upload: that round trip must not erase the pending-A safety meaning.
 const remoteKey=`repos/${REPO}/contents/results/maintenance-${s6.request.requestId}.json`;
 const uploaded=f.remote.get(remoteKey);
 assert.ok(Buffer.isBuffer(uploaded));
 const receipt=JSON.parse(uploaded.toString('utf8'));
 assert.equal(receipt.status,'UNKNOWN');
 assert.equal(receipt.s6ExecutionStatus,'POSTCHECK_PENDING');
 assert.equal(receipt.s6LeaseReleaseAcknowledged,true);
 assert.equal(receipt.s6LastPhase,'PROMOTED_READBACK_VERIFIED');
 assert.equal(f.issue.comments.some(c=>c.body?.includes('S6_EXECUTION_STATUS: POSTCHECK_PENDING')),true);
 const duplicate=await f.agent.processIssue(f.issue);
 assert.equal(duplicate.code,'DUPLICATE_REQUEST_SUPPRESSED');
 assert.equal(f.stats.applies,1);
 assert.equal(f.calls.filter(x=>x.args.includes('s6-once-apply')).length,1);
});
test('S6 recovery-required outcome is durable and cannot stop twice',async t=>{
 const s6=s6AgentCase();
 const f=fixture(t,{title:'pc-controller-s6-once',
  issuePatch:{body:JSON.stringify(s6.request)},s6RawManifest:s6.raw,s6Status:s6.status,
  s6ApplyResult:{schema:'ZGMINI_S6_ONCE_RESULT_V1',status:'RECOVERY_REQUIRED',
   code:'S6_ONCE_RUNTIME_OUTCOME_RECONCILE',requestId:s6.request.requestId,
   failoverTested:false,promotionApproved:false,failedCode:'BACKLOG_REPLAY_OUTCOME_UNKNOWN',
   failedAt:'BACKLOG_RECONCILE_ATTEMPT',leaseReleaseAcknowledged:true}});
 const result=await f.agent.processIssue(f.issue);
 assert.equal(result.status,'UNKNOWN');
 assert.equal(result.s6ExecutionStatus,'RECOVERY_REQUIRED');
 assert.equal(f.agent.loadLedger(s6.request.requestId).result.actualControllerSha,null);
 assert.equal(f.agent.loadLedger(s6.request.requestId).result.firstFail,
  'BACKLOG_REPLAY_OUTCOME_UNKNOWN');
 assert.equal((await f.agent.processIssue(f.issue)).code,'DUPLICATE_REQUEST_SUPPRESSED');
 assert.equal(f.stats.applies,1);
});
test('S6 updater exit 2 with exact RECOVERY_REQUIRED JSON preserves failed boundary without replay',async t=>{
 const s6=s6AgentCase();
 const raw={schema:'ZGMINI_S6_ONCE_RESULT_V1',status:'RECOVERY_REQUIRED',
  code:'S6_ONCE_RUNTIME_OUTCOME_RECONCILE',requestId:s6.request.requestId,
  operationalEffectUnverified:true,failoverTested:false,promotionApproved:false,
  mutationAttempted:true,failedCode:'S6_PORT_INTAKE_PAUSE_LOST',
  failedAt:'INTAKE_PAUSED',leaseReleaseAcknowledged:false,
  token:'MUST_NOT_LEAK',ownerPid:3244};
 const error=Object.assign(Error('child exited with code 2'),{
  code:2,stdout:JSON.stringify(raw)+'\n',stderr:'private path',killed:false,signal:null
 });
 const bounded=parseS6NonzeroRecoveryReport(error,s6.request.requestId);
 assert.equal(bounded?.status,'RECOVERY_REQUIRED');
 assert.equal(bounded.failedAt,'INTAKE_PAUSED');
 assert.equal(bounded.failedCode,'S6_PORT_INTAKE_PAUSE_LOST');
 assert.equal(Object.hasOwn(bounded,'token'),false);
 assert.equal(Object.hasOwn(bounded,'ownerPid'),false);
 const f=fixture(t,{title:'pc-controller-s6-once',
  issuePatch:{body:JSON.stringify(s6.request)},s6RawManifest:s6.raw,
  s6Status:s6.status,s6ApplyError:error});
 const result=await f.agent.processIssue(f.issue);
 const recorded=f.agent.loadLedger(s6.request.requestId).result;
 assert.equal(result.status,'UNKNOWN');
 assert.equal(result.code,'S6_ONCE_RUNTIME_OUTCOME_RECONCILE');
 assert.equal(recorded.s6ExecutionStatus,'RECOVERY_REQUIRED');
 assert.equal(recorded.actualControllerSha,null);
 assert.equal(recorded.firstFail,'S6_PORT_INTAKE_PAUSE_LOST');
 assert.equal(recorded.s6LastPhase,'INTAKE_PAUSED');
 assert.equal(recorded.s6LeaseReleaseAcknowledged,false);
 const json=f.remote.get(`repos/${REPO}/contents/results/maintenance-${s6.request.requestId}.json`);
 assert.ok(Buffer.isBuffer(json));
 const uploaded=JSON.parse(json.toString('utf8'));
 assert.equal(uploaded.firstFail,'S6_PORT_INTAKE_PAUSE_LOST');
 assert.equal(uploaded.actualControllerSha,null);
 assert.equal(uploaded.s6LastPhase,'INTAKE_PAUSED');
 assert.equal(uploaded.s6ExecutionStatus,'RECOVERY_REQUIRED');
 assert.doesNotMatch(JSON.stringify(uploaded),/MUST_NOT_LEAK|private path|ownerPid/);
 assert.equal((await f.agent.processIssue(f.issue)).code,'DUPLICATE_REQUEST_SUPPRESSED');
 assert.equal(f.stats.applies,1);
});
test('S6 updater nonzero exit rejects arbitrary, mismatched, or successful JSON fail-closed',()=>{
 const s6=s6AgentCase(),id=s6.request.requestId;
 const raw={schema:'ZGMINI_S6_ONCE_RESULT_V1',requestId:id,
  status:'RECOVERY_REQUIRED',code:'S6_ONCE_RUNTIME_OUTCOME_RECONCILE',
  operationalEffectUnverified:true,failoverTested:false,promotionApproved:false,
  mutationAttempted:true,failedAt:'OLD_TREE_STOP_ATTEMPT',
  failedCode:'S6_PORT_STOP_GUARD_CHANGED',leaseReleaseAcknowledged:false};
 const error={code:2,stdout:JSON.stringify(raw),signal:null,killed:false};
 assert.equal(parseS6NonzeroRecoveryReport(error,id).failedAt,'OLD_TREE_STOP_ATTEMPT');
 for(const bad of [
  {...error,code:1},{...error,code:9},{...error,killed:true},
  {...error,signal:'SIGTERM'}, {...error,stdout:'private Windows log'},
  {...error,stdout:'X'.repeat(16385)},
  {...error,stdout:JSON.stringify({...raw,requestId:'pc-s6-00000000-0000-4000-8000-000000000000'})},
  {...error,stdout:JSON.stringify({...raw,status:'POSTCHECK_PENDING'})},
  {...error,stdout:JSON.stringify({...raw,operationalEffectUnverified:false})},
  {...error,stdout:JSON.stringify({...raw,mutationAttempted:false})},
  {...error,stdout:JSON.stringify({...raw,promotionApproved:true})},
  {...error,stdout:JSON.stringify({...raw,failedAt:'FAKE_SUCCESS'})},
  {...error,stdout:JSON.stringify({...raw,failedCode:'BAD/PATH'})},
  {...error,stdout:JSON.stringify({...raw,leaseReleaseAcknowledged:'yes'})}
 ]){
  assert.equal(parseS6NonzeroRecoveryReport(bad,id),null);
 }
});
test('S6 lost updater response remains unknown without automatic retry',async t=>{
 const s6=s6AgentCase();
 const f=fixture(t,{title:'pc-controller-s6-once',
  issuePatch:{body:JSON.stringify(s6.request)},s6RawManifest:s6.raw,s6Status:s6.status,
  s6ApplyError:Error('uncertain after possible supervisor stop')});
 const result=await f.agent.processIssue(f.issue);
 assert.equal(result.status,'UNKNOWN');
 assert.equal(result.code,'S6_ONCE_OUTCOME_UNKNOWN');
 assert.equal(f.agent.loadLedger(s6.request.requestId).result.firstFail,
  'S6_ONCE_UPDATER_RESPONSE_UNKNOWN');
 assert.equal((await f.agent.processIssue(f.issue)).code,'DUPLICATE_REQUEST_SUPPRESSED');
 assert.equal(f.stats.applies,1);
});
test('S6 malformed child stdout preserves uncertain one-shot and parser category',async t=>{
 const s6=s6AgentCase();
 const f=fixture(t,{title:'pc-controller-s6-once',
  issuePatch:{body:JSON.stringify(s6.request)},s6RawManifest:s6.raw,s6Status:s6.status,
  s6ApplyRaw:'not-json'});
 const result=await f.agent.processIssue(f.issue);
 const recorded=f.agent.loadLedger(s6.request.requestId).result;
 assert.equal(result.status,'UNKNOWN');
 assert.equal(result.code,'S6_ONCE_OUTCOME_UNKNOWN');
 assert.equal(recorded.firstFail,'S6_ONCE_OUTPUT_INVALID');
 assert.equal((await f.agent.processIssue(f.issue)).code,'DUPLICATE_REQUEST_SUPPRESSED');
 assert.equal(f.stats.applies,1);
});
test('S6 invalid structured result preserves uncertain one-shot and schema category',async t=>{
 const s6=s6AgentCase();
 const f=fixture(t,{title:'pc-controller-s6-once',
  issuePatch:{body:JSON.stringify(s6.request)},s6RawManifest:s6.raw,s6Status:s6.status,
  s6ApplyResult:{schema:'ZGMINI_S6_ONCE_RESULT_V1',status:'SUCCEEDED',
   requestId:s6.request.requestId,failoverTested:false,promotionApproved:false}});
 const result=await f.agent.processIssue(f.issue);
 const recorded=f.agent.loadLedger(s6.request.requestId).result;
 assert.equal(result.status,'UNKNOWN');
 assert.equal(result.code,'S6_ONCE_OUTCOME_UNKNOWN');
 assert.equal(recorded.firstFail,'S6_ONCE_RESULT_UNVERIFIED');
 assert.equal((await f.agent.processIssue(f.issue)).code,'DUPLICATE_REQUEST_SUPPRESSED');
 assert.equal(f.stats.applies,1);
});
test('S6 rejects stale standby owner and does not execute or claim an effect',async t=>{
 const s6=s6AgentCase();
 const status={...s6.status,s6Live:{...s6.status.s6Live,standbyPids:[23003,23002]}};
 const f=fixture(t,{title:'pc-controller-s6-once',
  issuePatch:{body:JSON.stringify(s6.request)},s6RawManifest:s6.raw,s6Status:status});
 const row=(await f.agent.pollOnce())[0];
 assert.equal(row.status,'BLOCKED');
 assert.equal(row.code,'S6_ONCE_LIVE_CAS_UNVERIFIED');
 assert.equal(row.executionStarted,false);
 assert.equal(f.stats.applies,0);
 assert.equal(f.agent.loadLedger(s6.request.requestId),null);
});
test('S6 bot, missing exact approval or unreadable operating snapshot never reaches execute path',async t=>{
 const s6=s6AgentCase();
 for(const params of [
  {actor:'github-actions[bot]',s6RawManifest:s6.raw,s6Status:s6.status,expected:'IGNORED'},
  {s6RawManifest:null,s6Status:s6.status,expected:'BLOCKED'},
  {s6RawManifest:s6.raw,s6Status:null,expected:'BLOCKED'}
 ]){
  const f=fixture(t,{title:'pc-controller-s6-once',
   issuePatch:{body:JSON.stringify(s6.request)},...params});
  const rows=await f.agent.pollOnce();
  assert.equal(rows.length,1);
  assert.equal(rows[0].status,params.expected);
  assert.equal(f.stats.applies,0);
  assert.equal(f.calls.some(row=>row.args.includes('s6-once-apply')),false);
 }
});


test('only Owner-pinned B manifest plus verified updater success emits native effect in durable JSON',async t=>{
 const manifest=sampleRequest().manifest;
 const nativePolicySha256='e'.repeat(64);
 const selectiveSource={schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',
  branch:'codex/ci-native-proof-20261127',mainSha:'b'.repeat(40),
  customPaths:['controller/operations.mjs']};
 const ciNativeApproval={schema:'ZGMINI_CI_NATIVE_B_POLICY_APPROVAL_V1',
  effect:'A_READONLY',nativePolicySha256};
 const f=fixture(t,{manifestPatch:{controllerOnlyInstall:true,selectiveSource,ciNativeApproval}});
 const current=await f.agent.pollOnce();
 assert.equal(current[0].status,'SUCCEEDED');
 const output=JSON.parse(f.remote.get(
  `repos/${REPO}/contents/results/maintenance-${REQUEST_ID}.json`).toString('utf8'));
 assert.equal(output.ciNativeEffect,'A_READONLY');
 assert.equal(output.ciNativePolicySha256,nativePolicySha256);
 const txt=f.remote.get(`repos/${REPO}/contents/results/maintenance-${REQUEST_ID}.txt`).toString('utf8');
 assert.match(txt,/CI_NATIVE_EFFECT: A_READONLY/);
 assert.match(txt,new RegExp('CI_NATIVE_POLICY_SHA256: '+nativePolicySha256));
 assert.equal(f.agent.loadLedger(REQUEST_ID).reportUploadStatus,'VERIFIED');
 assert.equal(f.stats.applies,1);
 await f.agent.pollOnce();
 assert.equal(f.stats.applies,1);
 const trusted=validateUpdateRequest(f.request,f.rawManifest,{actor:ACTOR,
  allowedActors:[ACTOR],controlRepository:REPO,installedSha:INSTALLED});
 const ok=normalizedResult(f.request,{status:'SUCCEEDED',code:'UPDATE_COMMITTED',
  actualControllerSha:TARGET,protectedStateUnchanged:true},'UPDATE_COMMITTED');
 assert.equal(attachApprovedNativeBReceipt(ok,trusted,ACTOR).ciNativeEffect,'A_READONLY');
 for(const [kind,value,actor] of [
  ['protected state drift',{...ok,protectedStateUnchanged:false},ACTOR],
  ['other controller SHA',{...ok,actualControllerSha:'c'.repeat(40)},ACTOR],
  ['unverified state',{...ok,status:'UNKNOWN'},ACTOR],
  ['forged actor',ok,'github-actions[bot]'],
  ['other request ID',{...ok,requestId:'pc-other-0000'},ACTOR],
 ]){
  const denied=attachApprovedNativeBReceipt(value,trusted,actor);
  assert.equal(denied.ciNativeEffect,undefined,kind);
 }
});

test('ordinary B result never gains CI-native permission from updater stdout',async t=>{
 const f=fixture(t,{applyResult:{status:'SUCCEEDED',code:'UPDATE_COMMITTED',
  actualControllerSha:TARGET,protectedStateUnchanged:true,
  ciNativeEffect:'A_READONLY',ciNativePolicySha256:'e'.repeat(64)}});
 await f.agent.pollOnce();
 const output=JSON.parse(f.remote.get(
  `repos/${REPO}/contents/results/maintenance-${REQUEST_ID}.json`).toString('utf8'));
 assert.equal(output.status,'SUCCEEDED');
 assert.equal(output.ciNativeEffect,undefined);
 assert.equal(output.ciNativePolicySha256,undefined);
});


test('public maintainer one-file handoff pins exact immutable source and leaves all B effects held',()=>{
 const target='feaf0a380890663d8881881bea63587576188c76';
 const previous=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/b08f3a482e9bb39523f47675ae06bc6e02e01d2d.json',import.meta.url),'utf8'));
 const approved=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/'+target+'.json',import.meta.url),'utf8'));
 assert.equal(previous.targetSha,'b08f3a482e9bb39523f47675ae06bc6e02e01d2d');
 assert.equal(approved.installedSha,previous.targetSha);
 assert.equal(approved.targetSha,target);
 assert.equal(approved.schema,'ZGMINI_MAINTENANCE_HANDOFF_V2');
 assert.equal(approved.transition,'SEVEN_TO_SEVEN');
 assert.equal(approved.scope,'COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE');
 assert.equal(requireHandoffApproval(approved,target,previous.targetSha),'SEVEN_TO_SEVEN');
 assert.throws(()=>requireHandoffApproval({...approved,approved:false},target,previous.targetSha),
  /HANDOFF_APPROVAL_REQUIRED/);
 assert.equal(Object.hasOwn(approved,'ciControllerBPolicy'),false);
 const source=[...nextRuntimeFiles,'tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs'];
 assert.deepEqual(Object.keys(approved.files).sort(),source.sort());
 const installedFiles=Object.fromEntries(nextRuntimeFiles.map(p=>[p,previous.files[p]]));
 assert.deepEqual(handoffFilePlan('SEVEN_TO_SEVEN',installedFiles,approved.files).writes,
  ['tools/maintenance-agent.mjs']);
 assert.deepEqual(approved.runtimeChangedFiles,['tools/maintenance-agent.mjs']);
 assert.equal(approved.files['tools/maintenance-agent.mjs'],
  '7c3f6318b07844aaba68cc6f24d5bc82a45d4cde9bd5291cd3e9948778c945c2');
 for(const rel of source){
  const bytes=execFileSync('git',['show',target+':'+rel],
   {cwd:new URL('../',import.meta.url),maxBuffer:5_000_000});
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
   approved.files[rel], 'approved immutable source: '+rel);
  if(rel!=='tools/maintenance-agent.mjs')
   assert.equal(approved.files[rel],previous.files[rel], 'unrelated file preserved: '+rel);
 }
});


test('public postcheck receiver handoff is exactly two source files with original installed CAS and Public B held',()=>{
 const source='feaf0a380890663d8881881bea63587576188c76';
 const target='3bed26ecabde1ac9046e000b1b32d912fa1ab53b';
 const before=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/'+source+'.json',import.meta.url),'utf8'));
 const candidate=JSON.parse(fs.readFileSync(new URL(
  '../approvals/maintenance-handoffs/'+target+'.json',import.meta.url),'utf8'));
 assert.equal(candidate.schema,'ZGMINI_MAINTENANCE_HANDOFF_V2');
 assert.equal(candidate.transition,'SEVEN_TO_SEVEN');
 assert.equal(candidate.installedSha,source);
 assert.equal(candidate.targetSha,target);
 assert.equal(candidate.approved,true);
 assert.equal(candidate.scope,'COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE');
 assert.equal(requireHandoffApproval(candidate,target,source),'SEVEN_TO_SEVEN');
 assert.throws(()=>requireHandoffApproval({...candidate,approved:false},target,source),
  /HANDOFF_APPROVAL_REQUIRED/);
 assert.throws(()=>requireHandoffApproval(candidate,target,'b'.repeat(40)),
  /HANDOFF_APPROVAL_REQUIRED/);
 assert.equal(Object.hasOwn(candidate,'ciControllerBPolicy'),false);
 const runtime=[...nextRuntimeFiles];
 const full=[...runtime,'tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs'];
 assert.deepEqual(Object.keys(candidate.files).sort(),full.sort());
 const planned=handoffFilePlan('SEVEN_TO_SEVEN',
  Object.fromEntries(runtime.map(rel=>[rel,before.files[rel]])),candidate.files);
 assert.deepEqual(planned.writes,[
  'tools/maintenance-contract.mjs','tools/update.mjs'
 ]);
 assert.deepEqual(candidate.runtimeChangedFiles,planned.writes);
 assert.deepEqual(planned.rollbackAdded,[]);
 assert.equal(candidate.files['tools/maintenance-contract.mjs'],
  '19bf293ab2647996fafd2a8380d463a525f2ecc9801c20de8fc437e08a9ed70a');
 assert.equal(candidate.files['tools/update.mjs'],
  '3a48d18dd6e58650ed351b5a75d54e3a91aa616d2d9bd995909ca1f3c1659594');
 const workingTree=new URL('../',import.meta.url);
 for(const rel of full){
  const prev=execFileSync('git',['show',source+':'+rel],
   {cwd:workingTree,maxBuffer:5_000_000});
  const next=execFileSync('git',['show',target+':'+rel],
   {cwd:workingTree,maxBuffer:5_000_000});
  assert.equal(crypto.createHash('sha256').update(prev).digest('hex'),
   before.files[rel],'existing C handoff raw byte CAS: '+rel);
  assert.equal(crypto.createHash('sha256').update(next).digest('hex'),
   candidate.files[rel],'new C handoff immutable raw byte CAS: '+rel);
  if(!planned.writes.includes(rel))
   assert.equal(before.files[rel],candidate.files[rel],
    'same installed source file remains unchanged: '+rel);
 }
 const handoffSource=fs.readFileSync(new URL('../tools/handoff-maintenance.mjs',import.meta.url),'utf8');
 assert.match(handoffSource,/requireNewReceiverOrigin\(/);
 assert.match(handoffSource,/HANDOFF_OPERATOR_WINDOWS_REQUIRED/);
 assert.match(handoffSource,/HANDOFF_MAIN_REQUIRED/);
 assert.match(handoffSource,/requireNoUnfinishedHandoff/);
});




test('Public publisher reads only independent installed 7-file grant and detects source drift',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ci-public-installed-read-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const files={};
 for(const rel of nextRuntimeFiles){
  const full=path.join(root,...rel.split('/'));
  fs.mkdirSync(path.dirname(full),{recursive:true});
  const bytes=Buffer.from('reviewed protected installed file '+rel+'\n');
  fs.writeFileSync(full,bytes);
  files[rel]=digest(bytes);
 }
 const installed={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha:'c'.repeat(40),startupSha256:'d'.repeat(64),files,
  ciControllerBPolicy:{schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V2',
   enabled:true,workflowId:430972394,
   workflowBlobSha:'f'.repeat(40),
   workflowPath:'.github/workflows/ci-approval-controller-b.yml',
   repositoryVisibility:'public',
   installedSha:INSTALLED,targetSha:TARGET,manifestSha256:'e'.repeat(64)}};
 const manifestPath=path.join(root,'MAINTENANCE_INSTALL.json');
 fs.writeFileSync(manifestPath,JSON.stringify(installed));
 const result=readIndependentlyInstalledControllerBPublisherPolicy({installRoot:root});
 assert.equal(result.ciControllerBPolicy.targetSha,TARGET);
 assert.equal(Object.isFrozen(result),true);
 const source=path.join(root,'tools','maintenance-agent.mjs');
 fs.appendFileSync(source,'\n// tampered\n');
 assert.throws(()=>readIndependentlyInstalledControllerBPublisherPolicy({installRoot:root}),
  /CI_PUBLIC_PUBLISHER_INSTALLED_POLICY_UNVERIFIED/);
 // Restoring fixture bytes is safe here; the operational files are untouched.
 fs.writeFileSync(source,'reviewed protected installed file tools/maintenance-agent.mjs\n');
 const v1=structuredClone(installed);
 v1.ciControllerBPolicy={
  schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V1',
  enabled:true,workflowId:430972394,workflowBlobSha:'f'.repeat(40),
  workflowPath:'.github/workflows/ci-approval-controller-b.yml'
 };
 fs.writeFileSync(manifestPath,JSON.stringify(v1));
 assert.throws(()=>readIndependentlyInstalledControllerBPublisherPolicy({installRoot:root}),
  /CI_PUBLIC_PUBLISHER_INSTALLED_POLICY_UNVERIFIED/);
 fs.writeFileSync(manifestPath,JSON.stringify(installed));
 fs.writeFileSync(source,'reviewed protected installed file tools/maintenance-agent.mjs\n');
 assert.equal(readIndependentlyInstalledControllerBPublisherPolicy({installRoot:root})
  .ciControllerBPolicy.repositoryVisibility,'public');
 fs.rmSync(source);
 try{
  fs.symlinkSync(path.join(root,'tools','maintenance-contract.mjs'),source,'file');
  assert.throws(()=>readIndependentlyInstalledControllerBPublisherPolicy({installRoot:root}),
   /CI_PUBLIC_PUBLISHER_INSTALLED_POLICY_UNVERIFIED/);
 }catch(e){
  if(!['EPERM','EACCES','ENOTSUP'].includes(e?.code))throw e;
 }
});

test('Public B publisher on hosted source CI is default-denied until exact installed policy',async()=>{
 const m=sampleRequest().manifest;
 // Approved two-file selective overlay: production B still requires a V2
 // one-effect manifest pin before any Issue POST.
 m.allowFiles=[
  {path:'config/operations.json',sha256:'a'.repeat(64)},
  {path:'controller/operations.mjs',sha256:'c'.repeat(64)}
 ];
 m.checks.manifestSha256=manifestFingerprint(m.allowFiles).sha256;
 m.controllerOnlyInstall=true;
 m.selectiveSource={schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',
  branch:'codex/publisher-scope-evidence',mainSha:'f'.repeat(40),
  customPaths:m.allowFiles.map(f=>f.path)};
 const bytes=Buffer.from(JSON.stringify(m));
 const input={targetSha:TARGET,approvalSha256:digest(bytes),runId:765,attempt:1};
 const repo={id:1442936296,full_name:REPO,private:false,
  owner:{id:327938088,login:ACTOR,type:'User'}};
 let reads=0,posts=0;
 const ports={readRepository:async()=>repo,
  readManifest:async()=>{reads++;return bytes;},
  createIssue:async()=>{posts++;throw Error('UNAUTHORIZED_POST');}};
 await assert.rejects(()=>submitExistingControllerApprovalFromCi(input,ports),
  /MAINTENANCE_CI_PUBLIC_POLICY_NOT_INSTALLED/);
 assert.equal(reads,0);assert.equal(posts,0);
 const installed=()=>({schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha:'c'.repeat(40),startupSha256:'d'.repeat(64),
  files:Object.fromEntries(['a','b','c','d','e','f','g'].map(x=>
   ['tools/'+x+'.mjs','e'.repeat(64)])),
  ciControllerBPolicy:{schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V2',
   enabled:true,workflowId:430972394,
   workflowBlobSha:'f'.repeat(40),
   workflowPath:'.github/workflows/ci-approval-controller-b.yml',
   repositoryVisibility:'public',installedSha:INSTALLED,
   targetSha:TARGET,manifestSha256:digest(bytes)}});
 ports.readIndependentInstalledCiPolicy=async()=>({
  ...installed(),ciControllerBPolicy:{...installed().ciControllerBPolicy,
   manifestSha256:'0'.repeat(64)}});
 await assert.rejects(()=>submitExistingControllerApprovalFromCi(input,ports),
  /MAINTENANCE_CI_PUBLIC_EFFECT_SCOPE_MISMATCH/);
 assert.equal(reads,0);assert.equal(posts,0);
 ports.readIndependentInstalledCiPolicy=async()=>installed();
 await assert.rejects(()=>submitExistingControllerApprovalFromCi(input,ports),
  /MAINTENANCE_CI_PUBLIC_PUBLISHER_IDENTITY_UNVERIFIED/);
 assert.equal(reads,0);assert.equal(posts,0);
 ports.readPublisherWorkflowIdentity=async()=>({
  workflowId:installed().ciControllerBPolicy.workflowId,
  workflowBlobSha:installed().ciControllerBPolicy.workflowBlobSha
 });
 const own={id:327938088,login:ACTOR,type:'User'};
 const pr={number:28,merged:true,merged_by:own,merge_commit_sha:'a'.repeat(40),
  base:{ref:'main',repo:{full_name:REPO}},
  head:{sha:'f'.repeat(40),repo:{full_name:REPO}}};
 const run={id:22,workflow_id:416355595,
  path:'.github/workflows/controller-maintenance-source-tests.yml',
  event:'pull_request',status:'completed',conclusion:'success',
  repository:{id:1442936296,full_name:REPO},head_repository:{id:1442936296},
  head_sha:pr.head.sha};
 let saved=null,actual=null;
 Object.assign(ports,{
  readMergedManifest:async()=>bytes,
  readApprovalPr:async()=>pr,listRuns:async()=>({workflow_runs:[run]}),
  readRun:async()=>run,loadReceipt:async()=>saved,
  findPriorRequests:async()=>[],
  saveReceipt:async(_effect,receipt,{exclusive=false}={})=>{
   if(exclusive&&saved)throw Error('DUPLICATE_RECEIPT');
   saved=structuredClone(receipt);
  },
  createIssue:async envelope=>{
   posts++;
   assert.equal(saved.phase,'CREATING');
   actual={number:42,state:'open',
    user:{login:CI_CONTROLLER_ACTOR,id:41898282,type:'Bot'},
    title:envelope.title,body:envelope.body,
    labels:envelope.labels.map(name=>({name}))};
   return {number:42};
  },
  readIssue:async()=>actual
 });
 const done=await submitExistingControllerApprovalFromCi(input,ports);
 assert.equal(done.status,'REQUEST_READBACK_VERIFIED');
 assert.equal(saved.phase,'READBACK_VERIFIED');
 assert.match(done.receiptMarker,/^ZGMINI_CI_CONTROLLER_B_RECEIPT=42:[a-f0-9]{64}$/);
 assert.equal(posts,1);assert.ok(reads>=1);
 const reused=await submitExistingControllerApprovalFromCi({...input,runId:777},ports);
 assert.equal(reused.status,'EXISTING_REQUEST_REUSED');
 assert.equal(reused.receiptMarker,undefined);
 assert.equal(posts,1);
});



test('verified Public B never enters configured approval PR merge before exact Owner approval',async()=>{
 const runtime=fs.readFileSync(new URL('../ci-approval/completed-run-intake.mjs',import.meta.url),'utf8');
 assert.match(runtime,/autoApprovalPolicy:allowPublic\?null:initialControllerPublicationPolicy\(policy\)/);
 assert.match(runtime,/if\(policy&&!allowPublic\)/);
 let reads=0,merges=0,posts=0,stages=0;
 const result=await publishConfiguredControllerApproval({
  action:'completed',repository:{id:1442936296,full_name:REPO,private:false}
 },{
  allowPublic:true,
  policy:{targetSha:TARGET,sourcePrNumber:10,approvalPrNumber:11},
  runId:765,attempt:1,
  getJson:async()=>{reads++;throw Error('PUBLIC_AUTO_MERGE_UNAUTHORIZED');},
  ports:{mergeApprovalPr:async()=>{merges++},createIssue:async()=>{posts++}},
  stageApprovalPr:async()=>{stages++;throw Error('PUBLIC_STAGING_UNAUTHORIZED');},
  emitReceipt:()=>assert.fail('no Public configured receipt')
 });
 assert.deepEqual(result,{state:'DISABLED',code:'CI_PUBLIC_CONFIGURED_MERGE_NOT_AUTHORIZED',results:[]});
 assert.equal(reads,0);assert.equal(merges,0);assert.equal(posts,0);assert.equal(stages,0);
});


test('new Public B submission branch is separately opt-in and bound to installed Windows B pin',()=>{
 const workflow=fs.readFileSync(new URL('../.github/workflows/ci-approval-controller-b.yml',import.meta.url),'utf8');
 const section=workflow.slice(workflow.indexOf('  submit-controller-b:'));
 const trigger=workflow.slice(0,workflow.indexOf('\npermissions:'));
 assert.match(section,/vars\.ZGMINI_CI_CONTROLLER_B_ENABLED == 'true'/);
 assert.match(section,/github\.event\.repository\.private == true/);
 assert.match(section,/github\.event\.repository\.private == false/);
 assert.match(section,/vars\.ZGMINI_CI_CONTROLLER_B_PUBLIC_EFFECT_APPROVED == 'true'/);
 assert.match(section,/github\.event\.workflow_run\.workflow_id == 416355595/);
 assert.match(section,/github\.event\.workflow_run\.conclusion == 'success'/);
 assert.match(section,/github\.event\.workflow_run\.head_repository\.id == 1442936296/);
 assert.match(section,/name: Checkout existing Private B source pin\s+if: github\.event\.repository\.private == true/);
 assert.match(section,/ref: cfe57f3d720219613c87eff21338de0d35edbf6b/);
 assert.match(section,/name: Checkout separately approved Public B candidate source pin\s+if: github\.event\.repository\.private == false/);
 assert.match(section,/ref: 4d3fe664a90f2e8c3dea885559b1ec263df66a24/);
 assert.match(section,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
 assert.match(section,/persist-credentials: false/);
 assert.match(section,/run: node ci-approval\/completed-run-intake\.mjs --publish-existing/);
 assert.doesNotMatch(trigger,/workflow_dispatch:|schedule:|pull_request:/);
 // This flag merely permits the hosted workflow to reach its fixed caller.
 // Windows itself must have a separately approved exact V2 one-effect grant.
 const publisher=fs.readFileSync(new URL('../ci-approval/completed-run-intake.mjs',import.meta.url),'utf8');
 assert.match(publisher,/readIndependentlyInstalledControllerBPublisherPolicy\(\)/);
 assert.match(publisher,/readAuthenticatedControllerBPublisherWorkflow\(\{getJson\}\)/);
 assert.match(publisher,/publicEffectPin=grant\.targetSha/);
 const receiver=fs.readFileSync(new URL('../tools/maintenance-agent.mjs',import.meta.url),'utf8');
 assert.match(receiver,/PUBLIC_B_EFFECT_SEPARATE_AUTH_REQUIRED/);
 assert.match(receiver,/installedControllerBPolicy\(JSON\.parse\(fs\.readFileSync/);
});

test('Public source event stays Private-only by default but is observable with verified caller scope',async()=>{
 const repo={id:1442936296,full_name:REPO,private:false};
 const run={id:45623579994,run_attempt:1,workflow_id:416355595,
  path:'.github/workflows/controller-maintenance-source-tests.yml',
  event:'pull_request',repository:repo,head_repository:repo,
  head_sha:'a'.repeat(40),status:'completed',conclusion:'success'};
 const event={action:'completed',repository:repo,workflow_run:run};
 let reads=0;
 const getRun=async()=>{reads++;return structuredClone(run);};
 const blocked=await observeCompletedRun(event,{getRun});
 assert.equal(blocked.state,'IGNORED');assert.equal(reads,0);
 const seen=await observeCompletedRun(event,{getRun,allowPublic:true});
 assert.equal(seen.state,'CI_COMPLETION_OBSERVED_ONLY');
 assert.equal(seen.headSha,run.head_sha);assert.equal(seen.canPublish,false);
 assert.equal(seen.canExecute,false);assert.equal(reads,1);
 for(const drift of [
  e=>e.workflow_run.head_repository.id=123,
  e=>e.workflow_run.repository.private=true,
  e=>e.repository.private=true,
  e=>e.workflow_run.conclusion='failure',
  e=>e.workflow_run.workflow_id=1
 ]){
  const e=structuredClone(event);drift(e);reads=0;
  const denied=await observeCompletedRun(e,{getRun,allowPublic:true});
  assert.equal(denied.state,'IGNORED');assert.equal(reads,0);
 }
 const late=await observeLateOwnerMergedControllerApproval(event,{
  getJson:async route=>route==='actions/runs/'+run.id?run:
   route==='commits/'+run.head_sha+'/pulls?per_page=100'?[]:
   assert.fail('unexpected API route'),allowPublic:true});
 assert.equal(late.state,'IGNORED');
 assert.equal(late.canPublish,false);
 const lateBlocked=await observeLateOwnerMergedControllerApproval(event,{
  getJson:()=>assert.fail('default Private does not read a Public event')});
 assert.equal(lateBlocked.state,'IGNORED');
});

test('Public approval main event reaches read-only intake only under explicit verified scope',async()=>{
 const repo={id:1442936296,full_name:REPO,private:false};
 const before='a'.repeat(40),after='b'.repeat(40);
 const event={repository:repo,ref:'refs/heads/main',deleted:false,
  forced:false,before,after};
 let reads=0;
 const getJson=async route=>{
  reads++;
  assert.equal(route,'compare/'+before+'...'+after);
  return {status:'ahead',behind_by:0,base_commit:{sha:before},
   merge_base_commit:{sha:before},files:[]};
 };
 assert.equal((await observePublishedControllerApprovals(event,{getJson})).state,'IGNORED');
 assert.equal(reads,0);
 const observed=await observePublishedControllerApprovals(event,{getJson,allowPublic:true});
 assert.equal(observed.state,'IGNORED','unrelated changes do not issue approval');
 assert.equal(observed.reason,'NO_CONTROLLER_APPROVAL_CHANGE');
 assert.equal(reads,1);assert.equal(observed.canExecute,false);
 const pushed=await publishExistingControllerApprovals(event,{
  getJson,allowPublic:true,publicEffectPin:TARGET,runId:123,attempt:1,
  ports:{createIssue:()=>assert.fail('unrelated source cannot POST')},
  emitReceipt:()=>assert.fail('unrelated source cannot issue receipt')});
 assert.equal(pushed.state,'IGNORED');
 assert.equal(reads,2);
 const wrong={...event,repository:{...repo,id:1}};
 assert.equal((await observePublishedControllerApprovals(wrong,{
  getJson:()=>assert.fail('foreign repo cannot read'),allowPublic:true})).state,'IGNORED');
});

test('Public run cannot use legacy Private-only publisher flag or unverified output as authority',async()=>{
 const repo={id:1442936296,full_name:REPO,private:false};
 const run={id:765,run_attempt:1,workflow_id:416355595,
  path:'.github/workflows/controller-maintenance-source-tests.yml',
  event:'pull_request',repository:repo,head_repository:repo,
  head_sha:'a'.repeat(40),status:'completed',conclusion:'success'};
 const event={action:'completed',repository:repo,workflow_run:run};
 const blocked=await publishLateOwnerMergedControllerApproval(event,{
  getJson:()=>assert.fail('unverified Public must not read'),
  ports:{createIssue:()=>assert.fail('unverified Public must not post')},
  runId:765,attempt:1,emitReceipt:()=>assert.fail('no receipt')});
 assert.equal(blocked.state,'IGNORED');
 assert.deepEqual(blocked.results,[]);
 const allowed=await publishLateOwnerMergedControllerApproval(event,{
  allowPublic:true,publicEffectPin:TARGET,
  getJson:async route=>route==='actions/runs/'+run.id?run:
   route==='commits/'+run.head_sha+'/pulls?per_page=100'?[]:
   assert.fail('unexpected read'),
  ports:{createIssue:()=>assert.fail('no approval PR, no post')},
  runId:765,attempt:1,emitReceipt:()=>assert.fail('no receipt')});
 assert.equal(allowed.state,'IGNORED');
 assert.deepEqual(allowed.results,[]);
});


test('Public B publisher cannot scan or post without the installed one-effect target pin',async()=>{
 const repo={id:1442936296,full_name:REPO,private:false};
 const before='a'.repeat(40),after='d'.repeat(40);
 const event={repository:repo,ref:'refs/heads/main',deleted:false,
  forced:false,before,after};
 let calls=0;
 const denied=await publishExistingControllerApprovals(event,{
  allowPublic:true,getJson:async()=>{calls++;throw Error('MUST_NOT_READ');},
  ports:{createIssue:()=>assert.fail('no Issue')},
  runId:12,attempt:1,emitReceipt:()=>assert.fail('no receipt')
 });
 assert.deepEqual(denied,{state:'EVIDENCE_MISSING',code:'CI_PUBLIC_EFFECT_PIN_REQUIRED',results:[]});
 assert.equal(calls,0);
 const run={id:765,run_attempt:1,workflow_id:416355595,
  path:'.github/workflows/controller-maintenance-source-tests.yml',
  event:'pull_request',repository:repo,head_repository:repo,
  head_sha:'e'.repeat(40),status:'completed',conclusion:'success'};
 const fromRun=await publishLateOwnerMergedControllerApproval({
  action:'completed',repository:repo,workflow_run:run
 },{
  allowPublic:true,getJson:async()=>{calls++;throw Error('MUST_NOT_READ');},
  ports:{createIssue:()=>assert.fail('no Issue')},
  runId:12,attempt:1,emitReceipt:()=>assert.fail('no receipt')
 });
 assert.equal(fromRun.code,'CI_PUBLIC_EFFECT_PIN_REQUIRED');
 assert.equal(calls,0);
});

test('one installed Public B pin isolates two approvals on main push and source completion',async()=>{
 const repo={id:1442936296,full_name:REPO,private:false};
 const other='c'.repeat(40),head='e'.repeat(40),merge='f'.repeat(40);
 const before='a'.repeat(40),after='d'.repeat(40);
 const wanted='approvals/controller-updates/'+TARGET+'.json';
 const unrelated='approvals/controller-updates/'+other+'.json';
 const payload={schema:'ZGMINI_PC_UPDATE_V1',targetSha:TARGET,
  purpose:'pc-controller-maintenance',controllerOnlyInstall:true,
  selectiveSource:{branch:'codex/exact-owner-approval'},
  approval:{ref:'https://github.com/'+REPO+'/pull/28'}};
 const bytes=Buffer.from(JSON.stringify(payload));
 const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length))
  .update(Buffer.from([0])).update(bytes).digest('hex');
 const file={type:'file',path:wanted,encoding:'base64',
  sha:blob,content:bytes.toString('base64')};
 const pr={number:28,merged:true,merged_at:'2026-11-28T00:00:00Z',
  merged_by:{login:ACTOR,id:327938088,type:'User'},
  merge_commit_sha:merge,base:{ref:'main',repo},head:{sha:head,repo}};
 const run={id:765,run_attempt:1,workflow_id:416355595,
  path:'.github/workflows/controller-maintenance-source-tests.yml',
  event:'pull_request',repository:repo,head_repository:repo,
  head_sha:head,status:'completed',conclusion:'success'};
 const calls=[],getJson=async route=>{
  calls.push(route);
  if(route==='compare/'+before+'...'+after)
   return {status:'ahead',behind_by:0,base_commit:{sha:before},
    merge_base_commit:{sha:before},files:[
      {filename:unrelated,status:'modified',sha:'0'.repeat(40)},
      {filename:wanted,status:'added',sha:blob}]};
  if(route==='contents/'+wanted+'?ref='+after||
     route==='contents/'+wanted+'?ref='+merge||
     route==='contents/'+wanted+'?ref=main')return file;
  if(route==='pulls/28')return pr;
  if(route==='commits/'+head+'/pulls?per_page=100')
   return [{number:28,merged_at:pr.merged_at}];
  if(route==='pulls/28/files?per_page=100')
   return [{filename:unrelated,status:'modified',sha:'0'.repeat(40)},
    {filename:wanted,status:'added',sha:blob}];
  if(route==='actions/workflows/416355595/runs?head_sha='+head+
    '&event=pull_request&status=success&per_page=100')
   return {workflow_runs:[run]};
  if(route==='actions/runs/765')return run;
  throw Error('unexpected API route: '+route);
 };
 const pushed={repository:repo,ref:'refs/heads/main',deleted:false,
  forced:false,before,after};
 const observed=await observePublishedControllerApprovals(pushed,{
  getJson,allowPublic:true,publicEffectPin:TARGET});
 assert.equal(observed.state,'APPROVAL_PUBLICATION_OBSERVED_ONLY');
 assert.deepEqual(observed.entries.map(x=>x.targetSha),[TARGET]);
 assert.equal(observed.entries[0].ciState,'SOURCE_CI_MATCH_ONLY');
 assert.equal(calls.some(x=>x.includes(other)),false);
 let submits=0;
 const ports={readRepository:async()=>{submits++;return null;},
  createIssue:()=>assert.fail('no authorized source may post')};
 const published=await publishExistingControllerApprovals(pushed,{
  getJson,ports,allowPublic:true,publicEffectPin:TARGET,
  runId:123,attempt:1,emitReceipt:()=>assert.fail('no receipt')});
 assert.equal(published.results.length,1);
 assert.equal(published.results[0].targetSha,TARGET);
 assert.equal(published.results[0].code,'MAINTENANCE_CI_REPOSITORY_DENIED');
 assert.equal(submits,1,'only the installed target enters strict submitter');
 const event={action:'completed',repository:repo,workflow_run:run};
 const late=await observeLateOwnerMergedControllerApproval(event,{
  getJson,allowPublic:true,publicEffectPin:TARGET});
 assert.equal(late.state,'OWNER_APPROVAL_RUN_OBSERVED_ONLY');
 assert.deepEqual(late.entries.map(x=>x.targetSha),[TARGET]);
 assert.equal(calls.some(x=>x.includes(other)),false);
 const afterLate=await publishLateOwnerMergedControllerApproval(event,{
  getJson,ports,allowPublic:true,publicEffectPin:TARGET,
  runId:124,attempt:1,emitReceipt:()=>assert.fail('no receipt')});
 assert.deepEqual(afterLate.results.map(x=>x.targetSha),[TARGET]);
 assert.equal(submits,2,'both publication paths stay limited to the same installed target');
});


test('Public B publisher requires exact checked-out source to be ancestor of authenticated main',async()=>{
 const source='a'.repeat(40),main='b'.repeat(40);
 const env={GITHUB_WORKSPACE:'/tmp/ci-isolated-source',
  GITHUB_REPOSITORY:REPO,GITHUB_REF:'refs/heads/main',
  GITHUB_WORKFLOW_SHA:main};
 let reads=0,compares=0;
 const getJson=async route=>{
  reads++;
  assert.equal(route,'compare/'+source+'...'+main);
  compares++;
  return {status:'ahead',behind_by:0,
   base_commit:{sha:source},head_commit:{sha:main},
   merge_base_commit:{sha:source}};
 };
 const accepted=await readAuthenticatedPublicBPublisherSourceAncestry({
  env,getJson,readCheckoutSha:async()=>source});
 assert.deepEqual(accepted,{sourceSha:source,mainSha:main});
 assert.equal(Object.isFrozen(accepted),true);
 assert.equal(reads,1);
 const identical=await readAuthenticatedPublicBPublisherSourceAncestry({
  env,getJson:async route=>{
   assert.equal(route,'compare/'+main+'...'+main);
   return {status:'identical',behind_by:0,
    base_commit:{sha:main},head_commit:{sha:main},
    merge_base_commit:{sha:main}};
  },readCheckoutSha:()=>main});
 assert.equal(identical.sourceSha,main);
 for(const failure of [
  {name:'unmerged candidate branch',data:{status:'diverged',behind_by:1,
   base_commit:{sha:source},head_commit:{sha:main},merge_base_commit:{sha:'c'.repeat(40)}}},
  {name:'post-squash source not in main ancestry',data:{status:'ahead',
   behind_by:0,base_commit:{sha:source},head_commit:{sha:main},
   merge_base_commit:{sha:'c'.repeat(40)}}},
  {name:'main moved backwards from source',data:{status:'behind',
   behind_by:2,base_commit:{sha:source},head_commit:{sha:main},
   merge_base_commit:{sha:main}}},
  {name:'forged API head',data:{status:'ahead',behind_by:0,
   base_commit:{sha:source},head_commit:{sha:'c'.repeat(40)},
   merge_base_commit:{sha:source}}},
  {name:'missing compare readback',data:null}
 ]){
  await assert.rejects(()=>readAuthenticatedPublicBPublisherSourceAncestry({
   env,readCheckoutSha:()=>source,getJson:async()=>failure.data}),
   /CI_PUBLIC_PUBLISHER_MAIN_ANCESTRY_UNVERIFIED/,failure.name);
 }
 for(const invalid of [
  {...env,GITHUB_REPOSITORY:'attacker/repo'},
  {...env,GITHUB_REF:'refs/heads/candidate'},
  {...env,GITHUB_WORKFLOW_SHA:'bad'},
  {...env,GITHUB_WORKSPACE:'relative/checkout'}
 ]){
  await assert.rejects(()=>readAuthenticatedPublicBPublisherSourceAncestry({
   env:invalid,readCheckoutSha:()=>{throw Error('must not call git');},
   getJson:()=>{throw Error('must not read GitHub');}}),
   /CI_PUBLIC_PUBLISHER_MAIN_ANCESTRY_UNVERIFIED/);
 }
 await assert.rejects(()=>readAuthenticatedPublicBPublisherSourceAncestry({
  env,readCheckoutSha:()=>{throw Error('checkout unknown');},getJson}),
  /CI_PUBLIC_PUBLISHER_MAIN_ANCESTRY_UNVERIFIED/);
 assert.equal(compares,1,'only approved provenance triggered the readback');
});

test('Public running publisher workflow attestation binds authenticated immutable GitHub API bytes',async()=>{
 const workflow='.github/workflows/ci-approval-controller-b.yml';
 const bytes=Buffer.from('name: Exact reviewed CI Publisher\non: workflow_run\n');
 const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length))
  .update(Buffer.from([0])).update(bytes).digest('hex');
 const env={GITHUB_REPOSITORY:REPO,GITHUB_REF:'refs/heads/main',
  GITHUB_WORKFLOW_REF:REPO+'/'+workflow+'@refs/heads/main',
  GITHUB_WORKFLOW_SHA:'a'.repeat(40),GITHUB_JOB:'submit-controller-b',
  GITHUB_RUN_ID:'22',GITHUB_RUN_ATTEMPT:'1'};
 const api=async route=>{
  if(route==='actions/workflows/ci-approval-controller-b.yml')
   return {id:123456,state:'active',path:workflow};
  if(route==='contents/'+workflow+'?ref='+env.GITHUB_WORKFLOW_SHA)
   return {type:'file',path:workflow,encoding:'base64',sha:blob,
    content:bytes.toString('base64')};
  throw Error('denied');
 };
 const proof=await readAuthenticatedControllerBPublisherWorkflow({env,getJson:api});
 assert.deepEqual(proof,{workflowId:123456,workflowBlobSha:blob});
 assert.equal(Object.isFrozen(proof),true);
 for(const patch of [
  x=>x.GITHUB_WORKFLOW_REF=REPO+'/'+workflow+'@refs/heads/topic',
  x=>x.GITHUB_JOB='observe-public-source',
  x=>x.GITHUB_WORKFLOW_SHA='main',
  x=>x.GITHUB_REPOSITORY='attacker/repo',
  x=>x.GITHUB_REF='refs/heads/topic',
  x=>x.GITHUB_RUN_ATTEMPT='0'
 ]){
  const v={...env};patch(v);
  await assert.rejects(()=>readAuthenticatedControllerBPublisherWorkflow({
   env:v,getJson:()=>assert.fail('untrusted event may not request API')}),
   /CI_PUBLIC_PUBLISHER_WORKFLOW_UNVERIFIED/);
 }
 for(const bad of [
  {id:222,state:'disabled_manually',path:workflow},
  {id:222,state:'active',path:'unrelated.yml'}
 ]){
  await assert.rejects(()=>readAuthenticatedControllerBPublisherWorkflow({
   env,getJson:route=>route.startsWith('actions/')?bad:api(route)}),
   /CI_PUBLIC_PUBLISHER_WORKFLOW_UNVERIFIED/);
 }
 for(const file of [
  {type:'file',path:workflow,encoding:'base64',sha:blob,
   content:Buffer.from('tampered').toString('base64')},
  {type:'file',path:workflow,encoding:'base64',sha:'f'.repeat(40),
   content:bytes.toString('base64')},
  {type:'file',path:'attacker.yml',encoding:'base64',sha:blob,
   content:bytes.toString('base64')}
 ]){
  await assert.rejects(()=>readAuthenticatedControllerBPublisherWorkflow({
   env,getJson:route=>route.startsWith('actions/')?{
    id:123456,state:'active',path:workflow
   }:file}),/CI_PUBLIC_PUBLISHER_WORKFLOW_UNVERIFIED/);
 }
});

test('Public B stays blocked without an independently installed V2 grant, including bot spoof',async t=>{
 const f=fixture(t,{privateRepo:false,actor:CI_CONTROLLER_ACTOR});
 const result=await f.agent.processIssue(f.issue);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'PUBLIC_B_EFFECT_SEPARATE_AUTH_REQUIRED');
 assert.equal(result.effectAuthorized,false);
 assert.equal(result.operationalWrites,0);
 assert.equal(f.stats.applies,0);assert.equal(f.stats.manifestReads,0);
 assert.equal(f.agent.loadLedger(REQUEST_ID),null);
});

function publicBAuthFixture(){
 const path='.github/workflows/ci-approval-controller-b.yml';
 const workflow=Buffer.from('reviewed Public B source workflow fixture\\n');
 const blob=crypto.createHash('sha1').update(Buffer.from('blob '+workflow.length))
  .update(Buffer.from([0])).update(workflow).digest('hex');
 const manifest=sampleRequest(),request={...manifest.issue,chatId:'chat-ci-765-1'};
 const requestBytes=Buffer.from(JSON.stringify(request));
 const installed={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha:'c'.repeat(40),startupSha256:'d'.repeat(64),
  files:Object.fromEntries(['a','b','c','d','e','f','g'].map(x=>['tools/'+x+'.mjs','e'.repeat(64)])),
  ciControllerBPolicy:{schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V2',
    enabled:true,workflowId:123456,workflowBlobSha:blob,workflowPath:path,
    repositoryVisibility:'public',installedSha:INSTALLED,targetSha:TARGET,
    manifestSha256:request.approvalManifestSha256}};
 const policy=installedControllerBPolicy(installed);
 const run={id:765,run_attempt:1,workflow_id:123456,path,
  repository:{id:1442936296,full_name:REPO,private:false},
  head_repository:{id:1442936296,full_name:REPO,private:false},
  head_branch:'main',head_sha:'b'.repeat(40),event:'workflow_run',
  status:'completed',conclusion:'success'};
 const job={id:888,run_id:765,run_attempt:1,head_sha:run.head_sha,
  name:'submit-controller-b',status:'completed',conclusion:'success',
  steps:[{name:'Record Controller B request receipt',status:'completed',conclusion:'success'}]};
 const actual={number:42,title:'pc-controller-update',state:'open',
  user:{id:41898282,type:'Bot',login:CI_CONTROLLER_ACTOR},
  labels:[{name:'pc-maintenance'}],body:requestBytes.toString('utf8')};
 const proof={
  issueNumber:42,requestBytes,runId:765,attempt:1,policy,
  getJson:async route=>{
   if(route==='actions/runs/765/attempts/1')return run;
   if(route==='contents/'+path+'?ref='+run.head_sha)return {type:'file',
    path,sha:blob,encoding:'base64',content:workflow.toString('base64')};
   if(route==='actions/runs/765/attempts/1/jobs?per_page=100')
    return {total_count:1,jobs:[job]};
   throw Error('unexpected GitHub API route');
  },
  readJobLogs:async id=>id===888?
   '2026-11-28T00:00:00Z '+controllerBReceiptMarker(42,requestBytes)+'\n':''
 };
 return {installed,policy,run,job,actual,request,proof};
}

test('Public receiver poll performs exact installed V2 CI proof, one isolated apply and no retry',async t=>{
 const p=publicBAuthFixture();
 const f=fixture(t,{privateRepo:false,actor:'app/github-actions',
  requestPatch:{chatId:'chat-ci-765-1'},
  manifestPatch:{controllerOnlyInstall:true,selectiveSource:{
    schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',
    branch:'codex/ci-public-effect-review',mainSha:'e'.repeat(40),customPaths:[]}},
  installedCiPolicy:(_issue,raw)=>({...p.installed,ciControllerBPolicy:{
    ...p.installed.ciControllerBPolicy,manifestSha256:digest(raw)}}),
  publicCiProof:{actual:p.actual,getJson:p.proof.getJson,
    readJobLogs:(id,issue)=>id===p.job.id?
      '2026-11-28T00:00:00Z '+controllerBReceiptMarker(issue.number,Buffer.from(issue.body))+'\n':''}
 });
 const observed=await f.agent.pollOnce();
 const successful=observed.find(x=>x.status==='SUCCEEDED');
 assert.equal(observed[0]?.status,'SUCCEEDED',
   'authenticated Public B effect cannot be mislabeled source-only');
 assert.equal(successful?.code,'UPDATE_COMMITTED',JSON.stringify(observed));
 assert.equal(f.stats.applies,1);
 assert.equal(f.stats.manifestReads,1);
 assert.equal(f.agent.loadLedger(f.request.requestId)?.status,'SUCCEEDED');
 assert.equal(f.remote.size,2,'sanitized JSON and TXT pair');
 const again=await f.agent.pollOnce();
 assert.equal(again.find(x=>x.code==='DUPLICATE_REQUEST_SUPPRESSED')?.status,
   'SUCCEEDED','existing completed ledger status is preserved on duplicate');
 assert.equal(f.stats.applies,1,'one approved B effect is never reinstalled');
});

test('Public receiver accepts exact approved operations config plus Controller module via V2 receipt',async t=>{
 const p=publicBAuthFixture();
 const files=[
  {path:'config/operations.json',sha256:'a'.repeat(64)},
  {path:'controller/operations.mjs',sha256:'c'.repeat(64)}
 ];
 const f=fixture(t,{privateRepo:false,actor:'app/github-actions',
  requestPatch:{chatId:'chat-ci-765-1'},
  manifestPatch:{allowFiles:files,checks:{targetSha:TARGET,status:'PASS',
   manifestSha256:manifestFingerprint(files).sha256},
   controllerOnlyInstall:true,selectiveSource:{
    schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',
    branch:'codex/ci-public-effect-review',mainSha:'e'.repeat(40),
    customPaths:files.map(x=>x.path)}},
  installedCiPolicy:(_issue,raw)=>({...p.installed,ciControllerBPolicy:{
   ...p.installed.ciControllerBPolicy,manifestSha256:digest(raw)}}),
  publicCiProof:{actual:p.actual,getJson:p.proof.getJson,
   readJobLogs:(id,issue)=>id===p.job.id?
    '2026-11-28T00:00:00Z '+controllerBReceiptMarker(issue.number,Buffer.from(issue.body))+'\n':''}
 });
 const observed=await f.agent.pollOnce();
 assert.equal(observed.find(x=>x.status==='SUCCEEDED')?.code,'UPDATE_COMMITTED',JSON.stringify(observed));
 assert.equal(f.stats.applies,1);assert.equal(f.stats.manifestReads,1);
 assert.equal(f.remote.size,2,'the original JSON/TXT receipt pair remains required');
 assert.equal(f.agent.loadLedger(f.request.requestId)?.status,'SUCCEEDED');
});

test('Public receiver rejects spoofed CI issue despite pinned V2 grant without an apply',async t=>{
 const p=publicBAuthFixture();
 const f=fixture(t,{privateRepo:false,actor:CI_CONTROLLER_ACTOR,
  requestPatch:{chatId:'chat-ci-765-1'},
  installedCiPolicy:(_issue,raw)=>({...p.installed,ciControllerBPolicy:{
    ...p.installed.ciControllerBPolicy,manifestSha256:'0'.repeat(64)}}),
  publicCiProof:{actual:p.actual,getJson:p.proof.getJson,
    readJobLogs:(id,issue)=>id===p.job.id?
      '2026-11-28T00:00:00Z '+controllerBReceiptMarker(issue.number,Buffer.from(issue.body))+'\n':''}
 });
 const observed=await f.agent.pollOnce();
 assert.equal(observed.find(x=>x.status==='BLOCKED')?.code,
   'CI_PUBLIC_EFFECT_SCOPE_MISMATCH',JSON.stringify(observed));
 assert.equal(f.stats.applies,0);assert.equal(f.stats.manifestReads,0);
 assert.equal(f.agent.loadLedger(f.request.requestId),null);
});

test('Public GitHub CLI app alias alone cannot spoof REST Bot admission',async t=>{
 const p=publicBAuthFixture();
 const f=fixture(t,{privateRepo:false,actor:'app/github-actions',
  requestPatch:{chatId:'chat-ci-765-1'},
  installedCiPolicy:(_issue,raw)=>({...p.installed,ciControllerBPolicy:{
    ...p.installed.ciControllerBPolicy,manifestSha256:digest(raw)}}),
  publicCiProof:{actual:{...p.actual,user:{...p.actual.user,id:1}},
    getJson:p.proof.getJson,
    readJobLogs:(id,issue)=>id===p.job.id?
      '2026-11-28T00:00:00Z '+controllerBReceiptMarker(issue.number,Buffer.from(issue.body))+'\n':''}
 });
 const observed=await f.agent.pollOnce();
 assert.equal(observed.find(x=>x.status==='BLOCKED')?.code,
   'CI_ISSUE_ORIGIN_DENIED',JSON.stringify(observed));
 assert.equal(f.stats.applies,0);
 assert.equal(f.stats.manifestReads,0);
 assert.equal(f.agent.loadLedger(f.request.requestId),null);
});

test('independent installed V2 exact public effect authenticates only original CI workload',async()=>{
 const f=publicBAuthFixture();
 assert.deepEqual(Object.keys(f.policy).sort(),
  ['workflowId','workflowBlobSha','repositoryVisibility','installedSha',
   'targetSha','manifestSha256'].sort());
 assert.equal(Object.isFrozen(f.policy),true);
 const proof=await verifyControllerBIdentity(f.proof);
 assert.equal(proof.state,'CI_WORKLOAD_IDENTITY_VERIFIED_ONLY');
 assert.equal(proof.issueNumber,42);
 assert.equal(proof.canPublish,false);assert.equal(proof.canExecute,false);
 const admission=await authenticateControllerBIssue(f.actual,{policy:f.policy,
  getJson:f.proof.getJson,readJobLogs:f.proof.readJobLogs});
 assert.equal(admission.state,'CI_WORKLOAD_IDENTITY_VERIFIED_ONLY');
 assert.ok(admission.authorization);
 assert.equal(admission.canExecute,false);
 assert.equal((await authenticateControllerBIssue(f.actual,{policy:null,
  getJson:f.proof.getJson,readJobLogs:f.proof.readJobLogs})).state,'DISABLED');
});

test('public B installed scope rejects extra fields, malformed pins and implicit visibility',()=>{
 const f=publicBAuthFixture();
 const mutate=[
  x=>x.ciControllerBPolicy.targetSha='f'.repeat(40),
  x=>x.ciControllerBPolicy.targetSha=x.ciControllerBPolicy.installedSha,
  x=>x.ciControllerBPolicy.manifestSha256='incorrect',
  x=>x.ciControllerBPolicy.repositoryVisibility='private',
  x=>x.ciControllerBPolicy.workflowBlobSha='invalid',
  x=>x.ciControllerBPolicy.enabled=false,
  x=>x.ciControllerBPolicy.extra='allow',
  x=>x.ciControllerBPolicy.workflowPath='not-reviewed.yml',
  x=>x.sourceSha='invalid',
  x=>x.files={}
 ];
 for(const patch of mutate){
  const v=structuredClone(f.installed);patch(v);
  if(v.ciControllerBPolicy.targetSha==='f'.repeat(40)){
   // A different well-formed target is a *different installed grant*, not
   // proof of authority for the original target.
   assert.notEqual(installedControllerBPolicy(v).targetSha,f.policy.targetSha);
  }else assert.throws(()=>installedControllerBPolicy(v),/CI_INSTALLED_POLICY_INVALID/);
 }
});

test('Public B requires exact pinned request, origin and run receipt',async()=>{
 const f=publicBAuthFixture();
 const context={policy:f.policy,getJson:f.proof.getJson,
  readJobLogs:f.proof.readJobLogs};
 const denied=[
  [{...f.actual,body:JSON.stringify({...f.request,targetControllerSha:'f'.repeat(40)})},
   'CI_PUBLIC_EFFECT_SCOPE_MISMATCH'],
  [{...f.actual,body:JSON.stringify({...f.request,approvalManifestSha256:'0'.repeat(64)})},
   'CI_PUBLIC_EFFECT_SCOPE_MISMATCH'],
  [{...f.actual,user:{id:123,type:'Bot',login:CI_CONTROLLER_ACTOR}},
   'CI_ISSUE_ORIGIN_DENIED'],
  [{...f.actual,labels:[{name:'bug'}]},'CI_ISSUE_ORIGIN_DENIED'],
  [{...f.actual,state:'closed'},'CI_ISSUE_ORIGIN_DENIED']
 ];
 for(const [issue,code] of denied){
  const r=await authenticateControllerBIssue(issue,context);
  assert.equal(r.code,code);assert.equal(r.authorization,undefined);
 }
 f.run.repository.private=true;
 assert.equal((await verifyControllerBIdentity(f.proof)).code,'CI_RUN_IDENTITY_MISMATCH');
 f.run.repository.private=false;f.run.head_repository.private=true;
 assert.equal((await verifyControllerBIdentity(f.proof)).code,'CI_RUN_IDENTITY_MISMATCH');
 f.run.head_repository.private=false;f.job.conclusion='skipped';
 assert.equal((await verifyControllerBIdentity(f.proof)).code,'CI_JOB_IDENTITY_MISMATCH');
 f.job.conclusion='success';
 const swapped=await verifyControllerBIdentity({...f.proof,issueNumber:43});
 assert.equal(swapped.code,'CI_RECEIPT_ISSUE_OR_BYTES_MISMATCH');
});

// Public GitHub-hosted source-only CI runs the fixed Writer B COM probe
// in Node vm with injected fixtures; no Windows API/PC action is invoked.
import '../r17-writer-b/r17-b-windows-probe.test.mjs';
