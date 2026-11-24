import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectW03PaidPrivateReadonly,summarizeD05ThemeCandidates} from '../tools/w03-paid-private-readonly.mjs';

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

test('D05 final-output archive counts real calculation days only and does not expose scores or IDs',()=>{
 const now=Date.parse('2026-11-24T02:00:00.000Z');
 const n=(v)=>'theme-'+v.repeat(64)+'.json';
 const event=(i,at='2026-11-23T16:00:00.000Z')=>({
  scoreId:'theme:sample-'+i,score:63.51,phase:'CONFIRMED',
  asOfDate:'2026-11-20',calculatedAt:at,calculatedDateKst:'2026-11-24',
  eventId:createHash('sha256').update(i+'|'+at).digest('hex')
 });
 const rows=Array.from({length:30},(_,i)=>event(i));
 const receipt={status:'LOCAL_FINAL_THEME_OUTPUT_VERIFIED',candidateBodySha256:'a'.repeat(64),
  calculatedAt:rows[0].calculatedAt,scoreCount:30,
  outputEventsSha256:createHash('sha256').update(JSON.stringify(rows.map(e=>e.eventId).sort())).digest('hex')};
 const out=summarizeD05ThemeCandidates([n('a'),n('b')],()=>rows,{now,receipt});
 assert.equal(out.status,'PASS');assert.equal(out.dailyFinalScorePoints,30);
 assert.equal(out.distinctCalculationDates,1);assert.equal(out.latestDateThemeCount,30);
 assert.equal(out.complete30Dates,1);assert.equal(out.currentReceiptMatched,true);
 assert.equal(out.oneYearComplete,false);
 assert.doesNotMatch(JSON.stringify(out),/sample-|63\.51/);
 const gap=summarizeD05ThemeCandidates([n('a'),n('b')],name=>{
  if(name===n('b'))throw Error('SECRET');return rows.slice(0,29);
 },{now,receipt});
 assert.equal(gap.status,'PARTIAL');assert.equal(gap.distinctThemeCount,29);
 assert.equal(gap.rejectedCandidateFiles,1);assert.equal(gap.currentReceiptMatched,false);
 assert.doesNotMatch(JSON.stringify(gap),/SECRET/);
 const conflict=summarizeD05ThemeCandidates([n('a'),n('b')],name=>
  name===n('a')?rows:[{...rows[0],eventId:'e'.repeat(64)}],{now});
 assert.equal(conflict.status,'PARTIAL');assert.equal(conflict.clockConflicts,1);
 const stale=summarizeD05ThemeCandidates([n('a')],()=>rows,{now,deadline:0});
 assert.equal(stale.status,'PARTIAL');assert.equal(stale.scannedCandidateFiles,0);
 assert.equal(summarizeD05ThemeCandidates(['../escape.json'],()=>rows,{now}).status,'STATE_UNKNOWN');
});
