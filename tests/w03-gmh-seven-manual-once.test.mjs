import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authorize,execute,SCHEMA,OUTPUT,TITLE,REPO,
 APPROVED_SOURCE_SHA,WINDOW_START,WINDOW_END}
 from '../tools/w03-gmh-seven-manual-once.mjs';
import {sanitize} from '../tools/w03-gmh-seven-manual-report.mjs';
const ID='dc547041-e9d7-4141-8571-87d5a8f7afab';
const CHAT='7b9b6c79-7d59-4915-918a-457a821f4a6d';
const HEAD='3dfe7889c8034b22cfb8e4d6dad705ea685268ba';
const req=()=>({schema:SCHEMA,operation:TITLE,requestId:ID,chatId:CHAT,
 controlRepository:REPO,controlSourceSha:HEAD,
 candidateSourceSha:APPROVED_SOURCE_SHA,start:WINDOW_START,end:WINDOW_END,
 maxRequests:4});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:HEAD,GITHUB_RUN_ID:'43860001234'});
const event=()=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{title:TITLE,number:1665,
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
  body:JSON.stringify(req())}});
test('only owner-opened exact private manual request can pin source',()=>{
 assert.equal(authorize(event(),env()).requestId,ID);
 for(const mutate of [
  x=>x.repository.private=false,
  x=>x.issue.title='pc-writer-source-install',
  x=>x.issue.labels=[],
  x=>{const r=JSON.parse(x.issue.body);r.candidateSourceSha='f'.repeat(40);
   x.issue.body=JSON.stringify(r);},
  x=>{const r=JSON.parse(x.issue.body);r.maxRequests=99;
   x.issue.body=JSON.stringify(r);},
  x=>{const r=JSON.parse(x.issue.body);r.end='2026-11-16';
   x.issue.body=JSON.stringify(r);}
 ]){
  const actual=event();mutate(actual);
  assert.throws(()=>authorize(actual,env()),{code:/W03_GMH_MANUAL_/});
 }
});
test('reviewed public source + one explicit request only, no scheduling, write or leaked raw',()=>{
 assert.equal(process.platform,'win32',
  'actual isolated Windows CI is required for W03 runtime contract');
 let checked=0,claims=0,calls=0;
 const result=execute({event:event(),env:env(),sourceRoot:'E:\\approved-source',
  verify:({sourceRoot})=>{checked++;assert.equal(sourceRoot,'E:\\approved-source');
   return 'E:\\approved-source\\scripts\\pc-writer\\theme-seven-gmh-history-r1.mjs';},
  claim:r=>{claims++;assert.equal(r.requestId,ID);},
  launch:(file,r)=>{
   calls++;assert.equal(r.maxRequests,4);
   assert.match(file,/theme-seven-gmh-history-r1.mjs/);
   return {schema:OUTPUT,status:'PASS',code:'W03_GMH_MANUAL_PRIVATE_RAW_CHECKPOINT',
    sourceStatus:'CHECKPOINT_READY_TO_RESUME',
    providerCalls:4,rawPagesStored:4,completedSymbols:4,
    pendingSymbols:10,manifestFiles:4};
  }});
 assert.deepEqual([checked,claims,calls],[1,1,1]);
 assert.equal(result.status,'PASS');
 assert.equal(result.d1Writes,0);
 assert.equal(result.publicWrites,0);
 assert.equal(result.schedulerChanges,0);
 assert.equal(result.rawPriceExposed,false);
 assert.equal(result.sourceCommit,APPROVED_SOURCE_SHA);
 const report=sanitize(result,req(),env());
 assert.equal(report.status,'PASS');
 assert.equal(report.completedSymbols,4);
 assert.equal(report.pendingSymbols,10);
 assert.equal(report.providerCalls,4);
 assert.ok(!JSON.stringify(report).includes('approved-source'));
 const bad={...result,rawOriginalBars:[{symbol:'SPY',close:1500}]};
 const safe=sanitize(bad,req(),env());
 assert.equal(safe.status,'PASS');
 assert.ok(!JSON.stringify(safe).includes('1500'));
});
test('report rejects fabricated complete 14/14 and unsafe result fields',()=>{
 const base={schema:OUTPUT,status:'PASS',code:'W03_GMH_MANUAL_PRIVATE_RAW_CHECKPOINT',
  sourceStatus:'PRIVATE_GMH_HISTORY_COLLECTED',requestId:ID,
  sourceCommit:APPROVED_SOURCE_SHA,controlSha:HEAD,providerCalls:4,
  rawPagesStored:4,completedSymbols:14,pendingSymbols:0,
  manifestFiles:20,d1Writes:0,publicWrites:0,schedulerChanges:0,
  rawPriceExposed:false,retry:'NO_AUTOMATIC_REEXECUTION'};
 assert.equal(sanitize(base,req(),env()).status,'PASS');
 const broken=[
  {...base,providerCalls:5},
  {...base,completedSymbols:13,pendingSymbols:0},
  {...base,sourceCommit:'f'.repeat(40)},
  {...base,d1Writes:1},
  {...base,rawPriceExposed:true},
  {...base,sourceStatus:'PRIVATE_GMH_HISTORY_COLLECTED',pendingSymbols:1,
   completedSymbols:13},
 ];
 for(const b of broken)assert.equal(sanitize(b,req(),env()).status,
  'STATE_UNKNOWN');
});
test('dedicated job checks approved source commit before checkout and never runs periodic collector',()=>{
 const work=readFileSync(new URL('../.github/workflows/pc-writer-b-source-once.yml',
  import.meta.url),'utf8');
 assert.match(work,/w03-gmh-seven-history-manual-once/);
 assert.match(work,/steps\.w03gmhmanualpreflight\.outputs\.candidateSourceSha/);
 assert.match(work,/w03-gmh-seven-manual-preflight\.mjs/);
 assert.match(work,/w03-gmh-seven-manual-once\.mjs/);
 assert.match(work,/w03-gmh-seven-manual-report\.mjs/);
 assert.match(work,/w03gmhmanualsource\.outcome == 'success'/);
});
