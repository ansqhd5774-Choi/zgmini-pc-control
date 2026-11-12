import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectD05LineageReadonly,summarizeD05LineageOperation} from '../controller/d05-lineage-readonly.mjs';

const SHA_A='a'.repeat(40),SHA_B='b'.repeat(40);

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'d05-reader-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return {root,dir:path.join(root,'pc-writer','score-lineage'),
  file:path.join(root,'pc-writer','score-lineage','d05-composite-events-v1.jsonl')};
}
function row(date,source=SHA_A){
 const calculatedAt=`${date}T12:00:00.000Z`;
 const stable={schema:'D05_COMPOSITE_INPUT_LINEAGE_LOCAL_V1',
  eventId:`D05/CM-R1/${calculatedAt}`,calculatedAt,asOfDate:date,score:50,
  outputSignature:'12345678',archiveKey:`composite-observed:${date}`,archiveStoredAt:Date.parse(calculatedAt),
  approvedSourceSha:source,runtimeSourceSha:source,
  inputScope:'SELECTED_7_BATCHES_ONLY',inputStatus:'LOCAL_SELECTED_7_MATCHED',
  selectionEvidence:'POST_SELECTION_UNIQUE_MATCH',
  effectiveUseVerified:false,completeD05InputLineage:false,publicD1Verified:false,
  sources:['macro','credit','supply','fundFlows','bisDsr','bisTc','rates'].map(sourceKey=>({
   sourceKey,batchKey:`${sourceKey}:PRIVATE_NOT_RETURNED`,storedAt:1,
   storedBodySha256:'c'.repeat(64),selectionWitness:'POST_SELECTION_MATCH_ONLY'}))};
 const stableEvidenceDigestSha256=createHash('sha256').update(JSON.stringify(stable)).digest('hex');
 return {status:'PREPARED_LOCAL_ONLY',...stable,recordedAt:`${date}T12:00:01.000Z`,stableEvidenceDigestSha256};
}

test('D05 fixed path missing is nonmutating and not called a success',t=>{
 const {root,dir}=fixture(t);
 fs.mkdirSync(path.join(root,'pc-writer'));
 const result=inspectD05LineageReadonly(root,{approvedSourceSha:SHA_A});
 assert.equal(result.code,'D05_LEDGER_ABSENT');
 assert.equal(result.eventCount,null);
 assert.equal(fs.existsSync(dir),false);
 assert.equal(result.operationalWrites,0);
});

test('D05 valid JSONL yields only aggregate proof and installed-source count',t=>{
 const {root,dir,file}=fixture(t);fs.mkdirSync(dir,{recursive:true});
 const input=[row('2026-11-09'),row('2026-11-10',SHA_B),row('2026-11-11')];
 fs.writeFileSync(file,input.map(x=>JSON.stringify(x)).join('\n')+'\n');
 const result=inspectD05LineageReadonly(root,{approvedSourceSha:SHA_A});
 assert.equal(result.status,'PASS');
 assert.equal(result.eventCount,3);
 assert.equal(result.distinctCalculatedDates,3);
 assert.equal(result.earliestCalculatedAt,'2026-11-09T12:00:00.000Z');
 assert.equal(result.latestCalculatedAt,'2026-11-11T12:00:00.000Z');
 assert.equal(result.currentApprovedSourceEventCount,2);
 assert.match(result.sha256,/^[a-f0-9]{64}$/);
 assert.equal(result.aclEvidence,'NOT_VERIFIED_BY_NODE_FS');
 assert.equal(result.backupEvidence,'NOT_VERIFIED');
 const serialized=JSON.stringify(result);
 assert.equal(serialized.includes('PRIVATE_NOT_RETURNED'),false);
 assert.equal(serialized.includes(SHA_A),false);
});

test('D05 malformed, duplicate and partial lines fail closed',t=>{
 const {root,dir,file}=fixture(t);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(file,JSON.stringify(row('2026-11-10')));
 assert.equal(inspectD05LineageReadonly(root).code,'D05_LEDGER_PARTIAL_LINE');
 fs.writeFileSync(file,'{bad json}\n');
 assert.equal(inspectD05LineageReadonly(root).code,'D05_LEDGER_ROW_UNPROVEN');
 const same=JSON.stringify(row('2026-11-10'))+'\n';
 fs.writeFileSync(file,same+same);
 assert.equal(inspectD05LineageReadonly(root).code,'D05_LEDGER_ROW_UNPROVEN');
 const damaged=row('2026-11-10');damaged.stableEvidenceDigestSha256='e'.repeat(64);
 fs.writeFileSync(file,JSON.stringify(damaged)+'\n');
 assert.equal(inspectD05LineageReadonly(root).code,'D05_LEDGER_ROW_UNPROVEN');
 fs.writeFileSync(file,Buffer.concat([Buffer.from(JSON.stringify(row('2026-11-10'))),Buffer.from([0xff,10])]));
 assert.equal(inspectD05LineageReadonly(root).code,'D05_LEDGER_UTF8_UNPROVEN');
});

test('D05 installed-source proof requires both approved and runtime SHA',t=>{
 const {root,dir,file}=fixture(t);fs.mkdirSync(dir,{recursive:true});
 const mismatch=row('2026-11-10');mismatch.runtimeSourceSha=SHA_B;
 const {status,recordedAt,stableEvidenceDigestSha256,...stable}=mismatch;
 mismatch.stableEvidenceDigestSha256=createHash('sha256').update(JSON.stringify(stable)).digest('hex');
 fs.writeFileSync(file,JSON.stringify(mismatch)+'\n');
 const result=inspectD05LineageReadonly(root,{approvedSourceSha:SHA_A});
 assert.equal(result.status,'PASS');
 assert.equal(result.currentApprovedSourceEventCount,0);
});

test('D05 symbolic link and bounded-size violations fail closed',t=>{
 const {root,dir,file}=fixture(t);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(file,JSON.stringify(row('2026-11-10'))+'\n');
 assert.equal(inspectD05LineageReadonly(root,{maxLedgerBytes:1}).code,'D05_LEDGER_SIZE_UNPROVEN');
 const target=path.join(root,'outside.jsonl');fs.writeFileSync(target,'sensitive');
 fs.rmSync(file);
 try{
  fs.symlinkSync(target,file);
 }catch(error){
  // The isolated Windows CI account has no symlink privilege. Keep the
  // same rejection assertion, using a fabricated lstat result only there.
  if(!['EPERM','EACCES','ENOTSUP'].includes(error?.code))throw error;
  fs.writeFileSync(file,'not-a-link');
  const simulatedFileSystem={...fs,
   lstatSync(location,options){
    const actual=fs.lstatSync(location,options);
    if(path.resolve(location)!==path.resolve(file))return actual;
    return new Proxy(actual,{get(stat,key,receiver){
     if(key==='isSymbolicLink')return ()=>true;
     return Reflect.get(stat,key,receiver);
    }});
   },
   openSync(){throw Error('SYMLINK_WAS_FOLLOWED');},
  };
  assert.equal(inspectD05LineageReadonly(root,
   {fileSystem:simulatedFileSystem}).code,'D05_LEDGER_FILE_UNPROVEN');
  return;
 }
 assert.equal(inspectD05LineageReadonly(root).code,'D05_LEDGER_FILE_UNPROVEN');
});

test('D05 reader rejects arbitrary root, approved source and budget',()=>{
 assert.equal(inspectD05LineageReadonly('../relative').code,'D05_READONLY_INPUT_INVALID');
 assert.equal(inspectD05LineageReadonly('/safe',{approvedSourceSha:'bad'}).code,'D05_READONLY_INPUT_INVALID');
 assert.equal(inspectD05LineageReadonly('/safe',{maxLedgerBytes:-1}).code,'D05_READONLY_INPUT_INVALID');
 assert.equal(inspectD05LineageReadonly('/safe',{maxLedgerBytes:64*1024*1024+1}).code,'D05_READONLY_INPUT_INVALID');
});

test('D05 missing data root is distinct from missing lineage file',t=>{
 const {root}=fixture(t);
 assert.equal(inspectD05LineageReadonly(path.join(root,'missing')).code,'D05_DATA_ROOT_ABSENT');
});

test('D05 A result envelope must not promote missing and malformed ledgers to PASS',t=>{
 const {root,dir,file}=fixture(t);fs.mkdirSync(dir,{recursive:true});
 const absent=summarizeD05LineageOperation(inspectD05LineageReadonly(root));
 assert.equal(absent.status,'BLOCKED');
 assert.equal(absent.code,'D05_LEDGER_ABSENT');
 assert.equal(absent.lineage.status,'UNPROVEN');
 assert.equal(absent.operationalWrites,0);
 fs.writeFileSync(file,'{malformed}\n');
 const invalid=summarizeD05LineageOperation(inspectD05LineageReadonly(root));
 assert.equal(invalid.status,'BLOCKED');
 assert.equal(invalid.code,'D05_LEDGER_ROW_UNPROVEN');
 assert.equal(invalid.lineage.status,'UNPROVEN');
 assert.equal(invalid.providerCalls,0);
 assert.equal(invalid.d1Writes,0);
});

test('D05 A result envelope succeeds only for sanitized verified evidence',t=>{
 const {root,dir,file}=fixture(t);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(file,JSON.stringify(row('2026-11-10'))+'\n');
 const report=summarizeD05LineageOperation(inspectD05LineageReadonly(root,{approvedSourceSha:SHA_A}));
 assert.equal(report.status,'PASS');
 assert.equal(report.code,'D05_READONLY_DIAGNOSIS');
 assert.equal(report.lineage.code,'D05_LEDGER_SANITIZED_READONLY_VERIFIED');
 assert.equal(report.lineage.eventCount,1);
 assert.equal(report.sqliteOpened,false);
 assert.equal(report.operationalWrites,0);
 const strange=summarizeD05LineageOperation({status:'PASS',code:'UNRECOGNIZED'});
 assert.equal(strange.status,'BLOCKED');
 assert.equal(strange.code,'D05_LINEAGE_UNPROVEN');
});
