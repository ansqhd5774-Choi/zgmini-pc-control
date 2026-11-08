import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectWriterInstallPreimage,CALENDAR_PREIMAGE_FILES,
 EMPLOYMENT_R6_PREIMAGE_FILES} from '../controller/writer-install-preimage-readonly.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const SHA='a'.repeat(40);
const fixture=()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-preimage-'));
 const base=path.join(temp,'zgmini'),data=path.join(base,'data');
 const source=path.join(base,'projects','zgmini-earnings-history-pc-release');
 fs.mkdirSync(path.join(data,'pc-writer'),{recursive:true});
 fs.mkdirSync(source,{recursive:true});
 const config={source:SHA,otherSecret:'never expose',
  employmentR6AutoCollection:false,employmentR6OneYearAutoPublication:true};
 fs.writeFileSync(path.join(data,'pc-writer','config.json'),JSON.stringify(config));
 const trace=()=>({sourceResolved:false,configApprovedSha:SHA,
  lastWriterEvidence:{sourceHead:SHA,status:'VERIFIED'},
  historicalCheckoutCandidate:{gitVerified:true,sourceRoot:
   'projects/zgmini-earnings-history-pc-release',head:SHA,trackedDirty:false,
   matchesWriterCheckpoint:true},
  tracedLaunchers:[{path:'launchers/start.cmd',sha256:'1'.repeat(64)}]});
 return {data,source,temp,trace,finish:()=>fs.rmSync(temp,{recursive:true,force:true})};
};

test('fixed 22-file A inventory observes only approved file hashes and two safe flags',()=>{
 const f=fixture();try{
  for(const rel of [CALENDAR_PREIMAGE_FILES[2],
   EMPLOYMENT_R6_PREIMAGE_FILES[0],EMPLOYMENT_R6_PREIMAGE_FILES[10]]){
   const file=path.join(f.source,...rel.split('/'));
   fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'export default 1;\n');
  }
  // >64 sibling directories, no whole-project traversal or arbitrary names.
  for(let i=0;i<70;i++)fs.mkdirSync(path.join(f.source,'unused'+i));
  const r=inspectWriterInstallPreimage(f.data,{strictPlatform:false,
   inspectSource:f.trace});
  assert.equal(r.status,'PASS');assert.equal(r.code,'WRITER_FIXED_PREIMAGE_READONLY');
  assert.equal(r.calendar.length,3);assert.equal(r.employmentR6.length,19);
  assert.equal(r.sourceHead,SHA);assert.equal(r.approvedConfigSource,SHA);
  assert.equal(r.sourceIdentityConsistent,true);
  assert.equal(r.calendar[2].expectedEffect,'M');
  assert.equal(r.calendar[2].sha256,sha(Buffer.from('export default 1;\n')));
  assert.equal(r.calendar[0].state,'ABSENT');
  assert.equal(r.employmentR6[0].trackedDirty,false);
  assert.equal(r.r6Config.keys.employmentR6AutoCollection,'DISABLED');
  assert.equal(r.r6Config.keys.employmentR6OneYearAutoPublication,'ENABLED');
  assert.match(r.r6Config.configSha256,/^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(r).includes('never expose'),false);
  assert.equal(r.sqliteOpened,false);assert.equal(r.operationalWrites,0);
 }finally{f.finish();}
});

test('drift cannot be called installation-safe despite readable bytes',()=>{
 const f=fixture();try{
  const r=inspectWriterInstallPreimage(f.data,{strictPlatform:false,
   inspectSource:()=>({...f.trace(),configApprovedSha:'b'.repeat(40)})});
  assert.equal(r.status,'PASS');assert.equal(r.sourceIdentityConsistent,false);
 }finally{f.finish();}
});

test('symbolic links or missing files never yield guessed preimage',()=>{
 const f=fixture();try{
  const outside=path.join(f.temp,'private.mjs');fs.writeFileSync(outside,'secret');
  const relative=CALENDAR_PREIMAGE_FILES[2];const file=path.join(f.source,...relative.split('/'));
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.symlinkSync(outside,file);
  const r=inspectWriterInstallPreimage(f.data,{strictPlatform:false,
   inspectSource:f.trace});
  assert.equal(r.calendar[2].exists,null);assert.equal(r.calendar[2].sha256,null);
 }finally{f.finish();}
});

test('wrong checkout and absent task source never become verified',()=>{
 const f=fixture();try{
  const r=inspectWriterInstallPreimage(f.data,{strictPlatform:false,
   inspectSource:()=>({...f.trace(),historicalCheckoutCandidate:{gitVerified:true,
    sourceRoot:'projects/another-project',head:SHA,trackedDirty:false}})});
  assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.sourceRoot,null);
 }finally{f.finish();}
});
