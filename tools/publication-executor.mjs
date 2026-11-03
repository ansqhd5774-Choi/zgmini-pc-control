// Proposed, B-only BEA/QFR one-shot executor. Not installed or enabled on PC.
// NEVER invoke from pc-job/pc-maintenance; dedicated labeled Issue and manifest only.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {admitPublication} from './publication-preflight.mjs';
import {CONTROL_REPOSITORY,sha256,validateSourceCheckpoints,
  validatePublisherFileDigests,validatePublicationReadback,
  classifyPublicationLedger} from './publication-contract.mjs';

const ROOT='E:\\ZGmini';
const PC_BASE=path.join(ROOT,'data','pc-writer');
const SAFE_ROOT=path.join(ROOT,'automation','pc-publication');
const APPLY_TIMEOUT_MS=240_000;
const PREFLIGHT_TIMEOUT_MS=90_000;
const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const ERROR=/^[A-Z0-9_]{1,96}$/;
const now=()=>new Date().toISOString();
const code=e=>ERROR.test(String(e?.message??''))?e.message:'PUBLICATION_OPERATION_FAILED';

export function parsePublisherLog(text,operation){
  if(typeof text!=='string'||Buffer.byteLength(text)>32768)throw Error('PUBLICATION_RESULT_TXT_INVALID');
  const rows={};
  for(const line of text.split(/\r?\n/)){
    const index=line.indexOf('=');
    if(index<=0)continue;
    const key=line.slice(0,index),value=line.slice(index+1);
    if(!/^[A-Z0-9_]{1,64}$/.test(key)||value.length>512||Object.hasOwn(rows,key))
      throw Error('PUBLICATION_RESULT_TXT_INVALID');
    rows[key]=value;
  }
  const expectedResult=operation==='bea-unit-profit-once'
    ?['PASS_BEA_UNIT_READBACK_VERIFIED','PASS_BEA_UNIT_ALREADY_STORED']
    :['PASS_QFR_D1_EXACT_READBACK','PASS_QFR_D1_ALREADY_STORED'];
  if(!expectedResult.includes(rows.RESULT)||!['READBACK_VERIFIED','ALREADY_STORED'].includes(rows.D1_RESULT))
    throw Error('PUBLICATION_RESULT_NOT_VERIFIED');
  const sourceVersion=operation==='bea-unit-profit-once'?rows.SOURCE_SHA256:rows.SOURCE_VERSION;
  const sourceStoredAt=Number(rows.SOURCE_STORED_AT);
  if(!SHA256.test(sourceVersion??'')||!Number.isSafeInteger(sourceStoredAt)||sourceStoredAt<=0)
    throw Error('PUBLICATION_RESULT_CHECKPOINT_INVALID');
  return Object.freeze({status:'PASS',d1Result:rows.D1_RESULT,sourceVersion,sourceStoredAt});
}

export function millisecondsToNextUtcSecond(now){
  if(!Number.isSafeInteger(now)||now<0)throw Error('PUBLICATION_CLOCK_INVALID');
  return 1000-(now%1000)+50;
}

export function publicationCheckpointReport(operation,evidence){
  // BEA's identical-source shortcut retains the older D1 payload timestamp.
  // The attempt's fresh retrieval timestamp is NOT a verified D1 timestamp.
  const attemptedOnly=operation==='bea-unit-profit-once'
    &&evidence.d1Result==='ALREADY_STORED';
  return {sourceStoredAt:attemptedOnly?null:evidence.sourceStoredAt,
    attemptedSourceStoredAt:evidence.sourceStoredAt,
    sourceStoredAtEvidence:attemptedOnly?'ATTEMPTED_ONLY':'D1_READBACK_VERIFIED'};
}

export function nextLedgerPhase(before,event,{code:reason=null}={}){
  if(!before||typeof before!=='object')throw Error('PUBLICATION_LEDGER_INVALID');
  if(before.phase==='READY'&&event==='PREFLIGHT_PASS')return {...before,phase:'PREFLIGHT_VERIFIED',updatedAt:now()};
  if(before.phase==='PREFLIGHT_VERIFIED'&&event==='APPLY_START')return {...before,phase:'APPLYING',updatedAt:now()};
  if(before.phase==='APPLYING'&&event==='READBACK_PASS')return {...before,phase:'PASS',updatedAt:now()};
  if(['READY','PREFLIGHT_VERIFIED'].includes(before.phase)&&event==='STOP')
    return {...before,phase:'BLOCKED',firstFail:reason,updatedAt:now()};
  if(before.phase==='APPLYING'&&event==='UNVERIFIED')
    return {...before,phase:'STATE_UNKNOWN',firstFail:reason,updatedAt:now()};
  throw Error('PUBLICATION_LEDGER_TRANSITION_REJECTED');
}

const git=(cwd,args)=>execFileSync('git',['-c','core.fsmonitor=false',
  '-c','core.untrackedCache=false','-C',cwd,...args],{encoding:'utf8',
  windowsHide:true,timeout:15_000,maxBuffer:65536}).trim();
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const real=file=>fs.realpathSync.native(file);
const within=(base,target)=>{const relative=path.relative(base,target);
  return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
const writeAtomic=(file,value)=>{
  const temporary=file+'.tmp-'+process.pid;
  fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  fs.renameSync(temporary,file);
};

function verifyPublisherFiles(validated,publisherRoot){
  const expected=validated.approval.publisherFiles;
  const digest={};
  for(const name of Object.keys(expected)){
    const file=real(path.join(publisherRoot,...name.split('/')));
    if(!within(publisherRoot,file)||!fs.statSync(file).isFile())
      throw Error('PUBLICATION_SOURCE_FILE_OUTSIDE_ROOT');
    digest[name]=sha256(fs.readFileSync(file));
  }
  validatePublisherFileDigests(validated,digest);
}

async function validatePcSources(validated){
  if(process.platform!=='win32')throw Error('PUBLICATION_WINDOWS_REQUIRED');
  if(!process.env.GITHUB_WORKSPACE)throw Error('PUBLICATION_WORKSPACE_MISSING');
  const publisherRoot=real(path.join(process.env.GITHUB_WORKSPACE,'publisher'));
  if(!within(real(process.env.GITHUB_WORKSPACE),publisherRoot))
    throw Error('PUBLICATION_PUBLISHER_ROOT_INVALID');
  const candidate=process.env.ZGMINI_EARNINGS_C_OPERATIONAL_ROOT;
  if(!candidate||!path.isAbsolute(candidate))throw Error('PUBLICATION_OPERATIONAL_ROOT_NOT_CONFIGURED');
  const operationalRoot=real(candidate);
  const allowed=real(path.join(ROOT,'projects'));
  if(!within(allowed,operationalRoot))throw Error('PUBLICATION_OPERATIONAL_ROOT_OUTSIDE_PROJECTS');
  if(!fs.existsSync(path.join(PC_BASE,'config.json')))
    throw Error('PUBLICATION_PC_CONFIG_MISSING');
  const config=readJson(path.join(PC_BASE,'config.json'));
  const gitState=root=>({head:git(root,['rev-parse','HEAD']),
    dirty:git(root,['status','--porcelain','--untracked-files=no','--',
      'worker','scripts/pc-writer','lib/market-score'])!==''});
  const pub=gitState(publisherRoot),op=gitState(operationalRoot);
  validateSourceCheckpoints(validated,{publisherHead:pub.head,
    originMainHead:git(publisherRoot,['rev-parse','refs/remotes/origin/main']),
    publisherBranch:git(publisherRoot,['branch','--show-current']),
    publisherClean:!pub.dirty,operationalHead:op.head,configSource:config.source,
    operationalClean:!op.dirty,publisherRoot,operationalRoot});
  verifyPublisherFiles(validated,publisherRoot);
  // Reuse the exact existing writer's independently checked dual-source guard.
  const gate=await import(pathToFileURL(path.join(publisherRoot,'scripts/pc-writer',
    'EARNINGS_R4_C_D1_DUAL_SOURCE_GATES.mjs')).href);
  gate.validateD1DualSource({config,publisher:gate.inspectD1Source(publisherRoot,{publisher:true}),
    operational:gate.inspectD1Source(operationalRoot)});
  return {publisherRoot,operationalRoot};
}

function resultDirectoryFor(requestId){
  const home=path.join(SAFE_ROOT,'results',requestId);
  fs.mkdirSync(home,{recursive:true});
  if(!within(real(path.join(SAFE_ROOT,'results')),real(home)))
    throw Error('PUBLICATION_LOG_DIRECTORY_INVALID');
  return home;
}

function readNewResult(directory,prefix,before){
  const next=fs.readdirSync(directory).filter(f=>f.startsWith(prefix)
    &&f.endsWith('.txt')&&!before.has(f));
  if(next.length!==1)throw Error('PUBLICATION_RESULT_TXT_NOT_UNIQUE');
  return fs.readFileSync(path.join(directory,next[0]),'utf8');
}

async function runFixedChild(script,args,env,timeout){
  return new Promise(resolve=>{
    const child=spawn(process.execPath,[script,...args],{shell:false,
      windowsHide:true,env,stdio:['ignore','pipe','pipe']});
    let output='',truncated=false,ended=false,timedOut=false;
    const add=bytes=>{if(output.length<8192)output+=bytes.toString();else truncated=true;};
    child.stdout.on('data',add);child.stderr.on('data',add);
    const timer=setTimeout(()=>{
      if(ended)return;timedOut=true;
      if(process.platform==='win32'&&Number.isSafeInteger(child.pid)){
        // Only the child PID created by this exact request; never kill global node.exe.
        spawnSync('taskkill.exe',['/T','/F','/PID',String(child.pid)],
          {windowsHide:true,timeout:12000,stdio:'ignore'});
      }else child.kill();
    },timeout);
    const done=(exitCode)=>{if(ended)return;ended=true;clearTimeout(timer);
      resolve({exitCode,timedOut,truncated,output});};
    child.on('error',()=>done(-1));child.on('close',done);
  });
}

async function api(route,{method='GET',body}={}){
  const response=await fetch(`https://api.github.com/repos/${CONTROL_REPOSITORY}/${route}`,{
    method,headers:{authorization:'Bearer '+process.env.GITHUB_TOKEN,
      accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',
      'content-type':'application/json'},body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(20_000)});
  let json={};try{json=await response.json();}catch{}
  return {status:response.status,body:json};
}
async function uploadReport(issue,report){
  // Reporting retries do not re-run the operation; all paths and content are fixed.
  const file=`results/publication-${report.requestId}.json`;
  const serialized=JSON.stringify(report,null,2)+'\n';
  const remote=await api('contents/'+file);
  if(remote.status===200){
    if(Buffer.from(remote.body.content?.replace(/\s/g,'')??'','base64').toString()!==serialized)
      throw Error('PUBLICATION_REMOTE_RESULT_CONFLICT');
  }else if(remote.status===404){
    const put=await api('contents/'+file,{method:'PUT',body:{
      message:`report: B publication ${report.requestId}`,branch:'main',
      content:Buffer.from(serialized).toString('base64')}});
    if(put.status!==201&&put.status!==200)throw Error('PUBLICATION_REMOTE_RESULT_UNKNOWN');
  }else throw Error('PUBLICATION_REMOTE_RESULT_LOOKUP_FAILED');
  const marker=`<!-- zgmini-publication-result:${report.requestId} -->`;
  const comments=await api(`issues/${issue}/comments?per_page=100`);
  if(comments.status!==200)throw Error('PUBLICATION_RESULT_COMMENT_LOOKUP_FAILED');
  if(!Array.isArray(comments.body)||comments.body.length>=100)
    throw Error('PUBLICATION_RESULT_COMMENT_PAGE_UNVERIFIED');
  if(!comments.body.some(x=>x.body?.includes(marker))){
    const posted=await api(`issues/${issue}/comments`,{method:'POST',body:{body:
      `${marker}\n**${report.status} — ${report.code}**\n\n[JSON 결과](https://github.com/${CONTROL_REPOSITORY}/blob/main/${file})\n`}});
    if(posted.status!==201)throw Error('PUBLICATION_RESULT_COMMENT_UNKNOWN');
  }
}

async function execute(){
  const {validated,event}=await admitPublication();
  const {request,invocation}=validated;
  let report={schema:'ZGMINI_PC_PUBLICATION_RESULT_V1',requestId:request.requestId,
    operation:request.operation,issueNumber:event.issue.number,
    snapshotKey:invocation.snapshotKey,status:'BLOCKED',code:'PUBLICATION_NOT_STARTED',
    startedAt:now(),finishedAt:null,providerCalls:null,d1Writes:null,
    sourceVersion:null,sourceStoredAt:null};
  let ledgerPath=null,leasePath=null,phase=null;
  try{
    const {publisherRoot,operationalRoot}=await validatePcSources(validated);
    fs.mkdirSync(path.join(SAFE_ROOT,'requests'),{recursive:true});
    fs.mkdirSync(path.join(SAFE_ROOT,'leases'),{recursive:true});
    const requestDir=real(path.join(SAFE_ROOT,'requests'));
    if(!within(real(SAFE_ROOT),requestDir))throw Error('PUBLICATION_LEDGER_ROOT_INVALID');
    ledgerPath=path.join(requestDir,request.requestId+'.json');
    const existing=fs.existsSync(ledgerPath)?readJson(ledgerPath):null;
    const classified=classifyPublicationLedger(existing,validated);
    if(classified.status!=='NEW'){
      report={...report,status:'DUPLICATE_REUSED_NO_EXECUTION',
        code:'PUBLICATION_REQUEST_ALREADY_SEEN',previousPhase:classified.phase};
      return report;
    }
    // Fixed B-only PC lease; never delete a stale lease or override another owner.
    const active=path.join(SAFE_ROOT,'leases','active');
    fs.mkdirSync(active);leasePath=active;
    fs.writeFileSync(path.join(active,'owner.json'),JSON.stringify({requestId:request.requestId,
      pid:process.pid,createdAt:now()}),{flag:'wx'});
    phase={requestId:request.requestId,fingerprint:classified.fingerprint,
      phase:'READY',updatedAt:now(),firstFail:null};
    fs.writeFileSync(ledgerPath,JSON.stringify(phase,null,2)+'\n',{flag:'wx'});
    const logDirectory=resultDirectoryFor(request.requestId);
    const childEnv={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,
      PATH:process.env.PATH,TEMP:process.env.RUNNER_TEMP, TMP:process.env.RUNNER_TEMP,
      USERPROFILE:process.env.USERPROFILE,
      ZGMINI_PC_HOME:PC_BASE,
      ZGMINI_EARNINGS_C_OPERATIONAL_ROOT:operationalRoot,
      ZGMINI_EARNINGS_C_LOG_DIR:logDirectory};
    const script=path.join(publisherRoot,...invocation.script.split('/'));
    const preflight=await runFixedChild(script,['--dry-run'],childEnv,PREFLIGHT_TIMEOUT_MS);
    if(preflight.exitCode!==0||preflight.timedOut||preflight.truncated)
      throw Error('PUBLICATION_PREFLIGHT_FAILED');
    // Both pinned publishers use second-resolution, exclusive result filenames.
    // Keep apply in a later UTC second to avoid colliding with dry-run evidence.
    const fenceAt=Date.now();
    await new Promise(resolve=>setTimeout(resolve,millisecondsToNextUtcSecond(fenceAt)));
    phase=nextLedgerPhase(phase,'PREFLIGHT_PASS');writeAtomic(ledgerPath,phase);
    const outputDir=request.operation==='bea-unit-profit-once'?logDirectory:
      path.join(publisherRoot,'scripts','pc-writer');
    const prefix=request.operation==='bea-unit-profit-once'? 'EARNINGS_BEA_UNIT_PROFIT_R1_RESULT_':
      'EARNINGS_CENSUS_QFR_R4_D1_RESULT_';
    const before=new Set(fs.readdirSync(outputDir).filter(f=>f.startsWith(prefix)));
    phase=nextLedgerPhase(phase,'APPLY_START');writeAtomic(ledgerPath,phase);
    const applied=await runFixedChild(script,[...invocation.flags],childEnv,APPLY_TIMEOUT_MS);
    if(applied.exitCode!==0||applied.timedOut||applied.truncated)
      throw Error('PUBLICATION_APPLY_RESULT_UNKNOWN');
    const evidence=parsePublisherLog(readNewResult(outputDir,prefix,before),request.operation);
    validatePublicationReadback(validated,{...evidence,key:invocation.snapshotKey});
    phase=nextLedgerPhase(phase,'READBACK_PASS');writeAtomic(ledgerPath,phase);
    report={...report,status:'PASS',code:'PUBLICATION_SINGLE_KEY_READBACK_VERIFIED',
      d1Result:evidence.d1Result,sourceVersion:evidence.sourceVersion,
      ...publicationCheckpointReport(request.operation,evidence),
      d1Writes:evidence.d1Result==='READBACK_VERIFIED'?1:0,
      providerCalls:request.operation==='bea-unit-profit-once'?2:0};
    // Only a fully verified operation releases its lease; archive owner evidence.
    fs.renameSync(active,path.join(SAFE_ROOT,'leases','complete-'+request.requestId));
    leasePath=null;
    return report;
  }catch(error){
    const reason=code(error);
    if(phase&&ledgerPath){
      if(phase.phase==='PASS')phase={...phase,phase:'STATE_UNKNOWN',firstFail:reason,updatedAt:now()};
      else phase=nextLedgerPhase(phase,phase.phase==='APPLYING'?'UNVERIFIED':'STOP',{code:reason});
      writeAtomic(ledgerPath,phase);
    }
    report={...report,status:phase?.phase==='STATE_UNKNOWN'?'STATE_UNKNOWN':'BLOCKED',
      code:reason,d1Writes:phase?.phase==='STATE_UNKNOWN'?null:0};
    // Keep active lease on unknown writes. Verified preflight-only errors may
    // be released safely without changing the immutable per-request ledger.
    if(leasePath&&phase?.phase==='BLOCKED'){
      fs.renameSync(leasePath,path.join(SAFE_ROOT,'leases','blocked-'+request.requestId));
      leasePath=null;
    }
    return report;
  }finally{
    report.finishedAt=now();
    // Report publication errors never trigger another B write.
    try{await uploadReport(event.issue.number,report);}catch(error){
      console.log(`REPORT_UPLOAD=${code(error)}; OPERATION_RETRY=FORBIDDEN`);
      // Runtime may have PASS, but report handoff has not been proven.
      process.exitCode=1;
    }
    console.log(JSON.stringify(report));
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const result=await execute();
    if(process.exitCode!==1)
      process.exitCode=result?.status==='PASS'||result?.status==='DUPLICATE_REUSED_NO_EXECUTION'?0:1;
  }catch(error){
    console.log(`status=AUTOMATION_BLOCKED\ncode=${code(error)}\nD1_WRITES=UNVERIFIED\nOPERATION_RETRY=FORBIDDEN`);
    process.exitCode=1;
  }
}
