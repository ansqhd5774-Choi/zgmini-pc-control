import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {authorize,REPO,OP,REQUEST_SCHEMA,
 APPROVAL_SCHEMA,BEFORE_SHA,BEFORE_BYTES,PATCH,TARGET}
 from '../tools/w03-r179-seven-readback-b.mjs';

const path=new URL('../approvals/w03-r179-guard/r179-readback-20261116.json',
 import.meta.url);
const digest=b=>createHash('sha256').update(b).digest('hex');
const manifestSHA='ced5f1503f140fda25538d25fc98cf817cb06806a107cb24b36a024baea9f8d3';
const ref='be0690f24050da7a5975fee5fb8f96db1bff4632';
test('immutable reviewed R179 B approval exact file bytes/hash and prohibited effects',()=>{
 const raw=fs.readFileSync(path),m=JSON.parse(raw.toString('utf8'));
 assert.equal(digest(raw),manifestSHA);
 assert.equal(m.schema,APPROVAL_SCHEMA);
 assert.equal(m.status,'APPROVED_B');
 assert.equal(m.scope,'W03_R179_SEVEN_CORE_READBACK_MINIMUM_ONLY');
 assert.equal(m.operation,OP);
 assert.equal(m.controlSourceSha,ref);
 assert.equal(m.targetPath,TARGET);
 assert.equal(m.beforeSha256,BEFORE_SHA);
 assert.equal(m.beforeBytes,BEFORE_BYTES);
 assert.equal(m.patchId,PATCH);
 assert.equal(m.maxAttempts,1);
 for(const name of ['allowProviderCalls','allowSqliteWrites','allowD1Writes',
  'allowTaskChanges','allowOtherSourceChanges'])
  assert.equal(m[name],false);
 const req={schema:REQUEST_SCHEMA,operation:OP,
  requestId:'c1a3cb1c-3653-47a7-96d4-72c4d0316691',
  chatId:'6f721cec-27af-4a58-9760-af78e10752cf',
  controlRepository:REPO,
  approvalManifestPath:'approvals/w03-r179-guard/r179-readback-20261116.json',
  approvalManifestSha256:manifestSHA};
 const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:ref};
 const event={repository:{full_name:REPO,private:true},
  sender:{login:'ansqhd5774-Choi'},
  issue:{title:OP,number:1641,user:{login:'ansqhd5774-Choi'},
   labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(req)}};
 assert.equal(authorize({event,env,manifestBytes:raw}).manifest.controlSourceSha,ref);
});
