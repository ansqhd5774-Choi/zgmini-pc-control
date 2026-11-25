import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {auditFixedR6RawRunSnapshot,inspectEmploymentR6RawRunLight}
 from '../controller/employment-r6-raw-run-attestation-readonly.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const RELEASE='DOL_UI_WEEKLY_CLAIMS';
const PROVIDER='DOL';
const AT='2026-11-19T09:00:00.000Z';
function schema(db){
 db.exec("CREATE TABLE market_score_employment_r6_raw_snapshot_v1("+
  "snapshot_id TEXT,chunk_index INTEGER,chunk_count INTEGER,release_group TEXT,"+
  "provider TEXT,request_key TEXT,retrieved_at TEXT,created_at TEXT,"+
  "body_sha256 TEXT,detail_json TEXT,body_chunk TEXT);"+
  "CREATE TABLE market_score_employment_r4_shadow_runs_v1("+
  "provider TEXT,status TEXT,completed_at TEXT,detail_json TEXT);");
}
function snapshot(db,{requestKey,body,storedBody=body,chunkSize=4}){
 const h=sha(body),id=sha([RELEASE,PROVIDER,requestKey,h].join('|'));
 const parts=[];
 for(let i=0;i<storedBody.length;i+=chunkSize)parts.push(storedBody.slice(i,i+chunkSize));
 const stmt=db.prepare("INSERT INTO market_score_employment_r6_raw_snapshot_v1 VALUES(?,?,?,?,?,?,?,?,?,?,?)");
 parts.forEach((part,index)=>stmt.run(id,index,parts.length,RELEASE,PROVIDER,
  requestKey,'2026-11-18T01:00:00.000Z','2026-11-18T01:00:01.000Z',h,
  JSON.stringify({responseHash:h,secret:'PRIVATE_RESPONSE_TOKEN'}),part));
 return {id,hash:h};
}
function run(db,item,{provider='EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS',time='2026-11-18T01:02:00.000Z'}={}){
 db.prepare("INSERT INTO market_score_employment_r4_shadow_runs_v1 VALUES(?,?,?,?)")
  .run(provider,'PARTIAL',time,JSON.stringify({
   rawSnapshots:[{snapshotId:item.id,bodySha256:item.hash}],
   secret:'PRIVATE_RUN_TOKEN',
  }));
}
test('fixed light audit verifies complete raw chunks and exact run receipt links',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 const certified=snapshot(db,{requestKey:'test-one',body:'original body'});
 snapshot(db,{requestKey:'test-two',body:'another response'});
 snapshot(db,{requestKey:'test-three',body:'expected value',storedBody:'tampered data!'});
 run(db,certified);
 const badId=db.prepare("SELECT snapshot_id FROM market_score_employment_r6_raw_snapshot_v1 WHERE request_key=? LIMIT 1")
  .get('test-three').snapshot_id;
 const expectedOrdinal=db.prepare("SELECT COUNT(DISTINCT snapshot_id) AS n FROM market_score_employment_r6_raw_snapshot_v1 WHERE snapshot_id<=?")
  .get(badId).n;
 const result=auditFixedR6RawRunSnapshot(db,{checkedAt:AT});
 assert.deepEqual(result,{
  status:'HASH_AND_RUN_LINKS_VERIFIED_NOT_PIT',checkedAt:AT,
  metadataKeys:3,bodyVerifiedKeys:2,runCertifiedKeys:1,
  invalidBodyKeys:1,validWithoutRunKeys:1,
  invalidReasonCounts:{
   CHUNK_OR_COUNT_INVALID:0,HASH_FORMAT_INVALID:0,SOURCE_FIELDS_INVALID:0,
   TIME_INVALID:0,RESPONSE_HASH_MISSING:0,RESPONSE_HASH_VALUE_MISMATCH:0,
   SNAPSHOT_ID_MISMATCH:0,BODY_SHA_MISMATCH:1,
  },
  invalidReasonOrdinals:[{ordinal:expectedOrdinal,reason:'BODY_SHA_MISMATCH'}],
  invalidReasonTruncated:false,
 });
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|original body|another response|snapshotId|body_sha256|test-one/);
 db.close();
});
test('invalid snapshot reason codes isolate chunk, time, response metadata and ID failures',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 snapshot(db,{requestKey:'broken-count',body:'count body'});
 snapshot(db,{requestKey:'broken-time',body:'time body'});
 snapshot(db,{requestKey:'broken-response',body:'metadata body'});
 snapshot(db,{requestKey:'broken-id',body:'id body'});
 const table='market_score_employment_r6_raw_snapshot_v1';
 db.prepare('DELETE FROM '+table+' WHERE request_key=? AND chunk_index=0').run('broken-count');
 db.prepare('UPDATE '+table+' SET created_at=? WHERE request_key=?')
  .run('2026-11-17T01:00:00.000Z','broken-time');
 db.prepare('UPDATE '+table+' SET detail_json=? WHERE request_key=?')
  .run(JSON.stringify({responseHash:'f'.repeat(64),secret:'PRIVATE_META'}),'broken-response');
 db.prepare('UPDATE '+table+' SET snapshot_id=? WHERE request_key=?')
  .run('f'.repeat(64),'broken-id');
 const result=auditFixedR6RawRunSnapshot(db,{checkedAt:AT});
 assert.equal(result.metadataKeys,4);
 assert.equal(result.bodyVerifiedKeys,0);
 assert.equal(result.invalidBodyKeys,4);
 for(const code of ['CHUNK_OR_COUNT_INVALID','TIME_INVALID',
  'RESPONSE_HASH_VALUE_MISMATCH','SNAPSHOT_ID_MISMATCH'])
  assert.equal(result.invalidReasonCounts[code],1);
 assert.equal(Object.values(result.invalidReasonCounts).reduce((a,b)=>a+b,0),4);
 assert.equal(result.invalidReasonOrdinals.length,4);
 assert.equal(new Set(result.invalidReasonOrdinals.map(x=>x.ordinal)).size,4);
 assert.equal(result.invalidReasonTruncated,false);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|broken-|metadata body|responseHash|snapshotId|body_sha256/);
 db.close();
});
test('missing responseHash is distinct from a present incorrect value without leaking metadata',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 for(const key of ['hash-absent','hash-null','hash-invalid'])
  snapshot(db,{requestKey:key,body:'secret-'+key});
 const table='market_score_employment_r6_raw_snapshot_v1';
 db.prepare('UPDATE '+table+' SET detail_json=? WHERE request_key=?')
  .run(JSON.stringify({secret:'PRIVATE_MISSING'}),'hash-absent');
 db.prepare('UPDATE '+table+' SET detail_json=? WHERE request_key=?')
  .run(JSON.stringify({responseHash:null,secret:'PRIVATE_NULL'}),'hash-null');
 db.prepare('UPDATE '+table+' SET detail_json=? WHERE request_key=?')
  .run(JSON.stringify({responseHash:'f'.repeat(64),secret:'PRIVATE_WRONG'}),'hash-invalid');
 const result=auditFixedR6RawRunSnapshot(db,{checkedAt:AT});
 assert.equal(result.invalidBodyKeys,3);
 assert.equal(result.invalidReasonCounts.RESPONSE_HASH_MISSING,2);
 assert.equal(result.invalidReasonCounts.RESPONSE_HASH_VALUE_MISMATCH,1);
 assert.equal(result.invalidReasonOrdinals.length,3);
 assert.equal(Object.values(result.invalidReasonCounts).reduce((a,b)=>a+b,0),3);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|secret-|hash-absent|hash-null|hash-invalid|responseHash/);
 db.close();
});
test('failure reasons stay bounded when invalid snapshots exceed the output limit',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 for(let i=0;i<35;i++)
  snapshot(db,{requestKey:'private-'+i,body:'original-'+i,storedBody:'tampered-'+i});
 const result=auditFixedR6RawRunSnapshot(db,{checkedAt:AT});
 assert.equal(result.metadataKeys,35);
 assert.equal(result.invalidBodyKeys,35);
 assert.equal(result.invalidReasonCounts.BODY_SHA_MISMATCH,35);
 assert.equal(result.invalidReasonOrdinals.length,32);
 assert.equal(result.invalidReasonTruncated,true);
 assert.doesNotMatch(JSON.stringify(result),/private-|original-|tampered-/);
 db.close();
});
test('wrong provider or future run cannot certify a valid snapshot',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 const item=snapshot(db,{requestKey:'forged-provider',body:'body'});
 run(db,item,{provider:'EMPLOYMENT_R6_OTHER'});
 run(db,item,{time:'2026-11-20T01:00:00.000Z'});
 const result=auditFixedR6RawRunSnapshot(db,{checkedAt:AT});
 assert.equal(result.bodyVerifiedKeys,1);
 assert.equal(result.runCertifiedKeys,0);
 assert.equal(result.validWithoutRunKeys,1);
 db.close();
});
test('missing approved columns remain unverified, never falsely certified',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE market_score_employment_r6_raw_snapshot_v1(snapshot_id TEXT)');
 const result=auditFixedR6RawRunSnapshot(db,{checkedAt:AT});
 assert.equal(result.status,'SCHEMA_UNAVAILABLE');
 assert.equal(result.runCertifiedKeys,null);
 db.close();
});
test('fixed installed path uses native readonly SQLite and leaves PC data unchanged',t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'w04-raw-audit-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const data=path.join(tmp,'ZGmini','data');
 const storage=path.join(data,'pc-writer','storage');
 fs.mkdirSync(storage,{recursive:true});
 const file=path.join(storage,'core.sqlite');
 const db=new DatabaseSync(file);schema(db);
 const item=snapshot(db,{requestKey:'real-path-test',body:'private source bytes'});
 run(db,item);db.close();
 const before=sha(fs.readFileSync(file));
 const result=inspectEmploymentR6RawRunLight(data,{now:()=>new Date(AT)});
 assert.equal(result.status,'PASS',JSON.stringify(result));
 assert.equal(result.code,'R6_RAW_RUN_AGGREGATE_READONLY');
 assert.equal(result.attestation.metadataKeys,1);
 assert.equal(result.attestation.runCertifiedKeys,1);
 assert.match(result.dbIdentityTag,/^[0-9a-f]{16}$/);
 assert.equal(result.sqliteOpened,true);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.equal(sha(fs.readFileSync(file)),before);
 assert.doesNotMatch(JSON.stringify(result),/private source bytes|PRIVATE_|real-path-test|snapshot_id|body_chunk/);
});

test('bounded mismatch lineage groups expose only safe month/provider/revision and counts',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 db.exec('ALTER TABLE market_score_employment_r4_shadow_runs_v1 ADD COLUMN collector_revision TEXT');
 const bad=snapshot(db,{requestKey:'PRIVATE-BAD-LINEAGE',body:'PRIVATE_BODY'});
 const raw='market_score_employment_r6_raw_snapshot_v1';
 db.prepare('UPDATE '+raw+' SET detail_json=? WHERE snapshot_id=?')
  .run(JSON.stringify({responseHash:'f'.repeat(64),privateToken:'PRIVATE_TOKEN'}),bad.id);
 db.prepare('INSERT INTO market_score_employment_r4_shadow_runs_v1 VALUES(?,?,?,?,?)')
  .run('EMPLOYMENT_R6_'+RELEASE,'SUCCESS','2026-11-18T02:00:00.000Z',
   JSON.stringify({rawSnapshots:[{snapshotId:bad.id,bodySha256:bad.hash}]}),'R6_TEST_1');
 const report=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 assert.equal(report.invalidReasonCounts.RESPONSE_HASH_VALUE_MISMATCH,1);
 assert.deepEqual(report.invalidLineageGroups,[{
  reason:'RESPONSE_HASH_VALUE_MISMATCH',provider:PROVIDER,releaseGroup:RELEASE,
  retrievedMonth:'2026-11',collectorRevision:'R6_TEST_1',count:1,
 }]);
 assert.equal(report.invalidLineageScope,'DIAGNOSTIC_NOT_PIT');
 assert.doesNotMatch(JSON.stringify(report),/PRIVATE_|PRIVATE-BAD|body_sha256|snapshotId|requestKey/);
 db.close();
});
test('mismatched BED-style response metadata still checks body and snapshot ID independently',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 const good=snapshot(db,{requestKey:'SECRET_GOOD',body:'{"status": "REQUEST_SUCCEEDED"}'});
 const broken=snapshot(db,{requestKey:'SECRET_BAD',body:'{"status": "REQUEST_SUCCEEDED"}',
  storedBody:'{"status":"CHANGED"}'});
 const raw='market_score_employment_r6_raw_snapshot_v1';
 for(const id of [good.id,broken.id])
  db.prepare('UPDATE '+raw+' SET detail_json=? WHERE snapshot_id=?')
   .run(JSON.stringify({responseHash:'f'.repeat(64),secret:'PRIVATE_CANONICAL'}),id);
 const report=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 assert.equal(report.invalidReasonCounts.RESPONSE_HASH_VALUE_MISMATCH,2);
 assert.equal(report.bodyVerifiedKeys,0);
 assert.deepEqual(report.mismatchIntegrity,{
  checked:2,bodyShaMatched:1,bodyShaMismatched:1,
  idMatched:2,idMismatched:0,
  scope:'INDEPENDENT_HASH_CHECKS_NOT_PIT',
 });
 assert.doesNotMatch(JSON.stringify(report),/SECRET_|PRIVATE_|CHANGED|REQUEST_SUCCEEDED|snapshotId|body_sha256/);
 db.close();
});

test('unlinked invalid snapshot has explicit UNLINKED lineage rather than fabricated revision',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 const bad=snapshot(db,{requestKey:'PRIVATE-UNLINKED',body:'private'});
 db.prepare('UPDATE market_score_employment_r6_raw_snapshot_v1 SET detail_json=? WHERE snapshot_id=?')
  .run(JSON.stringify({responseHash:'0'.repeat(64)}),bad.id);
 const result=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 assert.equal(result.invalidLineageGroups[0].collectorRevision,'UNLINKED');
 assert.equal(result.invalidLineageGroups[0].count,1);
 db.close();
});


function legacyBed(db,{key='BED_PRIVATE',storedBody=null,metadataHash=null,forgedId=false}={}){
 const payload={status:'REQUEST_SUCCEEDED',Results:{series:[{seriesID:'PRIVATE_SERIES',data:[]}]}};
 const body=JSON.stringify(payload,null,2);
 const stable=x=>x&&typeof x==='object'?(Array.isArray(x)?x.map(stable):
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])]))):x;
 const hash=sha(body),id=forgedId?'f'.repeat(64):sha(['BLS_BED','BLS_BED',key,hash].join('|'));
 db.prepare('INSERT INTO market_score_employment_r6_raw_snapshot_v1 VALUES(?,?,?,?,?,?,?,?,?,?,?)')
  .run(id,0,1,'BLS_BED','BLS_BED',key,'2026-11-18T01:00:00.000Z',
   '2026-11-18T01:00:01.000Z',hash,JSON.stringify({responseHash:metadataHash??sha(JSON.stringify(stable(payload)))}),storedBody??body);
 run(db,{id,hash},{provider:'EMPLOYMENT_R6_BLS_BED'});
 return {id,hash};
}
test('legacy BED canonical difference is independently proved without rewriting or PIT promotion',()=>{
 const db=new DatabaseSync(':memory:');schema(db);legacyBed(db);
 const before=db.prepare('SELECT * FROM market_score_employment_r6_raw_snapshot_v1').all();
 const r=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 assert.deepEqual(r.legacyBedProof,{examined:1,canonicalMatched:1,canonicalMismatched:0,
  invalidJson:0,bodyOrIdInvalid:0,runLinked:1,scope:'LEGACY_BED_CANONICAL_COMPATIBILITY_NOT_PIT'});
 assert.equal(r.bodyVerifiedKeys,0);assert.equal(r.runCertifiedKeys,0);
 assert.equal(r.invalidReasonCounts.RESPONSE_HASH_VALUE_MISMATCH,1);
 assert.deepEqual(db.prepare('SELECT * FROM market_score_employment_r6_raw_snapshot_v1').all(),before);
 assert.doesNotMatch(JSON.stringify(r),/BED_PRIVATE|PRIVATE_SERIES|snapshotId|body_sha256/);db.close();
});
test('legacy compatibility never excuses tampered bytes, identity, wrong metadata or an unrelated source',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 legacyBed(db,{key:'bad-body',storedBody:'changed'});
 legacyBed(db,{key:'bad-id',forgedId:true});
 legacyBed(db,{key:'bad-canonical',metadataHash:'e'.repeat(64)});
 const other=snapshot(db,{requestKey:'NON_BED',body:'{"status":"REQUEST_SUCCEEDED","Results":{"series":[]}}'});
 db.prepare('UPDATE market_score_employment_r6_raw_snapshot_v1 SET detail_json=? WHERE snapshot_id=?')
  .run(JSON.stringify({responseHash:'d'.repeat(64)}),other.id);
 const r=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 assert.equal(r.legacyBedProof.examined,3);assert.equal(r.legacyBedProof.bodyOrIdInvalid,2);
 assert.equal(r.legacyBedProof.canonicalMismatched,1);assert.equal(r.legacyBedProof.runLinked,0);
 assert.equal(r.legacyBedProof.canonicalMatched,0);assert.equal(r.runCertifiedKeys,0);db.close();
});
test('missing History source links are scoped to each key and independent of unrelated BED failures',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 const item=snapshot(db,{requestKey:'claims',body:'PRIVATE_CLAIMS'});run(db,item);
 legacyBed(db,{metadataHash:'e'.repeat(64)});
 const columns='logical_series_id TEXT,geography_type TEXT,geography_code TEXT,observation_date TEXT,'+
  'provider TEXT,source_hash TEXT,retrieved_at TEXT,available_at TEXT,provenance_json TEXT';
 db.exec('CREATE TABLE market_score_employment_r4_shadow_current_v1('+columns+');'+
  'CREATE TABLE market_score_employment_r4_shadow_history_v1('+columns+');');
 const insert=db.prepare('INSERT INTO market_score_employment_r4_shadow_current_v1 VALUES(?,?,?,?,?,?,?,?,?)');
 const h='a'.repeat(64),p=JSON.stringify({rawRecordHash:h,responseHash:item.hash});
 for(const state of ['CA','NY','TX','MA'])
  insert.run('STATE_CONTINUED_CLAIMS','STATE',state,'2026-10-31','DOL',h,
   '2026-11-18T01:00:00.000Z',state==='NY'?null:'2026-11-10T01:00:00.000Z',p);
 db.exec("INSERT INTO market_score_employment_r4_shadow_history_v1 SELECT * FROM market_score_employment_r4_shadow_current_v1 WHERE geography_code='MA'");
 db.prepare('UPDATE market_score_employment_r4_shadow_current_v1 SET provenance_json=? WHERE geography_code=?')
  .run(JSON.stringify({responseHash:item.hash,rawRecordHash:'b'.repeat(64)}),'TX');
 const r=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 const v=r.missingHistoryLineage;
 assert.equal(v.missingHistoryKeys,3);assert.equal(v.groups.length,1);
 assert.equal(v.groups[0].rawRunLinked,2);assert.equal(v.groups[0].metadataInvalid,1);
 assert.equal(v.groups[0].availableTimeMissing,1);assert.equal(v.pitAttested,false);
 assert.equal(v.repairAuthorized,false);assert.equal(v.rawRecordValuesReparsed,false);
 assert.doesNotMatch(JSON.stringify(v),/PRIVATE_|CA|NY|geography_code|provenance_json/);
 db.close();
});
test('a run cannot attest future snapshots and the reader does not pretend to reconstruct lost historic availability',()=>{
 const db=new DatabaseSync(':memory:');schema(db);const x=legacyBed(db);
 db.exec('DELETE FROM market_score_employment_r4_shadow_runs_v1');
 run(db,x,{provider:'EMPLOYMENT_R6_BLS_BED',time:'2026-11-17T01:00:00.000Z'});
 const r=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 assert.equal(r.legacyBedProof.canonicalMatched,1);assert.equal(r.legacyBedProof.runLinked,0);
 assert.equal(r.runCertifiedKeys,0);assert.equal(r.missingHistoryLineage.status,'SCHEMA_UNAVAILABLE');db.close();
});


test('W04 state claims bounded weekly missing History is not PIT attestation',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 const raw=snapshot(db,{requestKey:'PRIVATE_WEEK_EXAMPLE',body:'PRIVATE_WEEK_PAYLOAD'});
 run(db,raw);
 const cols='logical_series_id TEXT,geography_type TEXT,geography_code TEXT,observation_date TEXT,'+
  'provider TEXT,source_hash TEXT,retrieved_at TEXT,available_at TEXT,provenance_json TEXT';
 db.exec('CREATE TABLE market_score_employment_r4_shadow_current_v1('+cols+');'+
  'CREATE TABLE market_score_employment_r4_shadow_history_v1('+cols+');');
 const insert=db.prepare('INSERT INTO market_score_employment_r4_shadow_current_v1 VALUES(?,?,?,?,?,?,?,?,?)');
 const metaHash='a'.repeat(64);
 const metadata=JSON.stringify({rawRecordHash:metaHash,responseHash:raw.hash,secret:'PRIVATE_METADATA'});
 const weeks=Array.from({length:20},(_,i)=>
  new Date(Date.UTC(2026,10,14-7*i)).toISOString().slice(0,10));
 for(const week of weeks){
  for(const state of ['CA','NY']){
   insert.run('STATE_INITIAL_CLAIMS','STATE',state,week,'DOL_ETA',metaHash,
    '2026-11-18T01:00:00.000Z',null,metadata);
  }
 }
 db.exec("INSERT INTO market_score_employment_r4_shadow_history_v1 "+
  "SELECT * FROM market_score_employment_r4_shadow_current_v1 "+
  "WHERE geography_code='CA' AND observation_date='2026-11-14'");
 insert.run('STATE_INITIAL_CLAIMS','STATE','TX','2026-02-30','DOL_ETA',metaHash,
  '2026-11-18T01:00:00.000Z',null,metadata);
 const report=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 const group=report.missingHistoryLineage.groups.find(x=>
  x.provider==='DOL_ETA'&&x.logicalSeriesId==='STATE_INITIAL_CLAIMS');
 assert.equal(report.missingHistoryLineage.missingHistoryKeys,40);
 assert.equal(group.missingHistoryKeys,40);
 assert.equal(group.observedMissingWeeks,20);
 assert.equal(group.earliestMissingWeek,weeks.at(-1));
 assert.equal(group.latestMissingWeek,'2026-11-14');
 assert.deepEqual(group.latestMissingWeekCounts[0],{week:'2026-11-14',missingKeys:1});
 assert.equal(group.latestMissingWeekCounts.length,20);
 assert.equal(group.latestMissingWeekCounts[1].missingKeys,2);
 assert.equal(group.missingWeekCountsTruncated,false);
 assert.equal(group.invalidWeekDateKeys,1);
 assert.equal(group.weekScope,'CURRENT_ONLY_KEYS_NOT_PIT');
 assert.equal(report.missingHistoryLineage.pitAttested,false);
 assert.equal(report.missingHistoryLineage.repairAuthorized,false);
 assert.doesNotMatch(JSON.stringify(group),
  /PRIVATE_|geography_code|provenance_json|responseHash|snapshotId|body_sha256/);
 db.close();
});

test('W04 57 weekly bins return exact 2,880-key aggregate and stay capped at 64',()=>{
 const db=new DatabaseSync(':memory:');schema(db);
 const raw=snapshot(db,{requestKey:'wk57',
  body:'RAW_FIXTURE_ONLY'});run(db,raw);
 const cols='logical_series_id TEXT,geography_type TEXT,geography_code TEXT,observation_date TEXT,'+
  'provider TEXT,source_hash TEXT,retrieved_at TEXT,available_at TEXT,provenance_json TEXT';
 db.exec('CREATE TABLE market_score_employment_r4_shadow_current_v1('+cols+');'+
  'CREATE TABLE market_score_employment_r4_shadow_history_v1('+cols+');');
 const insert=db.prepare('INSERT INTO market_score_employment_r4_shadow_current_v1 VALUES(?,?,?,?,?,?,?,?,?)');
 const hash='a'.repeat(64),meta=JSON.stringify({rawRecordHash:hash,
  responseHash:raw.hash,fixtureMarker:'DUMMY'});
 const date=i=>new Date(Date.UTC(2025,6,26+7*i)).toISOString().slice(0,10);
 const regions=Array.from({length:51},(_,i)=>'REGION_'+String(i).padStart(2,'0'));
 for(let w=0;w<57;w++){
  for(const region of regions.slice(0,w===56?24:51))
   insert.run('STATE_INITIAL_CLAIMS','STATE',region,date(w),'DOL_ETA',hash,
    '2026-11-18T01:00:00.000Z',null,meta);
 }
 const report=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 const v=report.missingHistoryLineage,group=v.groups.find(x=>
  x.provider==='DOL_ETA'&&x.logicalSeriesId==='STATE_INITIAL_CLAIMS');
 assert.equal(v.missingHistoryKeys,2880);
 assert.equal(group.missingHistoryKeys,2880);
 assert.equal(group.observedMissingWeeks,57);
 assert.equal(group.earliestMissingWeek,'2025-07-26');
 assert.equal(group.latestMissingWeek,'2026-08-22');
 assert.equal(group.missingWeekCountsTruncated,false);
 assert.deepEqual(group.latestMissingWeekCounts,Array.from({length:57},(_,i)=>({
  week:date(56-i),missingKeys:i===0?24:51,
 })));
 assert.equal(group.latestMissingWeekCounts.reduce((n,x)=>n+x.missingKeys,0),2880);
 assert.equal(v.pitAttested,false);assert.equal(v.repairAuthorized,false);
 assert.ok(Buffer.byteLength(JSON.stringify(report))<32768);
 assert.doesNotMatch(JSON.stringify(report),/wk57|RAW_FIXTURE_ONLY|DUMMY|REGION_\d\d|geography_code|provenance_json/);
 // Output remains bounded when the SQLite query observes more than 64 weeks.
 for(let w=-13;w<0;w++)
  insert.run('STATE_INITIAL_CLAIMS','STATE','REGION_00',date(w),'DOL_ETA',hash,
   '2026-11-18T01:00:00.000Z',null,meta);
 const more=auditFixedR6RawRunSnapshot(db,{checkedAt:AT,includeInvalidLineage:true});
 const bounded=more.missingHistoryLineage.groups.find(x=>
  x.provider==='DOL_ETA'&&x.logicalSeriesId==='STATE_INITIAL_CLAIMS');
 assert.equal(bounded.observedMissingWeeks,70);
 assert.equal(bounded.latestMissingWeekCounts.length,64);
 assert.equal(bounded.missingWeekCountsTruncated,true);
 assert.deepEqual(bounded.latestMissingWeekCounts[0],{week:'2026-08-22',missingKeys:24});
 assert.equal(more.missingHistoryLineage.pitAttested,false);
 assert.ok(Buffer.byteLength(JSON.stringify(more))<32768);
 db.close();
});
