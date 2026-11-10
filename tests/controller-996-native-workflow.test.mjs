import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {create996NativeClaimStore} from '../tools/controller-996-native-claims.mjs';
import {create996NativeWorkflowGateway} from '../tools/controller-996-native-workflow.mjs';

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'leases'));
 const store=create996NativeClaimStore({root,testOnly:true,
  uuid:()=> 'workflow-test-claim',now:()=> '2026-11-10T04:00:00.000Z'});
 store.reserveClaim();store.recordOnce('PREPARED');
 const state={workflow:'disabled_manually',putCalls:0};
 const gateway=(enable=()=>{state.putCalls++;state.workflow='active';return true;})=>
  create996NativeWorkflowGateway({claimStore:store,
   readWorkflow:()=>({state:state.workflow}),enableApi:enable});
 return {store,state,gateway};
}

test('one prepared durable intent authorizes exactly one PUT attempt',t=>{
 const f=fixture(t),g=f.gateway();
 assert.equal(f.state.putCalls,0);
 const ticket=g.prepareEnableIntent();
 assert.equal(f.store.hasMarker('WORKFLOW_ENABLE_ATTEMPTED'),true);
 assert.equal(g.enableOnce(ticket),true);
 assert.equal(g.verifyActiveReadback(),true);
 assert.equal(f.state.putCalls,1);
 assert.throws(()=>g.enableOnce(ticket),/C_WORKFLOW_ENABLE_TICKET_INVALID_OR_USED/);
 assert.throws(()=>g.prepareEnableIntent(),/C_WORKFLOW_ENABLE_INTENT_ALREADY_EXISTS/);
 assert.equal(f.state.putCalls,1);
});

test('already active Workflow cannot mint a new PUT intent',t=>{
 const f=fixture(t);f.state.workflow='active';
 const g=f.gateway();
 assert.throws(()=>g.prepareEnableIntent(),/C_WORKFLOW_NOT_DISABLED_BEFORE_INTENT/);
 assert.equal(f.store.hasMarker('WORKFLOW_ENABLE_ATTEMPTED'),false);
 assert.equal(f.state.putCalls,0);
});

test('missing PREPARED checkpoint blocks PUT before intent',t=>{
 const f=fixture(t);
 const wrongStore={...f.store,hasMarker:name=>name==='PREPARED'?false:
  f.store.hasMarker(name)};
 const g=create996NativeWorkflowGateway({claimStore:wrongStore,
  readWorkflow:()=>({state:'disabled_manually'}),enableApi:()=>{throw Error('must not run');}});
 assert.throws(()=>g.prepareEnableIntent(),/C_PREPARED_RECORD_REQUIRED/);
 assert.equal(f.store.hasMarker('WORKFLOW_ENABLE_ATTEMPTED'),false);
});

test('timeout after PUT attempt leaves durable marker and restart cannot retry',t=>{
 const f=fixture(t),g=f.gateway(()=>{f.state.putCalls++;throw Error('timeout');});
 const ticket=g.prepareEnableIntent();
 assert.throws(()=>g.enableOnce(ticket),/C_WORKFLOW_ENABLE_OUTCOME_UNKNOWN/);
 assert.equal(f.state.putCalls,1);
 assert.equal(f.store.hasMarker('WORKFLOW_ENABLE_ATTEMPTED'),true);
 assert.throws(()=>g.enableOnce(ticket),/C_WORKFLOW_ENABLE_TICKET_INVALID_OR_USED/);
 const restarted=f.gateway();
 assert.throws(()=>restarted.prepareEnableIntent(),/C_WORKFLOW_ENABLE_INTENT_ALREADY_EXISTS/);
 assert.equal(f.state.putCalls,1);
});

test('acknowledgment ambiguity cannot be reinterpreted as a retry',t=>{
 const f=fixture(t),g=f.gateway(()=>{f.state.putCalls++;return undefined;});
 const ticket=g.prepareEnableIntent();
 assert.throws(()=>g.enableOnce(ticket),/C_WORKFLOW_ENABLE_OUTCOME_UNKNOWN/);
 assert.equal(f.state.putCalls,1);
});

test('unrecognized workflow readback is a hard stop without writing marker',t=>{
 const f=fixture(t);f.state.workflow='unknown';
 const g=f.gateway();
 assert.throws(()=>g.prepareEnableIntent(),/C_WORKFLOW_STATE_UNKNOWN/);
 assert.equal(f.state.putCalls,0);
 assert.equal(f.store.hasMarker('WORKFLOW_ENABLE_ATTEMPTED'),false);
});

test('gateway constructor without claim ownership and strict APIs fails',()=>{
 assert.throws(()=>create996NativeWorkflowGateway({}),/C_WORKFLOW_GATEWAY_PORT_INVALID/);
});
