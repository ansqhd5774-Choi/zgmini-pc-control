// Isolated design fixture. NEVER import this into an installed Controller.
// The production independent-maintainer integration must separately review
// approvals, backups, rollback, inventory and Windows process ownership.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const R6_SOURCE_FILES=Object.freeze([
  'lib/market-score/employment-r4-shadow-contract.mjs',
  'lib/market-score/employment-r6-contract.mjs',
  'lib/market-score/employment-r6-feature-engine.mjs',
  'lib/market-score/employment-r6-formula.mjs',
  'lib/market-score/employment-r6-observation-reader.mjs',
  'lib/market-score/employment-r6-one-year-read-model.mjs',
  'lib/market-score/employment-r6-scheduler.mjs',
  'lib/market-score/employment-r6-window.mjs',
  'scripts/pc-writer/d1-diagnostics.mjs',
  'scripts/pc-writer/d1-transient.mjs',
  'scripts/pc-writer/d1.mjs',
  'scripts/pc-writer/employment-r6-candidate-locator.mjs',
  'scripts/pc-writer/employment-r6-one-year-stage.mjs',
  'scripts/pc-writer/employment-r6-pit-coverage.mjs',
  'scripts/pc-writer/employment-r6-runner-stage.mjs',
  'worker/employment-r6-public-display.mjs',
]);
const ENTRY='scripts/pc-writer/employment-r6-runner-stage.mjs';
const SOURCE_BRANCH='codex/employment-1y-reader-r1';
const OP='employment-r6-candidate-stage-readonly';
export const R6_EXACT_SOURCE_SHA='afdd8fab1c03b321e4b8b0853bb236c0800a0a14';
export const R6_CANONICAL_MANIFEST_SHA256='42afb8fe4f0ecdeb551256ec897bb99b1e850420dd0f5bc7b74ec03db2f46c81';
const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const stop=code=>{throw Object.assign(Error(code),{code});};
const pathKey=x=>path.normalize(x).replace(/[\\/]+$/,'').toLowerCase();
const requireRealDirectory=(dir,code)=>{
  let stat,real;
  try{stat=fs.lstatSync(dir);real=fs.realpathSync.native(dir);}
  catch{stop(code);}
  // Reject C: compatibility junctions, symlinked staging parents and aliases.
  if(!stat.isDirectory()||stat.isSymbolicLink()||
    pathKey(path.resolve(dir))!==pathKey(real))stop(code);
};
const requireWithin=(root,file,code)=>{
  const rel=path.relative(root,file);
  if(!rel||rel==='..'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel))stop(code);
};

const sameEntries=(keys,expected)=>keys.length===expected.length&&
  [...keys].sort().every((p,i)=>p===[...expected].sort()[i]);

/** Build a proposed host overlay and an isolated sealed source directory.
 * This function does not open, overwrite or edit the PC host.json or SQLite.
 * `sourceFiles` bytes must come from an already verified exact commit.
 * `expectedFileHashes` must be bound to the separately B-approved manifest.
 */
function buildR6HostOverlay({installedHost,sourceFiles,manifestBytes,
  sourceSha,candidatePath,corePath,stageRoot},{allowSyntheticFixture=false}={}){
  if(!SHA40.test(sourceSha??'')||sourceSha!==R6_EXACT_SOURCE_SHA)stop('R6_SOURCE_SHA_NOT_APPROVED');
  if(!installedHost||typeof installedHost!=='object'||Array.isArray(installedHost)
    ||!installedHost.approvedSources||!installedHost.controllerSourceSha
    ||!path.isAbsolute(stageRoot??''))stop('R6_HOST_INPUT_INVALID');
  requireRealDirectory(stageRoot,'R6_STAGE_PARENT_ALIAS_OR_MISSING');
  if(Object.hasOwn(installedHost.approvedSources,sourceSha))stop('R6_BUNDLE_ALREADY_REGISTERED');
  if(corePath!==undefined)stop('R6_CORE_OVERRIDE_FORBIDDEN');
  const approvedCore=path.join(installedHost.dataRoot??'','pc-writer','storage','core.sqlite');
  if(!path.isAbsolute(installedHost.dataRoot??''))stop('R6_HOST_DATA_ROOT_INVALID');
  if(!sourceFiles||!sameEntries(Object.keys(sourceFiles),R6_SOURCE_FILES))stop('R6_FILE_LIST_MISMATCH');
  if(!Buffer.isBuffer(manifestBytes))stop('R6_MANIFEST_BYTES_REQUIRED');
  if(!allowSyntheticFixture&&hash(manifestBytes)!==R6_CANONICAL_MANIFEST_SHA256)stop('R6_CANONICAL_MANIFEST_DRIFT');
  let approvedManifest;
  try{approvedManifest=JSON.parse(manifestBytes.toString('utf8'));}
  catch{stop('R6_MANIFEST_INVALID');}
  if(approvedManifest.schema!=='ZGMINI_R6_SOURCE_BUNDLE_DRAFT_V1'
    ||approvedManifest.sourceRepository!=='ansqhd5774-Choi/zgmini'
    ||approvedManifest.sourceSha!==R6_EXACT_SOURCE_SHA
    ||approvedManifest.sourceBranch!==SOURCE_BRANCH||approvedManifest.entrypoint!==ENTRY
    ||!approvedManifest.files
    ||!sameEntries(Object.keys(approvedManifest.files),R6_SOURCE_FILES))stop('R6_MANIFEST_CONTRACT_MISMATCH');
  const expectedFileHashes=approvedManifest.files;
  if(!path.isAbsolute(candidatePath??'')
    ||path.basename(candidatePath)!=='EMPLOYMENT_R6_CANDIDATE.sqlite'
    )stop('R6_CANDIDATE_PATH_INVALID');
  if(Object.hasOwn(installedHost,'employmentR6CandidatePath')
    &&installedHost.employmentR6CandidatePath!==candidatePath)stop('R6_HOST_CANDIDATE_OVERWRITE_FORBIDDEN');
  let core,candidate;
  try{
    core=fs.statSync(approvedCore,{bigint:true});candidate=fs.statSync(candidatePath,{bigint:true});
    if(!core.isFile()||!candidate.isFile()||fs.realpathSync(approvedCore)===fs.realpathSync(candidatePath)
      ||core.dev===candidate.dev&&core.ino===candidate.ino)stop('R6_CANDIDATE_CORE_ALIAS');
  }catch(error){if(error?.code==='R6_CANDIDATE_CORE_ALIAS')throw error;stop('R6_SOURCE_PATH_UNAVAILABLE');}

  const manifestFiles={};
  for(const rel of R6_SOURCE_FILES){
    const bytes=sourceFiles[rel];
    const expected=expectedFileHashes[rel];
    if(!Buffer.isBuffer(bytes)||!SHA256.test(expected??'')||hash(bytes)!==expected)
      stop('R6_SOURCE_BYTES_DRIFT');
    manifestFiles[rel]=expected;
  }

  const stageBundle=path.join(stageRoot,'r6-bundle-'+sourceSha);
  requireWithin(stageRoot,stageBundle,'R6_STAGE_PATH_ESCAPE');
  if(fs.existsSync(stageBundle))stop('R6_STAGE_ALREADY_EXISTS');
  // Existing installed bundle paths never enter the write loop.
  fs.mkdirSync(stageBundle,{recursive:false});
  fs.mkdirSync(path.join(stageBundle,'source'));
  requireRealDirectory(stageBundle,'R6_STAGE_CREATED_ALIAS');
  for(const rel of R6_SOURCE_FILES){
    const dest=path.join(stageBundle,'source',rel);
    requireWithin(path.join(stageBundle,'source'),dest,'R6_SOURCE_STAGE_ESCAPE');
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    requireRealDirectory(path.dirname(dest),'R6_SOURCE_PARENT_ALIAS');
    fs.writeFileSync(dest,sourceFiles[rel],{flag:'wx'});
    if(hash(fs.readFileSync(dest))!==manifestFiles[rel])stop('R6_STAGE_FILE_READBACK_MISMATCH');
  }
  // The runner's R6 validator checks the SHA-256 of these exact bytes.
  fs.writeFileSync(path.join(stageBundle,'manifest.json'),manifestBytes,{flag:'wx'});
  const rawManifestHash=hash(fs.readFileSync(path.join(stageBundle,'manifest.json')));

  // Preserve existing approvedSources, controllerFiles, seat/operation settings.
  const proposed=structuredClone(installedHost);
  proposed.approvedSources[sourceSha]={root:stageBundle,branch:SOURCE_BRANCH,
    entrypoint:ENTRY,manifestSha256:rawManifestHash};
  proposed.employmentR6CandidatePath=candidatePath;
  if(JSON.stringify(proposed.approvedSources[sourceSha])!==JSON.stringify({
    root:stageBundle,branch:SOURCE_BRANCH,entrypoint:ENTRY,manifestSha256:rawManifestHash,
  }))stop('R6_HOST_OVERLAY_INVALID');
  return {stageBundle,proposedHost:proposed,sourceSha,operation:OP,
    fileCount:R6_SOURCE_FILES.length,manifestSha256:rawManifestHash,
    candidateIdentity:{realpath:fs.realpathSync(candidatePath),dev:String(candidate.dev),
      ino:String(candidate.ino),size:String(candidate.size)},
    existingApprovalsPreserved:JSON.stringify(installedHost.approvedSources)===
      JSON.stringify(Object.fromEntries(Object.entries(proposed.approvedSources)
        .filter(([sha])=>sha!==sourceSha))),
  };
}

/** Production path: only the exact current B-approved R6 manifest is accepted. */
export function draftR6HostRegistration(input){return buildR6HostOverlay(input);}

/** Test-only entrypoint: synthetic 16-file fixtures exercise byte protection.
 * It is never wired into Controller/maintainer/host registration. */
export function simulateR6HostRegistrationFixture(input){
  return buildR6HostOverlay(input,{allowSyntheticFixture:true});
}
