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
