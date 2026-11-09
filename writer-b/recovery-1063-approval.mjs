// Immutable source-reviewed recovery approval. The Issue cannot select a file.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {INCIDENT_ID,PREPARED_SHA,BASE_SHA,FINGERPRINT,MODULE,AFTER_SHA,BEFORE_SHA}
 from './recovery-1063-core.mjs';

export const APPROVAL_FILE='approvals/writer-recoveries/writer-b-1063-reconcile-20261109.json';
export const APPROVAL_SHA256='33ceb5c1d51df7010f6836c9b080c80d91bbf4287a0aec0e70bb55a420a8573e';
const need=(p,code)=>{if(!p)throw Object.assign(new Error(code),{code});};
export function verifyRecoveryApproval(controlRoot,{io=fs}={}){
 const file=path.join(controlRoot,...APPROVAL_FILE.split('/'));
 const stat=io.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=4096,
  'WRITER_B_1063_APPROVAL_FILE_UNSAFE');
 const raw=io.readFileSync(file);
 need(createHash('sha256').update(raw).digest('hex')===APPROVAL_SHA256,
  'WRITER_B_1063_APPROVAL_HASH_DRIFT');
 const x=JSON.parse(raw.toString('utf8'));
 need(x.schema==='ZGMINI_PC_WRITER_B_1063_RECOVERY_APPROVAL_V1'&&
  x.status==='APPROVED_B'&&
  x.scope==='INCIDENT_1063_ONLY'&&
  x.incidentRequestId===INCIDENT_ID&&x.runCount===1&&
  x.originalManifestSha256===
   '984ee506c54c1c97de31d5af4d0369cc2e8c0b5557334146748628110be709f7'&&
  x.preparedSourceSha===PREPARED_SHA&&x.baseSourceSha===BASE_SHA&&
  x.journalSha256===FINGERPRINT.journal&&
  x.provenanceSha256===FINGERPRINT.provenance&&
  x.backupConfigSha256===FINGERPRINT.backupConfig&&
  x.backupTaskXmlSha256===FINGERPRINT.backupTask&&
  x.backupPreimageSha256===FINGERPRINT.backupPreimage&&
  x.backupModuleSha256===BEFORE_SHA&&
  x.preparedConfigSha256===FINGERPRINT.config&&
  x.disabledCoreTaskXmlSha256===FINGERPRINT.disabledTaskXml&&
  x.modulePath===MODULE&&x.moduleAfterSha256===AFTER_SHA&&
  x.coreTask==='ZGMINI-PC-Local-Core'&&
  JSON.stringify(x.permittedEffects)===JSON.stringify([
   'ENABLE_EXISTING_CORE_TASK','ARCHIVE_AND_FINALIZE_EXACT_INCIDENT_LOCK'])&&
  ['allowSourceWrites','allowConfigWrites','allowOtherTaskWrites',
   'allowProviderCalls','allowD1Writes'].every(k=>x[k]===false),
  'WRITER_B_1063_APPROVAL_SCOPE_DRIFT');
 return APPROVAL_SHA256;
}
