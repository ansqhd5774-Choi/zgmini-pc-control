import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {planSourceBundleRegistration,SOURCE_BUNDLE_SCHEMA,
  SOURCE_BUNDLE_APPROVAL_SCHEMA,SOURCE_BUNDLE_OPERATION,
  validateSourceBundleIssueEnvelope,validateSourceBundleBApproval,
  stageApprovedSourceBundle,applyPreparedSourceBundleHostCas}
  from '../tools/source-bundle-register.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const SOURCE_SHA='a'.repeat(40),INSTALLED_SHA='b'.repeat(40);
const sourceFiles=Object.freeze({
 'scripts/pc-writer/theme-platform.mjs':`import {reader} from './reader.mjs';\nimport {decode} from 'hyparquet';\nexport {reader,decode};\n`,
 'scripts/pc-writer/reader.mjs':'export const reader=1;\n',
 'node_modules/hyparquet/package.json':'{"name":"hyparquet","exports":"./src/index.js"}\n',
 'node_modules/hyparquet/src/index.js':'export const decode=()=>1;\n',
});
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-bundle-candidate-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const stageBundle=path.join(dir,'sealed');
 fs.mkdirSync(path.join(stageBundle,'source'),{recursive:true});
 for(const [rel,value] of Object.entries(sourceFiles)){
   const dest=path.join(stageBundle,'source',...rel.split('/'));
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,value,{flag:'wx'});
 }
 const manifest={schema:SOURCE_BUNDLE_SCHEMA,sourceRepository:'ansqhd5774-Choi/zgmini',
   sourceSha:SOURCE_SHA,sourceBranch:'codex/theme-fear-greed-integration-20261025',
   entrypoint:'scripts/pc-writer/theme-platform.mjs',
   files:Object.fromEntries(Object.entries(sourceFiles).map(([p,b])=>[p,hash(b)]))};
 const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(stageBundle,'manifest.json'),manifestBytes,{flag:'wx'});
 const host={schema:'ZGMINI_PC_HOST_V1',controllerSourceSha:INSTALLED_SHA,
   dataRoot:'E:/ZGmini/data',reserved:{preserve:'yes'},approvedSources:{['c'.repeat(40)]:{root:'old'}}};
 const hostBytes=Buffer.from(JSON.stringify(host,null,2)+'\n');
 const proposed=structuredClone(host);
 proposed.approvedSources[SOURCE_SHA]={root:stageBundle,branch:manifest.sourceBranch,
   entrypoint:manifest.entrypoint,manifestSha256:hash(manifestBytes)};
 const approval={schema:SOURCE_BUNDLE_APPROVAL_SCHEMA,operation:SOURCE_BUNDLE_OPERATION,
   scope:'HOST_APPROVED_SOURCES_SINGLE_CAS_ONLY',sourceRepository:manifest.sourceRepository,
   sourceSha:SOURCE_SHA,sourceBranch:manifest.sourceBranch,entrypoint:manifest.entrypoint,
   sourceManifestSha256:hash(manifestBytes),hostOriginalSha256:hash(hostBytes),
   hostProposedSha256:hash(Buffer.from(JSON.stringify(proposed,null,2)+'\n')),
   hostPath:path.join(dir,'host.json'),installedControllerSha:INSTALLED_SHA,stageBundle};
 return {dir,manifest,manifestBytes,host,hostBytes,approval,stageBundle};
}
const plan=f=>planSourceBundleRegistration(f);
const err=code=>e=>e.code===code;
function rewriteModuleAndPin(f,newCode){
 const rel='scripts/pc-writer/theme-platform.mjs';
 fs.writeFileSync(path.join(f.stageBundle,'source',rel),newCode);
 f.manifest.files[rel]=hash(newCode);
 const manifestBytes=Buffer.from(JSON.stringify(f.manifest,null,2)+'\n');
 fs.writeFileSync(path.join(f.stageBundle,'manifest.json'),manifestBytes);
 const proposed=structuredClone(f.host);
 proposed.approvedSources[SOURCE_SHA]={root:f.stageBundle,branch:f.manifest.sourceBranch,
   entrypoint:f.manifest.entrypoint,manifestSha256:hash(manifestBytes)};
 const approval={...f.approval,sourceManifestSha256:hash(manifestBytes),
   hostProposedSha256:hash(Buffer.from(JSON.stringify(proposed,null,2)+'\n'))};
 return {...f,manifestBytes,approval};
}

test('sealed bundle gets single approvedSources CAS, with existing keys untouched',t=>{
 const f=fixture(t),result=plan(f);
 assert.equal(result.fileCount,4);
 const next=JSON.parse(result.proposedHostBytes);
 assert.deepEqual(next.reserved,f.host.reserved);
 assert.deepEqual(next.approvedSources['c'.repeat(40)],f.host.approvedSources['c'.repeat(40)]);
 assert.equal(next.approvedSources[SOURCE_SHA].manifestSha256,hash(f.manifestBytes));
 assert.equal(fs.existsSync(f.approval.hostPath),false,'candidate cannot mutate host');
});
test('host CAS mismatch refused',t=>{
 const f=fixture(t);
 const mutated=Buffer.from(f.hostBytes.toString().replace('yes','no'));
 assert.throws(()=>plan({...f,hostBytes:mutated}),err('BUNDLE_APPROVAL_OR_HOST_CAS_MISMATCH'));
});
test('unlisted staged file refused',t=>{
 const f=fixture(t);
 fs.writeFileSync(path.join(f.stageBundle,'source','unlisted.js'),'x');
 assert.throws(()=>plan(f),err('BUNDLE_INVENTORY_NOT_CLOSED'));
});
test('modified node_modules decoder refused',t=>{
 const f=fixture(t);
 fs.writeFileSync(path.join(f.stageBundle,'source/node_modules/hyparquet/src/index.js'),'evil');
 assert.throws(()=>plan(f),err('BUNDLE_SOURCE_BYTES_DRIFT'));
});
test('missing package import refused',t=>{
 const f=fixture(t);
 const file=path.join(f.stageBundle,'source/scripts/pc-writer/theme-platform.mjs');
 const next=fs.readFileSync(file,'utf8').replace('hyparquet','not-bundled');
 assert.throws(()=>plan(rewriteModuleAndPin(f,next)),err('BUNDLE_PACKAGE_IMPORT_UNCLOSED'));
});
test('side-effect import ../escape is rejected from exact-approved source bytes',t=>{
 const f=fixture(t);
 assert.throws(()=>plan(rewriteModuleAndPin(f,"import '../../../../outside.mjs';\n")),
   err('BUNDLE_UNSAFE_PATH'));
});
test('side-effect relative import missing from bundle inventory is rejected',t=>{
 const f=fixture(t);
 assert.throws(()=>plan(rewriteModuleAndPin(f,"import './unlisted.mjs';\n")),
   err('BUNDLE_RELATIVE_IMPORT_UNCLOSED'));
});
test('JSDoc typedef and commented examples are not executable imports',t=>{
 const f=fixture(t);
 const code=`/**
  * @typedef {import('../src/types.d.ts').Awaitable<T>} Awaitable<T>
  * Example: import { ParquetReadOptions } from 'hyparquet'
  */
  // import './unlisted.mjs';
  const note = "import './not-module.mjs'";
  const url = 'https://example.test/data';
  import {reader} from './reader.mjs';
  import {decode} from 'hyparquet';
  export {reader,decode};
  `;
 assert.equal(plan(rewriteModuleAndPin(f,code)).fileCount,4);
});
test('executable import inside template expression still rejects missing module',t=>{
 const f=fixture(t);
 assert.throws(()=>plan(rewriteModuleAndPin(f,
  'const x = `literal ${import("./unlisted.mjs")}`;\n')),
  err('BUNDLE_RELATIVE_IMPORT_UNCLOSED'));
});
test('manifest source mismatch refused',t=>{
 const f=fixture(t);
 f.approval.sourceSha='d'.repeat(40);
 assert.throws(()=>plan(f),err('BUNDLE_MANIFEST_CONTRACT'));
});
test('approved bundle already present cannot overwrite old registration',t=>{
 const f=fixture(t);
 const copied=structuredClone(f.host);
 copied.approvedSources[SOURCE_SHA]={root:'existing'};
 const hostBytes=Buffer.from(JSON.stringify(copied,null,2)+'\n');
 f.approval.hostOriginalSha256=hash(hostBytes);
 assert.throws(()=>plan({...f,hostBytes}),err('BUNDLE_HOST_PRECONDITION'));
});
test('staged directory symlink is refused',t=>{
 const f=fixture(t);
 const target=path.join(f.stageBundle,'source','node_modules');
 const alias=path.join(f.stageBundle,'source','package-alias');
 fs.symlinkSync(target,alias,'dir');
 assert.throws(()=>plan(f),err('BUNDLE_SYMLINK_FORBIDDEN'));
});
test('manifest entries cannot escape source root',t=>{
 const f=fixture(t);
 f.manifest.files['../outside.js']=hash('x');
 const nextBytes=Buffer.from(JSON.stringify(f.manifest,null,2)+'\n');
 const nextApproval={...f.approval,sourceManifestSha256:hash(nextBytes)};
 assert.throws(()=>plan({...f,manifestBytes:nextBytes,approval:nextApproval}),
  err('BUNDLE_UNSAFE_PATH'));
});
test('Issue + B approval pin exact bytes and restrict host/staging paths',()=>{
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
   requestId:'pc-12345678-1234-4123-8123-123456789abc',
   chatId:'chat-12345678-1234-4123-8123-123456789abc',
   operation:SOURCE_BUNDLE_OPERATION,
   controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
   targetControllerSha:INSTALLED_SHA};
 const manifest={schema:SOURCE_BUNDLE_APPROVAL_SCHEMA,
   operation:SOURCE_BUNDLE_OPERATION,scope:'HOST_APPROVED_SOURCES_SINGLE_CAS_ONLY',
   sourceRepository:'ansqhd5774-Choi/zgmini',
   sourceBranch:'codex/theme-fear-greed-integration-20261025',sourceSha:SOURCE_SHA,
   sourceManifestPath:`approvals/source-bundles/manifests/${SOURCE_SHA}.json`,
   sourceManifestSha256:'d'.repeat(64),
   entrypoint:'scripts/pc-writer/theme-platform.mjs',installedControllerSha:INSTALLED_SHA,
   hostPath:'E:/ZGmini/automation/pc-control/host.json',
   hostOriginalSha256:'a'.repeat(64),hostProposedSha256:'b'.repeat(64),
   stageBundle:`E:/ZGmini/automation/pc-control/source-bundles/source-${SOURCE_SHA}`,
   backupDirectory:`E:/ZGmini/automation/pc-control/backups/source-${request.requestId}`,
   approval:{grade:'B',scope:'HOST_APPROVED_SOURCES_SINGLE_CAS_ONLY',
     ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/552'},
   backup:{strategy:'VERSIONED_SNAPSHOT',rollback:'RESTORE_HOST_SHA256',
     originalSha256:'a'.repeat(64)}};
 const bytes=Buffer.from(JSON.stringify(manifest));request.approvalManifestSha256=hash(bytes);
 assert.deepEqual(validateSourceBundleIssueEnvelope(request,{actor:'ansqhd5774-Choi'}),request);
 assert.equal(validateSourceBundleBApproval(request,bytes,{actor:'ansqhd5774-Choi',
   installedSha:INSTALLED_SHA}).sourceSha,SOURCE_SHA);
 assert.throws(()=>validateSourceBundleBApproval(request,Buffer.concat([bytes,Buffer.from(' ')]),
   {actor:'ansqhd5774-Choi',installedSha:INSTALLED_SHA}),err('BUNDLE_B_APPROVAL_BYTES_DRIFT'));
 const invalid={...manifest,hostPath:'C:/temp/host.json'};
 const invalidBytes=Buffer.from(JSON.stringify(invalid));
 assert.throws(()=>validateSourceBundleBApproval({...request,
   approvalManifestSha256:hash(invalidBytes)},invalidBytes,
   {actor:'ansqhd5774-Choi',installedSha:INSTALLED_SHA}),err('BUNDLE_B_APPROVAL_PATH_SCOPE'));
});
test('staging is inert, exact and preserves an existing bundle without overwrite',t=>{
 const f=fixture(t);
 const target=path.join(f.dir,'new-bundle');
 const staged=stageApprovedSourceBundle({manifestBytes:f.manifestBytes,
   sourceFiles:Object.fromEntries(Object.entries(sourceFiles).map(([k,v])=>[k,Buffer.from(v)])),
   stageBundle:target});
 assert.equal(staged.fileCount,4);
 assert.equal(fs.readFileSync(path.join(target,'manifest.json')).equals(f.manifestBytes),true);
 const same=stageApprovedSourceBundle({manifestBytes:f.manifestBytes,
   sourceFiles:Object.fromEntries(Object.entries(sourceFiles).map(([k,v])=>[k,Buffer.from(v)])),
   stageBundle:target});
 assert.equal(same.reused,true,'exact already staged bytes can be reused without overwrite');
});

function simulateHostApply(t,verified){
 const f=fixture(t),hostPath=path.join(f.dir,'host.json');
 fs.writeFileSync(hostPath,f.hostBytes,{flag:'wx'});
 const proposed=plan(f),originalPlatform=Object.getOwnPropertyDescriptor(process,'platform');
 Object.defineProperty(process,'platform',{value:'win32',configurable:true});
 t.after(()=>Object.defineProperty(process,'platform',originalPlatform));
 return {f,hostPath,proposed,backupDirectory:path.join(f.dir,'snapshot'),
  run:()=>applyPreparedSourceBundleHostCas({plan:proposed,hostPath,
   backupDirectory:path.join(f.dir,'snapshot'),verifyAuthorizedLease:verified})};
}
test('B host CAS applies only one new source key with exact backup and readback',t=>{
 const s=simulateHostApply(t,()=>{}),result=s.run();
 assert.equal(result.status,'APPLIED');
 assert.equal(hash(fs.readFileSync(s.hostPath)),s.proposed.hostProposedSha256);
 assert.equal(fs.readFileSync(path.join(s.backupDirectory,'HOST_BEFORE.bytes')).equals(s.f.hostBytes),true);
 assert.equal(fs.existsSync(path.join(s.backupDirectory,'APPLIED.json')),true);
});
test('post-swap probe failure with retained lease rolls back, preserving original host',t=>{
 let checks=0;
 const s=simulateHostApply(t,()=>{
   if(++checks===3)throw Object.assign(new Error('SIMULATED_POST_SWAP_FAILURE'),
     {code:'SIMULATED_POST_SWAP_FAILURE'});
 });
 const result=s.run();
 assert.equal(result.status,'ROLLED_BACK');
 assert.equal(hash(fs.readFileSync(s.hostPath)),s.proposed.hostOriginalSha256);
 assert.equal(fs.existsSync(path.join(s.backupDirectory,'ROLLED_BACK.json')),true);
});
test('lease lost after host swap MUST hold recovery; no unowned rollback',t=>{
 let checks=0;
 const s=simulateHostApply(t,()=>{
   if(++checks>=3)throw Object.assign(new Error('SIMULATED_LEASE_LOST'),
     {code:'SIMULATED_LEASE_LOST'});
 });
 const result=s.run();
 assert.equal(result.status,'RECOVERY_REQUIRED');
 assert.equal(hash(fs.readFileSync(s.hostPath)),s.proposed.hostProposedSha256);
 assert.equal(fs.existsSync(path.join(s.backupDirectory,'ROLLED_BACK.json')),false);
});
