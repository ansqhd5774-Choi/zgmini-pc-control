import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{validateInfrastructureDelta}from'../tools/maintenance-contract.mjs';
const bytes=Buffer.from('approved fixture'),sha=createHash('sha256').update(bytes).digest('hex');
const evidence={files:[{path:'scripts/check.mjs',sha256:sha}]};
test('unchanged infrastructure needs no acknowledgment',()=>assert.equal(validateInfrastructureDelta(['controller/engine.mjs'],null,()=>bytes),true));
test('exact separately acknowledged infrastructure may coexist without deployment',()=>assert.equal(validateInfrastructureDelta(['controller/engine.mjs','scripts/check.mjs'],evidence,()=>bytes),true));
test('unacknowledged infrastructure remains blocked',()=>assert.throws(()=>validateInfrastructureDelta(['scripts/check.mjs'],null,()=>bytes),/UNAPPROVED_INFRA_CHANGE/));
test('acknowledgment cannot omit another changed file',()=>assert.throws(()=>validateInfrastructureDelta(['scripts/check.mjs','.github/workflows/new.yml'],evidence,()=>bytes),/UNAPPROVED_INFRA_CHANGE/));
test('wrong acknowledged bytes remain blocked',()=>assert.throws(()=>validateInfrastructureDelta(['scripts/check.mjs'],evidence,()=>Buffer.from('changed')),/UPDATE_INFRA_HASH_MISMATCH/));
