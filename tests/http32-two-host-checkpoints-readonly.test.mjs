import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectHttp32TwoHostCheckpoints} from '../controller/http32-two-host-checkpoints-readonly.mjs';

const NOW=Date.parse('2026-11-16T13:30:00.000Z');
function temp(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-http32-two-'));
 try{return fn(root);}finally{fs.rmSync(root,{recursive:true,force:true});}
}
function put(root,rel,obj){
 const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});
 fs.writeFileSync(p,JSON.stringify(obj));
}
const sample={
 checkedAt:'2026-11-16T00:00:11.478Z',requestEnd:'2026-11-15',
 storageVerified:true,status:'COLLECTED_PENDING_VALIDATION',
 runRequests:2,token:'SECRET_NOT_TO_EXPOSE',path:'C:/TOP-SECRET'
};
test('Alpaca 2xx support needs recent verified report and aligned checkpoint, not only 20h inference',()=>temp(root=>{
 put(root,'local-asset-bubble-r10-alpaca-collection.json',sample);
 put(root,'asset-r10-alpaca/incremental-checkpoint.json',{through:'2026-11-15'});
 const r=inspectHttp32TwoHostCheckpoints({root,now:NOW});
 const a=r.hosts[0];
 assert.equal(a.host,'data.alpaca.markets');
 assert.equal(a.reportReadState,'READ_VERIFIED');
 assert.equal(a.checkpointReadState,'READ_VERIFIED');
 assert.equal(a.cacheEvidenceVerified,true);
 assert.equal(a.storageVerified,true);
 assert.equal(a.checkpointAligned,true);
 assert.equal(r.providerCalls,0);assert.equal(r.operationalWrites,0);
 assert.ok(!JSON.stringify(r).includes('SECRET_NOT_TO_EXPOSE'));
 assert.ok(!JSON.stringify(r).includes('TOP-SECRET'));
}));
test('Alpaca 20h cache expiry, deferred quota and checkpoint mismatch never certify cache',()=>temp(root=>{
 put(root,'local-asset-bubble-r10-alpaca-collection.json',sample);
 put(root,'asset-r10-alpaca/incremental-checkpoint.json',{through:'2026-11-14'});
 const mismatch=inspectHttp32TwoHostCheckpoints({root,now:NOW});
 assert.equal(mismatch.hosts[0].cacheEvidenceVerified,false);
 put(root,'asset-r10-alpaca/incremental-checkpoint.json',{through:'2026-11-15'});
 const late=inspectHttp32TwoHostCheckpoints({root,now:NOW+21*3600000});
 assert.equal(late.hosts[0].cacheEvidenceVerified,false);
 assert.equal(late.hosts[0].withinCacheWindow,false);
 put(root,'local-asset-bubble-r10-alpaca-collection.json',{...sample,status:'DEFERRED_QUOTA'});
 assert.equal(inspectHttp32TwoHostCheckpoints({root,now:NOW}).hosts[0].cacheEvidenceVerified,false);
}));
test('Census monthly backfill report exposes only safe metadata, not proof of post-release HTTP or D1',()=>temp(root=>{
 put(root,'local-monthly-one-year-backfill-last-run.json',{
  at:'2026-11-14T10:00:00Z',asOf:'2026-11-14',status:'STORED',
  chart:{status:'READY',recordCount:620,target:'2026-09-01',rowsWritten:0},
  credentials:'PRIVATE_CENSUS_KEY',headers:{authorization:'BEARER_HIDDEN'}
 });
 const x=inspectHttp32TwoHostCheckpoints({root,now:NOW});
 const c=x.hosts[1];
 assert.equal(c.host,'cdn.www.census.gov');
 assert.equal(c.reportReadState,'READ_VERIFIED');
 assert.equal(c.chartStatus,'READY');
 assert.equal(c.chartRowsWritten,0);
 assert.equal(c.chartTarget,'2026-09-01');
 assert.equal(c.note,'PC_BACKFILL_NOT_CLOUDFLARE_D1_OR_POST_RELEASE_HTTP_PROOF');
 assert.ok(!JSON.stringify(x).includes('PRIVATE_CENSUS_KEY'));
 assert.ok(!JSON.stringify(x).includes('BEARER_HIDDEN'));
}));
test('missing or malformed source reports remain clearly unverified and never create green',()=>temp(root=>{
 const empty=inspectHttp32TwoHostCheckpoints({root,now:NOW});
 assert.equal(empty.hosts[0].reportReadState,'FILE_ABSENT');
 assert.equal(empty.hosts[0].cacheEvidenceVerified,false);
 assert.equal(empty.hosts[1].reportReadState,'FILE_ABSENT');
 fs.writeFileSync(path.join(root,'local-monthly-one-year-backfill-last-run.json'),'SECRET_NOT_JSON');
 const out=inspectHttp32TwoHostCheckpoints({root,now:NOW});
 assert.equal(out.hosts[1].reportReadState,'FILE_UNREADABLE');
 assert.ok(!JSON.stringify(out).includes('SECRET_NOT_JSON'));
}));
test('symlink reports never escape the approved source root',t=>temp(root=>{
 const outside=path.join(os.tmpdir(),'zgmini-checkpoint-secret-'+process.pid+'.json');
 fs.writeFileSync(outside,'{"token":"PRIVATE_TOKEN"}');
 try{
  try{fs.symlinkSync(outside,path.join(root,'local-monthly-one-year-backfill-last-run.json'));}
  catch(e){if(e.code==='EPERM'||e.code==='EACCES'){t.skip('symlink privilege unavailable');return;}throw e;}
  const r=inspectHttp32TwoHostCheckpoints({root,now:NOW});
  assert.equal(r.hosts[1].reportReadState,'UNSAFE_FILE');
  assert.ok(!JSON.stringify(r).includes('PRIVATE_TOKEN'));
 }finally{fs.rmSync(outside,{force:true});}
}));

test('current Core cycle reports R10 child invocation separately from aged saved R10 receipt',()=>temp(root=>{
 put(root,'local-asset-bubble-r10-alpaca-collection.json',{...sample,checkedAt:'2026-11-12T00:08:19.983Z'});
 put(root,'asset-r10-alpaca/incremental-checkpoint.json',{through:'2026-11-11'});
 put(root,'local-cycle-last-run.json',{
  at:'2026-11-16T13:25:34.482Z',lane:'core',status:'COMPLETE',
  alpacaIncremental:{status:'FAILED_PREVIOUS_INPUTS_PRESERVED',runRequests:null},
  progressive:{auxiliaryStartedAt:'2026-11-16T13:17:00Z',auxiliaryStatus:'COMPLETE'},
  secret:'KEY_LEAK_BLOCK',commandLine:'NOT_TO_EXPOSE'
 });
 const x=inspectHttp32TwoHostCheckpoints({root,now:NOW}),a=x.hosts[0];
 assert.equal(a.cacheEvidenceVerified,false);
 assert.equal(a.coreCycleReadState,'READ_VERIFIED');
 assert.equal(a.coreCycleLane,'core');
 assert.equal(a.coreCycleStatus,'COMPLETE');
 assert.equal(a.coreAlpacaStatus,'FAILED_PREVIOUS_INPUTS_PRESERVED');
 assert.equal(a.coreAlpacaRunRequests,null);
 assert.equal(a.coreAuxiliaryStartedAt,'2026-11-16T13:17:00.000Z');
 assert.ok(!JSON.stringify(x).includes('KEY_LEAK_BLOCK'));
 assert.ok(!JSON.stringify(x).includes('NOT_TO_EXPOSE'));
}));
test('missing or non-Core recent local cycle never forges R10 invocation proof',()=>temp(root=>{
 const absent=inspectHttp32TwoHostCheckpoints({root,now:NOW}).hosts[0];
 assert.equal(absent.coreCycleReadState,'FILE_ABSENT');
 assert.equal(absent.coreAlpacaStatus,'UNVERIFIED');
 put(root,'local-cycle-last-run.json',{
  at:'2026-11-16T13:15:00Z',lane:'korea',status:'COMPLETE',
  alpacaIncremental:{status:'SKIPPED_KOREA_LANE',runRequests:0},
  progressive:{auxiliaryStatus:'COMPLETE'}
 });
 const a=inspectHttp32TwoHostCheckpoints({root,now:NOW}).hosts[0];
 assert.equal(a.coreCycleLane,'korea');
 assert.equal(a.coreAlpacaStatus,'SKIPPED_KOREA_LANE');
 assert.equal(a.cacheEvidenceVerified,false);
}));

test('user-approved R10 Alpaca exclusion is distinct from a transport outage',()=>temp(root=>{
 put(root,'local-asset-bubble-r10-alpaca-collection.json',{...sample,checkedAt:'2026-11-12T00:08:19.983Z'});
 put(root,'asset-r10-alpaca/incremental-checkpoint.json',{through:'2026-11-11'});
 put(root,'local-cycle-last-run.json',{
  at:'2026-11-16T14:24:16.913Z',lane:'core',status:'COMPLETE',
  alpacaIncremental:{status:'EXCLUDED_BY_USER',runRequests:0},
  progressive:{auxiliaryStatus:'COMPLETE',auxiliaryStartedAt:'2026-11-16T14:23:26.801Z'},
  token:'SECRET_SHALL_NOT_LEAK'
 });
 const x=inspectHttp32TwoHostCheckpoints({root,now:NOW}).hosts[0];
 assert.equal(x.coreCycleReadState,'READ_VERIFIED');
 assert.equal(x.coreAlpacaStatus,'EXCLUDED_BY_USER');
 assert.equal(x.coreAlpacaRunRequests,0);
 assert.equal(x.cacheEvidenceVerified,false); // excluded != successful R10 refresh
 assert.ok(!JSON.stringify(x).includes('SECRET_SHALL_NOT_LEAK'));
}));
