// #996 historical C protection vs. later approved Writer B: SOURCE-ONLY review.
// This module never authenticates GitHub evidence, accesses Windows, mutates
// files, grants C consent, or changes the existing pre-import hard STOP.
import {createHash} from 'node:crypto';

const SHA=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const digest=x=>createHash('sha256').update(Buffer.from(JSON.stringify(x))).digest('hex');
const FILE='config.json';
const OTHER=['quota-runner.cmd','run-local.cmd'];
const TASKS={
 'ZGMINI-PC-Local-Core':'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
 'ZGMINI-PC-Local-Korea':'1797e5def9fc92551132ca69f60bb5320bb346c687988be3e4ff3eb76ef5fdc1',
};
const PINS=Object.freeze({
 historicalFingerprint:'877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86',
 historicalConfigSha:'0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453',
 currentFingerprint:'0ef53711fe5da97f4614b962e81a393e3532a8f912d201a86cdc068502f99904',
 currentConfigSha:'53533eab16c0d62301450129cfe81aefcd7a56a45c97a20d536b32c526c3d72a',
 writerRequestId:'8f5a44a7-9d5d-4f2c-8736-8ff015f57d91',
 writerRunId:'43233138112',
 writerBaseHead:'84df5e80f4bcdadd2a274d6f55a90290426c2406',
 writerCandidateSha:'9eae7d4815853ab6207b4eceedd4de52ea49ac45',
 readbackProtectedSha:'4c9666de6260e528ba1cc3c93e100bd6afc867be7d5379a552e49ef1a112029d',
 writerManifestSha:'bb22635ea23de806be241bc1c205d319ad6b17a9b42f3d0fb4d7f06655ac9c9a',
 writerInstalledSourceSha:'05d7ae49e0a84cbeebd90ef4de6dd7284094bf97',
 readbackRequestId:'pc-r10-retired-health-after-b-20261112-11',
});
const keys=o=>o&&typeof o==='object'&&!Array.isArray(o)?Object.keys(o).sort():[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=(code)=>Object.freeze({
 schema:'ZGMINI_996_APPROVED_WRITER_TRANSITION_SOURCE_REVIEW_V1',
 status:'TRANSITION_METADATA_NOT_REVIEWED',code,
 historicalConsentStillPinned:true,currentLiveProtectionAuthorized:false,
 evidenceAuthenticated:false,executionAuthorized:false,operationalWrites:0,
});

/** Pure check on supplied *untrusted* evidence objects, not authentication. */
export function review996ApprovedWriterTransitionReadOnly({historical,writerInstall,
 writerReadback,current}={}){
 const pinnedFiles=historical?.protectedItemsSha256?.files;
 const pinnedTasks=historical?.protectedItemsSha256?.tasks;
 const pinnedStatus=historical?.protectedWriterFileStatus;
 if(historical?.schema!=='ZGMINI_CONTROLLER_996_C_APPROVAL_V1'||
  historical.issueNumber!==996||historical.approved!==true||
  historical.operation!=='RECONCILE_INTAKE_PAUSED_ONLY'||
  historical.protectionNowFingerprint!==PINS.historicalFingerprint||
  !same(keys(pinnedFiles),[FILE])||pinnedFiles?.[FILE]!==PINS.historicalConfigSha||
  !same(keys(pinnedStatus),[FILE,...OTHER].sort())||
  pinnedStatus?.[FILE]!=='PRESENT'||
  !OTHER.every(x=>pinnedStatus[x]==='ABSENT')||
  !same(pinnedTasks,TASKS)||
  !same(historical.protectedTaskEnabled,{
   'ZGMINI-PC-Local-Core':true,'ZGMINI-PC-Local-Korea':true,
  }))return fail('C996_BRIDGE_HISTORICAL_APPROVAL_PIN_DRIFT');

 if(writerInstall?.schema!=='ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1')
  return fail('C996_BRIDGE_WRITER_RESULT_SCHEMA_UNEXPECTED');
 if(writerInstall.requestId!==PINS.writerRequestId||
  writerInstall.runId!==PINS.writerRunId||
  writerInstall.mode!=='LOCAL_OVERLAY'||
  writerInstall.baseHead!==PINS.writerBaseHead||
  writerInstall.candidateSourceSha!==PINS.writerCandidateSha||
  writerInstall.manifestSha256!==PINS.writerManifestSha||
  writerInstall.status!=='WRITER_B_INSTALLED_VERIFIED'||
  writerInstall.code!=='WRITER_B_INSTALL_VERIFIED'||
  writerInstall.sourceSha!==PINS.writerInstalledSourceSha||
  writerInstall.localOnly!==true||
  !same(writerInstall.changedPaths,['scripts/pc-writer/additional-collection-health.mjs']))
  return fail('C996_BRIDGE_WRITER_B_SOURCE_OR_SCOPE_DRIFT');

 if(writerReadback?.requestId!==PINS.readbackRequestId||
  writerReadback.status!=='PASS'||
  writerReadback.code!=='WRITER_APPROVED_PREIMAGE_READONLY'||
  writerReadback.pcOperationalApprovedSha!==PINS.writerInstalledSourceSha||
  writerReadback.result?.evidenceLevel!=='FIXED_CHECKOUT_NOT_LIVE_CORE_PROCESS'||
  writerReadback.result?.runtimeSourceVerified!==false||
  writerReadback.result?.sourceHead!==PINS.writerInstalledSourceSha||
  writerReadback.result?.r6Config?.status!=='PASS'||
  writerReadback.result?.r6Config?.configSha256!==PINS.currentConfigSha||
  writerReadback.protectedStateUnchanged!==true||
  !SHA(writerReadback.protectedBeforeSha256)||
  writerReadback.protectedBeforeSha256!==PINS.readbackProtectedSha||
  writerReadback.protectedBeforeSha256!==writerReadback.protectedAfterSha256)
  return fail('C996_BRIDGE_WRITER_READBACK_NOT_PINNED');

 const items=current?.items;
 if(current?.schema!=='ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1'||
  current.requestId!=='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404'||
  current.issueNumber!==996||
  current.status!=='CURRENT_ITEMS_DIFFER_OR_UNPROVEN'||
  current.originalObservationFingerprint!==PINS.historicalFingerprint||
  current.currentFingerprint!==PINS.currentFingerprint||
  current.fingerprintMatch!==false||current.executionAuthorized!==false||
  current.operationalWrites!==0||
  current.historicalBaselineAvailable!==false||
  current.allActorsImmutableProven!==false||
  !Number.isFinite(Date.parse(current.observedAt)))
  return fail('C996_BRIDGE_CURRENT_SNAPSHOT_IDENTITY_OR_AUTHORITY');

 if(!same(keys(items?.files),[FILE])||
  items.files?.[FILE]!==PINS.currentConfigSha||
  !same(keys(items.writerFileStatus),[FILE,...OTHER].sort())||
  items.writerFileStatus[FILE]!=='PRESENT'||
  !OTHER.every(x=>items.writerFileStatus[x]==='ABSENT')||
  !same(items.taskSha256,TASKS)||
  !same(items.taskEnabled,{
   'ZGMINI-PC-Local-Core':true,'ZGMINI-PC-Local-Korea':true,
  })||
  digest({files:items.files,tasks:items.taskSha256})!==PINS.currentFingerprint)
  return fail('C996_BRIDGE_PROTECTED_ITEM_OR_FINGERPRINT_DRIFT');

 return Object.freeze({
  schema:'ZGMINI_996_APPROVED_WRITER_TRANSITION_SOURCE_REVIEW_V1',
  status:'MATCHING_APPROVED_WRITER_TRANSITION_METADATA_ONLY',
  code:'C996_BRIDGE_PROVENANCE_AND_LIVE_C_CONSENT_STILL_REQUIRED',
  historicalConfigSha256:PINS.historicalConfigSha,
  currentConfigSha256:PINS.currentConfigSha,
  currentFingerprint:PINS.currentFingerprint,
  coreKoreaTaskHashesUnchanged:true,
  historicalConsentStillPinned:true,
  independentlyAuthenticatedGithubReadback:false,
  originalWindowsDoubleReadVerified:false,
  currentLiveProtectionAuthorized:false,
  exactNewCConsentVerified:false,
  sourceLockAndPackageSealed:false,
  evidenceAuthenticated:false,
  executionAuthorized:false,operationalWrites:0,
 });
}
