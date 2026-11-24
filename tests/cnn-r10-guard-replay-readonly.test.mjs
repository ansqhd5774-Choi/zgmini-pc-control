import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCnnR10ThreeGuardsReadonly as replay} from '../controller/cnn-r10-guard-replay-readonly.mjs';

const PIN='a'.repeat(40),HEAD='b'.repeat(40);
function script(){
 const lines=Array.from({length:27},()=>'const noop=0;');
 lines[0]=`const APPROVED_SOURCE_SHA="${PIN}";`;
 lines[1]="const head=execFileSync('git',['rev-parse','HEAD']).toString().trim();";
 lines[18]="if (head !== APPROVED_SOURCE_SHA) need(false,'SOURCE SHA');";
 lines[20]="if (head === APPROVED_SOURCE_SHA) need(false,'SECOND');";
 lines[22]="if (head !== APPROVED_SOURCE_SHA) need(false,'THIRD');";
 lines[25]="const PRIVATE_SECRET='NEVER_PUBLISH';";
 return lines;
}
const facts=(head=HEAD)=>({sourcePin:true,ledgerStable:true,gitVerified:true,head,
 gitExit:{head:0,tracked:0,whole:0}});
test('reports only evaluated guard order and first static replay failure',()=>{
 const r=replay(script().join('\n'),facts());
 assert.deepEqual(r.guardEvaluation.map(x=>x.line),[19,21,23]);
 assert.deepEqual(r.guardEvaluation.map(x=>x.guardPassed),[false,true,false]);
 assert.equal(r.firstReplayFailure,'LINE_19');
 assert.equal(r.firstRuntimeFailure,null);
 assert.equal(r.status,'REPLAY_EVALUATED');
 assert.deepEqual(r.gitExit,{head:0,tracked:0,whole:0});
 assert.doesNotMatch(JSON.stringify(r),/NEVER_PUBLISH|aaaaaaaaaaaaaaaa|bbbbbbbbbbbb|SOURCE SHA/);
});
test('honors chronological order for later first replay blocker',()=>{
 const r=replay(script().join('\n'),facts(PIN));
 assert.deepEqual(r.guardEvaluation.map(x=>x.guardPassed),[true,false,true]);
 assert.equal(r.firstReplayFailure,'LINE_21');
});
test('earlier unrecognized guard stops causal replay attribution',()=>{
 const lines=script();
 lines[18]="if (arbitraryCall()) need(false,'SOURCE SHA');";
 const r=replay(lines.join('\n'),facts(PIN));
 assert.equal(r.status,'PARTIAL_REPLAY');
 assert.equal(r.guardEvaluation[0].guardPassed,null);
 assert.equal(r.guardEvaluation[1].guardPassed,false);
 assert.equal(r.firstReplayFailure,null);
});
test('positive guard without explicit block action stays unknown',()=>{
 const lines=script();
 lines[18]="if (head !== APPROVED_SOURCE_SHA) doSomethingUnknown();";
 const r=replay(lines.join('\n'),facts());
 assert.equal(r.guardEvaluation[0].guardPassed,null);
 assert.equal(r.firstReplayFailure,null);
});
test('unverified pin, git or ledger never reports replay success',()=>{
 for(const delta of [{sourcePin:false},{gitVerified:false},{ledgerStable:false}]){
  const r=replay(script().join('\n'),{...facts(),...delta});
  assert.equal(r.status,'STATE_UNKNOWN');
  assert.equal(r.firstReplayFailure,null);
  assert.ok(r.guardEvaluation.every(x=>x.guardPassed===null));
 }
});
test('Git exits are bounded, input text and secret fields are never returned',()=>{
 const r=replay(script().join('\n'),{...facts(),gitExit:{head:127,tracked:200,whole:-1},secret:'SECRET'});
 assert.deepEqual(r.gitExit,{head:127,tracked:200,whole:null});
 assert.doesNotMatch(JSON.stringify(r),/SECRET|PRIVATE|cmdLine|path|SOURCE SHA/);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.providerCalls,0);
 assert.equal(r.d1Writes,0);
});
test('arbitrary expression with chained operands is not executed or guessed',()=>{
 const lines=script();
 lines[18]="if (head !== APPROVED_SOURCE_SHA && fetch('SECRET')) throw Error('SOURCE SHA');";
 const r=replay(lines.join('\n'),facts());
 assert.equal(r.guardEvaluation[0].guardPassed,null);
 assert.equal(r.firstReplayFailure,null);
});
