// #996 NEW continuation C consent evidence reader — SOURCE / GET-ONLY.
// No actual new manifest or owner consent exists yet. No PC I/O, POST, C
// execution or authority is granted by any successful read.
import {createHash} from 'node:crypto';
import {CONTINUATION_EFFECTS} from './controller-996-continuation-gate.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const ISSUE=996;
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const TARGET='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
// Pinned independently from the original #996 REST Issue body bytes.
// A later edit to any original request field, including chatId or approval
// manifest digest, must STOP rather than silently alter C provenance.
const ORIGINAL_BODY_SHA256='37caf348eb4fc5440ebfa76a1c1166bb7480dffdd8d054dcb19391816bc72b5a';
const ORIGINAL_OWNER_ID=327938088;
const REPOSITORY_ID=1442936296;
const MANIFEST='docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json';
const CONSENT='ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1';
const REVOKE='ZGMINI_CONTROLLER_996_CONTINUATION_C_REVOKE_V1';
const H40=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
const H64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const UUID=x=>typeof x==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function pinnedManifest(m){
  const pins=m?.originalPins;
  const keys=['oldC','installOwner','installRecovery','backlog','installed',
    'stage','maintainer','PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
    'BACKLOG_CLOSE_ATTEMPTED'];
  const topKeys=['schema','grade','approved','operation','issueNumber',
    'originalRequestId','continuationRequestId','operatorCommit',
    'operatorSha256','bootstrapSha256','packageSha256','sourceLockSha256','originalPins','launchPins',
    'effects','workflowPutCount','backlogWriteCount',
    'originalRequestRetryCount','issuePostCount'];
  return m?.schema==='ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1'&&
    same(Object.keys(m).sort(),topKeys.sort())&&
    m.grade==='C'&&m.approved===true&&
    m.operation==='ARCHIVE_INTERRUPTED_C_CLAIM_AND_INSTALL_LEASE'&&
    m.issueNumber===ISSUE&&m.originalRequestId===REQ&&
    UUID(m.continuationRequestId)&&m.continuationRequestId!==REQ&&
    H40(m.operatorCommit)&&H64(m.operatorSha256)&&H64(m.bootstrapSha256)&&
    H64(m.packageSha256)&&H64(m.sourceLockSha256)&&
    m.launchPins&&same(Object.keys(m.launchPins).sort(),
      ['helperSha256','launcherSha256','nodeSha256','outerSha256'])&&
    Object.values(m.launchPins).every(H64)&&
    same(m.effects,CONTINUATION_EFFECTS)&&
    m.workflowPutCount===0&&m.backlogWriteCount===0&&
    m.originalRequestRetryCount===0&&m.issuePostCount===0&&
    pins&&typeof pins==='object'&&!Array.isArray(pins)&&
    Object.keys(pins).length===keys.length&&keys.every(k=>H64(pins[k]))&&
    !Object.hasOwn(m,'manifestSha256');
}

// Exact body for a FUTURE owner's separate #996 approval comment. Generating
// it is not evidence of approval; only independently read raw REST comments
// can establish that the owner actually posted it.
export function format996ContinuationConsentBody(manifest,manifestSha256,
  manifestCommitSha){
  need(pinnedManifest(manifest)&&H64(manifestSha256)&&H40(manifestCommitSha),
    'C_996_NEW_CONSENT_MANIFEST_INVALID');
  return [CONSENT,'decision=APPROVE_ONCE',`issueNumber=${ISSUE}`,
    `originalRequestId=${REQ}`,
    `continuationRequestId=${manifest.continuationRequestId}`,
    `manifestSha256=${manifestSha256}`,
    `manifestCommitSha=${manifestCommitSha}`,
    `operatorCommit=${manifest.operatorCommit}`,
    `operatorSha256=${manifest.operatorSha256}`,
    `bootstrapSha256=${manifest.bootstrapSha256}`,
    `packageSha256=${manifest.packageSha256}`,
    `sourceLockSha256=${manifest.sourceLockSha256}`,
    `effects=${CONTINUATION_EFFECTS.join('|')}`,
    'workflowPutCount=0','backlogWriteCount=0',
    'originalRequestRetryCount=0','issuePostCount=0',
  ].join('\n');
}

function gitBlobSha(data){
  return createHash('sha1').update(Buffer.from(`blob ${data.length}\0`))
    .update(data).digest('hex');
}
function decodePinnedManifest(response){
  const m=response?.data;
  need(response?.status===200&&m?.type==='file'&&m.path===MANIFEST&&
    m.encoding==='base64'&&H40(m.sha)&&
    Number.isSafeInteger(m.size)&&m.size>0&&m.size<=65_536&&
    typeof m.content==='string'&&m.content.length<=100_000,
  'C_996_NEW_CONSENT_GIT_CONTENT_UNVERIFIED');
  const normalized=m.content.replace(/\s/g,'');
  need(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized),
    'C_996_NEW_CONSENT_GIT_BASE64_INVALID');
  const bytes=Buffer.from(normalized,'base64');
  need(bytes.length===m.size&&bytes.toString('base64')===normalized&&
    gitBlobSha(bytes)===m.sha,'C_996_NEW_CONSENT_GIT_BLOB_DRIFT');
  let parsed;
  try{parsed=JSON.parse(bytes.toString('utf8'));}catch{}
  need(pinnedManifest(parsed),'C_996_NEW_CONSENT_MANIFEST_INVALID');
  return {bytes,manifest:parsed,manifestSha256:sha(bytes)};
}
async function rawComments(githubReader){
  const comments=[];
  let finished=false;
  for(let page=1;page<=100;page++){
    const res=await githubReader.get(`issues/${ISSUE}/comments?per_page=100&page=${page}`);
    need(res?.status===200&&Array.isArray(res.data)&&res.data.length<=100,
      'C_996_NEW_CONSENT_COMMENTS_PAGE_UNVERIFIED');
    comments.push(...res.data);
    need(comments.length<=10_000,'C_996_NEW_CONSENT_COMMENTS_OVERFLOW');
    if(res.data.length<100){finished=true;break;}
  }
  need(finished,'C_996_NEW_CONSENT_COMMENTS_PARTIAL');
  const ids=new Set();
  for(const c of comments){
    need(Number.isSafeInteger(c?.id)&&c.id>0&&!ids.has(c.id)&&
      typeof c.body==='string'&&typeof c.user?.login==='string',
      'C_996_NEW_CONSENT_COMMENTS_INVALID');
    ids.add(c.id);
  }
  return comments;
}
const readbackProjection=comments=>comments.map(c=>[
  c.id,c.body,c.user?.login,c.user?.id,c.created_at,c.updated_at,
]);
const timestampValid=c=>typeof c.created_at==='string'&&
  c.created_at===c.updated_at&&Number.isFinite(Date.parse(c.created_at));
const issueProjection=i=>[
  i?.number,i?.title,i?.body,i?.comments,i?.updated_at,i?.state,
  i?.user?.login,i?.user?.id,
];

/** One-shot read, TWO full comment readbacks, fixed GitHub origin + path. */
export function create996ContinuationConsentEvidenceReader({githubReader}={}){
  need(githubReader&&typeof githubReader.get==='function'&&
    typeof githubReader.authenticateReadOnly==='function',
    'C_996_NEW_CONSENT_GET_PORT_MISSING');
  let used=false;
  return Object.freeze({async readOnce({manifestCommitSha}={}){
    need(!used,'C_996_NEW_CONSENT_REPEATED_READ_DENIED');
    used=true;
    need(H40(manifestCommitSha),'C_996_NEW_CONSENT_COMMIT_NOT_PINNED');
    const auth=await githubReader.authenticateReadOnly();
    // Authenticate the GitHub GET transport independently of the human
    // account that authored the new C consent. Standard Actions GITHUB_TOKEN
    // is an app installation token and cannot be treated as the Owner user.
    const ownerReader=auth?.kind==='OWNER_USER_GET'&&auth.actor===OWNER;
    const installationReader=auth?.kind==='INSTALLATION_REPOSITORY_GET'&&
      auth.actor==='github-app-installation';
    need((ownerReader||installationReader)&&
      auth.repository===REPO&&auth.repositoryId===REPOSITORY_ID&&
      auth.ownerAccountId===ORIGINAL_OWNER_ID&&
      auth.private===true&&auth.readOnly===true&&
      auth.executionAuthorized===false&&auth.testOnly===false,
      'C_996_NEW_CONSENT_GITHUB_ORIGIN_UNVERIFIED');
    const issue=await githubReader.get(`issues/${ISSUE}`);
    need(issue?.status===200&&issue.data?.number===ISSUE&&
      issue.data?.user?.login===OWNER&&
      issue.data.user.id===ORIGINAL_OWNER_ID&&
      Number.isSafeInteger(issue.data?.comments)&&
      issue.data.comments>=0&&issue.data.comments<=10_000&&
      issue.data.state==='open'&&
      typeof issue.data.updated_at==='string',
      'C_996_NEW_CONSENT_ORIGINAL_ISSUE_UNVERIFIED');
    let issueBody;
    try{issueBody=JSON.parse(issue.data.body);}catch{}
    need(issue.data.title==='pc-controller-update'&&
      issueBody?.schema==='ZGMINI_PC_MAINTENANCE_REQUEST_V1'&&
      issueBody.requestId===REQ&&issueBody.operation==='controller-update'&&
      issueBody.targetControllerSha===TARGET&&
      typeof issue.data.body==='string'&&
      sha(Buffer.from(issue.data.body,'utf8'))===ORIGINAL_BODY_SHA256,
      'C_996_NEW_CONSENT_ORIGINAL_ISSUE_BODY_DRIFT');
    const evidence=decodePinnedManifest(await githubReader.get(
      `contents/${MANIFEST}?ref=${manifestCommitSha}`));
    const exactBody=format996ContinuationConsentBody(
      evidence.manifest,evidence.manifestSha256,manifestCommitSha);
    const before=await rawComments(githubReader);
    const after=await rawComments(githubReader);
    need(same(readbackProjection(before),readbackProjection(after)),
      'C_996_NEW_CONSENT_COMMENT_READBACK_DRIFT');
    const issueAfter=await githubReader.get(`issues/${ISSUE}`);
    need(issueAfter?.status===200&&
      same(issueProjection(issue.data),issueProjection(issueAfter.data)),
      'C_996_NEW_CONSENT_ISSUE_READBACK_DRIFT');
    need(issue.data.comments===before.length&&
      issueAfter.data.comments===after.length,
      'C_996_NEW_CONSENT_COMMENT_TOTAL_MISMATCH');
    const owner=after.filter(c=>c.user.login===OWNER&&
      c.user.id===issue.data.user.id);
    need(!owner.some(c=>c.body.startsWith(REVOKE)),
      'C_996_NEW_CONSENT_REVOKED_OR_AMBIGUOUS');
    need(!owner.some(c=>c.body.startsWith(CONSENT)&&c.body!==exactBody),
      'C_996_NEW_CONSENT_AMBIGUOUS_OWNER_APPROVAL');
    const matches=owner.filter(c=>c.body===exactBody);
    need(matches.length===1,'C_996_NEW_CONSENT_MISSING_OR_DUPLICATE');
    need(timestampValid(matches[0]),
      'C_996_NEW_CONSENT_APPROVAL_EDITED_OR_UNDATED');
    // Intentionally weaker than operational authorization. Authenticated
    // readback + physical Windows prewrite CAS must still be joined later.
    return Object.freeze({schema:'ZGMINI_CONTROLLER_996_NEW_C_CONSENT_READ_V1',
      status:'C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY',
      repository:REPO,issueNumber:ISSUE,manifestCommitSha,
      manifestSha256:evidence.manifestSha256,
      continuationRequestId:evidence.manifest.continuationRequestId,
      operatorSha256:evidence.manifest.operatorSha256,
      bootstrapSha256:evidence.manifest.bootstrapSha256,
      packageSha256:evidence.manifest.packageSha256,
      sourceLockSha256:evidence.manifest.sourceLockSha256,
      consentCommentId:matches[0].id,commentsRead:after.length,
      rawManifestBytes:Buffer.from(evidence.bytes),
      executionAuthorized:false,operationalWrites:0,
      workflowPuts:0,backlogWrites:0,issuePosts:0,pcRetries:0});
  }});
}
