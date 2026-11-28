import test from 'node:test';
import assert from 'node:assert/strict';
import {OXLINT_ARCHIVE_SHA256,OXLINT_LINUX_SHA256,selectOxlintRelease,selectSourceFiles,verifyArchive} from './ci-oxlint-changed.mjs';

test('select only changed existing JS/TS without path traversal',()=>{
 const existing=p=>p!=='tools/removed.mjs';
 assert.deepEqual(selectSourceFiles([
  'tools/a.mjs','tools/a.mjs','tests/b.test.mjs','controller/c.ts',
  'README.md','tools/removed.mjs','../outside.js','C:/private.js',
  'node_modules/lodash/index.js','.github/workflows/example.yml'
 ],existing),['controller/c.ts','tests/b.test.mjs','tools/a.mjs']);
});
test('unknown changed-file scope is not falsely marked clean',()=>{
 assert.throws(()=>selectSourceFiles(null),/OXLINT_CHANGE_SCOPE_UNVERIFIED/);
});
test('download integrity mismatch fails closed',()=>{
 assert.match(OXLINT_ARCHIVE_SHA256,/^[a-f0-9]{64}$/);
 assert.throws(()=>verifyArchive(Buffer.from('tampered')),
  /OXLINT_ARCHIVE_SHA256_MISMATCH/);
});

 test('Public Linux oxlint requires exact owner PR on hosted x64 and pinned release',()=>{
 const repo='ansqhd5774-Choi/zgmini-pc-control',id=1442936296,owner='ansqhd5774-Choi',ownerId=327938088;
 const env={GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:repo,RUNNER_ENVIRONMENT:'github-hosted',GITHUB_SHA:'c'.repeat(40),RUNNER_OS:'Linux',RUNNER_ARCH:'X64'};
 const event={action:'opened',number:42,repository:{id,full_name:repo,private:false,visibility:'public',owner:{id:ownerId,login:owner}},pull_request:{number:42,user:{id:ownerId,login:owner},head:{sha:'b'.repeat(40),repo:{id,full_name:repo}},base:{ref:'main',sha:'a'.repeat(40),repo:{id,full_name:repo}}}};
 assert.equal(selectOxlintRelease(env,event,'linux','x64').sha256,OXLINT_LINUX_SHA256);
 assert.equal(selectOxlintRelease({RUNNER_OS:'Windows'},null,'win32','x64').sha256,OXLINT_ARCHIVE_SHA256);
 for(const patch of [{RUNNER_ENVIRONMENT:'self-hosted'},{RUNNER_ARCH:'ARM64'},{GITHUB_EVENT_NAME:'issues'}])
  assert.throws(()=>selectOxlintRelease({...env,...patch},event,'linux','x64'),/OXLINT_ISOLATED_PR_REQUIRED/);
 const foreign=structuredClone(event);foreign.pull_request.user.id=1;
 assert.throws(()=>selectOxlintRelease(env,foreign,'linux','x64'),/OXLINT_ISOLATED_PR_REQUIRED/);
 assert.throws(()=>selectOxlintRelease(env,event,'win32','x64'),/OXLINT_ISOLATED_PR_REQUIRED/);
});
