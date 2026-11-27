import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePublicOwnerBExactScope} from '../tools/update.mjs';
import {classifyPublicBPreflight,main,verifyOperatorSourceClosure,
 withPublicBInstallLease} from '../tools/controller-public-b-operator-once.mjs';
import {validateControllerSelectivePin,manifestFingerprint} from '../tools/maintenance-contract.mjs';
import {assemble4263Contracts,classify4263Evidence,main as recover4263Main} from '../tools/controller-public-b-recover-4263.mjs';
import * as updater from '../tools/update.mjs';

const target='555f95708984580cd7d5a0fd05a80b718e867710';
const installed='3c7d4cfefacf072fd35cb19706b352c64c5e4fd2';
const manifest=JSON.parse(fs.readFileSync(new URL('../approvals/controller-updates/'+target+'.json',import.meta.url)));
const pin=JSON.parse(fs.readFileSync(new URL('../approvals/controller-selective-targets/'+target+'.json',import.meta.url)));
const data={actor:'ansqhd5774-Choi',issue:{operation:'controller-update',
 controlRepository:'ansqhd5774-Choi/zgmini-pc-control',targetControllerSha:target},manifest};
const clone=x=>JSON.parse(JSON.stringify(x));
test('exact owner B effect is scope-bound to one selective 4-file Controller target',()=>{
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.allowFiles.length,4);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validatePublicOwnerBExactScope(data),true);
 const cases=[
  d=>{d.actor='another-user';},d=>{d.issue.operation='system-shell';},
  d=>{d.issue.targetControllerSha='a'.repeat(40);},
  d=>{d.manifest.installedSha='a'.repeat(40);},
  d=>{d.manifest.targetSha='a'.repeat(40);},
  d=>{d.manifest.controllerOnlyInstall=false;},
  d=>{d.manifest.approval.ref='https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/1';},
  d=>{d.manifest.postOperation='source-audit';},
  d=>{d.manifest.allowFiles.push({path:'controller/operations.mjs',sha256:'0'.repeat(64)});},
  d=>{d.manifest.selectiveSource.branch='codex/other';},
 ];
 for(const change of cases){
  const d=clone(data);change(d);
  assert.throws(()=>validatePublicOwnerBExactScope(d),/PUBLIC_B_EFFECT_SCOPE_DENIED/);
 }
});
test('independent operator decision fails closed on every missing proof',()=>{
 const ready={owner:true,operator:true,source:true,manifest:true,
  installed:true,leaseFree:true,previousAttempt:false};
 assert.equal(classifyPublicBPreflight(ready),'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY');
 for(const key of Object.keys(ready)){
  const invalid={...ready,[key]:key==='previousAttempt'?true:false};
  assert.notEqual(classifyPublicBPreflight(invalid),'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY');
 }
 assert.notEqual(classifyPublicBPreflight({}),'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY');
});
test('source-only Linux CI cannot create a Public B Issue or execute operator',async()=>{
 if(process.platform==='win32')return;
 await assert.rejects(main(['inspect']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
 await assert.rejects(main(['apply']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
});
test('4263 recovery receives validator from authoritative contract module, not updater exports',()=>{
 assert.equal(typeof updater.validateControllerSelectivePin,'undefined');
 const recovered=assemble4263Contracts(updater,{validateControllerSelectivePin});
 assert.equal(recovered.validateControllerSelectivePin(manifest,pin),true);
 assert.equal(recovered.prevalidationInventory,updater.prevalidationInventory);
 assert.equal(recovered.verifyPublicOwnerBWindows,updater.verifyPublicOwnerBWindows);
 assert.throws(()=>assemble4263Contracts(updater,{}),/B4263_CONTRACT_EXPORT_MISSING/);
 assert.throws(()=>assemble4263Contracts({}, {validateControllerSelectivePin}),/B4263_CONTRACT_EXPORT_MISSING/);
});
test('interrupted #4263 stays within original exact-source one-shot scope',()=>{
 const ready={originalLedger:true,ownerDead:true,leaseExact:true,
  installedTarget:true,supervisorHealthy:true,sixIdle:true,
  workflowPaused:true,backupProtected:true,backlogOriginal:true,
  claimAbsent:true};
 assert.equal(classify4263Evidence(ready),'B4263_RECOVERY_PREFLIGHT_ONLY');
 for(const key of Object.keys(ready)){
  assert.notEqual(classify4263Evidence({...ready,[key]:false}),
   'B4263_RECOVERY_PREFLIGHT_ONLY',key);
 }
 assert.notEqual(classify4263Evidence({}),'B4263_RECOVERY_PREFLIGHT_ONLY');
 const src=fs.readFileSync(new URL('../tools/controller-public-b-recover-4263.mjs',import.meta.url),'utf8');
 assert.match(src,/const RECOVERY_PR=4265;/);
 assert.match(src,/const ISSUE=4263;/);
 assert.match(src,/const REQUEST='pc-update-3f1c0413-37dd-4b44-900e-75c709d492ff';/);
 assert.match(src,/originalLedgerSha256:hash\(pre\.ledgerRaw\)/);
 assert.match(src,/record\('WORKFLOW_ENABLE_ATTEMPTED'\)/);
 assert.match(src,/await ports\.resumeIntake\(\)/);
 assert.match(src,/await ports\.reconcileBacklog\(request\)/);
 assert.match(src,/const post=await ports\.postcheck\(request\)/);
 assert.match(src,/fs\.renameSync\(leaseDir,leaseArchived\)/);
 assert.doesNotMatch(src,/\bports\.(?:switchVersion|stopOwnSupervisor|restore|reconnect)\s*\(/);
 assert.match(src,/fs\.readFileSync\(leaseOwner\)\.equals\(pre\.ownerRaw\)/);
 assert.match(src,/B4263_OUTCOME_RECONCILE_NO_RETRY/);
 const upd=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 assert.match(upd,/prepareInterruptedPublicBSwitch:async\(\)=>\{/);
 assert.match(upd,/publicOwnerBOperator&&issueNumber===4263/);
});
test('hosted source CI never operates exact #4263 recovery on Windows',async()=>{
 if(process.platform==='win32')return;
 await assert.rejects(recover4263Main(['inspect']),/B4263_INDEPENDENT_WINDOWS_REQUIRED/);
 await assert.rejects(recover4263Main(['recover']),/B4263_INDEPENDENT_WINDOWS_REQUIRED/);
});
test('public maintenance receiver denial remains intact',()=>{
 const agent=fs.readFileSync(new URL('../tools/maintenance-agent.mjs',import.meta.url),'utf8');
 assert.match(agent,/if\(await repositoryAllowed\(\)==='PUBLIC'\)/);
 assert.match(agent,/PUBLIC_B_EFFECT_SEPARATE_AUTH_REQUIRED/);
 assert.match(agent,/operationalWrites:0,effectAuthorized:false/);
});

test('full local static import closure is pinned before module evaluation',()=>{
 const paths=[
  'tools/controller-public-b-operator-once.mjs','tools/update.mjs',
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-lock.mjs','tools/source-bundle-register.mjs'
 ];
 const local=Object.fromEntries(paths.map(rel=>[
  rel,fs.readFileSync(new URL('../'+rel,import.meta.url))]));
 const trusted={...local};
 assert.equal(verifyOperatorSourceClosure(rel=>local[rel],rel=>trusted[rel]),true);
 const changed={...local,
  'tools/source-bundle-register.mjs':Buffer.from('export const injected=true;')};
 assert.throws(()=>verifyOperatorSourceClosure(rel=>changed[rel],
  rel=>trusted[rel]),/PUBLIC_B_OPERATOR_SOURCE_CAS_FAILED/);
 const unexpected={...local,'tools/update.mjs':Buffer.concat([
  local['tools/update.mjs'],Buffer.from("\nimport './unapproved-helper.mjs';\n")])};
 assert.throws(()=>verifyOperatorSourceClosure(rel=>unexpected[rel],
  rel=>unexpected[rel]),/PUBLIC_B_OPERATOR_IMPORT_NOT_PINNED/);
 const entry=local['tools/controller-public-b-operator-once.mjs'].toString('utf8');
 assert.doesNotMatch(entry,/^import[^\n]*from\s+['"]\./m);
 assert.match(entry,/await Promise\.all\(\[/);
});
test('immutable reviewed source merge and moving-main byte parity are enforced',()=>{
 const file=fs.readFileSync(new URL('../tools/controller-public-b-operator-once.mjs',import.meta.url),'utf8');
 assert.match(file,/sourcePr=api\('repos\/'\+REPO\+'\/pulls\/4262'\)/);
 assert.match(file,/sourcePr\?\.merged===true/);
 assert.match(file,/sourceLineage\?\.merge_base_commit\?\.sha===sourceMerge/);
 assert.match(file,/const approved=readRevision\(rel,sourceMerge\)/);
 assert.match(file,/approved\.equals\(readMain\(rel\)\)/);
 const rel='tools/update.mjs';
 const current=fs.readFileSync(new URL('../'+rel,import.meta.url));
 const local={};
 const source=[
  'tools/controller-public-b-operator-once.mjs','tools/update.mjs',
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-lock.mjs','tools/source-bundle-register.mjs'
 ];
 for(const item of source)local[item]=fs.readFileSync(new URL('../'+item,import.meta.url));
 const mutated=Buffer.concat([current,Buffer.from('// main drift')]);
 assert.throws(()=>verifyOperatorSourceClosure(item=>local[item],
  item=>item===rel?mutated:local[item]),/PUBLIC_B_OPERATOR_SOURCE_CAS_FAILED/);
});

test('lease is released only after positively verified terminal outcome',async()=>{
 const newLock=()=>({releaseCount:0,holdCount:0,release(){
  this.releaseCount++;},holdForRecovery(){this.holdCount++;}});
 const done=[
  {status:'PASS',actualInstalledSha:target,postcheck:{
   protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:true}},
  {status:'BLOCKED',actualInstalledSha:installed,workflowEnabled:true},
  {status:'ROLLED_BACK',actualInstalledSha:installed,
   workflowEnabled:true,protectedStateUnchanged:true}
 ];
 for(const result of done){
  const lock=newLock();
  assert.equal(await withPublicBInstallLease(lock,async()=>result),result);
  assert.equal(lock.releaseCount,1);
  assert.equal(lock.holdCount,0);
 }
});
test('unknown effect, missing proof and persistence exceptions retain recovery lease',async()=>{
 const newLock=()=>({releaseCount:0,holdCount:0,release(){
  this.releaseCount++;},holdForRecovery(){this.holdCount++;}});
 const unknown=[
  {status:'RECOVERY_REQUIRED',actualInstalledSha:null},
  {status:'BLOCKED',actualInstalledSha:installed,workflowEnabled:null},
  {status:'PASS',actualInstalledSha:target,postcheck:{runnerSetVerified:false}},
  {status:'STATE_UNKNOWN',actualInstalledSha:null}
 ];
 for(const result of unknown){
  const lock=newLock();
  await withPublicBInstallLease(lock,async()=>result);
  assert.equal(lock.releaseCount,0);
  assert.equal(lock.holdCount,1);
 }
 for(const failureStep of ['port.persist','switchVersion','claim.record']){
  const lock=newLock();
  await assert.rejects(withPublicBInstallLease(lock,async()=>{
   throw Object.assign(new Error(failureStep),{code:'EIO'});
  }),/port.persist|switchVersion|claim.record/);
  assert.equal(lock.releaseCount,0);
  assert.equal(lock.holdCount,1);
 }
});
