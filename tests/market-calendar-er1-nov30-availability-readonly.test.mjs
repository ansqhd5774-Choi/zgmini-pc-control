import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {inspectER1NovemberAvailability} from '../controller/market-calendar-er1-nov30-availability-readonly.mjs';

function makeFixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-er1-nov-'));
  const home=path.join(root,'pc-writer');
  const input=path.join(home,'er1-input');
  const privateDir=path.join(input,'nov30-forward-days');
  const storage=path.join(home,'storage');
  for(const dir of [privateDir,storage])fs.mkdirSync(dir,{recursive:true});
  const db=new DatabaseSync(path.join(storage,'core.sqlite'));
  db.exec('CREATE TABLE public_feed_snapshots_v1(kind TEXT,feed_key TEXT,snapshot_key TEXT,body TEXT,stored_at INTEGER, PRIMARY KEY(kind,feed_key,snapshot_key))');
  return {root,home,input,privateDir,db,cleanup(){db.close();fs.rmSync(root,{recursive:true,force:true})}};
}
function payload(date,symbols){return {date,pre:symbols.map(symbol=>({symbol,name:'Synthetic Corp'})),after:[],notSupplied:[]}}
function savePrivate(dir,date,body){fs.writeFileSync(path.join(dir,date+'.json'),JSON.stringify({storedAt:'2026-11-04T03:00:00Z',body}))}
function saveCore(db,date,body){db.prepare('INSERT INTO public_feed_snapshots_v1 VALUES(?,?,?,?,?)').run('input',`release-calendar:earnings-api:${date}`,'current',JSON.stringify({requestedDate:date,text:JSON.stringify(body)}),1793761200000)}

test('30/30 November calendar 3051 is not confused with historical actuals or scores',()=>{
  const f=makeFixture();
  try{
    const all=[];
    for(let day=1;day<=30;day++){
      const date=`2026-11-${String(day).padStart(2,'0')}`;
      const n=101+(day<=21?1:0);
      const symbols=Array.from({length:n},(_,i)=>`T${String(all.length+i+1).padStart(5,'0')}`);
      all.push(...symbols);
      const body=payload(date,symbols);
      if(day<=16)saveCore(f.db,date,body);else savePrivate(f.privateDir,date,body);
    }
    fs.writeFileSync(path.join(f.input,'er1-public-display.json'),JSON.stringify({
      status:'READY_ER1_PUBLIC',asOf:'2026-11-02',scores:all.slice(0,4).map(
        (symbol,i)=>({issuerId:symbol,tickers:[symbol],score:60+i}))
    }));
    const known=path.join(f.input,'dec31-symbol-probe');fs.mkdirSync(known);
    fs.writeFileSync(path.join(known,all[0]+'.json'),JSON.stringify({body:[{
      date:'2026-08-01',symbol:all[0],eps:1,revenue:100
    }]}));
    fs.writeFileSync(path.join(known,all[1]+'.json'),JSON.stringify({body:[{
      date:'2026-12-01',symbol:all[1],eps:1,revenue:100
    }]}));
    const knownOther=path.join(f.input,'dec31-symbol-batch-a');fs.mkdirSync(knownOther);
    fs.writeFileSync(path.join(knownOther,all[0]+'.json'),JSON.stringify({body:[{
      date:'2026-08-01',symbol:all[0],eps:2,revenue:200
    }]}));
    const r=inspectER1NovemberAvailability(f.root,{clock:()=>Date.parse('2026-11-04T04:00:00Z')});
    assert.equal(r.status,'PASS');
    assert.equal(r.code,'ER1_NOV30_AVAILABILITY_READONLY');
    assert.equal(r.calendarEventRows,3051);
    assert.equal(r.uniqueScheduledSymbols,3051);
    assert.equal(r.verifiedDayCount,30);
    assert.equal(r.coreReusedDayCount,16);
    assert.equal(r.privateDayCount,14);
    assert.equal(r.priorScoreJoinSymbols,4);
    assert.equal(r.priorScoreAsOf,'2026-11-02');
    assert.equal(r.knownActualArchiveSymbols,2);
    assert.equal(r.actualInputFiles,3);
    // Same historical ticker in two archives is one scheduled issuer.
    assert.equal(r.candidateHistoricalMatches,1);
    assert.equal(r.actualEligibilityVerified,false);
    assert.equal(r.futureCandidateAsOfUtc,'2026-11-04');
    assert.equal(r.futureCandidateSymbols,2643);
    assert.equal(r.futureCachedFileSymbols,0);
    assert.equal(r.futureMissingFileSymbols,2643);
    assert.equal(r.futureActualContentsVerified,false);
    assert.equal(r.scoreCalculationPerformed,false);
    assert.equal(r.providerCalls,0);
    assert.equal(r.dbWrites,0);
    assert.equal(r.d1Writes,0);
    assert.equal(r.operationalWrites,0);
    assert.equal(r.sqliteOpened,true);
  }finally{f.cleanup()}
});

test('missing and invalid days are explicit, not silently deemed covered',()=>{
  const f=makeFixture();
  try{
    for(let day=1;day<=29;day++){
      const date=`2026-11-${String(day).padStart(2,'0')}`;
      savePrivate(f.privateDir,date,payload(date,[`T${day}`]));
    }
    fs.writeFileSync(path.join(f.privateDir,'2026-11-29.json'),'{bad json');
    const r=inspectER1NovemberAvailability(f.root);
    assert.equal(r.verifiedDayCount,28);
    assert.equal(r.missingDayCount,1);
    assert.equal(r.invalidDayCount,1);
    assert.equal(r.status,'PARTIAL');
    assert.equal(r.code,'ER1_NOV30_AVAILABILITY_PARTIAL');
    assert.equal(r.priorScoreSnapshotState,'UNAVAILABLE');
    assert.equal(r.providerCalls,0);
    assert.equal(r.actualEligibilityVerified,false);
  }finally{f.cleanup()}
});

test('invalid unapproved root cannot scan arbitrary paths',()=>{
  const result=inspectER1NovemberAvailability('relative-root');
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'ER1_NOV30_DATA_ROOT_INVALID');
});

test('30/30 days with an invalid vendor event is PARTIAL, never PASS',()=>{
  const f=makeFixture();
  try{
    for(let day=1;day<=30;day++){
      const date=`2026-11-${String(day).padStart(2,'0')}`;
      const body=payload(date,[`T${day}`]);
      if(day===30)body.pre.push({symbol:'!BAD',name:'Synthetic Corp'});
      savePrivate(f.privateDir,date,body);
    }
    const r=inspectER1NovemberAvailability(f.root);
    assert.equal(r.status,'PARTIAL');
    assert.equal(r.verifiedDayCount,30);
    assert.equal(r.invalidVendorRows,1);
    assert.equal(r.code,'ER1_NOV30_AVAILABILITY_PARTIAL');
  }finally{f.cleanup()}
});

test('oversized unrelated old actual archive stays bounded without blocking future candidate counts',()=>{
  const f=makeFixture();
  try{
    for(let day=1;day<=30;day++){
      const date=`2026-11-${String(day).padStart(2,'0')}`;
      savePrivate(f.privateDir,date,payload(date,[`T${day}`]));
    }
    const known=path.join(f.input,'dec31-symbol-probe');fs.mkdirSync(known);
    for(let i=1;i<=129;i++)fs.writeFileSync(path.join(known,`T${i}.json`),
      JSON.stringify({body:[{symbol:`T${i}`,date:'2026-08-01',eps:1,revenue:1}]}));
    const r=inspectER1NovemberAvailability(f.root,{clock:()=>Date.parse('2026-11-04T04:00:00Z')});
    assert.equal(r.status,'PASS');
    assert.equal(r.code,'ER1_NOV30_AVAILABILITY_READONLY');
    assert.equal(r.actualArchiveInspectionPartial,true);
    assert.equal(r.futureCandidateSymbols,26);
    assert.equal(r.futureCachedFileSymbols,26);
    assert.equal(r.futureMissingFileSymbols,0);
    assert.equal(r.providerCalls,0);
    assert.equal(r.dbWrites,0);
    assert.equal(r.d1Writes,0);
  }finally{f.cleanup()}
});

test('future-only November candidate count deduplicates and separates cached, malformed and missing files',()=>{
  const f=makeFixture();
  try{
    for(let day=1;day<=30;day++){
      const date=`2026-11-${String(day).padStart(2,'0')}`;
      const symbols=day===4?['PAST']:day===6?['FUTURE1','FUTURE2']:
        day===7?['FUTURE1','FUTURE3']:[];
      savePrivate(f.privateDir,date,payload(date,symbols));
    }
    const full=path.join(f.input,'nov30-er1-full');fs.mkdirSync(full);
    fs.writeFileSync(path.join(full,'FUTURE1.json'),'{}');
    fs.writeFileSync(path.join(full,'FUTURE2.json'),'x');
    const pilot=path.join(f.input,'nov30-er1-batch20');fs.mkdirSync(pilot);
    // A properly sized existing archive is reusable metadata, not verified history.
    fs.writeFileSync(path.join(pilot,'FUTURE2.json'),JSON.stringify({
      body:[{symbol:'FUTURE2',date:'2026-08-01',eps:1,revenue:2}],
      storedAt:'2026-11-04T00:00:00Z'}));
    const r=inspectER1NovemberAvailability(f.root,{clock:()=>Date.parse('2026-11-05T00:00:00Z')});
    assert.equal(r.status,'PASS');
    assert.equal(r.futureCandidateAsOfUtc,'2026-11-05');
    assert.equal(r.futureCandidateSymbols,3);
    assert.equal(r.futureCachedFileSymbols,2);
    assert.equal(r.futureInvalidFileSymbols,0);
    assert.equal(r.futureMissingFileSymbols,1);
    assert.equal(r.futureActualContentsVerified,false);
    assert.equal(r.providerCalls,0);
    assert.equal(r.d1Writes,0);
  }finally{f.cleanup()}
});
