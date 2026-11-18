import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectBeaMfgArchiveReadonly} from '../controller/earnings-bea-mfg-archive-readonly.mjs';
const series='N400RC1Q027SBEA';
const csv='observation_date,'+series+'\n2025-04-01,681.285\n2025-07-01,741.175\n2025-10-01,801.724\n2026-01-01,812.346\n2026-04-01,1053.304\n';
const sha=createHash('sha256').update(csv).digest('hex'),now=Date.parse('2026-11-18T05:00:00Z');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zg-w05-r311-'));
 const data=path.join(root,'ZGmini','data');
 const folder=path.join(data,'pc-writer','raw','earnings-recession','bea-manufacturing-profits-r5');
 fs.mkdirSync(folder,{recursive:true});
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const meta={schemaVersion:'earnings-bea-manufacturing-raw-r5-v1',sourceVersion:sha,
   seriesId:series,sourceUrl:'https://fred.stlouisfed.org/graph/fredgraph.csv?id='+series,
   file:sha+'.csv',historicalMode:'CURRENT_VINTAGE_NOT_PIT',unit:'BILLIONS_USD_SAAR',
   sourceStoredAt:Date.parse('2026-10-28T00:00:00Z'),sourceRetrievedAt:'2026-10-28T00:00:00.000Z',
   rowCount:5,latestPeriod:'2026-Q2',secret:'PRIVATE_DO_NOT_EXPOSE'};
 const files={csv:path.join(folder,sha+'.csv'),meta:path.join(folder,sha+'.json')};
 const seed=()=>{fs.writeFileSync(files.csv,csv);fs.writeFileSync(files.meta,JSON.stringify(meta));};
 return {root,data,folder,files,meta,seed};
}
test('R3-11 exact CSV and metadata SHA/period verified with zero PC writes',t=>{
 const {data,folder,files,seed}=fixture(t);seed();
 const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 const original=[hash(files.csv),hash(files.meta)],entries=fs.readdirSync(folder).sort();
 const x=inspectBeaMfgArchiveReadonly(data,{now});
 assert.equal(x.status,'PASS',JSON.stringify(x));
 assert.equal(x.code,'BEA_MFG_ARCHIVE_SHA_METADATA_READONLY');
 assert.equal(x.latest.sourceVersion,sha);assert.equal(x.latest.csvSha256,sha);
 assert.equal(x.latest.observedThrough,'2026-Q2');assert.equal(x.latest.rowCount,5);
 assert.equal(x.sourceCount,1);assert.equal(x.invalidCount,0);
 assert.equal(x.providerCalls,0);assert.equal(x.sqliteWrites,0);
 assert.equal(x.d1Writes,0);assert.equal(x.operationalWrites,0);assert.equal(x.rawExposed,false);
 assert.deepEqual([hash(files.csv),hash(files.meta)],original);
 assert.deepEqual(fs.readdirSync(folder).sort(),entries);
 assert.doesNotMatch(JSON.stringify(x),/PRIVATE_DO_NOT_EXPOSE|681\.285|1053\.304|pc-writer|fredgraph/);
 assert.ok(Buffer.byteLength(JSON.stringify(x))<2048);
});
test('missing files never invent a stored BEA source',t=>{
 const {data}=fixture(t);const x=inspectBeaMfgArchiveReadonly(data,{now});
 assert.equal(x.status,'PASS');assert.equal(x.code,'BEA_MFG_ARCHIVE_NOT_STORED');
 assert.equal(x.latest,null);
});
test('mutated CSV, metadata mismatch and unpaired original fail closed',t=>{
 const {data,files,seed,meta}=fixture(t);seed();
 fs.writeFileSync(files.csv,csv.replace('1053.304','900.000'));
 assert.equal(inspectBeaMfgArchiveReadonly(data,{now}).code,'BEA_MFG_ARCHIVE_SHA_MISMATCH');
 seed();fs.writeFileSync(files.meta,JSON.stringify({...meta,rowCount:8}));
 assert.equal(inspectBeaMfgArchiveReadonly(data,{now}).code,'BEA_MFG_ARCHIVE_PERIOD_MISMATCH');
 seed();fs.unlinkSync(files.meta);
 const x=inspectBeaMfgArchiveReadonly(data,{now});
 assert.equal(x.status,'STATE_UNKNOWN');assert.equal(x.verifiedCount,0);
});
test('calendar gap or invalid source stored timestamp cannot be counted as PASS',t=>{
 const {data,folder,files,seed,meta}=fixture(t);seed();
 fs.writeFileSync(files.meta,JSON.stringify({...meta,sourceStoredAt:now+100}));
 assert.equal(inspectBeaMfgArchiveReadonly(data,{now}).code,'BEA_MFG_ARCHIVE_METADATA_MISMATCH');
 seed();const changed=csv.replace('2025-10-01','2026-10-01');
 const s2=createHash('sha256').update(changed).digest('hex');
 fs.writeFileSync(path.join(folder,s2+'.csv'),changed);
 fs.writeFileSync(path.join(folder,s2+'.json'),JSON.stringify({...meta,sourceVersion:s2,file:s2+'.csv'}));
 assert.equal(inspectBeaMfgArchiveReadonly(data,{now}).status,'STATE_UNKNOWN');
});
test('linked CSV and archive directory are rejected before any raw disclosure',
 {skip:process.platform==='win32'},t=>{
 const {data,root,folder,files,seed}=fixture(t);seed();
 const outer=path.join(root,'outside.csv');fs.renameSync(files.csv,outer);
 fs.symlinkSync(outer,files.csv);
 assert.equal(inspectBeaMfgArchiveReadonly(data,{now}).code,'BEA_MFG_ARCHIVE_UNSAFE_PATH');
 fs.unlinkSync(files.csv);fs.renameSync(outer,files.csv);
 const outsideFolder=path.join(root,'outside');
 fs.renameSync(folder,outsideFolder);fs.symlinkSync(outsideFolder,folder,'dir');
 assert.equal(inspectBeaMfgArchiveReadonly(data,{now}).code,'BEA_MFG_ARCHIVE_UNSAFE_PATH');
});
test('no issue supplied path and no arbitrary data root',()=>{
 assert.equal(inspectBeaMfgArchiveReadonly('relative').status,'STATE_UNKNOWN');
 assert.equal(inspectBeaMfgArchiveReadonly(os.tmpdir()).status,'STATE_UNKNOWN');
});

test('BEA quarterly historical archive beginning in 1947 passes the official 4-digit date contract',t=>{
 const {data,folder,meta}=fixture(t);
 const historic='observation_date,'+series+'\n1947-01-01,10.1\n1947-04-01,11.1\n1947-07-01,12.1\n1947-10-01,13.1\n1948-01-01,14.1\n';
 const historicSha=createHash('sha256').update(historic).digest('hex');
 fs.writeFileSync(path.join(folder,historicSha+'.csv'),historic);
 fs.writeFileSync(path.join(folder,historicSha+'.json'),JSON.stringify({
   ...meta,sourceVersion:historicSha,file:historicSha+'.csv',
   latestPeriod:'1948-Q1',rowCount:5
 }));
 const x=inspectBeaMfgArchiveReadonly(data,{now});
 assert.equal(x.status,'PASS',JSON.stringify(x));
 assert.equal(x.latest.sourceVersion,historicSha);
 assert.equal(x.latest.observedThrough,'1948-Q1');
 assert.equal(x.latest.rowCount,5);
 assert.equal(x.providerCalls,0);assert.equal(x.operationalWrites,0);
});

test('dangling archive directory symlink cannot appear as NOT_STORED even when existsSync is false',t=>{
 const {data,folder}=fixture(t);
 const filesystem=Object.create(fs);
 // On Windows unprivileged accounts cannot create a real symlink; simulate the
 // actual lstat/exists disagreement without requiring admin rights.
 filesystem.existsSync=p=>p===folder?false:fs.existsSync(p);
 filesystem.lstatSync=p=>p===folder?
   {isSymbolicLink:()=>true,isDirectory:()=>false}:fs.lstatSync(p);
 const x=inspectBeaMfgArchiveReadonly(data,{filesystem,now});
 assert.equal(x.status,'STATE_UNKNOWN');
 assert.equal(x.code,'BEA_MFG_ARCHIVE_UNSAFE_PATH');
 assert.equal(x.latest,null);
 assert.equal(x.operationalWrites,0);
});
