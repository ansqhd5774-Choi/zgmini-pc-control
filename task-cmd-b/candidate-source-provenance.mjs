// Read-only verification of the one approved R47 CMD source, not the whole checkout.
// All observations must come from the same pinned Git revision. No Task/PC writes.
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};

export function pinnedR47CandidateBlobOid(treeEntry,sourcePath){
 // Require a regular, tracked Git blob at exactly the approved source path.
 const m=/^100644 blob ([a-f0-9]{40})\t([^\r\n]+)$/.exec(treeEntry??'');
 need(m&&m[2]===sourcePath,'TASK_CMD_B_CANDIDATE_GIT_MODE_STOP');
 return m[1];
}

export function verifiedR47CandidateSource(m,{
 initialHead,finalHead,treeEntry,pathStatus,blobOid,gitBlob,worktreeBytes
}){
 need(initialHead===m.sourceSha&&finalHead===m.sourceSha,
  'TASK_CMD_B_CANDIDATE_HEAD_DRIFT_STOP');
 need(blobOid===pinnedR47CandidateBlobOid(treeEntry,m.sourcePath),
  'TASK_CMD_B_CANDIDATE_GIT_BLOB_STOP');
 // The workflow may contain unrelated generated files. Only the authorized
 // CMD is a candidate effect; it must have no staged/untracked/worktree drift.
 need(pathStatus==='','TASK_CMD_B_CANDIDATE_SOURCE_DRIFT_STOP');
 need(Buffer.isBuffer(gitBlob)&&gitBlob.length>0&&
  gitBlob.length<=1024*1024&&hash(gitBlob)===m.afterSha256,
  'TASK_CMD_B_CANDIDATE_GIT_BLOB_STOP');
 need(Buffer.isBuffer(worktreeBytes)&&worktreeBytes.length===gitBlob.length&&
  worktreeBytes.equals(gitBlob)&&hash(worktreeBytes)===m.afterSha256,
  'TASK_CMD_B_CANDIDATE_WORKTREE_DRIFT_STOP');
 return worktreeBytes;
}
