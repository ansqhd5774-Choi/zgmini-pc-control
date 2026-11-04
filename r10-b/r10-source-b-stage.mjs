// Isolated bytes-only R10 B preparation. Does not import or execute candidate
// source, open DBs, call APIs or alter the operating source/config/Git/Tasks.
import fs from 'node:fs';
import path from 'node:path';
import {PATHS,R10_B_FILES,sha256,stop} from './r10-source-b-contract.mjs';

const MAX_SOURCE_BYTES=262_144;
const inside=(root,file)=>{
 const relative=path.relative(root,file);
 return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)
  &&!path.isAbsolute(relative);
};
function realDir(file,fileSystem){
 let real,stat;
 try{real=fileSystem.realpathSync.native(file);stat=fileSystem.lstatSync(real);}
 catch{stop('R10_B_SOURCE_DIRECTORY_NOT_VERIFIED')}
 if(!stat.isDirectory()||stat.isSymbolicLink())
  stop('R10_B_SOURCE_DIRECTORY_NOT_VERIFIED');
 return real;
}
function readSafeFile(root,relative,fileSystem){
 const file=path.join(root,...relative.split('/'));
 let real,stat;
 try{real=fileSystem.realpathSync.native(file);stat=fileSystem.lstatSync(file);}
 catch{stop('R10_B_REQUIRED_FILE_MISSING_STOP')}
 if(!inside(root,real)||!stat.isFile()||stat.isSymbolicLink()||
  stat.size<1||stat.size>MAX_SOURCE_BYTES)
  stop('R10_B_REQUIRED_FILE_UNSAFE_STOP');
 return fileSystem.readFileSync(file);
}
function importsOf(bytes){
 const text=bytes.toString('utf8');
 // The approved R10 modules use static relative imports only. Unknown dynamic
 // module loading must be reviewed outside the operational installer.
 if(/\bimport\s*\(/.test(text)||/\brequire\s*\(/.test(text))
  stop('R10_B_DYNAMIC_IMPORT_REVIEW_STOP');
 return [...text.matchAll(/\b(?:import|export)\s+(?:[\s\S]*?\s+from\s*)?['"]([^'"]+)['"]/g)]
  .map(m=>m[1]);
}

export function inspectR10BSourceBytes({candidateRoot,operatingRoot,manifest,
 fileSystem=fs,strictWindows=true}={}){
 if(typeof candidateRoot!=='string'||typeof operatingRoot!=='string'||
  !path.isAbsolute(candidateRoot)||!path.isAbsolute(operatingRoot)||
  (strictWindows&&process.platform!=='win32'))
  stop('R10_B_SOURCE_PATH_STOP');
 const candidate=realDir(candidateRoot,fileSystem);
 const operating=realDir(operatingRoot,fileSystem);
 if(candidate.toLowerCase()===operating.toLowerCase()||
  inside(operating,candidate)||inside(candidate,operating))
  stop('R10_B_CANDIDATE_LIVE_ALIAS_STOP');
 const files=[];
 for(const relative of PATHS){
  const proposed=readSafeFile(candidate,relative,fileSystem);
  const original=readSafeFile(operating,relative,fileSystem);
  const proposedDigest=sha256(proposed),originalDigest=sha256(original);
  if(proposedDigest!==R10_B_FILES[relative]||
    proposedDigest!==manifest?.candidateFilesSha256?.[relative])
    stop('R10_B_PINNED_CANDIDATE_FILE_DRIFT_STOP');
  if(originalDigest!==manifest?.originalFilesSha256?.[relative])
    stop('R10_B_ORIGINAL_SOURCE_FILE_DRIFT_STOP');
  const imports=importsOf(proposed);
  for(const imported of imports){
   if(!imported.startsWith('.'))stop('R10_B_EXTERNAL_IMPORT_REVIEW_STOP');
   const normalized=path.posix.normalize(path.posix.join(path.posix.dirname(relative),imported));
   if(normalized.startsWith('../')||normalized.startsWith('/')||
     normalized.includes('..\\'))stop('R10_B_IMPORT_ESCAPE_STOP');
   // Import targets are checked against the EFFECTIVE approved source tree.
   if(!PATHS.includes(normalized))readSafeFile(operating,normalized,fileSystem);
  }
  files.push({path:relative,candidateSha256:proposedDigest,
   originalSha256:originalDigest,bytes:proposed.length,imports:imports.length});
 }
 return {status:'PASS',code:'R10_B_ISOLATED_SOURCE_BYTES_AND_IMPORTS_VERIFIED',
  files,sourceExecuted:false,operationalWrites:0,providerCalls:0,
  sqliteOpened:false,d1Writes:0};
}

/** Creates a NEW isolated stage only. Never overwrites any preexisting stage. */
export function stageR10BBytes({candidateRoot,operatingRoot,stageRoot,manifest,
 fileSystem=fs,strictWindows=true}={}){
 const checked=inspectR10BSourceBytes({candidateRoot,operatingRoot,
  manifest,fileSystem,strictWindows});
 if(typeof stageRoot!=='string'||!path.isAbsolute(stageRoot)||
  (strictWindows&&!/^E:\\ZGmini\\automation\\r10-source-b-stage\\[a-z0-9-]+$/i.test(stageRoot)))
  stop('R10_B_STAGE_ROOT_STOP');
 if(strictWindows){
  // A fixed-looking E: path may still traverse a junction to another volume.
  const parent=realDir(path.dirname(stageRoot),fileSystem);
  if(!/^e:\\zgmini\\automation\\r10-source-b-stage$/i.test(parent))
   stop('R10_B_STAGE_PARENT_ESCAPE_STOP');
 }
 if(fileSystem.existsSync(stageRoot))stop('R10_B_STAGE_EXISTS_STOP');
 fileSystem.mkdirSync(stageRoot,{recursive:false});
 for(const relative of PATHS){
  const source=path.join(candidateRoot,...relative.split('/'));
  const dest=path.join(stageRoot,...relative.split('/'));
  fileSystem.mkdirSync(path.dirname(dest),{recursive:true});
  fileSystem.copyFileSync(source,dest,fileSystem.constants.COPYFILE_EXCL);
  if(sha256(readSafeFile(stageRoot,relative,fileSystem))!==R10_B_FILES[relative])
   stop('R10_B_STAGE_READBACK_MISMATCH_STOP');
 }
 return {...checked,stageStatus:'STAGED_ISOLATED_NO_PC_MUTATION'};
}
