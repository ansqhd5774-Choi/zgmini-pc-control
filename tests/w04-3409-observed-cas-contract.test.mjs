import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateApproval,CAS_PATHS} from '../tools/w04-3409-independent-source-prep.mjs';
import {permittedInstalledRecoveryProtection} from '../tools/maintenance-recovery.mjs';

const readJson=relative=>JSON.parse(readFileSync(new URL('../'+relative,import.meta.url),'utf8'));
const original=readJson('approvals/maintenance-recoveries/pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0.installed.json');
const addendum=readJson('approvals/maintenance-recoveries/pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0.post-writer.json');
const readback=readJson('results/pc-process-inventory-45485257529-1-operating.json');
const observed=readback.w043409MaintenanceStatus;
const approvedCas=original.casDigests;
const liveCas=observed.recoveryCas.casDigests;
const originalKeys=['ledgerSha256','ownerSha256','markerSha256','backlogSha256','snapshotSha256','protectionSha256'];

test('#3409 observed immutable V1 receipt preserves six original CAS and changes Writer only',()=>{
 assert.equal(original.schema,'ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1');
 assert.equal(readback.status,'PASS');
 assert.equal(readback.operationalWrites,0);
 assert.equal(readback.runId,'45485257529');
 assert.equal(observed.requestId,original.requestId);
 assert.equal(observed.actualControllerSha,original.targetControllerSha);
 assert.equal(observed.recoveryEvidence.leaseHeld,true);
 assert.equal(observed.recoveryCas.status,'LINEAGE_CORRELATED');
 assert.equal(observed.protectedDifferenceClass,'WRITER_CONFIG_ONLY');
 assert.equal(observed.recoveryEligible,false);
 assert.equal(observed.sourcePreflight.code,'SOURCE_OBJECT_ABSENT');
 assert.deepEqual(Object.keys(approvedCas).sort(),Object.keys(liveCas).sort());
 for(const key of originalKeys)assert.equal(liveCas[key],approvedCas[key],key+' must remain unchanged');
 assert.equal(approvedCas.writerSha256,'00e1b32c9983a8630ca5fd9ed99eafcf6c7eaeac39dbcdb7b68111906d778c64');
 assert.equal(liveCas.writerSha256,'16bfe9b88497e5c52bf22079856ad5224b97ab9f4ef093dcc706a75de34a6066');
 assert.notEqual(liveCas.writerSha256,approvedCas.writerSha256);
});

test('#3409 original protection rejects Writer-only delta without verified Writer B bridge',()=>{
 const w04={allowUnchangedBaseline:true};
 const approvedWriterOnly={allowed:true,code:'RECOVERY_CURRENT_WRITER_CONFIG_PRESERVED',preservedWriterConfig:true};
 const unchanged={allowed:true,code:'RECOVERY_ORIGINAL_PROTECTION_UNCHANGED',preservedWriterConfig:false};
 assert.equal(permittedInstalledRecoveryProtection(w04,approvedWriterOnly),false);
 assert.equal(permittedInstalledRecoveryProtection(w04,approvedWriterOnly,false),false);
 assert.equal(permittedInstalledRecoveryProtection(w04,approvedWriterOnly,true),true);
 assert.equal(permittedInstalledRecoveryProtection(w04,unchanged),true);
 assert.equal(permittedInstalledRecoveryProtection(w04,{allowed:false,code:'RECOVERY_OTHER_PROTECTED_STATE_DRIFT'}),false);
});

test('#3409 V2 preparation validates separately pinned addendum, not historical V1',()=>{
 assert.equal(validateApproval(addendum),true);
 assert.throws(()=>validateApproval(original),/PREP_APPROVAL_IDENTITY_MISMATCH/);
 for(const key of originalKeys)assert.equal(addendum.casDigests[key],approvedCas[key]);
 assert.equal(addendum.casDigests.writerSha256,liveCas.writerSha256);
 assert.notEqual(addendum.casDigests.writerSha256,approvedCas.writerSha256);
 const changed=structuredClone(addendum);
 changed.casDigests.writerSha256='0'.repeat(64);
 assert.throws(()=>validateApproval(changed),/PREP_CAS_CONTRACT_INVALID/);
 const inconsistent=structuredClone(addendum);
 inconsistent.previousRecoveryApprovalSha256='0'.repeat(64);
 assert.throws(()=>validateApproval(inconsistent),/PREP_APPROVAL_IDENTITY_MISMATCH/);
 assert.deepEqual(Object.keys(CAS_PATHS).sort(),['ledger','owner','marker','backlog','snapshot','protection','writer'].sort());
});
