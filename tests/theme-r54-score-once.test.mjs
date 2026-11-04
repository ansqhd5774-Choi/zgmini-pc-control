import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execute,upload,validateRequest,verifyApproval,SCHEMA,TITLE,OWNER,
 CONTROL_REPO,PUBLIC_SHA,ADAPTER_SHA} from '../r54-score-once/entry.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const UUID='00000000-0000-4000-8000-000000000001';
const controlSha='a'.repeat(40);
const hash=b=>createHash('sha256').update(b).digest('hex');
const request={schema:SCHEMA,operation:'theme-nine-r54-score-replay-once',
 requestId:'pc-theme-r54-score-'+UUID,chatId:'chat-'+UUID,
 controlSha,publicSha:PUBLIC_SHA,adapterSha:ADAPTER_SHA};
const event={action:'opened',repository:{private:true,full_name:CONTROL_REPO},
 issue:{number:676,body:JSON.stringify(request),title:TITLE,user:{login:OWNER},labels:[]}};
function fixture(){
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'r54-score-once-'));
 const dataRoot=path.join(cwd,'data');
 for(const rel of ['control','adapter/controller','source','data/themes/legacy-nine-r48-private-candidate',
  'data/themes/legacy-nine-r51-private-provisional','data/pc-writer/theme-nine-r54'])
  fs.mkdirSync(path.join(cwd,rel),{recursive:true});
 fs.copyFileSync(path.join(root,'THEME_R54_SCORE_REPLAY_B_APPROVAL.json'),
  path.join(cwd,'control/THEME_R54_SCORE_REPLAY_B_APPROVAL.json'));
 fs.copyFileSync(path.resolve(root,'../pc-r54-controller-prototype/controller/theme-nine-r54-evidence-readonly.mjs'),
  path.join(cwd,'adapter/controller/theme-nine-r54-evidence-readonly.mjs'));
 const eventFile=path.join(cwd,'event.json');fs.writeFileSync(eventFile,JSON.stringify(event));
 const env={GITHUB_WORKSPACE:cwd,GITHUB_EVENT_PATH:eventFile,
  GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_ACTOR:OWNER,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_SHA:controlSha,GITHUB_RUN_ID:'785',GITHUB_TOKEN:'fixture-token'};
 fs.writeFileSync(path.join(dataRoot,'pc-writer/theme-nine-r54/PUBLISHER_CONSENT_R54.txt'),
  'ACCEPT_R54_ANONYMOUS_DERIVED_RISK_20261028\r\n');
 const candidate={observationDate:'2026-10-30',phase:'CONFIRMED',themes:Array(9).fill({score:40})};
 const bytes=Buffer.from(JSON.stringify(candidate)+'\n');
 const filename='THEME_NINE_R48_PRIVATE_CANDIDATE_2026-10-30_'+hash(bytes).slice(0,16)+'.json';
 fs.writeFileSync(path.join(dataRoot,'themes/legacy-nine-r48-private-candidate',filename),bytes);
 fs.writeFileSync(path.join(dataRoot,'themes/legacy-nine-r51-private-provisional',
  'THEME_NINE_R51_PRIVATE_PROVISIONAL_2026-10-29_2026-10-30_aaaaaaaaaaaaaaaa.json'),'{}\n');
 const pairFile=path.join(dataRoot,'themes','r47-snapshot.json');fs.writeFileSync(pairFile,'{}\n');
 return {cwd,dataRoot,env,candidate,filename,pairFile};
}
const evidence=filename=>({status:'PASS',providerCalls:0,operationalWrites:0,d1Writes:0,
 sqliteOpened:false,r48:{candidates:[
  {date:'2026-10-28',filename:'THEME_NINE_R48_PRIVATE_CANDIDATE_2026-10-28_aaaaaaaaaaaaaaaa.json',
   baseline:{status:'VERIFIED_PREFIX',rawStatus:'RAW_VERIFIED'},delta:{status:'NOT_REQUIRED'}},
  {date:'2026-10-30',filename,baseline:{status:'VERIFIED_PREFIX',
   expectedSha256:'b'.repeat(64),rawStatus:'RAW_VERIFIED'},
   delta:{status:'VERIFIED_PREFIX',expectedSha256:'c'.repeat(64),rawStatus:'RAW_VERIFIED'}}]}});
const base={status:'READY',phase:'PROVISIONAL',observationDate:'2026-10-28',
 confirmedObservationDate:'2026-10-28',themes:Array.from({length:10},(_,i)=>({theme:'T'+i})),
 provisional:{points:[{date:'2026-10-29',scores:{T0:50}}]}};
function harness(f,inspection){
 let replayCount=0,publishCount=0;
 const loader=async file=>{
  if(file.endsWith('theme-nine-r54-evidence-readonly.mjs'))
   return {inspectThemeNineR54Evidence:()=>inspection};
  if(file.endsWith('theme-nine-r54-public-connect.mjs'))
   return {verifyNineR54PrivatePair:({candidate})=>{
    replayCount++;assert.equal(candidate.observationDate,'2026-10-30');
    return {sourceFile:f.pairFile,source:{latestSpySessionDate:'2026-10-30'}};}};
  if(file.endsWith('theme-nine-r51-provisional-overlay.mjs'))
   return {buildNineR51ExistingPublicProvisionalOverlay:({confirmed,publicBase})=>({
    ...confirmed,provisional:publicBase.provisional})};
  if(file.endsWith('theme-nine-r54-public-record.mjs'))
   return {buildNineR54PublicRecord:({candidate,publisherConsent})=>{
    publishCount++;assert.equal(publisherConsent,true);return {...candidate};}};
  throw new Error('unexpected source');
 };
 return {loader,fetcher:async()=>({ok:true,json:async()=>base}),
  counts:()=>({replayCount,publishCount})};
}

test('B manifest and issue/UUID/actor gates are strict',()=>{
 const f=fixture();try{
  assert.deepEqual(validateRequest(event,f.env),request);
  assert.equal(verifyApproval(f.cwd).scope,'PRIVATE_R54_SCORE_REPLAY_NO_WRITE_ONCE');
  assert.throws(()=>validateRequest({...event,issue:{...event.issue,title:'pc-job'}},f.env),/R54_SCORE_ISSUE_AUTH_DENIED/);
  assert.throws(()=>validateRequest({...event,issue:{...event.issue,labels:[{name:'pc-job'}]}},f.env),/R54_SCORE_ISSUE_AUTH_DENIED/);
  fs.appendFileSync(path.join(f.cwd,'adapter/controller/theme-nine-r54-evidence-readonly.mjs'),'\n// changed');
  assert.throws(()=>verifyApproval(f.cwd),/R54_SCORE_ADAPTER_SHA_DENIED/);
 }finally{fs.rmSync(f.cwd,{recursive:true,force:true});}
});

test('verified newest R48 pair replays, R51 double-date is recognized, no PC/D1 writes',async()=>{
 const f=fixture();try{
  const h=harness(f,evidence(f.filename));
  const result=await execute({env:f.env,dataRoot:f.dataRoot,platform:'win32',freeMiB:2395,
   loader:h.loader,fetcher:h.fetcher});
  assert.equal(result.status,'PASS',result.code);
  assert.equal(result.evidence.sourceDate,'2026-10-30');
  assert.equal(result.evidence.r51SavedCount,1);
  assert.deepEqual(h.counts(),{replayCount:1,publishCount:1});
  assert.equal(result.publicBaseGets,1);assert.equal(result.providerCalls,0);
  assert.equal(result.d1Writes,0);assert.equal(result.pcDataWrites,0);
  const stored=fs.readFileSync(path.join(f.cwd,'THEME_R54_SCORE_REPLAY_676.json'),'utf8');
  assert.equal(stored.includes('fixture-token'),false);
  let output='';await upload(f.env,async(_url,opt)=>{output=opt.body;return {ok:true};});
  assert.match(output,/R54_SCORE_REPLAY_ELIGIBLE_IN_MEMORY_NOT_PUBLISHED/);
  assert.doesNotMatch(output,/fixture-token/);
 }finally{fs.rmSync(f.cwd,{recursive:true,force:true});}
});

test('unverified current manifest prevents score replay; exact resource gate',async()=>{
 const f=fixture();try{
  let dirty=evidence(f.filename);dirty.r48.candidates[1].delta.rawStatus='RAW_MISSING';
  dirty.r48.candidates[0].baseline.rawStatus='RAW_MISSING';
  const h=harness(f,dirty);
  const fail=await execute({env:f.env,dataRoot:f.dataRoot,platform:'win32',freeMiB:2395,
   loader:h.loader,fetcher:h.fetcher});
  assert.equal(fail.code,'R54_SCORE_NO_RAW_VERIFIED_CANDIDATE');
  assert.equal(h.counts().replayCount,0);
  assert.equal(fail.d1Writes,0);
 }finally{fs.rmSync(f.cwd,{recursive:true,force:true});}
});

test('workflow uses only bounded existing self-hosted runner with pinned source',()=>{
 const yml=fs.readFileSync(path.join(root,'.github/workflows/pc-theme-r54-score-once.yml'),'utf8');
 assert.match(yml,/timeout-minutes: 4/);assert.match(yml,/issues:\s*\n\s*types: \[opened\]/);
 assert.match(yml,/ref: 5ee597cc6c0da9f38ab54c8aeb46b89f60a1ef36/);
 assert.match(yml,/ref: 77c6cc43a2450f34a7cfe81f39040807e727f1cf/);
 assert.match(yml,/runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
 assert.doesNotMatch(yml,/schtasks|wrangler|node -e|pc-job\s*\n\s*run:/);
});
