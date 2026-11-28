import test from 'node:test';
import assert from 'node:assert/strict';
import {ZIZMOR_ZIP_SHA256,ZIZMOR_LINUX_SHA256,selectZizmorRelease,selectChangedActionFiles,verifyZizmorArchive,summarizeZizmorRuleIds}
  from '../tools/ci-zizmor-pr.mjs';

test('audit only valid changed workflow or local action paths',()=>{
 const existing=p=>p!=='.github/workflows/deleted.yml';
 assert.deepEqual(selectChangedActionFiles([
  '.github/workflows/ci.yml','.github/workflows/ci.yml',
  '.github/workflows/scan.yaml','.github/actions/security/action.yml',
  '.github/workflows/deleted.yml','.github/workflows/../private.yml',
  'tools/maintenance-agent.mjs','.github/workflows/secrets.txt',
  'C:/escape.yml','../outside.yml'
 ],existing),[
  '.github/actions/security/action.yml',
  '.github/workflows/ci.yml','.github/workflows/scan.yaml'
 ]);
});
test('missing PR compare proof cannot be interpreted as a clean security audit',()=>{
 assert.throws(()=>selectChangedActionFiles(null),
   /ZIZMOR_CHANGED_SCOPE_UNVERIFIED/);
});
test('tampered external release hash is rejected before execution',()=>{
 assert.match(ZIZMOR_ZIP_SHA256,/^[0-9a-f]{64}$/);
 assert.throws(()=>verifyZizmorArchive(Buffer.from('tampered')),
   /ZIZMOR_ARCHIVE_SHA256_MISMATCH/);
});

test('failed audit exposes only fixed-form rule IDs, never paths or source excerpts',()=>{
 const noisy="error[template-injection]: location private-path\n"+
  "   showing private snippet\nwarning[excessive-permissions]: other-path\n"+
  "error[template-injection]: repeated";
 assert.deepEqual(summarizeZizmorRuleIds(noisy,''),[
  'excessive-permissions','template-injection'
 ]);
 const metadata=summarizeZizmorRuleIds(noisy,'').join(',');
 assert.doesNotMatch(metadata,/private|location|snippet|other-path/);
});

test('malformed or oversized audit output never exposes unsafe content',()=>{
 assert.deepEqual(summarizeZizmorRuleIds('error[not valid]',''),[]);
 assert.deepEqual(summarizeZizmorRuleIds('error[valid]','x'.repeat(8*1024*1024+1)),[]);
 assert.deepEqual(summarizeZizmorRuleIds('',''),[]);
});

 test('Public Linux zizmor requires exact owner PR on hosted x64 and pinned release',()=>{
 const repo='ansqhd5774-Choi/zgmini-pc-control',id=1442936296,owner='ansqhd5774-Choi',ownerId=327938088;
 const env={GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:repo,RUNNER_ENVIRONMENT:'github-hosted',GITHUB_SHA:'c'.repeat(40),RUNNER_OS:'Linux',RUNNER_ARCH:'X64'};
 const event={action:'opened',number:42,repository:{id,full_name:repo,private:false,visibility:'public',owner:{id:ownerId,login:owner}},pull_request:{number:42,user:{id:ownerId,login:owner},head:{sha:'b'.repeat(40),repo:{id,full_name:repo}},base:{ref:'main',sha:'a'.repeat(40),repo:{id,full_name:repo}}}};
 assert.equal(selectZizmorRelease(env,event,'linux','x64').sha256,ZIZMOR_LINUX_SHA256);
 assert.equal(selectZizmorRelease({RUNNER_OS:'Windows'},null,'win32','x64').sha256,ZIZMOR_ZIP_SHA256);
 for(const patch of [{RUNNER_ENVIRONMENT:'self-hosted'},{RUNNER_ARCH:'ARM64'},{GITHUB_EVENT_NAME:'issues'}])
  assert.throws(()=>selectZizmorRelease({...env,...patch},event,'linux','x64'),/ZIZMOR_ISOLATED_PR_REQUIRED/);
 const foreign=structuredClone(event);foreign.pull_request.user.id=1;
 assert.throws(()=>selectZizmorRelease(env,foreign,'linux','x64'),/ZIZMOR_ISOLATED_PR_REQUIRED/);
 assert.throws(()=>selectZizmorRelease(env,event,'win32','x64'),/ZIZMOR_ISOLATED_PR_REQUIRED/);
});
