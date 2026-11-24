import test from 'node:test';
import assert from 'node:assert/strict';
import {GITLEAKS_ZIP_SHA256,prCommitRange,requireExactSha256} from '../tools/ci-gitleaks-pr.mjs';
const base='a'.repeat(40),head='b'.repeat(40);
test('validate exact PR base/head with no ambiguous ref',()=>{
 assert.deepEqual(prCommitRange({pull_request:{base:{sha:base},head:{sha:head}}},head),
  {base,head});
 assert.throws(()=>prCommitRange({pull_request:{base:{sha:base},head:{sha:head}}},base),
  /GITLEAKS_PR_RANGE_INVALID/);
 assert.throws(()=>prCommitRange({pull_request:{base:{sha:base},head:{sha:base}}},base),
  /GITLEAKS_PR_RANGE_INVALID/);
});
test('release digest mismatch is a hard failure',()=>{
 assert.match(GITLEAKS_ZIP_SHA256,/^[0-9a-f]{64}$/);
 assert.throws(()=>requireExactSha256(Buffer.from('not-release'),GITLEAKS_ZIP_SHA256),
  /GITLEAKS_RELEASE_SHA256_MISMATCH/);
});
