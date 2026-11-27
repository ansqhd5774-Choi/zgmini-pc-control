import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validatePublicOwnerBExactScope} from '../tools/update.mjs';
import {main,verifyOperatorSourceClosure,withPublicBInstallLease} from '../tools/controller-audit-sha-repair-public-b-operator-once.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const INSTALLED='cde1dd372210e4658ae348cb9e2577967cb11634';
const TARGET='f03febc06f32a553676622ecf049e7dd90e2b7d5';
const operator='tools/controller-audit-sha-repair-public-b-operator-once.mjs';
const update=fs.readFileSync('tools/update.mjs','utf8');
const entry=fs.readFileSync(operator,'utf8');
const actor='ansqhd5774-Choi';
const issue=target=>({operation:'controller-update',controlRepository:REPO,targetControllerSha:target});

test('new one-file B remains fail closed before distinct B approval merge',()=>{
 const proposal={installedSha:INSTALLED,targetSha:TARGET,controllerOnlyInstall:true,
  purpose:'pc-controller-maintenance',approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',
   ref:'https://github.com/'+REPO+'/pull/4303'},postOperation:'core-status',
  selectiveSource:{branch:'codex/issues-lifecycle-manager-20261118-72-audit-sha-overlay'},
  allowFiles:[{path:'controller/operations.mjs',sha256:'6c0441108c244d1d5dd58e7793b785a371169a9d96b69e606200d905e8f59966'}]};
 assert.throws(()=>validatePublicOwnerBExactScope({actor,issue:issue(TARGET),manifest:proposal}),
  /PUBLIC_B_EFFECT_SCOPE_DENIED/);
 assert.ok(update.includes('approvalMerge:null'));
 assert.ok(update.includes("effect.approvalMerge??''"));
 assert.ok(entry.includes('const APPROVAL_MERGE=null;'));
 assert.ok(entry.includes("'PUBLIC_B_APPROVAL_NOT_PINNED'"));
});

test('prior three approved effects remain exact and source PR differs from approval PR',()=>{
 const previous=['555f95708984580cd7d5a0fd05a80b718e867710',
  'cde1dd372210e4658ae348cb9e2577967cb11634',
  'd3764580fdb08ecddd5f9b1064051eec30f90492'];
 for(const id of previous){
  const m=JSON.parse(fs.readFileSync('approvals/controller-updates/'+id+'.json','utf8'));
  assert.equal(validatePublicOwnerBExactScope({actor,issue:issue(id),manifest:m}),true);
 }
 assert.ok(entry.includes('const SOURCE_PR=4305;'));
 assert.ok(entry.includes('SOURCE_PR!==4303'));
 assert.ok(entry.includes('const TARGET=\''+TARGET+'\''));
 assert.ok(entry.includes('const INSTALLED=\''+INSTALLED+'\''));
 assert.ok(entry.includes("'tools/controller-audit-sha-repair-public-b-operator-once.mjs'"));
 assert.ok(entry.includes('sourcePr?.merged===true'));
 assert.ok(entry.includes('approved.equals(readMain(rel))'));
 const check=spawnSync(process.execPath,['--check',operator],{encoding:'utf8',timeout:15000});
 assert.equal(check.status,0,check.stderr);
});

test('operator refuses inspection and installation away from independent Windows owner',async()=>{
 if(process.platform!=='win32'){
  await assert.rejects(main(['inspect']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
  await assert.rejects(main(['apply']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
 }
 assert.ok(entry.includes('updater.verifyRecoveryOperator()'));
 assert.ok(entry.includes("maintenanceLockStatus(MAINT,'controller-install')"));
 assert.ok(entry.includes('lock.holdForRecovery()'));
 assert.ok(entry.includes('deps.prevalidationInventory(host)!==null'));
});

test('new independent operator pins entire six-source import closure before evaluation',()=>{
 const rels=[
  'tools/controller-audit-sha-repair-public-b-operator-once.mjs',
  'tools/update.mjs','tools/maintenance-contract.mjs',
  'tools/maintenance-apply.mjs','tools/maintenance-lock.mjs',
  'tools/source-bundle-register.mjs'
 ];
 const trusted=Object.fromEntries(rels.map(rel=>[rel,fs.readFileSync(rel)]));
 assert.equal(verifyOperatorSourceClosure(rel=>trusted[rel],rel=>trusted[rel]),true);
 const modified={...trusted,'tools/update.mjs':Buffer.from('export const injected=true;')};
 assert.throws(()=>verifyOperatorSourceClosure(rel=>modified[rel],rel=>trusted[rel]),
  /PUBLIC_B_OPERATOR_SOURCE_CAS_FAILED/);
 const extra={...trusted,
  'tools/update.mjs':Buffer.concat([trusted['tools/update.mjs'],
   Buffer.from("\nimport './unapproved-sidecar.mjs';")])};
 assert.throws(()=>verifyOperatorSourceClosure(rel=>extra[rel],rel=>extra[rel]),
  /PUBLIC_B_OPERATOR_IMPORT_NOT_PINNED/);
});

test('new independent operator holds lease for unknown results, releases only verified outcomes',async()=>{
 const lock=()=>({released:0,held:0,release(){this.released++;},
  holdForRecovery(){this.held++;}});
 const valid=lock();
 await withPublicBInstallLease(valid,async()=>({status:'PASS',actualInstalledSha:TARGET,
  postcheck:{protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:true}}));
 assert.deepEqual([valid.released,valid.held],[1,0]);
 const cases=[
  {status:'STATE_UNKNOWN',actualInstalledSha:null},
  {status:'PASS',actualInstalledSha:TARGET,
   postcheck:{protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:false}},
  {status:'PASS',actualInstalledSha:INSTALLED,
   postcheck:{protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:true}},
  {status:'BLOCKED',actualInstalledSha:INSTALLED,workflowEnabled:null}
 ];
 for(const result of cases){
  const l=lock();await withPublicBInstallLease(l,async()=>result);
  assert.deepEqual([l.released,l.held],[0,1]);
 }
 const thrown=lock();
 await assert.rejects(withPublicBInstallLease(thrown,async()=>{throw Error('uncertain');}),/uncertain/);
 assert.deepEqual([thrown.released,thrown.held],[0,1]);
});
