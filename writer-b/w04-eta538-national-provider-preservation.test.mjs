import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWriterBManifest} from './contract.mjs';
import {verifyWriterBPreimage,verifyWriterBCandidate} from './installer.mjs';

// Source-only check of a PENDING proposal, not authority to run Writer B.
// The hypothetical APPROVED_B clone is never saved or submitted to an Issue.
const proposal=JSON.parse(readFileSync(new URL(
 '../approvals/writer-updates/w04-eta538-ninefile-pending-20261125.json',
 import.meta.url),'utf8'));
const COLLECTOR='lib/market-score/employment-r6-collector.mjs';
const PROVIDER='lib/market-score/employment-r6-provider.mjs';
const RELEASE='lib/market-score/employment-r6-dol-release-text.mjs';
const ETA538='lib/market-score/employment-r6-dol-eta538-provider.mjs';

test('W04 ETA538 pending B manifest rejects execution and protects installed National Provider',()=>{
 assert.equal(proposal.status,'PENDING_APPROVAL');
 assert.throws(()=>validateWriterBManifest(proposal),
  e=>e.code==='WRITER_B_SOURCE_CONTRACT_STOP');
 assert.equal(proposal.candidateSourceSha,
  '50769db23ac6a5f55203855f5231d12dc0595bb4');
 assert.equal(proposal.baseHead,'4cdf4727e59a0667d641354bb5b3e7ede761daf7');
 assert.equal(proposal.files.length,7);
 assert.equal(proposal.files.filter(f=>f.change==='M').length,1);
 assert.equal(proposal.files.filter(f=>f.change==='A').length,6);
 assert.deepEqual(proposal.files.filter(f=>f.change==='M').map(f=>f.path),[COLLECTOR]);
 const byPath=new Map(proposal.files.map(f=>[f.path,f]));
 assert.equal(byPath.get(COLLECTOR).beforeSha256,
  '848c83202b2b63944629655850542ef2a90fefdeed48ffbfdc1774ad487a0bc5');
 assert.equal(byPath.get(COLLECTOR).afterSha256,
  '580fefcbf6b592208fd6a9f98aaf56b89dcd3bb665ad0f8a215fececc5d386df');
 assert.equal(byPath.get(RELEASE).afterSha256,
  'b849c77c1afebb0dfb7dc9ec673c7d4390e2469a06f77b7e70451a955a52871b');
 assert.ok(byPath.has(ETA538));
 assert.equal(byPath.has(PROVIDER),false);
 assert.equal(proposal.protectedFiles.find(f=>f.path===PROVIDER)?.sha256,
  'b94cd97208bc5ea19be4068a170e3c45b051639c5ee3d1ec2156c1ed18c587d6');
 assert.deepEqual(proposal.protectedFiles.map(x=>x.path).sort(),[
  PROVIDER,'lib/market-score/employment-r6-scheduler.mjs',
  'lib/market-score/employment-r4-shadow-contract.mjs',
  'lib/market-score/employment-r4-shadow-provider.mjs',
 ].sort());
 for(const flag of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])
  assert.equal(proposal[flag],false,flag);
});

test('W04 bounded 1M+6A proposal is structurally valid only in an ephemeral simulation',()=>{
 const simulated=structuredClone(proposal);
 simulated.status='APPROVED_B'; // Test-only contract shape; NO external authorization.
 assert.equal(validateWriterBManifest(simulated),simulated);
 const preimage={
  sourceRoot:simulated.sourceRoot,configPath:simulated.configPath,
  coreTask:simulated.coreTask,head:simulated.baseHead,
  configSource:simulated.baseConfigSourceSha,
  originalConfigSha256:'a'.repeat(64),
  originalTaskDefinitionSha256:'b'.repeat(64),
  originalBranch:'codex/installed-current',
  coreTaskEnabled:true,targetPathsClean:true,
  beforeSha256:Object.fromEntries(simulated.files.map(f=>[
   f.path,f.change==='M'?f.beforeSha256:null])),
  protectedSha256:Object.fromEntries(simulated.protectedFiles.map(f=>[f.path,f.sha256])),
  runtimeConsumerSha256:{},
 };
 assert.equal(verifyWriterBPreimage(simulated,preimage),preimage);
 const candidate={
  sourceSha:simulated.candidateSourceSha,clean:true,
  sha256:Object.fromEntries(simulated.files.map(f=>[f.path,f.afterSha256])),
 };
 assert.equal(verifyWriterBCandidate(simulated,candidate),candidate);
 const broken=structuredClone(simulated);
 broken.files.push({
  path:PROVIDER,change:'M',
  beforeSha256:'b94cd97208bc5ea19be4068a170e3c45b051639c5ee3d1ec2156c1ed18c587d6',
  afterSha256:'b91bd2973adf8a74f4fb01c166ce44b415b54cbe9ffcc95d02307cf115380474',
 });
 assert.throws(()=>validateWriterBManifest(broken),
  e=>e.code==='WRITER_B_PROTECTED_OVERLAP_STOP');
 assert.equal(proposal.status,'PENDING_APPROVAL',
  'testing an ephemeral approval shape cannot change actual proposal state');
});
