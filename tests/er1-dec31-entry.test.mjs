import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {validateRequest} from '../er1-dec31-entry.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const approval=JSON.parse(fs.readFileSync(path.join(here,'..','ER1_DEC31_CAPTURE_B_APPROVAL.json'),'utf8'));
const sha=createHash('sha256').update(fs.readFileSync(path.join(here,'..',
  'scripts','pc-writer','market-calendar-dec31-forward-capture.mjs'))).digest('hex');
const req=()=>({schema:'ZGMINI_ER1_DEC31_CAPTURE_V1',requestId:'pc-dec31-'+randomUUID(),
  chatId:'chat-'+randomUUID(),operation:'capture-earnings-calendar-through-2026-12-31',
  sourceSha:approval.sourceSha,from:'2026-12-01',through:'2026-12-31'});
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened'};
const wrap=r=>({action:'opened',issue:{title:'pc-er1-dec31-capture-one-shot',
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-er1-approved'}],body:JSON.stringify(r)}});

test('approval pins 31 December days, 31 calls, no shared writes',()=>{
  assert.equal(approval.sourceFileSha256,sha);
  assert.equal(approval.maxProviderRequests,31);
  assert.equal(approval.allowCoreWrites,false);
  assert.equal(approval.allowD1Writes,false);
  assert.equal(approval.allowSchedulerChanges,false);
  assert.equal(approval.allowChangesToExisting14DayFeed,false);
});

test('owner approval issue accepted with immutable source SHA',()=>{
  const input=req();
  assert.deepEqual(validateRequest(wrap(input),env),input);
});

test('wrong date, actor, label, source rejected',()=>{
  const date=req();date.through='2027-01-31';
  assert.throws(()=>validateRequest(wrap(date),env),/DEC31_ISSUE_CONTRACT_INVALID/);
  assert.throws(()=>validateRequest(wrap(req()),{...env,GITHUB_ACTOR:'outsider'}),/DEC31_ISSUE_NOT_APPROVED/);
  const bad=wrap(req());bad.issue.labels=[];
  assert.throws(()=>validateRequest(bad,env),/DEC31_ISSUE_NOT_APPROVED/);
  const wrong=req();wrong.sourceSha='0'.repeat(40);
  assert.throws(()=>validateRequest(wrap(wrong),env),/DEC31_ISSUE_CONTRACT_INVALID/);
});
