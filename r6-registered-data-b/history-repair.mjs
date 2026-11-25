// Fixed-scope History recovery on the existing R6 B lane.
// This module does not authorize a selection. The A result must supply it,
// and the exact manifest must be merged before an owner one-shot request.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const HISTORY_REPAIR_SCHEMA='ZGMINI_W04_HISTORY_REPAIR_B_APPROVAL_V1';
export const HISTORY_REPAIR_MODE='HISTORY_REPAIR';
const repo='ansqhd5774-Choi/zgmini-pc-control',owner='ansqhd5774-Choi';
const home=String.raw`E:\ZGmini\data\pc-writer`;
const hostFile=String.raw`E:\ZGmini\automation\pc-control\host.json`;
const source='551640c3094738f7803d6a7f799098a55c21523c';
const manifestDigest='508ce1aa31163ea73f7c658ab03adea50235c8dca38fa5dd12f670f114edd751';
const receiptName='pit0605-pc-c9e5b130-4e7a-4a24-a588-717d7faef26d.json';
const receiptDigest='2163132e165e45e08edff062722465dac1ff3a2d17ce999ec98a479d6e32547b';
const evidenceDigest='30afbbec30466fa3e93442c78514ccb5125ca57ae4609dfdd5b9f44716c3acc5';
const stage=String.raw`E:\ZGmini\automation\pc-control\source-bundles\source-`+source;
const entry='scripts/pc-writer/employment-r6-runner-stage.mjs';
const branch='codex/w04-pit-readonly-conflict-vintage-20261125';
const moduleName='lib/market-score/employment-r6-history-repair-transaction.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const need=(v,code)=>{if(!v)throw Object.assign(Error(code),{code});};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const same=(a,b)=>typeof a==='string'&&path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
const effects={historyInserts:true,coreBackup:true,providerCalls:false,d1Writes:false,currentWrites:false,schemaWrites:false,taskWrites:false,sourceWrites:false};

export function authorizeHistoryRepair({event,env,approvalBytes}={}){
 need(env?.GITHUB_REPOSITORY===repo&&env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
 env.GITHUB_ACTOR===owner&&env.GITHUB_RUN_ATTEMPT==='1'&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')&&
 event?.action==='opened'&&event.repository?.full_name===repo&&event.repository.private===true&&
 event.sender?.login===owner&&event.issue?.user?.login===owner&&!event.issue.pull_request&&
 event.issue.title==='pc-employment-r6-registered-data-once'&&event.issue.labels?.some(x=>x.name==='pc-writer-b-install'),
 'W04_REPAIR_OWNER_EVENT_STOP');
 const request=JSON.parse(event.issue.body),approval=JSON.parse(approvalBytes.toString('utf8'));
 need(exact(request,['schema','requestId','chatId','operation','approvalManifestSha256'])&&
 request.schema==='ZGMINI_R6_REGISTERED_DATA_B_REQUEST_V1'&&request.operation==='employment-r6-registered-data-once'&&
 uuid(request.requestId)&&uuid(request.chatId)&&hex(request.approvalManifestSha256)&&
 Buffer.isBuffer(approvalBytes)&&sha(approvalBytes)===request.approvalManifestSha256,'W04_REPAIR_APPROVAL_HASH_STOP');
 need(exact(approval,['schema','status','scope','sourceSha','sourceManifestSha256','receiptSha256','evidenceDigest','selectionSha256','approvedCount','effects'])&&
 approval.schema===HISTORY_REPAIR_SCHEMA&&approval.status==='APPROVED_B'&&approval.scope==='CORE_MISSING_STATE_CLAIMS_HISTORY_ONLY'&&
 approval.sourceSha===source&&approval.sourceManifestSha256===manifestDigest&&approval.receiptSha256===receiptDigest&&
 approval.evidenceDigest===evidenceDigest&&hex(approval.selectionSha256)&&Number.isSafeInteger(approval.approvedCount)&&
 approval.approvedCount>0&&approval.approvedCount<=2880&&exact(approval.effects,Object.keys(effects))&&
 Object.entries(effects).every(([k,v])=>approval.effects[k]===v),'W04_REPAIR_APPROVAL_SCOPE_STOP');
 return {request,approval};
}

function regularBytes(file,cap=32*1024*1024){
 const st=fs.lstatSync(file);need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=cap,'W04_REPAIR_FILE_STOP');
 return fs.readFileSync(file);
}
async function loadRegisteredRepairInputs(){
 const h=JSON.parse(regularBytes(hostFile).toString('utf8'));
 const reg=h.approvedSources?.[source];
 need(h.schema==='ZGMINI_PC_HOST_V1'&&reg?.manifestSha256===manifestDigest&&
 same(reg.root,stage)&&reg.branch===branch&&reg.entrypoint===entry,'W04_REPAIR_BUNDLE_UNREGISTERED');
 const bytes=regularBytes(path.join(stage,'manifest.json'));
 need(sha(bytes)===manifestDigest,'W04_REPAIR_BUNDLE_MANIFEST_DRIFT');
 const m=JSON.parse(bytes.toString('utf8'));
 need(m.sourceSha===source&&m.sourceRepository==='ansqhd5774-Choi/zgmini'&&m.sourceBranch===branch&&m.entrypoint===entry&&
 Object.keys(m.files).length===21&&hex(m.files[moduleName]),'W04_REPAIR_BUNDLE_SCOPE_STOP');
 for(const [rel,digest] of Object.entries(m.files)){
  need(/^[-a-zA-Z0-9_./]+$/.test(rel)&&!rel.startsWith('/')&&!rel.split('/').some(x=>!x||x==='.'||x==='..')&&hex(digest),'W04_REPAIR_BUNDLE_FILE_STOP');
  need(sha(regularBytes(path.join(stage,'source',...rel.split('/')),10485760))===digest,'W04_REPAIR_BUNDLE_FILE_DRIFT');
 }
 const receiptBytes=regularBytes(path.join(home,'pit-evidence',receiptName));
 need(sha(receiptBytes)===receiptDigest,'W04_REPAIR_RECEIPT_DRIFT');
 const mod=await import(pathToFileURL(path.join(stage,'source',...moduleName.split('/'))).href);
 need(typeof mod.previewEmploymentHistoryRepairSelection==='function'&&typeof mod.applyEmploymentHistoryRepairTransaction==='function','W04_REPAIR_MODULE_STOP');
 return {receipt:{receiptBytes,receiptSha256:receiptDigest,evidenceDigest,expectedKeys:2880},
  preview:mod.previewEmploymentHistoryRepairSelection,apply:mod.applyEmploymentHistoryRepairTransaction};
}

async function nativeOpen(){const sqlite=await import('node:sqlite');
 need(typeof sqlite.backup==='function','W04_REPAIR_NATIVE_BACKUP_UNAVAILABLE');
 const file=path.join(home,'storage','core.sqlite');
 const stat=fs.lstatSync(file);need(stat.isFile()&&!stat.isSymbolicLink(),'W04_REPAIR_CORE_FILE_STOP');
 return {db:new sqlite.DatabaseSync(file),backup:sqlite.backup,DatabaseSync:sqlite.DatabaseSync};
}
async function nativeSnapshot({db,backup,DatabaseSync,request,inputs,approval}){
 const dir=path.join(home,'pit-evidence','history-repair-'+request.requestId);
 fs.mkdirSync(dir,{recursive:false});
 const file=path.join(dir,'CORE_BEFORE.sqlite');
 await backup(db,file);
 const copy=new DatabaseSync(file,{readOnly:true});
 try{const rows=copy.prepare('PRAGMA quick_check').all();
  need(rows.length===1&&Object.values(rows[0])[0]==='ok','W04_REPAIR_BACKUP_CHECK_STOP');
  copy.exec('BEGIN');
  try{const selected=inputs.preview(copy,inputs.receipt);
   need(selected.eligible===approval.approvedCount&&selected.selectionSha256===approval.selectionSha256,
    'W04_REPAIR_BACKUP_PREIMAGE_DRIFT');
  }finally{copy.exec('ROLLBACK');}
 }finally{copy.close();}
 const stat=fs.statSync(file);
 need(stat.size>0,'W04_REPAIR_BACKUP_EMPTY');
 const backupFd=fs.openSync(file,'r+');
 try{fs.fsyncSync(backupFd);}finally{fs.closeSync(backupFd);}
 const write=value=>{
  // Each phase is immutable, so a crash cannot replace the prior evidence.
  const journal=path.join(dir,value.phase+'.json');
  const bytes=JSON.stringify(value)+'\n';
  const fd=fs.openSync(journal,'wx',0o600);
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  need(fs.readFileSync(journal,'utf8')===bytes,'W04_REPAIR_JOURNAL_READBACK_STOP');
 };
 return {backupVerified:true,bytes:stat.size,write};
}

export async function performHistoryRepair({auth,acquire,claim,load=loadRegisteredRepairInputs,open=nativeOpen,snapshot=nativeSnapshot}={}){
 const {request,approval}=auth;
 const base={schema:'ZGMINI_R6_REGISTERED_DATA_B_RESULT_V1',requestId:request.requestId,
 approvalManifestSha256:request.approvalManifestSha256,approvedCount:approval.approvedCount,
 sourceSha:approval.sourceSha,mode:HISTORY_REPAIR_MODE,providerRequests:0,blsRequests:0,dolRequests:0,groupResults:[],
 publication:'NOT_ATTEMPTED',sqlite:'UNVERIFIED',historicalVersionAttested:false,selectionSha256:approval.selectionSha256};
 let lock,handle,snap,claimed=false,claimStarted=false,committed=false,out;
 try{
  lock=await acquire(home,request.requestId);need(lock.held(),'W04_REPAIR_LEASE_LOST');
  const inputs=await load();handle=await open();
  const db=handle.db;db.exec('BEGIN');
  let selected;
  try{selected=inputs.preview(db,inputs.receipt);}finally{db.exec('ROLLBACK');}
  need(selected.eligible===approval.approvedCount&&selected.selectionSha256===approval.selectionSha256,'W04_REPAIR_SELECTION_DRIFT');
  need(lock.held(),'W04_REPAIR_LEASE_LOST');
  snap=await snapshot({...handle,request,inputs,approval});
  need(snap.backupVerified===true&&lock.held(),'W04_REPAIR_BACKUP_OR_LEASE_STOP');
  const journal={requestId:request.requestId,approvalManifestSha256:request.approvalManifestSha256,
   selectionSha256:approval.selectionSha256,approvedCount:approval.approvedCount,backupBytes:snap.bytes};
  snap.write({...journal,phase:'BACKUP_VERIFIED'});
  claimStarted=true;claim(home,request,HISTORY_REPAIR_MODE);claimed=true;
  need(lock.held(),'W04_REPAIR_LEASE_LOST');
  snap.write({...journal,phase:'APPLYING'});
  const r=inputs.apply(db,inputs.receipt,{approvedSelectionSha256:approval.selectionSha256,approvedCount:approval.approvedCount});
  committed=r?.status==='HISTORY_REPAIR_COMMITTED';
  need(committed&&r.inserted===approval.approvedCount&&r.selectionSha256===approval.selectionSha256&&
    r.historicalVersionAttested===false&&r.providerCalls===0&&r.d1Writes===0,'W04_REPAIR_RESULT_STOP');
  need(lock.held(),'W04_REPAIR_LEASE_LOST');
  snap.write({...journal,phase:'COMMITTED_VERIFIED',inserted:r.inserted,recordedAt:r.recordedAt});
  out={...base,status:'SUCCESS',code:'W04_HISTORY_REPAIR_COMMITTED',sqlite:'HISTORY_REPAIR_VERIFIED',
   historyRowsAdded:r.inserted,backupVerified:true,lastPass:'HISTORY_READBACK',firstFail:null};
 }catch(e){
  // The shared Core lock contract uses R6_B_CORE_LOCK_OCCUPIED. Preserve its
  // bounded category instead of turning a five-minute wait into an opaque
  // W04_REPAIR_EXECUTION_STOP. Never publish owner/PID/lock contents.
  const cause=e?.code??e?.message??'';
  const lockOccupied=cause==='R6_B_CORE_LOCK_OCCUPIED';
  const code=lockOccupied?'W04_REPAIR_CORE_LOCK_OCCUPIED':
   /^W04_REPAIR_[A-Z0-9_]+$/.test(cause)?cause:'W04_REPAIR_EXECUTION_STOP';
  out={...base,status:claimed||claimStarted||committed?'STATE_UNKNOWN':'BLOCKED',
   code,backupVerified:snap?.backupVerified===true,
   lastPass:claimed?'ONE_SHOT_CLAIMED':null,
   firstFail:lockOccupied?'CORE_LOCK':'HISTORY_REPAIR'};
 }finally{
  try{handle?.db.close();}catch{out={...base,status:'STATE_UNKNOWN',code:'W04_REPAIR_CLOSE_STOP'};}
  if(lock&&!lock.release())out={...base,status:'STATE_UNKNOWN',code:'W04_REPAIR_LEASE_RELEASE_STOP'};
 }
 return out;
}
