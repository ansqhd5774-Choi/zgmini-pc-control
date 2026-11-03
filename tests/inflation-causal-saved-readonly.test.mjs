import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectInflationCausalSaved} from '../controller/inflation-causal-saved-readonly.mjs';

const fixture=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-inflation-status-'));
  const home=path.join(root,'pc-writer'),supply=path.join(home,'supply-r10');
  fs.mkdirSync(supply,{recursive:true});return {root,home,supply};
};
const withFixture=fn=>{const f=fixture();try{fn(f);}finally{fs.rmSync(f.root,{recursive:true,force:true});}};
const makeRows=()=>Array.from({length:345},(_,i)=>{
  const month=i+1,year=1998+Math.floor((month-1)/12),m=(month-1)%12+1;
  return {observationDate:`${year}-${String(m).padStart(2,'0')}-01`,value:i/100};
});

test('rejects non-absolute dataRoot without touching any file',()=>{
  const found=inspectInflationCausalSaved('relative');
  assert.equal(found.code,'DATA_ROOT_NOT_ABSOLUTE');
  assert.equal(found.providerCalls,0);
  assert.equal(found.operationalWrites,0);
});

test('empty save is missing, 20 excluded and 31 explicitly unregistered',()=>withFixture(({root})=>{
  const found=inspectInflationCausalSaved(root);
  assert.equal(found.gscpi21.status,'MISSING');
  assert.equal(found.sce31.status,'NOT_REGISTERED');
  assert.equal(found.excluded20.status,'EXCLUDED_BY_USER');
  assert.equal(found.manufacturing30.status,'NOT_EVALUATED_IN_21_READONLY');
  assert.equal(found.status,'PASS');
}));

test('checks 345 valid GSCPI months, OLE raw and existing checkpoint without exposing values',()=>withFixture(({root,home,supply})=>{
  const rows=makeRows();
  fs.writeFileSync(path.join(supply,'gscpi.json'),JSON.stringify({source:'NY_FED_GSCPI',rows}));
  fs.writeFileSync(path.join(supply,'gscpi.xlsx'),Buffer.concat([
    Buffer.from('d0cf11e0a1b11ae1','hex'),Buffer.alloc(504)]));
  fs.writeFileSync(path.join(supply,'extra-manifest.json'),JSON.stringify([{id:'gscpi',status:'STORED'}]));
  fs.writeFileSync(path.join(supply,'inputs.json'),'{}');
  fs.writeFileSync(path.join(home,'local-supply-r10-collection.json'),JSON.stringify({status:'COLLECTED',checkedAt:Date.UTC(2026,9,10)}));
  const found=inspectInflationCausalSaved(root);
  assert.equal(found.gscpi21.status,'SAVED_STRUCTURE_VERIFIED');
  assert.equal(found.gscpi21.rawToParsedEqualityVerified,false);
  assert.equal(found.gscpi21.rowCount,345);
  assert.equal(found.gscpi21.firstMonth,'1998-01');
  assert.equal(found.gscpi21.lastMonth,'2026-09');
  assert.equal(found.gscpi21.rawFormat,'OLE_BIFF');
  assert.equal(found.gscpi21.checkpointStatus,'COLLECTED');
  assert.equal(found.gscpi21.inputsPresent,true);
  assert.match(found.gscpi21.rawSha256,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(found).includes('3.44'),false);
}));

test('invalid duplicate month does not report verified',()=>withFixture(({root,supply})=>{
  const rows=makeRows();rows[10].observationDate=rows[9].observationDate;
  fs.writeFileSync(path.join(supply,'gscpi.json'),JSON.stringify({source:'NY_FED_GSCPI',rows}));
  const found=inspectInflationCausalSaved(root);
  assert.equal(found.gscpi21.parsedStatus,'INVALID_ROWS');
  assert.equal(found.gscpi21.status,'NOT_VERIFIED');
}));

test('refuses a symlink masquerading as source raw file',()=>withFixture(({root,supply})=>{
  fs.writeFileSync(path.join(supply,'gscpi.json'),JSON.stringify({source:'NY_FED_GSCPI',rows:makeRows()}));
  const elsewhere=path.join(root,'elsewhere.xlsx');fs.writeFileSync(elsewhere,Buffer.from('d0cf11e0a1b11ae1','hex'));
  fs.symlinkSync(elsewhere,path.join(supply,'gscpi.xlsx'));
  const found=inspectInflationCausalSaved(root);
  assert.equal(found.gscpi21.status,'PARTIAL_SAVED');
  assert.equal(found.gscpi21.rawStatus,'INVALID_FILE');
}));
