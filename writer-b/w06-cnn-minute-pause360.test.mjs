import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest,approvedCoreDrainWindowMs} from './contract.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const prior=read('approvals/writer-updates/w06-cnn-minute-ninefile-20261126.json'),current=read('approvals/writer-updates/w06-cnn-minute-ninefile-pause360-20261126.json');
test('W06 second request uses exact 9-file installed-preimage scope and approved standard pause-only maintenance',()=>{
 assert.equal(validateWriterBManifest(prior),prior);assert.equal(validateWriterBManifest(current),current);
 assert.equal(Object.hasOwn(prior,'coreMaintenance'),false);
 assert.equal(current.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 assert.equal(approvedCoreDrainWindowMs(current.coreMaintenance),360000);
 assert.deepEqual(Object.fromEntries(Object.entries(current).filter(([k])=>k!=='coreMaintenance')),prior);
 assert.equal(current.files.length,9);assert.equal(current.protectedFiles.length,15);
 assert.equal(current.runtimeDependencies.consumers.length,3);
 assert.equal(current.runtimeDependencies.taskXmlSha256,'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 for(const field of ['allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(current[field],false);
 assert.notEqual(current.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_1200S_V1');
 assert.notEqual(current.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_2400S_V1');
});
