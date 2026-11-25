import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {inspectER1DecemberSavedEvidence} from '../controller/market-calendar-er1-dec31-evidence-readonly.mjs';
import {inspectWriterPublicationEvidence} from '../controller/writer-publication-evidence-readonly.mjs';

const clock=Date.parse('2026-11-25T09:00:00Z');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-er1-dec31-a-'));
 const home=path.join(root,'pc-writer'),input=path.join(home,'er1-input');
 const days=path.join(input,'dec31-forward-days'),storage=path.join(home,'storage');
 for(const dir of [days,storage])fs.mkdirSync(dir,{recursive:true});
 const filename=path.join(storage,'core.sqlite');
 return {root,home,input,days,filename,
  close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
const day=i=>`2026-12-${String(i).padStart(2,'0')}`;
const body=(date)=>({date,pre:[{symbol:'SECRET_RAW',eps:142}],after:[],notSupplied:[]});
function makeDb(f){
 const db=new DatabaseSync(f.filename);
 db.exec("CREATE TABLE public_feed_snapshots_v1(kind TEXT,feed_key TEXT,snapshot_key TEXT,body TEXT,stored_at INTEGER)");
 return db;
}
function saveDay(db,date,raw=body(date)){
 db.prepare('INSERT INTO public_feed_snapshots_v1 VALUES(?,?,?,?,?)').run(
  'input','release-calendar:earnings-api:'+date,'current',
  JSON.stringify({requestedDate:date,text:JSON.stringify(raw)}),Date.parse('2026-11-03T00:00:00Z'));
}
function archive(f,date,raw=body(date)){
 fs.writeFileSync(path.join(f.days,date+'.json'),JSON.stringify({
  storedAt:'2026-11-03T00:00:00Z',body:raw}));
}
function symbol(f,folder,ticker,rows=[{symbol:ticker,date:'2026-09-01',eps:22}]){
 const dir=path.join(f.input,folder);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,ticker+'.json'),JSON.stringify({
  storedAt:'2026-11-03T00:00:00Z',body:rows}));
}

test('31 SQLite inputs and 31 separate archived days remain separate verified-shape counts',()=>{
 const f=fixture();try{
  const db=makeDb(f);
  for(let i=1;i<=31;i++){saveDay(db,day(i));archive(f,day(i));}
  db.close();
  symbol(f,'dec31-symbol-batch-a','TOL');
  symbol(f,'nov30-er1-full','CASY');
  const r=inspectER1DecemberSavedEvidence(f.root,{now:clock});
  assert.equal(r.status,'PASS');
  assert.equal(r.sqlite.state,'READ');
  assert.equal(r.sqlite.validDays,31);
  assert.deepEqual(r.sqlite.missingDays,[]);
  assert.equal(r.privateDays.validDays,31);
  assert.equal(r.symbols.TOL.state,'SHAPE_VALID');
  assert.equal(r.symbols.CASY.state,'SHAPE_VALID');
  assert.deepEqual(r.symbols.CASY.validFolders,['nov30-er1-full']);
  assert.equal(r.sourceEligibilityVerified,false);
  assert.equal(r.actualValuesVerified,false);
  assert.equal(r.monthlyCalculationVerified,false);
  assert.equal(r.providerCalls+r.dbWrites+r.d1Writes+r.operationalWrites,0);
  assert.equal(JSON.stringify(r).includes('SECRET_RAW'),false);
  assert.equal(JSON.stringify(r).includes('142'),false);
 }finally{f.close();}
});

test('missing SQLite and missing archive days never become zero or completed observations',()=>{
 const f=fixture();try{
  archive(f,day(1));
  fs.writeFileSync(path.join(f.days,day(2)+'.json'),'NOT_JSON');
  const r=inspectER1DecemberSavedEvidence(f.root,{now:clock});
  assert.equal(r.status,'PASS');
  assert.equal(r.sqlite.state,'DB_MISSING');
  assert.equal(r.sqlite.validDays,null);
  assert.equal(r.sqlite.missingDays,null);
  assert.equal(r.privateDays.validDays,1);
  assert.equal(r.privateDays.invalidDays.includes(day(2)),true);
  assert.equal(r.privateDays.missingDays.length,29);
  assert.equal(r.symbols.TOL.state,'NOT_FOUND_IN_FIXED_FOLDERS');
  assert.equal(r.symbols.CASY.state,'NOT_FOUND_IN_FIXED_FOLDERS');
 }finally{f.close();}
});

test('symbol archives do not follow symlinks or accept a mismatched symbol',()=>{
 const f=fixture();try{
  const outside=path.join(f.root,'outside.json');
  fs.writeFileSync(outside,JSON.stringify({storedAt:'2026-11-03T00:00:00Z',
   body:[{symbol:'CASY',date:'2026-12-02',secret:'OUTSIDE_SECRET'}]}));
  const dir=path.join(f.input,'dec31-symbol-batch-a');
  fs.mkdirSync(dir);
  fs.symlinkSync(outside,path.join(dir,'TOL.json'));
  symbol(f,'dec31-symbol-probe','CASY',[{symbol:'TOL',date:'2026-09-01'}]);
  const r=inspectER1DecemberSavedEvidence(f.root,{now:clock});
  assert.equal(r.symbols.TOL.state,'INVALID_ARCHIVE');
  assert.equal(r.symbols.CASY.state,'INVALID_ARCHIVE');
  assert.deepEqual(r.symbols.TOL.invalidFolders,['dec31-symbol-batch-a']);
  assert.equal(JSON.stringify(r).includes('OUTSIDE_SECRET'),false);
 }finally{f.close();}
});

test('WAL and SHM bytes do not change during read-only December reconciliation',()=>{
 const f=fixture();let db;
 try{
  db=makeDb(f);
  db.exec('PRAGMA journal_mode=WAL');
  saveDay(db,day(1));
  const files=[f.filename,f.filename+'-wal',f.filename+'-shm'];
  const before=files.map(p=>fs.existsSync(p)?{
   size:fs.statSync(p).size,mtimeMs:fs.statSync(p).mtimeMs}:null);
  const r=inspectER1DecemberSavedEvidence(f.root,{now:clock});
  assert.equal(r.status,'PASS');
  assert.equal(r.sqlite.validDays,1);
  assert.equal(r.sqlite.missingDays.length,30);
  const after=files.map(p=>fs.existsSync(p)?{
   size:fs.statSync(p).size,mtimeMs:fs.statSync(p).mtimeMs}:null);
  assert.deepEqual(after,before);
 }finally{try{db?.close()}catch{}f.close();}
});

test('existing registered Writer A result includes bounded December metadata',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.home,'local-writer-last-run.json'),JSON.stringify({
   at:'2026-11-25T08:00:00Z',source:'a'.repeat(40),mode:'PUBLISH',
   status:'VERIFIED',er1Future:{months:[{month:'2026-12',status:'SAVED_MONTH_INCOMPLETE'}]}}));
  const r=inspectWriterPublicationEvidence(f.root);
  assert.equal(r.status,'PASS');
  assert.equal(r.er1DecemberInput.code,'ER1_DEC31_FIXED_METADATA_READONLY');
  assert.equal(r.er1Future.months[0].status,'SAVED_MONTH_INCOMPLETE');
  assert.equal(r.er1DecemberInput.sqlite.state,'DB_MISSING');
  assert.equal(r.er1DecemberInput.sourceEligibilityVerified,false);
 }finally{f.close();}
});
