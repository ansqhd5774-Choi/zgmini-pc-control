/**
 * R54 B fixed six-file *installed-byte* inventory.
 *
 * Runtime caller passes only its trusted dataRoot (E:/ZGmini/data). The
 * pc-job request cannot select paths, run commands, provide expected hashes,
 * or trigger collection/publication. This does not establish Task identity,
 * approval, or permission to perform a B install.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const DEFAULT_DATA_ROOT='E:/ZGmini/data';
const SOURCE_PARTS=Object.freeze(['pc-writer','theme-nine-r54']);
const MAX_SOURCE_BYTES=4_000_000;
export const R54_SIX_SOURCE_PATHS=Object.freeze([
 'scripts/pc-writer/theme-nine-r54-public-connect.mjs',
 'scripts/pc-writer/theme-nine-r51-stage-current.mjs',
 'scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs',
 'scripts/pc-writer/theme-nine-r54-public-record.mjs',
 'scripts/pc-writer/theme-nine-r48-d1-publication.mjs',
 'worker/theme-nine-r37-public.mjs',
]);

function statState(file,io){
 try{return {info:io.lstatSync(file)};}
 catch(error){return {state:error?.code==='ENOENT'?'MISSING':'READ_FAILED'};}
}
function realPath(file,io){
 return io.realpathSync.native?io.realpathSync.native(file):io.realpathSync(file);
}
function within(root,resolved){
 const rel=path.relative(root,resolved);
 return rel===''||(rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel));
}
function classifySource(dataRoot,canonicalRoot,sourcePath,io){
 const parts=[...SOURCE_PARTS,...sourcePath.split('/')];
 let current=dataRoot;
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);
  const {info,state}=statState(current,io);
  if(!info)return {state,sha256:null,bytes:null};
  if(info.isSymbolicLink())return {state:'REDIRECT_REJECTED',sha256:null,bytes:null};
  const isLast=i===parts.length-1;
  if(isLast?!info.isFile():!info.isDirectory())
   return {state:'INVALID_TYPE',sha256:null,bytes:null};
  let resolved;
  try{resolved=realPath(current,io);}
  catch{return {state:'READ_FAILED',sha256:null,bytes:null};}
  if(!within(canonicalRoot,resolved))
   return {state:'REDIRECT_REJECTED',sha256:null,bytes:null};
  if(isLast){
   if(info.size<0||info.size>MAX_SOURCE_BYTES)
    return {state:'INVALID_SIZE',sha256:null,bytes:null};
   try{
    const buffer=io.readFileSync(current);
    const after=io.lstatSync(current);
    if(after.isSymbolicLink()||!after.isFile()||
      after.size!==info.size||after.mtimeMs!==info.mtimeMs||
      buffer.length!==info.size)
     return {state:'CHANGED_DURING_READ',sha256:null,bytes:null};
    return {state:'PRESENT',sha256:createHash('sha256').update(buffer).digest('hex'),
     bytes:buffer.length};
   }catch{return {state:'READ_FAILED',sha256:null,bytes:null};}
  }
 }
 return {state:'READ_FAILED',sha256:null,bytes:null};
}

/**
 * Injectable dataRoot and fsOps exist for isolated fixture tests; production
 * wiring must use the controller's fixed trusted dataRoot, never job payload.
 */
export function inspectR54SixFileInventory(dataRoot=DEFAULT_DATA_ROOT,{fsOps=fs}={}){
 const result={
  status:'BLOCKED',code:'R54_DATA_ROOT_UNAVAILABLE',
  scope:'FIXED_R54_WRITER_SOURCE_FILES_ONLY',
  writerRoot:'pc-writer/theme-nine-r54',
  files:R54_SIX_SOURCE_PATHS.map(file=>({path:file,state:'UNKNOWN_ROOT',
   sha256:null,bytes:null})),
  expectedCount:R54_SIX_SOURCE_PATHS.length,presentCount:0,missingCount:0,
  rejectedCount:0,inventoryComplete:false,
  runtimeTaskBindingVerified:false,approvedForInstallation:false,
  providerCalls:0,sqliteOpened:false,d1Writes:0,operationalWrites:0,
  transientELogsWritten:0,
 };
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot)){
  result.code='R54_DATA_ROOT_NOT_ABSOLUTE';return result;
 }
 const {info}=statState(dataRoot,fsOps);
 if(!info||!info.isDirectory()||info.isSymbolicLink())return result;
 let canonicalRoot;
 try{canonicalRoot=realPath(dataRoot,fsOps);}
 catch{return result;}
 result.files=R54_SIX_SOURCE_PATHS.map(file=>({path:file,
  ...classifySource(dataRoot,canonicalRoot,file,fsOps)}));
 result.presentCount=result.files.filter(x=>x.state==='PRESENT').length;
 result.missingCount=result.files.filter(x=>x.state==='MISSING').length;
 result.rejectedCount=result.files.filter(x=>
  !['PRESENT','MISSING'].includes(x.state)).length;
 result.inventoryComplete=result.presentCount===result.expectedCount;
 result.status=result.rejectedCount?'BLOCKED':'PASS';
 result.code=result.rejectedCount?'R54_SIXFILE_INVENTORY_UNSAFE_OR_UNREADABLE':
  result.missingCount?'R54_SIXFILE_INVENTORY_MISSING':
  'R54_SIXFILE_INVENTORY_COMPLETE';
 return result;
}
