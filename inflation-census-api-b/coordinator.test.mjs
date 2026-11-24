import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {
 CENSUS_B_REPO,CENSUS_B_TITLE,CENSUS_B_SCHEMA,CENSUS_B_APPROVAL_SCHEMA,
 CENSUS_B_SCOPE,CENSUS_B_DATA_ROOT,CENSUS_B_SOURCE_ROOT,CENSUS_B_CORE_LOCK,
 CENSUS_B_WRITER_LOCK,CENSUS_B_ENDPOINT,CENSUS_B_TARGET,CENSUS_B_SOURCE_FILES,
 censusBDigest,authorizeCensusB
} from './contract.mjs';
import {performCensusApiB,verifyCensusBPreimage,
 verifyCensusBCollectorResult} from './coordinator.mjs';
const SOURCE='a'.repeat(40),INSTALLED='b'.repeat(40),DIGEST='c'.repeat(64);
const files=()=>Object.fromEntries(CENSUS_B_SOURCE_FILES.map(x=>[x,DIGEST]));
function approval(){
 return {schema:CENSUS_B_APPROVAL_SCHEMA,status:'APPROVED_B',scope:CENSUS_B_SCOPE,
  operation:CENSUS_B_TITLE,controlSourceSha:SOURCE,installedSourceSha:INSTALLED,
  sourceRoot:CENSUS_B_SOURCE_ROOT,dataRoot:CENSUS_B_DATA_ROOT,
  coreLock:CENSUS_B_CORE_LOCK,writerLock:CENSUS_B_WRITER_LOCK,
  sourceFilesSha256:files(),providerEndpoint:CENSUS_B_ENDPOINT,
  selector:'MTM/TI/SA/US',targetFile:CENSUS_B_TARGET,
  maxProviderGets:2,maxRawArchives:2,maxOutputFiles:1,maxBackupFiles:1,
  coreLeaseMode:'EXCLUSIVE_EXISTING_LOCAL_CYCLE_LOCK_VERIFIED_OWNER',
  allowQuotaLedgerWrites:true,allowProviderCalls:true,allowDatabaseWrites:false,
  allowD1Writes:false,allowSourceChanges:false,allowTaskChanges:false,
  allowScheduleChanges:false,allowOtherWrites:false};
}
function proof(){
 const m=approval(),bytes=Buffer.from(JSON.stringify(m));
 const req={schema:CENSUS_B_SCHEMA,requestId:randomUUID(),chatId:randomUUID(),
  operation:CENSUS_B_TITLE,controlRepository:CENSUS_B_REPO,
  approvalManifestPath:'approvals/inflation-census-api-b/w01-once.json',
  approvalManifestSha256:censusBDigest(bytes)};
 const env={GITHUB_REPOSITORY:CENSUS_B_REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:SOURCE};
 const event={action:'opened',repository:{private:true,full_name:CENSUS_B_REPO},
  sender:{login:'ansqhd5774-Choi'},
  issue:{number:1789,title:CENSUS_B_TITLE,user:{login:'ansqhd5774-Choi'},
   labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(req)}};
 return authorizeCensusB({event,env,manifestBytes:bytes});
}
const preimage=()=>({sourceHead:INSTALLED,configSource:INSTALLED,
 sourceRoot:CENSUS_B_SOURCE_ROOT,dataRoot:CENSUS_B_DATA_ROOT,
 coreLock:CENSUS_B_CORE_LOCK,writerLock:CENSUS_B_WRITER_LOCK,
 sourceClean:true,writerLeaseOwned:true,coreTaskEnabled:true,
 sourceFilesSha256:files()});
const fetched=()=>({status:'COMPLETE',providerRequests:2,
 completed:[{group:'census',ids:[28],status:'SAVED_READBACK',providerRequests:2}],
 failed:[],skipped:[]});
function io(overrides={}){
 const calls=[],api={
  proveLiveCoreLockOwner:async()=>calls.push('core-owner'),
  acquireSharedWriterLease:async()=>calls.push('writer-acquire'),
  readPcPreimage:async()=>{calls.push('preimage');return preimage();},
  preflightProviderReadOnly:async()=>calls.push('provider-preflight'),
  assertCoreIdle:async()=>calls.push('idle'),
  acquireCoreLease:async()=>calls.push('core-acquire'),
  verifyCoreLease:async()=>calls.push('core-verify'),
  claimOnce:async()=>calls.push('claim'),
  journalPhase:async p=>calls.push('journal:'+p),
  collectAndReadback:async()=>{calls.push('collect');return fetched();},
  verifySavedReadback:async()=>calls.push('readback'),
  releaseCoreLease:async()=>calls.push('core-release'),
  releaseSharedWriterLease:async ({retain})=>calls.push('writer-release:'+retain),
 };
 return {calls,api:{...api,...overrides}};
}
test('approved Census request executes only after live Core owner, shared lock, source and exclusive Core lease',async()=>{
 const {calls,api}=io();const r=await performCensusApiB(proof(),api);
 assert.equal(r.status,'PASS');
 assert.equal(r.providerCalls,2);
 assert.equal(r.stored,'SAVED_READBACK');
 assert.deepEqual(calls,['core-owner','writer-acquire','preimage','provider-preflight','idle',
  'core-acquire','core-verify','preimage','claim','journal:CLAIMED',
  'collect','core-verify','readback','journal:COMPLETED',
  'core-release','writer-release:false']);
});
test('untrusted proof never reaches IO',async()=>{
 const {calls,api}=io();
 await assert.rejects(()=>performCensusApiB({manifest:approval(),request:{}},api),
  /PROOF_REQUIRED/);
 assert.deepEqual(calls,[]);
});
test('owner proof failure never acquires shared Writer lock or claims request',async()=>{
 const {calls,api}=io({proveLiveCoreLockOwner:async()=>{throw Error('task owner unknown');}});
 const r=await performCensusApiB(proof(),api);
 assert.equal(r.status,'STOP');
 assert.equal(r.providerCalls,0);
 assert.deepEqual(calls,[]);
});
test('source drift preserves data and releases only owned shared lock',async()=>{
 const {calls,api}=io({readPcPreimage:async()=>({...preimage(),sourceHead:'e'.repeat(40)})});
 const r=await performCensusApiB(proof(),api);
 assert.equal(r.status,'STOP');
 assert.equal(r.code,'W01_CENSUS_B_SOURCE_PREIMAGE_STOP');
 assert.deepEqual(calls,['core-owner','writer-acquire','writer-release:false']);
});
test('after claim unknown collector outcome retains shared recovery lock and forbids replay',async()=>{
 const {calls,api}=io({collectAndReadback:async()=>{throw Error('network timeout after GET');}});
 const r=await performCensusApiB(proof(),api);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.providerCalls,null);
 assert.equal(r.replay,'FORBIDDEN');
 assert.ok(calls.includes('journal:RECOVERY_REQUIRED'));
 assert.equal(calls.at(-1),'writer-release:true');
});
test('invalid 3-GET or foreign group cannot be reported as verified Census-only',()=>{
 for(const bad of [
  {...fetched(),providerRequests:3},
  {...fetched(),completed:[{group:'cpi',ids:[22,23],status:'SAVED_READBACK',providerRequests:2}]},
  {...fetched(),failed:[{group:'census',code:'CENSUS_M3_BAD'}]},
 ]){
  assert.throws(()=>verifyCensusBCollectorResult(bad),/COLLECTOR_RESULT_STOP/);
 }
});
test('Core lease release failure downgrades a successful collector to STATE_UNKNOWN and retains Writer lock',async()=>{
 const {calls,api}=io({releaseCoreLease:async()=>{throw Error('foreign owner');}});
 const r=await performCensusApiB(proof(),api);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'W01_CENSUS_B_CORE_RELEASE_UNVERIFIED_STOP');
 assert.equal(r.providerCalls,null);
 assert.equal(calls.at(-1),'writer-release:true');
});
test('preimage requires all four exact approved installed source files',()=>{
 const m=approval(),p=preimage();
 delete p.sourceFilesSha256[CENSUS_B_SOURCE_FILES[0]];
 assert.throws(()=>verifyCensusBPreimage(m,p),/SOURCE_PREIMAGE_STOP/);
});


test('Core busy denies cleanly before one-shot claim and releases Writer',async()=>{
 const {calls,api}=io({acquireCoreLease:async()=>{
  throw Object.assign(Error('occupied'),{code:'W01_CENSUS_B_CORE_LEASE_BUSY_STOP'});
 }});
 const r=await performCensusApiB(proof(),api);
 assert.equal(r.status,'STOP');
 assert.equal(r.code,'W01_CENSUS_B_CORE_LEASE_BUSY_STOP');
 assert.equal(r.providerCalls,0);
 assert.equal(calls.at(-1),'writer-release:false');
 assert.ok(!calls.includes('claim'));
});

test('ambiguous Core lease setup retains Writer for original recovery owner',async()=>{
 const {calls,api}=io({acquireCoreLease:async()=>{throw Error('unknown half-created lease');}});
 const r=await performCensusApiB(proof(),api);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.providerCalls,0);
 assert.equal(calls.at(-1),'writer-release:true');
});

test('failed completion journal keeps original recovery owner and never emits PASS',async()=>{
 const {calls,api}=io({journalPhase:async phase=>{
  calls.push('journal:'+phase);
  if(phase==='COMPLETED')throw Error('ledger inaccessible');
 }});
 const r=await performCensusApiB(proof(),api);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.providerCalls,null);
 assert.equal(calls.at(-1),'writer-release:true');
});

test('native B interface shares exact Core owner verifier and never creates Task',async()=>{
 const fs=await import('node:fs');
 const path=await import('node:path');
 const root=path.resolve(import.meta.dirname,'..');
 const code=fs.readFileSync(path.join(root,'inflation-census-api-b','windows-adapter.mjs'),'utf8');
 const workflow=fs.readFileSync(path.join(root,'.github','workflows',
  'pc-writer-b-source-once.yml'),'utf8');
 assert.match(code,/observeLiveCoreLockOwner\(APPROVAL_SCHEMA_V2/);
 assert.match(code,/awaitNaturalCoreIdle/);
 assert.match(code,/acquireInstallLock/);
 assert.match(code,/runInflationCandidateOnce\(\{\s*approved:true/);
 assert.match(code,/groups:\['census'\]/);
 assert.match(code,/mode:'enforce'/);
 assert.match(workflow,/github\.event\.issue\.title == 'w01-census-m3-api-once'/);
 assert.doesNotMatch(code,/\/Create\b|\/Run\b|New-ScheduledTask/);
});

test('Census-specific B natural-owner and idle waits leave time for two official GETs under 12-minute shared job cap',async()=>{
 const fs=await import('node:fs');
 const path=await import('node:path');
 const root=path.resolve(import.meta.dirname,'..');
 const code=fs.readFileSync(path.join(root,'inflation-census-api-b','windows-adapter.mjs'),'utf8');
 const workflow=fs.readFileSync(path.join(root,'.github','workflows','pc-writer-b-source-once.yml'),'utf8');
 assert.match(code,/maxObservationMs:5\*60_000/);
 assert.match(code,/windowMs:3\*60_000/);
 assert.ok(workflow.includes("timeout-minutes: ${{ contains(github.event.issue.labels.*.name, 'pc-writer-b-extended-drain-2400') && 50 || contains(github.event.issue.labels.*.name, 'pc-writer-b-extended-drain-1200') && 30 || 12 }}"));
 assert.doesNotMatch(workflow,/^\s*timeout-minutes:\s*(?:30|50)\s*$/m);
 assert.ok(5*60_000+3*60_000+2*20_000<12*60_000);
});

test('Census raw provenance pins exact saved document hashes, never a different valid archive',async()=>{
 const {verifyCensusDocumentProvenance}=await import('./windows-adapter.mjs');
 const a='a'.repeat(64),b='b'.repeat(64);
 const name=y=>`census-m3-mtm-${y}-${y===2025?a:b}.json`;
 const doc={provenance:[
  {year:2025,sourceSha256:a,archive:'raw/'+name(2025)},
  {year:2026,sourceSha256:b,archive:'raw/'+name(2026)}]};
 const read=n=>new Map([[name(2025),a],[name(2026),b]]).get(n)??null;
 assert.equal(verifyCensusDocumentProvenance(doc,read),true);
 assert.throws(()=>verifyCensusDocumentProvenance(doc,n=>n===name(2025)?b:read(n)),
  /W01_CENSUS_B_PROVENANCE_SHA_STOP/);
 assert.throws(()=>verifyCensusDocumentProvenance(doc,()=>null),
  /W01_CENSUS_B_PROVENANCE_SHA_STOP/);
 assert.throws(()=>verifyCensusDocumentProvenance({
  provenance:[doc.provenance[0],{...doc.provenance[0]}]},read),
  /W01_CENSUS_B_PROVENANCE_SHAPE_STOP/);
 assert.throws(()=>verifyCensusDocumentProvenance({
  provenance:[{...doc.provenance[0],archive:'raw/something-else.json'},
   doc.provenance[1]]},read),
  /W01_CENSUS_B_PROVENANCE_PATH_STOP/);
 assert.throws(()=>verifyCensusDocumentProvenance({...doc,provenance:[]},read),
  /W01_CENSUS_B_PROVENANCE_SHAPE_STOP/);
});

test('Census key absence terminates before Core lease, journal claim and provider GET',async()=>{
 const {calls,api}=io({preflightProviderReadOnly:async()=>{
  throw Object.assign(new Error('key absent'),{
   code:'W01_CENSUS_B_CENSUS_KEY_UNAVAILABLE_STOP'});
 }});
 const out=await performCensusApiB(proof(),api);
 assert.equal(out.status,'STOP');
 assert.equal(out.code,'W01_CENSUS_B_CENSUS_KEY_UNAVAILABLE_STOP');
 assert.equal(out.providerCalls,0);
 assert.deepEqual(calls,['core-owner','writer-acquire','preimage','writer-release:false']);
});
test('Census credential preflight uses pinned local-env and passes only its scoped key',async()=>{
 const fs=await import('node:fs');
 const path=await import('node:path');
 const code=fs.readFileSync(path.join(import.meta.dirname,'windows-adapter.mjs'),'utf8');
 assert.match(code,/async preflightProviderReadOnly\(\)/);
 assert.match(code,/providers\.CENSUS_API_KEY\.trim\(\)\.length>0/);
 assert.match(code,/providerEnv:\{CENSUS_API_KEY:censusKey\}/);
 assert.doesNotMatch(code,/providerEnv:env,quotaFetch/);
});

test('SAVED_READBACK is bound to the Census GET invocation, not a prior valid stored document',async()=>{
 const {verifyCensusBReadbackWindow}=await import('./windows-adapter.mjs');
 const begin=Date.parse('2026-11-17T01:20:00.000Z');
 const end=begin+35_000;
 const testWindow=sourceStoredAt=>verifyCensusBReadbackWindow({
  status:'SAVED_READBACK',sourceStoredAt,startedAt:begin,finishedAt:end});
 assert.equal(testWindow('2026-11-17T01:20:00.000Z'),true);
 assert.equal(testWindow('2026-11-17T01:20:35.000Z'),true);
 assert.throws(()=>testWindow('2026-11-16T01:20:20.000Z'),
  /W01_CENSUS_B_STORED_AT_PREVIOUS_RUN_STOP/);
 assert.throws(()=>testWindow('2026-11-17T01:20:35.001Z'),
  /W01_CENSUS_B_STORED_AT_PREVIOUS_RUN_STOP/);
 assert.throws(()=>testWindow('not-a-date'),/W01_CENSUS_B_STORED_AT_INVALID_STOP/);
 assert.throws(()=>verifyCensusBReadbackWindow({
  status:'SAVED_READBACK',sourceStoredAt:'2026-11-17T01:20:10.000Z',
  startedAt:end,finishedAt:begin}),
  /W01_CENSUS_B_STORED_AT_PREVIOUS_RUN_STOP/);
});
test('UNCHANGED preserves the last-good saved_at without claiming this-run freshness',async()=>{
 const {verifyCensusBReadbackWindow}=await import('./windows-adapter.mjs');
 assert.equal(verifyCensusBReadbackWindow({status:'UNCHANGED',
  sourceStoredAt:'2025-12-01T00:00:00.000Z',startedAt:Date.now(),
  finishedAt:Date.now()+1000}),true);
 assert.throws(()=>verifyCensusBReadbackWindow({
  status:'INVALID',sourceStoredAt:'2026-11-17T00:00:00.000Z',
  startedAt:0,finishedAt:1}),/W01_CENSUS_B_STORED_AT_INVALID_STOP/);
});

test('only the approved Census M3 module is loaded for B instead of six shared dispatcher collectors',async()=>{
 const fs=await import('node:fs');
 const path=await import('node:path');
 const code=fs.readFileSync(path.join(import.meta.dirname,'windows-adapter.mjs'),'utf8');
 const begin=code.indexOf('  async collectAndReadback(){');
 const end=code.indexOf('  async verifySavedReadback(',begin);
 assert.ok(begin>=0&&end>begin);
 const routine=code.slice(begin,end);
 assert.match(routine,/inflation-causal-candidate-census-m3\.mjs/);
 assert.match(routine,/collectCensusM3Inventories==='function'/);
 assert.match(routine,/collectors:\{census:census\.collectCensusM3Inventories\}/);
 assert.match(routine,/groups:\['census'\]/);
 assert.match(routine,/providerEnv:\{CENSUS_API_KEY:censusKey\}/);
 const imports=[...routine.matchAll(/await import\(/g)];
 assert.equal(imports.length,3,'only quota, approved Census module and common dispatcher');
 assert.doesNotMatch(routine,/inflation-causal-candidate-(?:bls3|fed-g17|treasury|eia-gasoline)\.mjs/);
});
