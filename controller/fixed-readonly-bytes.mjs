import fs from 'node:fs';
import path from 'node:path';

// Only call with a fixed, caller-owned file path under an already verified root.
// This module does not discover paths, interpret secrets or validate domain JSON.
const failure=reason=>({ok:false,reason});
const inside=(root,file)=>{
 const rel=path.relative(root,file);
 return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);
};

export function readFixedReadonlyBytes(file,{
 fileSystem=fs,verifiedRoot,minBytes=1,maxBytes
}={}){
 if(typeof file!=='string'||!path.isAbsolute(file)||
  typeof verifiedRoot!=='string'||!path.isAbsolute(verifiedRoot)||
  !Number.isSafeInteger(minBytes)||minBytes<1||
  !Number.isSafeInteger(maxBytes)||maxBytes<minBytes)
  return failure('UNSAFE_FILE');
 let initial,resolved;
 try{initial=fileSystem.lstatSync(file);}
 catch(error){return failure(error?.code==='ENOENT'?'MISSING':'UNREADABLE');}
 if(!initial.isFile()||initial.isSymbolicLink())return failure('UNSAFE_FILE');
 if(initial.size<minBytes||initial.size>maxBytes||!Number.isSafeInteger(initial.size))
  return failure('SIZE_INVALID');
 try{
  const realpath=fileSystem.realpathSync.native??fileSystem.realpathSync;
  resolved=realpath(file);
  if(!inside(verifiedRoot,resolved))return failure('UNSAFE_FILE');
 }catch{return failure('UNSAFE_FILE');}
 let fd;
 try{
  const flags=process.platform==='win32'?'r':
   fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0);
  fd=fileSystem.openSync(file,flags);
  const opened=fileSystem.fstatSync(fd);
  if(!opened.isFile()||opened.size<minBytes||opened.size>maxBytes)
   return failure('SIZE_INVALID');
  if(opened.size!==initial.size||
   (initial.ino&&opened.ino&&initial.ino!==opened.ino)||
   (initial.dev&&opened.dev&&initial.dev!==opened.dev))
   return failure('CHANGED_DURING_READ');
  const bytes=Buffer.alloc(opened.size);
  let total=0;
  while(total<bytes.length){
   const read=fileSystem.readSync(fd,bytes,total,bytes.length-total,total);
   if(!Number.isSafeInteger(read)||read<=0)break;
   total+=read;
  }
  if(total!==bytes.length)return failure('SHORT_READ');
  const after=fileSystem.fstatSync(fd);
  if(!after.isFile()||after.size!==opened.size||
   (opened.ino&&after.ino&&opened.ino!==after.ino)||
   (opened.dev&&after.dev&&opened.dev!==after.dev)||
   (Number.isFinite(opened.mtimeMs)&&Number.isFinite(after.mtimeMs)&&
     opened.mtimeMs!==after.mtimeMs))
   return failure('CHANGED_DURING_READ');
  return {ok:true,bytes};
 }catch(error){
  if(error?.code==='ELOOP')return failure('UNSAFE_FILE');
  return failure('UNREADABLE');
 }finally{
  if(fd!==undefined)try{fileSystem.closeSync(fd);}catch{}
 }
}

