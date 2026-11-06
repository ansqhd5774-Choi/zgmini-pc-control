// ZGMINI market-calendar B source alignment, scoped only to existing Core/Writer.
// This pure contract never performs I/O. Actual deployment requires a separately
// pinned approval manifest, exact active Core source proof, and Windows adapter.
import {createHash} from 'node:crypto';

export const BASE='d7bc4948573843766ad82c72ff392220178c36a3';
export const PUBLIC='ce9bccd8b38939b204e8f836a50ae362960eb7af';
export const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const CONFIG=String.raw`E:\ZGmini\data\pc-writer\config.json`;
export const CORE_TASK='ZGMINI-PC-Local-Core';
export const INSTALLED_HOTFIX_PATH='scripts/pc-writer/release-calendar.mjs';
export const INSTALLED_HOTFIX_SHA256='3fa8e1039fcedd3b2fb07b888996f845c6b7102505acdba7608818cb56238871';
// These are Git blob IDs at the exact approved, already merged public commit.
// The Stage step must verify both public checkout HEAD and each exact blob.
export const TARGET_BLOBS=Object.freeze({
 'lib/cftc-calendar.mjs':'31b817d65a19281c095261f296bd97559c1bcb49',
 'lib/earnings-api-calendar.mjs':'24aa4b383e5b77d458d6f87883d2b0c2a9e08461',
 'lib/earnings-api-private-projection.mjs':'5020fa2ed0f9f2218f208e30b7e6a7541680f3e4',
 'lib/eia-calendar.mjs':'ba6b9760481af53501abeb2b454d8f7683908a8e',
 'lib/release-calendar.mjs':'6e6fb2ad3bc1e5ada326354d52f813c0330f8300',
 'lib/tic-calendar.mjs':'6fda628df15057ae33d4b3532fa046114ea187ff',
 'lib/treasury-calendar.mjs':'38f1046f890d47b3488f548243bea76fef634e54',
 'lib/usda-calendar.mjs':'339c2fb497dd3c6129b686942815f43fed351fbb',
 'scripts/pc-writer/earnings-api-local.mjs':'86c08de695983cb4974d54965aea8ab8e0b1be91',
 [INSTALLED_HOTFIX_PATH]:'4eda793bea8b2ff5062eda68800fa4a5688016c2',
});
export const TARGET_PATHS=Object.freeze(Object.keys(TARGET_BLOBS));
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
export class CalendarSourceStop extends Error {
 constructor(code){super(code);this.name='CalendarSourceStop';this.code=code;}
}
const need=(ok,code)=>{if(!ok)throw new CalendarSourceStop(code);};
const sameMap=(a,b)=>a&&typeof a==='object'&&
 Object.keys(a).length===Object.keys(b).length&&
 Object.entries(b).every(([key,value])=>a[key]===value);

// Read-only, pre-claim proof. No side effect is allowed before this passes.
// The active scheduled entrypoint must be resolved by inspecting task Actions,
// not inferred from a historic checkout or its config path alone.
export function validatePreflight(b){
 need(b&&typeof b==='object'&&b.sourceRoot===SOURCE_ROOT&&b.configPath===CONFIG&&
  b.coreTask===CORE_TASK,'CAL_B_PATH_SCOPE_STOP');
 need(b.activeCoreSourceVerified===true&&b.resolvedTaskSourceRoot===SOURCE_ROOT&&
  b.resolvedTaskEntry==='scripts/pc-writer/local-cycle.mjs'&&
  b.taskDefinitionVerified===true,'CAL_B_ACTIVE_TASK_SOURCE_UNRESOLVED_STOP');
 need(b.head===BASE&&b.configSource===BASE&&
  typeof b.originalBranch==='string'&&b.originalBranch.length>0&&
  !b.originalBranch.startsWith('calendar-source-b/'),'CAL_B_BASE_LINEAGE_STOP');
 need(b.publicHead===PUBLIC&&
  b.publicHotfixBlob===TARGET_BLOBS[INSTALLED_HOTFIX_PATH],
  'CAL_B_PUBLIC_PIN_STOP');
 need(b.taskEnabled===true&&b.taskStateKnown===true,
  'CAL_B_CORE_TASK_STATE_STOP');
 // trackedDirty is scoped to the writer's relevant lib/worker/scripts paths;
 // unrelated user docs/logs/untracked files are preserved, not a new gate.
 need(Array.isArray(b.trackedDirty)&&Array.isArray(b.indexDirty),
  'CAL_B_DIRTY_REPORT_MISSING_STOP');
 need(b.indexDirty.length===0,'CAL_B_STAGED_INDEX_STOP');
 // The B #511 one-file hotfix is already installed as a dirty overlay.
 // Only this exact file and exact byte digest may be consumed by a new
 // isolated commit, and the target byte digest must match it verbatim.
 need(b.trackedDirty.length===0||(b.trackedDirty.length===1&&
  b.trackedDirty[0]?.path===INSTALLED_HOTFIX_PATH&&
  b.trackedDirty[0]?.sha256===INSTALLED_HOTFIX_SHA256&&
  b.trackedDirty[0]?.targetBlob===TARGET_BLOBS[INSTALLED_HOTFIX_PATH]),
  'CAL_B_DIRTY_OVERLAY_SCOPE_STOP');
 need(SHA64.test(b.configRawSha256??'')&&
  SHA64.test(b.taskXmlSha256??'')&&
  SHA40.test(b.baseTreeSha??''),
  'CAL_B_BEFORE_HASH_MISSING_STOP');
 need(b.providerCalls===0&&b.sqliteOpened===false&&b.d1Writes===0,
  'CAL_B_SOURCE_ONLY_SCOPE_STOP');
 return Object.freeze({
  base:BASE,public:PUBLIC,paths:TARGET_PATHS.length,
  hotfixPath:INSTALLED_HOTFIX_PATH,
  originalBranch:b.originalBranch,configRawSha256:b.configRawSha256,
  taskXmlSha256:b.taskXmlSha256,baseTreeSha:b.baseTreeSha,
 });
}

// Inspect the assembled commit BEFORE touching a live branch or the Core task.
// Its full diff (not only target file list) must be wholly contained in 10
// approved source paths, and every target file must match public Git blobs.
export function validatePrepared(c,preflight){
 need(preflight?.base===BASE&&c?.parent===BASE&&SHA40.test(c.sha??'')&&c.sha!==BASE,
  'CAL_B_PREPARE_LINEAGE_STOP');
 need(c.cleanCommit===true&&Array.isArray(c.diff)&&
  c.diff.length>=1&&c.diff.length<=TARGET_PATHS.length,
  'CAL_B_PREPARE_DIFF_COUNT_STOP');
 const seen=new Set();
 for(const entry of c.diff){
  need(entry&&TARGET_PATHS.includes(entry.path)&&
   ['M','A'].includes(entry.status)&&!seen.has(entry.path),
   'CAL_B_PREPARE_UNAPPROVED_DIFF_STOP');
  seen.add(entry.path);
 }
 need(sameMap(c.targetBlobs,TARGET_BLOBS)&&
  c.commitTreeRechecked===true&&c.scratchOnly===true,
  'CAL_B_PREPARE_TARGET_MISMATCH_STOP');
 return Object.freeze({sha:c.sha,approvedChangeCount:c.diff.length});
}

export function validateAfter(a,planned){
 need(planned?.sha&&a?.head===planned.sha&&a?.configSource===planned.sha&&
  a?.taskEnabled===true&&a?.taskDefinitionVerified===true&&
  a?.gitDiffRelevantClean===true&&a?.otherDirtyBytesPreserved===true&&
  a?.targetBlobsVerified===true&&a?.protectedStateVerified===true,
  'CAL_B_FINAL_READBACK_STOP');
 return {status:'CAL_B_SOURCE_INSTALLED_VERIFIED',sourceSha:planned.sha};
}

// The immediate production unblocker: commit ONLY the already-approved #511
// hotfix in-place, leaving all other previously verified 12-source files alone.
// A wider 10-file public-source synchronization is NOT a prerequisite for the
// existing SQLite -> Writer -> D1 path and requires separate exact diff review.
export function validateOneFileBefore(b){
 const result=validatePreflight(b);
 need(b.trackedDirty.length===1,'CAL_B_ONEFILE_DIRTY_REQUIRED_STOP');
 need(b.sourceCount===12,'CAL_B_TWELVE_SOURCE_RUNTIME_STOP');
 return result;
}
export function validateOneFileCommit(c,preflight){
 need(preflight?.base===BASE&&c?.parent===BASE&&SHA40.test(c.sha??'')&&
  c.sha!==BASE,'CAL_B_ONEFILE_PARENT_STOP');
 need(c.branch&&/^calendar-source-b\/pc-calendar-[a-f0-9-]+$/.test(c.branch),
  'CAL_B_ONEFILE_BRANCH_STOP');
 need(Array.isArray(c.diff)&&c.diff.length===1&&
  c.diff[0].status==='M'&&c.diff[0].path===INSTALLED_HOTFIX_PATH,
  'CAL_B_ONEFILE_DIFF_STOP');
 need(c.storedBlob===TARGET_BLOBS[INSTALLED_HOTFIX_PATH]&&
  c.storedSha256===INSTALLED_HOTFIX_SHA256&&c.relevantDiffClean===true,
  'CAL_B_ONEFILE_COMMIT_READBACK_STOP');
 return Object.freeze({sha:c.sha,branch:c.branch});
}
