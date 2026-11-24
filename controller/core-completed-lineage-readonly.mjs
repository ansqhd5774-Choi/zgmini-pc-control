// Fixed bounded completed-cycle verification; migrated unchanged from the previously verified 092 reader.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readActiveCoreSourceIdentity} from './core-runtime-source-readonly.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const proofNames=['core-cycle-id.mjs','core-origin-runtime.mjs','core-origin-wmi.mjs'];
const fail=code=>({status:'UNVERIFIED',code,collectionWriterSameCycleVerified:false,
 operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false});
export function classifyCompletedCoreLineage({cycle,collection,writer,identity,proofHashes}){
 if(identity?.status!=='VERIFIED'||!(/^[a-f0-9]{40}$/.test(identity.sourceSha??'')))return fail('CORE_COMPLETED_SOURCE_UNVERIFIED');
 const id=cycle?.coreCycleId;
 if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)||
  collection?.coreCycleId!==id||writer?.coreCycleId!==id)return fail('CORE_COMPLETED_CYCLE_LINK_MISSING');
 if(cycle.lane!=='core'||cycle.coreCheckoutSourceSha!==identity.sourceSha||
  identity.approvedSourceSha!==identity.sourceSha||writer.source!==identity.sourceSha)
  return fail('CORE_COMPLETED_SOURCE_MISMATCH');
 if(cycle.coreOriginEvidence!=='TASK_ENGINE_WMI_CAPTURED_AT_START'||
  cycle.coreOriginCode!=='CORE_TASK_ENGINE_CAPTURED_AT_START')return fail('CORE_COMPLETED_TASK_ORIGIN_UNVERIFIED');
 const start=Date.parse(cycle.coreCycleStartedAt),end=Date.parse(cycle.at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||
  !Number.isSafeInteger(cycle.coreProcessPid)||cycle.coreProcessPid<1||
  !Number.isSafeInteger(cycle.coreParentPid)||cycle.coreParentPid<1||
  !Number.isSafeInteger(cycle.coreNodeCreatedAtMs)||Math.abs(cycle.coreNodeCreatedAtMs-start)>30000||
  Date.parse(writer.at)<Date.parse(collection.at)||
  [collection.at,writer.at].some(t=>!Number.isFinite(Date.parse(t))||Date.parse(t)<start||Date.parse(t)>end))
  return fail('CORE_COMPLETED_TIME_OR_PROCESS_MISMATCH');
 const entryHash=identity.files?.find(f=>f.path==='scripts/pc-writer/local-cycle.mjs')?.sha256;
 if(!(/^[a-f0-9]{64}$/.test(entryHash??''))||entryHash!==cycle.coreEntrypointSha256||
  proofNames.some(n=>!(/^[a-f0-9]{64}$/.test(proofHashes?.[n]??''))||cycle.coreProofFileSha256?.[n]!==proofHashes[n]))
  return fail('CORE_COMPLETED_PROOF_FILE_MISMATCH');
 if(cycle.publishRequested!==true||writer.mode!=='PUBLISH'||
  !['VERIFIED','VERIFIED_WITH_GAPS'].includes(writer.status)||
  cycle.publicationExit!==0||cycle.collectionExit!==0)
  return fail('CORE_COMPLETED_RESULTS_NOT_SUCCESSFUL');
 return {status:'PASS',code:'CORE_COMPLETED_COLLECTION_WRITER_LINEAGE_VERIFIED',
  collectionWriterSameCycleVerified:true,coreCycleId:id,sourceSha:identity.sourceSha,
  startedAt:cycle.coreCycleStartedAt,completedAt:cycle.at,
  taskOriginEvidence:cycle.coreOriginEvidence,collectionStatus:collection.status,
  writerStatus:writer.status,cycleStatus:cycle.status,
  scope:'COMPLETED_CYCLE_ORIGIN_AND_RESULT_LINK_ONLY',
  allBusinessDataVerified:false,operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false};
}
export function readCompletedCoreLineage(){
 const root=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
 const base=String.raw`E:\ZGmini\data\pc-writer`;
 try{
  const bounded=file=>{const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size<2||s.size>2_000_000)throw Error('INVALID_RECORD');return fs.readFileSync(file);};
  const names=['local-cycle-last-run.json','local-collection-last-run.json','local-writer-last-run.json'];
  const raw=names.map(n=>bounded(path.join(base,n)));
  const [cycle,collection,writer]=raw.map(b=>JSON.parse(b.toString('utf8')));
  const identity=readActiveCoreSourceIdentity(root),proofHashes={};
  if(identity.status!=='VERIFIED')return fail(identity.code);
  for(const name of proofNames){
   const rel='scripts/pc-writer/'+name,file=path.join(root,rel);
   if(fs.realpathSync.native(file).toLowerCase()!==file.toLowerCase())return fail('CORE_COMPLETED_PROOF_PATH_MISMATCH');
   const bytes=bounded(file),blob=execFileSync('git',['cat-file','blob',identity.sourceSha+':'+rel],{cwd:root,windowsHide:true,timeout:5000,maxBuffer:2_000_000});
   if(!bytes.equals(blob))return fail('CORE_COMPLETED_PROOF_SOURCE_MISMATCH');
   proofHashes[name]=digest(bytes);
  }
  const result=classifyCompletedCoreLineage({cycle,collection,writer,identity,proofHashes});
  if(names.some((n,i)=>digest(bounded(path.join(base,n)))!==digest(raw[i])))return fail('CORE_COMPLETED_RECORD_CHANGED_DURING_READ');
  const again=readActiveCoreSourceIdentity(root);
  if(JSON.stringify(again)!==JSON.stringify(identity))return fail('CORE_COMPLETED_SOURCE_CHANGED_DURING_READ');
  return {...result,checkpointSha256:Object.fromEntries(names.map((n,i)=>[n,digest(raw[i])]))};
 }catch{return fail('CORE_COMPLETED_READ_UNAVAILABLE');}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(readCompletedCoreLineage()));
}
