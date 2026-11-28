import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {authorizeWriterBNative,assertAuthenticatedWriterBIssue,
 validateWriterBRequestManifest,ISSUE_LABEL}
 from '../writer-b/contract.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 // Real reviewed Writer approval fixture, copied only into a source-only
 // synthetic test: remove its optional extended-window grant. Never send it
 // as a real install request or install this fixture on a PC.
 const manifest=JSON.parse(fs.readFileSync(
  new URL('../approvals/writer-updates/w05-r304-maintenance-window-20261119.json',import.meta.url)));
 delete manifest.coreMaintenance;
 const approvalBytes=Buffer.from(JSON.stringify(manifest));
 const request={schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
  requestId:'12345678-1234-4234-8234-123456789abc',
  chatId:'12345678-1234-4234-8234-123456789abd',
  operation:'pc-writer-source-install',controlRepository:REPO,
  approvalManifestPath:'approvals/writer-updates/w05-r304-maintenance-window-20261119.json',
  approvalManifestSha256:hash(approvalBytes)};
 const requestBytes=Buffer.from(JSON.stringify(request));
 const adapterBytes=Buffer.from('exact pinned independent native Writer adapter');
 const p={schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',enabled:true,
  effect:'B_WRITER_SOURCE',nativeWriterBExecutionEnabled:true,
  nativeWriterBControlSha:'a'.repeat(40),
  nativeWriterBAdapterSha256:hash(adapterBytes),
  businessApprovalSha256:hash(approvalBytes),
  approvedRequestSha256:hash(requestBytes)};
 const scope={policy:p,approvalBytes,requestBytes};
 const observation={state:'CONTRACT_MATCH_ONLY',
  code:'CI_NATIVE_RECEIVER_INDEPENDENT_EVIDENCE_MATCH',
  effectKey:hash(JSON.stringify([
   p.effect,p.businessApprovalSha256,p.approvedRequestSha256
  ]))};
 const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'workflow_dispatch',
  GITHUB_ACTOR:'github-actions[bot]',GITHUB_REF:'refs/heads/main',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'123456',
  RUNNER_NAME:'zgmini-pc-01',GITHUB_SHA:'a'.repeat(40)};
 return {scope,observation,env,controlHead:env.GITHUB_SHA,adapterBytes};
}
test('native Writer B requires independent receiver and installed exact opt-in',()=>{
 const x=fixture(),a=authorizeWriterBNative(x);
 assert.equal(a.requestId,'12345678-1234-4234-8234-123456789abc');
 assert.equal(a.manifestSha256,hash(x.scope.approvalBytes));
 assert.equal(a.issueNumber,null);
 assert.equal(assertAuthenticatedWriterBIssue(a),a);
});
test('arbitrary object cannot create a Writer B installer seal',()=>{
 const x=fixture();
 assert.throws(()=>assertAuthenticatedWriterBIssue({
  requestId:'12345678-1234-4234-8234-123456789abc',
  manifest:JSON.parse(x.scope.approvalBytes)
 }),{code:'WRITER_B_UNVERIFIED_ISSUE_STOP'});
});
test('CI receiver admission cannot be substituted by a synthetic skip',()=>{
 const x=fixture();x.observation.state='REJECTED';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_INDEPENDENT_GRANT_STOP'});
});
test('missing separate runtime activation denies B even when CI source passed',()=>{
 const x=fixture();delete x.scope.policy.nativeWriterBExecutionEnabled;
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_INDEPENDENT_GRANT_STOP'});
});
test('Writer B cannot be reinterpreted as A or Controller B',()=>{
 const x=fixture();x.scope.policy.effect='A_READONLY';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_INDEPENDENT_GRANT_STOP'});
});
test('native Writer B does not run on generic CI/Owner manually dispatched identity',()=>{
 const x=fixture();x.env.GITHUB_ACTOR='ansqhd5774-Choi';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('native Writer B cannot execute on isolated CI controller Runner',()=>{
 const x=fixture();x.env.RUNNER_NAME='zgmini-handoff-ci-isolated';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('only first run attempt is eligible for one-shot Writer installation',()=>{
 const x=fixture();x.env.GITHUB_RUN_ATTEMPT='2';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('transitive Writer installer revision must match exact installed control SHA',()=>{
 const x=fixture();x.scope.policy.nativeWriterBControlSha='b'.repeat(40);
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('unreviewed native adapter SHA is blocked before installer',()=>{
 const x=fixture();x.adapterBytes=Buffer.from('different adapter');
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('changed manifest or request bytes cannot gain a native grant',()=>{
 const x=fixture();x.scope.approvalBytes=Buffer.from('{}');
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_APPROVAL_BYTES_STOP'});
 const y=fixture();y.scope.requestBytes=Buffer.from('{}');
 assert.throws(()=>authorizeWriterBNative(y),{code:'WRITER_B_NATIVE_APPROVAL_BYTES_STOP'});
});
test('source drift between Actions checkout and running workflow is denied',()=>{
 const x=fixture();x.controlHead='b'.repeat(40);
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('extended Core Task pause approval is not silently included in initial native B',()=>{
 const x=fixture();
 const m=JSON.parse(x.scope.approvalBytes);
 m.coreMaintenance='PAUSE_NEW_STARTS_DRAIN_360S_V1';
 const changed=Buffer.from(JSON.stringify(m));
 x.scope.approvalBytes=changed;
 x.scope.policy.businessApprovalSha256=hash(changed);
 x.scope.requestBytes=Buffer.from(JSON.stringify({
  ...JSON.parse(x.scope.requestBytes),approvalManifestSha256:hash(changed)
 }));
 x.scope.policy.approvedRequestSha256=hash(x.scope.requestBytes);
 x.observation.effectKey=hash(JSON.stringify([
  'B_WRITER_SOURCE',x.scope.policy.businessApprovalSha256,x.scope.policy.approvedRequestSha256
 ]));
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_MAINTENANCE_SCOPE_STOP'});
});

test('public Writer B seal remains bound to exact independent execution opt-in',()=>{
 const x=fixture();
 Object.assign(x.scope.policy,{repositoryVisibility:'public',installedControllerSha:'f'.repeat(40)});
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
 x.env.ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED='true';
 const a=authorizeWriterBNative(x);
 assert.equal(a.issueNumber,null);
 const wrong=fixture();
 wrong.scope.policy.repositoryVisibility='public';
 wrong.scope.policy.installedControllerSha='not-a-sha';
 wrong.env.ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED='true';
 assert.throws(()=>authorizeWriterBNative(wrong),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});

test('#4135 paid MarketParquet four-file manifest is exact native B scope, never an execution grant',()=>{
 // Historical request reconstructed for source-only validation, not replayed.
 const p='approvals/writer-updates/us-breadth-paid-r2-guarded-fourfile-natural-idle-20261127.json';
 const bytes=fs.readFileSync(new URL('../'+p,import.meta.url));
 const digest='c4f58408f4360f7d03b9c359cda78ce4602c447d86ff15ad538cdb57d820acda';
 assert.equal(hash(bytes),digest);
 const original={schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
  requestId:'d1e33802-9e86-4b4b-ae20-6cfdb0c2c2b8',
  chatId:'a67cd0f6-508a-4a73-87e3-88174bd8e52e',
  operation:'pc-writer-source-install',controlRepository:REPO,
  approvalManifestPath:p,approvalManifestSha256:digest};
 const input={body:JSON.stringify(original),
  labels:[{name:ISSUE_LABEL}],manifestBytes:bytes};
 const {request,manifest}=validateWriterBRequestManifest(input);
 assert.equal(request.approvalManifestPath,p);
 assert.equal(request.requestId,original.requestId);
 assert.equal(Object.hasOwn(manifest,'coreMaintenance'),false);
 assert.equal(manifest.runCount,1);
 assert.deepEqual(manifest.files.map(f=>f.path),[
  'scripts/pc-writer/local-cycle.mjs',
  'scripts/pc-writer/marketparquet-paid-store.mjs',
  'scripts/pc-writer/us-breadth-paid-r2-cycle.mjs',
  'scripts/pc-writer/us-breadth-paid-r2-stored.mjs'
 ]);
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])
  assert.equal(manifest[key],false,key);
 const mutated={...original,approvalManifestSha256:'0'.repeat(64)};
 assert.throws(()=>validateWriterBRequestManifest({...input,body:JSON.stringify(mutated)}),
  {code:'WRITER_B_MANIFEST_HASH_STOP'});
 const noLabel={...input,labels:[]};
 assert.throws(()=>validateWriterBRequestManifest(noLabel),
  {code:'WRITER_B_ISSUE_AUTH_STOP'});
});
