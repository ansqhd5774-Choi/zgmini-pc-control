// Fixed, one-time upload-only recovery for #3650's retained original result.
// Never invokes the original A operation or rewrites its local evidence.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {need, exclusive, readAllPages, digest} from './common.mjs';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {renderBoundedReport, uploadVerifiedReportPair} from './report-upload-verified.mjs';

const SOURCE_FILE = fileURLToPath(import.meta.url);
const realpath=fs.realpathSync.native??fs.realpathSync;
export const RECOVERY = Object.freeze({
  repository: 'ansqhd5774-Choi/zgmini-pc-control',
  actor: 'ansqhd5774-Choi',
  issueNumber: 3650,
  runId: '45649058563', attempt: '1', seat: '6',
  jobId: 'run-45649058563-1-seat-6',
  requestId: 'pc-9632a7d8-4b11-4e9a-8fb5-0ecb18df26ab',
  chatId: 'chat-ci1582-cf-active-readback-20261126',
  operation: 'w05-cloudflare-deployment-readonly',
  resultCode: 'CF_ACTIVE_DEPLOYMENT_READONLY_VERIFIED',
  sourceSha: '8cb18dfe4d839d42fd62b3650334dd12d83511b73',
  originalExecutionSha: '60f37de24cbad4adc0b6ee9eee3c98a43160443d',
  trigger: '/zgmini-recover-3650-once',
  commentMarker: '<!-- zgmini-pc-result:45649058563:1:3 -->',
});

function fail(code){throw Object.assign(new Error(code), {code});}
const eqPath=(a,b)=>process.platform==='win32'
  ?path.normalize(a).toLowerCase()===path.normalize(b).toLowerCase()
  :path.normalize(a)===path.normalize(b);

export function validateTrigger(event,env){
  need(env?.GITHUB_REPOSITORY===RECOVERY.repository&&
    env?.GITHUB_EVENT_NAME==='issue_comment'&&
    env?.GITHUB_ACTOR===RECOVERY.actor&&
    /^zgmini-pc-0[1-6]$/.test(env?.RUNNER_NAME??''), 'RECOVERY_EVENT_DENIED');
  need(event?.action==='created'&&event.repository?.private===true&&
    event.repository?.full_name===RECOVERY.repository&&
    !event.issue?.pull_request&&event.issue?.number===RECOVERY.issueNumber&&
    event.issue?.user?.login===RECOVERY.actor&&
    event.comment?.user?.login===RECOVERY.actor&&
    event.comment?.body===RECOVERY.trigger, 'RECOVERY_TRIGGER_DENIED');
  // The current workflow runId and runner name are provenance and MUST NOT
  // be overwritten with the original run's values.
  need(/^\d{1,20}$/.test(env?.GITHUB_RUN_ID??'')&&
    /^\d{1,3}$/.test(env?.GITHUB_RUN_ATTEMPT??''), 'RECOVERY_RUN_ID_INVALID');
}

function realDirectory(file,expected){
  let stat,real;
  try{stat=fs.lstatSync(file);real=realpath(file);}
  catch{fail('RECOVERY_DIRECTORY_UNAVAILABLE');}
  need(stat.isDirectory()&&!stat.isSymbolicLink()&&eqPath(real,expected),
    'RECOVERY_UNSAFE_DIRECTORY');
}

function jsonAt(file,root,maxBytes=262144){
  const read=readFixedReadonlyBytes(file,{verifiedRoot:root,maxBytes});
  need(read.ok,'RECOVERY_FILE_'+(read.reason??'UNREADABLE'));
  try{return JSON.parse(read.bytes.toString('utf8'));}
  catch{fail('RECOVERY_JSON_INVALID');}
}

function bytesAt(file,root,maxBytes=262144){
  const read=readFixedReadonlyBytes(file,{verifiedRoot:root,maxBytes});
  need(read.ok,'RECOVERY_FILE_'+(read.reason??'UNREADABLE'));
  return read.bytes;
}

export function verifyInstalledRuntime({root,scriptPath=SOURCE_FILE}={}){
  // This check deliberately fails when invoked from recovery-prototype/.
  need(path.isAbsolute(root??'')&&
    eqPath(scriptPath,path.join(root,'controller','report-recovery-3650-once.mjs')),
    'RECOVERY_NOT_INSTALLED');
  const rootReal=realpath(root);
  realDirectory(root,rootReal);
  realDirectory(path.join(root,'controller'),path.join(rootReal,'controller'));
  realDirectory(path.join(root,'config'),path.join(rootReal,'config'));
  const host=jsonAt(path.join(root,'host.json'),rootReal,65536);
  const policy=jsonAt(path.join(root,'config','operations.json'),rootReal,65536);
  need(policy.controlRepository===RECOVERY.repository&&
    Number.isSafeInteger(policy.maxReportBytes)&&policy.maxReportBytes>0&&
    policy.maxReportBytes<=32768, 'RECOVERY_POLICY_INVALID');
  const sourceKey='controller/report-recovery-3650-once.mjs';
  need(/^[a-f0-9]{64}$/.test(host?.controllerFiles?.[sourceKey]??''),
    'RECOVERY_SOURCE_UNPINNED');
  for(const [rel,sha] of Object.entries(host.controllerFiles)){
    need(typeof rel==='string'&&!rel.includes('..')&&
      !path.isAbsolute(rel)&&/^[a-f0-9]{64}$/.test(sha), 'RECOVERY_MANIFEST_INVALID');
    const file=path.join(root,rel);
    const bytes=bytesAt(file,rootReal,8*1024*1024);
    need(digest(bytes)===sha,'RECOVERY_SOURCE_DRIFT');
  }
  return {policy};
}

export function verifyRetainedOriginal(root){
  need(path.isAbsolute(root??''),'RECOVERY_ROOT_INVALID');
  const rootReal=realpath(root);
  realDirectory(root,rootReal);
  for(const child of ['reports','jobs','ledger','leases'])
    realDirectory(path.join(root,child),path.join(rootReal,child));
  const ws=path.join(root,'jobs',RECOVERY.jobId);
  realDirectory(ws,path.join(rootReal,'jobs',RECOVERY.jobId));
  const expectedFiles=['input.json','worker-result.json','RESULT.json','RESULT.txt'];
  need(isDeepStrictEqual(fs.readdirSync(ws).sort(),[...expectedFiles].sort()),
    'RECOVERY_WORKSPACE_UNEXPECTED');
  const pointer=jsonAt(path.join(root,'reports',
    `${RECOVERY.runId}-${RECOVERY.attempt}-${RECOVERY.seat}.json`),rootReal);
  const report=pointer?.report;
  need(pointer?.issueNumber===RECOVERY.issueNumber&&
    eqPath(pointer?.workspace??'',ws)&&
    eqPath(pointer?.file??'',path.join(ws,'RESULT.json')),
    'RECOVERY_POINTER_MISMATCH');
  need(report?.schema==='ZGMINI_PC_RESULT_V1'&&
    report.jobId===RECOVERY.jobId&&report.requestId===RECOVERY.requestId&&
    report.chatId===RECOVERY.chatId&&
    report.operation===RECOVERY.operation&&report.code===RECOVERY.resultCode&&
    report.seat===Number(RECOVERY.seat)&&report.status==='PASS'&&
    report.firstFail===null&&report.actualExecutionSha===RECOVERY.originalExecutionSha&&
    report.requestedSourceSha===RECOVERY.sourceSha&&
    report.sourceBranch==='main'&&report.sourceRepository==='ansqhd5774-Choi/zgmini'&&
    report.controlSourceSha===RECOVERY.originalExecutionSha&&
    report.result?.code===RECOVERY.resultCode&&
    report.result?.domain==='zgmini.kr'&&
    report.result?.deploymentIdentityVerified===true&&
    report.result?.domainVerified===true&&
    report.result?.expectedBuildVersionActive===false&&
    report.result?.sourceShaVerified===false&&
    report.result?.providerCalls===0&&report.result?.d1Writes===0&&
    report.result?.operationalWrites===0&&
    report.controlRepository===RECOVERY.repository&&
    report.protectedStateUnchanged===true&&report.reused!==true&&
    report.resourceLeasesRetained!==true&&report.providerCalls===0&&
    report.operationalWrites===0&&report.d1Writes===0,
    'RECOVERY_ORIGINAL_NOT_PROVEN');
  const result=jsonAt(path.join(ws,'RESULT.json'),rootReal);
  const workerResult=jsonAt(path.join(ws,'worker-result.json'),rootReal);
  const input=jsonAt(path.join(ws,'input.json'),rootReal,65536);
  need(isDeepStrictEqual(result,report)&&
    isDeepStrictEqual(workerResult,report.result),
    'RECOVERY_WORKSPACE_RESULT_MISMATCH');
  need(input?.request?.requestId===RECOVERY.requestId&&
    input.request.chatId===RECOVERY.chatId&&
    input.request.operation===RECOVERY.operation&&
    input.request.sourceSha===RECOVERY.sourceSha&&
    input.request.sourceBranch==='main'&&
    input.request.sourceRepository==='ansqhd5774-Choi/zgmini',
    'RECOVERY_REQUEST_MISMATCH');
  const ledger=jsonAt(path.join(root,'ledger',RECOVERY.requestId+'.json'),rootReal);
  need(ledger?.payloadSha===digest(JSON.stringify(input.request))&&
    ledger.report?.jobId===RECOVERY.jobId&&
    ledger.report.requestId===RECOVERY.requestId&&
    ledger.report.status==='PASS'&&ledger.report.code===RECOVERY.resultCode&&
    ledger.report.actualExecutionSha===RECOVERY.originalExecutionSha&&
    ledger.report.protectedStateUnchanged===true,
    'RECOVERY_LEDGER_MISMATCH');
  const txt=Object.entries(report).filter(([k])=>!['result','prior'].includes(k))
    .map(([k,v])=>`${k}=${typeof v==='object'?JSON.stringify(v):v}`)
    .join('\r\n')+'\r\n';
  need(bytesAt(path.join(ws,'RESULT.txt'),rootReal).equals(Buffer.from(txt,'utf8')),
    'RECOVERY_WORKSPACE_TEXT_MISMATCH');
  // No cleanup: original pointer, ledger and workspace remain evidence.
  return report;
}

function safeOutput(report){
  const inspect=(v,depth=0)=>{
    if(depth>12)fail('RECOVERY_OUTPUT_UNSAFE');
    if(!v||typeof v!=='object'){
      if(typeof v==='string'&&/(?:Bearer\s+[A-Za-z0-9._-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,})/.test(v))
        fail('RECOVERY_OUTPUT_UNSAFE');
      return;
    }
    for(const [k,x] of Object.entries(v)){
      if(/(?:access.?token|refresh.?token|api.?key|password|private.?key|credential|authorization|secret)/i.test(k))
        fail('RECOVERY_OUTPUT_UNSAFE');
      inspect(x,depth+1);
    }
  };
  inspect(report);
}

function resultBody(report,json,txt,files){
  const url=`https://github.com/${RECOVERY.repository}/actions/runs/${RECOVERY.runId}`;
  return `${RECOVERY.commentMarker}\n**${report.status} — ${report.code}**\n\n`+
    `실행: ${url}\n\n${files.map(x=>'- '+x).join('\n')}\n\n`+
    `JSON 결과:\n\n\`\`\`json\n${json}\`\`\`\n\n`+
    `TXT 결과:\n\n\`\`\`text\n${txt}\`\`\`\n`;
}

const links=['json','txt'].map(ext=>
  `https://github.com/${RECOVERY.repository}/blob/main/results/${RECOVERY.runId}-${RECOVERY.attempt}-seat-${RECOVERY.seat}.${ext}`);

async function issueComments(api){
  return readAllPages(async(page)=>{
    const r=await api(`issues/${RECOVERY.issueNumber}/comments?per_page=100&page=${page}`);
    need(r.status===200,'RECOVERY_COMMENTS_READ_FAILED');
    return r.data;
  });
}

function classifyMarker(comments,body){
  const found=comments.filter(c=>c.body?.includes(RECOVERY.commentMarker));
  need(found.every(c=>c.user?.login==='github-actions[bot]'&&c.body===body),
    'RECOVERY_COMMENT_CONFLICT');
  need(found.length<=1,'RECOVERY_COMMENT_DUPLICATED');
  return found.length===1;
}

export async function recoverOriginal({root,policy,event,env,api,
  acquire=exclusive,upload=uploadVerifiedReportPair}={}){
  validateTrigger(event,env);
  need(policy?.controlRepository===RECOVERY.repository&&
    Number.isSafeInteger(policy.maxReportBytes)&&policy.maxReportBytes<=32768&&
    policy.maxReportBytes>0, 'RECOVERY_POLICY_INVALID');
  // Shared lease is the same one the installed normal uploader uses.
  let release;
  try{
    release=acquire(path.join(root,'leases'),'result-upload');
  }catch(error){if(error?.code==='LEASE_BUSY')fail('RECOVERY_UPLOAD_BUSY');throw error;}
  try{
    const report=verifyRetainedOriginal(root);
    safeOutput(report);
    const {json,txt}=renderBoundedReport(report,policy.maxReportBytes);
    const body=resultBody(report,json,txt,links);
    need(Buffer.byteLength(body,'utf8')<=65536,'RECOVERY_COMMENT_SIZE');
    const source=await api(`issues/${RECOVERY.issueNumber}`);
    need(source.status===200&&source.data?.number===RECOVERY.issueNumber&&
      source.data?.user?.login===RECOVERY.actor&&
      source.data?.labels?.some(label=>label.name==='pc-job')&&
      !source.data?.pull_request, 'RECOVERY_ORIGINAL_ISSUE_MISMATCH');
    let originalRequest;
    try{originalRequest=JSON.parse(source.data.body);}catch{fail('RECOVERY_ORIGINAL_ISSUE_MISMATCH');}
    need(originalRequest.requestId===RECOVERY.requestId&&
      originalRequest.chatId===RECOVERY.chatId&&
      originalRequest.schema==='ZGMINI_PC_JOB_V1'&&
      originalRequest.operation===RECOVERY.operation&&
      originalRequest.sourceSha===RECOVERY.sourceSha&&
      originalRequest.sourceRepository==='ansqhd5774-Choi/zgmini'&&
      originalRequest.sourceBranch==='main'&&
      Object.keys(originalRequest).length===7,
      'RECOVERY_ORIGINAL_ISSUE_MISMATCH');
    const before=classifyMarker(await issueComments(api),body);
    const published=await upload({api,repository:RECOVERY.repository,
      runId:RECOVERY.runId,attempt:RECOVERY.attempt,seat:RECOVERY.seat,json,txt});
    need(isDeepStrictEqual(published,links),'RECOVERY_UPLOAD_PAIR_INVALID');
    if(!before){
      try{
        const posted=await api(`issues/${RECOVERY.issueNumber}/comments`,'POST',{body});
        need(posted.status===201,'RECOVERY_COMMENT_POST_FAILED');
      }catch{
        // Ambiguous POST may have succeeded. Only read back; no blind retry.
        need(classifyMarker(await issueComments(api),body),
          'RECOVERY_COMMENT_OUTCOME_UNKNOWN');
      }
    }
    need(classifyMarker(await issueComments(api),body),
      'RECOVERY_COMMENT_READBACK_FAILED');
    return {status:before?'ALREADY_RECOVERED':'DELIVERY_RECOVERED',
      originalRunId:RECOVERY.runId,originalIssueNumber:RECOVERY.issueNumber,
      resultFiles:2,providerCalls:0,workerExecutions:0};
  }finally{release();}
}

async function cli(){
  const root=path.dirname(path.dirname(SOURCE_FILE));
  const {policy}=verifyInstalledRuntime({root});
  need(process.env.GITHUB_TOKEN,'RECOVERY_TOKEN_MISSING');
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const token=process.env.GITHUB_TOKEN;
  const api=async(route,method='GET',body)=>{
    const r=await fetch('https://api.github.com/repos/'+RECOVERY.repository+'/'+route,{
      method,headers:{accept:'application/vnd.github+json',
        authorization:'Bearer '+token,'x-github-api-version':'2022-11-28',
        'content-type':'application/json'},
      body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
    let data;try{data=await r.json();}catch{data={};}
    return {status:r.status,data};
  };
  const result=await recoverOriginal({root,policy,event,env:process.env,api});
  console.log(JSON.stringify(result));
}

if(process.argv[1]&&path.resolve(process.argv[1])===SOURCE_FILE){
  cli().catch(error=>{
    console.error(JSON.stringify({status:'BLOCKED',code:/^[A-Z0-9_]{1,100}$/.test(error?.code??'')?
      error.code:'RECOVERY_INTERNAL_ERROR'}));
    process.exitCode=1;
  });
}
