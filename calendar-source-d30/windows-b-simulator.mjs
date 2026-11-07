// ER1 D+30: evidence-pinned, SOURCE-ONLY manifest draft and in-memory B test.
// Never a PC installer, approval artifact, workflow, Controller or scheduler.
// The historic #590 calendar B implementation remains entirely untouched.
import {D30_INSTALL_CONTRACT,assessD30SourceInstall} from './contract.mjs';
import {D30_WINDOWS_SOURCE_ROOT} from './windows-preview.mjs';
import {installD30ApprovedThreeFiles} from './install-core.mjs';

const PATHS=D30_INSTALL_CONTRACT.operationalFiles.map(f=>f.path);
const AFTER=Object.freeze({
  'lib/earnings-api-calendar.mjs':
    'e48d4ea5da65d2b72b070e54bb41103486e730c38b8c040215388a9b57af39cb',
  'scripts/pc-writer/earnings-api-local.mjs':
    'a686bf736c9a5ae274cd2dc69dd169e93ddab90f72ae273c45e765c788226ce8',
  'scripts/pc-writer/release-calendar.mjs':
    '1f7186cad2240839a432bd6ac9351c83762334b38a988d27d971cb4ffe647f1b',
});
const BEFORE=Object.freeze({
  'lib/earnings-api-calendar.mjs':
    'e5c0fdfaddd8048fcb7e79c40f9d39185c75efbe73e7f6b62752073f14b23b3f',
  'scripts/pc-writer/earnings-api-local.mjs':
    'f80bced7233ba9da5511a73bf324ae73a4a7c505ecf1ce9f690cb412b98b1b62',
  'scripts/pc-writer/release-calendar.mjs':
    '3fa8e1039fcedd3b2fb07b888996f845c6b7102505acdba7608818cb56238871',
});
const PREVIEW_REQUEST='pc-calendar-d30-b44e1ad9-f87a-4030-bf7a-07a4ba645524';
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};

/** Verified #682 read-only result. No raw PC bytes or secret values. */
export function makeD30BManifestDraft(){
  return {
    status:'AWAITING_PROVENANCE_AND_SEPARATE_B_APPROVAL',
    scope:D30_INSTALL_CONTRACT.scope,
    sourceHead:D30_INSTALL_CONTRACT.sourceHead,
    sourceRoot:D30_WINDOWS_SOURCE_ROOT,
    beforeSourceSha:null, // #682 did NOT establish Task/config/checkpoint provenance.
    approvalEvidence:null, // #682 preview is NOT an operational B approval.
    previewEvidence:{issue:682,requestId:PREVIEW_REQUEST,
      actionsRun:42386747409,sourceProvenance:'PENDING'},
    files:D30_INSTALL_CONTRACT.operationalFiles.map(f=>{
      const beforeSha256=BEFORE[f.path];
      const afterSha256=AFTER[f.path];
      return {path:f.path,beforeSha256,
        targetBlob:f.targetBlob,targetSha256:f.targetSha256,afterSha256,
        ...(beforeSha256!==f.baseSha256?{mergePreview:{
          status:'CLEAN_PRESERVED_VERIFIED',beforeSha256,
          baseSha256:f.baseSha256,candidateSha256:f.targetSha256,
          afterSha256,conflictCount:0,preservedVerified:true,sourceWrites:0,
          evidenceIssue:682,evidenceRequestId:PREVIEW_REQUEST}}:{})};
    }),
  };
}

/** Check independently approved B values against fixed #682 byte evidence. */
export function assessD30BApprovedEvidence({approvedBManifest,activeCore,
  installedFileHashes}={}){
  const draft=makeD30BManifestDraft();
  if(!approvedBManifest||!Array.isArray(approvedBManifest.files)||
      approvedBManifest.files.length!==PATHS.length)
    return {status:'BLOCKED',code:'ER1_D30_B_APPROVAL_MISSING'};
  for(const [i,file] of approvedBManifest.files.entries()){
    const fixed=draft.files[i];
    if(file.path!==fixed.path||file.beforeSha256!==fixed.beforeSha256||
       file.targetSha256!==fixed.targetSha256||file.targetBlob!==fixed.targetBlob||
       file.afterSha256!==fixed.afterSha256||
       JSON.stringify(file.mergePreview??null)!==JSON.stringify(fixed.mergePreview??null))
      return {status:'BLOCKED',code:'ER1_D30_B_PREVIEW_EVIDENCE_DRIFT'};
  }
  return assessD30SourceInstall({approvedBManifest,activeCore,installedFileHashes});
}

/**
 * A model of the existing calendar B transaction protocol, not a Windows
 * implementation. It stores only SHA state and synthetic backup/commit IDs.
 * Positive results explicitly mean SIMULATED, never installed or approved.
 */
export async function simulateD30BTransaction({approvedBManifest,activeCore,
  installedFileHashes={...BEFORE},sharedLeaseGranted=false,
  coreQuiesced=false,failAt=null}={}){
  const eligible=assessD30BApprovedEvidence({approvedBManifest,activeCore,
    installedFileHashes});
  if(eligible.status!=='READY_FOR_SEPARATE_APPROVED_B_INSTALL')
    return {status:'SIMULATION_BLOCKED',code:eligible.code,
      operationalWrites:0,sourceProvenance:'NOT_CLAIMED'};
  const before=approvedBManifest.beforeSourceSha;
  const committed='b'.repeat(40); // Synthetic only, NEVER a real Git SHA.
  need(committed!==before,'ER1_D30_SIM_COMMIT_FIXTURE_STOP');
  let head=before,config=before;
  let files={...installedFileHashes};
  let backup=null,applied=false,changes=0;
  const stageId='SIMULATED_PRIVATE_EXACT_STAGE';
  const staged=Object.fromEntries(approvedBManifest.files.map(f=>[f.path,{
    sha256:f.afterSha256,candidateSha256:f.targetSha256,
    blob:f.targetBlob,preservationVerified:true}]));
  const host={
    async verifyAuthority(){
      need(approvedBManifest.approvalEvidence?.trim(),
        'ER1_D30_SIM_APPROVAL_STOP');
    },
    async attest(){return {activeCore,installedFileHashes:{...files},
      sourceRoot:D30_WINDOWS_SOURCE_ROOT,gitHead:head,configSource:config,
      trackedDirty:[],stagedPaths:[],
      coreShaConsumers:['CORE_PUBLISHER','CNN_ARCHIVE_SIDECAR']};},
    async stageApprovedTargets(){return {stageId,files:staged};},
    async verifyExclusiveLease(){
      need(sharedLeaseGranted===true,'ER1_D30_SIM_SHARED_LEASE_STOP');
    },
    async verifyCoreQuiesced(){
      need(coreQuiesced===true,'ER1_D30_SIM_CORE_BUSY_STOP');
    },
    async snapshotOriginal(){backup={head,config,files:{...files}};
      return {backupId:'SIMULATED_EXACT_BACKUP',readbackVerified:true};},
    async applyStagedExactPaths(paths,id){
      need(id===stageId&&paths.join('|')===PATHS.join('|'),
        'ER1_D30_SIM_STAGE_ID_STOP');
      files=Object.fromEntries(PATHS.map(p=>[p,staged[p].sha256]));
      applied=true;changes++;
      return {updatedPaths:PATHS};
    },
    async commitExactPaths(){
      if(failAt==='commit')stop('ER1_D30_SIM_COMMIT_FAULT');
      need(applied,'ER1_D30_SIM_NO_STAGE_STOP');head=committed;changes++;
      return {sha:committed,changedPaths:PATHS,clean:true,
        protectedUnchanged:true};
    },
    async casConfigSource(oldSha,newSha){
      need(config===oldSha&&head===newSha,'ER1_D30_SIM_CONFIG_CAS_STOP');
      config=newSha;changes++;
      return {sourceSha:newSha};
    },
    async verifyFinal(){return {gitHead:head,configSource:config,
      clean:true,protectedUnchanged:true,coreTaskRestored:true,
      fileSha256:{...files}};},
    async recover(id){
      need(backup&&id==='SIMULATED_EXACT_BACKUP',
        'ER1_D30_SIM_BACKUP_MISSING');
      ({head,config}=backup);files={...backup.files};changes++;
      return {restored:true,verified:true};
    },
  };
  const r=await installD30ApprovedThreeFiles({approvedBManifest,host})
    .catch(error=>({status:'SIMULATION_STOPPED',code:error.code??
      'ER1_D30_SIM_UNKNOWN_STOP'}));
  return {status:r.status==='SOURCE_INSTALLED_VERIFIED'?
      'SIMULATED_B_TRANSACTION_VERIFIED':
      r.status==='ROLLED_BACK'?'SIMULATED_ROLLED_BACK':
      r.status==='RECOVERY_REQUIRED'?'SIMULATED_RECOVERY_REQUIRED':
      'SIMULATION_BLOCKED',
    code:r.code??null,simulatedOnly:true,
    operationalWrites:0,syntheticStateTransitions:changes,
    backupObserved:backup!==null,
    stateRestored:r.status==='ROLLED_BACK'&&head===before&&config===before&&
      PATHS.every(p=>files[p]===installedFileHashes[p])};
}
