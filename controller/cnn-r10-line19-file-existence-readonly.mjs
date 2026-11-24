// Source-pinned R10 line19 file-existence probe. Never imports or executes
// operational Sidecar. No paths or source bytes are returned in result.
import path from 'node:path';
const P=path.win32;
const IDENT=/^[A-Za-z_$][\w$]*$/;
const unknown={schema:'ZGMINI_CNN_R10_LINE19_FILES_V1',status:'STATE_UNKNOWN',
 operands:[],currentStaticCondition:'UNVERIFIED',runtimeCondition:'NOT_OBSERVED',
 firstRuntimeFailure:null,operationalWrites:0,providerCalls:0,d1Writes:0};
function decodeLiteral(s){
 const m=/^(['"])([\s\S]{1,300})\1$/.exec(s.trim());
 if(!m||/[\r\n]/.test(m[2])||/\\(?![\\/])/.test(m[2]))return null;
 const value=m[2].replace(/\\\\/g,'\\').replace(/\\\//g,'/');
 return /^[A-Za-z0-9 _./:\\-]+$/.test(value)?value:null;
}
function splitTop(s,token){
 let depth=0,quote=null,esc=false,from=0;const out=[];
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(quote){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}
   if(c===quote)quote=null;continue;}
  if(c==="'"||c==='"'||c==='\x60'){quote=c;continue;}
  if(c==='('||c==='['||c==='{'){depth++;continue;}
  if(c===')'||c===']'||c==='}'){if(--depth<0)return null;continue;}
  if(depth===0&&s.startsWith(token,i)){
   out.push(s.slice(from,i).trim());i+=token.length-1;from=i+1;
  }
 }
 if(depth!==0||quote)return null;
 out.push(s.slice(from).trim());
 return out.length<=8?out:null;
}
function stripOuter(text){
 let s=text.trim();
 for(let k=0;k<5&&s.startsWith('(')&&s.endsWith(')');k++){
  let depth=0,match=-1,quote=null,esc=false;
  for(let i=0;i<s.length;i++){
   const c=s[i];
   if(quote){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}
    if(c===quote)quote=null;continue;}
   if(c==="'"||c==='"'||c==='\x60'){quote=c;continue;}
   if(c==='(')depth++;
   if(c===')'&&--depth===0){match=i;break;}
  }
  if(match!==s.length-1)break;
  s=s.slice(1,-1).trim();
 }
 return s;
}
function getLine19(source){
 const lines=source.split(/\r?\n/);
 if(lines.length<23)return null;
 const line=lines.slice(18,20).join(' ').slice(0,1200);
 const start=/^\s*if\s*\(/.exec(line);
 if(!start)return null;
 let depth=1,quote=null,esc=false,end=-1;
 for(let i=start[0].length;i<line.length;i++){
  const c=line[i];
  if(quote){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}
   if(c===quote)quote=null;continue;}
  if(c==="'"||c==='"'||c==='\x60'){quote=c;continue;}
  if(c==='(')depth++;
  if(c===')'&&--depth===0){end=i;break;}
 }
 return end<start[0].length||quote?null:{lines,expr:line.slice(start[0].length,end)};
}
function allowed(full,root){
 if(!P.isAbsolute(full)||!P.isAbsolute(root))return false;
 const rel=P.relative(P.normalize(root),P.normalize(full));
 return rel===''||(!rel.startsWith('..')&&!P.isAbsolute(rel));
}
export function projectPinnedCnnR10Line19FilesReadonly(source,raw={},io={}){
 const empty=structuredClone(unknown);
 if(!raw.sourcePin||!raw.ledgerStable||!raw.gitVerified||
  typeof source!=='string'||source.length>131072||
  !P.isAbsolute(raw.dataRoot??'')||!P.isAbsolute(raw.projectRoot??'')||
  !P.isAbsolute(raw.sidecarFile??'')||typeof io.fileStatus!=='function')return empty;
 const parsed=getLine19(source);
 if(!parsed)return empty;
 const atoms=splitTop(parsed.expr,'&&');
 if(!atoms||atoms.length!==2||atoms.some(a=>splitTop(a,'||')?.length!==1))return empty;
 const assignments=new Map();
 for(const line of parsed.lines.slice(0,18)){
  const m=/^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*?)\s*;?\s*$/.exec(line);
  if(m&&m[2].length<=350)assignments.set(m[1],m[2].replace(/;\s*$/,''));
 }
 const resolve=(expression,depth=0)=>{
  if(depth>6||expression.length>350)return null;
  const s=stripOuter(expression);
  const direct=decodeLiteral(s);
  if(direct!==null)return direct;
  if(s==='fileURLToPath(import.meta.url)')return raw.sidecarFile;
  if(/^path\.dirname\(\s*fileURLToPath\(import\.meta\.url\)\s*\)$/.test(s))
   return P.dirname(raw.sidecarFile);
  if(IDENT.test(s)&&assignments.has(s))return resolve(assignments.get(s),depth+1);
  const call=/^path\.(join|resolve)\(([\s\S]+)\)$/.exec(s);
  if(!call)return null;
  const args=splitTop(call[2],',');
  if(!args||args.length<2||args.length>7)return null;
  const items=args.map(a=>resolve(a,depth+1));
  if(items.some(a=>a===null))return null;
  return call[1]==='join'?P.join(...items):P.resolve(...items);
 };
 const operands=atoms.map(atom=>{
  const m=/^!\s*(?:fs\.)?existsSync\(([\s\S]+)\)$/.exec(stripOuter(atom));
  if(!m)return {target:'UNRESOLVED',exists:null,negatedValue:null};
  const p=resolve(m[1]);
  const target=p!==null&&allowed(p,raw.dataRoot)?'DATA_ROOT_CHILD':
   p!==null&&allowed(p,raw.projectRoot)?'PROJECT_ROOT_CHILD':'UNRESOLVED';
  let exists=null;
  if(target!=='UNRESOLVED'){
   try{const result=io.fileStatus(P.normalize(p),target);
    if(typeof result==='boolean')exists=result;}catch{}
  }
  return {target,exists,negatedValue:exists===null?null:!exists};
 });
 const condition=operands.some(x=>x.negatedValue===false)?'FALSE':
  operands.every(x=>x.negatedValue===true)?'TRUE':'UNVERIFIED';
 return {...empty,status:'CURRENT_FS_CHECK_ONLY',operands,
  currentStaticCondition:condition};
}
