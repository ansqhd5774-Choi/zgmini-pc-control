// Incident-specific, fail-closed roll-forward reconciliation for Writer B #1063.
// Pure decision/transaction orchestration; all I/O is supplied by a separately
// approved and source-pinned Windows adapter. This module never retries #1063.

export const INCIDENT_ID='bd435d7c-2939-457f-907c-98d551f6b8cf';
export const PREPARED_SHA='434f30d2aa221bddacab5afa09241916618d8e22';
export const BASE_SHA='825cfbd6e2025940e3e48631e7ff1dddf582e75a';
export const MODULE='lib/market-score/employment-r6-collector.mjs';
export const BEFORE_SHA='5be5155196c8539639f6bb5228d5af145646e0aff7f7c92a86ba3341d83efc39';
export const AFTER_SHA='f22b2f1447e462d3101caf027323572606db61352ab6a53524dd406cca7a4915';

export const FINGERPRINT=Object.freeze({
 journal:'5e19de532866e2f4e5795a7667dc7fe502c6b19d2e391e1ba5980e4ebc6ba509',
 backupConfig:'9fddecb8fb010e622ba9a607b2a4c904ab78feac402aca563e060d3ebb41b361',
 backupTask:'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
 backupPreimage:'382d8a8e59a7dcf94e44fa0c13c5cdf3ae654f448490588aa3fe5bce53b785e4',
 provenance:'d4675df57be56410cf6f52429ff485d333cbaab2ababf25d66a821444fe07048',
 config:'39920d27f3b6a3f4963fc7bd817421e1b94df81eacedd38ddbcf4af86ddd2c7f',
 disabledTaskXml:'b393a99571c3bf57d5c7c33f34f62cf8aa668aaa1f9d001d61c541464c6401e0',
});

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};

export function attestPreparedSnapshot(s,{afterEnable=false}={}){
 need(s?.status==='PASS'&&s.code==='WRITER_B_1063_RECOVERY_EVIDENCE_READONLY'&&
  s.incident==='WRITER_B_1063'&&s.requestId===INCIDENT_ID&&
  s.operationalWrites===0&&s.providerCalls===0&&s.d1Writes===0,
  'WRITER_B_1063_DIAGNOSTIC_NOT_PASS');
 need(s.journal?.sha256===FINGERPRINT.journal&&
  s.journal.lastPhase==='RECOVERY_REQUIRED'&&s.journal.entryCount===10,
  'WRITER_B_1063_JOURNAL_DRIFT');
 need(s.backups?.matchPreimage===true&&
  s.backups.configSha256===FINGERPRINT.backupConfig&&
  s.backups.taskXmlSha256===FINGERPRINT.backupTask&&
  s.backups.moduleSha256===BEFORE_SHA&&
  s.backups.preimageSha256===FINGERPRINT.backupPreimage,
  'WRITER_B_1063_BACKUP_DRIFT');
 need(s.provenance?.present===true&&
  s.provenance.sha256===FINGERPRINT.provenance&&
  s.provenance.preparedLocalSha===PREPARED_SHA,
  'WRITER_B_1063_PROVENANCE_DRIFT');
 need(s.lock?.state==='PRESENT'&&s.lock.matchesRequest===true&&
  s.lock.owner===INCIDENT_ID,'WRITER_B_1063_LOCK_OWNER_DRIFT');
 need(s.source?.head===PREPARED_SHA&&s.source.configSource===PREPARED_SHA&&
  s.source.headEqualsConfig===true&&s.source.headIsPreparedLocal===true&&
  s.source.sourcePair==='INCIDENT_PREPARED_PAIR'&&
  s.source.branchKind==='INCIDENT_LOCAL_BRANCH'&&
  s.source.module?.path===MODULE&&s.source.module.sha256===AFTER_SHA&&
  s.source.module.state==='AFTER'&&s.source.configSha256===FINGERPRINT.config,
  'WRITER_B_1063_PREPARED_SOURCE_DRIFT');
 need(s.coreTask?.name==='ZGMINI-PC-Local-Core'&&
  s.coreTask.definitionMatchesOriginalExceptEnabled===true,
  'WRITER_B_1063_CORE_DEFINITION_DRIFT');
 if(!afterEnable){
  need(s.coreTask.enabled===false&&s.coreTask.coreQuietSnapshot===true&&
   s.coreTask.xmlSha256===FINGERPRINT.disabledTaskXml,
   'WRITER_B_1063_CORE_NOT_QUIET');
 }else need(s.coreTask.enabled===true,
  'WRITER_B_1063_CORE_NOT_ENABLED');
 return true;
}

export function attestGitIntegrity(g){
 need(g?.head===PREPARED_SHA&&g?.branch===`writer-b/${INCIDENT_ID}`&&
  g.ref===PREPARED_SHA&&g.tree===g.provenanceTree&&
  g.parent===BASE_SHA&&g.singleParent===true&&
  g.baseTree===g.provenanceBaseTree&&
  /^[a-f0-9]{40}$/.test(g.baseTree??'')&&
  /^[a-f0-9]{40}$/.test(g.tree??'')&&g.trackedClean===true&&
  g.untrackedClean===true,
  'WRITER_B_1063_GIT_PROVENANCE_OR_DIRTY_DRIFT');
 return true;
}

/**
 * `io` must guarantee fixed paths, exact source-pinned GitHub B authorization,
 * Windows Task probe, one-time recovery ledger and durable journal writes.
 * Result is not a feature publish or first-install success claim.
 */
export async function reconcileWriterB1063(io){
 const required=['inspect','gitIntegrity','reserveOnce','enableCore',
  'appendPhase','finalizeLock'];
 need(io&&required.every(k=>typeof io[k]==='function'),
  'WRITER_B_1063_ADAPTER_INCOMPLETE');
 let sideEffectStarted=false,lockFinalized=false;
 try{
  attestPreparedSnapshot(await io.inspect());
  attestGitIntegrity(await io.gitIntegrity());
  // A second snapshot catches legitimate Core/task/source changes during
  // preflight. The one-shot ledger prevents a second B for the same incident.
  attestPreparedSnapshot(await io.inspect());
  await io.reserveOnce();
  // This one-shot reservation is intentionally consumed even if a subsequent
  // read-only CAS fails. Do not auto-retry: classify the failed reconciliation
  // from its durable attempt ledger and request a new approved decision.
  attestPreparedSnapshot(await io.inspect());
  attestGitIntegrity(await io.gitIntegrity());
  sideEffectStarted=true;
  await io.enableCore();
  attestPreparedSnapshot(await io.inspect(),{afterEnable:true});
  attestGitIntegrity(await io.gitIntegrity());
  await io.appendPhase('CORE_RESUMED');
  await io.finalizeLock(INCIDENT_ID);
  lockFinalized=true;
  await io.appendPhase('FINALIZED');
  return {status:'WRITER_B_1063_CORE_RECOVERED',
   code:'WRITER_B_1063_PREPARED_CORE_ENABLED_LOCK_FINALIZED',
   sourceSha:PREPARED_SHA,incidentRequestId:INCIDENT_ID,
   verified:true,lockFinalized:true,installationVerified:false,
   providerCalls:0,d1Writes:0};
 }catch(error){
  const code=/^WRITER_B_1063_[A-Z0-9_]{1,100}$/.test(error?.code??'')?
   error.code:'WRITER_B_1063_RECOVERY_STATE_UNKNOWN';
  return {status:sideEffectStarted?'WRITER_B_1063_STATE_UNKNOWN':
   'WRITER_B_1063_PREFLIGHT_STOP',code,
   incidentRequestId:INCIDENT_ID,lockFinalized,
   verified:false,installationVerified:false,
   retry:'NO_REEXECUTE_READONLY_RECONCILE',providerCalls:0,d1Writes:0};
 }
}
