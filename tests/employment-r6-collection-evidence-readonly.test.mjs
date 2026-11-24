import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {inspectEmploymentR6CollectionEvidence,R6_READONLY_STAGES,auditStoredEta538PdfRawLinkage} from '../controller/employment-r6-collection-evidence-readonly.mjs';

const STATES=['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zg-r6-evidence-'));
 const data=path.join(root,'ZGmini','data');
 const storage=path.join(data,'pc-writer','storage');
 fs.mkdirSync(storage,{recursive:true});
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return {data,storage,file:path.join(storage,'core.sqlite')};
}
function createDb(file){
 const db=new DatabaseSync(file);
 db.exec(`CREATE TABLE market_score_employment_r4_shadow_runs_v1(
  provider TEXT,status TEXT,completed_at TEXT,provider_requests INTEGER,collected_rows INTEGER,
  inserted_count INTEGER,revised_count INTEGER,rejected_count INTEGER,failure_code TEXT,detail_json TEXT);
 CREATE TABLE market_score_employment_r6_raw_snapshot_v1(
  request_key TEXT,release_group TEXT,chunk_index INTEGER,retrieved_at TEXT,chunk_count INTEGER,
  http_status INTEGER,detail_json TEXT,body_chunk TEXT);
 CREATE TABLE market_score_employment_r4_shadow_current_v1(
  logical_series_id TEXT,geography_type TEXT,geography_code TEXT,observation_date TEXT,value REAL);
 CREATE INDEX r6_current_date ON market_score_employment_r4_shadow_current_v1(logical_series_id,observation_date DESC);`);
 return db;
}
function seed(db,{weeks=56,missingLastCode=null,startDate='2025-01-04'}={}){
 const d=`${startDate}T00:00:00.000Z`;
 const insert=db.prepare(`INSERT INTO market_score_employment_r4_shadow_current_v1
  (logical_series_id,geography_type,geography_code,observation_date,value) VALUES(?,?,?,?,?)`);
 db.exec('BEGIN');
 try{
  for(let i=0;i<weeks;i++){
   const week=new Date(Date.parse(d)+i*7*86400000).toISOString().slice(0,10);
   for(const code of STATES){if(i===weeks-1&&code===missingLastCode)continue;
    insert.run('STATE_INITIAL_CLAIMS','STATE',code,week,100);
   }
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 db.prepare(`INSERT INTO market_score_employment_r4_shadow_runs_v1 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
  'EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS','PARTIAL','2026-11-09T02:11:00.000Z',2,2800,2799,0,1,'SERIES_PARTIAL',
  JSON.stringify({mode:'BACKFILL',missingSeries:['STATE_INITIAL_CLAIMS'],
   latestInitialClaimsObservationDate:'2026-11-05',privateToken:'SECRET_DO_NOT_OUTPUT'}));
 db.prepare(`INSERT INTO market_score_employment_r4_shadow_runs_v1 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
  'EMPLOYMENT_R6_BLS_BED','PARTIAL','2026-11-09T02:11:10.000Z',4,380,379,0,1,'SERIES_PARTIAL',
  JSON.stringify({mode:'BACKFILL',missingSeries:['BDS0000000000','TOKEN_SECRET'],privateToken:'SECRET_DO_NOT_OUTPUT'}));
 db.prepare(`INSERT INTO market_score_employment_r6_raw_snapshot_v1 VALUES(?,?,?,?,?,?,?,?)`).run(
  'DOL_ETA539:600w','DOL_UI_WEEKLY_CLAIMS',0,'2026-11-09T02:10:00.000Z',3,200,
  JSON.stringify({parserMeta:{coreCount:51,selectedWeeks:['2025-07-19','2025-07-26'],latestCompleteWeek:'2025-07-26'},historyWeeks:600,secret:'SECRET_DO_NOT_OUTPUT'}),
  'PRIVATE_RAW_BODY_SHOULD_NOT_LEAK');
}

test('read-only summaries preserve SQLite bytes and hide raw bodies/tokens',t=>{
 const {data,storage,file}=fixture(t),db=createDb(file);seed(db);db.close();
 const beforeHash=sha(file),beforeFiles=fs.readdirSync(storage).sort();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 assert.equal(r.code,'R6_DOL_BED_STORED_EVIDENCE_READONLY');
 assert.equal(r.dol.BACKFILL.failureCode,'SERIES_PARTIAL');
 assert.deepEqual(r.dol.BACKFILL.knownMissingSeries,['STATE_INITIAL_CLAIMS']);
 assert.equal(r.bed.BACKFILL.missingSeriesCount,2);
 assert.deepEqual(r.bed.BACKFILL.knownMissingSeries,['BDS0000000000']);
 assert.equal(r.eta539[0].selectedWeeks,2);
 assert.equal(r.eta539[0].firstSelectedWeek,'2025-07-19');
 assert.equal(r.stateClaims.complete51Weeks,56);
 assert.equal(r.stateClaims.fullTenYearRawCoverage.status,'INSUFFICIENT_RAW_WEEKS');
 assert.equal(r.stateClaims.strict52WeekCandidateCount,1);
 assert.equal(r.stateClaims.latestStrict52WeekCandidate,new Date(Date.parse('2025-01-04T00:00:00.000Z')+55*7*86400000).toISOString().slice(0,10));
 assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);assert.equal(r.operationalWrites,0);
 assert.equal(sha(file),beforeHash);
 assert.deepEqual(fs.readdirSync(storage).sort(),beforeFiles);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_RAW_BODY|SECRET_DO_NOT_OUTPUT|TOKEN_SECRET|body_chunk|detail_json/i);
 assert.ok(Buffer.byteLength(JSON.stringify(r))<32768);
});

test('deployed R6 BACKFILL 530-week ETA539 snapshot is discovered without writes',t=>{
 const {data,storage,file}=fixture(t),db=createDb(file);seed(db);
 db.prepare(`UPDATE market_score_employment_r6_raw_snapshot_v1
  SET request_key='DOL_ETA539:530w',
      detail_json=json_set(detail_json,'$.historyWeeks',530)
  WHERE request_key='DOL_ETA539:600w'`).run();
 db.close();
 const beforeHash=sha(file),beforeFiles=fs.readdirSync(storage).sort();
 const result=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(result.status,'PASS');
 assert.equal(result.eta539[0].mode,'BACKFILL');
 assert.equal(result.eta539[0].historyWeeks,530);
 assert.equal(result.eta539[0].selectedWeeks,2);
 assert.equal(result.eta539[0].latestCompleteWeek,'2025-07-26');
 assert.equal(result.providerCalls,0);
 assert.equal(result.operationalWrites,0);
 assert.equal(sha(file),beforeHash);
 assert.deepEqual(fs.readdirSync(storage).sort(),beforeFiles);
});

test('51-region missing week prevents claiming strict 52-week coverage',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db,{missingLastCode:'WY'});db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.incompleteWeeks,1);
 assert.equal(r.stateClaims.strict52WeekCandidateCount,0);
 assert.equal(r.stateClaims.firstWindowBreak.reason,'REGION_51_COVERAGE_GAP');
 assert.equal(r.stateClaims.latestWindowBreak.reason,'REGION_51_COVERAGE_GAP');
 assert.equal(r.stateClaims.recentIncompleteWeeks[0].regions,50);
});

test('unrecognized region does not pass merely because 51 rows exist',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);
 const last=new Date(Date.parse('2025-01-04T00:00:00.000Z')+55*7*86400000).toISOString().slice(0,10);
 db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 SET geography_code='ZZ' WHERE observation_date=? AND geography_code='WY'").run(last);
 db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.recentIncompleteWeeks[0].rows,51);
 assert.equal(r.stateClaims.recentIncompleteWeeks[0].regions,51);
 assert.equal(r.stateClaims.recentIncompleteWeeks[0].unknownCodes,1);
 assert.equal(r.stateClaims.strict52WeekCandidateCount,0);
});

test('one zero weekly value is valid when the prior four-week sum remains positive',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);
 const zeroWeek='2025-01-04';
 db.prepare(`UPDATE market_score_employment_r4_shadow_current_v1 SET value=0
  WHERE observation_date=? AND geography_code='WY'`).run(zeroWeek);
 db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.strict52WeekCandidateCount,1);
 assert.equal(r.stateClaims.firstWindowBreak,null);
});

test('an entire zero prior four-week state base prevents a valid score',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);
 db.prepare(`UPDATE market_score_employment_r4_shadow_current_v1 SET value=0
  WHERE geography_code='WY' AND observation_date IN
   ('2025-01-04','2025-01-11','2025-01-18','2025-01-25')`).run();
 db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.strict52WeekCandidateCount,0);
 assert.equal(r.stateClaims.firstWindowBreak?.reason,'PRIOR_4W_ZERO_BASE');
});

test('W04 PIT-04-07 NULL in a prior 4-week state base is not silently ignored by SQLite SUM',t=>{
 const {data,storage,file}=fixture(t),db=createDb(file);
 seed(db);
 db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 SET value=NULL WHERE geography_code='WY' AND observation_date='2025-01-04'").run();
 db.close();
 const beforeHash=sha(file),beforeFiles=fs.readdirSync(storage).sort();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 assert.equal(r.stateClaims.sampledWeeks,56);
 assert.equal(r.stateClaims.complete51Weeks,55);
 assert.equal(r.stateClaims.incompleteWeeks,1);
 assert.equal(r.stateClaims.recentIncompleteWeeks[0].invalidValues,1);
 assert.equal(r.stateClaims.strict52WeekCandidateCount,0);
 assert.equal(r.stateClaims.firstWindowBreak?.reason,'STATE_CLAIMS_VALUE_INVALID');
 assert.equal(r.stateClaims.latestStrict52WeekCandidate,null);
 assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);assert.equal(r.operationalWrites,0);
 assert.equal(sha(file),beforeHash);assert.deepEqual(fs.readdirSync(storage).sort(),beforeFiles);
});

test('W04 PIT-04-07 invalid state claim counts cannot certify 51-state or 10y raw windows',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:577,startDate:'2015-10-17'});
 db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 SET value=NULL WHERE geography_code='WY' AND observation_date='2026-10-31'").run();
 db.close();
 const before=sha(file),r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.sampledWeeks,577);
 assert.equal(r.stateClaims.fullTenYearRawCoverage.status,'STATE_CLAIMS_VALUE_INVALID');
 assert.equal(r.stateClaims.fullTenYearRawCoverage.firstFailureWeek,'2026-10-31');
 assert.equal(r.stateClaims.latestStrict52WeekCandidate,'2026-10-24');
 assert.equal(r.stateClaims.incompleteWeeks,1);
 assert.equal(sha(file),before);
 const cases=[-1,1.5,'not-a-count'];
 for(const value of cases){
  const writing=new DatabaseSync(file);
  writing.prepare("UPDATE market_score_employment_r4_shadow_current_v1 SET value=? WHERE geography_code='WY' AND observation_date='2026-10-31'").run(value);
  writing.close();
  const checked=inspectEmploymentR6CollectionEvidence(data);
  assert.equal(checked.stateClaims.fullTenYearRawCoverage.status,'STATE_CLAIMS_VALUE_INVALID',String(value));
  assert.equal(checked.stateClaims.incompleteWeeks,1,String(value));
 }
});

test('530 complete weeks cannot satisfy 10-year claims coverage without older stored rows',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:530,startDate:'2015-10-17'});db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.sampledWeeks,530);
 assert.equal(r.stateClaims.fullTenYearRawCoverage.status,'INSUFFICIENT_RAW_WEEKS');
 assert.equal(r.stateClaims.fullTenYearRawCoverage.requiredRawWeeks,577);
 assert.equal(r.stateClaims.fullTenYearRawCoverage.requiredRows,29427);
});

test('577 complete, consecutive weeks satisfy raw preconditions without claiming a score',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:577,startDate:'2015-10-17'});db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.sampledWeeks,577);
 assert.equal(r.stateClaims.fullTenYearRawCoverage.status,'RAW_PRECONDITIONS_COMPLETE');
 assert.equal(r.stateClaims.fullTenYearRawCoverage.referenceWeeks,521);
 assert.equal(r.stateClaims.fullTenYearRawCoverage.latestRequiredWeek,'2026-10-31');
 assert.equal(r.stateClaims.fullTenYearRawCoverage.firstRequiredWeek,'2015-10-17');
 assert.equal(r.providerCalls,0);
 assert.equal(r.d1Writes,0);
});

test('missing one state in 577 weeks rejects ten-year raw coverage',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:577,startDate:'2015-10-17',missingLastCode:'WY'});db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.fullTenYearRawCoverage.status,'REGION_51_COVERAGE_GAP');
 assert.equal(r.stateClaims.fullTenYearRawCoverage.firstFailureWeek,'2026-10-31');
 assert.deepEqual(r.stateClaims.fullTenYearRawCoverage.missingRegionCodes,['WY']);
});

test('a whole missing calendar week rejects apparent 577-week count',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:578,startDate:'2015-10-10'});
 db.prepare("DELETE FROM market_score_employment_r4_shadow_current_v1 WHERE observation_date='2016-03-05'").run();db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.fullTenYearRawCoverage.status,'NONCONSECUTIVE_10Y_WEEKS');
 assert.equal(r.stateClaims.fullTenYearRawCoverage.firstFailureWeek,'2016-03-05');
});


test('576 stored weeks identify the first absent calendar week exactly',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:577,startDate:'2015-10-17'});
 db.prepare("DELETE FROM market_score_employment_r4_shadow_current_v1 WHERE observation_date='2016-03-05'").run();
 db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 const raw=r.stateClaims.fullTenYearRawCoverage;
 assert.equal(r.status,'PASS');
 assert.equal(raw.observedRawWeeks,576);
 assert.equal(raw.status,'INSUFFICIENT_RAW_WEEKS');
 assert.equal(raw.firstFailureWeek,'2016-03-05');
 assert.equal(raw.missingRegionCodes,undefined);
 assert.equal(r.operationalWrites,0);
});

test('unknown ZZ geography cannot cover a missing approved WY jurisdiction',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:577,startDate:'2015-10-17'});
 db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 SET geography_code='ZZ' WHERE geography_code='WY' AND observation_date='2026-10-31'").run();
 db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 const raw=r.stateClaims.fullTenYearRawCoverage;
 assert.equal(r.status,'PASS');
 assert.equal(raw.status,'REGION_51_COVERAGE_GAP');
 assert.equal(raw.firstFailureWeek,'2026-10-31');
 assert.deepEqual(raw.missingRegionCodes,['WY']);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_RAW_BODY|TOKEN_SECRET/i);
 assert.equal(r.providerCalls,0);
 assert.equal(r.operationalWrites,0);
});

test('577 weeks with one zero prior-state 4w base are still not score-ready',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:577,startDate:'2015-10-17'});
 db.prepare(`UPDATE market_score_employment_r4_shadow_current_v1 SET value=0
  WHERE geography_code='WY' AND observation_date IN
   ('2015-10-17','2015-10-24','2015-10-31','2015-11-07')`).run();db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.stateClaims.fullTenYearRawCoverage.status,'PRIOR_4W_ZERO_BASE');
});

test('clean WAL without sidecars uses native read-only and preserves business database',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);db.exec('PRAGMA journal_mode=WAL');db.close();
 const before=sha(file),r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));assert.equal(r.sqliteOpened,true);
 assert.equal(r.pitRawSchema.raw.requiredCount,11);assert.equal(sha(file),before);
 assert.equal(r.operationalWrites,0);
});

test('live WAL pair is readable and committed data is preserved without stopping the writer',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);db.exec('PRAGMA journal_mode=WAL');
 const before=db.prepare('SELECT COUNT(*) AS n FROM market_score_employment_r4_shadow_current_v1').get().n;
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));assert.equal(r.sqliteOpened,true);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM market_score_employment_r4_shadow_current_v1').get().n,before);
 assert.equal(r.operationalWrites,0);assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);
 db.close();
});

test('a valid saved WAL without a shared index is read through normal SQLite coordination',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);db.exec('PRAGMA journal_mode=WAL');
 db.exec('PRAGMA user_version=7');
 const base=fs.readFileSync(file),wal=fs.readFileSync(file+'-wal');db.close();
 fs.writeFileSync(file,base);fs.writeFileSync(file+'-wal',wal);
 assert.equal(fs.existsSync(file+'-shm'),false);
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));assert.equal(r.operationalWrites,0);
});

test('database open failures preserve a specific query failure without claiming evidence success',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);db.close();const before=sha(file);
 const r=inspectEmploymentR6CollectionEvidence(data,{openDatabase:()=>{throw Error('fixture busy');}});
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'R6_EVIDENCE_QUERY_FAILED');
 assert.equal(r.sqliteOpened,false);assert.equal(sha(file),before);
});

test('unapproved data path and symbolic core file fail without opening SQLite',t=>{
 const {data,storage,file}=fixture(t);
 assert.equal(inspectEmploymentR6CollectionEvidence(storage).code,'R6_EVIDENCE_DATA_ROOT_DENIED');
 const other=path.join(storage,'other.sqlite');const db=createDb(other);db.close();
 let filesystem=fs;
 try{fs.symlinkSync(other,file);}
 catch(error){
  if(!['EPERM','EACCES'].includes(error?.code))throw error;
  // Isolated Windows CI users may lack symlink creation privileges.
  // Simulate the same lstat+realpath contract without relaxing the guard.
  filesystem={...fs,
   lstatSync(target){
    if(target===file)return Object.assign(Object.create(fs.lstatSync(other)),{
     isSymbolicLink:()=>true,
    });
    return fs.lstatSync(target);
   },
   realpathSync(target){return target===file?other:fs.realpathSync(target);},
  };
 }
 const r=inspectEmploymentR6CollectionEvidence(data,{filesystem,
  openDatabase:()=>{throw Error('SHOULD_NOT_OPEN');}});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.sqliteOpened,false);
});

test('DOL national error categories remain diagnostic without leaking arbitrary error text',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:1});
 db.prepare(`INSERT INTO market_score_employment_r4_shadow_runs_v1 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
  'EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS','PARTIAL','2026-11-16T08:00:00.000Z',
  2,51,0,0,0,'DOL_NATIONAL_HTTP_FAILED',
  JSON.stringify({mode:'RELEASE',nationalResponseEvidence:{httpStatus:503},
    privateToken:'SECRET_DO_NOT_OUTPUT'}));
 db.close();
 const testCodes=[
  ['DOL_NATIONAL_HTTP_FAILED','DOL_NATIONAL_HTTP_FAILED'],
  ['DOL_NATIONAL_REQUEST_FAILED','DOL_NATIONAL_REQUEST_FAILED'],
  ['DOL_NATIONAL_NO_VALID_ROWS','DOL_NATIONAL_NO_VALID_ROWS'],
  ['DOL_NATIONAL_SERIES_INCOMPLETE','DOL_NATIONAL_SERIES_INCOMPLETE'],
  ['DOL_NATIONAL_INVALID_DATA','DOL_NATIONAL_INVALID_DATA'],
  ['DOL_NATIONAL_SOURCE_UNAVAILABLE','DOL_NATIONAL_SOURCE_UNAVAILABLE'],
  ['DOL_NATIONAL_RESPONSE_FORMAT_UNSUPPORTED','DOL_NATIONAL_RESPONSE_FORMAT_UNSUPPORTED'],
  ['DOL_RELEASE_OBSERVATION_STALE','DOL_RELEASE_OBSERVATION_STALE'],
  ['HTTP_503_SECRET_DO_NOT_OUTPUT','OTHER'],
 ];
 for(const [stored,expected] of testCodes){
  const writing=new DatabaseSync(file);
  writing.prepare(`UPDATE market_score_employment_r4_shadow_runs_v1 SET failure_code=?
   WHERE provider='EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS'
    AND json_extract(detail_json,'$.mode')='RELEASE'`).run(stored);
  writing.close();
  const beforeHash=sha(file);
  const result=inspectEmploymentR6CollectionEvidence(data);
  assert.equal(result.status,'PASS');
  assert.equal(result.dol.RELEASE.failureCode,expected,stored);
  assert.equal(result.dol.RELEASE.providerRequests,2);
  assert.equal(result.providerCalls,0);
  assert.equal(result.d1Writes,0);
  assert.equal(result.operationalWrites,0);
  assert.equal(sha(file),beforeHash,'read-only diagnosis must preserve storage bytes');
  assert.doesNotMatch(JSON.stringify(result),/SECRET_DO_NOT_OUTPUT|privateToken|nationalResponseEvidence/i);
 }
});

test('W04 manual National response diagnosis classifies stored 200 TEXT without leaking source body',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db,{weeks:1});
 db.prepare(`INSERT INTO market_score_employment_r4_shadow_runs_v1 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
  'EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS','PARTIAL','2026-11-16T10:14:15.554Z',
  2,5712,0,0,0,'DOL_NATIONAL_NO_VALID_ROWS',
  JSON.stringify({mode:'ONE_YEAR',missingSeries:[
   'INITIAL_CLAIMS','INITIAL_CLAIMS_4W','CONTINUED_CLAIMS','INSURED_UNEMPLOYMENT_RATE'],
   nationalResponseEvidence:{
    httpStatus:200,contentTypeCategory:'text/plain',responseFormat:'TEXT',
    bodyCharLength:42,parsedNationalSeriesCount:0,
    latestNationalObservationDate:null,
    bodySha256:'DO_NOT_OUTPUT_PRIVATE_DIGEST',
    sourceUrl:'SECRET_DO_NOT_OUTPUT',token:'SECRET_DO_NOT_OUTPUT'
   },error:'SECRET_DO_NOT_OUTPUT'}));
 db.close();
 const before=sha(file);
 const result=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(result.status,'PASS');
 assert.equal(result.dol.ONE_YEAR.status,'PARTIAL');
 assert.equal(result.dol.ONE_YEAR.failureCode,'DOL_NATIONAL_NO_VALID_ROWS');
 assert.deepEqual(result.dol.ONE_YEAR.nationalResponse,{
  httpStatus:200,contentTypeCategory:'text/plain',responseFormat:'TEXT',
  bodyPresent:true,parsedNationalSeriesCount:0,
  requestFailureCode:null,validationFailureCode:null,latestNationalObservationDate:null,
 });
 assert.equal(sha(file),before);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.equal(result.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(result),/SECRET_DO_NOT_OUTPUT|DO_NOT_OUTPUT_PRIVATE_DIGEST|sourceUrl|token|bodySha256|error/i);
});

test('W04 National raw diagnostic rejects arbitrary formats and unbounded error codes',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db,{weeks:1});
 db.prepare(`INSERT INTO market_score_employment_r4_shadow_runs_v1 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
  'EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS','PARTIAL','2026-11-16T10:14:15.554Z',
  2,5712,0,0,0,'SECRET_DO_NOT_OUTPUT',
  JSON.stringify({mode:'ONE_YEAR',nationalResponseEvidence:{
   httpStatus:200,contentTypeCategory:'text/html;token=SECRET_DO_NOT_OUTPUT',
   responseFormat:'MALICIOUS_FORMAT_SECRET_DO_NOT_OUTPUT',bodyCharLength:500,
   parsedNationalSeriesCount:999,requestFailureCode:'SECRET_DO_NOT_OUTPUT',
   validationFailureCode:'SECRET_DO_NOT_OUTPUT',
   latestNationalObservationDate:'2026-11-14'
  }}));
 db.close();
 const result=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(result.status,'PASS');
 assert.equal(result.dol.ONE_YEAR.failureCode,'OTHER');
 assert.deepEqual(result.dol.ONE_YEAR.nationalResponse,{
  httpStatus:200,contentTypeCategory:'UNKNOWN',responseFormat:'UNKNOWN',
  bodyPresent:true,parsedNationalSeriesCount:null,
  requestFailureCode:null,validationFailureCode:null,
  latestNationalObservationDate:'2026-11-14',
 });
 assert.doesNotMatch(JSON.stringify(result),/SECRET_DO_NOT_OUTPUT|MALICIOUS_FORMAT/);
});

test('official DOL HTTP-200 source unavailability remains redacted and exact in A diagnostic',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db,{weeks:1});
 db.prepare(`INSERT INTO market_score_employment_r4_shadow_runs_v1 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
  'EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS','PARTIAL','2026-11-16T11:30:15.554Z',
  2,5712,0,0,0,'DOL_NATIONAL_SOURCE_UNAVAILABLE',
  JSON.stringify({mode:'ONE_YEAR',nationalResponseEvidence:{
    httpStatus:200,contentTypeCategory:'text/plain',responseFormat:'SOURCE_UNAVAILABLE',
    bodyCharLength:100,parsedNationalSeriesCount:0,
    requestFailureCode:'DOL_NATIONAL_SOURCE_UNAVAILABLE',
    sourceUrl:'SECRET_DO_NOT_OUTPUT',bodySha256:'PRIVATE_DIGEST_DO_NOT_OUTPUT',
  }}));
 db.close();
 const before=sha(file);
 const result=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(result.status,'PASS');
 assert.equal(result.dol.ONE_YEAR.failureCode,'DOL_NATIONAL_SOURCE_UNAVAILABLE');
 assert.equal(result.dol.ONE_YEAR.nationalResponse.responseFormat,'SOURCE_UNAVAILABLE');
 assert.equal(result.dol.ONE_YEAR.nationalResponse.httpStatus,200);
 assert.equal(result.dol.ONE_YEAR.nationalResponse.requestFailureCode,'DOL_NATIONAL_SOURCE_UNAVAILABLE');
 assert.equal(result.dol.ONE_YEAR.nationalResponse.parsedNationalSeriesCount,0);
 assert.equal(sha(file),before);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.doesNotMatch(JSON.stringify(result),/SECRET_DO_NOT_OUTPUT|PRIVATE_DIGEST_DO_NOT_OUTPUT|sourceUrl|bodySha256/);
});


function storeNationalRawFixture(db,{
 rawDate='11/07/2026',recordedDate='2026-10-17',corrupt=false,missingChunk=false,
}={}){
 db.exec("ALTER TABLE market_score_employment_r6_raw_snapshot_v1 ADD COLUMN snapshot_id TEXT");
 db.exec("ALTER TABLE market_score_employment_r6_raw_snapshot_v1 ADD COLUMN body_sha256 TEXT");
 const xml='<r539cyNational><week><weekEnded>'+rawDate+'</weekEnded>'+
  '<InitialClaims><SA>210,000</SA><SA4WK>205,000</SA4WK></InitialClaims>'+
  '<ContinuedClaims><SA>1,800,000</SA></ContinuedClaims><IUR><SA>1.2</SA></IUR>'+
  '</week></r539cyNational>';
 const hash=createHash('sha256').update(xml).digest('hex');
 const detail=JSON.stringify({mode:'RELEASE',latestInitialClaimsObservationDate:recordedDate,
  latestNationalSeriesObservationDates:Object.fromEntries(
   ['INITIAL_CLAIMS','INITIAL_CLAIMS_4W','CONTINUED_CLAIMS','INSURED_UNEMPLOYMENT_RATE']
     .map(id=>[id,recordedDate])),
  nationalResponseEvidence:{bodySha256:hash,latestNationalObservationDate:recordedDate},
  privateToken:'SECRET_DO_NOT_OUTPUT'});
 db.prepare("INSERT INTO market_score_employment_r4_shadow_runs_v1 VALUES(?,?,?,?,?,?,?,?,?,?)").run(
  'EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS','PARTIAL','2026-11-18T01:55:19.006Z',
  2,51,0,0,0,'DOL_RELEASE_OBSERVATION_STALE',detail);
 db.prepare("INSERT INTO market_score_employment_r6_raw_snapshot_v1 "+
  "(request_key,release_group,chunk_index,retrieved_at,chunk_count,http_status,detail_json,body_chunk,snapshot_id,body_sha256) "+
  "VALUES(?,?,?,?,?,?,?,?,?,?)").run('DOL_NATIONAL:2025-2026','DOL_UI_WEEKLY_CLAIMS',0,
   '2026-11-18T01:54:19.006Z',missingChunk?2:1,200,'{}',
   corrupt?xml.replace('210,000','209,000'):xml,'fixture-nat-1',hash);
 return {xml,hash};
}

test('W04 A/light compares immutable saved National XML to its exact run hash without changing storage',t=>{
 const {data,storage,file}=fixture(t),db=createDb(file);seed(db,{weeks:1});
 storeNationalRawFixture(db);db.close();
 const before=sha(file),beforeFiles=fs.readdirSync(storage).sort();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 assert.equal(r.nationalRaw.RELEASE.status,'RAW_NEWER_THAN_RUN_PARSER');
 assert.equal(r.nationalRaw.RELEASE.linkedByRawBodySha,true);
 assert.equal(r.nationalRaw.RELEASE.latestWeekEnded,'2026-11-07');
 assert.equal(r.nationalRaw.RELEASE.latestNumericDates.INITIAL_CLAIMS,'2026-11-07');
 assert.equal(r.nationalRaw.RELEASE.recordedLatestDates.INITIAL_CLAIMS,'2026-10-17');
 assert.equal(r.nationalRaw.ONE_YEAR.status,'RUN_NOT_STORED');
 assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);assert.equal(r.operationalWrites,0);
 assert.equal(sha(file),before);
 assert.deepEqual(fs.readdirSync(storage).sort(),beforeFiles);
 assert.doesNotMatch(JSON.stringify(r),/SECRET_DO_NOT_OUTPUT|210,000|<week|bodySha256|snapshot_id/i);
 assert.ok(Buffer.byteLength(JSON.stringify(r))<32768);
});

test('National same raw/parser date is aligned; mismatch cannot be called source freshness',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db,{weeks:1});
 storeNationalRawFixture(db,{rawDate:'10/17/2026'});db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.nationalRaw.RELEASE.status,'RAW_EQUALS_RUN_PARSER');
 assert.equal(r.nationalRaw.RELEASE.latestWeekEnded,'2026-10-17');
});

test('National raw audit blocks a corrupted body and fails closed without revealing it',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db,{weeks:1});
 storeNationalRawFixture(db,{corrupt:true});db.close();
 const before=sha(file);
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.nationalRaw.RELEASE.status,'RAW_BODY_HASH_MISMATCH');
 assert.equal(r.nationalRaw.RELEASE.latestNumericDates,null);
 assert.equal(r.nationalRaw.RELEASE.linkedByRawBodySha,false);
 assert.equal(sha(file),before);
 assert.doesNotMatch(JSON.stringify(r),/210,000|209,000|<week|bodySha256|SECRET_DO_NOT_OUTPUT/i);
});

test('National raw audit detects incomplete chunk set instead of pretending XML is old',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db,{weeks:1});
 storeNationalRawFixture(db,{missingChunk:true});db.close();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.nationalRaw.RELEASE.status,'RAW_CHUNKS_INCOMPLETE');
 assert.equal(r.nationalRaw.RELEASE.latestWeekEnded,null);
});

test('W04 PIT schema diagnosis reports only fixed raw/runs missing column ordinals',t=>{
 const {data,storage,file}=fixture(t),db=createDb(file);seed(db,{weeks:1});db.close();
 const before=sha(file),beforeFiles=fs.readdirSync(storage).sort();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 assert.equal(r.pitRawSchema.kind,'EMPLOYMENT_R6_PIT_SCHEMA_ONLY_V1');
 assert.equal(r.pitRawSchema.reason,'RAW_REQUIRED_COLUMNS_MISSING');
 assert.deepEqual(r.pitRawSchema.raw,{tablePresent:true,requiredCount:11,presentCount:7,
  missingOrdinals:[0,4,7,8]});
 assert.deepEqual(r.pitRawSchema.runs,{tablePresent:true,requiredCount:4,presentCount:4,
  missingOrdinals:[]});
 assert.match(r.pitRawSchema.dbIdentityTag,/^[a-f0-9]{16}$/);
 assert.equal(inspectEmploymentR6CollectionEvidence(data).pitRawSchema.dbIdentityTag,r.pitRawSchema.dbIdentityTag);
 assert.match(r.pitRawSchema.checkedAt,/^20\d{2}-\d{2}-\d{2}T/);
 assert.equal(sha(file),before);
 assert.deepEqual(fs.readdirSync(storage).sort(),beforeFiles);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_RAW_BODY|SECRET_DO_NOT_OUTPUT|TOKEN_SECRET|body_chunk|detail_json/i);
 assert.equal(r.providerCalls,0);assert.equal(r.operationalWrites,0);assert.equal(r.d1Writes,0);
 assert.ok(Buffer.byteLength(JSON.stringify(r))<32768);
});

test('W04 PIT schema reports required columns present after complete fixed schema',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db,{weeks:1});
 for(const c of ['snapshot_id TEXT','provider TEXT','created_at TEXT','body_sha256 TEXT']){
  db.exec(`ALTER TABLE market_score_employment_r6_raw_snapshot_v1 ADD COLUMN ${c}`);
 }
 db.close();
 const before=sha(file),r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS');
 assert.equal(r.pitRawSchema.reason,'REQUIRED_SCHEMA_PRESENT');
 assert.equal(r.pitRawSchema.raw.presentCount,11);
 assert.deepEqual(r.pitRawSchema.raw.missingOrdinals,[]);
 assert.equal(r.pitRawSchema.runs.presentCount,4);
 assert.deepEqual(r.pitRawSchema.runs.missingOrdinals,[]);
 assert.equal(sha(file),before);
});

test('W04 PIT schema distinguishes a missing runs table without changing DB',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 db.exec('DROP TABLE market_score_employment_r4_shadow_runs_v1');db.close();
 const before=sha(file),r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R6_EVIDENCE_TABLE_MISSING');
 assert.equal(r.pitRawSchema.reason,'RUNS_TABLE_MISSING');
 assert.equal(r.pitRawSchema.runs.tablePresent,false);
 assert.deepEqual(r.pitRawSchema.runs.missingOrdinals,[0,1,2,3]);
 assert.equal(sha(file),before);
});

test('W04 PIT schema distinguishes a missing raw table without changing DB',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 db.exec('DROP TABLE market_score_employment_r6_raw_snapshot_v1');db.close();
 const before=sha(file),r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R6_EVIDENCE_TABLE_MISSING');
 assert.equal(r.pitRawSchema.reason,'RAW_TABLE_MISSING');
 assert.equal(r.pitRawSchema.raw.tablePresent,false);
 assert.deepEqual(r.pitRawSchema.raw.missingOrdinals,[0,1,2,3,4,5,6,7,8,9,10]);
 assert.equal(sha(file),before);
});

function seedEta539Parity(db,{latestInvalid=false}={}){
 db.exec("ALTER TABLE market_score_employment_r6_raw_snapshot_v1 ADD COLUMN snapshot_id TEXT");
 db.exec("ALTER TABLE market_score_employment_r6_raw_snapshot_v1 ADD COLUMN provider TEXT");
 db.exec("ALTER TABLE market_score_employment_r6_raw_snapshot_v1 ADD COLUMN body_sha256 TEXT");
 for(const column of ['provider','provider_series_id','source_hash','source_revision','retrieved_at'])
  db.exec('ALTER TABLE market_score_employment_r4_shadow_current_v1 ADD COLUMN '+column+' TEXT');
 const week='2026-10-31',report='2026-11-04',stored='2026-11-19T00:00:00.000Z';
 const lines=['st,rptdate,c1,c2,c3,c8',...STATES.map(st=>
   [st,'11/04/2026','2','10/31/2026',st==='AL'?'0':'300','9000'].join(','))];
 if(latestInvalid)lines.push('AL,11/11/2026,2,10/31/2026,,9000');
 const raw=lines.join('\n'),digest=createHash('sha256').update(raw).digest('hex');
 const snapshotId=createHash('sha256').update('DOL_UI_WEEKLY_CLAIMS|DOL_ETA|DOL_ETA539:60w|'+digest).digest('hex');
 db.prepare("INSERT INTO market_score_employment_r6_raw_snapshot_v1 "+
  "(request_key,release_group,chunk_index,retrieved_at,chunk_count,http_status,detail_json,body_chunk,snapshot_id,provider,body_sha256) "+
  "VALUES(?,?,?,?,?,?,?,?,?,?,?)").run('DOL_ETA539:60w','DOL_UI_WEEKLY_CLAIMS',0,
   stored,1,200,'{}',raw,snapshotId,'DOL_ETA',digest);
 const insert=db.prepare("INSERT INTO market_score_employment_r4_shadow_current_v1 "+
   "(logical_series_id,geography_type,geography_code,observation_date,value,provider,provider_series_id,source_hash,source_revision,retrieved_at) "+
   "VALUES(?,?,?,?,?,?,?,?,?,?)");
 for(const st of STATES){
  const value=st==='AL'?0:300;
  const hash=createHash('sha256').update(JSON.stringify({reflectedWeek:week,reportDate:report,st,value})).digest('hex');
  insert.run('STATE_INITIAL_CLAIMS','STATE',st,week,value,
   'DOL_ETA','ETA539:C3',hash,'ETA539:RPTDATE:'+report,stored);
 }
}
test('W04 PIT0407 stable field order reproduces actual parser sourceHash, not insertion order',()=>{
 const item={st:'AL',reflectedWeek:'2026-10-31',reportDate:'2026-11-04',value:0};
 const canonical=JSON.stringify(Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])));
 const hash=createHash('sha256').update(canonical).digest('hex');
 assert.equal(hash,createHash('sha256').update(JSON.stringify({reflectedWeek:item.reflectedWeek,
  reportDate:item.reportDate,st:item.st,value:item.value})).digest('hex'));
 assert.notEqual(hash,createHash('sha256').update(JSON.stringify({reportDate:item.reportDate,
  reflectedWeek:item.reflectedWeek,st:item.st,value:item.value})).digest('hex'));
});

test('W04 PIT0407 raw snapshot c3 matches stored Current with genuine zero, no raw disclosure or mutation',t=>{
 const {data,file,storage}=fixture(t),db=createDb(file);
 seed(db);seedEta539Parity(db);db.close();
 const beforeHash=sha(file),beforeFiles=fs.readdirSync(storage).sort();
 const r=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 const p=r.eta539RawCurrentParity;
 assert.equal(p.kind,'W04_ETA539_C3_RAW_CURRENT_PARITY_V1');
 assert.equal(p.status,'SNAPSHOT_SCOPE_CLASSIFIED_NOT_PIT');
 assert.equal(p.checkedWeeks,1);
 assert.equal(p.checkedKeys,51);
 assert.deepEqual(p.counts,{MATCH:51,CURRENT_NEWER_THAN_RAW:0,MISSING_CURRENT:0,
  OTHER_SOURCE:0,VALUE_DIFFERENT:0,HASH_DIFFERENT:0,REVISION_DIFFERENT:0});
 assert.equal(p.rawPitAttested,false);assert.equal(p.repairAuthorized,false);
 assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);assert.equal(r.operationalWrites,0);
 assert.equal(sha(file),beforeHash);
 assert.deepEqual(fs.readdirSync(storage).sort(),beforeFiles);
 assert.doesNotMatch(JSON.stringify(p),/body_chunk|source_hash|snapshot_id|9000|10\/31\/2026/i);
});
test('W04 PIT0407 raw parity separates newer Current, changed value, provenance hash and revision',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);seedEta539Parity(db);
 const u=(column,value,state)=>db.prepare('UPDATE market_score_employment_r4_shadow_current_v1 SET '+
  column+'=? WHERE geography_code=? AND observation_date=?').run(value,state,'2026-10-31');
 u('retrieved_at','2026-11-20T00:00:00.000Z','AL');
 u('value',900,'AK');
 u('source_hash','f'.repeat(64),'AZ');
 u('source_revision','ETA539:RPTDATE:2026-10-30','AR');
 u('provider','OTHER','CA');
 db.prepare("DELETE FROM market_score_employment_r4_shadow_current_v1 WHERE geography_code='CO' AND observation_date='2026-10-31'").run();
 db.close();
 const p=inspectEmploymentR6CollectionEvidence(data).eta539RawCurrentParity;
 assert.equal(p.status,'SNAPSHOT_SCOPE_CLASSIFIED_NOT_PIT');
 assert.deepEqual(p.counts,{MATCH:45,CURRENT_NEWER_THAN_RAW:1,MISSING_CURRENT:1,
  OTHER_SOURCE:1,VALUE_DIFFERENT:1,HASH_DIFFERENT:1,REVISION_DIFFERENT:1});
});
test('W04 PIT0407 newer missing c3 revision does not reuse older valid state-week',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);seedEta539Parity(db,{latestInvalid:true});db.close();
 const p=inspectEmploymentR6CollectionEvidence(data).eta539RawCurrentParity;
 assert.equal(p.status,'NO_COMPLETE_WEEK_IN_SNAPSHOT',JSON.stringify(p));
 assert.equal(p.invalidLatest,1);
 assert.equal(p.rawPitAttested,false);assert.equal(p.repairAuthorized,false);
});



test('PIT0407 full stored ETA539 CSV can span more than 64 verified chunks without metadata false-negative',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);seedEta539Parity(db);
 const head=db.prepare("SELECT * FROM market_score_employment_r6_raw_snapshot_v1 "+
  "WHERE request_key='DOL_ETA539:60w' AND chunk_index=0").get();
 const slices=65;const width=Math.ceil(head.body_chunk.length/slices);
 const pieces=[];
 for(let i=0;i<slices;i++)pieces.push(head.body_chunk.slice(i*width,(i+1)*width));
 assert.equal(pieces.join(''),head.body_chunk);
 db.prepare("UPDATE market_score_employment_r6_raw_snapshot_v1 SET body_chunk=?,chunk_count=65 "+
  "WHERE snapshot_id=? AND chunk_index=0").run(pieces[0],head.snapshot_id);
 const insert=db.prepare("INSERT INTO market_score_employment_r6_raw_snapshot_v1 "+
  "(request_key,release_group,chunk_index,retrieved_at,chunk_count,http_status,detail_json,body_chunk,snapshot_id,provider,body_sha256) "+
  "VALUES(?,?,?,?,?,?,?,?,?,?,?)");
 for(let i=1;i<pieces.length;i++)insert.run(head.request_key,head.release_group,i,
  head.retrieved_at,65,head.http_status,head.detail_json,pieces[i],
  head.snapshot_id,head.provider,head.body_sha256);
 db.close();
 const p=inspectEmploymentR6CollectionEvidence(data).eta539RawCurrentParity;
 assert.equal(p.status,'SNAPSHOT_SCOPE_CLASSIFIED_NOT_PIT',JSON.stringify(p));
 assert.equal(p.checkedKeys,51);
 assert.equal(p.counts.MATCH,51);
});

test('PIT0407 stored ETA539 beyond approved 4096-chunk bound reports exact safe reason',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);seedEta539Parity(db);
 db.prepare("UPDATE market_score_employment_r6_raw_snapshot_v1 "+
  "SET chunk_count=4097 WHERE request_key='DOL_ETA539:60w'").run();db.close();
 const p=inspectEmploymentR6CollectionEvidence(data).eta539RawCurrentParity;
 assert.equal(p.status,'RAW_CHUNK_COUNT_OUT_OF_BOUNDS');
 assert.equal(p.rawPitAttested,false);
 assert.equal(p.repairAuthorized,false);
});



test('PIT0407 later Current retrieval does not hide same raw c3 values or overstate PIT',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);seedEta539Parity(db);
 db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 "+
  "SET retrieved_at='2026-11-20T01:00:00.000Z' WHERE observation_date='2026-10-31'").run();
 db.close();
 const p=inspectEmploymentR6CollectionEvidence(data).eta539RawCurrentParity;
 assert.equal(p.status,'SNAPSHOT_SCOPE_CLASSIFIED_NOT_PIT',JSON.stringify(p));
 assert.equal(p.checkedKeys,51);
 assert.equal(p.counts.CURRENT_NEWER_THAN_RAW,51);
 assert.deepEqual(p.newerCurrentComparison,{
  VALUE_HASH_REVISION_MATCH:51,VALUE_DIFFERENT:0,HASH_DIFFERENT:0,REVISION_DIFFERENT:0});
 assert.equal(p.rawPitAttested,false);
 assert.equal(p.repairAuthorized,false);
});

test('PIT0407 later Current retrieval compares value/hash/revision separately',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);seedEta539Parity(db);
 db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 "+
  "SET retrieved_at='2026-11-20T01:00:00.000Z' WHERE observation_date='2026-10-31'").run();
 db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 SET value=901 "+
  "WHERE observation_date='2026-10-31' AND geography_code='AL'").run();
 db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 SET source_hash=? "+
  "WHERE observation_date='2026-10-31' AND geography_code='AK'").run('f'.repeat(64));
 db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 "+
  "SET source_revision='ETA539:RPTDATE:2026-11-11' "+
  "WHERE observation_date='2026-10-31' AND geography_code='AZ'").run();
 db.close();
 const p=inspectEmploymentR6CollectionEvidence(data).eta539RawCurrentParity;
 assert.equal(p.status,'SNAPSHOT_SCOPE_CLASSIFIED_NOT_PIT',JSON.stringify(p));
 assert.equal(p.counts.CURRENT_NEWER_THAN_RAW,51);
 assert.deepEqual(p.newerCurrentComparison,{
  VALUE_HASH_REVISION_MATCH:48,VALUE_DIFFERENT:1,HASH_DIFFERENT:1,REVISION_DIFFERENT:1});
 assert.equal(p.rawPitAttested,false);
});

test('R6 fixed stage markers cover the full safe stored-only path without altering core data',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);db.close();
 const before=sha(file),observed=[];
 const result=inspectEmploymentR6CollectionEvidence(data,{onStage:stage=>observed.push(stage)});
 assert.equal(result.status,'PASS',JSON.stringify(result));
 assert.deepEqual(observed,R6_READONLY_STAGES);
 assert.equal(sha(file),before);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
});

test('R6 diagnostic callback failure cannot turn a previously passing readonly query into failure',t=>{
 const {data,file}=fixture(t),db=createDb(file);seed(db);db.close();
 const before=sha(file);
 const result=inspectEmploymentR6CollectionEvidence(data,{
  onStage:()=>{throw Error('fixture diagnostic workspace unavailable');},
 });
 assert.equal(result.status,'PASS',JSON.stringify(result));
 assert.equal(result.code,'R6_DOL_BED_STORED_EVIDENCE_READONLY');
 assert.equal(sha(file),before);
});

test('W04 ETA538 saved-only audit checks binary PDF, Base64 and all four National row hashes',()=>{
 const digest=v=>createHash('sha256').update(v).digest('hex');
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE market_score_employment_r6_raw_snapshot_v1 ('+
   'snapshot_id TEXT,chunk_index INTEGER,chunk_count INTEGER,release_group TEXT,'+
   'provider TEXT,request_key TEXT,retrieved_at TEXT,body_sha256 TEXT,'+
   'body_chunk TEXT,detail_json TEXT,content_type TEXT);'+
   'CREATE TABLE market_score_employment_r4_shadow_current_v1 ('+
   'provider TEXT,geography_type TEXT,geography_code TEXT,logical_series_id TEXT,'+
   'observation_date TEXT,provider_series_id TEXT,unit TEXT,value REAL,'+
   'source_hash TEXT,provenance_json TEXT)');
  const releaseDate='2026-11-19',retrievedAt='2026-11-24T16:03:21.789Z';
  const bytes=Buffer.from('%PDF-1.4\n'+'demo-binary-archive-'.repeat(8)+'\n%%EOF');
  const original=digest(bytes),encoded=bytes.toString('base64'),textHash=digest(encoded);
  const requestKey='DOL_ETA538_PDF:'+releaseDate;
  const snapshotId=digest('DOL_UI_WEEKLY_CLAIMS|DOL_ETA|'+requestKey+'|'+textHash);
  const observationWeeks={INITIAL_CLAIMS:'2026-11-14',
   INITIAL_CLAIMS_4W:'2026-11-14',CONTINUED_CLAIMS:'2026-11-07',
   INSURED_UNEMPLOYMENT_RATE:'2026-11-07'};
  const metadata={schema:'W04_DOL_ETA538_PDF_BASE64_SNAPSHOT_V1',
   bodyEncoding:'BASE64_PDF_BYTES',originalContentType:'application/pdf',
   originalBodySha256:original,originalBodyBytes:bytes.length,bodyTextSha256:textHash,
   sourceReleaseDate:releaseDate,
   sourceUrl:'https://oui.doleta.gov/press/2026/111926.pdf',
   sourceObservationWeeks:observationWeeks};
  db.prepare('INSERT INTO market_score_employment_r6_raw_snapshot_v1 VALUES(?,?,?,?,?,?,?,?,?,?,?)')
   .run(snapshotId,0,1,'DOL_UI_WEEKLY_CLAIMS','DOL_ETA',requestKey,
    retrievedAt,textHash,encoded,JSON.stringify(metadata),'application/pdf');
  const series=[
   ['INITIAL_CLAIMS','DOL:ETA538:InitialClaims:SA',203000,'CLAIMS_COUNT'],
   ['INITIAL_CLAIMS_4W','DOL:ETA538:InitialClaims:SA4WK',197750,'CLAIMS_COUNT'],
   ['CONTINUED_CLAIMS','DOL:ETA538:ContinuedClaims:SA',1763000,'CLAIMS_COUNT'],
   ['INSURED_UNEMPLOYMENT_RATE','DOL:ETA538:IUR:SA',1.1,'PERCENT'],
  ];
  const insert=db.prepare('INSERT INTO market_score_employment_r4_shadow_current_v1 VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const [id,providerSeriesId,value,unit] of series){
   const observationDate=observationWeeks[id];
   const sourceHash=digest(JSON.stringify({logicalSeriesId:id,observationDate,
    providerSeriesId,value,unit,releaseDate}));
   insert.run('DOL_ETA','NATIONAL','US',id,observationDate,providerSeriesId,
    unit,value,sourceHash,JSON.stringify({rawSnapshotId:snapshotId,
     originalPdfSha256:original,responseHash:textHash,rawRecordHash:sourceHash,
     sourceKind:'ETA538_ADVANCE_RELEASE_PDF'}));
  }
  // Invalid release/hash pins must fail before any persisted-byte claim.
  assert.equal(auditStoredEta538PdfRawLinkage(db,{releaseDate:'invalid',
   approvedPdfSha256:original}).status,'PIN_INVALID');
  assert.equal(auditStoredEta538PdfRawLinkage(db,{approvedPdfSha256:'0'}).status,
   'PIN_INVALID');
  const verified=auditStoredEta538PdfRawLinkage(db,{approvedPdfSha256:original});
  assert.equal(verified.status,'PDF_BYTES_AND_FOUR_ROW_HASH_LINKS_VERIFIED_NOT_VALUE_REPARSE');
  assert.equal(verified.verifiedNationalRows,4);
  assert.equal(verified.originalPdfSha256Matched,true);
  assert.equal(auditStoredEta538PdfRawLinkage(db).status,'PDF_BYTES_OR_HASH_MISMATCH');
  assert.equal(verified.valuesReparsed,false);
  assert.deepEqual(verified.observationWeeks,observationWeeks);
  assert.doesNotMatch(JSON.stringify(verified),/demo-binary-archive|203000|1763000/);
  db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 SET value=999 WHERE logical_series_id='INITIAL_CLAIMS'").run();
  assert.equal(auditStoredEta538PdfRawLinkage(db,{approvedPdfSha256:original}).status,'PDF_NATIONAL_ROW_HASH_LINK_INVALID');
  db.prepare("UPDATE market_score_employment_r4_shadow_current_v1 SET value=203000 WHERE logical_series_id='INITIAL_CLAIMS'").run();
  db.prepare('UPDATE market_score_employment_r6_raw_snapshot_v1 SET body_chunk=?').run(encoded.slice(0,-3)+'AAA');
  assert.equal(auditStoredEta538PdfRawLinkage(db,{approvedPdfSha256:original}).status,'PDF_BYTES_OR_HASH_MISMATCH');
 }finally{db.close();}
});


test('W04 stored DOL RELEASE counters include exact noop and history rows without provider calls',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:1});
 db.exec('ALTER TABLE market_score_employment_r4_shadow_runs_v1 ADD COLUMN noop_count INTEGER;'+
  'ALTER TABLE market_score_employment_r4_shadow_runs_v1 ADD COLUMN history_rows_added INTEGER;');
 const release='2026-11-24T19:23:15.174Z';
 db.prepare('INSERT INTO market_score_employment_r4_shadow_runs_v1 '+
  '(provider,status,completed_at,provider_requests,collected_rows,inserted_count,'+
  'revised_count,noop_count,rejected_count,history_rows_added,failure_code,detail_json) '+
  'VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(
  'EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS','SUCCESS',release,2,3440,42,
  11,3387,0,53,null,JSON.stringify({mode:'RELEASE',secret:'PRIVATE_DO_NOT_EXPORT'}));
 db.close();
 const before=sha(file);
 const result=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(result.status,'PASS',JSON.stringify(result));
 assert.equal(result.dol.RELEASE.completedAt,release);
 assert.equal(result.dol.RELEASE.collectedRows,3440);
 assert.equal(result.dol.RELEASE.inserted,42);
 assert.equal(result.dol.RELEASE.revised,11);
 assert.equal(result.dol.RELEASE.noop,3387);
 assert.equal(result.dol.RELEASE.rejected,0);
 assert.equal(result.dol.RELEASE.historyRowsAdded,53);
 assert.equal(result.providerCalls,0);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.d1Writes,0);
 assert.equal(sha(file),before);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_DO_NOT_EXPORT|secret/);
});

test('W04 optional historic counters absent from older schema remain null, not zero',t=>{
 const {data,file}=fixture(t),db=createDb(file);
 seed(db,{weeks:1});
 db.close();
 const result=inspectEmploymentR6CollectionEvidence(data);
 assert.equal(result.status,'PASS',JSON.stringify(result));
 assert.equal(result.dol.BACKFILL.inserted,2799);
 assert.equal(result.dol.BACKFILL.noop,null);
 assert.equal(result.dol.BACKFILL.historyRowsAdded,null);
 assert.equal(result.providerCalls,0);
 assert.equal(result.operationalWrites,0);
});
