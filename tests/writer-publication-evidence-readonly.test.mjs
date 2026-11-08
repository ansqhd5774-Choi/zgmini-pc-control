import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectWriterPublicationEvidence} from '../controller/writer-publication-evidence-readonly.mjs';
const fixture=()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'er1-meta-'));
 fs.mkdirSync(path.join(d,'pc-writer'));return{d,write:(p,o)=>fs.writeFileSync(
  path.join(d,'pc-writer',p),JSON.stringify(o)),close:()=>fs.rmSync(d,{recursive:true,force:true})};
};
test('ER1 writer months are whitelisted and global D1 VERIFIED is not per-feed proof',()=>{
 const f=fixture();try{
  f.write('local-writer-last-run.json',{at:'2026-11-08T00:00:00Z',source:'a'.repeat(40),
   mode:'PUBLISH',status:'VERIFIED',privateRaw:'SECRET',er1Future:{status:'UPDATED',
    months:[{month:'2026-11',status:'READY_OUTPUT',sqliteDays:16,privateDays:14,
     scoreableIssuers:123,rawEps:'SECRET'}]},failures:[]});
  f.write('local-publication-ledger.json',{status:'VERIFIED',source:'a'.repeat(40),
   at:Date.parse('2026-11-08T00:01:00Z'),secret:'SECRET'});
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.status,'PASS');assert.equal(r.er1Future.months[0].sqliteDays,16);
  assert.equal(r.globalLedgerVerified,true);
  assert.equal(r.localOutputVerified,false);assert.equal(r.d1.productionVerified,false);
  assert.equal(r.output.bodySha256,null);assert.equal(r.sqliteOpened,false);
  assert.equal(JSON.stringify(r).includes('SECRET'),false);
 }finally{f.close();}
});
test('missing ledger gives metadata but does not claim publish success',()=>{
 const f=fixture();try{
  f.write('local-writer-last-run.json',{source:'a'.repeat(40),status:'VERIFIED',
   er1Future:{months:[{month:'2026-11',status:'UNCHANGED'}]}});
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.status,'PASS');assert.equal(r.ledger.state,'MISSING');
  assert.equal(r.er1Future.months[0].sqliteDays,null);
  assert.equal(r.globalLedgerVerified,false);
 }finally{f.close();}
});
