import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {inspectEmploymentR6CollectionEvidence} from '../controller/employment-r6-collection-evidence-readonly.mjs';

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
function seed(db,{weeks=56,missingLastCode=null}={}){
 const d='2025-01-04T00:00:00.000Z';
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

test('WAL database without sidecars remains untouched and unopened',t=>{
 const {data,storage,file}=fixture(t),db=createDb(file);
 db.exec('PRAGMA journal_mode=WAL');db.close();
 assert.equal(fs.readFileSync(file)[18],2);
 const beforeHash=sha(file),beforeFiles=fs.readdirSync(storage).sort();
 const r=inspectEmploymentR6CollectionEvidence(data,{openDatabase:()=>{throw Error('SHOULD_NOT_OPEN');}});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R6_EVIDENCE_WAL_SIDECARS_ABSENT');
 assert.equal(r.sqliteOpened,false);
 assert.equal(sha(file),beforeHash);
 assert.deepEqual(fs.readdirSync(storage).sort(),beforeFiles);
});

test('unapproved data path and symbolic core file fail without opening SQLite',t=>{
 const {data,storage,file}=fixture(t);
 assert.equal(inspectEmploymentR6CollectionEvidence(storage).code,'R6_EVIDENCE_DATA_ROOT_DENIED');
 const other=path.join(storage,'other.sqlite');const db=createDb(other);db.close();
 fs.symlinkSync(other,file);
 const r=inspectEmploymentR6CollectionEvidence(data,{openDatabase:()=>{throw Error('SHOULD_NOT_OPEN');}});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.sqliteOpened,false);
});
