import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectAlpacaQuotaReadonly} from '../controller/alpaca-quota-readonly.mjs';

const now=Date.parse('2026-11-02T13:00:00Z');
const fresh=({times=[],limit=null,remaining=null,reset=null,status=null}={})=>({version:1,
 requestTimes:times,lastRemoteLimit:limit,lastRemoteRemaining:remaining,
 lastRemoteResetAt:reset,lastStatus:status,quotaState:'AVAILABLE'});
function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpaca-quota-readonly-'));
 const root=path.join(dir,'pc-writer');fs.mkdirSync(root);
 const file=path.join(root,'alpaca-quota-ledger.json');
 const save=value=>fs.writeFileSync(file,JSON.stringify(value));
 return Promise.resolve().then(()=>fn({dir,root,file,save})).finally(()=>fs.rmSync(dir,{force:true,recursive:true}));
}

test('119 / 120 / 140 / 141 recent reservations have distinct states',()=>fixture(({dir,save})=>{
 for(const [n,state,status] of [[119,'AVAILABLE','PASS'],[120,'WARNING','PASS'],
  [140,'LIMIT_REACHED','PASS'],[141,'OVER_LIMIT','FAIL']]){
  save(fresh({times:Array(n).fill(now-30_000)}));
  const outcome=inspectAlpacaQuotaReadonly(dir,{now});
  assert.equal(outcome.quota.windowState,state);
  assert.equal(outcome.status,status);
  assert.equal(outcome.accountWide30Percent,'UNVERIFIED');
 }
}));

test('only recent 60 seconds count; no live traffic never establishes account PASS',()=>fixture(({dir,save})=>{
 save(fresh({times:[now-60_001,now-60_000,now]}));
 const outcome=inspectAlpacaQuotaReadonly(dir,{now});
 assert.equal(outcome.quota.recentReservations,2);
 save(fresh({times:[now-90_000]}));
 assert.equal(inspectAlpacaQuotaReadonly(dir,{now}).quota.requestEvidence,'NO_LIVE_TRAFFIC_EVIDENCE');
}));

test('stored remote limit of 200 and remaining 60 is a stop hint, not proven header',()=>fixture(({dir,save})=>{
 save(fresh({times:[now],limit:200,remaining:60,reset:now+30_000,status:429}));
 const observed=inspectAlpacaQuotaReadonly(dir,{now});
 assert.equal(observed.quota.remoteLedgerHint.state,'REMOTE_RESERVE_REACHED');
 assert.equal(observed.quota.decision,'STOP');
 assert.equal(observed.quota.remoteLedgerHint.headerProvenance,'NOT_PROVABLE_FROM_LEDGER');
 save(fresh({limit:200,remaining:0,reset:now-1}));
 assert.equal(inspectAlpacaQuotaReadonly(dir,{now}).quota.remoteLedgerHint.state,'REMOTE_HEADER_UNOBSERVED');
}));

test('missing, malformed, oversize and symlinked ledger fail closed',()=>fixture(({dir,file,save})=>{
 assert.equal(inspectAlpacaQuotaReadonly(dir,{now}).code,'ALPACA_LEDGER_ABSENT');
 fs.writeFileSync(file,'not-json');
 assert.equal(inspectAlpacaQuotaReadonly(dir,{now}).code,'ALPACA_LEDGER_INVALID');
  save(fresh({limit:200,remaining:201,reset:now+20_000}));
  assert.equal(inspectAlpacaQuotaReadonly(dir,{now}).code,'ALPACA_LEDGER_INVALID');
 fs.writeFileSync(file,'x'.repeat(32769));
 assert.equal(inspectAlpacaQuotaReadonly(dir,{now}).code,'ALPACA_LEDGER_SIZE_INVALID');
 fs.unlinkSync(file);
 const target=path.join(dir,'untrusted.json');fs.writeFileSync(target,JSON.stringify(fresh()));
 fs.symlinkSync(target,file);
 assert.equal(inspectAlpacaQuotaReadonly(dir,{now}).code,'ALPACA_LEDGER_UNSAFE_FILE');
}));

test('future reservation drift blocks without writing or recovering the quota lock',()=>fixture(({dir,root,file,save})=>{
 save(fresh({times:[now+2_000]}));
 const lock=path.join(root,'alpaca-quota-reservation.lock');fs.mkdirSync(lock);
 const before=fs.readFileSync(file,'utf8');
 const result=inspectAlpacaQuotaReadonly(dir,{now});
 assert.equal(result.code,'ALPACA_CLOCK_DRIFT');
 assert.equal(fs.readFileSync(file,'utf8'),before);
 assert.equal(fs.existsSync(lock),true);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.equal(result.sqliteOpened,false);
}));

test('extra credentials and raw values never escape the sanitized result',()=>fixture(({dir,file,save})=>{
 save({...fresh({times:[now]}),apiKey:'PRIVATE_KEY_DO_NOT_PRINT',rawUrl:'https://example.test/?token=PRIVATE_TOKEN'});
 const result=inspectAlpacaQuotaReadonly(dir,{now});
 assert.equal(result.status,'PASS');
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_KEY_DO_NOT_PRINT|PRIVATE_TOKEN|pc-writer/);
 assert.equal(fs.existsSync(file),true);
}));
