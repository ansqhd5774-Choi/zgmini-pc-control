import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateStalledClaim,retainRollbackClaim} from '../tools/controller-rollback-recovery.mjs';
const h=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const requestId='pc-update-fixture';
 const claimBytes=Buffer.from(JSON.stringify({requestId,pid:123,nonce:'a'.repeat(36)}));
 const recordBytes=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_ROLLBACK_RECONCILIATION_V1',requestId,
  status:'RECOVERY_REQUIRED',originalPhase:'SWITCHED',code:'ROLLBACK_SUPERVISOR_SOURCE_UNKNOWN',
  failureOperation:'restore',actualInstalledSha:null}));
 const backlogBytes=Buffer.from('{}');
 return {requestId,claimBytes,recordBytes,backlogBytes,ownerAlive:false,
  approval:{resumeClaim:{ownerSha256:h(claimBytes),recordSha256:h(recordBytes),backlogSha256:h(backlogBytes)}}};
}
test('separately pinned dead guard-stop claim may be preserved for a fresh verified continuation',()=>{
 assert.equal(validateStalledClaim(fixture()),true);
});
for(const [name,change] of Object.entries({
 live:f=>f.ownerAlive=true,unknown:f=>f.ownerAlive=null,otherRequest:f=>f.requestId='pc-other',
 changedOwner:f=>f.claimBytes=Buffer.from('{}'),changedRecord:f=>f.recordBytes=Buffer.from('{}'),
 changedBacklog:f=>f.backlogBytes=Buffer.from('{"changed":true}'),
 unsafePhase:f=>{const r=JSON.parse(f.recordBytes);r.code='WRITE_OUTCOME_UNKNOWN';f.recordBytes=Buffer.from(JSON.stringify(r));f.approval.resumeClaim.recordSha256=h(f.recordBytes);},
 }))test('stalled continuation refuses '+name,()=>{const f=fixture();change(f);assert.throws(()=>validateStalledClaim(f));});

test('successful archive final record releases reservation while uncertain and pre-archive writes retain it',()=>{
 const done={mutationStarted:true,status:'ROLLED_BACK',leaseArchived:true};
 assert.equal(retainRollbackClaim(done,true),false);
 assert.equal(retainRollbackClaim(done,false),true);
 assert.equal(retainRollbackClaim({...done,leaseArchived:false},true),true);
 assert.equal(retainRollbackClaim({...done,status:'RECOVERY_REQUIRED'},true),true);
});
