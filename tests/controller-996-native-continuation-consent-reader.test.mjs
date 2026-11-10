import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTINUATION_EFFECTS} from
  '../tools/controller-996-continuation-gate.mjs';
import {create996ContinuationConsentEvidenceReader,
  format996ContinuationConsentBody} from
  '../tools/controller-996-native-continuation-consent-reader.mjs';

const OWNER='ansqhd5774-Choi',REPO=`${OWNER}/zgmini-pc-control`;
const COMMIT='f'.repeat(40),ID='70a4c347-25ea-4fc6-83d2-c0c670115249';
const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const PATH='docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json';
const SHA=b=>createHash('sha256').update(b).digest('hex');
const BLOB=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`))
  .update(b).digest('hex');
const pins=Object.fromEntries([
  'oldC','installOwner','installRecovery','backlog','installed','stage',
  'maintainer','PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
  'BACKLOG_CLOSE_ATTEMPTED',
].map((name,i)=>[name,String(i).padStart(64,'0')]));
function candidate(){
  return {schema:'ZGMINI_CONTROLLER_996_CONTINUATION_C_APPROVAL_V1',
    grade:'C',approved:true,
    operation:'ARCHIVE_INTERRUPTED_C_CLAIM_AND_INSTALL_LEASE',
    issueNumber:996,originalRequestId:REQ,continuationRequestId:ID,
    operatorCommit:'d'.repeat(40),operatorSha256:'a'.repeat(64),
    packageSha256:'b'.repeat(64),sourceLockSha256:'c'.repeat(64),
    originalPins:structuredClone(pins),
    effects:[...CONTINUATION_EFFECTS],workflowPutCount:0,
    backlogWriteCount:0,originalRequestRetryCount:0,issuePostCount:0};
}
function fixture(){
  const manifest=candidate();
  let bytes=Buffer.from(JSON.stringify(manifest)+'\n');
  const owner={login:OWNER,id:327938088};
  const current={issue:{number:996,user:owner,title:'pc-controller-update',
    body:JSON.stringify({schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
      requestId:REQ,chatId:'chat-e29f389d-36fb-41d8-bc27-8f58a3facad9',
      operation:'controller-update',controlRepository:REPO,
      targetControllerSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
      approvalManifestSha256:'98c76160e08f25187cee2b5d6c5bfa843bb589edc7a9bdd45a6713f92824ed94'}),
    updated_at:'2026-11-10T05:21:34Z',state:'open'},
    comments:[],secondComments:null,badBlob:false,authorized:true,
    readerKind:'OWNER_USER_GET',testOnly:false,
    calls:[],listRounds:0,issueReads:0,commentCountOverride:null,
    secondIssue:null};
  const approved=()=>({id:9001,user:{...owner},
    body:format996ContinuationConsentBody(manifest,SHA(bytes),COMMIT),
    created_at:'2026-11-11T00:00:00Z',
    updated_at:'2026-11-11T00:00:00Z'});
  current.comments=[approved()];
  const githubReader={
    authenticateReadOnly:async()=>({kind:current.readerKind,
      actor:!current.authorized?'someone-else':
        current.readerKind==='INSTALLATION_REPOSITORY_GET'?
          'github-app-installation':OWNER,
      ownerAccountId:327938088,repository:REPO,repositoryId:1442936296,
      private:true,readOnly:true,executionAuthorized:false,
      testOnly:current.testOnly}),
    get:async url=>{
      current.calls.push(url);
      if(url==='issues/996'){
        current.issueReads++;
        const issue=current.secondIssue&&current.issueReads>=2?
          current.secondIssue:current.issue;
        return {status:200,data:{...structuredClone(issue),
          comments:current.commentCountOverride??current.comments.length}};
      }
      if(url===`contents/${PATH}?ref=${COMMIT}`)return {status:200,data:{
        type:'file',path:PATH,encoding:'base64',size:bytes.length,
        sha:current.badBlob?'0'.repeat(40):BLOB(bytes),
        content:bytes.toString('base64')}};
      const match=/^issues\/996\/comments\?per_page=100&page=(\d+)$/.exec(url);
      if(match){
        const page=Number(match[1]);
        if(page===1)current.listRounds++;
        const snapshot=current.secondComments&&current.listRounds>=2?
          current.secondComments:current.comments;
        return {status:200,data:structuredClone(snapshot.slice((page-1)*100,page*100))};
      }
      throw Error('unexpected route '+url);
    },
  };
  return {current,manifest,approved,reader:()=>
    create996ContinuationConsentEvidenceReader({githubReader}),
    replaceManifest:m=>{bytes=Buffer.from(JSON.stringify(m)+'\n');},
    manifestBytes:()=>bytes};
}
const failure=(f,code)=>assert.rejects(()=>f.reader().readOnce({manifestCommitSha:COMMIT}),
  err=>err?.code===code);

test('one-shot raw Git+owner comment evidence is review-only, never C authorization',async()=>{
  const f=fixture();
  const reader=f.reader(),r=await reader.readOnce({manifestCommitSha:COMMIT});
  assert.equal(r.status,'C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY');
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.operationalWrites,0);
  assert.equal(r.issuePosts,0);
  assert.equal(r.manifestSha256,SHA(f.manifestBytes()));
  assert.equal(r.rawManifestBytes.equals(f.manifestBytes()),true);
  assert.equal(r.consentCommentId,9001);
  assert.equal(f.current.calls.filter(x=>x.includes('comments?')).length,2);
  await assert.rejects(()=>reader.readOnce({manifestCommitSha:COMMIT}),
    {code:'C_996_NEW_CONSENT_REPEATED_READ_DENIED'});
});
test('old C approval cannot substitute for new continuation C consent',async()=>{
  const f=fixture();
  f.current.comments[0].body='ZGMINI_CONTROLLER_996_C_CONSENT_V1';
  await failure(f,'C_996_NEW_CONSENT_MISSING_OR_DUPLICATE');
});
test('changed original issue request or title rejects approval provenance',async()=>{
  const f=fixture();f.current.issue.title='unrelated-request';
  await failure(f,'C_996_NEW_CONSENT_ORIGINAL_ISSUE_BODY_DRIFT');
  const g=fixture();
  const body=JSON.parse(g.current.issue.body);
  body.requestId='different-original-request';
  g.current.issue.body=JSON.stringify(body);
  await failure(g,'C_996_NEW_CONSENT_ORIGINAL_ISSUE_BODY_DRIFT');
});
test('previously unchecked original issue fields are pinned byte-for-byte',async()=>{
  for(const field of ['chatId','controlRepository','approvalManifestSha256']){
    const f=fixture();const body=JSON.parse(f.current.issue.body);
    body[field]='changed';f.current.issue.body=JSON.stringify(body);
    await failure(f,'C_996_NEW_CONSENT_ORIGINAL_ISSUE_BODY_DRIFT');
  }
});
test('missing owner revocation cannot hide behind truncated comment pages',async()=>{
  const f=fixture();f.current.commentCountOverride=2;
  await failure(f,'C_996_NEW_CONSENT_COMMENT_TOTAL_MISMATCH');
});
test('issue body change during two comment scans is rejected',async()=>{
  const f=fixture();f.current.secondIssue=structuredClone(f.current.issue);
  f.current.secondIssue.body+=' ';
  await failure(f,'C_996_NEW_CONSENT_ISSUE_READBACK_DRIFT');
});
test('wrong Git blob content SHA blocks even if base64 is well-formed',async()=>{
  const f=fixture();f.current.badBlob=true;
  await failure(f,'C_996_NEW_CONSENT_GIT_BLOB_DRIFT');
});
test('manifest releasing install before continuation fails exact-effects gate',async()=>{
  const f=fixture();const wrong=candidate();
  wrong.effects=[...wrong.effects];
  [wrong.effects[3],wrong.effects[5]]=[wrong.effects[5],wrong.effects[3]];
  f.replaceManifest(wrong);
  await failure(f,'C_996_NEW_CONSENT_MANIFEST_INVALID');
});
test('extra manifest operation flags cannot silently expand C authorization',async()=>{
  const f=fixture();const wrong=candidate();wrong.allowDelete=true;
  f.replaceManifest(wrong);
  await failure(f,'C_996_NEW_CONSENT_MANIFEST_INVALID');
});
test('a Git ref name rather than pinned 40-hex commit is rejected',async()=>{
  const f=fixture();
  await assert.rejects(()=>f.reader().readOnce({manifestCommitSha:'main'}),
    {code:'C_996_NEW_CONSENT_COMMIT_NOT_PINNED'});
});
test('untrusted GitHub reader identity is rejected',async()=>{
  const f=fixture();f.current.authorized=false;
  await failure(f,'C_996_NEW_CONSENT_GITHUB_ORIGIN_UNVERIFIED');
});
test('installation GET identity is separate from human owner consent',async()=>{
  const f=fixture();f.current.readerKind='INSTALLATION_REPOSITORY_GET';
  const r=await f.reader().readOnce({manifestCommitSha:COMMIT});
  assert.equal(r.status,'C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY');
  assert.equal(r.consentCommentId,9001);
  assert.equal(r.executionAuthorized,false);
});
test('synthetic test GET origin may not stand in for independent consent',async()=>{
  const f=fixture();f.current.testOnly=true;
  await failure(f,'C_996_NEW_CONSENT_GITHUB_ORIGIN_UNVERIFIED');
});
test('missing synthetic flag never counts as independent network authentication',async()=>{
  const f=fixture();f.current.testOnly=undefined;
  await failure(f,'C_996_NEW_CONSENT_GITHUB_ORIGIN_UNVERIFIED');
});
test('unrecognized reader token identity kind fails closed',async()=>{
  const f=fixture();f.current.readerKind='UNKNOWN_AUTHENTICATION';
  await failure(f,'C_996_NEW_CONSENT_GITHUB_ORIGIN_UNVERIFIED');
});
test('approval from a different user ID is not owner consent',async()=>{
  const f=fixture();f.current.comments[0].user.id=42;
  await failure(f,'C_996_NEW_CONSENT_MISSING_OR_DUPLICATE');
});
test('duplicate exact owner approval is rejected',async()=>{
  const f=fixture();f.current.comments.push({...f.approved(),id:9002});
  await failure(f,'C_996_NEW_CONSENT_MISSING_OR_DUPLICATE');
});
test('conflicting new C owner approval with different UUID is rejected',async()=>{
  const f=fixture();f.current.comments.push({...f.approved(),id:9005,
    body:'ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1\n'+
      'continuationRequestId=00000000-0000-4000-8000-000000000000'});
  await failure(f,'C_996_NEW_CONSENT_AMBIGUOUS_OWNER_APPROVAL');
});
test('edited or missing timestamp on the sole approval is rejected',async()=>{
  for(const stamp of ['2026-11-11T01:00:00Z',null]){
    const f=fixture();f.current.comments[0].updated_at=stamp;
    await failure(f,'C_996_NEW_CONSENT_APPROVAL_EDITED_OR_UNDATED');
  }
});
test('an owner revocation marker denies the approval',async()=>{
  const f=fixture();f.current.comments.push({...f.approved(),id:9003,
    body:'ZGMINI_CONTROLLER_996_CONTINUATION_C_REVOKE_V1\n'+ID});
  await failure(f,'C_996_NEW_CONSENT_REVOKED_OR_AMBIGUOUS');
});
test('comment readback changed between two complete scans is rejected',async()=>{
  const f=fixture();f.current.secondComments=[{...f.approved(),id:9004}];
  await failure(f,'C_996_NEW_CONSENT_COMMENT_READBACK_DRIFT');
});
test('duplicate REST comment IDs and incomplete pagination are rejected',async()=>{
  const f=fixture();f.current.comments.push({...f.approved(),id:9001,
    body:'unrelated comment'});
  await failure(f,'C_996_NEW_CONSENT_COMMENTS_INVALID');
  const g=fixture();
  g.current.comments=Array.from({length:100},(_,i)=>({
    ...g.approved(),id:9001+i,body:`comment ${i}`}));
  g.current.comments.push({...g.approved(),id:9101});
  const r=await g.reader().readOnce({manifestCommitSha:COMMIT});
  assert.equal(r.commentsRead,101);
  assert.equal(g.current.calls.filter(x=>x.includes('comments?')).length,4);
});
