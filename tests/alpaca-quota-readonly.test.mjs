import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectAlpacaQuotaReadonly,inspectQuotaModuleSourceReadonly} from '../controller/alpaca-quota-readonly.mjs';

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

function sourceFixture(fn){
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'r17-quota-source-'));
 const parent=path.join(temporary,'ZGmini'),data=path.join(parent,'data');
 const writer=path.join(data,'pc-writer');
 const modules=path.join(parent,'projects','zgmini-earnings-history-pc-release','scripts','pc-writer');
 fs.mkdirSync(writer,{recursive:true});fs.mkdirSync(modules,{recursive:true});
 const names=['quota-fetch.mjs','quota-policy.mjs','quota-ledger.mjs'];
 const values=Object.fromEntries(names.map((name,i)=>[name,`export const testValue=${i}; // SECRET_SOURCE_DO_NOT_PRINT\n`]));
 const approvedSha='dace6090f61eb0d0319f79422649af312f7b1764';
 fs.writeFileSync(path.join(writer,'config.json'),JSON.stringify({source:approvedSha,secret:'PRIVATE_KEY_DO_NOT_PRINT'}));
 for(const [name,value] of Object.entries(values))fs.writeFileSync(path.join(modules,name),value);
 return Promise.resolve().then(()=>fn({temporary,parent,data,writer,modules,names,values,approvedSha}))
  .finally(()=>fs.rmSync(temporary,{force:true,recursive:true}));
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

test('accepted 500ms future clock skew still occupies a reservation slot',()=>fixture(({dir,save})=>{
 save(fresh({times:[...Array(139).fill(now-30_000),now+500]}));
 const observed=inspectAlpacaQuotaReadonly(dir,{now});
 assert.equal(observed.quota.recentReservations,140);
 assert.equal(observed.quota.windowState,'LIMIT_REACHED');
 assert.equal(observed.quota.decision,'STOP');
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
 try{fs.symlinkSync(target,file);}catch(error){
  if(process.platform==='win32'&&['EPERM','EACCES'].includes(error.code))return;
  throw error;
 }
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
 assert.equal(result.baseAgreement,'UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_KEY_DO_NOT_PRINT|PRIVATE_TOKEN|pc-writer/);
 assert.equal(fs.existsSync(file),true);
}));

test('missing ledger adds fixed installed quota source hashes without changing status or side effects',()=>sourceFixture(({data,writer,names,values,approvedSha})=>{
 const before=fs.readFileSync(path.join(writer,'config.json'));
 const outcome=inspectAlpacaQuotaReadonly(data,{now});
 assert.equal(outcome.status,'BLOCKED');
 assert.equal(outcome.code,'ALPACA_LEDGER_ABSENT');
 assert.equal(outcome.providerCalls,0);assert.equal(outcome.d1Writes,0);
 assert.equal(outcome.operationalWrites,0);assert.equal(outcome.sqliteOpened,false);
 assert.equal(outcome.sourceInventory.state,'SOURCE_BYTES_AND_CONFIG_READ');
 assert.equal(outcome.sourceInventory.configApprovedSha,approvedSha);
 assert.equal(outcome.sourceInventory.runtimeBindingVerified,false);
 assert.equal(outcome.sourceInventory.complete,true);
 assert.deepEqual(outcome.sourceInventory.modules.map(x=>x.name),names);
 for(const item of outcome.sourceInventory.modules){
  assert.equal(item.state,'PRESENT');
  assert.equal(item.sha256,createHash('sha256').update(values[item.name]).digest('hex'));
  assert.equal(item.bytes,Buffer.byteLength(values[item.name]));
 }
 assert.deepEqual(fs.readFileSync(path.join(writer,'config.json')),before);
 assert.doesNotMatch(JSON.stringify(outcome),/PRIVATE_KEY_DO_NOT_PRINT|SECRET_SOURCE_DO_NOT_PRINT/);
}));

test('valid quota ledger still returns the original quota-only contract',()=>sourceFixture(({data,writer})=>{
 fs.writeFileSync(path.join(writer,'alpaca-quota-ledger.json'),JSON.stringify(fresh({times:[now]})));
 const outcome=inspectAlpacaQuotaReadonly(data,{now});
 assert.equal(outcome.status,'PASS');
 assert.equal(Object.hasOwn(outcome,'sourceInventory'),false);
 assert.equal(outcome.quota.recentReservations,1);
}));

test('missing, symbolic and oversized quota module files remain unverifiable without executing them',()=>sourceFixture(({data,modules})=>{
 const name='quota-ledger.mjs';
 fs.unlinkSync(path.join(modules,name));
 assert.equal(inspectQuotaModuleSourceReadonly(data).modules[2].state,'MISSING');
 fs.writeFileSync(path.join(modules,name),'x'.repeat(1_048_577));
 assert.equal(inspectQuotaModuleSourceReadonly(data).modules[2].state,'SIZE_INVALID');
 fs.unlinkSync(path.join(modules,name));
 const target=path.join(modules,'quota-fetch.mjs');
 try{fs.symlinkSync(target,path.join(modules,name));}
 catch(error){if(process.platform==='win32'&&['EPERM','EACCES'].includes(error.code))return;throw error;}
 const output=inspectQuotaModuleSourceReadonly(data);
 assert.equal(output.modules[2].state,'UNSAFE_FILE');
 assert.equal(output.complete,false);
}));

test('foreign root is not used as an arbitrary file selector',()=>sourceFixture(({temporary,data})=>{
 const foreign=path.join(temporary,'foreign','data');fs.mkdirSync(foreign,{recursive:true});
 assert.equal(inspectQuotaModuleSourceReadonly(foreign).state,'SOURCE_ROOT_UNVERIFIED');
 assert.equal(inspectQuotaModuleSourceReadonly(data).state,'SOURCE_BYTES_AND_CONFIG_READ');
}));
