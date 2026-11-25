import test from 'node:test';
import assert from 'node:assert/strict';
import {GITLEAKS_ZIP_SHA256,GITLEAKS_FINDINGS_EXIT_CODE,prCommitRange,requireExactSha256,requireGitleaksClean,summarizeRuleOnlyOutput} from '../tools/ci-gitleaks-pr.mjs';
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

test('gitleaks scanner failure remains fail-closed with sanitized distinct classification',()=>{
 assert.equal(GITLEAKS_FINDINGS_EXIT_CODE,2);
 assert.equal(requireGitleaksClean({status:0,error:null,signal:null}),true);
 assert.throws(()=>requireGitleaksClean({status:2}),/GITLEAKS_FINDINGS_DETECTED/);
 for(const result of [{status:1},{status:3},{status:127}]){
  assert.throws(()=>requireGitleaksClean(result),/GITLEAKS_SCAN_EXECUTION_FAILED/);
 }
 for(const result of [null,{status:null},{status:0,error:Error('INTERNAL_REDACTED')},{status:0,signal:'SIGKILL'}]){
  assert.throws(()=>requireGitleaksClean(result),/GITLEAKS_EXECUTION_FAILED/);
 }
});

test('gitleaks template metadata strips matches and fails closed on unexpected output',()=>{
 const summary=summarizeRuleOnlyOutput('generic-api-key\\naws-access-token\\ngeneric-api-key\\n');
 assert.deepEqual(summary,{findingCount:3,ruleIds:['aws-access-token','generic-api-key']});
 for(const bad of ['', 'generic-api-key\\nUNEXPECTED_OR_RAW', 'unexpected=value',
  'aws-access-token\\nnot usable', 1, null]){
  assert.throws(()=>summarizeRuleOnlyOutput(bad),/GITLEAKS_REPORT_UNSAFE/);
 }
});
