import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makeRecoveryPlan,planFromStableEvidence,persistUnapprovedRecoveryProposal} from '../tools/maintenance-recovery-plan.mjs';

const id='pc-update-9f22c05c-2735-4d63-81c8-b88c6d332d9a';
const source='dbe072206a599f7ac3c4eb9d86afd89cd4fdbd54';
const installed='14940aa112494b1cea09ff5c7250f4af86a4ce6a';
const toolSha256='a'.repeat(64);
const evidence=()=>({
  ledgerBytes:Buffer.from(JSON.stringify({requestId:id,issueNumber:319,
    installedShaBefore:installed,failureOperation:'inspect',privateProperty:'DO_NOT_PRINT'})),
  ownerBytes:Buffer.from('{"pid":1234,"nonce":"SENSITIVE_VALUE"}'),
  markerBytes:Buffer.from('{"requestOwnerPid":1234,"nonce":"SENSITIVE_VALUE"}'),
});
const requiredChecks=[
  'REQUEST_IDENTITY','DEAD_INSTALL_OWNER','PREVALIDATION_ONLY','ORIGINAL_BYTES',
  'NO_UPDATE_ARTIFACTS','NO_PAUSE','RUNNERS_IDLE','MAINTAINER_BYTES',
];
const inspection=()=>({requestId:id,sourceSha:source,status:'ABORT_UNTOUCHED_ELIGIBLE',
  code:'PREVALIDATION_ABORT_VERIFIED',operationalWrites:0,actualControllerSha:installed,
  checks:Object.fromEntries(requiredChecks.map(key=>[key,true]))});

test('proposes a precise but unapproved manifest without exposing private bytes',()=>{
  const result=makeRecoveryPlan({requestId:id,sourceSha:source,inspection:inspection(),
    ...evidence(),toolSha256});
  assert.equal(result.status,'PROPOSAL_ONLY');
  assert.equal(result.approvalDraft.approved,false);
  assert.equal(result.approvalDraft.issueNumber,319);
  for(const key of ['ledgerSha256','ownerSha256','markerSha256'])
    assert.match(result.approvalDraft[key],/^[a-f0-9]{64}$/);
  assert.equal(result.failureOperation,'inspect');
  assert.doesNotMatch(JSON.stringify(result),/SENSITIVE_VALUE|privateProperty|DO_NOT_PRINT|1234/);
});

test('rejects an ineligible or uncertain recovery',()=>{
  for(const patch of [{status:'RECOVERY_REQUIRED'},{operationalWrites:null},
    {checks:{...inspection().checks,ORIGINAL_BYTES:false}},{actualControllerSha:'b'.repeat(40)}]){
    assert.throws(()=>makeRecoveryPlan({requestId:id,sourceSha:source,
      inspection:{...inspection(),...patch},...evidence(),toolSha256}),
      /RECOVERY_PLAN_(NOT_ELIGIBLE|LEDGER_MISMATCH)/);
  }
});

test('rejects eight unrelated true checks, missing checks and unapproved substitutions',()=>{
  const valid=inspection();
  const inherited=Object.create(valid.checks);
  for(let i=0;i<8;i++)inherited['UNRELATED_'+i]=true;
  for(const checks of [
    Object.fromEntries(Array.from({length:8},(_,i)=>['CHECK_'+i,true])),
    inherited,
    Object.fromEntries(requiredChecks.slice(1).map(key=>[key,true])),
    {...valid.checks,ORIGINAL_BYTES:true,UNRELATED_CHECK:true},
    {...valid.checks,REQUEST_IDENTITY:false},
    Object.fromEntries([...requiredChecks.slice(1),'UNRELATED_CHECK'].map(key=>[key,true])),
  ]){
    assert.throws(()=>makeRecoveryPlan({requestId:id,sourceSha:source,
      inspection:{...valid,checks},...evidence(),toolSha256}),
    /RECOVERY_PLAN_NOT_ELIGIBLE/);
  }
});

test('rejects mutation between evidence reads without producing a plan',async()=>{
  let reads=0;
  await assert.rejects(()=>planFromStableEvidence({requestId:id,sourceSha:source,toolSha256,
    readEvidence:()=>{reads++;return {...evidence(),markerBytes:Buffer.from('nonce-'+reads)};},
    inspect:async()=>inspection()}),/RECOVERY_PLAN_EVIDENCE_CHANGED/);
});

test('allows stable double read with an official inspect result',async()=>{
  const result=await planFromStableEvidence({requestId:id,sourceSha:source,toolSha256,
    readEvidence:evidence,inspect:async()=>inspection()});
  assert.equal(result.approvalDraft.approved,false);
  assert.equal(result.operationalWrites,0);
});

test('explicitly saves only an unapproved proposal in a separate atomic artifact',()=>{
  const baseDir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-recovery-proposal-'));
  const plan=makeRecoveryPlan({requestId:id,sourceSha:source,inspection:inspection(),
    ...evidence(),toolSha256});
  plan.ownerBytes='SENSITIVE_VALUE';plan.approvalDraft.internalPath='E:/PRIVATE';
  const result=persistUnapprovedRecoveryProposal({plan,readEvidence:evidence,baseDir});
  assert.equal(result.status,'PROPOSAL_ONLY');assert.equal(result.approved,false);
  assert.equal(result.operationalWrites,0);assert.equal(result.proposalWrites,1);
  assert.match(result.proposalRelPath,/^recovery-proposals\//);
  const artifact=fs.readFileSync(path.join(baseDir,result.proposalRelPath),'utf8');
  assert.equal(JSON.parse(artifact).approvalDraft.approved,false);
  assert.doesNotMatch(artifact,/SENSITIVE_VALUE|DO_NOT_PRINT|E:\/PRIVATE|"pid"|"nonce"/);
  assert.equal(fs.existsSync(path.join(baseDir,'approvals')),false);
  assert.doesNotMatch(JSON.stringify(result),/E:\/ZGmini|SENSITIVE_VALUE/);
});

test('an existing proposal is never overwritten even when a second attempt has changed input',()=>{
  const baseDir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-recovery-proposal-'));
  const plan=makeRecoveryPlan({requestId:id,sourceSha:source,inspection:inspection(),
    ...evidence(),toolSha256});
  const first=persistUnapprovedRecoveryProposal({plan,readEvidence:evidence,baseDir});
  const destination=path.join(baseDir,first.proposalRelPath),saved=fs.readFileSync(destination);
  assert.throws(()=>persistUnapprovedRecoveryProposal({plan,readEvidence:evidence,baseDir}),
    /RECOVERY_PROPOSAL_ALREADY_EXISTS/);
  assert.ok(fs.readFileSync(destination).equals(saved));
  assert.deepEqual(fs.readdirSync(path.dirname(destination)),[path.basename(destination)]);
});

test('rejects changed evidence and refuses to write an approved manifest',()=>{
  const baseDir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-recovery-proposal-'));
  const plan=makeRecoveryPlan({requestId:id,sourceSha:source,inspection:inspection(),
    ...evidence(),toolSha256});
  assert.throws(()=>persistUnapprovedRecoveryProposal({plan,baseDir,
    readEvidence:()=>({...evidence(),ownerBytes:Buffer.from('DIFFERENT_OWNER')})}),
  /RECOVERY_PROPOSAL_EVIDENCE_CHANGED/);
  assert.equal(fs.existsSync(path.join(baseDir,'recovery-proposals')),false);
  const unsafe={...plan,approvalDraft:{...plan.approvalDraft,approved:true}};
  assert.throws(()=>persistUnapprovedRecoveryProposal({plan:unsafe,baseDir,readEvidence:evidence}),
    /RECOVERY_PROPOSAL_NOT_UNAPPROVED/);
  assert.equal(fs.existsSync(path.join(baseDir,'approvals')),false);
});
