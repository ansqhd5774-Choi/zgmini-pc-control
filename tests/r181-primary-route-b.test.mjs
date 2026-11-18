import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  PINNED_R181_PRIMARY_SHA256,prepareR181PrimaryRouteCandidateForExactPreimage,
  preparePinnedR181PrimaryRouteCandidate,
} from '../tools/r181-primary-route-candidate.mjs';
import {
  R181_PRIMARY_B_OPERATION,R181_PRIMARY_B_REQUEST_SCHEMA,
  R181_PRIMARY_B_APPROVAL_SCHEMA,R181_PRIMARY_B_SCOPE,
  R181_PRIMARY_B_PATCH,R181_PRIMARY_B_TARGET,
  authorizeR181PrimaryProtectedB,runApprovedR181PrimaryProtectedB,
} from '../tools/r181-primary-b-transaction.mjs';
import {createR181ProtectedWindowsIo}
  from '../tools/r181-protected-b-windows-io.mjs';
import {sanitizeR181BReport} from '../tools/r181-primary-b-report.mjs';
const SHA=b=>createHash('sha256').update(b).digest('hex');
const R='ansqhd5774-Choi/zgmini-pc-control',HEAD='a'.repeat(40);
const source=Buffer.from([
  "const HOME='https://getmarkethistory.com';",
  "export function buildUrl(symbol,start,end){return HOME+'/api/v1/bars/stocks/'+symbol+'/1h?start='+start+'&end='+end;}",
  "export const list=['BOTZ','ROBO','SPY'];",
].join('\n'));
function admission(){
  const manifest={
    schema:R181_PRIMARY_B_APPROVAL_SCHEMA,status:'APPROVED_B',
    scope:R181_PRIMARY_B_SCOPE,operation:R181_PRIMARY_B_OPERATION,
    controlSourceSha:'b'.repeat(40),targetPath:R181_PRIMARY_B_TARGET,
    beforeSha256:PINNED_R181_PRIMARY_SHA256,patchId:R181_PRIMARY_B_PATCH,
    runCount:1,allowProviderCalls:false,allowDbWrites:false,
    allowD1Writes:false,allowTaskChanges:false,allowOtherFileChanges:false,
  };
  const bytes=Buffer.from(JSON.stringify(manifest));
  const request={
    schema:R181_PRIMARY_B_REQUEST_SCHEMA,
    requestId:'00000000-0000-4000-8000-000000000001',
    chatId:'00000000-0000-4000-8000-000000000002',
    operation:R181_PRIMARY_B_OPERATION,controlRepository:R,
    approvalManifestPath:'approvals/r181-primary-b/r181-primary-exact-one.json',
    approvalManifestSha256:SHA(bytes),
  };
  const event={repository:{full_name:R,private:true},
    sender:{login:'ansqhd5774-Choi'},
    issue:{number:555,title:R181_PRIMARY_B_OPERATION,
      user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
      body:JSON.stringify(request)}};
  const env={GITHUB_REPOSITORY:R,GITHUB_EVENT_NAME:'issues',
    GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
    GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:HEAD,GITHUB_RUN_ID:'43800000001'};
  return {manifest,bytes,request,event,env};
}
test('exact real URL-owner route yields only in-memory +3 byte candidate',()=>{
  const made=prepareR181PrimaryRouteCandidateForExactPreimage(source,SHA(source));
  assert.equal(made.status,'PREPARED_CANDIDATE_ONLY');
  assert.equal(made.changedByteCount,3);
  assert.equal(made.providerCalls,0);
  assert.equal(made.operationalWrites,0);
  assert.equal(made.applied,false);
  assert.equal(JSON.stringify(made).includes('getmarkethistory.com'),false);
  const next=made.getPrivateCandidateBytes();
  assert.equal(next.length,source.length+3);
  assert.ok(next.toString().includes('/api/v1/bars/stocks/us/'));
  assert.ok(!source.toString().includes('/api/v1/bars/stocks/us/'));
});
test('real protected 4328-byte preimage pin rejects all fixture substitutions',()=>{
  assert.match(PINNED_R181_PRIMARY_SHA256,/^[a-f0-9]{64}$/);
  const small=preparePinnedR181PrimaryRouteCandidate(source);
  assert.equal(small.code,'R181_PRIMARY_PREIMAGE_SIZE_STOP');
  const mismatch=preparePinnedR181PrimaryRouteCandidate(Buffer.alloc(4328,0x61));
  assert.equal(mismatch.code,'R181_PREIMAGE_SHA_MISMATCH');
  for(const r of [small,mismatch])assert.equal(r.applied,false);
});
test('duplicate, commented, and already-modern path cannot write',()=>{
  const paths=[
    [Buffer.concat([source,Buffer.from("\nconst old='/api/v1/bars/stocks/';")]),'R181_LEGACY_ROUTE_NOT_UNIQUE'],
    [Buffer.from(source.toString().replace('/api/v1/bars/stocks/','/api/v1/bars/stocks/us/')),'R181_CURRENT_ROUTE_ALREADY_PRESENT'],
  ];
  for(const [bytes,code] of paths){
    const made=prepareR181PrimaryRouteCandidateForExactPreimage(bytes,SHA(bytes));
    assert.equal(made.code,code);
    assert.equal(made.applied,false);
  }
});
test('one approved private B admission binds exact one-time PC helper only',()=>{
  const x=admission();
  const proof=authorizeR181PrimaryProtectedB({event:x.event,env:x.env,manifestBytes:x.bytes});
  assert.equal(proof.manifest.targetPath,R181_PRIMARY_B_TARGET);
  assert.equal(proof.approvedCodeSha,x.manifest.controlSourceSha);
  const bad=admission();bad.event.issue.title='r181-protected-route-install';
  assert.throws(()=>authorizeR181PrimaryProtectedB({event:bad.event,env:bad.env,
    manifestBytes:bad.bytes}),e=>e.code==='R181_PRIMARY_B_EVENT_DENIED');
});
test('unverified protected source stops before claim or file switch',async()=>{
  const x=admission();
  const proof=authorizeR181PrimaryProtectedB({event:x.event,env:x.env,manifestBytes:x.bytes});
  const called=[];
  const io={
    acquireSharedWriterLease:async()=>called.push('LEASE'),
    readPinnedFile:async target=>{assert.equal(target,R181_PRIMARY_B_TARGET);
      called.push('READ');return Buffer.from('unapproved fixture');},
    claimOnce:async()=>{throw Error('SHOULD_NOT_CLAIM');},
    backupAndVerify:async()=>{throw Error('SHOULD_NOT_BACKUP');},
    journal:async()=>{throw Error('SHOULD_NOT_JOURNAL');},
    replaceAtomically:async()=>{throw Error('SHOULD_NOT_REPLACE');},
    restoreAtomically:async()=>{throw Error('SHOULD_NOT_RESTORE');},
    releaseWriterLease:async()=>called.push('RELEASE'),
  };
  const result=await runApprovedR181PrimaryProtectedB(proof,io);
  assert.equal(result.status,'R181_PRIMARY_B_PREFLIGHT_STOP');
  assert.equal(result.code,'R181_PRIMARY_PREIMAGE_SIZE_STOP');
  assert.deepEqual(called,['LEASE','READ','RELEASE']);
  assert.equal(result.operationalWrites??0,0);
});
test('result reporter cannot fabricate applied success or leak raw PC source',()=>{
  const x=admission();
  const forged={requestId:x.request.requestId,status:'R181_PRIMARY_B_APPLIED_VERIFIED',
    code:'R181_PRIMARY_B_SINGLE_ROUTE_APPLIED',applied:true,
    changedFileCount:1,changedByteCount:3,
    beforeSha256:PINNED_R181_PRIMARY_SHA256,
    afterSha256:'c'.repeat(64),controlSha:HEAD,
    manifestSha256:x.request.approvalManifestSha256,
    backupVerified:false,rawSource:'PRIVATE_PC_SOURCE'};
  const bad=sanitizeR181BReport(forged,x.request,x.env);
  assert.equal(bad.status,'R181_PRIMARY_B_STATE_UNKNOWN');
  const good=sanitizeR181BReport({...forged,backupVerified:true},x.request,x.env);
  assert.equal(good.status,'R181_PRIMARY_B_APPLIED_VERIFIED');
  assert.equal(JSON.stringify(good).includes('PRIVATE_PC_SOURCE'),false);
});
test('common Windows IO admits only fixed CYCLE or PRIMARY profiles',()=>{
  if(process.platform!=='win32'){
    assert.throws(()=>createR181ProtectedWindowsIo('PRIMARY'),
      e=>e.code==='R181_B_WINDOWS_ONLY_STOP');
    return;
  }
  assert.equal(Object.isFrozen(createR181ProtectedWindowsIo()),true);
  assert.equal(Object.isFrozen(createR181ProtectedWindowsIo('PRIMARY')),true);
  assert.throws(()=>createR181ProtectedWindowsIo('ARBITRARY'),
    e=>e.code==='R181_B_PROFILE_DENIED');
});
