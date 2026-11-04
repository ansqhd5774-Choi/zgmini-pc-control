import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {inspectER1NovemberAvailability} from '../market-calendar-er1-nov30-availability-readonly.mjs';

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
    assert.equal(r.candidateHistoricalMatches,1);
    assert.equal(r.actualEligibilityVerified,false);
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
