// Create-only remote proof evidence; no shell, PC install or source edit.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyProofIssue,loadProofApproval,PROOF_RESULT,
  PROOF_SCHEMA,PROOF_CLI_SCHEMA}
  from './proof-only.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const VERSION=/^[a-f0-9]{16}$/;
const RUN=/^[0-9]{1,18}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(v,code)=>{if(!v)throw Object.assign(Error(code),{code});};
const statusCode=s=>/^(?:B_|PACKAGE_|PROOF_)[A-Z0-9_]{3,100}$/.test(s??'');
const simpleSim=s=>({direction:s.direction,mockFetchCalls:s.mockFetchCalls,
  d1Writes:s.d1Writes,cycleCheckpointSha256:s.cycleCheckpointSha256,
  sameWindowDedup:s.sameWindowDedup,revisions:s.revisions,
  casRejected:s.casRejected,tamperRejected:s.tamperRejected,
  sameDayBudgetRetained:s.sameDayBudgetRetained});

function safeTranscript(value,auth){
  const s=value?.metrics?.simulations;
  if(value?.schema!=='ZGMINI_CONFIGURED_OLD_NEW_WINDOWS_PROOF_V1'||
    value.sourceSha!==auth.manifest.sourceSha||
    !SHA40.test(value.oldSourceSha??'')||
    !VERSION.test(value.oldVersion??'')||
    value.taskXmlSha256!==auth.manifest.runtimePreimage.taskXmlSha256||
    !Array.isArray(s)||s.length!==2||
    s[0]?.direction!=='OLD_TO_NEW'||s[1]?.direction!=='NEW_TO_OLD'||
    !s.every(x=>SHA64.test(x.cycleCheckpointSha256??'')&&
      Number.isSafeInteger(x.mockFetchCalls)&&x.mockFetchCalls>=0&&
      x.mockFetchCalls<=100&&x.d1Writes===0&&
      x.sameWindowDedup===true&&x.revisions===2&&
      x.casRejected===true&&x.tamperRejected===true&&
      x.sameDayBudgetRetained===true)||
    value.metrics.externalNetworkCalls!==0||
    value.metrics.d1Writes!==0||
    value.metrics.sharedLeaseCollisionRejected!==true||
    value.metrics.oneShotReplayRejected!==true||
    !Number.isSafeInteger(value.metrics.mockFetchCalls)||
    value.metrics.mockFetchCalls!==s.reduce((n,x)=>n+x.mockFetchCalls,0))
    return null;
  const t={schema:value.schema,sourceSha:value.sourceSha,
    oldSourceSha:value.oldSourceSha,oldVersion:value.oldVersion,
    taskXmlSha256:value.taskXmlSha256,
    metrics:{externalNetworkCalls:0,d1Writes:0,
      simulations:s.map(simpleSim),
      mockFetchCalls:value.metrics.mockFetchCalls,
      sharedLeaseCollisionRejected:true,oneShotReplayRejected:true}};
  return JSON.stringify(t)===JSON.stringify(value)?t:null;
}

function safeCliEntryProof(value){
  if(value?.status!=='PASS'||value.childExitCode!==0||
    value.fixtureRoot!=='RUNNER_TEMP'||value.operationWrites!==0||
    !SHA64.test(value.testSha256??'')||
    Object.keys(value).length!==5)return null;
  // The proof and reporter load this same immutable control checkout.
  try{
    const testFile=new URL('./approval-cycle.test.mjs',import.meta.url);
    if(sha(fs.readFileSync(testFile))!==value.testSha256)return null;
  }catch{return null;}
  return {status:'PASS',childExitCode:0,
    testSha256:value.testSha256,fixtureRoot:'RUNNER_TEMP',operationWrites:0};
}

export function sanitizeProofReport(raw,auth,env){
  const modern=raw?.schema===PROOF_CLI_SCHEMA;
  const legacy=raw?.schema===PROOF_SCHEMA;
  const base={schema:modern?PROOF_CLI_SCHEMA:PROOF_SCHEMA,
    requestId:auth.request.requestId,
    runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
    approvalSha256:auth.approvalSha256,
    sourceSha:auth.manifest.sourceSha,
    manifestSha256:auth.manifest.packageManifestSha256,
    status:'PROOF_UNVERIFIED',code:'PROOF_RESULT_MISSING_OR_INVALID',
    operationWrites:0,windowsProof:'NOT_ESTABLISHED',
    cliEntrypointProof:modern?'NOT_ESTABLISHED':'LEGACY_NOT_TESTED',
    cliTestSha256:null,cliNodeExitCode:null,
    activeRuntimeSha256:null,taskXmlSha256:null,
    evidenceSha256:null,transcript:null,
    retry:'NO_AUTO_RETRY_READ_ONLY_RECONCILE'};
  if((!modern&&!legacy)||raw.requestId!==base.requestId||
    raw.sourceSha!==base.sourceSha||
    raw.manifestSha256!==base.manifestSha256||
    raw.approvalSha256!==base.approvalSha256||raw.operationWrites!==0)
    return base;
  if(raw.status==='PROOF_BLOCKED'&&statusCode(raw.code))
    return {...base,status:'PROOF_BLOCKED',code:raw.code,
      cliNodeExitCode:modern&&Number.isInteger(raw.cliNodeExitCode)&&
        raw.cliNodeExitCode>=0&&raw.cliNodeExitCode<=255?
        raw.cliNodeExitCode:null};
  if(raw.status!=='PROOF_PASS'||
    raw.activeRuntimeSha256!==
      auth.manifest.runtimePreimage.activeRuntimeSha256||
    raw.taskXmlSha256!==auth.manifest.runtimePreimage.taskXmlSha256||
    !SHA64.test(raw.evidenceSha256??''))return base;
  const transcript=safeTranscript(raw.transcript,auth);
  if(!transcript||sha(Buffer.from(JSON.stringify(transcript)))!==
    raw.evidenceSha256)return base;
  const cli=modern?safeCliEntryProof(raw.cliEntrypointProof):null;
  if(modern&&!cli)return base;
  return {...base,status:'PROOF_PASS',
    code:modern?'PROOF_WINDOWS_BILATERAL_CLI_PASS':
      'PROOF_WINDOWS_BILATERAL_PASS',
    windowsProof:'OLD_NEW_TEMP_FIXTURE_ONLY_NO_INSTALL',
    cliEntrypointProof:modern?'WINDOWS_CLI_ENTRY_PASS':'LEGACY_NOT_TESTED',
    cliTestSha256:cli?.testSha256??null,
    cliNodeExitCode:cli?.childExitCode??null,
    activeRuntimeSha256:raw.activeRuntimeSha256,
    taskXmlSha256:raw.taskXmlSha256,
    evidenceSha256:raw.evidenceSha256,transcript};
}

const textReport=r=>[
  `REQUEST_ID=${r.requestId}`,`RUN_ID=${r.runId??'UNKNOWN'}`,
  `STATUS=${r.status}`,`CODE=${r.code}`,
  `SOURCE_SHA=${r.sourceSha}`,
  `APPROVAL_SHA256=${r.approvalSha256}`,
  `PACKAGE_MANIFEST_SHA256=${r.manifestSha256}`,
  `ACTIVE_RUNTIME_SHA256=${r.activeRuntimeSha256??'UNKNOWN'}`,
  `TASK_XML_SHA256=${r.taskXmlSha256??'UNKNOWN'}`,
  `WINDOWS_PROOF=${r.windowsProof}`,
  `CLI_ENTRY_PROOF=${r.cliEntrypointProof}`,
  `CLI_TEST_SHA256=${r.cliTestSha256??'UNKNOWN'}`,
  `CLI_NODE_EXIT_CODE=${r.cliNodeExitCode??'UNKNOWN'}`,
  `EVIDENCE_SHA256=${r.evidenceSha256??'UNKNOWN'}`,
  `OPERATION_WRITES=${r.operationWrites}`,
  `RETRY=${r.retry}`,'',
].join('\n');

async function readback(api,url,headers,content){
  try{
    const res=await api(url+'?ref=main',{method:'GET',headers});
    if(res.status!==200)return false;
    const x=await res.json();
    return x?.encoding==='base64'&&
      Buffer.from((x.content??'').replace(/\s/g,''),'base64')
        .equals(Buffer.from(content));
  }catch{return false;}
}

export async function uploadProofReport({event,env,auth,rawResult,
  fetchApi=fetch}={}){
  verifyProofIssue(event,env);
  need(typeof env.GITHUB_TOKEN==='string'&&
    env.GITHUB_TOKEN.length>=20&&RUN.test(env.GITHUB_RUN_ID??''),
  'PROOF_REPORT_AUTH_STOP');
  let parsed=null;
  if(typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=8192){
    try{parsed=JSON.parse(rawResult);}catch{/* fail closed */}
  }
  const report=sanitizeProofReport(parsed,auth,env);
  const headers={accept:'application/vnd.github+json',
    authorization:'Bearer '+env.GITHUB_TOKEN,
    'x-github-api-version':'2022-11-28',
    'content-type':'application/json',
    'user-agent':'zgmini-configured-runtime-proof-once'};
  const file=`https://api.github.com/repos/${REPO}/contents/`+
    `results/approved-runtime-b-proof-${auth.request.requestId}`;
  let created=0,verified=0;
  for(const [ext,content] of [['json',JSON.stringify(report,null,2)+'\n'],
    ['txt',textReport(report)]]){
    const url=file+'.'+ext;
    try{
      const r=await fetchApi(url,{method:'PUT',headers,
        body:JSON.stringify({message:'chore(runtime-b): read-only Windows '+
          'compatibility proof',content:Buffer.from(content).toString('base64')})});
      if(r.status===201)created++;
    }catch{/* Never retry an ambiguous PUT. */}
    if(await readback(fetchApi,url,headers,content))verified++;
  }
  const status=verified===2?report.status:'PROOF_UNVERIFIED';
  const comment=`<!-- configured-runtime-proof:${auth.request.requestId} -->\n`+
    `Read-only Windows compatibility proof: **${status}** `+
    `(${verified===2?report.code:'PROOF_RESULT_PAIR_UNVERIFIED'})\n`+
    `RUN_ID: ${report.runId??'UNKNOWN'}; RESULT READBACK: ${verified}/2; `+
    `CREATED: ${created}/2; EVIDENCE: ${report.evidenceSha256??'UNKNOWN'}\n`+
    `CLI_ENTRY: ${report.cliEntrypointProof}; CLI_NODE_EXIT: `+
    `${report.cliNodeExitCode??'UNKNOWN'}\n`+
    'OPERATION WRITES: 0; NO B INSTALL; NO SCHEDULED UPDATE TEST; '+
    'NO AUTO RETRY\n';
  const posted=await fetchApi(`https://api.github.com/repos/${REPO}/issues/`+
    `${event.issue.number}/comments`,{method:'POST',headers,
    body:JSON.stringify({body:comment})});
  need(posted.status===201,'PROOF_REPORT_COMMENT_STOP');
  return {status,created,verified};
}

export async function reportProofFromRunner(){
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const auth=loadProofApproval({event,env});
  let rawResult='';
  try{rawResult=fs.readFileSync(path.join(env.RUNNER_TEMP,PROOF_RESULT),'utf8');}
  catch{/* Pin-only failure remains unverified. */}
  const result=await uploadProofReport({event,env,auth,rawResult});
  process.stdout.write(`PROOF_REMOTE_READBACK ${result.verified}/2\n`);
  if(result.status!=='PROOF_PASS')process.exitCode=1;
  return result;
}
