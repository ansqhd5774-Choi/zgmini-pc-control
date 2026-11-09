import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {WRITER_FOLLOWUP_CANDIDATE} from '../tools/controller-postswitch-approval.mjs';
import {verifyWriterFollowupBReceipts, analyzeSourceOnlyReplacementChain,
  analyzeWriterFollowupSourceCandidate, classifyWriterFollowupAObservations}
  from '../tools/controller-postswitch-evidence.mjs';
import {WRITER_CONFIG_PATH,inspectLocalWriterSourceOnly,
  main as writerReadOnlyMain}
  from '../tools/controller-postswitch-writer-readonly.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
// These three literal raw GitHub result files are intentionally pinned byte-for-
// byte: editing punctuation or final newline must break the recorded SHA256.
const pinnedRaw = [
  "{\n  \"schema\": \"ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1\",\n  \"requestId\": \"a861da80-8765-4e8c-b5a0-1824764284e2\",\n  \"status\": \"WRITER_B_INSTALLED_VERIFIED\",\n  \"code\": \"WRITER_B_INSTALL_VERIFIED\",\n  \"sourceSha\": \"4ec0b8c197627ebdb316be8df291e30d7e435784\",\n  \"mode\": \"LOCAL_OVERLAY\",\n  \"localOnly\": true,\n  \"baseHead\": \"75f73d8613550221f8e80b304d67b8b10a228e7f\",\n  \"candidateSourceSha\": \"27c02d9b254e92af21b2a5b92a4c0bb152bb5713\",\n  \"manifestSha256\": \"3452198846df9e4bb6f2299e3f4be64691ec87d4c9801121db130482c866904c\",\n  \"baseTreeOid\": \"5467892732dcaf8d4e3da7d4ddcca0358bfd25f9\",\n  \"preparedTreeOid\": \"215cfe0e32046457248cec2be68a54e42e5d4fc0\",\n  \"provenanceSha256\": \"35e6013e58c988458831928dc2949c8d4a2b15bd1b24740f26869055880bd6ab\",\n  \"runId\": \"42706312346\",\n  \"retry\": \"READ_ONLY_RECONCILE_NO_REEXECUTE\",\n  \"changedPaths\": [\n    \"scripts/pc-writer/build-asset-r10-release.mjs\"\n  ]\n}\n",
  "{\n  \"schema\": \"ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1\",\n  \"requestId\": \"b86e398c-59dd-485e-a3b1-2596fb5466d2\",\n  \"status\": \"WRITER_B_INSTALLED_VERIFIED\",\n  \"code\": \"WRITER_B_INSTALL_VERIFIED\",\n  \"sourceSha\": \"144f3b8f673cc3d18f004ddd65f6920d450f0ea6\",\n  \"mode\": \"LOCAL_OVERLAY\",\n  \"localOnly\": true,\n  \"baseHead\": \"4ec0b8c197627ebdb316be8df291e30d7e435784\",\n  \"candidateSourceSha\": \"27c02d9b254e92af21b2a5b92a4c0bb152bb5713\",\n  \"manifestSha256\": \"88c28ab0fbe7ae4683f76a94af907df5ef591623bdec37b01a670914cfa88703\",\n  \"baseTreeOid\": \"215cfe0e32046457248cec2be68a54e42e5d4fc0\",\n  \"preparedTreeOid\": \"90773b401efb20e4b099ebc8d9ba9942ed619f69\",\n  \"provenanceSha256\": \"190cf6c5b9c11ef9d9f9ec19bcf0ecd559773ff5f7dc4d3025b71da75a276adc\",\n  \"runId\": \"42709232093\",\n  \"retry\": \"READ_ONLY_RECONCILE_NO_REEXECUTE\",\n  \"changedPaths\": [\n    \"scripts/pc-writer/run-local.mjs\"\n  ]\n}\n",
  "{\n  \"schema\": \"ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1\",\n  \"requestId\": \"d9cc77ff-acb0-44e0-9f2b-1659efead888\",\n  \"status\": \"WRITER_B_INSTALLED_VERIFIED\",\n  \"code\": \"WRITER_B_INSTALL_VERIFIED\",\n  \"sourceSha\": \"48d3478030590ca63aaab2435e88c896608c70d3\",\n  \"mode\": \"LOCAL_OVERLAY\",\n  \"localOnly\": true,\n  \"baseHead\": \"144f3b8f673cc3d18f004ddd65f6920d450f0ea6\",\n  \"candidateSourceSha\": \"66cb996994dbece69f64bb2de51ef6e4c0a874de\",\n  \"manifestSha256\": \"0f0e02409e9c206f8c35e1efe7790ce1a80a3e3eb0bcf8bbf4f8931a1587a57c\",\n  \"baseTreeOid\": \"90773b401efb20e4b099ebc8d9ba9942ed619f69\",\n  \"preparedTreeOid\": \"18305f03c00112b0530fb5020fc64841ffb6a657\",\n  \"provenanceSha256\": \"e07deeb33ffc1bdc7a1d0700e6eecd845ef9fc7e0dc295e6661346fa95fd3cd9\",\n  \"runId\": \"42711838501\",\n  \"retry\": \"READ_ONLY_RECONCILE_NO_REEXECUTE\",\n  \"changedPaths\": [\n    \"scripts/pc-writer/run-local.mjs\"\n  ]\n}\n",
];
const receipts = () => WRITER_FOLLOWUP_CANDIDATE.writerB.map((expected,index)=>({
  path:expected.path,blobSha:expected.blobSha,raw:Buffer.from(pinnedRaw[index],'utf8'),
}));

test('three approved Writer B receipts match the exact raw bytes, blobs and ordered sources',()=>{
  assert.equal(verifyWriterFollowupBReceipts(receipts()),true);
  const b=WRITER_FOLLOWUP_CANDIDATE.writerB;
  assert.deepEqual(b.map(x=>x.changedPath),[
    'scripts/pc-writer/build-asset-r10-release.mjs',
    'scripts/pc-writer/run-local.mjs',
    'scripts/pc-writer/run-local.mjs',
  ]);
  assert.equal(WRITER_FOLLOWUP_CANDIDATE.configShaAnchors.at4ec,null);
  assert.equal(WRITER_FOLLOWUP_CANDIDATE.scope,
    'READONLY_SOURCE_ONLY_CANDIDATE_NOT_C_APPROVAL');
});

test('Writer B receipt drift, missing, reordered, changed raw or substituted blob fails closed',()=>{
  for(const edit of [
    list=>list.reverse(),
    list=>list.pop(),
    list=>{list[0].path='results/not-expected.json';},
    list=>{list[1].blobSha='0'.repeat(40);},
    list=>{list[2].raw=Buffer.from(list[2].raw.toString('utf8')+' ');},
    list=>{list[0].raw=Buffer.from(list[1].raw);},
  ]) {
    const rows=receipts();edit(rows);
    assert.equal(verifyWriterFollowupBReceipts(rows),false);
  }
});

const sources=['0','1','2','3','4'].map(c=>c.repeat(40));
const config=s=>Buffer.from(JSON.stringify({
  schema:'LOCAL_CONFIG',source:s,option:{enabled:true},nullable:null,
},null,2)+'\n','utf8');
const anchors=Object.fromEntries(sources.map((s,i)=>[
  s,i===2?null:digest(config(s)),
]));
const run=raw=>analyzeSourceOnlyReplacementChain(raw,{sources,anchors});

test('inverse source-only chain matches independent anchors and marks 4ec derived-only',()=>{
  const analysis=run(config(sources[4]));
  assert.equal(analysis.status,'SOURCE_ONLY_CHAIN_CANDIDATE_VERIFIED');
  assert.deepEqual(analysis.stages.map(x=>x.sourceSha),sources.slice().reverse());
  assert.deepEqual(analysis.stages.map(x=>x.evidenceLevel),[
    'PINNED_DIGEST_MATCH','PINNED_DIGEST_MATCH','DERIVED_ONLY',
    'PINNED_DIGEST_MATCH','PINNED_DIGEST_MATCH',
  ]);
  assert.equal(analysis.stages[2].configSha256,digest(config(sources[2])));
  assert.equal(analysis.intermediate4ecIndependentlyObserved,false);
  assert.equal(analysis.cApprovalAuthorized,false);
  assert.equal(analysis.liveCoreSourceVerified,false);
});

test('inverse chain rejects unrelated-byte drift, invalid source, bad anchor and bad UTF8',()=>{
  assert.equal(run(Buffer.from(config(sources[4]).toString().replace('true','false'))).status,
    'SOURCE_ONLY_CHAIN_UNVERIFIED');
  assert.equal(run(Buffer.from('{"source":"'+sources[4]+'","source":"'+sources[4]+'"}')).status,
    'SOURCE_ONLY_CHAIN_UNVERIFIED');
  assert.equal(run(Buffer.from([0xff])).status,'SOURCE_ONLY_CHAIN_UNVERIFIED');
  assert.equal(analyzeSourceOnlyReplacementChain(config(sources[4]),{
    sources,anchors:{...anchors,[sources[3]]:'f'.repeat(64)},
  }).code,'WRITER_CHAIN_CONFIG_SHA_MISMATCH');
  assert.equal(analyzeWriterFollowupSourceCandidate(null).status,
    'SOURCE_ONLY_CHAIN_UNVERIFIED');
});

test('inverse chain requires every exact source anchor and keeps 4ec derived-only',()=>{
  const missingKey={...anchors};
  delete missingKey[sources[0]];
  missingKey['f'.repeat(40)]=digest(config(sources[0]));
  assert.equal(analyzeSourceOnlyReplacementChain(config(sources[4]),{
    sources,anchors:missingKey,
  }).code,'WRITER_CHAIN_ARGUMENTS_INVALID');
  assert.equal(analyzeSourceOnlyReplacementChain(config(sources[4]),{
    sources,anchors:{...anchors,[sources[4]]:null},
  }).code,'WRITER_CHAIN_ARGUMENTS_INVALID');
  assert.equal(analyzeSourceOnlyReplacementChain(config(sources[4]),{
    sources,anchors:{...anchors,[sources[2]]:undefined},
  }).code,'WRITER_CHAIN_ARGUMENTS_INVALID');
});

const candidateStages=()=>[
  WRITER_FOLLOWUP_CANDIDATE.sourceSequence.at(-1),
  WRITER_FOLLOWUP_CANDIDATE.sourceSequence[2],
  WRITER_FOLLOWUP_CANDIDATE.sourceSequence[1],
  WRITER_FOLLOWUP_CANDIDATE.sourceSequence[0],
  '70d2d1dbd8180255133bdd7fc925ae07bb8d6cc9',
].map((sourceSha,index)=>({sourceSha,configSha256:`${index}`.repeat(64),
  evidenceLevel:index===2?'DERIVED_ONLY':'PINNED_DIGEST_MATCH'}));
const candidateAnalysis=()=>({status:'SOURCE_ONLY_CHAIN_CANDIDATE_VERIFIED',
  code:'WRITER_CHAIN_PINNED_ENDPOINTS_MATCH',stages:candidateStages(),
  intermediate4ecIndependentlyObserved:false,
  cApprovalAuthorized:false,liveCoreSourceVerified:false});

test('local Writer proof reads only the fixed Windows path and emits hashes, never config raw',()=>{
  const privateBytes=Buffer.from('{"source":"secret-string","credential":"private-token"}');
  let reads=0;
  const actual=inspectLocalWriterSourceOnly({
    readConfigRaw:file=>{assert.equal(file,WRITER_CONFIG_PATH);reads++;return privateBytes;},
    analyze:raw=>{assert.equal(raw,privateBytes);return candidateAnalysis();},
  });
  assert.equal(reads,1);
  assert.equal(actual.status,'READONLY_SOURCE_CANDIDATE_VERIFIED');
  assert.equal(actual.digestStages.length,5);
  assert.equal(actual.digestStages[2].evidenceLevel,'DERIVED_ONLY');
  assert.equal(actual.cApprovalAuthorized,false);
  assert.equal(actual.liveCoreSourceVerified,false);
  assert.equal(actual.operationalWrites,0);
  assert.equal(actual.remoteBReceiptsVerifiedHere,false);
  assert.doesNotMatch(JSON.stringify(actual),/credential|private-token|secret-string/);
});

test('local Writer proof rejects unreadable, tampered and misclassified bytes without leaking',()=>{
  const secret='secret-in-windows-config';
  const unreadable=inspectLocalWriterSourceOnly({readConfigRaw:()=>{throw Error(secret);}});
  assert.equal(unreadable.code,'WRITER_SOURCE_ONLY_LOCAL_READ_FAILED');
  assert.doesNotMatch(JSON.stringify(unreadable),/secret-in-windows-config/);
  assert.equal(inspectLocalWriterSourceOnly({readConfigRaw:()=>secret}).code,
    'WRITER_SOURCE_ONLY_RAW_NOT_BUFFER');
  assert.equal(inspectLocalWriterSourceOnly({readConfigRaw:()=>Buffer.from(secret)}).status,
    'READONLY_SOURCE_CANDIDATE_UNVERIFIED');
  for(const modify of [
    x=>{x.cApprovalAuthorized=true;},
    x=>{x.liveCoreSourceVerified=true;},
    x=>{x.intermediate4ecIndependentlyObserved=true;},
    x=>{x.stages[2].evidenceLevel='PINNED_DIGEST_MATCH';},
    x=>{x.stages[3].configSha256='bad-sha';},
    x=>{x.stages[0].sourceSha='0'.repeat(40);},
  ]){
    const analysis=candidateAnalysis();modify(analysis);
    const result=inspectLocalWriterSourceOnly({
      readConfigRaw:()=>Buffer.from(secret),analyze:()=>analysis,
    });
    assert.equal(result.status,'READONLY_SOURCE_CANDIDATE_UNVERIFIED');
    assert.equal(result.cApprovalAuthorized,false);
    assert.equal(result.operationalWrites,0);
    assert.doesNotMatch(JSON.stringify(result),/secret-in-windows-config/);
  }
});

test('local Writer CLI refuses CI/non-Windows and accepts only fixed read-only mode',()=>{
  let invoked=0;
  const inspect=()=>{invoked++;return {status:'READONLY_SOURCE_CANDIDATE_VERIFIED'};};
  const args=['--verify-local-writer-source'];
  for(const ports of [
    {platform:'linux'},
    {platform:'win32',githubActions:'true'},
    {platform:'win32',runnerName:'gh-runner'},
  ]){
    assert.equal(writerReadOnlyMain(args,{...ports,inspect}).status,
      'READONLY_SOURCE_CANDIDATE_UNVERIFIED');
  }
  assert.equal(writerReadOnlyMain([],{
    platform:'win32',inspect,githubActions:null,runnerName:null,
  }).code,'WRITER_SOURCE_ONLY_FIXED_USAGE_REQUIRED');
  assert.equal(invoked,0);
  assert.equal(writerReadOnlyMain(args,{
    platform:'win32',inspect,githubActions:null,runnerName:null,
  }).status,'READONLY_SOURCE_CANDIDATE_VERIFIED');
  assert.equal(invoked,1);
});

test('A point observations are classified without promoting source identity or live Core',()=>{
  const [,,at144,at48]=WRITER_FOLLOWUP_CANDIDATE.sourceSequence;
  const observations={
    at144:{status:'PASS',code:'WRITER_APPROVED_PREIMAGE_READONLY',
      result:{sourceHead:at144,approvedConfigSource:at144,
        checkpointSource:WRITER_FOLLOWUP_CANDIDATE.sourceSequence[1],
        sourceIdentityConsistent:false,runtimeSourceVerified:false}},
    at48Uncorroborated:{status:'STATE_UNKNOWN',
      code:'WRITER_PREIMAGE_CHECKOUT_NOT_CORROBORATED',
      result:{sourceHead:null,runtimeSourceVerified:false}},
    at48HistoricalOnly:{status:'PASS',code:'PC_SOURCE_READONLY_DIAGNOSIS',
      result:{runtimeSourceVerified:false,historicalCheckoutCandidate:{
        head:at48,trackedDirty:false}}},
  };
  const actual=classifyWriterFollowupAObservations(observations);
  assert.equal(actual.status,'A_OBSERVATIONS_CLASSIFIED_NOT_LIVE_CORE');
  assert.equal(actual.liveCoreSourceVerified,false);
  assert.equal(actual.latestPreimagePass,false);
  assert.equal(actual.cApprovalAuthorized,false);
  observations.at48Uncorroborated.status='PASS';
  assert.equal(classifyWriterFollowupAObservations(observations).status,
    'A_OBSERVATIONS_UNVERIFIED');
});

