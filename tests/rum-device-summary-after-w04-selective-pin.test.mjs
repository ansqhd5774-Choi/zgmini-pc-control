import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
 manifestFingerprint,validateControllerOnlyInstallDelta,
 validateControllerSelectivePin,validateUpdateRequest
} from '../tools/maintenance-contract.mjs';

const root=path.resolve(import.meta.dirname,'..');
const parserPath='controller/cloudflare-rum-field-parser.mjs';
const parserSha256='f3364bebe79c8b126f259ea34322475cd925d0700ec9cc301c2e335f23067ce6';
const files=[{path:parserPath,sha256:parserSha256}];
const installed='1543e13fdebb18267a76ebb4653535c87438c3f0';
const target='57d5056d00943b25b88d6c13b1418d94bd14fc21';
const fingerprint='c9fa54df00426c82f9e18eec88257de142596fe1dd4bcb14bde1cc56c050cac3';

test('RUM excluded-device selective candidate uses reviewed single-file parser bytes',()=>{
 assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,parserPath))).digest('hex'),parserSha256);
 assert.equal(manifestFingerprint(files).sha256,fingerprint);
 assert.equal(validateControllerOnlyInstallDelta([parserPath],files),true);
 assert.throws(()=>validateControllerOnlyInstallDelta([parserPath,'controller/operations.mjs'],files),/ALLOWFILE_DIFF_MISMATCH/);
});

test('RUM post-W04 manifest is admissible only against the exact conditional W04 installed SHA',()=>{
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',target+'.json'));
 const manifest=JSON.parse(raw);
 const pin=JSON.parse(fs.readFileSync(path.join(root,'approvals/controller-selective-targets',target+'.json'),'utf8'));
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.deepEqual(manifest.allowFiles,files);
 assert.equal(manifest.checks.manifestSha256,fingerprint);
 assert.equal(manifest.checks.status,'PASS');
 assert.equal(manifest.selectiveSource.branch,'codex/rum-device-groups-after-w04-20261125');
 assert.equal(manifest.selectiveSource.mainSha,'15849445508961ec93165fcfd854c7d642772d7f');
 assert.deepEqual(manifest.selectiveSource.customPaths,[]);
 assert.equal(manifest.postSourceSha,'b6049aac81b3442a58b08050ee138921f87a09e6');
 assert.deepEqual(manifest.backup,{strategy:'VERSIONED_SNAPSHOT',
   rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installed}});
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-update-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  chatId:'chat-rum-excluded-device-provisional-test',operation:'controller-update',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',targetControllerSha:target,
  approvalManifestSha256:createHash('sha256').update(raw).digest('hex')};
 const valid=validateUpdateRequest(request,raw,
   {actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(valid.manifest,pin),true);
 assert.throws(()=>validateUpdateRequest(request,raw,
   {actor:'ansqhd5774-Choi',installedSha:'3d42f226fcffde1f09885da552f9b003ea30e57e'}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerSelectivePin(manifest,{...pin,installedSha:'3d42f226fcffde1f09885da552f9b003ea30e57e'}),/SELECTIVE_PIN_MISMATCH/);
});

test('RUM approval JSON retains exact LF bytes',()=>{
 for(const dir of ['approvals/controller-updates','approvals/controller-selective-targets']){
  const raw=fs.readFileSync(path.join(root,dir,target+'.json'));
  assert.equal(raw.includes(13),false,dir);
  assert.notEqual(createHash('sha256').update(raw).digest('hex'),
    createHash('sha256').update(Buffer.from(raw.toString('utf8').replace(/\n/g,'\r\n'))).digest('hex'));
 }
});
