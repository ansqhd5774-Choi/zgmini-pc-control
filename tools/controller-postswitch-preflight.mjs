// Read-only, bounded planning for #917 post-switch backlog recovery.
// This is NOT a write-capable Controller recovery operator. In particular it
// does not acquire/release a lease, post an Issue or modify the old ledger.
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {main as inspectPostSwitch} from './controller-postswitch-evidence.mjs';
import {planPostSwitchBacklogItem, originalIssueInPause,
  verifiedClosedBacklogWindows} from './controller-postswitch-backlog.mjs';

const repository='ansqhd5774-Choi/zgmini-pc-control';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const maintenance='E:/ZGmini/automation/pc-maintenance';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(condition,code)=>{if(!condition)throw Object.assign(new Error(code),{code});};

export function readAllPages(getPage, maxPages=20) {
  need(typeof getPage==='function' && Number.isSafeInteger(maxPages) &&
    maxPages>=1 && maxPages<=20, 'POSTSWITCH_PAGINATION_ARGUMENTS_INVALID');
  const rows=[];
  for(let page=1;page<=maxPages;page++){
    const batch=getPage(page);
    need(Array.isArray(batch) && batch.length<=100,
      'POSTSWITCH_REMOTE_READBACK_INVALID');
    rows.push(...batch);
    if(batch.length<100)return rows;
  }
  need(false,'POSTSWITCH_REMOTE_READBACK_TRUNCATED');
}

/** All remote scans must be exhaustive; no search-snippet negative evidence. */
export function prepareBacklogReadOnly({requestId,backlog,fetchIssues,
  fetchComments,fetchOriginal,fetchAllIssues}) {
  const windows=verifiedClosedBacklogWindows(backlog,requestId);
  need(typeof fetchIssues==='function' && typeof fetchComments==='function' &&
    typeof fetchOriginal==='function' && typeof fetchAllIssues==='function',
  'POSTSWITCH_READBACK_PORT_MISSING');
  const candidates=new Map();
  for(const window of windows){
    const since=new Date(Date.parse(window.pausedAt)-2000).toISOString();
    const all=readAllPages(page=>fetchIssues(since,page));
    for(const row of all){
      if(originalIssueInPause(row,[window]))candidates.set(row.number,row);
    }
  }
  const allIssues=readAllPages(page=>fetchAllIssues(page));
  const actions=[];
  for(const row of [...candidates.values()].sort((a,b)=>a.number-b.number)){
    // GitHub list often omits Issue body; fetch the canonical detail before
    // validating the request, even if the list row looks correct.
    const original=fetchOriginal(row.number);
    need(original?.number===row.number && original?.created_at===row.created_at,
      'POSTSWITCH_ORIGINAL_ISSUE_DRIFT');
    const comments=readAllPages(page=>fetchComments(row.number,page));
    const plan=planPostSwitchBacklogItem({maintenanceRequestId:requestId,
      original,backlog,cloneIssues:allIssues,originalComments:comments,
      cloneSearchComplete:true,resultReadComplete:true});
    actions.push(plan);
  }
  need(Object.keys(backlog.replays).every(key=>
    actions.some(row=>String(row.originalIssueNumber)===key)),
  'POSTSWITCH_BACKLOG_ORPHANED_REPLAY');
  return {windows:windows.length,candidateCount:actions.length,actions,
    source:'EXHAUSTIVE_REMOTE_READBACK',writes:0};
}

export async function main(args=process.argv.slice(2), ports={}){
  need(process.platform==='win32' && !process.env.GITHUB_ACTIONS &&
    !process.env.RUNNER_NAME, 'POSTSWITCH_OPERATOR_WINDOWS_REQUIRED');
  need(args.length===4 && args[0]==='--request-id' &&
    args[2]==='--source-sha' && /^pc-update-[a-f0-9-]{36}$/.test(args[1]) &&
    /^[a-f0-9]{40}$/.test(args[3]), 'POSTSWITCH_PREFLIGHT_USAGE');
  const id=args[1], source=args[3];
  const git=a=>execFileSync('git',a,{cwd:repo,windowsHide:true,maxBuffer:4e6});
  git(['merge-base','--is-ancestor',source,'HEAD']);
  for(const rel of ['tools/controller-postswitch-preflight.mjs',
    'tools/controller-postswitch-backlog.mjs']){
    need(sha256(git(['show',`${source}:${rel}`]))===
      sha256(fs.readFileSync(path.join(repo,rel))), 'POSTSWITCH_PREFLIGHT_SOURCE_DRIFT');
  }
  const evidence=await (ports.inspect??inspectPostSwitch)(args);
  need(evidence.status==='READONLY_POSTSWITCH_EVIDENCE_VERIFIED' &&
    evidence.requestId===id && evidence.sourceSha===source,
  'POSTSWITCH_PREFLIGHT_EVIDENCE_UNVERIFIED');
  const backlog=JSON.parse(fs.readFileSync(path.join(maintenance,'backlog',`${id}.json`),'utf8'));
  const github=ports.github??(route=>JSON.parse(execFileSync(gh,['api',`repos/${repository}/${route}`],
    {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4e6})));
  const plan=prepareBacklogReadOnly({requestId:id,backlog,
    fetchIssues:(since,page)=>github(`issues?state=all&since=${encodeURIComponent(since)}&per_page=100&page=${page}`),
    fetchComments:(number,page)=>github(`issues/${number}/comments?per_page=100&page=${page}`),
    fetchOriginal:number=>github(`issues/${number}`),
    fetchAllIssues:page=>github(`issues?state=all&per_page=100&page=${page}`)});
  return {status:'POSTSWITCH_PREFLIGHT_READONLY_PASS',requestId:id,sourceSha:source,
    actualControllerSha:evidence.actualControllerSha,
    backupControllerSha:evidence.backupSha,
    originalLedgerSha256:evidence.materialHashes.ledger,
    approvalMaterialHashes:evidence.materialHashes,
    checks:evidence.checks,backlogPlan:plan,
    recoveryAuthorized:false,operationalWrites:0,
    next:'COMMIT_EXACT_C_GRADE_APPROVAL_AND_SEPARATELY_VERIFY_WRITE_OPERATOR'};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await main()));}
  catch(error){console.log(JSON.stringify({status:'RECOVERY_REQUIRED',
    code:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'POSTSWITCH_PREFLIGHT_FAILED',
    operationalWrites:0,next:'INSPECT_NAMED_FAILURE_NO_RETRY_OR_LEASE_CHANGE'}));
    process.exitCode=2;}
}
