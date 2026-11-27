import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePublicOwnerBExactScope} from '../tools/update.mjs';
import {classifyPublicBPreflight,verifyOperatorSourceClosure,
 withPublicBInstallLease,main} from '../tools/controller-lineage-public-b-operator-once.mjs';

const installed='cde1dd372210e4658ae348cb9e2577967cb11634';
const target='d3764580fdb08ecddd5f9b1064051eec30f90492';
const path='controller/operations.mjs';
const control='ansqhd5774-Choi/zgmini-pc-control';
const pin={path,sha256:'6c0441108c244d1d5dd58e7793b785a371169a9d96b69e606200d905e8f59966'};
const manifest={
 installedSha:installed,targetSha:target,purpose:'pc-controller-maintenance',
 controllerOnlyInstall:true,postOperation:'core-status',
 approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',
 ref:'https://github.com/'+control+'/pull/4302'},
 allowFiles:[pin],selectiveSource:{branch:'codex/controller-audit-4300-selective-20261128'}
};
const data={actor:'ansqhd5774-Choi',issue:{operation:'controller-update',
 controlRepository:control,targetControllerSha:target},manifest};
const clone=x=>JSON.parse(JSON.stringify(x));

test('4300 lineage candidate is exactly one file with fixed owner B scope',()=>{
 assert.deepEqual(manifest.allowFiles.map(x=>x.path),['controller/operations.mjs']);
 assert.equal(validatePublicOwnerBExactScope(data),true);
 for(const change of [
  x=>x.actor='other',x=>x.issue.operation='remote-shell',
  x=>x.issue.targetControllerSha=installed,
  x=>x.manifest.installedSha='a'.repeat(40),
  x=>x.manifest.targetSha='a'.repeat(40),
  x=>x.manifest.controllerOnlyInstall=false,
  x=>x.manifest.approval.ref='https://github.com/'+control+'/pull/4283',
  x=>x.manifest.postOperation='runner-smoke',
  x=>x.manifest.allowFiles.push({path:'controller/entry.mjs',sha256:'0'.repeat(64)}),
  x=>x.manifest.selectiveSource.branch='unapproved'
 ]){const candidate=clone(data);change(candidate);
  assert.throws(()=>validatePublicOwnerBExactScope(candidate),/PUBLIC_B_EFFECT_SCOPE_DENIED/);
 }
});
test('independent operator is fail-closed without physical owner and exact reviewed source',async()=>{
 const ok={owner:true,operator:true,source:true,manifest:true,installed:true,
  leaseFree:true,previousAttempt:false};
 assert.equal(classifyPublicBPreflight(ok),'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY');
 for(const k of Object.keys(ok)){
  assert.notEqual(classifyPublicBPreflight({...ok,[k]:k==='previousAttempt'?true:false}),
   'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY');
 }
 if(process.platform!=='win32'){
  await assert.rejects(main(['inspect']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
  await assert.rejects(main(['apply']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
 }
});
test('lineage source closure requires identical trusted bytes and rejects unlisted imports',()=>{
 const rels=['tools/controller-lineage-public-b-operator-once.mjs','tools/update.mjs',
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-lock.mjs','tools/source-bundle-register.mjs'];
 const bytes=Object.fromEntries(rels.map(p=>[p,fs.readFileSync(new URL('../'+p,import.meta.url))]));
 assert.equal(verifyOperatorSourceClosure(p=>bytes[p],p=>bytes[p]),true);
 assert.throws(()=>verifyOperatorSourceClosure(p=>p===rels[1]?Buffer.from('tampered'):bytes[p],p=>bytes[p]),
  /PUBLIC_B_OPERATOR_SOURCE_CAS_FAILED/);
 const injected={...bytes,[rels[1]]:Buffer.concat([bytes[rels[1]],Buffer.from("\nimport './remote-execute.mjs';")])};
 assert.throws(()=>verifyOperatorSourceClosure(p=>injected[p],p=>injected[p]),
  /PUBLIC_B_OPERATOR_IMPORT_NOT_PINNED/);
 const text=bytes[rels[0]].toString('utf8');
 assert.match(text,/const TARGET='d3764580fdb08ecddd5f9b1064051eec30f90492'/);
 assert.match(text,/const INSTALLED='cde1dd372210e4658ae348cb9e2577967cb11634'/);
 assert.match(text,/manifest\.checks\?\.status==='PASS'/);
 assert.match(text,/APPROVAL_MERGE='b7b7eb92802d0e974ee3ad9a2d2689e37ae41bb4'/);
});
test('unknown outcome preserves leased recovery exclusivity',async()=>{
 const lock=()=>({releases:0,holds:0,release(){this.releases++;},
 holdForRecovery(){this.holds++;}});
 const ok=lock();
 await withPublicBInstallLease(ok,async()=>({status:'PASS',actualInstalledSha:target,
  postcheck:{protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:true}}));
 assert.deepEqual([ok.releases,ok.holds],[1,0]);
 for(const result of [{status:'STATE_UNKNOWN',actualInstalledSha:null},
  {status:'PASS',actualInstalledSha:target,postcheck:{postSourceVerified:false}},
  {status:'BLOCKED',actualInstalledSha:installed,workflowEnabled:null}]){
  const l=lock();
  await withPublicBInstallLease(l,async()=>result);
  assert.deepEqual([l.releases,l.holds],[0,1]);
 }
});
