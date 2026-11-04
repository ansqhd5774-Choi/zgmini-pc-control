import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateR54BIssueEnvelope,validateR54BManifestRequest,
 R54_B_OPERATION,R54_B_SOURCE_FILES,R54_B_MANIFEST_SCOPE,R54_B_TASK_EXCEPTION} from '../tools/maintenance-contract.mjs';
import {command,r54BStartFreezeReady} from '../tools/update.mjs';

const directory=path.dirname(fileURLToPath(import.meta.url));
const toolsDir=path.resolve(directory,'../tools');
const hash=x=>createHash('sha256').update(x).digest('hex');
const sha='a'.repeat(40),requestId='pc-50d9c90d-2cf0-4804-b4db-9e82746ee01d';
const bytes=()=>Buffer.from(JSON.stringify({
 schema:'ZGMINI_R54_SIXFILE_B_ONE_TIME_TASK_HOLD_V2',status:'APPROVED_B',
 scope:R54_B_MANIFEST_SCOPE,runCount:1,
 noProviderCalls:true,noD1Writes:true,noControllerChanges:true,
 files:R54_B_SOURCE_FILES,taskStateException:R54_B_TASK_EXCEPTION}));
const issue=()=>({schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId,
 chatId:'chat-5de45612-d991-4d07-bad4-7ab77b1b2979',
 operation:R54_B_OPERATION,controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
 targetControllerSha:sha,approvalManifestSha256:hash(bytes())});
const trusted={actor:'ansqhd5774-Choi'};

test('installed six-file host imports only existing six files; no draft runtime dependency',()=>{
 const installed=new Set(['maintenance-agent.mjs','maintenance-contract.mjs',
  'maintenance-apply.mjs','maintenance-lock.mjs','update.mjs',
  'maintenance-ancestry.vbs']);
 for(const rel of ['maintenance-agent.mjs','maintenance-contract.mjs',
  'update.mjs','maintenance-apply.mjs']){
  const source=fs.readFileSync(path.join(toolsDir,rel),'utf8');
  for(const found of source.matchAll(/\bfrom\s+['"]\.\/([^'"/]+)['"]/g)){
   assert.ok(installed.has(found[1]),`unexpected installed module ${rel}: ${found[1]}`);
  }
 }
});

test('inline B contract validates exact six files and blocks controller/manifest drift',()=>{
 const req=issue();
 assert.equal(validateR54BIssueEnvelope(req,trusted).operation,R54_B_OPERATION);
 const out=validateR54BManifestRequest(req,bytes(),{...trusted,installedSha:sha});
 assert.equal(out.manifest.files.length,6);
 assert.throws(()=>validateR54BManifestRequest(req,bytes(),{
  ...trusted,installedSha:'b'.repeat(40)}),/R54_B_INSTALLED_CONTROLLER_DRIFT/);
 const extra=Buffer.from(JSON.stringify({...JSON.parse(bytes()),
  files:[...R54_B_SOURCE_FILES,{path:'etc/wrong',old:'0'.repeat(64),next:'1'.repeat(64)}]}));
 assert.throws(()=>validateR54BManifestRequest({
  ...req,approvalManifestSha256:hash(extra)},extra,{...trusted,installedSha:sha}),
 /R54_B_MANIFEST_SCOPE_DENIED/);
 const withUnknown=Buffer.from(JSON.stringify({...JSON.parse(bytes()),command:'run-anything'}));
 assert.throws(()=>validateR54BManifestRequest({
  ...req,approvalManifestSha256:hash(withUnknown)},withUnknown,{...trusted,installedSha:sha}),
  /R54_B_MANIFEST_FIELDS_DENIED/);
 const widened=Buffer.from(JSON.stringify({...JSON.parse(bytes()),
  taskStateException:{...R54_B_TASK_EXCEPTION,noOtherTaskChanges:false}}));
 assert.throws(()=>validateR54BManifestRequest({
  ...req,approvalManifestSha256:hash(widened)},widened,{...trusted,installedSha:sha}),
  /R54_B_MANIFEST_SCOPE_DENIED/);
});

test('R54 B apply rejects arbitrary package file before reading PC state or swapping',async()=>{
 await assert.rejects(()=>command(['r54-b-apply','--request-id',requestId,
  '--manifest-file','/tmp/untrusted-r54-package.json']),/R54_B_APPROVAL_FILE_PATH/);
});

test('inlined start-freeze gate checks actual collision window, not other Tasks',()=>{
 const proof={
  authorization:{grade:'B',scope:'ONE_TIME_R54_TASK_PAUSE_RESTORE_B',
   taskName:'ZGMINI-PC-Theme-Nine-R54-Public',singleUse:true,
   preserveTaskDefinition:true,allowForceTermination:false,
   allowOtherTaskChanges:false},
  baseline:{name:'ZGMINI-PC-Theme-Nine-R54-Public',
   actionPath:'E:/ZGmini/data/pc-writer/theme-nine-r54/scripts/pc-writer/THEME_NINE_R54_PUBLIC_CYCLE.cmd',
   actionSha256:'0dea186a956dbc1471a4063e8c64dd5a230549477860e699bbb450a06d4360f4',
   enabled:false,definitionDigest:'9'.repeat(64),durableXmlBackupReadback:true},
  closedRoutes:{taskName:'ZGMINI-PC-Theme-Nine-R54-Public',
   schedulerStartDisabled:true,taskNotRunning:true,childProcessCount:0,
   conflictingSourceLaunches:0,installWindowExclusivityVerified:true,
   unrelatedTaskCount:20,relevantLocksClear:true,exclusiveBLeaseHeld:true},
  sourceRows:R54_B_SOURCE_FILES.map(x=>({path:x.path,actual:x.old})),
  observedAt:new Date().toISOString()};
 assert.equal(r54BStartFreezeReady(null),false);
 assert.equal(r54BStartFreezeReady(proof),true);
 assert.equal(r54BStartFreezeReady({...proof,
  closedRoutes:{...proof.closedRoutes,installWindowExclusivityVerified:false}}),false);
 assert.equal(r54BStartFreezeReady({...proof,
  closedRoutes:{...proof.closedRoutes,conflictingSourceLaunches:1}}),false);
 assert.equal(r54BStartFreezeReady({...proof,
  closedRoutes:{...proof.closedRoutes,childProcessCount:1}}),false);
 assert.equal(r54BStartFreezeReady({...proof,
  sourceRows:proof.sourceRows.slice(0,5)}),false);
 assert.equal(r54BStartFreezeReady({...proof,observedAt:'2026-01-01T00:00:00Z'}),false);
});
