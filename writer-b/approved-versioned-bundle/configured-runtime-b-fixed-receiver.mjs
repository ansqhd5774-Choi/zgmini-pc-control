// Fixed Windows receiver for the existing configured-theme package upgrader.
// The deployed receiver has NO arbitrary command/path interface. The only
// default compatibility provider intentionally refuses unproven old/new state.
// Package staging is restricted to RUNNER_TEMP; operational writes happen
// solely inside the existing feature package runner, after a Writer B claim.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {loadApprovedRaw,verifyPinnedSourceCheckout}
  from '../../direct-writer-b/run.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
  from '../../r17-writer-b/r17-b-claim.mjs';

const SOURCE_REPO='ansqhd5774-Choi/zgmini';
const DATA_ROOT='E:/ZGmini/data';
const WRITER_HOME=path.join(DATA_ROOT,'pc-writer');
const SHARED_LOCK=path.join(WRITER_HOME,'writer-source-install.lock');
const JOURNALS=path.join(WRITER_HOME,'writer-b-install-once');
const MOD='scripts/pc-writer/theme-config-package-runner.mjs';
const BUILDER='scripts/pc-writer/theme-config-package-build.mjs';
const INSTALL='scripts/pc-writer/theme-config-install.mjs';
const HOME=path.join(WRITER_HOME,'theme-config-tool');
const MANUAL=Object.freeze([
  ['THEME_REGISTER.cmd','--import',true],
  ['THEME_LIST.cmd','--list',false],
  ['THEME_UPDATE.cmd','--interactive-cycle',false],
]);
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};
function regular(file){
  const st=fs.lstatSync(file);
  need(st.isFile()&&!st.isSymbolicLink(),'B_FIXED_FILE_REDIRECT');
  return fs.readFileSync(file);
}
function directory(dir){
  const resolved=path.resolve(dir);
  const st=fs.lstatSync(resolved);
  need(st.isDirectory()&&!st.isSymbolicLink()&&
    fs.realpathSync(resolved)===resolved,'B_FIXED_DIRECTORY_REDIRECT');
  return resolved;
}
const moduleAt=(root,relative)=>import(pathToFileURL(
  path.join(root,...relative.split('/'))).href);
const defaultCompatibility=async()=>fail('B_WINDOWS_CROSS_VERSION_PROOF_PENDING');

// DI exists only for bounded offline tests; the production default below
// passes fixed Node/Windows functions and a fail-closed proof provider.
export function createFixedConfiguredReceiver({
  env=process.env,platform=process.platform,
  authorize=loadApprovedRaw,
  pinCheckout=verifyPinnedSourceCheckout,
  importModule=moduleAt,
  verifyCrossVersion=defaultCompatibility,
  claim=acquireInstallLock,consumeClaim=createInstallJournal,
  release=releaseInstallClaim,
}={}){
  let approved=null,sourceRoot=null,feature=null,sourceInstall=null;
  let baseline=null,claimHandle=null,claimRequest=null;
  const controlRoot=path.join(env.GITHUB_WORKSPACE??'','generic-b-control');
  const candidateRoot=path.join(env.GITHUB_WORKSPACE??'','generic-b-approved-source');
  function currentApproval(requestId){
    need(platform==='win32','B_FIXED_WINDOWS_REQUIRED');
    need(typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
      'B_FIXED_TEMP_REQUIRED');
    const event=JSON.parse(regular(env.GITHUB_EVENT_PATH).toString('utf8'));
    const auth=authorize({event,env,controlRoot});
    need(auth.mode==='CONFIGURED_THEMES_REPEAT_UPGRADE'&&
      auth.request.requestId===requestId,'B_FIXED_APPROVAL_SCOPE');
    pinCheckout(auth,{sourceRoot:candidateRoot});
    return auth;
  }
  const receiver={
    async verifyApprovedPackage(requestId){
      need(approved===null,'B_FIXED_ALREADY_LOADED');
      const auth=currentApproval(requestId);
      sourceRoot=directory(candidateRoot);
      const builder=await importModule(sourceRoot,BUILDER);
      need(typeof builder.buildConfiguredPackage==='function',
        'B_FIXED_APPROVED_PACKAGE_BUILDER');
      const temp=directory(env.RUNNER_TEMP);
      const outputDir=fs.mkdtempSync(path.join(temp,'zgmini-runtime-b-'));
      let built;
      try{built=builder.buildConfiguredPackage({
        sourceSha:auth.manifest.sourceSha,outputDir});}
      catch{fail('B_FIXED_PACKAGE_BUILD_STOP');}
      need(built?.sourceSha===auth.manifest.sourceSha&&
        built.manifestSha256===auth.manifest.packageManifestSha256&&
        built.status==='PACKAGE_BUILT_NO_PC_WRITES'&&
        typeof built.packageRoot==='string'&&
        built.packageRoot.startsWith(outputDir+path.sep),
      'B_FIXED_PACKAGE_APPROVAL_MISMATCH');
      approved={repository:SOURCE_REPO,runnerPath:MOD,
        effect:'CONFIGURED_THEMES_REPEAT_UPGRADE',
        requestId,sourceSha:auth.manifest.sourceSha,
        approvalSha256:sha(auth.raw),
        packageManifestSha256:built.manifestSha256,
        packageRoot:built.packageRoot};
      return Object.freeze({...approved});
    },
    async verifyWindowsCompatibility(approval){
      need(approved&&approval.requestId===approved.requestId&&
        approval.sourceSha===approved.sourceSha,
      'B_FIXED_APPROVAL_CHANGED');
      const module=await importModule(sourceRoot,MOD);
      need(typeof module.inspectConfiguredPackage==='function',
        'B_FIXED_INSPECTOR_ABSENT');
      const current=module.inspectConfiguredPackage({
        packageRoot:approval.packageRoot,dataRoot:DATA_ROOT});
      const active=regular(path.join(HOME,'ACTIVE_RUNTIME.json'));
      const expected=currentApproval(approval.requestId).manifest.runtimePreimage;
      need(current.taskState===3&&
        current.oldCmdSha256===expected.scheduledCmdSha256&&
        current.oldVbsSha256===expected.scheduledVbsSha256&&
        current.taskXmlSha256===expected.taskXmlSha256&&
        sha(active)===expected.activeRuntimeSha256,
      'B_FIXED_WINDOWS_PREIMAGE_DRIFT');
      const manual=new Map(MANUAL.map(([name])=>[name,
        sha(regular(path.join(HOME,name)))]));
      const original=sha(regular(path.join(HOME,'INSTALL_RESULT.json')));
      // Hashes/READY alone do not prove old/new DB and checkpoint safety.
      // The proof provider must independently run/attest an isolated Windows
      // old->new and new->old fixture, including the shared lock race.
      const proof=await verifyCrossVersion({approval,
        current,sourceRoot,packageRoot:approval.packageRoot,
        oldActiveBytes:active,oldManualHashes:manual});
      need(proof?.trustedRunnerVerified===true&&
        /^[a-f0-9]{64}$/.test(proof.evidenceSha256??'')&&
        proof.oldVersion===current.oldVersion&&
        proof.newSourceSha===approval.sourceSha&&
        proof.taskXmlSha256===current.taskXmlSha256,
      'B_FIXED_CROSS_VERSION_PROOF_UNVERIFIED');
      feature=module;
      baseline={oldVersion:current.oldVersion,
        taskXmlSha256:current.taskXmlSha256,
        activeSha256:sha(active),scheduledCmdSha256:current.oldCmdSha256,
        scheduledVbsSha256:current.oldVbsSha256,
        originalSha256:original,manual};
      return {os:'win32',runtimeMode:'REPEATABLE_ACTIVE_RUNTIME',
        sourceSha:approval.sourceSha,
        taskXmlSha256:current.taskXmlSha256,
        activeRuntimeSha256:baseline.activeSha256,
        scheduledCmdSha256:current.oldCmdSha256,
        scheduledVbsSha256:current.oldVbsSha256,
        compatibilityEvidenceSha256:proof.evidenceSha256};
    },
    async loadPinnedPackageRunner(approval){
      need(feature&&baseline&&approved?.requestId===approval.requestId,
        'B_FIXED_WINDOWS_PROOF_REQUIRED');
      const parsed=feature.verifyConfiguredPackage(approval.packageRoot);
      need(parsed.sourceSha===approval.sourceSha&&
        parsed.manifestSha256===approval.packageManifestSha256,
      'B_FIXED_SOURCE_PACKAGE_DRIFT');
      return {sourceSha:parsed.sourceSha,
        packageManifestSha256:parsed.manifestSha256,
        runConfiguredPackage:feature.runConfiguredPackage};
    },
    async acquireSharedWriterLease({approval,windows}){
      need(!claimHandle&&baseline&&
        approval.requestId===approved.requestId&&
        windows.taskXmlSha256===baseline.taskXmlSha256,
      'B_FIXED_CLAIM_PRECONDITION');
      directory(WRITER_HOME);
      // The shared lease protects feature preflight too; the requestId is
      // consumed only once that preflight succeeds, in the next method.
      claimRequest=approval.requestId;
      claimHandle=claim({journalRoot:JOURNALS,
        requestId:claimRequest,sharedLock:SHARED_LOCK});
      return {requestId:claimRequest,ownerVerified:true};
    },
    async consumeOneShotAuthorization({approval,windows,preflight}){
      need(claimHandle&&claimRequest===approval.requestId&&baseline&&
        windows.taskXmlSha256===baseline.taskXmlSha256&&
        preflight.status==='PREFLIGHT_PASS',
      'B_FIXED_ONESHOT_PRECONDITION');
      consumeClaim({journalRoot:JOURNALS,requestId:claimRequest,
        sharedLock:SHARED_LOCK,fd:claimHandle.fd});
      const receiptSha256=sha(Buffer.from(JSON.stringify({
        requestId:claimRequest,sourceSha:approval.sourceSha,
        approvalSha256:approval.approvalSha256,
        taskXmlSha256:baseline.taskXmlSha256})));
      return {requestId:claimRequest,
        approvalSha256:approval.approvalSha256,
        sourceSha:approval.sourceSha,receiptSha256};
    },
    async verifyInstalledReadback({approval,windows,result}){
      need(claimHandle&&baseline&&feature&&
        result.sourceSha===approval.sourceSha,
      'B_FIXED_READBACK_CLAIM_REQUIRED');
      const active=JSON.parse(regular(path.join(HOME,'ACTIVE_RUNTIME.json')));
      const now=feature.inspectConfiguredPackage({
        packageRoot:approval.packageRoot,dataRoot:DATA_ROOT});
      need(active.sourceSha===approval.sourceSha&&
        active.version===now.oldVersion&&
        active.version!==baseline.oldVersion&&
        now.taskState===3&&
        now.taskXmlSha256===windows.taskXmlSha256&&
        now.oldVbsSha256===baseline.scheduledVbsSha256&&
        sha(regular(path.join(HOME,'INSTALL_RESULT.json')))===
          baseline.originalSha256,
      'B_FIXED_READBACK_DRIFT');
      const installer=await importModule(sourceRoot,INSTALL);
      let changed=0;
      for(const [name,mode,argument] of MANUAL){
        const expected=installer.configuredManualCommand({
          dataRoot:DATA_ROOT,home:HOME,
          version:active.version,mode,argument});
        need(regular(path.join(HOME,name)).equals(Buffer.from(expected)),
          'B_FIXED_MANUAL_LAUNCHER_DRIFT');
        changed++;
      }
      // Require exact old bytes in the recovery backup, not only a backup
      // path string or a successful return code.
      const backups=directory(result.backup);
      need(path.dirname(backups)===path.join(HOME,'backups')&&
        sha(regular(path.join(backups,'THEME_SCHEDULED.cmd')))===
          baseline.scheduledCmdSha256,
      'B_FIXED_BACKUP_DRIFT');
      for(const [name,expectedSha] of baseline.manual){
        need(sha(regular(path.join(backups,name)))===expectedSha,
          'B_FIXED_MANUAL_BACKUP_DRIFT');
      }
      return {status:'VERIFIED',sourceSha:approval.sourceSha,
        packageManifestSha256:approval.packageManifestSha256,
        taskXmlSha256:now.taskXmlSha256,
        activeRuntimeVersion:active.version,
        manualCommandsVerified:changed,rollbackRecordVerified:true};
    },
    async releaseSharedWriterLease({requestId,retain}){
      need(claimHandle&&claimRequest===requestId,
        'B_FIXED_NO_OWNED_CLAIM');
      const journal=path.join(claimHandle.journalDir,'journal.jsonl');
      if(fs.existsSync(journal)){
        fs.appendFileSync(journal,JSON.stringify({
          status:retain?'STATE_UNKNOWN':'CLOSED',
          at:new Date().toISOString()})+'\n');
      }
      // The caller keeps the mutex leaf for an uncertain effect so that a
      // later job cannot overwrite an uninspected runtime. The journal is
      // always preserved and the exact fd is closed only by its owner.
      release({fd:claimHandle.fd,sharedLock:SHARED_LOCK,
        requestId,retain:retain===true});
      claimHandle=null;
      return {status:retain?'RETAINED_FOR_RECONCILIATION':'RELEASED',requestId};
    },
  };
  return receiver;
}

export default createFixedConfiguredReceiver();
