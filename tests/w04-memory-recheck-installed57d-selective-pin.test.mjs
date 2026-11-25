import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {
 manifestFingerprint,validateControllerOnlyInstallDelta,
 validateControllerSelectivePin,validateUpdateRequest,
} from '../tools/maintenance-contract.mjs';

const root=path.resolve(import.meta.dirname,'..');
const installed='57d5056d00943b25b88d6c13b1418d94bd14fc21';
const target='f611243f7b830f273e053c1085110ad06b5fdf79';
const main='ff620ab1b0bcfd78273297aa1b764dfd2ee05503';
const sourceBranch='codex/w04-memory-recheck-installed57d-20261125';
const file='controller/operations.mjs';
const approvedFiles=[{path:file,
 sha256:'b887dac033e5eddb03d40a81c83bdda41b92439f3f636d85a5b8ede0f606967d'}];
const fingerprint='6b33bf5f707046f3408430b415b9f254fa296d888b6022d0940ad05262edb06b';
const digest=b=>createHash('sha256').update(b).digest('hex');

test('W04 R6 RAM recheck fixes only the existing second gate and retains policy threshold',()=>{
 const src=fs.readFileSync(path.join(root,file),'utf8');
 const section=src.split("if(request.operation==='employment-r6-candidate-stage-readonly')")[1]
  ?.split("if(request.operation==='core-conflict-proof')")[0];
 assert.ok(section);
 assert.ok(section.includes('await waitForMemoryAdmission({minimumFreeMiB,timeoutMs:9000,intervalMs:1500})'));
 assert.ok(section.includes('if(!memoryRecheck.admitted)return'));
 assert.equal(section.includes('if(os.freemem()/1048576<minimum'),false);
 const policy=JSON.parse(fs.readFileSync(path.join(root,'config/operations.json'),'utf8'));
 assert.equal(policy.operations['employment-r6-candidate-stage-readonly'].minimumFreeMiB,1536);
 assert.equal(manifestFingerprint(approvedFiles).sha256,fingerprint);
 assert.equal(validateControllerOnlyInstallDelta([file],approvedFiles),true);
 assert.throws(()=>validateControllerOnlyInstallDelta([file,'config/operations.json'],approvedFiles));
});

test('W04 installed-57d selective pin and B manifest bind exact one-file overlay',()=>{
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',target+'.json'));
 const manifest=JSON.parse(raw.toString('utf8'));
 const pin=JSON.parse(fs.readFileSync(path.join(root,'approvals/controller-selective-targets',target+'.json'),'utf8'));
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.controllerOnlyInstall,true);
 assert.equal(manifest.purpose,'pc-controller-maintenance');
 assert.deepEqual(manifest.allowFiles,approvedFiles);
 assert.equal(manifest.checks.manifestSha256,fingerprint);
 assert.deepEqual(manifest.selectiveSource,{
  schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',
  branch:sourceBranch,mainSha:main,customPaths:[file],
 });
 assert.deepEqual(manifest.backup,{strategy:'VERSIONED_SNAPSHOT',
  rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installed}});
 assert.equal(manifest.postOperation,'core-status');
 assert.equal(manifest.postSourceBranch,'main');
 assert.equal(manifest.postSourceSha,'b6049aac81b3442a58b08050ee138921f87a09e6');
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 const req={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-update-12345678-1234-4123-8123-123456789abc',
  chatId:'chat-w04-memory-b-pin-test',operation:'controller-update',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  targetControllerSha:target,approvalManifestSha256:digest(raw)};
 const checked=validateUpdateRequest(req,raw,
  {actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(checked.manifest,pin),true);
 assert.throws(()=>validateUpdateRequest(req,raw,
  {actor:'ansqhd5774-Choi',installedSha:target}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerSelectivePin(manifest,{...pin,customPaths:[]}),/SELECTIVE_PIN_MISMATCH/);
});

test('B approved manifest/pin retain original LF bytes and exact B file-scope only',()=>{
 for(const folder of ['controller-updates','controller-selective-targets']){
  const bytes=fs.readFileSync(path.join(root,'approvals',folder,target+'.json'));
  assert.equal(bytes.includes(13),false,folder);
  assert.notEqual(digest(bytes),
   digest(Buffer.from(bytes.toString('utf8').replace(/\n/g,'\r\n'))));
 }
});
