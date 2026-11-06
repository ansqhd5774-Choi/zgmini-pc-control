// Bounded evidence for unrelated tracked/untracked dirty paths. A large
// unrelated archive must not become an arbitrary global installation Gate.
// Exact target + protected files are checked separately, without size limits.
import fs from 'node:fs';
import path from 'node:path';
import {sha256} from './contract.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const SMALL_LIMIT=256*1024;

export function snapshotUnrelatedDirty({sourceRoot,statusBytes,manifest,
 lstat=fs.lstatSync,readFile=fs.readFileSync}={}){
 need(typeof sourceRoot==='string'&&Buffer.isBuffer(statusBytes)&&
  Array.isArray(manifest?.files)&&Array.isArray(manifest?.protectedFiles),
  'WRITER_B_UNRELATED_SNAPSHOT_CONTRACT_STOP');
 const forbidden=new Set([...manifest.files,...manifest.protectedFiles]
  .map(f=>f.path.toLowerCase()));
 const rows=statusBytes.toString('utf8').split('\0').filter(Boolean);
 const evidence=[];
 for(const row of rows){
  need(row.length>=4&&row[2]===' '&&!/[RC]/.test(row.slice(0,2)),
   'WRITER_B_DIRTY_PORCELAIN_FORMAT_STOP');
  const rel=row.slice(3);
  need(!rel.startsWith('/')&&!rel.includes('\\')&&
   !rel.split('/').includes('..')&&!forbidden.has(rel.toLowerCase()),
   'WRITER_B_TARGET_DIRTY_STOP');
  const file=path.join(sourceRoot,...rel.split('/'));
  let stat;
  try{stat=lstat(file);}catch(error){
   if(error?.code==='ENOENT'){
    evidence.push({row,kind:'deleted'});continue;
   }
   throw error;
  }
  const kind=stat.isSymbolicLink()?'symlink':stat.isFile()?'file':
   stat.isDirectory()?'dir':'other';
  const item={row,kind,size:stat.size,mtimeMs:stat.mtimeMs,
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
