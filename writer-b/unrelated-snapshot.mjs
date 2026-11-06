// Bounded evidence for unrelated tracked/untracked dirty paths. A large
// unrelated archive must not become an arbitrary global installation Gate.
// Exact target + protected files are checked separately, without size limits.
import fs from 'node:fs';
import path from 'node:path';
import {sha256} from './contract.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const SMALL_LIMIT=256*1024;
const STATUS_LIMIT=4_000_000; // Already bounded by the Git child maxBuffer.

function parsePorcelainZ(bytes){
 need(bytes.length<=STATUS_LIMIT,'WRITER_B_DIRTY_PORCELAIN_FORMAT_STOP');
 if(bytes.length===0)return [];
 need(bytes.at(-1)===0,'WRITER_B_DIRTY_PORCELAIN_FORMAT_STOP');
 const fields=bytes.toString('utf8').split('\0');fields.pop();
 const records=[];
 for(let i=0;i<fields.length;i++){
  const row=fields[i];
  need(row.length>=4&&row[2]===' ','WRITER_B_DIRTY_PORCELAIN_FORMAT_STOP');
  const paths=[row.slice(3)];
  // `git status --porcelain=v1 -z` gives R/C as XY destination\0source\0.
  // Both names are relevant to an overlap and preservation assertion.
  if(/[RC]/.test(row.slice(0,2))){
   need(i+1<fields.length&&fields[i+1].length>0,
    'WRITER_B_DIRTY_PORCELAIN_FORMAT_STOP');
   paths.push(fields[++i]);
  }
  records.push({row,paths});
 }
 return records;
}

export function snapshotUnrelatedDirty({sourceRoot,statusBytes,manifest,
 lstat=fs.lstatSync,readFile=fs.readFileSync}={}){
 need(typeof sourceRoot==='string'&&Buffer.isBuffer(statusBytes)&&
  Array.isArray(manifest?.files)&&Array.isArray(manifest?.protectedFiles),
  'WRITER_B_UNRELATED_SNAPSHOT_CONTRACT_STOP');
 const forbidden=new Set([...manifest.files,...manifest.protectedFiles]
  .map(f=>f.path.toLowerCase()));
 const rows=parsePorcelainZ(statusBytes);
 const evidence=[];
 for(const {row,paths} of rows)for(const [index,rel] of paths.entries()){
  need(!rel.startsWith('/')&&!rel.includes('\\')&&
   rel.length>0&&!rel.split('/').includes('..')&&!forbidden.has(rel.toLowerCase()),
   'WRITER_B_TARGET_DIRTY_STOP');
  const file=path.join(sourceRoot,...rel.split('/'));
  const identity={row,path:rel,role:index===0?'destination-or-path':'original'};
  let stat;
  try{stat=lstat(file);}catch(error){
   if(error?.code==='ENOENT'){
    evidence.push({...identity,kind:'deleted'});continue;
   }
   throw error;
  }
  const kind=stat.isSymbolicLink()?'symlink':stat.isFile()?'file':
   stat.isDirectory()?'dir':'other';
  const item={...identity,kind,size:stat.size,mtimeMs:stat.mtimeMs,
   ctimeMs:stat.ctimeMs,mode:stat.mode,ino:stat.ino,dev:stat.dev};
  // For small regular files, prove exact bytes. Large unrelated files and
  // symlinks only need unchanged metadata: Git's exact tree diff cannot
  // update paths outside the approved target set.
  if(kind==='file'&&stat.size<=SMALL_LIMIT)
   item.sha256=sha256(readFile(file));
  evidence.push(item);
 }
 return {porcelainSha256:sha256(statusBytes),evidence};
}
