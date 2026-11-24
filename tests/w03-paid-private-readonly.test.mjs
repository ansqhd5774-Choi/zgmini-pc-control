import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectW03PaidPrivateReadonly,summarizeD05ThemeCandidates,inspectD05ConfiguredRegistrationReadonly} from '../tools/w03-paid-private-readonly.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const H='a'.repeat(64),Q='b'.repeat(64);
const baseDate=Date.parse('2026-01-01T00:00:00Z');
const points=Array.from({length:252},(_,i)=>({
 date:new Date(baseDate+i*86400000).toISOString().slice(0,10),score:42+i/100
}));
const confirmed=points.at(-1).date;
function fixture({scores=points,storeStatus='PRIVATE_STORED_READBACK_VERIFIED',includeTheme=true}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w03-private-safe-'));
 const dir=path.win32.join(root,'pc-writer','marketparquet-paid');
 const derived=path.win32.join(dir,'derived');fs.mkdirSync(derived,{recursive:true});
 const content=JSON.stringify({schema:'ZGMINI_PAID_PRIVATE_DERIVED_V1',sourceVersion:H,
  registrySha256:Q,confirmedDate:confirmed,provisionalDate:confirmed,
  themes:[{id:'ai-software',configured:true,confirmedObservationDate:confirmed,
   history:scores,score:scores.at(-1).score,secret:'NEVER_EXPOSE'}]});
 const digest=sha(content);
 fs.writeFileSync(path.win32.join(derived,'private-theme-'+digest+'.json'),content);
 const run={status:'PRIVATE_CALCULATED',confirmedDate:confirmed,sourceLatestDate:confirmed,
  privateResults:includeTheme?[{id:'ai-software',status:'PRIVATE_CALCULATED_NOT_PUBLISHED'}]:[],
  privateStored:{status:storeStatus,count:1,bodySha256:digest},
  results:[{id:'ai-software',status:'READY'}],secret:'NEVER_EXPOSE'};
 const report=path.win32.join(dir,'theme-last-run.json');fs.writeFileSync(report,JSON.stringify(run));
 return {root,dir,report,digest,run,clean:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('verifies exactly 252 private score dates with byte SHA without exposing score or secrets',()=>{
 const x=fixture();try{
  const got=inspectW03PaidPrivateReadonly({root:x.root});
  assert.equal(got.status,'PASS');assert.equal(got.code,'W03_AI_PRIVATE_252_READBACK_VERIFIED');
  assert.equal(got.historyPoints,252);assert.equal(got.lastDate,confirmed);
  assert.equal(got.privateBodySha256,x.digest);
  assert.equal(got.operationalWrites,0);assert.equal(got.providerCalls,0);
  assert.equal(got.d1Writes,0);assert.doesNotMatch(JSON.stringify(got),/NEVER_EXPOSE/);
  assert.equal(Object.hasOwn(got,'score'),false);
 }finally{x.clean();}
});
test('post-publish unchanged and D1-CAS statuses still verify private bytes',()=>{
 const x=fixture();try{
  for(const state of ['UNCHANGED_READBACK_VERIFIED','D1_CAS_READBACK_VERIFIED']){
   x.run.status=state;fs.writeFileSync(x.report,JSON.stringify(x.run));
   const got=inspectW03PaidPrivateReadonly({root:x.root});
   assert.equal(got.status,'PASS');
   assert.equal(got.code,'W03_AI_PRIVATE_252_READBACK_VERIFIED');
   assert.equal(got.cycleStatus,state);
   assert.equal(got.privateBodySha256,x.digest);
  }
  x.run.privateStored.status='PRIVATE_STORE_FAILED';fs.writeFileSync(x.report,JSON.stringify(x.run));
  assert.equal(inspectW03PaidPrivateReadonly({root:x.root}).code,'W03_PRIVATE_STORE_NOT_VERIFIED');
 }finally{x.clean();}
});
test('does not promote missing theme, waiting cycle, or failed storage',()=>{
 const x=fixture({includeTheme:false});try{
  assert.equal(inspectW03PaidPrivateReadonly({root:x.root}).code,'W03_AI_SOFTWARE_NOT_CALCULATED');
  x.run.privateResults=[{id:'ai-software',status:'PRIVATE_CALCULATED_NOT_PUBLISHED'}];
  x.run.privateStored.status='PRIVATE_STORE_FAILED';
  fs.writeFileSync(x.report,JSON.stringify(x.run));
  assert.equal(inspectW03PaidPrivateReadonly({root:x.root}).code,'W03_PRIVATE_STORE_NOT_VERIFIED');
  x.run.status='NOT_ENABLED';fs.writeFileSync(x.report,JSON.stringify(x.run));
  assert.equal(inspectW03PaidPrivateReadonly({root:x.root}).code,'W03_CYCLE_NOT_CALCULATED');
 }finally{x.clean();}
});
test('rejects tampered digest and falsified score observations',()=>{
 const x=fixture();try{
  x.run.privateStored.bodySha256='c'.repeat(64);fs.writeFileSync(x.report,JSON.stringify(x.run));
  assert.equal(inspectW03PaidPrivateReadonly({root:x.root}).code,'W03_DERIVED_W03_FILE_NOT_FOUND');
  x.run.privateStored.bodySha256=x.digest;fs.writeFileSync(x.report,JSON.stringify(x.run));
  const file=path.win32.join(x.dir,'derived','private-theme-'+x.digest+'.json');
  fs.writeFileSync(file,'{}');
  assert.equal(inspectW03PaidPrivateReadonly({root:x.root}).code,'W03_DERIVED_HASH_MISMATCH');
 }finally{x.clean();}
});
test('distinguishes 251 valid points from verified 252-point history',()=>{
 const x=fixture({scores:points.slice(1)});try{
  const got=inspectW03PaidPrivateReadonly({root:x.root});
  assert.equal(got.status,'PARTIAL');
  assert.equal(got.code,'W03_AI_PRIVATE_PARTIAL_HISTORY');
  assert.equal(got.historyPoints,251);
 }finally{x.clean();}
});
test('missing last run and directory substitution are not reported as completed',()=>{
 const x=fixture();try{
  fs.unlinkSync(x.report);
  assert.equal(inspectW03PaidPrivateReadonly({root:x.root}).code,'W03_LAST_RUN_W03_FILE_NOT_FOUND');
  fs.mkdirSync(x.report);
  assert.equal(inspectW03PaidPrivateReadonly({root:x.root}).code,'W03_LAST_RUN_W03_FILE_UNSAFE');
 }finally{x.clean();}
});

test('D05 public-only archive checks the approved registered roster, not the 30-card UI catalog',()=>{
 const now=Date.parse('2026-11-24T02:00:00.000Z');
 const n=(v)=>'theme-'+v.repeat(64)+'.json';
 const event=(i,at='2026-11-23T16:00:00.000Z')=>({
  scoreId:'theme:sample-'+i,score:63.51,phase:'CONFIRMED',
  asOfDate:'2026-11-20',calculatedAt:at,calculatedDateKst:'2026-11-24',
  eventId:createHash('sha256').update(i+'|'+at).digest('hex')
 });
 const rows=Array.from({length:10},(_,i)=>event(i));
 const publicExpectedIds=rows.map(e=>e.scoreId.slice(6));
 const publicReadyIds=[...publicExpectedIds];
 const confirmedDate='2026-11-20';
 const receipt={status:'LOCAL_FINAL_THEME_OUTPUT_VERIFIED',candidateBodySha256:'a'.repeat(64),
  calculatedAt:rows[0].calculatedAt,scoreCount:10,
  outputEventsSha256:createHash('sha256').update(JSON.stringify(rows.map(e=>e.eventId).sort())).digest('hex')};
 const options={now,receipt,publicExpectedIds,publicReadyIds,confirmedDate};
 const out=summarizeD05ThemeCandidates([n('a'),n('b')],()=>rows,options);
 assert.equal(out.status,'PASS');assert.equal(out.dailyFinalScorePoints,10);
 assert.equal(out.code,'D05_PAID_PUBLIC_FINAL_OUTPUTS_READBACK_VERIFIED');
 assert.equal(out.scope,'PAID_PUBLIC_FINAL_OUTPUTS_ONLY');
 assert.equal(out.expectedPublicThemeCount,10);assert.equal(out.dashboardTargetThemeCount,30);
 assert.equal(out.distinctCalculationDates,1);assert.equal(out.latestDateThemeCount,10);
 assert.equal(out.completePublicDates,1);assert.equal(out.complete30Dates,0);
 assert.equal(out.currentReceiptMatched,true);assert.equal(out.publicFinalOutputCoverageVerified,true);
 assert.equal(out.full30FinalOutputCoverageVerified,false);assert.equal(out.oneYearComplete,false);
 assert.doesNotMatch(JSON.stringify(out),/sample-|63\\.51/);
 const gap=summarizeD05ThemeCandidates([n('a'),n('b')],name=>{
  if(name===n('b'))throw Error('SECRET');return rows.slice(0,9);
 },options);
 assert.equal(gap.status,'PARTIAL');assert.equal(gap.distinctThemeCount,9);
 assert.equal(gap.rejectedCandidateFiles,1);assert.equal(gap.currentReceiptMatched,false);
 assert.doesNotMatch(JSON.stringify(gap),/SECRET/);
 const conflict=summarizeD05ThemeCandidates([n('a'),n('b')],name=>
  name===n('a')?rows:[{...rows[0],eventId:'e'.repeat(64)}],options);
 assert.equal(conflict.status,'PARTIAL');assert.equal(conflict.clockConflicts,1);
 const stale=summarizeD05ThemeCandidates([n('a')],()=>rows,{...options,deadline:0});
 assert.equal(stale.status,'PARTIAL');assert.equal(stale.scannedCandidateFiles,0);
 assert.equal(summarizeD05ThemeCandidates(['../escape.json'],()=>rows,options).status,'STATE_UNKNOWN');
 for(const change of [
  {publicExpectedIds:null},{publicExpectedIds:['sample-0','sample-0']},
  {publicExpectedIds:[...publicExpectedIds.slice(0,-1),'other']},
  {publicReadyIds:publicReadyIds.slice(1)},
  {confirmedDate:'2026-11-19'},
  {receipt:null},
  {receipt:{...receipt,calculatedAt:'2026-11-20T01:00:00.000Z'}}
 ]){
  const result=summarizeD05ThemeCandidates([n('a')],()=>rows,{...options,...change});
  assert.equal(result.status,'PARTIAL');assert.equal(result.publicFinalOutputCoverageVerified,false);
 }
});

test('D05 public final-output coverage scales with the approved roster, not ten or thirty UI cards',()=>{
 const now=Date.parse('2026-11-24T02:00:00.000Z');
 const candidate='theme-'+'a'.repeat(64)+'.json';
 for(const count of [11,31]){
  const rows=Array.from({length:count},(_,i)=>({
   scoreId:'theme:future-'+i,score:63.51,phase:'CONFIRMED',
   asOfDate:'2026-11-20',calculatedAt:'2026-11-23T16:00:00.000Z',
   calculatedDateKst:'2026-11-24',
   eventId:sha('future-'+i)
  }));
  const roster=rows.map(x=>x.scoreId.slice('theme:'.length));
  const receipt={status:'LOCAL_FINAL_THEME_OUTPUT_VERIFIED',
   candidateBodySha256:'a'.repeat(64),calculatedAt:rows[0].calculatedAt,
   scoreCount:count,outputEventsSha256:sha(JSON.stringify(rows.map(x=>x.eventId).sort()))};
  const result=summarizeD05ThemeCandidates([candidate],()=>rows,{
   now,receipt,publicExpectedIds:roster,publicReadyIds:roster,
   confirmedDate:'2026-11-20'
  });
  assert.equal(result.status,'PASS');
  assert.equal(result.code,'D05_PAID_PUBLIC_FINAL_OUTPUTS_READBACK_VERIFIED');
  assert.equal(result.expectedPublicThemeCount,count);
  assert.equal(result.distinctThemeCount,count);
  assert.equal(result.latestDateThemeCount,count);
  assert.equal(result.completePublicDates,1);
  assert.equal(result.dailyFinalScorePoints,count);
  assert.equal(result.currentReceiptMatched,true);
  assert.equal(result.publicFinalOutputCoverageVerified,true);
  assert.doesNotMatch(JSON.stringify(result),/future-|63\.51/);
 }
});

test('D05 archive count beyond 10000 remains bounded and verifies the actual dynamic roster',()=>{
 const at=Date.parse('2026-11-23T16:00:00.000Z');
 const now=Date.parse('2026-11-24T02:00:00.000Z');
 const file=i=>'theme-'+i.toString(16).padStart(64,'0')+'.json';
 const names=Array.from({length:10001},(_,i)=>file(i));
 const event=i=>({scoreId:'theme:sample-0',score:63.51,phase:'CONFIRMED',
  asOfDate:'2026-11-20',calculatedAt:new Date(at+i).toISOString(),
  calculatedDateKst:'2026-11-24',eventId:sha('event-'+i)});
 const newest=event(names.length-1);
 const receipt={status:'LOCAL_FINAL_THEME_OUTPUT_VERIFIED',
  candidateBodySha256:(names.length-1).toString(16).padStart(64,'0'),
  calculatedAt:newest.calculatedAt,scoreCount:1,
  outputEventsSha256:sha(JSON.stringify([newest.eventId]))};
 const out=summarizeD05ThemeCandidates(names,name=>[event(parseInt(name.slice(6,70),16))],{
  now,deadline:Date.now()+90000,receipt,publicExpectedIds:['sample-0'],
  publicReadyIds:['sample-0'],confirmedDate:'2026-11-20'
 });
 assert.equal(out.status,'PASS');
 assert.equal(out.candidateFiles,10001);
 assert.equal(out.scannedCandidateFiles,10001);
 assert.equal(out.actualOutputEvents,10001);
 assert.equal(out.dailyFinalScorePoints,1);
 assert.equal(out.archiveScanComplete,true);
 assert.equal(out.currentReceiptMatched,true);
 assert.equal(out.publicFinalOutputCoverageVerified,true);
 assert.equal(out.oneYearComplete,false);
 assert.doesNotMatch(JSON.stringify(out),/sample-0|63\\.51/);
 const excess=Array(100001).fill(file(0));
 assert.equal(summarizeD05ThemeCandidates(excess,()=>{throw Error('READ_MUST_NOT_RUN')}).code,
  'D05_THEME_ARCHIVE_INVENTORY_INVALID');
});

test('D05 configured registration file inventory is count-only and preserves private definitions',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'d05-registered-readonly-'));
 try{
  const dir=path.join(root,'theme-config','definitions');
  fs.mkdirSync(dir,{recursive:true});
  const d={schema:'ZGMINI_THEME_CONFIG_V2',id:'quantum-computing',
   label:'양자컴퓨팅',provider:'getmarkethistory',
   profile:'ETF_ONLY_T40_R20_V40_ADAPTIVE_R2_DATED_ISSUER_AUM_R32',
   etfs:['QTUM'],benchmark:'SPY',startDate:'2026-01-01',
   selectionEvidence:{path:'secret/one.json',sha256:'a'.repeat(64)},
   aumEvidence:{path:'secret/two.json',sha256:'b'.repeat(64)},
   provisionalPolicy:'GMH_CONFIRMED_MARKETPARQUET_PROVISIONAL_R8_OVERLAP_GUARD'};
  const file=path.join(dir,'quantum-computing.json');
  fs.writeFileSync(file,JSON.stringify(d));
  const probe=()=>inspectD05ConfiguredRegistrationReadonly({root});
  const a=probe();
  assert.equal(a.status,'PASS');
  assert.equal(a.code,'D05_CONFIGURED_REGISTRATIONS_READONLY');
  assert.equal(a.registeredDefinitionCount,1);
  assert.equal(a.validDefinitionCount,1);
  assert.equal(a.dashboard30CoverageVerified,false);
  assert.equal(a.registeredThemesCalculated,false);
  assert.equal(a.publicPublicationAuthorized,false);
  assert.equal(a.operationalWrites,0);
  assert.match(a.registryManifestSha256,/^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(a),/quantum-computing|양자컴퓨팅|QTUM|secret/);
  assert.deepEqual(probe(),a);
  fs.writeFileSync(file,'{}');
  assert.equal(probe().status,'STATE_UNKNOWN');
  fs.unlinkSync(file);
  assert.equal(probe().registeredDefinitionCount,0);
  fs.writeFileSync(path.join(dir,'../escape.json'),'{}');
  assert.equal(probe().registeredDefinitionCount,0);
  fs.writeFileSync(path.join(dir,'not@allowed.json'),'{}');
  assert.equal(probe().code,'D05_CONFIGURED_DEFINITIONS_INVENTORY_INVALID');
  fs.unlinkSync(path.join(dir,'not@allowed.json'));
  fs.rmdirSync(dir);
  assert.equal(probe().code,'D05_CONFIGURED_DEFINITIONS_DIRECTORY_ABSENT');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
