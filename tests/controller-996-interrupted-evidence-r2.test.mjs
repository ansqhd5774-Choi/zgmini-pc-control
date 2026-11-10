import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {summarize996ReplayJournal,
  collect996InterruptedEvidenceR2} from '../tools/controller-996-interrupted-evidence-r2.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const M='automation/pc-maintenance';
const C='automation/pc-control';
const STAGE=`${C}/backups/controller-update-${REQ}/stage`;
const CO=`${M}/leases/controller-recovery`;
const hash=x=>createHash('sha256').update(x).digest('hex');
const text=x=>Buffer.from(JSON.stringify(x));
const maintainers=['maintenance-contract.mjs','maintenance-apply.mjs',
 'maintenance-agent.mjs','maintenance-lock.mjs','update.mjs',
 'maintenance-ancestry.vbs','source-bundle-register.mjs'];

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 const put=(rel,buf)=>{
  const target=path.join(root,...rel.split('/'));
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,buf);
  return hash(buf);
 };
 const coreFiles={},stageFiles={};
 for(const rel of ['config/operations.json',
   'controller/entry.mjs','controller/common.mjs',
   'controller/upload.mjs','controller/allowlist.mjs']){
  const buf=Buffer.from(`const source = ${JSON.stringify(rel)};`);
  coreFiles[rel]=put(`${C}/${rel}`,buf);
  stageFiles[rel]=put(`${STAGE}/${rel}`,buf);
 }
 const control=text({controllerSourceSha:'badad9124157879d7a645b64f2768113d632355b',
   controllerFiles:coreFiles});
 const stage=text({controllerSourceSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
   controllerFiles:stageFiles});
 const maintFiles={};
 for(const name of maintainers){
  const rel=`tools/${name}`,buf=Buffer.from('snapshot '+name);
  maintFiles[rel]=put(`${M}/${rel}`,buf);
 }
 const maint=text({schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
   sourceSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
   files:maintFiles});
 const pins={controller:put(`${C}/host.json`,control),
  stage:put(`${STAGE}/host.json`,stage),
  maintainer:put(`${M}/MAINTENANCE_INSTALL.json`,maint),
  oldOwner:put(`${M}/leases/controller-install/owner.json`,
    text({pid:99999999})),
  oldRecovery:put(`${M}/leases/controller-install/RECOVERY_REQUIRED.json`,
    text({requestId:REQ}))};
 put(`${CO}/owner.json`,text({pid:99999999,nonce:'private-owner-nonce'}));
 for(const marker of ['PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
  'BACKLOG_CLOSE_ATTEMPTED'])
  put(`${CO}/${marker}.json`,text({name:marker,nonce:'private-owner-nonce'}));
 const replay={'1217':{status:'DONE',originalRequestId:'private-request',
    replayIssueNumber:1301},
  '1227':{status:'SKIPPED_RESULT_PRESENT'}};
 const backlogSha256=put(`${M}/backlog/${REQ}.json`,
  text({schema:'ZGMINI_PC_BACKLOG_V1',requestId:REQ,replays:replay,
    pausedAt:'2026-11-10T01:06:53.751Z',
    resumedAt:'2026-11-10T13:21:26.727Z'}));
 const originalObservation={status:'READONLY_INTERRUPTED_PHASE_CONSISTENT',
  checksPassed:14,checksTotal:14,backlogSha256,executionAuthorized:false,
  pausedAt:'2026-11-10T01:06:53.751Z',
  resumedAt:'2026-11-10T13:21:26.727Z'};
 return {root,pins,put,originalObservation,
  run:opts=>collect996InterruptedEvidenceR2({root,pins,
    originalObservation,testOnly:true,...opts}),
  cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('empty physical replay journal has explicit zero counts and a fixed digest',()=>{
  const r=summarize996ReplayJournal({});
  assert.equal(r.replayCount,0);
  assert.equal(r.doneCount,0);assert.equal(r.skippedCount,0);
  assert.deepEqual(r.entries,[]);
  assert.match(r.replayJournalSha256,/^[a-f0-9]{64}$/);
});

test('physical replay journal summarizes only issue identifiers, statuses and hashes',()=>{
  const r=summarize996ReplayJournal({
    '1227':{status:'SKIPPED_RESULT_PRESENT',sensitive:'never print this'},
    '1219':{status:'DONE',originalRequestId:'pc-a-private-request',
      replayIssueNumber:1309,nonce:'private nonce'},
  });
  assert.equal(r.replayCount,2);assert.equal(r.doneCount,1);
  assert.equal(r.skippedCount,1);
  assert.deepEqual(r.entries,[
    {originIssue:1219,status:'DONE',replayIssueNumber:1309},
    {originIssue:1227,status:'SKIPPED_RESULT_PRESENT',replayIssueNumber:null},
  ]);
  assert.equal(JSON.stringify(r).includes('private'),false);
});

test('missing, transient or malformed replay records stop rather than infer no replay',()=>{
  for(const invalid of [undefined,null,[],{'1217':{status:'POSTING'}},
    {'bad-key':{status:'DONE',replayIssueNumber:1300,originalRequestId:'pc-1'}},
    {'1217':{status:'DONE',originalRequestId:'pc-1'}},
    {'1217':{status:'DONE',replayIssueNumber:1300}}]){
    assert.throws(()=>summarize996ReplayJournal(invalid),/C_EVIDENCE_REPLAY/);
  }
});

test('production evidence observer refuses Linux and unauthenticated baseline',()=>{
  const r=collect996InterruptedEvidenceR2({originalObservation:{
    status:'READONLY_INTERRUPTED_PHASE_CONSISTENT',
    checksPassed:14,checksTotal:14,
    backlogSha256:'a'.repeat(64),executionAuthorized:false,
  }});
  assert.equal(r.status,'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE');
  assert.equal(r.code,'C_EVIDENCE_ORIGINAL_WINDOWS_ONLY');
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.operationalWrites,0);
});

test('snapshot checks actual manifest-bound source bytes and redacts claim contents',()=>{
 const f=fixture();
 try{
  const r=f.run();
  assert.equal(r.status,'READONLY_EVIDENCE_SNAPSHOT_CONSISTENT');
  assert.equal(r.sourceManifestHashPostcheckVerified,true);
  assert.equal(r.claimProvenanceExternallyPinned,false);
  assert.equal(r.executionAuthorized,false);
  assert.deepEqual(r.sourceFiles,{installed:5,staged:5,maintainer:7});
  assert.equal(r.replayCount,2);assert.equal(r.replayDoneCount,1);
  assert.equal(r.replaySkippedCount,1);
  assert.equal(r.replayEntries[0].originIssue,1217);
  assert.equal(JSON.stringify(r).includes('private'),false);
 }finally{f.cleanup();}
});

test('unknown claim files and changed snapshot file bytes fail closed',()=>{
 const f=fixture();
 try{
  f.put(`${CO}/UNKNOWN.json`,Buffer.from('{}'));
  const bad=f.run();
  assert.equal(bad.status,'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE');
  assert.equal(bad.code,'C_EVIDENCE_C_CLAIM_EXTRA_OR_MISSING_FILE');
 }finally{f.cleanup();}
 const g=fixture();
 try{
  const r=g.run({afterFirstCapture:()=>g.put(`${CO}/PREPARED.json`,
    Buffer.from('{"new":"unapproved"}'))});
  assert.equal(r.status,'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE');
  assert.equal(r.code,'C_EVIDENCE_SNAPSHOT_DRIFT');
 }finally{g.cleanup();}
});

test('installed source drift and wrong baseline SHA both fail closed',()=>{
 const f=fixture();
 try{
  f.put(`${C}/controller/entry.mjs`,Buffer.from('tampered controller entry'));
  const r=f.run();
  assert.equal(r.code,'C_EVIDENCE_SOURCE_BYTE_DRIFT');
 }finally{f.cleanup();}
 const g=fixture();
 try{
  const r=g.run({originalObservation:{...g.originalObservation,
    backlogSha256:'0'.repeat(64)}});
  assert.equal(r.code,'C_EVIDENCE_SNAPSHOT_DRIFT');
 }finally{g.cleanup();}
});

test('pause boundary and metadata-only claim changes fail independently',()=>{
 const f=fixture();
 try{
  const r=f.run({originalObservation:{...f.originalObservation,
    pausedAt:'2026-11-10T01:00:00.000Z'}});
  assert.equal(r.code,'C_EVIDENCE_PAUSE_WINDOW_IDENTITY_DRIFT');
 }finally{f.cleanup();}
 const g=fixture();
 try{
  const r=g.run({afterFirstCapture:()=>{
    const file=path.join(g.root,...`${CO}/owner.json`.split('/'));
    const now=new Date();
    fs.utimesSync(file,now,new Date(now.getTime()+65000));
  }});
  assert.equal(r.code,'C_EVIDENCE_SNAPSHOT_DRIFT');
 }finally{g.cleanup();}
});
