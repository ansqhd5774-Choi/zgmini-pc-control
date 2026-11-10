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
  const owner={login:OWNER,id:777};
  const current={issue:{number:996,user:owner,title:'pc-controller-update',
    body:JSON.stringify({schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
      requestId:REQ,operation:'controller-update',
      targetControllerSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8'})},
    comments:[],secondComments:null,badBlob:false,authorized:true,
    calls:[],listRounds:0};
  const approved=()=>({id:9001,user:{...owner},
    body:format996ContinuationConsentBody(manifest,SHA(bytes),COMMIT),
    created_at:'2026-11-11T00:00:00Z',
    updated_at:'2026-11-11T00:00:00Z'});
  current.comments=[approved()];
  const githubReader={
    authenticateReadOnly:()=>({actor:current.authorized?OWNER:'someone-else',
      repository:REPO,private:true,readOnly:true,executionAuthorized:false}),
    get:url=>{
      current.calls.push(url);
      if(url==='issues/996')return {status:200,data:structuredClone(current.issue)};
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
const failure=(f,code)=>assert.throws(()=>f.reader().readOnce({manifestCommitSha:COMMIT}),
  err=>err?.code===code);

test('one-shot raw Git+owner comment evidence is review-only, never C authorization',()=>{
  const f=fixture();
  const reader=f.reader(),r=reader.readOnce({manifestCommitSha:COMMIT});
  assert.equal(r.status,'C_CONTINUATION_CONSENT_EVIDENCE_REVIEWED_ONLY');
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.operationalWrites,0);
  assert.equal(r.issuePosts,0);
  assert.equal(r.manifestSha256,SHA(f.manifestBytes()));
  assert.equal(r.rawManifestBytes.equals(f.manifestBytes()),true);
  assert.equal(r.consentCommentId,9001);
  assert.equal(f.current.calls.filter(x=>x.includes('comments?')).length,2);
  assert.throws(()=>reader.readOnce({manifestCommitSha:COMMIT}),
    {code:'C_996_NEW_CONSENT_REPEATED_READ_DENIED'});
});
test('old C approval cannot substitute for new continuation C consent',()=>{
  const f=fixture();
  f.current.comments[0].body='ZGMINI_CONTROLLER_996_C_CONSENT_V1';
  failure(f,'C_996_NEW_CONSENT_MISSING_OR_DUPLICATE');
});
test('changed original issue request or title rejects approval provenance',()=>{
  const f=fixture();f.current.issue.title='unrelated-request';
  failure(f,'C_996_NEW_CONSENT_ORIGINAL_ISSUE_BODY_DRIFT');
  const g=fixture();
  const body=JSON.parse(g.current.issue.body);
  body.requestId='different-original-request';
  g.current.issue.body=JSON.stringify(body);
  failure(g,'C_996_NEW_CONSENT_ORIGINAL_ISSUE_BODY_DRIFT');
});
test('wrong Git blob content SHA blocks even if base64 is well-formed',()=>{
  const f=fixture();f.current.badBlob=true;
  failure(f,'C_996_NEW_CONSENT_GIT_BLOB_DRIFT');
});
test('manifest releasing install before continuation fails exact-effects gate',()=>{
  const f=fixture();const wrong=candidate();
  wrong.effects=[...wrong.effects];
  [wrong.effects[3],wrong.effects[5]]=[wrong.effects[5],wrong.effects[3]];
  f.replaceManifest(wrong);
  failure(f,'C_996_NEW_CONSENT_MANIFEST_INVALID');
});
test('extra manifest operation flags cannot silently expand C authorization',()=>{
  const f=fixture();const wrong=candidate();wrong.allowDelete=true;
  f.replaceManifest(wrong);
  failure(f,'C_996_NEW_CONSENT_MANIFEST_INVALID');
});
test('a Git ref name rather than pinned 40-hex commit is rejected',()=>{
  const f=fixture();
  assert.throws(()=>f.reader().readOnce({manifestCommitSha:'main'}),
    {code:'C_996_NEW_CONSENT_COMMIT_NOT_PINNED'});
});
test('untrusted GitHub reader identity is rejected',()=>{
  const f=fixture();f.current.authorized=false;
  failure(f,'C_996_NEW_CONSENT_GITHUB_ORIGIN_UNVERIFIED');
});
test('approval from a different user ID is not owner consent',()=>{
  const f=fixture();f.current.comments[0].user.id=42;
  failure(f,'C_996_NEW_CONSENT_MISSING_OR_DUPLICATE');
});
test('duplicate exact owner approval is rejected',()=>{
  const f=fixture();f.current.comments.push({...f.approved(),id:9002});
  failure(f,'C_996_NEW_CONSENT_MISSING_OR_DUPLICATE');
});
test('conflicting new C owner approval with different UUID is rejected',()=>{
  const f=fixture();f.current.comments.push({...f.approved(),id:9005,
    body:'ZGMINI_CONTROLLER_996_CONTINUATION_C_CONSENT_V1\n'+
      'continuationRequestId=00000000-0000-4000-8000-000000000000'});
  failure(f,'C_996_NEW_CONSENT_AMBIGUOUS_OWNER_APPROVAL');
});
test('edited or missing timestamp on the sole approval is rejected',()=>{
  for(const stamp of ['2026-11-11T01:00:00Z',null]){
    const f=fixture();f.current.comments[0].updated_at=stamp;
    failure(f,'C_996_NEW_CONSENT_APPROVAL_EDITED_OR_UNDATED');
  }
});
test('an owner revocation marker denies the approval',()=>{
  const f=fixture();f.current.comments.push({...f.approved(),id:9003,
    body:'ZGMINI_CONTROLLER_996_CONTINUATION_C_REVOKE_V1\n'+ID});
  failure(f,'C_996_NEW_CONSENT_REVOKED_OR_AMBIGUOUS');
});
test('comment readback changed between two complete scans is rejected',()=>{
  const f=fixture();f.current.secondComments=[{...f.approved(),id:9004}];
  failure(f,'C_996_NEW_CONSENT_COMMENT_READBACK_DRIFT');
});
test('duplicate REST comment IDs and incomplete pagination are rejected',()=>{
  const f=fixture();f.current.comments.push({...f.approved(),id:9001,
    body:'unrelated comment'});
  failure(f,'C_996_NEW_CONSENT_COMMENTS_INVALID');
  const g=fixture();
  g.current.comments=Array.from({length:100},(_,i)=>({
    ...g.approved(),id:9001+i,body:`comment ${i}`}));
  g.current.comments.push({...g.approved(),id:9101});
  const r=g.reader().readOnce({manifestCommitSha:COMMIT});
  assert.equal(r.commentsRead,101);
  assert.equal(g.current.calls.filter(x=>x.includes('comments?')).length,4);
});
