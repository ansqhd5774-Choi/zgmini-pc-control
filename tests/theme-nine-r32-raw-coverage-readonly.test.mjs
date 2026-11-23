import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {auditR32StoredRawWithSpec,APPROVED_R32_SYMBOLS,inspectNineR32RawCoverage} from '../controller/theme-nine-r32-raw-coverage-readonly.mjs';
import {memoryAdmissionMinimum,waitForMemoryAdmission} from '../controller/memory-admission.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const rosterSha='a'.repeat(64),symbols=['SPY','BOTZ','ROBO'];
const SOURCE='https://getmarkethistory.com';
const MODE='RAW_UNADJUSTED_1H_NOT_OFFICIAL_CLOSE';
const dateRows=[['2026-10-23','2026-10-23T20:00:00Z'],['2026-11-03','2026-11-03T20:00:00Z']];
function fixture(t,{delta=true,partial=false}={}){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'w03-r32-readonly-'));
 t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const dataRoot=path.join(home,'data');fs.mkdirSync(dataRoot);
 const files={};
 for(const [folder,isDelta] of [['legacy-nine-r23',false],...(delta?[['legacy-nine-r35-delta',true]]:[])]){
  const dir=path.join(dataRoot,'themes',folder);
  fs.mkdirSync(path.join(dir,'state'),{recursive:true});fs.mkdirSync(path.join(dir,'raw'));
  const records=[],states={};
  for(const symbol of symbols){
   const date=isDelta?dateRows[1]:dateRows[0];
   const contents=JSON.stringify({symbol,timestamp:date[1],open:10,high:11,low:9,close:10.5,volume:100,is_gap:false})+'\n';
   const digest=sha(contents),relative=`raw/${symbol}_${digest}.jsonl`;
   fs.writeFileSync(path.join(dir,'raw',`${symbol}_${digest}.jsonl`),contents);
   records.push({path:relative,sha256:digest,symbol,source:SOURCE,priceMode:MODE,
    requestedUrl:`${SOURCE}/api/v1/bars/stocks/${symbol}/1h?start=${isDelta?'2026-11-02':'2023-01-01'}&end=${isDelta?'2026-11-05':'2026-10-26'}&format=jsonl&limit=5000`,
    schemaVersion:isDelta?'GMH_1H_OHLCV_NDJSON_R35':'GMH_1H_OHLCV_NDJSON_R23',
    firstTimestampUTC:date[1],lastTimestampUTC:date[1],
    ...(isDelta?{lastVerifiedNYDay:date[0]}:{}),rows:1,nonGapRows:1,gapRows:0});
   states[symbol]={complete:!(partial&&isDelta&&symbol==='ROBO'),files:[{path:relative,sha256:digest}],
    lastTimestamp:date[1],noBars:false};
   files[`${folder}-${symbol}`]=path.join(dir,'raw',`${symbol}_${digest}.jsonl`);
  }
  const manifest={version:1,project:folder,rosterSha256:rosterSha,source:SOURCE,
   licenseStatus:'PRIVATE_RESEARCH_ONLY_PUBLICATION_NOT_APPROVED',files:records};
  fs.writeFileSync(path.join(dir,'raw-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const start=isDelta?'2026-11-02':'2023-01-01',end=isDelta?'2026-11-05':'2026-10-26';
  const state={version:1,project:folder,rosterSha256:rosterSha,start,end,symbols:states};
  const key=sha(JSON.stringify({roster:rosterSha,start,end})).slice(0,20);
  const stateFile=path.join(dir,'state',`${isDelta?'delta':'collection'}-${key}.json`);
  fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n');
  files[`${folder}-checkpoint`]=stateFile;
  files[`${folder}-manifest`]=path.join(dir,'raw-manifest.json');
 }
 return {dataRoot,files};
}
const audit=f=>auditR32StoredRawWithSpec({dataRoot:f.dataRoot,rosterSha,symbols});

test('R32 post-admission recheck waits briefly for recovery and preserves the original safety minimum',async()=>{
 const policy=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 const ops=fs.readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 const r32=ops.split("if(request.operation==='theme-nine-r32-raw-coverage-readonly')")[1]
  ?.split("if(request.operation==='inflation-a401-private23-readonly')")[0];
 assert.ok(r32,'R32 operation branch present');
 assert.match(r32,/await waitForMemoryAdmission\(\{minimumFreeMiB,timeoutMs:9000,intervalMs:1500\}\)/);
 assert.match(r32,/minimumFreeMiB=policy\.operations\[request\.operation\]\.minimumFreeMiB/);
 assert.match(r32,/if\(!memoryRecheck\.admitted\)return \{status:'BLOCKED',code:'RESOURCE_WAIT_MEMORY'/);
 assert.doesNotMatch(r32,/if\(os\.freemem\(\)\/1048576<min\)/);
 const threshold=memoryAdmissionMinimum(policy,'theme-nine-r32-raw-coverage-readonly');
 assert.equal(threshold,1536);
 const engine=await waitForMemoryAdmission({minimumFreeMiB:threshold,readFreeMiB:()=>1798,timeoutMs:0});
 assert.equal(engine.admitted,true);
 const seen=[1200,1600];let samples=0;
 const recovered=await waitForMemoryAdmission({minimumFreeMiB:threshold,
  readFreeMiB:()=>seen[Math.min(samples++,seen.length-1)],timeoutMs:50,intervalMs:1});
 assert.equal(recovered.admitted,true);assert.equal(recovered.samples,2);
 assert.equal(recovered.minObservedMiB,1200);
 const blocked=await waitForMemoryAdmission({minimumFreeMiB:threshold,
  readFreeMiB:()=>1200,timeoutMs:5,intervalMs:1});
 assert.equal(blocked.admitted,false);assert.equal(blocked.freeMiB,1200);
});

test('real on-disk GMH R23+R35 manifests/checkpoints/raw SHA produce per-symbol NY day metadata only',t=>{
 const f=fixture(t),r=audit(f);
 assert.equal(r.status,'PASS');assert.equal(r.code,'R32_SAVED_RAW_SHA_CHECKPOINT_VERIFIED_NOT_CURRENT');
 assert.equal(r.verifiedRawPages,6);assert.equal(r.latestVerifiedSPYDay,'2026-11-03');
 assert.equal(r.latestCommonNYDay,'2026-11-03');
 assert.equal(r.symbols.length,3);assert.deepEqual(r.symbols.map(v=>v.verifiedNYDays),[2,2,2]);
 assert.equal(r.providerCalls,0);assert.equal(r.operationalWrites,0);assert.equal(r.d1Writes,0);
 assert.equal(r.currentnessVerified,false);assert.equal(r.publicationAuthorized,false);
 assert.doesNotMatch(JSON.stringify(r),/10\.5|2026-11-03T20:00:00Z|\/tmp\//);
});

test('R23 only is internally verified but no currentness or publication inferred',t=>{
 const f=fixture(t,{delta:false}),r=audit(f);
 assert.equal(r.status,'PASS');assert.equal(r.latestVerifiedSPYDay,'2026-10-23');
 assert.equal(r.manifests.r35,null);assert.equal(r.currentnessVerified,false);
});

test('incomplete R35 checkpoint gives PARTIAL, not finished coverage',t=>{
 const f=fixture(t,{partial:true}),r=audit(f);
 assert.equal(r.status,'PARTIAL');assert.equal(r.checkpoints.r35.incomplete,1);
 assert.equal(r.currentnessVerified,false);
});

test('raw SHA drift fails closed rather than trusting lastVerifiedNYDay manifest',t=>{
 const f=fixture(t);fs.appendFileSync(f.files['legacy-nine-r35-delta-SPY'],'PRICE_LEAK');
 const r=audit(f);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'R32_COVERAGE_RAW_SHA_DRIFT');
 assert.equal(r.firstFail,'SAVED_RAW_COVERAGE_AUDIT');
});

test('raw timestamp inside file cannot be forged with matching SHA unless manifest metadata agrees',t=>{
 const f=fixture(t);const folder='legacy-nine-r35-delta',mFile=f.files[`${folder}-manifest`];
 const m=JSON.parse(fs.readFileSync(mFile));const e=m.files.find(x=>x.symbol==='SPY');
 const old=JSON.parse(fs.readFileSync(f.files[`${folder}-SPY`],'utf8'));
 old.timestamp='2026-11-04T20:00:00Z';
 const body=JSON.stringify(old)+'\n',h=sha(body);
 const newPath=path.join(path.dirname(f.files[`${folder}-SPY`]),`SPY_${h}.jsonl`);
 fs.writeFileSync(newPath,body);fs.rmSync(f.files[`${folder}-SPY`]);
 e.path=`raw/SPY_${h}.jsonl`;e.sha256=h;
 const cpFile=f.files[`${folder}-checkpoint`],cp=JSON.parse(fs.readFileSync(cpFile));
 cp.symbols.SPY.files=[{path:e.path,sha256:h}];
 fs.writeFileSync(cpFile,JSON.stringify(cp));fs.writeFileSync(mFile,JSON.stringify(m));
 const r=audit(f);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'R32_COVERAGE_PAGE_METADATA_DRIFT');
});

test('checkpoint path reference outside immutable manifest is rejected',t=>{
 const f=fixture(t),cpFile=f.files['legacy-nine-r35-delta-checkpoint'];
 const cp=JSON.parse(fs.readFileSync(cpFile));cp.symbols.BOTZ.files[0].path='raw/UNLISTED_'.padEnd(69,'a')+'.jsonl';
 fs.writeFileSync(cpFile,JSON.stringify(cp));
 const r=audit(f);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'R32_COVERAGE_CHECKPOINT_PAGE_REFERENCE');
});

test('raw symlink is rejected without following outside data root',t=>{
 const f=fixture(t),file=f.files['legacy-nine-r35-delta-SPY'];
 const outside=path.join(path.dirname(f.dataRoot),'private.txt');fs.writeFileSync(outside,'sensitive');
 fs.rmSync(file);
 try{fs.symlinkSync(outside,file);}catch(error){
  // Non-admin Windows CI accounts may lack SeCreateSymbolicLinkPrivilege.
  // Do not downgrade the application's mandatory reject-on-link logic.
  if(process.platform==='win32'&&['EPERM','EACCES'].includes(error?.code)){
   t.skip('Windows CI cannot create symlinks; production source still rejects links');return;
  }
  throw error;
 }
 const r=audit(f);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'R32_COVERAGE_UNSAFE_PATH');
 assert.equal(r.providerCalls,0);assert.doesNotMatch(JSON.stringify(r),/sensitive/);
});

test('missing or mismatched data root does not cause a write or synthetic result',()=>{
 const r=auditR32StoredRawWithSpec({dataRoot:'/no/such/source',rosterSha,symbols});
 assert.equal(r.status,'BLOCKED');assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);
});

test('Controller adapter pins 63 distinct R20 ETFs and one SPY without a user-selected path',()=>{
 assert.equal(APPROVED_R32_SYMBOLS.length,64);
 assert.equal(new Set(APPROVED_R32_SYMBOLS).size,64);
 assert.equal(APPROVED_R32_SYMBOLS[0],'SPY');
 assert.equal(APPROVED_R32_SYMBOLS.filter(s=>s!=='SPY').length,63);
 const out=inspectNineR32RawCoverage('/invalid/missing-data');
 assert.equal(out.status,'BLOCKED');assert.equal(out.providerCalls,0);
});

test('zero-bars symbol has null missing count, not a false zero',t=>{
 const f=fixture(t,{delta:false}),prefix='legacy-nine-r23';
 const manifestFile=f.files[`${prefix}-manifest`],checkpointFile=f.files[`${prefix}-checkpoint`];
 const m=JSON.parse(fs.readFileSync(manifestFile));
 m.files=m.files.filter(entry=>entry.symbol!=='ROBO');
 fs.writeFileSync(manifestFile,JSON.stringify(m)+'\n');
 const cp=JSON.parse(fs.readFileSync(checkpointFile));
 cp.symbols.ROBO.files=[];cp.symbols.ROBO.noBars=true;
 fs.writeFileSync(checkpointFile,JSON.stringify(cp)+'\n');
 const r=audit(f),robo=r.symbols.find(x=>x.symbol==='ROBO');
 assert.equal(r.status,'PASS');assert.equal(r.symbolsWithoutValidBars,1);
 assert.equal(robo.coverageStatus,'NO_VERIFIED_BARS');
 assert.equal(robo.verifiedNYDays,0);
 assert.equal(robo.absentOnObservedSPYDaysAfterFirst,null);
});

test('missing observed-SPY NY day samples are bounded and never treated as official calendar',t=>{
 const v=fixture(t),folder='legacy-nine-r35-delta';
 const mFile=v.files[`${folder}-manifest`],cpFile=v.files[`${folder}-checkpoint`];
 const m=JSON.parse(fs.readFileSync(mFile)),cp=JSON.parse(fs.readFileSync(cpFile));
 m.files=m.files.filter(x=>x.symbol!=='ROBO');
 cp.symbols.ROBO.files=[];cp.symbols.ROBO.noBars=true;
 fs.writeFileSync(mFile,JSON.stringify(m)+'\n');
 fs.writeFileSync(cpFile,JSON.stringify(cp)+'\n');
 const r=audit(v),item=r.symbols.find(x=>x.symbol==='ROBO');
 assert.equal(r.status,'PASS');
 assert.equal(item.coverageStatus,'VERIFIED_BARS');
 assert.equal(item.absentOnObservedSPYDaysAfterFirst,1);
 assert.equal(item.firstAbsentObservedSPYNYDay,'2026-11-03');
 assert.equal(item.lastAbsentObservedSPYNYDay,'2026-11-03');
 assert.deepEqual(item.recentAbsentObservedSPYNYDays,['2026-11-03']);
 assert.equal(item.absentObservedSPYSampleTruncated,false);
 assert.equal(r.currentnessVerified,false);
 assert.equal(r.publicationAuthorized,false);
});

test('R35 checkpoint requested URL outside its window is denied even when raw page SHA matches',t=>{
 const f=fixture(t),folder='legacy-nine-r35-delta',cpFile=f.files[`${folder}-checkpoint`];
 const cp=JSON.parse(fs.readFileSync(cpFile));
 cp.symbols.BOTZ.files[0].requestedUrl=
  `${SOURCE}/api/v1/bars/stocks/BOTZ/1h?start=2026-10-01&end=2026-10-06&format=jsonl&limit=5000`;
 fs.writeFileSync(cpFile,JSON.stringify(cp)+'\n');
 const r=audit(f);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'R32_COVERAGE_CHECKPOINT_REQUEST_WINDOW');
 assert.equal(r.providerCalls,0);
 assert.equal(r.operationalWrites,0);
});

test('R35 checkpoint own request URL supersedes older manifest URL for a reused SHA page',t=>{
 const f=fixture(t),folder='legacy-nine-r35-delta';
 const manifestFile=f.files[`${folder}-manifest`],cpFile=f.files[`${folder}-checkpoint`];
 const manifest=JSON.parse(fs.readFileSync(manifestFile));
 const entry=manifest.files.find(x=>x.symbol==='BOTZ');
 const requested=entry.requestedUrl;
 entry.requestedUrl=`${SOURCE}/api/v1/bars/stocks/BOTZ/1h?start=2026-10-01&end=2026-10-06&format=jsonl&limit=5000`;
 fs.writeFileSync(manifestFile,JSON.stringify(manifest)+'\n');
 const cp=JSON.parse(fs.readFileSync(cpFile));
 cp.symbols.BOTZ.files[0].requestedUrl=requested;
 fs.writeFileSync(cpFile,JSON.stringify(cp)+'\n');
 const r=audit(f);
 assert.equal(r.status,'PASS');
 assert.equal(r.latestVerifiedSPYDay,'2026-11-03');
 assert.equal(r.currentnessVerified,false);
});

test('R23 baseline source URL must retain the approved fixed 2023-01-01 to 2026-10-26 window',t=>{
 const f=fixture(t,{delta:false}),file=f.files['legacy-nine-r23-manifest'];
 const m=JSON.parse(fs.readFileSync(file,'utf8'));
 m.files[0].requestedUrl=
  `${SOURCE}/api/v1/bars/stocks/${m.files[0].symbol}/1h?start=2023-01-01&end=2026-11-03&format=jsonl&limit=5000`;
 fs.writeFileSync(file,JSON.stringify(m)+'\n');
 const result=audit(f);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R32_COVERAGE_R23_BASELINE_REQUEST_WINDOW');
 assert.equal(result.providerCalls,0);
 assert.equal(result.operationalWrites,0);
});

test('R23 baseline checkpoint must retain approved fixed dates even with rekeyed filename',t=>{
 const f=fixture(t,{delta:false}),original=f.files['legacy-nine-r23-checkpoint'];
 const state=JSON.parse(fs.readFileSync(original,'utf8'));
 state.end='2026-11-03';
 const key=sha(JSON.stringify({roster:rosterSha,start:state.start,end:state.end})).slice(0,20);
 fs.rmSync(original);
 fs.writeFileSync(path.join(path.dirname(original),`collection-${key}.json`),JSON.stringify(state)+'\n');
 const result=audit(f);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R32_COVERAGE_CHECKPOINT_IDENTITY');
});


test('post-migration R35 manifest accepts stocks/us with unchanged SHA and price mode',t=>{
 const f=fixture(t),folder='legacy-nine-r35-delta',file=f.files[`${folder}-manifest`];
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const entry=manifest.files.find(x=>x.symbol==='BOTZ');
 entry.requestedUrl=entry.requestedUrl.replace('/bars/stocks/BOTZ/','/bars/stocks/us/BOTZ/');
 fs.writeFileSync(file,JSON.stringify(manifest));
 const r=audit(f);
 assert.equal(r.status,'PASS');
 assert.equal(r.latestVerifiedSPYDay,'2026-11-03');
 assert.equal(r.currentnessVerified,false);
});
test('post-migration R35 checkpoint prefers new route over archived manifest URL',t=>{
 const f=fixture(t),folder='legacy-nine-r35-delta',file=f.files[`${folder}-checkpoint`];
 const state=JSON.parse(fs.readFileSync(file,'utf8'));
 const ref=state.symbols.BOTZ.files[0];
 const manifest=JSON.parse(fs.readFileSync(f.files[`${folder}-manifest`],'utf8'));
 const oldEntry=manifest.files.find(x=>x.symbol==='BOTZ');
 assert.equal(ref.requestedUrl??oldEntry.requestedUrl,oldEntry.requestedUrl);
 ref.requestedUrl=oldEntry.requestedUrl.replace('/bars/stocks/BOTZ/','/bars/stocks/us/BOTZ/');
 fs.writeFileSync(file,JSON.stringify(state));
 const r=audit(f);
 assert.equal(r.status,'PASS');
 assert.equal(r.currentnessVerified,false);
});
test('unrecognized R35 region remains denied',t=>{
 const f=fixture(t),folder='legacy-nine-r35-delta',file=f.files[`${folder}-manifest`];
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const entry=manifest.files.find(x=>x.symbol==='SPY');
 entry.requestedUrl=entry.requestedUrl.replace('/bars/stocks/SPY/','/bars/stocks/ca/SPY/');
 fs.writeFileSync(file,JSON.stringify(manifest));
 const r=audit(f);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'R32_COVERAGE_PAGE_SOURCE_URL');
});
test('R23 historical path identity cannot be rewritten as stocks/us',t=>{
 const f=fixture(t,{delta:false}),file=f.files['legacy-nine-r23-manifest'];
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const entry=manifest.files.find(x=>x.symbol==='SPY');
 entry.requestedUrl=entry.requestedUrl.replace('/bars/stocks/SPY/','/bars/stocks/us/SPY/');
 fs.writeFileSync(file,JSON.stringify(manifest));
 const r=audit(f);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'R32_COVERAGE_PAGE_SOURCE_URL');
});
