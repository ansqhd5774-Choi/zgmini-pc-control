// Strict, bounded VBScript read-only dataflow. No code execution and no raw
// command, path, variable name, source text, or environment value in output.
// Unknown control flow/evaluation is a STOP, not a guessed active Core path.
import path from 'node:path';
const STOP='UNRESOLVED';
const MAX_LINES=1000,MAX_CALLS=8,MAX_VARS=120,MAX_CHARS=100_000;
const kind=x=>x?.kind??STOP;
const known=(value,kindValue)=>({value,kind:kindValue,resolved:true});
const unknown=(reason=STOP)=>({resolved:false,reason,kind:STOP});
const winNorm=x=>path.win32.normalize(x).toLowerCase();

function stripComment(line){
 let quoted=false,out='';
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(c==='"'){
   if(quoted&&line[i+1]==='"'){out+='""';i++;continue;}
   quoted=!quoted;
  }
  if(c==="'"&&!quoted)break;
  out+=c;
 }
 return /^\s*rem(?:\s|$)/i.test(out)?'':out;
}
function maskStrings(line){
 let quoted=false,out='';
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(c==='"'){
   if(quoted&&line[i+1]==='"'){out+='  ';i++;continue;}
   quoted=!quoted;out+=' ';continue;
  }
  out+=quoted?' ':c;
 }
 return out;
}
export function logicalLines(raw){
 const str=String(raw);
 if(str.length>MAX_CHARS)return [];
 const source=str.replace(/\r/g,'').split('\n');
 if(source.length>MAX_LINES)return [];
 const lines=[];let held='';
 for(const item of source){
  const line=stripComment(item);
  const continuing=/\s+_\s*$/.test(line);
  held+=line.replace(/\s+_\s*$/,'');
  if(continuing){held+=' ';continue;}
  lines.push(held);held='';
 }
 if(held)lines.push(held);
 return lines;
}
function splitTopLevel(source,delimiter){
 let depth=0,quoted=false,from=0;
 const chunks=[];
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='"'){
   if(quoted&&source[i+1]==='"'){i++;continue;}
   quoted=!quoted;continue;
  }
  if(quoted)continue;
  if(c==='(')depth++;
  else if(c===')')depth--;
  else if(c===delimiter&&depth===0){
   chunks.push(source.slice(from,i).trim());from=i+1;
  }
  if(depth<0)return null;
 }
 if(quoted||depth!==0)return null;
 chunks.push(source.slice(from).trim());
 return chunks;
}
function callFunction(expr,name){
 const m=expr.match(new RegExp(`^([a-z_][\\w]*)\\.${name}\\s*\\((.*)\\)$`,'i'));
 return m?{object:m[1].toLowerCase(),args:splitTopLevel(m[2],',')}:null;
}
function envExpand(value,environment){
 if(!/^([^%]|%[A-Za-z][\w]*%)*$/.test(value))return unknown('ENV_SYNTAX');
 let unresolved=false;
 const output=value.replace(/%([A-Za-z][\w]*)%/g,(_full,n)=>{
  const key=n.toLowerCase();
  if(!['systemdrive','systemroot','windir','programfiles'].includes(key)||
   typeof environment[key]!=='string'){unresolved=true;return '';} 
  return environment[key];
 });
 return unresolved?unknown('ENV_NOT_ALLOWLISTED'):known(output,'env');
}
function valueOf(expression,vars,objects,context,depth=0){
 if(depth>9)return unknown('EXPR_DEPTH');
 let expr=expression.trim();
 if(!expr)return unknown('EMPTY_EXPRESSION');
 if(expr[0]==='('&&expr.at(-1)===')'){
  const inside=expr.slice(1,-1),parts=splitTopLevel(inside,',');
  if(parts?.length===1)expr=inside.trim();
 }
 const concat=splitTopLevel(expr,'&');
 if(!concat)return unknown('UNBALANCED_EXPRESSION');
 if(concat.length>1){
  const bits=concat.map(p=>valueOf(p,vars,objects,context,depth+1));
  if(bits.some(x=>!x.resolved))return unknown('CONCAT_UNRESOLVED');
  return known(bits.map(x=>x.value).join(''),'concatenated');
 }
 const literal=expr.match(/^"((?:[^"]|"")*)"$/s);
 if(literal)return known(literal[1].replace(/""/g,'"'),'literal');
 if(/^chr\(34\)$/i.test(expr))return known('"','chr34');
 if(/^wscript\.scriptfullname$/i.test(expr))return known(context.scriptPath,'scriptfull');
 if(/^[a-z_]\w*$/i.test(expr))return vars.get(expr.toLowerCase())??unknown('VARIABLE_UNBOUND');
 const build=callFunction(expr,'BuildPath');
 if(build){
  if(objects.get(build.object)!=='fso'||build.args?.length!==2)
   return unknown('BUILDPATH_OBJECT_OR_ARITY');
  const items=build.args.map(x=>valueOf(x,vars,objects,context,depth+1));
  if(items.some(x=>!x.resolved))return unknown('BUILDPATH_ARG_UNKNOWN');
  return known(path.win32.join(items[0].value,items[1].value),'buildpath');
 }
 const parent=callFunction(expr,'GetParentFolderName');
 if(parent){
  if(objects.get(parent.object)!=='fso'||parent.args?.length!==1)
   return unknown('PARENT_OBJECT_OR_ARITY');
  const item=valueOf(parent.args[0],vars,objects,context,depth+1);
  return item.resolved?known(path.win32.dirname(item.value),'parentpath'):
   unknown('PARENT_ARG_UNKNOWN');
 }
 const expand=callFunction(expr,'ExpandEnvironmentStrings');
 if(expand){
  if(objects.get(expand.object)!=='shell'||expand.args?.length!==1)
   return unknown('ENV_OBJECT_OR_ARITY');
  const item=valueOf(expand.args[0],vars,objects,context,depth+1);
  return item.resolved?envExpand(item.value,context.environment):
   unknown('ENV_ARG_UNKNOWN');
 }
 return unknown('EXPRESSION_NOT_ALLOWLISTED');
}
function identifyCommand(value,{scriptPath,secondPath,root}){
 const lower=winNorm(value);
 const next=secondPath&&lower.includes(winNorm(secondPath));
 const core=lower.includes(winNorm(path.win32.join(root,'scripts','pc-writer','local-cycle.mjs')));
 const rootMatch=lower.includes(winNorm(root));
 const archive=/\barchive-run\.mjs\b/i.test(value);
 const earnings=/\bearnings-api-local\.mjs\b/i.test(value);
 const cmdAmbiguous=/\bcmd(?:\.exe)?\s+\/(?:c|k)\b/i.test(value);
 const exactAbsolute=/(?:^|\s|\")\w:\\/.test(value);
 const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const nextLiteral=secondPath&&new RegExp(
  `^(?:"?(?:[A-Za-z]:\\\\Windows\\\\System32\\\\)?wscript\\.exe"?\\s+)?"?${escapeRe(secondPath)}"?(?:\\s+\\/\\/[A-Za-z]+)*$`,'i').test(value.trim());
 const coreTarget=path.win32.join(root,'scripts','pc-writer','local-cycle.mjs');
 const exactNodeEntrypoint=new RegExp(
  `^"?E:\\\\ZGmini\\\\runtime\\\\node\\.exe"?\\s+"?${escapeRe(coreTarget)}"?\\s+--publish$`,'i').test(value.trim());
 return {nextPinnedVbs:Boolean(next),coreEntrypoint:core,
  sourceRootReferenced:rootMatch,archiveSidecar:archive,earningsSidecar:earnings,
  nextPinnedVbsDirect:Boolean(nextLiteral),coreNodeEntrypointDirect:exactNodeEntrypoint,
  shellCmdAmbiguous:cmdAmbiguous,absolutePathObserved:exactAbsolute,
  scriptFullNameReferenced:lower.includes(winNorm(scriptPath))};
}
export function traceVbsDataflow(raw,{scriptPath,secondPath=null,root,
 environment={}}){
 const lines=logicalLines(raw),vars=new Map(),objects=new Map(),calls=[];
 const result={callCount:0,calls:[],unresolvedCount:0,
  branchSeen:false,indirectExecutionSeen:false,sourceTooLarge:lines.length===0,
  entirelyDeterministic:false,allCallArgumentsResolved:false};
 if(result.sourceTooLarge)return result;
 const context={scriptPath,environment};
 let branchDepth=0;
 for(const line of lines){
  const clean=line.trim();if(!clean)continue;
  const code=maskStrings(clean);
  if(/\b(?:execute|executeglobal|eval|callbyname|wscript\.quit|exit\s+(?:sub|function)|stop|shellexecute|with\b|getobject\b|win32_process\.create\b)\b/i.test(code)||
   /\b(?:wscript\.)?createobject\s*\([^)]*\)\s*\.\s*(?:run|exec)\b/i.test(code)||
   /^call\s+[a-z_]/i.test(code))
   result.indirectExecutionSeen=true;
  if(/^(?:end\s+if|end\s+select|next\b|loop\b|wend\b)/i.test(code))
   branchDepth=Math.max(0,branchDepth-1);
  if(/^(?:if\b|select\s+case|for\b|do\b|while\b)/i.test(code))
   branchDepth++;
  if(/^(?:if\b|elseif\b|else\b|end\s+if|select\s+case|case\b|end\s+select|for\b|next\b|do\b|loop\b|while\b|wend\b|on\s+error\b|sub\b|function\b|end\s+sub|end\s+function)/i.test(code))
   result.branchSeen=true;
  if(/^(?:sub\b|function\b|end\s+sub|end\s+function)/i.test(code))
   result.indirectExecutionSeen=true;
  const set=clean.match(/^set\s+([a-z_]\w*)\s*=\s*(?:wscript\.)?createobject\s*\(\s*"([^"]+)"\s*\)/i);
  if(set){
   const type=set[2].toLowerCase();
   objects.set(set[1].toLowerCase(),type==='scripting.filesystemobject'?'fso':
    type==='wscript.shell'?'shell':'other');
   continue;
  }
  const assignment=clean.match(/^(?:set\s+)?([a-z_]\w*)\s*=\s*(.+)$/i);
  if(assignment){
   const key=assignment[1].toLowerCase();
   const value=branchDepth>0?unknown('ASSIGNED_IN_CONTROL_FLOW'):
    valueOf(assignment[2],vars,objects,context);
   if(vars.size>=MAX_VARS&&!vars.has(key)){result.sourceTooLarge=true;break;}
   vars.set(key,value);
  }
  for(const m of code.matchAll(/\b([a-z_]\w*)\.(Run|Exec)\b/ig)){
   const rawArg=clean.slice(m.index+m[0].length);
   const object=objects.get(m[1].toLowerCase());
   if(object!=='shell'){
    result.unresolvedCount++;
    calls.push({api:m[2].toLowerCase(),argumentForm:'unknown',
     resolved:false,reason:'SHELL_OBJECT_NOT_PROVEN',conditional:branchDepth>0});
    continue;
   }
   let expr=rawArg.trim();
   if(expr[0]==='('&&expr.at(-1)===')')expr=expr.slice(1,-1).trim();
   const args=splitTopLevel(expr,',');
   const first=args?.[0]??'';
   const value=valueOf(first,vars,objects,context);
   const descriptor={api:m[2].toLowerCase(),argumentForm:kind(value),
    resolved:value.resolved===true,
    conditional:branchDepth>0,
    reason:value.resolved?null:(value.reason??STOP),
    ...(value.resolved?identifyCommand(value.value,{scriptPath,secondPath,root}):{})};
   if(!value.resolved)result.unresolvedCount++;
   calls.push(descriptor);
  }
  if(calls.length>MAX_CALLS){result.sourceTooLarge=true;break;}
 }
 result.callCount=calls.length;
 result.calls=calls.slice(0,MAX_CALLS);
 result.allCallArgumentsResolved=calls.length>0&&calls.every(c=>c.resolved);
 result.entirelyDeterministic=!result.sourceTooLarge&&
  !result.indirectExecutionSeen&&result.allCallArgumentsResolved;
 return result;
}
