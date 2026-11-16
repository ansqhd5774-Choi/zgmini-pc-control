import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authorize,execute,SCHEMA,OUTPUT,TITLE}
 from '../tools/w03-gmh-seven-private-score-once.mjs';
import {REPO,APPROVED_SOURCE_SHA}
 from '../tools/w03-gmh-seven-manual-once.mjs';
import {sanitize} from '../tools/w03-gmh-seven-private-score-report.mjs';
const ID='321aa62b-07f5-4e54-8ef8-26f51acc6291';
const HEAD='41872b1ab1cf3257776da6dcd5e2ed12e03ec046';
const request=()=>({schema:SCHEMA,operation:TITLE,requestId:ID,
 chatId:'224fd13a-31da-4c7f-b8c1-8921439cae71',
 controlRepository:REPO,controlSourceSha:HEAD,
 candidateSourceSha:APPROVED_SOURCE_SHA});
const event=()=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{number:1700,title:TITLE,
 user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
 body:JSON.stringify(request())}});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:HEAD,GITHUB_RUN_ID:'43860001234'});
test('source-only manual scorer is one-shot authenticated, never a provider data operation',()=>{
 assert.equal(authorize(event(),env()).requestId,ID);
 for(const change of [
  e=>e.repository.private=false,e=>e.issue.title='w03-gmh-seven-history-manual-once',
  e=>e.issue.labels=[],
  e=>{let r=JSON.parse(e.issue.body);r.candidateSourceSha='f'.repeat(40);e.issue.body=JSON.stringify(r);},
  e=>{let r=JSON.parse(e.issue.body);r.extra='accept';e.issue.body=JSON.stringify(r);}
 ]){
  const e=event();change(e);
  assert.throws(()=>authorize(e,env()),{code:/W03_GMH_SCORE_/});
 }
});
test('private 7x252 real-run receipt requires SHA evidence and no public/GET writes',()=>{
 assert.equal(process.platform,'win32');
 let verified=0,claimed=0,called=0;
 const raw=execute({event:event(),env:env(),sourceRoot:'E:\\fixed',
  verify:({sourceRoot})=>{verified++;assert.equal(sourceRoot,'E:\\fixed');
   return 'E:\\fixed\\scripts\\pc-writer\\theme-seven-gmh-history-r1.mjs';},
  journal:r=>{claimed++;assert.equal(r.requestId,ID);},
  run:file=>{called++;assert.match(file,/theme-seven-gmh-history-r1.mjs/);
   return {schema:OUTPUT,status:'PASS',
    code:'W03_GMH_SCORE_PRIVATE_7X252_VERIFIED',
    observationDate:'2026-11-13',commonSessionCount:673,
    historyPoints:1764,inputManifestSha256:'a'.repeat(64),
    privateArtifactSha256:'b'.repeat(64)};}
 });
 assert.deepEqual([verified,claimed,called],[1,1,1]);
 assert.equal(raw.status,'PASS');
 assert.equal(raw.providerCalls,0);
 assert.equal(raw.d1Writes,0);
 assert.equal(raw.publicWrites,0);
 const clean=sanitize(raw,request(),env());
 assert.equal(clean.status,'PASS');
 assert.equal(clean.historyPoints,1764);
 assert.equal(clean.observationDate,'2026-11-13');
 assert.equal(clean.privateArtifactSha256,'b'.repeat(64));
 assert.ok(!JSON.stringify(clean).includes('E:\\fixed'));
 for(const override of [
  {historyPoints:252},{commonSessionCount:627},
  {d1Writes:1},{providerCalls:14},
  {rawBarExposure:true},{privateArtifactSha256:'bad'},
  {sourceCommit:'f'.repeat(40)}
 ])assert.equal(sanitize({...raw,...override},request(),env()).status,
  'STATE_UNKNOWN');
});
test('score path strictly separate from manual provider checkout and D1',()=>{
 const w=readFileSync(new URL('../.github/workflows/pc-writer-b-source-once.yml',
  import.meta.url),'utf8');
 for(const x of ['w03-gmh-seven-private-score-once',
  'w03-gmh-seven-private-score-preflight.mjs',
  'w03-gmh-seven-private-score-report.mjs',
  "steps.w03gmhscoresource.outcome == 'success'"])
  assert.ok(w.includes(x),x);
});
