import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,SCHEMA,TITLE,OUTPUT,
 SAVED_SCHEMA,APPROVED_SAVED_SOURCE_SHA}
 from '../tools/w03-gmh-seven-private-score-once.mjs';
import {APPROVED_SOURCE_SHA,REPO}
 from '../tools/w03-gmh-seven-manual-once.mjs';
import {launchSavedScore,verifySavedCandidate}
 from '../tools/w03-gmh-seven-saved-score-v2.mjs';
import {sanitize}
 from '../tools/w03-gmh-seven-private-score-report.mjs';

const SOURCE='9'.repeat(40),ID='e80ffcc1-45b6-4e2f-aed7-56422097435f';
const request=(schema=SAVED_SCHEMA)=>({
 schema,operation:TITLE,requestId:ID,
 chatId:'a6fbf1e3-c14d-4f15-bf1a-4ce7738016e2',
 controlRepository:REPO,controlSourceSha:SOURCE,
 candidateSourceSha:schema===SCHEMA?APPROVED_SOURCE_SHA:APPROVED_SAVED_SOURCE_SHA
});
const event=req=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},
 issue:{number:4321,title:TITLE,user:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(req)}});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:SOURCE,GITHUB_RUN_ID:'43210'});
const child=()=>({schema:'ZGMINI_W03_GMH_SEVEN_PC_PARITY_V1',
 status:'PRIVATE_GMH_7X252_PARITY_VERIFIED_NOT_PUBLISHED',
 sourceProvider:'GETMARKETHISTORY_1H_PRIVATE',
 observationDate:'2026-11-13',
 commonSessionCount:679,historyPoints:1764,rawPagesVerified:14,
 rawManifestSha256:'a'.repeat(64),
 checkpointSha256:'b'.repeat(64),
 privateArtifactSha256:'c'.repeat(64),localSaved:true,
 providerCalls:0,d1Writes:0,publicWrites:0,schedulerWrites:0,
 publicationAuthorized:false,upstreamCommercialRightsVerified:false,
 derivedLicenseVerified:false});
const launch=data=>launchSavedScore('/approved/pc-parity.mjs',{
 platform:'win32',fileExists:()=>true,
 spawn:()=>({status:0,stdout:JSON.stringify(data)})});
function signedRaw(raw,req){
 return {schema:OUTPUT,...raw,requestId:req.requestId,
  sourceCommit:req.candidateSourceSha,controlSha:SOURCE,
  runId:'43210',providerCalls:0,d1Writes:0,publicWrites:0,
  taskChanges:0,rawBarExposure:false,retry:'NO_AUTOMATIC_REEXECUTION'};
}
test('old private V1 title, source and request schema remain strictly accepted',()=>{
 for(const s of [SCHEMA,SAVED_SCHEMA]){
  const req=request(s);
  assert.equal(authorize(event(req),env()).candidateSourceSha,
   req.candidateSourceSha);
 }
 assert.throws(()=>authorize(event({...request(),candidateSourceSha:
  APPROVED_SOURCE_SHA}),env()),{code:'W03_GMH_SCORE_REQUEST_STOP'});
 assert.throws(()=>authorize(event({...request(SCHEMA),candidateSourceSha:
  APPROVED_SAVED_SOURCE_SHA}),env()),{code:'W03_GMH_SCORE_REQUEST_STOP'});
 assert.throws(()=>authorize(event({...request(),extra:true}),env()),
  {code:'W03_GMH_SCORE_REQUEST_STOP'});
});
test('V2 permits only truly saved 14x628/7x252 with SHA, zero public effects',()=>{
 const req=request();
 const actual=launch(child());
 assert.equal(actual.status,'PASS');
 assert.equal(actual.code,'W03_GMH_SCORE_SAVED_7X252_VERIFIED');
 assert.equal(actual.rawPagesVerified,14);
 const out=sanitize(signedRaw(actual,req),req,env());
 assert.equal(out.status,'PASS');
 assert.equal(out.sourceCommit,APPROVED_SAVED_SOURCE_SHA);
 assert.equal(out.privateArtifactSha256,'c'.repeat(64));
 assert.equal(out.checkpointSha256,'b'.repeat(64));
 assert.equal(out.rawPagesVerified,14);
 assert.equal(out.localSaved,true);
 assert.equal(out.providerCalls,0);
 assert.equal(out.d1Writes,0);
 assert.ok(!JSON.stringify(out).includes('/approved/'));
});
test('no saved artifact, invalid source, missing SHA, or publication rights reject V2',()=>{
 const req=request();
 for(const patch of [
  {localSaved:false},{rawPagesVerified:13},{historyPoints:252},
  {providerCalls:1},{d1Writes:1},{publicWrites:1},
  {publicationAuthorized:true},{upstreamCommercialRightsVerified:true},
  {derivedLicenseVerified:true},{checkpointSha256:'INVALID'},
  {rawManifestSha256:'INVALID'},{privateArtifactSha256:'INVALID'}
 ]){
  const output=launch({...child(),...patch});
  assert.equal(output.status,'STOP',JSON.stringify(patch));
 }
 const raw=signedRaw(launch(child()),req);
 for(const patch of [
  {sourceCommit:APPROVED_SOURCE_SHA},{rawBarExposure:true},
  {localSaved:false},{rawPagesVerified:257},{checkpointSha256:'BAD'},
  {privateArtifactSha256:'BAD'},{providerCalls:2},{d1Writes:1}
 ])assert.equal(sanitize({...raw,...patch},req,env()).status,
  'STATE_UNKNOWN',JSON.stringify(patch));
});
test('existing checkout helper rejects unpinned HEAD and mutated source files',()=>{
 const reqRoot='/fixed/test';
 const bogusFile=Buffer.from('UNTRUSTED');
 const fakeStat={isFile:()=>true,isSymbolicLink:()=>false,
  size:bogusFile.length,mtimeMs:1};
 const files={realpathSync:{native:x=>x},
  lstatSync:()=>fakeStat,readFileSync:()=>bogusFile};
 assert.throws(()=>verifySavedCandidate({sourceRoot:reqRoot,
  platform:'win32',head:()=>APPROVED_SOURCE_SHA,files}),
  {code:'W03_GMH_SCORE_V2_PINNED_SOURCE_STOP'});
 assert.throws(()=>verifySavedCandidate({sourceRoot:reqRoot,
  platform:'win32',head:()=>APPROVED_SAVED_SOURCE_SHA,files}),
  {code:'W03_GMH_SCORE_V2_SOURCE_BLOB_DRIFT'});
});
