import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {inspectInflation19RuntimeReadonly,inflation7WriterState}
 from '../controller/inflation19-runtime-readonly.mjs';

const stamp='2026-11-18T07:00:12.796Z';
const sourceStoredAt=Date.parse('2026-11-16T10:30:02.905Z');
const sourceVersion='INFL7_PRESENTATION_'+ 'a'.repeat(64);
const key='detail:inflation-causal-candidates-7:r1';
function root(t,writer){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w01-infl7-writer-a-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const home=path.join(root,'pc-writer');fs.mkdirSync(home);
 if(writer)fs.writeFileSync(path.join(home,'local-writer-last-run.json'),JSON.stringify(writer));
 return root;
}

test('existing Inflation19 A reads exact bounded inflation7 Writer receipt without I/O',t=>{
 const writer={at:stamp,status:'VERIFIED',
   inflation19:{status:'SKIPPED_METADATA_ONLY',ready:19,d1Writes:0},
   inflation7:{status:'READBACK_VERIFIED',key,ready:6,d1Writes:1,
     sourceVersion,sourceStoredAt},
   secret:'MUST_NOT_LEAK',otherRaw:{credential:'NEVER_EXPOSE'}};
 const result=inspectInflation19RuntimeReadonly(root(t,writer));
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'INFL19_RUNTIME_READONLY_EVIDENCE');
 assert.equal(result.writer.status,'SKIPPED_METADATA_ONLY');
 assert.equal(result.inflation7Writer.status,'READBACK_VERIFIED');
 assert.equal(result.inflation7Writer.key,key);
 assert.equal(result.inflation7Writer.readyCount,6);
 assert.equal(result.inflation7Writer.d1Writes,1);
 assert.equal(result.inflation7Writer.sourceVersion,sourceVersion);
 assert.equal(result.inflation7Writer.sourceStoredAt,sourceStoredAt);
 assert.equal(result.inflation7Writer.verifiedAtWriterTime,true);
 assert.equal(result.inflation7Writer.d1NowVerified,false);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.sqliteOpened,false);
 assert.doesNotMatch(JSON.stringify(result),/MUST_NOT_LEAK|NEVER_EXPOSE|credential|otherRaw/);
});

test('missing and metadata-only inflation7 ledger cannot claim D1 readback',t=>{
 const noLedger=inspectInflation19RuntimeReadonly(root(t));
 assert.equal(noLedger.inflation7Writer.availability,'MISSING');
 const writer={at:stamp,status:'VERIFIED',
   inflation7:{status:'SKIPPED_METADATA_ONLY',ready:6,d1Writes:0}};
 const result=inspectInflation19RuntimeReadonly(root(t,writer));
 assert.equal(result.inflation7Writer.status,'SKIPPED_METADATA_ONLY');
 assert.equal(result.inflation7Writer.verifiedAtWriterTime,false);
 assert.equal(result.inflation7Writer.d1NowVerified,false);
 assert.equal(result.inflation7Writer.key,null);
 assert.equal(result.inflation7Writer.readyCount,6);
});

test('unknown status/key/source fields and bad write counts never certify a receipt',t=>{
 const prior={at:stamp,status:'VERIFIED',inflation7:{
  status:'READBACK_VERIFIED',key,ready:6,d1Writes:1,sourceVersion,sourceStoredAt}};
 const cases=[
  w=>{w.inflation7.key='private:secret';},
  w=>{w.inflation7.sourceVersion='SENSITIVE_TOKEN';},
  w=>{w.inflation7.sourceStoredAt=Date.parse(stamp)+1000000;},
  w=>{w.inflation7.ready=7000;},
  w=>{w.inflation7.d1Writes=9000;},
  w=>{w.inflation7.d1Writes=0;},
 ];
 for(const mutate of cases){
  const changed=structuredClone(prior);mutate(changed);
  const out=inspectInflation19RuntimeReadonly(root(t,changed));
  assert.equal(out.inflation7Writer.status,'CONTRACT_UNVERIFIED');
  assert.equal(out.inflation7Writer.verifiedAtWriterTime,false);
  assert.equal(out.inflation7Writer.d1NowVerified,false);
 }
 const unexpected=structuredClone(prior);unexpected.inflation7.status='SUPER_SECRET';
 const u=inspectInflation19RuntimeReadonly(root(t,unexpected));
 assert.equal(u.inflation7Writer.status,'UNREPORTED');
 assert.doesNotMatch(JSON.stringify(u),/SUPER_SECRET/);
});

test('existing last-good timestamp and no-write result stays bounded',()=>{
 const file={availability:'PRESENT',modifiedAt:stamp,data:{at:stamp,
   status:'VERIFIED',inflation7:{status:'ALREADY_STORED',
    key,ready:6,d1Writes:0,sourceVersion,sourceStoredAt}}};
 const out=inflation7WriterState(file);
 assert.equal(out.status,'ALREADY_STORED');
 assert.equal(out.verifiedAtWriterTime,true);
 assert.equal(out.d1NowVerified,false);
 assert.equal(out.evidenceScope,'LOCAL_WRITER_LEDGER_ONLY_NOT_LIVE_D1');
});
