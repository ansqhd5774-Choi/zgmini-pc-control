import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {FIXED} from '../tools/s6-4078-backlog-only-plan.mjs';
import {readS64078LocalBytes as read} from '../tools/s6-4078-windows-local-readonly.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const APPROVAL='1fceeba061f7f8731811220b27cac245bd91d44e87d68935cd8475117f094141';
const approvalSource=path.join(process.cwd(),'approvals','controller-s6',APPROVAL+'.json');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'s6-4078-readonly-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const maintenanceRoot=path.join(root,'maintenance');
 const sourceRoot=path.join(root,'source');
 const controllerRoot=path.join(root,'controller');
 const ledger=path.join(maintenanceRoot,'ledger','S6_ONCE_'+FIXED.s6RequestId);
 const approval=path.join(sourceRoot,'approvals','controller-s6',APPROVAL+'.json');
 const owner=path.join(controllerRoot,'leases','supervisor','owner.json');
 for(const p of [ledger,path.dirname(approval),path.dirname(owner)])
  fs.mkdirSync(p,{recursive:true});
 const paths={maintenanceRoot,sourceRoot,controllerRoot,windowsPlatform:'win32'};
 fs.copyFileSync(approvalSource,approval);
 fs.writeFileSync(owner,'{"pid":20000,"nonce":"a"}');
 fs.writeFileSync(path.join(ledger,'claim.json'),JSON.stringify({
  schema:'ZGMINI_S6_CLAIM_V1',requestId:FIXED.s6RequestId,
  nonce:'12345678-1234-1234-1234-123456789abc'}));
 fs.writeFileSync(path.join(ledger,'journal.json'),JSON.stringify({
  schema:'ZGMINI_S6_ONCE_JOURNAL_V1',requestId:FIXED.s6RequestId,
  phase:'RECOVERY_REQUIRED',code:'S6_PORT_PROMOTION_UNVERIFIED',
  failedAt:'WATCHDOG_RELEASE_OUTCOME_UNVERIFIED'
 }));
 fs.writeFileSync(path.join(ledger,'backlog.json'),JSON.stringify({
  schema:'ZGMINI_PC_BACKLOG_V1',requestId:FIXED.s6RequestId,
  windows:[{pausedAt:'2026-11-26T19:12:00Z',
   resumedAt:'2026-11-26T19:16:00Z'}],replays:{}
 }));
 return {paths,ledger,approval,owner};
}
test('Windows local S6 reader returns double-read bytes but no replay authority',t=>{
 const f=fixture(t);const r=read(f.paths);
 assert.equal(r.status,'READ_ONLY_OBSERVED');
 assert.equal(r.code,'S6_4078_LOCAL_BYTES_SAMPLED');
 assert.equal(r.approvalSha256,APPROVAL);
 assert.equal(r.originalOwnerMatchesCurrent,false);
 assert.equal(r.ownerAndLeaseCasVerified,false);
 assert.equal(r.mutationAuthorized,false);assert.equal(r.operationalWrites,0);
 assert.equal(sha(r.localReadback.journalBefore),r.localReadback.journalSha256);
 assert.equal(sha(r.localReadback.backlogBefore),r.localReadback.backlogSha256);
 assert.equal(r.localReadback.backlogBefore,r.localReadback.backlogAfter);
});
test('non-Windows operator is rejected before local file read',()=>{
 const r=read({windowsPlatform:'linux'});
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.mutationAuthorized,false);
});
test('tampered S6 approval cannot be accepted as current source',t=>{
 const f=fixture(t);fs.appendFileSync(f.approval,' ');
 const r=read(f.paths);
 assert.equal(r.code,'S6_APPROVAL_SOURCE_CAS_DRIFT');
 assert.equal(r.operationalWrites,0);
});
test('CRLF checkout accepted only when canonical exact approval bytes match',t=>{
 const f=fixture(t);
 const original=fs.readFileSync(f.approval,'utf8');
 assert.ok(original.includes('\n'));
 fs.writeFileSync(f.approval,original.replace(/\n/g,'\r\n'));
 const r=read(f.paths);
 assert.equal(r.status,'READ_ONLY_OBSERVED');
 assert.equal(r.approvalSha256,APPROVAL);
 assert.equal(r.ownerAndLeaseCasVerified,false);
});
test('lone CR in approval file is not normalized',t=>{
 const f=fixture(t);
 const original=fs.readFileSync(f.approval,'utf8');
 fs.writeFileSync(f.approval,original.replace(/\n/g,'\r'));
 const r=read(f.paths);
 assert.equal(r.code,'S6_APPROVAL_SOURCE_CAS_DRIFT');
 assert.equal(r.operationalWrites,0);
});
test('claim requestId drift blocks local observation',t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.ledger,'claim.json'),
  JSON.stringify({schema:'ZGMINI_S6_CLAIM_V1',requestId:'changed',
   nonce:'12345678-1234-1234-1234-123456789abc'}));
 assert.equal(read(f.paths).code,'S6_ORIGINAL_CLAIM_UNVERIFIED');
});
test('missing journal cannot be represented as safe bytes',t=>{
 const f=fixture(t);fs.unlinkSync(path.join(f.ledger,'journal.json'));
 const r=read(f.paths);assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'S6_4078_LOCAL_SOURCE_OR_CAS_UNVERIFIED');
});
test('symlinked backlog cannot be read as authoritative source',t=>{
 const f=fixture(t);const original=path.join(f.ledger,'backlog.json');
 const replacement=path.join(f.ledger,'backup.json');
 fs.renameSync(original,replacement);
 fs.symlinkSync(replacement,original);
 const r=read(f.paths);assert.equal(r.code,'S6_4078_LOCAL_SOURCE_OR_CAS_UNVERIFIED');
});

test('journal mutation while reading backlog cannot pass as one S6 snapshot',t=>{
 const f=fixture(t);
 const journalPath=path.join(f.ledger,'journal.json');
 const original=fs.readFileSync(journalPath,'utf8');
 let backlogReads=0;
 const io={
  lstatSync:p=>fs.lstatSync(p),
  readFileSync:p=>{
   const bytes=fs.readFileSync(p);
   if(p.endsWith('backlog.json')&&++backlogReads===2)
    fs.writeFileSync(journalPath,original+' ');
   return bytes;
  }
 };
 const r=read({...f.paths,io});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'S6_LOCAL_CROSS_FILE_SNAPSHOT_CHANGED');
 assert.equal(r.mutationAuthorized,false);
 assert.equal(r.operationalWrites,0);
});
