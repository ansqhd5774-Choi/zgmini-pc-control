import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {readbackServiceSnapshot,validateChildSummary,childResultLogPath} from './once.mjs';
import {validateIssue,validateApproval,SCHEMA,OPERATION,MANIFEST,INSTALLED_SHA,
 FILES,SOURCE_ROOT,DATA_ROOT,sha256,sanitizedCode,validateInstalledBinding} from './contract.mjs';
import {sanitizedReport,upload} from './report.mjs';
import {readApprovalBytes} from './approval-bytes.mjs';

const requestId='pc-w05-r304-11111111-2222-4333-8444-555555555555';
const chatId='chat-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const makeEvent=(body={})=>({action:'opened',
 repository:{private:true,full_name:'ansqhd5774-Choi/zgmini-pc-control'},
 sender:{login:'ansqhd5774-Choi'},
 issue:{number:123,title:'pc-w05-r304-service-once',user:{login:'ansqhd5774-Choi'},
 labels:[{name:'pc-writer-b-install'}],body:JSON.stringify({
 schema:SCHEMA,requestId,chatId,operation:OPERATION,
 approvalPath:MANIFEST,approvalSha256:'1'.repeat(64),...body})}});
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1'};

function approved(){
 return {schema:'ZGMINI_W05_R304_SERVICE_B_APPROVAL_V1',
  status:'APPROVED_B',scope:'W05_WPSFD42_BLS_ONCE_EXISTING_SQLITE_APPEND',
  sourceRepository:'ansqhd5774-Choi/zgmini',installedSourceSha:INSTALLED_SHA,
  sourceRoot:SOURCE_ROOT,dataRoot:DATA_ROOT,files:FILES,series:'WPSFD42',
  startYear:2025,endYear:2026,maxProviderRequests:1,runCount:1,
  allowSqliteAppend:true,allowD1Writes:false,allowTaskChanges:false,
  allowSchemaChanges:false,allowOtherSources:false,allowNewSchedulers:false};
}
test('rejects unapproved actor, post-label, request path and replay',()=>{
 assert.equal(validateIssue(makeEvent(),env).requestId,requestId);
 assert.throws(()=>validateIssue({...makeEvent(),sender:{login:'other'}},env),/W05_B_REQUEST_OR_ACTOR_DENIED/);
 assert.throws(()=>validateIssue({...makeEvent(),action:'labeled'},env),/W05_B_REQUEST_OR_ACTOR_DENIED/);
 assert.throws(()=>validateIssue({...makeEvent(),issue:{...makeEvent().issue,labels:[]}},env),/W05_B_REQUEST_OR_ACTOR_DENIED/);
 assert.throws(()=>validateIssue(makeEvent({approvalPath:'../wrong'}),env),/W05_B_REQUEST_CONTRACT_STOP/);
 assert.throws(()=>validateIssue(makeEvent(),{...env,GITHUB_RUN_ATTEMPT:'2'}),/W05_B_REQUEST_OR_ACTOR_DENIED/);
});

test('approval uses the exact pinned Git blob, independent of checkout line endings',()=>{
 const raw=Buffer.from(JSON.stringify(approved(),null,2)+'\n');
 const fromGit=readApprovalBytes({controlRoot:'fixture-root',runGit:(_exe,args,opts)=>{
  assert.deepEqual(args,['-C','fixture-root','cat-file','blob','HEAD:'+MANIFEST]);
  assert.equal(opts.shell,false);return raw;
 }});
 assert.equal(validateApproval(fromGit,{approvalSha256:sha256(raw)}).status,'APPROVED_B');
 const crlf=Buffer.from(raw.toString().replace(/\n/g,'\r\n'));
 assert.notEqual(sha256(crlf),sha256(raw));
 assert.throws(()=>validateApproval(crlf,{approvalSha256:sha256(raw)}),/APPROVAL_BYTES_STOP/);
});
test('rejects proposed approval, changed source, broad provider effect and wrong raw hash',()=>{
 const good=approved(),raw=Buffer.from(JSON.stringify(good));
 assert.equal(validateApproval(raw,{approvalSha256:sha256(raw)}).status,'APPROVED_B');
 assert.throws(()=>validateApproval(raw,{approvalSha256:'b'.repeat(64)}),/W05_B_APPROVAL_BYTES_STOP/);
 for(const item of [
  {...good,status:'PROPOSED_NOT_APPROVED'},
  {...good,installedSourceSha:'0'.repeat(40)},
  {...good,allowD1Writes:true},
  {...good,allowSchemaChanges:true},
  {...good,series:'WPSFD41'},
  {...good,maxProviderRequests:2},
  {...good,files:{...good.files,'scripts/pc-writer/other.mjs':'b'.repeat(64)}},
 ]){
  const bytes=Buffer.from(JSON.stringify(item));
  assert.throws(()=>validateApproval(bytes,{approvalSha256:sha256(bytes)}),
   /W05_B_EFFECT_NOT_APPROVED/);
 }
});
test('publisher permits only bounded metadata, never raw data or secret keys',()=>{
 const clean={schema:'ZGMINI_W05_R304_SERVICE_B_RESULT_V1',
  status:'BLOCKED',code:'W05_B_EFFECT_NOT_APPROVED',requestId,
  sourceSha:INSTALLED_SHA,provider:'BLS',series:'WPSFD42',
  providerCalls:'NOT_CONFIRMED',dbWrites:'NOT_CONFIRMED',
  d1Writes:0,schedulerChanges:0,automaticRetries:0};
 assert.equal(sanitizedReport(clean,requestId).status,'BLOCKED');
 assert.throws(()=>sanitizedReport(clean,requestId,{expectedSourceSha:'c'.repeat(40)}),/REPORT_CONTRACT_STOP/);
 assert.throws(()=>sanitizedReport({...clean,payloadJson:'secret'},requestId),
  /W05_B_REPORT_CONTRACT_STOP/);
 assert.throws(()=>sanitizedReport({...clean,d1Writes:1},requestId),
  /W05_B_REPORT_CONTRACT_STOP/);
 assert.throws(()=>sanitizedReport({...clean,providerCalls:'KEY=secret'},requestId),
  /W05_B_REPORT_CONTRACT_STOP/);
 assert.throws(()=>sanitizedReport({...clean,observationAt:'2026-13-01'},requestId),
  /W05_B_REPORT_CONTRACT_STOP/);
 assert.equal(sanitizedCode('NOT_SAFE'),'W05_B_UNEXPECTED_STOP');
});

test('reviewed manifest may pin a newer checkout without editing executable source constants',()=>{
 const doc={...approved(),installedSourceSha:'c'.repeat(40)};
 const raw=Buffer.from(JSON.stringify(doc));
 const valid=validateApproval(raw,{approvalSha256:sha256(raw)});
 assert.equal(validateInstalledBinding(valid,{head:doc.installedSourceSha,
  configSource:doc.installedSourceSha,fileSha256:FILES}),doc.installedSourceSha);
 assert.throws(()=>validateInstalledBinding(valid,{head:INSTALLED_SHA,
  configSource:INSTALLED_SHA,fileSha256:FILES}),/INSTALLED_SOURCE_SHA_DRIFT/);
 assert.throws(()=>validateInstalledBinding(valid,{head:doc.installedSourceSha,
  configSource:INSTALLED_SHA,fileSha256:FILES}),/CONFIG_SOURCE_DRIFT/);
 assert.throws(()=>validateInstalledBinding(valid,{head:doc.installedSourceSha,
  configSource:doc.installedSourceSha,fileSha256:{...FILES,[Object.keys(FILES)[0]]:'d'.repeat(64)}}),/FILE_HASH_DRIFT/);
 const unapproved=Buffer.from(JSON.stringify({...doc,status:'PROPOSED_NOT_APPROVED'}));
 assert.throws(()=>validateApproval(unapproved,{approvalSha256:sha256(unapproved)}),/EFFECT_NOT_APPROVED/);
});

test('validates collector summary and rejects missing service confirmation',()=>{
 assert.equal(validateChildSummary('TXT_CREATED=EARNINGS_BLS_SERVICE_R1_RESULT_20261119-024500Z.txt\nRESULT=PASS_R3C_MANUAL_BLS_PERSISTED\n'),
  'EARNINGS_BLS_SERVICE_R1_RESULT_20261119-024500Z.txt');
 assert.throws(()=>validateChildSummary('RESULT=PASS_R3C_MANUAL_BLS_PERSISTED'),
  /W05_B_CHILD_RESULT_UNVERIFIED_STOP/);
});
test('BLS child receipt follows Windows Node TMP-over-TEMP precedence',()=>{
 const filename='EARNINGS_BLS_SERVICE_R1_RESULT_20261119-120000Z.txt';
 const tmp=path.join(os.tmpdir(),'w05-tmp-source');
 const temp=path.join(os.tmpdir(),'w05-temp-other');
 assert.equal(childResultLogPath(filename,{TMP:tmp,TEMP:temp}),path.join(tmp,filename));
 assert.equal(childResultLogPath(filename,{TMP:'',TEMP:temp}),path.join(temp,filename));
 assert.throws(()=>childResultLogPath('../result.txt',{TMP:tmp,TEMP:temp}),
  /W05_B_CHILD_RESULT_NAME_STOP/);
 assert.throws(()=>childResultLogPath(filename,{TMP:'relative-dir'}),
  /W05_B_TEMP_ROOT_STOP/);
});

test('simulated SQLite chunk and immutable snapshot SHA readback is fail-closed',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'w05-r304-fixture-'));
 const target=path.join(folder,'sample.sqlite');
 const db=new DatabaseSync(target);
 try{
  db.exec(`CREATE TABLE api_history_chunks_v1(
   provider TEXT,dataset TEXT,chunk_sha256 TEXT,payload_json TEXT,row_count INTEGER,first_seen_at TEXT);
   CREATE TABLE api_history_snapshots_v1(
   provider TEXT,dataset TEXT,snapshot_sha256 TEXT,chunk_hashes_json TEXT,row_count INTEGER,
   retrieved_at TEXT,status TEXT,history_mode TEXT,latest_observation_date TEXT,provenance_json TEXT);`);
  const rows=[{seriesID:'WPSFD42',value:125.6,observationDate:'2026-08-01'}];
  const chunkJson=JSON.stringify(rows),chunkHash=sha256(Buffer.from(chunkJson));
  const stamp='2026-11-19T02:45:00.000Z';
  const contract='EARNINGS_COMPANION_R3C_BLS_DIRECT_V1';
  const snapHash=sha256(Buffer.from(JSON.stringify({contract,provider:'BLS',
   dataset:'WPSFD42',frequency:'MONTHLY',seasonalAdjustment:'SA',chunks:[chunkHash]})));
  const provenance=JSON.stringify({authority:'US_BLS',seriesID:'WPSFD42',
   contract,retrievedAt:stamp});
  db.prepare('INSERT INTO api_history_chunks_v1 VALUES(?,?,?,?,?,?)').run(
    'BLS','WPSFD42',chunkHash,chunkJson,1,stamp);
  db.prepare('INSERT INTO api_history_snapshots_v1 VALUES(?,?,?,?,?,?,?,?,?,?)').run(
    'BLS','WPSFD42',snapHash,JSON.stringify([chunkHash]),1,stamp,
    'READY_DIRECT_BLS',contract,'2026-08-01',provenance);
  const saved=readbackServiceSnapshot(target);
  assert.equal(saved.rows,1);
  assert.equal(saved.snapshotSha256,snapHash);
  assert.equal(saved.retrievedAt,stamp);
  assert.equal(saved.firstSeenAt,stamp);
  db.prepare('UPDATE api_history_chunks_v1 SET payload_json=?').run('[]');
  assert.throws(()=>readbackServiceSnapshot(target),/W05_B_SQLITE_CHUNK_READBACK_STOP/);
 }finally{db.close();fs.rmSync(folder,{recursive:true,force:true});}
});

test('no local B result produces safe STATE_UNKNOWN JSON/TXT 2/2, not silent success',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'w05-r304-report-'));
 try{
  const eventPath=path.join(folder,'event.json');
  fs.writeFileSync(eventPath,JSON.stringify(makeEvent()));
  const saved=new Map();
  const fakeFetch=async(url,options)=>{
   if(url.endsWith('/comments'))return {status:201,ok:true};
   if(options.method==='PUT'){
    if(saved.has(url))return {status:422,ok:false};
    const body=JSON.parse(options.body);
    saved.set(url,body.content);
    return {status:201,ok:true};
   }
   const readUrl=url.replace(/\?ref=main$/,'');
   if(!saved.has(readUrl))return {status:404,ok:false};
   return {status:200,ok:true,json:async()=>({encoding:'base64',
    content:saved.get(readUrl)})};
  };
  const cfg={...env,GITHUB_EVENT_PATH:eventPath,RUNNER_TEMP:folder,
   GITHUB_TOKEN:'local-test-fake-token-no-network-12345'};
  const result=await upload(cfg,fakeFetch);
  assert.equal(result.status,'RESULT_PAIR_READBACK_VERIFIED');
  assert.equal(saved.size,2);
  const jsonURL=[...saved.keys()].find(x=>x.endsWith('.json'));
  const body=JSON.parse(Buffer.from(saved.get(jsonURL),'base64').toString('utf8'));
  assert.equal(body.status,'STATE_UNKNOWN');
  assert.equal(body.code,'W05_B_LOCAL_RESULT_MISSING_STOP');
  fs.writeFileSync(path.join(folder,'W05_R304_B_RESULT.json'),
   '{"status":"PASS","providerCalls":99,"secret":"do-not-upload"}');
  saved.clear();
  await upload(cfg,fakeFetch);
  const second=JSON.parse(Buffer.from(saved.get(jsonURL),'base64').toString('utf8'));
  assert.equal(second.status,'STATE_UNKNOWN');
  assert.equal(second.code,'W05_B_LOCAL_RESULT_UNVERIFIED_STOP');
  assert.equal(JSON.stringify(second).includes('do-not-upload'),false);
 }finally{fs.rmSync(folder,{recursive:true,force:true})}
});


test('manifest approval lifecycle may advance without changing executable source or widening effect',()=>{
 // PC A #2704 / Run 45013225693: sourceHead=config.source=checkpoint and
 // exact 3 W05 file hashes. This test NEVER authorizes a provider/DB effect.
 assert.equal(INSTALLED_SHA,'1e52876f5112c4a58a43273d264588755b7b9402');
 assert.deepEqual(FILES,{
  'scripts/pc-writer/EARNINGS_R3C_BLS_STORE_ONCE.mjs':'87e811b608ea7358c48aceebfe458e24e5887f2f31207481783abcad516a1af3',
  'scripts/pc-writer/EARNINGS_R3D_STORED_BLS_CALC_READONLY.mjs':'b441a52551a015ab9522280ee7c3f620fc8efd967c8dd0e6e04865bb72c97b31',
  'scripts/pc-writer/EARNINGS_R4_C_READ_MODEL_PREVIEW_READONLY.mjs':'f3f6e41b3b61039580db7ab7f6bed3133eb305ffef35e4b4b7ea919e0220ea77'
 });
 const raw=fs.readFileSync(new URL('../approvals/w05-r304-service-b/approval.json',import.meta.url));
 const proposed=JSON.parse(raw.toString('utf8'));
 assert.ok(['PROPOSED_NOT_APPROVED','APPROVED_B'].includes(proposed.status));
 assert.match(proposed.installedSourceSha,/^[a-f0-9]{40}$/);
 assert.notEqual(proposed.installedSourceSha,'0'.repeat(40));
 assert.deepEqual(proposed.files,FILES);
 if(proposed.status==='PROPOSED_NOT_APPROVED')
  assert.throws(()=>validateApproval(raw,{approvalSha256:sha256(raw)}),/W05_B_EFFECT_NOT_APPROVED/);
 else assert.equal(validateApproval(raw,{approvalSha256:sha256(raw)}).status,'APPROVED_B');
});
