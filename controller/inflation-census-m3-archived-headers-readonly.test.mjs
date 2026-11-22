import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {inspectInflationCensusM3ArchivedHeaders as inspect} from './inflation-census-m3-archived-headers-readonly.mjs';

const HEAD=['data_type_code','time_slot_date','seasonally_adj','category_code','cell_value','us'];
const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'w01-census-fixed-a-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const data=path.join(root,'data'),raw=path.join(data,'pc-writer','inflation-causal-candidates-r1','raw');
  fs.mkdirSync(raw,{recursive:true});
  const save=(year,payload)=>{
    const bytes=Buffer.from(JSON.stringify(payload)),hash=createHash('sha256').update(bytes).digest('hex');
    const file=path.join(raw,'census-m3-mtm-'+year+'-'+hash+'.json');
    fs.writeFileSync(file,bytes);
    return file;
  };
  return {data,raw,save};
};
test('fixed-year archive headers read without operational writes or observation disclosure',t=>{
  const f=fixture(t);
  f.save(2025,[HEAD,['TI','2025-09-01','yes','MTM','123456','1']]);
  f.save(2026,[HEAD,['TI','2026-09-01','yes','MTM','987654','1']]);
  const before=fs.readdirSync(f.raw);
  const r=inspect(f.data,{strictPlatform:false});
  assert.equal(r.status,'PASS');assert.equal(r.archiveCount,2);
  assert.equal(r.invalidCount,0);assert.deepEqual(r.missingYears,[]);
  assert.equal(r.operationalWrites,0);assert.equal(r.providerCalls,0);
  assert.deepEqual(fs.readdirSync(f.raw),before);
  assert.doesNotMatch(JSON.stringify(r),/123456|987654|\/tmp\/|census-m3-mtm-/);
});
test('missing date/header and duplicate input report only safe vocabulary',t=>{
  const f=fixture(t);
  f.save(2025,[['data_type_code','seasonally_adj','category_code','cell_value','us']]);
  f.save(2026,[['DATA_TYPE_CODE','DATA_TYPE_CODE','time','us','external-secret'],
    ['TI','TI','2026-09','1','PRIVATE']]);
  const r=inspect(f.data,{strictPlatform:false});
  assert.equal(r.status,'DIAGNOSED');
  assert.equal(r.archives[0].hasMonthlyDate,false);
  assert.equal(r.archives[1].duplicateHeaderCount,1);
  assert.deepEqual(r.archives[1].missingRequired,['seasonally_adj','category_code','cell_value']);
  assert.equal(r.archives[1].unknownHeaderCount,1);
  assert.doesNotMatch(JSON.stringify(r),/external-secret|PRIVATE/);
});
test('unused Census metadata collisions do not invalidate consumable headers',t=>{
  const f=fixture(t);
  f.save(2025,[[...HEAD,'','extra_note','extra_note'],
    ['TI','2025-09-01','yes','MTM','123456','1','','PRIVATE','PRIVATE']]);
  f.save(2026,[[...HEAD,'error_data','error_data'],
    ['TI','2026-09-01','yes','MTM','987654','1','N','N']]);
  const r=inspect(f.data,{strictPlatform:false});
  assert.equal(r.status,'PASS');
  assert.equal(r.invalidCount,0);
  assert.deepEqual(r.archives.map(x=>x.shape),['HEADERS_VALID','HEADERS_VALID']);
  assert.equal(r.archives[0].duplicateHeaderCount,1);
  assert.equal(r.archives[0].unknownHeaderCount,1);
  assert.equal(r.archives[1].duplicateHeaderCount,1);
  assert.deepEqual(r.archives.map(x=>x.duplicateConsumedHeaders),[[],[]]);
  assert.doesNotMatch(JSON.stringify(r),/123456|987654|PRIVATE|extra_note/);
});
test('duplicate consumed selector or monthly-date header remains invalid',t=>{
  const f=fixture(t);
  f.save(2025,[[...HEAD,'data_type_code']]);
  f.save(2026,[[...HEAD,'time_slot_date']]);
  const r=inspect(f.data,{strictPlatform:false});
  assert.equal(r.status,'DIAGNOSED');
  assert.equal(r.invalidCount,2);
  assert.deepEqual(r.archives.map(x=>x.shape),['HEADERS_INVALID','HEADERS_INVALID']);
  assert.deepEqual(r.archives.map(x=>x.duplicateHeaderCount),[1,1]);
  assert.deepEqual(r.archives.map(x=>x.duplicateConsumedHeaders),
    [['data_type_code'],['time_slot_date']]);
});
test('missing year does not become a false fully verified result',t=>{
  const f=fixture(t);f.save(2025,[HEAD]);
  const r=inspect(f.data,{strictPlatform:false});
  assert.equal(r.status,'PARTIAL');assert.deepEqual(r.missingYears,[2026]);
});
test('hash mismatch is a safe stop, not parser success',t=>{
  const f=fixture(t),file=f.save(2025,[HEAD]);
  fs.writeFileSync(file,'["changed"]');
  assert.equal(inspect(f.data,{strictPlatform:false}).code,'W01_CENSUS_ARCHIVE_HASH_MISMATCH');
});
test('symlink, missing directory and unsafe scope stop safely',t=>{
  const f=fixture(t),file=f.save(2025,[HEAD]);
  fs.unlinkSync(file);
  const outside=path.join(path.dirname(f.data),'outside.json');fs.writeFileSync(outside,'[]');
  let linked=false;
  try{fs.symlinkSync(outside,file);linked=true;}
  catch(e){if(!['EPERM','EACCES','ENOTSUP'].includes(e.code))throw e;}
  if(linked)assert.equal(inspect(f.data,{strictPlatform:false}).code,
    'W01_CENSUS_ARCHIVE_FILE_UNSAFE');
  fs.rmSync(f.raw,{recursive:true,force:true});
  assert.equal(inspect(f.data,{strictPlatform:false}).code,'W01_CENSUS_ARCHIVE_DIR_UNAVAILABLE');
  assert.equal(inspect(f.raw,{strictPlatform:false}).code,'W01_CENSUS_ARCHIVE_DIR_UNAVAILABLE');
});
test('strict Windows PC admission denies synthetic test roots on every platform',t=>{
  const f=fixture(t);
  assert.equal(inspect(f.data).code,'W01_CENSUS_ARCHIVE_ROOT_DENIED');
});
