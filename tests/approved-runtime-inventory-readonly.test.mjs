import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {inspectApprovedRuntimeInventory,inspectApprovedRuntimeRegistry}
 from '../controller/approved-runtime-inventory-readonly.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'approved-inventory-'));
const identity={sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'codex/theme',sourceSha:'1'.repeat(40)};
const validBundle=id=>({id,home:'E:\\ZGmini\\data\\pc-writer\\theme-config-tool',
 taskName:'ZGMINI-PC-ThemeSchedule',taskTime:'13:00',
 requiredLaunchers:['THEME_SCHEDULED.cmd'],
 optionalLaunchers:['THEME_LIST.cmd','THEME_REGISTER.cmd'],
 activeRecord:'ACTIVE_RUNTIME.json',maxFiles:128,maxBundleBytes:16*1024*1024});
const fixture=()=>({
 id:'approvedTheme',binding:{...identity},rootSegments:['pc-writer','theme-runtime'],
 files:[{key:'installer',relativePath:'bin/INSTALL_RESULT.json'},
  {key:'schedule',relativePath:'THEME_SCHEDULED.cmd'}],
 directories:[{key:'backup',relativePath:'backup'}],
 tasks:[{key:'themeSchedule',name:'ZGMINI-PC-ThemeSchedule',
  expectedCommandBasename:'THEME_SCHEDULED.cmd',expectedHour:13}],
});
const taskXml=`<?xml version="1.0"?><Task><Triggers><CalendarTrigger>
<StartBoundary>2026-11-08T13:00:00</StartBoundary></CalendarTrigger></Triggers>
<Settings><Enabled>true</Enabled></Settings><Actions><Exec>
<Command>E:\\ZGmini\\data\\pc-writer\\theme-runtime\\THEME_SCHEDULED.cmd</Command>
<Arguments>--secret=NEVER_LEAK_THIS_VALUE</Arguments></Exec></Actions></Task>`;
const withTmp=async callback=>{
 const base=tmp();try{await callback(base);}finally{fs.rmSync(base,{recursive:true,force:true});}
};

test('fixed approved inventory: hashes files, checks task metadata, zero writes or execution',async()=>{
 await withTmp(async base=>{
  const root=path.join(base,'pc-writer','theme-runtime');
  fs.mkdirSync(path.join(root,'bin'),{recursive:true});
  fs.mkdirSync(path.join(root,'backup'));
  fs.writeFileSync(path.join(root,'bin','INSTALL_RESULT.json'),'fixed-preimage');
  fs.writeFileSync(path.join(root,'THEME_SCHEDULED.cmd'),'REM safe script');
  let queryCount=0;
  const response=inspectApprovedRuntimeInventory({dataRoot:base,profile:fixture(),queryTask:n=>{
   assert.equal(n,'ZGMINI-PC-ThemeSchedule');queryCount++;return taskXml;
  }});
  assert.equal(queryCount,1);
  assert.equal(response.status,'DONE');
  assert.equal(response.profileId,'approvedTheme');
  assert.equal(response.rootExists,true);
  assert.equal(response.files.installer.sha256,sha('fixed-preimage'));
  assert.equal(response.files.installer.sizeBytes,14);
  assert.equal(response.files.schedule.exists,true);
  assert.equal(response.directories.backup.exists,true);
  assert.equal(response.tasks.themeSchedule.expectedCommandPresent,true);
  assert.equal(response.tasks.themeSchedule.expectedHourPresent,true);
  assert.equal(response.tasks.themeSchedule.enabled,true);
  assert.equal(response.writes,0);
  assert.equal(response.collectorRuns,0);
  assert.equal(response.d1Writes,0);
  assert.equal(response.dbOpens,0);
  assert.equal(response.installationPerformed,false);
  assert.ok(!JSON.stringify(response).includes('NEVER_LEAK_THIS_VALUE'));
  assert.ok(!JSON.stringify(response).includes('E:\\ZGmini'));
  assert.ok(Buffer.byteLength(JSON.stringify(response))<32768);
 });
});

test('missing fixed root or individual files are harmless and clearly reported',async()=>{
 await withTmp(async base=>{
  const before=fs.readdirSync(base);
  const absent=inspectApprovedRuntimeInventory({dataRoot:base,profile:fixture()});
  assert.equal(absent.rootExists,false);
  assert.equal(absent.files.installer.exists,false);
  assert.equal(absent.files.schedule.exists,false);
  assert.equal(absent.directories.backup.exists,false);
  assert.equal(absent.tasks.themeSchedule.status,'NOT_QUERIED');
  assert.deepEqual(fs.readdirSync(base),before);
  const root=path.join(base,'pc-writer','theme-runtime');
  fs.mkdirSync(path.join(root,'bin'),{recursive:true});
  fs.writeFileSync(path.join(root,'THEME_SCHEDULED.cmd'),'active');
  const partial=inspectApprovedRuntimeInventory({dataRoot:base,profile:fixture()});
  assert.equal(partial.rootExists,true);
  assert.equal(partial.files.installer.exists,false);
  assert.equal(partial.files.schedule.exists,true);
 });
});

test('malicious/unapproved paths, secrets, tasks, and freeform profile fields are rejected',async()=>{
 await withTmp(async base=>{
  const invalid=[
   {...fixture(),rootSegments:['pc-writer','..','theme-runtime']},
   {...fixture(),rootSegments:['C:\\Users\\Administrator']},
   {...fixture(),files:[{key:'inject',relativePath:'../../private.txt'}]},
   {...fixture(),files:[{key:'inject',relativePath:'bin/.env'}]},
   {...fixture(),files:[{key:'inject',relativePath:'bin/token.json'}]},
   {...fixture(),files:[{key:'inject',relativePath:'bin/secrets.txt'}]},
   {...fixture(),tasks:[{key:'bad',name:'\\\\server\\Task'}]},
   {...fixture(),requestPath:'C:/arbitrary'},
   {...fixture(),files:[{key:'same',relativePath:'foo.json'},
    {key:'same',relativePath:'bar.json'}]},
  ];
  for(const profile of invalid)assert.throws(
   ()=>inspectApprovedRuntimeInventory({dataRoot:base,profile}),
   {code:/^INVENTORY_/});
 });
});

test('symlink/reparse redirection in child root, parent, file, or nested selector is rejected',async()=>{
 await withTmp(async base=>{
  const outside=tmp();
  try{
   const root=path.join(base,'pc-writer','theme-runtime');
   fs.mkdirSync(root,{recursive:true});
   fs.symlinkSync(outside,path.join(root,'bin'),'dir');
   assert.throws(()=>inspectApprovedRuntimeInventory({dataRoot:base,profile:fixture()}),
    {code:'INVENTORY_REPARSE_OR_TYPE_DENIED'});
   fs.unlinkSync(path.join(root,'bin'));
   fs.mkdirSync(path.join(root,'bin'));
   fs.writeFileSync(path.join(outside,'target.json'),'sensitive');
   fs.symlinkSync(path.join(outside,'target.json'),path.join(root,'bin','INSTALL_RESULT.json'),'file');
   assert.throws(()=>inspectApprovedRuntimeInventory({dataRoot:base,profile:fixture()}),
    {code:'INVENTORY_REPARSE_OR_TYPE_DENIED'});
   fs.unlinkSync(path.join(root,'bin','INSTALL_RESULT.json'));
   fs.rmSync(root,{recursive:true});
   fs.symlinkSync(outside,root,'dir');
   assert.throws(()=>inspectApprovedRuntimeInventory({dataRoot:base,profile:fixture()}),
    {code:'INVENTORY_REPARSE_OR_TYPE_DENIED'});
  }finally{fs.rmSync(outside,{recursive:true,force:true});}
 });
});

test('oversize file yields bounded no-content state; Task UTF-16LE and failed task query are safe',async()=>{
 await withTmp(async base=>{
  const root=path.join(base,'pc-writer','theme-runtime','bin');
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,'INSTALL_RESULT.json'),Buffer.alloc(8*1024*1024+1,65));
  const utf16=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(taskXml,'utf16le')]);
  const large=inspectApprovedRuntimeInventory({dataRoot:base,profile:fixture(),queryTask:()=>utf16});
  assert.deepEqual(large.files.installer,{exists:true,status:'SIZE_LIMIT'});
  assert.equal(large.tasks.themeSchedule.status,'XML_READ');
  assert.equal(large.tasks.themeSchedule.expectedCommandPresent,true);
  const failed=inspectApprovedRuntimeInventory({dataRoot:base,profile:fixture(),queryTask:()=>{throw Error('secret');}});
  assert.equal(failed.tasks.themeSchedule.status,'QUERY_UNAVAILABLE');
  assert.ok(!JSON.stringify(failed).includes('secret'));
 });
});

test('stable generic receiver: separately pinned approved registry onboards a second feature without code changes',async()=>{
 await withTmp(async base=>{
  const other={...fixture(),id:'otherApprovedFeature',rootSegments:['pc-writer','other-feature'],
   binding:{...identity,sourceSha:'2'.repeat(40)},
   files:[{key:'snapshot',relativePath:'INSTALL_RESULT.json'}],directories:[],tasks:[]};
  const manifest=Buffer.from(JSON.stringify({
   schema:'ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1',
   profiles:[fixture(),other],
  }));
  const expectedHash=sha(manifest);
  const result=inspectApprovedRuntimeRegistry({dataRoot:base,manifestBytes:manifest,
   approvedManifestSha256:expectedHash,requestIdentity:identity});
  assert.equal(result.registeredCount,2);
  assert.equal(result.selectedCount,1);
  assert.equal(result.profiles[0].profileId,'approvedTheme');
  assert.ok(!JSON.stringify(result).includes('otherApprovedFeature'));
  assert.equal(result.registrySha256,expectedHash);
  assert.equal(result.operationalWrites,0);
  assert.ok(Buffer.byteLength(JSON.stringify(result))<=32768);
  assert.throws(()=>inspectApprovedRuntimeRegistry({dataRoot:base,manifestBytes:manifest,
   approvedManifestSha256:'a'.repeat(64),requestIdentity:identity}),
   {code:'INVENTORY_MANIFEST_APPROVAL_MISMATCH'});
 });
});

test('registry with pinned hash still rejects malicious selector and duplicate profiles',async()=>{
 await withTmp(async base=>{
  for(const profiles of [
   [fixture(),{...fixture(),id:'approvedTheme'}],
   [{...fixture(),files:[{key:'steal',relativePath:'../../private.json'}]}],
  ]){
   const manifest=Buffer.from(JSON.stringify({
    schema:'ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1',profiles,
   }));
   assert.throws(()=>inspectApprovedRuntimeRegistry({dataRoot:base,manifestBytes:manifest,
    approvedManifestSha256:sha(manifest),requestIdentity:identity}),{code:/^INVENTORY_/});
  }
 });
});

test('single A/B capability registry accepts safe optional B metadata but A never reads or returns it',async()=>{
 await withTmp(async base=>{
  const p={...fixture(),bundleProfile:validBundle('approvedTheme')};
  const manifest=Buffer.from(JSON.stringify({
   schema:'ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1',profiles:[p],
  }));
  const queryCount={value:0};
  const result=inspectApprovedRuntimeRegistry({dataRoot:base,manifestBytes:manifest,
   approvedManifestSha256:sha(manifest),requestIdentity:identity,
   queryTask:()=>{queryCount.value++;return taskXml;}});
  assert.equal(result.selectedCount,1);
  assert.equal(queryCount.value,1); // A-defined Task only; no B Task query.
  assert.equal(result.profiles[0].profileId,'approvedTheme');
  for(const key of ['bundleProfile','maxBundleBytes','requiredLaunchers','ACTIVE_RUNTIME.json',
    'E:\\ZGmini\\data\\pc-writer\\theme-config-tool'])
   assert.ok(!JSON.stringify(result).includes(key));
 });
});

test('optional B metadata malformed/secret/unsafe fields are strictly rejected before A reads',async()=>{
 await withTmp(async base=>{
  const candidates=[
   {...validBundle('approvedTheme'),home:'C:\\Windows\\system32'},
   {...validBundle('approvedTheme'),home:'E:\\ZGmini\\data\\pc-writer\\..\\escape'},
   {...validBundle('approvedTheme'),id:'otherProfile'},
   {...validBundle('approvedTheme'),requiredLaunchers:['../../run.cmd']},
   {...validBundle('approvedTheme'),optionalLaunchers:['secrets.env']},
   {...validBundle('approvedTheme'),optionalLaunchers:['THEME_SCHEDULED.cmd']},
   {...validBundle('approvedTheme'),activeRecord:'token.json'},
   {...validBundle('approvedTheme'),maxBundleBytes:33*1024*1024},
   {...validBundle('approvedTheme'),privateKey:'NEVER_ALLOWED'},
  ];
  for(const bundleProfile of candidates){
   const manifest=Buffer.from(JSON.stringify({
    schema:'ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1',
    profiles:[{...fixture(),bundleProfile}],
   }));
   let called=false;
   assert.throws(()=>inspectApprovedRuntimeRegistry({dataRoot:base,manifestBytes:manifest,
    approvedManifestSha256:sha(manifest),requestIdentity:identity,
    queryTask:()=>{called=true;return taskXml;}}),{code:/^INVENTORY_/});
   assert.equal(called,false);
  }
 });
});
