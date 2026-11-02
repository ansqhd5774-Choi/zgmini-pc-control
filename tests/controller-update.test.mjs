import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {processUpdate} from '../maintenance/processor.mjs';
import {digest,verifyChanges,verifyOperationPolicy} from '../maintenance/contract.mjs';

const oldSha='c491d95fdb594a729f08deff68d86e04c18a9544',newSha='b77a333db9d3445394ff4267949a79b6054126cf';
const a=digest('controller module v2');
const data=()=>({schema:'ZGMINI_PC_CONTROLLER_UPDATE_V1',requestId:'update-fg-20261102',chatId:'chat-fg-r10',controlRepository:'ansqhd5774-Choi/zgmini-pc-control',installedSha:oldSha,targetSha:newSha,
 approval:{approvalId:'approved-fg-r10',scope:'A_READONLY_CONTROLLER',basis:'User explicitly approved A-grade read-only PC diagnostic controller update',approvedBy:'ansqhd5774-Choi'},
 changedFiles:[{path:'controller/fear-greed-archive-readonly.mjs',sha256:a}],
 tests:{status:'PASS',sourceSha:newSha,passed:3,failed:0,evidence:'PR #28, local node test fixtures'},
 recovery:{backup:'HASHED_CONTROLLER_CONFIG_HOST',partialFailure:'STOP_AUDIT_BEFORE_RETRY'}});
const issue=(x=data())=>({number:90,actor:'ansqhd5774-Choi',labels:['pc-controller-update'],body:JSON.stringify(x)});
function fixture(){
 const ledger=new Map(),comments=[];let installed=oldSha,calls=0,idle=true,publishFails=false;
 const io={approvedBootstrapTargetSha:null,load:k=>ledger.get(k),save:r=>ledger.set(r.requestId,structuredClone(r)),
  inspectInstalled:async()=>({sha:installed}),inspectChanges:async()=>[{path:'controller/fear-greed-archive-readonly.mjs',status:'A',sha256:a},{path:'results/read-only.json',status:'A',sha256:digest('report')}],
  isIdle:async()=>({ok:idle,code:'CONTROL_JOBS_BUSY'}),
  apply:async()=>{calls++;installed=newSha;return {actualInstalledSha:newSha,runnerCount:6,protectedStateUnchanged:true,workflowEnabled:true,backup:'backup-verified'};},
  auditApplied:async()=>installed===newSha?{verified:true,actualInstalledSha:newSha,runnerCount:6,protectedStateUnchanged:true,workflowEnabled:true}: {verified:false},
  replayPending:async()=>0,
  publish:async(n,r)=>{if(publishFails)throw Object.assign(Error('offline'),{code:'GITHUB_OFFLINE'});comments.push({n,r});}};
 return {io,ledger,comments,get calls(){return calls},set idle(v){idle=v},set installed(v){installed=v},set publishFails(v){publishFails=v}};
}
test('approved exact SHA update: wait for live jobs, then apply once, preserve report',async()=>{
 const f=fixture();f.idle=false;let r=await processUpdate(issue(),f.io);assert.equal(r.code,'CONTROL_JOBS_BUSY');assert.equal(f.calls,0);
 f.idle=true;r=await processUpdate(issue(),f.io);assert.equal(r.status,'PASS');assert.equal(r.actualInstalledSha,newSha);assert.equal(r.runnerCount,6);assert.equal(f.calls,1);
 const twice=await processUpdate(issue(),f.io);assert.equal(twice.status,'PASS');assert.equal(f.calls,1);assert.equal(f.comments.length,1);
});
test('bad SHA, unauthorized path, actor, payload drift and failing evidence cannot install',async()=>{
 for(const changed of [x=>{x.targetSha='x'.repeat(40)},x=>{x.changedFiles[0].path='scripts/pc-writer/run.cmd'},x=>{x.tests.status='FAIL'},x=>{x.approval.scope='B_PRODUCTION_WRITE'}]){
  const f=fixture(),x=data();changed(x);const r=await processUpdate(issue(x),f.io);assert.equal(r.status,'BLOCKED');assert.equal(f.calls,0);
 }
 const f=fixture();assert.equal((await processUpdate({...issue(),actor:'someone-else'},f.io)).code,'UPDATE_ACTOR_NOT_ALLOWED');
 f.idle=false;await processUpdate(issue(),f.io);const x=data();x.chatId='changed';assert.equal((await processUpdate(issue(x),f.io)).code,'DUPLICATE_REQUEST_PAYLOAD_CHANGED');
 assert.throws(()=>verifyChanges(data(),[{path:'controller/fear-greed-archive-readonly.mjs',status:'A',sha256:digest('wrong')}]),/UPDATE_CHANGED_FILE_HASH/);
});
test('uncertain mid-update cannot retry; audited completed install can be recovered',async()=>{
 const f=fixture();f.ledger.set(data().requestId,{...data(),payloadSha:digest(JSON.stringify(data())),status:'WAITING',phase:'APPLYING',lastPass:'UPDATE_STARTED'});
 let r=await processUpdate(issue(),f.io);assert.equal(r.code,'UPDATE_OUTCOME_UNCERTAIN_NO_RETRY');assert.equal(f.calls,0);
 const g=fixture();g.installed=newSha;g.ledger.set(data().requestId,{...data(),payloadSha:digest(JSON.stringify(data())),status:'WAITING',phase:'APPLYING',lastPass:'UPDATE_STARTED'});
 r=await processUpdate(issue(),g.io);assert.equal(r.code,'UPDATE_RECOVERED_PENDING_REPLAY');assert.equal(g.calls,0);
 const done=await processUpdate(issue(),g.io);assert.equal(done.status,'PASS');assert.equal(g.calls,0);
});
test('failure after apply and disconnected Github publish is persisted and not reinstalled',async()=>{
 const f=fixture();f.publishFails=true;const r=await processUpdate(issue(),f.io);assert.equal(r.status,'PASS');assert.equal(f.calls,1);
 assert.equal(f.ledger.get(data().requestId).publicationCode,'GITHUB_OFFLINE');
 f.publishFails=false;const next=await processUpdate(issue(),f.io);assert.equal(next.status,'PASS');assert.equal(f.calls,1);assert.equal(f.comments.length,1);
});
test('failed application and partial verification stop without a second updater execution',async()=>{
 const f=fixture(),original=f.io.apply;let executions=0;
 f.io.apply=async()=>{executions++;throw Object.assign(Error('partial'),{code:'UPDATE_INTERRUPTED'});};
 let r=await processUpdate(issue(),f.io);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'UPDATE_STOP_NO_AUTOMATIC_RETRY');
 await processUpdate(issue(),f.io);assert.equal(executions,1);assert.equal(f.calls,0);
 const g=fixture();g.io.apply=async()=>({actualInstalledSha:newSha,runnerCount:5,protectedStateUnchanged:true,workflowEnabled:true});
 r=await processUpdate(issue(),g.io);assert.equal(r.code,'POST_UPDATE_VERIFICATION_FAILED');assert.equal(r.firstFail,'AFTER_UPDATE_AUDIT');
 f.io.apply=original;
});
test('replay network interruption preserves applied status and retries replay only',async()=>{
 const f=fixture();let times=0;
 f.io.replayPending=async()=>{times++;if(times===1)throw Object.assign(Error('offline'),{code:'GITHUB_OFFLINE'});return 1;};
 let r=await processUpdate(issue(),f.io);assert.equal(r.code,'REPLAY_RECOVERY_WAITING');assert.equal(f.calls,1);
 r=await processUpdate(issue(),f.io);assert.equal(r.status,'PASS');assert.equal(r.replayedPendingIssues,1);assert.equal(f.calls,1);
});
test('bootstrap scope is pinned to one explicitly installed target',async()=>{
 const f=fixture(),x=data();x.approval.scope='ONE_TIME_MAINTENANCE_BOOTSTRAP';
 let r=await processUpdate(issue(x),f.io);assert.equal(r.code,'BOOTSTRAP_TARGET_NOT_PINNED');assert.equal(f.calls,0);
 const g=fixture();g.io.approvedBootstrapTargetSha=newSha;
 r=await processUpdate(issue(x),g.io);assert.equal(r.status,'PASS');assert.equal(g.calls,1);
});
test('fixed standalone task and GitHub replay adapter keep normal Runner jobs independent',()=>{
 const bootstrap=fs.readFileSync(new URL('../tools/bootstrap-maintenance.mjs',import.meta.url),'utf8');
 const agent=fs.readFileSync(new URL('../maintenance/agent.mjs',import.meta.url),'utf8');
 const update=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 const workflow=fs.readFileSync(new URL('../.github/workflows/pc-job.yml',import.meta.url),'utf8');
 const entry=fs.readFileSync(new URL('../controller/entry.mjs',import.meta.url),'utf8');
 assert.match(bootstrap,/ZGMINI-PC-Control-Maintenance/);
 assert.match(bootstrap,/\['\/Create','\/TN',taskName,'\/SC','MINUTE'/);
 assert.match(agent,/processUpdate\(/);assert.match(agent,/controller-update-/);
 assert.match(agent,/pc-job-replay/);assert.match(update,/ZGMINI_CONTROL_UPDATE_TARGET_SHA/);
 assert.ok(update.indexOf("backupVerified=true")<update.indexOf("execFileSync('taskkill.exe'"));
 assert.match(workflow,/types: \[opened, labeled\]/);
 assert.match(workflow,/github\.event\.label\.name == 'pc-job-replay'/);
 assert.match(entry,/event\.label\?\.name==='pc-job-replay'/);
});

test('A-readonly controller approval cannot change write policy, existing operations or protected keys',()=>{
 const before={schema:'ZGMINI_PC_OPERATIONS_V1',controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  sourceRepository:'ansqhd5774-Choi/zgmini',allowedActors:['ansqhd5774-Choi'],
  seats:6,mutationsEnabled:false,maxHeavyJobs:1,artifactUploadEnabled:false,
  operations:{'source-audit':{grade:'A',timeoutSeconds:60,resource:'light'}}};
 const after=structuredClone(before);
 after.operations['fear-greed-archive-status']={grade:'A',timeoutSeconds:60,resource:'light'};
 assert.equal(verifyOperationPolicy(before,after),true);
 const writing=structuredClone(after);writing.mutationsEnabled=true;
 assert.throws(()=>verifyOperationPolicy(before,writing),/UPDATE_CONFIG_WRITE_OR_SEAT_CHANGE/);
 const existingChanged=structuredClone(after);existingChanged.operations['source-audit'].timeoutSeconds=90;
 assert.throws(()=>verifyOperationPolicy(before,existingChanged),/UPDATE_EXISTING_OPERATION_CHANGED/);
 const elevated=structuredClone(after);elevated.operations['fear-greed-archive-status'].grade='B';
 assert.throws(()=>verifyOperationPolicy(before,elevated),/UPDATE_NEW_OPERATION_NOT_READONLY_A/);
 const supplier=structuredClone(after);supplier.sourceRepository='unauthorized/supplier';
 assert.throws(()=>verifyOperationPolicy(before,supplier),/UPDATE_CONFIG_PROTECTED_FIELD_CHANGED/);
});

test('bootstrap pins updater and maintenance path defers intake until independent audit',()=>{
 const bootstrap=fs.readFileSync(new URL('../tools/bootstrap-maintenance.mjs',import.meta.url),'utf8');
 const agent=fs.readFileSync(new URL('../maintenance/agent.mjs',import.meta.url),'utf8');
 const update=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 assert.match(bootstrap,/updateToolSha256:sha\(updater\)/);
 assert.match(agent,/digest\(fs\.readFileSync\(updater\)\)===settings\.updateToolSha256/);
 assert.match(update,/CONTROLLER_UPDATER_RUNNER_CONTEXT_FORBIDDEN/);
 assert.match(agent,/ZGMINI_CONTROL_MAINTENANCE_DEFER_REENABLE:'1'/);
 assert.match(update,/if\(!managedIntake\)/);
 assert.ok(agent.indexOf("'UPDATE_PRE_RESUME_AUDIT_FAILED'")<
  agent.indexOf("api('actions/workflows/pc-job.yml/enable','PUT')",agent.indexOf('function apply')));
 assert.match(agent,/deferredUpdateReceipt\(request,record\)/);
});
