// ISOLATED DESIGN DRAFT ONLY. Not installed or authorized on a PC Runner.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const ENTRY='scripts/pc-writer/employment-r6-runner-stage.mjs';
const HASH=/^[a-f0-9]{64}$/;
const SHA=/^[a-f0-9]{40}$/;
const REPORT=/^EMPLOYMENT_R6_RUNNER_[A-Za-z0-9_]+\.json$/;
const STATUS=new Set(['PASS','BLOCKED','FAIL']);
const SUMMARY_FIELDS=['sourceFeatures','recentlyObservedFeatures','chartReadyFeatures',
  'chartPartialFeatures','scoredFeatures','recentlyScoredFeatures'];
const PIT_FIELDS=['coreCurrentRows','coreHistoryRevisions','coreCurrentKeys',
  'coreCurrentKeysMissingHistory','missingKeysWithCandidateHistory',
  'missingKeysWithMatchingCandidateValueAndHash','candidateCurrentKeys',
  'candidateNewKeys','candidateOverlapMatchingKeys',
  'candidateOverlapConflictingKeys','candidateOverlapUnverifiedKeys',
  'candidateNewKeysWithConsistentPITMetadata','candidateNewKeysWithIncompletePITMetadata',
  'coreMissingHistoryKeysWithConsistentCandidateMetadata',
  'coreMissingHistoryKeysWithoutConsistentCandidateMetadata'];
const count=n=>Number.isSafeInteger(n)&&n>=0?n:null;
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code});};
const safe=code=>/^[A-Z0-9_]{1,100}$/.test(code??'')?code:'R6_CONTROLLER_INTERNAL_ERROR';

export function validateBundle(request,{host,workspace}){
  const approved=host?.approvedSources?.[request.sourceSha];
  if(!approved||!SHA.test(request.sourceSha)||approved.branch!==request.sourceBranch
    ||approved.entrypoint!==ENTRY||!path.isAbsolute(approved.root))stop('R6_BUNDLE_NOT_APPROVED');
  if(!path.isAbsolute(workspace))stop('R6_WORKSPACE_NOT_ABSOLUTE');
  const core=path.join(host.dataRoot??'','pc-writer','storage','core.sqlite');
  const candidate=host.employmentR6CandidatePath;
  if(!path.isAbsolute(host.dataRoot??'')||!path.isAbsolute(candidate??'')
    ||path.basename(candidate)!=='EMPLOYMENT_R6_CANDIDATE.sqlite')stop('R6_HOST_CANDIDATE_NOT_APPROVED');
  if(!fs.existsSync(core)||!fs.existsSync(candidate))stop('R6_HOST_DATABASE_NOT_FOUND');
  const coreStat=fs.statSync(core,{bigint:true}),candidateStat=fs.statSync(candidate,{bigint:true});
  if(!coreStat.isFile()||!candidateStat.isFile()
    ||fs.realpathSync(core)===fs.realpathSync(candidate)
    ||coreStat.dev===candidateStat.dev&&coreStat.ino===candidateStat.ino)stop('R6_HOST_DATABASE_ALIAS');
  const manifestPath=path.join(approved.root,'manifest.json');
  if(!fs.statSync(manifestPath).isFile())stop('R6_MANIFEST_NOT_FOUND');
  let manifest,manifestBytes;
  try{
    manifestBytes=fs.readFileSync(manifestPath);
    manifest=JSON.parse(manifestBytes.toString('utf8'));
  }catch{stop('R6_MANIFEST_INVALID');}
  // Seal the exact approved file bytes (including whitespace and key order).
  // Re-serializing parsed JSON is not equivalent to a raw-byte approval hash.
  if(digest(manifestBytes)!==approved.manifestSha256)stop('R6_MANIFEST_DRIFT');
  const files=manifest?.files;
  if(!files||typeof files!=='object'||Array.isArray(files)
    ||Object.keys(files).length<1||Object.keys(files).length>128
    ||!Object.hasOwn(files,ENTRY))stop('R6_MANIFEST_INVALID');
  for(const [name,sha] of Object.entries(files)){
    if(!HASH.test(sha)||!name||name.startsWith('/')||name.includes('\\')
      ||name.split('/').some(s=>!s||s==='.'||s==='..')||!/^[-a-zA-Z0-9_./]+$/.test(name))stop('R6_BUNDLE_PATH_INVALID');
  }
  return {approved,files,core,candidate};
}

const runChild=(file,argv,{cwd,env})=>new Promise(resolve=>{
  const child=spawn(process.execPath,[file,...argv],{cwd,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
  // Never retain child stdout/stderr: the approved child may accidentally emit
  // sensitive diagnostics and the parent only needs the bounded overflow flag.
  let outputBytes=0,truncated=false;
  const add=b=>{outputBytes=Math.min(2049,outputBytes+b.length);if(outputBytes>2048)truncated=true;};
  child.stdout.on('data',add);child.stderr.on('data',add);
  child.on('error',()=>resolve({exitCode:-1,truncated:true}));
  child.on('exit',code=>resolve({exitCode:code,truncated}));
});

export async function inspectEmploymentR6Candidate(request,context){
  let guard;
  try{guard=validateBundle(request,context);}catch(error){return {status:'BLOCKED',code:safe(error.code)};}
  const {approved,files,core,candidate}=guard;
  const workspace=context.workspace;
  const target=path.join(workspace,'r6-source');
  try{
    fs.mkdirSync(target,{recursive:false});
    for(const [name,sha] of Object.entries(files)){
      const source=path.join(approved.root,'source',name);
      const info=fs.lstatSync(source);
      if(!info.isFile()||info.size>10485760)stop('R6_SOURCE_FILE_INVALID');
      const bytes=fs.readFileSync(source);
      if(digest(bytes)!==sha)stop('R6_SOURCE_HASH_DRIFT');
      const dest=path.join(target,name);
      fs.mkdirSync(path.dirname(dest),{recursive:true});
      fs.writeFileSync(dest,bytes,{flag:'wx'});
    }
  }catch(error){return {status:'BLOCKED',code:safe(error.code),candidateExecuted:false};}
  const outputDir=path.join(workspace,'r6-report');
  fs.mkdirSync(outputDir,{recursive:false});
  const argv=['--db',core,'--candidate-db-external',candidate,'--output-dir',outputDir];
  if(context.host.employmentR6AsOfDate){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(context.host.employmentR6AsOfDate))return {status:'BLOCKED',code:'R6_AS_OF_INVALID',candidateExecuted:false};
    argv.push('--as-of',context.host.employmentR6AsOfDate);
  }
  const env={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,
    PATH:path.dirname(process.execPath),TEMP:workspace,TMP:workspace,HOME:workspace,USERPROFILE:workspace};
  const child=await runChild(path.join(target,ENTRY),argv,{cwd:target,env});
  try{
    const reports=fs.readdirSync(outputDir).filter(x=>REPORT.test(x));
    if(reports.length!==1)stop('R6_RESULT_MISSING');
    const resultFile=path.join(outputDir,reports[0]);
    if(fs.statSync(resultFile).size>12000)stop('R6_RESULT_TOO_LARGE');
    const body=JSON.parse(fs.readFileSync(resultFile,'utf8'));
    if(!STATUS.has(body.status)||!/^[A-Z0-9_]{1,100}$/.test(body.code??'')
      ||body.kind!=='EMPLOYMENT_R6_RUNNER_READONLY_REPORT_V1'
      ||body.providerCalls!==0||body.d1Writes!==0
      ||body.publicationStatus!=='NOT_REQUESTED'||body.promotionApproved!==false
      ||child.truncated||child.exitCode!==(body.status==='PASS'?0:2))stop('R6_RESULT_INVALID');
    // The child is an immutable approved source; project only documented
    // aggregate fields and statuses, never report paths, raw rows or errors.
    if(body.status==='PASS'&&(!Array.isArray(body.indicators)||body.indicators.length!==29
      ||new Set(body.indicators.map(x=>x?.id)).size!==29
      ||body.indicators.some(x=>!/^[A-Z0-9_]{1,64}$/.test(x?.id??'')
        ||!['READY','STALE','UNAVAILABLE'].includes(x.rawStatus)
        ||!['READY','PARTIAL','UNAVAILABLE'].includes(x.chartStatus)
        ||!['READY','PARTIAL_HISTORY','PARTIAL_MISSING'].includes(x.scoreStatus)))){
      stop('R6_RESULT_INVALID');
    }
    const indicators=Array.isArray(body.indicators)&&body.indicators.length<=29
      ?body.indicators.map(x=>({id:/^[A-Z0-9_]{1,64}$/.test(x.id??'')?x.id:null,
        rawStatus:['READY','STALE','UNAVAILABLE'].includes(x.rawStatus)?x.rawStatus:'UNAVAILABLE',
        chartStatus:['READY','PARTIAL','UNAVAILABLE'].includes(x.chartStatus)?x.chartStatus:'UNAVAILABLE',
        scoreStatus:['READY','PARTIAL_HISTORY','PARTIAL_MISSING'].includes(x.scoreStatus)?x.scoreStatus:'PARTIAL_MISSING'})):[];
    const summary=Object.fromEntries(SUMMARY_FIELDS.map(k=>[k,count(body.summary?.[k])]));
    const pit=Object.fromEntries(PIT_FIELDS.map(k=>[k,count(body.pit?.[k])]));
    pit.candidateReconciliationPreviewStatus=/^[A-Z0-9_]{1,90}$/.test(body.pit?.candidateReconciliationPreviewStatus??'')
      ?body.pit.candidateReconciliationPreviewStatus:'NO_RUNTIME_EVIDENCE';
    const walPreflight=Object.fromEntries(['coreWalMode','candidateWalMode',
      'coreWalSidecarsPreexisting','candidateWalSidecarsPreexisting'].map(k=>[k,body.walPreflight?.[k]===true]));
    return {status:body.status,code:body.code,actualExecutionSha:request.sourceSha,
      sourceBundleSha:request.sourceSha,sqliteOpened:body.sqliteOpened===true,
      summary,pit,indicators,bodyDigest:HASH.test(body.bodyDigest??'')?body.bodyDigest:null,
      walPreflight,promotionApproved:false,
      providerCalls:0,d1Writes:0,operationalWrites:0};
  }catch(error){return {status:'FAIL',code:safe(error.code),candidateExecuted:true,
    actualExecutionSha:request.sourceSha};}
}
