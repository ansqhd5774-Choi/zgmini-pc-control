import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  authorizeR181ProtectedB,runApprovedR181ProtectedB,
  R181_B_OPERATION,R181_B_APPROVAL_SCHEMA,R181_B_REQUEST_SCHEMA,
  R181_B_SCOPE,R181_B_PATCH,R181_B_TARGET,
} from '../tools/r181-protected-b-transaction.mjs';
import {PINNED_R181_SHA256} from '../tools/r181-pinned-route-candidate.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const CONTROL_SHA='a'.repeat(40);
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const make=()=>{
  const manifest={
    schema:R181_B_APPROVAL_SCHEMA,status:'APPROVED_B',
    scope:R181_B_SCOPE,operation:R181_B_OPERATION,controlSourceSha:CONTROL_SHA,
    targetPath:R181_B_TARGET,beforeSha256:PINNED_R181_SHA256,
    patchId:R181_B_PATCH,runCount:1,allowProviderCalls:false,
    allowDbWrites:false,allowD1Writes:false,allowTaskChanges:false,
    allowOtherFileChanges:false,
  };
  const manifestBytes=Buffer.from(JSON.stringify(manifest));
  const request={
    schema:R181_B_REQUEST_SCHEMA,
    requestId:'00000000-0000-4000-8000-000000000001',
    chatId:'00000000-0000-4000-8000-000000000002',
    operation:R181_B_OPERATION,controlRepository:REPO,
    approvalManifestPath:'approvals/r181-protected-b/r181-exact-scope.json',
    approvalManifestSha256:sha(manifestBytes),
  };
  const event={
    repository:{full_name:REPO,private:true},
    sender:{login:'ansqhd5774-Choi'},
    issue:{number:12345,title:R181_B_OPERATION,pull_request:null,
      user:{login:'ansqhd5774-Choi'},
      labels:[{name:'pc-writer-b-install'}],
      body:JSON.stringify(request)},
  };
  const env={
    GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
    GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
    GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:CONTROL_SHA,
  };
  return {manifest,manifestBytes,request,event,env};
};
const code=fn=>assert.throws(fn,e=>typeof e?.code==='string'&&e.code.startsWith('R181_B_'));

test('exact merged B admission envelope produces opaque proof, no host IO',()=>{
  const input=make();
  const proof=authorizeR181ProtectedB(input);
  assert.equal(proof.request.operation,R181_B_OPERATION);
  assert.equal(proof.manifest.targetPath,R181_B_TARGET);
  assert.equal(proof.sourceSha,CONTROL_SHA);
  assert.equal(Object.isFrozen(proof),true);
  assert.equal(proof.manifestSha256,sha(input.manifestBytes));
});

test('unapproved private scope, actor and side effect permissions are rejected',()=>{
  const x=make();
  x.env.GITHUB_ACTOR='different';
  code(()=>authorizeR181ProtectedB(x));
  const y=make();y.manifest.allowDbWrites=true;
  y.manifestBytes=Buffer.from(JSON.stringify(y.manifest));
  y.request.approvalManifestSha256=sha(y.manifestBytes);
  y.event.issue.body=JSON.stringify(y.request);
  code(()=>authorizeR181ProtectedB(y));
  const z=make();z.manifest.targetPath='E:\\Wrong\\file.mjs';
  z.manifestBytes=Buffer.from(JSON.stringify(z.manifest));
  z.request.approvalManifestSha256=sha(z.manifestBytes);
  z.event.issue.body=JSON.stringify(z.request);
  code(()=>authorizeR181ProtectedB(z));
});

test('modified manifest bytes, replay event and unexpected target are refused',()=>{
  const a=make();a.manifestBytes=Buffer.from(a.manifestBytes.toString()+' ');
  code(()=>authorizeR181ProtectedB(a));
  const b=make();b.env.GITHUB_RUN_ATTEMPT='2';
  code(()=>authorizeR181ProtectedB(b));
  const c=make();c.manifest.controlSourceSha='not-a-sha';
  c.manifestBytes=Buffer.from(JSON.stringify(c.manifest));
  c.request.approvalManifestSha256=sha(c.manifestBytes);
  c.event.issue.body=JSON.stringify(c.request);
  code(()=>authorizeR181ProtectedB(c));
});

test('directly constructed authorization cannot trigger B IO',async()=>{
  const calls=[];
  const io={acquireSharedWriterLease:async()=>calls.push('lock')};
  await assert.rejects(()=>runApprovedR181ProtectedB({
    request:{requestId:'00000000-0000-4000-8000-000000000001'},
  },io),e=>e?.code==='R181_B_AUTH_REQUIRED');
  assert.deepEqual(calls,[]);
});

function mockIo({failRelease=false,readError=false}={}){
  const calls=[];
  const io={
    acquireSharedWriterLease:async()=>{calls.push('LOCK');},
    readPinnedFile:async target=>{
      calls.push('READ');
      assert.equal(target,R181_B_TARGET);
      if(readError)throw Error('PRIVATE_UNSAFE_SOURCE_MESSAGE');
      return Buffer.from('not the real protected R181 source');
    },
    claimOnce:async()=>{calls.push('CLAIM');},
    backupAndVerify:async()=>{calls.push('BACKUP');},
    journal:async()=>{calls.push('JOURNAL');},
    replaceAtomically:async()=>{calls.push('REPLACE');},
    restoreAtomically:async()=>{calls.push('RESTORE');},
    releaseWriterLease:async(_,opts)=>{
      calls.push('RELEASE');
      assert.equal(opts.retain,false);
      if(failRelease)throw Error('private lock failure');
    },
  };
  return {calls,io};
}

test('real SHA mismatch stops before claim, backup, provider call or file write',async()=>{
  const proof=authorizeR181ProtectedB(make());
  const {calls,io}=mockIo();
  const r=await runApprovedR181ProtectedB(proof,io);
  assert.equal(r.status,'R181_B_PREFLIGHT_STOP');
  assert.equal(r.code,'R181_PREIMAGE_SHA_MISMATCH');
  assert.equal(r.applied,false);
  assert.equal(r.providerCalls,0);
  assert.equal(r.dbWrites,0);
  assert.equal(r.d1Writes,0);
  assert.deepEqual(calls,['LOCK','READ','RELEASE']);
  assert.equal(JSON.stringify(r).includes('not the real protected'),false);
});

test('private read errors are reduced to safe code; lease always released',async()=>{
  const {calls,io}=mockIo({readError:true});
  const r=await runApprovedR181ProtectedB(authorizeR181ProtectedB(make()),io);
  assert.equal(r.status,'R181_B_PREFLIGHT_STOP');
  assert.equal(r.code,'R181_B_UNCLASSIFIED_STOP');
  assert.deepEqual(calls,['LOCK','READ','RELEASE']);
  assert.equal(JSON.stringify(r).includes('PRIVATE_UNSAFE'),false);
});

test('unverified lease release is recovery-required, never claimed success',async()=>{
  const {calls,io}=mockIo({failRelease:true});
  const r=await runApprovedR181ProtectedB(authorizeR181ProtectedB(make()),io);
  assert.equal(r.status,'R181_B_RECOVERY_REQUIRED');
  assert.equal(r.code,'R181_B_RELEASE_UNVERIFIED');
  assert.deepEqual(calls,['LOCK','READ','RELEASE']);
});
