import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectInflationCandidatesRuntimeReadonly as inspect} from './inflation-candidates-runtime-readonly.mjs';

const VERSION='INFL_CANDIDATE_FIXTURE_R1',STAMP='2026-11-08T00:00:00.000Z';
const mk=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'infl-cand-reader-'));
  const target=path.join(root,'pc-writer','inflation-causal-candidates-r1');
  fs.mkdirSync(target,{recursive:true});
  return {root,target,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
};
const header=provider=>({schemaVersion:1,provider,sourceVersion:VERSION,sourceStoredAt:STAMP});
const row=(date,value=1)=>({date,value});
const write=(dir,name,obj)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(obj));
const fixture=dir=>{
  write(dir,'bls-cpi-ppi3.json',{
    ...header('BLS'),series:{CUSR0000SEHA:[row('2026-10-01',150)],
      CUSR0000SEHC01:[row('2026-10-01',152)],WPSFD4:[row('2026-09-01',155)]}});
  write(dir,'treasury-mts-customs-duties.json',{
    ...header('US_TREASURY_MTS'),observations:[{date:'2026-09-01',netUsdDecimal:'2.50'}]});
  write(dir,'census-m3-manufacturing-inventories.json',{
    ...header('US_CENSUS_M3'),observations:[row('2026-09-01',950)]});
  write(dir,'fed-g17-manufacturing-ip.json',{
    ...header('FEDERAL_RESERVE_G17'),observations:[row('2026-09-01',101)]});
  write(dir,'eia-us-regular-gasoline-weekly.json',{
    ...header('EIA'),observations:[row('2026-10-05',3.3)],missing:[{date:'2026-10-12',status:'NOT_REPORTED'}]});
  write(dir,'core-attempts-r1.json',{
    schema:'ZGMINI_INFLATION_CANDIDATE_CORE_R1',
    processed:{cpi:{eventKey:'release:bls:cpi:2026-10-01',observationDate:'2026-10-01'}},
    attempted:{cpi:{eventKey:'release:bls:cpi:2026-10-01',at:STAMP}}});
};

test('7 indicators, 6 groups, valid snapshots with read-only and no provider calls',()=>{
  const x=mk();try{
    fixture(x.target);
    const files=fs.readdirSync(x.target).map(f=>({f,mtime:fs.statSync(path.join(x.target,f)).mtimeMs}));
    const result=inspect(x.root);
    assert.equal(result.status,'PASS');
    assert.deepEqual(result.indicators.map(i=>i.id),[22,23,24,16,28,29,2]);
    assert.equal(result.indicatorCount,7);assert.equal(result.collectorGroupCount,6);
    assert.equal(result.presentValidCount,7);
    assert.equal(result.groups.find(g=>g.group==='cpi').status,'PRESENT_VALID');
    assert.equal(result.checkpointStatus,'PRESENT_VALID');
    assert.equal(result.groups.find(g=>g.group==='cpi').checkpoint.processed,true);
    assert.equal(result.operationalReadiness,'NOT_ASSERTED');
    assert.equal(result.providerCalls,0);assert.equal(result.d1Writes,0);
    assert.equal(result.operationalWrites,0);assert.equal(result.sqliteOpened,false);
    assert.match(result.indicators[0].fileSha256,/^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(result).includes('release:bls'));
    assert.ok(!JSON.stringify(result).includes('netUsdDecimal'));
    assert.ok(!JSON.stringify(result).includes('3.3'));
    assert.deepEqual(files.map(({f})=>fs.statSync(path.join(x.target,f)).mtimeMs),files.map(f=>f.mtime));
  }finally{x.cleanup();}
});

test('missing data does not claim a successful collection',()=>{
  const x=mk();try{
    const result=inspect(x.root);
    assert.equal(result.status,'PASS');assert.equal(result.presentValidCount,0);
    assert.ok(result.indicators.every(i=>i.status==='MISSING'));
    assert.equal(result.checkpointStatus,'MISSING');
  }finally{x.cleanup();}
});

test('one missing BLS CPI series does not invalidate an independently stored PPI',()=>{
  const x=mk();try{
    write(x.target,'bls-cpi-ppi3.json',{...header('BLS'),series:{WPSFD4:[row('2026-09-01',10)]}});
    const result=inspect(x.root);
    assert.equal(result.indicators.find(i=>i.id===24).status,'PRESENT_VALID');
    assert.equal(result.indicators.find(i=>i.id===22).status,'INVALID');
    assert.equal(result.groups.find(g=>g.group==='cpi').status,'INVALID');
  }finally{x.cleanup();}
});

test('invalid JSON, source metadata, invalid date and unsafe symlink are sanitized',()=>{
  const x=mk();try{
    fixture(x.target);
    fs.writeFileSync(path.join(x.target,'fed-g17-manufacturing-ip.json'),'{bad json includes secret TOKEN=123');
    write(x.target,'treasury-mts-customs-duties.json',{
      ...header('US_TREASURY_MTS'),sourceVersion:'USER SECRET TOKEN 123',
      observations:[{date:'2026-09-01',netUsdDecimal:'2.50'}]});
    write(x.target,'census-m3-manufacturing-inventories.json',{
      ...header('US_CENSUS_M3'),observations:[row('2026-02-30',95)]});
    fs.unlinkSync(path.join(x.target,'eia-us-regular-gasoline-weekly.json'));
    fs.symlinkSync(path.join(x.target,'bls-cpi-ppi3.json'),path.join(x.target,'eia-us-regular-gasoline-weekly.json'));
    const result=inspect(x.root);
    assert.equal(result.indicators.find(i=>i.id===29).status,'INVALID');
    assert.equal(result.indicators.find(i=>i.id===16).status,'INVALID');
    assert.equal(result.indicators.find(i=>i.id===28).status,'INVALID');
    assert.equal(result.indicators.find(i=>i.id===2).status,'UNSAFE');
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  }finally{x.cleanup();}
});

test('malformed checkpoint does not falsely imply processed candidate status',()=>{
  const x=mk();try{
    fixture(x.target);
    write(x.target,'core-attempts-r1.json',{
      schema:'ZGMINI_INFLATION_CANDIDATE_CORE_R1',processed:{cpi:{eventKey:'x',observationDate:'2026-02-30'}},attempted:{}});
    const result=inspect(x.root);
    assert.equal(result.checkpointStatus,'INVALID');
    assert.equal(result.groups.find(g=>g.group==='cpi').checkpoint,null);
    assert.equal(result.presentValidCount,7);
  }finally{x.cleanup();}
});

test('no directory, unexpected root and symlinked candidate directory',()=>{
  assert.throws(()=>inspect('relative'),/INFL_CANDIDATES_READONLY_DATA_ROOT_DENIED/);
  const x=mk();try{
    fs.rmSync(x.target,{recursive:true});
    assert.equal(inspect(x.root).candidateDirectoryStatus,'MISSING');
    fs.symlinkSync(x.root,x.target);
    assert.equal(inspect(x.root).candidateDirectoryStatus,'UNSAFE');
  }finally{x.cleanup();}
});
