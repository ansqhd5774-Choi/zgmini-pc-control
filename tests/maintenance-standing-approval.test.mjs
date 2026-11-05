import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {resolveStandingControllerBApproval} from '../tools/maintenance-admission-queue.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const actor='ansqhd5774-Choi';
const target='b'.repeat(40);
const manifest={schema:'ZGMINI_PC_UPDATE_V1',targetSha:target,
 purpose:'pc-controller-maintenance',
 approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',
  ref:`https://github.com/${repo}/pull/28`},
 checks:{status:'PASS',targetSha:target}};
const bytes=Buffer.from(JSON.stringify(manifest));
const sha256=value=>createHash('sha256').update(value).digest('hex');
const intent={queueId:'queue-12345678',ref:`https://github.com/${repo}/pull/28`,
 targetControllerSha:target,approvalManifestSha256:sha256(bytes),
 scope:'PC_CONTROL_CONTROLLER_UPDATE',action:'SUBMIT_APPROVED_B_ONCE'};

const grant={repository:repo,sourceRef:'main',sourcePath:'docs/PC_AUTOMATION_STANDARD.md',
 actor,ownerVerified:true,active:true,scope:'PC_CONTROL_CONTROLLER_UPDATE'};
const ready={repository:repo,sourceRef:'main',
 sourcePath:'coordination/controller-admission-ready.json',actor,ownerVerified:true,
 queueId:intent.queueId,ref:intent.ref,targetControllerSha:target,
 approvalManifestSha256:intent.approvalManifestSha256};
const approved={sourceRepository:repo,sourceRef:'main',
 sourcePath:`approvals/controller-updates/${target}.json`,
 approvalRefConfirmed:true,bytes};
const resolve=(overrides={})=>resolveStandingControllerBApproval({
 intent,standingGrant:grant,readyOwnerProof:ready,approvedManifest:approved,...overrides});

test('same-purpose standing B approval reuses the verified owner scope, no extra per-job receipt',()=>{
 const r=resolve();
 assert.equal(r.verified,true);
 assert.equal(r.actor,actor);
 assert.equal(r.queueId,intent.queueId);
 assert.equal(r.approvalManifestSha256,intent.approvalManifestSha256);
 assert.equal(r.code,'QUEUE_STANDING_APPROVAL_VERIFIED');
});

test('main document text or comment alone cannot impersonate owner-verified standing approval',()=>{
 for(const evidence of [undefined,{...grant,ownerVerified:false},
  {...grant,sourceRef:'feature'},
  {...grant,actor:'github-actions[bot]'},
  {...grant,active:false},
  {body:'user approved #68',scope:grant.scope}]){
  const r=resolve({standingGrant:evidence});
  assert.equal(r.verified,false);
  assert.equal(r.code,'QUEUE_STANDING_GRANT_UNVERIFIED');
 }
});

test('explicit main READY must carry independent owner provenance and exact queue binding',()=>{
 for(const evidence of [undefined,{...ready,ownerVerified:false},
  {...ready,queueId:'queue-different'},
  {...ready,approvalManifestSha256:'0'.repeat(64)},
  {...ready,sourceRef:'codex/draft'}]){
  const r=resolve({readyOwnerProof:evidence});
  assert.equal(r.verified,false);
  assert.equal(r.code,'QUEUE_STANDING_READY_OWNER_UNVERIFIED');
 }
});

test('manifest bytes, main path, approval linkage and target hash must be exact',()=>{
 for(const evidence of [undefined,{...approved,sourceRef:'feature'},
  {...approved,sourcePath:'approvals/controller-updates/unrelated.json'},
  {...approved,approvalRefConfirmed:false},
  {...approved,bytes:Buffer.from('{}')},
  {...approved,bytes:Buffer.from(bytes.toString()+' ')}]){
  const r=resolve({approvedManifest:evidence});
  assert.equal(r.verified,false);
  assert.equal(r.code,'QUEUE_STANDING_MANIFEST_UNVERIFIED');
 }
});

test('new purpose/authority cannot silently inherit existing controller standing B grant',()=>{
 for(const change of [
  {intent:{...intent,scope:'PC_CONTROL_UNRESTRICTED_UPDATE'}},
  {intent:{...intent,action:'EXECUTE_SHELL'}},
  {standingGrant:{...grant,scope:'PC_CONTROL_UNRESTRICTED_UPDATE'}},
 ]){
  const r=resolve(change);
  assert.equal(r.verified,false);
 }
});

test('the existing safety-fix purpose shares the approved Controller B scope',()=>{
 const altered=Buffer.from(JSON.stringify({...manifest,purpose:'pc-controller-safety-fix'}));
 const newIntent={...intent,approvalManifestSha256:sha256(altered)};
 const r=resolve({intent:newIntent,
  readyOwnerProof:{...ready,approvalManifestSha256:newIntent.approvalManifestSha256},
  approvedManifest:{...approved,bytes:altered}});
 assert.equal(r.verified,true);
});

test('B manifest purpose or approval scope drift cannot be promoted by a valid standing grant',()=>{
 for(const edit of [
  {purpose:'pc-unrestricted-maintenance'},
  {approval:{...manifest.approval,grade:'A'}},
  {approval:{...manifest.approval,scope:'WRITER_UNRESTRICTED'}},
  {checks:{...manifest.checks,status:'FAILED'}},
 ]){
  const altered=Buffer.from(JSON.stringify({...manifest,...edit}));
  const newIntent={...intent,approvalManifestSha256:sha256(altered)};
  const r=resolve({intent:newIntent,
   readyOwnerProof:{...ready,approvalManifestSha256:newIntent.approvalManifestSha256},
   approvedManifest:{...approved,bytes:altered}});
  assert.equal(r.verified,false);
  assert.equal(r.code,'QUEUE_STANDING_SCOPE_MISMATCH');
 }
});
