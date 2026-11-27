import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const candidate=JSON.parse(fs.readFileSync(
  path.join(repo,'drafts/controller-public-a-selective-candidate-20261128.json'),'utf8'));
const git=(args,bytes=false)=>execFileSync('git',args,{
  cwd:repo,encoding:bytes?null:'utf8',timeout:30000,maxBuffer:4_000_000,
  windowsHide:true
});
const bytes=(commit,rel)=>git(['show',commit+':'+rel],true);
const sha256=data=>createHash('sha256').update(data).digest('hex');
const paths=candidate.allowFiles.map(x=>x.path);

test('Public A selective overlay has exact installed SHA as sole parent and precisely four changes',()=>{
  assert.equal(candidate.schema,'ZGMINI_CONTROLLER_PUBLIC_A_SELECTIVE_CANDIDATE_V1');
  assert.equal(candidate.approved,false);
  assert.equal(candidate.status,'SOURCE_ONLY_NOT_APPROVED');
  assert.equal(candidate.operatingInstallationVerified,false);
  assert.equal(candidate.operatingPreimageRawCasVerified,false);
  assert.equal(candidate.publicAWorkflowActivated,false);
  assert.equal(candidate.publicBEffectAuthorized,false);
  assert.equal(candidate.customPaths.length,0);
  assert.equal(candidate.installedSha,'3c7d4cfefacf072fd35cb19706b352c64c5e4fd2');
  assert.equal(candidate.targetSha,'20d5bbbf305531dca9bf5b74744df83daf37cf17');
  assert.equal(candidate.sourceMainSha,'f816c498d3aae937698835b29141b14f6ee65ed2');
  const remoteRef='refs/remotes/origin/'+candidate.targetBranch;
  assert.equal(git(['rev-parse','--verify',remoteRef]).trim(),candidate.targetSha);
  const lineage=git(['rev-list','--parents','-n','1',candidate.targetSha]).trim().split(/\s+/);
  assert.deepEqual(lineage,[candidate.targetSha,candidate.installedSha]);
  const diff=git(['diff','--name-status','--no-renames',
    candidate.installedSha,candidate.targetSha,'--']).trim().split(/\r?\n/).sort();
  assert.deepEqual(diff,paths.map(x=>'M\t'+x).sort());
  assert.deepEqual(paths,[
    'controller/common.mjs','controller/entry.mjs',
    'controller/preimage-manifest-stager.mjs','controller/upload.mjs'
  ]);
  for(const f of candidate.allowFiles){
    const actual=bytes(candidate.targetSha,f.path);
    assert.equal(sha256(actual),f.sha256,'target byte SHA256 '+f.path);
    assert.ok(actual.equals(bytes(candidate.sourceMainSha,f.path)),
      'selective blob must equal approved source main '+f.path);
    assert.equal(
      git(['rev-parse',candidate.targetSha+':'+f.path]).trim(),
      candidate.sourceGitBlobIds[f.path],'source blob '+f.path);
  }
  assert.doesNotThrow(()=>git(['merge-base','--is-ancestor',candidate.sourceMainSha,'HEAD']));
});

test('Public A selective target preserves installed Controller config, engine, dependency and private-only workflow',()=>{
  const unchanged=[
    'config/operations.json','controller/engine.mjs','controller/operations.mjs',
    'controller/preimage-manifest-contract.mjs',
    'controller/report-upload-verified.mjs',
    'controller/supervisor.mjs','.github/workflows/pc-job.yml'
  ];
  for(const rel of unchanged)
    assert.ok(bytes(candidate.installedSha,rel).equals(bytes(candidate.targetSha,rel)),
      'installed unchanged '+rel);
  const config=JSON.parse(bytes(candidate.targetSha,'config/operations.json').toString('utf8'));
  assert.equal(config.controlRepository,'ansqhd5774-Choi/zgmini-pc-control');
  assert.equal(config.mutationsEnabled,false);
  assert.equal(config.maxAutomaticRetries,0);
  assert.equal(config.operations['runner-smoke'].grade,'A');
  const workflow=bytes(candidate.targetSha,'.github/workflows/pc-job.yml').toString('utf8');
  assert.match(workflow,/github\.event\.repository\.private == true/);
  assert.doesNotMatch(workflow,/^\s+public-approved-a:/m);
  assert.doesNotMatch(workflow,/pull_request_target:/);
  const report=bytes(candidate.targetSha,'controller/report-upload-verified.mjs').toString('utf8');
  for(const name of ['resolveUploadPolicy','hasVerifiedReportComment','confirmVerifiedReportComment']){
    assert.match(report,new RegExp('export\\s+(?:const|function|async function)\\s+'+name+'\\b'));
  }
});

test('selective Public A candidate enforces owner Issue identity and redacted remote reports',()=>{
  const common=bytes(candidate.targetSha,'controller/common.mjs').toString('utf8');
  const entry=bytes(candidate.targetSha,'controller/entry.mjs').toString('utf8');
  const upload=bytes(candidate.targetSha,'controller/upload.mjs').toString('utf8');
  assert.match(common,/attestOwnerPcJobEvent/);
  assert.match(common,/publicPcReportProjection/);
  assert.match(common,/publicJobLogEnvelope/);
  assert.match(entry,/policy\.mutationsEnabled===false/);
  assert.match(entry,/policy\.maxAutomaticRetries===0/);
  assert.match(entry,/assertSupervisorOwner\(root,host\)/);
  assert.match(entry,/publicJobLogEnvelope\(\{status:'BLOCKED',code\},false\)/);
  assert.match(upload,/publicPcReportProjection/);
  assert.match(upload,/publishedReport=JSON\.parse\(json\)/);
  assert.deepEqual(candidate.allowFiles.map(x=>x.path),paths);
});
