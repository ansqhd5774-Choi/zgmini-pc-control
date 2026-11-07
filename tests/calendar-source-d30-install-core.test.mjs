import assert from 'node:assert/strict';
import test from 'node:test';
import {D30_INSTALL_CONTRACT} from '../calendar-source-d30/contract.mjs';
import {installD30ApprovedThreeFiles} from '../calendar-source-d30/install-core.mjs';

const PATHS=D30_INSTALL_CONTRACT.operationalFiles.map(x=>x.path);
const OLD='a'.repeat(40),NEXT='b'.repeat(40);
const ROOT='E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release';
const bytes=Object.fromEntries(D30_INSTALL_CONTRACT.operationalFiles.map(x=>
  [x.path,x.baseSha256]));
bytes[PATHS[1]]='f80bced7233ba9da5511a73bf324ae73a4a7c505ecf1ce9f690cb412b98b1b62';
const MERGED='9'.repeat(64); // test-only synthetic after digest
const targets=Object.fromEntries(D30_INSTALL_CONTRACT.operationalFiles.map(x=>
  [x.path,{sha256:x.path===PATHS[1]?MERGED:x.targetSha256,
    candidateSha256:x.targetSha256,blob:x.targetBlob,
    preservationVerified:x.path===PATHS[1]}]));
const activeCore={runtimeSourceVerified:true,evidenceLevel:'LIVE_CORE_EXECUTION_VERIFIED',
  sourceRoot:ROOT,runtimeSourceSha:OLD,evidenceIssue:602,
  evidenceRequestId:'pc-fixture-a'};
const manifest={scope:D30_INSTALL_CONTRACT.scope,
  sourceHead:D30_INSTALL_CONTRACT.sourceHead,sourceRoot:ROOT,beforeSourceSha:OLD,
  approvalEvidence:'fixture-only-not-real-authorization',
  files:D30_INSTALL_CONTRACT.operationalFiles.map(x=>({path:x.path,
    beforeSha256:bytes[x.path],targetBlob:x.targetBlob,targetSha256:x.targetSha256,
    afterSha256:x.path===PATHS[1]?MERGED:x.targetSha256,
    ...(x.path===PATHS[1]?{mergePreview:{
      status:'CLEAN_PRESERVED_VERIFIED',beforeSha256:bytes[x.path],
      baseSha256:x.baseSha256,candidateSha256:x.targetSha256,afterSha256:MERGED,
      conflictCount:0,preservedVerified:true,sourceWrites:0,
      evidenceIssue:999,evidenceRequestId:'fixture-merge-not-pc-evidence'}}:{})}))};

function fixture(){
  const calls=[];
  const state={...activeCore};
  let head=OLD,config=OLD,files={...bytes};
  const h={
    calls,
    async verifyAuthority(){calls.push('authority');},
    async attest(){calls.push('attest');return {activeCore:{...state},
      installedFileHashes:{...files},gitHead:head,configSource:config,
      sourceRoot:ROOT,trackedDirty:[],stagedPaths:[],
      coreShaConsumers:['CORE_PUBLISHER','CNN_ARCHIVE_SIDECAR']};},
    async stageApprovedTargets(paths,sourceHead,approved){calls.push('stage');
      assert.deepEqual(paths,PATHS);assert.equal(sourceHead,manifest.sourceHead);
      assert.deepEqual(approved,manifest);
      return {stageId:'fixture-staged-approved-after-bytes',files:structuredClone(targets)};},
    async verifyExclusiveLease(){calls.push('lease');},
    async verifyCoreQuiesced(){calls.push('quiesced');},
    async snapshotOriginal(paths){calls.push('backup');assert.deepEqual(paths,PATHS);
      return {backupId:'fixture-recoverable-copy',readbackVerified:true};},
    async applyStagedExactPaths(paths,stageId){calls.push('apply');
      assert.equal(stageId,'fixture-staged-approved-after-bytes');
      files=Object.fromEntries(paths.map(p=>
      [p,targets[p].sha256]));return {updatedPaths:paths};},
    async commitExactPaths(paths,beforeSha){calls.push('commit');
      assert.equal(beforeSha,OLD);head=NEXT;
      return {sha:NEXT,changedPaths:paths,clean:true,protectedUnchanged:true};},
    async casConfigSource(beforeSha,afterSha){calls.push('config');
      assert.equal(beforeSha,OLD);config=afterSha;return {sourceSha:afterSha};},
    async verifyFinal(paths,afterSha){calls.push('final');assert.equal(afterSha,NEXT);
      return {gitHead:head,configSource:config,clean:true,
        protectedUnchanged:true,coreTaskRestored:true,fileSha256:{...files}};},
    async recover(id,code){calls.push('recover');
      assert.equal(id,'fixture-recoverable-copy');assert.match(code,/^ER1_D30_/);
      return {restored:true,verified:true};},
  };
  return h;
}

test('exact authorized three-file transaction reports install-only success',async()=>{
  const h=fixture(),r=await installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h});
  assert.equal(r.status,'SOURCE_INSTALLED_VERIFIED');
  assert.equal(r.installedFileCount,3);
  assert.equal(r.publisherRuntime,'NOT_VERIFIED');
  assert.equal(r.sidecarRuntime,'NOT_VERIFIED');
  assert.equal(r.supplierGetCalls,0);
  assert.deepEqual(h.calls,['authority','attest','stage','lease','quiesced','attest',
    'backup','lease','quiesced','apply','commit','config','final']);
});

test('missing actual A-grade evidence stops without a lease or write',async()=>{
  const h=fixture();h.attest=async()=>({activeCore:null,installedFileHashes:bytes});
  await assert.rejects(installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h}),
    {code:'ER1_D30_ACTIVE_CORE_ORIGIN_UNVERIFIED'});
  assert.deepEqual(h.calls,['authority']);
});

test('mismatched #511 overlay stops before staging',async()=>{
  const h=fixture(),orig=h.attest;
  h.attest=async()=>{const r=await orig();r.installedFileHashes[PATHS[2]]=
    '8'.repeat(64);
    return r;};
  await assert.rejects(installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h}),
    {code:'ER1_D30_FILE_SCOPE_OR_DIGEST_MISMATCH'});
  assert.deepEqual(h.calls,['authority','attest']);
});

test('unreviewed shared CNN Sidecar source consumer stops before backup',async()=>{
  const h=fixture(),orig=h.attest;
  h.attest=async()=>{const r=await orig();r.coreShaConsumers=['CORE_PUBLISHER'];return r;};
  await assert.rejects(installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h}),
    {code:'ER1_D30_SHARED_SHA_CONSUMERS_UNREVIEWED'});
  assert.deepEqual(h.calls,['authority','attest']);
});

test('tracked-dirty Core checkout cannot be silently committed',async()=>{
  const h=fixture(),orig=h.attest;
  h.attest=async()=>{const r=await orig();r.trackedDirty=['lib/unapproved.mjs'];return r;};
  await assert.rejects(installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h}),
    {code:'ER1_D30_UNAPPROVED_DIRTY_STOP'});
  assert.deepEqual(h.calls,['authority','attest']);
});

test('target file hash substitution fails before lock acquisition',async()=>{
  const h=fixture();h.stageApprovedTargets=async()=>({stageId:'fixture-stage',files:{...targets,
    [PATHS[1]]:{...targets[PATHS[1]],sha256:'c'.repeat(64)}}});
  await assert.rejects(installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h}),
    {code:'ER1_D30_TARGET_BYTES_DRIFT'});
  assert.deepEqual(h.calls,['authority','attest']);
});

test('candidate PR blob staged wholesale fails when Windows PC overlay needs merge',async()=>{
  const h=fixture();h.stageApprovedTargets=async()=>({stageId:'fixture-stage',files:{...targets,
    [PATHS[1]]:{...targets[PATHS[1]],sha256:manifest.files[1].targetSha256}}});
  await assert.rejects(installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h}),
    {code:'ER1_D30_TARGET_BYTES_DRIFT'});
  assert.deepEqual(h.calls,['authority','attest']);
});

test('unverified staging preservation fails before acquiring write lease',async()=>{
  const h=fixture();h.stageApprovedTargets=async()=>({stageId:'fixture-stage',files:{...targets,
    [PATHS[1]]:{...targets[PATHS[1]],preservationVerified:false}}});
  await assert.rejects(installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h}),
    {code:'ER1_D30_TARGET_BYTES_DRIFT'});
  assert.deepEqual(h.calls,['authority','attest']);
});

test('live readback cannot accept candidate-only digest after merged install',async()=>{
  const h=fixture();h.verifyFinal=async()=>({gitHead:NEXT,configSource:NEXT,
    clean:true,protectedUnchanged:true,coreTaskRestored:true,
    fileSha256:{...Object.fromEntries(PATHS.map(p=>[p,targets[p].sha256])),
      [PATHS[1]]:manifest.files[1].targetSha256}});
  const result=await installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h});
  assert.equal(result.status,'ROLLED_BACK');
  assert.equal(result.code,'ER1_D30_FINAL_READBACK_STOP');
});

test('prewrite drift after lease stops before backup or file writes',async()=>{
  const h=fixture(),orig=h.attest;let n=0;
  h.attest=async()=>{const r=await orig();if(++n===2)r.configSource=NEXT;return r;};
  await assert.rejects(installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h}),
    {code:'ER1_D30_PREWRITE_DRIFT'});
  assert.ok(!h.calls.includes('backup')&&!h.calls.includes('apply'));
});

test('unknown error after first write causes bounded rollback, not retry',async()=>{
  const h=fixture();h.commitExactPaths=async()=>{h.calls.push('commit');
    throw Object.assign(new Error('fault'),{code:'ER1_D30_COMMIT_FAULT'});};
  const r=await installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h});
  assert.equal(r.status,'ROLLED_BACK');
  assert.equal(r.code,'ER1_D30_COMMIT_FAULT');
  assert.equal(h.calls.filter(x=>x==='apply').length,1);
  assert.equal(h.calls.filter(x=>x==='recover').length,1);
});

test('uncertain rollback leaves RECOVERY_REQUIRED, never success',async()=>{
  const h=fixture();h.casConfigSource=async()=>{throw new Error('unknown config write');};
  h.recover=async()=>({restored:false,verified:false});
  const r=await installD30ApprovedThreeFiles({approvedBManifest:manifest,host:h});
  assert.equal(r.status,'RECOVERY_REQUIRED');
  assert.equal(r.code,'ER1_D30_B_UNKNOWN');
});

test('no arbitrary host method is inferred when maintainer is absent',async()=>{
  await assert.rejects(installD30ApprovedThreeFiles({approvedBManifest:manifest,host:{}}),
    {code:'ER1_D30_HOST_CONTRACT_INCOMPLETE'});
});
