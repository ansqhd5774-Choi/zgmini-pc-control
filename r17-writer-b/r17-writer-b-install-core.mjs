// R17 Writer B installation coordinator. No OS, GitHub or PC I/O here.
// The caller MUST supply a purpose-built approved Windows adapter; this is not
// a generic pc-job shell, Controller updater, or self-running script.
import {createHash} from 'node:crypto';

export const BASE = 'a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e';
export const CANDIDATE = '81c8ee543c164fc16c8c760d504b113428d01d4a';
export const PATCH_HASH = '728a4887bd4c81c52b01f1a8f5de6b506dd009a37d68b1d9269cd7c19ec7c706';
export const CORE_XML_HASH = 'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028';
export const SOURCE_ROOT = String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const CONFIG_PATH = String.raw`E:\ZGmini\data\pc-writer\config.json`;
export const CORE_TASK = 'ZGMINI-PC-Local-Core';
export const BEFORE = Object.freeze({
  'scripts/pc-writer/local-cycle.mjs': '9c3fc7788907a2f8756b7ff82c372124a2e26253557b7db8a93eb6c8428eadee',
  'scripts/pc-writer/run-local.mjs': '4370f6f725b0a9ce3d093d3c94e766624f24e8a02896afb79b063d21a9747502',
});
export const TARGET = Object.freeze({
  'scripts/pc-writer/local-cycle.mjs': '185f93e27f9be28362417402b99da07431699ed4f96a0ca37dde29982c675be7',
  'scripts/pc-writer/run-local.mjs': '922503baa358203521698f157db59c23af29c0072c6d8af9d52a18541d61cc0a',
  'scripts/pc-writer/us-breadth-provisional-cycle.mjs': 'c181952f9198dfa99641b3f392ff4c1b280e9766cc8da471a2c78464b9ee7626',
  'scripts/pc-writer/us-breadth-provisional-publication.mjs': '1ea555e324b6c6b9226841ba05bb5ce41ca1865ab302c19eadc39e995c8d4d26',
  'lib/market-breadth/us-provisional-r1.mjs': '08e8d31a969b43842a2a69051a716e30db57947c85560b538252fba004e4f2b2',
});
export const DIFF = Object.freeze(Object.keys(TARGET).map(path=>({path, status: Object.hasOwn(BEFORE,path)?'M':'A'})));

const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const ID=/^pc-r17-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const CHAT=/^chat-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const AUTHORIZED=Symbol('approved-r17-b-install');
const MANIFEST_KEYS=['schema','status','scope','baseSourceSha','candidateSourceSha',
  'patchSha256','coreTaskXmlSha256','sourceRoot','configPath','coreTask',
  'beforeSha256','targetSha256','configChange','coreTaskChange',
  'allowProviderCalls','allowD1Writes','allowOtherOperationalWrites','runCount'];
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export class R17Stop extends Error {constructor(code){super(code);this.name='R17Stop';this.code=code;}}
function requireThat(ok,code){if(!ok)throw new R17Stop(code);}
function object(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
function exactKeys(obj,expected){return object(obj)&&Object.keys(obj).length===expected.length&&expected.every(k=>Object.hasOwn(obj,k));}
function sameMap(a,b){return exactKeys(a,Object.keys(b))&&Object.keys(b).every(k=>a[k]===b[k]);}
function sameDiff(a){return Array.isArray(a)&&a.length===DIFF.length&&DIFF.every(d=>a.filter(x=>x?.path===d.path&&x.status===d.status).length===1);}

export function authorize({event,env,request,manifestBytes}){
  requireThat(env?.GITHUB_REPOSITORY==='ansqhd5774-Choi/zgmini-pc-control'&&
    env?.GITHUB_EVENT_NAME==='issues'&&env?.GITHUB_EVENT_ACTION==='opened'&&
    env?.GITHUB_ACTOR==='ansqhd5774-Choi'&&env?.GITHUB_RUN_ATTEMPT==='1'&&
    /^zgmini-pc-0[1-6]$/.test(env?.RUNNER_NAME??'')&&
    /^\d{1,18}$/.test(env?.GITHUB_RUN_ID??'')&&SHA40.test(env?.R17_CONTROL_SHA??''),
    'R17_B_EVENT_CONTEXT_STOP');
  requireThat(event?.action==='opened'&&event?.repository?.private===true&&
    event?.repository?.full_name===env.GITHUB_REPOSITORY&&
    event?.sender?.login===env.GITHUB_ACTOR&&event?.issue?.user?.login===env.GITHUB_ACTOR&&
    event?.issue?.title==='pc-r17-writer-fivefile-install'&&
    !event.issue.pull_request&&Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&
    event.issue.labels?.some(label=>label.name==='pc-r17-writer-b-install'),
    'R17_B_ISSUE_AUTHORIZATION_STOP');
  requireThat(typeof event.issue.body==='string'&&Buffer.byteLength(event.issue.body,'utf8')<=4096,
    'R17_B_ISSUE_BODY_STOP');
  let body;try{body=JSON.parse(event.issue.body);}catch{throw new R17Stop('R17_B_ISSUE_BODY_STOP');}
  requireThat(object(body)&&exactKeys(body,Object.keys(request??{}))&&
    Object.keys(body).every(key=>body[key]===request[key]),'R17_B_ISSUE_REQUEST_MISMATCH_STOP');
  requireThat(object(request)&&exactKeys(request,['schema','requestId','chatId','operation','controlRepository','candidateSourceSha','approvalManifestSha256'])&&
    request.schema==='ZGMINI_R17_WRITER_B_INSTALL_REQUEST_V1'&&ID.test(request.requestId)&&
    CHAT.test(request.chatId)&&request.operation==='r17-writer-fivefile-install-once'&&
    request.controlRepository===env.GITHUB_REPOSITORY&&request.candidateSourceSha===CANDIDATE&&
    SHA64.test(request.approvalManifestSha256), 'R17_B_REQUEST_SCHEMA_STOP');
  requireThat(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>=200&&manifestBytes.length<=16_384&&
    sha256(manifestBytes)===request.approvalManifestSha256,'R17_B_MANIFEST_DIGEST_STOP');
  let manifest;try{manifest=JSON.parse(manifestBytes.toString('utf8'));}catch{throw new R17Stop('R17_B_MANIFEST_JSON_STOP');}
  requireThat(object(manifest)&&exactKeys(manifest,MANIFEST_KEYS)&&
    manifest.schema==='ZGMINI_R17_WRITER_B_INSTALL_APPROVAL_V1'&&
    manifest.status==='APPROVED_B_INSTALL_ONCE'&&manifest.scope==='R17_WRITER_EXACT_FIVE_FILES_SOURCE_COMMIT'&&
    manifest.baseSourceSha===BASE&&manifest.candidateSourceSha===CANDIDATE&&
    manifest.patchSha256===PATCH_HASH&&manifest.coreTaskXmlSha256===CORE_XML_HASH&&
    manifest.sourceRoot===SOURCE_ROOT&&manifest.configPath===CONFIG_PATH&&
    manifest.coreTask===CORE_TASK&&sameMap(manifest.beforeSha256,BEFORE)&&
    sameMap(manifest.targetSha256,TARGET)&&manifest.configChange==='SOURCE_SHA_ONLY'&&
    manifest.coreTaskChange==='TEMPORARY_DISABLE_RESTORE'&&
    manifest.allowProviderCalls===false&&manifest.allowD1Writes===false&&
    manifest.allowOtherOperationalWrites===false&&manifest.runCount===1,
    'R17_B_MANIFEST_SCOPE_STOP');
  return Object.freeze({...request,manifest,[AUTHORIZED]:true});
}

// Inputs are explicit; no source bytes, tokens, config contents or XML in journal.
export function validateBefore(b){
  requireThat(object(b)&&b.sourceRoot===SOURCE_ROOT&&b.configPath===CONFIG_PATH&&
    b.coreTask===CORE_TASK&&b.head===BASE&&b.configSource===BASE&&
    b.worktreeClean===true&&typeof b.originalBranch==='string'&&
    /^[A-Za-z][A-Za-z0-9_./-]{0,100}$/.test(b.originalBranch)&&
    !b.originalBranch.startsWith('r17-writer-b/')&&
    b.coreTaskXmlSha256===CORE_XML_HASH&&b.taskEnabled===true&&
    b.coreIdle===true&&sameMap(b.existingSha256,BEFORE)&&
    Array.isArray(b.absent)&&b.absent.length===3&&
    Object.keys(TARGET).filter(p=>!Object.hasOwn(BEFORE,p)).every(p=>b.absent.includes(p)),
    'R17_B_BASELINE_DRIFT_STOP');
}

export function validatePrepared(c,requestId){
  requireThat(object(c)&&SHA40.test(c.sha??'')&&c.sha!==BASE&&c.parent===BASE&&
    c.cleanCommit===true&&sameMap(c.targetSha256,TARGET)&&sameDiff(c.diff)&&
    c.patchSha256===PATCH_HASH&&c.candidateSourceSha===CANDIDATE&&
    ID.test(requestId??'')&&c.branch===`r17-writer-b/${requestId}`&&
    c.sourceRef===`refs/heads/${c.branch}`,
    'R17_B_PREPARED_TREE_STOP');
}

/**
 * Exact-once transaction with injected tightly scoped IO. The IO driver must:
 * - use create-new O_EXCL journal for claim() BEFORE any operational mutation;
 * - prepare new Git commit in isolated objects/index, never touching live source;
 * - implement bounded waitForDrain() and never remove a lock / terminate a process;
 * - reject any unexpected HEAD/dirty state during switch/rollback;
 * - atomically change only JSON config.source and restore exact backup bytes;
 * - verify Core task enabled/disabled via scheduler, not XML alone.
 * Each IO method must either return proven postcondition or throw a typed STOP.
 * If status remains ambiguous, never automatically retry the request.
 */
export async function performApprovedInstall(authorized,io,{maxDrainMs=180_000}={}){
  requireThat(object(authorized)&&authorized[AUTHORIZED]===true&&object(authorized.manifest)&&
    Number.isInteger(maxDrainMs)&&maxDrainMs>=1_000&&maxDrainMs<=180_000,
    'R17_B_UNAUTHORIZED_CALL_STOP');
  const result={status:'STATE_UNKNOWN',phase:'INIT',requestId:authorized.requestId,sourceSha:null};
  let claimed=false, taskMayHaveChanged=false, taskRestored=false;
  let sourceMayHaveChanged=false, configMayHaveChanged=false;
  let before=null,prepared=null;
  const progress=async(phase)=>{result.phase=phase;await io.journal(phase);};
  try{
    // Fail closed if claim/journal fails: request cannot be retried blindly.
    await io.claim(authorized.requestId);claimed=true;
    await progress('CLAIMED');
    before=await io.inspectBefore();validateBefore(before);
    await io.saveBaseline(before);await progress('BASELINE_SAVED');
    prepared=await io.prepareIsolatedCommit(before);validatePrepared(prepared,authorized.requestId);
    await progress('PREPARED');
    taskMayHaveChanged=true;
    await io.disableCoreTask(before);await io.assertCoreDisabled();
    await progress('CORE_DISABLED');
    await io.waitForDrain({maxDrainMs});await io.assertCoreDrained();
    await progress('CORE_DRAINED');
    sourceMayHaveChanged=true;
    await io.switchToPreparedCommit({before,prepared});
    await io.assertSource({head:prepared.sha,branch:prepared.branch,clean:true,files:TARGET});
    await progress('SOURCE_SWITCHED');
    configMayHaveChanged=true;
    await io.changeConfigSource({from:BASE,to:prepared.sha});
    await io.assertConfigSource(prepared.sha);
    await progress('CONFIG_REGISTERED');
    await io.restoreCoreTask(before);await io.assertCoreRestored(before);
    taskMayHaveChanged=false;
    taskRestored=true;
    await progress('CORE_RESTORED');
    await io.assertSource({head:prepared.sha,branch:prepared.branch,clean:true,files:TARGET});
    await io.assertConfigSource(prepared.sha);
    await io.assertCoreRestored(before);
    await progress('VERIFIED');
    result.status='R17_B_INSTALLED_VERIFIED';result.sourceSha=prepared.sha;
  }catch(error){
    result.status='R17_B_INSTALL_STOP';
    result.errorCode=(error&&typeof error.code==='string'&&/^R17_B_/.test(error.code))?error.code:'R17_B_UNEXPECTED_STOP';
    const recovery=[];
    if(claimed){
      // Once Core is enabled again, NEVER change the live Git tree or config
      // without separately disabling and draining the scheduler first.
      // Ambiguous post-restore verification is for manual reconciliation.
      if(taskRestored){
        result.status='R17_B_RECOVERY_REQUIRED';result.recovery=['POST_RESTORE_VERIFICATION'];
        try{await io.journal(result.status,result.errorCode);}catch{result.recovery.push('JOURNAL_FAILED');}
        return result;
      }
      // Known state transitions only. Drivers must reject unexpected state.
      if(taskMayHaveChanged){
        try{await io.assertCoreDisabled();}
        catch{
          // A disable/restore call might have succeeded before an unrelated
          // I/O failure. If already enabled, never rollback beneath Core.
          try{
            await io.assertCoreRestored(before);
            if(!sourceMayHaveChanged&&!configMayHaveChanged)
              taskMayHaveChanged=false; // permission denial, no mutation
            else recovery.push('CORE_ALREADY_ENABLED');
          }
          catch{recovery.push('CORE_STATE_UNKNOWN');}
        }
      }
      if(!recovery.length){
        if(configMayHaveChanged){
          try{await io.restoreConfigExactly(before);await io.assertConfigSource(BASE);}
          catch{recovery.push('CONFIG_RESTORE_FAILED');}
        }
        if(sourceMayHaveChanged){
          try{await io.restoreOriginalSource(before,prepared);await io.assertSource({head:BASE,branch:before.originalBranch,clean:true,files:BEFORE});}
          catch{recovery.push('SOURCE_RESTORE_FAILED');}
        }
        if(taskMayHaveChanged&&recovery.length===0){
          try{await io.restoreCoreTask(before);await io.assertCoreRestored(before);taskMayHaveChanged=false;}
          catch{recovery.push('CORE_RESTORE_FAILED');}
        }
      }
      // Even if rollback cannot finish, leave scheduler disabled: never
      // re-enable a task on an unverified source/config combination.
      if(recovery.length){
        result.status='R17_B_RECOVERY_REQUIRED';result.recovery=recovery;
        // Only leave disabled if that state was previously proved. Never
        // issue a new disable command against an ambiguous task state.
      }
      try{await io.journal(result.status,result.errorCode);}catch{
        result.status='R17_B_RECOVERY_REQUIRED';result.recovery=[...(result.recovery??[]),'JOURNAL_FAILED'];
      }
    }
  }
  return result;
}
