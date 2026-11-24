import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync,spawn,spawnSync} from 'node:child_process';import {TextDecoder} from 'node:util';import {need,digest,writeJson} from './common.mjs';
import {waitForMemoryAdmission} from './memory-admission.mjs';
import {inspectFearGreedArchive} from './fear-greed-archive-readonly.mjs';
import {inspectCnnPublicReadback} from './cnn-public-d1-api-readback-readonly.mjs';
import {inspectAlpacaQuotaReadonly} from './alpaca-quota-readonly.mjs';
import {inspectPcSource} from './pc-source-readonly.mjs';
import {inspectWriterInstallPreimage} from './writer-install-preimage-readonly.mjs';
import {inspectWriterPublicationEvidence} from './writer-publication-evidence-readonly.mjs';
import {inspectEmploymentR6D1Readback} from './employment-r6-d1-readback-readonly.mjs';
import {inspectR54PublicReadback} from './market-r54-d1-api-readback-readonly.mjs';
import {inspectW05FiveKeyD1ApiReadback} from './w05-five-key-d1-api-readback-readonly.mjs';
import {inspectW05CloudflareActive} from './w05-cloudflare-deployment-readonly.mjs';
import {inspectInflationCensusM3ArchivedHeaders} from './inflation-census-m3-archived-headers-readonly.mjs';
import {inspectInflation7D1Readback} from './inflation7-d1-readback-readonly.mjs';
import {inspectCoreRuntimeSource} from './core-runtime-source-readonly.mjs';
import {readCompletedCoreLineage} from './core-completed-lineage-readonly.mjs';
import {readFixedW05InventoryChunk} from './w05-writer-inventory-chunk-readonly.mjs';
import {observeInflationCoreLock} from './inflation-core-lock-observation-readonly.mjs';
import {inspectInflationEvent129Once} from './inflation-event129-evidence-readonly.mjs';
import {inspectWriterB1063Recovery} from './writer-b-1063-recovery-readonly.mjs';
import {inspectSharedResourceReleaseReadonly} from './shared-resource-release-readonly.mjs';
import {inspectPcSourceOrigin} from './pc-source-origin-readonly.mjs';
import {inspectR54SixFileInventory} from './r54-sixfile-inventory-readonly.mjs';
import {inspectR54RuntimeBinding} from './r54-runtime-binding-readonly.mjs';
import {inspectR47TaskActionReadonly} from './theme-r47-task-action-readonly.mjs';
import {inspectR17Windows,R17_PATCH_TEXT} from './us-breadth-r17-preflight.mjs';
import {inspectUsBreadthR17Runtime} from './us-breadth-r17-runtime-readonly.mjs';
import {inspectR17PostCancel,ONE_SHOT_DIAGNOSTIC_ID} from './r17-268-postcancel-readonly.mjs';
import {inspectER1SavedInput} from './market-calendar-er1-saved-readonly.mjs';
import {inspectInflationCausalSaved} from './inflation-causal-saved-readonly.mjs';
import {inspectDeltaR44CheckpointEvidence} from './market-calendar-r44-runtime-readonly.mjs';
import {inspectR44ExistingInputAudit} from './market-calendar-r44-input-audit-readonly.mjs';
import {inspectR44ProductionReadonly} from './market-calendar-r44-production-readonly.mjs';
import {inspectER1NovemberAvailability} from './market-calendar-er1-nov30-availability-readonly.mjs';
import {inspectAssetR10Publication} from './asset-r10-publication-readonly.mjs';
import {inspectAssetR10SourceBytes} from './asset-r10-source-readonly.mjs';
import {inspectD05LineageReadonly,summarizeD05LineageOperation} from './d05-lineage-readonly.mjs';
import {inspectSectorR3DatedLedger} from './sector-r3-dated-ledger-readonly.mjs';
import {inspectSectorR3D1ApiReadback} from './sector-r3-d1-api-readback-readonly.mjs';
import {inspectReleaseCalendarRuntime} from './release-calendar-runtime-readonly.mjs';
import {inspectSourceInventory} from './source-inventory-runtime-readonly.mjs';
import {inspectProviderActivity} from './provider-activity-runtime-readonly.mjs';
import {inspectThemeL7RuntimeReadonly} from './theme-l7-runtime-readonly.mjs';
import {inspectNineR32RawCoverage} from './theme-nine-r32-raw-coverage-readonly.mjs';
import {inspectA401Private23} from './inflation-a401-private23-readonly.mjs';
import {inspectA407IntegrityReadonly} from './inflation-a407-integrity-readonly.mjs';
import {inspectInflation19RuntimeReadonly} from './inflation19-runtime-readonly.mjs';
import {inspectInflationR2LocalReadonly} from './inflation-r2-local-readonly.mjs';
import {inspectInflationR2D1Readback} from './inflation-r2-d1-readback-readonly.mjs';
import {inspectInflationCandidatesRuntimeReadonly} from './inflation-candidates-runtime-readonly.mjs';
import {inspectEmploymentR6Candidate} from './employment-r6-candidate-readonly.mjs';
import {inspectEmploymentR6HostCas} from './employment-r6-host-cas-readonly.mjs';
import {inspectEmploymentR6WalMemoryPreflight} from './employment-r6-wal-memory-readonly.mjs';
import {inspectEmploymentR6CollectionEvidence,R6_READONLY_STAGES} from './employment-r6-collection-evidence-readonly.mjs';
import {inspectEmploymentR6RawRunLight} from './employment-r6-raw-run-attestation-readonly.mjs';
import {inspectBeaMfgArchiveReadonly} from './earnings-bea-mfg-archive-readonly.mjs';
import {inspectBeaUnitArchiveReadonly} from './earnings-bea-unit-archive-readonly.mjs';
import {inspectBeaNipaCaptureReadonly} from './earnings-bea-nipa-capture-readonly.mjs';
import {runW05ServiceStoredReadonly} from './w05-wpsfd42-service-readonly.mjs';
import {inspectInflation19D1Readback} from './inflation19-d1-readback-readonly.mjs';
const activeTasks=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'];
const retiredIranTask='ZGMINI-PC-Iran-Progress-R13';
const taskNotFound=text=>/cannot find the file|cannot find the specified|does not exist|지정.*(?:파일|작업|경로).*찾을 수 없|찾을 수 없.*(?:파일|작업|경로)/i.test(text);
const decodeTaskOutput=bytes=>new TextDecoder('euc-kr').decode(bytes);
export function attestRetiredIranAbsence({exact,inventory}){
 // Never treat a bare nonzero schtasks exit as evidence of absence:
 // access denial, scheduler failures, and name drift must remain blocking.
 need(exact&&!exact.error&&!exact.signal,'RETIRED_IRAN_QUERY_UNCERTAIN');
 need(exact.status!==0,'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE');
 need(exact.status===1&&taskNotFound(decodeTaskOutput(exact.stderr??Buffer.alloc(0))),
  'RETIRED_IRAN_QUERY_UNCERTAIN');
 // Preserve the existing fail-closed code while distinguishing a failed
 // scheduler command from a successful command with an unparseable inventory.
 const inventoryError=probeReason=>Object.assign(
  new Error('RETIRED_IRAN_INVENTORY_UNAVAILABLE'),
  {code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE',probeReason});
 if(!inventory||inventory.error||inventory.signal||inventory.status!==0)
  throw inventoryError('SCHTASKS_INVENTORY_COMMAND_FAILED');
 const names=decodeTaskOutput(inventory.stdout??Buffer.alloc(0)).split(/\r?\n/)
  .map(line=>line.match(/^\s*"([^"]+)"\s*,/)?.[1]??null).filter(Boolean);
 if(names.length===0)throw inventoryError('SCHTASKS_INVENTORY_EMPTY_PARSE');
 need(!names.some(name=>/ZGMINI-PC-Iran/i.test(name)),'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE');
 return 'APPROVED_RETIRED_ABSENT';
}
export function nativeRetiredIranEvidence(){
 const schtasks=path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe');
 const opt={windowsHide:true,timeout:15000,maxBuffer:4000000};
 return attestRetiredIranAbsence({
  exact:spawnSync(schtasks,['/Query','/TN',retiredIranTask,'/XML'],opt),
  inventory:spawnSync(schtasks,['/Query','/FO','CSV','/NH'],opt)
 });
}
export function protectedState(dataRoot,{queryTask,retiredTaskEvidence=nativeRetiredIranEvidence}={}){
 const output={files:{},tasks:{}};
 for(const name of ['config.json','quota-runner.cmd','run-local.cmd']){const f=path.join(dataRoot,'pc-writer',name);if(fs.existsSync(f))output.files[name]=digest(fs.readFileSync(f));}
 if(queryTask){
  for(const task of activeTasks)output.tasks[task]=digest(queryTask(task));
  output.tasks[retiredIranTask]=retiredTaskEvidence();
 }
 return output;
}
// Project only bounded, non-sensitive R6 status from existing Core/Writer ledgers.
const r6GroupNames=new Set([
 'DOL_UI_WEEKLY_CLAIMS','BLS_EMPLOYMENT_SITUATION','BLS_JOLTS',
 'BLS_ECI','BLS_STATE_MSA','BLS_BED',
]);
const r6Code=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,99}$/.test(value)?value:null;
const r6Count=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000?value:null;
function r6CollectionProjection(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const rows=(items,planned)=>Array.isArray(items)?items.slice(0,12).flatMap(item=>{
  if(!item||!r6GroupNames.has(item.groupName))return [];
  const status=r6Code(item.status);
  if(!status)return [];
  return [{groupName:item.groupName,status,
   ...(r6Code(item.failureCode)?{failureCode:r6Code(item.failureCode)}:{}),
   ...(!planned&&r6Count(item.providerRequests)!==null?{providerRequests:item.providerRequests}:{}),
   ...(planned?{due:item.due===true}: {})}];
 }).slice(0,6):[];
 return {status:r6Code(raw.status),code:r6Code(raw.code),
  providerRequests:r6Count(raw.providerRequests),
  groups:rows(raw.groups,false),plannedGroups:rows(raw.plannedGroups,true)};
}
function r6LocalResultReadback(root,checksum,asOfDate,sourceStoredAt){
 if(!/^[a-f0-9]{64}$/.test(checksum??''))return 'NO_HASH';
 const folder=path.join(root,'employment-r6-public-results');
 const file=path.join(folder,checksum+'.json');
 try{
  const dir=fs.lstatSync(folder),stat=fs.lstatSync(file);
  if(!dir.isDirectory()||dir.isSymbolicLink()||!stat.isFile()||stat.isSymbolicLink()
    ||stat.size<1||stat.size>8*1024*1024)return 'UNSAFE_OR_OVERSIZE';
  const body=JSON.parse(fs.readFileSync(file,'utf8'));
  if(digest(JSON.stringify(body))!==checksum)return 'HASH_MISMATCH';
  if(body?.kind!=='EMPLOYMENT_R6_ONE_YEAR_STORED_DISPLAY_R1'
    ||!Array.isArray(body?.indicators)||body.indicators.length!==29
    ||body.asOfDate!==asOfDate||body.sourceStoredAt!==sourceStoredAt)
    return 'METADATA_MISMATCH';
  // Model provenance is read exclusively from the same checksum-verified body.
  if(!/^EMP-R6-FORMULA-R(?:[0-9]{1,2}|2-CPS-2025-10)$/.test(body.methodologyVersion??'')
    ||!/^sha256:[a-f0-9]{64}$/.test(body.formulaHash??''))return 'MODEL_PROVENANCE_INVALID';
  return {status:'VERIFIED',methodologyVersion:body.methodologyVersion,
   formulaHash:body.formulaHash};
 }catch(error){return error?.code==='ENOENT'?'MISSING':'READ_FAILED';}
}
function r6PublicationProjection(report,root){
 const raw=report?.employmentR6OneYear;
 const failure=Array.isArray(report?.failures)
  ?report.failures.find(item=>item?.id==='employment-r6-one-year-publication'):null;
 if(!raw&&!failure)return null;
 const safeDate=typeof raw?.asOfDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.asOfDate)?raw.asOfDate:null;
 const sourceStoredAt=Number.isSafeInteger(raw?.sourceStoredAt)&&raw.sourceStoredAt>0?raw.sourceStoredAt:null;
 const projected={status:r6Code(raw?.status),failureCode:r6Code(failure?.reason),
  asOfDate:safeDate,sourceStoredAt,
  sourceFeatures:r6Count(raw?.sourceFeatures),
  chartReadyFeatures:r6Count(raw?.chartReadyFeatures),
  recentlyObservedFeatures:r6Count(raw?.recentlyObservedFeatures)};
 const localHash=typeof raw?.localResultHash==='string'&&/^[a-f0-9]{64}$/.test(raw.localResultHash)?raw.localResultHash:null;
 if(localHash!==null){
  projected.localResultHash=localHash;
  projected.localResultStored=typeof raw?.localResultStored==='boolean'?raw.localResultStored:null;
  const result=r6LocalResultReadback(root,localHash,safeDate,sourceStoredAt);
  projected.localResultReadback=typeof result==='string'?result:result.status;
  if(typeof result==='object'&&result?.status==='VERIFIED'){
   projected.methodologyVersion=result.methodologyVersion;
   projected.formulaHash=result.formulaHash;
  }
 }
 return projected;
}
export function readCore(dataRoot,{queryTask,retiredTaskEvidence=nativeRetiredIranEvidence}={}){
 const root=path.join(dataRoot,'pc-writer'),out={lockPresent:fs.existsSync(path.join(root,'local-cycle.lock')),checkpoints:{},taskXmlHashes:{}};
 for(const file of ['local-cycle-last-run.json','local-collection-last-run.json','local-writer-last-run.json']){
  const p=path.join(root,file);if(!fs.existsSync(p)){out.checkpoints[file]={exists:false};continue;}
  const s=fs.statSync(p);let data;try{data=JSON.parse(fs.readFileSync(p));}catch{data={};}
  out.checkpoints[file]={exists:true,modifiedAt:s.mtime.toISOString(),bytes:s.size,status:typeof data.status==='string'&&/^[A-Z0-9_:-]{1,80}$/.test(data.status)?data.status:null};
  if(file==='local-collection-last-run.json'){
   const employmentR6=r6CollectionProjection(data.employmentR6Collection);
   if(employmentR6)out.checkpoints[file].employmentR6=employmentR6;
  }
  if(file==='local-writer-last-run.json'){
   const employmentR6=r6PublicationProjection(data,root);
   if(employmentR6)out.checkpoints[file].employmentR6=employmentR6;
  }
 }
 const config=path.join(root,'config.json');if(fs.existsSync(config)){const c=JSON.parse(fs.readFileSync(config));const x=c.source;out.approvedSourceSha=[x?.sha,x?.commit,x?.commitSha,x,c.sourceSha].find(v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v))??null;}
 if(queryTask){
  for(const task of activeTasks)out.taskXmlHashes[task]=digest(queryTask(task));
  out.taskXmlHashes[retiredIranTask]=retiredTaskEvidence();
 }
 return out;
}
export function nativeTaskXml(task){return execFileSync(path.join(process.env.SystemRoot||'C:/Windows','System32','schtasks.exe'),['/Query','/TN',task,'/XML'],{windowsHide:true,timeout:12000,maxBuffer:262144});}
export async function runOperation(request,context){
 const {workspace,dataRoot,policy,host,queryTask=nativeTaskXml,retiredTaskEvidence=nativeRetiredIranEvidence}=context;
 if(request.operation==='runner-smoke')return {status:'PASS',code:'RUNNER_COMMAND_EXECUTED',seat:context.seat,resource:{totalMiB:Math.floor(os.totalmem()/1048576),freeMiB:Math.floor(os.freemem()/1048576)},execution: 'CMD_TO_PINNED_NODE',providerCalls:0,d1Writes:0};
 if(request.operation==='core-status'){
  // Only the fixed engine's missing pre-snapshot activates this scope. The
  // outer result must remain STATE_UNKNOWN; local Core evidence is still useful.
  const partial=context.skipProtectedTaskObservation===true&&policy.mutationsEnabled===false;
  return {status:'PASS',code:'CORE_READONLY_DIAGNOSIS',core:readCore(dataRoot,partial?{}:{queryTask,retiredTaskEvidence}),
   ...(partial?{taskObservation:'UNVERIFIED'}:{}),providerCalls:0,d1Writes:0,sqliteOpened:false};
 }
 if(request.operation==='d05-lineage-readonly')return summarizeD05LineageOperation(
  inspectD05LineageReadonly(dataRoot,{approvedSourceSha:readCore(dataRoot).approvedSourceSha}));
 if(request.operation==='sector-r3-dated-ledger-readonly')return inspectSectorR3DatedLedger(dataRoot);
 if(request.operation==='sector-r3-d1-api-readback-readonly')return inspectSectorR3D1ApiReadback(dataRoot);
 if(request.operation==='core-runtime-source-readonly')return inspectCoreRuntimeSource();
 if(request.operation==='core-completed-lineage-readonly')return readCompletedCoreLineage();
 if(/^w05-writer-inventory-chunk-[0-4]-readonly$/.test(request.operation))return readFixedW05InventoryChunk(request.operation);
 if(request.operation==='inflation-core-lock-observation-readonly')
  return observeInflationCoreLock({queryTask});
 if(request.operation==='inflation-event129-evidence-readonly')
  return inspectInflationEvent129Once();
 if(request.operation==='shared-resource-release-readonly')return inspectSharedResourceReleaseReadonly({dataRoot,queryTask});
  if(request.operation==='writer-b-1063-recovery-readonly')return inspectWriterB1063Recovery();
 if(request.operation==='fear-greed-archive-status')return inspectFearGreedArchive(dataRoot,{queryTask});
 if(request.operation==='cnn-public-d1-api-readback-readonly')return await inspectCnnPublicReadback(dataRoot);
 if(request.operation==='alpaca-quota-readonly')return inspectAlpacaQuotaReadonly(dataRoot);
 if(request.operation==='pc-source-preflight')return inspectPcSource({dataRoot,coreTaskXml:queryTask('ZGMINI-PC-Local-Core')});
 if(request.operation==='writer-install-preimage-readonly')return inspectWriterInstallPreimage(dataRoot,{coreTaskXml:queryTask('ZGMINI-PC-Local-Core'),approvedPreimageScope:context.approvedPreimageScope});
 if(request.operation==='writer-publication-evidence-readonly')return inspectWriterPublicationEvidence(dataRoot);
 if(request.operation==='employment-r6-d1-readback-readonly')return inspectEmploymentR6D1Readback(dataRoot);
 if(request.operation==='market-r54-d1-api-readback-readonly')return inspectR54PublicReadback(dataRoot);
 if(request.operation==='w05-five-key-d1-api-readback-readonly')return await inspectW05FiveKeyD1ApiReadback(dataRoot);
 if(request.operation==='w05-cloudflare-deployment-readonly')return await inspectW05CloudflareActive(dataRoot);
 if(request.operation==='inflation-census-m3-archive-headers-readonly')return inspectInflationCensusM3ArchivedHeaders(dataRoot);
 if(request.operation==='inflation7-d1-readback-readonly')return inspectInflation7D1Readback(dataRoot);
 if(request.operation==='r17-268-postcancel-readonly'){
  if(request.requestId!==ONE_SHOT_DIAGNOSTIC_ID)return {status:'BLOCKED',code:'R17_268_ONE_SHOT_REQUEST_ID_STOP',providerCalls:0,d1Writes:0,operationalWrites:0};
  let coreTaskXml=null,sourceTrace=null,protectedStateSha256=null;
  try{coreTaskXml=queryTask('ZGMINI-PC-Local-Core');}catch{}
  if(coreTaskXml)try{sourceTrace=inspectPcSource({dataRoot,coreTaskXml});}catch{}
  try{protectedStateSha256=digest(JSON.stringify(protectedState(dataRoot,{queryTask,retiredTaskEvidence})));}catch{}
  return inspectR17PostCancel(dataRoot,{coreTaskXml,sourceTrace,patchText:R17_PATCH_TEXT,protectedStateSha256});
 }
 if(request.operation==='us-breadth-r17-preflight')return inspectR17Windows();
 if(request.operation==='us-breadth-r17-runtime-readonly')return inspectUsBreadthR17Runtime(dataRoot);
 if(request.operation==='pc-source-origin-readonly')return inspectPcSourceOrigin({dataRoot});
 if(request.operation==='r54-sixfile-inventory-readonly')return inspectR54SixFileInventory(dataRoot);
 if(request.operation==='r54-runtime-binding-readonly')return inspectR54RuntimeBinding({queryTask});
 if(request.operation==='r47-task-action-readonly')return inspectR47TaskActionReadonly();
 if(request.operation==='release-calendar-runtime-readonly'){
  let coreTaskXml=null;try{coreTaskXml=queryTask('ZGMINI-PC-Local-Core');}catch{}
  return inspectReleaseCalendarRuntime(dataRoot,{coreTaskXml});
 }
 if(request.operation==='source-inventory-runtime-readonly')return inspectSourceInventory(dataRoot);
 if(request.operation==='provider-activity-runtime-readonly')return inspectProviderActivity(dataRoot);
 if(request.operation==='market-calendar-r44-runtime-readonly')return inspectDeltaR44CheckpointEvidence(dataRoot);
 if(request.operation==='market-calendar-r44-input-audit-readonly')return inspectR44ExistingInputAudit(dataRoot);
 if(request.operation==='market-calendar-r44-production-readonly')return inspectR44ProductionReadonly();
 if(request.operation==='market-calendar-er1-saved-status')return inspectER1SavedInput(dataRoot);
 if(request.operation==='inflation-causal-saved-status')return inspectInflationCausalSaved(dataRoot);
 if(request.operation==='market-calendar-er1-nov30-availability')return inspectER1NovemberAvailability(dataRoot);
 if(request.operation==='asset-r10-publication-status')return inspectAssetR10Publication(dataRoot);
 if(request.operation==='asset-r10-source-readonly')return inspectAssetR10SourceBytes(dataRoot,{coreTaskXml:queryTask('ZGMINI-PC-Local-Core')});
 if(request.operation==='employment-r6-host-cas-readonly')return inspectEmploymentR6HostCas({host});
 if(request.operation==='employment-r6-wal-memory-preflight')return inspectEmploymentR6WalMemoryPreflight({host});
 if(request.operation==='employment-r6-collection-evidence-readonly')return inspectEmploymentR6CollectionEvidence(dataRoot,{
  // Stage marker contains only a literal phase and remains in the isolated job workspace.
  onStage:stage=>{
   if(typeof workspace!=='string'||!R6_READONLY_STAGES.includes(stage))return;
   writeJson(path.join(workspace,'employment-r6-readonly-stage.json'),{stage});
  },
 });
 if(request.operation==='employment-r6-raw-run-attestation-readonly')return inspectEmploymentR6RawRunLight(dataRoot);
 if(request.operation==='earnings-bea-mfg-archive-readonly')return inspectBeaMfgArchiveReadonly(dataRoot);
 if(request.operation==='earnings-bea-unit-archive-readonly')return inspectBeaUnitArchiveReadonly(dataRoot);
 if(request.operation==='earnings-bea-nipa-capture-readonly')return inspectBeaNipaCaptureReadonly(dataRoot);
 if(request.operation==='w05-wpsfd42-service-readonly')return await runW05ServiceStoredReadonly({request,host,dataRoot,workspace});
 if(request.operation==='inflation19-d1-readback-readonly')return inspectInflation19D1Readback(dataRoot);
 if(request.operation==='employment-r6-candidate-stage-readonly'){
  const minimum=policy.operations[request.operation].minimumFreeMiB??policy.minimumFreeMiBForHeavy;
  if(os.freemem()/1048576<minimum)return {status:'BLOCKED',code:'RESOURCE_WAIT_MEMORY',
    candidateExecuted:false,sqliteOpened:false,providerCalls:0,d1Writes:0};
  return inspectEmploymentR6Candidate(request,{host,workspace});
 }
 if(request.operation==='core-conflict-proof'){
  const isolated=path.join(workspace,'core-fixture');fs.mkdirSync(path.join(isolated,'pc-writer'),{recursive:true});
  const f=path.join(isolated,'pc-writer','local-cycle.lock');fs.writeFileSync(f,'fixture-owner');
  const before=digest(fs.readFileSync(f));const blocked=readCore(isolated).lockPresent;need(blocked,'CORE_FIXTURE_NOT_DETECTED');need(before===digest(fs.readFileSync(f)),'CORE_FIXTURE_CHANGED');
  return {status:'PASS',code:'CORE_WRITE_GATE_BLOCKED_WITHOUT_LOCK_CHANGE',scope:'ISOLATED_FIXTURE',realCoreLockObserved:fs.existsSync(path.join(dataRoot,'pc-writer/local-cycle.lock')),mutationsEnabled:false};
 }
 if(request.operation==='isolation-proof'){
  const p=path.join(workspace,'isolation.json');writeJson(p,{requestId:request.requestId,seat:context.seat});
  await new Promise(r=>setTimeout(r,15000));need(JSON.parse(fs.readFileSync(p)).requestId===request.requestId,'ISOLATION_FILE_COLLISION');
  return {status:'PASS',code:'ISOLATED_WORKSPACE_VERIFIED',workspaceId:context.workspaceId,seat:context.seat,requestId:request.requestId};
 }
 if(request.operation==='failure-proof')throw Object.assign(new Error('CONTROLLED_FIXTURE_FAILURE'),{code:'CONTROLLED_FIXTURE_FAILURE'});
 if(request.operation==='timeout-proof'){await new Promise(r=>setTimeout(r,60000));return {status:'FAIL',code:'TIMEOUT_GUARD_NOT_APPLIED'};}
 if(request.operation==='source-audit'){
  const res=await fetch('https://api.github.com/repos/'+request.sourceRepository+'/commits/'+request.sourceSha,{headers:{accept:'application/vnd.github+json','user-agent':'zgmini-pc-control'},signal:AbortSignal.timeout(20000)});
  need(res.ok,'SOURCE_COMMIT_LOOKUP_FAILED');const data=await res.json();need(data.sha===request.sourceSha,'SOURCE_SHA_MISMATCH');
  const ref=await fetch('https://api.github.com/repos/'+request.sourceRepository+'/commits/'+encodeURIComponent(request.sourceBranch),{headers:{accept:'application/vnd.github+json','user-agent':'zgmini-pc-control'},signal:AbortSignal.timeout(20000)});need(ref.ok,'SOURCE_BRANCH_LOOKUP_FAILED');need((await ref.json()).sha===request.sourceSha,'SOURCE_BRANCH_HEAD_CHANGED');
  return {status:'PASS',code:'SOURCE_COMMIT_READONLY_VERIFIED',sourceSha:data.sha,changedFileCount:data.files?.length??null,executedCandidateCode:false};
 }
 if(request.operation==='theme-l7-runtime-readonly')return inspectThemeL7RuntimeReadonly({dataRoot,queryTask});
 if(request.operation==='theme-nine-r32-raw-coverage-readonly'){
  // Recheck after the engine's admission without reducing the RAM minimum.
  // A brief dip uses the same bounded common admission instead of one-shot rejection.
  const minimumFreeMiB=policy.operations[request.operation].minimumFreeMiB;
  const memoryRecheck=await waitForMemoryAdmission({minimumFreeMiB,timeoutMs:9000,intervalMs:1500});
  if(!memoryRecheck.admitted)return {status:'BLOCKED',code:'RESOURCE_WAIT_MEMORY',candidateExecuted:false,
   memoryRecheck,providerCalls:0,sqliteOpened:false,operationalWrites:0,d1Writes:0};
  const audit=inspectNineR32RawCoverage(dataRoot);
  return audit.status==='PARTIAL'?{...audit,status:'BLOCKED',coverageStatus:'PARTIAL'}:audit;
 }
 if(request.operation==='inflation-a401-private23-readonly')return inspectA401Private23(request,context);
 if(request.operation==='inflation-a407-integrity-readonly')return inspectA407IntegrityReadonly(request,context);
 if(request.operation==='inflation19-runtime-readonly')return inspectInflation19RuntimeReadonly(dataRoot);
 if(request.operation==='inflation-r2-local-readonly')return inspectInflationR2LocalReadonly(dataRoot);
 if(request.operation==='inflation-r2-d1-readback-readonly')return inspectInflationR2D1Readback(dataRoot);
 if(request.operation==='inflation-candidates-runtime-readonly')return inspectInflationCandidatesRuntimeReadonly(dataRoot);
 if(request.operation==='theme-platform-shadow-readonly'){
  try{return await runApprovedShadowReadOnly({request,host,dataRoot});}
  catch(error){
   // A source not yet registered by the regular B host admission is a
   // technical prerequisite, not a source-integrity execution failure.
   if(error?.code==='SHADOW_SOURCE_NOT_APPROVED')return {
    status:'BLOCKED',code:'SHADOW_SOURCE_NOT_APPROVED',actualExecutionSha:null,
    requestedSourceSha:request.sourceSha,candidateExecuted:false,
    providerCalls:0,d1Writes:0,schedulerWrites:0};
   throw error;
  }
 }
 if(request.operation==='theme-common-tests'){
  const approved=host.approvedSources?.[request.sourceSha];need(approved,'SOURCE_NOT_APPROVED_FOR_EXECUTION');need(approved.branch===request.sourceBranch,'APPROVED_SOURCE_BRANCH_MISMATCH');
  if(os.freemem()/1048576<(policy.operations[request.operation].minimumFreeMiB??policy.minimumFreeMiBForHeavy))return {status:'BLOCKED',code:'RESOURCE_WAIT_MEMORY',retry:'RESUME_WITH_NEW_REQUEST_WHEN_RESOURCE_CHANGES',candidateExecuted:false};
  const manifest=JSON.parse(fs.readFileSync(path.join(approved.root,'manifest.json')));need(digest(JSON.stringify(manifest.files))===approved.manifestSha256,'APPROVED_MANIFEST_DRIFT');
  const source=path.join(workspace,'source');fs.mkdirSync(source);
  for(const [relative,sha] of Object.entries(manifest.files)){const bytes=fs.readFileSync(path.join(approved.root,'source',relative));need(digest(bytes)===sha,'APPROVED_SOURCE_FILE_DRIFT');const dest=path.join(source,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});}
  const tmp=path.join(workspace,'tmp'),home=path.join(workspace,'home');fs.mkdirSync(tmp);fs.mkdirSync(home);
  const env={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,PATH:path.dirname(process.execPath),TEMP:tmp,TMP:tmp,USERPROFILE:home,HOME:home,CI:'true',ZGMINI_DATA_ROOT:path.join(tmp,'fixture-data')};
  const args=['--max-old-space-size=128','--test','--test-concurrency=1',...approved.tests];
  const run=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:source,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let text='',truncated=false;
   const add=b=>{if(text.length<131072)text+=b.toString();else truncated=true;};child.stdout.on('data',add);child.stderr.on('data',add);child.on('error',()=>resolve({code:-1,text:'',truncated}));child.on('exit',code=>resolve({code,text,truncated}));});
  const stats=run.text.split(/\r?\n/).filter(x=>/^.?\s*(tests|pass|fail|cancelled|skipped|todo) \d+$/.test(x)).slice(-8);
  return {status:run.code===0?'PASS':'FAIL',code:run.code===0?'APPROVED_TESTS_PASS':'APPROVED_TESTS_FAILED',exitCode:run.code,statistics:stats,actualExecutionSha:request.sourceSha,truncated:run.truncated,providerCalls:0,d1Writes:0};
 }
 throw Object.assign(new Error('OPERATION_NOT_ALLOWED'),{code:'OPERATION_NOT_ALLOWED'});
}



// Candidate A-grade operation. Requires a separately B-approved immutable
// source bundle; never downloads or dynamically selects executable code.

const SHADOW_BRANCH='codex/theme-fear-greed-integration-20261025';
const SHADOW_ENTRY='scripts/pc-writer/theme-config-tool.mjs';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const sha=digest;

function safeRegular(file,root){
 const real=fs.realpathSync(file);
 need(real.startsWith(root+path.sep),'SHADOW_BUNDLE_PATH_ESCAPE');
 need(fs.statSync(real).isFile()&&!fs.lstatSync(file).isSymbolicLink(),
  'SHADOW_BUNDLE_NOT_REGULAR');
 return fs.readFileSync(real);
}

function verifyApprovedShadowBundle({request,host}){
 need(request?.sourceRepository==='ansqhd5774-Choi/zgmini',
  'SHADOW_REPOSITORY_DENIED');
 need(request.sourceBranch===SHADOW_BRANCH,'SHADOW_BRANCH_DENIED');
 need(SHA40.test(request.sourceSha??''),'SHADOW_SHA_INVALID');
 const approved=host?.approvedSources?.[request.sourceSha];
 need(approved?.branch===SHADOW_BRANCH&&approved?.entrypoint===SHADOW_ENTRY,
  'SHADOW_SOURCE_NOT_APPROVED');
 need(SHA64.test(approved.manifestSha256??''),'SHADOW_MANIFEST_SHA_INVALID');
 need(path.isAbsolute(approved.root??''),'SHADOW_ROOT_NOT_ABSOLUTE');
 const root=fs.realpathSync(approved.root);
 need(fs.statSync(root).isDirectory(),'SHADOW_ROOT_NOT_DIRECTORY');
 const manifestBytes=safeRegular(path.join(root,'manifest.json'),root);
 need(sha(manifestBytes)===approved.manifestSha256,'SHADOW_MANIFEST_DRIFT');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'));}
 catch{need(false,'SHADOW_MANIFEST_INVALID');}
 need(manifest.sourceSha===request.sourceSha&&
  manifest.sourceBranch===SHADOW_BRANCH&&
  manifest.entrypoint===SHADOW_ENTRY,'SHADOW_MANIFEST_IDENTITY');
 const files=manifest.files;
 need(files&&typeof files==='object'&&!Array.isArray(files)&&
  Object.keys(files).length>0&&Object.keys(files).length<=300,
  'SHADOW_MANIFEST_FILES_INVALID');
 need(Object.hasOwn(files,SHADOW_ENTRY),'SHADOW_ENTRY_MISSING');
 const sourceRoot=fs.realpathSync(path.join(root,'source'));
 need(sourceRoot.startsWith(root+path.sep),'SHADOW_SOURCE_ROOT_ESCAPE');
 for(const [rel,expected] of Object.entries(files)){
  need(typeof rel==='string'&&rel.length<=240&&
   (/^(scripts\/pc-writer|worker|config|docs|examples)\/[A-Za-z0-9_.\/-]+$/.test(rel)||
    /^vendor\/hyparquet-1\.31\.2\/[A-Za-z0-9_.\/-]+$/.test(rel)||
    rel==='package.json')&&
   !rel.split('/').includes('..')&&SHA64.test(expected),
   'SHADOW_MANIFEST_FILE_PATH_INVALID');
  const file=path.resolve(sourceRoot,...rel.split('/'));
  need(sha(safeRegular(file,sourceRoot))===expected,'SHADOW_SOURCE_FILE_DRIFT');
 }
 // A verified manifest is insufficient if unlisted .mjs files remain beside
 // approved modules: Node could import those through relative resolution.
 const listed=new Set(Object.keys(files));
 const discovered=new Set();
 const pending=[{dir:sourceRoot,prefix:''}];
 while(pending.length){
  const {dir,prefix}=pending.pop();
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const rel=prefix?prefix+'/'+entry.name:entry.name;
   const file=path.join(dir,entry.name);
   need(!fs.lstatSync(file).isSymbolicLink(),
    'SHADOW_SOURCE_UNLISTED_OR_LINKED');
   if(entry.isDirectory())pending.push({dir:file,prefix:rel});
   else{
    need(entry.isFile()&&listed.has(rel),
     'SHADOW_SOURCE_UNLISTED_OR_LINKED');
    discovered.add(rel);
   }
   need(discovered.size+pending.length<=600,
    'SHADOW_SOURCE_INVENTORY_UNBOUNDED');
  }
 }
 need(discovered.size===listed.size,'SHADOW_SOURCE_MANIFEST_INCOMPLETE');
 return {sourceRoot,entrypoint:path.join(sourceRoot,...SHADOW_ENTRY.split('/')),
  sourceSha:request.sourceSha,verifiedFileCount:Object.keys(files).length};
}

function interpretShadowOutcome({exitCode,stdout='',stderr=''}){
 need(typeof stdout==='string'&&typeof stderr==='string'&&
  Buffer.byteLength(stdout)<=2_000_000&&Buffer.byteLength(stderr)<=2_000_000,
  'SHADOW_OUTPUT_BOUNDS');
 let result;
 try{result=JSON.parse(stdout.trim()||stderr.trim());}
 catch{need(false,'SHADOW_OUTPUT_JSON_INVALID');}
 need(result&&typeof result==='object','SHADOW_OUTPUT_INVALID');
 // The CLI writes STOP JSON to stderr and exits 2 when source data is missing.
 // Return a short public code, never the underlying stdout/stderr or raw data.
 if(result.status==='STOP'){
  need(result.d1Writes===0&&result.schedulerWrites===0,
   'SHADOW_READONLY_CONTRACT_NOT_PROVEN');
  const reason=typeof result.reason==='string'&&
   /^[A-Z][A-Z0-9_]{2,99}$/.test(result.reason)?result.reason:'SHADOW_SOURCE_STOP';
  return {status:'BLOCKED',code:reason,executionMode:'APPROVED_READONLY_SHADOW',
   providerCalls:0,d1Writes:0,schedulerWrites:0,
   checkpointPersistence:'TRANSIENT_MEMORY_ONLY'};
 }
 need(result.providerCalls===0&&result.d1Writes===0&&
  result.schedulerWrites===0&&result.publicConnection==='NOT_ACTIVATED'&&
  result.checkpointPersistence==='TRANSIENT_MEMORY_ONLY',
  'SHADOW_READONLY_CONTRACT_NOT_PROVEN');
 need(Array.isArray(result.publicTargetIds)&&new Set(result.publicTargetIds).size===result.publicTargetIds.length&&
  result.publicTargetIds.length>=10,'SHADOW_PUBLIC_TARGETS_UNDER_MINIMUM');
 const c=result.coverage?.public;
 need(c&&[c.themes,c.expectedPhases,c.complete,c.blocked,c.pending].every(n=>
  Number.isSafeInteger(n)&&n>=0)&&c.themes===result.publicTargetIds.length&&
  c.expectedPhases===2*c.themes&&c.complete+c.blocked+c.pending===c.expectedPhases,
  'SHADOW_PUBLIC_COVERAGE_INVALID');
 // Private configuration replay is diagnostic only. A private provisional
 // adapter can exit 2 while every public phase has genuinely completed.
 const p=result.coverage?.private;
 const privateValid=p&&Number.isSafeInteger(p.themes)&&p.themes>=0&&
  p.expectedPhases===2*p.themes&&
  [p.complete,p.blocked,p.pending].every(n=>Number.isSafeInteger(n)&&n>=0)&&
  p.complete+p.blocked+p.pending===p.expectedPhases&&
  ['COMPLETE','PARTIAL','RUNNING','INCOMPLETE','NOT_APPLICABLE'].includes(p.status);
 const privateCoverage=privateValid?{status:p.status,themes:p.themes,
  expectedPhases:p.expectedPhases,complete:p.complete,blocked:p.blocked,
  pending:p.pending}:null;
 need(privateValid,'SHADOW_PRIVATE_COVERAGE_INVALID');
 const publicComplete=c.status==='COMPLETE'&&
  c.complete===c.expectedPhases&&c.blocked===0&&c.pending===0;
 const normalExit=exitCode===0&&result.status==='COMPLETE'&&
  ['COMPLETE','NOT_APPLICABLE'].includes(privateCoverage.status)&&
  privateCoverage.blocked===0&&privateCoverage.pending===0;
 const privateOnlyPartial=exitCode===2&&result.status==='PARTIAL'&&
  privateCoverage?.status==='PARTIAL'&&privateCoverage.blocked>0;
 const complete=publicComplete&&(normalExit||privateOnlyPartial);
 // Only bounded, enumerated phase diagnostics leave the Controller. Never
 // return source results, stdout/stderr, error messages or checkpoint data.
 const safe=(value,re,fallback)=>typeof value==='string'&&re.test(value)?value:fallback;
 const phaseRows=Array.isArray(result.results)?result.results.slice(0,64).map(row=>({
  id:safe(row?.id,/^[a-z0-9][a-z0-9-]{0,79}$/,'REDACTED'),
  kind:['confirmed','provisional'].includes(row?.kind)?row.kind:'REDACTED',
  status:['COMPLETE','BLOCKED'].includes(row?.status)?row.status:'UNKNOWN',
  stage:safe(row?.stage,/^[a-z][a-z0-9-]{0,39}$/,null),
  code:safe(row?.code,/^[A-Z][A-Z0-9_]{0,99}$/,null)
 })):[];
 // The shared Controller's idempotent replay accepts only PASS/FAIL/BLOCKED/
 // STATE_UNKNOWN. Keep partial coverage explicit without persisting a status
 // that cannot be returned for the same requestId on a later readback.
 return {status:complete?'PASS':'BLOCKED',replayStatus:complete?'COMPLETE':'PARTIAL',
  code:complete?'SHADOW_PUBLIC_REPLAY_COMPLETE':'SHADOW_PUBLIC_REPLAY_REVIEW',
  executionMode:'APPROVED_READONLY_SHADOW',
  publicTargetCount:c.themes,publicPhases:c.expectedPhases,
  publicComplete:c.complete,publicBlocked:c.blocked,publicPending:c.pending,
  publicCoverageStatus:publicComplete?'COMPLETE':'PARTIAL',
  privateCoverage,privateCoverageStatus:privateCoverage?.status??'UNKNOWN',
  phaseRows,phaseRowsTruncated:Array.isArray(result.results)&&result.results.length>64,
  sourceMode:['EXISTING_LOCAL_SAVED_ONLY','SAVED_PLUS_PUBLIC_API_AND_D1_READS',
   'CUSTOM_ADAPTER_UNVERIFIED'].includes(result.sourceMode)?result.sourceMode:null,
  d1Reads:Number.isSafeInteger(result.d1Reads)&&result.d1Reads>=0?result.d1Reads:null,
  publicApiReads:Number.isSafeInteger(result.publicApiReads)&&result.publicApiReads>=0?
   result.publicApiReads:null,
  providerCalls:0,d1Writes:0,schedulerWrites:0,
  checkpointPersistence:'TRANSIENT_MEMORY_ONLY'};
}

async function runApprovedShadowReadOnly({request,host,dataRoot,
 // The parent Controller worker has a 240s deadline. Leave 30s for cleanup,
 // protected-state postchecks, and the result upload on a slow Windows PC.
 timeoutMs=210000,spawnImpl=spawn}={}){
 const bundle=verifyApprovedShadowBundle({request,host});
 need(typeof dataRoot==='string'&&path.isAbsolute(dataRoot),
  'SHADOW_DATA_ROOT_INVALID');
 const dataReal=fs.realpathSync(dataRoot);
 need(fs.statSync(dataReal).isDirectory(),'SHADOW_DATA_ROOT_NOT_DIRECTORY');
 const env={SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,
  PATH:path.dirname(process.execPath),USERPROFILE:process.env.USERPROFILE,
  APPDATA:process.env.APPDATA,CLOUDFLARE_API_TOKEN:process.env.CLOUDFLARE_API_TOKEN,
  TEMP:process.env.TEMP,TMP:process.env.TMP,
  ZGMINI_DATA_ROOT:dataReal};
 const launched=await new Promise(resolve=>{
  const child=spawnImpl(process.execPath,
   ['--max-old-space-size=384',bundle.entrypoint,'--platform-shadow'],
   {cwd:bundle.sourceRoot,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',overflow=false,timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeoutMs);
  child.stdout.on('data',b=>{
   if(Buffer.byteLength(stdout)+b.length>2_000_000){overflow=true;child.kill();}
   else stdout+=b.toString('utf8');
  });
  child.stderr.on('data',b=>{
   if(Buffer.byteLength(stderr)+b.length>2_000_000){overflow=true;child.kill();}
   else stderr+=b.toString('utf8');
  });
  child.on('error',()=>{clearTimeout(timer);resolve({exitCode:-1,stdout:'',stderr:'',overflow,timedOut});});
  child.on('close',code=>{clearTimeout(timer);
   resolve({exitCode:code,stdout,stderr,overflow,timedOut});});
 });
 need(!launched.timedOut,'SHADOW_RUNTIME_TIMEOUT');
 need(!launched.overflow,'SHADOW_RUNTIME_OUTPUT_OVERFLOW');
 const outcome=interpretShadowOutcome(launched);
 return {...outcome,actualExecutionSha:bundle.sourceSha,
  requestedSourceSha:request.sourceSha,candidateExecuted:true,
  approvedFileCount:bundle.verifiedFileCount};
}
