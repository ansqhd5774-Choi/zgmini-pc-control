import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {create996NativeClaimStore} from '../tools/controller-996-native-claims.mjs';
import {create996NativeBacklogGate} from '../tools/controller-996-native-backlog.mjs';

const REQUEST='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pause='2026-11-10T01:30:00.000Z';
const resume='2026-11-10T03:15:00.000Z';
function fixture(t,{nonce='c996-test-claim'}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'leases'));
 const folder=path.join(root,'backlog');fs.mkdirSync(folder);
 const file=path.join(folder,REQUEST+'.json');
 const input={schema:'ZGMINI_PC_BACKLOG_V1',requestId:REQUEST,
  pausedAt:pause,resumedAt:null,replays:{},
  windows:[{pausedAt:pause,resumedAt:null}]};
 const bytes=Buffer.from(JSON.stringify(input)+'\n');
 fs.writeFileSync(file,bytes);
 const store=create996NativeClaimStore({root,testOnly:true,uuid:()=>nonce,
  now:()=>resume});
 store.reserveClaim();store.recordOnce('PREPARED');
 store.recordOnce('WORKFLOW_ENABLE_ATTEMPTED');
 const state={active:true,exclusive:true,exclusiveReads:0};
 const options={root,testOnly:true,claimStore:store,
  expectedOriginalSha:sha(bytes),now:()=>resume,
  workflowGateway:{verifyActiveReadback:()=>state.active},
  proveExclusiveWriter:()=>{state.exclusiveReads++;return state.exclusive;}};
 return {root,folder,file,bytes,store,state,options,
  gate:(overrides={})=>create996NativeBacklogGate({...options,...overrides})};
}

test('one-shot closes exactly original pause window; preserves replays',t=>{
 const f=fixture(t),gate=f.gate();
 const p=gate.closeOnce();
 assert.equal(p.originalSha,sha(f.bytes));
 assert.equal(p.nextSha,sha(fs.readFileSync(f.file)));
 assert.equal(p.resumeAt,resume);
 assert.equal(f.state.exclusiveReads,2);
 assert.equal(f.store.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),true);
 const final=gate.readClosed(p.nextSha);
 assert.deepEqual(final.windows,[{pausedAt:pause,resumedAt:resume}]);
 assert.deepEqual(final.replays,{});
 assert.throws(()=>gate.closeOnce(),/C_BACKLOG_INTENT_ALREADY_OR_WORKFLOW_NOT_PREPARED/);
});

test('an unverified Writer or inactive Workflow cannot consume attempt',t=>{
 const f=fixture(t);f.state.exclusive=false;
 assert.throws(()=>f.gate().closeOnce(),/C_BACKLOG_EXCLUSIVE_WRITER_UNVERIFIED/);
 assert.equal(f.store.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),false);
 f.state.exclusive=true;f.state.active=false;
 assert.throws(()=>f.gate().closeOnce(),/C_WORKFLOW_NOT_ACTIVE/);
 assert.equal(fs.readFileSync(f.file).equals(f.bytes),true);
});

test('original digest drift stops before any intent or file replace',t=>{
 const f=fixture(t);fs.appendFileSync(f.file,' ');
 assert.throws(()=>f.gate().closeOnce(),/C_BACKLOG_ORIGINAL_DIGEST_DRIFT/);
 assert.equal(f.store.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),false);
 assert.equal(fs.readFileSync(f.file).equals(f.bytes),false);
});

test('pending/duplicate windows or an unknown replay fail before intent',t=>{
 for(const mutate of [
  x=>x.windows.push({...x.windows[0]}),
  x=>x.replays['2000']={status:'POSTING'},
  x=>x.resumedAt=resume,
 ]){
  const f=fixture(t),data=JSON.parse(f.bytes);mutate(data);
  const bytes=Buffer.from(JSON.stringify(data)+'\n');fs.writeFileSync(f.file,bytes);
  assert.throws(()=>f.gate({expectedOriginalSha:sha(bytes)}).closeOnce(),
   /C_BACKLOG_STRUCTURE_MISMATCH|C_BACKLOG_NOT_OPEN/);
  assert.equal(f.store.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),false);
 }
});

test('an unknown outcome after durable marker is never automatically retried',t=>{
 const f=fixture(t),gate=f.gate({onPreCommit:()=>{throw Error('simulated crash');}});
 assert.throws(()=>gate.closeOnce(),/simulated crash/);
 assert.equal(f.store.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),true);
 assert.equal(fs.readFileSync(f.file).equals(f.bytes),true);
 assert.throws(()=>f.gate().closeOnce(),/C_BACKLOG_INTENT_ALREADY_OR_WORKFLOW_NOT_PREPARED/);
});

test('concurrent file change before commit is left intact, never overwritten',t=>{
 const f=fixture(t),changed=Buffer.from('external writer change\n');
 assert.throws(()=>f.gate({onPreCommit:()=>fs.writeFileSync(f.file,changed)})
  .closeOnce(),/C_BACKLOG_CHANGED_BEFORE_COMMIT/);
 assert.equal(fs.readFileSync(f.file).equals(changed),true);
 assert.equal(f.store.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),true);
});

test('independent Writer proof loss at commit blocks replacement',t=>{
 const f=fixture(t),gate=f.gate({proveExclusiveWriter:()=>{
  f.state.exclusiveReads++;return f.state.exclusiveReads===1;
 }});
 assert.throws(()=>gate.closeOnce(),/C_BACKLOG_EXCLUSIVE_WRITER_LOST/);
 assert.equal(fs.readFileSync(f.file).equals(f.bytes),true);
 assert.equal(f.store.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),true);
});

test('untrusted temp name is rejected before consuming one-shot marker',t=>{
 const f=fixture(t,{nonce:'bad_nonce'});
 assert.throws(()=>f.gate().closeOnce(),/C_BACKLOG_OWNER_NONCE_UNSAFE/);
 assert.equal(f.store.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),false);
});

test('stale temp path blocks before the attempt marker is recorded',t=>{
 const f=fixture(t),temp=path.join(f.folder,`${REQUEST}.c996-c996-test-claim.tmp`);
 fs.writeFileSync(temp,'older uncertain operation');
 assert.throws(()=>f.gate().closeOnce(),/C_BACKLOG_TEMP_ALREADY_EXISTS/);
 assert.equal(f.store.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),false);
 assert.equal(fs.readFileSync(temp,'utf8'),'older uncertain operation');
});

test('test-only override cannot target production path or unsafe root',()=>{
 assert.throws(()=>create996NativeBacklogGate({root:'/tmp',testOnly:true}),
  /C_BACKLOG_TEST_ROOT_REJECTED/);
 assert.throws(()=>create996NativeBacklogGate({root:'E:/ZGmini/automation/pc-maintenance',
  testOnly:true}),/C_BACKLOG_TEST_ROOT_REJECTED/);
 assert.throws(()=>create996NativeBacklogGate({root:'/tmp',testOnly:false}),
  /C_ORIGINAL_WINDOWS_PC_REQUIRED/);
});
