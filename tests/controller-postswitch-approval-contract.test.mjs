import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {INCIDENT,MATERIAL_KEYS,TOOL_PATHS,WRITER_TRANSITION,WRITER_FOLLOWUP,
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

const followupManifest=()=>({...manifest(true),writerFollowup:structuredClone(WRITER_FOLLOWUP)});
const followupEvidence=()=>({...evidence(true),writerFollowupVerified:true});
const checkFollowup=(ap=followupManifest(),ev=followupEvidence(),sha=sourceSha)=>
 validatePostSwitchApproval(ap,{requestId:INCIDENT.requestId,sourceSha:sha,evidence:ev});
test('new C contract explicitly binds four B receipts and exact latest config hash',()=>{
 const ap=checkFollowup();
 assert.equal(ap.writerFollowup.writerB.length,4);
 assert.equal(ap.writerFollowup.currentConfigSha256,
   '0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453');
 assert.deepEqual(ap.writerTransition,WRITER_TRANSITION);
});
test('historical C consent cannot authorize later Writer overlays',()=>{
 assert.throws(()=>checkFollowup(manifest(true)),/NEW_CONSENT_REQUIRED/);
 assert.throws(()=>checkFollowup(followupManifest(),evidence(true)),/FOLLOWUP_UNVERIFIED/);
 const ap=followupManifest();delete ap.writerTransition;
 assert.throws(()=>checkFollowup(ap),/FOLLOWUP_UNVERIFIED/);
});
test('altered or incomplete new consent and missing source closure are rejected',()=>{
 for(const edit of [
  ap=>{ap.writerFollowup.currentConfigSha256='0'.repeat(64);},
  ap=>{ap.writerFollowup.writerB.pop();},
  ap=>{ap.writerFollowup.writerB[0].blobSha='0'.repeat(40);},
  ap=>{ap.writerFollowup.writerA.blobSha='0'.repeat(40);},
  ap=>{ap.writerFollowup.sourceSequence.reverse();},
  ap=>{ap.writerFollowup.extra=true;},
  ap=>{delete ap.toolHashes['tools/controller-postswitch-writer-readonly.mjs'];},
  ap=>{ap.approved=false;},
  ap=>{ap.expectedBacklogIssues=[919,919];},
 ]){const ap=followupManifest();edit(ap);assert.throws(()=>checkFollowup(ap));}
 assert.throws(()=>checkFollowup(followupManifest(),followupEvidence(),'0'.repeat(40)),/IDENTITY_INVALID/);
});

test('committed review candidate stays unapproved and pins exact source file bytes',()=>{
 const ap=JSON.parse(fs.readFileSync(new URL('../approvals/maintenance-recoveries/'+
   INCIDENT.requestId+'.postswitch.candidate.json',import.meta.url),'utf8'));
 assert.equal(ap.approved,false);
 assert.throws(()=>validatePostSwitchApproval(ap,{requestId:INCIDENT.requestId,
   sourceSha:ap.sourceSha,evidence:{...followupEvidence(),materialHashes:ap.evidenceHashes}}),
   /IDENTITY_INVALID/);
 for(const file of TOOL_PATHS){
  const bytes=execFileSync('git',['show',ap.sourceSha+':'+file],{windowsHide:true});
  assert.equal(createHash('sha256').update(bytes).digest('hex'),ap.toolHashes[file]);
 }
});
