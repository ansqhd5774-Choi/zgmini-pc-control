import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {wantsHistoryRepairPreview,projectHistoryRepairSelection,stageHistoryRepairReceipt} from '../controller/employment-r6-candidate-readonly.mjs';

const source='551640c3094738f7803d6a7f799098a55c21523c';
const files={'scripts/pc-writer/employment-r6-history-repair-readonly.mjs':'a'.repeat(64)};
const raw={status:'REPAIR_PREVIEW_ONLY',eligible:2879,held:{existingHistory:1,unmatched:0,unsupportedCurrent:0},
 expectedKeys:2880,receiptSha256:'2163132e165e45e08edff062722465dac1ff3a2d17ce999ec98a479d6e32547b',
 evidenceDigest:'30afbbec30466fa3e93442c78514ccb5125ca57ae4609dfdd5b9f44716c3acc5',
 selectionSha256:'b'.repeat(64),historicalVersionAttested:false,repairAuthorized:false,sqliteWrites:0};
test('selection preview is pinned to explicit raw mode and approved source marker',()=>{
 assert.equal(wantsHistoryRepairPreview({pit0605Raw:true,sourceSha:source},files),true);
 assert.equal(wantsHistoryRepairPreview({pit0605Raw:true,sourceSha:'a'.repeat(40)},files),false);
 assert.equal(wantsHistoryRepairPreview({sourceSha:source},files),false);
 assert.equal(wantsHistoryRepairPreview({pit0605Raw:true,sourceSha:source},{}),false);
});
test('only partition and digest return, no raw data or authorization',()=>{
 assert.deepEqual(projectHistoryRepairSelection({...raw,privateRows:['PRIVATE']}),raw);
 for(const invalid of [{eligible:2880},{repairAuthorized:true},{historicalVersionAttested:true},
  {sqliteWrites:1},{receiptSha256:'c'.repeat(64)},{selectionSha256:'bad'}]){
  assert.throws(()=>projectHistoryRepairSelection({...raw,...invalid}),/R6_HISTORY_REPAIR_SELECTION_INVALID/);
 }
});
test('wrong retained receipt cannot be staged',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w04-selection-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const home=path.join(root,'data'),folder=path.join(home,'pc-writer','pit-evidence'),out=path.join(root,'out');
 fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(out);
 fs.writeFileSync(path.join(folder,'pit0605-pc-c9e5b130-4e7a-4a24-a588-717d7faef26d.json'),'{"forged":"receipt"}');
 assert.throws(()=>stageHistoryRepairReceipt({dataRoot:home},out),/R6_HISTORY_REPAIR_RECEIPT_DRIFT/);
 assert.deepEqual(fs.readdirSync(out),[]);
});
