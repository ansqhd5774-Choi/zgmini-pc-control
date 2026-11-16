import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectProviderActivity} from '../controller/provider-activity-runtime-readonly.mjs';
const NOW=Date.parse('2026-11-15T12:50:00.000Z');
function fixture(fn){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-activity-'));
 const home=path.join(d,'pc-writer');fs.mkdirSync(home);
 const file=path.join(home,'collection-events.jsonl');
 try{return fn({d,file,write:(items)=>fs.writeFileSync(file,items.map(v=>typeof v==='string'?v:JSON.stringify(v)).join('\n')+'\n')});}
 finally{fs.rmSync(d,{recursive:true,force:true});}
}
const event=(date,providers)=>({at:date,lane:'core',status:'COMPLETE',providers});
const host=(statuses)=>({requests:Object.values(statuses).reduce((a,v)=>a+v,0),statuses});

test('two distinct days of GET 2xx observed but not installed-activity proof',()=>fixture(({d,write})=>{
 write([event('2026-11-14T12:00:00Z',{'api.earningsapi.com':host({'200':15})}),event('2026-11-15T12:00:00Z',{'api.earningsapi.com':host({'200':15})})]);
 const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.status,'PASS');
 assert.equal(x.hosts[0].requestCount,30);assert.equal(x.hosts[0].observedDayCount,2);
 assert.equal(x.hosts[0].statusCounts.ok2xx,30);assert.equal(x.activeEndpointCount,null);
 assert.equal(x.providerCalls,0);assert.equal(x.sqliteOpened,false);
}));

test('a recent 503 after previous success is visible and does not become healthy',()=>fixture(({d,write})=>{
 write([event('2026-11-11T00:00:00Z',{'api.stlouisfed.org':host({'200':4})}),event('2026-11-15T12:00:00Z',{'api.stlouisfed.org':host({'503':1})})]);
 const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.hosts[0].lastRunResponses.server5xx,1);
 assert.equal(x.hosts[0].lastRunResponses.ok2xx,0);assert.equal(x.hosts[0].last2xxRunAt,'2026-11-11T00:00:00.000Z');
}));

test('network, quota and 429 categorized without implying HTTP success',()=>fixture(({d,write})=>{
 write([event('2026-11-15T11:00:00Z',{'api.bls.gov':host({'NETWORK_ERROR':1,'PROVIDER_QUOTA_GUARD':2,'429':1})})]);
 const x=inspectProviderActivity(d,{now:NOW});const z=x.hosts[0].statusCounts;
 assert.deepEqual([z.networkError,z.quotaGuard,z.client4xx,z.ok2xx],[1,2,1,0]);
}));

test('sensitive payload is never returned',()=>fixture(({d,write})=>{
 write([{...event('2026-11-15T11:00:00Z',{'api.bls.gov':host({'200':1})}),secret:'DO-NOT-LEAK',url:'https://api.bls.gov?a=API_SECRET'}]);
 assert.ok(!JSON.stringify(inspectProviderActivity(d,{now:NOW})).includes('DO-NOT-LEAK'));
 assert.ok(!JSON.stringify(inspectProviderActivity(d,{now:NOW})).includes('API_SECRET'));
}));

test('no log means unknown, not healthy',()=>fixture(({d})=>{
 const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.status,'STATE_UNKNOWN');assert.equal(x.activeEndpointCount,null);
}));

test('reject symlinked source',()=>fixture(({d,file})=>{
 const external=path.join(os.tmpdir(),'zgmini-symlink-'+process.pid+'.jsonl');fs.writeFileSync(external,'{}\n');
 try{fs.symlinkSync(external,file);const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.status,'STATE_UNKNOWN');assert.equal(x.code,'UNSAFE_LOG_FILE');}
 finally{fs.rmSync(external,{force:true});}
}));

test('truncated last append and malformed JSON never pass as full evidence',()=>fixture(({d,file})=>{
 fs.writeFileSync(file,JSON.stringify(event('2026-11-15T11:00:00Z',{'api.bls.gov':host({'200':1})}))+'\n{bad\n{unterminated');
 const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.status,'STATE_UNKNOWN');assert.equal(x.invalidRows,1);
 assert.equal(x.hosts[0].requestCount,1);
}));

test('reject counts that do not reconcile with status counts',()=>fixture(({d,write})=>{
 write([event('2026-11-15T11:00:00Z',{'api.bls.gov':{requests:20,statuses:{'200':5}}})]);
 const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.status,'STATE_UNKNOWN');assert.equal(x.invalidRows,1);
}));

test('duplicate exact log records are not double counted',()=>fixture(({d,write})=>{
 const v=event('2026-11-15T11:00:00Z',{'api.bls.gov':host({'200':4})});write([v,v]);
 const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.duplicateLines,1);assert.equal(x.hosts[0].requestCount,4);assert.equal(x.status,'STATE_UNKNOWN');
}));

test('KST midnight creates distinct observed days',()=>fixture(({d,write})=>{
 write([event('2026-11-14T14:55:00Z',{'api.bls.gov':host({'200':1})}),event('2026-11-14T15:05:00Z',{'api.bls.gov':host({'200':1})})]);
 assert.equal(inspectProviderActivity(d,{now:NOW}).hosts[0].observedDayCount,2);
}));

test('14-day window excludes older historical successes',()=>fixture(({d,write})=>{
 write([event('2026-10-15T12:00:00Z',{'api.bls.gov':host({'200':1})}),event('2026-11-15T12:00:00Z',{'api.bls.gov':host({'500':1})})]);
 const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.hosts[0].last2xxRunAt,null);
 assert.equal(x.hosts[0].requestCount,1);
}));

test('safe hostnames only; unknown domains remain unverified',()=>fixture(({d,write})=>{
 write([event('2026-11-15T12:00:00Z',{'localhost':host({'200':1}),'api.earningsapi.com':host({'200':1})})]);
 const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.hiddenHosts,1);
 assert.equal(x.hosts.length,1);assert.equal(x.status,'STATE_UNKNOWN');
}));

test('successful cycle events with no network requests do not imply active providers',()=>fixture(({d,write})=>{
 write([event('2026-11-15T12:00:00Z',{})]);
 const x=inspectProviderActivity(d,{now:NOW});assert.equal(x.status,'STATE_UNKNOWN');
 assert.equal(x.code,'PROVIDER_ACTIVITY_NO_OBSERVED_HOSTS');assert.equal(x.activeEndpointCount,null);
}));


test('observed HTTP 32-host cohort returns exact names and 29/1/2 evidence replay',()=>fixture(({d,write})=>{
 const domains=Array.from({length:32},(_,i)=>'api'+String(i).padStart(2,'0')+'.provider.example.org');
 const first=Object.fromEntries(domains.map(name=>[name,host({'200':1})]));
 const second=Object.fromEntries(domains.filter((_,i)=>i!==2).map((name,i)=>[
  name,host({[name===domains[0]?'503':name===domains[1]?'429':'200']:1})]));
 write([event('2026-11-11T12:00:00.000Z',first),event('2026-11-15T12:00:00.000Z',second)]);
 const out=inspectProviderActivity(d,{now:NOW});
 assert.equal(out.monitoredHostCount,32);
 assert.equal(out.monitoredHostsReturned,32);
 assert.deepEqual(out.http,{normal:29,failed:1,unknown:2,total:32});
 assert.deepEqual(out.hosts.filter(x=>x.monitored).map(x=>x.host).sort(),domains);
 assert.equal(out.hosts.find(x=>x.host===domains[0]).lastRunStatuses['503'],1);
 assert.equal(out.hosts.find(x=>x.host===domains[0]).monitoringState,'failed');
 assert.equal(out.hosts.find(x=>x.host===domains[1]).monitoringState,'unknown');
 assert.equal(out.hosts.find(x=>x.host===domains[2]).reason,'NO_VERIFIED_SCHEDULE_OVER_36H');
 assert.equal(out.providerCalls,0);assert.equal(out.operationalWrites,0);
}));
test('one-off hosts cannot displace the 32-member repeated monitoring roster',()=>fixture(({d,write})=>{
 const repeated=Object.fromEntries(Array.from({length:32},(_,i)=>['repeated'+i+'.provider.org',host({'200':1})]));
 const singleton=Object.fromEntries(Array.from({length:64},(_,i)=>['oneoff'+i+'.provider.org',host({'200':1})]));
 write([event('2026-11-14T12:00:00Z',repeated),event('2026-11-15T12:00:00Z',{...repeated,...singleton})]);
 const out=inspectProviderActivity(d,{now:NOW});
 assert.equal(out.monitoredHostCount,32);
 assert.equal(out.monitoredHostsReturned,32);
 assert.equal(out.http.normal,32);
 assert.equal(out.hostsReturned,64);
 assert.equal(out.omittedHosts,32);
 assert.equal(out.status,'STATE_UNKNOWN');
}));
test('publisher cadence heuristic can flag healthy provider as unknown rather than confirmed failure',()=>fixture(({d,write})=>{
 const rows=Array.from({length:7},(_,i)=>event(new Date(Date.parse('2026-11-06T12:00:00Z')+i*86400000).toISOString(),
  {'monthly.provider.org':host({'200':1})}));
 write(rows);
 const out=inspectProviderActivity(d,{now:NOW});
 assert.equal(out.monitoredHostCount,1);
 assert.equal(out.http.failed,0);
 assert.equal(out.http.unknown,1);
 assert.equal(out.hosts[0].reason,'ESTIMATED_CADENCE_OVERDUE');
 assert.equal(out.hosts[0].lastRunStatuses['200'],1);
}));
test('host list and status counters never disclose raw response URL, header or credential',()=>fixture(({d,write})=>{
 write([event('2026-11-14T12:00:00Z',{'sec-data.gov':host({'200':1})}),
 {...event('2026-11-15T12:00:00Z',{'sec-data.gov':host({'404':1})}),
  responseUrl:'https://sec-data.gov/?api_key=SEC-PRIVATE-KEY',authorization:'Bearer TOPSECRET'}]);
 const out=inspectProviderActivity(d,{now:NOW});
 const serialized=JSON.stringify(out);
 assert.equal(out.http.failed,1);
 assert.ok(!serialized.includes('SEC-PRIVATE-KEY'));
 assert.ok(!serialized.includes('TOPSECRET'));
 assert.ok(!serialized.includes('responseUrl'));
}));
