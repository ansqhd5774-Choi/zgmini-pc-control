import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateControllerImportClosure,controllerImportScanRoots,validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';
import './controller-audit-public-a-dual-pin.test.mjs';

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

test('exact overlay has full pre-install transitive import closure, without adding unapproved modules',()=>{
 const changed=candidate.allowFiles.map(x=>x.path);
 assert.equal(validateControllerOnlyInstallDelta(changed,candidate.allowFiles),true);
 const allFiles=git(['ls-tree','-r','--name-only',candidate.targetSha,'--','controller','config'])
   .trim().split(/\r?\n/).filter(Boolean);
 const roots=controllerImportScanRoots(changed);
 assert.ok(roots.includes('controller/entry.mjs'));
 assert.ok(roots.includes('controller/operations.mjs'));
 const scan=validateControllerImportClosure(allFiles,roots,
   rel=>bytes(candidate.targetSha,rel).toString('utf8'));
 assert.equal(scan.status,'VERIFIED');
 assert.ok(scan.checkedModules>=4);
 for(const rel of ['controller/engine.mjs','controller/operations.mjs',
  'controller/report-upload-verified.mjs']){
  assert.ok(allFiles.includes(rel),'installed import graph module must exist: '+rel);
  assert.ok(bytes(candidate.installedSha,rel).equals(bytes(candidate.targetSha,rel)),
   'unchanged runtime dependency: '+rel);
 }
});


test('stage 5 postcheck-aware overlay is exact four-file installed-parent and not B authorized',()=>{
 const next=JSON.parse(fs.readFileSync(path.join(repo,
   'drafts/controller-public-a-postcheck-selective-candidate-20261128.json'),'utf8'));
 assert.equal(next.approved,false);
 assert.equal(next.publicBEffectAuthorized,false);
 assert.equal(next.operatingPreimageRawCasVerified,false);
 assert.equal(next.operatingInstallationVerified,false);
 assert.equal(next.publicAWorkflowActiveOnMain,true);
 assert.equal(next.installedSha,'3c7d4cfefacf072fd35cb19706b352c64c5e4fd2');
 assert.equal(next.targetSha,'555f95708984580cd7d5a0fd05a80b718e867710');
 assert.equal(next.sourceMainSha,'9b12c27a341fe3f982e93a631497bdf23547d371');
 assert.equal(next.targetBranch,'codex/public-a-controller-postcheck-selective-20261128');
 assert.equal(git(['rev-parse','--verify','refs/remotes/origin/'+next.targetBranch]).trim(),next.targetSha);
 assert.deepEqual(git(['rev-list','--parents','-n','1',next.targetSha]).trim().split(/\s+/),
  [next.targetSha,next.installedSha]);
 assert.deepEqual(git(['diff','--name-only','--no-renames',next.installedSha,next.targetSha,'--'])
  .trim().split(/\r?\n/).sort(),next.allowFiles.map(x=>x.path).sort());
 assert.deepEqual(next.allowFiles.map(x=>x.path),[
  'controller/common.mjs','controller/entry.mjs',
  'controller/preimage-manifest-stager.mjs','controller/upload.mjs'
 ]);
 const oldPaths=['controller/engine.mjs','controller/operations.mjs',
  'controller/supervisor.mjs','config/operations.json'];
 for(const rel of oldPaths)
  assert.ok(bytes(next.installedSha,rel).equals(bytes(next.targetSha,rel)),'unchanged '+rel);
 for(const item of next.allowFiles){
  const payload=bytes(next.targetSha,item.path);
  assert.equal(sha256(payload),item.sha256,'raw hash '+item.path);
  assert.equal(git(['rev-parse',next.targetSha+':'+item.path]).trim(),
    next.sourceGitBlobIds[item.path]);
  assert.ok(payload.equals(bytes(next.sourceMainSha,item.path)), 'approved source main '+item.path);
 }
 assert.doesNotThrow(()=>git(['merge-base','--is-ancestor',next.sourceMainSha,'HEAD']));
 const src=bytes(next.targetSha,'controller/common.mjs').toString('utf8');
 assert.match(src,/exactPublicUpdatePostcheckTitle\(event\.issue\.title,event\.issue\.body\)/);
 assert.match(src,/PC Update/);
 assert.match(src,/publicPcReportProjection/);
 const wf=fs.readFileSync(path.join(repo,'.github/workflows/pc-job.yml'),'utf8');
 assert.match(wf,/555f95708984580cd7d5a0fd05a80b718e867710/);
 for(const f of next.allowFiles)assert.ok(wf.includes("'"+f.path+"':'"+f.sha256+"'"));
 assert.ok(wf.includes("id: installed_controller"));
 assert.equal((wf.match(/steps\.installed_controller\.outcome == 'success'/g)||[]).length,3);
 const scanPaths=git(['ls-tree','-r','--name-only',next.targetSha,'--','controller','config'])
  .trim().split(/\r?\n/).filter(Boolean);
 const scan=validateControllerImportClosure(scanPaths,
  controllerImportScanRoots(next.allowFiles.map(x=>x.path)),
  rel=>bytes(next.targetSha,rel).toString('utf8'));
 assert.equal(scan.status,'VERIFIED');
 assert.equal(validateControllerOnlyInstallDelta(
  next.allowFiles.map(f=>f.path),next.allowFiles),true);
});
