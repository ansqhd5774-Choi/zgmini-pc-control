import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectSavedActual} from './er1-nov30-saved-actual-audit.mjs';

function fixture(t,days=[1,12,13]){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'er1-saved-audit-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const d=path.join(root,'er1-input','nov30-forward-days');
  fs.mkdirSync(d,{recursive:true});
  for(const n of days){
    const date='2026-11-'+String(n).padStart(2,'0');
    const body={date,pre:[{symbol:n===1?'ONE':'TWO',name:'Issuer '+n,
      eps:n===1?1.25:null,revenue:n===1?200:null}],after:[],notSupplied:[]};
    fs.writeFileSync(path.join(d,date+'.json'),JSON.stringify({
      storedAt:'2026-11-06T01:00:00Z',body}));
  }
  const history=path.join(root,'er1-input','nov30-er1-full');
  fs.mkdirSync(history,{recursive:true});
  fs.writeFileSync(path.join(history,'TWO.json'),JSON.stringify({
    storedAt:'2026-11-06T01:00:00Z',body:[
      {symbol:'TWO',date:'2026-10-22',eps:0.4,revenue:50},
      {symbol:'TWO',date:'2026-07-22',eps:0.3,revenue:48}]}));
  return root;
}

test('No network: aggregate saved history and November raw; preview only',async t=>{
  const pcHome=fixture(t);
  let called=0;
  const report=await inspectSavedActual({pcHome,asOf:'2026-11-06',
    readCore:()=>null,score:(rows)=>{
      called++;
      assert.equal(rows.length,1);
      assert.equal(rows[0].earningsSymbol,'TWO');
      return {coverage:{scoreableIssuers:1},rankings:[{symbol:'TWO',score:99}]};
    }});
  assert.equal(report.status,'PARTIAL');
  assert.equal(report.dayCount,3);
  assert.equal(report.priorCalendarRowsBothActual,1);
  assert.equal(report.futureSymbols,1);
  assert.equal(report.historyFileSymbols,1);
  assert.equal(report.futureSymbolsWithBothActual,1);
  assert.equal(report.futureSymbolsWithRecentEPSandRevenueActual,1);
  assert.equal(report.scoreableIssuers,1);
  assert.equal(report.previewOnly,true);
  assert.equal(report.fullCohortVerified,false);
  assert.equal(report.providerCalls,0);
  assert.equal(report.d1Writes,0);
  assert.equal(report.coreWrites,0);
  assert.equal(called,1);
  assert.equal(JSON.stringify(report).includes('TWO'),false);
});

test('Missing and corrupt saved histories are not substituted with estimates',async t=>{
  const pcHome=fixture(t,[12]);
  fs.writeFileSync(path.join(pcHome,'er1-input','nov30-er1-full','TWO.json'),
    '{invalid-json');
  const report=await inspectSavedActual({pcHome,asOf:'2026-11-06',
    readCore:()=>null,score:()=>{throw Error('should not score invalid records')}});
  assert.equal(report.historyFilesInvalid,1);
  assert.equal(report.scoreableIssuers,0);
  assert.equal(report.status,'PARTIAL');
  assert.equal(report.providerCalls,0);
});
