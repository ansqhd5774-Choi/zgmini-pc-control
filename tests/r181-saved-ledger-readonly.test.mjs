import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticateSavedLedgerA,assessSavedR181Ledger,
 executeSavedLedgerA,REPO,OP,SOURCE_SHA,HELPER_SHA,SYMBOLS,REQUEST_SCHEMA}
 from '../tools/r181-saved-ledger-readonly.mjs';
import {sanitizeSavedLedgerResult} from '../tools/r181-saved-ledger-report.mjs';

const requestId='b52437d4-9a81-46e1-bf31-4e02ddf03a81';
const chatId='ec4c61aa-c60a-45ce-8f21-70f33eb41914';
const controlSha='4ee6b5dfb165668775e2070ce5364ee610a7060a';
const req=()=>({schema:REQUEST_SCHEMA,requestId,chatId,operation:OP,
 controlRepository:REPO,controlSourceSha:controlSha,
 cycleSha256:SOURCE_SHA,primaryHelperSha256:HELPER_SHA});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:controlSha,
 GITHUB_RUN_ID:'43800000000'});
const event=()=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},
 issue:{number:1607,title:OP,body:JSON.stringify(req()),
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}]}});
const coverage=()=>Object.fromEntries(SYMBOLS.map(s=>[s,
 {bars:701,latest15NY:'2026-11-13',secret:'TOKEN_MUST_NOT_LEAK',
  close:90000123}]));
const ledger=()=>({status:'LOCAL_PRIMARY_STORED',
 at:'2026-11-16T05:29:30.439Z',providerCalls:14,coverage:coverage(),
 token:'HIDDEN_TOKEN',url:'https://secret.example',price:90000123});

test('exact private one-shot request identity is required',()=>{
 assert.equal(authenticateSavedLedgerA(event(),env()).controlSourceSha,controlSha);
 for(const alter of [
  e=>e.issue.title='another-operation',
  e=>e.issue.labels=[],
  e=>e.repository.private=false,
  e=>e.issue.user.login='other',
  e=>{const b=JSON.parse(e.issue.body);b.controlSourceSha='f'.repeat(40);e.issue.body=JSON.stringify(b);},
  e=>{const b=JSON.parse(e.issue.body);b.extra='hello';e.issue.body=JSON.stringify(b);},
  e=>{const b=JSON.parse(e.issue.body);b.cycleSha256='f'.repeat(64);e.issue.body=JSON.stringify(b);}
 ]){
  const e=event();alter(e);
  assert.throws(()=>authenticateSavedLedgerA(e,env()),{code:/R181_LEDGER_A_/});
 }
});
test('complete 14 mandatory metadata is reported but never claimed as SQLite validated',()=>{
 const out=assessSavedR181Ledger(ledger());
 assert.equal(out.coverageStatus,'LEDGER_REPORTED_COMPLETE');
 assert.equal(out.matchingRows,14);
 assert.equal(out.providerCalls,14);
 assert.equal(out.fixedSymbolCount,14);
 assert.equal(out.sqliteOpened,false);
 assert.equal(out.rawShaVerified,false);
 assert.equal(out.checkpointVerified,false);
 const json=JSON.stringify(out);
 for(const forbidden of ['TOKEN_MUST_NOT_LEAK','HIDDEN_TOKEN',
  'https://secret.example','90000123'])assert.equal(json.includes(forbidden),false);
});
test('arbitrary 14 symbols, unavailable bars, bad days, bad count all remain incomplete',()=>{
 const good=ledger();
 const wrong={...good.coverage};delete wrong.SPY;wrong.FAKE={bars:701,latest15NY:'2026-11-13'};
 for(const modified of [
  {...good,coverage:wrong},
  {...good,coverage:{...good.coverage,SPY:null}},
  {...good,coverage:{...good.coverage,SPY:{bars:0,latest15NY:'2026-11-13'}}},
  {...good,coverage:{...good.coverage,SPY:{bars:1.5,latest15NY:'2026-11-13'}}},
  {...good,coverage:{...good.coverage,SPY:{bars:701,latest15NY:'2026-02-30'}}},
  {...good,at:'not-a-date'},
  {...good,providerCalls:'14'},
  {...good,providerCalls:0},
  {...good,status:'STOP'},
  {...good,coverage:null},
 ]){
  const out=assessSavedR181Ledger(modified);
  assert.equal(out.coverageStatus,'LEDGER_REPORTED_INCOMPLETE');
  assert.equal(out.sqliteOpened,false);
  assert.equal(JSON.stringify(out).includes('FAKE'),false);
 }
});
test('one-shot execution never starts collector and only invokes read-only inspection',()=>{
 let called=0;
 const out=executeSavedLedgerA({event:event(),env:env(),inspect:()=>{
  called++;return assessSavedR181Ledger(ledger());
 }});
 assert.equal(called,1);
 assert.equal(out.status,'PASS');
 assert.equal(out.sourcePinVerified,true);
 assert.equal(out.coverage.coverageStatus,'LEDGER_REPORTED_COMPLETE');
 assert.equal(sanitizeSavedLedgerResult(out,req(),env()).status,'PASS');
});
test('reporter revalidates redaction envelope and refuses contaminated results',()=>{
 const full=executeSavedLedgerA({event:event(),env:env(),
  inspect:()=>assessSavedR181Ledger(ledger())});
 const good=sanitizeSavedLedgerResult(full,req(),env());
 assert.equal(good.status,'PASS');
 assert.equal(good.coverage.symbols.length,14);
 for(const problem of [
  {...full,coverage:{...full.coverage,symbols:[...full.coverage.symbols.slice(0,13),
    {...full.coverage.symbols[13],symbol:'HIDDEN_TOKEN'}]}},
  {...full,coverage:{...full.coverage,sqliteOpened:true}},
  {...full,coverage:{...full.coverage,evidenceLevel:'SQLITE_VERIFIED'}},
  {...full,coverage:{...full.coverage,providerCallsThisRun:1}},
  {...full,controlSourceSha:'f'.repeat(40)},
 ]){
  const out=sanitizeSavedLedgerResult(problem,req(),env());
  assert.equal(out.status,'STATE_UNKNOWN');
  assert.equal(out.coverage,null);
 }
 const stopped=sanitizeSavedLedgerResult({
  schema:full.schema,status:'STOP',code:'R181_LEDGER_A_LEDGER_CHANGED_STOP',
  requestId:null},req(),env());
 assert.equal(stopped.status,'STOP');
});
