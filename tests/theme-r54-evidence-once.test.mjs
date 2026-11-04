import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execute,upload,validateRequest,verifyApproval,summarizeInspection,
 ADAPTER_REF,REPO,OWNER,TITLE,SCHEMA} from '../r54-evidence-once/entry.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceAdapter=path.resolve(root,'../pc-r54-controller-prototype/controller/theme-nine-r54-evidence-readonly.mjs');
const UUID='00000000-0000-4000-8000-000000000001';
const controlSha='a'.repeat(40);
const request={schema:SCHEMA,operation:'theme-nine-r54-evidence-readonly-once',
 requestId:'pc-theme-r54-evidence-'+UUID,chatId:'chat-'+UUID,
 sourceSha:ADAPTER_REF,controlSha};
const event={action:'opened',repository:{private:true,full_name:REPO},
 issue:{number:543,body:JSON.stringify(request),title:TITLE,user:{login:OWNER},labels:[]}};
const environment=(workspace,e=event)=>{
 const eventFile=path.join(workspace,'event.json');
 fs.writeFileSync(eventFile,JSON.stringify(e));
 return {GITHUB_WORKSPACE:workspace,GITHUB_EVENT_PATH:eventFile,
  GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:OWNER,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_SHA:controlSha,GITHUB_RUN_ID:'321',
  GITHUB_TOKEN:'fixture-only-token'};
};
const fixture=()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r54-once-'));
 for(const rel of ['r54-control','r54-adapter/controller'])
  fs.mkdirSync(path.join(folder,rel),{recursive:true});
 fs.copyFileSync(path.join(root,'THEME_R54_EVIDENCE_B_APPROVAL.json'),
  path.join(folder,'r54-control/THEME_R54_EVIDENCE_B_APPROVAL.json'));
 fs.copyFileSync(sourceAdapter,
  path.join(folder,'r54-adapter/controller/theme-nine-r54-evidence-readonly.mjs'));
 return folder;
};
const sample=()=>({status:'PASS',providerCalls:0,operationalWrites:0,d1Writes:0,
 sqliteOpened:false,r48:{directoryStatus:'INSPECTED',candidates:[
 {date:'2026-10-28',filename:'THEME_NINE_R48_PRIVATE_CANDIDATE_2026-10-28_aaaaaaaaaaaaaaaa.json',
  status:'INSPECTED',expectedBaselineSha256:'a'.repeat(64),
  baseline:{status:'VERIFIED_PREFIX',expectedSha256:'a'.repeat(64),rawStatus:'RAW_VERIFIED',rawVerifiedPages:64},
  delta:{status:'NO_EXACT_PREFIX_MATCH'}},
 {date:'2026-10-30',filename:'THEME_NINE_R48_PRIVATE_CANDIDATE_2026-10-30_bbbbbbbbbbbbbbbb.json',
  status:'INSPECTED',baseline:{status:'VERIFIED_PREFIX'},delta:{status:'VERIFIED_PREFIX'}}]},
 manifests:{baseline:{status:'READY',sha256:'c'.repeat(64),fileCount:64},
  delta:{status:'READY',sha256:'d'.repeat(64),fileCount:9}},
 r51:{directoryStatus:'READY',observedCandidateNames:[]},
 r54:{status:'INSPECTED',logs:[{name:'THEME_NINE_R54_CYCLE_1_2.txt',
  knownError:'THEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT',sourceManifestShaDrift:true,sha256:'e'.repeat(64)}]},
 secretPrice:1234.56,rawProviderToken:'not-for-export'});

test('strict owner/issue/schema and B approval bind the exact immutable adapter bytes',()=>{
 const folder=fixture();
 try{
  const env=environment(folder);
  assert.deepEqual(validateRequest(event,env),request);
  assert.equal(verifyApproval(folder).adapterSha256.length,64);
  for(const change of [
   {user:{login:'untrusted'}},{labels:[{name:'pc-job'}]},
   {body:JSON.stringify({...request,sourceSha:'b'.repeat(40)})},
  ])assert.throws(()=>validateRequest({...event,issue:{...event.issue,...change}},env),
   /R54_ONCE_/);
  fs.appendFileSync(path.join(folder,'r54-adapter/controller/theme-nine-r54-evidence-readonly.mjs'),'\n// tampered\n');
  assert.throws(()=>verifyApproval(folder),/R54_ONCE_ADAPTER_SHA_DENIED/);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('one-shot readback produces bounded metadata, no raw/token or provider writes',async()=>{
 const folder=fixture();
 try{
  const env=environment(folder);
  let used=0;
  const result=await execute({env,platform:'win32',freeMiB:2395,
   loader:async()=>({inspectThemeNineR54Evidence(){used++;return sample();}})});
  assert.equal(result.status,'PASS');assert.equal(used,1);
  assert.equal(result.details.r48.candidates.length,2);
  assert.equal(result.details.r48.candidates[0].baseline.status,'VERIFIED_PREFIX');
  assert.equal(result.providerCalls,0);assert.equal(result.d1Writes,0);
  const stored=fs.readFileSync(path.join(folder,'THEME_R54_EVIDENCE_543.json'),'utf8');
  assert.equal(stored.includes('not-for-export'),false);
  assert.equal(stored.includes('1234.56'),false);
  assert.ok(stored.length<16000);
  let transmitted='';
  await upload(env,async(_url,args)=>{transmitted=args.body;return {ok:true};});
  assert.match(transmitted,/R54_ONCE_EVIDENCE_RETRIEVED_NOT_PUBLISH_APPROVED/);
  assert.doesNotMatch(transmitted,/not-for-export|1234.56/);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('below RAM gate stops before inspecting R54 and yields exact blocked evidence',async()=>{
 const folder=fixture();
 try{
  const env=environment(folder);
  let used=0;
  const result=await execute({env,platform:'win32',freeMiB:1535,
   loader:async()=>({inspectThemeNineR54Evidence(){used++;return sample();}})});
  assert.equal(result.status,'BLOCKED');assert.equal(result.code,'R54_ONCE_RESOURCE_WAIT_MEMORY');
  assert.equal(used,0);
  assert.equal(fs.existsSync(path.join(folder,'THEME_R54_EVIDENCE_543.json')),true);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('separate self-hosted workflow is fixed, one-time, no pc-job and no publisher',()=>{
 const yml=fs.readFileSync(path.join(root,'.github/workflows/pc-theme-r54-evidence-once.yml'),'utf8');
 assert.match(yml,/issues:\s*\n\s*types: \[opened\]/);
 assert.match(yml,/ref: 77c6cc43a2450f34a7cfe81f39040807e727f1cf/);
 assert.match(yml,/github\.event\.issue\.title == 'pc-theme-r54-evidence-readonly-once'/);
 assert.match(yml,/runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
 assert.match(yml,/GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
 assert.match(yml,/entry\.mjs\" --upload/);
 assert.doesNotMatch(yml,/schtasks|wrangler|theme-nine-r54-public-connect|node -e/);
 const summary=summarizeInspection(sample());
 assert.equal(JSON.stringify(summary).includes('not-for-export'),false);
});
