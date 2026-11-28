import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateControllerImportClosure,controllerImportScanRoots,validateControllerOnlyInstallDelta,validateControllerConfigTransition,deployableControllerTreePaths,manifestFingerprint} from '../tools/maintenance-contract.mjs';
const candidate=JSON.parse(fs.readFileSync(new URL('../drafts/controller-s6-4069-selective-20261128.json',import.meta.url),'utf8'));
const git=(...args)=>execFileSync('git',args,{windowsHide:true,timeout:30000,maxBuffer:4000000});
const text=(...args)=>git(...args).toString('utf8').trim();
const bytes=(ref,rel)=>git('show',ref+':'+rel);
const hash=b=>createHash('sha256').update(b).digest('hex');
test('S6 #4069 exact selective candidate preserves installed parent and three-file scope',()=>{
 const {installedSha:old,targetSha:next,sourceMainSha:main,allowFiles,preimageFiles}=candidate;
 assert.equal(candidate.approved,false);
 assert.equal(candidate.publicBEffectAuthorized,false);
 assert.equal(candidate.operatingInstallationVerified,false);
 assert.equal(text('rev-parse','refs/remotes/origin/'+candidate.targetBranch),next);
 assert.equal(text('rev-list','--parents','-n','1',next),next+' '+old);
 assert.deepEqual(text('diff','--name-status','--no-renames',old,next,'--').split(/\r?\n/).sort(),[
  'A\tcontroller/s6-journal-readonly.mjs','M\tconfig/operations.json','M\tcontroller/operations.mjs'].sort());
 for(const p of allowFiles)assert.equal(hash(bytes(next,p.path)),p.sha256,p.path);
 for(const p of preimageFiles)assert.equal(hash(bytes(old,p.path)),p.sha256,p.path);
 assert.deepEqual(bytes(next,'controller/s6-journal-readonly.mjs'),bytes(main,'controller/s6-journal-readonly.mjs'));
 const previous=JSON.parse(bytes(old,'config/operations.json')),proposed=JSON.parse(bytes(next,'config/operations.json'));
 assert.equal(validateControllerConfigTransition(previous,proposed),true);
 assert.deepEqual(proposed.operations['controller-s6-4069-journal-readonly'],{grade:'A',resource:'light',timeoutSeconds:60});
 delete proposed.operations['controller-s6-4069-journal-readonly'];assert.deepEqual(proposed,previous);
 const anchor=" if(request.operation==='controller-operating-audit-readonly')return inspectControllerOperatingAuditReadonly();";
 const importLine="import {inspectS64069ReconciliationReadonly} from './s6-journal-readonly.mjs';\n";
 const handler="\n if(request.operation==='controller-s6-4069-journal-readonly')return inspectS64069ReconciliationReadonly();";
 assert.equal(bytes(next,'controller/operations.mjs').toString('utf8'),importLine+bytes(old,'controller/operations.mjs').toString('utf8').replace(anchor,anchor+handler));
 const paths=allowFiles.map(p=>p.path);
 assert.equal(validateControllerOnlyInstallDelta(paths,allowFiles),true);
 const deployed=deployableControllerTreePaths(text('ls-tree','-r','--name-only',next,'--','controller','config').split(/\r?\n/));
 assert.equal(validateControllerImportClosure(deployed,controllerImportScanRoots(paths),p=>bytes(next,p).toString('utf8')).status,'VERIFIED');
 for(const p of paths.filter(p=>p.endsWith('.mjs'))){
  const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:bytes(next,p),encoding:'utf8',timeout:10000});
  assert.equal(check.status,0,check.stderr);
 }
 assert.match(manifestFingerprint(allowFiles).sha256,/^[a-f0-9]{64}$/);
});
