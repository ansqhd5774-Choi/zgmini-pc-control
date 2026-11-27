import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {nextRuntimeFiles} from '../tools/handoff-maintenance.mjs';
import {digestOrphanSevenInstalledRuntimeFiles,
 inspectOrphanInstalledSevenCasReadOnly}
 from '../tools/supervisor-orphan-six-installed-seven-cas-readonly.mjs';
import {ORPHAN_SIX_B_FIXED_EFFECT,ORPHAN_SIX_B_SCOPE}
 from '../tools/supervisor-orphan-six-b-admission.mjs';
import {parseOrphanSixBFlatRequest,inspectOrphanSixBMaintainerInletSource}
 from '../tools/supervisor-orphan-six-b-maintainer-inlet-source.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
const sha=x=>createHash('sha256').update(x).digest('hex');
function sample(){
 const body={
  schema:'ZGMINI_PC_ORPHAN_SIX_B_REQUEST_V1',
  requestId:'pc-12345678-1234-4234-9234-123456789abc',
  chatId:'chat-orphan-six-source-only',
  operation:'controller-orphan-six-graceful-once',
  controlRepository:REPO,targetControllerSha:'a'.repeat(40),
  approvalManifestSha256:'0'.repeat(64)
 };
 const manifest={
  schema:'ZGMINI_PC_ORPHAN_SIX_B_APPROVAL_V1',
  operation:body.operation,requestId:body.requestId,
  installedControllerSha:body.targetControllerSha,
  installedMaintainerSha:'b'.repeat(40),
  maintenanceFilesSha256:'c'.repeat(64),watchdogSourceSha256:'d'.repeat(64),
  oldOwnerRawSha256:'e'.repeat(64),heartbeatRawSha256:'f'.repeat(64),
  hostRawSha256:'a'.repeat(64),privateOriginalSixSeatDigestSha256:'b'.repeat(64),
  approval:{approved:true,grade:'B',scope:ORPHAN_SIX_B_SCOPE,
   ref:'https://github.com/'+REPO+'/pull/6200',
   reviewedSourceSha:'c'.repeat(40)},
  effect:{...ORPHAN_SIX_B_FIXED_EFFECT}
 };
 const raw=Buffer.from(JSON.stringify(manifest)+'\n');
 body.approvalManifestSha256=sha(raw);
 const issue={title:'pc-controller-orphan-six-graceful-once',
  state:'OPEN',number:6201,author:{login:OWNER},
  labels:[{name:'pc-maintenance'}],body:JSON.stringify(body)};
 const pr={number:6200,state:'closed',merged:true,
  merged_at:'2026-11-27T01:00:00Z',
  head:{sha:manifest.approval.reviewedSourceSha,repo:{full_name:REPO}},
  base:{repo:{full_name:REPO}}};
 const comment=(decision='APPROVE')=>({
  id:41000,user:{login:OWNER},
  created_at:'2026-11-27T01:01:00Z',
  updated_at:'2026-11-27T01:01:00Z',
  html_url:'https://github.com/'+REPO+'/issues/6201#issuecomment-41000',
  body:JSON.stringify({schema:'ZGMINI_ORPHAN_SIX_B_OWNER_DECISION_V1',
   decision,requestId:body.requestId,
   approvalManifestSha256:body.approvalManifestSha256,
   reviewedSourceSha:manifest.approval.reviewedSourceSha,
   scope:ORPHAN_SIX_B_SCOPE,operation:body.operation,
   effect:'SIX_ORPHAN_LISTENER_GRACEFUL_STOP_ONCE',
   installedControllerSha:body.targetControllerSha})
 });
 const calls=[];
 const p={
  attestCurrentMaintainerSource:async()=>{calls.push('source');return {
   origin:'PRIVATE_INDEPENDENT_B_MAINTAINER',
   verifiedNinePinnedMaintainerFiles:true,
   currentMaintainerSourceUnchangedVerified:true
  };},
  readOriginalOneUseClaim:async()=>{calls.push('claim');return null;},
  getMainManifest:async(rel,ref)=>{
   calls.push('manifest');assert.equal(ref,'main');
   assert.equal(rel,'approvals/controller-orphan-six/'+sha(raw)+'.json');
   return raw;
  },
  getPullRequest:async()=>{calls.push('pr');return pr;},
  getOwnerEffectComments:async()=>{calls.push('comments');return {
   source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',
   complete:true,issueNumber:6201,items:[comment()]
  };},
  getInstalledReadback:async()=>{calls.push('installed');return {
   origin:'PRIVATE_INDEPENDENT_B_MAINTAINER',
   currentInstallVerified:true,sourceFilesVerified:true,
   controllerBPolicyUnchangedVerified:true,
   installedControllerSha:manifest.installedControllerSha,
   installedMaintainerSha:manifest.installedMaintainerSha,
   maintenanceFilesSha256:manifest.maintenanceFilesSha256
  };}
 };
 return {body,issue,manifest,raw,pr,comment,p,calls};
}
test('flat request parser requires exactly seven distinct scalar fields',()=>{
 const f=sample();
 assert.deepEqual(parseOrphanSixBFlatRequest(f.issue.body),f.body);
 for(const raw of [
  f.issue.body.slice(0,-1)+',"requestId":"pc-ffffffff-ffff-ffff-ffff-ffffffffffff"}',
  f.issue.body.slice(0,-1)+',"operation":1}',
  f.issue.body.slice(0,-1)+',"extra":"x"}',
  f.issue.body.replace('"chat-orphan-six-source-only"','null'),
  f.issue.body.slice(0,-1)+',}',
  f.issue.body+'{}',
  '{"schema":{"nested":true}}',
  '[]',
  ''.padEnd(20000,'X')
 ])assert.throws(()=>parseOrphanSixBFlatRequest(raw));
});
test('verified canonical merged source and exact owner decision yield non-executable candidate',async()=>{
 const f=sample();
 const r=await inspectOrphanSixBMaintainerInletSource({issue:f.issue,...f.p});
 assert.equal(r.status,'CANDIDATE_ONLY');
 assert.equal(r.approvalSourceVerified,true);
 assert.equal(r.effectAuthorized,false);
 assert.equal(r.runnerStopAuthorized,false);
 assert.equal(r.executionStarted,false);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.automaticRetries,0);
 assert.deepEqual(f.calls.sort(),['source','claim','manifest','pr','comments','installed'].sort());
 assert.doesNotMatch(JSON.stringify(r),/Runner.Listener|oldOwnerRawSha256|birth|nonce/);
});
test('bot, missing source callbacks and installed source drift cannot be interpreted as B authority',async()=>{
 const bot=sample();bot.issue.author.login='github-actions[bot]';
 const denied=await inspectOrphanSixBMaintainerInletSource({issue:bot.issue,...bot.p});
 assert.equal(denied.code,'ORPHAN_SIX_B_UNTRUSTED_ISSUE');
 assert.equal(bot.calls.length,0);
 const missing=sample();
 assert.equal((await inspectOrphanSixBMaintainerInletSource({issue:missing.issue}))
  .code,'ORPHAN_SIX_B_SOURCE_READ_PORTS_MISSING');
 const drift=sample();
 drift.p.attestCurrentMaintainerSource=async()=>({
  origin:'PRIVATE_INDEPENDENT_B_MAINTAINER',verifiedNinePinnedMaintainerFiles:false,
  currentMaintainerSourceUnchangedVerified:true
 });
 const x=await inspectOrphanSixBMaintainerInletSource({issue:drift.issue,...drift.p});
 assert.equal(x.code,'ORPHAN_SIX_B_MAINTAINER_SOURCE_UNVERIFIED');
 assert.equal(drift.calls.length,0);
});
test('old journal claim forbids resubmission even when canonical B approval is valid',async()=>{
 const f=sample();
 f.p.readOriginalOneUseClaim=async()=>({phase:'STOP_INTENT_RECORDED'});
 const r=await inspectOrphanSixBMaintainerInletSource({issue:f.issue,...f.p});
 assert.equal(r.code,'ORPHAN_SIX_B_ORIGINAL_CLAIM_RECONCILE_FIRST');
 assert.equal(r.operationalWrites,0);
 assert.deepEqual(f.calls,['source']);
});
test('revoked explicit B effect, readback outage and duplicate raw ID fail closed',async()=>{
 const f=sample();
 f.p.getOwnerEffectComments=async()=>({
  source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',
  complete:true,issueNumber:6201,items:[f.comment('REVOKE')]
 });
 assert.equal((await inspectOrphanSixBMaintainerInletSource({issue:f.issue,...f.p})).status,'BLOCKED');
 const g=sample();g.p.readOriginalOneUseClaim=async()=>{throw Error('readoutage');};
 assert.equal((await inspectOrphanSixBMaintainerInletSource({issue:g.issue,...g.p})).status,'BLOCKED');
 const h=sample();h.issue.body=h.issue.body.slice(0,-1)+',"requestId":"pc-ffffffff-ffff-ffff-ffff-ffffffffffff"}';
 assert.equal((await inspectOrphanSixBMaintainerInletSource({issue:h.issue,...h.p}))
  .code,'ORPHAN_SIX_B_RAW_REQUEST_INVALID');
 assert.equal(h.calls.length,0);
});
test('future B inlet module is source-only: no built-in process or filesystem effects',()=>{
 const src=fs.readFileSync(new URL(
  '../tools/supervisor-orphan-six-b-maintainer-inlet-source.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/from ['"]node:(?:child_process|fs|net|http|https)['"]/);
 assert.doesNotMatch(src,/\b(?:execFile|spawnSync|taskkill|GenerateConsoleCtrlEvent)\s*\(/);
});

function temporarySevenFileMaintainer(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orphan-seven-cas-readonly-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'tools'),{recursive:true});
 const files={};
 for(const rel of nextRuntimeFiles){
  const bytes=Buffer.from('TEMP_ORPHAN_CAS_FIXTURE_'+rel+'\n','utf8');
  fs.writeFileSync(path.join(root,rel),bytes);
  files[rel]=sha(bytes);
 }
 const manifest={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha:'b'.repeat(40),startupSha256:'c'.repeat(64),files};
 const raw=Buffer.from(JSON.stringify(manifest)+'\n');
 fs.writeFileSync(path.join(root,'MAINTENANCE_INSTALL.json'),raw);
 const pins={
  root,expectedInstalledManifestRawSha256:sha(raw),
  expectedMaintainerSourceSha:manifest.sourceSha,
  expectedSevenRuntimeFilesSha256:digestOrphanSevenInstalledRuntimeFiles(files)
 };
 return {root,pins,files,manifest,raw};
}
test('read-only exact installed seven-file CAS verifies bytes but grants zero private Windows authority',t=>{
 const f=temporarySevenFileMaintainer(t);
 const got=inspectOrphanInstalledSevenCasReadOnly(f.pins);
 assert.equal(got.status,'CANDIDATE_ONLY');
 assert.equal(got.installedRuntimeVerified,true);
 assert.equal(got.installedMaintainerSha,f.manifest.sourceSha);
 assert.equal(got.installedManifestRawSha256,sha(f.raw));
 assert.equal(got.sevenRuntimeFilesSha256,f.pins.expectedSevenRuntimeFilesSha256);
 assert.notEqual(got.sevenRuntimeFilesSha256,got.installedManifestRawSha256);
 for(const flag of ['verifiedNinePinnedMaintainerFiles','receiverAncestryVerified',
  'controllerBPolicyUnchangedVerified','effectAuthorized','runnerStopAuthorized'])
  assert.equal(got[flag],false,flag);
 assert.equal(got.operationalWrites,0);
 assert.equal(got.origin,'SOURCE_ONLY_LOCAL_CAS_READ');
});
test('independent installed manifest raw SHA and seven-runtime tuple digest must BOTH agree',t=>{
 const f=temporarySevenFileMaintainer(t);
 let result=inspectOrphanInstalledSevenCasReadOnly({
  ...f.pins,expectedInstalledManifestRawSha256:'a'.repeat(64)});
 assert.equal(result.code,'ORPHAN_SIX_INSTALLED_MANIFEST_RAW_CAS_MISMATCH');
 result=inspectOrphanInstalledSevenCasReadOnly({
  ...f.pins,expectedSevenRuntimeFilesSha256:'a'.repeat(64)});
 assert.equal(result.code,'ORPHAN_SIX_INSTALLED_FILES_PIN_MISMATCH');
 result=inspectOrphanInstalledSevenCasReadOnly({
  ...f.pins,expectedMaintainerSourceSha:'a'.repeat(40)});
 assert.equal(result.code,'ORPHAN_SIX_INSTALLED_MAINTAINER_SHA_MISMATCH');
});
test('tampered installed runtime source is denied even if approval manifest has valid original bytes',t=>{
 const f=temporarySevenFileMaintainer(t);
 fs.appendFileSync(path.join(f.root,nextRuntimeFiles[2]),'UNAPPROVED_DRIFT\n');
 const result=inspectOrphanInstalledSevenCasReadOnly(f.pins);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'ORPHAN_SIX_INSTALLED_FILE_BYTES_MISMATCH');
 assert.equal(result.effectAuthorized,false);
 assert.equal(result.operationalWrites,0);
});
test('unknown or omitted seventh module cannot be accepted as six-file maintainer',t=>{
 const f=temporarySevenFileMaintainer(t);
 const six={...f.files};delete six[nextRuntimeFiles[6]];
 const extra={...f.files,'tools/unapproved.mjs':'f'.repeat(64)};
 for(const files of [six,extra]){
  assert.throws(()=>digestOrphanSevenInstalledRuntimeFiles(files),
   /ORPHAN_SIX_SEVEN_FILE_SET_INVALID/);
 }
 fs.rmSync(path.join(f.root,nextRuntimeFiles[6]));
 const result=inspectOrphanInstalledSevenCasReadOnly(f.pins);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'ORPHAN_SIX_INSTALLED_CAS_READBACK_UNKNOWN');
});
test('shared hard-linked file and opaque IO failures do not produce CAS attestation',t=>{
 const f=temporarySevenFileMaintainer(t);
 const file=path.join(f.root,nextRuntimeFiles[3]);
 fs.linkSync(file,path.join(f.root,'tools','other-hardlink.fixture'));
 const result=inspectOrphanInstalledSevenCasReadOnly(f.pins);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'ORPHAN_SIX_INSTALLED_CAS_READBACK_UNKNOWN');
 assert.equal(result.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(result),/other-hardlink|TEMP_ORPHAN_CAS_FIXTURE|\/tools\//);
});
test('seven-file read-only module has no OS signal, process kill or persistent write operation',()=>{
 const source=fs.readFileSync(new URL(
  '../tools/supervisor-orphan-six-installed-seven-cas-readonly.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/from ['"]node:(?:child_process|net|http|https)['"]/);
 assert.doesNotMatch(source,/\b(?:execFile|spawn|taskkill|writeFileSync|renameSync|unlinkSync)\s*\(/);
 assert.doesNotMatch(source,/PRIVATE_INDEPENDENT_B_MAINTAINER'.*origin/);
});

test('static inlet matches original sources and loads from exactly seven installed files',async t=>{
 const {pathToFileURL}=await import('node:url');
 const {render}=await import('../tools/build-orphan-six-static-inlet.mjs');
 const agent=fs.readFileSync(new URL('../tools/maintenance-agent.mjs',import.meta.url),'utf8');
 const start=agent.indexOf('// BEGIN GENERATED ORPHAN SIX SOURCE INLET');
 const end=agent.indexOf('// END GENERATED ORPHAN SIX SOURCE INLET');
 assert.ok(start>=0&&end>start);
 assert.equal(agent.slice(start,agent.indexOf('\n',end)+1),render());
 assert.throws(()=>render(name=>fs.readFileSync(new URL('../tools/'+name,import.meta.url),'utf8')+
  '\nimport {x} from "./unapproved.mjs";\n'),/ORPHAN_BUNDLE_IMPORT/);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-orphan-inlet-seven-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'tools'));
 for(const rel of nextRuntimeFiles)fs.copyFileSync(new URL('../'+rel,import.meta.url),path.join(root,rel));
 assert.equal(fs.readdirSync(path.join(root,'tools')).length,7);
 const packed=await import(pathToFileURL(path.join(root,'tools/maintenance-agent.mjs')).href);
 const a=sample(),b=sample();
 assert.deepEqual(packed.parseOrphanSixPackagedRequest(a.issue.body),a.body);
 assert.deepEqual(await packed.inspectOrphanSixPackagedInletSource({issue:a.issue,...a.p}),
  await inspectOrphanSixBMaintainerInletSource({issue:b.issue,...b.p}));
 for(const mutate of [
  x=>{x.issue.author.login='github-actions[bot]';},
  x=>{x.p.readOriginalOneUseClaim=async()=>({phase:'STOP_INTENT_RECORDED'});},
  x=>{x.p.getOwnerEffectComments=async()=>({source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',complete:true,issueNumber:6201,items:[x.comment('REVOKE')]});},
  x=>{x.issue.body=x.issue.body.slice(0,-1)+',"requestId":"duplicate"}';}
 ]){
  const x=sample(),y=sample();mutate(x);mutate(y);
  const out=await packed.inspectOrphanSixPackagedInletSource({issue:x.issue,...x.p});
  assert.deepEqual(out,await inspectOrphanSixBMaintainerInletSource({issue:y.issue,...y.p}));
  assert.equal(out.effectAuthorized,false);assert.equal(out.operationalWrites,0);
 }
});

test('packaged coordinator and journal match original module denial without OS or file effects',async t=>{
 const {pathToFileURL}=await import('node:url');
 const {runOrphanSixGracefulB}=await import('../tools/supervisor-orphan-six-graceful-b-coordinator.mjs');
 const {createOrphanSixMaintenanceJournal}=await import('../tools/supervisor-orphan-six-maintenance-journal.mjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-orphan-packaged-coordinator-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'tools'),{recursive:true});
 for(const rel of nextRuntimeFiles)
  fs.copyFileSync(new URL('../'+rel,import.meta.url),path.join(root,rel));
 assert.equal(fs.readdirSync(path.join(root,'tools')).length,7);
 const packed=await import(pathToFileURL(path.join(root,'tools/maintenance-agent.mjs')).href);
 assert.equal(typeof packed.runOrphanSixPackagedCoordinatorSource,'function');
 assert.equal(typeof packed.createOrphanSixPackagedJournalSource,'function');
 const requestId='pc-12345678-1234-4234-9234-123456789abc';
 const approvalManifestSha256='a'.repeat(64);
 const params={requestId,approvalManifestSha256};
 assert.deepEqual(await packed.runOrphanSixPackagedCoordinatorSource(params),
  await runOrphanSixGracefulB(params));
 assert.equal((await packed.runOrphanSixPackagedCoordinatorSource(params)).code,
  'ORPHAN_SIX_MAINTAINER_BINDINGS_MISSING');
 for(const attempt of [packed.createOrphanSixPackagedJournalSource,createOrphanSixMaintenanceJournal]){
  assert.throws(()=>attempt({root,requestId,approvalManifestSha256}),
   /ORPHAN_SIX_JOURNAL_CONTEXT_DENIED/);
 }
 assert.equal(fs.readdirSync(root).sort().join(','),'tools',
  'mere import or invalid B context cannot create any journal/lease/write');
});

test('packaged coordinator never replays a claimed B journal or triggers fake signal ports',async t=>{
 const {pathToFileURL}=await import('node:url');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-orphan-packaged-replay-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'tools'),{recursive:true});
 for(const rel of nextRuntimeFiles)
  fs.copyFileSync(new URL('../'+rel,import.meta.url),path.join(root,rel));
 const packed=await import(pathToFileURL(path.join(root,'tools/maintenance-agent.mjs')).href);
 let writes=0,signals=0,ownerReads=0;
 const journal={read:()=>({sha256:'b'.repeat(64)}),
  commit:()=>{writes++;throw Error('must not commit');}};
 const keys=['verifyExactApproval','verifyFreshOwnerEffectDecision',
  'readPrivateSnapshot','attestPreSignal','attestSeatExit',
  'sendPrivateGracefulSignal','verifyFinalOldSixAbsent',
  'releaseFenceForWatchdog','holdForRecovery'];
 const port=Object.fromEntries(keys.map(key=>[key,async()=>{
  if(key==='sendPrivateGracefulSignal')signals++;
  if(key==='verifyFreshOwnerEffectDecision')ownerReads++;
  throw Error('should not read after durable claim');
 }]));
 const result=await packed.runOrphanSixPackagedCoordinatorSource({
  requestId:'pc-12345678-1234-4234-9234-123456789abc',
  approvalManifestSha256:'a'.repeat(64),
  lease:{owner:{pid:process.pid,nonce:'12345678-1234-4234-9234-123456789abc'}},
  journal,port
 });
 assert.equal(result.status,'RECOVERY_REQUIRED');
 assert.equal(result.code,'ORPHAN_SIX_EXISTING_JOURNAL_RECONCILE_FIRST');
 assert.equal(result.attemptedSignalCount,0);
 assert.equal(signals,0);assert.equal(ownerReads,0);assert.equal(writes,0);
 assert.equal(fs.readdirSync(root).sort().join(','),'tools');
});
