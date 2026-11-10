// #996 second, narrower original-Windows READ-ONLY evidence snapshot.
// This module has NO production CLI; it never adopts or archives any claim.
// A verified file digest is not an independently approved ownership transfer.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {collect996InterruptedEvidence} from './controller-996-interrupted-observer.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ROOT='E:/ZGmini';
const M='automation/pc-maintenance';
const CONTROL='automation/pc-control';
const STAGE=`${CONTROL}/backups/controller-update-${REQ}/stage`;
const COWNER=`${M}/leases/controller-recovery`;
const CORE_SHA='badad9124157879d7a645b64f2768113d632355b';
const STAGE_SHA='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const MAINT_SHA='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const MANIFEST_SHA=Object.freeze({
  controller:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
  stage:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
  maintainer:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
});
const ORIGINAL_OWNER_SHA='d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc';
const RECOVERY_MARKER_SHA='4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b';
const PINS=Object.freeze({...MANIFEST_SHA,oldOwner:ORIGINAL_OWNER_SHA,
  oldRecovery:RECOVERY_MARKER_SHA});
const MARKERS=['PREPARED','WORKFLOW_ENABLE_ATTEMPTED','BACKLOG_CLOSE_ATTEMPTED'];
const EXPECTED_C_FILES=['owner.json',...MARKERS.map(x=>x+'.json')].sort();
const MAINT_FILES=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs',
  'tools/source-bundle-register.mjs'];
const HASH=v=>createHash('sha256').update(v).digest('hex');
const SHA=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const sorted=a=>a.slice().sort();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function checkedPath(root,rel,file=true){
  need(typeof rel==='string'&&!rel.startsWith('/')&&
    rel.split('/').every(x=>x&&x!=='.'&&x!=='..'),
    'C_EVIDENCE_PATH_INVALID');
  let current=root;
  for(const [i,part] of rel.split('/').entries()){
    const st=fs.lstatSync(current);
    need(st.isDirectory()&&!st.isSymbolicLink(),
      'C_EVIDENCE_PARENT_REDIRECT');
    current=path.join(current,part);
    const child=fs.lstatSync(current);
    need(!child.isSymbolicLink(), 'C_EVIDENCE_PATH_REDIRECT');
    if(i===rel.split('/').length-1){
      need(file?child.isFile()&&child.size>0&&child.size<=2_000_000&&
        child.nlink===1:child.isDirectory(),
        'C_EVIDENCE_TARGET_UNSAFE');
    }
  }
  return current;
}
const bytes=(root,rel)=>fs.readFileSync(checkedPath(root,rel));
const json=(root,rel)=>{
  const b=bytes(root,rel);let value;
  try{value=JSON.parse(b.toString('utf8'));}catch{}
  need(value&&typeof value==='object'&&!Array.isArray(value),
    'C_EVIDENCE_JSON_INVALID');
  return {value,sha:HASH(b)};
};
const names=(root,rel)=>sorted(fs.readdirSync(checkedPath(root,rel,false)));
const absent=(root,rel)=>{
  let target;
  try{target=checkedPath(root,rel,false);}catch(e){
    if(e?.code==='ENOENT')return true;
    throw e;
  }
  return !target;
};
const dead=pid=>{
  need(Number.isSafeInteger(pid)&&pid>0,'C_EVIDENCE_OWNER_PID_INVALID');
  try{process.kill(pid,0);return false;}
  catch(e){return e?.code==='ESRCH';}
};
const ctrlRel=rel=>/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel);

/** Only numeric original Issue IDs and non-secret replay status/reference leave
 * the original Windows. The raw journal and requestId are never printed. */
export function summarize996ReplayJournal(replays){
  need(replays&&typeof replays==='object'&&!Array.isArray(replays),
    'C_EVIDENCE_REPLAYS_INVALID');
  const keys=Object.keys(replays);
  need(keys.length<=100,'C_EVIDENCE_REPLAYS_TOO_LARGE');
  const entries=[];
  for(const key of keys){
    const record=replays[key];
    need(/^[1-9]\d{0,14}$/.test(key)&&Number.isSafeInteger(Number(key))&&
      record&&typeof record==='object'&&!Array.isArray(record)&&
      ['DONE','SKIPPED_RESULT_PRESENT'].includes(record.status),
      'C_EVIDENCE_REPLAY_SHAPE_INVALID');
    if(record.status==='DONE')need(Number.isSafeInteger(record.replayIssueNumber)&&
      record.replayIssueNumber>0&&
      typeof record.originalRequestId==='string'&&
      record.originalRequestId.length>0&&record.originalRequestId.length<=100,
      'C_EVIDENCE_REPLAY_DONE_INCOMPLETE');
    entries.push(Object.freeze({originIssue:Number(key),status:record.status,
      replayIssueNumber:record.status==='DONE'?record.replayIssueNumber:null}));
  }
  entries.sort((a,b)=>a.originIssue-b.originIssue);
  return Object.freeze({replayCount:entries.length,
    doneCount:entries.filter(x=>x.status==='DONE').length,
    skippedCount:entries.filter(x=>x.status==='SKIPPED_RESULT_PRESENT').length,
    replayJournalSha256:HASH(Buffer.from(JSON.stringify(replays))),
    entries:Object.freeze(entries)});
}

function sourceSet(root,manifest,base,expectedSha,stage=false){
  need(manifest?.controllerSourceSha===expectedSha&&
    manifest.controllerFiles&&typeof manifest.controllerFiles==='object'&&
    !Array.isArray(manifest.controllerFiles),
    'C_EVIDENCE_SOURCE_MANIFEST_INVALID');
  const map=manifest.controllerFiles,files=sorted(Object.keys(map));
  need(files.length>=5&&files.length<=30&&
    files.every(rel=>ctrlRel(rel)&&SHA(map[rel])),
    'C_EVIDENCE_SOURCE_FILES_INVALID');
  if(stage){
    const actual=[];
    for(const folder of ['controller','config'])
      for(const name of names(root,base+'/'+folder))actual.push(folder+'/'+name);
    need(same(sorted(actual),files)&&
      same(names(root,base),['config','controller','host.json']),
      'C_EVIDENCE_STAGE_EXTRA_FILE');
  }
  for(const rel of files)
    need(HASH(bytes(root,base+'/'+rel))===map[rel],
      'C_EVIDENCE_SOURCE_BYTE_DRIFT');
  return files.length;
}

function maintainerSet(root,manifest){
  need(manifest?.schema==='ZGMINI_PC_MAINTENANCE_INSTALL_V1'&&
    manifest.sourceSha===MAINT_SHA&&
    manifest.files&&typeof manifest.files==='object'&&
    !Array.isArray(manifest.files)&&
    same(sorted(Object.keys(manifest.files)),sorted(MAINT_FILES))&&
    MAINT_FILES.every(rel=>SHA(manifest.files[rel])),
    'C_EVIDENCE_MAINTAINER_MANIFEST_INVALID');
  for(const rel of MAINT_FILES)
    need(HASH(bytes(root,M+'/'+rel))===manifest.files[rel],
      'C_EVIDENCE_MAINTAINER_BYTE_DRIFT');
  return MAINT_FILES.length;
}

function capture(root,pins){
  need(same(names(root,COWNER),EXPECTED_C_FILES),
    'C_EVIDENCE_C_CLAIM_EXTRA_OR_MISSING_FILE');
  need(absent(root,`${M}/leases/controller-recovery-continuation-${REQ}`)&&
    absent(root,`${M}/leases/controller-install-recovered-${REQ}`)&&
    absent(root,`${M}/leases/controller-recovery-archived-${REQ}`)&&
    ['PRE_ARCHIVE','ORIGINAL_LEASE_ARCHIVE_ATTEMPTED',
     'COMPLETE','OWN_CLAIM_ARCHIVE_ATTEMPTED'].every(x=>
      absent(root,`${COWNER}/${x}.json`)),
    'C_EVIDENCE_OWNER_OR_ARCHIVE_CONFLICT');
  const paths={backlog:`${M}/backlog/${REQ}.json`,
    cOwner:`${COWNER}/owner.json`,
    oldOwner:`${M}/leases/controller-install/owner.json`,
    oldRecovery:`${M}/leases/controller-install/RECOVERY_REQUIRED.json`,
    controller:`${CONTROL}/host.json`,stage:`${STAGE}/host.json`,
    maintainer:`${M}/MAINTENANCE_INSTALL.json`};
  for(const name of MARKERS)paths[name]=`${COWNER}/${name}.json`;
  const records={};
  for(const [key,rel] of Object.entries(paths))records[key]=json(root,rel);
  const fileIdentity=Object.fromEntries(Object.entries(paths).map(([key,rel])=>{
    const st=fs.lstatSync(checkedPath(root,rel));
    return [key,{dev:st.dev,ino:st.ino,size:st.size,nlink:st.nlink,
      mtimeMs:st.mtimeMs,birthtimeMs:st.birthtimeMs}];
  }));
  need(records.controller.sha===pins.controller&&
    records.stage.sha===pins.stage&&
    records.maintainer.sha===pins.maintainer&&
    records.oldOwner.sha===pins.oldOwner&&
    records.oldRecovery.sha===pins.oldRecovery,
    'C_EVIDENCE_ORIGINAL_MANIFEST_SHA_DRIFT');
  need(dead(records.cOwner.value.pid)&&dead(records.oldOwner.value.pid),
    'C_EVIDENCE_PREVIOUS_OWNER_ACTIVE_OR_UNKNOWN');
  const sourceCounts={
    installed:sourceSet(root,records.controller.value,CONTROL,CORE_SHA),
    staged:sourceSet(root,records.stage.value,STAGE,STAGE_SHA,true),
    maintainer:maintainerSet(root,records.maintainer.value),
  };
  const fileHashes=Object.fromEntries(Object.entries(records)
    .map(([key,v])=>[key,v.sha]));
  return {records,fileHashes,fileIdentity,sourceCounts,
    replay:summarize996ReplayJournal(records.backlog.value.replays)};
}

export function collect996InterruptedEvidenceR2({
  originalObservation=null,root=ROOT,testOnly=false,pins=PINS,
  afterFirstCapture=null}={}){
  try{
    if(testOnly)need(process.platform!=='win32'&&path.isAbsolute(root)&&
      path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&
      path.basename(root).startsWith('zgmini-996-test-')&&pins!==PINS&&
      Object.keys(PINS).every(k=>SHA(pins?.[k]))&&
      (afterFirstCapture===null||typeof afterFirstCapture==='function'),
      'C_EVIDENCE_TEST_PORT_REJECTED');
    else need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
      !process.env.RUNNER_NAME&&
      path.win32.normalize(root).toLowerCase()===
        path.win32.normalize(ROOT).toLowerCase()&&pins===PINS&&
        afterFirstCapture===null&&originalObservation===null,
      'C_EVIDENCE_ORIGINAL_WINDOWS_ONLY');
    // Production cannot be supplied a synthetic or historical 14/14 object.
    // Only a SAME-PROCESS fresh read of the original physical state is valid.
    if(!testOnly)originalObservation=collect996InterruptedEvidence();
    need(originalObservation?.status==='READONLY_INTERRUPTED_PHASE_CONSISTENT'&&
      originalObservation?.checksPassed===14&&
      originalObservation?.checksTotal===14&&
      originalObservation?.executionAuthorized===false&&
      SHA(originalObservation.backlogSha256),
      'C_EVIDENCE_PRIOR_READONLY_NOT_VERIFIED');
    const first=capture(root,pins);
    if(afterFirstCapture)afterFirstCapture(); // Simulation only.
    const second=capture(root,pins);
    need(same(first.fileHashes,second.fileHashes)&&
      same(first.fileIdentity,second.fileIdentity)&&
      same(first.sourceCounts,second.sourceCounts)&&
      same(first.replay,second.replay)&&
      first.fileHashes.backlog===originalObservation.backlogSha256,
      'C_EVIDENCE_SNAPSHOT_DRIFT');
    need(first.records.backlog.value.schema==='ZGMINI_PC_BACKLOG_V1'&&
      first.records.backlog.value.requestId===REQ&&
      first.records.backlog.value.pausedAt===originalObservation.pausedAt&&
      first.records.backlog.value.resumedAt===originalObservation.resumedAt,
      'C_EVIDENCE_PAUSE_WINDOW_IDENTITY_DRIFT');
    return Object.freeze({schema:'ZGMINI_CONTROLLER_996_INTERRUPTED_EVIDENCE_R2',
      requestId:REQ,status:'READONLY_EVIDENCE_SNAPSHOT_CONSISTENT',
      code:'C_CLAIM_INDEPENDENT_OWNER_HANDOFF_NOT_APPROVED',
      originalClaimSha256:first.fileHashes.cOwner,
      originalClaimFileIdentitySha256:HASH(Buffer.from(JSON.stringify(
        first.fileIdentity.cOwner))),
      markerSha256:Object.fromEntries(MARKERS.map(name=>[name,
        first.fileHashes[name]])),
      backlogSha256:first.fileHashes.backlog,
      pausedAt:originalObservation.pausedAt,
      resumedAt:originalObservation.resumedAt,
      replayCount:first.replay.replayCount,
      replayDoneCount:first.replay.doneCount,
      replaySkippedCount:first.replay.skippedCount,
      replayJournalSha256:first.replay.replayJournalSha256,
      replayEntries:first.replay.entries,sourceFiles:first.sourceCounts,
      sourceManifestHashPostcheckVerified:true,
      replayStatusIsNotExecutionProof:true,
      fullSourceBytePostcheckVerified:false,
      claimProvenanceExternallyPinned:false,
      executionAuthorized:false,operationalWrites:0,issuePosts:0,pcRetries:0});
  }catch(e){
    return Object.freeze({schema:'ZGMINI_CONTROLLER_996_INTERRUPTED_EVIDENCE_R2',
      requestId:REQ,status:'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE',
      code:/^C_EVIDENCE_[A-Z0-9_]+$/.test(e?.code??'')?e.code:
        'C_EVIDENCE_READ_OR_STATE_UNKNOWN',
      sourceManifestHashPostcheckVerified:false,
      fullSourceBytePostcheckVerified:false,
      claimProvenanceExternallyPinned:false,
      executionAuthorized:false,operationalWrites:0,issuePosts:0,pcRetries:0});
  }
}
