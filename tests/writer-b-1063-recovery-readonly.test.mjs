import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inspectWriterB1063Recovery,WRITER_B_1063_REQUEST_ID} from
 '../controller/writer-b-1063-recovery-readonly.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const SHA40='434f30d2aa221bddacab5afa09241916618d8e22';
const BASE='825cfbd6e2025940e3e48631e7ff1dddf582e75a';
const CANDIDATE='b1541453df0a92af748eb8e191c96bb3ef1e6071';
const MANIFEST='984ee506c54c1c97de31d5af4d0369cc2e8c0b5557334146748628110be709f7';
const MODULE='lib/market-score/employment-r6-collector.mjs';
const BEFORE='5be5155196c8539639f6bb5228d5af145646e0aff7f7c92a86ba3341d83efc39';
const AFTER='f22b2f1447e462d3101caf027323572606db61352ab6a53524dd406cca7a4915';
const hash=b=>createHash('sha256').update(b).digest('hex');
const originalModule=Buffer.from('FIXTURE_APPROVED_MODULE_BACKUP');
const afterModule=Buffer.from('FIXTURE_APPROVED_AFTER_MODULE');
const testDigest=b=>Buffer.from(b).equals(originalModule)?BEFORE:
 Buffer.from(b).equals(afterModule)?AFTER:hash(b);
const write=(p,bytes)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);};
const validJournal=[
 {status:'CLAIMED',at:'2026-11-09T11:00:00.000Z'},
 {phase:'CLAIMED',at:'2026-11-09T11:00:01.000Z'},
 {phase:'BACKED_UP',at:'2026-11-09T11:00:02.000Z'},
 {phase:'STAGED',at:'2026-11-09T11:00:03.000Z'},
 {phase:'TASK_PAUSED',at:'2026-11-09T11:00:04.000Z'},
 {phase:'SOURCE_SWITCHED',at:'2026-11-09T11:00:05.000Z'},
 {phase:'CONFIG_SWITCHED',at:'2026-11-09T11:00:06.000Z'},
 {phase:'RECOVERY_REQUIRED',at:'2026-11-09T11:00:07.000Z'},
].map(x=>JSON.stringify(x)).join('\n')+'\n';

function fixture(t){
 const base=fs.mkdtempSync(path.join(HERE,'fixture-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const paths={
  journalDir:path.join(base,'data','pc-writer','writer-b-install-once',WRITER_B_1063_REQUEST_ID),
  lockPath:path.join(base,'data','pc-writer','writer-source-install.lock'),
  coreCycleLockPath:path.join(base,'data','pc-writer','local-cycle.lock'),
  configPath:path.join(base,'data','pc-writer','config.json'),
  sourceRoot:path.join(base,'projects','zgmini-earnings-history-pc-release'),
 };
 fs.mkdirSync(paths.journalDir,{recursive:true});
 fs.mkdirSync(paths.sourceRoot,{recursive:true});
 const journal=p=>path.join(paths.journalDir,p);
 const originalConfig=Buffer.from(JSON.stringify({source:BASE,password:'PRIVATE_ORIGINAL_SECRET'}));
 const originalTask=Buffer.from('<Task><Settings><Enabled>true</Enabled></Settings></Task>');
 const preimage={
  head:BASE,branch:'main',originalConfigSha256:hash(originalConfig),
  originalTaskDefinitionSha256:hash(originalTask),
  beforeSha256:{[MODULE]:BEFORE},protectedSha256:{},
 };
 const provenance={
  schema:'ZGMINI_PC_WRITER_B_LOCAL_OVERLAY_PROVENANCE_V1',
  mode:'LOCAL_OVERLAY',localOnly:true,requestId:WRITER_B_1063_REQUEST_ID,
  manifestSha:MANIFEST,baseHead:BASE,baseTreeOid:'1'.repeat(40),
  candidateSourceSha:CANDIDATE,preparedLocalSha:SHA40,
  preparedTreeOid:'2'.repeat(40),
  localRef:`refs/heads/writer-b/${WRITER_B_1063_REQUEST_ID}`,
  changedPaths:[MODULE],fileHashes:[{path:MODULE,change:'M',
   beforeSha256:BEFORE,afterSha256:AFTER}],
 };
 write(journal('journal.jsonl'),validJournal);
 write(journal('preimage.json'),JSON.stringify(preimage));
 write(journal('config.original.bin'),originalConfig);
 write(journal('task.original.xml'),originalTask);
 write(journal('lib__market-score__employment-r6-collector.mjs.original.bin'),originalModule);
 write(journal('provenance.json'),JSON.stringify(provenance)+'\n');
 write(paths.lockPath,WRITER_B_1063_REQUEST_ID);
 write(paths.configPath,JSON.stringify({source:SHA40,token:'DO_NOT_RETURN'}));
 write(path.join(paths.sourceRoot,...MODULE.split('/')),afterModule);
 const context={platform:'win32',paths,digest:testDigest,
  git:(_root,args)=>args.at(-1)==='HEAD'?SHA40:`writer-b/${WRITER_B_1063_REQUEST_ID}`,
  taskXml:()=>Buffer.from('<Task><Settings><Enabled>false</Enabled></Settings></Task>'),
  taskProbe:()=>({enabled:false,state:1,instances:0,
   relatedProcesses:0,unknownProcessLines:0})};
 const run=(override={})=>inspectWriterB1063Recovery({...context,...override});
 return {base,paths,journal,preimage,provenance,context,run};
}
function digestFixture(root){
 const rows=[];
 function walk(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
   const p=path.join(dir,e.name);
   if(e.isDirectory())walk(p);
   else if(e.isSymbolicLink())rows.push([path.relative(root,p),'SYMLINK:'+fs.readlinkSync(p)]);
   else rows.push([path.relative(root,p),hash(fs.readFileSync(p))]);
  }
 }
 walk(root);return JSON.stringify(rows.sort((a,b)=>a[0].localeCompare(b[0])));
}

test('fixed incident snapshot: authentic provenance, prepared pair, disabled Core, no recovery authorization',t=>{
 const f=fixture(t),before=digestFixture(f.base);
 const result=f.run();
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'WRITER_B_1063_RECOVERY_EVIDENCE_READONLY');
 assert.equal(result.requestId,WRITER_B_1063_REQUEST_ID);
 assert.equal(result.journal.lastPhase,'RECOVERY_REQUIRED');
 assert.equal(result.journal.entryCount,8);
 assert.equal(result.backups.moduleSha256,BEFORE);
 assert.equal(result.backups.matchPreimage,true);
 assert.equal(result.provenance.preparedLocalSha,SHA40);
 assert.equal(result.lock.matchesRequest,true);
 assert.equal(result.source.sourcePair,'INCIDENT_PREPARED_PAIR');
 assert.equal(result.source.module.state,'AFTER');
 assert.equal(result.source.module.sha256,AFTER);
 assert.equal(result.source.trackedDirty,'NOT_VERIFIED');
 assert.equal(result.coreTask.enabled,false);
 assert.equal(result.coreTask.state,1);
 assert.equal(result.coreTask.coreQuietSnapshot,true);
 assert.equal(result.coreTask.resumeAuthorized,false);
 assert.equal(result.coreTask.xmlMatchesOriginal,false);
 assert.equal(result.coreTask.definitionMatchesOriginalExceptEnabled,true);
 assert.equal(result.recoveryStatus,'RECOVERY_REQUIRED');
 assert.equal(result.recoveryAuthorized,false);
 assert.equal(result.runtimeSourceVerified,false);
 assert.equal(result.operationalWrites,0);
 assert.equal(digestFixture(f.base),before);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_ORIGINAL_SECRET|DO_NOT_RETURN/);
});

test('Core Task activation toggle is benign but unrelated XML drift is reported',t=>{
 const f=fixture(t);
 const toggle=f.run();
 assert.equal(toggle.coreTask.xmlMatchesOriginal,false);
 assert.equal(toggle.coreTask.definitionMatchesOriginalExceptEnabled,true);
 const drift=f.run({taskXml:()=>Buffer.from(
  '<Task><Settings><Enabled>false</Enabled></Settings><Actions><Exec/></Actions></Task>')});
 assert.equal(drift.status,'PASS');
 assert.equal(drift.coreTask.definitionMatchesOriginalExceptEnabled,false);
 assert.equal(drift.coreTask.resumeAuthorized,false);
 const utf16=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(
  '<Task><Settings><Enabled>false</Enabled></Settings></Task>','utf16le')]);
 const encoded=f.run({taskXml:()=>utf16});
 assert.equal(encoded.status,'PASS');
 assert.equal(encoded.coreTask.definitionMatchesOriginalExceptEnabled,true);
 const malformed=f.run({taskXml:()=>Buffer.from('<Task><Enabled>false</Enabled></Task>')});
 assert.equal(malformed.status,'STATE_UNKNOWN');
});

test('missing, oversized or partial journal fails closed',t=>{
 const f=fixture(t);
 for(const data of [null,Buffer.alloc(8200,'X'),'{"status":"CLAIMED"']){
  if(data===null)fs.unlinkSync(f.journal('journal.jsonl'));
  else write(f.journal('journal.jsonl'),data);
  assert.equal(f.run().status,'STATE_UNKNOWN');
 }
});

test('backups and preimage missing, too large, or mismatched fail closed',t=>{
 const f=fixture(t);
 const p=f.journal('config.original.bin');
 fs.writeFileSync(p,'wrong-original');
 assert.equal(f.run().code,'WRITER_B_1063_BACKUP_HASH_MISMATCH');
 fs.unlinkSync(p);
 assert.equal(f.run().status,'STATE_UNKNOWN');
 write(p,Buffer.alloc(65537,'x'));
 assert.equal(f.run().status,'STATE_UNKNOWN');
});

test('hostile preimage path and wrong pinned module digest fail closed',t=>{
 const f=fixture(t);
 f.preimage.beforeSha256['../../credentials.env']='1'.repeat(64);
 write(f.journal('preimage.json'),JSON.stringify(f.preimage));
 assert.equal(f.run().code,'WRITER_B_1063_PREIMAGE_SCOPE_DRIFT');
 delete f.preimage.beforeSha256['../../credentials.env'];
 write(f.journal('preimage.json'),JSON.stringify(f.preimage));
 assert.equal(f.run({digest:hash}).code,'WRITER_B_1063_BACKUP_HASH_MISMATCH');
});

test('symlink replacement of fixed backup and parent junction escape fail closed',t=>{
 const f=fixture(t);
 const module=f.journal('lib__market-score__employment-r6-collector.mjs.original.bin');
 const sibling=path.join(f.base,'outside-secret');
 write(sibling,'SECRET_NOT_READ');
 fs.unlinkSync(module);
 fs.symlinkSync(sibling,module);
 assert.equal(f.run().status,'STATE_UNKNOWN');
 assert.doesNotMatch(JSON.stringify(f.run()),/SECRET_NOT_READ/);
 const other=fixture(t);
 const moved=other.paths.journalDir;
 const target=path.join(other.base,'untrusted');
 fs.renameSync(moved,target);
 fs.symlinkSync(target,moved,'dir');
 assert.equal(other.run().status,'STATE_UNKNOWN');
});

test('live M file BEFORE/AFTER/OTHER observation never proves recovery',t=>{
 const f=fixture(t);
 const live=path.join(f.paths.sourceRoot,...MODULE.split('/'));
 assert.equal(f.run().source.module.state,'AFTER');
 write(live,originalModule);
 const before=f.run();
 assert.equal(before.status,'PASS');
 assert.equal(before.source.module.state,'BEFORE');
 assert.equal(before.recoveryAuthorized,false);
 write(live,'unexpected-drift');
 const other=f.run();
 assert.equal(other.status,'PASS');
 assert.equal(other.source.module.state,'OTHER');
 assert.equal(other.recoveryStatus,'RECOVERY_REQUIRED');
});

test('live M file absent, oversized or symlinked fails closed',t=>{
 const f=fixture(t);
 const live=path.join(f.paths.sourceRoot,...MODULE.split('/'));
 fs.unlinkSync(live);
 assert.equal(f.run().status,'STATE_UNKNOWN');
 write(live,Buffer.alloc(2097153,'x'));
 assert.equal(f.run().status,'STATE_UNKNOWN');
 fs.unlinkSync(live);
 const outside=path.join(f.base,'outside-live-secret.mjs');
 write(outside,'SHOULD_NEVER_READ');
 fs.symlinkSync(outside,live);
 const result=f.run();
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.doesNotMatch(JSON.stringify(result),/SHOULD_NEVER_READ/);
});

test('source HEAD changing during bounded probe fails closed',t=>{
 const f=fixture(t);
 let heads=0;
 const result=f.run({git:(_root,args)=>{
  if(args.at(-1)!=='HEAD')return 'main';
  return ++heads===1?SHA40:'f'.repeat(40);
 }});
 assert.equal(result.code,'WRITER_B_1063_SOURCE_CHANGED_DURING_PROBE');
});

test('lock owner mismatch is observed without granting unlock or recovery',t=>{
 const f=fixture(t);
 write(f.paths.lockPath,'a1111111-2222-3333-4444-555555555555');
 const result=f.run();
 assert.equal(result.status,'PASS');
 assert.equal(result.lock.owner,'OTHER_OWNER');
 assert.equal(result.lock.matchesRequest,false);
 assert.equal(result.recoveryAuthorized,false);
});

test('absent lock, source drift, original base and disabled Task remain diagnostic-only',t=>{
 const f=fixture(t);
 fs.unlinkSync(f.paths.lockPath);
 const drift=f.run({git:(_root,args)=>args.at(-1)==='HEAD'?'f'.repeat(40):'main'});
 assert.equal(drift.status,'PASS');
 assert.equal(drift.source.sourcePair,'HEAD_CONFIG_DRIFT');
 assert.equal(drift.lock.state,'ABSENT');
 assert.equal(drift.recoveryAuthorized,false);
 write(f.paths.configPath,JSON.stringify({source:BASE}));
 const original=f.run({git:(_root,args)=>args.at(-1)==='HEAD'?BASE:'main',
  taskXml:()=>Buffer.from('<Task><Settings><Enabled>true</Enabled></Settings></Task>'),
  taskProbe:()=>({enabled:true,state:3,instances:0,
   relatedProcesses:0,unknownProcessLines:0})});
 assert.equal(original.status,'PASS');
 assert.equal(original.source.sourcePair,'ORIGINAL_BASE_PAIR');
 assert.equal(original.coreTask.enabled,true);
 assert.equal(original.coreTask.xmlMatchesOriginal,true);
 assert.equal(original.coreTask.definitionMatchesOriginalExceptEnabled,true);
 assert.equal(original.recoveryStatus,'RECOVERY_REQUIRED');
});

test('broken COM Task probe, unsupported OS, and corrupt provenance fail closed',t=>{
 const f=fixture(t);
 assert.equal(f.run({taskProbe:()=>{throw Error('SECRET_EXCEPTION');}}).status,'STATE_UNKNOWN');
 assert.equal(f.run({taskProbe:()=>null}).status,'STATE_UNKNOWN');
 assert.equal(f.run({platform:'linux'}).code,'WRITER_B_1063_WINDOWS_REQUIRED');
 f.provenance.manifestSha='f'.repeat(64);
 write(f.journal('provenance.json'),JSON.stringify(f.provenance));
 assert.equal(f.run().code,'WRITER_B_1063_PROVENANCE_SCOPE_DRIFT');
});

test('single Core quiet snapshot follows existing exact COM+WMI drain guard',t=>{
 const f=fixture(t);
 const base=f.context.taskProbe();
 assert.equal(f.run().coreTask.coreQuietSnapshot,true);
 for(const changed of [{enabled:true},{state:2},{state:4},{instances:1},
  {relatedProcesses:1},{unknownProcessLines:1}]){
  const result=f.run({taskProbe:()=>({...base,...changed})});
  assert.equal(result.status,'PASS');
  assert.equal(result.coreTask.coreQuietSnapshot,false);
  assert.equal(result.coreTask.resumeAuthorized,false);
 }
 write(f.paths.coreCycleLockPath,'EXISTING_CORE_LOCK');
 const lock=f.run();
 assert.equal(lock.status,'PASS');
 assert.equal(lock.coreTask.coreCycleLockPresent,true);
 assert.equal(lock.coreTask.coreQuietSnapshot,false);
 fs.unlinkSync(f.paths.coreCycleLockPath);
 fs.mkdirSync(f.paths.coreCycleLockPath);
 const directoryLease=f.run();
 assert.equal(directoryLease.status,'PASS');
 assert.equal(directoryLease.coreTask.coreCycleLockPresent,true);
 assert.equal(directoryLease.coreTask.coreQuietSnapshot,false);
});

test('existing operation allowlist gains only one light A, no new workflow or request fields',()=>{
 const policy=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 const item=policy.operations['writer-b-1063-recovery-readonly'];
 assert.deepEqual(item,{grade:'A',timeoutSeconds:60,resource:'light'});
 assert.equal(policy.mutationsEnabled,false);
 const operations=fs.readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 assert.match(operations,/request\.operation==='writer-b-1063-recovery-readonly'/);
 assert.doesNotMatch(operations,/writer-b-1063-recovery-readonly.*request\.(?:target|path|command)/);
});
