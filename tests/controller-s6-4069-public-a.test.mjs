import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {inspectS64069ReconciliationReadonly} from '../controller/s6-journal-readonly.mjs';
import {publicPcReportProjection as projectS6PublicReceipt} from '../controller/common.mjs';
test('Public A #4069 verifies only fixed historical failure and resume, keeps journal local',()=>{
 const id='pc-s6-63afb126-72dc-4ec5-a721-4819771fa9ee';
 const ref='1fceeba061f7f8731811220b27cac245bd91d44e87d68935cd8475117f094141';
 const approval=fs.readFileSync(new URL('../approvals/controller-s6/'+ref+'.json',import.meta.url));
 const fixture=(journalPatch={},backlogPatch={},missing=null)=>{
  const owned='maintenance/ledger/S6_ONCE_'+id;
  const files=new Map([
   ['source/approvals/controller-s6/'+ref+'.json',approval],
   ['control/leases/supervisor/owner.json',Buffer.from('{}')],
   [owned+'/claim.json',Buffer.from(JSON.stringify({schema:'ZGMINI_S6_CLAIM_V1',requestId:id,nonce:'12345678-1234-1234-1234-123456789012'}))],
   [owned+'/journal.json',Buffer.from(JSON.stringify({schema:'ZGMINI_S6_ONCE_JOURNAL_V1',requestId:id,phase:'RECOVERY_REQUIRED',failedAt:'WATCHDOG_RELEASE_OUTCOME_UNVERIFIED',code:'S6_PORT_PROMOTION_UNVERIFIED',mutationAttempted:true,leaseReleaseAcknowledged:true,...journalPatch}))],
   [owned+'/backlog.json',Buffer.from(JSON.stringify({schema:'ZGMINI_PC_BACKLOG_V1',requestId:id,pausedAt:'2026-11-26T19:14:00Z',resumedAt:'2026-11-26T19:16:00Z',windows:[{pausedAt:'2026-11-26T19:14:00Z',resumedAt:'2026-11-26T19:16:00Z'}],...backlogPatch}))]
  ]);
  if(missing)files.delete(owned+'/'+missing);
  const normalize=p=>p.replace(/\\/g,'/');
  const absent=()=>{throw Object.assign(Error('private local path'),{code:'ENOENT'});};
  return {sourceRoot:'source',maintenanceHome:'maintenance',controllerHome:'control',io:{
   lstatSync(p){p=normalize(p);if(p==='maintenance/ledger'||p===owned)return {isDirectory:()=>true,isSymbolicLink:()=>false};const b=files.get(p);if(!b)return absent();return {isFile:()=>true,isSymbolicLink:()=>false,nlink:1,size:b.length};},
   readFileSync(p){return files.get(normalize(p))??absent();}
  }};
 };
 const matched=inspectS64069ReconciliationReadonly(fixture());
 assert.equal(matched.status,'PASS');assert.equal(matched.originalS6SuccessEstablished,false);
 assert.equal(matched.evidence.journalPhase,'RECOVERY_REQUIRED');
 assert.equal(matched.operationalWrites,0);
 for(const args of [fixture({phase:'PROMOTED_READBACK_VERIFIED'}),fixture({requestId:'other'}),fixture({leaseReleaseAcknowledged:false}),fixture({}, {windows:[{pausedAt:'2026-11-26T19:14:00Z',resumedAt:null}]}),fixture({}, {}, 'journal.json')]){
  assert.equal(inspectS64069ReconciliationReadonly(args).status,'STATE_UNKNOWN');
 }
 const publicResult=projectS6PublicReceipt({schema:'ZGMINI_PC_RESULT_V1',jobId:'run-123-1-seat-1',requestId:'pc-test-4069',operation:'controller-s6-4069-journal-readonly',seat:1,status:matched.status,result:matched});
 assert.equal(publicResult.status,'PASS');
 assert.equal(publicResult.code,'PUBLIC_RESULT_CODE_REDACTED');
 assert.equal(Object.hasOwn(publicResult,'result'),false);
 assert.doesNotMatch(JSON.stringify(publicResult),/RECOVERY_REQUIRED|nonce|WATCHDOG_RELEASE|journalPhase|maintenance\//);
 const policy=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 assert.deepEqual(policy.operations['controller-s6-4069-journal-readonly'],{grade:'A',timeoutSeconds:60,resource:'light'});
});
