import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectInflation19RuntimeReadonly} from '../controller/inflation19-runtime-readonly.mjs';

const IDS=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'infl19-reader-'));
 const home=path.join(root,'pc-writer');
 fs.mkdirSync(path.join(home,'inflation-causal-r1'),{recursive:true});
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(rel,obj)=>{
  const file=path.join(home,rel);
  fs.writeFileSync(file,JSON.stringify(obj));
  return file;
 };
 return {root,home,put};
}
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const version='INFL19_PRESENTATION_'+ 'a'.repeat(64);
const stamp='2026-11-07T18:38:00.000Z';
const projection=()=>({
 payload:{sourceStoredAt:Date.parse(stamp),sourceVersion:version,
  indicators:IDS.map(id=>({id,status:'READY',value:98765,
   observationDate:'2026-10',sourceStoredAt:stamp,
   history:[{date:'2026-10',value:98765}],apiKey:'VERY_SECRET'}))},
});

test('fixed reports expose only bounded status, 4 groups, 19 dates and no secrets or writes',t=>{
 const f=fixture(t);
 const cycle=f.put('local-cycle-last-run.json',{
  status:'COMPLETE',at:Date.parse(stamp),secret:'PRIVATE_TOKEN_123',
  inflationRecurring:{status:'COMPLETE',providerRequests:3,
   updated:[{source:'bls8',status:'SAVED_READBACK',providerRequests:1,token:'PRIVATE_TOKEN_123'}],
   unchanged:[{source:'gas',status:'UNCHANGED',providerRequests:1}],
   failed:[{source:'sce',code:'INFL19_RECURRING_SOURCE_FAILED',url:'https://secret'}],
   skipped:['electricity']},
 });
 const checkpoint=f.put('inflation-causal-r1/recurring-checkpoint-r1.json',{
  schema:'ZGMINI_INFL19_RECURRING_R1',processed:{bls8:'2026-11-06'},
  attempted:{bls8:{eventKey:'2026-11-06',at:stamp}},
  apiKey:'PRIVATE_TOKEN_123',
 });
 const writer=f.put('local-writer-last-run.json',{
  status:'VERIFIED',at:Date.parse(stamp),
  inflation19:{status:'READBACK_VERIFIED',ready:19,d1Writes:1,
   sourceVersion:version,sourceStoredAt:Date.parse(stamp),secret:'PRIVATE_TOKEN_123'},
 });
 const stage=f.put('inflation-causal-r1/public-19-summary-projection-r1.json',projection());
 const files=[cycle,checkpoint,writer,stage];
 const before=files.map(sha);
 const report=inspectInflation19RuntimeReadonly(f.root);
 assert.deepEqual(files.map(sha),before);
 assert.equal(report.status,'PASS');
 assert.equal(report.operationalReadiness,'NOT_ASSERTED');
 assert.equal(report.cycle.status,'COMPLETE');
 assert.equal(report.cycle.providerRequests,3);
 assert.equal(report.cycle.byGroup.bls8.outcome,'UPDATED');
 assert.equal(report.cycle.byGroup.gas.outcome,'UNCHANGED');
 assert.equal(report.cycle.byGroup.sce.outcome,'FAILED');
 assert.equal(report.cycle.byGroup.electricity.outcome,'SKIPPED');
 assert.equal(report.checkpoint.byGroup.bls8.attemptedAt,stamp);
 assert.equal(report.writer.status,'READBACK_VERIFIED');
 assert.equal(report.writer.sourceStoredAt,Date.parse(stamp));
 assert.equal(report.projection.readyCount,19);
 assert.deepEqual(report.projection.perId.map(x=>x.id),IDS);
 assert.equal(report.projection.perId[0].observationDate,'2026-10');
 const json=JSON.stringify(report);
 assert.ok(json.length<32768);
 assert.ok(!json.includes('PRIVATE_TOKEN_123'));
 assert.ok(!json.includes('98765'));
 assert.ok(!json.includes('https://secret'));
 assert.deepEqual([report.providerCalls,report.d1Writes,report.operationalWrites,report.sqliteOpened],
  [0,0,0,false]);
});

test('writer VERIFIED never masquerades as inflation publication success',t=>{
 const f=fixture(t);
 f.put('local-cycle-last-run.json',{status:'COMPLETE',at:Date.parse(stamp),
  inflationRecurring:{status:'NO_VERIFIED_RELEASE_DUE',providerRequests:0,
   skipped:['bls8','electricity','sce','gas']}});
 f.put('local-writer-last-run.json',{status:'VERIFIED',
  inflation19:{status:'SKIPPED_INPUTS_NOT_READY',ready:17,d1Writes:0}});
 const report=inspectInflation19RuntimeReadonly(f.root);
 assert.equal(report.cycle.status,'NO_VERIFIED_RELEASE_DUE');
 assert.equal(report.writer.writerStatus,'VERIFIED');
 assert.equal(report.writer.status,'SKIPPED_INPUTS_NOT_READY');
 assert.equal(report.writer.readyCount,17);
 assert.equal(report.projection.availability,'MISSING');
});

test('not recorded, malformed JSON, too-large and symlink are safely classified',t=>{
 const f=fixture(t);
 let out=inspectInflation19RuntimeReadonly(f.root);
 assert.equal(out.cycle.availability,'MISSING');
 assert.equal(out.checkpoint.availability,'MISSING');
 assert.equal(out.writer.availability,'MISSING');
 const cycle=path.join(f.home,'local-cycle-last-run.json');
 fs.writeFileSync(cycle,'{broken');
 out=inspectInflation19RuntimeReadonly(f.root);
 assert.equal(out.cycle.availability,'INVALID_JSON');
 fs.writeFileSync(cycle,'x'.repeat(131073));
 out=inspectInflation19RuntimeReadonly(f.root);
 assert.equal(out.cycle.availability,'SIZE_REJECTED');
 fs.rmSync(cycle);
 try{fs.symlinkSync(path.join(f.root,'outside'),cycle);}
 catch(error){
  if(process.platform==='win32'&&error.code==='EPERM')return;
  throw error;
 }
 out=inspectInflation19RuntimeReadonly(f.root);
 assert.equal(out.cycle.availability,'UNSAFE_ENTRY');
});

test('cannot redirect the checkpoint through symlink directory or leak raw error',t=>{
 const f=fixture(t);
 const dir=path.join(f.home,'inflation-causal-r1');
 fs.rmSync(dir,{recursive:true});
 try{fs.symlinkSync(f.root,dir,process.platform==='win32'?'junction':'dir');}
 catch(error){
  if(process.platform==='win32'&&error.code==='EPERM'){
   fs.writeFileSync(dir,'not-a-directory');
  }else throw error;
 }
 f.put('local-cycle-last-run.json',{status:'COMPLETE',
  inflationRecurring:{status:'PARTIAL_PREVIOUS_CHECKPOINT_PRESERVED',providerRequests:1,
   failed:[{source:'bls8',code:'INFL19_SECRET_API_KEY'}]}});
 const report=inspectInflation19RuntimeReadonly(f.root);
 assert.equal(report.checkpoint.availability,'UNSAFE_ENTRY');
 assert.equal(report.cycle.byGroup.bls8.code,'UNREPORTED');
 assert.equal(report.cycle.status,'PARTIAL_PREVIOUS_CHECKPOINT_PRESERVED');
});

test('rejects arbitrary roots and does not infer READY from invalid stage',t=>{
 assert.throws(()=>inspectInflation19RuntimeReadonly('relative'),
  {code:'INFL19_READONLY_DATA_ROOT_DENIED'});
 const f=fixture(t);
 const p=projection();
 p.payload.indicators[0].id='unexpected';
 f.put('inflation-causal-r1/public-19-summary-projection-r1.json',p);
 const report=inspectInflation19RuntimeReadonly(f.root);
 assert.equal(report.projection.availability,'INVALID_CONTRACT');
 assert.equal(report.operationalReadiness,'NOT_ASSERTED');
});
