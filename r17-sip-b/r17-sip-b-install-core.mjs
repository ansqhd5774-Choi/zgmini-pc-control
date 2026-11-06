// R17 SIP premarket: source-only B install coordinator. No OS, GitHub or PC I/O.
// A registered, narrowly authorized Windows adapter MUST authenticate the exact
// Issue/manifest/run-once claim before calling this code. This module is not a
// pc-job operation or an install entry point.
import {createHash} from 'node:crypto';

export const BASELINE_SOURCE = 'd7bc4948573843766ad82c72ff392220178c36a3';
export const CANDIDATE_SOURCE = 'b30aefd89793de093369044a14d86c1fdc3b0d61';
export const SOURCE_ROOT = String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const CONFIG_PATH = String.raw`E:\ZGmini\data\pc-writer\config.json`;
export const CORE_TASK = 'ZGMINI-PC-Local-Core';
export const TARGET = Object.freeze({
  'scripts/pc-writer/us-breadth-provisional-cycle.mjs': Object.freeze({
    status:'M', beforeSha256:'c181952f9198dfa99641b3f392ff4c1b280e9766cc8da471a2c78464b9ee7626',
    targetSha256:'acaf0e46c532c49dc5a571718c2f91ddcd3dd57dbd0b50d1fb9ee350a7538cd1',
    targetBlobSha:'c531983f620d5c2315d8c0c92ea46053717ad5ca',
  }),
  'scripts/pc-writer/us-breadth-sip-premarket-cycle.mjs': Object.freeze({
    status:'A', beforeSha256:null,
    targetSha256:'4be51a9d8162a6bc90528965fd263f52371675fabb64df1ac7ae7c18948e4e59',
    targetBlobSha:'fb39479e540021e026559c85f4bbaefc1f2bfda5',
  }),
  'lib/market-breadth/us-premarket-sip-r1.mjs': Object.freeze({
    status:'A', beforeSha256:null,
    targetSha256:'a14cbad48d97895f6e4d2961e74af8ab657cd453a691552ab9f6ff675e7e7c6f',
    targetBlobSha:'0f7e044330ceee9d8fde8489ba22bceb847362b4',
  }),
});
// Scope Git cleanliness to the only paths this installation can replace.
// Unrelated work in the shared checkout must remain untouched, not block R17.
export const TARGET_STATUS_ARGS = Object.freeze([
  'status','--porcelain=v1','--untracked-files=all','--',...Object.keys(TARGET),
]);

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export class SipBStop extends Error {
  constructor(code){super(code);this.name='SipBStop';this.code=code;}
}
const requireThat=(ok,code)=>{if(!ok)throw new SipBStop(code);};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
function sameKeys(value,reference){
  return object(value)&&Object.keys(value).length===Object.keys(reference).length&&
    Object.keys(reference).every(k=>Object.hasOwn(value,k));
}
function sameTarget(value){
  return sameKeys(value,TARGET)&&Object.entries(TARGET).every(([path,expected])=>
    sameKeys(value[path],expected)&&Object.keys(expected).every(k=>value[path][k]===expected[k]));
}

// The draft is approval of the three-file *scope*, not a PC preimage proof,
// registered B adapter, or claim of successful installation.
export function validateScopeManifest(manifest){
  requireThat(object(manifest)&&manifest.schema==='ZGMINI_R17_SIP_B_SCOPE_V1'&&
    manifest.status==='SCOPE_APPROVED_PC_PREFLIGHT_PENDING'&&
    manifest.repository==='ansqhd5774-Choi/zgmini'&&
    manifest.baseSourceSha===BASELINE_SOURCE&&
    manifest.candidateSourceSha===CANDIDATE_SOURCE&&
    manifest.sourceRoot===SOURCE_ROOT&&manifest.configPath===CONFIG_PATH&&
    manifest.coreTask===CORE_TASK&&sameTarget(manifest.files)&&
    manifest.allowProviderCalls===false&&manifest.allowD1Writes===false&&
    manifest.allowDbChanges===false&&manifest.allowTaskDefinitionChanges===false&&
    manifest.allowOtherSourceChanges===false&&manifest.runCount===1,
    'SIP_B_MANIFEST_SCOPE_STOP');
  return manifest;
}

// Must be populated by a NEW read-only inspection of the actual PC, not by a
// remote GitHub HEAD. d7bc... was reported as a PC-local synthesized commit.
export function validatePcPreimage(snapshot){
  requireThat(object(snapshot)&&snapshot.sourceRoot===SOURCE_ROOT&&
    snapshot.configPath===CONFIG_PATH&&snapshot.coreTask===CORE_TASK&&
    snapshot.head===BASELINE_SOURCE&&snapshot.configSource===BASELINE_SOURCE&&
    typeof snapshot.originalBranch==='string'&&
    /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(snapshot.originalBranch)&&
    !snapshot.originalBranch.includes('..')&&
    !snapshot.originalBranch.endsWith('/')&&
    snapshot.targetPathsClean===true&&snapshot.coreTaskEnabled===true&&
    sameKeys(snapshot.existingSha256,{
      'scripts/pc-writer/us-breadth-provisional-cycle.mjs':''})&&
    snapshot.existingSha256['scripts/pc-writer/us-breadth-provisional-cycle.mjs']===
      TARGET['scripts/pc-writer/us-breadth-provisional-cycle.mjs'].beforeSha256&&
    Array.isArray(snapshot.absent)&&snapshot.absent.length===2&&
    Object.keys(TARGET).filter(p=>TARGET[p].status==='A').every(p=>snapshot.absent.includes(p)),
    'SIP_B_PC_PREIMAGE_STOP');
  return snapshot;
}

// Validate bytes from an exact GitHub candidate checkout, with no API calls.
// The checkout identity/cleanliness is checked by the Windows adapter.
export function validateCandidateBytes(bytesByPath){
  requireThat(sameKeys(bytesByPath,TARGET),'SIP_B_CANDIDATE_PATHS_STOP');
  for(const [path,expected] of Object.entries(TARGET)){
    const bytes=bytesByPath[path];
    requireThat(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=2_000_000&&
      sha256(bytes)===expected.targetSha256,'SIP_B_CANDIDATE_BYTES_STOP');
  }
  return true;
}

export function validateCandidateInspection(inspection){
  requireThat(object(inspection)&&inspection.sourceSha===CANDIDATE_SOURCE&&
    inspection.clean===true&&sameKeys(inspection.filesSha256,TARGET)&&
    Object.entries(TARGET).every(([path,expected])=>
      inspection.filesSha256[path]===expected.targetSha256),
    'SIP_B_CANDIDATE_INSPECTION_STOP');
  return inspection;
}

// The Windows adapter supplies exclusively scoped methods backed by the same
// shared Writer lock and existing 1-shot journal. It must never use a remote
// shell; the supplied methods must act only on these exact files/source/config.
// Do not call this function until Windows B registration and event authorization
// are separately completed. A failed read-only preflight consumes no claim.
export async function performAuthorizedInstall(auth,io){
  requireThat(auth?.registeredB===true&&auth?.exactOneShot===true&&
    auth?.manifestSha256&&/^[a-f0-9]{64}$/.test(auth.manifestSha256)&&
    typeof auth?.requestId==='string'&&auth.requestId.length>0,
    'SIP_B_NOT_REGISTERED_OR_AUTHORIZED_STOP');
  requireThat(object(io),'SIP_B_IO_STOP');
  let acquired=false,claimed=false,quiesced=false,switched=false,configChanged=false;
  let retainSharedLock=false;
  let before=null,prepared=null;
  try{
    await io.acquireSharedWriterLock();acquired=true;
    before=validatePcPreimage(await io.inspectPcPreimage());
    // The adapter must hash *actual* bytes from a pinned, clean candidate
    // checkout. Hash receipt is verified here; source I/O remains in adapter.
    validateCandidateInspection(await io.inspectPinnedCandidate(CANDIDATE_SOURCE));
    await io.claimOnce(auth.requestId);claimed=true;
    await io.backupExactSourceAndConfig(before);
    prepared=await io.prepareIsolatedExactThreeFileCommit(BASELINE_SOURCE,CANDIDATE_SOURCE,TARGET);
    requireThat(sha40(prepared?.commit)&&prepared.commit!==BASELINE_SOURCE&&
      prepared.parent===BASELINE_SOURCE&&prepared.clean===true&&
      prepared.onlyThreeFiles===true,'SIP_B_PREPARED_SCOPE_STOP');
    // The pause may disable Core and then fail while journaling. Mark intent
    // before the call so recovery always verifies/restores its exact state.
    quiesced=true;
    await io.pauseCoreWithoutDefinitionChange();
    await io.waitForCoreDrain();
    await io.assertCoreQuiet();
    switched=true;
    await io.switchToPreparedCommit(prepared.commit);
    await io.assertExactThreeFileSource(prepared.commit,TARGET);
    configChanged=true;
    await io.replaceConfigSourceOnly(BASELINE_SOURCE,prepared.commit);
    await io.assertConfigSource(prepared.commit);
    await io.restoreCoreExactState(before);
    quiesced=false;
    await io.assertCoreExactState(before);
    await io.assertExactThreeFileSource(prepared.commit,TARGET);
    await io.assertConfigSource(prepared.commit);
    return {status:'SIP_B_INSTALLED_VERIFIED',sourceSha:prepared.commit,requestId:auth.requestId};
  }catch(err){
    // Post-switch faults must be handled by the scoped adapter, including
    // never altering a live source under an enabled Core. Ambiguous state is
    // STOP + manual reconciliation, not an automatic duplicate run.
    const code=err instanceof SipBStop?err.code:'SIP_B_DRIVER_STOP';
    if(!claimed)return {status:'SIP_B_PREFLIGHT_STOP',code};
    let recovery='NOT_NEEDED';
    try{
      if(switched||configChanged){
        await io.assertCoreQuiet();
        if(configChanged)await io.restoreConfigExactly(before);
        if(switched)await io.restoreOriginalSourceExactly(before,prepared);
        await io.assertOriginalSourceAndConfig(before);
      }
      if(quiesced){await io.restoreCoreExactState(before);await io.assertCoreExactState(before);}
    }catch{recovery='MANUAL_RECONCILIATION_REQUIRED';}
    retainSharedLock=recovery!=='NOT_NEEDED';
    return {status:retainSharedLock?'SIP_B_RECOVERY_REQUIRED':'SIP_B_INSTALL_STOP',code,recovery};
  }finally{
    if(acquired)await io.releaseSharedWriterLock({retain:retainSharedLock});
  }
}
