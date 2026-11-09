// Minimal source-pin bootstrap. No repo-local code is imported until every
// dependency is byte-verified against a committed SHA and a raw C manifest.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const id='pc-update-877e10c8-8580-4095-a675-bef9ec032193';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
const files=Object.freeze([
  'tools/controller-postswitch-launcher.mjs',
  'tools/controller-postswitch-approval.mjs',
  'tools/controller-postswitch-operator.mjs',
  'tools/controller-postswitch-windows.mjs',
  'tools/controller-postswitch-evidence.mjs',
  'tools/controller-postswitch-preflight.mjs',
  'tools/controller-postswitch-backlog.mjs',
  'tools/controller-postswitch-postcheck.mjs',
  'tools/controller-postswitch-reconciliation.mjs',
  'tools/controller-postswitch-state.mjs',
  'tools/update.mjs',
  'tools/maintenance-apply.mjs',
  'tools/maintenance-contract.mjs',
  'tools/maintenance-lock.mjs',
  'tools/source-bundle-register.mjs',
]);
export function verifyLauncherArguments(args){
  need(Array.isArray(args)&&args.length===6&&args[0]==='--request-id'&&
    args[1]===id&&args[2]==='--source-sha'&&
    /^[a-f0-9]{40}$/.test(args[3])&&
    args[4]==='--approval-sha256'&&/^[a-f0-9]{64}$/.test(args[5]),
  'POSTSWITCH_LAUNCHER_ARGUMENTS_INVALID');
  return args;
}
export function verifyReadOnlyPrepareArguments(args){
  need(Array.isArray(args)&&args.length===5&&
    args[0]==='prepare'&&args[1]==='--request-id'&&args[2]===id&&
    args[3]==='--source-sha'&&/^[a-f0-9]{40}$/.test(args[4]),
  'POSTSWITCH_PREPARE_ARGUMENTS_INVALID');
  return args;
}
function committedClosure(source){
  const git=params=>execFileSync('git',params,{cwd:repo,windowsHide:true,
    timeout:30000,maxBuffer:8e6});
  git(['merge-base','--is-ancestor',source,'HEAD']);
  const hashes={};
  for(const file of files){
    const live=hash(fs.readFileSync(path.join(repo,file)));
    const committed=hash(git(['show',source+':'+file]));
    need(live===committed,'POSTSWITCH_LAUNCHER_SOURCE_DRIFT');
    hashes[file]=live;
  }
  return hashes;
}
function verifyPinnedClosure(args){
  const source=args[3],approvalFile=path.join(repo,'approvals',
    'maintenance-recoveries',id+'.postswitch.json');
  const raw=fs.readFileSync(approvalFile);
  need(hash(raw)===args[5],'POSTSWITCH_LAUNCHER_APPROVAL_HASH_INVALID');
  const approval=JSON.parse(raw.toString('utf8'));
  const hashes=approval?.toolHashes;
  need(approval.schema==='ZGMINI_PC_POSTSWITCH_RECOVERY_APPROVAL_V1'&&
    approval.approved===true&&approval.operation==='FORWARD_POSTSWITCH_917'&&
    approval.requestId===id&&approval.sourceSha===source&&
    hashes&&typeof hashes==='object'&&!Array.isArray(hashes)&&
    Object.keys(hashes).length===files.length&&
    files.every(f=>/^[a-f0-9]{64}$/.test(hashes[f]??'')),
  'POSTSWITCH_LAUNCHER_APPROVAL_INVALID');
  const git=params=>execFileSync('git',params,{cwd:repo,windowsHide:true,
    timeout:30000,maxBuffer:8e6});
  const committedApproval=git(['show','HEAD:approvals/maintenance-recoveries/'+
    id+'.postswitch.json']);
  need(hash(committedApproval)===hash(raw),
    'POSTSWITCH_LAUNCHER_APPROVAL_NOT_COMMITTED');
  const committed=committedClosure(source);
  need(files.every(file=>committed[file]===hashes[file]),
    'POSTSWITCH_LAUNCHER_APPROVED_TOOL_DRIFT');
  return approval;
}
// A failed *read-only* C preflight must expose the exact failed checks, not
// collapse them into an opaque error that asks the operator to rerun blindly.
// Never include raw ledger/owner/marker, access tokens or protected contents.
export function summarizePrepareEvidence(evidence){
  if(evidence?.status==='READONLY_POSTSWITCH_EVIDENCE_VERIFIED')return null;
  const checks=evidence?.checks&&typeof evidence.checks==='object' &&
    !Array.isArray(evidence.checks)?evidence.checks:{};
  const safeCode=value=>typeof value==='string'&&/^[A-Z0-9_]{1,100}$/.test(value)
    ?value:'NOT_RECORDED';
  return {status:'RECOVERY_REQUIRED',
    code:'POSTSWITCH_PREPARE_EVIDENCE_FAILED',
    evidenceCode:safeCode(evidence?.code),
    failedChecks:Object.entries(checks).filter(([,ok])=>ok!==true)
      .map(([name])=>name).filter(name=>/^[A-Z0-9_]{1,100}$/.test(name)),
    protectionCode:safeCode(evidence?.protectionCode),
    exactInventories:evidence?.exactInventories===true,
    exactSourceBytes:evidence?.exactSourceBytes===true,
    operationalWrites:0,recoveryAuthorized:false,
    next:'RECONCILE_NAMED_READONLY_CHECKS_NO_RETRY_OR_LOCK_CHANGE'};
}
async function prepareReadOnly(args){
  verifyReadOnlyPrepareArguments(args);
  const source=args[4],toolHashes=committedClosure(source);
  // Import the read-only planners only after the entire local dependency
  // closure was verified against the pinned Git commit.
  const {main:inspect}=await import('./controller-postswitch-evidence.mjs');
  const {main:preflight}=await import('./controller-postswitch-preflight.mjs');
  const evidence=await inspect(['--request-id',id,'--source-sha',source]);
  const namedFailure=summarizePrepareEvidence(evidence);
  if(namedFailure)return {...namedFailure,requestId:id,sourceSha:source};
  const plan=await preflight(['--request-id',id,'--source-sha',source]);
  need(plan.status==='POSTSWITCH_PREFLIGHT_READONLY_PASS'&&
    plan.backlogPlan.candidateCount===1&&
    plan.backlogPlan.actions[0]?.originalIssueNumber===919,
  'POSTSWITCH_PREPARE_BACKLOG_SCOPE_DRIFT');
  const gh='C:/Program Files/GitHub CLI/gh.exe';
  const remote=execFileSync(gh,['api','repos/ansqhd5774-Choi/zgmini/commits/main'],
    {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:3e6});
  const postSourceSha=JSON.parse(remote).sha;
  need(/^[a-f0-9]{40}$/.test(postSourceSha),
    'POSTSWITCH_PREPARE_POST_SOURCE_UNVERIFIED');
  const candidate={
    schema:'ZGMINI_PC_POSTSWITCH_RECOVERY_APPROVAL_V1',
    approved:false,operation:'FORWARD_POSTSWITCH_917',
    requestId:id,issueNumber:917,sourceSha:source,
    installedShaBefore:'c09bf6a6f66f229016135020d6ba553ba9a94676',
    targetControllerSha:'badad9124157879d7a645b64f2768113d632355b',
    evidenceHashes:evidence.materialHashes,
    toolHashes,
    expectedBacklogIssues:[919],
    postcheck:{operation:'core-status',sourceRepository:'ansqhd5774-Choi/zgmini',
      sourceBranch:'main',sourceSha:postSourceSha},
  };
  return {status:'POSTSWITCH_APPROVAL_CANDIDATE_READONLY',
    requestId:id,sourceSha:source,approvalCandidate:candidate,
    operationalWrites:0,recoveryAuthorized:false,
    next:'REVIEW_EXACT_MANIFEST_THEN_DIRECT_C_GRADE_OPERATOR'};
}
export async function main(args=process.argv.slice(2)){
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
    !process.env.RUNNER_NAME,'POSTSWITCH_DIRECT_WINDOWS_C_OPERATOR_REQUIRED');
  if(args[0]==='prepare')return prepareReadOnly(args);
  need(process.stdin.isTTY===true&&process.stdout.isTTY===true,
    'POSTSWITCH_DIRECT_WINDOWS_C_OPERATOR_REQUIRED');
  verifyLauncherArguments(args);
  verifyPinnedClosure(args);
  const {main:run}=await import('./controller-postswitch-windows.mjs');
  return run(args,{launcherVerified:true});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const result=await main();
    console.log(JSON.stringify(result));
    if(!['RECOVERY_COMPLETED','POSTSWITCH_APPROVAL_CANDIDATE_READONLY'].includes(result.status))
      process.exitCode=2;
  }catch(error){
    console.log(JSON.stringify({status:'RECOVERY_REQUIRED',
      code:/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:
        'POSTSWITCH_C_OPERATOR_STOP',
      originalRequestRetried:false,
      next:'INSPECT_EXISTING_RECOVERY_CLAIM_AND_ORIGINAL_NO_AUTOMATIC_RETRY'}));
    process.exitCode=2;
  }
}
