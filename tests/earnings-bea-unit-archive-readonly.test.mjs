import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectBeaUnitArchiveReadonly} from '../controller/earnings-bea-unit-archive-readonly.mjs';
const series='A463RD3Q052SBEA';
const csv='observation_date,'+series+'\n2025-01-01,0.201\n2025-04-01,0.211\n2025-07-01,0.225\n2025-10-01,0.235\n2026-01-01,0.250\n';
const now=Date.parse('2026-11-23T00:00:00Z');
const digest=value=>createHash('sha256').update(value).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zg-bea-unit-a-'));
 const data=path.join(root,'ZGmini','data');
 const folder=path.join(data,'pc-writer','raw','earnings-bea-unit-profit-r1');
 fs.mkdirSync(folder,{recursive:true});
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const sha=digest(csv);
 const csvFile=path.join(folder,sha+'.csv'),metaFile=path.join(folder,sha+'.json');
 const meta={schemaVersion:'earnings-bea-unit-raw-r1-v1',sourceVersion:sha,
  seriesId:series,sourceUrl:'https://fred.stlouisfed.org/graph/fredgraph.csv?id='+series,
  filename:sha+'.csv',byteLength:Buffer.byteLength(csv),
  sourceStoredAt:Date.parse('2026-10-27T00:00:00Z'),
  sourceRetrievedAt:'2026-10-27T00:00:00.000Z',privateKey:'DO_NOT_EXPOSE'};
 const seed=()=>{fs.writeFileSync(csvFile,csv);fs.writeFileSync(metaFile,JSON.stringify(meta));};
 return {root,data,folder,csvFile,metaFile,sha,meta,seed};
}
test('valid archive hash, metadata, quarterly period and zero-effect attestation',t=>{
 const x=fixture(t);x.seed();
 const before=[digest(fs.readFileSync(x.csvFile)),digest(fs.readFileSync(x.metaFile))];
 const result=inspectBeaUnitArchiveReadonly(x.data,{now});
 assert.equal(result.status,'PASS',JSON.stringify(result));
 assert.equal(result.code,'BEA_UNIT_ARCHIVE_SHA_METADATA_READONLY');
 assert.equal(result.latest.sourceVersion,x.sha);
 assert.equal(result.latest.observedThrough,'2026-03-31');
 assert.equal(result.latest.rowCount,5);
 assert.equal(result.sourceCount,1);assert.equal(result.verifiedCount,1);
 assert.equal(result.providerCalls,0);assert.equal(result.d1Writes,0);
 assert.equal(result.sqliteWrites,0);assert.equal(result.operationalWrites,0);
 assert.equal(result.rawExposed,false);
 assert.deepEqual([digest(fs.readFileSync(x.csvFile)),digest(fs.readFileSync(x.metaFile))],before);
 assert.doesNotMatch(JSON.stringify(result),/DO_NOT_EXPOSE|0\.250|pc-writer|fredgraph/);
});
test('missing archive remains NOT_STORED, not verified',t=>{
 const x=fixture(t);
 const result=inspectBeaUnitArchiveReadonly(x.data,{now});
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'BEA_UNIT_ARCHIVE_NOT_STORED');
 assert.equal(result.latest,null);
});
test('corrupt CSV bytes or metadata and partial archive fail closed',t=>{
 const x=fixture(t);x.seed();
 fs.writeFileSync(x.csvFile,csv.replace('0.250','0.251'));
 assert.equal(inspectBeaUnitArchiveReadonly(x.data,{now}).code,'BEA_UNIT_ARCHIVE_SHA_MISMATCH');
 x.seed();fs.writeFileSync(x.metaFile,JSON.stringify({...x.meta,byteLength:99}));
 assert.equal(inspectBeaUnitArchiveReadonly(x.data,{now}).code,'BEA_UNIT_ARCHIVE_META_MISMATCH');
 x.seed();fs.unlinkSync(x.metaFile);
 assert.equal(inspectBeaUnitArchiveReadonly(x.data,{now}).status,'STATE_UNKNOWN');
});
test('bad quarter sequence and future source timestamps are rejected',t=>{
 const x=fixture(t);x.seed();
 fs.writeFileSync(x.metaFile,JSON.stringify({...x.meta,sourceStoredAt:now+1}));
 assert.equal(inspectBeaUnitArchiveReadonly(x.data,{now}).code,'BEA_UNIT_ARCHIVE_META_MISMATCH');
 const broken=csv.replace('2025-10-01','2026-10-01'),sha=digest(broken);
 fs.unlinkSync(x.csvFile);fs.unlinkSync(x.metaFile);
 fs.writeFileSync(path.join(x.folder,sha+'.csv'),broken);
 fs.writeFileSync(path.join(x.folder,sha+'.json'),JSON.stringify({...x.meta,sourceVersion:sha,filename:sha+'.csv',byteLength:Buffer.byteLength(broken)}));
 assert.equal(inspectBeaUnitArchiveReadonly(x.data,{now}).code,'BEA_UNIT_ARCHIVE_PERIOD_GAP');
});
test('unsafe paths and unexpected files do not count as missing',t=>{
 const x=fixture(t);x.seed();
 fs.writeFileSync(path.join(x.folder,'unexpected.txt'),'bad');
 assert.equal(inspectBeaUnitArchiveReadonly(x.data,{now}).status,'STATE_UNKNOWN');
});
test('symlinked original and archive are rejected',{skip:process.platform==='win32'},t=>{
 const x=fixture(t);x.seed();
 const outside=path.join(x.root,'outside.csv');
 fs.renameSync(x.csvFile,outside);fs.symlinkSync(outside,x.csvFile);
 assert.equal(inspectBeaUnitArchiveReadonly(x.data,{now}).code,'BEA_UNIT_ARCHIVE_UNSAFE_FILE');
 fs.unlinkSync(x.csvFile);fs.renameSync(outside,x.csvFile);
 const other=path.join(x.root,'other');fs.renameSync(x.folder,other);fs.symlinkSync(other,x.folder,'dir');
 assert.equal(inspectBeaUnitArchiveReadonly(x.data,{now}).code,'BEA_UNIT_ARCHIVE_UNSAFE_PATH');
});
test('never accept user supplied arbitrary dataRoot',()=>{
 assert.equal(inspectBeaUnitArchiveReadonly('relative').status,'STATE_UNKNOWN');
 assert.equal(inspectBeaUnitArchiveReadonly(os.tmpdir()).status,'STATE_UNKNOWN');
});
