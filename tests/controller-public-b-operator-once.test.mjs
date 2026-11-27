import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePublicOwnerBExactScope} from '../tools/update.mjs';
import {classifyPublicBPreflight,main} from '../tools/controller-public-b-operator-once.mjs';
import {validateControllerSelectivePin,manifestFingerprint} from '../tools/maintenance-contract.mjs';

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
test('public maintenance receiver denial remains intact',()=>{
 const agent=fs.readFileSync(new URL('../tools/maintenance-agent.mjs',import.meta.url),'utf8');
 assert.match(agent,/if\(await repositoryAllowed\(\)==='PUBLIC'\)/);
 assert.match(agent,/PUBLIC_B_EFFECT_SEPARATE_AUTH_REQUIRED/);
 assert.match(agent,/operationalWrites:0,effectAuthorized:false/);
});
