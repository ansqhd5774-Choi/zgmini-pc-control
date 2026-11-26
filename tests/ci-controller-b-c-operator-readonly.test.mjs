import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyReceiptCOperatorServiceCode,inspectReceiptCOperatorServiceReadonly}
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
