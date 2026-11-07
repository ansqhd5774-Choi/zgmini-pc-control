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
const EXT=/\.(?:mjs|cjs|js|json)$/i;
const ROOT_ESCAPE=/^(?:\.\.(?:\/|$)|\/)/;
const ID_START=/[A-Za-z_$]/;
const ID_BODY=/[A-Za-z0-9_$]/;

// Walk lexical tokens so strings and comments containing the word "from"
// do not become fictitious dependencies. Only literal local imports are proved.
function sourceTokens(code){
 const out=[];let i=0;
 const add=(kind,value)=>{
  out.push({kind,value});
  need(out.length<=200000,'WRITER_B_IMPORT_TOKENS_LIMIT_STOP');
 };
 while(i<code.length){
  const ch=code[i],next=code[i+1];
  if(/\s/.test(ch)){i++;continue;}
  if(ch==='/'&&next==='/'){
   i+=2;while(i<code.length&&code[i]!=='\n')i++;continue;
  }
  if(ch==='/'&&next==='*'){
   i+=2;const close=code.indexOf('*/',i);
   need(close!==-1,'WRITER_B_IMPORT_SOURCE_SYNTAX_STOP');
   i=close+2;continue;
  }
  if(ch==='"'||ch==="'"){
   const quote=ch;let str='',closed=false;i++;
   for(;i<code.length;i++){
    if(code[i]===quote){i++;closed=true;break;}
    if(code[i]==='\\'){
     need(i+1<code.length,'WRITER_B_IMPORT_SOURCE_SYNTAX_STOP');
     str+=code[i]+code[++i];continue;
    }
    str+=code[i];
   }
   need(closed,'WRITER_B_IMPORT_SOURCE_SYNTAX_STOP');
   add('str',str);continue;
  }
  if(ch===String.fromCharCode(96)){
   // Template imports are computed and outside the literal-only proof.
   i++;let closed=false;
   for(;i<code.length;i++){
    if(code[i]==='\\'){i++;continue;}
    if(code[i]===String.fromCharCode(96)){i++;closed=true;break;}
   }
   need(closed,'WRITER_B_IMPORT_SOURCE_SYNTAX_STOP');
   add('template','');continue;
  }
  if(ID_START.test(ch)){
   const begin=i++;
   while(i<code.length&&ID_BODY.test(code[i]))i++;
   add('word',code.slice(begin,i));continue;
  }
  if('().'.includes(ch))add('punct',ch);
  i++;
 }
 return out;
}

function literalRelative(file,spec){
 if(!spec.startsWith('./')&&!spec.startsWith('../'))return null;
 need(spec.length<=240&&!/[\\\0?#]/.test(spec),
  'WRITER_B_IMPORT_PATH_SCOPE_STOP');
 const resolved=path.posix.normalize(path.posix.join(
  path.posix.dirname(file),spec));
 need(!ROOT_ESCAPE.test(resolved)&&
  resolved.split('/').every(s=>s&&s!=='.'&&s!=='..')&&
  EXT.test(resolved),'WRITER_B_IMPORT_PATH_SCOPE_STOP');
 return resolved;
}

export function relativeModuleReferences(file,bytes){
 need(typeof file==='string'&&file.length<=180&&
  !file.includes('\\')&&!ROOT_ESCAPE.test(file)&&
  !file.split('/').some(s=>s===''||s==='.'||s==='..')&&
  Buffer.isBuffer(bytes)&&bytes.length>=1&&bytes.length<=2_000_000,
  'WRITER_B_IMPORT_SOURCE_CONTRACT_STOP');
 let source;
 try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
 catch{stop('WRITER_B_IMPORT_SOURCE_UTF8_STOP');}
 const tokens=sourceTokens(source),refs=new Set();
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i],next=tokens[i+1];
  if(t.kind!=='word'||!['import','from','require'].includes(t.value))continue;
  const direct=(t.value==='from'||t.value==='import')&&next?.kind==='str'?next:null;
  const call=(t.value==='import'||t.value==='require')&&
   next?.kind==='punct'&&next.value==='('&&
   tokens[i+2]?.kind==='str'&&tokens[i+3]?.value===')'?tokens[i+2]:null;
  const lit=direct??call;
  if(!lit)continue;
  const ref=literalRelative(file,lit.value);
  if(ref)refs.add(ref);
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
