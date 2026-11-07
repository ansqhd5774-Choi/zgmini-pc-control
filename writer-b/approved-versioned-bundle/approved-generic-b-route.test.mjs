import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {
 createApprovedGenericBReceiverRoute,approvalPathFromDigest,
 GENERIC_B_OPERATION,GENERIC_B_TITLE,GENERIC_B_LABEL,GENERIC_B_ISSUE_SCHEMA,
 GENERIC_B_CONTROL_REPO,
} from './approved-generic-b-route.mjs';
import {PIN_CAS_SCHEMA,PIN_CAS_SCOPE}
 from './approved-registry-cas.mjs';
import {SCHEMA as BUNDLE_SCHEMA,SCOPE as BUNDLE_SCOPE}
 from './versioned-bundle-plan.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const ID='18927e34-9d91-471b-80ce-b47cb4d0df8a';
const CHAT='2368074b-108e-40cc-9e4d-f0a32892edc1';
const RECEIVER='1'.repeat(40),CONTROL='2'.repeat(40),SOURCE='3'.repeat(40);
const pinManifest={schema:PIN_CAS_SCHEMA,status:'APPROVED_B',scope:PIN_CAS_SCOPE,
 sourceSha:SOURCE,profileId:'themeTool'};
const bundleManifest={schema:BUNDLE_SCHEMA,status:'APPROVED',scope:BUNDLE_SCOPE,
 sourceSha:SOURCE,profileId:'themeTool'};
function makeFixture({manifest=pinManifest,installed=true,proofValid=true,
 rawTampered=false,alreadyConsumed=false,wrongActor=false}={}){
 const raw=Buffer.from(JSON.stringify(manifest));
 const digest=sha(raw);
 const issue={number:810,state:'OPEN',title:GENERIC_B_TITLE,
  author:{login:wrongActor?'attacker':'ansqhd5774-Choi'},
  labels:[{name:GENERIC_B_LABEL},{name:'pc-maintenance'}],body:JSON.stringify({
   schema:GENERIC_B_ISSUE_SCHEMA,requestId:ID,chatId:CHAT,
   operation:GENERIC_B_OPERATION,controlRepository:GENERIC_B_CONTROL_REPO,
   expectedInstalledReceiverSha:RECEIVER,approvalManifestSha256:digest})};
 const calls=[];
 const route=createApprovedGenericBReceiverRoute({
  installed:async()=>{calls.push('installed');return installed?{
   operation:GENERIC_B_OPERATION,status:'INSTALLED_APPROVED_B_RECEIVER',
   installedReceiverSha:RECEIVER,controlCommitSha:CONTROL,
   privateRepositoryVerified:true}:{status:'NOT_INSTALLED'};},
  requestStatus:async()=>{calls.push('status');return {
   status:alreadyConsumed?'RECOVERY_REQUIRED':'NOT_CLAIMED'};},
  readApprovalFromControlCommit:async args=>{
   calls.push('read');assert.equal(args.controlCommitSha,CONTROL);
   assert.equal(args.path,approvalPathFromDigest(digest));
   return rawTampered?Buffer.from(raw.toString('utf8')+' '):raw;
  },
  verifyOriginAndApproval:async args=>{calls.push('approval');return proofValid?{
   verified:true,effect:args.approvedMode,scope:args.manifest.scope,
   controlCommitSha:CONTROL,approvedRawSha256:digest,
   sourceSha:SOURCE,issueNumber:issue.number}:{verified:false};},
  makePinAdapter:async()=>{calls.push('pinAdapter');return {notExecutable:true};},
  makeBundleAdapter:async()=>{calls.push('bundleAdapter');return {
   adapter:{notExecutable:true},trustedProfiles:{mock:true}};},
  pinRunner:async payload=>{calls.push('pinRunner');assert.equal(payload.approvalRaw,raw);
   assert.equal(payload.pinnedApproval.requestId,ID);
   assert.equal(payload.pinnedApproval.rawApprovalSha256,digest);
   return {status:'PASS',reportStatus:'JSON_TXT_2_OF_2',kind:'PIN'};},
  bundleRunner:async payload=>{calls.push('bundleRunner');assert.equal(payload.rawManifest,raw);
   assert.equal(payload.pinnedApproval.approvalRef,approvalPathFromDigest(digest));
   assert.equal(payload.pinnedApproval.sourceSha,SOURCE);
   return {status:'PASS',reportStatus:'JSON_TXT_2_OF_2',kind:'BUNDLE'};},
 });
 return {route,issue,calls};
}

test('uninstalled new effect is rejected before Issue, manifest and mutation',async()=>{
 const x=makeFixture({installed:false});
 await assert.rejects(x.route.process({issue:x.issue}),{code:'B_ROUTE_NOT_INSTALLED'});
 assert.deepEqual(x.calls,['installed']);
});

test('no adapter/shell/task effect occurs without exact installed dependencies',()=>{
 assert.throws(()=>createApprovedGenericBReceiverRoute({installed:()=>true}),
  {code:'B_ROUTE_UNINSTALLED_DEPENDENCY'});
 assert.throws(()=>approvalPathFromDigest('../evil'),
  {code:'B_ROUTE_APPROVAL_DIGEST'});
});

test('pinned raw PIN manifest selects only PIN registry CAS effect',async()=>{
 const x=makeFixture();const out=await x.route.process({issue:x.issue});
 assert.equal(out.kind,'PIN');
 assert.deepEqual(x.calls,['installed','status','read','approval','pinAdapter','pinRunner']);
});

test('108-file versioned bundle B uses same common receiver route',async()=>{
 const x=makeFixture({manifest:bundleManifest});
 const out=await x.route.process({issue:x.issue});
 assert.equal(out.kind,'BUNDLE');
 assert.deepEqual(x.calls,['installed','status','read','approval',
  'bundleAdapter','bundleRunner']);
});

test('actor or label mismatch cannot retrieve manifest or run B',async()=>{
 const x=makeFixture({wrongActor:true});
 await assert.rejects(x.route.process({issue:x.issue}),
  {code:'B_ROUTE_ISSUE_ORIGIN'});
 assert.deepEqual(x.calls,['installed']);
});

test('Issue-selected action, path, shell and extra keys rejected',async()=>{
 const x=makeFixture();
 x.issue.body=JSON.stringify({...JSON.parse(x.issue.body),
  action:'execute',path:'E:\\ZGmini\\data\\pc-writer\\host.json'});
 await assert.rejects(x.route.process({issue:x.issue}),
  {code:'B_ROUTE_ISSUE_CONTRACT'});
 assert.deepEqual(x.calls,['installed']);
});

test('duplicate JSON authorization keys are denied before approved manifest read',async()=>{
 const x=makeFixture();
 x.issue.body=x.issue.body.replace('"operation":"pc-approved-runtime-b",',
  '"operation":"pc-approved-runtime-b","operation":"pc-approved-runtime-b",');
 await assert.rejects(x.route.process({issue:x.issue}),
  {code:'B_ROUTE_ISSUE_DUPLICATE_KEY'});
 assert.deepEqual(x.calls,['installed']);
});

test('exact approved raw SHA mismatch rejects before owner-effect verification',async()=>{
 const x=makeFixture({rawTampered:true});
 await assert.rejects(x.route.process({issue:x.issue}),
  {code:'B_ROUTE_APPROVAL_BYTES_DRIFT'});
 assert.deepEqual(x.calls,['installed','status','read']);
});

test('B provenance proof is mandatory and cannot be substituted by Issue JSON',async()=>{
 const x=makeFixture({proofValid:false});
 await assert.rejects(x.route.process({issue:x.issue}),
  {code:'B_ROUTE_OWNER_EFFECT_UNVERIFIED'});
 assert.deepEqual(x.calls,['installed','status','read','approval']);
});

test('existing request ID is not replayed or aliased to new approval',async()=>{
 const x=makeFixture({alreadyConsumed:true});
 await assert.rejects(x.route.process({issue:x.issue}),
  {code:'B_ROUTE_PRIOR_REQUEST_RECONCILE'});
 assert.deepEqual(x.calls,['installed','status']);
});

test('source-only Writer B approval cannot authorize PIN or versioned activation',async()=>{
 const x=makeFixture({manifest:{schema:'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1',
  status:'APPROVED_B',scope:'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY',
  sourceSha:SOURCE,profileId:'themeTool'}});
 await assert.rejects(x.route.process({issue:x.issue}),
  {code:'B_ROUTE_EFFECT_NOT_APPROVED'});
 assert.deepEqual(x.calls,['installed','status','read']);
});
