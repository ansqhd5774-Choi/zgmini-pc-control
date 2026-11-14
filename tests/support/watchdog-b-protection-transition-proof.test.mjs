import test from 'node:test';
import assert from 'node:assert/strict';
import {auditProtectedTransition} from './watchdog-b-protection-transition-proof.mjs';
const fake=(label)=>label.repeat(64).slice(0,64);
const core=fake('c'),korea=fake('k'),host0=fake('h'),host1=fake('j'),writer0=fake('w'),writer1=fake('z');
const b={'ZGMINI-PC-Local-Core':core,'ZGMINI-PC-Local-Korea':korea,
  'ZGMINI-PC-Iran-Progress-R13':'LEGACY_RETIRED_STATE',
  'E:/ZGmini/data/pc-writer/config.json':writer0,
  'E:/ZGmini/automation/pc-control/host.json':host0};
const n={...b,'ZGMINI-PC-Iran-Progress-R13':'APPROVED_RETIRED_ABSENT',
  'E:/ZGmini/data/pc-writer/config.json':writer1,
  'E:/ZGmini/automation/pc-control/host.json':host1};
const changed=[{category:'CONTROLLER_HOST',change:'CHANGED'},
  {category:'RETIRED_IRAN_TASK',change:'CHANGED'},
  {category:'WRITER_CONFIG',change:'CHANGED'}];
const readback={schema:'ZGMINI_PC_WATCHDOG_PROTECTED_DRIFT_A_RESULT_V1',
 requestId:'pc-watchdog-a-c3f812e2-6e11-4ec2-b6b7-f968174f38a9',
 failedIssueNumber:1372,status:'PASS',code:'WATCHDOG_A_PROTECTED_KEYS_CHANGED',
 runId:'43632362343',changed,changedCount:3,writes:0,providerCalls:0,d1Writes:0};
const tr=(category,key)=>({category,change:'CHANGED',expectedBefore:b[key],
 expectedAfter:n[key],approvalRef:'#123',receiptRef:'#456'});
const transitions=[tr('CONTROLLER_HOST','E:/ZGmini/automation/pc-control/host.json'),
 tr('RETIRED_IRAN_TASK','ZGMINI-PC-Iran-Progress-R13'),
 tr('WRITER_CONFIG','E:/ZGmini/data/pc-writer/config.json')];
const p={schema:'ZGMINI_WATCHDOG_B_TRANSITION_PROPOSAL_V1',failedIssueNumber:1372,
 readbackRunId:'43632362343',transitions};
const run=(o={})=>auditProtectedTransition({before:b,now:n,readback,proposal:p,...o});
test('category-only receipt is not approval to install or rebase',()=>{
 const r=run();assert.equal(r.status,'LOCAL_MATCH_OWNER_AUTHENTICATION_REQUIRED');
 assert.equal(r.approvedForInstall,false);assert.equal(r.baselineUpdated,false);
 assert.deepEqual(r.changedCategories,changed);
});
test('real #1374 category set without proof is blocked',()=>{
 const r=run({proposal:null});assert.equal(r.status,'OWNER_EVIDENCE_REQUIRED');
});
test('exact source A run and incident binding required',()=>{
 for(const [k,v] of [['runId','123'],['failedIssueNumber',1373],['requestId','wrong'],['writes',1],['status','FAIL'],['providerCalls',1]]){
  const r=run({readback:{...readback,[k]:v}});assert.equal(r.status,'UNVERIFIED');
 }
});
test('changed category cannot be omitted',()=>{
 const r=run({proposal:{...p,transitions:transitions.slice(1)}});
 assert.ok(r.blockers.includes('UNEXPLAINED_PROTECTED_CATEGORY'));
});
test('disguised additional or changed keys cannot get approval',()=>{
 const r=run({now:{...n,'ZGMINI-PC-Local-Core':fake('a')}});
 assert.equal(r.status,'UNVERIFIED');assert.ok(r.blockers.includes('LIVE_READBACK_MISMATCH'));
});
test('approval reference by itself cannot bypass exact matching',()=>{
 const t={...transitions[0],expectedAfter:fake('q')};
 const r=run({proposal:{...p,transitions:[t,...transitions.slice(1)]}});
 assert.ok(r.blockers.includes('TRANSITION_PREIMAGE_OR_POSTIMAGE_MISMATCH'));
});
test('duplicate and invented transition categories stop',()=>{
 for(const extra of [transitions[0],{...transitions[0],category:'FOREIGN'}]){
  const r=run({proposal:{...p,transitions:[...transitions,extra]}});
  assert.ok(r.blockers.includes('TRANSITION_SCHEMA_OR_DUPLICATE'));
 }
});
test('retired Iran must remain affirmatively absent',()=>{
 const r=run({now:{...n,'ZGMINI-PC-Iran-Progress-R13':'UNVERIFIED'}});
 assert.ok(r.blockers.includes('RETIRED_IRAN_ABSENCE_NOT_PROVEN'));
});
test('unknown fields or missing mandatory Tasks fail closed',()=>{
 for(const before of [{...b,unknown:'x'},Object.fromEntries(Object.entries(b).filter(([k])=>k!=='ZGMINI-PC-Local-Core'))]){
  assert.ok(run({before}).blockers.includes('PROTECTION_SCHEMA_INVALID'));
 }
});
test('readback change type is exact, not just category',()=>{
 assert.ok(run({readback:{...readback,changed:[{category:'CONTROLLER_HOST',change:'MISSING'},...changed.slice(1)]}}).blockers.includes('LIVE_READBACK_MISMATCH'));
});
test('output never discloses values or pseudo-protected hashes',()=>{
 const wire=JSON.stringify(run());for(const secret of [host0,host1,writer0,writer1,core,korea,'LEGACY_RETIRED_STATE'])assert.ok(!wire.includes(secret));
});
test('proposal refs may not be arbitrary URLs, without authenticating refs',()=>{
 const r=run({proposal:{...p,transitions:[{...transitions[1],approvalRef:'https://evil.example'},...transitions.filter(t=>t.category!=='RETIRED_IRAN_TASK')]}});
 assert.ok(r.blockers.includes('SOURCE_APPROVAL_OR_RECEIPT_REFERENCE_MISSING'));
});
