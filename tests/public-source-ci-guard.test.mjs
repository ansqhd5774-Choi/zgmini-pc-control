import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assessPublicSourceCi,runPublicSourceCiGuard} from '../tools/public-source-ci-guard.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control', id=1442936296;
const owner='ansqhd5774-Choi', ownerId=327938088;
const sha='a'.repeat(40);
const good=()=>({
  env:{GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:repo,
    RUNNER_ENVIRONMENT:'github-hosted',GITHUB_SHA:'c'.repeat(40)},
  event:{action:'synchronize',number:42,
    repository:{id,full_name:repo,private:false,visibility:'public',
      owner:{id:ownerId,login:owner}},
    pull_request:{number:42,user:{id:ownerId,login:owner},
      head:{sha,repo:{id,full_name:repo}},
      base:{ref:'main',sha:'b'.repeat(40),repo:{id,full_name:repo}}}}
});

const deny=(sample,code)=>{
 const out=assessPublicSourceCi(sample);
 assert.equal(out.status,'BLOCKED');assert.equal(out.code,code);
 assert.equal(out.executionAuthorized,false);
 assert.equal(out.operationalWrites,0);
};

test('public same-repo owner PR on GitHub-hosted is source-only',()=>{
 const result=assessPublicSourceCi(good());
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'PUBLIC_SOURCE_CI_ONLY');
 assert.equal(result.selfHostedAuthorized,false);
 assert.equal(result.controllerBAuthorized,false);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.operationalWrites,0);
});

test('private, missing metadata, spoofed owner or repository identity are rejected',()=>{
 for(const patch of [
   s=>{s.event.repository.private=true;},
   s=>{s.event.repository.visibility='private';},
   s=>{s.event.repository.id=1;},
   s=>{s.event.repository.full_name='someone/fork';},
   s=>{s.event.repository.owner.id=123;},
   s=>{delete s.event.repository.owner;},
   s=>{delete s.event.repository;},
 ]){const s=good();patch(s);deny(s,'PUBLIC_CI_REPOSITORY_MISMATCH');}
});

test('untrusted Runner or job event can never gain public CI admission',()=>{
 for(const patch of [
   s=>{s.env.RUNNER_ENVIRONMENT='self-hosted';},
   s=>{s.env.GITHUB_EVENT_NAME='workflow_dispatch';},
   s=>{s.env.GITHUB_REPOSITORY='other/repo';},
   s=>{s.env.GITHUB_SHA='not-a-sha';},
   s=>{delete s.env.RUNNER_ENVIRONMENT;},
 ]){const s=good();patch(s);deny(s,'PUBLIC_CI_HOST_OR_EVENT_UNTRUSTED');}
});

test('untrusted fork, author, workflow action or PR commit is rejected',()=>{
 for(const patch of [
   s=>{s.event.action='labeled';},
   s=>{s.event.pull_request.user.login='attacker';},
   s=>{s.event.pull_request.user.id=5;},
   s=>{s.event.pull_request.head.repo.id=9;},
   s=>{s.event.pull_request.base.repo.full_name='other/fork';},
   s=>{s.event.pull_request.base.ref='development';},
   s=>{s.event.pull_request.head.sha='b'.repeat(40);},
   s=>{s.event.pull_request.number=33;},
   s=>{delete s.event.pull_request;},
 ]){const s=good();patch(s);deny(s,'PUBLIC_CI_PR_ORIGIN_UNTRUSTED');}
});

test('fixed source-CI gate rejects malformed and missing event files',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-public-ci-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'event.json');
 const s=good();
 assert.equal(runPublicSourceCiGuard(s.env).code,'PUBLIC_CI_EVENT_FILE_UNAVAILABLE');
 fs.writeFileSync(file,'invalid json');
 assert.equal(runPublicSourceCiGuard({...s.env,GITHUB_EVENT_PATH:file}).code,
   'PUBLIC_CI_EVENT_FILE_INVALID');
 fs.writeFileSync(file,JSON.stringify(s.event));
 assert.equal(runPublicSourceCiGuard({...s.env,GITHUB_EVENT_PATH:file}).status,'PASS');
});

test('GitHub-hosted public source CI fails closed on each Node step for Windows and Linux',()=>{
 const workflow=fs.readFileSync(new URL('../.github/workflows/controller-maintenance-source-tests.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const section=workflow.split('  public-source-only:\n')[1]?.split('\n  source-only:')[0];
 assert.ok(section,'expected existing source-only job');
 assert.match(section,/os: \[ubuntu-latest, windows-latest\]/);
 assert.match(section,/runs-on: \$\{\{ matrix\.os \}\}/);
 // Windows defaults to pwsh and can swallow prior child process exit status.
 // Both independent steps must use bash -e instead.
 assert.equal((section.match(/shell: bash/g)||[]).length,2);
 assert.equal((section.match(/set -euo pipefail/g)||[]).length,2);
 assert.match(section,/permissions:\n\s+contents: read/);
 assert.match(section,/persist-credentials: false/);
 assert.doesNotMatch(section,/runs-on: \[self-hosted/);
});
