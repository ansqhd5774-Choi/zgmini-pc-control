import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {test} from 'node:test';
import {makeApprovedRuntimeBIntake} from './approved-runtime-b-intake.mjs';
import {makeApprovedRuntimeBUpdater} from './approved-runtime-b-updater.mjs';
import {createApprovedGenericBReceiverRoute,GENERIC_B_CONTROL_REPO}
 from './approved-generic-b-route.mjs';
import {makeMaintenanceAgentGenericBHook}
 from './maintenance-agent-generic-b-hook.mjs';
import {PIN_CAS_SCHEMA,PIN_CAS_SCOPE}
 from './approved-registry-cas.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const ID='18927e34-9d91-471b-80ce-b47cb4d0df8a';
const CHAT='2368074b-108e-40cc-9e4d-f0a32892edc1';
const RECEIVER='1'.repeat(40),CONTROL='2'.repeat(40),SOURCE='3'.repeat(40);
const ROOT=String.raw`E:\ZGmini\automation\pc-control`;
const DATA=String.raw`E:\ZGmini\data`;

function vertical(){
 const effects=[];const packageFiles=new Map();let ledger=null;
 const raw=Buffer.from(JSON.stringify({schema:PIN_CAS_SCHEMA,status:'APPROVED_B',
  scope:PIN_CAS_SCOPE,sourceSha:SOURCE,profileId:'themeTool'}));
 const request={schema:'ZGMINI_PC_APPROVED_RUNTIME_B_ISSUE_V1',
  requestId:ID,chatId:CHAT,operation:'pc-approved-runtime-b',
  controlRepository:GENERIC_B_CONTROL_REPO,expectedInstalledReceiverSha:RECEIVER,
  approvalManifestSha256:sha(raw)};
 const issue={number:810,title:'pc-approved-runtime-b',state:'OPEN',
  author:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-maintenance'},{name:'pc-approved-runtime-b'}],
  body:JSON.stringify(request)};
 const installed={status:'INSTALLED_APPROVED_B_RECEIVER',
  operation:'pc-approved-runtime-b',installedReceiverSha:RECEIVER,
  controlCommitSha:CONTROL,privateRepositoryVerified:true,
  platform:'win32',originVerified:true,maintenanceRoot:ROOT,dataRoot:DATA,
  fixedPathsVerified:true,installedManifestShaVerified:true,
  approvedRegistryFile:path.win32.join(DATA,'pc-writer',
   'approved-runtime-inventory-profiles.json'),
  sharedWriterLock:path.win32.join(DATA,'pc-writer','writer-source-install.lock')};
 const readApproval=async()=>raw;
 const effectRoute=createApprovedGenericBReceiverRoute({
  installed:async()=>installed,
  readApprovalFromControlCommit:readApproval,
  requestStatus:async()=>({status:ledger?'RECOVERY_REQUIRED':'NOT_CLAIMED'}),
  verifyOriginAndApproval:async args=>({verified:true,effect:args.approvedMode,
   scope:PIN_CAS_SCOPE,controlCommitSha:CONTROL,
   approvedRawSha256:sha(raw),sourceSha:SOURCE,issueNumber:810}),
  makePinAdapter:async()=>({mock:true}),makeBundleAdapter:async()=>{throw Error('not bundle');},
  pinRunner:async()=>{effects.push('PIN_CAS');return {
   status:'PASS',reportStatus:'JSON_TXT_2_OF_2',sourceSha:SOURCE};},
 });
 const updater=makeApprovedRuntimeBUpdater({
  installedStatus:async()=>installed,
  readRecoveryStatus:async()=>({requestId:ID,ledger,
   sharedWriterLock:{held:false},sourceShaVerified:true}),
  readApprovedPackage:async({path:file})=>packageFiles.get(file),
  verifyLiveOwnerIssue:async()=>({verified:true,issue,
   privateRepositoryVerified:true,controlCommitSha:CONTROL,
   manifestSha256:sha(raw)}),
  executeApprovedRoute:async()=>effectRoute.process({issue}),
  persistAndReadBackResult:async({result})=>{ledger=result;
   return {readbackVerified:true,requestId:ID,result};},
 });
 const intake=makeApprovedRuntimeBIntake({
  installedStatus:async()=>installed,
  readApprovalFromControlCommit:readApproval,
  verifyOwnerEffectApproval:async()=>({verified:true,issueNumber:810,
   controlCommitSha:CONTROL,rawApprovalSha256:sha(raw)}),
  storeApprovedPackageCreateOnce:async({file,packageData})=>{
   if(packageFiles.has(file))return {identicalExisting:true};
   packageFiles.set(file,packageData);return {created:true};},
  readApprovedPackageBack:async({file})=>packageFiles.get(file),
  invokeFixedUpdater:async({args})=>updater.command(args),
 });
 const hook=makeMaintenanceAgentGenericBHook({approvedRoute:intake});
 return {hook,issue,effects,packageFiles,ledger:()=>ledger};
}

test('single maintainer intake → fixed updater → generic PIN CAS route',async()=>{
 const x=vertical();
 const first=await x.hook.dispatch(x.issue);
 assert.equal(first.handled,true);
 assert.equal(first.result.status,'SUCCEEDED',JSON.stringify(first));
 assert.equal(first.result.endToEndDone,true);
 assert.deepEqual(x.effects,['PIN_CAS']);
 assert.equal(x.packageFiles.size,1);
 assert.equal(x.ledger().status,'SUCCEEDED');
});

test('same Issue cannot execute a second B after updater ledger claimed',async()=>{
 const x=vertical();
 await x.hook.dispatch(x.issue);
 await assert.rejects(x.hook.dispatch(x.issue),
  {code:'B_INTAKE_PRIOR_ATTEMPT_RECONCILE'});
 assert.deepEqual(x.effects,['PIN_CAS']);
});
