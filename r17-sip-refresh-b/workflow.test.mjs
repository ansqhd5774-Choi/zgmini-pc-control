import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TARGET,PROTECTED,BASELINE_SOURCE,CANDIDATE_SOURCE} from './install-core.mjs';
const workflowUrl=new URL('../.github/workflows/pc-r17-sip-refresh-onefile-b-once.yml',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('./APPROVED_SCOPE.json',import.meta.url),'utf8'));

test('068 installed SIP one-file patch intake is retired',()=>{
 assert.equal(fs.existsSync(workflowUrl),false);
});
test('fixed source, unique paths and exact live-file contract',()=>{
  assert.equal(CANDIDATE_SOURCE,'d913514d919c1e499b7af9bc86d17ca07da18094');
  assert.equal(BASELINE_SOURCE,'cf43e65bbf72f56b70a52bc5a650a0cb5682b6bc');
  assert.deepEqual(Object.keys(manifest.files),['scripts/pc-writer/us-breadth-sip-premarket-cycle.mjs']);
  assert.deepEqual(Object.keys(manifest.protectedFiles).sort(),Object.keys(PROTECTED).sort());
  assert.equal(manifest.files[Object.keys(TARGET)[0]].beforeSha256,
    '4be51a9d8162a6bc90528965fd263f52371675fabb64df1ac7ae7c18948e4e59');
  assert.equal(manifest.files[Object.keys(TARGET)[0]].targetSha256,
    'bf0d4858679295a19c0a35c2a704899d28cbef9e7874efe38d0f71a337b3a959');
  assert.equal(manifest.files[Object.keys(TARGET)[0]].targetBlobSha,
    '7ee9783744d45c3e5c2f88dc06f7e5c9687d7be3');
  assert.equal(fs.existsSync(workflowUrl),false);
});
test('no external provider, scheduler, D1, or secret output path',()=>{
  for(const marker of ['allowProviderCalls','allowD1Writes','allowDbChanges',
    'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(manifest[marker],false);
  assert.equal(fs.existsSync(workflowUrl),false);
});
