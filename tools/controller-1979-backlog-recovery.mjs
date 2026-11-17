// Exact post-INTAKE_RESUMED reconciliation. Never replay an invalid pc-job.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {REQUEST1979,resultPair,commitIntakeRecovery} from './controller-intake-recovery.mjs';
import {collectAutomationStatus} from './automation-status.mjs';
import {protectedSnapshot,verifyRecoveryOperator,validBacklogOriginalPcJob} from './update.mjs';
const repository='ansqhd5774-Choi/zgmini-pc-control';
const root='E:/ZGmini/automation/pc-maintenance',control='E:/ZGmini/automation/pc-control';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target='5492726bb5b0505b7ff7db73a3c673dabdf724ce';
const originalHash='c60bff2b88c85351c8ca6b9e9b06826b86972ec006edf94c631b5e3964255fdb';
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c});};
const hash=b=>createHash('sha256').update(b).digest('hex');
const gh=route=>JSON.parse(execFileSync('C:/Program Files/GitHub CLI/gh.exe',
 ['api',route.startsWith('search/')?route:`repos/${repository}/${route}`],
 {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:8e6}));
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};
export function plan1979(e){
 need(e.ledger.requestId===REQUEST1979&&e.ledger.issueNumber===1979&&
  e.ledger.targetSha===target&&e.ledger.status==='RECOVERY_REQUIRED'&&
  e.ledger.firstFail==='INTAKE_RESUMED'&&e.ledger.failureOperation==='reconcileBacklog'&&
  e.ledger.code==='BACKLOG_ORIGINAL_REQUEST_INVALID'&&!e.ledger.postIssueNumber,'INTAKE_1979_PHASE');
 need(e.identityVerified===true&&e.ownerAlive===false,'INTAKE_1979_OWNER');
 need(e.status.runtimeState==='HEALTHY'&&e.status.maintenanceState==='HEALTHY'&&
  e.status.actualControllerSha===target&&e.status.workflowState==='active'&&
  e.status.installLock?.held===true&&e.status.installLock?.recoveryRequired===true,
  'INTAKE_1979_RUNTIME');
 need(e.backlog.schema==='ZGMINI_PC_BACKLOG_V1'&&e.backlog.requestId===REQUEST1979&&
  e.backlog.pausedAt==='2026-11-17T09:44:25.782Z'&&
  e.backlog.resumedAt==='2026-11-17T09:48:12.244Z'&&e.backlog.windows?.length===1&&
  e.backlog.windows[0].pausedAt===e.backlog.pausedAt&&
  e.backlog.windows[0].resumedAt===e.backlog.resumedAt&&
  Object.keys(e.backlog.replays??{}).length===0,'INTAKE_1979_BACKLOG');
 need(e.protectedTasksSame===true&&e.searchComplete===true&&
  JSON.stringify(e.candidates)==='[1981]','INTAKE_1979_CANDIDATES');
 need(typeof e.originalBody==='string'&&hash(e.originalBody)===originalHash,
  'INTAKE_1979_ORIGINAL_BYTES');
 const body=JSON.parse(e.originalBody);
 need(!validBacklogOriginalPcJob(body)&&body.operation==='writer-install-preimage-readonly'&&
  body.requestId==='pc-1af3112e-95b6-4f21-a69b-10c0f585fa44'&&
  body.preimageManifestPath==='approvals/writer-updates/w05-r304-wpsfd42-threefile-source-20261117.json',
  'INTAKE_1979_REJECTION_UNPROVEN');
 const r=e.receipt1985,b=e.body1985;
 need(e.botReceipt===true&&e.resultPairsVerified===true&&r.schema==='ZGMINI_PC_RESULT_V1'&&
  r.controlRepository===repository&&r.requestId===b.requestId&&r.operation===b.operation&&
  r.operation==='r47-task-action-readonly'&&r.sourceRepository===b.sourceRepository&&
  r.sourceBranch===b.sourceBranch&&r.requestedSourceSha===b.sourceSha&&
  r.actualExecutionSha===target&&r.controlSourceSha===target&&r.status==='PASS'&&
  r.protectedStateUnchanged===true&&r.providerCalls===0&&r.operationalWrites===0&&r.d1Writes===0&&
  r.sqliteOpened===false&&Number.isFinite(Date.parse(r.startedAt))&&
  Date.parse(r.startedAt)>=Date.parse(e.backlog.resumedAt)&&
  Number.isFinite(Date.parse(r.finishedAt))&&Date.parse(r.finishedAt)>=Date.parse(r.startedAt),
  'INTAKE_1979_POST_RESUME_RECEIPT');
 const backlog=structuredClone(e.backlog);
 backlog.replays['1981']={status:'REJECTED_INVALID_ORIGINAL',originalRequestId:body.requestId,
  reason:'PREIMAGE_MANIFEST_PATH',originalBodySha256:originalHash,replayed:false};
 backlog.recoveryEvidence={issueNumber:1979,postResumeIssueNumber:1985,
  rejectedIssueNumber:1981,originalLedgerPreserved:true};
 return {backlog,summary:{schema:'ZGMINI_PC_INTAKE_RECOVERY_V1',requestId:REQUEST1979,issueNumber:1979,
  status:'INTAKE_RECONCILIATION_ELIGIBLE',actualControllerSha:target,originalLedgerPreserved:true,
  originalRequestRetried:false,controllerChanged:false,workflowChanged:false,replayedRequests:0,
  rejectedOriginalIssues:[1981],rejectionCode:'PREIMAGE_MANIFEST_PATH',providerCalls:0,
  operationalWrites:0,d1Writes:0,protectedStateUnchanged:true}};
}
export function collect1979(){
 const dir=path.join(root,'leases/controller-install');
 const files={ledger:path.join(root,'ledger',REQUEST1979+'.json'),owner:path.join(dir,'owner.json'),
  marker:path.join(dir,'RECOVERY_REQUIRED.json'),backlog:path.join(root,'backlog',REQUEST1979+'.json'),
  host:path.join(control,'host.json'),baseline:path.join(control,'backups','controller-update-'+REQUEST1979,'PROTECTED_BEFORE.json')};
 const bytes=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,fs.readFileSync(p)]));
 const v=Object.fromEntries(Object.entries(bytes).map(([k,b])=>[k,JSON.parse(b)]));
 const status=collectAutomationStatus([]),protection=protectedSnapshot();
 const update=gh('issues/1979'),u=JSON.parse(update.body),original=gh('issues/1981');
 const receipt=resultPair(1985,'44061200201-1-seat-6');
 const query=`repo:${repository} is:issue label:pc-job created:${new Date(Date.parse(v.backlog.pausedAt)-2000).toISOString()}..${v.backlog.resumedAt}`;
 const search=gh('search/issues?q='+encodeURIComponent(query)+'&per_page=100');
 const identityVerified=update.user?.login==='ansqhd5774-Choi'&&update.title==='pc-controller-update'&&
  u.requestId===REQUEST1979&&u.targetControllerSha===v.ledger.targetSha&&
  original.user?.login==='ansqhd5774-Choi'&&original.labels.some(x=>x.name==='pc-job')&&
  v.owner.nonce===v.marker.nonce&&v.owner.pid===v.marker.requestOwnerPid&&
  Number.isSafeInteger(v.owner.pid)&&v.owner.pid>0;
 const p=plan1979({...v,status,identityVerified,ownerAlive:alive(v.owner.pid),
  protectedTasksSame:JSON.stringify(protection.tasks)===JSON.stringify(v.baseline.tasks),
  searchComplete:search.incomplete_results===false&&search.total_count===search.items.length&&search.total_count<100,
  candidates:search.items.map(x=>x.number).sort((a,b)=>a-b),originalBody:original.body,
  receipt1985:receipt.receipt,body1985:receipt.body,botReceipt:receipt.bot,resultPairsVerified:true});
 for(const[k,f]of Object.entries(files))need(fs.readFileSync(f).equals(bytes[k]),'INTAKE_EVIDENCE_CHANGED');
 return {...p,files,bytes,ownerPid:v.owner.pid,hashes:{...Object.fromEntries(Object.entries(bytes).map(([k,b])=>[k,hash(b)])),
  protectedState:hash(JSON.stringify(protection))}};
}
const dependencies=['tools/controller-1979-backlog-recovery.mjs','tools/controller-intake-recovery.mjs',
 'tools/automation-status.mjs','tools/update.mjs','tools/maintenance-apply.mjs',
 'tools/maintenance-contract.mjs','tools/maintenance-lock.mjs','tools/source-bundle-register.mjs'];
export function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'INTAKE_OPERATOR_WINDOWS_REQUIRED');
 need(args.length===3&&['inspect','apply'].includes(args[0])&&args[1]==='--source-sha'&&/^[a-f0-9]{40}$/.test(args[2]),'INTAKE_USAGE');
 const[mode,,sourceSha]=args,git=a=>execFileSync('git',a,{cwd:repo,windowsHide:true,maxBuffer:12e6});
 git(['merge-base','--is-ancestor',sourceSha,'HEAD']);
 const fileHashes=Object.fromEntries(dependencies.map(p=>{const pinned=git(['show',sourceSha+':'+p]);
  need(hash(pinned)===hash(fs.readFileSync(path.join(repo,p))),'INTAKE_SOURCE_DRIFT');return[p,hash(pinned)];}));
 const e=collect1979(),proposal={...e.summary,sourceSha,hashes:e.hashes,fileHashes};
 if(mode==='inspect')return proposal;
 verifyRecoveryOperator();
 const rel=`approvals/maintenance-recoveries/${REQUEST1979}.intake.json`,raw=fs.readFileSync(path.join(repo,rel)),a=JSON.parse(raw);
 need(hash(raw)===hash(git(['show','HEAD:'+rel]))&&a.schema==='ZGMINI_PC_INTAKE_RECOVERY_APPROVAL_V1'&&
  a.approved===true&&a.requestId===REQUEST1979&&a.sourceSha===sourceSha&&
  JSON.stringify(a.hashes)===JSON.stringify(e.hashes)&&JSON.stringify(a.fileHashes)===JSON.stringify(fileHashes),
  'INTAKE_APPROVAL_MISMATCH');
 return commitIntakeRecovery({e,proposal,sourceSha,freshEvidence:collect1979,verifyFinal:()=>{
  const s=collectAutomationStatus([]);
  need(s.runtimeState==='HEALTHY'&&s.maintenanceState==='HEALTHY'&&s.workflowState==='active'&&
   s.actualControllerSha===target&&hash(JSON.stringify(protectedSnapshot()))===e.hashes.protectedState,'INTAKE_FINAL_RUNTIME_DRIFT');
 }});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(main()));}catch(e){console.log(JSON.stringify({status:'RECOVERY_REQUIRED',
  code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'INTAKE_INSPECTION_FAILED',next:'NO_RETRY_INSPECT_ORIGINAL_RECORDS'}));process.exitCode=2;}
}
