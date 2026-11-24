import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateApproval,verifyCas,CAS_PATHS} from '../tools/w04-3409-independent-source-prep.mjs';
import {permittedInstalledRecoveryProtection} from '../tools/maintenance-recovery.mjs';

const readJson=relative=>JSON.parse(readFileSync(new URL('../'+relative,import.meta.url),'utf8'));
const approval=readJson('approvals/maintenance-recoveries/pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0.installed.json');
const readback=readJson('results/pc-process-inventory-45485257529-1-operating.json');
const observed=readback.w043409MaintenanceStatus;
const approvedCas=approval.casDigests;
const liveCas=observed.recoveryCas.casDigests;
const originalKeys=['ledgerSha256','ownerSha256','markerSha256','backlogSha256','snapshotSha256','protectionSha256'];

test('#3409 observed immutable receipt preserves six original CAS and changes Writer only',()=>{
 assert.equal(validateApproval(approval),true);
 assert.equal(readback.status,'PASS');
 assert.equal(readback.operationalWrites,0);
 assert.equal(readback.runId,'45485257529');
 assert.equal(observed.requestId,approval.requestId);
 assert.equal(observed.actualControllerSha,approval.targetControllerSha);
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

test('#3409 unchanged-only protection rejects an independently approved Writer-only delta',()=>{
 const w04={allowUnchangedBaseline:true};
 const approvedWriterOnly={allowed:true,code:'RECOVERY_CURRENT_WRITER_CONFIG_PRESERVED',preservedWriterConfig:true};
 const unchanged={allowed:true,code:'RECOVERY_ORIGINAL_PROTECTION_UNCHANGED',preservedWriterConfig:false};
 assert.equal(permittedInstalledRecoveryProtection(w04,approvedWriterOnly),false);
 assert.equal(permittedInstalledRecoveryProtection(w04,unchanged),true);
 assert.equal(permittedInstalledRecoveryProtection(w04,{allowed:false,code:'RECOVERY_OTHER_PROTECTED_STATE_DRIFT'}),false);
});

test('#3409 source preparation accepts historical approval but not a silent Writer repin',()=>{
 const changed=structuredClone(approval);
 changed.casDigests.writerSha256=liveCas.writerSha256;
 changed.approvedCurrentWriterConfigSha256=liveCas.writerSha256;
 // Structural validation alone is insufficient to authorize a new recovery.
 assert.equal(validateApproval(changed),true);
 assert.notDeepEqual(changed.casDigests,approval.casDigests);
 // An unauthorized change to the current Writer pin alone must be rejected.
 const inconsistent=structuredClone(approval);
 inconsistent.approvedCurrentWriterConfigSha256=liveCas.writerSha256;
 assert.throws(()=>validateApproval(inconsistent),/PREP_CAS_CONTRACT_INVALID/);
 // verifyCas must continue to compare all seven files independently.
 assert.deepEqual(Object.keys(CAS_PATHS).sort(),['ledger','owner','marker','backlog','snapshot','protection','writer'].sort());
});
