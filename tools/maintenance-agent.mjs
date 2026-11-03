#!/usr/bin/env node
// Independent, pull-only PC maintainer. Never imported by the Core supervisor.
// GitHub Issues are requests, not executable commands or approval manifests.
import crypto from "node:crypto";
import {execFile as nodeExecFile,execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

import {validateMaintenanceRequest,validateUpdateRequest,
  validateR6HostIssueEnvelope,validateR6HostRegistrationRequest} from "./maintenance-contract.mjs";
import {acquireMaintenanceLock} from "./maintenance-lock.mjs";

const CONTROL_REPOSITORY="ansqhd5774-Choi/zgmini-pc-control";
const ISSUE_TITLE="pc-controller-update";
const R6_HOST_ISSUE_TITLE="pc-r6-host-register";
const ISSUE_LABEL="pc-maintenance";
const ALLOWED_ACTORS=Object.freeze(["ansqhd5774-Choi"]);
const SHA40=/^[a-f0-9]{40}$/;
const REQUEST_ID=/^[a-z0-9][a-z0-9-]{7,79}$/;
const MAX_BODY_BYTES=16_384;
const MAX_MANIFEST_BYTES=65_536;
const MAX_RESULT_BYTES=16_384;
const FIXED_LEASE_ROOT="E:/ZGmini/automation/pc-control/leases";
const TERMINAL=new Set(["SUCCEEDED","FAILED","BLOCKED","UNKNOWN",
  "PASS","ROLLED_BACK","RECOVERY_REQUIRED"]);
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");
const coded=(code)=>Object.assign(new Error(code),{code});
const safeCode=value=>typeof value==="string"&&/^[A-Z][A-Z0-9_]{0,79}$/.test(value)
  ?value:"UNSPECIFIED_FAILURE";
const isSha=value=>typeof value==="string"&&SHA40.test(value);
const safeString=(value,pattern)=>typeof value==="string"&&pattern.test(value)?value:null;

function defaultExecFile(file,args,options={}){
  return new Promise((resolve,reject)=>{
    nodeExecFile(file,args,{windowsHide:true,shell:false,encoding:"utf8",maxBuffer:2_000_000,
      ...options},(error,stdout,stderr)=>{
      if(error){error.stdout=stdout;error.stderr=stderr;reject(error);return;}
      resolve({stdout,stderr});
    });
  });
}
function safeUpdaterEnv(source=process.env){
  // The updater is an out-of-band Windows process, never an Actions job.
  // GitHub auth, service tokens, NODE_OPTIONS and arbitrary host env are withheld.
  const permitted=["PATH","Path","SystemRoot","WINDIR","USERPROFILE","APPDATA",
    "LOCALAPPDATA","TEMP","TMP","TMPDIR","HOME","HOMEDRIVE","HOMEPATH"];
  const env={};
  for(const key of permitted)if(typeof source[key]==="string")env[key]=source[key];
  env.ZGMINI_PC_MAINTENANCE_MODE="OUT_OF_BAND";
  return env;
}

function parseJsonOutput(value,code){
  const output=typeof value==="string"?value:value?.stdout;
  if(typeof output!=="string"||Buffer.byteLength(output)>2_000_000)throw coded(code);
  try{return JSON.parse(output);}catch{throw coded(code);}
}

function parseIssueBody(body){
  // The seven-key Issue envelope permits no JSON key aliases or duplicates.
  // Require literal canonical names so JSON.parse's last-key-wins behavior
  // cannot conceal a changed or duplicated security-sensitive value.
  const expected=["schema","requestId","chatId","operation","controlRepository",
    "targetControllerSha","approvalManifestSha256"];
  const parsed=JSON.parse(body);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
    throw coded("ISSUE_CONTRACT_INVALID");
  const keys=[];
  let depth=0,inString=false,escaped=false,start=0;
  for(let i=0;i<body.length;i++){
    const char=body[i];
    if(inString){
      if(escaped){escaped=false;continue;}
      if(char==="\\"){escaped=true;continue;}
      if(char==='"'){
        inString=false;
        let next=i+1;
        while(/\s/.test(body[next]??""))next++;
        if(depth===1&&body[next]===":"){
          const token=body.slice(start,i+1),key=JSON.parse(token);
          if(token!==JSON.stringify(key))throw coded("ISSUE_CONTRACT_INVALID");
          keys.push(key);
        }
      }
    }else if(char==='"'){inString=true;start=i;}
    else if(char==="{")depth++;
    else if(char==="}")depth--;
  }
  if(keys.length!==expected.length)throw coded("ISSUE_CONTRACT_INVALID");
  for(const key of expected){
    if(keys.filter(value=>value===key).length!==1)throw coded("ISSUE_CONTRACT_INVALID");
  }
  return parsed;
}

function writeOnce(file,contents){
  try{fs.writeFileSync(file,contents,{encoding:"utf8",flag:"wx",mode:0o600});return true;}
  catch(error){
    if(error?.code!=="EEXIST")throw coded("MAINTENANCE_STATE_WRITE_FAILED");
    if(fs.readFileSync(file,"utf8")!==contents)throw coded("MAINTENANCE_STATE_CONFLICT");
    return false;
  }
}

function atomicReplace(file,contents){
  const tmp=file+"."+process.pid+"."+crypto.randomBytes(6).toString("hex")+".tmp";
  try{
    fs.writeFileSync(tmp,contents,{encoding:"utf8",flag:"wx",mode:0o600});
    fs.renameSync(tmp,file);
  }catch{throw coded("MAINTENANCE_STATE_WRITE_FAILED");}
  finally{try{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}catch{/* only our temporary file */}}
}

function assertTrustedRoot(root){
  if(typeof root!=="string"||!path.isAbsolute(root)||path.parse(root).root===root)
    throw coded("MAINTENANCE_ROOT_REQUIRED");
  const normalized=path.resolve(root);
  if(!fs.existsSync(normalized)||!fs.statSync(normalized).isDirectory())
    throw coded("MAINTENANCE_ROOT_NOT_FOUND");
  return normalized;
}

function issueIsTrusted(issue,{allowedActors,title,label}){
  const actor=issue?.author?.login;
  const labels=issue?.labels;
  return Number.isSafeInteger(issue?.number)&&issue.number>0
    &&issue.title===title&&issue.state==="OPEN"
    &&typeof actor==="string"&&!actor.toLowerCase().endsWith("[bot]")
    &&allowedActors.some(name=>name.toLowerCase()===actor.toLowerCase())
    &&Array.isArray(labels)&&labels.some(item=>item?.name===label);
}

function commentMarker(id){return `<!-- zgmini-pc-maintenance-result:${id} -->`;}
export function failedUpdaterResult(request,error,status){
 let output=null;try{output=parseJsonOutput(error?.stdout,'UPDATE_OUTPUT_INVALID');}catch{}
 const exact=output?.status==='AUTOMATION_BLOCKED'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(output?.code??'');
 const untouched=exact&&output.failureStage==='PRE_INSTALL'&&status?.ledger===null&&
  status?.installLock?.held===false&&!status?.ledgerReadbackCode&&!status?.lockReadbackCode&&!status?.installedReadbackCode;
 return normalizedResult(request,{status:untouched?'BLOCKED':'UNKNOWN',
  firstFail:exact?output.code:'UPDATE_OUTCOME_UNKNOWN',actualControllerSha:status?.actualControllerSha,
  lastPass:untouched?'PRE_INSTALL_REJECTED':'NONE'},exact?output.code:'UPDATE_OUTCOME_UNKNOWN');
}
function normalizedResult(request,result,code){
  const from=result&&typeof result==="object"?result:{};
  const status=from.status==="PASS"?"SUCCEEDED"
    :from.status==="ROLLED_BACK"?"FAILED"
    :from.status==="RECOVERY_REQUIRED"?"UNKNOWN"
    :["SUCCEEDED","FAILED","BLOCKED","UNKNOWN"].includes(from.status)
      ?from.status:"UNKNOWN";
  return {
    schema:"ZGMINI_PC_MAINTENANCE_RESULT_V1",
    requestId:request.requestId,targetControllerSha:request.targetControllerSha,
    status,code:safeCode(code??from.code??"UNKNOWN_OUTCOME"),
    lastPass:safeCode(from.lastPass??"NONE"),
    firstFail:safeCode(from.firstFail??"NONE"),
    actualControllerSha:isSha(from.actualControllerSha??from.actualInstalledSha)
      ?(from.actualControllerSha??from.actualInstalledSha):null,
    recoverySha:isSha(from.recoverySha)?from.recoverySha:null,
    protectedStateUnchanged:from.protectedStateUnchanged===true,
    workflowEnabled:from.workflowEnabled===true,
  };
}
function resultComment(result,uploadStatus=null){
  return [commentMarker(result.requestId),
    "ZGMINI PC maintenance result (out-of-band)",
    `REQUEST_ID: ${result.requestId}`,
    `STATUS: ${result.status}`,
    `CODE: ${result.code}`,
    `LAST_PASS: ${result.lastPass}`,
    `FIRST_FAIL: ${result.firstFail}`,
    `TARGET_CONTROLLER_SHA: ${result.targetControllerSha}`,
    `ACTUAL_CONTROLLER_SHA: ${result.actualControllerSha??"UNVERIFIED"}`,
    `RECOVERY_SHA: ${result.recoverySha??"NONE"}`,
    `PROTECTED_STATE_UNCHANGED: ${result.protectedStateUnchanged}`,
    `WORKFLOW_ENABLED: ${result.workflowEnabled}`,
    ...(uploadStatus?[`REPORT_UPLOAD: ${uploadStatus}`,
      `RESULT_JSON: results/maintenance-${result.requestId}.json`,
      `RESULT_TXT: results/maintenance-${result.requestId}.txt`]:[])].join("\n");
}

/**
 * All side effects are injectable. Tests never access GitHub or a real PC.
 * The agent has no power to run user-supplied commands or arbitrary file paths.
 */
export function createMaintenanceAgent({
  stateDir,repo=CONTROL_REPOSITORY,title=ISSUE_TITLE,label=ISSUE_LABEL,
  allowedActors=ALLOWED_ACTORS,execFileImpl=defaultExecFile,
  ghBinary="C:/Program Files/GitHub CLI/gh.exe",nodeBinary=process.execPath,
  leaseRoot=FIXED_LEASE_ROOT,leaseAttempts=120,leaseWaitMs=500,
  updateScript=path.join(path.dirname(fileURLToPath(import.meta.url)),"update.mjs"),
  verifyInstalledSource=()=>{},
  installedShaFromStatus=result=>result?.actualControllerSha,
  ghTimeoutMs=20_000,updateTimeoutMs=0,
  now=()=>new Date().toISOString(),
}={}){
  const root=assertTrustedRoot(stateDir);
  if(repo!==CONTROL_REPOSITORY||!Array.isArray(allowedActors)||!allowedActors.length
    ||typeof updateScript!=="string"||!path.isAbsolute(updateScript)
    ||typeof leaseRoot!=="string"||!path.isAbsolute(leaseRoot)
    ||!Number.isInteger(leaseAttempts)||leaseAttempts<1||leaseAttempts>120
    ||!Number.isInteger(leaseWaitMs)||leaseWaitMs<0||leaseWaitMs>500){
    throw coded("MAINTENANCE_AGENT_CONFIG_INVALID");
  }
  const requestsDir=path.join(root,"requests"),approvedDir=path.join(root,"approved"),
    reportsDir=path.join(root,"reports");
  for(const dir of [requestsDir,approvedDir,reportsDir])fs.mkdirSync(dir,{recursive:true});

  async function exec(file,args,timeout,environment=process.env){
    // Never use a shell. The entire command vector is fixed by this module.
    return execFileImpl(file,args,{shell:false,windowsHide:true,timeout,
      env:environment,maxBuffer:2_000_000});
  }
  async function github(args){return exec(ghBinary,args,ghTimeoutMs);}
  async function githubJson(args,code){
    try{return parseJsonOutput(await github(args),code);}
    catch{throw coded(code);}
  }
  async function updater(args){
    // Check the immutable installed maintainer files again at the point of use:
    // the long-lived receiver must never execute a drifted updater.
    verifyInstalledSource();
    return exec(nodeBinary,[updateScript,...args],updateTimeoutMs,safeUpdaterEnv());
  }
  async function updaterStatus(id,operation="controller-update"){
    const subcommand=operation==="employment-r6-host-register"?"host-r6-status":"status";
    try{return parseJsonOutput(await updater([subcommand,"--request-id",id]),"UPDATE_STATUS_INVALID");}
    catch{throw coded("UPDATE_STATUS_UNAVAILABLE");}
  }
  async function acquireUploadLease(){
    const dir=path.join(leaseRoot,"result-upload"),ownerFile=path.join(dir,"owner.json");
    if(!fs.existsSync(leaseRoot)||!fs.statSync(leaseRoot).isDirectory())
      throw coded("REPORT_UPLOAD_LEASE_ROOT_UNAVAILABLE");
    for(let attempt=0;attempt<leaseAttempts;attempt++){
      try{
        // Same atomic directory mutex used by controller/common.mjs exclusive().
        // Never steal or garbage-collect another worker's lease.
        fs.mkdirSync(dir);
      }catch(error){
        if(error?.code!=="EEXIST")throw coded("REPORT_UPLOAD_LEASE_FAILED");
        if(attempt+1<leaseAttempts){
          await new Promise(resolve=>setTimeout(resolve,leaseWaitMs));
          continue;
        }
        throw coded("REPORT_UPLOAD_MUTEX_BUSY");
      }
      const nonce=crypto.randomUUID(),owner={pid:process.pid,nonce,at:now(),
        bootAt:Date.now()-os.uptime()*1000};
      try{
        fs.writeFileSync(ownerFile,JSON.stringify(owner)+"\n",{flag:"wx",mode:0o600});
        return {dir,ownerFile,nonce};
      }catch{
        // We created the directory but not its owner file. Remove only an
        // empty directory owned by this failed attempt; never remove peers.
        try{fs.rmdirSync(dir);}catch{/* fail closed */}
        throw coded("REPORT_UPLOAD_LEASE_FAILED");
      }
    }
    throw coded("REPORT_UPLOAD_MUTEX_BUSY");
  }
  function releaseUploadLease(lease){
    try{
      const owner=JSON.parse(fs.readFileSync(lease.ownerFile,"utf8"));
      if(owner.nonce!==lease.nonce||owner.pid!==process.pid)
        throw coded("REPORT_UPLOAD_MUTEX_OWNERSHIP_LOST");
      fs.unlinkSync(lease.ownerFile);
      fs.rmdirSync(lease.dir);
    }catch{throw coded("REPORT_UPLOAD_MUTEX_RELEASE_FAILED");}
  }
  async function repositoryAllowed(){
    const info=await githubJson(["repo","view",repo,"--json","isPrivate,nameWithOwner"],
      "GITHUB_REPOSITORY_CHECK_FAILED");
    if(info?.nameWithOwner!==repo||info?.isPrivate!==true)
      throw coded("GITHUB_PRIVATE_REPOSITORY_REQUIRED");
  }
  async function issueDetails(number){
    if(!Number.isSafeInteger(number)||number<=0)throw coded("INVALID_ISSUE_NUMBER");
    return githubJson(["issue","view",String(number),"--repo",repo,
      "--json","number,title,state,body,author,labels,comments"],"GITHUB_ISSUE_READ_FAILED");
  }
  async function manifestBytes(request){
    const approvedPath=request.operation==="employment-r6-host-register"
      ?"approvals/host-r6/afdd8fab1c03b321e4b8b0853bb236c0800a0a14.json"
      :`approvals/controller-updates/${request.targetControllerSha}.json`;
    const resource=`repos/${repo}/contents/${approvedPath}?ref=main`;
    const data=await githubJson(["api",resource],"APPROVAL_MANIFEST_READ_FAILED");
    if(data?.encoding!=="base64"||data?.type!=="file"
      ||typeof data.content!=="string"||data.content.length>MAX_MANIFEST_BYTES*2){
      throw coded("APPROVAL_MANIFEST_INVALID");
    }
    const encoded=data.content.replace(/\s/g,"");
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw coded("APPROVAL_MANIFEST_INVALID");
    const bytes=Buffer.from(encoded,"base64");
    if(bytes.length===0||bytes.length>MAX_MANIFEST_BYTES
      ||sha256(bytes)!==request.approvalManifestSha256){
      throw coded("APPROVAL_MANIFEST_HASH_MISMATCH");
    }
    return bytes;
  }
  function isMissingRemoteFile(error){
    return error?.code==="HTTP_404"||error?.status===404
      ||/\bHTTP 404\b/.test(String(error?.stderr??""));
  }
  async function uploadOneResult(requestId,extension,contents){
    if(!REQUEST_ID.test(requestId)||!["json","txt"].includes(extension)
      ||Buffer.byteLength(contents)>MAX_RESULT_BYTES){
      throw coded("REPORT_UPLOAD_INPUT_INVALID");
    }
    const resource=`repos/${repo}/contents/results/maintenance-${requestId}.${extension}`;
    let exists=false;
    try{
      const current=parseJsonOutput(await github(["api",resource+"?ref=main"]),
        "REPORT_UPLOAD_READ_INVALID");
      if(current?.type!=="file"||current?.encoding!=="base64"
        ||typeof current.content!=="string")throw coded("REPORT_UPLOAD_REMOTE_INVALID");
      const remote=Buffer.from(current.content.replace(/\s/g,""),"base64");
      if(!remote.equals(Buffer.from(contents,"utf8")))
        throw coded("REPORT_REMOTE_CONTENT_CONFLICT");
      exists=true;
    }catch(error){
      if(error?.code==="REPORT_REMOTE_CONTENT_CONFLICT"
        ||error?.code==="REPORT_UPLOAD_REMOTE_INVALID")throw error;
      if(!isMissingRemoteFile(error))throw coded("REPORT_UPLOAD_REMOTE_READ_FAILED");
    }
    if(!exists){
      const message=`PC maintenance ${requestId} ${extension} result`;
      const encoded=Buffer.from(contents,"utf8").toString("base64");
      try{
        // Create-only PUT: deliberately omit the existing-file SHA. A race
        // cannot overwrite an already uploaded job's report.
        await github(["api",resource,"--method","PUT",
          "--raw-field",`message=${message}`,
          "--raw-field","branch=main",
          "--raw-field",`content=${encoded}`]);
      }catch{
        // An upload timeout is ambiguous. Re-read below before reporting.
      }
      let after;
      try{after=parseJsonOutput(await github(["api",resource+"?ref=main"]),
        "REPORT_UPLOAD_READBACK_INVALID");}
      catch{throw coded("REPORT_UPLOAD_READBACK_PENDING");}
      if(after?.type!=="file"||after?.encoding!=="base64"
        ||typeof after.content!=="string")throw coded("REPORT_UPLOAD_READBACK_PENDING");
      if(!Buffer.from(after.content.replace(/\s/g,""),"base64")
        .equals(Buffer.from(contents,"utf8"))){
        throw coded("REPORT_REMOTE_CONTENT_CONFLICT");
      }
    }
  }
  async function deliverReports(entry){
    if(["VERIFIED","REPORT_UPLOAD_BLOCKED"].includes(entry.reportUploadStatus))return entry;
    let lease=null,code="REPORT_UPLOAD_PENDING",status="REPORT_UPLOAD_PENDING";
    try{
      lease=await acquireUploadLease();
      const base=path.join(reportsDir,`MAINTENANCE_${entry.requestId}`);
      // Both outputs are already persisted. Never submit raw manifest/DB data.
      await uploadOneResult(entry.requestId,"json",fs.readFileSync(base+".json","utf8"));
      await uploadOneResult(entry.requestId,"txt",fs.readFileSync(base+".txt","utf8"));
      status="VERIFIED";code="REPORT_UPLOAD_VERIFIED";
    }catch(error){
      code=safeCode(error?.code??error?.message);
      if(code==="REPORT_REMOTE_CONTENT_CONFLICT")status="REPORT_UPLOAD_BLOCKED";
    }
    finally{
      if(lease){
        try{releaseUploadLease(lease);}
        catch{status="REPORT_UPLOAD_PENDING";code="REPORT_UPLOAD_MUTEX_RELEASE_FAILED";}
      }
    }
    const updated={...entry,reportUploadStatus:status,reportUploadCode:code};
    persistLedger(updated);
    return updated;
  }
  function ledgerPath(id){
    if(!REQUEST_ID.test(id))throw coded("INVALID_REQUEST_ID");
    return path.join(requestsDir,sha256(id)+".json");
  }
  function loadLedger(id){
    const file=ledgerPath(id);
    if(!fs.existsSync(file))return null;
    try{
      const ledger=JSON.parse(fs.readFileSync(file,"utf8"));
      if(ledger.requestId!==id||!Number.isSafeInteger(ledger.issueNumber)
        ||typeof ledger.bodyDigest!=="string"||typeof ledger.fingerprint!=="string"){
        throw Error("invalid ledger");
      }
      return ledger;
    }catch{throw coded("MAINTENANCE_LEDGER_INVALID");}
  }
  function claim(request,issue,fingerprint,bodyDigest){
    const file=ledgerPath(request.requestId);
    const entry={schema:"ZGMINI_PC_MAINTENANCE_LEDGER_V1",requestId:request.requestId,
      issueNumber:issue.number,actor:issue.author.login,fingerprint,bodyDigest,
      targetControllerSha:request.targetControllerSha,
      status:"RUNNING",createdAt:now(),result:null};
    try{
      fs.writeFileSync(file,JSON.stringify(entry,null,2)+"\n",{encoding:"utf8",flag:"wx",mode:0o600});
      return {entry,created:true};
    }catch(error){
      if(error?.code!=="EEXIST")throw coded("MAINTENANCE_STATE_WRITE_FAILED");
      return {entry:loadLedger(request.requestId),created:false};
    }
  }
  function persistLedger(entry){
    atomicReplace(ledgerPath(entry.requestId),JSON.stringify(entry,null,2)+"\n");
  }
  function ensureResultFiles(entry){
    if(!entry.result)return;
    const filename=path.join(reportsDir,`MAINTENANCE_${entry.requestId}.json`);
    const result=entry.result;
    writeOnce(filename,JSON.stringify(result,null,2)+"\n");
    writeOnce(filename.replace(/\.json$/,".txt"),resultComment(result)+"\r\n");
  }
  function persistResult(entry,result){
    const updated={...entry,status:result.status,result,completedAt:now(),
      reportUploadStatus:"REPORT_UPLOAD_PENDING",reportUploadCode:"REPORT_UPLOAD_PENDING"};
    persistLedger(updated);
    ensureResultFiles(updated);
    return updated;
  }
  async function ensureComment(issueNumber,result,uploadStatus){
    // A timed-out gh comment may already be present. Always re-read first.
    const fresh=await issueDetails(issueNumber);
    const marker=commentMarker(result.requestId);
    if((fresh.comments??[]).some(c=>typeof c?.body==="string"&&c.body.includes(marker)
      &&allowedActors.some(actor=>actor.toLowerCase()===String(c?.author?.login??"").toLowerCase())))
      return "ALREADY_POSTED";
    try{
      await github(["issue","comment",String(issueNumber),"--repo",repo,
        "--body",resultComment(result,uploadStatus)]);
      return "POSTED";
    }catch{
      // The next poll will re-check the marker, never immediately retry.
      return "COMMENT_OUTCOME_UNKNOWN";
    }
  }
  async function commentOnceAndRecord(entry){
    if(entry.commentPosted===true||!entry.result)return;
    const posted=await ensureComment(entry.issueNumber,entry.result,
      entry.reportUploadStatus??"REPORT_UPLOAD_PENDING");
    if(posted==="POSTED"||posted==="ALREADY_POSTED"){
      persistLedger({...entry,commentPosted:true,
        commentUploadStatus:entry.reportUploadStatus??"REPORT_UPLOAD_PENDING"});
    }
  }
  async function uploadCompletionCommentOnce(entry){
    if(entry.reportUploadStatus!=="VERIFIED"||entry.commentUploadStatus!=="REPORT_UPLOAD_PENDING"
      ||entry.deliveryCommentPosted===true||entry.commentPosted!==true)return;
    const marker=`<!-- zgmini-pc-maintenance-upload:${entry.requestId} -->`;
    const fresh=await issueDetails(entry.issueNumber);
    const present=(fresh.comments??[]).some(c=>typeof c?.body==="string"
      &&c.body.includes(marker)
      &&allowedActors.some(actor=>actor.toLowerCase()===String(c?.author?.login??"").toLowerCase()));
    if(!present){
      const body=[marker,"REPORT_UPLOAD_VERIFIED",
        `RESULT_JSON: results/maintenance-${entry.requestId}.json`,
        `RESULT_TXT: results/maintenance-${entry.requestId}.txt`].join("\n");
      try{await github(["issue","comment",String(entry.issueNumber),"--repo",repo,
        "--body",body]);}
      catch{return;}
    }
    persistLedger({...entry,deliveryCommentPosted:true});
  }
  async function reconcileRunning(entry,request){
    let status;
    try{status=await updaterStatus(entry.requestId,request.operation);}
    catch{return entry;}
    const current=status?.ledger?.result??status?.result??status?.ledger;
    if(!current||!TERMINAL.has(current.status)){
      const elapsed=Date.now()-Date.parse(entry.createdAt);
      const noInstallEvidence=!current&&!status?.installLock?.held;
      // Crash between Issue claim and updater invocation leaves no updater
      // ledger. Surface UNKNOWN after a grace period; NEVER install again.
      if((noInstallEvidence&&elapsed>120000)||(current&&elapsed>3600000)){
        const result=normalizedResult(request,{status:'UNKNOWN',firstFail:'UPDATE_OUTCOME_UNKNOWN',
          actualControllerSha:status?.actualControllerSha},'UPDATE_OUTCOME_UNKNOWN');
        return persistResult(entry,result);
      }
      return entry;
    }
    const result=normalizedResult(request,{...current,
      actualControllerSha:current.actualControllerSha??status.actualControllerSha},current.code);
    return persistResult(entry,result);
  }
  async function processIssue(issue){
    if(![ISSUE_TITLE,R6_HOST_ISSUE_TITLE].includes(issue?.title)
      ||!issueIsTrusted(issue,{allowedActors,title:issue.title,label}))
      return {status:"IGNORED",issueNumber:issue?.number};
    if(typeof issue.body!=="string"||Buffer.byteLength(issue.body)>MAX_BODY_BYTES){
      return {status:"BLOCKED",code:"ISSUE_BODY_INVALID",issueNumber:issue.number};
    }
    let request;
    try{
      const parsed=parseIssueBody(issue.body);
      request=parsed.operation==="employment-r6-host-register"
        ?validateR6HostIssueEnvelope(parsed,{actor:issue.author.login,allowedActors,controlRepository:repo})
        :validateMaintenanceRequest(parsed,{actor:issue.author.login,allowedActors,controlRepository:repo});
      if((request.operation==="employment-r6-host-register")!==(issue.title===R6_HOST_ISSUE_TITLE))
        throw coded("ISSUE_TITLE_OPERATION_MISMATCH");
    }catch{
      return {status:"BLOCKED",code:"ISSUE_CONTRACT_INVALID",issueNumber:issue.number};
    }
    if(!REQUEST_ID.test(request.requestId)){
      return {status:"BLOCKED",code:"INVALID_REQUEST_ID",issueNumber:issue.number};
    }
    const bodyDigest=sha256(issue.body),fingerprint=sha256(JSON.stringify(request));
    const prior=loadLedger(request.requestId);
    if(prior){
      if(prior.issueNumber!==issue.number||prior.bodyDigest!==bodyDigest
        ||prior.fingerprint!==fingerprint||prior.actor!==issue.author.login){
        return {status:"BLOCKED",code:"REQUEST_ID_REUSE_CONFLICT",issueNumber:issue.number};
      }
      const settled=prior.status==="RUNNING"?await reconcileRunning(prior,request):prior;
      if(TERMINAL.has(settled.status)&&settled.result){
        ensureResultFiles(settled);
        const delivered=await deliverReports(settled);
        await commentOnceAndRecord(delivered);
        await uploadCompletionCommentOnce(loadLedger(request.requestId));
      }
      return {status:settled.status,code:"DUPLICATE_REQUEST_SUPPRESSED",
        reportUploadStatus:loadLedger(request.requestId).reportUploadStatus,
        requestId:request.requestId};
    }

    let approvedBytes,approved;
    try{
      approvedBytes=await manifestBytes(request);
      const preflight=await updaterStatus(request.requestId,request.operation);
      if(preflight?.installedReadbackCode||preflight?.ledgerReadbackCode||
        preflight?.lockReadbackCode)throw coded('UPDATE_STATUS_RECOVERY_REQUIRED');
      if(preflight?.ledger)throw coded('UPDATE_EXISTING_LEDGER_RECONCILE_FIRST');
      if(typeof preflight?.installLock?.held!=='boolean')
        throw coded('UPDATE_LOCK_STATUS_UNVERIFIED');
      if(preflight?.installLock?.held){
        return {status:preflight.installLock.recoveryRequired?'AUTOMATION_BLOCKED':'QUEUED',
          code:preflight.installLock.recoveryRequired?'MAINTENANCE_RECOVERY_HOLD':'MAINTENANCE_INSTALL_IN_PROGRESS',
          requestId:request.requestId};
      }
      const installedSha=installedShaFromStatus(preflight);
      if(!isSha(installedSha))throw coded("INSTALLED_CONTROLLER_SHA_UNVERIFIED");
      const args={actor:issue.author.login,allowedActors,controlRepository:repo,installedSha};
      approved=request.operation==="employment-r6-host-register"
        ?validateR6HostRegistrationRequest(request,approvedBytes,args)
        :validateUpdateRequest(request,approvedBytes,args);
    }catch(error){
      const code=safeCode(error?.code??error?.message);
      const blocked=claim(request,issue,fingerprint,bodyDigest);
      if(!blocked.created)return {status:"BLOCKED",code:"DUPLICATE_REQUEST_SUPPRESSED"};
      const result=normalizedResult(request,{status:"BLOCKED",firstFail:code},code);
      const stored=await deliverReports(persistResult(blocked.entry,result));
      await commentOnceAndRecord(stored);
      return {status:"BLOCKED",code,reportUploadStatus:stored.reportUploadStatus,
        requestId:request.requestId};
    }

    // Request values never choose a path or command. Only a pinned manifest is
    // stored under this trusted maintenance root for the separate updater.
    const packageFile=path.join(approvedDir,request.requestId+".json");
    // Preserve the pinned manifest's exact JSON field/file order: the updater
    // independently compares its parsed raw bytes against this package. The
    // contract's normalized copy may sort allowFiles and is only for admission.
    const packageData={issue:request,manifest:JSON.parse(approvedBytes.toString("utf8")),
      manifestRawBase64:approvedBytes.toString("base64"),
      issueNumber:issue.number,actor:issue.author.login};
    writeOnce(packageFile,JSON.stringify(packageData,null,2)+"\n");
    const held=claim(request,issue,fingerprint,bodyDigest);
    if(!held.created)return {status:"RUNNING",code:"DUPLICATE_REQUEST_SUPPRESSED"};
    let result;
    try{
      const command=request.operation==="employment-r6-host-register"?"host-r6-apply":"apply";
      const executed=parseJsonOutput(await updater([command,"--request-id",request.requestId,
        "--manifest-file",packageFile]),"UPDATE_OUTPUT_INVALID");
      result=normalizedResult(request,executed,executed.code);
    }catch(error){
      // Never retry an ambiguous apply. Query the independent updater ledger.
      let status=null;
      try{status=await updaterStatus(request.requestId,request.operation);}catch{/* unknown outcome */}
      const current=status?.ledger?.result??status?.result??status?.ledger;
      result=current&&TERMINAL.has(current.status)
        ?normalizedResult(request,{...current,
          actualControllerSha:current.actualControllerSha??status.actualControllerSha},current.code)
        :failedUpdaterResult(request,error,status);
    }
    const stored=await deliverReports(persistResult(held.entry,result));
    await commentOnceAndRecord(stored);
    return {status:result.status,code:result.code,
      reportUploadStatus:stored.reportUploadStatus,requestId:request.requestId};
  }
  async function pollOnce(){
    await repositoryAllowed();
    const summaries=await githubJson(["issue","list","--repo",repo,"--state","open",
      "--label",label,"--limit","1000","--json","number"],"GITHUB_ISSUE_LIST_FAILED");
    if(!Array.isArray(summaries))throw coded("GITHUB_ISSUE_LIST_INVALID");
    const seen=new Set(),results=[];
    for(const entry of summaries){
      const number=entry?.number;
      if(!Number.isSafeInteger(number)||number<=0||seen.has(number))continue;
      seen.add(number);
      try{results.push(await processIssue(await issueDetails(number)));}
      catch(error){results.push({issueNumber:number,status:"BLOCKED",
        code:safeCode(error?.code??error?.message)});}
    }
    return results;
  }
  return {pollOnce,processIssue,loadLedger,updaterStatus};
}

function verifyInstalledTools(root){
  const installed=JSON.parse(fs.readFileSync(path.join(root,"MAINTENANCE_INSTALL.json"),"utf8"));
  const expected=["tools/maintenance-contract.mjs","tools/maintenance-apply.mjs",
    "tools/maintenance-agent.mjs","tools/maintenance-lock.mjs","tools/update.mjs",
    "tools/maintenance-ancestry.vbs"];
  if(installed.schema!=="ZGMINI_PC_MAINTENANCE_INSTALL_V1"
    ||Object.keys(installed.files??{}).length!==expected.length)throw coded("MAINTENANCE_SELF_MANIFEST_INVALID");
  for(const [rel,hash] of Object.entries(installed.files)){
    if(!expected.includes(rel)||!(/^[a-f0-9]{64}$/).test(hash)
      ||sha256(fs.readFileSync(path.join(root,rel)))!==hash)throw coded("MAINTENANCE_SELF_DRIFT");
  }
}

export function attestReceiverOrigin(root,owner,{platform=process.platform,
  appData=process.env.APPDATA,
  cscript=(args)=>execFileSync('cscript.exe',args,{windowsHide:true,
    encoding:'utf8',timeout:12000,maxBuffer:4096})}={}){
  if(platform!=='win32'||typeof appData!=='string'||!path.isAbsolute(appData))
    throw coded('MAINTENANCE_ORIGIN_UNKNOWN');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'MAINTENANCE_INSTALL.json'),'utf8'));
  const startup=path.join(appData,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_MAINTENANCE.vbs');
  if(!/^[a-f0-9]{64}$/.test(manifest.startupSha256??'')||
    sha256(fs.readFileSync(startup))!==manifest.startupSha256)
    throw coded('MAINTENANCE_ORIGIN_UNKNOWN');
  const script=path.join(root,'tools/maintenance-ancestry.vbs');
  let result;
  try{result=String(cscript(['//NoLogo',script,'CAPTURE',String(owner.pid)])).trim();}
  catch{throw coded('MAINTENANCE_ORIGIN_UNKNOWN');}
  const matches=/^ATTESTED\|([0-9]{14}\.[0-9]{6}[+-][0-9]{3})\|([0-9]{1,9})\|(S-1-[0-9-]{4,100})$/.exec(result);
  if(!matches||owner.pid!==process.pid||!/^[0-9a-f-]{36}$/.test(owner.nonce??''))
    throw coded('MAINTENANCE_ORIGIN_UNKNOWN');
  const evidence={schema:'ZGMINI_PC_RECEIVER_ORIGIN_V1',sourceSha:manifest.sourceSha,
    startupSha256:manifest.startupSha256,pid:owner.pid,nonce:owner.nonce,
    bootAt:owner.bootAt,created:matches[1],session:matches[2],sid:matches[3],
    attestedAt:new Date().toISOString()};
  const dir=path.join(root,'receivers');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,owner.nonce+'.json'),JSON.stringify(evidence)+'\n',{flag:'wx',mode:0o600});
  return evidence;
}

export function cooperativeStopRequested(root,owner){
 const file=path.join(root,'STOP_REQUEST.json');
 if(!fs.existsSync(file)||fs.existsSync(path.join(root,'leases/controller-install')))return false;
 let request;try{request=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return false;}
 const installed=JSON.parse(fs.readFileSync(path.join(root,'MAINTENANCE_INSTALL.json'),'utf8'));
 if(request.schema!=='ZGMINI_MAINTENANCE_STOP_V1'||request.pid!==owner.pid||request.nonce!==owner.nonce||request.sourceSha!==installed.sourceSha)return false;
 fs.renameSync(file,path.join(root,'STOP_HANDLED-'+owner.nonce+'.json'));return true;
}

export async function main(args=process.argv.slice(2)){
  const mode=args.length===1&&["--once","--poll"].includes(args[0])?args[0]:null;
  if(!mode)throw coded("MAINTENANCE_USAGE_INVALID");
  const root=assertTrustedRoot(process.env.ZGMINI_PC_MAINTENANCE_ROOT);
  verifyInstalledTools(root);
  let lease;
  try{lease=acquireMaintenanceLock(root,'receiver');}
  catch(error){if(error?.code==='MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED')return;throw error;}
  try{
    attestReceiverOrigin(root,lease.owner);
    const agent=createMaintenanceAgent({stateDir:root,verifyInstalledSource:()=>verifyInstalledTools(root)});
    do{
      if(cooperativeStopRequested(root,lease.owner))break;
      try{const results=await agent.pollOnce();atomicReplace(path.join(root,'RECEIVER_STATUS.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,status:'LISTENING',results})+'\n');}
      catch(error){
        if(mode==='--once')throw error;
        // A temporary GitHub outage must not permanently terminate the user
        // Startup receiver. Fixed next-poll delay, no automatic job retry.
        process.stderr.write('MAINTENANCE_POLL_WAIT: '+safeCode(error?.code??error?.message)+'\n');
        atomicReplace(path.join(root,'RECEIVER_STATUS.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,status:'POLL_WAIT',code:safeCode(error?.code??error?.message)})+'\n');
      }
      if(mode==='--once'||cooperativeStopRequested(root,lease.owner))break;
      await new Promise(resolve=>setTimeout(resolve,60_000));
    }while(true);
  }finally{lease.release();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{
    process.stderr.write("MAINTENANCE_AGENT: "+safeCode(error?.code??error?.message)+"\n");
    process.exitCode=2;
  });
}


