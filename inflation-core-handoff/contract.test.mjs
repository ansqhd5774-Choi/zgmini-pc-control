import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 CORE_HANDOFF_REQUEST_SCHEMA,CORE_HANDOFF_APPROVAL_SCHEMA,
 CORE_HANDOFF_ISSUE_TITLE,CORE_HANDOFF_ISSUE_LABEL,
 CORE_HANDOFF_OPERATION,CORE_HANDOFF_MODE,CORE_HANDOFF_DELIVERY,
 CORE_HANDOFF_SOURCE_FILES,authorizeCoreOwnedHandoff,
 assertAuthenticatedCoreHandoff,projectCoreOwnedTransactionApproval,
} from './contract.mjs';
import {
 CONTROL_REPO,OWNER,SCOPE,SOURCE_ROOT,DATA_ROOT,URLS,TARGETS,MAX_BYTES,
} from '../inflation-manual-b/contract.mjs';

const uuid='c131d4c4-b788-4a1c-9f60-146dd6f7abb1';
const env=()=>({GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:OWNER,GITHUB_RUN_ATTEMPT:'1',
 GITHUB_SHA:'b'.repeat(40)});
const hash=b=>createHash('sha256').update(b).digest('hex');
const approval=()=>({
 schema:CORE_HANDOFF_APPROVAL_SCHEMA,status:'APPROVED_B',
 scope:SCOPE,sourceRoot:SOURCE_ROOT,dataRoot:DATA_ROOT,
 coreExecution:CORE_HANDOFF_MODE,delivery:CORE_HANDOFF_DELIVERY,
 runCount:1,sourceSha:'a'.repeat(40),
 sourceFiles:CORE_HANDOFF_SOURCE_FILES.map(path=>({path,sha256:'b'.repeat(64)})),
 providerUrls:URLS,targetFiles:TARGETS,maxBytes:MAX_BYTES,timeoutMs:40_000,
 allowDbWrites:false,allowD1Writes:false,allowTaskChanges:false,
 allowSourceChanges:false,allowOtherWrites:false,
});
const fixture=(manifest=approval())=>{
 const manifestBytes=Buffer.from(JSON.stringify(manifest));
 const req={schema:CORE_HANDOFF_REQUEST_SCHEMA,requestId:uuid,chatId:uuid,
  operation:CORE_HANDOFF_OPERATION,controlRepository:CONTROL_REPO,
  approvalManifestPath:'approvals/inflation-core-handoff/w01-exact-v3.json',
  approvalManifestSha256:hash(manifestBytes)};
 const event={action:'opened',repository:{full_name:CONTROL_REPO,private:true},
  sender:{login:OWNER},issue:{number:100,user:{login:OWNER},
   title:CORE_HANDOFF_ISSUE_TITLE,labels:[{name:CORE_HANDOFF_ISSUE_LABEL}],
   body:JSON.stringify(req)}};
 return {env:env(),event,manifestBytes,req};
};
test('V3 authorizes a correctly hashed exact-effect owner Issue without IO',()=>{
 const data=fixture();
 const auth=authorizeCoreOwnedHandoff(data);
 assert.equal(assertAuthenticatedCoreHandoff(auth),auth);
 assert.equal(auth.manifest.coreExecution,CORE_HANDOFF_MODE);
 assert.equal(auth.request.requestId,uuid);
});
test('V2 external B manifest cannot silently become Core-owned authority',()=>{
 const m=approval();m.schema='ZGMINI_INFLATION_OFFICIAL_MANUAL_B_APPROVAL_V2';
 assert.throws(()=>authorizeCoreOwnedHandoff(fixture(m)),
  {code:'INFL_CORE_HANDOFF_MANIFEST_EFFECT_STOP'});
});
test('manifest missing explicit Core execution or changing effects is rejected',()=>{
 for(const changes of [{coreExecution:'EXCLUSIVE_EXISTING_LOCAL_CYCLE_LOCK'},
  {delivery:'PLAIN_JSON_PENDING_FILE'},{allowTaskChanges:true},
  {allowSourceChanges:true},{runCount:2},{allowD1Writes:true}]){
  assert.throws(()=>authorizeCoreOwnedHandoff(fixture({...approval(),...changes})),
   {code:'INFL_CORE_HANDOFF_MANIFEST_EFFECT_STOP'});
 }
});
test('missing extra module hash or added unrelated file cannot be authorized',()=>{
 const m=approval();m.sourceFiles.pop();
 assert.throws(()=>authorizeCoreOwnedHandoff(fixture(m)),
  {code:'INFL_CORE_HANDOFF_SOURCE_CLOSURE_STOP'});
 const n=approval();n.sourceFiles[1].path='scripts/pc-writer/unapproved.mjs';
 assert.throws(()=>authorizeCoreOwnedHandoff(fixture(n)),
  {code:'INFL_CORE_HANDOFF_SOURCE_CLOSURE_STOP'});
});
test('Issue signature and pinned original bytes must match',()=>{
 const d=fixture();d.event.sender.login='attacker';
 assert.throws(()=>authorizeCoreOwnedHandoff(d),
  {code:'INFL_CORE_HANDOFF_EVENT_AUTH_STOP'});
 const h=fixture();h.manifestBytes=Buffer.from(h.manifestBytes.toString().replace('APPROVED_B','PENDING___'));
 assert.throws(()=>authorizeCoreOwnedHandoff(h),
  {code:'INFL_CORE_HANDOFF_MANIFEST_HASH_STOP'});
});
test('no JSON clone, approval-looking object or old Issue passes the branded auth boundary',()=>{
 const d=fixture();const auth=authorizeCoreOwnedHandoff(d);
 assert.throws(()=>assertAuthenticatedCoreHandoff({...auth}),
  {code:'INFL_CORE_HANDOFF_AUTH_OBJECT_STOP'});
 assert.throws(()=>assertAuthenticatedCoreHandoff({manifest:approval(),request:d.req}),
  {code:'INFL_CORE_HANDOFF_AUTH_OBJECT_STOP'});
 const old=fixture();old.event.issue.title='pc-inflation-official-manual-once';
 assert.throws(()=>authorizeCoreOwnedHandoff(old),
  {code:'INFL_CORE_HANDOFF_EVENT_AUTH_STOP'});
});

test('V3 projects exact coordinator effect only from verified branded authority',()=>{
 const approved=authorizeCoreOwnedHandoff(fixture());
 const projected=projectCoreOwnedTransactionApproval(approved);
 assert.equal(projected.requestId,uuid);
 assert.equal(projected.status,'APPROVED_B');
 assert.equal(projected.coreExecution,'CURRENT_CORE_OWNED_LOCK');
 assert.equal(projected.exactOfficialSources,true);
 assert.equal(projected.exactTwoTargets,true);
 assert.equal(projected.dbWrites,false);
 assert.equal(projected.d1Writes,false);
 assert.equal(projected.taskChanges,false);
 assert.equal(projected.sourceChanges,false);
 assert.equal(projected.manifestSha256,approved.request.approvalManifestSha256);
 assert.throws(()=>projectCoreOwnedTransactionApproval({...approved}),
  {code:'INFL_CORE_HANDOFF_AUTH_OBJECT_STOP'});
});

test('trace-only chat label does not impose a second UUID approval gate',()=>{
 const d=fixture();
 const req=JSON.parse(d.event.issue.body);
 req.chatId='chat-w01-core-handoff-20261121';
 d.event.issue.body=JSON.stringify(req);
 const auth=authorizeCoreOwnedHandoff(d);
 assert.equal(auth.request.chatId,req.chatId);
});
