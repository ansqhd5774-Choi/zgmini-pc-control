import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {runR181ApprovedEntry} from '../tools/r181-protected-b-entry.mjs';
import {sanitizeR181BReport} from '../tools/r181-protected-b-report.mjs';
import {R181_B_TARGET,R181_B_OPERATION,R181_B_APPROVAL_SCHEMA,
  R181_B_REQUEST_SCHEMA,R181_B_SCOPE,R181_B_PATCH}
  from '../tools/r181-protected-b-transaction.mjs';
import {PINNED_R181_SHA256} from '../tools/r181-pinned-route-candidate.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const REPO='ansqhd5774-Choi/zgmini-pc-control',HEAD='a'.repeat(40);
const fixture=()=>{
  const manifest={schema:R181_B_APPROVAL_SCHEMA,status:'APPROVED_B',
    scope:R181_B_SCOPE,operation:R181_B_OPERATION,controlSourceSha:'b'.repeat(40),
    targetPath:R181_B_TARGET,beforeSha256:PINNED_R181_SHA256,
    patchId:R181_B_PATCH,runCount:1,allowProviderCalls:false,
    allowDbWrites:false,allowD1Writes:false,allowTaskChanges:false,
    allowOtherFileChanges:false};
  const bytes=Buffer.from(JSON.stringify(manifest));
  const request={schema:R181_B_REQUEST_SCHEMA,
    requestId:'00000000-0000-4000-8000-000000000001',
    chatId:'00000000-0000-4000-8000-000000000002',
    operation:R181_B_OPERATION,controlRepository:REPO,
    approvalManifestPath:'approvals/r181-protected-b/r181-exact-case.json',
    approvalManifestSha256:sha(bytes)};
  const event={repository:{full_name:REPO,private:true},
    sender:{login:'ansqhd5774-Choi'},issue:{number:500,title:R181_B_OPERATION,
      pull_request:null,user:{login:'ansqhd5774-Choi'},
      labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(request)}};
  const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
    GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
    GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:HEAD,GITHUB_RUN_ID:'43800000001'};
  return {manifest,bytes,request,event,env};
};

test('reviewed code pin can predate manifest commit and still has independent admission',async()=>{
  if(process.platform!=='win32')return;
  const x=fixture(),called=[];
  const io={
    acquireSharedWriterLease:async()=>{called.push('LOCK');},
    readPinnedFile:async target=>{
      assert.equal(target,R181_B_TARGET);called.push('READ');
      return Buffer.from('unmatched non-operational fixture');},
    claimOnce:async()=>{throw Error('should not claim');},
    backupAndVerify:async()=>{throw Error('should not backup');},
    journal:async()=>{throw Error('should not journal');},
    replaceAtomically:async()=>{throw Error('should not replace');},
    restoreAtomically:async()=>{throw Error('should not restore');},
    releaseWriterLease:async()=>{called.push('RELEASE');},
  };
  const result=await runR181ApprovedEntry({event:x.event,env:x.env,
    controlRoot:'C:\\mock-control',head:()=>HEAD,
    manifestReader:()=>x.bytes,
    reviewedCode:(_,pin)=>{called.push('REVIEW');assert.equal(pin,'b'.repeat(40));},
    makeWindowsIo:()=>io});
  assert.deepEqual(called,['REVIEW','LOCK','READ','RELEASE']);
  assert.equal(result.status,'R181_B_PREFLIGHT_STOP');
  assert.equal(result.requestId,x.request.requestId);
  assert.equal(result.controlSha,HEAD);
  assert.equal(result.applied,false);
});

test('manifest approval and reviewer must be verified before IO binding',async()=>{
  if(process.platform!=='win32')return;
  const x=fixture();x.manifest.status='DRAFT_NOT_APPROVED';
  const bytes=Buffer.from(JSON.stringify(x.manifest));
  x.request.approvalManifestSha256=sha(bytes);
  x.event.issue.body=JSON.stringify(x.request);
  let ioCalled=false;
  await assert.rejects(
    ()=>runR181ApprovedEntry({event:x.event,env:x.env,controlRoot:'C:\\fixture',
      head:()=>HEAD,manifestReader:()=>bytes,
      reviewedCode:()=>{throw Error('must never reach review');},
      makeWindowsIo:()=>{ioCalled=true;throw Error('untrusted execution');}}),
    e=>e?.code==='R181_B_APPROVAL_DENIED');
  assert.equal(ioCalled,false);
});

test('R181 reporter disallows fabricated success and private data fields',()=>{
  const f=fixture(),request=f.request,env=f.env;
  const falseSuccess={status:'R181_B_APPLIED_VERIFIED',
    code:'R181_B_SINGLE_ROUTE_APPLIED',requestId:request.requestId,
    applied:true,changedFileCount:1,changedByteCount:3,
    beforeSha256:PINNED_R181_SHA256,afterSha256:'c'.repeat(64),
    controlSha:HEAD,manifestSha256:request.approvalManifestSha256,
    backupVerified:false,rawSource:'private source'};
  const r=sanitizeR181BReport(falseSuccess,request,env);
  assert.equal(r.status,'R181_B_STATE_UNKNOWN');
  assert.equal(JSON.stringify(r).includes('private source'),false);
  const good=sanitizeR181BReport({...falseSuccess,backupVerified:true},request,env);
  assert.equal(good.status,'R181_B_APPLIED_VERIFIED');
  assert.equal(good.changedFileCount,1);
  assert.equal(JSON.stringify(good).includes('private source'),false);
});

test('existing Writer B workflow routes both approved titles without cross-executing',()=>{
  const root=path.dirname(fileURLToPath(import.meta.url));
  const s=readFileSync(path.join(root,'..','.github','workflows',
    'pc-writer-b-source-once.yml'),'utf8');
  assert.match(s,/r181-protected-route-install/);
  assert.match(s,/if: github\.event\.issue\.title == 'pc-writer-source-install'/);
  assert.match(s,/id: r181/);
  assert.match(s,/r181-protected-b-entry\.mjs/);
  assert.match(s,/r181-protected-b-report\.mjs/);
  assert.match(s,/fetch-depth:.*r181-protected-route-install/);
});
