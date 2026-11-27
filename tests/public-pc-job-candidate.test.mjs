import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assessPublicPcJobCandidate,runPublicPcJobCandidate} from '../tools/public-pc-job-candidate.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control',owner='ansqhd5774-Choi';
const request=()=>({schema:'ZGMINI_PC_JOB_V1',requestId:'pc-public-readonly-candidate-20261128-01',
  chatId:'chat-public-intake-20261128',operation:'runner-smoke',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha:'a'.repeat(40)});
const good=()=>({env:{GITHUB_EVENT_NAME:'issues',GITHUB_REPOSITORY:repo,
  GITHUB_SHA:'b'.repeat(40),GITHUB_ACTOR:owner,RUNNER_ENVIRONMENT:'github-hosted',
  ZGMINI_PC_JOB_LATE_LABEL_ENABLED:'false'},
  event:{action:'opened',number:4230,
    sender:{login:owner,id:327938088},
    repository:{full_name:repo,id:1442936296,private:false,visibility:'public',
      owner:{login:owner,id:327938088}},
    issue:{number:4230,title:'pc-job',state:'open',
      user:{login:owner,id:327938088},labels:[{name:'pc-job'}],
      body:JSON.stringify(request())}}});
const deny=(sample,code)=>{
  const out=assessPublicPcJobCandidate(sample);
  assert.equal(out.status,'BLOCKED');
  assert.equal(out.code,code);
  assert.equal(out.executionAuthorized,false);
  assert.equal(out.selfHostedAuthorized,false);
  assert.equal(out.controllerBAuthorized,false);
  assert.equal(out.approvalVerified,false);
  assert.equal(out.operationalWrites,0);
};

test('owner public issue becomes a read-only candidate and never a PC authorization',()=>{
  const s=good(),r=assessPublicPcJobCandidate(s);
  assert.equal(r.status,'CANDIDATE_ONLY');
  assert.equal(r.code,'PUBLIC_PC_JOB_READONLY_CANDIDATE');
  assert.equal(r.issueNumber,4230);
  assert.equal(r.requestDigest,createHash('sha256').update(s.event.issue.body).digest('hex'));
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.selfHostedAuthorized,false);
  assert.equal(r.controllerBAuthorized,false);
  assert.equal(r.approvalVerified,false);
  assert.equal(r.operationalWrites,0);
  assert.equal(JSON.stringify(r).includes(s.event.issue.body),false);
});

test('repository visibility, owner id, name or issuer cannot bypass gate',()=>{
  for(const p of [
    s=>{s.event.repository.private=true;},
    s=>{s.event.repository.visibility='private';},
    s=>{s.event.repository.id=9;},
    s=>{s.event.repository.full_name='someone/other';},
    s=>{s.event.repository.owner.id=9;},
    s=>{s.event.repository.owner.login='someone';},
    s=>{delete s.event.repository;},
  ]){const s=good();p(s);deny(s,'PUBLIC_PC_JOB_REPOSITORY_DENIED');}
});

test('foreign actor or self-hosted execution environment is rejected',()=>{
  for(const p of [
    s=>{s.env.GITHUB_ACTOR='attacker';},
    s=>{s.env.GITHUB_EVENT_NAME='workflow_dispatch';},
    s=>{s.env.RUNNER_ENVIRONMENT='self-hosted';},
    s=>{s.env.GITHUB_REPOSITORY='another/repo';},
    s=>{s.env.GITHUB_SHA='invalid';},
  ]){const s=good();p(s);deny(s,'PUBLIC_PC_JOB_EVENT_OR_HOST_DENIED');}
});

test('issue creator, sender, labels, number, title, state and PR spoofing rejected',()=>{
  for(const p of [
    s=>{s.event.sender.id=8;},
    s=>{s.event.sender.login='bad';},
    s=>{s.event.issue.user.id=8;},
    s=>{s.event.issue.user.login='bad';},
    s=>{s.event.issue.labels=[];},
    s=>{s.event.issue.title='not-pc-job';},
    s=>{s.event.issue.state='closed';},
    s=>{s.event.issue.number=4244;},
    s=>{s.event.issue.pull_request={url:'untrusted'};},
  ]){const s=good();p(s);deny(s,'PUBLIC_PC_JOB_ISSUE_IDENTITY_DENIED');}
});

test('labeled is opt-in, owner only and requires exact pc-job label',()=>{
  let s=good();s.event.action='labeled';s.event.label={name:'pc-job'};
  deny(s,'PUBLIC_PC_JOB_ACTION_DENIED');
  s.env.ZGMINI_PC_JOB_LATE_LABEL_ENABLED='true';
  assert.equal(assessPublicPcJobCandidate(s).status,'CANDIDATE_ONLY');
  s.event.label.name='other';
  deny(s,'PUBLIC_PC_JOB_ACTION_DENIED');
  s=good();s.event.action='edited';
  deny(s,'PUBLIC_PC_JOB_ACTION_DENIED');
});

test('malformed, duplicated, extraneous, B operation and untrusted source denied',()=>{
  for(const value of [
    '{}',
    '{ bad json',
    JSON.stringify({...request(),operation:'controller-update'}),
    JSON.stringify({...request(),operation:'writer-source-install'}),
    JSON.stringify({...request(),sourceRepository:'attacker/repo'}),
    JSON.stringify({...request(),sourceBranch:'evil'}),
    JSON.stringify({...request(),sourceSha:'invalid'}),
    JSON.stringify({...request(),approvalManifestSha256:'0'.repeat(64)}),
    JSON.stringify(request()).replace(',"chatId"',',"requestId":"pc-overridden","chatId"'),
    JSON.stringify(request(),null,2),
    'x'.repeat(16385)
  ]){
    const s=good();s.event.issue.body=value;
    const r=assessPublicPcJobCandidate(s);
    assert.equal(r.status,'BLOCKED');
    assert.equal(r.executionAuthorized,false);
    assert.equal(r.operationalWrites,0);
  }
});

test('event file reader is bounded and denies invalid input without network or writes',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-public-pc-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'event.json'),s=good();
  assert.equal(runPublicPcJobCandidate(s.env).code,'PUBLIC_PC_JOB_EVENT_FILE_INVALID');
  fs.writeFileSync(file,'{invalid');
  assert.equal(runPublicPcJobCandidate({...s.env,GITHUB_EVENT_PATH:file}).status,'BLOCKED');
  fs.writeFileSync(file,JSON.stringify(s.event));
  assert.equal(runPublicPcJobCandidate({...s.env,GITHUB_EVENT_PATH:file}).status,'CANDIDATE_ONLY');
  const link=path.join(root,'link.json');
  try{
    fs.symlinkSync(file,link);
    assert.equal(runPublicPcJobCandidate({...s.env,GITHUB_EVENT_PATH:link}).status,'BLOCKED');
  }catch(e){if(e.code!=='EPERM'&&e.code!=='EACCES')throw e;}
});

test('existing private operational job stays gated; public job cannot grant permissions',()=>{
 const yaml=fs.readFileSync(new URL('../.github/workflows/pc-job.yml',import.meta.url),'utf8');
 const op=yaml.split('  approved-pc-job:\n')[1]?.split('\n  public-readonly-intake:')[0];
 const pub=yaml.split('  public-readonly-intake:\n')[1];
 assert.ok(op);assert.ok(pub);
 assert.match(op,/github\.event\.repository\.private == true/);
 assert.match(op,/runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
 assert.match(pub,/github\.event\.repository\.private == false/);
 assert.match(pub,/runs-on: ubuntu-latest/);
 assert.match(pub,/contents: read/);
 assert.doesNotMatch(pub,/self-hosted|contents: write|issues: write|controller\\entry\.mjs|maintenance-agent\.mjs/);
 assert.match(pub,/node tools\/public-pc-job-candidate\.mjs/);
});
