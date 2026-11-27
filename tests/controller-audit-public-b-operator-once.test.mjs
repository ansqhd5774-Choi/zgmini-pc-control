import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePublicOwnerBExactScope} from '../tools/update.mjs';
import {validateControllerSelectivePin,manifestFingerprint} from '../tools/maintenance-contract.mjs';
import {classifyPublicBPreflight,verifyOperatorSourceClosure,
 withPublicBInstallLease,main} from '../tools/controller-audit-public-b-operator-once.mjs';

const installed='555f95708984580cd7d5a0fd05a80b718e867710';
const target='cde1dd372210e4658ae348cb9e2577967cb11634';
const control='ansqhd5774-Choi/zgmini-pc-control';
const manifest=JSON.parse(fs.readFileSync(new URL('../approvals/controller-updates/'+target+'.json',import.meta.url)));
const pin=JSON.parse(fs.readFileSync(new URL('../approvals/controller-selective-targets/'+target+'.json',import.meta.url)));
const data={actor:'ansqhd5774-Choi',issue:{operation:'controller-update',
 controlRepository:control,targetControllerSha:target},manifest};
const clone=v=>JSON.parse(JSON.stringify(v));

test('new approved B effect matches exactly two audit files and preserves previous B scope',()=>{
 assert.equal(manifest.installedSha,installed);
 assert.equal(manifest.targetSha,target);
 assert.deepEqual(manifest.allowFiles.map(x=>x.path).sort(),['config/operations.json','controller/operations.mjs']);
 assert.equal(manifest.checks.manifestSha256,manifestFingerprint(manifest.allowFiles).sha256);
 assert.equal(validateControllerSelectivePin(manifest,pin),true);
 assert.equal(validatePublicOwnerBExactScope(data),true);
 const prior='555f95708984580cd7d5a0fd05a80b718e867710';
 const old=JSON.parse(fs.readFileSync(new URL('../approvals/controller-updates/'+prior+'.json',import.meta.url)));
 assert.equal(validatePublicOwnerBExactScope({actor:data.actor,
  issue:{...data.issue,targetControllerSha:prior},manifest:old}),true);
 const cases=[
  d=>{d.actor='another-owner';},
  d=>{d.issue.operation='remote-shell';},
  d=>{d.issue.targetControllerSha='a'.repeat(40);},
  d=>{d.manifest.installedSha='a'.repeat(40);},
  d=>{d.manifest.targetSha='a'.repeat(40);},
  d=>{d.manifest.controllerOnlyInstall=false;},
  d=>{d.manifest.approval.ref='https://github.com/'+control+'/pull/4260';},
  d=>{d.manifest.postOperation='runner-smoke';},
  d=>{d.manifest.allowFiles.push({path:'controller/entry.mjs',sha256:'0'.repeat(64)});},
  d=>{d.manifest.selectiveSource.branch='codex/other';}
 ];
 for(const change of cases){
  const item=clone(data);change(item);
  assert.throws(()=>validatePublicOwnerBExactScope(item),/PUBLIC_B_EFFECT_SCOPE_DENIED/);
 }
});

test('separate Windows operator remains fail-closed without physical owner proof',async()=>{
 const pass={owner:true,operator:true,source:true,manifest:true,
 installed:true,leaseFree:true,previousAttempt:false};
 assert.equal(classifyPublicBPreflight(pass),'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY');
 for(const k of Object.keys(pass)){
  const broken={...pass,[k]:k==='previousAttempt'?true:false};
  assert.notEqual(classifyPublicBPreflight(broken),'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY');
 }
 if(process.platform!=='win32'){
  await assert.rejects(main(['inspect']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
  await assert.rejects(main(['apply']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
 }
});

test('new operator source import closure is complete and verifies raw bytes before evaluation',()=>{
 const rels=['tools/controller-audit-public-b-operator-once.mjs','tools/update.mjs',
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-lock.mjs','tools/source-bundle-register.mjs'];
 const src=Object.fromEntries(rels.map(r=>[r,fs.readFileSync(new URL('../'+r,import.meta.url))]));
 assert.equal(verifyOperatorSourceClosure(r=>src[r],r=>src[r]),true);
 const tamper={...src,'tools/update.mjs':Buffer.from('export const changed=true;')};
 assert.throws(()=>verifyOperatorSourceClosure(r=>tamper[r],r=>src[r]),
  /PUBLIC_B_OPERATOR_SOURCE_CAS_FAILED/);
 const unreviewed={...src,'tools/update.mjs':Buffer.concat([
  src['tools/update.mjs'],Buffer.from("\\nimport './unauthorized.mjs';")])};
 assert.throws(()=>verifyOperatorSourceClosure(r=>unreviewed[r],r=>unreviewed[r]),
  /PUBLIC_B_OPERATOR_IMPORT_NOT_PINNED/);
 const code=src[rels[0]].toString('utf8');
 assert.match(code,/const TARGET='cde1dd372210e4658ae348cb9e2577967cb11634'/);
 assert.match(code,/const INSTALLED='555f95708984580cd7d5a0fd05a80b718e867710'/);
 assert.match(code,/const APPROVAL_MERGE='f96187723c25d2059a53e587d9b31717deaab277'/);
 assert.match(code,/need\(SOURCE_PR>0&&sourcePr\?\.number===SOURCE_PR&&sourcePr\?\.merged===true/);
 assert.match(code,/approved\.equals\(readMain\(rel\)\)/);
});

test('unknown new two-file B outcome retains exclusive recovery lease',async()=>{
 const lock=()=>({releaseCount:0,holdCount:0,release(){this.releaseCount++;},
 holdForRecovery(){this.holdCount++;}});
 const ok=lock();
 await withPublicBInstallLease(ok,async()=>({status:'PASS',actualInstalledSha:target,
 postcheck:{protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:true}}));
 assert.deepEqual([ok.releaseCount,ok.holdCount],[1,0]);
 for(const outcome of [{status:'STATE_UNKNOWN',actualInstalledSha:null},
  {status:'PASS',actualInstalledSha:target,postcheck:{postSourceVerified:false}},
  {status:'BLOCKED',actualInstalledSha:installed,workflowEnabled:null}]){
  const l=lock();await withPublicBInstallLease(l,async()=>outcome);
  assert.deepEqual([l.releaseCount,l.holdCount],[0,1]);
 }
});
