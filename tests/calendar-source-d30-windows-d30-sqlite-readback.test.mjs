import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {
 D30_SQLITE_ISSUE_TITLE,D30_SQLITE_SCHEMA,D30_SQLITE_OPERATION,
 authorizeD30SqliteIssue,nyCalendarDay,d30CalendarDay,
 readD30Sqlite,runD30SqliteIssue,
} from '../calendar-source-d30/windows-d30-sqlite-readback.mjs';

const HEAD='a'.repeat(40);
const TODAY='2026-11-07';
const TARGET='2026-12-07';
const NOW=new Date('2026-11-07T20:00:00.000Z'); // NY November 7, 3pm.
const UUID='5a70fcdc-00ae-4e39-8626-7f40f59db424';
const BASE='release-calendar:earnings-api';
const body={schema:D30_SQLITE_SCHEMA,operation:D30_SQLITE_OPERATION,
 requestId:`pc-calendar-d30-db-${UUID}`,controlSha:HEAD};
const event={action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{number:741,user:{login:'ansqhd5774-Choi'},
  title:D30_SQLITE_ISSUE_TITLE,body:JSON.stringify(body)}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:HEAD};
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function fixture(t,{state='READY',statusDay=TODAY,missing=null,
  corruptDay=false,rows=[{symbol:'SECRET',name:'Private Company'}]}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'d30-readback-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'storage'));
 const file=path.join(root,'storage','core.sqlite');
 const db=new DatabaseSync(file);
 db.exec('CREATE TABLE public_feed_snapshots_v1 (kind TEXT,feed_key TEXT,snapshot_key TEXT,body TEXT,stored_at INTEGER,PRIMARY KEY(kind,feed_key,snapshot_key))');
 const write=(key,content,at)=>{
  if(key===missing)return;
  db.prepare('INSERT INTO public_feed_snapshots_v1 VALUES (?,?,?,?,?)').run(
   'input',key,'current',JSON.stringify(content),at);
 };
 const t0=Date.parse('2026-11-07T19:00:00.000Z');
 write(`${BASE}:forward-30-attempt:${TODAY}`,{attemptedNyDay:TODAY},t0);
 write(`${BASE}:${TARGET}`,{requestedDate:TARGET,
  text:corruptDay?'not-json':JSON.stringify({date:TARGET,pre:rows,after:[],
    notSupplied:[],apiKey:'VENDOR_SECRET_DO_NOT_OUTPUT'})},t0+10);
 write(`${BASE}:forward-30-status`,{status:state,attemptedNyDay:statusDay,
  checkedAt:new Date(t0+20).toISOString(),coveredDays:state==='READY'?[TARGET]:[],
  recordCount:rows.length,publicationStatus:'HELD_UNCONFIRMED'},t0+20);
 db.close();
 return {file,read:()=>readD30Sqlite({now:NOW,dbPath:file})};
}

test('New York day and D+30 arithmetic stay on calendar dates',()=>{
 assert.equal(nyCalendarDay(NOW),TODAY);
 assert.equal(d30CalendarDay(TODAY),TARGET);
 assert.equal(nyCalendarDay(new Date('2026-11-08T04:30:00.000Z')),TODAY);
 assert.equal(d30CalendarDay('2026-10-31'),'2026-11-30');
 assert.equal(d30CalendarDay('bogus'),null);
});

test('exact owner, schema, request ID and checked-out control SHA authorize only readback',()=>{
 const r=authorizeD30SqliteIssue({event,env,observedControlSha:HEAD});
 assert.equal(r.status,'AUTHORIZED');
 assert.equal(r.issue,741);
 assert.equal(r.providerCalls,0);
 const alien={...event,sender:{login:'other-user'}};
 assert.equal(authorizeD30SqliteIssue({event:alien,env,observedControlSha:HEAD}).status,'BLOCKED');
 assert.equal(authorizeD30SqliteIssue({event:{...event,action:'edited'},env,
  observedControlSha:HEAD}).status,'BLOCKED');
 const injected={...event,issue:{...event.issue,
  body:JSON.stringify({...body,dbPath:'C:\\other.sqlite'})}};
 assert.equal(authorizeD30SqliteIssue({event:injected,env,
  observedControlSha:HEAD}).code,'ER1_D30_SQLITE_CONTROL_OR_SCOPE_STOP');
 assert.equal(authorizeD30SqliteIssue({event,env,
  observedControlSha:'b'.repeat(40)}).status,'BLOCKED');
});

test('unauthorized Issue cannot invoke even an injected readback host',()=>{
 let opened=0;
 const result=runD30SqliteIssue({event:{...event,issue:{...event.issue,
  title:'pc-calendar-d30-readonly-preview-once'}},env,platform:'win32',
  observedControlSha:HEAD,readback:()=>{opened++;return {};}});
 assert.equal(result.status,'BLOCKED');
 assert.equal(opened,0);
});

test('exact current input rows are read back, parsed and verified with zero operational writes',t=>{
 const f=fixture(t);const oldHash=hash(f.file);
 const r=f.read();
 assert.equal(r.status,'PASS');
 assert.equal(r.code,'ER1_D30_PRIVATE_SQLITE_READBACK_VERIFIED');
 assert.equal(r.nyDay,TODAY);
 assert.equal(r.targetDay,TARGET);
 assert.equal(r.recordCount,1);
 assert.equal(r.privateInputVerified,true);
 assert.equal(r.attemptObserved,true);
 assert.equal(r.providerRequestEvidence,'NOT_DIRECTLY_OBSERVED');
 assert.equal(r.d30SourceDesignedMaxDailyGet,1);
 assert.equal(r.providerCalls,0);
 assert.equal(r.dbWrites,0);
 assert.equal(r.d1Writes,0);
 assert.equal(r.operationalWrites,0);
 assert.equal(hash(f.file),oldHash);
 const report=JSON.stringify(r);
 for(const secret of ['SECRET','Private Company','VENDOR_SECRET','apiKey','text'])
  assert.equal(report.includes(secret),false);
});

test('missing private day row cannot be reported as successful collection',t=>{
 const f=fixture(t,{missing:`${BASE}:${TARGET}`});
 const r=f.read();
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'ER1_D30_PRIVATE_INPUT_READBACK_MISMATCH');
 assert.equal(r.privateInputVerified,false);
});

test('unparseable private payload and wrong status day never become PASS',t=>{
 const corrupt=fixture(t,{corruptDay:true});
 assert.equal(corrupt.read().status,'STATE_UNKNOWN');
 const stale=fixture(t,{statusDay:'2026-11-06'});
 assert.equal(stale.read().code,'ER1_D30_FORWARD_STATUS_STALE');
});

test('supplier failure preserves observed attempted day but not stored-success claim',t=>{
 const f=fixture(t,{state:'SOURCE_FAILED'});
 const r=f.read();
 assert.equal(r.status,'SOURCE_FAILED');
 assert.equal(r.code,'ER1_D30_PRIVATE_PROVIDER_FAILED');
 assert.equal(r.privateInputVerified,false);
});

test('missing status is PENDING and a forced SQLite failure stays UNKNOWN',t=>{
 const f=fixture(t,{missing:`${BASE}:forward-30-status`});
 assert.equal(f.read().status,'PENDING');
 const broken=readD30Sqlite({now:NOW,dbPath:f.file,
  openDb:()=>{throw Error('sensitive database host detail');}});
 assert.equal(broken.status,'STATE_UNKNOWN');
 assert.equal(JSON.stringify(broken).includes('sensitive'),false);
});

test('authorized host executes one readback and emits no secret fields',()=>{
 const r=runD30SqliteIssue({event,env,platform:'win32',
  observedControlSha:HEAD,readback:()=>({status:'PENDING',code:'FIXED_READONLY'})});
 assert.equal(r.status,'PENDING');
 assert.equal(r.issue,741);
 assert.equal(r.controlSha,HEAD);
});
