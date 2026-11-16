// Exact #1501 RECONNECTED recovery. No install, replay, workflow PUT or rollback.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {collectAutomationStatus} from './automation-status.mjs';
import {protectedSnapshot,verifyRecoveryOperator,closeLatestPause} from './update.mjs';

export const REQUEST='pc-update-95a0c24a-e0eb-4ad5-a250-559750f8450b';
const root='E:/ZGmini/automation/pc-maintenance',control='E:/ZGmini/automation/pc-control';
const repository='ansqhd5774-Choi/zgmini-pc-control';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digest=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c});};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const alive=p=>{try{process.kill(p,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};
const gh=(route)=>JSON.parse(execFileSync('C:/Program Files/GitHub CLI/gh.exe',
 ['api',route.startsWith('search/')?route:`repos/${repository}/${route}`],
 {windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:4e6}));
const put=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
const dependencies=['tools/controller-intake-recovery.mjs','tools/automation-status.mjs',
 'tools/update.mjs','tools/maintenance-apply.mjs','tools/maintenance-contract.mjs',
 'tools/maintenance-lock.mjs','tools/source-bundle-register.mjs'];

export function planIntakeRecovery(e){
 need(e.ledger.requestId===REQUEST&&e.ledger.issueNumber===1501&&
  e.ledger.status==='RECOVERY_REQUIRED'&&e.ledger.firstFail==='RECONNECTED'&&
  e.ledger.failureOperation==='resumeIntake'&&!e.ledger.postIssueNumber,'INTAKE_ORIGINAL_PHASE');
 need(e.identityVerified===true&&e.ownerAlive===false,'INTAKE_OWNER_UNVERIFIED');
 need(e.status.runtimeState==='HEALTHY'&&e.status.maintenanceState==='HEALTHY'&&
  e.status.workflowState==='active'&&e.status.actualControllerSha===e.ledger.targetSha&&
  e.status.installLock.held===true&&e.status.installLock.recoveryRequired===true,
  'INTAKE_RUNTIME_UNVERIFIED');
 need(e.backlog.schema==='ZGMINI_PC_BACKLOG_V1'&&e.backlog.requestId===REQUEST&&
  e.backlog.windows?.length===1&&e.backlog.windows[0].resumedAt===null&&
  Object.keys(e.backlog.replays??{}).length===0,'INTAKE_BACKLOG_NOT_ORIGINAL');
 need(e.protectedTasksSame===true,'INTAKE_PROTECTED_TASK_DRIFT');
 need(e.searchComplete===true&&JSON.stringify([...e.candidates].sort((a,b)=>a-b))==='[1503,1508]',
  'INTAKE_BACKLOG_CANDIDATES_UNVERIFIED');
 const fields=['operation','sourceRepository','sourceBranch','sourceSha'];
 need(fields.every(k=>e.original1503[k]===e.replacement1517[k]),'INTAKE_REPLACEMENT_SCOPE');
 for(const [body,r] of [[e.replacement1517,e.receipt1517],[e.original1508,e.receipt1508]]){
  need(r.schema==='ZGMINI_PC_RESULT_V1'&&r.controlRepository===repository&&
   r.requestId===body.requestId&&r.operation===body.operation&&r.sourceRepository===body.sourceRepository&&
   r.sourceBranch===body.sourceBranch&&r.requestedSourceSha===body.sourceSha&&
   r.protectedStateUnchanged===true&&r.providerCalls===0&&r.operationalWrites===0&&r.d1Writes===0&&
   ['PASS','BLOCKED'].includes(r.status)&&Number.isFinite(Date.parse(r.finishedAt)),'INTAKE_RECEIPT_UNVERIFIED');
 }
 need(e.receipt1508.status==='PASS'&&e.botReceipt1508===true&&e.botReceipt1517===true&&
  e.resultPairsVerified===true,'INTAKE_REMOTE_RECEIPT_UNVERIFIED');
 const resumedAt=e.receipt1508.startedAt;
 need(Number.isFinite(Date.parse(resumedAt))&&Date.parse(resumedAt)>=Date.parse(e.backlog.pausedAt),
  'INTAKE_RESUME_BOUND_INVALID');
 const backlog=closeLatestPause(e.backlog,resumedAt);
 backlog.resumeEvidence={kind:'SUCCESSFUL_DISPATCH_UPPER_BOUND',issueNumber:1508,
  observedAt:e.status.observedAt,exactEnableTimeKnown:false};
 backlog.replays={
  '1503':{status:'SKIPPED_EQUIVALENT_EXECUTION',replacementIssueNumber:1517,
   originalRequestId:e.original1503.requestId,resultStatus:e.receipt1517.status},
  '1508':{status:'SKIPPED_RESULT_PRESENT',originalRequestId:e.original1508.requestId}};
 return {backlog,summary:{schema:'ZGMINI_PC_INTAKE_RECOVERY_V1',requestId:REQUEST,
  status:'INTAKE_RECONCILIATION_ELIGIBLE',actualControllerSha:e.status.actualControllerSha,
  originalLedgerPreserved:true,originalRequestRetried:false,controllerChanged:false,
  workflowChanged:false,replayedRequests:0,providerCalls:0,operationalWrites:0,d1Writes:0,
  protectedStateUnchanged:true,candidateCount:2,replacementIssueNumber:1517,
  replacementFunctionalStatus:e.receipt1517.status,resumeEvidenceIssueNumber:1508}};
}

function resultPair(issueNumber,basename){
 const i=gh(`issues/${issueNumber}`),body=JSON.parse(i.body);
 need(i.user?.login==='ansqhd5774-Choi'&&i.labels.some(x=>x.name==='pc-job'),'INTAKE_PC_ISSUE_IDENTITY');
 const comments=gh(`issues/${issueNumber}/comments?per_page=100`);
 need(comments.length<100,'INTAKE_COMMENTS_TRUNCATED');
 const file=ext=>gh(`contents/results/${basename}.${ext}?ref=main`);
 const j=file('json'),t=file('txt');
 const raw=Buffer.from(j.content,'base64'),txt=Buffer.from(t.content,'base64').toString('utf8');
 const receipt=JSON.parse(raw);
 need(txt.includes('requestId='+body.requestId)&&txt.includes('status='+receipt.status)&&
  txt.includes('code='+receipt.code),'INTAKE_RESULT_PAIR_MISMATCH');
 const bot=comments.some(x=>x.user?.login==='github-actions[bot]'&&
  x.body.includes('zgmini-pc-result:')&&x.body.includes(`results/${basename}.json`)&&
  x.body.includes(body.requestId));
 return {body,receipt,bot};
}

export function collectEvidence(){
 const dir=path.join(root,'leases/controller-install');
 const files={ledger:path.join(root,'ledger',REQUEST+'.json'),owner:path.join(dir,'owner.json'),
  marker:path.join(dir,'RECOVERY_REQUIRED.json'),backlog:path.join(root,'backlog',REQUEST+'.json'),
  host:path.join(control,'host.json'),baseline:path.join(control,'backups','controller-update-'+REQUEST,'PROTECTED_BEFORE.json')};
 const bytes=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,fs.readFileSync(p)]));
 const values=Object.fromEntries(Object.entries(bytes).map(([k,b])=>[k,JSON.parse(b)]));
 const status=collectAutomationStatus([]),protectedState=protectedSnapshot();
 const a=resultPair(1508,'43786853022-1-seat-1'),b=resultPair(1517,'43789176758-1-seat-4');
 const original=gh('issues/1501'),body=JSON.parse(original.body),missing=gh('issues/1503');
 need(missing.user?.login==='ansqhd5774-Choi'&&missing.labels.some(x=>x.name==='pc-job'),'INTAKE_ORIGINAL_PC_ISSUE');
 const from=new Date(Date.parse(values.backlog.pausedAt)-2000).toISOString();
 const to=a.receipt.startedAt;
 const query=`repo:${repository} is:issue label:pc-job created:${from}..${to}`;
 const search=gh('search/issues?q='+encodeURIComponent(query)+'&per_page=100');
 const owner=values.owner,marker=values.marker;
 const identityVerified=original.user?.login==='ansqhd5774-Choi'&&original.title==='pc-controller-update'&&
  body.requestId===REQUEST&&body.targetControllerSha===values.ledger.targetSha&&
  owner.nonce===marker.nonce&&owner.pid===marker.requestOwnerPid&&
  Number.isSafeInteger(owner.pid)&&owner.pid>0;
 for(const [k,p] of Object.entries(files))need(fs.readFileSync(p).equals(bytes[k]),'INTAKE_EVIDENCE_CHANGED');
 const e={...values,status,identityVerified,ownerAlive:alive(owner.pid),
  protectedTasksSame:JSON.stringify(protectedState.tasks)===JSON.stringify(values.baseline.tasks),
  searchComplete:search.incomplete_results===false&&search.total_count===search.items.length&&search.total_count<100,
  candidates:search.items.map(x=>x.number),original1503:JSON.parse(missing.body),
  replacement1517:b.body,original1508:a.body,receipt1508:a.receipt,receipt1517:b.receipt,
  botReceipt1508:a.bot,botReceipt1517:b.bot,resultPairsVerified:true};
 const plan=planIntakeRecovery(e);
 return {...plan,files,bytes,hashes:{...Object.fromEntries(Object.entries(bytes).map(([k,b])=>[k,digest(b)])),
  protectedState:digest(JSON.stringify(protectedState))},ownerPid:owner.pid};
}

export async function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'INTAKE_OPERATOR_WINDOWS_REQUIRED');
 need(args.length===3&&['inspect','apply'].includes(args[0])&&args[1]==='--source-sha'&&
  /^[a-f0-9]{40}$/.test(args[2]),'INTAKE_USAGE');
 const [mode,,sourceSha]=args;
 const git=a=>execFileSync('git',a,{cwd:repo,windowsHide:true,maxBuffer:12e6});
 git(['merge-base','--is-ancestor',sourceSha,'HEAD']);
 const fileHashes=Object.fromEntries(dependencies.map(p=>{
  const pinned=git(['show',sourceSha+':'+p]);
  need(digest(pinned)===digest(fs.readFileSync(path.join(repo,p))),'INTAKE_SOURCE_DRIFT');
  return [p,digest(pinned)];
 }));
 const e=collectEvidence();
 const proposal={...e.summary,sourceSha,hashes:e.hashes,fileHashes};
 if(mode==='inspect')return proposal;
 verifyRecoveryOperator();
 const rel=`approvals/maintenance-recoveries/${REQUEST}.intake.json`;
 const raw=fs.readFileSync(path.join(repo,rel)),approval=JSON.parse(raw);
 need(digest(raw)===digest(git(['show','HEAD:'+rel])),'INTAKE_APPROVAL_UNCOMMITTED');
 need(approval.schema==='ZGMINI_PC_INTAKE_RECOVERY_APPROVAL_V1'&&approval.approved===true&&
  approval.requestId===REQUEST&&approval.sourceSha===sourceSha&&
  JSON.stringify(approval.hashes)===JSON.stringify(e.hashes)&&
  JSON.stringify(approval.fileHashes)===JSON.stringify(fileHashes),'INTAKE_APPROVAL_MISMATCH');
 return commitIntakeRecovery({e,proposal,sourceSha,freshEvidence:collectEvidence,
  verifyFinal:()=>{
   const s=collectAutomationStatus([]);
   need(s.runtimeState==='HEALTHY'&&s.maintenanceState==='HEALTHY'&&s.workflowState==='active'&&
    s.actualControllerSha===e.summary.actualControllerSha,'INTAKE_FINAL_RUNTIME_DRIFT');
   need(digest(JSON.stringify(protectedSnapshot()))===e.hashes.protectedState,'INTAKE_FINAL_PROTECTION_DRIFT');
  }});
}

export function commitIntakeRecovery({e,proposal,sourceSha,freshEvidence,verifyFinal,
 rootDir=root,isAlive=alive}){
 const claim=path.join(rootDir,'leases/controller-recovery');fs.mkdirSync(claim);
 const nonce=randomUUID(),claimFile=path.join(claim,'owner.json');
 put(claimFile,{pid:process.pid,nonce,requestId:REQUEST});
 const out=path.join(rootDir,'recovery'),record=path.join(out,REQUEST+'-intake-'+nonce+'.json');
 fs.mkdirSync(out,{recursive:true});let started=false;
 try{
  const fresh=freshEvidence();
  need(JSON.stringify(fresh.hashes)===JSON.stringify(e.hashes)&&isAlive(e.ownerPid)===false,'INTAKE_EVIDENCE_CHANGED');
  put(record,{...proposal,status:'PREPARED',at:new Date().toISOString()});
  fs.writeFileSync(record+'.original-backlog.json',e.bytes.backlog,{flag:'wx',mode:0o600});
  // Durable PREPARED and claim precede the first operational bookkeeping write.
  started=true;
  const tmp=e.files.backlog+'.intake-'+nonce+'.tmp';put(tmp,e.backlog);
  need(fs.readFileSync(e.files.backlog).equals(e.bytes.backlog),'INTAKE_BACKLOG_CHANGED');
  fs.renameSync(tmp,e.files.backlog);
  need(JSON.stringify(read(e.files.backlog))===JSON.stringify(e.backlog),'INTAKE_BACKLOG_READBACK');
  verifyFinal();
  for(const k of ['ledger','owner','marker','host','baseline'])
   need(fs.readFileSync(e.files[k]).equals(e.bytes[k]),'INTAKE_FINAL_IDENTITY_DRIFT');
  need(isAlive(e.ownerPid)===false,'INTAKE_OWNER_REVIVED');
  const archive=path.join(out,REQUEST+'-intake-'+nonce+'.lease');
  put(record+'.archive-prepared.json',{...proposal,status:'ARCHIVE_PREPARED',archiveName:path.basename(archive)});
  fs.renameSync(path.join(rootDir,'leases/controller-install'),archive);
  const result={...e.summary,status:'INTAKE_RECOVERED_EXISTING_CONTROLLER_PRESERVED',sourceSha,
   leaseArchived:true,archiveName:path.basename(archive),maintenanceBookkeepingWrites:2,
   at:new Date().toISOString()};
  put(record+'.complete.json',result);
  started=false;return result;
 }finally{
  // Any uncertain write preserves the reservation and durable evidence. No retry.
  if(!started){need(read(claimFile).nonce===nonce,'INTAKE_CLAIM_CHANGED');fs.unlinkSync(claimFile);fs.rmdirSync(claim);}
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await main()));}catch(e){
  console.log(JSON.stringify({status:'RECOVERY_REQUIRED',code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'INTAKE_INSPECTION_FAILED',
   next:'INSPECT_ORIGINAL_AND_RECOVERY_RECORDS_NO_RETRY'}));process.exitCode=2;
 }
}
