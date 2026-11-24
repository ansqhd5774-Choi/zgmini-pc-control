import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {authorizeDolManual,performDolManual,runDolManualOnce,DOL_MANUAL_SCHEMA,DOL_MANUAL_PDF_SCHEMA,createApprovedDolManualCollectorOptions,verifyDolEta539StateReadback,DOL_ETA539_STATE_LATEST_WEEK_SQL} from './dol-manual-v1.mjs';
import {readFileSync} from 'node:fs';
import {sanitizeR6BResult} from './report.mjs';

const uid='eacb5f1c-8f44-47f4-8edb-e221a3a02e91';
const chat='72c97d22-8bc5-4c0e-9883-bc81bdb7fb2e';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fileHashes=Object.fromEntries([
 'lib/market-score/employment-r6-provider.mjs',
 'lib/market-score/employment-r6-collector.mjs',
 'lib/market-score/employment-r6-scheduler.mjs'].map((p,i)=>[p,String(i+1).repeat(64)]));
const approval={
 schema:DOL_MANUAL_SCHEMA,status:'APPROVED_B',
 scope:'EMPLOYMENT_R6_DOL_MANUAL_SQLITE_ONCE',mode:'ONE_YEAR',
 sourceRepository:'ansqhd5774-Choi/zgmini',
 installedSourceSha:'a'.repeat(40),
 sourceRoot:'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release',
 pcHome:'E:\\ZGmini\\data\\pc-writer',
 groupName:'DOL_UI_WEEKLY_CLAIMS',maxDolCalls:2,
 fileHashes,
 effects:{dolProviderCalls:true,sqliteWrites:true,rawSnapshotReadback:true,
  blsProviderCalls:false,d1Writes:false,taskWrites:false,sourceWrites:false},
};
function fixture(manifest=approval,changes={}){
 const approvalBytes=Buffer.from(JSON.stringify(manifest));
 const request={schema:'ZGMINI_R6_REGISTERED_DATA_B_REQUEST_V1',
  requestId:uid,chatId:chat,operation:'employment-r6-registered-data-once',
  approvalManifestSha256:sha(approvalBytes)};
 const event={action:'opened',
  repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
  sender:{login:'ansqhd5774-Choi'},
  issue:{title:'pc-employment-r6-registered-data-once',
   user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
   number:42,body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'b'.repeat(40)};
 return {event:{...event,...changes.event},env:{...env,...changes.env},
  approvalBytes,request};
}
test('manual DOL V1 exact owner, hashes and no BLS, D1, task effects',()=>{
 const input=fixture(),auth=authorizeDolManual(input);
 assert.equal(auth.approval.mode,'ONE_YEAR');
 assert.equal(auth.approval.maxDolCalls,2);
 assert.equal(Object.keys(auth.approval.fileHashes).length,3);
 for(const tweak of [
  a=>{a.groupName='BLS_JOLTS';},
  a=>{a.maxDolCalls=3;},
  a=>{a.effects.d1Writes=true;},
  a=>{a.effects.blsProviderCalls=true;},
  a=>{a.effects.taskWrites=true;},
  a=>{a.fileHashes['scripts/pc-writer/local-cycle.mjs']='b'.repeat(64);},
  a=>{a.installedSourceSha='NOT_SHA';},
  a=>{a.mode='RELEASE';},
 ]) {
  const bad=structuredClone(approval);tweak(bad);
  assert.throws(()=>authorizeDolManual(fixture(bad)),/R6_DOL_(SCOPE|FILE_SCOPE|EFFECT_SCOPE)_STOP/);
 }
 assert.throws(()=>authorizeDolManual(fixture(approval,{env:{GITHUB_RUN_ATTEMPT:'2'}})),
  /R6_DOL_OWNER_EVENT_STOP/);
 const badHash=fixture();badHash.approvalBytes=Buffer.from('{"fake":true}');
 assert.throws(()=>authorizeDolManual(badHash),/R6_DOL_APPROVAL_HASH_STOP/);
});
function inject({sourceError=null,runError=null,releaseFails=false}={}){
 const calls=[],lock={held:()=>true,release:()=>{calls.push('UNLOCK');return !releaseFails;}};
 return {calls,verify:()=>{calls.push('VERIFY');if(sourceError)throw sourceError;},
  acquire:async()=>{calls.push('LOCK');return lock;},
  claim:()=>calls.push('CLAIM'),
  run:async()=>{calls.push('RUN');if(runError)throw runError;
   return {status:'PARTIAL',code:'R6_DOL_MANUAL_PARTIAL',
    providerRequests:2,blsRequests:0,dolRequests:2,
    groupResults:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'PARTIAL',
     providerRequests:2,failureCode:'DOL_NATIONAL_SERIES_INCOMPLETE'}],
    sqlite:'COLLECTOR_RECORDED',publication:'NOT_ATTEMPTED',
    nationalSeriesSaved:3,nationalRowsSaved:3,stateRowsSaved:51};},
 };
}
test('one-shot manual DOL runs after exact source and durable claim, then unlocks',async()=>{
 const input=fixture(),auth=authorizeDolManual(input);
 const o=inject(),r=await performDolManual({auth,...o});
 assert.deepEqual(o.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
 assert.equal(r.status,'PARTIAL');
 assert.equal(r.lastPass,'COLLECT_READBACK');
 assert.equal(r.providerRequests,2);
 assert.equal(r.nationalSeriesSaved,3);
});
test('preflight source mismatch prevents claim, DB and provider; no retry',async()=>{
 const auth=authorizeDolManual(fixture());
 const o=inject({sourceError:Object.assign(Error('source'),{code:'R6_B_INSTALLED_SOURCE_STOP'})});
 const r=await performDolManual({auth,...o});
 assert.deepEqual(o.calls,['VERIFY']);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.firstFail,'PREFLIGHT');
});
test('after claim failure remains STATE_UNKNOWN, not a fake collection success',async()=>{
 const auth=authorizeDolManual(fixture());
 const o=inject({runError:Object.assign(Error('fault'),{code:'R6_DOL_READBACK_INVALID'})});
 const r=await performDolManual({auth,...o});
 assert.deepEqual(o.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R6_DOL_READBACK_INVALID');
});
test('lock ownership uncertainty preserves lock and never asserts success',async()=>{
 const auth=authorizeDolManual(fixture());
 const o=inject({releaseFails:true});
 const r=await performDolManual({auth,...o});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R6_DOL_LOCK_RELEASE_UNVERIFIED');
});
test('sanitized manual 3-of-4 output retains only bounded counts, no raw',()=>{
 const {request}=fixture();
 const input={
  status:'PARTIAL',code:'R6_DOL_MANUAL_PARTIAL',requestId:uid,
  sourceSha:'a'.repeat(40),mode:'ONE_YEAR',providerRequests:2,
  blsRequests:0,dolRequests:2,
  groupResults:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'PARTIAL',
   providerRequests:2,failureCode:'DOL_NATIONAL_SERIES_INCOMPLETE'}],
  sqlite:'COLLECTOR_RECORDED',publication:'NOT_ATTEMPTED',
  sourceStoredAt:null,sourceFeatures:null,chartReadyFeatures:null,
  nationalSeriesSaved:3,nationalRowsSaved:3,stateRowsSaved:51,
  providerBody:'NO_PRIVATE_DATA_IN_REPORT',
  lastPass:'COLLECT_READBACK',firstFail:null,
 };
 const env={GITHUB_RUN_ID:'43800000000',R6_B_EFFECT_OUTCOME:'success'};
 const out=sanitizeR6BResult(input,request,env);
 assert.equal(out.status,'PARTIAL');
 assert.equal(out.nationalSeriesSaved,3);
 assert.equal(out.stateRowsSaved,51);
 assert.equal(out.publication,'NOT_ATTEMPTED');
 assert.doesNotMatch(JSON.stringify(out),/NO_PRIVATE_DATA_IN_REPORT|providerBody/);
 for(const change of [
  {...input,blsRequests:1},
  {...input,providerRequests:3},
  {...input,groupResults:[]},
  {...input,publication:'VERIFIED'},
  {...input,nationalSeriesSaved:8},
  {...input,code:'R6_B_PARTIAL_PUBLISH_VERIFIED'},
 ])assert.equal(sanitizeR6BResult(change,request,env).status,'STATE_UNKNOWN');
 const badEnv={...env,R6_B_EFFECT_OUTCOME:'failure'};
 assert.equal(sanitizeR6BResult(input,request,badEnv).status,'STATE_UNKNOWN');
});

test('the manual module never imports the top-level awaiting operation entrypoint',async()=>{
 const source=readFileSync(new URL('./dol-manual-v1.mjs',import.meta.url),'utf8');
 assert.equal(source.includes("from './operation.mjs'"),false);
 const input=fixture(),o=inject();
 const done=await runDolManualOnce({...input,...o});
 assert.equal(done.status,'PARTIAL');
 assert.deepEqual(o.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
});

test('missing sealed adapters cannot execute a provider request',async()=>{
 const auth=authorizeDolManual(fixture());
 await assert.rejects(
  performDolManual({auth}),
  e=>e.code==='R6_DOL_ADAPTER_MISSING');
});

test('unexpected post-claim failures report bounded stage without leaking exception text',async()=>{
 const auth=authorizeDolManual(fixture());
 for(const stage of ['MODULE_LOAD','LOCAL_RUNTIME_SETUP','COLLECTOR_EXECUTION',
  'SQLITE_READBACK','CLEANUP']){
  const o=inject();
  const result=await performDolManual({...o,auth,
   run:async({onStage})=>{onStage(stage);
    throw new TypeError('PRIVATE_PROVIDER_BODY_LOCAL_PATH_MUST_NOT_LEAK');}});
  assert.deepEqual(o.calls,['VERIFY','LOCK','CLAIM','UNLOCK']);
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.code,`R6_DOL_${stage}_STOP`);
  assert.equal(result.lastPass,'ONE_SHOT_CLAIMED');
  assert.equal(result.firstFail,'COLLECT_OR_PUBLISH');
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_PROVIDER_BODY_LOCAL_PATH/);
 }
});

test('generic pre-claim failure stays BLOCKED without claiming or retrying',async()=>{
 const auth=authorizeDolManual(fixture());
 const o=inject();
 const result=await performDolManual({...o,auth,
  verify:()=>{o.calls.push('VERIFY');throw new TypeError('UNSAFE_SOURCE_PATH');}});
 assert.deepEqual(o.calls,['VERIFY']);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R6_DOL_PREFLIGHT_STOP');
 assert.equal(result.firstFail,'PREFLIGHT');
 assert.doesNotMatch(JSON.stringify(result),/UNSAFE_SOURCE_PATH/);
});

test('sealed DOL B authorization supplies manual intent only for scoped ONE_YEAR collection',()=>{
 const auth=authorizeDolManual(fixture());
 const fetchImpl=async()=>{};
 const db={prepare(){}};
 const options=createApprovedDolManualCollectorOptions({auth,db,fetchImpl});
 assert.equal(options.executionIntent,'AUTHORIZED_MANUAL');
 assert.equal(options.mode,'ONE_YEAR');
 assert.deepEqual(options.groups,['DOL_UI_WEEKLY_CLAIMS']);
 assert.equal(options.db,db);
 assert.equal(options.fetchImpl,fetchImpl);
 assert.equal(options.manualApprovalEvidence.requestId,auth.request.requestId);
 assert.equal(options.manualApprovalEvidence.approvalManifestSha256,auth.request.approvalManifestSha256);
 assert.equal(options.manualApprovalEvidence.maxDolCalls,2);
 assert.deepEqual(Object.keys(options.manualApprovalEvidence).sort(),[
  'approvalManifestSha256','groupName','maxDolCalls','mode','requestId','schema','scope','status',
 ].sort());
 for(const changed of [
  {approval:{...auth.approval,groupName:'BLS_JOLTS'}},
  {approval:{...auth.approval,maxDolCalls:3}},
  {request:{...auth.request,requestId:'bad'}},
  {request:{...auth.request,approvalManifestSha256:'bad'}},
 ]) assert.throws(()=>createApprovedDolManualCollectorOptions({auth:{...auth,...changed},db,fetchImpl}),
  /R6_DOL_MANUAL_INTENT_STOP/);
});

const pdfFiles=[
 'lib/market-score/employment-r6-dol-advance-pdf-candidate.mjs',
 'lib/market-score/employment-r6-dol-advance-store-candidate.mjs',
 'lib/market-score/employment-r6-dol-pdf-raw-envelope.mjs',
 'lib/market-score/employment-r6-dol-eta538-provider.mjs',
 'lib/market-score/employment-r6-dol-advance-row-readback.mjs',
 'lib/market-score/employment-r6-dol-release-text.mjs',
];
function approvedPdfV2(){
 return {...structuredClone(approval),
  schema:DOL_MANUAL_PDF_SCHEMA,
  fileHashes:{...fileHashes,...Object.fromEntries(pdfFiles.map((p,i)=>[p,String(i+4).repeat(64)]))},
  effects:{...approval.effects,eta538PdfGet:true},
  pdfArchive:{
   releaseDate:'2026-11-19',releaseAt:'2026-11-19T13:30:00.000Z',
   expectedInitialWeekEnd:'2026-11-14',
   originalPdfSha256:'a11a33cbd30081e869f2cad4cc4a6ccb6b19feeb20731d233ef83d29d15995ec',
  },
 };
}
test('W04 ETA538 V2 extends same existing DOL one-shot only with exact pinned archive',()=>{
 const auth=authorizeDolManual(fixture(approvedPdfV2()));
 assert.equal(auth.approval.schema,DOL_MANUAL_PDF_SCHEMA);
 assert.equal(auth.approval.maxDolCalls,2);
 assert.equal(Object.keys(auth.approval.fileHashes).length,9);
 assert.equal(auth.approval.effects.blsProviderCalls,false);
 assert.equal(auth.approval.effects.d1Writes,false);
 assert.equal(auth.approval.effects.eta538PdfGet,true);
 const factory=()=>({fetchGroup:async()=>({})});
 const options=createApprovedDolManualCollectorOptions({auth,db:{prepare(){}},
  fetchImpl:async()=>{},providerFactory:factory});
 assert.equal(options.providerFactory,factory);
 assert.equal(options.executionIntent,'AUTHORIZED_MANUAL');
 assert.equal(options.mode,'ONE_YEAR');
 assert.deepEqual(options.groups,['DOL_UI_WEEKLY_CLAIMS']);
 assert.equal(options.manualApprovalEvidence.maxDolCalls,2);
 assert.throws(()=>createApprovedDolManualCollectorOptions({auth,db:{prepare(){}},
  fetchImpl:async()=>{}}),/R6_DOL_PDF_FACTORY_MISSING/);
});
test('W04 V2 wrong source/date/effect/file hashes reject before the PC lock or provider',()=>{
 const changes=[
  [x=>{x.pdfArchive.originalPdfSha256='not-hash'},'R6_DOL_PDF_SOURCE_PIN_STOP'],
  [x=>{x.pdfArchive.releaseDate='2026-11-20'},'R6_DOL_PDF_SOURCE_PIN_STOP'],
  [x=>{x.pdfArchive.releaseAt='2030-11-19T13:30:00.000Z'},'R6_DOL_PDF_SOURCE_PIN_STOP'],
  [x=>{x.pdfArchive.expectedInitialWeekEnd='invalid'},'R6_DOL_PDF_SOURCE_PIN_STOP'],
  [x=>{x.effects.eta538PdfGet=false},'R6_DOL_EFFECT_SCOPE_STOP'],
  [x=>{x.effects.blsProviderCalls=true},'R6_DOL_EFFECT_SCOPE_STOP'],
  [x=>{x.effects.d1Writes=true},'R6_DOL_EFFECT_SCOPE_STOP'],
  [x=>{delete x.fileHashes[pdfFiles[0]]},'R6_DOL_FILE_SCOPE_STOP'],
  [x=>{x.fileHashes['scripts/pc-writer/arbitrary.mjs']='b'.repeat(64)},'R6_DOL_FILE_SCOPE_STOP'],
  [x=>{x.maxDolCalls=3},'R6_DOL_SCOPE_STOP'],
 ];
 for(const [change,reason] of changes){
  const variant=approvedPdfV2();change(variant);
  assert.throws(()=>authorizeDolManual(fixture(variant)),
   error=>error?.message===reason,reason);
 }
 const bad=structuredClone(approval);bad.effects.eta538PdfGet=true;
 assert.throws(()=>authorizeDolManual(fixture(bad)),/R6_DOL_EFFECT_SCOPE_STOP/);
});
test('W04 V2 reuses same preflight, Core lock and durable one-shot claim order',async()=>{
 const auth=authorizeDolManual(fixture(approvedPdfV2())),o=inject();
 const verify=options=>{
  o.calls.push('VERIFY');
  assert.equal(options.pdfApproved,true);
  assert.equal(options.overlay.files.length,9);
  assert.deepEqual(new Set(options.overlay.files.map(x=>x.path)),
    new Set([...Object.keys(fileHashes),...pdfFiles]));
 };
 const result=await performDolManual({auth,...o,verify});
 assert.deepEqual(o.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.publication,'NOT_ATTEMPTED');
 assert.equal(result.dolRequests,2);
});
test('W04 legacy V1 still verifies only 3 files and has no PDF providerFactory',async()=>{
 const auth=authorizeDolManual(fixture()),o=inject();
 const verify=options=>{
  o.calls.push('VERIFY');
  assert.equal(options.pdfApproved,false);
  assert.equal(options.overlay.files.length,3);
 };
 await performDolManual({auth,...o,verify});
 assert.deepEqual(o.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
 const options=createApprovedDolManualCollectorOptions({auth,providerFactory:()=>({})});
 assert.equal(Object.hasOwn(options,'providerFactory'),false);
});
test('W04 Controller B event dispatcher accepts only the existing manual workflow V1/V2',()=>{
 const source=readFileSync(new URL('./operation.mjs',import.meta.url),'utf8');
 assert.ok(source.includes("'ZGMINI_R6_DOL_MANUAL_B_APPROVAL_V2'"));
 assert.ok(source.includes('pdfApproved===true'));
 assert.ok(source.includes('verifyInstalledR6DolManualOverlay'));
});

test('W04 PDF V2 succeeds with exactly 51 distinct areas on latest stored ETA539 week',()=>{
  const success={pdfMode:true,collectorStatus:'SUCCESS',latestWeek:'2026-11-14'};
  for(const stateRows of [0,1,49,50,52,NaN,null,undefined,51.5]){
    assert.throws(()=>verifyDolEta539StateReadback({
      ...success,stateRows,stateGeographies:51,
    }),e=>e?.code==='R6_DOL_ETA539_STATE_READBACK_INVALID');
  }
  for(const geo of [0,50,52,NaN,null,undefined]){
    assert.throws(()=>verifyDolEta539StateReadback({
      ...success,stateRows:51,stateGeographies:geo,
    }),e=>e?.code==='R6_DOL_ETA539_STATE_READBACK_INVALID');
  }
  assert.throws(()=>verifyDolEta539StateReadback({
    pdfMode:true,collectorStatus:'SUCCESS',stateRows:51,stateGeographies:51,
    latestWeek:null,
  }),e=>e?.code==='R6_DOL_ETA539_STATE_READBACK_INVALID');
  assert.equal(verifyDolEta539StateReadback({
    ...success,stateRows:51,stateGeographies:51,
  }),true);
});

test('W04 ETA539 readback selects only newest complete 51-area week from 112-week current history',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec(`CREATE TABLE market_score_employment_r4_shadow_current_v1 (
      provider TEXT,geography_type TEXT,logical_series_id TEXT,
      geography_code TEXT,observation_date TEXT,retrieved_at TEXT
    )`);
    const insert=db.prepare(`INSERT INTO market_score_employment_r4_shadow_current_v1
      (provider,geography_type,logical_series_id,geography_code,observation_date,retrieved_at)
      VALUES('DOL_ETA','STATE','STATE_INITIAL_CLAIMS',?,?,?)`);
    const start='2026-11-25T00:00:00.000Z';
    db.exec('BEGIN');
    for(let week=0;week<112;week++){
      const date=new Date(Date.UTC(2024,0,6+week*7)).toISOString().slice(0,10);
      for(let geo=0;geo<51;geo++)insert.run('S'+String(geo).padStart(2,'0'),date,start);
    }
    db.exec('COMMIT');
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM
      market_score_employment_r4_shadow_current_v1`).get().n,112*51);
    const row=db.prepare(DOL_ETA539_STATE_LATEST_WEEK_SQL).get(start);
    assert.deepEqual({n:row.n,geographies:row.geographies},
      {n:51,geographies:51});
    assert.equal(verifyDolEta539StateReadback({
      pdfMode:true,collectorStatus:'SUCCESS',
      stateRows:row.n,stateGeographies:row.geographies,latestWeek:row.latest_week,
    }),true);
    db.prepare(`DELETE FROM market_score_employment_r4_shadow_current_v1
      WHERE observation_date=? AND geography_code='S50'`).run(row.latest_week);
    const missing=db.prepare(DOL_ETA539_STATE_LATEST_WEEK_SQL).get(start);
    assert.equal(missing.n,50);
    assert.throws(()=>verifyDolEta539StateReadback({
      pdfMode:true,collectorStatus:'SUCCESS',
      stateRows:missing.n,stateGeographies:missing.geographies,latestWeek:missing.latest_week,
    }),e=>e?.code==='R6_DOL_ETA539_STATE_READBACK_INVALID');
    db.prepare(`INSERT INTO market_score_employment_r4_shadow_current_v1
      (provider,geography_type,logical_series_id,geography_code,observation_date,retrieved_at)
      VALUES('DOL_ETA','STATE','STATE_INITIAL_CLAIMS','S00',?,?)`)
      .run(row.latest_week,start);
    const duplicate=db.prepare(DOL_ETA539_STATE_LATEST_WEEK_SQL).get(start);
    assert.equal(duplicate.n,51);
    assert.equal(duplicate.geographies,50);
    assert.throws(()=>verifyDolEta539StateReadback({
      pdfMode:true,collectorStatus:'SUCCESS',
      stateRows:duplicate.n,stateGeographies:duplicate.geographies,latestWeek:duplicate.latest_week,
    }),e=>e?.code==='R6_DOL_ETA539_STATE_READBACK_INVALID');
  }finally{db.close();}
});

test('W04 V1 and incomplete V2 preserve existing partial reporting',()=>{
 for(const pdfMode of [false,true]){
  for(const collectorStatus of ['PARTIAL','FAIL','NOOP']){
   assert.equal(verifyDolEta539StateReadback({
    pdfMode,collectorStatus,stateRows:0,
   }),true);
  }
 }
 assert.equal(verifyDolEta539StateReadback({
  pdfMode:false,collectorStatus:'SUCCESS',stateRows:0,
 }),true);
});
