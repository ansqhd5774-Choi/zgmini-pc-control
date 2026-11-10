// #996 C trusted-bootstrap REVIEW CANDIDATE, GET-ONLY. NOT a launcher.
// This file's own SHA must be verified OUTSIDE Node with Windows OS
// Get-FileHash against the exact Owner-approved/bootstrapSha256 trust anchor.
// Self-hashing here is evidence, NOT an independent root of trust.
// No local module imports, private token access, operation or E: mutation.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi',OWNER_ID=327938088,REPO_ID=1442936296;
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const BODY_SHA='37caf348eb4fc5440ebfa76a1c1166bb7480dffdd8d054dcb19391816bc72b5a';
const TARGET='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const NODE='E:/ZGmini/runtime/node.exe';
const GH='C:/Program Files/GitHub CLI/gh.exe';
const S2_MANIFEST='docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json';
const S2_LOCK='tools/controller-996-c-native-owner-source-lock.json';
const S2_ZIP='artifacts/controller-996/zgmini-996-c-native-owner-package.zip';
const SELF='tools/controller-996-c-native-trusted-bootstrap.mjs';
const CONSENT='ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1';
const REVOKE='ZGMINI_CONTROLLER_996_CONTINUATION_C_REVOKE_V1';
const FILES=Object.freeze([
  SELF,
  'tools/controller-996-c-native-owner-operator.mjs',
  'tools/controller-996-c-installed-gh-get-readonly.mjs',
  'tools/controller-996-native-continuation-consent-reader.mjs',
  'tools/controller-996-original-four-jobs-readonly.mjs',
  'tools/controller-996-continuation-gate.mjs',
  'tools/controller-996-c-original-prewrite-readonly.mjs',
  'tools/controller-996-c-original-stage-readonly.mjs',
  'tools/controller-996-c-physical-disposition-readonly.mjs',
  'tools/controller-996-git-byte-offline-readonly-r4.mjs',
  'tools/controller-996-git-byte-offline-manifest-r4.json',
  'tools/controller-996-interrupted-observer.mjs',
  'tools/controller-996-protection-attestation.mjs',
  'tools/controller-996-r2-evidence-review.mjs',
  'tools/controller-996-windows-archive-adapter.mjs',
  'tools/controller-996-windows-observer.mjs',
]);
const EFFECTS=Object.freeze([
  'CREATE_AND_PRESERVE_FIXED_C_RESERVATION_VIA_ATOMIC_PROPOSAL_MOVE',
  'RESERVE_INDEPENDENT_CONTINUATION_C_CLAIM',
  'WRITE_SCOPED_DURABLE_RECOVERY_MARKERS',
  'ARCHIVE_ABANDONED_C_CLAIM_NO_DELETE',
  'ARCHIVE_INDEPENDENT_CONTINUATION_C_CLAIM',
  'VERIFY_DURABLE_READY_TO_RELEASE_INSTALL',
  'ARCHIVE_ORIGINAL_INSTALL_LEASE_LAST_NO_DELETE',
]);
const DIR=path.dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update(Buffer.from(`blob ${x.length}\0`)).update(x).digest('hex');
const h40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const h64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const blocked=code=>Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_NATIVE_TRUSTED_BOOTSTRAP_REVIEW_V1',
  status:'BOOTSTRAP_NO_GO',code,executionAuthorized:false,
  operatorStarted:false,originalPcWrites:0,githubWrites:0,
  externalOsTrustAnchorVerified:false,
});
function originalWindows(){
  need(process.platform==='win32'&&!process.env.RUNNER_NAME&&
    !process.env.GITHUB_ACTIONS&&!process.env.GH_HOST&&
    path.win32.normalize(process.execPath).toLowerCase()===
      path.win32.normalize(NODE).toLowerCase(),
  'C_996_BOOTSTRAP_ORIGINAL_WINDOWS_ONLY');
  const gh=fs.lstatSync(GH);
  need(gh.isFile()&&!gh.isSymbolicLink()&&
    path.win32.normalize(fs.realpathSync.native(GH)).toLowerCase()===
      path.win32.normalize(GH).toLowerCase(),
  'C_996_BOOTSTRAP_GH_UNTRUSTED');
}
function getJson(route){
  need(/^user$|^repos\/ansqhd5774-Choi\/zgmini-pc-control(?:\/(?:issues\/996(?:\/comments\?per_page=100&page=(?:[1-9]|[1-9][0-9]|100))?|contents\/(?:docs\/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1\.json|tools\/[a-zA-Z0-9._-]+|artifacts\/controller-996\/zgmini-996-c-native-owner-package\.zip)\?ref=[a-f0-9]{40}))?$/.test(route),
  'C_996_BOOTSTRAP_GET_ROUTE_UNEXPECTED');
  let raw;
  try{raw=execFileSync(GH,['api','--method','GET',route],{
    encoding:'utf8',windowsHide:true,timeout:30_000,
    maxBuffer:24_000_000,stdio:['ignore','pipe','pipe'],
  });}catch{need(false,'C_996_BOOTSTRAP_GH_GET_FAILED');}
  need(typeof raw==='string'&&raw.length>0&&raw.length<24_000_000,
    'C_996_BOOTSTRAP_GH_GET_SIZE');
  try{return JSON.parse(raw);}catch{need(false,'C_996_BOOTSTRAP_GH_JSON');}
}
function gitBytes(repoPath,commit){
  need(h40(commit)&&[SELF,S2_MANIFEST,S2_LOCK,S2_ZIP,...FILES].includes(repoPath),
    'C_996_BOOTSTRAP_GIT_TARGET_INVALID');
  const row=getJson(`repos/${REPO}/contents/${repoPath}?ref=${commit}`);
  need(row?.path===repoPath&&row.type==='file'&&row.encoding==='base64'&&
    typeof row.content==='string'&&h40(row.sha)&&
    Number.isSafeInteger(row.size)&&row.size>0&&row.size<=16_000_000,
  'C_996_BOOTSTRAP_GIT_BLOB_INVALID');
  const encoded=row.content.replace(/\s/g,'');
  need(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded),
    'C_996_BOOTSTRAP_GIT_ENCODING_INVALID');
  const bytes=Buffer.from(encoded,'base64');
  need(bytes.length===row.size&&bytes.toString('base64')===encoded&&
    blob(bytes)===row.sha,'C_996_BOOTSTRAP_GIT_BYTES_INVALID');
  return bytes;
}
function localFile(repoPath,limit){
  need([SELF,S2_LOCK,S2_ZIP,...FILES].includes(repoPath),
    'C_996_BOOTSTRAP_LOCAL_PATH_INVALID');
  const full=repoPath===S2_ZIP?
    path.resolve(DIR,'../artifacts/controller-996/zgmini-996-c-native-owner-package.zip'):
    path.join(DIR,path.basename(repoPath));
  const stat=fs.lstatSync(full);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&
    stat.size>0&&stat.size<=limit,
  'C_996_BOOTSTRAP_LOCAL_SOURCE_UNSAFE');
  return fs.readFileSync(full);
}
function comments(){
  const rows=[],ids=new Set();
  for(let page=1;page<=100;page++){
    const next=getJson(`repos/${REPO}/issues/996/comments?per_page=100&page=${page}`);
    need(Array.isArray(next)&&next.length<=100,'C_996_BOOTSTRAP_COMMENT_PAGE_INVALID');
    for(const c of next){
      need(Number.isSafeInteger(c?.id)&&c.id>0&&!ids.has(c.id)&&
        typeof c.body==='string'&&typeof c.user?.login==='string'&&
        Number.isSafeInteger(c.user?.id),
      'C_996_BOOTSTRAP_COMMENT_ID_OR_AUTHOR_INVALID');
      ids.add(c.id);
    }
    rows.push(...next);
    if(next.length<100){
      need(rows.length<=10_000,'C_996_BOOTSTRAP_COMMENT_OVERFLOW');
      return rows;
    }
  }
  need(false,'C_996_BOOTSTRAP_COMMENT_PAGES_INCOMPLETE');
}
function expectedConsent(m,manifestSha,s2){
  return [CONSENT,'decision=APPROVE_ONCE','issueNumber=996',
    `originalRequestId=${REQ}`,
    `continuationRequestId=${m.continuationRequestId}`,
    `manifestSha256=${manifestSha}`,`manifestCommitSha=${s2}`,
    `operatorCommit=${m.operatorCommit}`,
    `operatorSha256=${m.operatorSha256}`,
    `bootstrapSha256=${m.bootstrapSha256}`,
    `packageSha256=${m.packageSha256}`,
    `sourceLockSha256=${m.sourceLockSha256}`,
    `effects=${EFFECTS.join('|')}`,'workflowPutCount=0',
    'backlogWriteCount=0','originalRequestRetryCount=0','issuePostCount=0',
  ].join('\n');
}
function validateManifest(m){
  const fields=['schema','grade','approved','operation','issueNumber',
    'originalRequestId','continuationRequestId','operatorCommit',
    'operatorSha256','bootstrapSha256','packageSha256','sourceLockSha256',
    'originalPins','effects','workflowPutCount','backlogWriteCount',
    'originalRequestRetryCount','issuePostCount'];
  const pins=['oldC','installOwner','installRecovery','backlog','installed',
    'stage','maintainer','PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
    'BACKLOG_CLOSE_ATTEMPTED'];
  need(m&&eq(Object.keys(m).sort(),fields.sort())&&
    m.schema==='ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1'&&
    m.grade==='C'&&m.approved===true&&
    m.operation==='ARCHIVE_INTERRUPTED_C_CLAIM_AND_INSTALL_LEASE'&&
    m.issueNumber===996&&m.originalRequestId===REQ&&
    uuid(m.continuationRequestId)&&m.continuationRequestId!==REQ&&
    h40(m.operatorCommit)&&h64(m.operatorSha256)&&
    h64(m.bootstrapSha256)&&h64(m.packageSha256)&&
    h64(m.sourceLockSha256)&&eq(m.effects,EFFECTS)&&
    m.workflowPutCount===0&&m.backlogWriteCount===0&&
    m.originalRequestRetryCount===0&&m.issuePostCount===0&&
    m.originalPins&&eq(Object.keys(m.originalPins).sort(),pins.sort())&&
    pins.every(k=>h64(m.originalPins[k])),
  'C_996_BOOTSTRAP_APPROVAL_MANIFEST_INVALID');
}

/** Read-only authentication candidate; NEVER launches an operator. */
export function verify996CTrustedBootstrapReadOnly({manifestCommitSha}={}){
  try{
    originalWindows();
    need(h40(manifestCommitSha),'C_996_BOOTSTRAP_S2_COMMIT_REQUIRED');
    const who=getJson('user'),repo=getJson(`repos/${REPO}`);
    need(who?.login===OWNER&&who.id===OWNER_ID&&
      repo?.id===REPO_ID&&repo.full_name===REPO&&repo.private===true&&
      repo.owner?.login===OWNER&&repo.owner.id===OWNER_ID,
    'C_996_BOOTSTRAP_GITHUB_OWNER_OR_REPO_INVALID');
    const issue=getJson(`repos/${REPO}/issues/996`);
    need(issue?.number===996&&issue.user?.login===OWNER&&
      issue.user.id===OWNER_ID&&issue.state==='open'&&
      issue.title==='pc-controller-update'&&
      typeof issue.body==='string'&&sha(Buffer.from(issue.body))===BODY_SHA&&
      issue.comments>=0&&issue.comments<=10_000,
    'C_996_BOOTSTRAP_ISSUE_INVALID');
    let body;try{body=JSON.parse(issue.body);}catch{}
    need(body?.requestId===REQ&&body.operation==='controller-update'&&
      body.targetControllerSha===TARGET&&
      body.schema==='ZGMINI_PC_MAINTENANCE_REQUEST_V1',
    'C_996_BOOTSTRAP_ORIGINAL_BODY_INVALID');
    const manifestBytes=gitBytes(S2_MANIFEST,manifestCommitSha);
    let m;try{m=JSON.parse(manifestBytes.toString('utf8'));}catch{}
    validateManifest(m);
    const exact=expectedConsent(m,sha(manifestBytes),manifestCommitSha);
    const first=comments(),second=comments();
    const projection=rows=>rows.map(x=>[x.id,x.body,x.user?.login,
      x.user?.id,x.created_at,x.updated_at]);
    need(eq(projection(first),projection(second))&&
      issue.comments===first.length,
    'C_996_BOOTSTRAP_CONSENT_READBACK_DRIFT');
    const owner=second.filter(c=>c.user?.login===OWNER&&c.user.id===OWNER_ID);
    need(!owner.some(c=>c.body.startsWith(REVOKE))&&
      !owner.some(c=>c.body.startsWith(CONSENT)&&c.body!==exact),
    'C_996_BOOTSTRAP_CONSENT_AMBIGUOUS_OR_REVOKED');
    const approved=owner.filter(c=>c.body===exact);
    need(approved.length===1&&approved[0].created_at===approved[0].updated_at&&
      Number.isFinite(Date.parse(approved[0].created_at)),
    'C_996_BOOTSTRAP_OWNER_CONSENT_MISSING');
    const issueAfter=getJson(`repos/${REPO}/issues/996`);
    need(eq([issue.number,issue.body,issue.state,issue.comments,issue.updated_at],
      [issueAfter.number,issueAfter.body,issueAfter.state,
        issueAfter.comments,issueAfter.updated_at]),
    'C_996_BOOTSTRAP_ISSUE_CHANGED');
    const selfBytes=localFile(SELF,2_000_000);
    need(sha(selfBytes)===m.bootstrapSha256&&
      selfBytes.equals(gitBytes(SELF,m.operatorCommit)),
    'C_996_BOOTSTRAP_BOOTSTRAP_SHA_DRIFT');
    const lockBytes=localFile(S2_LOCK,100_000);
    const zipBytes=localFile(S2_ZIP,16_000_000);
    need(sha(lockBytes)===m.sourceLockSha256&&
      sha(zipBytes)===m.packageSha256&&
      lockBytes.equals(gitBytes(S2_LOCK,manifestCommitSha))&&
      zipBytes.equals(gitBytes(S2_ZIP,manifestCommitSha)),
    'C_996_BOOTSTRAP_S2_SOURCE_DRIFT');
    let lock;try{lock=JSON.parse(lockBytes.toString('utf8'));}catch{}
    need(lock?.schema==='ZGMINI_CONTROLLER_996_NATIVE_OWNER_SOURCE_LOCK_V1'&&
      eq(Object.keys(lock).sort(),['schema','files'].sort())&&
      lock.files&&eq(Object.keys(lock.files).sort(),FILES.slice().sort()),
    'C_996_BOOTSTRAP_LOCK_FILES_INVALID');
    for(const f of FILES){
      const bytes=localFile(f,2_000_000);
      need(h64(lock.files[f])&&sha(bytes)===lock.files[f]&&
        bytes.equals(gitBytes(f,m.operatorCommit)),
      'C_996_BOOTSTRAP_S1_CLOSURE_DRIFT');
    }
    // Bootstrap has no independent OS trust anchor nor verified immutable
    // process snapshot. Evidence alone NEVER authorizes an operator launch.
    return Object.freeze({
      schema:'ZGMINI_CONTROLLER_996_NATIVE_TRUSTED_BOOTSTRAP_REVIEW_V1',
      status:'GIT_AND_LOCAL_BYTES_OBSERVED_ONLY',
      filesCheckedAtS1:FILES.length,filesCheckedAtS2:3,
      effectsChecked:EFFECTS.length,ownerConsentCommentId:approved[0].id,
      externalOsTrustAnchorVerified:false,operatorStarted:false,
      executionAuthorized:false,originalPcWrites:0,githubWrites:0,
      nextRequired:'OUT_OF_PROCESS_OS_HASH_ANCHOR_AND_IMMUTABLE_SNAPSHOT',
    });
  }catch(e){return blocked(/^C_996_BOOTSTRAP_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_996_BOOTSTRAP_READ_OR_STATE_UNKNOWN');}
}
