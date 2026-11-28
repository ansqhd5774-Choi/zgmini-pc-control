import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePublicOwnerBExactScope} from '../tools/update.mjs';
import {classifyPublicBPreflight,verifyOperatorSourceClosure,withPublicBInstallLease,main} from '../tools/controller-s6-4069-public-b-operator-once.mjs';
const target='66b8a66c6112441576917e0ac9fbe4d39cbd5eea';
const installed='d3764580fdb08ecddd5f9b1064051eec30f90492';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const manifest=JSON.parse(fs.readFileSync(new URL('../approvals/controller-updates/'+target+'.json',import.meta.url),'utf8'));
const data={actor:'ansqhd5774-Choi',issue:{operation:'controller-update',controlRepository:repo,targetControllerSha:target},manifest};
test('S6 B exact scope preserves independent owner requirement and denies expanded effects',async()=>{
 assert.equal(validatePublicOwnerBExactScope(data),true);
 for(const mutate of [x=>x.actor='other',x=>x.issue.targetControllerSha=installed,x=>x.issue.operation='other',x=>x.manifest.installedSha='a'.repeat(40),x=>x.manifest.approval.ref='https://github.com/'+repo+'/pull/4302',x=>x.manifest.controllerOnlyInstall=false,x=>x.manifest.postOperation='runner-smoke',x=>x.manifest.selectiveSource.branch='codex/other',x=>x.manifest.allowFiles.push({path:'controller/entry.mjs',sha256:'a'.repeat(64)})]){
  const v=structuredClone(data);mutate(v);assert.throws(()=>validatePublicOwnerBExactScope(v),/PUBLIC_B_EFFECT_SCOPE_DENIED/);
 }
 const ready={owner:true,operator:true,source:true,manifest:true,installed:true,leaseFree:true,previousAttempt:false};
 assert.equal(classifyPublicBPreflight(ready),'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY');
 for(const k of Object.keys(ready))assert.notEqual(classifyPublicBPreflight({...ready,[k]:k==='previousAttempt'}),'PUBLIC_B_OPERATOR_PREFLIGHT_READY_ONLY');
 if(process.platform!=='win32'){await assert.rejects(main(['inspect']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);await assert.rejects(main(['apply']),/PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);}
 const rels=['tools/controller-s6-4069-public-b-operator-once.mjs','tools/update.mjs','tools/maintenance-contract.mjs','tools/maintenance-apply.mjs','tools/maintenance-lock.mjs','tools/source-bundle-register.mjs'];
 const bytes=Object.fromEntries(rels.map(p=>[p,fs.readFileSync(new URL('../'+p,import.meta.url))]));
 assert.equal(verifyOperatorSourceClosure(p=>bytes[p],p=>bytes[p]),true);
 assert.throws(()=>verifyOperatorSourceClosure(p=>p===rels[1]?Buffer.from('drift'):bytes[p],p=>bytes[p]),/PUBLIC_B_OPERATOR_SOURCE_CAS_FAILED/);
 const lock=()=>({releases:0,holds:0,release(){this.releases++;},holdForRecovery(){this.holds++;}});
 const ok=lock();await withPublicBInstallLease(ok,async()=>({status:'PASS',actualInstalledSha:target,postcheck:{protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:true}}));assert.deepEqual([ok.releases,ok.holds],[1,0]);
 const bad=lock();await withPublicBInstallLease(bad,async()=>({status:'STATE_UNKNOWN'}));assert.deepEqual([bad.releases,bad.holds],[0,1]);
});
