import test from 'node:test';
import assert from 'node:assert/strict';
import {ensurePostcheckIssue, postcheckEnvelope} from '../tools/controller-postswitch-postcheck.mjs';

const requestId='pc-update-877e10c8-8580-4095-a675-bef9ec032193';
const issue={requestId,chatId:'chat-bf5a569b-fb93-48b4-a842-cb160b62c0b3'};
const manifest={targetSha:'badad9124157879d7a645b64f2768113d632355b',
  postOperation:'core-status',postSourceBranch:'main',
  postSourceSha:'680390969d4ffa27247e73bcfe454292178f17d8'};
const row=(descriptor,number=9999)=>({number,title:descriptor.title,body:descriptor.body,
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-job'}]});
const record=()=>({requestId,claimHeld:true});
function fixture({present=[],ackLost=false,persistFail=false,oldRecord=record()}={}) {
  const calls=[],rows=[...present],records=[];
  const options={issue,manifest,record:oldRecord,
    listIssues:async()=>{calls.push('lookup');return [...rows];},
    createIssue:async descriptor=>{calls.push('create');
      const created=row(descriptor,2222);rows.push(created);
      if(ackLost)throw Error('network acknowledgement lost');
      return created;},
    persist:async state=>{calls.push('persist');if(persistFail)throw Error('persist failed');
      records.push(state);}};
  return {calls,rows,records,options};
}

test('postcheck envelope matches fixed original 7-field pc-job',()=>{
  const d=postcheckEnvelope(issue,manifest);
  assert.deepEqual(Object.keys(JSON.parse(d.body)).sort(),
    ['schema','requestId','chatId','operation','sourceRepository','sourceBranch','sourceSha'].sort());
  assert.equal(JSON.parse(d.body).requestId,requestId+'-postcheck');
  assert.equal(JSON.parse(d.body).sourceSha,manifest.postSourceSha);
  assert.deepEqual(d.labels,['pc-job']);
});

test('durable postcheck intent precedes exactly one creation and verified readback',async()=>{
  const f=fixture();
  const r=await ensurePostcheckIssue(f.options);
  assert.equal(r.issueNumber,2222);
  assert.equal(r.verified,true);
  assert.deepEqual(f.calls,['lookup','persist','create','lookup','persist']);
  assert.equal(f.records[0].postcheckCreationAttempted,true);
  assert.equal(f.records[0].postcheckIssueNumber,undefined);
  assert.equal(f.records.at(-1).postcheckIssueNumber,2222);
});

test('existing unique postcheck Issue reuses remote evidence without POST',async()=>{
  const f=fixture({present:[row(postcheckEnvelope(issue,manifest),1234)]});
  const r=await ensurePostcheckIssue(f.options);
  assert.equal(r.issueNumber,1234);
  assert.equal(r.recoveredFromExisting,true);
  assert.equal(f.calls.includes('create'),false);
});

test('lost acknowledgement may recover unique existing Issue but never repost',async()=>{
  const f=fixture({ackLost:true});
  const r=await ensurePostcheckIssue(f.options);
  assert.equal(r.issueNumber,2222);
  assert.equal(r.recoveredFromExisting,true);
  assert.equal(f.calls.filter(v=>v==='create').length,1);
});

test('interrupted earlier creation with zero readback is blocked without POST',async()=>{
  const f=fixture({oldRecord:{...record(),postcheckCreationAttempted:true}});
  await assert.rejects(()=>ensurePostcheckIssue(f.options),/POSTCHECK_OUTCOME_UNKNOWN/);
  assert.equal(f.calls.includes('create'),false);
});

test('unexpected second Issue or wrong actor never triggers another POST',async()=>{
  const d=postcheckEnvelope(issue,manifest);
  for(const present of [[row(d,1111),row(d,2222)],
    [{...row(d,1111),user:{login:'unapproved-user'}}]]) {
    const f=fixture({present});
    await assert.rejects(()=>ensurePostcheckIssue(f.options));
    assert.equal(f.calls.includes('create'),false);
  }
});

test('a separate recovery record must be held and durably writable before POST',async()=>{
  const invalid=fixture({oldRecord:{requestId,claimHeld:false}});
  await assert.rejects(()=>ensurePostcheckIssue(invalid.options),/POSTCHECK_RECOVERY_CLAIM_REQUIRED/);
  assert.equal(invalid.calls.includes('create'),false);
  const failed=fixture({persistFail:true});
  await assert.rejects(()=>ensurePostcheckIssue(failed.options),/persist failed/);
  assert.equal(failed.calls.includes('create'),false);
});

test('recorded Issue number drift is a hard failure',async()=>{
  const f=fixture({present:[row(postcheckEnvelope(issue,manifest),1234)],
    oldRecord:{...record(),postcheckIssueNumber:4444}});
  await assert.rejects(()=>ensurePostcheckIssue(f.options),/POSTCHECK_RECORDED_ISSUE_DRIFT/);
  assert.equal(f.calls.includes('create'),false);
});
