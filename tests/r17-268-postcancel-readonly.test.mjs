import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 TARGET_REQUEST,BASE_SHA,BASE_HASHES,EXPECTED_TASK_HASH,HISTORICAL_PROTECTED_SHA,
 applyFixedPatch,classifyEvidence,summarizeEvidence,
} from '../controller/r17-268-postcancel-readonly.mjs';

const digest=s=>createHash('sha256').update(s).digest('hex');
const originals={
 'scripts/pc-writer/local-cycle.mjs':'before\nold line\nafter\n',
 'scripts/pc-writer/run-local.mjs':'first\nlegacy\nlast\n',
};
const patch=`diff --git a/scripts/pc-writer/local-cycle.mjs b/scripts/pc-writer/local-cycle.mjs
--- a/scripts/pc-writer/local-cycle.mjs
+++ b/scripts/pc-writer/local-cycle.mjs
@@ -1,3 +1,3 @@
 before
-old line
+new line
 after
diff --git a/scripts/pc-writer/run-local.mjs b/scripts/pc-writer/run-local.mjs
--- a/scripts/pc-writer/run-local.mjs
+++ b/scripts/pc-writer/run-local.mjs
@@ -1,3 +1,3 @@
 first
-legacy
+patched
 last
`;

function completeFixture(){
 return {sources:Object.fromEntries(Object.entries(BASE_HASHES).map(([k,sha256])=>[k,{sha256}])),
  targetSha256:{},configSource:BASE_SHA,taskHash:EXPECTED_TASK_HASH,
  preflight:{requestId:TARGET_REQUEST,terminal:true},
  operatingSourceIdentified:true,runtimeSourceVerified:true,process:{verified:true,active:false},
  lease:{verified:true,active:false},protectedStateSha256:HISTORICAL_PROTECTED_SHA,
  checkpointsObserved:true,requestSideEffectsVerifiedAbsent:true};
}

test('exactly two context-verified files are patched in memory; originals unchanged',()=>{
 const prior=JSON.stringify(originals);
 const result=applyFixedPatch(patch,originals);
 assert.equal(JSON.stringify(originals),prior);
 assert.equal(result['scripts/pc-writer/local-cycle.mjs'],digest('before\nnew line\nafter\n'));
 assert.equal(result['scripts/pc-writer/run-local.mjs'],digest('first\npatched\nlast\n'));
});

test('CRLF source is normalized for matching and restored for digest',()=>{
 const win=Object.fromEntries(Object.entries(originals).map(([k,v])=>[k,v.replaceAll('\n','\r\n')]));
 const result=applyFixedPatch(patch,win);
 assert.equal(result['scripts/pc-writer/local-cycle.mjs'],digest('before\r\nnew line\r\nafter\r\n'));
});

test('mismatched patch context, missing file, duplicate file, and trailing text fail closed',()=>{
 const wrong={...originals,'scripts/pc-writer/local-cycle.mjs':'before\nDIFFERENT\nafter\n'};
 assert.throws(()=>applyFixedPatch(patch,wrong),/PATCH_CONTEXT_UNVERIFIED/);
 assert.throws(()=>applyFixedPatch(patch,{}),/BASE_UNVERIFIED/);
 assert.throws(()=>applyFixedPatch(patch.replaceAll('run-local.mjs','local-cycle.mjs'),originals),/PATCH_SCOPE_UNVERIFIED/);
 assert.throws(()=>applyFixedPatch(patch+'evil',originals),/PATCH_(?:TRAILING_CONTENT|LINE)_UNVERIFIED/);
});

test('complete no-drift evidence is the only NO_CHANGE_CONFIRMED',()=>{
 assert.equal(classifyEvidence(completeFixture()).status,'NO_CHANGE_CONFIRMED');
 assert.equal(classifyEvidence({...completeFixture(),checkpointsObserved:false}).status,'INSUFFICIENT_EVIDENCE');
 assert.equal(classifyEvidence({...completeFixture(),runtimeSourceVerified:false}).status,'INSUFFICIENT_EVIDENCE');
 assert.equal(classifyEvidence({...completeFixture(),preflight:{requestId:TARGET_REQUEST,terminal:false}}).status,'INSUFFICIENT_EVIDENCE');
 assert.equal(classifyEvidence({...completeFixture(),protectedStateSha256:null}).status,'INSUFFICIENT_EVIDENCE');
 assert.equal(classifyEvidence({...completeFixture(),requestSideEffectsVerifiedAbsent:false}).status,'INSUFFICIENT_EVIDENCE');
});

test('the currently available PC evidence cannot justify a no-change or resume PASS',()=>{
 const evidence={...completeFixture(),
  // #268 has no terminal request-scoped ledger or proof of side-effect absence.
  preflight:{requestId:TARGET_REQUEST,terminal:false,lastStep:null},
  protectedStateSha256:null,
  requestSideEffectsVerifiedAbsent:false,
  // The installed source tracer proves only static launcher provenance.
  runtimeSourceVerified:false,
  // No matching process or dedicated lease is not verified negative proof.
  process:{verified:false,active:false,matchingProcessCount:0},
  lease:{verified:false,active:null},
 };
 const result=summarizeEvidence(evidence);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R17_268_EVIDENCE_INSUFFICIENT_BLOCKED');
 assert.equal(result.assessment,'INSUFFICIENT_EVIDENCE');
 assert.equal(result.assessmentCode,'R17_268_LAST_STEP_OR_BASELINE_UNVERIFIED');
 assert.ok(result.missingEvidence.includes('PROTECTED_STATE_BASELINE_UNVERIFIED'));
 assert.ok(result.missingEvidence.includes('REQUEST_SIDE_EFFECTS_UNVERIFIED'));
 assert.ok(result.missingEvidence.includes('PROCESS_ABSENCE_UNVERIFIED'));
 assert.ok(result.missingEvidence.includes('REQUEST_TERMINAL_UNVERIFIED'));
 assert.deepEqual(result.sourceComparison.map(x=>x.comparison),['BEFORE','BEFORE']);
 assert.equal(result.operationalWrites,0);
});

test('normal scheduled checkpoint changes are observed, not attributed to #268',()=>{
 const first={...completeFixture(),checkpointEvidence:{cycle:{sha256:'a'.repeat(64)}}};
 const second={...completeFixture(),checkpointEvidence:{cycle:{sha256:'b'.repeat(64)}}};
 assert.equal(classifyEvidence(first).status,'NO_CHANGE_CONFIRMED');
 assert.equal(classifyEvidence(second).status,'NO_CHANGE_CONFIRMED');
 const report=summarizeEvidence(second);
 assert.equal(report.checkpointChangeAttribution,'UNKNOWN');
 assert.deepEqual(report.checkpointEvidence,second.checkpointEvidence);
 assert.equal(report.protectedStateEvidence.matched,true);
});

test('protected aggregate drift cannot be confused with a matching old config source pin',()=>{
 const result=summarizeEvidence({...completeFixture(),protectedStateSha256:'e'.repeat(64)});
 assert.equal(result.assessment,'CHANGED');
 assert.equal(result.assessmentCode,'R17_268_PROTECTED_STATE_DRIFT_UNATTRIBUTED');
 assert.equal(result.attributedTo268,false);
 assert.equal(result.protectedStateEvidence.matched,false);
});

test('source comparison does not attribute approved patch bytes to cancelled request',()=>{
 const file='scripts/pc-writer/run-local.mjs',sha='a'.repeat(64);
 const observed={...completeFixture(),targetSha256:{[file]:sha},
  sources:{...completeFixture().sources,[file]:{sha256:sha}}};
 const report=summarizeEvidence(observed);
 assert.equal(report.assessment,'CHANGED');
 assert.equal(report.status,'BLOCKED');
 const row=report.sourceComparison.find(x=>x.file===file);
 assert.equal(row.comparison,'APPROVED_PATCH');
 assert.equal(row.attributedTo268,false);
});

test('active execution or lease blocks any clean-state admission',()=>{
 const changed={...completeFixture(),configSource:'f'.repeat(40),process:{verified:true,active:true}};
 assert.deepEqual(classifyEvidence(changed),{status:'INSUFFICIENT_EVIDENCE',code:'R17_268_ACTIVE_PROCESS_STOP'});
 assert.equal(classifyEvidence({...completeFixture(),lease:{verified:true,active:true}}).code,'R17_268_ACTIVE_LEASE_STOP');
});

test('changed source SHA and config/task drift are reported, without #268 attribution',()=>{
 const change={...completeFixture(),sources:{...completeFixture().sources,
  'scripts/pc-writer/run-local.mjs':{sha256:'f'.repeat(64)}},targetSha256:{'scripts/pc-writer/run-local.mjs':'f'.repeat(64)}};
 const value=classifyEvidence(change);
 assert.equal(value.status,'CHANGED');assert.equal(value.changes[0].kind,'APPROVED_PATCH_PRESENT');
 assert.equal(value.attributedTo268,false);
 const unconfirmed=classifyEvidence({...change,operatingSourceIdentified:false});
 assert.equal(unconfirmed.status,'INSUFFICIENT_EVIDENCE');
 assert.equal(unconfirmed.candidateChanges[0].kind,'APPROVED_PATCH_PRESENT');
 assert.equal(classifyEvidence({...completeFixture(),configSource:'f'.repeat(40)}).code,'R17_268_CONFIG_PIN_CHANGED');
 assert.equal(classifyEvidence({...completeFixture(),taskHash:'f'.repeat(64)}).code,'R17_268_TASK_CHANGED');
});

test('summary never claims side effects or source restoration',()=>{
 const summary=summarizeEvidence({...completeFixture(),process:{verified:false}});
 assert.equal(summary.status,'BLOCKED');
 assert.equal(summary.assessment,'INSUFFICIENT_EVIDENCE');
 assert.equal(summary.providerCalls,0);assert.equal(summary.dbD1Writes,0);
 assert.equal(summary.operationalWrites,0);
 assert.equal(summary.oldRunId,'41786730527');
});

test('dispatcher has one-shot ID gate; published policy remains A/readonly',()=>{
 const dispatcher=readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 const policy=JSON.parse(readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 assert.match(dispatcher,/request\.requestId!==ONE_SHOT_DIAGNOSTIC_ID/);
 assert.match(dispatcher,/inspectR17PostCancel\(dataRoot,/);
 assert.match(dispatcher,/digest\(JSON\.stringify\(protectedState\(dataRoot,\{queryTask\}\)\)\)/);
 assert.deepEqual(policy.operations['r17-268-postcancel-readonly'],{grade:'A',timeoutSeconds:90,resource:'light'});
 assert.equal(policy.mutationsEnabled,false);
});
