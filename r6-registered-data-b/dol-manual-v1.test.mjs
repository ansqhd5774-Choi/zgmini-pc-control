import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authorizeDolManual,performDolManual,DOL_MANUAL_SCHEMA} from './dol-manual-v1.mjs';
import {sanitizeR6BResult} from './report.mjs';

const uid='eacb5f1c-8f44-47f4-8edb-e221a3a02e91';
const chat='72c97d22-8bc5-4c0e-9883-bc81bdb7fb2e';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fileHashes=Object.fromEntries([
 'lib/market-score/employment-r6-provider.mjs',
 'lib/market-score/employment-r6-collector.mjs',
 'lib/market-score/employment-r6-scheduler.mjs'].map((p,i)=>[p,String(i+1).repeat(64)]));
const approval={
 schema:DOL_MANUAL_SCHEMA,status:'APPROVED_B',
 scope:'EMPLOYMENT_R6_DOL_MANUAL_SQLITE_ONCE',mode:'ONE_YEAR',
 sourceRepository:'ansqhd5774-Choi/zgmini',
 installedSourceSha:'a'.repeat(40),
 sourceRoot:'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release',
 pcHome:'E:\\ZGmini\\data\\pc-writer',
 groupName:'DOL_UI_WEEKLY_CLAIMS',maxDolCalls:2,
 fileHashes,
 effects:{dolProviderCalls:true,sqliteWrites:true,rawSnapshotReadback:true,
  blsProviderCalls:false,d1Writes:false,taskWrites:false,sourceWrites:false},
};
function fixture(manifest=approval,changes={}){
 const approvalBytes=Buffer.from(JSON.stringify(manifest));
 const request={schema:'ZGMINI_R6_REGISTERED_DATA_B_REQUEST_V1',
  requestId:uid,chatId:chat,operation:'employment-r6-registered-data-once',
  approvalManifestSha256:sha(approvalBytes)};
 const event={action:'opened',
  repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
  sender:{login:'ansqhd5774-Choi'},
  issue:{title:'pc-employment-r6-registered-data-once',
   user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
   number:42,body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'b'.repeat(40)};
 return {event:{...event,...changes.event},env:{...env,...changes.env},
  approvalBytes,request};
}
test('manual DOL V1 exact owner, hashes and no BLS, D1, task effects',()=>{
 const input=fixture(),auth=authorizeDolManual(input);
 assert.equal(auth.approval.mode,'ONE_YEAR');
 assert.equal(auth.approval.maxDolCalls,2);
 assert.equal(Object.keys(auth.approval.fileHashes).length,3);
 for(const tweak of [
  a=>{a.groupName='BLS_JOLTS';},
  a=>{a.maxDolCalls=3;},
  a=>{a.effects.d1Writes=true;},
  a=>{a.effects.blsProviderCalls=true;},
  a=>{a.effects.taskWrites=true;},
  a=>{a.fileHashes['scripts/pc-writer/local-cycle.mjs']='b'.repeat(64);},
  a=>{a.installedSourceSha='NOT_SHA';},
  a=>{a.mode='RELEASE';},
 ]) {
  const bad=structuredClone(approval);tweak(bad);
  assert.throws(()=>authorizeDolManual(fixture(bad)),/R6_DOL_(SCOPE|FILE_SCOPE|EFFECT_SCOPE)_STOP/);
 }
 assert.throws(()=>authorizeDolManual(fixture(approval,{env:{GITHUB_RUN_ATTEMPT:'2'}})),
  /R6_DOL_OWNER_EVENT_STOP/);
 const badHash=fixture();badHash.approvalBytes=Buffer.from('{"fake":true}');
 assert.throws(()=>authorizeDolManual(badHash),/R6_DOL_APPROVAL_HASH_STOP/);
});
function inject({sourceError=null,runError=null,releaseFails=false}={}){
 const calls=[],lock={held:()=>true,release:()=>{calls.push('UNLOCK');return !releaseFails;}};
 return {calls,verify:()=>{calls.push('VERIFY');if(sourceError)throw sourceError;},
  acquire:async()=>{calls.push('LOCK');return lock;},
  claim:()=>calls.push('CLAIM'),
  run:async()=>{calls.push('RUN');if(runError)throw runError;
   return {status:'PARTIAL',code:'R6_DOL_MANUAL_PARTIAL',
    providerRequests:2,blsRequests:0,dolRequests:2,
    groupResults:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'PARTIAL',
     providerRequests:2,failureCode:'DOL_NATIONAL_SERIES_INCOMPLETE'}],
    sqlite:'COLLECTOR_RECORDED',publication:'NOT_ATTEMPTED',
    nationalSeriesSaved:3,nationalRowsSaved:3,stateRowsSaved:51};},
 };
}
test('one-shot manual DOL runs after exact source and durable claim, then unlocks',async()=>{
 const input=fixture(),auth=authorizeDolManual(input);
 const o=inject(),r=await performDolManual({auth,...o});
 assert.deepEqual(o.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
 assert.equal(r.status,'PARTIAL');
 assert.equal(r.lastPass,'COLLECT_READBACK');
 assert.equal(r.providerRequests,2);
 assert.equal(r.nationalSeriesSaved,3);
});
test('preflight source mismatch prevents claim, DB and provider; no retry',async()=>{
 const auth=authorizeDolManual(fixture());
 const o=inject({sourceError:Object.assign(Error('source'),{code:'R6_B_INSTALLED_SOURCE_STOP'})});
 const r=await performDolManual({auth,...o});
 assert.deepEqual(o.calls,['VERIFY']);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.firstFail,'PREFLIGHT');
});
test('after claim failure remains STATE_UNKNOWN, not a fake collection success',async()=>{
 const auth=authorizeDolManual(fixture());
 const o=inject({runError:Object.assign(Error('fault'),{code:'R6_DOL_READBACK_INVALID'})});
 const r=await performDolManual({auth,...o});
 assert.deepEqual(o.calls,['VERIFY','LOCK','CLAIM','RUN','UNLOCK']);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R6_DOL_READBACK_INVALID');
});
test('lock ownership uncertainty preserves lock and never asserts success',async()=>{
 const auth=authorizeDolManual(fixture());
 const o=inject({releaseFails:true});
 const r=await performDolManual({auth,...o});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'R6_DOL_LOCK_RELEASE_UNVERIFIED');
});
test('sanitized manual 3-of-4 output retains only bounded counts, no raw',()=>{
 const {request}=fixture();
 const input={
  status:'PARTIAL',code:'R6_DOL_MANUAL_PARTIAL',requestId:uid,
  sourceSha:'a'.repeat(40),mode:'ONE_YEAR',providerRequests:2,
  blsRequests:0,dolRequests:2,
  groupResults:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'PARTIAL',
   providerRequests:2,failureCode:'DOL_NATIONAL_SERIES_INCOMPLETE'}],
  sqlite:'COLLECTOR_RECORDED',publication:'NOT_ATTEMPTED',
  sourceStoredAt:null,sourceFeatures:null,chartReadyFeatures:null,
  nationalSeriesSaved:3,nationalRowsSaved:3,stateRowsSaved:51,
  providerBody:'NO_PRIVATE_DATA_IN_REPORT',
  lastPass:'COLLECT_READBACK',firstFail:null,
 };
 const env={GITHUB_RUN_ID:'43800000000',R6_B_EFFECT_OUTCOME:'success'};
 const out=sanitizeR6BResult(input,request,env);
 assert.equal(out.status,'PARTIAL');
 assert.equal(out.nationalSeriesSaved,3);
 assert.equal(out.stateRowsSaved,51);
 assert.equal(out.publication,'NOT_ATTEMPTED');
 assert.doesNotMatch(JSON.stringify(out),/NO_PRIVATE_DATA_IN_REPORT|providerBody/);
 for(const change of [
  {...input,blsRequests:1},
  {...input,providerRequests:3},
  {...input,groupResults:[]},
  {...input,publication:'VERIFIED'},
  {...input,nationalSeriesSaved:8},
  {...input,code:'R6_B_PARTIAL_PUBLISH_VERIFIED'},
 ])assert.equal(sanitizeR6BResult(change,request,env).status,'STATE_UNKNOWN');
 const badEnv={...env,R6_B_EFFECT_OUTCOME:'failure'};
 assert.equal(sanitizeR6BResult(input,request,badEnv).status,'STATE_UNKNOWN');
});
