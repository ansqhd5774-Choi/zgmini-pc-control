import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWriterBManifest,EXTENDED_DRAIN_LABEL} from '../writer-b/contract.mjs';

function load(name){
 return JSON.parse(readFileSync(new URL('../approvals/writer-updates/'+name,import.meta.url)));
}
const existing=load('d05-private-final-events-twofile-20261124.json');
const extended=load('d05-private-final-events-twofile-2400s-20261124.json');

test('D05 40-minute opt-in changes only natural Core drain bound',()=>{
 assert.equal(validateWriterBManifest(existing),existing);
 assert.equal(validateWriterBManifest(extended),extended);
 assert.equal(existing.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 assert.equal(extended.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_2400S_V1');
 assert.equal(EXTENDED_DRAIN_LABEL,'pc-writer-b-extended-drain-2400');
 assert.deepEqual({...extended,coreMaintenance:existing.coreMaintenance},existing);
 assert.equal(extended.files.length,2);
 assert.equal(extended.runCount,1);
 assert.equal(extended.runtimeDependencies.taskXmlSha256,
  'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
 'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(extended[key],false);
});

test('D05 extended manifest rejects unauthorized effects',()=>{
 for(const modified of [
  {...extended,allowDbChanges:true},
  {...extended,allowTaskDefinitionChanges:true},
  {...extended,runtimeDependencies:{...extended.runtimeDependencies,taskXmlSha256:null}},
  {...extended,coreMaintenance:'PAUSE_NEW_STARTS_DRAIN_999S_V1'}
 ])assert.throws(()=>validateWriterBManifest(modified));
});
