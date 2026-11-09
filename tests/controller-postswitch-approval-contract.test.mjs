import test from 'node:test';
import assert from 'node:assert/strict';
import {INCIDENT,MATERIAL_KEYS,TOOL_PATHS,WRITER_TRANSITION,
  validatePostSwitchApproval} from '../tools/controller-postswitch-approval.mjs';

const sourceSha='f'.repeat(40);
const materialHashes=Object.fromEntries(MATERIAL_KEYS.map(k=>[k,'a'.repeat(64)]));
const toolHashes=Object.fromEntries(TOOL_PATHS.map(k=>[k,'b'.repeat(64)]));
const evidence=transition=>({materialHashes,checks:{
  PROTECTION_UNCHANGED:!transition,PROTECTION_CONTRACT_VERIFIED:transition,
}});
const manifest=transition=>({
  schema:'ZGMINI_PC_POSTSWITCH_RECOVERY_APPROVAL_V1',approved:true,
  operation:'FORWARD_POSTSWITCH_917',requestId:INCIDENT.requestId,
  issueNumber:INCIDENT.issueNumber,sourceSha,
  targetControllerSha:INCIDENT.newSha,installedShaBefore:INCIDENT.oldSha,
  evidenceHashes:materialHashes,toolHashes,
  postcheck:{operation:'core-status',sourceRepository:'ansqhd5774-Choi/zgmini',
    sourceBranch:'main',sourceSha},
  expectedBacklogIssues:[919],
  ...(transition ? {writerTransition:{...WRITER_TRANSITION}} : {}),
});
const check=(approval,transition)=>validatePostSwitchApproval(approval,
  {requestId:INCIDENT.requestId,sourceSha,evidence:evidence(transition)});

test('legacy unchanged protection remains a valid exact C approval',()=>{
  assert.equal(check(manifest(false),false).approved,true);
});
test('explicit verified Writer config transition is independently accepted',()=>{
  const approval=manifest(true);
  assert.equal(check(approval,true).writerTransition.currentConfigSha256,
    WRITER_TRANSITION.currentConfigSha256);
  assert.equal(approval.writerTransition.baselineConfigSha256,
    WRITER_TRANSITION.baselineConfigSha256);
});
test('transition needs both signed manifest and verified live evidence',()=>{
  assert.throws(()=>check(manifest(false),true),
    /POSTSWITCH_APPROVAL_PROTECTION_UNVERIFIED/);
  assert.throws(()=>check(manifest(true),false),
    /POSTSWITCH_APPROVED_WRITER_TRANSITION_UNVERIFIED/);
});
test('mismatched approved source and result blob cannot be substituted',()=>{
  for(const field of Object.keys(WRITER_TRANSITION)){
    const approval=manifest(true);
    approval.writerTransition[field]='0'.repeat(String(approval.writerTransition[field]).length);
    assert.throws(()=>check(approval,true),
      /POSTSWITCH_APPROVED_WRITER_TRANSITION_MISMATCH/);
  }
});
test('extraneous approval and transition fields fail exact schema',()=>{
  const approval=manifest(true);approval.writerTransition.unknown='value';
  assert.throws(()=>check(approval,true),/POSTSWITCH_APPROVED_WRITER_TRANSITION_MISMATCH/);
  const extra=manifest(true);extra.unsanctioned=true;
  assert.throws(()=>check(extra,true),/POSTSWITCH_APPROVAL_FIELDS_INVALID/);
});
