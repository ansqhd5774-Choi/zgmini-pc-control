import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyReceiptCOperatorServiceCode,inspectReceiptCOperatorServiceReadonly,
 inspectReceiptCFixedPathsReadonly}
 from '../tools/ci-controller-b-c-operator-readonly.mjs';

test('fixed isolated service, native read-only query and identity is not serialized',()=>{
 let calls=0;
 const result=inspectReceiptCOperatorServiceReadonly({platform:'win32',
  run:(exe,args,opt)=>{
   calls++;
   assert.equal(exe,'powershell.exe');
   assert.deepEqual(args.slice(0,3),['-NoLogo','-NoProfile','-NonInteractive']);
   assert.match(args[4],/Get-CimInstance -ClassName Win32_Service -Filter/);
   assert.match(args[4],/actions\.runner\.ansqhd5774-Choi-zgmini-pc-control\.zgmini-handoff-ci-spare-01/);
   assert.match(args[4],/StartName/);
   assert.doesNotMatch(args[4],/Set-Acl|New-Item|Remove-Item|Set-Item|icacls|takeown|mkdir|New-LocalUser|Set-Service|Invoke-Expression/i);
   assert.equal(opt.shell,false);
   assert.equal(opt.windowsHide,true);
   assert.ok(opt.timeout<=10000);
   return {status:0,stdout:'DEDICATED_ACCOUNT_CANDIDATE\r\n'};
  }});
 assert.equal(calls,1);
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.cAccountCandidate,true);
 assert.equal(result.cOperatorApplied,false);
 assert.equal(result.runnerWritableVerified,false);
 assert.equal(result.crossRunDurabilityVerified,false);
 assert.equal(result.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(result),/LocalService|LocalSystem|NetworkService|StartName|S-1-5-21|secret/i);
});
test('shared service account cannot satisfy independent C packet as-is',()=>{
 const r=classifyReceiptCOperatorServiceCode('SHARED_ACCOUNT_STOP');
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'CI_RECEIPT_C_SHARED_ACCOUNT_STOP');
 assert.equal(r.cAccountCandidate,false);
 const notRunning=classifyReceiptCOperatorServiceCode('SERVICE_NOT_RUNNING');
 assert.equal(notRunning.status,'BLOCKED');
});
test('unknown, malformed and error paths do not invent service identity',()=>{
 for(const raw of ['','administrator','DEDICATED_ACCOUNT_CANDIDATE\nSECRET',
  'SHARED_ACCOUNT_STOP\nACCOUNT_UNVERIFIED',null,'C:\\private']) {
  assert.equal(classifyReceiptCOperatorServiceCode(raw).status,'STATE_UNKNOWN');
 }
 const unavailable=inspectReceiptCOperatorServiceReadonly({platform:'win32',
  run:()=>({status:1,stdout:'DEDICATED_ACCOUNT_CANDIDATE'})});
 assert.equal(unavailable.status,'STATE_UNKNOWN');
 assert.equal(inspectReceiptCOperatorServiceReadonly({platform:'linux'}).status,'STATE_UNKNOWN');
 assert.equal(inspectReceiptCOperatorServiceReadonly({platform:'win32',run:()=>{throw Error('PRIVATE')}}).status,'STATE_UNKNOWN');
});


function fakePaths({parent=false,root=false,alias=false,access=false}={}){
 const present=new Set(['C:\\','C:\\ProgramData']);
 if(parent)present.add('C:\\ProgramData\\ZGMINI-CI');
 if(root)present.add('C:\\ProgramData\\ZGMINI-CI\\ControllerBReceipts');
 const realpathSync=p=>alias&&p==='C:\\ProgramData'? 'C:\\redirect':p;
 realpathSync.native=realpathSync;
 return {
  lstatSync(p){
   if(access&&p==='C:\\ProgramData'){const e=new Error('PRIVATE');e.code='EACCES';throw e;}
   if(!present.has(p)){const e=new Error('missing');e.code='ENOENT';throw e;}
   return {isDirectory:()=>true,isSymbolicLink:()=>false};
  },
  realpathSync
 };
}
test('C receipt fixed path preflight reads known physical paths even when GitHub variable is absent',()=>{
 const r=inspectReceiptCFixedPathsReadonly({platform:'win32',filesystem:fakePaths()});
 assert.equal(r.status,'PARTIAL');
 assert.equal(r.code,'CI_RECEIPT_C_TARGET_ABSENT');
 assert.equal(r.parent,'ABSENT');
 assert.equal(r.receiptRoot,'ABSENT');
 assert.equal(r.fixedTargetVacantObserved,true);
 assert.equal(r.cOperatorApplied,false);
 assert.equal(r.githubVariableConfiguredVerified,false);
 assert.equal(r.actualRunnerWriteVerified,false);
 assert.equal(r.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(r),/C:\\|StartName|SID|secret/i);
});
test('C packet target already existing is distinguished from variable state',()=>{
 const p=inspectReceiptCFixedPathsReadonly({platform:'win32',filesystem:fakePaths({parent:true})});
 assert.equal(p.code,'CI_RECEIPT_C_PARENT_ALREADY_PRESENT');
 assert.equal(p.fixedTargetVacantObserved,false);
 const r=inspectReceiptCFixedPathsReadonly({platform:'win32',filesystem:fakePaths({parent:true,root:true})});
 assert.equal(r.code,'CI_RECEIPT_C_ROOT_ALREADY_PRESENT');
 assert.equal(r.receiptRoot,'DIRECTORY');
 assert.equal(r.githubVariableConfiguredVerified,false);
});
test('physical path alias and access errors fail closed without changing Windows ACL',()=>{
 const alias=inspectReceiptCFixedPathsReadonly({platform:'win32',filesystem:fakePaths({alias:true})});
 assert.equal(alias.status,'BLOCKED');
 assert.equal(alias.code,'CI_RECEIPT_C_PATH_ALIAS_STOP');
 const access=inspectReceiptCFixedPathsReadonly({platform:'win32',filesystem:fakePaths({access:true})});
 assert.equal(access.status,'STATE_UNKNOWN');
 assert.equal(access.fixedTargetVacantObserved,false);
 assert.equal(inspectReceiptCFixedPathsReadonly({platform:'linux'}).status,'STATE_UNKNOWN');
});
