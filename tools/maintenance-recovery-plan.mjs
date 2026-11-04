// Read-only, source-pinned proposal builder for a pre-validation recovery.
// This does not approve a recovery, release a lease, or install anything.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const isSha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const isId=x=>typeof x==='string'&&/^pc-[a-z0-9-]{8,76}$/.test(x);
const fail=code=>Object.assign(new Error(code),{code});
const requireTrue=(test,code)=>{if(!test)throw fail(code);};
// Must match the fixed recovery evidence contract in maintenance-recovery.mjs.
// Eight arbitrary true values cannot establish an untouched installation.
const REQUIRED_CHECKS=Object.freeze([
  'REQUEST_IDENTITY','DEAD_INSTALL_OWNER','PREVALIDATION_ONLY','ORIGINAL_BYTES',
  'NO_UPDATE_ARTIFACTS','NO_PAUSE','RUNNERS_IDLE','MAINTAINER_BYTES',
]);

// The approved manifest must be reviewed and committed separately. Do not
// propagate raw lease bytes or owner identity into the plan/report.
export function makeRecoveryPlan({requestId,sourceSha,inspection,
  ledgerBytes,ownerBytes,markerBytes,toolSha256}){
  requireTrue(isId(requestId)&&isSha(sourceSha),'RECOVERY_PLAN_IDENTITY_INVALID');
  requireTrue(/^[a-f0-9]{64}$/.test(toolSha256??''),'RECOVERY_PLAN_TOOL_HASH_INVALID');
  requireTrue(Buffer.isBuffer(ledgerBytes)&&Buffer.isBuffer(ownerBytes)&&Buffer.isBuffer(markerBytes),
    'RECOVERY_PLAN_EVIDENCE_INVALID');
  requireTrue(inspection?.requestId===requestId&&inspection?.sourceSha===sourceSha&&
    inspection?.status==='ABORT_UNTOUCHED_ELIGIBLE'&&inspection?.code==='PREVALIDATION_ABORT_VERIFIED'&&
    inspection?.operationalWrites===0&&
    Object.keys(inspection?.checks??{}).length===REQUIRED_CHECKS.length&&
    REQUIRED_CHECKS.every(key=>inspection.checks[key]===true),
    'RECOVERY_PLAN_NOT_ELIGIBLE');
  let ledger;
  try{ledger=JSON.parse(ledgerBytes.toString('utf8'));}
  catch{throw fail('RECOVERY_PLAN_LEDGER_INVALID');}
  requireTrue(ledger?.requestId===requestId&&Number.isSafeInteger(ledger.issueNumber)&&ledger.issueNumber>0&&
    isSha(ledger.installedShaBefore)&&ledger.installedShaBefore===inspection.actualControllerSha,
    'RECOVERY_PLAN_LEDGER_MISMATCH');
  const failureOperation=/^[a-z][a-zA-Z0-9_-]{0,64}$/.test(ledger.failureOperation??'')
    ?ledger.failureOperation:'UNKNOWN';
  return {
    schema:'ZGMINI_PC_RECOVERY_PLAN_V1',status:'PROPOSAL_ONLY',requestId,sourceSha,
    operation:'ABORT_UNTOUCHED',failureOperation,
    approvalPath:'approvals/maintenance-recoveries/'+requestId+'.json',
    approvalDraft:{schema:'ZGMINI_PC_RECOVERY_APPROVAL_V1',approved:false,
      operation:'ABORT_UNTOUCHED',requestId,issueNumber:ledger.issueNumber,
      sourceSha,installedSha:inspection.actualControllerSha,toolSha256,
      ledgerSha256:digest(ledgerBytes),ownerSha256:digest(ownerBytes),
      markerSha256:digest(markerBytes)},
    next:'REVIEW_COMMIT_EXACT_MANIFEST_THEN_INDEPENDENT_WINDOWS_ABORT_ONCE',
    operationalWrites:0,
  };
}

// Read evidence twice across the official inspect; a changed lease is not a
// valid proposal. The actual mutating recovery independently rechecks bytes.
export async function planFromStableEvidence({requestId,sourceSha,readEvidence,inspect,toolSha256}){
  const before=readEvidence(requestId);
  const inspection=await inspect(requestId,sourceSha);
  const after=readEvidence(requestId);
  for(const key of ['ledgerBytes','ownerBytes','markerBytes']){
    requireTrue(Buffer.isBuffer(before?.[key])&&Buffer.isBuffer(after?.[key])&&
      before[key].equals(after[key]),'RECOVERY_PLAN_EVIDENCE_CHANGED');
  }
  return makeRecoveryPlan({requestId,sourceSha,inspection,toolSha256,...before});
}

async function runCli(args=process.argv.slice(2)){
  requireTrue(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,
    'RECOVERY_OPERATOR_WINDOWS_REQUIRED');
  requireTrue(args.length===4&&args[0]==='--request-id'&&args[2]==='--source-sha',
    'RECOVERY_PLAN_USAGE');
  const [,requestId,,sourceSha]=args;
  requireTrue(isId(requestId)&&isSha(sourceSha),'RECOVERY_PLAN_IDENTITY_INVALID');
  const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const g=a=>execFileSync('git',a,{cwd:repo,windowsHide:true,maxBuffer:4e6});
  g(['merge-base','--is-ancestor',sourceSha,'HEAD']);
  const pinnedPlan=g(['show',sourceSha+':tools/maintenance-recovery-plan.mjs']);
  requireTrue(digest(pinnedPlan)===digest(fs.readFileSync(fileURLToPath(import.meta.url))),
    'RECOVERY_PLAN_SOURCE_DRIFT');
  const officialRecovery=await import('./maintenance-recovery.mjs');
  const toolSha256=digest(g(['show',sourceSha+':tools/maintenance-recovery.mjs']));
  const base='E:/ZGmini/automation/pc-maintenance';
  const readEvidence=id=>({
    ledgerBytes:fs.readFileSync(path.join(base,'ledger',id+'.json')),
    ownerBytes:fs.readFileSync(path.join(base,'leases/controller-install/owner.json')),
    markerBytes:fs.readFileSync(path.join(base,'leases/controller-install/RECOVERY_REQUIRED.json')),
  });
  return planFromStableEvidence({requestId,sourceSha,readEvidence,toolSha256,
    inspect:(id,sha)=>officialRecovery.main(['inspect','--request-id',id,'--source-sha',sha])});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  runCli().then(result=>console.log(JSON.stringify(result))).catch(error=>{
    const code=/^[A-Z0-9_]{1,80}$/.test(error?.code??'')?error.code:'RECOVERY_PLAN_READ_FAILED';
    console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code,changed:false}));
    process.exitCode=2;
  });
}
