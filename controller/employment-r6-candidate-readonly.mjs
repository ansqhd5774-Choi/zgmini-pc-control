// ISOLATED DESIGN DRAFT ONLY. Not installed or authorized on a PC Runner.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {spawn} from 'node:child_process';

const ENTRY='scripts/pc-writer/employment-r6-runner-stage.mjs';
const HASH=/^[a-f0-9]{64}$/;
const SHA=/^[a-f0-9]{40}$/;
const REPORT=/^EMPLOYMENT_R6_RUNNER_[A-Za-z0-9_]+\.json$/;
const STATUS=new Set(['PASS','BLOCKED','FAIL']);
const SUMMARY_FIELDS=['sourceFeatures','recentlyObservedFeatures','chartReadyFeatures',
  'chartPartialFeatures','scoredFeatures','recentlyScoredFeatures'];
const PIT_FIELDS=['coreCurrentRows','coreHistoryRevisions','coreCurrentKeys',
  // Fixed count-only History lineage fields; never return revision rows,
  // source hashes, raw observations, paths, or availability timestamps.
  'coreHistoryAsOfUniqueKeys','coreHistoryPriorRevisionKeys',
  'coreHistoryPriorRevisionRows','coreHistoryAmbiguousLatestKeys',
  'coreHistorySameInstantAdditionalRows',
  // PIT-04-03: disjoint Core CURRENT-to-latest-HISTORY, count-only classification.
  'coreCurrentHistoryMatchingKeys','coreCurrentHistoryConflictingKeys',
  'coreCurrentHistoryUnverifiedKeys','coreCurrentHistoryMissingKeys',
  'candidateHistoryAsOfUniqueKeys',
  'candidateHistoryPriorRevisionKeys','candidateHistoryPriorRevisionRows',
  'candidateHistoryAmbiguousLatestKeys','candidateHistorySameInstantAdditionalRows',
  'coreCurrentKeysMissingHistory','missingKeysWithCandidateHistory',
  'missingKeysWithMatchingCandidateValueAndHash','candidateCurrentKeys',
  'candidateNewKeys','candidateOverlapMatchingKeys',
  'candidateOverlapConflictingKeys','candidateOverlapUnverifiedKeys',
  'candidateNewKeysWithConsistentPITMetadata','candidateNewKeysWithIncompletePITMetadata',
  'coreMissingHistoryKeysWithConsistentCandidateMetadata',
  'coreMissingHistoryKeysWithoutConsistentCandidateMetadata',
  // PIT-04-05: aggregate raw response / collection run attribution only.
  'rawSnapshotMetadataKeys','rawSnapshotCertifiedKeys',
  'rawSnapshotInvalidBodyKeys','rawSnapshotValidWithoutRunKeys',
  'coreCurrentRawLineageVerifiedKeys','coreCurrentRawLineageMissingSnapshotKeys',
  'coreCurrentRawLineageConflictingKeys','coreCurrentRawLineageUnverifiedKeys',
  'coreHistoryRawLineageTotalRows','coreHistoryRawLineageVerifiedRows',
  'coreHistoryRawLineageMissingSnapshotRows','coreHistoryRawLineageConflictingRows',
  'coreHistoryRawLineageUnverifiedRows'];
const count=n=>Number.isSafeInteger(n)&&n>=0?n:null;
const dateOnly=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)
  &&Number.isFinite(Date.parse(x+'T00:00:00Z'))
  &&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x?x:null;
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code});};
const safe=code=>/^[A-Z0-9_]{1,100}$/.test(code??'')?code:'R6_CONTROLLER_INTERNAL_ERROR';

// Fixed R6 source labels only; this is a safe metadata projection, not a
// general-purpose SQL, file, provider, or exact timestamp disclosure channel.
const R6_SOURCE_GROUPS=new Set([
 'DOL_UI_WEEKLY_CLAIMS','BLS_EMPLOYMENT_SITUATION','BLS_JOLTS',
 'BLS_ECI','BLS_STATE_MSA','BLS_BED','UNKNOWN',
]);
const ATTEST_FIELDS=['metadataKeys','bodyVerifiedKeys','runCertifiedKeys'];
const attestRows=(rows,key,allowed,max)=>{
 if(rows==null)return null;
 if(!Array.isArray(rows)||rows.length>max)stop('R6_RESULT_INVALID');
 const seen=new Set();
 return rows.map(item=>{
  const name=item?.[key];
  if(typeof name!=='string'||!allowed(name)||seen.has(name))stop('R6_RESULT_INVALID');
  seen.add(name);
  const counts=Object.fromEntries(ATTEST_FIELDS.map(k=>[k,count(item[k])]));
  if(Object.values(counts).some(x=>x===null)
    ||counts.runCertifiedKeys>counts.bodyVerifiedKeys
    ||counts.bodyVerifiedKeys>counts.metadataKeys)stop('R6_RESULT_INVALID');
  return {[key]:name,...counts};
 });
};
const isMonth=x=>typeof x==='string'&&(
 /^(?:20\d{2})-(?:0[1-9]|1[0-2])$/.test(x)||x==='OLDER'||x==='UNKNOWN');
const bucketTotal=(rows,key)=>rows.reduce((sum,row)=>sum+row[key],0);

const PIT04_REGIONS=new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const PIT04_REASONS=new Set([
 'CANDIDATE_CURRENT_CONFLICT','CORE_HISTORY_AMBIGUOUS','CORE_HISTORY_CONFLICT',
 'CORE_CURRENT_DUPLICATE','MISSING_HISTORY_CANDIDATE_UNVERIFIED',
 'MISSING_HISTORY_NO_CANDIDATE','MISSING_HISTORY_CANDIDATE_INTERNAL_MATCH_ONLY',
]);
const PIT04_COUNTERS=[
 'coreKeys','coreHistoryMissing','coreHistoryConflict','coreHistoryAmbiguous',
 'candidateOverlapConflicts','missingCandidateInternalMatch',
 'missingCandidateIncomplete','missingWithoutCandidate','duplicateCurrentKeys',
];
// Strictly validate even the previously sanitized child. Neither extra fields
// nor the child-provided original JSON may cross the Controller report boundary.
export function projectPit04KeyReview(review,{offset,asOfDate}={}){
 const fail=()=>stop('R6_PIT04_RESULT_INVALID');
 if(!Number.isSafeInteger(offset)||offset<0||offset>50000
    ||!dateOnly(asOfDate)||review?.kind!=='EMPLOYMENT_R6_PIT0408_KEY_REVIEW_SOURCE_ONLY_V1'
    ||review.status!=='HOLD_KEY_CLASSIFICATION_NOT_RAW_PIT_ATTESTATION'
    ||review.rawPitAttested!==false||review.promotionApproved!==false
    ||review.repairAuthorized!==false||review.offset!==offset
    ||review.pageSize!==8||!Array.isArray(review.evidence))fail();
 const counts=Object.fromEntries(PIT04_COUNTERS.map(k=>[k,count(review.counts?.[k])]));
 if(Object.values(counts).some(v=>v===null)
    ||counts.coreKeys>50000||counts.coreHistoryMissing>counts.coreKeys
    ||counts.coreHistoryConflict>counts.coreKeys
    ||counts.candidateOverlapConflicts>counts.coreKeys
    ||counts.coreHistoryAmbiguous>counts.coreKeys
    ||counts.duplicateCurrentKeys>counts.coreKeys
    ||counts.coreHistoryMissing!==counts.missingCandidateInternalMatch
       +counts.missingCandidateIncomplete+counts.missingWithoutCandidate)fail();
 const total=count(review.evidenceTotal);
 if(total===null||total>counts.coreKeys||offset>total
   ||review.evidence.length!==Math.min(8,total-offset))fail();
 const next=offset+8<total?offset+8:null;
 if(review.evidenceTruncated!==(next!==null)||review.nextOffset!==next)fail();
 const seen=new Set();
 const evidence=review.evidence.map(item=>{
  const region=item?.geographyCode,date=item?.observationDate,reason=item?.reason;
  const k=region+'|'+date;
  if(item?.logicalSeriesId!=='STATE_INITIAL_CLAIMS'||!PIT04_REGIONS.has(region)
    ||!dateOnly(date)||new Date(date+'T00:00:00Z').getUTCDay()!==6
    ||date>asOfDate||!PIT04_REASONS.has(reason)||seen.has(k)
    ||typeof item.coreHistoryMissing!=='boolean'
    ||typeof item.candidateCurrentConflict!=='boolean'
    ||item.rawPitAttested!==false||item.repairAuthorized!==false
    ||(reason==='CANDIDATE_CURRENT_CONFLICT'&&!item.candidateCurrentConflict)
    ||(reason.startsWith('MISSING_HISTORY_')&&!item.coreHistoryMissing))fail();
  seen.add(k);
  return {logicalSeriesId:'STATE_INITIAL_CLAIMS',
    geographyCode:region,observationDate:date,reason,
    coreHistoryMissing:item.coreHistoryMissing,
    candidateCurrentConflict:item.candidateCurrentConflict,
    rawPitAttested:false,repairAuthorized:false};
 });
 return {kind:'EMPLOYMENT_R6_PIT0408_KEY_REVIEW_SOURCE_ONLY_V1',
  status:'HOLD_KEY_CLASSIFICATION_NOT_RAW_PIT_ATTESTATION',
  counts,evidenceTotal:total,offset,pageSize:8,nextOffset:next,
  evidenceTruncated:next!==null,evidence,
  rawPitAttested:false,promotionApproved:false,repairAuthorized:false};
}

export function validateBundle(request,{host,workspace}){
  if(Object.hasOwn(request,'pit04Offset')&&(!Number.isSafeInteger(request.pit04Offset)
     ||request.pit04Offset<0||request.pit04Offset>50000))stop('R6_PIT04_OFFSET_INVALID');
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
  if(Object.hasOwn(request,'pit04Offset')&&
    !['lib/market-score/employment-r6-pit04-key-evidence.mjs',
      'scripts/pc-writer/employment-r6-pit-coverage.mjs'].every(p=>Object.hasOwn(files,p)))
    stop('R6_PIT04_SOURCE_NOT_APPROVED');
  for(const [name,sha] of Object.entries(files)){
    if(!HASH.test(sha)||!name||name.startsWith('/')||name.includes('\\')
      ||name.split('/').some(s=>!s||s==='.'||s==='..')||!/^[-a-zA-Z0-9_./]+$/.test(name))stop('R6_BUNDLE_PATH_INVALID');
  }
  return {approved,files,core,candidate};
}

const runChild=(file,argv,{cwd,env})=>new Promise(resolve=>{
  // This is system-wide memory use observed while the child runs, not the
  // child process's own peak RSS. A blocked preflight is not a computation peak.
  const mib=1048576,intervalMs=100;
  const totalMiB=Math.floor(os.totalmem()/mib);
  const baselineFreeMiB=Math.floor(os.freemem()/mib);
  let minimumFreeMiB=baselineFreeMiB,samples=1,settled=false;
  const sample=()=>{minimumFreeMiB=Math.min(minimumFreeMiB,Math.floor(os.freemem()/mib));samples++;};
  const child=spawn(process.execPath,[file,...argv],{cwd,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
  const interval=setInterval(sample,intervalMs);
  interval.unref();
  const done=(exitCode,failed)=>{
    if(settled)return;
    settled=true;clearInterval(interval);sample();
    resolve({exitCode,truncated:truncated||failed,
      memoryTelemetry:{kind:'SYSTEM_RAM_SAMPLED_DURING_R6_CHILD_V1',
        intervalMs,samples,totalMiB,baselineFreeMiB,minimumFreeMiB,
        peakSystemUsedMiB:Math.max(0,totalMiB-minimumFreeMiB),
        peakIncreaseFromBaselineMiB:Math.max(0,baselineFreeMiB-minimumFreeMiB)}});
  };
  // Never retain child stdout/stderr: the approved child may accidentally emit
  // sensitive diagnostics and the parent only needs the bounded overflow flag.
  let outputBytes=0,truncated=false;
  const add=b=>{outputBytes=Math.min(2049,outputBytes+b.length);if(outputBytes>2048)truncated=true;};
  child.stdout.on('data',add);child.stderr.on('data',add);
  child.on('error',()=>done(-1,true));
  child.on('exit',code=>done(code,false));
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
  if(Object.hasOwn(request,'pit04Offset'))argv.push('--pit04-offset',String(request.pit04Offset));
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
    const wantsPit04=Object.hasOwn(request,'pit04Offset');
    if(wantsPit04&&body.status==='PASS'&&body.pit04KeyReview==null)
      stop('R6_PIT04_RESULT_MISSING');
    if(!wantsPit04&&body.pit04KeyReview!=null)stop('R6_PIT04_UNREQUESTED_RESULT');
    const pit04KeyReview=wantsPit04&&body.status==='PASS'
      ?projectPit04KeyReview(body.pit04KeyReview,{
         offset:request.pit04Offset,asOfDate:body.asOfDate}):null;
    // New Host bundles can carry bounded raw-body/run proof by source/month.
    // Older approved bundles omit these arrays and retain their prior output.
    pit.rawSnapshotByGroup=attestRows(body.pit?.rawSnapshotByGroup,
      'releaseGroup',name=>R6_SOURCE_GROUPS.has(name),R6_SOURCE_GROUPS.size);
    pit.rawSnapshotByMonth=attestRows(body.pit?.rawSnapshotByMonth,
      'retrievalMonth',isMonth,14);
    if((pit.rawSnapshotByGroup===null)!==(pit.rawSnapshotByMonth===null))
      stop('R6_RESULT_INVALID');
    if(pit.rawSnapshotByGroup!==null){
      const expected=[pit.rawSnapshotMetadataKeys,pit.rawSnapshotCertifiedKeys,
        pit.rawSnapshotInvalidBodyKeys,pit.rawSnapshotValidWithoutRunKeys];
      if(expected.some(x=>x===null)
        ||[pit.rawSnapshotByGroup,pit.rawSnapshotByMonth].some(rows=>
          bucketTotal(rows,'metadataKeys')!==pit.rawSnapshotMetadataKeys
          ||bucketTotal(rows,'runCertifiedKeys')!==pit.rawSnapshotCertifiedKeys
          ||bucketTotal(rows,'bodyVerifiedKeys')!==
            pit.rawSnapshotMetadataKeys-pit.rawSnapshotInvalidBodyKeys)
        ||pit.rawSnapshotMetadataKeys-pit.rawSnapshotInvalidBodyKeys!==
          pit.rawSnapshotCertifiedKeys+pit.rawSnapshotValidWithoutRunKeys)
        stop('R6_RESULT_INVALID');
    }
    // PIT-04-03: a complete four-bucket result must partition the same
    // as-of Core CURRENT keys. A PASS report with inconsistent totals is
    // invalid evidence, never a new candidate promotion or corrected count.
    const four=['coreCurrentHistoryMatchingKeys','coreCurrentHistoryConflictingKeys',
      'coreCurrentHistoryUnverifiedKeys','coreCurrentHistoryMissingKeys'];
    if(body.status==='PASS'&&four.every(k=>pit[k]!==null)
      &&(pit.coreCurrentKeys===null
        ||four.reduce((sum,k)=>sum+pit[k],0)!==pit.coreCurrentKeys
        ||(pit.coreCurrentKeysMissingHistory!==null
          &&pit.coreCurrentHistoryMissingKeys!==pit.coreCurrentKeysMissingHistory)))
      stop('R6_RESULT_INVALID');
    // Neither raw source bodies nor hashes can pass this boundary. A complete
    // four-bucket lineage partition is necessary for reportable evidence.
    const rawCurrent=['coreCurrentRawLineageVerifiedKeys',
      'coreCurrentRawLineageMissingSnapshotKeys','coreCurrentRawLineageConflictingKeys',
      'coreCurrentRawLineageUnverifiedKeys'];
    const rawHistory=['coreHistoryRawLineageVerifiedRows',
      'coreHistoryRawLineageMissingSnapshotRows','coreHistoryRawLineageConflictingRows',
      'coreHistoryRawLineageUnverifiedRows'];
    const complete=fields=>fields.every(key=>pit[key]!==null);
    const total=fields=>fields.reduce((sum,key)=>sum+pit[key],0);
    if(body.status==='PASS'
      &&((complete(rawCurrent)&&(pit.coreCurrentKeys===null
        ||total(rawCurrent)!==pit.coreCurrentKeys))
        ||(complete(rawHistory)&&(pit.coreHistoryRawLineageTotalRows===null
          ||total(rawHistory)!==pit.coreHistoryRawLineageTotalRows))
        ||(pit.rawSnapshotMetadataKeys!==null&&pit.rawSnapshotCertifiedKeys!==null
          &&pit.rawSnapshotCertifiedKeys>pit.rawSnapshotMetadataKeys))){
      stop('R6_RESULT_INVALID');
    }
    const rawStatuses=new Set(['NO_RUNTIME_EVIDENCE','HOLD_INCOMPLETE_SOURCE_LINEAGE',
      'READONLY_SOURCE_LINKS_NOT_PIT_APPROVAL']);
    pit.rawLineageEvidenceStatus=rawStatuses.has(body.pit?.rawLineageEvidenceStatus)
      ?body.pit.rawLineageEvidenceStatus:'NO_RUNTIME_EVIDENCE';
    if(body.status==='PASS'&&pit.rawLineageEvidenceStatus!=='NO_RUNTIME_EVIDENCE'
      &&(pit.rawSnapshotMetadataKeys===null||pit.rawSnapshotCertifiedKeys===null
        ||pit.coreHistoryRawLineageTotalRows===null
        ||!complete(rawCurrent)||!complete(rawHistory)))stop('R6_RESULT_INVALID');
    pit.candidateReconciliationPreviewStatus=/^[A-Z0-9_]{1,90}$/.test(body.pit?.candidateReconciliationPreviewStatus??'')
      ?body.pit.candidateReconciliationPreviewStatus:'NO_RUNTIME_EVIDENCE';
    const walPreflight=Object.fromEntries(['coreWalMode','candidateWalMode',
      'coreWalSidecarsPreexisting','candidateWalSidecarsPreexisting'].map(k=>[k,body.walPreflight?.[k]===true]));
    return {status:body.status,code:body.code,actualExecutionSha:request.sourceSha,
      sourceBundleSha:request.sourceSha,asOfDate:dateOnly(body.asOfDate),
      sqliteOpened:body.sqliteOpened===true,
      summary,pit,...(pit04KeyReview===null?{}:{pit04KeyReview}),
      indicators,bodyDigest:HASH.test(body.bodyDigest??'')?body.bodyDigest:null,
      walPreflight,promotionApproved:false,
      memoryTelemetry:{...child.memoryTelemetry,
        calculationPeakValid:body.status==='PASS',
        measurementPhase:body.status==='PASS'?'COMPUTATION':'PREFLIGHT_OR_EARLY_EXIT'},
      providerCalls:0,d1Writes:0,operationalWrites:0};
  }catch(error){return {status:'FAIL',code:safe(error.code),candidateExecuted:true,
    actualExecutionSha:request.sourceSha};}
}

