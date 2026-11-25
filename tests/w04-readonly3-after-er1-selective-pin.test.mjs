import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {manifestFingerprint,validateControllerOnlyInstallDelta,validateControllerSelectivePin,validateUpdateRequest} from '../tools/maintenance-contract.mjs';

const root=path.resolve(import.meta.dirname,'..');
const files=[
 {path:'controller/employment-r6-candidate-readonly.mjs',sha256:'c79214e912154982bc88a35c7dfd236a441d566b062b1b437bc45fa261657825'},
 {path:'controller/employment-r6-collection-evidence-readonly.mjs',sha256:'5968df52d1fa8e8338f0fe991933d15af8384f96b37a8eca114a5365064dd3e6'},
 {path:'controller/employment-r6-raw-run-attestation-readonly.mjs',sha256:'48d4d7eea2ab06a7c20c73ef9888947594000be98729a45363647d14ee5897d7'},
];
const fingerprint='b49bd0af86c73f1a98d75415dae500678f62c0fa2a6564d7bb0f65d810e45714';

test('W04 post-ER1 overlay pins exactly the three already-reviewed read-only source bytes',()=>{
 for(const f of files){
  const actual=createHash('sha256').update(fs.readFileSync(path.join(root,f.path))).digest('hex');
  assert.equal(actual,f.sha256,f.path);
 }
 assert.equal(manifestFingerprint(files).sha256,fingerprint);
 assert.equal(validateControllerOnlyInstallDelta(files.map(f=>f.path),files),true);
});

test('W04 post-ER1 selective install rejects unrelated config or ER1 changes',()=>{
 assert.throws(
  ()=>validateControllerOnlyInstallDelta([...files.map(f=>f.path),'controller/operations.mjs'],files),
  /SELECTIVE|UPDATE|DELTA|FILE|INVALID/i,
 );
});

test('W04 conditional manifest and pin are consistent but require ER1 installed CAS',()=>{
 const installed='502aac841475fa94b7cc9d56c028fd38b0554831';
 const target='1543e13fdebb18267a76ebb4653535c87438c3f0';
 const raw=fs.readFileSync(path.join(root,'approvals/controller-updates',target+'.json'));
 const manifest=JSON.parse(raw);
 const pin=JSON.parse(fs.readFileSync(path.join(root,'approvals/controller-selective-targets',target+'.json'),'utf8'));
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.equal(manifest.selectiveSource.branch,'codex/w04-three-readonly-after-er1-502aac-20261125');
 assert.equal(manifest.selectiveSource.mainSha,'3a3aa9bc511048c122ddf72a388c04531a54108f');
 assert.deepEqual(manifest.selectiveSource.customPaths,[]);
 assert.deepEqual(manifest.allowFiles,files);
 assert.deepEqual(manifest.backup,{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installed}});
 assert.equal(manifest.checks.manifestSha256,fingerprint);
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3576');
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-update-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  chatId:'chat-w04-readonly3-provisional-pin-test',operation:'controller-update',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',targetControllerSha:target,
  approvalManifestSha256:createHash('sha256').update(raw).digest('hex')};
 const valid=validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',installedSha:installed});
 assert.equal(validateControllerSelectivePin(valid.manifest,pin),true);
 assert.throws(()=>validateUpdateRequest(request,raw,{actor:'ansqhd5774-Choi',
  installedSha:'3d42f226fcffde1f09885da552f9b003ea30e57e'}),/UPDATE_INSTALLED_SOURCE_DRIFT/);
 assert.throws(()=>validateControllerSelectivePin(valid.manifest,{...pin,
  installedSha:'3d42f226fcffde1f09885da552f9b003ea30e57e'}),/SELECTIVE_PIN_MISMATCH/);
});
