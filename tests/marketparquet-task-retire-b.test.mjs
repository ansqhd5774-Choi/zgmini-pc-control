import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {
 MP_RETIRE_B_MANIFEST,MP_RETIRE_B_OPERATION,MP_RETIRE_B_ISSUE_TITLE,
 validateMpRetireBIssueEnvelope,validateMpRetireBManifestRequest,
} from '../tools/maintenance-contract.mjs';
import {
 inspectMpRetireTaskXml,parseMpRetireTaskProbe,runMpRetireApprovedOneShot,
} from '../tools/update.mjs';

const h=x=>createHash('sha256').update(x).digest('hex');
const repo='ansqhd5774-Choi/zgmini-pc-control';
const sha='a'.repeat(40);
const bytes=fs.readFileSync(new URL('../approvals/marketparquet-task-retire/one-task.json',import.meta.url));
function issue(){
 return {schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-2e30f130-f838-4596-ac94-c690bb2829cb',
  chatId:'chat-4b30737e-56b6-4bdb-8caf-8e36137ac7e7',
  operation:MP_RETIRE_B_OPERATION,controlRepository:repo,
  targetControllerSha:sha,approvalManifestSha256:h(bytes)};
}
test('exact B issue admits actor, installed controller and immutable one-Task manifest only',()=>{
 const good=issue();
 const ctx={actor:'ansqhd5774-Choi',controlRepository:repo};
 assert.equal(MP_RETIRE_B_ISSUE_TITLE,'pc-marketparquet-task-retire');
 assert.equal(validateMpRetireBIssueEnvelope(good,ctx).operation,MP_RETIRE_B_OPERATION);
 assert.equal(validateMpRetireBManifestRequest(good,bytes,{...ctx,installedSha:sha})
  .manifest.taskName,'ZGMINI-PC-MarketParquet-ETF');
 assert.throws(()=>validateMpRetireBIssueEnvelope(good,{...ctx,actor:'runner-bot'}),
  /MP_B_ISSUE_ORIGIN_DENIED/);
 assert.throws(()=>validateMpRetireBIssueEnvelope({...good,taskName:'ZGMINI-PC-Local-Core'},ctx),
  /MP_B_ISSUE_FIELDS_INVALID/);
 assert.throws(()=>validateMpRetireBManifestRequest(good,bytes,{...ctx,installedSha:'b'.repeat(40)}),
  /MP_B_INSTALLED_CONTROLLER_DRIFT/);
 assert.throws(()=>validateMpRetireBManifestRequest(good,Buffer.concat([bytes,Buffer.from(' ')]),
  {...ctx,installedSha:sha}),/MP_B_MANIFEST_DIGEST_DENIED/);
 assert.throws(()=>validateMpRetireBManifestRequest(good,
  Buffer.from(JSON.stringify({...MP_RETIRE_B_MANIFEST,taskName:'ZGMINI-PC-Local-Core'})),
  {...ctx,installedSha:sha}),/MP_B_MANIFEST_DIGEST_DENIED/);
});
test('Task COM reports only strict Enabled/State/instances; unknown fails closed',()=>{
 assert.deepEqual(parseMpRetireTaskProbe('MP_TASK|True|3|0\n'),
  {enabled:true,state:3,instances:0});
 assert.deepEqual(parseMpRetireTaskProbe('MP_TASK|False|1|0\n'),
  {enabled:false,state:1,instances:0});
 for(const bad of ['UNKNOWN','MP_TASK|True|4|-1','MP_TASK|False|0|0',
  'MP_TASK|True|3|0\nTask=Core','MP_TASK|True|3|99999']){
  assert.throws(()=>parseMpRetireTaskProbe(bad),/MP_B_TASK_COM_PROBE_INVALID/);
 }
});
const entry=MP_RETIRE_B_MANIFEST.entryPath;
function xml({enabled=true,otherEntry=entry}={}){
 return Buffer.from('<?xml version="1.0"?><Task xmlns="urn:task">' +
  '<Settings><Enabled>'+String(enabled)+'</Enabled></Settings>' +
  '<Actions><Exec><Command>E:\\ZGmini\\runtime\\node.exe</Command>' +
  '<Arguments>"'+otherEntry+'"</Arguments></Exec></Actions></Task>');
}
function fixture({active=true,source=Buffer.from('retired MarketParquet entry fixture')}={}){
 const baseline=xml(),pin={...MP_RETIRE_B_MANIFEST,
  taskXmlSha256:h(baseline),entrySha256:h(source)};
 let disabled=false,callCount=0,leaseCount=0,releaseCount=0,heldCount=0,
  corruptPost=false,protectedDrift=false;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-mp-retire-'));
 const cleanup=()=>fs.rmSync(dir,{force:true,recursive:true});
 const io={
  requestId:'pc-2e30f130-f838-4596-ac94-c690bb2829cb',
  backupBase:dir,pin,
  queryXml(task){
   if(task===pin.taskName)return disabled?xml({enabled:false}):baseline;
   if(task==='ZGMINI-PC-Local-Core')return Buffer.from(protectedDrift&&disabled?'core changed':'core preserved');
   if(task==='ZGMINI-PC-GetMarketHistory-ETF')return Buffer.from('gmh preserved');
   throw Error('UNRELATED_TASK_OBSERVED');
  },
  probe(){return disabled?{enabled:false,state:1,instances:0}:
   active?{enabled:true,state:3,instances:0}:{enabled:true,state:4,instances:1};},
  readEntry(){return corruptPost&&disabled?Buffer.from('drift'):source;},
  disable(){callCount++;disabled=true;},
  acquireInstall(){leaseCount++;return {release(){releaseCount++;},holdForRecovery(){heldCount++;}};},
 };
 return {io,dir,cleanup,get calls(){return callCount;},
  get leases(){return leaseCount;},get released(){return releaseCount;},
  get held(){return heldCount;},
  corruptPost(){corruptPost=true;},corruptProtected(){protectedDrift=true;}};
}
test('pinned preimage verifies one exact Node entry and rejects another Task source',()=>{
 const b=xml(),source=Buffer.from('entry');
 const pin={...MP_RETIRE_B_MANIFEST,taskXmlSha256:h(b),entrySha256:h(source)};
 const state=inspectMpRetireTaskXml(b,source,{pin});
 assert.equal(state.entrySha256,h(source));
 assert.throws(()=>inspectMpRetireTaskXml(b,source,{pin:{...pin,taskXmlSha256:'0'.repeat(64)}}),
  /MP_B_TASK_XML_PREIMAGE_DRIFT/);
 const alternate=xml({otherEntry:'E:\\ZGmini\\data\\pc-writer\\core.mjs'});
 assert.throws(()=>inspectMpRetireTaskXml(alternate,source,{pin,pinnedPreimage:false}),
  /MP_B_TASK_ENTRY_CHANGED/);
 assert.throws(()=>inspectMpRetireTaskXml(b,Buffer.from('changed'),{pin}),
  /MP_B_ENTRY_SOURCE_SHA_DRIFT/);
});
test('exact B disables only pinned Task after durable original backup; GMH/Core byte-identical',async()=>{
 const f=fixture();
 try{
  const result=await runMpRetireApprovedOneShot(f.io);
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.code,'MP_B_EXACT_TASK_DISABLED_VERIFIED');
  assert.equal(result.taskEnabled,false);
  assert.equal(result.gmhTaskPreserved,true);
  assert.equal(result.coreTaskPreserved,true);
  assert.equal(result.providerCalls,0);
  assert.equal(result.d1Writes,0);
  assert.equal(result.writerFilesChanged,0);
  assert.equal(f.calls,1);assert.equal(f.leases,1);
  assert.equal(f.released,1);assert.equal(f.held,0);
  const backup=path.join(f.dir,'MP_TASK_RETIRE_B_'+f.io.requestId);
  assert.deepEqual(fs.readFileSync(path.join(backup,'task-original.xml')),xml());
  assert.match(fs.readFileSync(path.join(backup,'JOURNAL.jsonl'),'utf8'),
   /"phase":"DISABLED_VERIFIED"/);
  const duplicate=await runMpRetireApprovedOneShot(f.io);
  assert.equal(duplicate.status,'BLOCKED');
  assert.equal(duplicate.code,'MP_B_PREVIOUS_REQUEST_RECONCILE');
  assert.equal(f.calls,1);
 }finally{f.cleanup();}
});
test('running or changed Task aborts before any lease, backup, OS write',async()=>{
 const f=fixture({active:false});
 try{
  const r=await runMpRetireApprovedOneShot(f.io);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.code,'MP_B_TASK_NOT_READY_IDLE');
  assert.equal(f.calls,0);assert.equal(f.leases,0);
  assert.deepEqual(fs.readdirSync(f.dir),[]);
 }finally{f.cleanup();}
});
test('post-disable source SHA drift means UNKNOWN, exact backup held, never automatic restore',async()=>{
 const f=fixture();f.corruptPost();
 try{
  const r=await runMpRetireApprovedOneShot(f.io);
  assert.equal(r.status,'UNKNOWN');
  assert.equal(r.code,'MP_B_ENTRY_SOURCE_SHA_DRIFT');
  assert.equal(f.calls,1);
  assert.equal(f.held,1);assert.equal(f.released,0);
  const backup=path.join(f.dir,'MP_TASK_RETIRE_B_'+f.io.requestId);
  assert.deepEqual(fs.readFileSync(path.join(backup,'task-original.xml')),xml());
  assert.doesNotMatch(fs.readFileSync(path.join(backup,'JOURNAL.jsonl'),'utf8'),
   /DISABLED_VERIFIED/);
 }finally{f.cleanup();}
});
test('any GMH/Core Task drift after disable is UNKNOWN, not falsely successful',async()=>{
 const f=fixture();f.corruptProtected();
 try{
  const r=await runMpRetireApprovedOneShot(f.io);
  assert.equal(r.status,'UNKNOWN');
  assert.equal(r.code,'MP_B_GMH_OR_CORE_TASK_CHANGED');
  assert.equal(f.calls,1);assert.equal(f.held,1);
 }finally{f.cleanup();}
});
