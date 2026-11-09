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
  git(['merge-base','--is-ancestor',source,'HEAD']);
  for(const file of files){
    const live=hash(fs.readFileSync(path.join(repo,file)));
    const committed=hash(git(['show',source+':'+file]));
    need(live===committed&&live===hashes[file],
      'POSTSWITCH_LAUNCHER_SOURCE_DRIFT');
  }
  return approval;
}
export async function main(args=process.argv.slice(2)){
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
    !process.env.RUNNER_NAME&&process.stdin.isTTY===true&&
    process.stdout.isTTY===true,'POSTSWITCH_DIRECT_WINDOWS_C_OPERATOR_REQUIRED');
  verifyLauncherArguments(args);
  verifyPinnedClosure(args);
  const {main:run}=await import('./controller-postswitch-windows.mjs');
  return run(args,{launcherVerified:true});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const result=await main();
    console.log(JSON.stringify(result));
    if(result.status!=='RECOVERY_COMPLETED')process.exitCode=2;
  }catch(error){
    console.log(JSON.stringify({status:'RECOVERY_REQUIRED',
      code:/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:
        'POSTSWITCH_C_OPERATOR_STOP',
      originalRequestRetried:false,
      next:'INSPECT_EXISTING_RECOVERY_CLAIM_AND_ORIGINAL_NO_AUTOMATIC_RETRY'}));
    process.exitCode=2;
  }
}
