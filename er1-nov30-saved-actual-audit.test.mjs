import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectSavedActual,validIssue} from './er1-nov30-saved-actual-audit.mjs';

function fixture(t,days=[1,12,13]){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'er1-saved-audit-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const d=path.join(root,'er1-input','nov30-forward-days');
  fs.mkdirSync(d,{recursive:true});
  for(const n of days){
    const date='2026-11-'+String(n).padStart(2,'0');
    const body={date,pre:[{symbol:n===1?'ONE':'TWO',name:'Issuer '+n,
      eps:n===1?1.25:null,revenue:n===1?200:null,
      epsEstimate:n===1?0.8:n===12?0:1.2,
      revenueEstimate:n===13?null:n===1?205:123}],after:[],notSupplied:[]};
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
  assert.equal(report.calendarForecastEPSNumberRows,3);
  assert.equal(report.calendarForecastEPSNullOrMissingRows,0);
  assert.equal(report.calendarForecastRevenueNumberRows,2);
  assert.equal(report.calendarForecastRevenueNullOrMissingRows,1);
  assert.equal(report.calendarRowsBothForecast,2);
  assert.equal(report.priorCalendarRowsBothForecast,1);
  assert.equal(report.futureCalendarRowsBothForecast,1);
  assert.equal(report.futureSymbolsWithEPSForecast,1);
  assert.equal(report.futureSymbolsWithRevenueForecast,1);
  assert.equal(report.futureSymbolsWithBothForecast,1);
  assert.equal(report.futureSymbolsWithoutBothForecast,0);
  assert.equal(report.futureForecastInvalidRows,0);
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

test('Null, absent and malformed forecasts are counted without turning into zero',async t=>{
  const pcHome=fixture(t,[12,13]);
  const folder=path.join(pcHome,'er1-input','nov30-forward-days');
  const first=path.join(folder,'2026-11-12.json');
  const firstBody=JSON.parse(fs.readFileSync(first,'utf8'));
  delete firstBody.body.pre[0].epsEstimate;
  firstBody.body.pre[0].revenueEstimate='not-a-number';
  fs.writeFileSync(first,JSON.stringify(firstBody));
  const report=await inspectSavedActual({pcHome,asOf:'2026-11-06',
    readCore:()=>null,score:()=>({coverage:{scoreableIssuers:0}})});
  assert.equal(report.futureSymbols,1);
  assert.equal(report.calendarForecastEPSNullOrMissingRows,1);
  assert.equal(report.calendarForecastEPSNumberRows,1);
  assert.equal(report.calendarForecastRevenueNullOrMissingRows,1);
  assert.equal(report.calendarForecastRevenueNumberRows,0);
  assert.equal(report.futureForecastInvalidRows,1);
  assert.equal(report.futureSymbolsWithBothForecast,0);
  assert.equal(report.futureSymbolsWithoutBothForecast,1);
  assert.equal(report.providerCalls,0);
  assert.equal(report.d1Writes,0);
  assert.equal(JSON.stringify(report).includes('TWO'),false);
});

const digest=arr=>createHash('sha256').update(JSON.stringify(arr)).digest('hex');
const EVENT_ENV={
  GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened'
};
const original474Request=()=>({
  schema:'ZGMINI_ER1_NOV30_ORIGINAL_COHORT_A_V1',
  operation:'original-cohort-read-only',
  originalIssueNumber:474,
  sourceSha:'a6dd77d19ccfcb79ddcdd0b4a6f495ec3888e24a',
  requestId:'pc-nov30-actual-550e8400-e29b-41d4-a716-446655440000',
  chatId:'chat-550e8400-e29b-41d4-a716-446655440001'
});
const original474Event=(req=original474Request())=>({
  action:'opened',
  issue:{title:'pc-er1-nov30-original-cohort-audit',
    labels:[{name:'pc-er1-approved'}],
    user:{login:'ansqhd5774-Choi'},body:JSON.stringify(req)}
});

test('#474 fixed original-asOf is admitted without changing legacy read-only contract',()=>{
  const r=validIssue(original474Event(),EVENT_ENV);
  assert.equal(r.pinnedAsOf,'2026-11-06');
  assert.equal(r.originalIssueNumber,474);
  const legacy={
    schema:'ZGMINI_ER1_NOV30_SAVED_ACTUAL_A_V1',
    operation:'read-only',
    sourceSha:original474Request().sourceSha,
    requestId:original474Request().requestId,
    chatId:original474Request().chatId
  };
  const e=original474Event(legacy);
  e.issue.title='pc-er1-nov30-saved-actual-audit';
  assert.equal(validIssue(e,EVENT_ENV).pinnedAsOf,null);
});

test('historical comparison rejects extra asOf, changed original issue and owner',()=>{
  for(const change of [
    {asOf:'2026-11-07'},
    {originalIssueNumber:155},
    {sourceSha:'0'.repeat(40)},
    {operation:'private-collect'}]){
    assert.throws(()=>validIssue(original474Event({
      ...original474Request(),...change}),EVENT_ENV),
      /NOV30_SAVED_AUDIT_CONTRACT_STOP/);
  }
  assert.throws(()=>validIssue(original474Event(),{
    ...EVENT_ENV,GITHUB_ACTOR:'not-owner'}),/NOV30_SAVED_AUDIT_ISSUE_STOP/);
  const mislabeled=original474Event();
  mislabeled.issue.labels=[];
  assert.throws(()=>validIssue(mislabeled,EVENT_ENV),
    /NOV30_SAVED_AUDIT_ISSUE_STOP/);
});

test('different source ordering gives different digest for same future symbol set',async t=>{
  const pcHome=fixture(t,[12,13]);
  const folder=path.join(pcHome,'er1-input','nov30-forward-days');
  for(const [day,symbol] of [['12','ZZZ'],['13','AAA']]){
    const file=path.join(folder,'2026-11-'+day+'.json');
    const payload=JSON.parse(fs.readFileSync(file,'utf8'));
    payload.body.pre[0].symbol=symbol;
    fs.writeFileSync(file,JSON.stringify(payload));
  }
  const r=await inspectSavedActual({
    pcHome,asOf:'2026-11-06',readCore:()=>null,
    score:()=>({coverage:{scoreableIssuers:0}})
  });
  assert.equal(r.futureSymbols,2);
  assert.equal(r.candidateSetSha256,digest(['AAA','ZZZ']));
  assert.equal(r.collectorOrderedCandidateSetSha256,digest(['ZZZ','AAA']));
  assert.notEqual(r.candidateSetSha256,r.collectorOrderedCandidateSetSha256);
  assert.equal(r.original474CohortHashComparison,'NOT_EVALUATED');
  assert.equal(r.providerCalls,0);
  assert.equal(r.d1Writes,0);
  assert.equal(JSON.stringify(r).includes('AAA'),false);
  assert.equal(JSON.stringify(r).includes('ZZZ'),false);
});

test('historical match is never reported from incomplete daily observations',async t=>{
  const pcHome=fixture(t,[12]);
  const r=await inspectSavedActual({
    pcHome,asOf:'2026-11-06',readCore:()=>null});
  assert.equal(r.dayCount,1);
  assert.equal(r.original474CohortHashComparison,'NOT_EVALUATED');
  assert.equal(r.fullCohortVerified,false);
  assert.equal(r.providerCalls,0);
});
