import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {makeWindowsRegistryPinBAdapter}
 from './windows-registry-pin-adapter.mjs';
import {runApprovedRegistryCas,patchHostRuntimePinBytes,
 PIN_CAS_SCHEMA,PIN_CAS_SCOPE,RUNTIME_REGISTRY_SCHEMA}
 from './approved-registry-cas.mjs';

// The Windows drive is mapped to an isolated POSIX temp fixture for DI only.
// Windows ACL inheritance, rename durability and real NTFS are NOT tested.
const sha=b=>createHash('sha256').update(b).digest('hex');
const SOURCE='a'.repeat(40);
const HOST=String.raw`E:\ZGmini\data\pc-writer\controller\host.json`;
const REG=String.raw`E:\ZGmini\data\pc-writer\approved-runtime-inventory-profiles.json`;
const LCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const JROOT=String.raw`E:\ZGmini\data\pc-writer\approved-runtime-pin-cas`;
const RESULTS=String.raw`E:\ZGmini\data\pc-writer\results`;
const TARGETS={dataRoot:String.raw`E:\ZGmini\data`,hostFile:HOST,
 registryFile:REG,sharedWriterLock:LCK,journalRoot:JROOT,resultRoot:RESULTS};
const REQUEST='18927e34-9d91-471b-80ce-b47cb4d0df8a';
const throwCode=code=>{const e=new Error(code);e.code=code;throw e;};

function setup({registryAbsent=false,fault=null,aclDrift=false,
 rollbackAclDrift=false,registryParentMissing=false,driveUnavailable=false,
 registryParentReparse=false,driveUnavailableAfterLock=false,
 ownerUnverified=false}={}){
 const physical=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-b-pin-windows-mock-'));
 const translate=win=>{
  const normalized=path.win32.normalize(win);
  assert.match(normalized,/^[A-Za-z]:\\/);
  assert.ok(!normalized.split('\\').includes('..'));
  return path.join(physical,normalized[0].toUpperCase(),
   ...normalized.slice(3).split('\\'));
 };
 const existing={id:'existing',binding:{sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'main',sourceSha:'b'.repeat(40)},rootSegments:['pc-writer','existing'],
  files:[],directories:[],tasks:[]};
 const beforeRegistry=registryAbsent?null:
  Buffer.from(JSON.stringify({schema:RUNTIME_REGISTRY_SCHEMA,profiles:[existing]}));
 const oldPin=beforeRegistry===null?null:sha(beforeRegistry);
 const host=Buffer.from('{"token":"PRIVATE_KEEP_UNCHANGED",'+
  '"approvedRuntimeInventorySha256":'+JSON.stringify(oldPin)+'}\n');
 const profile={id:'themeTool',binding:{sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'codex/theme-fear-greed-integration-20261025',sourceSha:SOURCE},
  rootSegments:['pc-writer','theme-config-tool'],files:[],directories:[],tasks:[],
  bundleProfile:{id:'themeTool',home:String.raw`E:\ZGmini\data\pc-writer\theme-config-tool`,
   taskName:'ZGMINI-PC-Configured-Themes',taskTime:'13:00',
   requiredLaunchers:['THEME_SCHEDULED.cmd'],optionalLaunchers:[],
   activeRecord:'ACTIVE_RUNTIME.json',maxFiles:256,maxBundleBytes:33554432}};
 const targetRegistry=Buffer.from(registryAbsent?
  JSON.stringify({schema:RUNTIME_REGISTRY_SCHEMA,profiles:[profile]}):
  beforeRegistry.toString('utf8').replace(/]}$/,`,${JSON.stringify(profile)}]}`));
 const pin=sha(targetRegistry),afterHost=patchHostRuntimePinBytes(host,{oldPin,newPin:pin});
 const raw=Buffer.from(JSON.stringify({schema:PIN_CAS_SCHEMA,status:'APPROVED_B',
  scope:PIN_CAS_SCOPE,profileId:profile.id,sourceSha:SOURCE,
  hostBeforeSha256:sha(host),hostAfterSha256:sha(afterHost),oldPin,newPin:pin,
  registryBeforeSha256:oldPin,registryAfterSha256:pin,
  registryEntryKey:profile.id,registryEntryBeforeSha256:null,
  registryEntryAfterSha256:sha(Buffer.from(JSON.stringify(profile)))}));
 const pinnedApproval={requestId:REQUEST,profileId:profile.id,sourceSha:SOURCE,
  rawApprovalSha256:sha(raw)};
 for(const dir of [HOST,REG,LCK,JROOT,RESULTS]){
  const file=dir===JROOT||dir===RESULTS?translate(dir):path.dirname(translate(dir));
  fs.mkdirSync(file,{recursive:true});
 }
 fs.writeFileSync(translate(HOST),host);
 if(beforeRegistry!==null)fs.writeFileSync(translate(REG),beforeRegistry);
 if(registryParentMissing){
  assert.equal(registryAbsent,true,'missing-parent fixture requires absent registry');
  // Simulate the *fixed* pc-writer parent disappearing independently of the
  // existing host bytes. Physically removing it would erase the fixture host.
 }
 let afterLock=false,afterBackup=false,operationalSwitches=0;
 const io={constants:fs.constants,
  lstatSync:p=>{
   if(registryParentMissing&&p===path.win32.dirname(REG))
    throw Object.assign(new Error('missing pc-writer parent'),{code:'ENOENT'});
   if(p===TARGETS.dataRoot&&(driveUnavailable||
    (driveUnavailableAfterLock&&afterLock)||
    (fault==='DRIVE_LOST_AFTER_BACKUP'&&afterBackup)))
    throw Object.assign(new Error('simulated missing E: drive'),{code:'ENODEV'});
   return fs.lstatSync(translate(p));
  },
  realpathSync:{native:p=>{
   if(registryParentReparse&&p===path.win32.dirname(REG))
    return String.raw`Z:\unapproved\redirect`;
   const native=translate(p),resolved=fs.realpathSync.native(native);
   return resolved===native?path.win32.normalize(p):String.raw`Z:\unapproved\reparse`;
  }},
  readFileSync:(p,...other)=>fs.readFileSync(translate(p),...other),
  copyFileSync:(s,d,flags)=>{
   fs.copyFileSync(translate(s),translate(d),flags);
   if(fault==='BACKUP_COPY'&&d.endsWith('.original.bin'))
    throwCode('B_PIN_WINDOWS_INJECTED_COPY');
  },
  openSync:(p,flags,...other)=>{
   if(fault==='RESULT_UNAVAILABLE'&&p.startsWith(RESULTS+'\\'))
    throwCode('B_PIN_WINDOWS_INJECTED_RESULT');
   return fs.openSync(translate(p),flags,...other);
  },
  writeSync:(...args)=>fs.writeSync(...args),
  fsyncSync:(...args)=>fs.fsyncSync(...args),
  closeSync:(...args)=>fs.closeSync(...args),
  ftruncateSync:(...args)=>fs.ftruncateSync(...args),
  unlinkSync:p=>fs.unlinkSync(translate(p)),
  linkSync:(s,d)=>{
   operationalSwitches++;
   fs.linkSync(translate(s),translate(d));
   if(fault==='REGISTRY_LINKED'&&d===REG)
    throwCode('B_PIN_WINDOWS_INJECTED_LINK');
  },
  renameSync:(s,d)=>{
   operationalSwitches++;
   fs.renameSync(translate(s),translate(d));
   if(fault==='HOST_RENAMED'&&d===HOST&&!s.includes('-restore'))
    throwCode('B_PIN_WINDOWS_INJECTED_HOST');
   if(fault==='REGISTRY_RENAMED'&&d===REG&&!s.includes('-restore'))
    throwCode('B_PIN_WINDOWS_INJECTED_REGISTRY');
  },
 };
 const claimApi={
  acquireInstallLock({journalRoot,requestId,sharedLock}){
   assert.equal(journalRoot,JROOT);assert.equal(sharedLock,LCK);
   if(fs.existsSync(translate(path.win32.join(JROOT,requestId))))
    throwCode('R17_B_REQUEST_ALREADY_CLAIMED_STOP');
   const fd=fs.openSync(translate(sharedLock),'wx');
   fs.writeSync(fd,requestId);fs.fsyncSync(fd);
   afterLock=true;
   return {fd,journalDir:path.win32.join(journalRoot,requestId)};
  },
  createInstallJournal({requestId,fd,sharedLock}){
   assert.equal(sharedLock,LCK);
   assert.equal(fs.readFileSync(translate(sharedLock),'utf8'),requestId);
   assert.ok(Number.isInteger(fd));
   fs.mkdirSync(translate(path.win32.join(JROOT,requestId)),{recursive:false});
  },
  releaseInstallClaim({requestId,fd,sharedLock,retain}){
   assert.equal(sharedLock,LCK);assert.equal(retain,false);
   assert.equal(fs.readFileSync(translate(sharedLock),'utf8'),requestId);
   fs.closeSync(fd);fs.unlinkSync(translate(sharedLock));
  },
 };
 const adapter=makeWindowsRegistryPinBAdapter({
  authenticatedReceiver:{approvalScope:PIN_CAS_SCOPE,
   installedReceiverVerified:true,pathsFromInstalledHost:true},
  targets:TARGETS,requestId:REQUEST,approvedRegistryAfterBytes:targetRegistry,
  verifyApproval:async({sha256:approved})=>({verified:true,
   rawApprovalSha256:approved}),lockApi:claimApi,fileIO:io,
  verifyDirectoryOwnership:()=>({ownerVerified:!ownerUnverified,
   noReparse:true,aclVerified:true}),
  aclFingerprint:p=>{
   if(fault==='DRIVE_LOST_AFTER_BACKUP'&&
    p===REG+'.pin-b-'+REQUEST+'.original.bin')afterBackup=true;
   if(fault==='HOST_CONCURRENT_DRIFT'&&p.includes('.tmp')&&
    p.startsWith(HOST)&&!p.includes('-restore'))
    fs.writeFileSync(translate(HOST),'EXTERNAL_UNCOOPERATIVE_WRITER');
   return (aclDrift&&p.endsWith('.tmp'))||
    (rollbackAclDrift&&p.includes('-restore.tmp'))?
     'DIFFERENT_ACL':'FIXTURE_ACL';
  },
  platform:()=> 'win32',
 });
 return {physical,translate,adapter,raw,pinnedApproval,host,afterHost,beforeRegistry,
  targetRegistry,getOperationalSwitchCount:()=>operationalSwitches};
}
async function withFixture(opts,fn){
 const x=setup(opts);
 try{await fn(x);}finally{fs.rmSync(x.physical,{recursive:true,force:true});}
}

test('Windows factory refuses unauthorized receiver and wrong platform without I/O',()=>{
 const safe={targets:TARGETS,requestId:REQUEST,approvedRegistryAfterBytes:Buffer.from('{}'),
  verifyApproval:()=>true,lockApi:{acquireInstallLock(){},createInstallJournal(){},
   releaseInstallClaim(){}},platform:()=> 'win32'};
 assert.throws(()=>makeWindowsRegistryPinBAdapter(safe),
  {code:'B_PIN_WINDOWS_RECEIVER_AUTH_REQUIRED'});
 assert.throws(()=>makeWindowsRegistryPinBAdapter({...safe,
  authenticatedReceiver:{approvalScope:PIN_CAS_SCOPE,installedReceiverVerified:true,
   pathsFromInstalledHost:true},platform:()=> 'linux'}),
 {code:'B_PIN_WINDOWS_PLATFORM_REQUIRED'});
});

test('Windows factory refuses Issue-selected registry target, even with trusted receiver',()=>{
 const safe={authenticatedReceiver:{approvalScope:PIN_CAS_SCOPE,
  installedReceiverVerified:true,pathsFromInstalledHost:true},
  requestId:REQUEST,approvedRegistryAfterBytes:Buffer.from('{}'),
  verifyApproval:()=>true,lockApi:{acquireInstallLock(){},createInstallJournal(){},
   releaseInstallClaim(){}},platform:()=> 'win32'};
 assert.throws(()=>makeWindowsRegistryPinBAdapter({...safe,
  targets:{...TARGETS,registryFile:String.raw`E:\ZGmini\data\any-other.json`}}),
  {code:'B_PIN_WINDOWS_FIXED_EFFECT_SCOPE'});
 assert.throws(()=>makeWindowsRegistryPinBAdapter({...safe,
  targets:{...TARGETS,hostFile:'host.json'}}),
  {code:'B_PIN_WINDOWS_TARGET_PATH'});
});

test('Windows-mapped DI: transaction preserves host secret and backs up both files',async()=>{
 await withFixture({},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'PASS',JSON.stringify(out));
  assert.equal(out.reportStatus,'JSON_TXT_2_OF_2');
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.afterHost);
  assert.deepEqual(fs.readFileSync(x.translate(REG)),x.targetRegistry);
  assert.ok(fs.existsSync(x.translate(HOST+'.pin-b-'+REQUEST+'.original.bin')));
  assert.ok(fs.existsSync(x.translate(REG+'.pin-b-'+REQUEST+'.original.bin')));
  assert.equal(fs.existsSync(x.translate(LCK)),false);
  assert.ok(fs.readFileSync(x.translate(HOST),'utf8').includes('PRIVATE_KEEP_UNCHANGED'));
  const report=fs.readFileSync(x.translate(path.win32.join(RESULTS,'pin-cas-'+REQUEST+'.json')),'utf8');
  assert.ok(!report.includes('PRIVATE_KEEP_UNCHANGED'));
 });
});

test('Windows-mapped DI: host rename fault restores original with CAS',async()=>{
 await withFixture({fault:'HOST_RENAMED'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED',JSON.stringify(out));
  assert.equal(out.rollback,'VERIFIED');
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.host);
  assert.deepEqual(fs.readFileSync(x.translate(REG)),x.beforeRegistry);
  assert.equal(fs.existsSync(x.translate(LCK)),false);
 });
});

test('Windows-mapped DI: registry rename fault rolls back both files',async()=>{
 await withFixture({fault:'REGISTRY_RENAMED'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED',JSON.stringify(out));
  assert.equal(out.rollback,'VERIFIED');
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.host);
  assert.deepEqual(fs.readFileSync(x.translate(REG)),x.beforeRegistry);
 });
});

test('Windows-mapped DI: partial backup leaves lock and STATE_UNKNOWN',async()=>{
 await withFixture({fault:'BACKUP_COPY'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'STATE_UNKNOWN',JSON.stringify(out));
  assert.equal(out.retainLockForRecovery,true);
  assert.equal(fs.readFileSync(x.translate(LCK),'utf8'),REQUEST);
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.host);
 });
});

test('Windows-mapped DI: bootstrap create and rollback preserve actual absence',async()=>{
 await withFixture({registryAbsent:true},async x=>{
  assert.equal(fs.existsSync(x.translate(REG)),false);
  // This is A-style read-only evidence, not a B owner approval or claim.
  const aObservation=await x.adapter.inspectPreimage();
  assert.equal(aObservation.registry,null);
  assert.match(aObservation.host.toString('utf8'),
   /"approvedRuntimeInventorySha256":null/);
  assert.equal(fs.existsSync(x.translate(LCK)),false);
  assert.equal(fs.existsSync(x.translate(path.win32.join(JROOT,REQUEST))),false);
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'PASS',JSON.stringify(out));
  assert.deepEqual(fs.readFileSync(x.translate(REG)),x.targetRegistry);
  assert.equal(fs.existsSync(x.translate(REG+'.pin-b-'+REQUEST+'.original.bin')),false);
 });
 await withFixture({registryAbsent:true,fault:'REGISTRY_LINKED'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED',JSON.stringify(out));
  assert.equal(out.rollback,'VERIFIED');
  assert.equal(fs.existsSync(x.translate(REG)),false);
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.host);
 });
});

test('Windows-mapped DI: missing registry parent does not count as leaf ABSENT',async()=>{
 await withFixture({registryAbsent:true,registryParentMissing:true},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED',JSON.stringify(out));
  assert.equal(out.code,'B_PIN_WINDOWS_REGISTRY_PARENT_MISSING');
  assert.equal(x.getOperationalSwitchCount(),0);
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.host);
  assert.equal(fs.existsSync(x.translate(REG)),false);
  assert.equal(fs.existsSync(x.translate(LCK)),false);
 });
});

test('Windows-mapped DI: disconnected E: drive is not a safe first-registration preimage',async()=>{
 await withFixture({registryAbsent:true,driveUnavailable:true},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED',JSON.stringify(out));
  assert.equal(out.code,'B_PIN_WINDOWS_REGISTRY_PARENT_MISSING');
  assert.equal(x.getOperationalSwitchCount(),0);
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.host);
  assert.equal(fs.existsSync(x.translate(REG)),false);
  assert.equal(fs.existsSync(x.translate(LCK)),false);
 });
});

test('Windows-mapped DI: registry parent reparse redirection denies bootstrap',async()=>{
 await withFixture({registryAbsent:true,registryParentReparse:true},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED',JSON.stringify(out));
  assert.equal(out.code,'B_PIN_WINDOWS_REGISTRY_PARENT_REPARSE');
  assert.equal(x.getOperationalSwitchCount(),0);
  assert.equal(fs.existsSync(x.translate(REG)),false);
  assert.equal(fs.existsSync(x.translate(LCK)),false);
 });
});

test('Windows-mapped DI: installed writer parent owner cannot be inferred from path',async()=>{
 await withFixture({registryAbsent:true,ownerUnverified:true},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED',JSON.stringify(out));
  assert.equal(out.code,'B_PIN_WINDOWS_REGISTRY_PARENT_OWNER_UNVERIFIED');
  assert.equal(x.getOperationalSwitchCount(),0);
  assert.equal(fs.existsSync(x.translate(REG)),false);
  assert.equal(fs.existsSync(x.translate(LCK)),false);
 });
});

test('Windows-mapped DI: drive disappears after shared lock => no CAS/create',async()=>{
 await withFixture({registryAbsent:true,driveUnavailableAfterLock:true},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED',JSON.stringify(out));
  assert.equal(out.code,'B_PIN_WINDOWS_REGISTRY_PARENT_MISSING');
  assert.equal(x.getOperationalSwitchCount(),0);
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.host);
  assert.equal(fs.existsSync(x.translate(REG)),false);
  assert.equal(fs.existsSync(x.translate(LCK)),false);
 });
});

test('Windows-mapped DI: drive disappears after backup retains lock with zero CAS',async()=>{
 await withFixture({fault:'DRIVE_LOST_AFTER_BACKUP'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'STATE_UNKNOWN',JSON.stringify(out));
  assert.equal(out.retainLockForRecovery,true);
  assert.equal(x.getOperationalSwitchCount(),0);
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.host);
  assert.deepEqual(fs.readFileSync(x.translate(REG)),x.beforeRegistry);
  assert.equal(fs.readFileSync(x.translate(LCK),'utf8'),REQUEST);
 });
});

test('Windows-mapped DI: security fingerprint mismatch fails closed before switch',async()=>{
 await withFixture({aclDrift:true},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'BLOCKED',JSON.stringify(out));
  assert.equal(out.rollback,'VERIFIED');
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.host);
  assert.equal(fs.existsSync(x.translate(LCK)),false);
 });
});

test('Windows-mapped DI: rollback ACL failure is STATE_UNKNOWN with retained shared lock',async()=>{
 await withFixture({fault:'REGISTRY_RENAMED',rollbackAclDrift:true},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'STATE_UNKNOWN',JSON.stringify(out));
  assert.equal(out.code,'B_PIN_ROLLBACK_UNVERIFIED');
  assert.equal(out.retainLockForRecovery,true);
  assert.equal(fs.readFileSync(x.translate(LCK),'utf8'),REQUEST);
  assert.deepEqual(fs.readFileSync(x.translate(REG)),x.targetRegistry);
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.afterHost);
 });
});

test('Windows-mapped DI: last-moment external host drift never overwrites it',async()=>{
 await withFixture({fault:'HOST_CONCURRENT_DRIFT'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'STATE_UNKNOWN',JSON.stringify(out));
  assert.equal(out.retainLockForRecovery,true);
  assert.equal(fs.readFileSync(x.translate(HOST),'utf8'),
   'EXTERNAL_UNCOOPERATIVE_WRITER');
  assert.deepEqual(fs.readFileSync(x.translate(REG)),x.beforeRegistry);
  assert.equal(fs.readFileSync(x.translate(LCK),'utf8'),REQUEST);
 });
});

test('Windows-mapped DI: results unavailable stays PASS but evidence INCOMPLETE',async()=>{
 await withFixture({fault:'RESULT_UNAVAILABLE'},async x=>{
  const out=await runApprovedRegistryCas({approvalRaw:x.raw,
   pinnedApproval:x.pinnedApproval,adapter:x.adapter});
  assert.equal(out.status,'PASS',JSON.stringify(out));
  assert.equal(out.reportStatus,'INCOMPLETE');
  assert.deepEqual(fs.readFileSync(x.translate(HOST)),x.afterHost);
  assert.deepEqual(fs.readFileSync(x.translate(REG)),x.targetRegistry);
  assert.equal(fs.existsSync(x.translate(LCK)),false);
 });
});
