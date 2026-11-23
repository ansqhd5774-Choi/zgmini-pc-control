import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectW05ServiceSavedPreview} from '../controller/w05-service-saved-preview-readonly.mjs';

const NAMES=['EARNINGS_R4_C_READ_MODEL_PREVIEW_READONLY.mjs',
 'EARNINGS_R3D_STORED_BLS_CALC_READONLY.mjs'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const values=()=>({
 payload:{sourceVersion:'a'.repeat(64),sourceStoredAt:1793010000000,
  observedThroughBySeries:{WPSFD42:'2026-10'},
  rows:[{indicatorId:'bls_ppi_services_index',value:119.23,unit:'INDEX',
    observationPeriod:'2026-10',status:'READY'},
   {indicatorId:'bls_ppi_services_yoy_sa',value:3.15,unit:'PERCENT',
    observationPeriod:'2026-10',status:'READY'}]},
 diagnostics:{bySeries:[{seriesId:'WPSFD42',
  snapshotSha256:'b'.repeat(64)}]},
});
function fixture(t){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'zg-w05-service-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const root=path.join(tmp,'ZGmini');
 const data=path.join(root,'data');
 const scripts=path.join(root,'projects','zgmini-earnings-history-pc-release',
  'scripts','pc-writer');
 fs.mkdirSync(scripts,{recursive:true});
 const storage=path.join(data,'pc-writer','storage');
 fs.mkdirSync(storage,{recursive:true});
 fs.writeFileSync(path.join(storage,'core.sqlite'),'fake fixture only');
 const bytes=['// reviewed R4 fixture\n','// reviewed R3D fixture\n'];
 const pins={};
 for(let i=0;i<NAMES.length;i++){
  fs.writeFileSync(path.join(scripts,NAMES[i]),bytes[i]);
  pins[NAMES[i]]=hash(bytes[i]);
 }
 const counts={db:0,exec:[],close:0,load:0};
 const options={pins,openDb:()=>{counts.db++;return {
  exec:s=>counts.exec.push(s),close:()=>{counts.close++}};},
  loadModule:async()=>{counts.load++;return {buildServiceSourcePreview:values};}};
 return {root,data,scripts,pins,options,counts};
}
test('exact reviewed R4 and R3D read only approved local SQLite and return two rows',
 async t=>{
 const f=fixture(t);
 const before=NAMES.map(n=>hash(fs.readFileSync(path.join(f.scripts,n))));
 const r=await inspectW05ServiceSavedPreview(f.data,f.options);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 assert.equal(r.code,'W05_SERVICE_SAVED_PREVIEW_VERIFIED');
 assert.equal(r.seriesId,'WPSFD42');
 assert.equal(r.observationMonth,'2026-10');
 assert.equal(r.rows.length,2);
 assert.deepEqual(r.rows.map(row=>row.indicatorId),
  ['bls_ppi_services_index','bls_ppi_services_yoy_sa']);
 assert.deepEqual(r.rows.map(row=>row.value),[119.23,3.15]);
 assert.equal(r.sourceSnapshotSha256,'b'.repeat(64));
 assert.equal(r.sourceVersion,'a'.repeat(64));
 assert.equal(r.sourceStoredAt,1793010000000);
 assert.equal(r.sqliteOpened,true);
 assert.deepEqual(f.counts.exec,['PRAGMA query_only=ON']);
 assert.deepEqual([f.counts.db,f.counts.load,f.counts.close],[1,1,1]);
 assert.deepEqual(NAMES.map(n=>hash(fs.readFileSync(path.join(f.scripts,n)))),before);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.providerCalls,0);
 assert.equal(r.d1Writes,0);
 assert.equal(r.sqliteWrites,0);
 assert.equal(JSON.stringify(r).includes(f.data),false);
});
test('tampered calculator or R3D dependency stops before import/database read',
 async t=>{
 const f=fixture(t);
 for(const name of NAMES){
  const file=path.join(f.scripts,name);
  const original=fs.readFileSync(file);
  fs.appendFileSync(file,'TAMPER');
  const r=await inspectW05ServiceSavedPreview(f.data,f.options);
  assert.equal(r.status,'STATE_UNKNOWN');
  assert.equal(r.code,'W05_SERVICE_SOURCE_BYTES_NOT_APPROVED');
  fs.writeFileSync(file,original);
 }
 assert.deepEqual([f.counts.load,f.counts.db],[0,0]);
});
test('invalid paths and missing stored source never produce a false PASS',async t=>{
 const f=fixture(t);
 assert.equal((await inspectW05ServiceSavedPreview(os.tmpdir(),f.options)).status,
  'STATE_UNKNOWN');
 fs.unlinkSync(path.join(f.scripts,NAMES[0]));
 const r=await inspectW05ServiceSavedPreview(f.data,f.options);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.sqliteOpened,false);
 assert.equal(f.counts.db,0);
});
test('missing YoY base remains null and cannot be fabricated READY',async t=>{
 const f=fixture(t);
 f.options.loadModule=async()=>({buildServiceSourcePreview:()=>{
  const data=values();data.payload.rows[1]={...data.payload.rows[1],
   value:null,status:'PARTIAL',unavailableReason:'EXACT_T_MINUS_12_BASE_MISSING_OR_NONPOSITIVE'};
  return data;
 }});
 const r=await inspectW05ServiceSavedPreview(f.data,f.options);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'W05_SERVICE_SAVED_PREVIEW_PARTIAL');
 assert.equal(r.rows[1].value,null);
 assert.equal(r.rows[1].unavailableReason,'EXACT_T_MINUS_12_BASE_MISSING_OR_NONPOSITIVE');
 assert.equal(f.counts.close,1);
});
test('incorrect rows or source provenance fail closed without leaking SQL',async t=>{
 const f=fixture(t);
 f.options.loadModule=async()=>({buildServiceSourcePreview:()=>{
  const data=values();data.payload.rows[1].indicatorId=data.payload.rows[0].indicatorId;
  return data;
 }});
 const r=await inspectW05ServiceSavedPreview(f.data,f.options);
 assert.equal(r.code,'W05_SERVICE_RESULT_CONTRACT_INVALID');
 assert.equal(r.rows.length,0);
 assert.equal(f.counts.close,1);
});
test('read-only SQLite failure closes handle and returns sanitized code',async t=>{
 const f=fixture(t);
 f.options.openDb=()=>({exec:()=>{throw Error('private credentials 123');},
  close:()=>{f.counts.close++}});
 const r=await inspectW05ServiceSavedPreview(f.data,f.options);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'W05_SERVICE_SAVED_PREVIEW_UNVERIFIED');
 assert.equal(f.counts.close,1);
 assert.doesNotMatch(JSON.stringify(r),/private credentials/);
});
test('source modification during SQLite read is rejected',async t=>{
 const f=fixture(t);
 f.options.loadModule=async()=>({buildServiceSourcePreview:()=>{
  fs.appendFileSync(path.join(f.scripts,NAMES[1]),'changed');
  return values();
 }});
 const r=await inspectW05ServiceSavedPreview(f.data,f.options);
 assert.equal(r.code,'W05_SERVICE_SOURCE_CHANGED_DURING_READ');
 assert.equal(f.counts.close,1);
});
