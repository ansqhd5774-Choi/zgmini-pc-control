import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,classifyR179StaticSource,countStorageNames,execute,
 REPO,TITLE,SCHEMA,OUTPUT,SHA179,SHA171} from '../tools/w03-r179-stored-handoff-readonly.mjs';
import {sanitize} from '../tools/w03-r179-stored-handoff-report.mjs';

const SHA181='be0303b112d6f4471137aa134bf98f696a8a8dfe60d1d13502646c5e0b509d62';
const control='badd7300d590b33a84f2038fd5e18d7299c9d2a0';
const request=()=>({schema:SCHEMA,operation:TITLE,
 requestId:'ab17cd45-37a1-49fa-aa9a-216afcb24488',
 chatId:'b2477083-84de-4de6-a971-153dc7d7c52b',
 controlRepository:REPO,controlSourceSha:control,
 r179ExpectedSha256:SHA179,r171ExpectedSha256:SHA171,
 r181ExpectedSha256:SHA181});
const event=()=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},
 issue:{title:TITLE,number:1619,user:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(request())}});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:control,GITHUB_RUN_ID:'43840000000'});
const stat=()=>({signalLevel:'STATIC_SOURCE_ONLY_NOT_EXECUTION_AUTHORIZATION',
 sqliteToken:false,parquetToken:true,jsonToken:true,wranglerToken:true,
 d1Token:true,dryRunFlagPresent:false,computeOnlyFlagPresent:false,
 readOnlyFlagPresent:false});
const ledger=(status)=>({status,dates:{observationDate:null,observedDate:null,
 baseObservationDate:null,confirmedObservationDate:null}});
const payload=()=>({schema:'ZGMINI_W03_R179_HANDOFF_PAYLOAD_V1',
 status:'SOURCES_PINNED_READONLY',sources:{
  r181:{status:'PIN_MATCH',pinMatch:true,bytes:7089,static:stat()},
  r179:{status:'PIN_MATCH',pinMatch:true,bytes:10822,static:stat()},
  r171:{status:'PIN_MATCH',pinMatch:true,bytes:6389,static:stat()}},
 ledgers:{
 'R181_PRIMARY_LAST_RUN.json':ledger('LOCAL_PRIMARY_STORED'),
 'ZGMINI_R179_PUBLICATION_LAST_RUN.json':ledger('PUBLIC_API_ROLLING_MISMATCH'),
 'R183_PUBLICATION_RETRY_LAST_RUN.json':ledger('PUBLISHER_CHILD_FAILED_REVIEW')},
 storage:{counts:{sqlite:0,db:0,parquet:100,json:20,
 ndjson:0,csv:0,other:0},datedParquetFiles:99,
 earliestDatedFile:'2026-07-01',latestDatedFile:'2026-11-13',
 requiresContentValidation:true},
 lastPublicationStatus:'PUBLIC_API_ROLLING_MISMATCH',
 nextGate:'STORED_RAW_CONTENT_252_AND_RIGHTS_BEFORE_COMPUTE',
 rightsAttested:false,sourceRawShaVerified:false,sqliteCheckpointVerified:false,
 history252Verified:false,publisherExecuted:false,d1Readback:false,
 providerCalls:0,sqliteOpened:false,pcWrites:0,d1Writes:0});
test('exact private R179 handoff identity only',()=>{
 assert.equal(authorize(event(),env()).operation,TITLE);
 for(const modify of [
 e=>e.issue.title='pc-writer-source-install',
 e=>e.issue.labels=[],
 e=>e.sender.login='other',
 e=>e.repository.private=false,
 e=>{const r=JSON.parse(e.issue.body);r.r179ExpectedSha256='0'.repeat(64);e.issue.body=JSON.stringify(r);},
 e=>{const r=JSON.parse(e.issue.body);r.extra=true;e.issue.body=JSON.stringify(r)}
 ]){
  const e=event();modify(e);
  assert.throws(()=>authorize(e,env()),{code:/^W03_R179_AUTH_/});
 }
});
test('static source signals provide no execution authority and no raw paths',()=>{
 const x=classifyR179StaticSource(
 "const source='sensitive api key'; // --dry-run sqlite3 parquet\nconst db='D1';");
 assert.equal(x.dryRunFlagPresent,true);
 assert.equal(x.sqliteToken,true);
 assert.equal(x.parquetToken,true);
 assert.equal(x.signalLevel,'STATIC_SOURCE_ONLY_NOT_EXECUTION_AUTHORIZATION');
 assert.equal(JSON.stringify(x).includes('sensitive api key'),false);
});
test('bounded local storage inventory lists types/dates, not filenames or prices',()=>{
 const x=countStorageNames(['etf_daily_2026-11-13.parquet',
  'etf_daily_2026-11-12.parquet','asset-secret.sqlite',
  'token-dump.json','otherFile.txt','etf_daily_2026-02-30.parquet']);
 assert.equal(x.counts.parquet,3);
 assert.equal(x.counts.sqlite,1);
 assert.equal(x.datedParquetFiles,2);
 assert.equal(x.latestDatedFile,'2026-11-13');
 assert.equal(JSON.stringify(x).includes('asset-secret'),false);
 assert.throws(()=>countStorageNames(new Array(4001).fill('x')),
  {code:'W03_R179_STORAGE_INVENTORY_BOUND_STOP'});
});
test('valid static report cannot be mistaken for history-252 or actual D1 publication',()=>{
 const result=execute({event:event(),env:env(),inspect:payload});
 const safe=sanitize(result,request(),env());
 assert.equal(safe.status,'PASS');
 assert.equal(safe.details.status,'SOURCES_PINNED_READONLY');
 assert.equal(safe.details.history252Verified,false);
 assert.equal(safe.details.publisherExecuted,false);
 assert.equal(safe.details.d1Readback,false);
 assert.equal(safe.details.lastPublicationStatus,'PUBLIC_API_ROLLING_MISMATCH');
});
test('invalid dates, claimed rights, leaked keys, mismatched source and DB writes blocked',()=>{
 const safe=sanitize(execute({event:event(),env:env(),inspect:payload}),
  request(),env());
 assert.equal(safe.status,'PASS');
 const orig=execute({event:event(),env:env(),inspect:payload});
 for(const mutation of [
  p=>p.details.rightsAttested=true,
  p=>p.details.sqliteCheckpointVerified=true,
  p=>p.details.d1Writes=1,
  p=>p.details.storage.latestDatedFile='2026-02-30',
  p=>p.details.ledgers['ZGMINI_R179_PUBLICATION_LAST_RUN.json'].dates.observationDate='2026-99-99',
  p=>p.details.sources.r179.static.apiToken='secret',
  p=>p.details.sources.r179.sha='secret'
 ]){
  const p=structuredClone(orig);mutation(p);
  if(p.details.sources.r179.static.apiToken||p.details.sources.r179.sha){
   // Whitelist removes accidental extra fields; it never sends arbitrary strings.
   const s=sanitize(p,request(),env());
   assert.equal(JSON.stringify(s).includes('secret'),false);
  }else assert.equal(sanitize(p,request(),env()).status,'STATE_UNKNOWN');
 }
});
