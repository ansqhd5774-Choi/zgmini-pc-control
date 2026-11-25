// Read-only integrity check for an independently pinned approval source.
// A caller-supplied pin is NOT authority. Never infer approval from main,
// a PR, an Issue body, or this receipt. No publication/execution capability.
import {createHash} from 'node:crypto';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const hex=(x,n)=>typeof x==='string'&&x.length===n&&/^[a-f0-9]+$/.test(x);
const sha256=b=>createHash('sha256').update(b).digest('hex');
const gitBlob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const allowed=p=>typeof p==='string'&&p.length<=240&&(p==='docs/PC_AUTOMATION_STANDARD.md'||/^approvals\/(controller-updates|controller-selective-targets|writer-updates)\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(p));
const out=(state,reason,extra={})=>Object.freeze({mode:'SHADOW_ONLY',state,reason,canPublish:false,canExecute:false,...extra});
export function inspectPinnedApprovalSource(pin,observation){
 if(!exact(pin,['repository','revision','path','blobSha','sha256'])||pin.repository!==repo||!hex(pin.revision,40)||!allowed(pin.path)||!hex(pin.blobSha,40)||!hex(pin.sha256,64))
  return out('INVALID','PIN_FORMAT');
 if(!exact(observation,['repository','revision','path','blobSha','bytes'])||!Buffer.isBuffer(observation.bytes)||observation.bytes.length===0||observation.bytes.length>1048576)
  return out('EVIDENCE_MISSING','SOURCE_BYTES_MISSING');
 if(['repository','revision','path','blobSha'].some(k=>pin[k]!==observation[k]))
  return out('REJECTED','SOURCE_IDENTITY_MISMATCH');
 if(gitBlob(observation.bytes)!==pin.blobSha||sha256(observation.bytes)!==pin.sha256)
  return out('REJECTED','SOURCE_BYTES_MISMATCH');
 return out('PIN_MATCH_ONLY','INTEGRITY_MATCH_NOT_AUTHORITY',{repository:repo,revision:pin.revision,path:pin.path,blobSha:pin.blobSha,sha256:pin.sha256});
}
