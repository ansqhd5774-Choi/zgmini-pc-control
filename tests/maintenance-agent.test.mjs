import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {test} from "node:test";

import {createMaintenanceAgent,failedUpdaterResult} from "../tools/maintenance-agent.mjs";

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
import {manifestFingerprint} from "../tools/maintenance-contract.mjs";

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
  verifyInstalledSource=()=>{},statusFaults={},preexistingLedger=null}={}){
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
    manifestReads:0,uploadWrites:0,uploadReads:0};
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
        return {stdout:JSON.stringify([{number:issue.number}])};
      }
      if(args[0]==="issue"&&args[1]==="view"){
        return {stdout:JSON.stringify(issue)};
      }
      if(args[0]==="api"){
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
        stats.comments++;
        assert.equal(args[args.indexOf("--repo")+1],REPO);
        const body=args[args.indexOf("--body")+1];
        assert.match(body,/zgmini-pc-maintenance-(?:result|upload):/);
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
    if(args[1]==="status"){
      stats.statusQueries++;
      return {stdout:JSON.stringify({status:"STATUS",actualControllerSha:INSTALLED,
        ledger:stats.applies?afterTimeout:preexistingLedger,installLock,...statusFaults})};
    }
    if(args[1]==="apply"){
      stats.applies++;
      assert.equal(args[args.indexOf("--request-id")+1],REQUEST_ID);
      const packageFile=args[args.indexOf("--manifest-file")+1];
      assert.ok(packageFile.startsWith(path.join(root,"approved")+path.sep));
      const packaged=JSON.parse(fs.readFileSync(packageFile,"utf8"));
      assert.deepEqual(packaged.issue,request);
      assert.deepEqual(packaged.manifest,manifest);
      assert.deepEqual(Buffer.from(packaged.manifestRawBase64,"base64"),rawManifest);
      assert.equal(packaged.issueNumber,72);
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

test("authorized private-repo issue starts one standalone updater and persists redacted TXT/JSON and one comment",async t=>{
  const f=fixture(t);
  const result=await f.agent.pollOnce();
  assert.equal(result.length,1);
  assert.equal(result[0].status,"SUCCEEDED",JSON.stringify(result[0]));
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.comments,1);
  assert.equal(f.stats.uploadWrites,2);
  assert.equal(f.remote.size,2);
  assert.equal(f.agent.loadLedger(REQUEST_ID).reportUploadStatus,"VERIFIED");
  assert.equal(fs.existsSync(path.join(f.leaseRoot,"result-upload")),false);
  const reportFile=path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.json`);
  const report=JSON.parse(fs.readFileSync(reportFile,"utf8"));
  assert.equal(report.status,"SUCCEEDED");
  assert.equal(report.code,"UPDATE_COMMITTED");
  assert.equal(report.actualControllerSha,TARGET);
  assert.equal(report.protectedStateUnchanged,true);
  assert.equal(report.workflowEnabled,false);
  const text=[fs.readFileSync(reportFile,"utf8"),
    fs.readFileSync(reportFile.replace(/\.json$/,".txt"),"utf8"),f.issue.comments[0].body].join("\n");
  assert.doesNotMatch(text,/approved\/|private-|GH_TOKEN|\.sqlite|manifestRawBase64|allowFiles/);
  const repeat=await f.agent.pollOnce();
  assert.equal(repeat[0].code,"DUPLICATE_REQUEST_SUPPRESSED");
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.comments,1);
  assert.equal(f.stats.uploadWrites,2);
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
    assert.equal(output[0].status,"IGNORED");
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

test("a new maintainer process reuses durable ledger even if Issue comments disappear",async t=>{
  const f=fixture(t);
  await f.agent.pollOnce();
  assert.equal(f.agent.loadLedger(REQUEST_ID).commentPosted,true);
  f.issue.comments.length=0;
  const txt=path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.txt`);
  fs.unlinkSync(txt); // simulated crash after ledger/JSON but before TXT durability
  const restarted=createMaintenanceAgent({stateDir:f.root,leaseRoot:f.leaseRoot,
    leaseAttempts:1,leaseWaitMs:0,execFileImpl:f.fakeExec});
  const again=await restarted.pollOnce();
  assert.equal(again[0].code,"DUPLICATE_REQUEST_SUPPRESSED");
  assert.equal(fs.existsSync(txt),true);
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

test("occupied shared result-upload lease leaves local reports and Issue comment in PENDING, then retries upload only",async t=>{
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
  assert.match(f.issue.comments[0].body,/REPORT_UPLOAD: REPORT_UPLOAD_PENDING/);
  assert.equal(fs.existsSync(path.join(lock,"owner.json")),true);
  assert.equal(fs.existsSync(path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.json`)),true);
  assert.equal(fs.existsSync(path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.txt`)),true);
  fs.unlinkSync(path.join(lock,"owner.json"));fs.rmdirSync(lock);
  const again=await f.agent.pollOnce();
  assert.equal(again[0].reportUploadStatus,"VERIFIED");
  assert.equal(f.stats.applies,1);
  assert.equal(f.stats.uploadWrites,2);
  assert.equal(f.stats.comments,2); // one idempotent delivery-completion marker
  assert.match(f.issue.comments[1].body,/REPORT_UPLOAD_VERIFIED/);
  await f.agent.pollOnce();
  assert.equal(f.stats.comments,2);
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

test("failed GitHub PUT keeps local reports and Issue comment, no success claim",async t=>{
  const f=fixture(t,{uploadFailure:Object.assign(Error("offline"),{code:"ETIMEDOUT"})});
  const first=await f.agent.pollOnce();
  assert.equal(first[0].reportUploadStatus,"REPORT_UPLOAD_PENDING");
  assert.equal(f.stats.uploadWrites,1);
  assert.equal(f.stats.comments,1);
  assert.match(f.issue.comments[0].body,/REPORT_UPLOAD: REPORT_UPLOAD_PENDING/);
  assert.equal(f.agent.loadLedger(REQUEST_ID).reportUploadStatus,"REPORT_UPLOAD_PENDING");
  assert.equal(fs.existsSync(path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.json`)),true);
  assert.equal(fs.existsSync(path.join(f.root,"reports",`MAINTENANCE_${REQUEST_ID}.txt`)),true);
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
    const report=JSON.parse(fs.readFileSync(path.join(f.root,"reports",
      `MAINTENANCE_${REQUEST_ID}.json`),"utf8"));
    assert.equal(report.status,expected);
    assert.equal(report.actualControllerSha,actual);
  }
});
