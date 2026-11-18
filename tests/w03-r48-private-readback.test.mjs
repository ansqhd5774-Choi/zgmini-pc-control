import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {REPO,TITLE,SCHEMA,RESULT,APPROVAL,authorize,inspect,execute}
 from '../tools/w03-r48-private-readback.mjs';
import {sanitize,asText} from '../tools/w03-r48-private-readback-report.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const approvalSha=()=>sha(fs.readFileSync(path.resolve(
 path.dirname(fileURLToPath(import.meta.url)),'..',APPROVAL)));
const req=()=>({schema:SCHEMA,operation:TITLE,
 requestId:'56cf06e8-cd51-4a4d-985d-8d389d62a512',
 chatId:'e12abe4d-5142-45c4-85c8-9c37e412b4d9',
 controlRepository:REPO,controlSourceSha:'b'.repeat(40),
 approvalManifestPath:APPROVAL,approvalManifestSha256:approvalSha()});
function auth(){
 const request=req(),event={action:'opened',repository:{full_name:REPO,private:true},
  sender:{login:'ansqhd5774-Choi'},issue:{number:100,title:TITLE,
   labels:[{name:'pc-writer-b-install'}],user:{login:'ansqhd5774-Choi'},
   body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:'b'.repeat(40),
  GITHUB_RUN_ID:'44223333111'};
 return {request,event,env};
}
function fixture(t,{r48=true}={}){
 const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'w03-r48-readback-')));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const root=path.join(dir,'themes'),p47=path.join(root,'legacy-nine-r47-private'),
 p48=path.join(root,'legacy-nine-r48-private-candidate');
 const bas=path.join(root,'legacy-nine-r23'),delta=path.join(root,'legacy-nine-r35-delta');
 for(const p of [p47,p48,bas,delta])fs.mkdirSync(p,{recursive:true});
 const ba=Buffer.from('{"baseline":"test"}\n'),de=Buffer.from('{"delta":"test"}\n');
 fs.writeFileSync(path.join(bas,'raw-manifest.json'),ba);
 fs.writeFileSync(path.join(delta,'raw-manifest.json'),de);
 const days=Array.from({length:252},(_,i)=>new Date(
  Date.parse('2026-11-13T00:00:00Z')-(251-i)*86400000
 ).toISOString().slice(0,10));
 const source={baselineManifestSha256:sha(ba),deltaManifestSha256:sha(de),
  latestSpySessionDate:'2026-11-13',deltaCompletedWindows:[
   {start:'2026-11-03',end:'2026-11-12',spyDay:'2026-11-12'}]};
 const etf=Buffer.from(JSON.stringify({
  contract:'THEME_NINE_R47_PRIVATE_INCREMENTAL_INDIVIDUAL_V1',
  source,publicationAuthorized:false,historyMarker:'SECRET_SCORE_DO_NOT_UPLOAD'})+'\n');
 const nine=Buffer.from(JSON.stringify({
  contract:'THEME_NINE_R47_PRIVATE_RECURRING_NINE_THEME_SHADOW_V1',
  source,publicationAuthorized:false})+'\n');
 const digest=sha(Buffer.concat([etf,nine])).slice(0,16);
 const first=path.join(p47,'THEME_NINE_R47_PRIVATE_2026-11-13_'+digest+'_ETF.json');
 const second=path.join(p47,'THEME_NINE_R47_PRIVATE_2026-11-13_'+digest+'_NINE.json');
 fs.writeFileSync(first,etf);fs.writeFileSync(second,nine);
 const candidate={contract:'THEME_NINE_R48_R47_PRIVATE_R37_CANDIDATE_V1',
  status:'PRIVATE_CANDIDATE_NOT_PUBLISHED',publicationAuthorized:false,
  upstreamCommercialRightsVerified:false,derivedLicenseVerified:false,
  sourcePriceReconciled:false,sourceManifestVerified:false,
  privateReplayVerified:false,sourcePriceMode:'RAW_UNADJUSTED_1H_NOT_OFFICIAL_CLOSE',
  methodologyVersion:'ETF_ONLY_T40_R20_V40_ADAPTIVE_R2_DATED_ISSUER_AUM_R32',
  rosterSha256:'e2ea97ce0ed0bf15cb083237d63d3cf520e090d8bd229a837bad393c3f8b0c6c',
  phase:'CONFIRMED',sourceStoredAt:null,publishedAt:null,
  observationDate:'2026-11-13',baselineManifestSha256:source.baselineManifestSha256,
  deltaManifestSha256:source.deltaManifestSha256,ETFPositions:64,uniqueETFs:63,
  r25InputSha256:sha(etf),shadowSha256:sha(nine),
  rawManifestSha256:sha(Buffer.from(JSON.stringify({
    baselineManifestSha256:source.baselineManifestSha256,
    deltaManifestSha256:source.deltaManifestSha256,
    deltaCompletedWindows:source.deltaCompletedWindows}))),
  themes:Array.from({length:9},(_,i)=>({
   theme:'Private'+i,score:50,history:days.map(date=>({date,score:50}))
  })),originalRawPricesNotToUpload:'SECRET_RAW_VALUES'};
 let pCandidate=null;
 if(r48){
  const body=Buffer.from(JSON.stringify(candidate)+'\n');
  pCandidate=path.join(p48,'THEME_NINE_R48_PRIVATE_CANDIDATE_2026-11-13_'+
   sha(body).slice(0,16)+'.json');
  fs.writeFileSync(pCandidate,body);
 }
 return {dir,root,p47,p48,bas,delta,first,second,pCandidate,candidate};
}
test('fixed request admits only correct owner, SHA manifest, title and first attempt',()=>{
 const {request,event,env}=auth();
 assert.deepEqual(authorize(event,env),request);
 for(const change of [
  x=>x.env.GITHUB_ACTOR='someone-else',
  x=>x.env.GITHUB_RUN_ATTEMPT='2',
  x=>x.event.issue.title='invalid',
  x=>{x.event.issue.labels=[]},
  x=>{const q=JSON.parse(x.event.issue.body);q.approvalManifestSha256='0'.repeat(64);x.event.issue.body=JSON.stringify(q);},
  x=>{const q=JSON.parse(x.event.issue.body);q.other='E:/secret';x.event.issue.body=JSON.stringify(q);},
  x=>{x.event.repository.private=false},
 ]){const a=auth();change(a);assert.throws(()=>authorize(a.event,a.env));}
});
test('empty R48 candidate is distinct from missing R47 calculation',t=>{
 const x=fixture(t,{r48:false});
 const result=inspect({dataRoot:x.dir});
 assert.equal(result.status,'NO_R48_CANDIDATE');
 assert.equal(result.candidateCount,0);
 assert.equal(result.providerCalls,0);
});
test('actual R48 candidate SHA, R47 ETF/NINE pair, complete 9x252 and current source match',t=>{
 const f=fixture(t);
 const x=inspect({dataRoot:f.dir});
 assert.equal(x.status,'PASS');
 assert.equal(x.code,'R48_CURRENT_PRIVATE_CANDIDATE_SHA_VERIFIED');
 assert.equal(x.candidateCount,1);
 assert.equal(x.latestR47Date,'2026-11-13');
 assert.equal(x.latest.privateHistoryRows,2268);
 assert.equal(x.latest.parentPairMatched,true);
 assert.equal(x.latest.currentSourceManifestMatched,true);
 assert.equal(x.latest.latestR47DateMatched,true);
 const {request,event,env}=auth();
 const out=sanitize(execute({event,env,reader:()=>x}),request,env);
 assert.equal(out.status,'PASS');
 assert.equal(out.latest.r47EtfSha256,sha(fs.readFileSync(f.first)));
 assert.equal(out.latest.r47NineSha256,sha(fs.readFileSync(f.second)));
 assert.ok(!JSON.stringify(out).includes('SECRET_'));
 assert.match(asText(out),/providerCalls=0/);
});
test('existing R48 is stale after current R35 manifest changed',t=>{
 const f=fixture(t);
 fs.writeFileSync(path.join(f.delta,'raw-manifest.json'),'{"delta":"new"}\n');
 const x=inspect({dataRoot:f.dir});
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.code,'R48_SOURCE_MANIFEST_CHANGED');
 assert.equal(x.latest.currentSourceManifestMatched,false);
});
test('missing R47 NINE source never validates R48 parent',t=>{
 const f=fixture(t);
 fs.unlinkSync(f.second);
 const x=inspect({dataRoot:f.dir});
 assert.equal(x.status,'STOP');
 assert.equal(x.code,'W03_R48_READBACK_UNEXPECTED_STOP');
});
test('candidate filename SHA and R48 theme history must be complete',t=>{
 const f=fixture(t);
 fs.appendFileSync(f.pCandidate,'x');
 const x=inspect({dataRoot:f.dir});
 assert.equal(x.status,'STOP');
 assert.equal(x.code,'W03_R48_READBACK_INPUT_OR_CONTRACT_STOP');
});
test('redacted result is always exactly whitelisted and never leaks source values',t=>{
 const f=fixture(t),x=inspect({dataRoot:f.dir});
 const {request,env}=auth();
 const base={schema:RESULT,requestId:request.requestId,
  controlSha:env.GITHUB_SHA,status:x.status,code:x.code,details:x};
 assert.equal(sanitize(base,request,env).status,'PASS');
 assert.equal(sanitize({...base,controlSha:'0'.repeat(40)},request,env).status,'STATE_UNKNOWN');
 assert.equal(sanitize({...base,details:{...x,d1Writes:1}},request,env).status,'STATE_UNKNOWN');
 const evil={...base,details:{...x,latest:{...x.latest,hiddenScore:1234}}};
 assert.equal(sanitize(evil,request,env).status,'PASS');
 assert.equal(JSON.stringify(sanitize(evil,request,env)).includes('hiddenScore'),false);
});
