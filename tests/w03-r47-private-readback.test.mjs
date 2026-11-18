import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {
  REPO,TITLE,SCHEMA,RESULT_SCHEMA,CMD_SHA,ROSTER_SHA,APPROVAL_PATH,
  authorize,inspectR47PrivateSaved,execute,
} from '../tools/w03-r47-private-readback.mjs';
import {sanitize,asText} from '../tools/w03-r47-private-readback-report.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const request=()=>({
 schema:SCHEMA,operation:TITLE,
 requestId:'7af5ce31-44b2-4aa1-8822-cc8b27337e65',
 chatId:'f8f62ea0-43ef-4dc5-9a74-22276a1f0354',
 controlRepository:REPO,controlSourceSha:'a'.repeat(40),
 expectedInstalledCmdSha256:CMD_SHA,approvalManifestPath:APPROVAL_PATH,
 approvalManifestSha256:sha(fs.readFileSync(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),'..',APPROVAL_PATH))),
});
function fixtureEvent(){
 const req=request();
 const event={repository:{full_name:REPO,private:true},
  sender:{login:'ansqhd5774-Choi'},
  issue:{title:TITLE,number:10,user:{login:'ansqhd5774-Choi'},
   labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(req)}};
 const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:'a'.repeat(40),
  GITHUB_RUN_ID:'123456789'};
 return {req,event,env};
}
function saved(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'w03-r47-readback-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const home=path.join(dir,'themes');
 const base=path.join(home,'legacy-nine-r23');
 const delta=path.join(home,'legacy-nine-r35-delta');
 const shadow=path.join(home,'legacy-nine-r47-private');
 for(const p of [base,delta,shadow])fs.mkdirSync(p,{recursive:true});
 const a=Buffer.from('{"version":1,"files":[]}\n');
 const b=Buffer.from('{"version":2,"files":[]}\n');
 fs.writeFileSync(path.join(base,'raw-manifest.json'),a);
 fs.writeFileSync(path.join(delta,'raw-manifest.json'),b);
 const source={baselineManifestSha256:sha(a),deltaManifestSha256:sha(b),
  rosterSha256:ROSTER_SHA,latestSpySessionDate:'2026-11-13',
  deltaCompletedWindows:[{start:'2026-11-03',end:'2026-11-12',spyDay:'2026-11-12'}],
  deltaVerifiedPageReferences:64};
 const score={contract:'THEME_NINE_R47_PRIVATE_INCREMENTAL_INDIVIDUAL_V1',
  source,publicationAuthorized:false,
  approvedFormula:'EXACT_EXISTING_THEME_OPTIONAL_ADAPTIVE_R2_T40_R20_V40',
  counts:{themes:9,approvedETFPositions:64,uniqueApprovedETFs:63},
  individual:{privateScoresNotToUpload:12345}};
 const theme={contract:'THEME_NINE_R47_PRIVATE_RECURRING_NINE_THEME_SHADOW_V1',
  source,benchmarkDate:'2026-11-13',publicationAuthorized:false,
  aggregation:'EXACT_EXISTING_R32_DATE_REDUCER',
  counts:{themes:9,approvedETFPositions:64,uniqueApprovedETFs:63,tradingDates:252},
  themes:[{privateLicensedBarsNotToUpload:999}]};
 const aa=Buffer.from(JSON.stringify(score)+'\n');
 const bb=Buffer.from(JSON.stringify(theme)+'\n');
 const digest=sha(Buffer.concat([aa,bb])).slice(0,16);
 const prefix='THEME_NINE_R47_PRIVATE_2026-11-13_'+digest;
 const f=path.join(shadow,prefix+'_ETF.json');
 const g=path.join(shadow,prefix+'_NINE.json');
 fs.writeFileSync(f,aa);fs.writeFileSync(g,bb);
 return {dir,home,base,delta,shadow,f,g,score,theme};
}
test('readback request admits exact owner event, immutable CMD SHA and 7 keys',()=>{
 const {req,event,env}=fixtureEvent();
 assert.deepEqual(authorize(event,env),req);
 assert.equal(execute({event,env,inspect:()=>({
  schema:'ZGMINI_W03_R47_PRIVATE_SHADOW_METADATA_V1',
  status:'NO_PRIVATE_SHADOW',code:'R47_PRIVATE_SHADOW_NOT_FOUND',
  candidateCount:0,latest:null,sourceRawPagesRehashedNow:false,
  providerCalls:0,sqliteOpened:false,pcWrites:0,d1Writes:0,
  taskRunVerified:false,
 })}).status,'NO_PRIVATE_SHADOW');
 for(const mutation of [
  x=>x.env.GITHUB_ACTOR='not-owner',
  x=>x.env.GITHUB_EVENT_ACTION='edited',
  x=>x.env.GITHUB_RUN_ATTEMPT='2',
  x=>x.event.issue.labels=[],
  x=>{const p=JSON.parse(x.event.issue.body);p.expectedInstalledCmdSha256='0'.repeat(64);x.event.issue.body=JSON.stringify(p);},
  x=>{const p=JSON.parse(x.event.issue.body);p.approvalManifestSha256='0'.repeat(64);x.event.issue.body=JSON.stringify(p);},
  x=>{const p=JSON.parse(x.event.issue.body);p.arbitraryFile='C:/sensitive';x.event.issue.body=JSON.stringify(p);},
  x=>{x.event.repository.private=false;},
 ]){const obj=fixtureEvent();mutation(obj);assert.throws(()=>authorize(obj.event,obj.env));}
});
test('missing R47 directory is not reported as saved source',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'w03-r47-empty-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const x=inspectR47PrivateSaved({dataRoot:dir});
 assert.equal(x.status,'NO_PRIVATE_SHADOW');
 assert.equal(x.latest,null);
 assert.equal(x.sourceRawPagesRehashedNow,false);
});
test('verified pair checks actual two bytes, filename digest and manifest linkage only',t=>{
 const x=saved(t);
 const r=inspectR47PrivateSaved({dataRoot:x.dir});
 assert.equal(r.status,'PRIVATE_RESULT_PAIR_AND_MANIFEST_SHA_VERIFIED');
 assert.equal(r.candidateCount,1);
 assert.equal(r.latest.benchmarkDate,'2026-11-13');
 assert.equal(r.latest.completedWindowCount,1);
 assert.equal(r.latest.sourceCurrentManifestMatch,true);
 assert.equal(r.latest.sourceRawPagesRehashedNow,false);
 assert.equal(r.taskRunVerified,false);
 assert.ok(!JSON.stringify(r).includes('privateScoresNotToUpload'));
 assert.ok(!JSON.stringify(r).includes('privateLicensedBarsNotToUpload'));
 const {req,event,env}=fixtureEvent();
 const out=execute({event,env,inspect:()=>r});
 const clean=sanitize(out,req,env);
 assert.equal(clean.status,r.status);
 assert.equal(clean.latest.scoreSha256,r.latest.scoreSha256);
 assert.ok(!JSON.stringify(clean).includes('privateScoresNotToUpload'));
 assert.match(asText(clean),/sourceRawPagesRehashedNow=false/);
});
test('manifest changed after private calculation is STALE, not current',t=>{
 const x=saved(t);
 fs.writeFileSync(path.join(x.delta,'raw-manifest.json'),'{"version":3,"files":[]}\n');
 const r=inspectR47PrivateSaved({dataRoot:x.dir});
 assert.equal(r.status,'PRIVATE_RESULT_SOURCE_MANIFEST_CHANGED');
 assert.equal(r.latest.sourceCurrentManifestMatch,false);
});
test('partial private pair never proves calculation complete',t=>{
 const x=saved(t);fs.unlinkSync(x.g);
 const r=inspectR47PrivateSaved({dataRoot:x.dir});
 assert.equal(r.status,'STOP');
 assert.equal(r.code,'W03_R47_READBACK_UNEXPECTED_STOP');
});
test('tampered pair SHA stops before reporting private data',t=>{
 const x=saved(t);
 fs.appendFileSync(x.g,'{"fake":"licensed-row"}');
 const r=inspectR47PrivateSaved({dataRoot:x.dir});
 assert.equal(r.status,'STOP');
 assert.equal(r.code,'W03_R47_READBACK_PAIR_DIGEST_STOP');
 assert.ok(!JSON.stringify(r).includes('licensed-row'));
});
test('redacted report rejects forged, unknown or mixed metadata',t=>{
 const x=saved(t);const {req,env}=fixtureEvent();
 const r=inspectR47PrivateSaved({dataRoot:x.dir});
 const good={schema:RESULT_SCHEMA,requestId:req.requestId,
  controlSha:env.GITHUB_SHA,status:r.status,code:r.code,metadata:r};
 assert.equal(sanitize(good,req,env).status,r.status);
 assert.equal(sanitize({...good,controlSha:'0'.repeat(40)},req,env).status,'STATE_UNKNOWN');
 assert.equal(sanitize({...good,metadata:{...r,d1Writes:1}},req,env).status,'STATE_UNKNOWN');
 assert.equal(sanitize({...good,metadata:{...r,latest:{...r.latest,
  leakedPrices:[1,2,3]}}},req,env).status,r.status);
 assert.ok(!JSON.stringify(sanitize({...good,metadata:{...r,latest:{...r.latest,
  leakedPrices:[1,2,3]}}},req,env)).includes('leakedPrices'));
 const empty={...good,status:'NO_PRIVATE_SHADOW',code:'R47_PRIVATE_SHADOW_NOT_FOUND',
  metadata:{...r,status:'NO_PRIVATE_SHADOW',code:'R47_PRIVATE_SHADOW_NOT_FOUND',
  latest:null,candidateCount:0}};
 assert.equal(sanitize(empty,req,env).status,'NO_PRIVATE_SHADOW');
});
