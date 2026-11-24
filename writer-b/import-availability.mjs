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
const EXT=/\.[a-z0-9]{1,8}$/i; // Includes Node 22 .ts/.mts and existing source modules.
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
  if(ch==='/'){
   // A regexp literal can contain quote characters. Treating those quotes as
   // JavaScript strings causes a false syntax STOP and may invent imports.
   // Distinguish expression-start '/' from division using the immediate
   // preceding token/context; never interpret division as a regexp.
   let previous=i-1;
   while(previous>=0&&/\s/.test(code[previous]))previous--;
   const last=out.at(-1);
   const startsExpression=previous<0||'([{:;,=!?&|'.includes(code[previous])||
    (code[previous]==='>'&&code[previous-1]==='=')||
    (last?.kind==='word'&&['return','throw','case','yield','await'].includes(last.value));
   if(startsExpression){
    let end=i+1,characterClass=false,escaped=false,closed=false;
    for(;end<code.length;end++){
     const c=code[end];
     if(c==='\r'||c==='\n')break;
     if(escaped){escaped=false;continue;}
     if(c==='\\'){escaped=true;continue;}
     if(c==='['){characterClass=true;continue;}
     if(c===']'){characterClass=false;continue;}
     if(c==='/'&&!characterClass){end++;closed=true;break;}
    }
    need(closed,'WRITER_B_IMPORT_SOURCE_SYNTAX_STOP');
    while(end<code.length&&/[a-z]/i.test(code[end]))end++;
    add('regexp','');i=end;continue;
   }
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

const DIAGNOSTIC_REASONS=new Set([
 'NOT_FOUND','SYMLINK','NOT_FILE','SIZE','OUTSIDE_ROOT','READ_ERROR',
 'UNAVAILABLE_OR_UNSAFE',
]);
// Keep the single historical diagnostic and add a bounded batch only when
// multiple approved imports are unavailable. This stays within reporter's
// 8 KiB raw-result limit even for maximum-length allowed relative paths.
const MAX_IMPORT_DIAGNOSTICS=8;
const SAFE_RELATIVE=/^(?:scripts\/pc-writer|lib|worker)\/[A-Za-z0-9_./-]+$/;
const safeDiagnosticPath=value=>typeof value==='string'&&value.length>=1&&
 value.length<=180&&SAFE_RELATIVE.test(value)&&
 !value.split('/').some(part=>part===''||part==='.'||part==='..');
export function safeWriterBImportDiagnostic(error){
 if(error?.code!=='WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP')return null;
 const d=error?.diagnostic;
 if(!d||d.sourceKind!=='APPROVED_AFTER'||
  !safeDiagnosticPath(d.sourcePath)||
  !safeDiagnosticPath(d.dependencyPath)||
  !DIAGNOSTIC_REASONS.has(d.reason))return null;
 return {sourceKind:'APPROVED_AFTER',sourcePath:d.sourcePath,
  dependencyPath:d.dependencyPath,reason:d.reason};
}
export function safeWriterBImportDiagnosticBatch(error){
 const first=safeWriterBImportDiagnostic(error);
 const raw=error?.diagnostics,omitted=error?.diagnosticsOmitted;
 if(!first||!Array.isArray(raw)||raw.length<2||
   raw.length>MAX_IMPORT_DIAGNOSTICS||!Number.isInteger(omitted)||
   omitted<0||omitted>1024)return null;
 const diagnostics=raw.map(entry=>safeWriterBImportDiagnostic({
  code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP',diagnostic:entry}));
 if(diagnostics.some(entry=>entry===null)||
   JSON.stringify(diagnostics[0])!==JSON.stringify(first))return null;
 return {diagnostics,diagnosticsOmitted:omitted};
}
function unavailableImports(diagnostics,omitted){
 const code='WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP';
 const error=Object.assign(new Error(code),{code,diagnostic:diagnostics[0],
  ...(diagnostics.length>1||omitted>0?{
  diagnostics,diagnosticsOmitted:omitted,
  }: {})});
 throw error;
}

export function verifyWriterBImportAvailability({afterFiles,beforeFiles=new Map(),existing}){
 need(afterFiles instanceof Map&&afterFiles.size>=1&&afterFiles.size<=32&&
  beforeFiles instanceof Map&&
  [...beforeFiles.keys()].every(file=>afterFiles.has(file))&&
  typeof existing==='function','WRITER_B_IMPORT_CHECK_CONTRACT_STOP');
 let inspected=0;
 const missing=[];let totalMissing=0;
 const approved=new Set([...afterFiles.keys()].map(s=>s.toLowerCase()));
 for(const [file,bytes] of afterFiles){
  // An approved test fixture is not imported by the Core runtime; do not
  // make intentional negative test imports a global installation blocker.
  if(/\.test\.(?:mjs|cjs|js)$/i.test(file))continue;
  // Existing optional imports are not new obligations merely because an
  // unrelated line changed. Probe only new imports in M, all imports in A.
  const previous=new Set(beforeFiles.has(file)?
   relativeModuleReferences(file,beforeFiles.get(file)):[]);
  for(const ref of relativeModuleReferences(file,bytes)){
   if(previous.has(ref.toLowerCase())||previous.has(ref))continue;
   inspected++;
   need(inspected<=1024,'WRITER_B_IMPORT_REFERENCE_LIMIT_STOP');
   if(approved.has(ref.toLowerCase()))continue;
   // 'existing' is an injected bounded, read-only operational-source
   // existence check. Never inspect arbitrary workspace or candidate files.
   let availability;
   try{availability=existing(ref);}
   catch{availability={available:false,reason:'READ_ERROR'};}
   if(availability===true)continue;
   const reason=availability&&typeof availability==='object'?
    availability.reason:'UNAVAILABLE_OR_UNSAFE';
   totalMissing++;
   if(missing.length<MAX_IMPORT_DIAGNOSTICS)missing.push({
    sourceKind:'APPROVED_AFTER',sourcePath:file,dependencyPath:ref,
    reason:DIAGNOSTIC_REASONS.has(reason)?reason:'UNAVAILABLE_OR_UNSAFE',
   });
  }
 }
 if(totalMissing)unavailableImports(missing,totalMissing-missing.length);
 return {status:'PASS',code:'WRITER_B_LITERAL_IMPORTS_AVAILABLE',
  approvedFiles:afterFiles.size,checkedReferences:inspected,
  evidenceLevel:'NEW_LITERAL_RELATIVE_IMPORTS_ONLY'};
}
