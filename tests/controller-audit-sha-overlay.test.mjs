import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const BASE='cde1dd372210e4658ae348cb9e2577967cb11634';
const TARGET='f03febc06f32a553676622ecf049e7dd90e2b7d5';
const PATH='controller/operations.mjs';
const BEFORE='0507663515206b97bb2cad72a2b3fb19032d5ab0f3c2bdd1305eaa6d225d5375';
const AFTER='6c0441108c244d1d5dd58e7793b785a371169a9d96b69e606200d905e8f59966';
const FROM='report.actualExecutionSha===host?.controllerSourceSha';
const TO="report.actualExecutionSha==='555f95708984580cd7d5a0fd05a80b718e867710'";
const git=(...args)=>execFileSync('git',args,{windowsHide:true,timeout:15000,maxBuffer:2e6});
const digest=x=>createHash('sha256').update(x).digest('hex');

test('historical ledger SHA repair is an exact one-file child of installed Controller',()=>{
 assert.equal(git('rev-list','--parents','-n','1',TARGET).toString().trim(),TARGET+' '+BASE);
 assert.equal(git('diff','--name-only',BASE,TARGET,'--').toString().trim(),PATH);
 const old=git('show',BASE+':'+PATH);
 const newer=git('show',TARGET+':'+PATH);
 assert.equal(digest(old),BEFORE);
 assert.equal(digest(newer),AFTER);
 const original=old.toString('utf8'),updated=newer.toString('utf8');
 assert.equal(original.split(FROM).length-1,1);
 assert.equal(updated,original.replace(FROM,TO));
 assert.ok(updated.includes('supervisor?.sourceSha===host?.controllerSourceSha'));
 assert.equal(git('show',BASE+':config/operations.json').equals(
  git('show',TARGET+':config/operations.json')),true);
 const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
  input:updated,encoding:'utf8',windowsHide:true,timeout:15000
 });
 assert.equal(syntax.status,0,syntax.stderr);
});

test('historical SHA is fixed while current supervisor SHA stays independently protected',()=>{
 const original=git('show',BASE+':'+PATH).toString('utf8');
 const updated=git('show',TARGET+':'+PATH).toString('utf8');
 assert.equal(updated.includes(FROM),false);
 assert.equal(updated.split(TO).length-1,1);
 assert.equal(updated.includes('supervisor?.sourceSha===host?.controllerSourceSha'),true);
 assert.equal(updated.includes('report.requestId===requestId'),true);
 assert.equal(updated.includes('report.jobId===jobId'),true);
 assert.equal(updated.includes('report.status===\'PASS\''),true);
 assert.equal(original.includes('supervisor?.sourceSha===host?.controllerSourceSha'),true);
});

test('draft one-file B manifest and selective pin preserve installed CAS and exact effect',async()=>{
 const {readFileSync}=await import('node:fs');
 const {manifestFingerprint,validateControllerSelectivePin}=await import('../tools/maintenance-contract.mjs');
 const m=JSON.parse(readFileSync('approvals/controller-updates/'+TARGET+'.json','utf8'));
 const pin=JSON.parse(readFileSync('approvals/controller-selective-targets/'+TARGET+'.json','utf8'));
 assert.equal(m.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(m.installedSha,BASE);
 assert.equal(m.targetSha,TARGET);
 assert.equal(m.controllerOnlyInstall,true);
 assert.deepEqual(m.allowFiles,[{path:PATH,sha256:AFTER}]);
 assert.equal(m.checks.manifestSha256,manifestFingerprint(m.allowFiles).sha256);
 assert.deepEqual(m.backup,{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:BASE}});
 assert.equal(m.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4303');
 assert.equal(m.selectiveSource.branch,'codex/issues-lifecycle-manager-20261118-72-audit-sha-overlay');
 assert.deepEqual(m.selectiveSource.customPaths,[PATH]);
 assert.equal(validateControllerSelectivePin(m,pin),true);
 assert.equal(pin.approvalRef,m.approval.ref);
 assert.equal(pin.allowFiles.length,1);
 assert.throws(()=>validateControllerSelectivePin({...m,targetSha:'a'.repeat(40)},pin),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin({...m,allowFiles:[...m.allowFiles,
  {path:'controller/common.mjs',sha256:'a'.repeat(64)}]},pin),/SELECTIVE_PIN_MISMATCH/);
});

test('new historical-ledger B effect remains denied by currently installed exact public owner admission',async()=>{
 const {validatePublicOwnerBExactScope}=await import('../tools/update.mjs');
 const {readFileSync}=await import('node:fs');
 const manifest=JSON.parse(readFileSync('approvals/controller-updates/'+TARGET+'.json','utf8'));
 const actor='ansqhd5774-Choi';
 const issue={operation:'controller-update',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',targetControllerSha:TARGET};
 assert.throws(()=>validatePublicOwnerBExactScope({actor,issue,manifest}),
  /PUBLIC_B_EFFECT_SCOPE_DENIED/);
 // Changing target/installed solely in an old approved effect is also denied.
 const oldTarget='cde1dd372210e4658ae348cb9e2577967cb11634';
 const oldApproved=JSON.parse(readFileSync('approvals/controller-updates/'+oldTarget+'.json','utf8'));
 assert.throws(()=>validatePublicOwnerBExactScope({actor,issue,
  manifest:{...oldApproved,targetSha:TARGET}}),/PUBLIC_B_EFFECT_SCOPE_DENIED/);
});

test('draft new Windows owner adapter cannot execute without independently pinned B approval',async()=>{
 const {readFileSync}=await import('node:fs');
 const entry=readFileSync('tools/controller-audit-sha-repair-public-b-operator-once.mjs','utf8');
 assert.ok(entry.includes("const TARGET='"+TARGET+"'"));
 assert.ok(entry.includes("const INSTALLED='"+BASE+"'"));
 assert.ok(entry.includes("const APPROVAL_MERGE=null;"));
 assert.ok(entry.includes("const SOURCE_PR=null;"));
 assert.ok(entry.includes("'PUBLIC_B_OPERATOR_SOURCE_PR_NOT_PINNED'"));
 assert.ok(entry.includes("SOURCE_PR!==4303"));
 assert.ok(entry.includes(" 'controller/operations.mjs'"));
 assert.ok(entry.includes("'PUBLIC_B_APPROVAL_NOT_PINNED'"));
 assert.ok(entry.includes("!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME"));
 assert.ok(entry.includes("deps.prevalidationInventory(host)!==null"));
 assert.ok(entry.includes("deps.maintenanceLockStatus(MAINT,'controller-install')"));
 assert.ok(entry.includes("lock.holdForRecovery()"));
 assert.ok(entry.includes("updater.verifyRecoveryOperator()"));
 const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
  input:entry,encoding:'utf8',windowsHide:true,timeout:15000
 });
 assert.equal(syntax.status,0,syntax.stderr);
 const {main}=await import('../tools/controller-audit-sha-repair-public-b-operator-once.mjs');
 if(process.platform!=='win32'){
  await assert.rejects(main(['inspect']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
  await assert.rejects(main(['apply']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
 }
});

test('old exact owner B effects remain admitted while draft SHA repair stays denied',async()=>{
 const {readFileSync}=await import('node:fs');
 const {validatePublicOwnerBExactScope}=await import('../tools/update.mjs');
 const actor='ansqhd5774-Choi',controlRepository='ansqhd5774-Choi/zgmini-pc-control';
 const known=['555f95708984580cd7d5a0fd05a80b718e867710',
  'cde1dd372210e4658ae348cb9e2577967cb11634'];
 for(const id of known){
  const manifest=JSON.parse(readFileSync('approvals/controller-updates/'+id+'.json','utf8'));
  assert.equal(validatePublicOwnerBExactScope({actor,manifest,issue:{
   operation:'controller-update',controlRepository,targetControllerSha:id
  }}),true);
 }
 const manifest=JSON.parse(readFileSync('approvals/controller-updates/'+TARGET+'.json','utf8'));
 assert.throws(()=>validatePublicOwnerBExactScope({actor,manifest,issue:{
  operation:'controller-update',controlRepository,targetControllerSha:TARGET
 }}),/PUBLIC_B_EFFECT_SCOPE_DENIED/);
});

test('approved B effect and independently reviewed operator source must have different PR roots',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync('tools/controller-audit-sha-repair-public-b-operator-once.mjs','utf8');
 const manifest=JSON.parse(readFileSync('approvals/controller-updates/'+TARGET+'.json','utf8'));
 assert.equal(manifest.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/4303');
 assert.ok(code.includes("const SOURCE_PR=null;"));
 assert.ok(code.includes("SOURCE_PR!==4303"));
 assert.ok(code.includes("approved.equals(readMain(rel))"));
 assert.ok(code.includes("approved=readRevision(rel,sourceMerge)"));
 assert.ok(code.includes("sourcePr?.merged===true"));
 assert.ok(code.includes("sourceLineage?.behind_by===0"));
});
