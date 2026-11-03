import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {validateBundle,inspectEmploymentR6Candidate} from '../controller/employment-r6-candidate-readonly.mjs';

const ENTRY='scripts/pc-writer/employment-r6-runner-stage.mjs';
const SHA='a'.repeat(40);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fakeR6=`import fs from 'node:fs';import path from 'node:path';
const args=process.argv.slice(2);const get=k=>args[args.indexOf(k)+1];
const out=get('--output-dir');
const result={kind:'EMPLOYMENT_R6_RUNNER_READONLY_REPORT_V1',status:'PASS',
  code:'EMPLOYMENT_R6_READONLY_STAGE_COMPLETED',sqliteOpened:true,
  providerCalls:0,d1Writes:0,promotionApproved:false,publicationStatus:'NOT_REQUESTED',
  summary:{sourceFeatures:1,UNTRUSTED_RAW:'PRIVATE_VALUE'},
  pit:{coreCurrentKeysMissingHistory:4},
  indicators:Array.from({length:29},(_,i)=>({id:'FEATURE_'+i,rawStatus:'READY',
   chartStatus:'READY',scoreStatus:'READY'})),
  bodyDigest:'b'.repeat(64),walPreflight:{coreWalMode:true}};
fs.writeFileSync(path.join(out,'EMPLOYMENT_R6_RUNNER_fixture.json'),JSON.stringify(result));
`;

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'r6-controller-draft-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const dataRoot=path.join(root,'data'),workspace=path.join(root,'workspace');
  const core=path.join(dataRoot,'pc-writer','storage','core.sqlite');
  const candidate=path.join(root,'isolated','EMPLOYMENT_R6_CANDIDATE.sqlite');
  const bundle=path.join(root,'bundle'),script=path.join(bundle,'source',ENTRY);
  fs.mkdirSync(path.dirname(core),{recursive:true});fs.mkdirSync(path.dirname(candidate),{recursive:true});
  fs.mkdirSync(path.dirname(script),{recursive:true});fs.mkdirSync(workspace);
  fs.writeFileSync(core,'synthetic-core');fs.writeFileSync(candidate,'synthetic-candidate');
  fs.writeFileSync(script,fakeR6);
  const files={[ENTRY]:hash(Buffer.from(fakeR6))};
  const manifestBytes=Buffer.from(JSON.stringify({files},null,2)+'\n');
  fs.writeFileSync(path.join(bundle,'manifest.json'),manifestBytes);
  const host={dataRoot,employmentR6CandidatePath:candidate,
    approvedSources:{[SHA]:{root:bundle,branch:'codex/employment-1y-reader-r1',entrypoint:ENTRY,
      manifestSha256:hash(manifestBytes)}}};
  const request={sourceSha:SHA,sourceBranch:'codex/employment-1y-reader-r1'};
  return {root,workspace,host,request,core,candidate,script};
}

test('source, host, manifest and immutable path checks reject unapproved inputs',t=>{
  const f=fixture(t);
  assert.doesNotThrow(()=>validateBundle(f.request,f));
  assert.throws(()=>validateBundle({...f.request,sourceSha:'c'.repeat(40)},f),
    /R6_BUNDLE_NOT_APPROVED/);
  assert.throws(()=>validateBundle({...f.request,sourceBranch:'main'},f),
    /R6_BUNDLE_NOT_APPROVED/);
  f.host.employmentR6CandidatePath=f.core;
  assert.throws(()=>validateBundle(f.request,f),/R6_HOST_CANDIDATE_NOT_APPROVED/);
});

test('approved fixture runs in workspace and output projection does not leak raw fields',async t=>{
  const f=fixture(t);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'PASS');
  assert.equal(result.actualExecutionSha,SHA);
  assert.equal(result.sqliteOpened,true);
  assert.equal(result.summary.sourceFeatures,1);
  assert.equal(Object.hasOwn(result.summary,'UNTRUSTED_RAW'),false);
  assert.equal(result.providerCalls,0);assert.equal(result.d1Writes,0);
  assert.equal(result.promotionApproved,false);
  assert.equal(fs.readFileSync(f.core,'utf8'),'synthetic-core');
  assert.equal(fs.readFileSync(f.candidate,'utf8'),'synthetic-candidate');
  assert.equal(JSON.stringify(result).includes('PRIVATE_VALUE'),false);
});

test('hash drift BLOCKED before executing synthetic child',async t=>{
  const f=fixture(t);fs.appendFileSync(f.script,'\n// source changed');
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'R6_SOURCE_HASH_DRIFT');
  assert.equal(result.candidateExecuted,false);
});

test('manifest byte drift BLOCKED even if parsed JSON is semantically identical',async t=>{
  const f=fixture(t);
  const file=path.join(f.host.approvedSources[SHA].root,'manifest.json');
  const before=fs.readFileSync(file,'utf8');
  fs.writeFileSync(file,'  '+before);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'R6_MANIFEST_DRIFT');
  assert.equal(result.candidateExecuted,undefined);
});

test('an approved child cannot claim PASS without all 29 validated public statuses',async t=>{
  const f=fixture(t);
  const changed=fs.readFileSync(f.script,'utf8')
    .replace('fs.writeFileSync(path.join(out,', 'result.indicators=[];fs.writeFileSync(path.join(out,');
  fs.writeFileSync(f.script,changed);
  const files={[ENTRY]:hash(Buffer.from(changed))};
  const bytes=Buffer.from(JSON.stringify({files})+'\n');
  const approved=f.host.approvedSources[SHA];
  fs.writeFileSync(path.join(approved.root,'manifest.json'),bytes);
  approved.manifestSha256=hash(bytes);
  const result=await inspectEmploymentR6Candidate(f.request,f);
  assert.equal(result.status,'FAIL');
  assert.equal(result.code,'R6_RESULT_INVALID');
  assert.equal(result.actualExecutionSha,SHA);
  assert.equal(JSON.stringify(result).includes('PRIVATE_VALUE'),false);
});
