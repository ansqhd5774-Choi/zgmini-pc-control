import './ci-controller-b-host-state-readonly.test.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assessPublicSourceCi,runPublicSourceCiGuard} from '../tools/public-source-ci-guard.mjs';
// Reuse immutable Public source CI; no workflow byte change or Windows B dispatch.
// Retain the old V1/V2 source guards alongside the new V2-to-V3 successor.
import '../sidecar-b/contract.test.mjs';
import '../sidecar-b/w06-r3-operating-approval.test.mjs';
import '../sidecar-b/w06-r3-sevenmin-approval.test.mjs';
import '../sidecar-b/w06-v2-to-v3-pin-only.test.mjs';
// Reuse the existing immutable GitHub-hosted source CI for the V2 live preimage read.
import '../sidecar-b/operating-probe.test.mjs';
// Public W06 independent Windows preimage path is READONLY, never an install.
import '../sidecar-b/public-v3-independent-preimage-readonly.test.mjs';
// Public B new operator remains disabled until separately approved exact effect.
import '../sidecar-b/public-v3-independent-owner-b-once.test.mjs';
// Exact approved Controller audit two-file B source-only regression.
import './controller-audit-public-b-operator-once.test.mjs';
import './controller-audit-lineage-public-b-operator-once.test.mjs';
// Fixed S6 journal regression on GitHub-hosted source only; no Windows access.
import './controller-s6-4069-public-a.test.mjs';
// Completed #3650 lifecycle and historical upload contract; injected source-only fixtures.
import './report-recovery-3650-once.test.mjs';
// Reuse existing lifecycle checks in Public hosted CI; no pinned YAML edits.
import './retired-one-shots-20261120.test.mjs';
import './ci-failure-issue.test.mjs';
import '../inflation19-gas-refresh-b/gas-refresh.test.mjs';
import '../inflation19-gas-refresh-b/receiver.test.mjs';
import './er1-nov30-batch20-one-shot-entry.test.mjs';
import './er1-nov30-batch20-recovery-entry.test.mjs';

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

// Exact approval pin acceptance belongs to the existing hosted source CI;
// this does not invoke any Windows operator or grant an operational lease.
test('W06 V3 operator pins owner merged effect #4289 and reviewed source #4293',()=>{
 const op=fs.readFileSync(new URL('../sidecar-b/public-v3-independent-owner-b-once.mjs',import.meta.url),'utf8');
 const manifest=JSON.parse(fs.readFileSync(new URL('../approvals/sidecar-b/w06-cnn-v2-to-v3-20261128.json',import.meta.url),'utf8'));
 assert.match(op,/const APPROVAL_PR=4289;/);
 assert.match(op,/const APPROVAL_MERGE='1c0e8b2e3b032548548b42df535dc060a40ff64c';/);
 assert.match(op,/const REVIEWED_SOURCE_PR=4293;/);
 assert.equal(manifest.status,'APPROVED_B');
 assert.equal(manifest.schema,'ZGMINI_CNN_SIDECAR_ONEFILE_B_V3');
 assert.equal(manifest.beforeSha256,'eb3c43bf8fba6ea4e51f3e84b77f9ec13000db9d9e38077ffd914950d7080b6b');
 assert.equal(manifest.afterSha256,'894411dea16462c4ee305f7ec80102d81662063f5f76c8a8384f04977e860ac3');
 assert.equal(manifest.runCount,1);
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskChanges'])assert.equal(manifest[key],false);
});

import './controller-s6-4069-b-approval.test.mjs';

import './controller-s6-4069-owner-install.test.mjs';
