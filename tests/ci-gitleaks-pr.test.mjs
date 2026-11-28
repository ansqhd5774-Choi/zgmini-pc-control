import test from 'node:test';
import assert from 'node:assert/strict';
import {GITLEAKS_LINUX_SHA256,selectScanRelease,GITLEAKS_ZIP_SHA256,GITLEAKS_FINDINGS_EXIT_CODE,prCommitRange,requireExactSha256,requireGitleaksClean,summarizeRuleOnlyOutput} from '../tools/ci-gitleaks-pr.mjs';
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
 const summary=summarizeRuleOnlyOutput('generic-api-key\naws-access-token\ngeneric-api-key\n');
 assert.deepEqual(summary,{findingCount:3,ruleIds:['aws-access-token','generic-api-key']});
 for(const bad of ['', 'generic-api-key\nUNEXPECTED_OR_RAW', 'unexpected=value',
  'aws-access-token\nnot usable', 1, null]){
  assert.throws(()=>summarizeRuleOnlyOutput(bad),/GITLEAKS_REPORT_UNSAFE/);
 }
});

// Public scan must not authorize a Windows or self-hosted execution path.
test('Linux Gitleaks release requires exact Public hosted owner PR and pinned x64 bytes',()=>{
 const repo='ansqhd5774-Choi/zgmini-pc-control', id=1442936296;
 const owner='ansqhd5774-Choi', ownerId=327938088;
 const env={GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:repo,RUNNER_ENVIRONMENT:'github-hosted',GITHUB_SHA:'c'.repeat(40),RUNNER_OS:'Linux',RUNNER_ARCH:'X64'};
 const event={action:'opened',number:42,repository:{id,full_name:repo,private:false,visibility:'public',owner:{id:ownerId,login:owner}},pull_request:{number:42,user:{id:ownerId,login:owner},head:{sha:head,repo:{id,full_name:repo}},base:{ref:'main',sha:base,repo:{id,full_name:repo}}}};
 const release=selectScanRelease(env,event,'linux','x64');
 assert.equal(release.sha256,GITLEAKS_LINUX_SHA256);
 assert.equal(release.archive,'gitleaks.tar.gz');
 assert.match(release.url,/gitleaks_8\.30\.1_linux_x64\.tar\.gz$/);
 for(const changed of [{RUNNER_ENVIRONMENT:'self-hosted'},{RUNNER_ARCH:'ARM64'},{GITHUB_EVENT_NAME:'issue_comment'}])
  assert.throws(()=>selectScanRelease({...env,...changed},event,'linux','x64'),/GITLEAKS_ISOLATED_EVENT_REQUIRED/);
 for(const change of [e=>{e.repository.private=true},e=>{e.pull_request.user.id=1},e=>{e.pull_request.head.repo.id=1}]){
  const altered=structuredClone(event);change(altered);
  assert.throws(()=>selectScanRelease(env,altered,'linux','x64'),/GITLEAKS_ISOLATED_EVENT_REQUIRED/);
 }
 assert.throws(()=>selectScanRelease(env,event,'win32','x64'),/GITLEAKS_ISOLATED_EVENT_REQUIRED/);
 assert.equal(selectScanRelease({RUNNER_OS:'Windows'},null,'win32','x64').sha256,GITLEAKS_ZIP_SHA256);
});
