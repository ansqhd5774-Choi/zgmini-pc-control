// Direct Windows C-grade #917 post-switch operator.
// Not a pc-job/Actions adapter, receiver, or unattended scheduler.
// Deliberately has no default execution and no overrideable root/path/command.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {INCIDENT,TOOL_PATHS,MATERIAL_KEYS,
  validatePostSwitchApproval} from './controller-postswitch-approval.mjs';
import {main as inspectPostSwitch} from './controller-postswitch-evidence.mjs';
import {main as inspectPreflight,prepareBacklogReadOnly,readAllPages}
  from './controller-postswitch-preflight.mjs';
import {exactReplayCandidates} from './controller-postswitch-backlog.mjs';
import {ensurePostcheckIssue} from './controller-postswitch-postcheck.mjs';
import {acquirePostSwitchState} from './controller-postswitch-state.mjs';
import {runApprovedPostSwitch} from './controller-postswitch-operator.mjs';

const maintenance='E:/ZGmini/automation/pc-maintenance';
const control='E:/ZGmini/automation/pc-control';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repository='ansqhd5774-Choi/zgmini-pc-control';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(yes,code)=>{if(!yes)throw Object.assign(new Error(code),{code});};
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const read=file=>fs.readFileSync(file);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const own=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

function git(args){
  return execFileSync('git',args,{cwd:repo,windowsHide:true,
    timeout:30000,maxBuffer:8e6});
}
function api(route,body=null){
  const args=['api','repos/'+repository+'/'+route];
  let input=null;
  try{
    if(body!==null){
      const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-917-post-'));
      input=path.join(temp,'body.json');
      fs.writeFileSync(input,JSON.stringify(body)+'\n',{flag:'wx',mode:0o600});
      args.push('-X','POST','--input',input);
    }
    return JSON.parse(execFileSync(gh,args,{encoding:'utf8',windowsHide:true,
      timeout:30000,maxBuffer:8e6}));
  }finally{
    if(input!==null){
      try{fs.unlinkSync(input);fs.rmdirSync(path.dirname(input));}catch{}
    }
  }
}
function issuePages(){
  return readAllPages(page=>api('issues?state=all&per_page=100&page='+page));
}
function commentsFor(issueNumber){
  return readAllPages(page=>api('issues/'+issueNumber+'/comments?per_page=100&page='+page));
}
function backlogReadOnly(backlog){
  const id=INCIDENT.requestId;
  return prepareBacklogReadOnly({requestId:id,backlog,
    fetchIssues:(since,page)=>api('issues?state=all&since='+
      encodeURIComponent(since)+'&per_page=100&page='+page),
    fetchComments:(n,page)=>api('issues/'+n+'/comments?per_page=100&page='+page),
    fetchOriginal:n=>api('issues/'+n),
    fetchAllIssues:page=>api('issues?state=all&per_page=100&page='+page)});
}

/** Reject bot markers with missing/mismatched evidence; no reply is proof alone. */
export function parseVerifiedPcBotResult(comments,requestId,expectedSha,
  requestedSourceSha){
  need(Array.isArray(comments),'POSTSWITCH_RESULT_READBACK_UNAVAILABLE');
  const matching=[];
  for(const comment of comments){
    if(comment?.user?.login!=='github-actions[bot]' ||
      !comment.body?.includes('zgmini-pc-result:'))continue;
    const match=comment.body.match(/JSON 결과:\s*[\x60]{3}json\s*([\s\S]*?)[\x60]{3}/);
    need(match!==null,'POSTSWITCH_RESULT_BOT_BODY_INCOMPLETE');
    let result;try{result=JSON.parse(match[1]);}
    catch{need(false,'POSTSWITCH_RESULT_BOT_JSON_INVALID');}
    if(result.requestId===requestId)matching.push(result);
  }
  if(matching.length===0)return null;
  need(matching.length===1,'POSTSWITCH_RESULT_DUPLICATE_UNCERTAIN');
  const row=matching[0];
  need(row.schema==='ZGMINI_PC_RESULT_V1' && row.status==='PASS' &&
    row.controlRepository===repository &&
    row.controlSourceSha===expectedSha &&
    row.actualExecutionSha===expectedSha &&
    row.sourceRepository==='ansqhd5774-Choi/zgmini' &&
    row.requestedSourceSha===requestedSourceSha &&
    row.protectedStateUnchanged===true &&
    row.operationalWrites===0 && row.providerCalls===0 &&
    row.d1Writes===0,'POSTSWITCH_RESULT_FAILED_OR_SOURCE_DRIFT');
  return row;
}
async function waitPcResult(issueNumber,requestId,sourceSha,expectedSource){
  // A queued 8-minute A-grade run is not a failure. Poll only the existing
  // Issue; never send a second request after timeout or missing response.
  for(let n=0;n<90;n++){
    const found=parseVerifiedPcBotResult(commentsFor(issueNumber),requestId,
      sourceSha,expectedSource);
    if(found)return found;
    if(n<89)await sleep(10000);
  }
  need(false,'POSTSWITCH_RESULT_PENDING_NO_REPOST');
}

function materialPaths(){
  const id=INCIDENT.requestId,base=path.join(control,'backups','controller-update-'+id);
  return {
    ledger:path.join(maintenance,'ledger',id+'.json'),
    owner:path.join(maintenance,'leases/controller-install','owner.json'),
    marker:path.join(maintenance,'leases/controller-install','RECOVERY_REQUIRED.json'),
    currentHost:path.join(control,'host.json'),
    snapshotHost:path.join(base,'snapshot','host.json'),
    protectedBefore:path.join(base,'PROTECTED_BEFORE.json'),
    backlog:path.join(maintenance,'backlog',id+'.json'),
  };
}
function materialHashes(paths=materialPaths()){
  return Object.fromEntries(MATERIAL_KEYS.map(key=>[key,digest(read(paths[key]))]));
}
function durableNewJson(file,value){
  const fd=fs.openSync(file,'wx',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
}
function stablePreimages(approval){
  const got=materialHashes();
  need(MATERIAL_KEYS.every(key=>got[key]===approval.evidenceHashes[key]),
    'POSTSWITCH_APPROVED_ORIGINAL_CHANGED');
}
function pinnedTools(approval,source){
  git(['merge-base','--is-ancestor',source,'HEAD']);
  for(const rel of TOOL_PATHS){
    const actual=digest(read(path.join(repo,rel)));
    const pinned=digest(git(['show',source+':'+rel]));
    need(pinned===actual&&pinned===approval.toolHashes[rel],
      'POSTSWITCH_APPROVED_TOOL_SOURCE_DRIFT');
  }
}
function ensureDirectC(){
  need(process.platform==='win32' && !process.env.GITHUB_ACTIONS &&
    !process.env.RUNNER_NAME && process.stdin.isTTY===true &&
    process.stdout.isTTY===true,
  'POSTSWITCH_DIRECT_WINDOWS_C_OPERATOR_REQUIRED');
}
async function directConfirmation(){
  process.stdout.write('Type RECOVER-917 to authorize this ONE C-grade recovery: ');
  const line=await new Promise((resolve,reject)=>{
    let b='';
    const onData=chunk=>{
      b+=chunk.toString('utf8');
      if(b.includes('\n')){
        process.stdin.off('data',onData);
        process.stdin.pause();
        resolve(b.trim());
      }else if(b.length>80)reject(Error('confirmation too long'));
    };
    process.stdin.resume();process.stdin.on('data',onData);
  });
  need(line==='RECOVER-917','POSTSWITCH_DIRECT_C_CONFIRMATION_DENIED');
}
function loadApproval(args){
  const id=INCIDENT.requestId;
  need(args.length===6 && args[0]==='--request-id' &&
    args[1]===id && args[2]==='--source-sha' &&
    /^[a-f0-9]{40}$/.test(args[3]) &&
    args[4]==='--approval-sha256' && /^[a-f0-9]{64}$/.test(args[5]),
  'POSTSWITCH_OPERATOR_USAGE');
  const file=path.join(repo,'approvals','maintenance-recoveries',id+'.postswitch.json');
  const raw=read(file);
  need(digest(raw)===args[5],'POSTSWITCH_APPROVAL_RAW_HASH_MISMATCH');
  return {approval:JSON.parse(raw.toString('utf8')),source:args[3]};
}

function makePorts({approval,evidence,source,preflight,ledger}){
  const id=INCIDENT.requestId,paths=materialPaths();
  let state=null,backlogIssueNumber=null,backlogResult=null,postcheckResult=null;
  const checked=async()=>{
    stablePreimages(approval);
    const fresh=await inspectPostSwitch(['--request-id',id,'--source-sha',source]);
    validatePostSwitchApproval(approval,{requestId:id,sourceSha:source,evidence:fresh});
    need(fresh.status==='READONLY_POSTSWITCH_EVIDENCE_VERIFIED',
      'POSTSWITCH_LIVE_PRECONDITION_FAILED');
    return fresh;
  };
  const persisted=async report=>{
    need(state!==null,'POSTSWITCH_STATE_NOT_CLAIMED');
    if(report.status==='RECOVERY_COMPLETED'){
      const completed=path.join(maintenance,'recovery','post-switch',id+'.complete.json');
      durableNewJson(completed,{
        schema:'ZGMINI_PC_POSTSWITCH_RESULT_V1',requestId:id,
        status:'RECOVERY_COMPLETED',code:report.code,
        installedSha:INCIDENT.newSha,originalLedgerSha256:approval.evidenceHashes.ledger,
        leaseArchive:report.archivedLeaseName,at:new Date().toISOString()});
    }else{
      state.append('POSTSWITCH_PROGRESS',report);
    }
  };
  return {
    persist:persisted,
    verifyOriginalUnchanged:async()=>{
      try{stablePreimages(approval);return true;}catch{return false;}
    },
    verifyPreconditions:async()=>{
      const fresh=await checked();return {verified:
        fresh.actualControllerSha===INCIDENT.newSha};
    },
    acquireClaim:async()=>{
      need(state===null,'POSTSWITCH_CLAIM_DUPLICATE');
      state=acquirePostSwitchState({maintenanceRoot:maintenance,requestId:id,
        ledgerSha256:approval.evidenceHashes.ledger,sourceSha:source});
      return {acquired:true,exclusive:true,preexisting:false};
    },
    reconcileBacklog:async()=>{
      need(state!==null,'POSTSWITCH_CLAIM_REQUIRED');
      state.verifyStillHeld();
      const fresh=backlogReadOnly(json(paths.backlog));
      need(fresh.candidateCount===1 && fresh.actions.length===1 &&
        fresh.actions[0].originalIssueNumber===919 &&
        JSON.stringify(fresh.actions)===JSON.stringify(preflight.backlogPlan.actions),
      'POSTSWITCH_BACKLOG_PLAN_DRIFT');
      const action=fresh.actions[0],origin=api('issues/919');
      const originalBody=JSON.parse(origin.body);
      need(originalBody.requestId===action.originalRequestId,
        'POSTSWITCH_BACKLOG_REQUEST_DRIFT');
      let issueNumber=919;
      if(action.action==='RECORD_POSTING_THEN_POST_ONCE'){
        state.append('BACKLOG_POSTING_INTENT',{originalIssueNumber:919,
          requestId:action.originalRequestId,title:action.replayTitle});
        let created=null;
        try{created=api('issues',{title:action.replayTitle,
          body:origin.body,labels:['pc-job']});}catch{}
        // ACK loss requires exact, exhaustive readback. Never POST again.
        const matches=exactReplayCandidates(id,origin,issuePages());
        need(matches.length===1 &&
          (created===null||matches[0]===created.number),
        'POSTSWITCH_BACKLOG_POST_OUTCOME_UNKNOWN');
        issueNumber=matches[0];
        state.append('BACKLOG_REPLAY_LINK_VERIFIED',
          {originalIssueNumber:919,replayIssueNumber:issueNumber});
      }else if(['ALREADY_DONE','LINK_LOST_ACK'].includes(action.action)){
        issueNumber=action.replayIssueNumber;
      }else{
        need(['RECORD_RESULT_SKIP','RESULT_PRESENT'].includes(action.action),
          'POSTSWITCH_BACKLOG_ACTION_UNSUPPORTED');
      }
      const result=await waitPcResult(issueNumber,action.originalRequestId,
        INCIDENT.newSha,originalBody.sourceSha);
      state.append('BACKLOG_A_RESULT_VERIFIED',{issueNumber,
        resultJobId:result.jobId,code:result.code});
      backlogIssueNumber=issueNumber;backlogResult=result;
      return {verified:true,outcomeUnknown:false};
    },
    postcheck:async()=>{
      need(state!==null&&backlogResult!==null,'POSTSWITCH_BACKLOG_NOT_VERIFIED');
      const raw=api('issues/'+INCIDENT.issueNumber);
      const original=JSON.parse(raw.body);
      const manifest={targetSha:INCIDENT.newSha,
        postOperation:approval.postcheck.operation,
        postSourceBranch:approval.postcheck.sourceBranch,
        postSourceSha:approval.postcheck.sourceSha};
      let record={requestId:id,claimHeld:true};
      const result=await ensurePostcheckIssue({issue:original,manifest,record,
        listIssues:issuePages,
        createIssue:body=>api('issues',body),
        persist:async next=>{
          state.append('POSTCHECK_ISSUE_STATE',next);record={...next};
        }});
      const pcId=id+'-postcheck';
      postcheckResult=await waitPcResult(result.issueNumber,pcId,
        INCIDENT.newSha,approval.postcheck.sourceSha);
      const fresh=await checked();
      state.append('POSTCHECK_A_RESULT_VERIFIED',
        {issueNumber:result.issueNumber,code:postcheckResult.code,
          resultJobId:postcheckResult.jobId});
      return {status:postcheckResult.status,
        actualExecutionSha:postcheckResult.actualExecutionSha,
        protectedStateUnchanged:postcheckResult.protectedStateUnchanged,
        runnerSetVerified:fresh.checks.RUNNERS_ONLINE===true,
        postSourceVerified:postcheckResult.requestedSourceSha===
          approval.postcheck.sourceSha,outcomeUnknown:false};
    },
    verifyFinal:async()=>{
      need(backlogIssueNumber!==null&&postcheckResult!==null,
        'POSTSWITCH_FINAL_RESULTS_MISSING');
      const fresh=await checked();
      return {currentSourceSha:fresh.actualControllerSha,
        protectedStateUnchanged:fresh.checks.PROTECTION_UNCHANGED,
        workflowActive:fresh.checks.LIVE_WORKFLOW_ACTIVE,
        supervisorVerified:fresh.checks.SUPERVISOR_FRESH,
        runnerSetVerified:fresh.checks.RUNNERS_ONLINE,
        backlogVerified:fresh.checks.BACKLOG_CLOSED};
    },
    archiveLease:async()=>{
      need(state!==null&&backlogResult!==null&&postcheckResult!==null,
        'POSTSWITCH_ARCHIVE_PRECONDITION_MISSING');
      state.verifyStillHeld();
      await checked();
      const dir=path.join(maintenance,'leases','controller-install');
      const out=path.join(maintenance,'recovery','post-switch');
      const oldArchive=path.join(out,id+'.install-lease');
      const claimArchive=path.join(out,id+'.recovery-claim');
      need(!fs.existsSync(oldArchive)&&!fs.existsSync(claimArchive),
        'POSTSWITCH_ARCHIVE_DESTINATION_EXISTS');
      const owner=read(path.join(dir,'owner.json'));
      const marker=read(path.join(dir,'RECOVERY_REQUIRED.json'));
      need(digest(owner)===approval.evidenceHashes.owner &&
        digest(marker)===approval.evidenceHashes.marker,
      'POSTSWITCH_ARCHIVE_OWNER_CHANGED');
      state.append('INSTALL_LEASE_ARCHIVE_INTENT',
        {originalRequestId:id,archiveName:path.basename(oldArchive)});
      stablePreimages(approval);
      // Archive the independent claim first, while the *original* install
      // lock still protects the shared lane. The original lease rename is
      // the final shared-state mutation / explicit release point.
      state.append('RECOVERY_CLAIM_ARCHIVE_INTENT',
        {archiveName:path.basename(claimArchive)});
      const claimOriginal=digest(read(path.join(state.claimDir,'owner.json')));
      fs.renameSync(state.claimDir,claimArchive);
      need(digest(read(path.join(claimArchive,'owner.json')))===claimOriginal &&
        !fs.existsSync(state.claimDir),'POSTSWITCH_CLAIM_ARCHIVE_READBACK_FAILED');
      stablePreimages(approval);
      fs.renameSync(dir,oldArchive);
      // Readback only after releasing the install lock: a new approved
      // maintenance request may now legitimately acquire its own lease.
      need(digest(read(path.join(oldArchive,'owner.json')))===
        approval.evidenceHashes.owner &&
        digest(read(path.join(oldArchive,'RECOVERY_REQUIRED.json')))===
        approval.evidenceHashes.marker &&
        digest(read(paths.ledger))===approval.evidenceHashes.ledger,
      'POSTSWITCH_LEASE_ARCHIVE_READBACK_FAILED');
      return {verified:true,originalPreserved:true,archiveVerified:true,
        claimPreserved:true,archiveName:path.basename(oldArchive)};
    },
  };
}

export async function main(args=process.argv.slice(2),{launcherVerified=false}={}){
  ensureDirectC();
  need(launcherVerified===true,'POSTSWITCH_PINNED_LAUNCHER_REQUIRED');
  const {approval,source}=loadApproval(args),id=INCIDENT.requestId;
  need(approval.sourceSha===source,'POSTSWITCH_APPROVAL_SOURCE_MISMATCH');
  pinnedTools(approval,source);
  const evidence=await inspectPostSwitch(['--request-id',id,'--source-sha',source]);
  validatePostSwitchApproval(approval,{requestId:id,sourceSha:source,evidence});
  need(evidence.status==='READONLY_POSTSWITCH_EVIDENCE_VERIFIED',
    'POSTSWITCH_EVIDENCE_FAILED');
  const preflight=await inspectPreflight(['--request-id',id,'--source-sha',source]);
  need(preflight.status==='POSTSWITCH_PREFLIGHT_READONLY_PASS' &&
    preflight.backlogPlan.candidateCount===1 &&
    preflight.backlogPlan.actions[0]?.originalIssueNumber===919,
  'POSTSWITCH_BACKLOG_SCOPE_MISMATCH');
  const ledger=json(materialPaths().ledger);
  // No operational side effect is permitted before the human C-grade
  // confirmation and all of the pinned, narrow preflight checks succeed.
  await directConfirmation();
  return runApprovedPostSwitch({approval,sourceSha:source,ledger,evidence,
    ports:makePorts({approval,evidence,source,preflight,ledger})});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',
    code:'POSTSWITCH_PINNED_LAUNCHER_REQUIRED',operationalWrites:0}));
  process.exitCode=2;
}
