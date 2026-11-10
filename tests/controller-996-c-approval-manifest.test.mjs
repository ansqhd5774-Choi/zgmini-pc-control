import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {build996ConsentComment,review996CConsent}
 from '../tools/controller-996-c-consent-verifier.mjs';

const FILE=new URL('../docs/CONTROLLER_996_C_APPROVAL_R1.json',import.meta.url);
const bytes=()=>fs.readFileSync(FILE);
const SHA=v=>createHash('sha256').update(v).digest('hex');
const OWNER='ansqhd5774-Choi';
const requestId='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const git={repository:'ansqhd5774-Choi/zgmini-pc-control',
 path:'docs/CONTROLLER_996_C_APPROVAL_R1.json',commitSha:'a'.repeat(40)};

function fixture({content=bytes(),comments=true}={}){
 const parsed=JSON.parse(content);
 const comment={id:99601,user:{login:OWNER},
  created_at:'2026-11-10T20:00:00.000Z',
  body:build996ConsentComment(SHA(content))};
 return {
  originalIssue:{number:996,title:'pc-controller-update',
   user:{login:OWNER},body:JSON.stringify({requestId,
    targetControllerSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8'})},
  commentsReadback:{complete:true,comments:comments?[comment]:[]},
  gitRead:{...git,bytes:content},operatorManifestBytes:content,
 };
}

test('exact proposed scope passes schema only with a synthetic owner hash receipt',()=>{
 const result=review996CConsent(fixture());
 assert.equal(result.status,'CONSENT_PROVENANCE_REVIEWED_ONLY');
 assert.equal(result.manifestSha256,SHA(bytes()));
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.pcWritesAuthorized,0);
});

test('candidate file alone grants no actual owner consent or execution',()=>{
 const result=review996CConsent(fixture({comments:false}));
 assert.equal(result.status,'CONSENT_UNVERIFIED');
 assert.equal(result.code,'CONSENT_MISSING_OR_CONFLICTING');
 assert.equal(result.executionAuthorized,false);
});

test('a manifest with fabricated Writer files or enabled-state drift is rejected',()=>{
 const changed=JSON.parse(bytes());
 changed.protectedWriterFileStatus['quota-runner.cmd']='PRESENT';
 const content=Buffer.from(JSON.stringify(changed)+'\n');
 const result=review996CConsent(fixture({content}));
 assert.equal(result.code,'C_MANIFEST_SCOPE_OR_EVIDENCE_UNVERIFIED');
});

test('manifest is pinned only to original one-shot intake repair effects',()=>{
 const manifest=JSON.parse(bytes());
 assert.equal(manifest.operation,'RECONCILE_INTAKE_PAUSED_ONLY');
 assert.equal(manifest.executionScope,'ORIGINAL_WINDOWS_ONE_SHOT');
 assert.equal(manifest.acceptsMissingHistoricalProtectedBaseline,true);
 assert.equal(manifest.acceptsUnprovenGitHubDisableActor,true);
 assert.equal(manifest.phaseScopedSourceProof.reachedControllerSwitch,false);
 assert.equal(manifest.allowedEffects.includes('INSTALL_CONTROLLER'),false);
 assert.equal(manifest.allowedEffects.includes('RETRY_PC_JOB'),false);
 assert.equal(manifest.protectedWriterFileStatus['quota-runner.cmd'],'ABSENT');
 assert.equal(manifest.protectedWriterFileStatus['run-local.cmd'],'ABSENT');
});
