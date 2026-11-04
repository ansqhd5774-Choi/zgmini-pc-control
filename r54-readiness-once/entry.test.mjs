import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspect,projectR35Details,validateRequest,TITLE,SCHEMA,REPO,OWNER,TASK_NAMES} from './entry.mjs';

const id='12345678-1234-4123-8123-123456789abc';
const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:OWNER,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_SHA:'a'.repeat(40)};
const request={schema:SCHEMA,operation:'r54-readiness-readonly-once',
 requestId:'pc-theme-r54-readiness-'+id,chatId:'chat-'+id,controlSha:env.GITHUB_SHA};
const event={action:'opened',repository:{private:true,full_name:REPO},issue:{number:301,
 user:{login:OWNER},title:TITLE,labels:[],body:JSON.stringify(request)}};

test('exact issue and immutable request are accepted',()=>{
 assert.deepEqual(validateRequest(event,env),request);
});
test('request cannot choose operation or source',()=>{
 const replaced={...request,operation:'shell'};
 assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify(replaced)}},env),
  /R54_READINESS_REQUEST_DENIED/);
 const extra={...request,command:'schtasks /Delete'};
 assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify(extra)}},env),
  /R54_READINESS_REQUEST_DENIED/);
});
test('task failure is isolated and does not mask other task results',()=>{
 const seen=[];
 const r47Task='ZGMINI-PC-Theme-Nine-R47-Private';
 const r=inspect({freeMiB:1488,dataRoot:'R54-fixture',
  taskQuery:name=>{seen.push(name);if(name===TASK_NAMES[1]){
   const error=Object.assign(new Error('not found'),{status:1});throw error;
  }return Buffer.from('<Task/>');},
  list:()=>[]});
 assert.deepEqual(seen,[...TASK_NAMES,r47Task]);
 assert.equal(r.tasks[0].found,true);
 assert.equal(r.tasks[1].found,false);
 assert.equal(r.tasks[1].exitCode,1);
 assert.equal(r.tasks[2].found,true);
 assert.equal(r.tasks[3].name,r47Task);
 assert.equal(r.freeMiB,1488);
});

test('source probe ledger is attributed by New York date; source responses are not quota failures',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r35-ny-probe-'));
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 try{
  const win={start:'2026-10-30',end:'2026-11-03'};
  const roster='b'.repeat(64);
  const identity=digest(JSON.stringify({rosterSha:roster,start:win.start,end:win.end})).slice(0,20);
  const dir=path.join(root,'themes','legacy-nine-r47-probes');
  fs.mkdirSync(dir,{recursive:true});
  const attempts=[
   {at:'2026-11-03T02:30:41.000Z',status:'WAIT_SOURCE_NO_NEW_VERIFIED_SPY_SESSION',
    providerCalls:1,latestSeenSpyNYDay:'2026-10-30'},
   {at:'2026-11-04T02:30:53.000Z',status:'WAIT_SOURCE_NO_NEW_VERIFIED_SPY_SESSION',
    providerCalls:1,latestSeenSpyNYDay:'2026-10-30'}
  ];
  fs.writeFileSync(path.join(dir,'r47-source-probe-'+identity+'.json'),
   JSON.stringify({version:1,project:'legacy-nine-r47-source-probe',rosterSha256:roster,
    window:win,attempts}));
  const observed=inspect({dataRoot:root,freeMiB:1400,taskQuery:()=>'<Task/>',list:fs.readdirSync});
  const ledger=observed.sourceLineage.r35Evidence.probeLedger;
  assert.equal(ledger.status,'READ');
  assert.equal(ledger.invalidFiles,0);
  for(const date of ['2026-11-02','2026-11-03']){
   assert.equal(ledger.days[date].attemptCount,1);
   assert.equal(ledger.days[date].attempts[0].status,'WAIT_SOURCE_NO_NEW_VERIFIED_SPY_SESSION');
   assert.equal(ledger.days[date].attempts[0].providerCalls,1);
   assert.equal(ledger.days[date].attempts[0].latestSeenSpyNYDay,'2026-10-30');
   assert.match(ledger.days[date].attempts[0].ledgerSha256,/^[a-f0-9]{64}$/);
  }
  assert.equal(ledger.days['2026-11-02'].attempts[0].at,'2026-11-03T02:30:41.000Z');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('SPY raw pages are independently hash-checked; only target session counts are reported',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r35-raw-proof-'));
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 try{
  const dir=path.join(root,'themes','legacy-nine-r35-delta','raw');
  fs.mkdirSync(dir,{recursive:true});
  const bytes=Buffer.from([
   {timestamp:'2026-11-02T15:30:00Z',symbol:'SPY',close:555,volume:1},
   {timestamp:'2026-11-03T15:30:00Z',symbol:'SPY',close:556,volume:2},
   {timestamp:'2026-11-04T15:30:00Z',symbol:'SPY',close:557,volume:3}
  ].map(v=>JSON.stringify(v)).join('\n')+'\n');
  fs.writeFileSync(path.join(dir,'SPY_'+digest(bytes)+'.jsonl'),bytes);
  fs.writeFileSync(path.join(dir,'SPY_'+'d'.repeat(64)+'.jsonl'),bytes);
  const r=inspect({dataRoot:root,freeMiB:1400,taskQuery:()=>'<Task/>',list:fs.readdirSync});
  const spy=r.sourceLineage.r35Evidence.spyRaw;
  assert.equal(spy.status,'READ');
  assert.equal(spy.filesScanned,2);
  assert.equal(spy.invalidFiles,1);
  assert.equal(spy.dates['2026-11-02'].savedRows,1);
  assert.equal(spy.dates['2026-11-03'].savedRows,1);
  assert.equal(spy.dates['2026-11-02'].files[0].sha256,digest(bytes));
  assert.equal(JSON.stringify(spy).includes('555'),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('new R35 issue report omits unrelated R54 details and fits 8192-byte upload contract',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r35-compact-report-'));
 try{
  const add=(relative,text)=>{
   const file=path.join(root,relative);
   fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,text);
  };
  add('themes/legacy-nine-r35-delta/raw-manifest.json',
   JSON.stringify({files:[{symbol:'SPY',lastVerifiedNYDay:'2026-10-30'}]}));
  for(const [i,day] of ['2026-11-02','2026-11-03'].entries())add(
   'pc-writer/theme-nine-r48/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE_'+i+'_1.json',
   JSON.stringify({status:'PRIVATE_SHADOW_ALREADY_VERIFIED',
    collection:{status:'WAIT_SOURCE_NO_NEW_VERIFIED_SPY_SESSION'},
    freshness:{targetClosedNYDay:day,lastVerifiedSpyNYDay:'2026-10-30'}}));
  const projected=projectR35Details(inspect({dataRoot:root,taskQuery:()=>'<Task/>',
   freeMiB:807,list:fs.readdirSync}));
  assert.equal(projected.r47Reports.reports.length,2);
  assert.equal(projected.r35Manifest.latestSpyDay,'2026-10-30');
  assert.equal(Object.hasOwn(projected,'freeMiB'),false);
  assert.equal(Object.hasOwn(projected,'recentRuns'),false);
  assert.ok(Buffer.byteLength(JSON.stringify({details:projected},null,2))<8192);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('observation contains no raw XML or error stderr',()=>{
 const r=inspect({freeMiB:1700,dataRoot:'R54-fixture',
  taskQuery:name=>{if(name===TASK_NAMES[2])throw Object.assign(new Error('secret'),{status:1,stderr:'secret'});
   return Buffer.from('<Task><Password>secret</Password></Task>');},
  list:()=>[]});
 const body=JSON.stringify(r);
 assert.equal(body.includes('<Task>'),false);
 assert.equal(body.includes('secret'),false);
});

test('installed R54, R47 report and raw manifests are observed only by hash and dates',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-readonly-proof-'));
 try{
  const write=(relative,content)=>{
   const p=path.join(root,relative);
   fs.mkdirSync(path.dirname(p),{recursive:true});
   fs.writeFileSync(p,content);return p;
  };
  const script='// legacy installed revision; SECRET_MUST_NOT_LEAK';
  write('pc-writer/theme-nine-r54/scripts/pc-writer/theme-nine-r54-public-connect.mjs',script);
  write('pc-writer/theme-nine-r54/scripts/pc-writer/THEME_NINE_R54_PUBLIC_CYCLE.cmd','@echo off');
  write('pc-writer/theme-nine-r48/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd','@echo off');
  write('themes/legacy-nine-r23/raw-manifest.json',JSON.stringify({files:[]}));
  write('themes/legacy-nine-r35-delta/raw-manifest.json',JSON.stringify({files:[
   {symbol:'SPY',lastVerifiedNYDay:'2026-10-30'}]}));
  write('pc-writer/theme-nine-r48/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE_1_2.json',
   JSON.stringify({status:'PRIVATE_SAVED',freshness:{targetClosedNYDay:'2026-11-03',
    lastVerifiedSpyNYDay:'2026-10-30'},raw:'SECRET_MUST_NOT_LEAK'}));
  write('pc-writer/theme-nine-r54/logs/THEME_NINE_R54_CYCLE_1_2.txt',
   'SECRET_MUST_NOT_LEAK\nTHEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT\nRESULT=STOP_OR_PENDING_REVIEW_TXT\n');
  const result=inspect({dataRoot:root,freeMiB:900,taskQuery:()=>'<Task/>',list:fs.readdirSync});
  assert.equal(result.sourceLineage.installed.r54Connect.sha256,
   createHash('sha256').update(script).digest('hex'));
  assert.equal(result.sourceLineage.manifests.r35.latestSpyDay,'2026-10-30');
  assert.equal(result.sourceLineage.recentRuns.r47.files[0].detail.targetClosedNYDay,'2026-11-03');
  assert.deepEqual(result.sourceLineage.recentRuns.r54.files[0].detail.errors,
   ['THEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT']);
  assert.equal(JSON.stringify(result).includes('SECRET_MUST_NOT_LEAK'),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
