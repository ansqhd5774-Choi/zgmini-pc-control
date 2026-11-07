import assert from 'node:assert/strict';
import {test} from 'node:test';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {makeApprovedRuntimeBUpdater,STATUS,APPLY}
 from './approved-runtime-b-updater.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const REQUEST='18927e34-9d91-471b-80ce-b47cb4d0df8a';
const CHAT='2368074b-108e-40cc-9e4d-f0a32892edc1';
const RECEIVER='1'.repeat(40),CONTROL='2'.repeat(40);
const ROOT=String.raw`E:\ZGmini\automation\pc-control`;
const DATA=String.raw`E:\ZGmini\data`;
const PACKAGE=path.win32.join(ROOT,'approved',REQUEST+'.json');
function setup({installed=true,prior=false,lockAfterFirstProbe=false,
 badManifest=false,badOwner=false,routeThrows=false,evidenceIncomplete=false,
 ledgerReadbackFails=false}={}){
 const calls=[];let probes=0;
 const bytes=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_RUNTIME_PIN_AND_REGISTRY_CAS_B_V1',
  status:'APPROVED_B',scope:'HOST_RUNTIME_PIN_AND_REGISTRY_BYTE_CAS_ONLY'}));
 const issueData={schema:'ZGMINI_PC_APPROVED_RUNTIME_B_ISSUE_V1',requestId:REQUEST,
  chatId:CHAT,operation:'pc-approved-runtime-b',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  expectedInstalledReceiverSha:RECEIVER,
  approvalManifestSha256:hash(bytes)};
 const issue={number:810,state:'OPEN',title:'pc-approved-runtime-b',
  author:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-maintenance'},{name:'pc-approved-runtime-b'}],
  body:JSON.stringify(issueData)};
 const pkg={issue:issueData,actor:'ansqhd5774-Choi',issueNumber:810,
  manifest:JSON.parse(bytes),manifestRawBase64:bytes.toString('base64')};
 const installedValue={operation:'pc-approved-runtime-b',
  status:installed?'INSTALLED_APPROVED_B_RECEIVER':'NOT_INSTALLED',
  installedReceiverSha:RECEIVER,controlCommitSha:CONTROL,
  privateRepositoryVerified:true,platform:'win32',originVerified:true,
  maintenanceRoot:ROOT,dataRoot:DATA,fixedPathsVerified:true,
  installedManifestShaVerified:true,
  approvedRegistryFile:path.win32.join(DATA,'pc-writer',
   'approved-runtime-inventory-profiles.json'),
  sharedWriterLock:path.win32.join(DATA,'pc-writer','writer-source-install.lock')};
 const updater=makeApprovedRuntimeBUpdater({
  installedStatus:async()=>{calls.push('installed');return installedValue;},
  readRecoveryStatus:async()=>{calls.push('status');probes++;
   return {requestId:REQUEST,ledger:prior?{status:'UNKNOWN'}:null,
    sharedWriterLock:{held:lockAfterFirstProbe&&probes>=2},
    sourceShaVerified:true};},
  readApprovedPackage:async({path:readPath})=>{calls.push('package');
   assert.equal(readPath,PACKAGE);return badManifest?
    {...pkg,manifestRawBase64:Buffer.from('TAMPERED').toString('base64')}:pkg;},
  verifyLiveOwnerIssue:async()=>{calls.push('owner');return {
   verified:!badOwner,issue,privateRepositoryVerified:true,
   controlCommitSha:CONTROL,manifestSha256:hash(bytes)};},
  executeApprovedRoute:async()=>{calls.push('route');
   if(routeThrows)throw Object.assign(Error('fault'),{code:'B_INJECTED'});
   return {status:'PASS',sourceSha:'3'.repeat(40),
    reportStatus:evidenceIncomplete?'INCOMPLETE':'JSON_TXT_2_OF_2'};},
  persistAndReadBackResult:async({result})=>{calls.push('ledger');return {
   readbackVerified:!ledgerReadbackFails,requestId:REQUEST,result};},
 });
 return {updater,issue,calls,bytes};
}

test('source-only updater requires every installed receiver authority hook',()=>{
 assert.throws(()=>makeApprovedRuntimeBUpdater({installedStatus:async()=>true}),
  {code:'B_UPDATE_RECEIVER_HOOK_UNINSTALLED'});
});

test('new UUID status is read-only, unlike old slug maintenance status',async()=>{
 const x=setup();const result=await x.updater.command([STATUS,'--request-id',REQUEST]);
 assert.equal(result.status,'NOT_CLAIMED');
 assert.deepEqual(x.calls,['installed','status']);
});

test('valid fixed package PIN effect delegates once and persists readback',async()=>{
 const x=setup();const out=await x.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE]);
 assert.equal(out.status,'SUCCEEDED');
 assert.equal(out.evidenceComplete,true);
 assert.deepEqual(x.calls,['installed','status','package','owner','status',
  'route','ledger']);
});

test('uninstalled receiver cannot inspect package or route any B effect',async()=>{
 const x=setup({installed:false});
 await assert.rejects(x.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE]),{code:'B_UPDATE_INSTALLED_RECEIVER_UNVERIFIED'});
 assert.deepEqual(x.calls,['installed']);
});

test('Issue-supplied manifest file or extra arguments never select paths',async()=>{
 const x=setup();
 await assert.rejects(x.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',String.raw`E:\Unapproved\fake.json`]),
  {code:'B_UPDATE_APPROVAL_PATH_DRIFT'});
 assert.deepEqual(x.calls,['installed','status']);
 await assert.rejects(x.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE,'--shell','cmd']),{code:'B_UPDATE_ARGS'});
});

test('mutated raw approved bytes and owner proof mismatch fail before route',async()=>{
 const a=setup({badManifest:true});
 await assert.rejects(a.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE]),{code:'B_UPDATE_PACKAGE_RAW_SHA_DRIFT'});
 assert.equal(a.calls.includes('route'),false);
 const b=setup({badOwner:true});
 await assert.rejects(b.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE]),{code:'B_UPDATE_OWNER_PROVENANCE_UNVERIFIED'});
 assert.equal(b.calls.includes('route'),false);
});

test('existing attempt or lock contention never performs another apply',async()=>{
 const prior=setup({prior:true});
 await assert.rejects(prior.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE]),{code:'B_UPDATE_PRIOR_OUTCOME_RECONCILE'});
 assert.equal(prior.calls.includes('route'),false);
 const racing=setup({lockAfterFirstProbe:true});
 await assert.rejects(racing.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE]),{code:'B_UPDATE_CLAIM_RACE'});
 assert.equal(racing.calls.includes('route'),false);
});

test('ambiguous execution returns UNKNOWN and never automatically retries',async()=>{
 const x=setup({routeThrows:true});
 const out=await x.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE]);
 assert.equal(out.status,'UNKNOWN');
 assert.equal(out.code,'B_UPDATE_APPLY_OUTCOME_UNKNOWN');
 assert.equal(x.calls.filter(a=>a==='route').length,1);
});

test('local PASS with incomplete JSON/TXT keeps separate evidence flag',async()=>{
 const x=setup({evidenceIncomplete:true});
 const out=await x.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE]);
 assert.equal(out.status,'SUCCEEDED');
 assert.equal(out.operationSucceeded,true);
 assert.equal(out.evidenceComplete,false);
 assert.equal(out.endToEndDone,false);
 assert.equal(out.code,'B_UPDATE_APPLIED_EVIDENCE_INCOMPLETE');
});

test('post-CAS ledger failure yields UNKNOWN, never apparent complete success',async()=>{
 const x=setup({ledgerReadbackFails:true});
 const out=await x.updater.command([APPLY,'--request-id',REQUEST,
  '--manifest-file',PACKAGE]);
 assert.equal(out.status,'UNKNOWN');
 assert.equal(out.operationSucceeded,true);
 assert.equal(out.ledgerVerified,false);
 assert.equal(out.endToEndDone,false);
 assert.equal(x.calls.filter(v=>v==='route').length,1);
});
