import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {inspectPcInflation19,validateRequest,verifyApproval,APPROVAL,PC_HOME,
  ISSUE_TITLE,REQUEST_SCHEMA,CONTROL_REPO} from './inflation-19-inventory-b-once.mjs';

const mk=fn=>{
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'inflation19-inventory-'));
  const home=path.join(parent,'pc-writer');fs.mkdirSync(home);
  try{fn({parent,home});}finally{fs.rmSync(parent,{recursive:true,force:true});}
};
const rows=(count,startYear=2000)=>Array.from({length:count},(_,i)=>({
  observationDate:`${startYear+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`,value:1+i/10,
}));
const save=(root,relative,data)=>{
  const file=path.join(root,...relative.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));return file;
};
const createDb=home=>{
  const filename=path.join(home,'storage','core.sqlite');fs.mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec(`CREATE TABLE market_input_batches_v1 (batch_key TEXT, body TEXT, stored_at INTEGER);
    CREATE TABLE api_history_snapshots_v1 (provider TEXT,dataset TEXT,
      snapshot_sha256 TEXT, as_of TEXT,retrieved_at TEXT,status TEXT,
      history_mode TEXT,row_count INTEGER,latest_observation_date TEXT,
      chunk_hashes_json TEXT,provenance_json TEXT);
    CREATE TABLE api_history_chunks_v1 (provider TEXT,dataset TEXT,
      chunk_sha256 TEXT,row_count INTEGER);`);
  return db;
};

test('no saved evidence is reported as UNVERIFIED; no database is created',()=>mk(({home})=>{
  const result=inspectPcInflation19(home);
  assert.equal(result.status,'PASS');assert.equal(result.counts.saved,0);
  assert.equal(Object.keys(result.inputs).length,19);
  assert.equal(result.inputs['21'].status,'UNVERIFIED');
  assert.equal(result.excluded20,'EXCLUDED_BY_USER');
  assert.equal(fs.existsSync(path.join(home,'storage','core.sqlite')),false);
  assert.equal(result.dbWrites,0);assert.equal(result.providerCalls,0);
}));

test('stored macro gzip and exact PIT linked chunks are counted without raw values',()=>mk(({home})=>{
  const db=createDb(home);
  const macro={series:{DTWEXBGS:rows(30),MCOILWTICO:rows(31)}};
  db.prepare('INSERT INTO market_input_batches_v1 VALUES (?,?,?)').run('macro:2026-10-31',
    'gzip:'+gzipSync(JSON.stringify(macro)).toString('base64'),Date.UTC(2026,9,31));
  const hash='a'.repeat(64);
  db.prepare('INSERT INTO api_history_snapshots_v1 VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    'FRED','CES0500000003','b'.repeat(64),'2026-10-31','2026-11-01T00:00:00.000Z',
    'READY_INITIAL_RELEASE_HISTORY','INITIAL_RELEASE_ONLY',25,'2026-09-01',JSON.stringify([hash]),'{}');
  db.prepare('INSERT INTO api_history_chunks_v1 VALUES (?,?,?,?)').run('FRED','CES0500000003',hash,25);
  db.close();
  const result=inspectPcInflation19(home);
  assert.equal(result.inputs['18'].status,'SAVED_VERIFIED');
  assert.equal(result.inputs['1'].count,31);
  assert.equal(result.inputs['12'].status,'SAVED_VERIFIED');
  assert.equal(result.inputs['12'].count,25);
  assert.equal(result.inputs['13'].status,'UNVERIFIED');
  assert.equal(JSON.stringify(result).includes('3.9'),false);
}));

test('corrupt gzip and incomplete PIT chunk stay UNVERIFIED without clearing other input',()=>mk(({home})=>{
  const db=createDb(home);
  db.prepare('INSERT INTO market_input_batches_v1 VALUES (?,?,?)').run('macro:2026-10-31','gzip:invalid',1);
  db.prepare('INSERT INTO api_history_snapshots_v1 VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    'FRED','MCOILWTICO','b'.repeat(64),'2026-10-31','2026-11-01T00:00:00.000Z',
    'READY_INITIAL_RELEASE_HISTORY','INITIAL_RELEASE_ONLY',25,'2026-09-01',JSON.stringify(['a'.repeat(64)]),'{}');
  db.close();
  const result=inspectPcInflation19(home);
  assert.equal(result.inputs['1'].status,'UNVERIFIED');
  assert.equal(result.inputs['18'].status,'UNVERIFIED');
  assert.equal(result.status,'PASS');
}));

test('GSCPI requires source, full chronological parsed data, and matching archive manifest',()=>mk(({home})=>{
  save(home,'supply-r10/gscpi.json',{source:'NY_FED_GSCPI',rows:rows(180,2000)});
  let result=inspectPcInflation19(home);
  assert.equal(result.inputs['21'].status,'PARTIAL_SAVED');
  const raw=save(home,'supply-r10/gscpi.xlsx',Buffer.concat([
    Buffer.from('d0cf11e0a1b11ae1','hex'),Buffer.alloc(504)]));
  assert.equal(Boolean(raw),true);
  save(home,'supply-r10/extra-manifest.json',[{id:'gscpi',status:'STORED'}]);
  result=inspectPcInflation19(home);
  assert.equal(result.inputs['21'].status,'SAVED_VERIFIED');
  assert.equal(result.inputs['21'].count,180);
}));

test('SCE existing archive and PCE supply rows report independent evidence',()=>mk(({home})=>{
  const raw=Buffer.from('fake workbook for hash integrity fixture');
  const hash=createHash('sha256').update(raw).digest('hex');
  save(home,'inflation-causal/sce31/latest.json',{source:'NY_FED_SCE_ONE_YEAR_MEDIAN',
    status:'STORED',count:160,latestMonth:'2026-09-01',downloadSha256:hash,fetchedAt:'2026-11-04T04:41:52.103Z'});
  save(home,`inflation-causal/sce31/${hash}.xlsx`,raw);
  save(home,`inflation-causal/sce31/${hash}.json`,'existing parsed rows');
  save(home,'supply-r10/DPCERA3M086SBEA.json',{source:'FRED',rows:rows(29)});
  save(home,'supply-r10/DPCERA3M086SBEA.csv','date,value\n2026-09,102');
  save(home,'supply-r10/extra-manifest.json',[{id:'DPCERA3M086SBEA',status:'STORED'}]);
  const result=inspectPcInflation19(home);
  assert.equal(result.inputs['31'].status,'SAVED_VERIFIED');
  assert.equal(result.inputs['26'].status,'SAVED_VERIFIED');
  assert.equal(result.counts.saved,2);
}));

test('strict issue admission prevents untrusted author, extra arguments and malformed requests',()=>{
  const uuid='123e4567-e89b-42d3-a456-426614174000';
  const controlSha='a'.repeat(40);
  const env={GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:controlSha};
  const event={action:'opened',repository:{private:true},issue:{title:ISSUE_TITLE,user:{login:'ansqhd5774-Choi'},
    body:JSON.stringify({schema:REQUEST_SCHEMA,operation:'readonly-private-inventory-once',
      requestId:`pc-inflation19-${uuid}`,chatId:`chat-${uuid}`,controlSha})}};
  assert.equal(validateRequest(event,env).requestId,`pc-inflation19-${uuid}`);
  assert.throws(()=>validateRequest(event,{...env,GITHUB_ACTOR:'unauthorized'}),/ISSUE_DENIED/);
  assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify({schema:REQUEST_SCHEMA,operation:'readonly-private-inventory-once',
    requestId:`pc-inflation19-${uuid}`,chatId:`chat-${uuid}`,controlSha,command:'cmd'})}},env),/REQUEST_DENIED/);
});

test('private approval rejects wrong hash and unverifiable source bytes',()=>mk(({parent})=>{
  const workspace=path.join(parent,'runner');fs.mkdirSync(path.join(workspace,'control'),{recursive:true});
  const script=fs.readFileSync(new URL('./inflation-19-inventory-b-once.mjs',import.meta.url));
  const actual=createHash('sha256').update(script).digest('hex');
  const fields={schema:'ZGMINI_INFLATION_19_B_APPROVAL_V1',scope:'PRIVATE_READONLY_STORED_INPUT_INVENTORY',
    dataHome:PC_HOME,inputCount:19,maxProviderRequests:0,maxAutomaticRetries:0,
    coreWrites:false,dbWrites:false,d1Writes:false,schedulerWrites:false};
  save(workspace,`control/${APPROVAL}`,{...fields,scriptSha256:'f'.repeat(64)});
  save(workspace,'control/inflation-19-inventory-b-once.mjs',script);
  assert.throws(()=>verifyApproval(workspace),/SOURCE_HASH_DENIED/);
  save(workspace,`control/${APPROVAL}`,{...fields,scriptSha256:actual});
  assert.equal(verifyApproval(workspace).inputCount,19);
}));

test('unsafe symlink writer path is refused without touching external targets',()=>mk(({parent,home})=>{
  const target=path.join(parent,'other-pc-writer');fs.mkdirSync(target);
  fs.rmSync(home,{recursive:true});
  fs.symlinkSync(target,home,'dir');
  const result=inspectPcInflation19(home);
  assert.equal(result.status,'BLOCKED');
  assert.equal(fs.readdirSync(target).length,0);
}));
