import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticate,validateSeat,SCHEMA,TITLE,REPOSITORY,toText} from '../tools/pc-host-inventory-readonly.mjs';
function fixture(role='operating'){
 const body={schema:SCHEMA,operation:'host-inventory-readonly',
  requestId:'37f4c567-4f2a-4746-b811-2209af71bfb8',role};
 return {event:{action:'opened',repository:{full_name:REPOSITORY,private:true},
  issue:{number:2000,user:{login:'ansqhd5774-Choi'},title:TITLE,body:JSON.stringify(body)}},
  env:{GITHUB_REPOSITORY:REPOSITORY,GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_EVENT_NAME:'issues',GITHUB_RUN_ID:'43000000001',GITHUB_RUN_ATTEMPT:'1'}};
}
test('exact authenticated read-only request accepts each role',()=>{
 for(const role of ['operating','handoff']){
  const f=fixture(role);
  assert.equal(authenticate(f.event,f.env,role).role,role);
 }
});
test('unauthenticated, extra command/path, wrong role, or duplicate input stops',()=>{
 const f=fixture();
 for(const mutate of [
  e=>e.action='labeled',e=>e.repository.private=false,
  e=>e.issue.user.login='other',e=>e.issue.title='run-shell',
  e=>{const b=JSON.parse(e.issue.body);b.cmd='dir';e.issue.body=JSON.stringify(b);},
  e=>{const b=JSON.parse(e.issue.body);b.role='handoff';e.issue.body=JSON.stringify(b);}
 ]){const e=structuredClone(f.event);mutate(e);assert.throws(()=>authenticate(e,f.env,'operating'));}
 assert.throws(()=>authenticate(f.event,{...f.env,GITHUB_ACTOR:'other'},'operating'));
});
test('strict host and runner identity, never conflate the two PCs',()=>{
 assert.equal(validateSeat('operating','OPERATING-01','zgmini-pc-03','OPERATING-01'),'MATCH');
 assert.equal(validateSeat('operating','DESKTOP-N62L0NG','zgmini-pc-03','DESKTOP-N62L0NG'),
  'OPERATING_HOST_COLLIDES_WITH_QUEUE');
 assert.equal(validateSeat('handoff','DESKTOP-N62L0NG','zgmini-handoff-ci-spare-01','DESKTOP-N62L0NG'),
  'MATCH');
 assert.equal(validateSeat('handoff','OTHER','zgmini-handoff-ci-spare-01','OTHER'),
  'HANDOFF_HOST_MISMATCH');
 assert.equal(validateSeat('operating','A','zgmini-pc-01','B'),'MATCH');
 assert.equal(validateSeat('operating','PC','zgmini-pc-05',''),'MATCH');
 assert.equal(validateSeat('handoff','DESKTOP-N62L0NG','zgmini-handoff-ci-spare-01',''),'MATCH');
 assert.equal(validateSeat('operating','','zgmini-pc-01',''),'HOST_IDENTITY_UNVERIFIED');
});
test('text report contains no paths, tokens, or raw memory dump',()=>{
 const text=toText({schema:'R',requestId:'id',runId:'1',attempt:'1',role:'handoff',
  host:'DESKTOP-N62L0NG',runnerName:'zgmini-handoff-ci-spare-01',
  expectedLabel:'zgmini-handoff-ci-isolated',status:'PASS',code:'READONLY_HOST_INVENTORY_COLLECTED',
  memory:{totalMiB:16000,freeMiB:1200}});
 assert.match(text,/memory.totalMiB=16000/);
 assert.doesNotMatch(text,/E:\\|TOKEN|PRIVATE|AppData/);
});
