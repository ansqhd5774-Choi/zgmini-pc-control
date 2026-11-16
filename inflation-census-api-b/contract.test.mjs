import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {
 CENSUS_B_REPO,CENSUS_B_TITLE,CENSUS_B_SCHEMA,CENSUS_B_APPROVAL_SCHEMA,
 CENSUS_B_SCOPE,CENSUS_B_DATA_ROOT,CENSUS_B_SOURCE_ROOT,CENSUS_B_CORE_LOCK,
 CENSUS_B_WRITER_LOCK,CENSUS_B_ENDPOINT,CENSUS_B_TARGET,CENSUS_B_SOURCE_FILES,
 censusBDigest,validateCensusBManifest,authorizeCensusB,assertCensusBAuthorized
} from './contract.mjs';
const S='a'.repeat(40),H='b'.repeat(64);
function manifest(){
 return {schema:CENSUS_B_APPROVAL_SCHEMA,status:'APPROVED_B',
  scope:CENSUS_B_SCOPE,operation:CENSUS_B_TITLE,controlSourceSha:S,
  installedSourceSha:'c'.repeat(40),sourceRoot:CENSUS_B_SOURCE_ROOT,
  dataRoot:CENSUS_B_DATA_ROOT,coreLock:CENSUS_B_CORE_LOCK,
  writerLock:CENSUS_B_WRITER_LOCK,
  sourceFilesSha256:Object.fromEntries(CENSUS_B_SOURCE_FILES.map(x=>[x,H])),
  providerEndpoint:CENSUS_B_ENDPOINT,selector:'MTM/TI/SA/US',
  targetFile:CENSUS_B_TARGET,maxProviderGets:2,maxRawArchives:2,
  maxOutputFiles:1,coreLeaseMode:'EXCLUSIVE_EXISTING_LOCAL_CYCLE_LOCK_VERIFIED_OWNER',
  allowQuotaLedgerWrites:true,allowProviderCalls:true,
  allowDatabaseWrites:false,allowD1Writes:false,allowSourceChanges:false,
  allowTaskChanges:false,allowScheduleChanges:false,allowOtherWrites:false};
}
function fixture(m=manifest()){
 const bytes=Buffer.from(JSON.stringify(m));
 const request={schema:CENSUS_B_SCHEMA,requestId:randomUUID(),chatId:randomUUID(),
  operation:CENSUS_B_TITLE,controlRepository:CENSUS_B_REPO,
  approvalManifestPath:'approvals/inflation-census-api-b/w01-census-m3-once.json',
  approvalManifestSha256:censusBDigest(bytes)};
 const event={action:'opened',repository:{full_name:CENSUS_B_REPO,private:true},
  sender:{login:'ansqhd5774-Choi'},issue:{number:1234,title:CENSUS_B_TITLE,
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
  body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:CENSUS_B_REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:S};
 return {bytes,request,event,env};
}
test('approved frozen Census API scope validates and issues unforgeable receipt',()=>{
 const f=fixture();
 const proof=authorizeCensusB({event:f.event,env:f.env,manifestBytes:f.bytes});
 assert.equal(proof.manifest.maxProviderGets,2);
 assert.equal(proof.manifest.allowD1Writes,false);
 assert.equal(assertCensusBAuthorized(proof),proof);
 assert.throws(()=>assertCensusBAuthorized({...proof}),/PROOF_REQUIRED/);
});
test('default-off and unknown effects are denied',()=>{
 for(const edit of [
  x=>x.status='DRAFT_NOT_APPROVED',
  x=>x.maxProviderGets=3,
  x=>x.maxOutputFiles=2,
  x=>x.allowD1Writes=true,
  x=>x.allowDatabaseWrites=true,
  x=>x.allowOtherWrites=true,
  x=>x.allowSourceChanges=true,
  x=>x.allowTaskChanges=true,
  x=>x.allowScheduleChanges=true,
  x=>x.coreLeaseMode='NONE',
  x=>x.writerLock='C:\\temp\\unknown.lock',
  x=>x.providerEndpoint='https://example.com/fake',
  x=>x.selector='OTHER',
  x=>x.sourceFilesSha256={'scripts/other.mjs':H},
  x=>x.newEffect='unreviewed',
 ]){
  const m=manifest();edit(m);
  assert.throws(()=>validateCensusBManifest(m),/APPROVAL_/);
 }
});
test('exact owner Issue, manifest digest, source pin and request identity required',()=>{
 for(const mutate of [
  x=>x.event.issue.title='pc-writer-source-install',
  x=>x.event.issue.user.login='other',
  x=>x.event.repository.private=false,
  x=>x.event.issue.labels=[],
  x=>x.env.GITHUB_RUN_ATTEMPT='2',
  x=>x.env.GITHUB_SHA='d'.repeat(40),
  x=>x.request.operation='other',
  x=>x.request.requestId='not-a-uuid',
  x=>x.request.approvalManifestPath='../unsafe.json',
  x=>x.request.approvalManifestSha256='e'.repeat(64),
 ]){
  const f=fixture();mutate(f);
  f.event.issue.body=JSON.stringify(f.request);
  assert.throws(()=>authorizeCensusB({
   event:f.event,env:f.env,manifestBytes:f.bytes}),/W01_CENSUS_B_/);
 }
});
test('no raw data, provider credential, or operating writes in approval',()=>{
 const m=manifest();
 assert.deepEqual(Object.keys(m.sourceFilesSha256).sort(),[...CENSUS_B_SOURCE_FILES].sort());
 assert.equal(m.maxProviderGets,2);
 assert.equal(m.maxRawArchives,2);
 for(const k of ['allowDatabaseWrites','allowD1Writes','allowSourceChanges',
  'allowTaskChanges','allowScheduleChanges','allowOtherWrites'])assert.equal(m[k],false);
 assert.ok(!Object.keys(m).some(k=>/key|token|password/i.test(k)));
});
