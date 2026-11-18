import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {REPO,TITLE,SCHEMA,RESULT,APPROVAL,authorize,inspect,execute}
 from '../tools/w03-r51-stored-date-readback.mjs';
import {sanitize,asText} from '../tools/w03-r51-stored-date-report.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const approvalSha=()=>sha(fs.readFileSync(path.resolve(
 path.dirname(fileURLToPath(import.meta.url)),'..',APPROVAL)));
function request(){
 const req={schema:SCHEMA,operation:TITLE,
  requestId:'aa4bce8d-e965-40d1-b143-4c2098e3a1bb',
  chatId:'b9ac6013-cd2a-405e-89be-f1a75d2aa592',
  controlRepository:REPO,controlSourceSha:'c'.repeat(40),
  approvalManifestPath:APPROVAL,approvalManifestSha256:approvalSha()};
 const ev={action:'opened',repository:{full_name:REPO,private:true},
  sender:{login:'ansqhd5774-Choi'},issue:{title:TITLE,number:105,
   user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
   body:JSON.stringify(req)}};
 const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:'c'.repeat(40),GITHUB_RUN_ID:'44246123411'};
 return {req,ev,env};
}
function fixture(t,{r51=true}={}){
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'w03-r51-')));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const themes=path.join(root,'themes'),r48=path.join(themes,'legacy-nine-r48-private-candidate'),
  r51dir=path.join(themes,'legacy-nine-r51-private-provisional');
 fs.mkdirSync(r48,{recursive:true});fs.mkdirSync(r51dir,{recursive:true});
 const days=Array.from({length:252},(_,i)=>new Date(
  Date.parse('2026-11-13T00:00:00Z')-(251-i)*86400000).toISOString().slice(0,10));
 const flags={publicationAuthorized:false,upstreamCommercialRightsVerified:false,
  derivedLicenseVerified:false,sourcePriceReconciled:false,
  sourceManifestVerified:false,privateReplayVerified:false};
 const r48data={contract:'THEME_NINE_R48_R47_PRIVATE_R37_CANDIDATE_V1',
  status:'PRIVATE_CANDIDATE_NOT_PUBLISHED',observationDate:'2026-11-13',
  ...flags,privateSecret:'NEVER_UPLOAD_SCORES',ETFPositions:64,uniqueETFs:63};
 const r48bytes=Buffer.from(JSON.stringify(r48data)+'\n');
 const r48path=path.join(r48,'THEME_NINE_R48_PRIVATE_CANDIDATE_2026-11-13_'+
  sha(r48bytes).slice(0,16)+'.json');
 fs.writeFileSync(r48path,r48bytes);
 const stage={...r48data,phase:'PROVISIONAL',sourceStoredAt:null,publishedAt:null,
  themes:Array.from({length:9},(_,i)=>({
   theme:'Private'+i,history:days.map(date=>({date,score:50}))
  })),
  provisional:{points:[{date:'2026-10-27',scores:{'Private0':50}}]},
  provisionalLineage:{source:'EXISTING_PUBLIC_PROVISIONAL_AS_PUBLISHED',
   confirmedCandidateSha256:sha(Buffer.from(JSON.stringify(r48data))),
   latestCandidateSha256:null,publicProvisionalEndDate:'2026-10-27'},
  otherPrivateScores:'NEVER_UPLOAD_SOURCE'};
 const b=Buffer.from(JSON.stringify(stage)+'\n');
 let r51path=null;
 if(r51){r51path=path.join(r51dir,
  'THEME_NINE_R51_PRIVATE_PROVISIONAL_2026-11-13_2026-10-27_'+
  sha(b).slice(0,16)+'.json');fs.writeFileSync(r51path,b)}
 return{root,r48path,r51path,r48dir:r48,r51dir,stage};
}
test('B readback requires fixed manifest raw SHA, issue actor, first attempt',()=>{
 const {req,ev,env}=request();
 assert.deepEqual(authorize(ev,env),req);
 const changes=[
  x=>x.env.GITHUB_RUN_ATTEMPT='2',
  x=>x.env.GITHUB_ACTOR='other',
  x=>x.ev.issue.title='other',
  x=>{x.ev.issue.labels=[]},
  x=>{x.ev.repository.private=false},
  x=>{const j=JSON.parse(x.ev.issue.body);j.approvalManifestSha256='0'.repeat(64);x.ev.issue.body=JSON.stringify(j)},
  x=>{const j=JSON.parse(x.ev.issue.body);j.other='E:/secret';x.ev.issue.body=JSON.stringify(j)}
 ];
 for(const change of changes){const x=request();change(x);
  assert.throws(()=>authorize(x.ev,x.env))}
});
test('missing R51 stage remains explicitly not stored without fake dates',t=>{
 const f=fixture(t,{r51:false});const r=inspect({dataRoot:f.root});
 assert.equal(r.status,'NO_R51_CANDIDATE');
 assert.equal(r.latest,null);
 assert.equal(r.providerCalls,0);
});
test('stored R51 exact parent SHA and legacy provisional older than confirmed is valid',t=>{
 const f=fixture(t);const r=inspect({dataRoot:f.root});
 assert.equal(r.status,'PASS');assert.equal(r.code,'R51_SAVED_R48_SHA_LINK_VERIFIED');
 assert.equal(r.latest.confirmedDate,'2026-11-13');
 assert.equal(r.latest.provisionalEndDate,'2026-10-27');
 assert.equal(r.latest.provisionalMode,'PUBLIC_LEGACY_AS_IS');
 assert.equal(r.latest.confirmedHistoryRows,2268);
 assert.equal(r.latest.parentR48Matched,true);
 const {req,ev,env}=request();
 const observed=execute({event:ev,env,reader:()=>r});
 const clean=sanitize(observed,req,env);
 assert.equal(clean.status,'PASS');
 assert.match(asText(clean),/publicCurrentDateVerified=false/);
 assert.ok(!JSON.stringify(clean).includes('NEVER_UPLOAD'));
});
test('R48 changed/missing parent gives PARTIAL; not a verified R51 source',t=>{
 const f=fixture(t);fs.unlinkSync(f.r48path);
 const r=inspect({dataRoot:f.root});
 assert.equal(r.status,'PARTIAL');assert.equal(r.code,'R51_R48_SOURCE_NOT_FOUND');
 assert.equal(r.latest.parentR48Sha256,null);
});
test('mismatched candidate filename SHA is STOP and raw bytes not returned',t=>{
 const f=fixture(t);fs.appendFileSync(f.r51path,'corruption');
 const r=inspect({dataRoot:f.root});
 assert.equal(r.status,'STOP');assert.equal(r.code,'W03_R51_READBACK_DIGEST_STOP');
 assert.equal(r.latest,null);
});
test('metadata reporter strictly whitelists dates, counts, hashes and no raw scores',t=>{
 const f=fixture(t);const r=inspect({dataRoot:f.root}),{req,env}=request();
 const raw={schema:RESULT,controlSha:env.GITHUB_SHA,requestId:req.requestId,
  status:r.status,code:r.code,metadata:r};
 assert.equal(sanitize(raw,req,env).status,'PASS');
 assert.equal(sanitize({...raw,controlSha:'0'.repeat(40)},req,env).status,'STATE_UNKNOWN');
 assert.equal(sanitize({...raw,metadata:{...r,pcWrites:1}},req,env).status,'STATE_UNKNOWN');
 const injected={...raw,metadata:{...r,latest:{...r.latest,
  leakedPrivatePrice:[1000,2000]}}};
 const out=sanitize(injected,req,env);
 assert.equal(out.status,'PASS');assert.equal(JSON.stringify(out).includes('leakedPrivatePrice'),false);
});
