import {test} from 'node:test';
import {validateRequest} from '../controller/common.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {validateBundle,inspectEmploymentR6Candidate,projectPit04KeyReview} from '../controller/employment-r6-candidate-readonly.mjs';

const ENTRY='scripts/pc-writer/employment-r6-runner-stage.mjs';
const SHA='a'.repeat(40);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fakeR6=`import fs from 'node:fs';import path from 'node:path';
const args=process.argv.slice(2);const get=k=>args[args.indexOf(k)+1];
const out=get('--output-dir');
const result={kind:'EMPLOYMENT_R6_RUNNER_READONLY_REPORT_V1',status:'PASS',
  code:'EMPLOYMENT_R6_READONLY_STAGE_COMPLETED',sqliteOpened:true,asOfDate:'2026-11-02',
  providerCalls:0,d1Writes:0,promotionApproved:false,publicationStatus:'NOT_REQUESTED',
  summary:{sourceFeatures:1,UNTRUSTED_RAW:'PRIVATE_VALUE'},
  pit:{coreCurrentKeys:27,coreCurrentKeysMissingHistory:4,
    rawSnapshotMetadataKeys:6,rawSnapshotCertifiedKeys:4,
    coreCurrentRawLineageVerifiedKeys:20,coreCurrentRawLineageMissingSnapshotKeys:2,
    coreCurrentRawLineageConflictingKeys:3,coreCurrentRawLineageUnverifiedKeys:2,
    coreHistoryRawLineageTotalRows:30,coreHistoryRawLineageVerifiedRows:23,
    coreHistoryRawLineageMissingSnapshotRows:4,coreHistoryRawLineageConflictingRows:1,
    coreHistoryRawLineageUnverifiedRows:2,
    rawLineageEvidenceStatus:'HOLD_INCOMPLETE_SOURCE_LINEAGE',
    rawBody:'PRIVATE_PROVIDER_RAW_BODY_MUST_NOT_LEAK',
    coreCurrentHistoryMatchingKeys:20,coreCurrentHistoryConflictingKeys:2,
    coreCurrentHistoryUnverifiedKeys:1,coreCurrentHistoryMissingKeys:4,
    coreHistoryAsOfUniqueKeys:123,coreHistoryPriorRevisionKeys:9,
    coreHistoryPriorRevisionRows:11,coreHistoryAmbiguousLatestKeys:2,
    coreHistorySameInstantAdditionalRows:3,candidateHistoryAsOfUniqueKeys:42,
    candidateHistoryPriorRevisionKeys:5,candidateHistoryPriorRevisionRows:7,
    candidateHistoryAmbiguousLatestKeys:1,candidateHistorySameInstantAdditionalRows:4,
    sensitiveHistorySourceHash:'SECRET_DO_NOT_LEAK'},
  indicators:Array.from({length:29},(_,i)=>({id:'FEATURE_'+i,rawStatus:'READY',
   chartStatus:'READY',scoreStatus:'READY'})),
  bodyDigest:'b'.repeat(64),walPreflight:{coreWalMode:true}};
fs.writeFileSync(path.join(out,'EMPLOYMENT_R6_RUNNER_fixture.json'),JSON.stringify(result));
`;

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'r6-controller-draft-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const dataRoot=path.join(root,'data'),workspace=path.join(root,'workspace');
  const core=path.join(dataRoot,'pc-writer','storage','core.sqlite');
  const candidate=path.join(root,'isolated','EMPLOYMENT_R6_CANDIDATE.sqlite');
  const bundle=path.join(root,'bundle'),script=path.join(bundle,'source',ENTRY);
  fs.mkdirSync(path.dirname(core),{recursive:true});fs.mkdirSync(path.dirname(candidate),{recursive:true});
  fs.mkdirSync(path.dirname(script),{recursive:true});fs.mkdirSync(workspace);
  fs.writeFileSync(core,'synthetic-core');fs.writeFileSync(candidate,'synthetic-candidate');
  fs.writeFileSync(script,fakeR6);
  const files={[ENTRY]:hash(Buffer.from(fakeR6))};
  const manifestBytes=Buffer.from(JSON.stringify({files},null,2)+'\n');
  fs.writeFileSync(path.join(bundle,'manifest.json'),manifestBytes);
  const host={dataRoot,employmentR6CandidatePath:candidate,
    approvedSources:{[SHA]:{root:bundle,branch:'codex/employment-1y-reader-r1',entrypoint:ENTRY,
      manifestSha256:hash(manifestBytes)}}};
  const request={sourceSha:SHA,sourceBranch:'codex/employment-1y-reader-r1'};
  return {root,workspace,host,request,core,candidate,script};
}

test('PIT-08 optional read-only timestamp and chart geometry pass without private raw fields',async t=>{
  const f=fixture(t);
  const source=fs.readFileSync(f.script,'utf8').replace(
    "  bodyDigest:'b'.repeat(64),walPreflight:{coreWalMode:true}};",
    "  sourceStoredAt:1793500000000,formulaHash:'sha256:'+'f'.repeat(64),"+
    "methodologyVersion:'EMP-R6-FORMULA-R1',"+
    "stateClaimsChart:{pointCount:52,unit:'%',unitMatchesApproved:true,gapCount:1,firstDate:'2025-11-07',"+
    "lastDate:'2026-10-30',observationDate:'2026-10-30',"+
    "lastPointFinite:true,lastPointMatchesCurrent:true},"+
    "bodyDigest:'b'.repeat(64),walPreflight:{coreWalMode:true}};"
  );
  assert.match(source,/sourceStoredAt:1793500000000/);
  fs.writeFileSync(f.script,source);
  const dir=f.host.approvedSources[SHA].root;
  const manifestBytes=Buffer.from(JSON.stringify({files:{[ENTRY]:hash(Buffer.from(source))}},null,2)+'\n');
  fs.writeFileSync(path.join(dir,'manifest.json'),manifestBytes);
  f.host.approvedSources[SHA].manifestSha256=hash(manifestBytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'PASS',JSON.stringify(result));
  assert.equal(result.sourceStoredAt,1793500000000);
  assert.equal(result.methodologyVersion,'EMP-R6-FORMULA-R1');
  assert.match(result.formulaHash,/^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result.stateClaimsChart,{
    pointCount:52,unit:'%',unitMatchesApproved:true,gapCount:1,firstDate:'2025-11-07',lastDate:'2026-10-30',
    observationDate:'2026-10-30',lastPointFinite:true,lastPointMatchesCurrent:true,
  });
  assert.ok(!JSON.stringify(result).includes('PRIVATE_PROVIDER_RAW_BODY_MUST_NOT_LEAK'));
});

test('PIT-08 chart metadata rejects invalid date without adding a legacy gate',async t=>{
  const f=fixture(t);
  const source=fs.readFileSync(f.script,'utf8').replace(
    "  bodyDigest:'b'.repeat(64),walPreflight:{coreWalMode:true}};",
    "  stateClaimsChart:{pointCount:52,unit:'%',unitMatchesApproved:true,gapCount:1,firstDate:'2025-11-07',"+
    "lastDate:'NOT_A_DATE',observationDate:'2026-10-30',"+
    "lastPointFinite:true,lastPointMatchesCurrent:true},"+
    "bodyDigest:'b'.repeat(64),walPreflight:{coreWalMode:true}};"
  );
  fs.writeFileSync(f.script,source);
  const dir=f.host.approvedSources[SHA].root;
  const bytes=Buffer.from(JSON.stringify({files:{[ENTRY]:hash(Buffer.from(source))}},null,2)+'\n');
  fs.writeFileSync(path.join(dir,'manifest.json'),bytes);
  f.host.approvedSources[SHA].manifestSha256=hash(bytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'FAIL');
  assert.equal(result.code,'R6_RESULT_INVALID');
});

test('optional missing-reference date passes only for partial score and never returns raw rows',async t=>{
  const cases=[
    {status:'PARTIAL_HISTORY',date:'2026-10-01',ok:true},
    {status:'PARTIAL_HISTORY',date:'2026-11-31',ok:false},
    {status:'PARTIAL_HISTORY',date:'2026-11-03',ok:false},
    {status:'READY',date:'2026-10-01',ok:false},
  ];
  const output="fs.writeFileSync(path.join(out,'EMPLOYMENT_R6_RUNNER_fixture.json'),JSON.stringify(result));";
  for(const item of cases){
    const f=fixture(t);
    const injected="result.indicators[0].scoreStatus="+JSON.stringify(item.status)+";"+
      "result.indicators[0].firstMissingReferenceDate="+JSON.stringify(item.date)+";\n"+output;
    const current=fs.readFileSync(f.script,'utf8');
    assert.equal(current.includes(output),true);
    const source=current.replace(output,injected);
    fs.writeFileSync(f.script,source);
    const root=f.host.approvedSources[SHA].root;
    const bytes=Buffer.from(JSON.stringify({files:{[ENTRY]:hash(Buffer.from(source))}},null,2)+'\n');
    fs.writeFileSync(path.join(root,'manifest.json'),bytes);
    f.host.approvedSources[SHA].manifestSha256=hash(bytes);
    const result=await inspectEmploymentR6Candidate(f.request,f);
    if(item.ok){
      assert.equal(result.status,'PASS');
      assert.equal(result.indicators[0].scoreStatus,'PARTIAL_HISTORY');
      assert.equal(result.indicators[0].firstMissingReferenceDate,item.date);
      assert.equal(Object.hasOwn(result.indicators[1],'firstMissingReferenceDate'),false);
      assert.doesNotMatch(JSON.stringify(result),/PRIVATE_PROVIDER_RAW_BODY_MUST_NOT_LEAK|SECRET_DO_NOT_LEAK/);
      assert.equal(result.operationalWrites,0);
    }else{
      assert.equal(result.status,'FAIL');
      assert.equal(result.code,'R6_RESULT_INVALID');
    }
  }
});

test('source, host, manifest and immutable path checks reject unapproved inputs',t=>{
  const f=fixture(t);
  assert.doesNotThrow(()=>validateBundle(f.request,f));
  assert.throws(()=>validateBundle({...f.request,sourceSha:'c'.repeat(40)},f),
    /R6_BUNDLE_NOT_APPROVED/);
  assert.throws(()=>validateBundle({...f.request,sourceBranch:'main'},f),
    /R6_BUNDLE_NOT_APPROVED/);
  f.host.employmentR6CandidatePath=f.core;
  assert.throws(()=>validateBundle(f.request,f),/R6_HOST_CANDIDATE_NOT_APPROVED/);
});

test('approved fixture runs in workspace and output projection does not leak raw fields',async t=>{
  const f=fixture(t);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'PASS');
  assert.equal(result.actualExecutionSha,SHA);
  assert.equal(result.asOfDate,'2026-11-02');
  assert.equal(result.sqliteOpened,true);
  assert.equal(result.summary.sourceFeatures,1);
  assert.deepEqual([
    result.pit.coreCurrentHistoryMatchingKeys,
    result.pit.coreCurrentHistoryConflictingKeys,
    result.pit.coreCurrentHistoryUnverifiedKeys,
    result.pit.coreCurrentHistoryMissingKeys,
  ],[20,2,1,4]);
  assert.deepEqual({
    coreUnique:result.pit.coreHistoryAsOfUniqueKeys,
    corePriorKeys:result.pit.coreHistoryPriorRevisionKeys,
    corePriorRows:result.pit.coreHistoryPriorRevisionRows,
    coreAmbiguous:result.pit.coreHistoryAmbiguousLatestKeys,
    coreSameInstant:result.pit.coreHistorySameInstantAdditionalRows,
    candidateUnique:result.pit.candidateHistoryAsOfUniqueKeys,
    candidatePriorKeys:result.pit.candidateHistoryPriorRevisionKeys,
    candidatePriorRows:result.pit.candidateHistoryPriorRevisionRows,
    candidateAmbiguous:result.pit.candidateHistoryAmbiguousLatestKeys,
    candidateSameInstant:result.pit.candidateHistorySameInstantAdditionalRows,
  },{coreUnique:123,corePriorKeys:9,corePriorRows:11,coreAmbiguous:2,
    coreSameInstant:3,candidateUnique:42,candidatePriorKeys:5,
    candidatePriorRows:7,candidateAmbiguous:1,candidateSameInstant:4});
  assert.equal(Object.hasOwn(result.pit,'sensitiveHistorySourceHash'),false);
  assert.equal(Object.hasOwn(result.summary,'UNTRUSTED_RAW'),false);
  assert.equal(result.providerCalls,0);assert.equal(result.d1Writes,0);
  assert.equal(result.promotionApproved,false);
  assert.equal(result.memoryTelemetry?.kind,'SYSTEM_RAM_SAMPLED_DURING_R6_CHILD_V1');
  assert.equal(result.memoryTelemetry?.calculationPeakValid,true);
  assert.equal(result.memoryTelemetry?.measurementPhase,'COMPUTATION');
  assert.ok(result.memoryTelemetry?.samples>=2);
  assert.ok(result.memoryTelemetry?.peakSystemUsedMiB>=0);
  assert.equal(fs.readFileSync(f.core,'utf8'),'synthetic-core');
  assert.equal(fs.readFileSync(f.candidate,'utf8'),'synthetic-candidate');
  assert.equal(JSON.stringify(result).includes('PRIVATE_VALUE'),false);
});

test('W04 raw attestations expose only fixed release groups, months and count triples',async t=>{
  const f=fixture(t);
  const inject=body=>{
    fs.writeFileSync(f.script,body);
    const approved=f.host.approvedSources[SHA];
    const files={[ENTRY]:hash(Buffer.from(body))};
    const bytes=Buffer.from(JSON.stringify({files})+'\n');
    fs.writeFileSync(path.join(approved.root,'manifest.json'),bytes);
    approved.manifestSha256=hash(bytes);
  };
  const original="rawSnapshotMetadataKeys:6,rawSnapshotCertifiedKeys:4,";
  const extended=original+[
    "rawSnapshotInvalidBodyKeys:1,rawSnapshotValidWithoutRunKeys:1,",
    "rawSnapshotByGroup:[{releaseGroup:'BLS_BED',metadataKeys:6,bodyVerifiedKeys:5,runCertifiedKeys:4}],",
    "rawSnapshotByMonth:[{retrievalMonth:'2026-11',metadataKeys:6,bodyVerifiedKeys:5,runCertifiedKeys:4}],",
  ].join('\n');
  assert.ok(fakeR6.includes(original));
  inject(fakeR6.replace(original,extended));
  const pass=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(pass.status,'PASS',JSON.stringify(pass));
  assert.deepEqual(pass.pit.rawSnapshotByGroup,[{
    releaseGroup:'BLS_BED',metadataKeys:6,bodyVerifiedKeys:5,runCertifiedKeys:4,
  }]);
  assert.deepEqual(pass.pit.rawSnapshotByMonth,[{
    retrievalMonth:'2026-11',metadataKeys:6,bodyVerifiedKeys:5,runCertifiedKeys:4,
  }]);
  assert.equal(pass.pit.rawSnapshotInvalidBodyKeys,1);
  assert.equal(pass.pit.rawSnapshotValidWithoutRunKeys,1);
  assert.doesNotMatch(JSON.stringify(pass),/PRIVATE_PROVIDER_RAW_BODY_MUST_NOT_LEAK/);

  // An immutable child attempting to leak a source ID, exact timestamp, or
  // inconsistent count must not claim a valid A-grade PASS.
  const wrong=[
    extended.replace("releaseGroup:'BLS_BED'","releaseGroup:'PRIVATE_SOURCE_ID'"),
    extended.replace("retrievalMonth:'2026-11'","retrievalMonth:'2026-11-17T09:00:00.000Z'"),
    extended.replace("rawSnapshotValidWithoutRunKeys:1","rawSnapshotValidWithoutRunKeys:2"),
  ];
  for(const replacement of wrong){
    inject(fakeR6.replace(original,replacement));
    const invalid=await inspectEmploymentR6Candidate(f.request,{...f,
      workspace:fs.mkdtempSync(path.join(f.root,'workspace-attest-'))});
    assert.equal(invalid.status,'FAIL');
    assert.equal(invalid.code,'R6_RESULT_INVALID');
    assert.doesNotMatch(JSON.stringify(invalid),/PRIVATE_SOURCE_ID|PRIVATE_PROVIDER_RAW_BODY/);
  }
});

test('early WAL block cannot be misreported as peak calculation memory',async t=>{
  const f=fixture(t);
  const blocked=fakeR6.replace("status:'PASS'","status:'BLOCKED'")
    .replace("code:'EMPLOYMENT_R6_READONLY_STAGE_COMPLETED'","code:'WAL_SIDECAR_NOT_READY'")
    + '\nprocess.exitCode=2;\n';
  fs.writeFileSync(f.script,blocked);
  const files={[ENTRY]:hash(Buffer.from(blocked))};
  const bytes=Buffer.from(JSON.stringify({files})+'\n');
  const approved=f.host.approvedSources[SHA];
  fs.writeFileSync(path.join(approved.root,'manifest.json'),bytes);
  approved.manifestSha256=hash(bytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'WAL_SIDECAR_NOT_READY');
  assert.equal(result.memoryTelemetry?.calculationPeakValid,false);
  assert.equal(result.memoryTelemetry?.measurementPhase,'PREFLIGHT_OR_EARLY_EXIT');
});

test('hash drift BLOCKED before executing synthetic child',async t=>{
  const f=fixture(t);fs.appendFileSync(f.script,'\n// source changed');
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'R6_SOURCE_HASH_DRIFT');
  assert.equal(result.candidateExecuted,false);
});

test('manifest byte drift BLOCKED even if parsed JSON is semantically identical',async t=>{
  const f=fixture(t);
  const file=path.join(f.host.approvedSources[SHA].root,'manifest.json');
  const before=fs.readFileSync(file,'utf8');
  fs.writeFileSync(file,'  '+before);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'R6_MANIFEST_DRIFT');
  assert.equal(result.candidateExecuted,undefined);
});

test('an approved child cannot claim PASS without all 29 validated public statuses',async t=>{
  const f=fixture(t);
  const changed=fs.readFileSync(f.script,'utf8')
    .replace('fs.writeFileSync(path.join(out,', 'result.indicators=[];fs.writeFileSync(path.join(out,');
  fs.writeFileSync(f.script,changed);
  const files={[ENTRY]:hash(Buffer.from(changed))};
  const bytes=Buffer.from(JSON.stringify({files})+'\n');
  const approved=f.host.approvedSources[SHA];
  fs.writeFileSync(path.join(approved.root,'manifest.json'),bytes);
  approved.manifestSha256=hash(bytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'FAIL');
  assert.equal(result.code,'R6_RESULT_INVALID');
  assert.equal(result.actualExecutionSha,SHA);
  assert.equal(JSON.stringify(result).includes('PRIVATE_VALUE'),false);
});
test('new History-only counts reject negative, non-integer, and raw source fields',async t=>{
  const f=fixture(t);
  const content=fs.readFileSync(f.script,'utf8').replace(
    "candidateHistoryPriorRevisionRows:7,",
    "candidateHistoryPriorRevisionRows:-1,")
    .replace("coreHistoryPriorRevisionRows:11,","coreHistoryPriorRevisionRows:1.2,")
    .replace("candidateHistoryAmbiguousLatestKeys:1,","candidateHistoryAmbiguousLatestKeys:'SECRET_DO_NOT_LEAK',");
  fs.writeFileSync(f.script,content);
  const files={[ENTRY]:hash(Buffer.from(content))};
  const manifestBytes=Buffer.from(JSON.stringify({files})+'\n');
  const approved=f.host.approvedSources[SHA];
  fs.writeFileSync(path.join(approved.root,'manifest.json'),manifestBytes);
  approved.manifestSha256=hash(manifestBytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'PASS');
  assert.equal(result.pit.coreHistoryPriorRevisionRows,null);
  assert.equal(result.pit.candidateHistoryPriorRevisionRows,null);
  assert.equal(result.pit.candidateHistoryAmbiguousLatestKeys,null);
  assert.equal(result.pit.coreHistoryPriorRevisionKeys,9);
  assert.equal(result.pit.candidateHistorySameInstantAdditionalRows,4);
  assert.equal(JSON.stringify(result).includes('SECRET_DO_NOT_LEAK'),false);
  assert.equal(result.providerCalls,0);
  assert.equal(result.operationalWrites,0);
  assert.equal(fs.readFileSync(f.core,'utf8'),'synthetic-core');
  assert.equal(fs.readFileSync(f.candidate,'utf8'),'synthetic-candidate');
});
test('History count as-of date fails closed on impossible calendar dates',async t=>{
  const f=fixture(t);
  const content=fs.readFileSync(f.script,'utf8')
    .replace("asOfDate:'2026-11-02'","asOfDate:'2026-13-52'");
  fs.writeFileSync(f.script,content);
  const files={[ENTRY]:hash(Buffer.from(content))};
  const bytes=Buffer.from(JSON.stringify({files})+'\n');
  fs.writeFileSync(path.join(f.host.approvedSources[SHA].root,'manifest.json'),bytes);
  f.host.approvedSources[SHA].manifestSha256=hash(bytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'PASS');
  assert.equal(result.asOfDate,null);
  assert.equal(result.pit.coreHistoryAsOfUniqueKeys,123);
  assert.equal(result.providerCalls,0);
  assert.equal(result.d1Writes,0);
  assert.equal(result.operationalWrites,0);
});

test('PIT-04-03 count projection fails closed for unsafe counts or raw fields',async t=>{
  const f=fixture(t);
  const content=fs.readFileSync(f.script,'utf8')
    .replace('coreCurrentHistoryMatchingKeys:20','coreCurrentHistoryMatchingKeys:-1')
    .replace('coreCurrentHistoryConflictingKeys:2','coreCurrentHistoryConflictingKeys:2.5')
    .replace('coreCurrentHistoryUnverifiedKeys:1','coreCurrentHistoryUnverifiedKeys:"PRIVATE_RAW"')
    .replace('coreCurrentHistoryMissingKeys:4','coreCurrentHistoryMissingKeys:Number.MAX_SAFE_INTEGER+1');
  fs.writeFileSync(f.script,content);
  const files={[ENTRY]:hash(Buffer.from(content))};
  const manifestBytes=Buffer.from(JSON.stringify({files})+'\n');
  fs.writeFileSync(path.join(f.host.approvedSources[SHA].root,'manifest.json'),manifestBytes);
  f.host.approvedSources[SHA].manifestSha256=hash(manifestBytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'PASS');
  assert.deepEqual([
    result.pit.coreCurrentHistoryMatchingKeys,
    result.pit.coreCurrentHistoryConflictingKeys,
    result.pit.coreCurrentHistoryUnverifiedKeys,
    result.pit.coreCurrentHistoryMissingKeys,
  ],[null,null,null,null]);
  assert.equal(result.promotionApproved,false);
  assert.equal(result.providerCalls,0);
  assert.equal(result.operationalWrites,0);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_RAW|source_hash|rawValue/);
});

test('PIT-04-03 rejects a PASS when four valid buckets do not sum to Core CURRENT',async t=>{
  const f=fixture(t);
  const changed=fs.readFileSync(f.script,'utf8')
    .replace('coreCurrentHistoryMatchingKeys:20','coreCurrentHistoryMatchingKeys:21');
  fs.writeFileSync(f.script,changed);
  const approved=f.host.approvedSources[SHA];
  const files={[ENTRY]:hash(Buffer.from(changed))};
  const manifestBytes=Buffer.from(JSON.stringify({files})+'\n');
  fs.writeFileSync(path.join(approved.root,'manifest.json'),manifestBytes);
  approved.manifestSha256=hash(manifestBytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'FAIL');
  assert.equal(result.code,'R6_RESULT_INVALID');
  assert.equal(result.actualExecutionSha,SHA);
  assert.equal(JSON.stringify(result).includes('PRIVATE_VALUE'),false);
  assert.equal(fs.readFileSync(f.core,'utf8'),'synthetic-core');
  assert.equal(fs.readFileSync(f.candidate,'utf8'),'synthetic-candidate');
});

test('PIT-04-03 rejects missing-history disagreement even when four buckets sum',async t=>{
  const f=fixture(t);
  const changed=fs.readFileSync(f.script,'utf8')
    .replace('coreCurrentKeysMissingHistory:4','coreCurrentKeysMissingHistory:5');
  fs.writeFileSync(f.script,changed);
  const approved=f.host.approvedSources[SHA];
  const files={[ENTRY]:hash(Buffer.from(changed))};
  const manifestBytes=Buffer.from(JSON.stringify({files})+'\n');
  fs.writeFileSync(path.join(approved.root,'manifest.json'),manifestBytes);
  approved.manifestSha256=hash(manifestBytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'FAIL');
  assert.equal(result.code,'R6_RESULT_INVALID');
  assert.equal(result.actualExecutionSha,SHA);
  assert.equal(fs.readFileSync(f.core,'utf8'),'synthetic-core');
  assert.equal(fs.readFileSync(f.candidate,'utf8'),'synthetic-candidate');
});


test('PIT-04-05 fixed sanitized lineage count fields are projected without any raw response',async t=>{
  const f=fixture(t);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'PASS');
  assert.deepEqual([
    result.pit.rawSnapshotMetadataKeys,result.pit.rawSnapshotCertifiedKeys,
    result.pit.coreCurrentRawLineageVerifiedKeys,
    result.pit.coreCurrentRawLineageMissingSnapshotKeys,
    result.pit.coreCurrentRawLineageConflictingKeys,
    result.pit.coreCurrentRawLineageUnverifiedKeys,
    result.pit.coreHistoryRawLineageTotalRows,
    result.pit.coreHistoryRawLineageVerifiedRows,
    result.pit.coreHistoryRawLineageMissingSnapshotRows,
    result.pit.coreHistoryRawLineageConflictingRows,
    result.pit.coreHistoryRawLineageUnverifiedRows,
  ],[6,4,20,2,3,2,30,23,4,1,2]);
  assert.equal(result.pit.rawLineageEvidenceStatus,'HOLD_INCOMPLETE_SOURCE_LINEAGE');
  assert.equal(result.promotionApproved,false);
  assert.equal(result.providerCalls,0);
  assert.equal(result.d1Writes,0);
  assert.equal(result.operationalWrites,0);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_PROVIDER_RAW_BODY_MUST_NOT_LEAK|rawBody|responseHash|source_hash/);
});

async function runWithChangedPit(t,oldText,newText){
  const f=fixture(t);
  const raw=fs.readFileSync(f.script,'utf8');
  assert.ok(raw.includes(oldText));
  const changed=raw.replace(oldText,newText);
  fs.writeFileSync(f.script,changed);
  const files={[ENTRY]:hash(Buffer.from(changed))};
  const bytes=Buffer.from(JSON.stringify({files})+'\n');
  fs.writeFileSync(path.join(f.host.approvedSources[SHA].root,'manifest.json'),bytes);
  f.host.approvedSources[SHA].manifestSha256=hash(bytes);
  return await inspectEmploymentR6Candidate(f.request,f);
}

test('PIT-04-05 malformed count or inconsistent Core partition cannot become PASS evidence',async t=>{
  const invalid=await runWithChangedPit(t,
    'coreCurrentRawLineageMissingSnapshotKeys:2,',
    'coreCurrentRawLineageMissingSnapshotKeys:20,');
  assert.equal(invalid.status,'FAIL');
  assert.equal(invalid.code,'R6_RESULT_INVALID');
  assert.equal(invalid.actualExecutionSha,SHA);
  assert.equal(invalid.operationalWrites,undefined);
});

test('PIT-04-05 incomplete nonzero lineage cannot become PASS even when other fields match',async t=>{
  const invalid=await runWithChangedPit(t,
    'coreHistoryRawLineageVerifiedRows:23,',
    "coreHistoryRawLineageVerifiedRows:'SECRET_DO_NOT_EMIT',");
  assert.equal(invalid.status,'FAIL');
  assert.equal(invalid.code,'R6_RESULT_INVALID');
  assert.doesNotMatch(JSON.stringify(invalid),/SECRET_DO_NOT_EMIT/);
});

test('PIT-04-05 Core History mismatch and over-certified snapshots fail closed',async t=>{
  const inconsistent=await runWithChangedPit(t,
    'coreHistoryRawLineageVerifiedRows:23,',
    'coreHistoryRawLineageVerifiedRows:24,');
  assert.equal(inconsistent.status,'FAIL');
  assert.equal(inconsistent.code,'R6_RESULT_INVALID');
  const overCertified=await runWithChangedPit(t,
    'rawSnapshotCertifiedKeys:4,','rawSnapshotCertifiedKeys:7,');
  assert.equal(overCertified.status,'FAIL');
  assert.equal(overCertified.code,'R6_RESULT_INVALID');
});

test('PIT-04-05 invalid status cannot forge lineage readiness or promote a candidate',async t=>{
  const r=await runWithChangedPit(t,
    "rawLineageEvidenceStatus:'HOLD_INCOMPLETE_SOURCE_LINEAGE',",
    "rawLineageEvidenceStatus:'PRIVATE_RESPONSE_SHOULD_NOT_LEAK',");
  assert.equal(r.status,'PASS');
  assert.equal(r.pit.rawLineageEvidenceStatus,'NO_RUNTIME_EVIDENCE');
  assert.equal(r.promotionApproved,false);
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_RESPONSE_SHOULD_NOT_LEAK/);
});

const PIT04_FILE='lib/market-score/employment-r6-pit04-key-evidence.mjs';
const PIT04_READER='scripts/pc-writer/employment-r6-pit-coverage.mjs';
const pit04Fixture=()=>({
 kind:'EMPLOYMENT_R6_PIT0408_KEY_REVIEW_SOURCE_ONLY_V1',
 status:'HOLD_KEY_CLASSIFICATION_NOT_RAW_PIT_ATTESTATION',
 counts:{coreKeys:27,coreHistoryMissing:4,coreHistoryConflict:0,
  coreHistoryAmbiguous:0,candidateOverlapConflicts:1,
  missingCandidateInternalMatch:3,missingCandidateIncomplete:1,
  missingWithoutCandidate:0,duplicateCurrentKeys:0},
 evidenceTotal:1,offset:0,pageSize:8,evidenceTruncated:false,nextOffset:null,
 evidence:[{logicalSeriesId:'STATE_INITIAL_CLAIMS',geographyCode:'AK',
  observationDate:'2026-10-31',reason:'CANDIDATE_CURRENT_CONFLICT',
  coreHistoryMissing:true,candidateCurrentConflict:true,
  rawPitAttested:false,repairAuthorized:false,
  source_hash:'SENSITIVE_HASH_MUST_NOT_LEAK',value:1234}],
 rawPitAttested:false,promotionApproved:false,repairAuthorized:false,
 rawPrivate:{path:'SENSITIVE_PC_PATH_MUST_NOT_LEAK'},
});
function sealPit04Fixture(f,review=pit04Fixture(),{includeReview=true,includeReader=true}={}){
 const original=fs.readFileSync(f.script,'utf8');
 const start="fs.writeFileSync(path.join(out,'EMPLOYMENT_R6_RUNNER_fixture.json'),JSON.stringify(result));";
 assert.ok(original.includes(start));
 const code=original.replace(start,(
  includeReview?'result.pit04KeyReview='+JSON.stringify(review)+';\n':''
 )+start);
 fs.writeFileSync(f.script,code);
 const files={[ENTRY]:hash(Buffer.from(code))};
 const add=(name,value)=>{
  const target=path.join(f.root,'bundle','source',name);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,value);
  files[name]=hash(Buffer.from(value));
 };
 add(PIT04_FILE,'// approved source-only fixture');
 if(includeReader)add(PIT04_READER,'// approved snapshot-reader fixture');
 const raw=Buffer.from(JSON.stringify({files})+'\n');
 fs.writeFileSync(path.join(f.root,'bundle','manifest.json'),raw);
 f.host.approvedSources[SHA].manifestSha256=hash(raw);
}
test('PIT-04-08 schema accepts only optional bounded offset on existing R6 A',()=>{
 const policy={sourceRepository:'ansqhd5774-Choi/zgmini',operations:{
  'employment-r6-candidate-stage-readonly':{},'runner-smoke':{}}};
 const req={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-00000000-0000-4000-8000-000000000001',
  chatId:'chat_1234',operation:'employment-r6-candidate-stage-readonly',
  sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'codex/employment-1y-reader-r1',sourceSha:SHA};
 assert.doesNotThrow(()=>validateRequest(req,policy));
 assert.equal(validateRequest({...req,pit04Offset:8},policy).pit04Offset,8);
 for(const value of [-1,50001,1.5,'8',null,Infinity]){
  assert.throws(()=>validateRequest({...req,pit04Offset:value},policy),/PIT04_OFFSET_INVALID/);
 }
 assert.throws(()=>validateRequest({...req,operation:'runner-smoke',pit04Offset:0},policy),
  /REQUEST_FIELDS/);
 assert.throws(()=>validateRequest({...req,pit04Offset:0,sql:'SELECT *'},policy),
  /REQUEST_FIELDS/);
});
test('PIT-04-08 Controller fail-closes on missing approved classifier or reader bytes',t=>{
 const f=fixture(t);
 assert.throws(()=>validateBundle({...f.request,pit04Offset:0},f),
  /R6_PIT04_SOURCE_NOT_APPROVED/);
 sealPit04Fixture(f,pit04Fixture(),{includeReader:false});
 assert.throws(()=>validateBundle({...f.request,pit04Offset:0},f),
  /R6_PIT04_SOURCE_NOT_APPROVED/);
 sealPit04Fixture(f);
 assert.doesNotThrow(()=>validateBundle({...f.request,pit04Offset:0},f));
 assert.throws(()=>validateBundle({...f.request,pit04Offset:50001},f),
  /R6_PIT04_OFFSET_INVALID/);
});
test('PIT-04-08 paginated result passes fixed request and strips extra raw fields',async t=>{
 const f=fixture(t);sealPit04Fixture(f);
 const r=await inspectEmploymentR6Candidate({...f.request,pit04Offset:0},f);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 assert.equal(r.pit04KeyReview.evidence[0].geographyCode,'AK');
 assert.equal(r.pit04KeyReview.pageSize,8);
 assert.equal(r.pit04KeyReview.nextOffset,null);
 assert.equal(r.pit04KeyReview.rawPitAttested,false);
 assert.equal(r.promotionApproved,false);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.providerCalls,0);
 assert.equal(r.d1Writes,0);
 assert.doesNotMatch(JSON.stringify(r),/SENSITIVE_HASH_MUST_NOT_LEAK|SENSITIVE_PC_PATH_MUST_NOT_LEAK|source_hash/);
 assert.equal(fs.readFileSync(f.core,'utf8'),'synthetic-core');
 assert.equal(fs.readFileSync(f.candidate,'utf8'),'synthetic-candidate');
});
test('PIT-04-08 bad page and unrequested result are rejected at Controller boundary',async t=>{
 const variants=[
  {change:p=>({...p,offset:8}),code:'R6_PIT04_RESULT_INVALID',requested:true},
  {change:p=>({...p,nextOffset:8}),code:'R6_PIT04_RESULT_INVALID',requested:true},
  {change:p=>({...p,evidence:[{...p.evidence[0],geographyCode:'ZZ'}]}),
   code:'R6_PIT04_RESULT_INVALID',requested:true},
  {change:p=>({...p,counts:{...p.counts,missingCandidateIncomplete:0}}),
   code:'R6_PIT04_RESULT_INVALID',requested:true},
  {change:p=>p,code:'R6_PIT04_UNREQUESTED_RESULT',requested:false},
 ];
 for(const [index,v] of variants.entries()){
  const f=fixture(t);sealPit04Fixture(f,v.change(pit04Fixture()));
  const request=v.requested?{...f.request,pit04Offset:0}:f.request;
  const r=await inspectEmploymentR6Candidate(request,f);
  assert.equal(r.status,'FAIL',`variant ${index}:`+JSON.stringify(r));
  assert.equal(r.code,v.code);
  assert.doesNotMatch(JSON.stringify(r),/SENSITIVE_HASH_MUST_NOT_LEAK|SENSITIVE_PC_PATH_MUST_NOT_LEAK/);
 }
});
test('PIT-04-08 direct projection rejects forged region and offset, never publishes',()=>{
 const p=pit04Fixture();
 const good=projectPit04KeyReview(p,{offset:0,asOfDate:'2026-11-02'});
 assert.equal(good.promotionApproved,false);
 assert.equal(good.evidence.length,1);
 assert.doesNotMatch(JSON.stringify(good),/source_hash|value|rawPrivate/);
 assert.throws(()=>projectPit04KeyReview(p,{offset:8,asOfDate:'2026-11-02'}),/R6_PIT04_RESULT_INVALID/);
 assert.throws(()=>projectPit04KeyReview({...p,evidence:[{...p.evidence[0],observationDate:'2026-11-01'}]},
  {offset:0,asOfDate:'2026-11-02'}),/R6_PIT04_RESULT_INVALID/);
});
