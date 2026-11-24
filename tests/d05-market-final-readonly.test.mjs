import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {projectD05MarketRow,compareD05MarketStored,inspectD05MarketFinalReadonly}
 from '../controller/d05-market-final-readonly.mjs';

const IDS=['inflation','employment','rates','credit','growth','consumption',
 'earnings','liquidity','fundFlows','breadth','dollarFx','commodities'];
const at=Date.parse('2026-11-24T05:20:00.000Z');
const makeBody=()=>({status:'SUCCESS',asOfDate:'2026-11-20',
 overall:{status:'READY',score:50,methodologyVersion:'CM-R1'},
 domains:IDS.map((id,i)=>({id,status:'READY',score:i+20,
  asOfDate:'2026-11-20',methodologyVersion:'DOMAIN-R1'}))});
const row=(body=makeBody(),stored_at=at)=>({body:JSON.stringify(body),stored_at});
test('D05 exactly 13 saved outputs and identical current/day evidence',()=>{
 const r=compareD05MarketStored(row(),row(),{dayKey:'2026-11-24'});
 assert.equal(r.status,'PASS');
 assert.equal(r.code,'D05_MARKET_13_STORED_SNAPSHOT_MATCHED');
 assert.equal(r.localCurrent.outputs.length,13);
 assert.deepEqual(r.localCurrent.outputs.map(x=>x.id),['overall',...IDS]);
 assert.equal(r.localCurrent.calculatedAt,null);
 assert.equal(r.localCurrent.calculationReceiptVerified,false);
 assert.equal(r.sameEventVerified,false);
 assert.equal(r.localStoredSnapshotMatched,true);
 assert.equal(r.d1Readback,'NOT_PERFORMED');
 assert.equal(r.apiReadback,'NOT_PERFORMED');
 assert.equal(r.oneYearPitVerified,false);
 assert.equal(r.operationalWrites,0);
});
test('domain presentation order does not alter canonical ID mapping',()=>{
 const b=makeBody();b.domains.reverse();
 const p=projectD05MarketRow(row(b),'current');
 assert.deepEqual(p.outputs.map(x=>x.id),['overall',...IDS]);
});
test('different same-date storage rows are not marked as matched',()=>{
 const other=makeBody();other.domains[2].score=99;
 const r=compareD05MarketStored(row(),row(other),{dayKey:'2026-11-24'});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.localStoredSnapshotMatched,false);
});
test('missing domain, unexpected id, invalid score, invalid body and wrong timestamp fail closed',()=>{
 const missing=makeBody();missing.domains.pop();
 assert.equal(projectD05MarketRow(row(missing),'current'),null);
 const wrong=makeBody();wrong.domains[0].id='unexpected';
 assert.equal(projectD05MarketRow(row(wrong),'current'),null);
 const broken=makeBody();broken.overall.score=null;
 assert.equal(projectD05MarketRow(row(broken),'current'),null);
 assert.equal(projectD05MarketRow({body:'{',stored_at:at},'current'),null);
 const r=compareD05MarketStored(row(),row(),{dayKey:'2026-11-23'});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'D05_MARKET_STORED_DAY_MISMATCH');
});
test('fixed SQLite lookup reads current and exact UTC day with no operational writes',()=>{
 const queried=[];
 const fake={
  prepare(sql){assert.match(sql,/market_public_snapshots_v1/);
   return {get(key){queried.push(key);return row();}};},
  exec(sql){assert.equal(sql,'ROLLBACK');},close(){}
 };
 const files={
  realpathSync:Object.assign(p=>p,{native:p=>p}),
  lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:1024})
 };
 const out=inspectD05MarketFinalReadonly(path.resolve('tmp-test-d05'),{fileSystem:files,
  openDatabase:()=>fake});
 assert.equal(out.status,'PASS');
 assert.deepEqual(queried,['current','2026-11-24']);
 assert.equal(out.sqliteOpened,true);
});
test('operation declaration and routing stay registered',()=>{
 const operations=fs.readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 const config=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 assert.deepEqual(config.operations['d05-market-final-readonly'],
  {grade:'A',timeoutSeconds:60,resource:'light'});
 assert.match(operations,/request\.operation==='d05-market-final-readonly'/);
});
