// Read-only import availability check for approved Writer B overlays.
// This checks literal relative Node module references in approved AFTER
// source only; it does not claim coverage of computed imports or package
// resolution, and it never copies an unapproved dependency from candidate.
import path from 'node:path';
import {TextDecoder} from 'node:util';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)stop(code);};

// Captures literal-relative: static import/export "from", side-effect import,
// dynamic import('literal') and CJS require('literal'). The references remain
// data: no import/require/module evaluation occurs here.
const REFERENCE=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)(['"])(\.{1,2}\/[^'"\r\n]{1,240})\1/g;
const EXT=/\.(?:mjs|cjs|js|json)$/i;
const ROOT_ESCAPE=/^(?:\.\.(?:\/|$)|\/)/;

export function relativeModuleReferences(file,bytes){
 need(typeof file==='string'&&file.length<=180&&
  !file.includes('\\')&&!ROOT_ESCAPE.test(file)&&
  !file.split('/').some(s=>s===''||s==='.'||s==='..')&&
  Buffer.isBuffer(bytes)&&bytes.length>=1&&bytes.length<=2_000_000,
  'WRITER_B_IMPORT_SOURCE_CONTRACT_STOP');
 let source;
 try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
 catch{stop('WRITER_B_IMPORT_SOURCE_UTF8_STOP');}
 const refs=new Set();
 for(const match of source.matchAll(REFERENCE)){
  const relative=match[2];
  need(!/[\\\0?#]/.test(relative),
   'WRITER_B_IMPORT_PATH_SCOPE_STOP');
  const resolved=path.posix.normalize(path.posix.join(
   path.posix.dirname(file),relative));
  need(!ROOT_ESCAPE.test(resolved)&&
   resolved.split('/').every(s=>s&&s!=='.'&&s!=='..')&&
   EXT.test(resolved),'WRITER_B_IMPORT_PATH_SCOPE_STOP');
  refs.add(resolved);
  need(refs.size<=256,'WRITER_B_IMPORT_REFERENCE_LIMIT_STOP');
 }
 return [...refs];
}

export function verifyWriterBImportAvailability({afterFiles,existing}){
 need(afterFiles instanceof Map&&afterFiles.size>=1&&afterFiles.size<=32&&
  typeof existing==='function','WRITER_B_IMPORT_CHECK_CONTRACT_STOP');
 let inspected=0;
 for(const [file,bytes] of afterFiles){
  for(const ref of relativeModuleReferences(file,bytes)){
   inspected++;
   need(inspected<=1024,'WRITER_B_IMPORT_REFERENCE_LIMIT_STOP');
   if(afterFiles.has(ref))continue;
   // 'existing' is an injected bounded, read-only operational-source
   // existence check. Never inspect arbitrary workspace or candidate files.
   need(existing(ref)===true,'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
  }
 }
 return {status:'PASS',code:'WRITER_B_LITERAL_IMPORTS_AVAILABLE',
  approvedFiles:afterFiles.size,checkedReferences:inspected,
  evidenceLevel:'LITERAL_RELATIVE_IMPORTS_ONLY'};
}
