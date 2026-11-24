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


test('line 19 reports bounded Git HEAD provenance without leaking source',async()=>{
 const {classifyPinnedCnnR10Line19Readonly:shape}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();
 lines[18]="if (head !== APPROVED_SOURCE_SHA) need(false,'PRIVATE_SOURCE_SHA');";
 const result=shape(lines.join('\n'));
 assert.deepEqual({form:result.form,comparison:result.comparison,gitInput:result.gitInput,
  blockAction:result.blockAction},{
  form:'DIRECT_VARIABLE_COMPARE',comparison:'STRICT_NOT_EQUAL',
  gitInput:'GIT_HEAD',blockAction:'EXPLICIT_FAIL_HELPER'});
 assert.equal(result.runtimeInput,'NOT_OBSERVED_BY_THIS_PROBE');
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_SOURCE_SHA|aaaaaaaaaa|bbbbbbbbbb|head|APPROVED_SOURCE_SHA/);
});
test('line 19 classifies inline tracked Git status but does not evaluate it',async()=>{
 const {classifyPinnedCnnR10Line19Readonly:shape}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();
 lines[18]="if (execFileSync('git',['status','--porcelain','--untracked-files=no']).length > 0) need(false,'SECRET');";
 const v=shape(lines.join('\n'));
 assert.equal(v.form,'CALL_OR_MEMBER_EXPRESSION');
 assert.equal(v.gitInput,'GIT_STATUS_TRACKED');
 assert.equal(v.blockAction,'EXPLICIT_FAIL_HELPER');
 assert.equal(v.comparison,'OTHER');
 assert.doesNotMatch(JSON.stringify(v),/SECRET|--porcelain|--untracked-files/);
});
test('line 19 arbitrary compound expression is never called or treated as proven',async()=>{
 const {classifyPinnedCnnR10Line19Readonly:shape}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();let calls=0;globalThis.__cnnTestGuard=()=>{calls++;throw Error('CALLED');};
 lines[18]="if (hiddenValue() && __cnnTestGuard()) throw Error('SECRET');";
 const v=shape(lines.join('\n'));
 assert.equal(v.form,'COMPOUND_EXPRESSION');
 assert.equal(v.gitInput,'UNKNOWN');
 assert.equal(v.blockAction,'THROW');
 assert.equal(calls,0);
 assert.doesNotMatch(JSON.stringify(v),/SECRET|hiddenValue|__cnnTestGuard/);
 delete globalThis.__cnnTestGuard;
});
test('short or malformed pinned sources stay unverified',async()=>{
 const {classifyPinnedCnnR10Line19Readonly:shape}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 assert.equal(shape('if(1)').form,'UNKNOWN');
 const lines=script();lines[18]='if (unknownFunction(';
 assert.equal(shape(lines.join('\n')).form,'UNSUPPORTED');
 const r=replay(lines.join('\n'),{...facts(),sourcePin:false});
 assert.equal(r.line19Structure,null);
});


test('line19 current SHA replay makes false AND unsupported safely false',async()=>{
 const {projectCnnR10Line19OperandsReadonly:probe}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();
 lines[18]="if ((head === APPROVED_SOURCE_SHA) && unknownFunction('PRIVATE')) throw Error('NOPE');";
 const r=probe(lines.join('\n'),facts());
 assert.equal(r.connective,'AND_ONLY');
 assert.deepEqual(r.atomClasses,['PINNED_SHA40_COMPARE','CALL_OR_MEMBER_OR_GROUP']);
 assert.equal(r.currentStaticCondition,'FALSE');
 assert.equal(r.runtimeCondition,'NOT_OBSERVED');
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE|APPROVED_SOURCE_SHA|unknownFunction|bbbbbb/);
});
test('line19 unsupported earlier operand never becomes proven false',async()=>{
 const {projectCnnR10Line19OperandsReadonly:probe}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();
 lines[18]="if (privateCall() && head === APPROVED_SOURCE_SHA) throw Error('SECRET');";
 const r=probe(lines.join('\n'),facts());
 assert.equal(r.connective,'AND_ONLY');
 assert.equal(r.currentStaticCondition,'UNKNOWN');
 assert.equal(r.atomClasses.length,2);
});
test('line19 nested AND OR follows precedence without importing Sidecar',async()=>{
 const {projectCnnR10Line19OperandsReadonly:probe}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();
 lines[18]="if ((head !== APPROVED_SOURCE_SHA) || (head === APPROVED_SOURCE_SHA && privateCall())) throw Error('SECRET');";
 const r=probe(lines.join('\n'),facts());
 assert.equal(r.currentStaticCondition,'TRUE');
 assert.equal(r.connective,'MIXED');
 assert.equal(r.runtimeCondition,'NOT_OBSERVED');
 assert.equal(r.operationalWrites,0);
});
test('line19 source pin ledger and git preconditions fail closed',async()=>{
 const {projectCnnR10Line19OperandsReadonly:probe}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();
 lines[18]="if (head !== APPROVED_SOURCE_SHA && privateCall()) throw Error('X');";
 for(const delta of [{sourcePin:false},{ledgerStable:false},{gitVerified:false}]){
  const r=probe(lines.join('\n'),{...facts(),...delta});
  assert.equal(r.status,'STATE_UNKNOWN');
  assert.deepEqual(r.atomClasses,[]);
 }
});
test('line19 static operands never get promoted to previous runtime branch',()=>{
 const lines=script();
 lines[18]="if (head !== APPROVED_SOURCE_SHA || arbitraryCall()) throw Error('SECRET');";
 const r=replay(lines.join('\n'),facts());
 assert.equal(r.line19OperandEvidence.currentStaticCondition,'TRUE');
 assert.equal(r.guardEvaluation[0].guardPassed,null);
 assert.equal(r.firstReplayFailure,null);
 assert.equal(r.firstRuntimeFailure,null);
});


test('line19 reports strictly allowlisted semantic classes without raw operands',async()=>{
 const {projectCnnR10Line19OperandsReadonly:probe}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();
 lines[18]="if (fs.existsSync(privatePath) && execFileSync('git',['status','--porcelain']).length > 0) throw Error('SECRET');";
 const r=probe(lines.join('\n'),facts());
 assert.equal(r.connective,'AND_ONLY');
 assert.equal(r.atomSemantics.length,2);
 assert.equal(r.atomSemantics[0].family,'FILESYSTEM_METADATA');
 assert.equal(r.atomSemantics[0].input,'FILESYSTEM_PATH_UNVERIFIED');
 assert.equal(r.atomSemantics[1].family,'GIT_PROCESS');
 assert.equal(r.atomSemantics[1].input,'GIT_STATUS');
 assert.equal(r.currentStaticCondition,'UNKNOWN');
 assert.doesNotMatch(JSON.stringify(r),/privatePath|SECRET|execFileSync|--porcelain/);
});
test('line19 does not run calls when classifying dataflow families',async()=>{
 const {projectCnnR10Line19OperandsReadonly:probe}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();let invoked=0;
 globalThis.__forbidCall=()=>{invoked++;throw Error('CALLED');};
 lines[18]="if (__forbidCall('SECRET') && process.env.MY_PRIVATE) throw Error('SECRET');";
 const r=probe(lines.join('\n'),facts());
 assert.equal(invoked,0);
 assert.equal(r.atomSemantics[0].value,'NOT_EVALUATED');
 assert.equal(r.atomSemantics[1].input,'PROCESS_ENV');
 assert.equal(r.firstRuntimeFailure,null);
 assert.doesNotMatch(JSON.stringify(r),/MY_PRIVATE|__forbidCall|SECRET/);
 delete globalThis.__forbidCall;
});
test('line19 cannot classify unverified source inputs',async()=>{
 const {projectCnnR10Line19OperandsReadonly:probe}=await import('../controller/cnn-r10-guard-replay-readonly.mjs');
 const lines=script();
 lines[18]="if (fs.existsSync(secret) && helper(secret)) throw Error('SECRET');";
 const result=probe(lines.join('\n'),{...facts(),gitVerified:false});
 assert.deepEqual(result.atomSemantics,[]);
 assert.equal(result.status,'STATE_UNKNOWN');
});
