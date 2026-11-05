import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {test} from 'node:test';
import {manifestFingerprint} from '../tools/maintenance-contract.mjs';
import {admitApprovedControllerOnce,CONTROLLER_ADMISSION_SCHEMA,
 CONTROLLER_ADMISSION_LANE} from '../tools/maintenance-admission-queue.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const INSTALLED='a'.repeat(40),TARGET='b'.repeat(40);
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

function fixture({installed=INSTALLED,target=TARGET,queueId='queue-12345678',
 requestId='pc-11223344-5566-4788-9aab-ccddeeff0011',status='READY'}={}){
 const allowFiles=[{path:'controller/operations.mjs',sha256:'c'.repeat(64)}];
 const manifest={schema:'ZGMINI_PC_UPDATE_V1',installedSha:installed,targetSha:target,
  allowFiles,purpose:'pc-controller-maintenance',
  approval:{grade:'B',ref:`https://github.com/${REPO}/pull/28`,scope:'PC_CONTROL_CONTROLLER_UPDATE'},
  checks:{targetSha:target,status:'PASS',manifestSha256:manifestFingerprint(allowFiles).sha256},
  backup:{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installed}},
  postOperation:'core-status',postSourceBranch:'main',postSourceSha:target};
 const raw=Buffer.from(JSON.stringify(manifest));
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId,
  chatId:'chat-22334455-6677-4889-9aab-ddeeff001122',operation:'controller-update',
  controlRepository:REPO,targetControllerSha:target,approvalManifestSha256:digest(raw)};
 const item={schema:CONTROLLER_ADMISSION_SCHEMA,queueId,
  resourceLane:CONTROLLER_ADMISSION_LANE,status,request,dependencies:[]};
 return {item,raw};
}

const trustedPrior=(f,{issueNumber=72,status='QUEUED',
 request=f.item.request,author='ansqhd5774-Choi',title='pc-controller-update'}={})=>({
 issueNumber,status,request,author,title,labels:['pc-maintenance']});

function adapters(raw,{existing=null,approvalRefConfirmed=true,claimResult=true,
 pendingLane=false,submit=async()=>({issueNumber:88}),confirmRemote=true}={}){
 let n=0,claims=0,reads=0,current=existing;
 return {loadApprovedManifest:async path=>{
  assert.match(path,/^approvals\/controller-updates\/[a-f0-9]{40}\.json$/);
  return {bytes:raw,sourceRef:'main',approvalRefConfirmed};
 },readExisting:async()=>{reads++;return current;},
 readLanePending:async()=>({authoritative:true,pending:pendingLane}),
 claimLane:async()=>{claims++;return {acquired:claimResult};},
 submitIssue:async issue=>{
  n++;const result=await submit(issue);
  if(confirmRemote&&Number.isSafeInteger(result?.issueNumber))current={
   issueNumber:result.issueNumber,status:'QUEUED',request:JSON.parse(issue.body),
   author:'ansqhd5774-Choi',title:issue.title,labels:issue.labels};
  return result;
 },
 get calls(){return {submitted:n,claims,reads};}};
}

const invoke=(f,api,overrides={})=>admitApprovedControllerOnce({
 item:f.item,installedSha:INSTALLED,actor:'ansqhd5774-Choi',
 activeInstallLease:false,...api,...overrides});

test('approved main manifest produces one fixed seven-field issue',async()=>{
 const f=fixture(),a=adapters(f.raw);
 const r=await invoke(f,a);
 assert.equal(r.status,'ADMITTED');assert.equal(r.issueNumber,88);
 assert.equal(a.calls.submitted,1);assert.equal(a.calls.claims,1);
 const b=adapters(f.raw,{submit:async issue=>{
  assert.equal(issue.title,'pc-controller-update');
  assert.deepEqual(issue.labels,['pc-maintenance']);
  assert.deepEqual(Object.keys(JSON.parse(issue.body)),[
   'schema','requestId','chatId','operation','controlRepository',
   'targetControllerSha','approvalManifestSha256']);
  return {issueNumber:99};
 }});
 assert.equal((await invoke(f,b)).issueNumber,99);
});

test('six concurrent chats with a durable atomic lane claim admit only one',async()=>{
 const f=fixture();let owned=false,created=0;
 const api={loadApprovedManifest:async()=>({bytes:f.raw,sourceRef:'main',approvalRefConfirmed:true}),
  readExisting:async()=>created?trustedPrior(f,{issueNumber:101}):null,
  readLanePending:async()=>({authoritative:true,pending:false}),
  claimLane:async()=>{if(owned)return {acquired:false};owned=true;return {acquired:true};},
  submitIssue:async()=>({issueNumber:100+ ++created})};
 const rows=await Promise.all(Array.from({length:6},()=>invoke(f,api)));
 assert.equal(rows.filter(x=>x.status==='ADMITTED').length,1);
 assert.equal(rows.filter(x=>x.status==='WAITING_RESOURCE').length,5);
 assert.equal(created,1);
});

test('different target SHAs still contend on the same whole-lane claim',async()=>{
 const a=fixture(),b=fixture({target:'c'.repeat(40),queueId:'queue-87654321',
  requestId:'pc-99887766-6655-4433-8899-aabbccddeeff'});
 let owned=false,submitted=0,accepted=null;
 const call=f=>invoke(f,{loadApprovedManifest:async()=>({bytes:f.raw,sourceRef:'main',approvalRefConfirmed:true}),
  readExisting:async()=>accepted&&accepted.item.request.requestId===f.item.request.requestId
   ?trustedPrior(f,{issueNumber:accepted.issueNumber}):null,
  readLanePending:async()=>({authoritative:true,pending:false}),
  claimLane:async()=>{
   if(owned)return {acquired:false};owned=true;return {acquired:true};},
  submitIssue:async()=>{const issueNumber=1+ ++submitted;accepted={item:f.item,issueNumber};
   return {issueNumber};}});
 const rows=await Promise.all([call(a),call(b)]);
 assert.deepEqual(rows.map(x=>x.status).sort(),['ADMITTED','WAITING_RESOURCE']);
 assert.equal(submitted,1);
});

test('existing request is reused and no claim or re-submit occurs',async()=>{
 const f=fixture(),a=adapters(f.raw,{existing:trustedPrior(f,{status:'SUCCEEDED'})});
 const r=await invoke(f,a);assert.equal(r.status,'EXISTING');
 assert.equal(r.issueNumber,72);assert.equal(a.calls.claims,0);
 assert.equal(a.calls.submitted,0);
});

test('existing uncertain issue never triggers another submit',async()=>{
 const f=fixture(),a=adapters(f.raw,{existing:trustedPrior(f,{status:'SUBMITTING'})});
 const r=await invoke(f,a);assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(a.calls.submitted,0);
});

test('unverified approval and unready queue stay non-mutating',async()=>{
 const f=fixture(),a=adapters(f.raw,{approvalRefConfirmed:false});
 assert.equal((await invoke(f,a)).status,'WAITING_APPROVAL');
 assert.equal(a.calls.submitted,0);
 f.item.status='WAITING_APPROVAL';
 assert.equal((await invoke(f,a)).status,'WAITING_APPROVAL');
});

test('real installed SHA drift, active lease, missing dependency are local stops',async()=>{
 const f=fixture(),a=adapters(f.raw);
 assert.equal((await invoke(f,a,{installedSha:'f'.repeat(40)})).code,
  'UPDATE_INSTALLED_SOURCE_DRIFT');
 assert.equal((await invoke(f,a,{activeInstallLease:true})).status,'WAITING_RESOURCE');
 f.item.dependencies=['queue-87654321'];
 assert.equal((await invoke(f,a)).status,'WAITING_DEPENDENCY');
 assert.equal(a.calls.submitted,0);
});

test('ambiguous Issue creation discovers committed request without submitting again',async()=>{
 const f=fixture();let reads=0,submits=0;
 const api={loadApprovedManifest:async()=>({bytes:f.raw,sourceRef:'main',approvalRefConfirmed:true}),
  claimLane:async()=>({acquired:true}),readExisting:async()=>{
   reads++;return reads<3?null:trustedPrior(f,{issueNumber:90});},
  readLanePending:async()=>({authoritative:true,pending:false}),
  submitIssue:async()=>{submits++;throw Error('NETWORK_TIMEOUT');}};
 const r=await invoke(f,api);
 assert.equal(r.status,'EXISTING');assert.equal(r.issueNumber,90);
 assert.equal(submits,1);assert.equal(reads,3);
});

test('unresolved submit/lookup leaves state unknown; never automatically retries',async()=>{
 const f=fixture();let count=0;
 const api={loadApprovedManifest:async()=>({bytes:f.raw,sourceRef:'main',approvalRefConfirmed:true}),
  claimLane:async()=>({acquired:true}),readExisting:async()=>null,
  readLanePending:async()=>({authoritative:true,pending:false}),
  submitIssue:async()=>{count++;throw Error('NETWORK_TIMEOUT');}};
 const r=await invoke(f,api);
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'QUEUE_SUBMISSION_UNCERTAIN');
 assert.equal(count,1);
});

test('unavailable lookup fails closed without acquiring lane',async()=>{
 const f=fixture();let claims=0;
 const api={loadApprovedManifest:async()=>({bytes:f.raw,sourceRef:'main',approvalRefConfirmed:true}),
  readExisting:async()=>{throw Error('HTTP_503');},claimLane:async()=>{claims++;return {acquired:true};},
  readLanePending:async()=>({authoritative:true,pending:false}),
  submitIssue:async()=>{throw Error('MUST_NOT_SUBMIT');}};
 assert.equal((await invoke(f,api)).status,'STATE_UNKNOWN');assert.equal(claims,0);
});

test('naked issue number and mismatched remote request cannot be reused',async()=>{
 const f=fixture();
 const naked=adapters(f.raw,{existing:{issueNumber:80,status:'QUEUED'}});
 assert.equal((await invoke(f,naked)).code,'QUEUE_EXISTING_UNVERIFIED');
 const wrong=adapters(f.raw,{existing:trustedPrior(f,{request:{
  ...f.item.request,targetControllerSha:'f'.repeat(40)}})});
 assert.equal((await invoke(f,wrong)).code,'QUEUE_EXISTING_UNVERIFIED');
 assert.equal(naked.calls.submitted,0);assert.equal(wrong.calls.submitted,0);
});

test('create response without matching remote readback remains unknown',async()=>{
 const f=fixture(),a=adapters(f.raw,{confirmRemote:false});
 const r=await invoke(f,a);assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'QUEUE_SUBMISSION_UNCERTAIN');assert.equal(r.claimHeld,true);
 assert.equal(a.calls.submitted,1);
});

test('install lease evidence is required, omitted input never means unlocked',async()=>{
 const f=fixture(),a=adapters(f.raw);
 const r=await invoke(f,a,{activeInstallLease:undefined});
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'QUEUE_INSTALL_LEASE_UNVERIFIED');
 assert.equal(a.calls.submitted,0);
});

test('previous manually queued B issue for different target blocks new admission',async()=>{
 const f=fixture(),a=adapters(f.raw,{pendingLane:true});
 const r=await invoke(f,a);
 assert.equal(r.status,'WAITING_RESOURCE');assert.equal(r.code,'QUEUE_PRIOR_B_PENDING');
 assert.equal(a.calls.claims,0);assert.equal(a.calls.submitted,0);
});

test('manual pending issue appearing after claim retains claim for reconciliation',async()=>{
 const f=fixture();let reads=0,submits=0;
 const a=adapters(f.raw,{submit:async()=>{submits++;throw Error('NOT_EXPECTED');}});
 const r=await invoke(f,{...a,readLanePending:async()=>({authoritative:true,pending:++reads>1})});
 assert.equal(r.status,'WAITING_RESOURCE');assert.equal(r.code,'QUEUE_PRIOR_B_PENDING');
 assert.equal(r.claimHeld,true);assert.equal(r.needsClaimReconciliation,true);
 assert.equal(submits,0);
});

test('missing or malformed authoritative pending-lane observation fails closed',async()=>{
 const f=fixture(),a=adapters(f.raw);
 for(const observed of [undefined,{}, {authoritative:true}, {authoritative:false,pending:false}]){
  const r=await invoke(f,{...a,readLanePending:async()=>observed});
  assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'QUEUE_LANE_READ_UNVERIFIED');
 }
 assert.equal(a.calls.claims,0);assert.equal(a.calls.submitted,0);
});

test('malformed lane claim is unknown, not a safe occupied-lane result',async()=>{
 const f=fixture(),a=adapters(f.raw);
 const r=await invoke(f,{...a,claimLane:async()=>({})});
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'QUEUE_LANE_CLAIM_UNVERIFIED');
 assert.equal(a.calls.submitted,0);
});
