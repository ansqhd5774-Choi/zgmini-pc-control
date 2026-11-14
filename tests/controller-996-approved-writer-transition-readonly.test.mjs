import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {review996ApprovedWriterTransitionReadOnly as review} from '../tools/controller-996-approved-writer-transition-readonly.mjs';

const req='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const core='dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028';
const korea='1797e5def9fc92551132ca69f60bb5320bb346c687988be3e4ff3eb76ef5fdc1';
const tasks={'ZGMINI-PC-Local-Core':core,'ZGMINI-PC-Local-Korea':korea};
const enabled={'ZGMINI-PC-Local-Core':true,'ZGMINI-PC-Local-Korea':true};
const historicalSha='0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453';
const currentSha='53533eab16c0d62301450129cfe81aefcd7a56a45c97a20d536b32c526c3d72a';
const oldFp='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const newFp='0ef53711fe5da97f4614b962e81a393e3532a8f912d201a86cdc068502f99904';
const source='05d7ae49e0a84cbeebd90ef4de6dd7284094bf97';
const sha=x=>createHash('sha256').update(Buffer.from(JSON.stringify(x))).digest('hex');
function input(){
 return {
  historical:{schema:'ZGMINI_CONTROLLER_996_C_APPROVAL_V1',approved:true,
   issueNumber:996,operation:'RECONCILE_INTAKE_PAUSED_ONLY',
   protectionNowFingerprint:oldFp,
   protectedItemsSha256:{files:{'config.json':historicalSha},tasks:{...tasks}},
   protectedWriterFileStatus:{'config.json':'PRESENT','quota-runner.cmd':'ABSENT','run-local.cmd':'ABSENT'},
   protectedTaskEnabled:{...enabled}},
  writerInstall:{schema:'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1',requestId:'8f5a44a7-9d5d-4f2c-8736-8ff015f57d91',
   status:'WRITER_B_INSTALLED_VERIFIED',code:'WRITER_B_INSTALL_VERIFIED',
   localOnly:true,sourceSha:source,runId:'43233138112',mode:'LOCAL_OVERLAY',
   baseHead:'84df5e80f4bcdadd2a274d6f55a90290426c2406',
   candidateSourceSha:'9eae7d4815853ab6207b4eceedd4de52ea49ac45',
   manifestSha256:'bb22635ea23de806be241bc1c205d319ad6b17a9b42f3d0fb4d7f06655ac9c9a',
   changedPaths:['scripts/pc-writer/additional-collection-health.mjs']},
  writerReadback:{requestId:'pc-r10-retired-health-after-b-20261112-11',
   status:'PASS',code:'WRITER_APPROVED_PREIMAGE_READONLY',pcOperationalApprovedSha:source,
   protectedStateUnchanged:true,protectedBeforeSha256:'4c9666de6260e528ba1cc3c93e100bd6afc867be7d5379a552e49ef1a112029d',
   protectedAfterSha256:'4c9666de6260e528ba1cc3c93e100bd6afc867be7d5379a552e49ef1a112029d',
   result:{evidenceLevel:'FIXED_CHECKOUT_NOT_LIVE_CORE_PROCESS',runtimeSourceVerified:false,
    sourceHead:source,sourceIdentityConsistent:false,coreTaskSourceLinked:false,
    r6Config:{status:'PASS',configSha256:currentSha}}},
  current:{schema:'ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1',requestId:req,
   issueNumber:996,status:'CURRENT_ITEMS_DIFFER_OR_UNPROVEN',
   originalObservationFingerprint:oldFp,currentFingerprint:newFp,
   fingerprintMatch:false,executionAuthorized:false,operationalWrites:0,
   historicalBaselineAvailable:false,allActorsImmutableProven:false,
   observedAt:'2026-11-14T02:48:55.918Z',
   items:{files:{'config.json':currentSha},writerFileStatus:{'config.json':'PRESENT',
    'quota-runner.cmd':'ABSENT','run-local.cmd':'ABSENT'},taskSha256:{...tasks},taskEnabled:{...enabled}}},
 };
}
test('Writer B source overlay and config.source CAS remain observational for C',()=>{
 const x=input();assert.equal(sha({files:x.current.items.files,tasks}),newFp);
 const r=review(x);
 assert.equal(r.status,'MATCHING_POST_INSTALL_OBSERVATIONS_ONLY');
 assert.equal(r.code,'C996_BRIDGE_CONFIG_CHANGE_ATTRIBUTION_UNVERIFIED');
 assert.equal(r.configChangeAttributionVerified,false);
 assert.equal(r.writerBConfigSourceCasContracted,true);
 assert.equal(r.writerBUnrestrictedConfigEditApproved,false);
 assert.equal(r.readbackProtectedDigestIsConfigSha,false);
 assert.equal(r.evidenceAuthenticated,false);
 assert.equal(r.originalWindowsDoubleReadVerified,false);
 assert.equal(r.exactNewCConsentVerified,false);
 assert.equal(r.executionAuthorized,false);
 assert.equal(r.operationalWrites,0);
});
test('historic approval pin cannot be rewritten to current configuration',()=>{
 const x=input();x.historical.protectedItemsSha256.files['config.json']=currentSha;
 assert.equal(review(x).code,'C996_BRIDGE_HISTORICAL_APPROVAL_PIN_DRIFT');
});
test('unrelated Writer B path or wrong manifest is rejected',()=>{
 const x=input();x.writerInstall.changedPaths.push('scripts/pc-writer/local-cycle.mjs');
 assert.equal(review(x).code,'C996_BRIDGE_WRITER_B_SOURCE_OR_SCOPE_DRIFT');
 const y=input();y.writerInstall.manifestSha256='b'.repeat(64);
 assert.equal(review(y).code,'C996_BRIDGE_WRITER_B_SOURCE_OR_SCOPE_DRIFT');
 const z=input();z.writerInstall.runId='000';
 assert.equal(review(z).code,'C996_BRIDGE_WRITER_B_SOURCE_OR_SCOPE_DRIFT');
});
test('readback mismatch and false live runtime claim are rejected',()=>{
 const x=input();x.writerReadback.result.r6Config.configSha256=historicalSha;
 assert.equal(review(x).code,'C996_BRIDGE_WRITER_READBACK_NOT_PINNED');
 const y=input();y.writerReadback.result.evidenceLevel='LIVE_CORE_PROCESS';
 assert.equal(review(y).code,'C996_BRIDGE_WRITER_READBACK_NOT_PINNED');
 const z=input();z.writerReadback.protectedBeforeSha256='a'.repeat(64);
 z.writerReadback.protectedAfterSha256='a'.repeat(64);
 assert.equal(review(z).code,'C996_BRIDGE_WRITER_READBACK_NOT_PINNED');
 const k=input();k.writerReadback.result.sourceIdentityConsistent=true;
 assert.equal(review(k).code,'C996_BRIDGE_WRITER_READBACK_NOT_PINNED');
 const m=input();m.writerReadback.result.coreTaskSourceLinked=true;
 assert.equal(review(m).code,'C996_BRIDGE_WRITER_READBACK_NOT_PINNED');
});
test('task changed, disabled task, or additional file cannot pass',()=>{
 const x=input();x.current.items.taskSha256['ZGMINI-PC-Local-Core']='f'.repeat(64);
 assert.equal(review(x).code,'C996_BRIDGE_PROTECTED_ITEM_OR_FINGERPRINT_DRIFT');
 const y=input();y.current.items.taskEnabled['ZGMINI-PC-Local-Korea']=false;
 assert.equal(review(y).code,'C996_BRIDGE_PROTECTED_ITEM_OR_FINGERPRINT_DRIFT');
 const z=input();z.current.items.files['run-local.cmd']='f'.repeat(64);
 assert.equal(review(z).code,'C996_BRIDGE_PROTECTED_ITEM_OR_FINGERPRINT_DRIFT');
});
test('unverified live observation cannot pass even with matching file hashes',()=>{
 const x=input();x.current.executionAuthorized=true;
 assert.equal(review(x).code,'C996_BRIDGE_CURRENT_SNAPSHOT_IDENTITY_OR_AUTHORITY');
 const y=input();y.current.currentFingerprint=oldFp;
 assert.equal(review(y).code,'C996_BRIDGE_CURRENT_SNAPSHOT_IDENTITY_OR_AUTHORITY');
 const z=input();z.current.observedAt='invalid';
 assert.equal(review(z).code,'C996_BRIDGE_CURRENT_SNAPSHOT_IDENTITY_OR_AUTHORITY');
});
test('missing inputs and malicious permissive data fail closed',()=>{
 assert.equal(review().status,'TRANSITION_METADATA_NOT_REVIEWED');
 const x=input();x.historical.protectedTaskEnabled={'ZGMINI-PC-Local-Core':true};
 assert.equal(review(x).executionAuthorized,false);
 const y=input();y.writerReadback.protectedStateUnchanged=false;
 assert.equal(review(y).code,'C996_BRIDGE_WRITER_READBACK_NOT_PINNED');
});
