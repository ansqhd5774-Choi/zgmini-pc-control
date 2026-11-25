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


// Count-only opt-in; preserve existing A reply and private five-field key contract.
export function projectPit04ConflictCauses(raw,{expectedTotal}={}){
 if(raw==null)return null;
 const labels=['invalidNumericValue','providerOrSeriesDifferent',
  'valueAndHashDifferent','valueOnlyDifferent','hashOnlyDifferent'];
 const flags=['numericValue','sourceHash','provider','providerSeries','sourceRevision'];
 const causes=Object.fromEntries(labels.map(k=>[k,count(raw.causes?.[k])]));
 const changedFields=Object.fromEntries(flags.map(k=>[k,count(raw.changedFields?.[k])]));
 const total=count(raw.total);
 if(raw.kind!=='W04_CANDIDATE_CURRENT_CAUSE_COUNTS_V1'
  ||raw.sourceScope!=='READONLY_CORE_CANDIDATE_SAME_SNAPSHOT_NOT_PIT'
  ||raw.rawPitAttested!==false||raw.repairAuthorized!==false
  ||total===null||total>50000||total!==expectedTotal
  ||[...Object.values(causes),...Object.values(changedFields)]
    .some(x=>x===null||x>total)
  ||Object.values(causes).reduce((a,b)=>a+b,0)!==total)
  stop('R6_PIT0408_PRIVATE_REPORT_INVALID');
 return {kind:raw.kind,total,causes,changedFields,
  sourceScope:raw.sourceScope,rawPitAttested:false,repairAuthorized:false};
}

const PIT0605_CLASSES=['ORIGINAL_VERSION_AND_HISTORICAL_AVAILABILITY_PROVED',
 'RAW_OBSERVATION_MATCH_HISTORICAL_TIME_UNPROVEN',
 'RAW_OBSERVATION_OR_REVISION_CONFLICT','RAW_NOT_FOUND_IN_CHECKED_SCOPE'];

// Source-only count projection. No new approval, publication or repair.
export function projectR6RawCountAggregate(raw){
 const keys=['metadataKeys','bodyVerifiedKeys','runCertifiedKeys'];
 const countSafe=n=>Number.isSafeInteger(n)&&n>=0&&n<=4000?n:null;
 const approved=new Set(['DOL_UI_WEEKLY_CLAIMS','BLS_EMPLOYMENT_SITUATION','BLS_JOLTS','BLS_ECI','BLS_STATE_MSA','BLS_BED']);
 const month=s=>typeof s==='string'&&(s==='OLDER'||s==='UNKNOWN'||/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(s));
 const buckets=(data,label,allowed,max)=>{
  if(!Array.isArray(data)||data.length>max)stop('R6_RAW_AGGREGATE_RESULT_INVALID');
  const seen=new Set();
  return data.map(item=>{
   const name=item?.[label];
   if(typeof name!=='string'||!allowed(name)||seen.has(name))stop('R6_RAW_AGGREGATE_RESULT_INVALID');
   seen.add(name);
   const counts=Object.fromEntries(keys.map(k=>[k,countSafe(item[k])]));
   if(Object.values(counts).some(x=>x===null)||counts.runCertifiedKeys>counts.bodyVerifiedKeys
     ||counts.bodyVerifiedKeys>counts.metadataKeys)stop('R6_RAW_AGGREGATE_RESULT_INVALID');
   return {[label]:name,...counts};
  });
 };
 if(raw?.kind!=='W04_R6_RAW_AGGREGATE_COUNT_ONLY_V1'
  ||raw.status!=='SOURCE_ONLY_NOT_RUNTIME_ATTESTATION'
  ||raw.historicalPitAttested!==false||raw.repairAuthorized!==false
  ||raw.runtimeAuthorizationVerified!==false||raw.promotionApproved!==false
  ||raw.providerCalls!==0||raw.d1Writes!==0
  ||keys.some(k=>countSafe(raw[k])===null)
  ||raw.runCertifiedKeys>raw.bodyVerifiedKeys||raw.bodyVerifiedKeys>raw.metadataKeys)
  stop('R6_RAW_AGGREGATE_RESULT_INVALID');
 const groups=buckets(raw.rawSnapshotByGroup,'releaseGroup',s=>approved.has(s),6);
 const months=buckets(raw.rawSnapshotByMonth,'retrievalMonth',month,14);
 if([groups,months].some(rows=>keys.some(k=>rows.reduce((n,r)=>n+r[k],0)!==raw[k])))
  stop('R6_RAW_AGGREGATE_RESULT_INVALID');
 return {kind:raw.kind,status:raw.status,...Object.fromEntries(keys.map(k=>[k,raw[k]])),
  rawSnapshotByGroup:groups,rawSnapshotByMonth:months,
  historicalPitAttested:false,repairAuthorized:false,
  runtimeAuthorizationVerified:false,promotionApproved:false};
}

export function projectPit0605Aggregate(raw){
 if(raw?.kind!=='ZGMINI_W04_PIT0605_AGGREGATE_ONLY_V1'
 ||raw.status!=='HOLD_HISTORICAL_PIT_UNATTESTED'
 ||raw.historicalVersionAttested!==false||raw.repairAuthorized!==false
 ||raw.operationalWrites!==0||raw.providerCalls!==0||raw.d1Writes!==0
 ||!/^[a-f0-9]{64}$/.test(raw.evidenceDigest??'')
 ||!Number.isFinite(Date.parse(raw.checkedAt??'')))stop('R6_PIT0605_REPORT_INVALID');
 const missing=count(raw.missingHistoryKeys);
 const snapshots=count(raw.checkedRawSnapshots),accepted=count(raw.acceptedDOLSnapshots);
 const malformed=count(raw.malformedRawSnapshotGroups);
 const counts=Object.fromEntries(PIT0605_CLASSES.map(k=>[k,count(raw.counts?.[k])]));
 const rejected=Object.fromEntries(['bodyOrId','metadata','run','parser']
  .map(k=>[k,count(raw.rejectedRawSnapshots?.[k])]));
 if(missing===null||missing>50000
  ||[snapshots,accepted,malformed,...Object.values(counts),...Object.values(rejected)].some(x=>x===null)
  ||Object.values(counts).reduce((a,b)=>a+b,0)!==missing
  ||counts.ORIGINAL_VERSION_AND_HISTORICAL_AVAILABILITY_PROVED!==0
  ||accepted>snapshots)stop('R6_PIT0605_REPORT_INVALID');
 const receipt=raw.missingCandidateReceipts;
 const projected=receipt===undefined?null:(()=>{
  const keys=count(receipt?.keys),exact=count(receipt?.exactRawMatched),
   in2025=count(receipt?.exactReceiptFirstObserved2025);
  const validMonth=m=>m===null||typeof m==='string'
   &&/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(m);
  if(receipt?.scope!=='EXACT_STORED_RAW_RECEIPT_NOT_HISTORICAL_PIT'
   ||[keys,exact,in2025].some(x=>x===null)
   ||keys>missing||exact>keys||in2025>exact
   ||!validMonth(receipt.firstExactReceiptMonth)||!validMonth(receipt.lastExactReceiptMonth)
   ||(exact===0&&(receipt.firstExactReceiptMonth!==null
     ||receipt.lastExactReceiptMonth!==null))
   ||(exact>0&&(receipt.firstExactReceiptMonth===null
     ||receipt.lastExactReceiptMonth===null
     ||receipt.firstExactReceiptMonth>receipt.lastExactReceiptMonth)))
   stop('R6_PIT0605_REPORT_INVALID');
  return {keys,exactRawMatched:exact,exactReceiptFirstObserved2025:in2025,
   firstExactReceiptMonth:receipt.firstExactReceiptMonth,
   lastExactReceiptMonth:receipt.lastExactReceiptMonth,scope:receipt.scope};
 })();
 return {kind:raw.kind,status:raw.status,checkedAt:raw.checkedAt,missingHistoryKeys:missing,
  counts,checkedRawSnapshots:snapshots,acceptedDOLSnapshots:accepted,
  malformedRawSnapshotGroups:malformed,rejectedRawSnapshots:rejected,
  evidenceDigest:raw.evidenceDigest,
  ...(projected===null?{}:{missingCandidateReceipts:projected}),
  historicalVersionAttested:false,repairAuthorized:false};
}
// Pinned, previously retained PC-private evidence (#3640). This opt-in uses
// the existing A operation, but avoids re-running the historical raw scan.
const REPAIR_PREVIEW_ENTRY='scripts/pc-writer/employment-r6-history-repair-readonly.mjs';
const REPAIR_PREVIEW_SOURCE='551640c3094738f7803d6a7f799098a55c21523c';
const REPAIR_PREVIEW_RECEIPT='pit0605-pc-c9e5b130-4e7a-4a24-a588-717d7faef26d.json';
const REPAIR_PREVIEW_RECEIPT_SHA='2163132e165e45e08edff062722465dac1ff3a2d17ce999ec98a479d6e32547b';
const REPAIR_PREVIEW_EVIDENCE='30afbbec30466fa3e93442c78514ccb5125ca57ae4609dfdd5b9f44716c3acc5';
export function wantsHistoryRepairPreview(request,files){
 return request.pit0605Raw===true&&request.sourceSha===REPAIR_PREVIEW_SOURCE&&
  Object.hasOwn(files,REPAIR_PREVIEW_ENTRY);
}
export function stageHistoryRepairReceipt(host,outputDir){
 const home=host?.dataRoot;
 if(typeof home!=='string'||!path.isAbsolute(home)||path.basename(home).toLowerCase()!=='data')
   stop('R6_HISTORY_REPAIR_RECEIPT_ROOT_INVALID');
 const folder=path.join(home,'pc-writer','pit-evidence');
 const dir=fs.lstatSync(folder);
 if(!dir.isDirectory()||dir.isSymbolicLink())stop('R6_HISTORY_REPAIR_RECEIPT_ROOT_INVALID');
 const file=path.join(folder,REPAIR_PREVIEW_RECEIPT),st=fs.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink()||st.size<10||st.size>32*1024*1024)
   stop('R6_HISTORY_REPAIR_RECEIPT_INVALID');
 const bytes=fs.readFileSync(file);
 if(digest(bytes)!==REPAIR_PREVIEW_RECEIPT_SHA)stop('R6_HISTORY_REPAIR_RECEIPT_DRIFT');
 fs.writeFileSync(path.join(outputDir,'PIT0605_REPAIR_INPUT.json'),bytes,{flag:'wx',mode:0o600});
}
export function projectHistoryRepairSelection(raw){
 const fields=['existingHistory','unmatched','unsupportedCurrent'];
 const held=Object.fromEntries(fields.map(k=>[k,count(raw?.held?.[k])]));
 const eligible=count(raw?.eligible);
 if(raw?.status!=='REPAIR_PREVIEW_ONLY'||raw.receiptSha256!==REPAIR_PREVIEW_RECEIPT_SHA||
   raw.evidenceDigest!==REPAIR_PREVIEW_EVIDENCE||raw.expectedKeys!==2880||
   eligible===null||Object.values(held).some(x=>x===null)||
   eligible+Object.values(held).reduce((a,b)=>a+b,0)!==2880||
   !HASH.test(raw.selectionSha256??'')||raw.historicalVersionAttested!==false||
   raw.repairAuthorized!==false||raw.sqliteWrites!==0)
   stop('R6_HISTORY_REPAIR_SELECTION_INVALID');
 return {status:raw.status,eligible,held,expectedKeys:2880,
  receiptSha256:REPAIR_PREVIEW_RECEIPT_SHA,evidenceDigest:REPAIR_PREVIEW_EVIDENCE,
  selectionSha256:raw.selectionSha256,historicalVersionAttested:false,repairAuthorized:false,sqliteWrites:0};
}

export function retainPit0605PrivateEvidence({outputDir,host,request,aggregate}){
 const file=path.join(outputDir,'PIT0605_PRIVATE_KEY_EVIDENCE.json');
 const st=fs.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink()||st.size<10||st.size>32*1024*1024)
   stop('R6_PIT0605_PRIVATE_SOURCE_INVALID');
 const bytes=fs.readFileSync(file);
 let proof;
 try{proof=JSON.parse(bytes.toString('utf8'));}catch{stop('R6_PIT0605_PRIVATE_INVALID');}
 if(proof?.kind!=='PIT0605_PC_WORKSPACE_PRIVATE_V1'
  ||proof.digest!==aggregate.evidenceDigest
  ||!Array.isArray(proof.rows)||proof.rows.length!==aggregate.missingHistoryKeys
  ||digest(JSON.stringify(proof.rows))!==aggregate.evidenceDigest)
   stop('R6_PIT0605_PRIVATE_INVALID');
 const home=host?.dataRoot;
 if(typeof home!=='string'||!path.isAbsolute(home)
   ||path.basename(home).toLowerCase()!=='data')stop('R6_PIT0605_PRIVATE_ROOT_UNAVAILABLE');
 const writer=path.join(home,'pc-writer'),root=path.join(writer,'pit-evidence');
 if(!fs.statSync(writer).isDirectory())stop('R6_PIT0605_PRIVATE_ROOT_UNAVAILABLE');
 try{fs.mkdirSync(root,{recursive:false});}catch(e){if(e?.code!=='EEXIST')throw e;}
 const dir=fs.lstatSync(root);
 if(!dir.isDirectory()||dir.isSymbolicLink())stop('R6_PIT0605_PRIVATE_ROOT_UNAVAILABLE');
 const filename='pit0605-'+request.requestId+'.json',target=path.join(root,filename);
 fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600});
 const sha=digest(bytes);
 if(digest(fs.readFileSync(target))!==sha)stop('R6_PIT0605_PRIVATE_READBACK_MISMATCH');
 return {evidenceFileRef:'PC_WRITER_PIT_EVIDENCE/'+filename,
  evidenceFileSha256:sha,privateEvidenceReadback:true};
}


export function retainPit0408PrivateEvidence({outputDir,host,request,keyReview,allSeriesConflicts}){
 const file=path.join(outputDir,'PIT0408_PRIVATE_KEY_EVIDENCE.json');
 const stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<10||stat.size>32*1024*1024)
  stop('R6_PIT0408_PRIVATE_SOURCE_INVALID');
 const bytes=fs.readFileSync(file);
 let proof;
 try{proof=JSON.parse(bytes.toString('utf8'));}
 catch{stop('R6_PIT0408_PRIVATE_INVALID');}
 const ledger=proof?.ledger;
 if(proof?.kind!=='PIT0408_PC_WORKSPACE_PRIVATE_V1'||!HASH.test(proof.digest??'')
   ||ledger?.schema!=='W04_PIT0408_PRIVATE_KEYS_V1'
   ||ledger.rawPitAttested!==false||ledger.repairAuthorized!==false
   ||ledger.asOfDate!==keyReview.asOfDate
   ||ledger.coreStateKeyCount!==keyReview.counts.coreKeys
   ||!Array.isArray(ledger.evidence)||ledger.evidence.length!==keyReview.evidenceTotal
   ||!Array.isArray(ledger.allSeriesCandidateCurrentConflicts)
   ||ledger.allSeriesCandidateCurrentConflicts.length!==allSeriesConflicts
   ||digest(JSON.stringify(ledger))!==proof.digest)
  stop('R6_PIT0408_PRIVATE_INVALID');
 for(const [k,v] of Object.entries(keyReview.counts)){
  if(ledger.counts?.[k]!==v)stop('R6_PIT0408_PRIVATE_COUNT_MISMATCH');
 }
 const allowed=new Set(['logicalSeriesId','geographyCode','observationDate',
   'reason','coreHistoryMissing','candidateCurrentConflict','rawPitAttested','repairAuthorized']);
 const seen=new Set();
 let missing=0,claimConflicts=0;
 for(const row of ledger.evidence){
  if(!row||Object.keys(row).length!==allowed.size
    ||Object.keys(row).some(k=>!allowed.has(k))
    ||row.logicalSeriesId!=='STATE_INITIAL_CLAIMS'
    ||!PIT04_REGIONS.has(row.geographyCode)
    ||!/^20\d{2}-\d{2}-\d{2}$/.test(row.observationDate??'')
    ||row.rawPitAttested!==false||row.repairAuthorized!==false
    ||typeof row.coreHistoryMissing!=='boolean'
    ||typeof row.candidateCurrentConflict!=='boolean'
    ||!PIT04_REASONS.has(row.reason))stop('R6_PIT0408_PRIVATE_ROW_INVALID');
  const id=row.geographyCode+'|'+row.observationDate;
  if(seen.has(id))stop('R6_PIT0408_PRIVATE_DUPLICATE');
  seen.add(id);
  if(row.coreHistoryMissing)missing++;
  if(row.candidateCurrentConflict)claimConflicts++;
 }
 if(missing!==keyReview.counts.coreHistoryMissing
   ||claimConflicts!==keyReview.counts.candidateOverlapConflicts)
  stop('R6_PIT0408_PRIVATE_COUNT_MISMATCH');
 const allSeen=new Set();
 let stateConflicts=0;
 for(const row of ledger.allSeriesCandidateCurrentConflicts){
  if(!row||Object.keys(row).length!==5
    ||!['logicalSeriesId','geographyType','geographyCode','observationDate','reason']
       .every(k=>Object.hasOwn(row,k))
    ||typeof row.logicalSeriesId!=='string'||!/^[A-Z][A-Z0-9_]{2,63}$/.test(row.logicalSeriesId)
    ||typeof row.geographyType!=='string'||!/^[A-Z_]{2,24}$/.test(row.geographyType)
    ||typeof row.geographyCode!=='string'||!/^[A-Z0-9_-]{1,32}$/.test(row.geographyCode)
    ||!/^20\d{2}-\d{2}-\d{2}$/.test(row.observationDate??'')
    ||row.reason!=='CANDIDATE_CURRENT_CONFLICT')
    stop('R6_PIT0408_PRIVATE_CONFLICT_INVALID');
  const id=[row.logicalSeriesId,row.geographyType,row.geographyCode,
    row.observationDate].join('|');
  if(allSeen.has(id))stop('R6_PIT0408_PRIVATE_DUPLICATE');
  allSeen.add(id);
  if(row.logicalSeriesId==='STATE_INITIAL_CLAIMS')stateConflicts++;
 }
 if(stateConflicts!==keyReview.counts.candidateOverlapConflicts
   ||keyReview.evidence.length>8)
  stop('R6_PIT0408_PRIVATE_COUNT_MISMATCH');
 const home=host?.dataRoot;
 if(typeof home!=='string'||!path.isAbsolute(home)
   ||path.basename(home).toLowerCase()!=='data')
  stop('R6_PIT0408_PRIVATE_ROOT_UNAVAILABLE');
 const writer=path.join(home,'pc-writer'),root=path.join(writer,'pit-evidence');
 if(!fs.statSync(writer).isDirectory())
  stop('R6_PIT0408_PRIVATE_ROOT_UNAVAILABLE');
 try{fs.mkdirSync(root,{recursive:false});}catch(e){if(e?.code!=='EEXIST')throw e;}
 const folder=fs.lstatSync(root);
 if(!folder.isDirectory()||folder.isSymbolicLink())
  stop('R6_PIT0408_PRIVATE_ROOT_UNAVAILABLE');
 const name='pit0408-'+request.requestId+'.json',dest=path.join(root,name);
 fs.writeFileSync(dest,bytes,{flag:'wx',mode:0o600});
 const receiptSha=digest(bytes);
 if(digest(fs.readFileSync(dest))!==receiptSha)
  stop('R6_PIT0408_PRIVATE_READBACK_MISMATCH');
 return {pit04PrivateEvidenceDigest:proof.digest,
  evidenceFileSha256:receiptSha,evidenceFileRef:'PC_WRITER_PIT_EVIDENCE/'+name,
  privateEvidenceReadback:true};
}

export function validateBundle(request,{host,workspace}){
  if(Object.hasOwn(request,'rawAggregateSourceOnly')&&(
     request.rawAggregateSourceOnly!==true
     ||Object.hasOwn(request,'pit04Offset')
     ||Object.hasOwn(request,'pit0408Private')
     ||Object.hasOwn(request,'pit0605Raw')
     ||request.sourceSha!=='76c5de87a29be9646fcbf2b6ec071914443ce762'))
    stop('R6_RAW_AGGREGATE_SCOPE_NOT_APPROVED');
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
  if(request.rawAggregateSourceOnly===true
     &&!['lib/market-score/employment-r6-raw-aggregate-source-only.mjs',
       'lib/market-score/employment-r6-approved-snapshot-aggregate-source-only.mjs',
       'scripts/pc-writer/employment-r6-pit-coverage.mjs',
       'scripts/pc-writer/employment-r6-runner-stage.mjs'
     ].every(p=>Object.hasOwn(files,p)))
    stop('R6_RAW_AGGREGATE_SOURCE_NOT_APPROVED');
  if(request.pit0605Raw===true&&
     !['lib/market-score/employment-r6-pit04-key-evidence.mjs',
       'lib/market-score/employment-r4-shadow-provider.mjs',
       'scripts/pc-writer/employment-r6-pit-coverage.mjs'].every(p=>Object.hasOwn(files,p)))
     stop('R6_PIT0605_SOURCE_NOT_APPROVED');
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
  if(request.pit0408Private===true)argv.push('--pit0408-private','1');
  if(request.pit0605Raw===true)argv.push('--pit0605-raw','1');
  if(request.rawAggregateSourceOnly===true)argv.push('--raw-aggregate-source-only','1');
  const repairPreview=wantsHistoryRepairPreview(request,files);
  if(repairPreview){
    try{stageHistoryRepairReceipt(context.host,outputDir);}
    catch(error){return {status:'BLOCKED',code:safe(error.code),candidateExecuted:false};}
    argv.push('--pit0605-repair-preview','1');
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
    const resultKind=body.status==='PASS'&&request.rawAggregateSourceOnly===true
      ?'EMPLOYMENT_R6_RUNNER_RAW_AGGREGATE_SOURCE_ONLY_V1'
      :body.status==='PASS'&&request.pit0605Raw===true
      ?(repairPreview?'EMPLOYMENT_R6_RUNNER_HISTORY_REPAIR_PREVIEW_V1':'EMPLOYMENT_R6_RUNNER_PIT0605_AGGREGATE_V1')
      :'EMPLOYMENT_R6_RUNNER_READONLY_REPORT_V1';
    if(!STATUS.has(body.status)||!/^[A-Z0-9_]{1,100}$/.test(body.code??'')
      ||body.kind!==resultKind
      ||body.providerCalls!==0||body.d1Writes!==0
      ||body.publicationStatus!=='NOT_REQUESTED'||body.promotionApproved!==false
      ||child.truncated||child.exitCode!==(body.status==='PASS'?0:2))stop('R6_RESULT_INVALID');
    if(request.pit0605Raw===true&&body.status!=='PASS'){
      // The child may return the existing bounded failure report; do not
      // replace the actual error with an unrelated result-kind error.
      return {status:body.status,code:safe(body.code),
       candidateExecuted:true,sqliteOpened:body.sqliteOpened===true,
       repairAuthorized:false,operationalWrites:0,providerCalls:0,d1Writes:0};
    }
    if(request.rawAggregateSourceOnly===true){
      if(body.status!=='PASS')return {status:body.status,code:safe(body.code),
        candidateExecuted:true,repairAuthorized:false,operationalWrites:0,
        providerCalls:0,d1Writes:0};
      if(body.code!=='R6_RAW_AGGREGATE_SOURCE_ONLY_NOT_PIT')
        stop('R6_RAW_AGGREGATE_RESULT_INVALID');
      const rawAggregate=projectR6RawCountAggregate(body.rawAggregate);
      return {status:'PASS',code:'R6_RAW_AGGREGATE_SOURCE_ONLY_NOT_PIT',
        actualExecutionSha:request.sourceSha,rawAggregate,
        promotionApproved:false,repairAuthorized:false,
        operationalWrites:0,providerCalls:0,d1Writes:0};
    }
    if(repairPreview){
      if(body.code!=='W04_HISTORY_REPAIR_SELECTION_PREVIEW'||body.sqliteOpened!==true)
        stop('R6_HISTORY_REPAIR_SELECTION_INVALID');
      return {status:'PASS',code:'W04_HISTORY_REPAIR_SELECTION_PREVIEW',
       actualExecutionSha:request.sourceSha,sqliteOpened:true,
       selection:projectHistoryRepairSelection(body.selection),
       promotionApproved:false,repairAuthorized:false,operationalWrites:0,providerCalls:0,d1Writes:0};
    }
    if(request.pit0605Raw===true){
      if(body.kind!=='EMPLOYMENT_R6_RUNNER_PIT0605_AGGREGATE_V1'
        ||body.status!=='PASS'||body.code!=='PIT0605_SOURCE_EVIDENCE_CLASSIFIED_NOT_PIT'
        ||body.providerCalls!==0||body.d1Writes!==0
        ||body.publicationStatus!=='NOT_REQUESTED'||body.promotionApproved!==false
        ||child.truncated||child.exitCode!==0)stop('R6_PIT0605_REPORT_INVALID');
      const aggregate=projectPit0605Aggregate(body.pit0605Aggregate);
      const retained=retainPit0605PrivateEvidence({
       outputDir,host:context.host,request,aggregate});
      return {status:'PASS',code:'R6_PIT0605_SOURCE_CLASSIFIED_NOT_TRUE_PIT',
       actualExecutionSha:request.sourceSha,sqliteOpened:true,
       pit0605Aggregate:aggregate,...retained,
       promotionApproved:false,repairAuthorized:false,
       operationalWrites:0,providerCalls:0,d1Writes:0};
    }
    if(body.kind!=='EMPLOYMENT_R6_RUNNER_READONLY_REPORT_V1')
       stop('R6_RESULT_INVALID');
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
    // The approved reader already computed this missing-reference date;
    // validate it before exposing only the bounded date (never raw rows).
    if(Array.isArray(body.indicators)&&body.indicators.some(x=>
      x?.firstMissingReferenceDate!==undefined&&(
        x.scoreStatus!=='PARTIAL_HISTORY'||
        dateOnly(x.firstMissingReferenceDate)===null||
        dateOnly(body.asOfDate)===null||
        x.firstMissingReferenceDate>body.asOfDate)))stop('R6_RESULT_INVALID');
    const indicators=Array.isArray(body.indicators)&&body.indicators.length<=29
      ?body.indicators.map(x=>({id:/^[A-Z0-9_]{1,64}$/.test(x.id??'')?x.id:null,
        rawStatus:['READY','STALE','UNAVAILABLE'].includes(x.rawStatus)?x.rawStatus:'UNAVAILABLE',
        chartStatus:['READY','PARTIAL','UNAVAILABLE'].includes(x.chartStatus)?x.chartStatus:'UNAVAILABLE',
        scoreStatus:['READY','PARTIAL_HISTORY','PARTIAL_MISSING'].includes(x.scoreStatus)?x.scoreStatus:'PARTIAL_MISSING',
        ...(x.firstMissingReferenceDate===undefined?{}:{firstMissingReferenceDate:x.firstMissingReferenceDate})})):[];
    // Optional PIT-08 metadata. Older approved bundles remain compatible.
    const sourceMeta={};
    if(body.sourceStoredAt!==undefined){
      if(!Number.isSafeInteger(body.sourceStoredAt)||body.sourceStoredAt<=0)
        stop('R6_RESULT_INVALID');
      sourceMeta.sourceStoredAt=body.sourceStoredAt;
    }
    if(body.formulaHash!==undefined){
      if(!/^sha256:[a-f0-9]{64}$/.test(body.formulaHash??''))stop('R6_RESULT_INVALID');
      sourceMeta.formulaHash=body.formulaHash;
    }
    if(body.methodologyVersion!==undefined){
      if(!/^EMP-R6-FORMULA-R[0-9]{1,2}$/.test(body.methodologyVersion??''))
        stop('R6_RESULT_INVALID');
      sourceMeta.methodologyVersion=body.methodologyVersion;
    }
    if(body.stateClaimsChart!==undefined){
      const c=body.stateClaimsChart;
      const safeDate=v=>v===null||dateOnly(v)===v;
      if(!c||!Number.isInteger(c.pointCount)||c.pointCount<0||c.pointCount>400
        ||c.unit!=='%'||typeof c.unitMatchesApproved!=='boolean'
        ||!Number.isInteger(c.gapCount)||c.gapCount<0||c.gapCount>c.pointCount
        ||!safeDate(c.firstDate)||!safeDate(c.lastDate)
        ||!safeDate(c.observationDate)
        ||(c.pointCount===0&&(c.firstDate!==null||c.lastDate!==null))
        ||(c.pointCount>0&&(!c.firstDate||!c.lastDate||c.firstDate>c.lastDate))
        ||(c.lastDate&&c.lastDate>body.asOfDate)
        ||(c.observationDate&&c.observationDate>body.asOfDate)
        ||typeof c.lastPointFinite!=='boolean'
        ||typeof c.lastPointMatchesCurrent!=='boolean'
        ||(c.pointCount===0&&(c.lastPointFinite||c.lastPointMatchesCurrent)))
        stop('R6_RESULT_INVALID');
      sourceMeta.stateClaimsChart={
        pointCount:c.pointCount,unit:c.unit,unitMatchesApproved:c.unitMatchesApproved,
        gapCount:c.gapCount,firstDate:c.firstDate,lastDate:c.lastDate,
        observationDate:c.observationDate,lastPointFinite:c.lastPointFinite,
        lastPointMatchesCurrent:c.lastPointMatchesCurrent,
      };
    }
    const summary=Object.fromEntries(SUMMARY_FIELDS.map(k=>[k,count(body.summary?.[k])]));
    const pit=Object.fromEntries(PIT_FIELDS.map(k=>[k,count(body.pit?.[k])]));
    const wantsPit04=Object.hasOwn(request,'pit04Offset');
    if(wantsPit04&&body.status==='PASS'&&body.pit04KeyReview==null)
      stop('R6_PIT04_RESULT_MISSING');
    if(!wantsPit04&&body.pit04KeyReview!=null)stop('R6_PIT04_UNREQUESTED_RESULT');
    if(request.pit0408Private!==true&&
      (body.pit04PrivateEvidenceDigest!=null||body.pit04PrivateEvidencePersisted!=null))
      stop('R6_PIT0408_UNREQUESTED_PRIVATE');
    const pit04KeyReview=wantsPit04&&body.status==='PASS'
      ?projectPit04KeyReview(body.pit04KeyReview,{
         offset:request.pit04Offset,asOfDate:body.asOfDate}):null;
    if(body.candidateConflictBreakdown!=null&&request.pit0408Private!==true)
      stop('R6_PIT0408_PRIVATE_REPORT_INVALID');
    const causeSummary=request.pit0408Private===true&&body.status==='PASS'
      ?projectPit04ConflictCauses(body.candidateConflictBreakdown,{
         expectedTotal:pit.candidateOverlapConflictingKeys}):null;
    let privateReceipt={};
    if(request.pit0408Private===true&&body.status==='PASS'){
      if(request.pit04Offset!==0||!HASH.test(body.pit04PrivateEvidenceDigest??'')
        ||body.pit04PrivateEvidencePersisted!==true||pit04KeyReview===null
        ||pit.candidateOverlapConflictingKeys===null)
        stop('R6_PIT0408_PRIVATE_REPORT_INVALID');
      privateReceipt=retainPit0408PrivateEvidence({
        outputDir,host:context.host,request,
        keyReview:{...pit04KeyReview,asOfDate:body.asOfDate},
        allSeriesConflicts:pit.candidateOverlapConflictingKeys});
      if(privateReceipt.pit04PrivateEvidenceDigest!==body.pit04PrivateEvidenceDigest)
        stop('R6_PIT0408_PRIVATE_REPORT_INVALID');
    }
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
      summary,...sourceMeta,pit,...(pit04KeyReview===null?{}:{pit04KeyReview}),...privateReceipt,
      ...(causeSummary===null?{}:{candidateConflictBreakdown:causeSummary}),
      indicators,bodyDigest:HASH.test(body.bodyDigest??'')?body.bodyDigest:null,
      walPreflight,promotionApproved:false,
      memoryTelemetry:{...child.memoryTelemetry,
        calculationPeakValid:body.status==='PASS',
        measurementPhase:body.status==='PASS'?'COMPUTATION':'PREFLIGHT_OR_EARLY_EXIT'},
      providerCalls:0,d1Writes:0,operationalWrites:0};
  }catch(error){return {status:'FAIL',code:safe(error.code),candidateExecuted:true,
    actualExecutionSha:request.sourceSha};}
}

