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
