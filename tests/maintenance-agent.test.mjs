import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {test} from "node:test";

import {createMaintenanceAgent,failedUpdaterResult,normalizedResult} from "../tools/maintenance-agent.mjs";
import {prepareMaintenanceIssue} from '../tools/maintenance-request.mjs';

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
import {manifestFingerprint,R54_B_SOURCE_FILES,R54_B_OPERATION,R54_B_ISSUE_TITLE} from "../tools/maintenance-contract.mjs";

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
  s6ApplyRaw=null}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"zgmini-maintainer-agent-test-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const leaseRoot=path.join(root,"leases");fs.mkdirSync(leaseRoot);
  const example=sampleRequest();
  const manifest={...example.manifest,...manifestPatch};
  const rawManifest=Buffer.from(JSON.stringify(manifest));
  const request={...example.issue,approvalManifestSha256:digest(rawManifest)};
  const issue={number:72,title,state:"OPEN",body:JSON.stringify(request),
    author:{login:actor},labels:labels.map(name=>({name})),comments:[],...issuePatch};
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
      assert.equal(packaged.actor,ACTOR);
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

test("public repository blocks all issue or updater access",async t=>{
  const f=fixture(t,{privateRepo:false});
  await assert.rejects(f.agent.pollOnce(),/GITHUB_PRIVATE_REPOSITORY_REQUIRED/);
  assert.equal(f.stats.applies,0);
  assert.equal(f.stats.manifestReads,0);
  assert.ok(f.calls.every(call=>call.file.endsWith("gh.exe")&&call.args[0]==="repo"));
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
 assert.equal(f.agent.loadLedger(s6.request.requestId).result.firstFail,
  'BACKLOG_REPLAY_OUTCOME_UNKNOWN');
 assert.equal((await f.agent.processIssue(f.issue)).code,'DUPLICATE_REQUEST_SUPPRESSED');
 assert.equal(f.stats.applies,1);
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
