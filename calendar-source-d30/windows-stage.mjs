// Trusted Windows B-host helper for ER1 D+30 source preparation only.
// Reads caller-supplied bytes and writes merge inputs solely inside a private
// temporary directory. It NEVER edits an operating checkout, config, task,
// registry, database or scheduler, and it is NOT an Issue receiver/installer.
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {assessD30SourceInstall,D30_INSTALL_CONTRACT} from './contract.mjs';

const FILES=D30_INSTALL_CONTRACT.operationalFiles;
const PATHS=FILES.map(x=>x.path);
const MAX_BYTES=2_000_000;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)stop(code);};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitBlob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const sameKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join('\0')===[...keys].sort().join('\0');

function assertBytes(bytes){
  need(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<MAX_BYTES,
    'ER1_D30_STAGE_INPUT_BYTES_STOP');
  need(!bytes.includes(0),'ER1_D30_STAGE_BINARY_STOP');
  try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{stop('ER1_D30_STAGE_UTF8_STOP');}
}
function lineEnding(bytes){
  const text=bytes.toString('utf8');
  const all=text.match(/\n/g)?.length??0;
  const crlf=text.match(/\r\n/g)?.length??0;
  need(!text.includes('\r')||crlf===all&&text.match(/\r/g)?.length===crlf,
    'ER1_D30_STAGE_MIXED_EOL_STOP');
  return all===0?'NONE':crlf===all?'CRLF':'LF';
}
function writePrivate(file,bytes){
  const fd=fs.openSync(file,'wx',0o600);
  try{fs.writeSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}

// Useful as a pure-fixture test target; real caller must additionally pin
// all three inputs using previewD30ThreeFiles. Zero source-path writes.
export function mergeTextThreeWay({base,ours,theirs,gitExe='git',tempRoot=os.tmpdir()}={}){
  for(const bytes of [base,ours,theirs])assertBytes(bytes);
  need([lineEnding(base),lineEnding(ours),lineEnding(theirs)]
    .filter(x=>x!=='NONE').every((x,_,arr)=>x===arr[0]),
  'ER1_D30_STAGE_EOL_INCOMPATIBLE_STOP');
  need(typeof gitExe==='string'&&gitExe.trim()&&!/[\r\n\0]/.test(gitExe),
    'ER1_D30_STAGE_GIT_EXE_STOP');
  need(typeof tempRoot==='string'&&tempRoot.trim()&&
    fs.lstatSync(tempRoot).isDirectory()&&!fs.lstatSync(tempRoot).isSymbolicLink(),
  'ER1_D30_STAGE_TEMP_ROOT_STOP');

  const dir=fs.mkdtempSync(path.join(fs.realpathSync(tempRoot),'zgmini-d30-'));
  const names=['ours.mjs','base.mjs','theirs.mjs'];
  try{
    for(const [i,bytes] of [ours,base,theirs].entries())
      writePrivate(path.join(dir,names[i]),bytes);
    const run=(left,right)=>spawnSync(gitExe,
      ['merge-file','-p',path.join(dir,left),path.join(dir,'base.mjs'),path.join(dir,right)],
      {shell:false,windowsHide:true,encoding:null,timeout:30_000,
        maxBuffer:MAX_BYTES*2,env:{...process.env,GIT_TERMINAL_PROMPT:'0',
          GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0'}});
    const forward=run('ours.mjs','theirs.mjs');
    need(!forward.error&&Number.isInteger(forward.status),
      'ER1_D30_STAGE_MERGE_TOOL_STOP');
    need(forward.status===0,'ER1_D30_STAGE_MERGE_CONFLICT_STOP');
    const reverse=run('theirs.mjs','ours.mjs');
    need(!reverse.error&&Number.isInteger(reverse.status)&&reverse.status===0,
      'ER1_D30_STAGE_MERGE_REVERSE_STOP');
    need(Buffer.isBuffer(forward.stdout)&&forward.stdout.length>0&&
      forward.stdout.equals(reverse.stdout),
    'ER1_D30_STAGE_PRESERVATION_STOP');
    // Clean, identical forward/reverse merge is a syntactic preservation check;
    // it does NOT establish business meaning or authorize an operating write.
    return {bytes:Buffer.from(forward.stdout),conflictCount:0,
      preservedVerified:true,sourceWrites:0};
  }finally{
    for(const name of names){
      const p=path.join(dir,name);
      if(fs.existsSync(p))fs.unlinkSync(p);
    }
    fs.rmdirSync(dir);
  }
}

/**
 * All maps contain exactly the three D+30 relative paths with raw Buffers.
 * Base and candidate Git bytes are pinned to the PR's exact SHA256/blob.
 * The PC preimages are bound to the separately attested before SHA at B time;
 * the current f80 file contents are intentionally NOT invented here.
 */
export function previewD30ThreeFiles({publicBases,windowsPreimages,candidateTargets,
  gitExe='git',tempRoot=os.tmpdir()}={}){
  for(const map of [publicBases,windowsPreimages,candidateTargets])
    need(sameKeys(map,PATHS),'ER1_D30_STAGE_THREE_PATH_SCOPE_STOP');
  const files={};
  const mergedBytes=new Map();
  for(const pinned of FILES){
    const rel=pinned.path;
    const base=publicBases[rel],ours=windowsPreimages[rel],theirs=candidateTargets[rel];
    for(const bytes of [base,ours,theirs])assertBytes(bytes);
    need(sha256(base)===pinned.baseSha256&&
      sha256(theirs)===pinned.targetSha256&&gitBlob(theirs)===pinned.targetBlob,
    'ER1_D30_STAGE_PUBLIC_SOURCE_PIN_STOP');
    let merged;
    const beforeSha256=sha256(ours);
    if(beforeSha256===pinned.baseSha256){
      merged={bytes:Buffer.from(theirs),conflictCount:0,
        preservedVerified:true,sourceWrites:0};
    }else merged=mergeTextThreeWay({base,ours,theirs,gitExe,tempRoot});
    const afterSha256=sha256(merged.bytes);
    files[rel]={beforeSha256,baseSha256:pinned.baseSha256,
      candidateSha256:pinned.targetSha256,candidateBlob:pinned.targetBlob,
      afterSha256,mergeRequired:beforeSha256!==pinned.baseSha256,
      conflictCount:0,preservedVerified:merged.preservedVerified,sourceWrites:0};
    mergedBytes.set(rel,Buffer.from(merged.bytes));
  }
  return {status:'READ_ONLY_PREVIEW_COMPLETE',files,
    sourceWrites:0,readMergedBytes:rel=>{
      need(PATHS.includes(rel),'ER1_D30_STAGE_UNKNOWN_PATH_STOP');
      return Buffer.from(mergedBytes.get(rel));
    }};
}

// Pure exact after-byte comparison, separately testable with synthetic proofs.
// This alone does not substitute for assessD30SourceInstall's B authorization.
export function verifyApprovedD30AfterBytes(preview,approvedBManifest){
  need(preview?.status==='READ_ONLY_PREVIEW_COMPLETE'&&
    sameKeys(preview.files,PATHS)&&
    Array.isArray(approvedBManifest?.files)&&
    approvedBManifest.files.length===PATHS.length&&
    approvedBManifest.files.every((f,i)=>f.path===PATHS[i]),
  'ER1_D30_STAGE_APPROVED_SCOPE_STOP');
  for(const f of approvedBManifest.files){
    const actual=preview.files[f.path];
    need(f.afterSha256===actual.afterSha256&&
      (f.mergePreview==null||
        f.mergePreview.preservedVerified===actual.preservedVerified),
    'ER1_D30_STAGE_APPROVED_BYTES_DRIFT');
  }
  return true;
}

/**
 * Requires separately authenticated A/approval evidence, and verifies a fresh
 * preview against each exact manifest afterSha256 before exposing staged bytes
 * to the existing B host. Stage ownership/lease/apply/recovery remain host work.
 */
export function stageApprovedD30ThreeFiles({approvedBManifest,activeCore,
  publicBases,windowsPreimages,candidateTargets,gitExe,tempRoot}={}){
  const preview=previewD30ThreeFiles({publicBases,windowsPreimages,
    candidateTargets,gitExe,tempRoot});
  const installedFileHashes=Object.fromEntries(PATHS.map(p=>
    [p,preview.files[p].beforeSha256]));
  const decision=assessD30SourceInstall({activeCore,installedFileHashes,approvedBManifest});
  need(decision.status==='READY_FOR_SEPARATE_APPROVED_B_INSTALL',
    decision.code??'ER1_D30_STAGE_APPROVAL_STOP');
  verifyApprovedD30AfterBytes(preview,approvedBManifest);
  const stageId=`d30-${randomUUID()}`;
  const files=Object.fromEntries(FILES.map(f=>[f.path,{
    sha256:preview.files[f.path].afterSha256,
    candidateSha256:f.targetSha256,blob:f.targetBlob,
    preservationVerified:preview.files[f.path].preservedVerified,
  }]));
  return {stageId,files,sourceWrites:0,
    readStagedBytes:rel=>preview.readMergedBytes(rel)};
}
