// R10 source-pinned, read-only three-guard replay. Never executes the
// operational Sidecar, imports its code, or publishes its source / SHA values.
// "Replay" cannot prove which branch an earlier Sidecar process executed.
const SHA40=/^[a-f0-9]{40}$/i;
const SAFE_NAME=/^[A-Za-z_$][\w$]*$/;
const GUARDS=Object.freeze([19,21,23]);
const UNKNOWN='UNKNOWN';

// Only classifies line 19 in SHA-pinned source: no source execution or raw values.
export function classifyPinnedCnnR10Line19Readonly(source) {
 const unknown={schema:'ZGMINI_CNN_R10_LINE19_STRUCTURE_V1',
  form:'UNKNOWN',comparison:'UNKNOWN',gitInput:'UNKNOWN',
  blockAction:'UNKNOWN',runtimeInput:'NOT_OBSERVED_BY_THIS_PROBE'};
 if(typeof source!=='string'||source.length>131072)return unknown;
 const lines=source.split(/\r?\n/);
 if(lines.length<23)return unknown;
 const window=lines.slice(18,20).join(' ').slice(0,1200);
 const entry=/^\s*if\s*\(/.exec(window);
 if(!entry)return {...unknown,form:/^\s*(?:need|check|assert|fail)\s*\(/.test(window)?
  'HELPER_CALL':'UNSUPPORTED'};
 let start=entry[0].length,depth=1,quote=null,escaped=false,finish=-1;
 for(let i=start;i<window.length;i++){
  const c=window[i];
  if(quote){if(escaped){escaped=false;continue;}
   if(c==='\\'){escaped=true;continue;}if(c===quote)quote=null;continue;}
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='(')depth++;
  if(c===')'&&--depth===0){finish=i;break;}
 }
 if(finish<start||quote)return {...unknown,form:'UNSUPPORTED'};
 const expr=window.slice(start,finish),action=window.slice(finish+1);
 const direct=/^\s*([A-Za-z_$][\w$]*)\s*(===|!==|==|!=)\s*([A-Za-z_$][\w$]*)\s*$/.exec(expr);
 const form=direct?'DIRECT_VARIABLE_COMPARE':
  /&&|\|\||\?\?/.test(expr)?'COMPOUND_EXPRESSION':
  /[.(\[]/.test(expr)?'CALL_OR_MEMBER_EXPRESSION':
  /^\s*!?\s*[A-Za-z_$][\w$]*\s*$/.test(expr)?'BOOLEAN_IDENTIFIER':'UNSUPPORTED';
 const comparison=direct?({'===':'STRICT_EQUAL','!==':'STRICT_NOT_EQUAL',
  '==':'LOOSE_EQUAL','!=':'LOOSE_NOT_EQUAL'}[direct[2]]):
  /&&|\|\|/.test(expr)?'COMPOUND':/===|!==|==|!=/.test(expr)?
  'NESTED_COMPARISON':'OTHER';
 const prior=lines.slice(0,18).join('\n');
 const assignments=[...prior.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^\n;]{1,240})/g)];
 const identifiers=new Set(expr.match(/[A-Za-z_$][\w$]*/g)??[]);
 const referenced=assignments.filter(m=>identifiers.has(m[1]));
 const all=[expr,...referenced.map(m=>m[2])].join(' ');
 const head=/\brev-parse\b/.test(all)&&/\bHEAD\b/.test(all);
 const status=/\bstatus\b/.test(all)&&/porcelain|--untracked-files/.test(all);
 const gitInput=head&&status?'MULTIPLE_GIT_READS':head?'GIT_HEAD':
  status?/--untracked-files\s*(?:=|['", ]+)\s*no\b/.test(all)?
   'GIT_STATUS_TRACKED':'GIT_STATUS_OTHER':'UNKNOWN';
 const blockAction=/\bthrow\b/.test(action)?'THROW':
  /\b(?:need|check|ensure|assert|fail)\s*\(\s*false\b/.test(action)?
   'EXPLICIT_FAIL_HELPER':/\b(?:need|check|ensure|assert|fail)\s*\(/.test(action)?
   'OTHER_GUARD_HELPER':'UNKNOWN';
 return {...unknown,form,comparison,gitInput,blockAction};
}


// Bounded lexical replay of current line-19 SHA comparisons only. This cannot
// establish what an earlier Sidecar invocation executed.
export function projectCnnR10Line19OperandsReadonly(source,raw={}) {
 const empty={schema:'ZGMINI_CNN_R10_LINE19_OPERANDS_V1',
  status:'STATE_UNKNOWN',connective:'UNKNOWN',atomClasses:[],atomSemantics:[],
  currentStaticCondition:'UNKNOWN',runtimeCondition:'NOT_OBSERVED',
  firstRuntimeFailure:null,operationalWrites:0,providerCalls:0,d1Writes:0};
 if(!raw.sourcePin||!raw.ledgerStable||!raw.gitVerified||
    typeof source!=='string'||source.length>131072)return empty;
 const lines=source.split(/\r?\n/);
 if(lines.length<23)return empty;
 const line=lines.slice(18,20).join(' ').slice(0,1200);
 const start=/^\s*if\s*\(/.exec(line);
 if(!start)return empty;
 let level=1,quote=null,escape=false,finish=-1;
 for(let i=start[0].length;i<line.length;i++){
  const c=line[i];
  if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}
   if(c===quote)quote=null;continue;}
  if(c==="'"||c==='"'||c==='\x60'){quote=c;continue;}
  if(c==='(')level++;
  if(c===')'&&--level===0){finish=i;break;}
 }
 if(finish<start[0].length||quote)return empty;
 const expression=line.slice(start[0].length,finish);
 const pins=new Map();
 for(const l of lines.slice(0,18)){
  const m=l.match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([a-f0-9]{40})\2\s*;?\s*$/i);
  if(m)pins.set(m[1],m[3].toLowerCase());
 }
 const head=typeof raw.head==='string'&&SHA40.test(raw.head)?raw.head.toLowerCase():null;
 const values=new Map(pins);
 for(const m of lines.slice(0,23).join('\n').matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]{1,240})/g)){
  if(head&&/\brev-parse\b/.test(m[2])&&/\bHEAD\b/.test(m[2])&&
     /(?:execFileSync|spawnSync|execSync)/.test(m[2]))values.set(m[1],head);
 }
 const split=(s,op)=>{
  const parts=[];let from=0,depth=0,q=null,esc=false;
  for(let i=0;i<s.length;i++){
   const c=s[i];
   if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}
    if(c===q)q=null;continue;}
   if(c==="'"||c==='"'||c==='\x60'){q=c;continue;}
   if(c==='('||c==='['||c==='{'){depth++;continue;}
   if(c===')'||c===']'||c==='}'){if(--depth<0)return null;continue;}
   if(depth===0&&s.startsWith(op,i)){parts.push(s.slice(from,i));i+=op.length-1;from=i+1;}
  }
  if(depth!==0||q)return null;
  parts.push(s.slice(from));return parts;
 };
 const strip=(input)=>{
  let s=input.trim();
  for(let k=0;k<8&&s[0]==='('&&s[s.length-1]===')';k++){
   let d=0,close=-1,q=null,esc=false;
   for(let i=0;i<s.length;i++){
    const c=s[i];
    if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}
     if(c===q)q=null;continue;}
    if(c==="'"||c==='"'||c==='\x60'){q=c;continue;}
    if(c==='(')d++;
    if(c===')'&&--d===0){close=i;break;}
   }
   if(close!==s.length-1)break;
   s=s.slice(1,-1).trim();
  }
  return s;
 };
 const atomSemantics=[];
 const semantic=(expr)=>{
  const s=expr.trim();
  const family=/\b(?:execFileSync|spawnSync|execSync)\s*\(/.test(s)&&
    /(?:\bre?v-parse\b|\bstatus\b|\bgit\b)/i.test(s)?'GIT_PROCESS':
   /\b(?:fs\.)?(?:existsSync|statSync|lstatSync|realpathSync)\s*\(/.test(s)?'FILESYSTEM_METADATA':
   /\b(?:readFileSync|openSync)\s*\(/.test(s)?'FILESYSTEM_READ':
   /\b(?:createHash|digest)\s*\(/.test(s)?'HASHING':
   /\b(?:path\.(?:join|resolve|relative|normalize)|realpathSync)\s*\(/.test(s)?'PATH_RESOLUTION':
   /\bprocess\.env\b/.test(s)?'ENV_REFERENCE':
   /\.includes\s*\(/.test(s)?'MEMBER_INCLUDES':
   /\.test\s*\(/.test(s)?'MEMBER_TEST':
   /\b[A-Za-z_$][\w$]*\s*\(/.test(s)?'LOCAL_OR_OTHER_CALL':'UNKNOWN';
  const input=/\brev-parse\b/.test(s)&&/\bHEAD\b/.test(s)?'GIT_HEAD':
   /\bstatus\b/.test(s)&&/\bporcelain\b/.test(s)?'GIT_STATUS':
   /\b(?:config|approved|sourceSha)\b/i.test(s)?'SOURCE_CONFIG_REFERENCE':
   /\b(?:checkpoint|lastRun)\b/i.test(s)?'CHECKPOINT_REFERENCE':
   /\b(?:existsSync|statSync|lstatSync)\b/.test(s)?'FILESYSTEM_PATH_UNVERIFIED':
   /\bprocess\.env\b/.test(s)?'PROCESS_ENV':
   'UNVERIFIED';
  const comparison=/!==/.test(s)?'STRICT_NOT_EQUAL':
   /===/.test(s)?'STRICT_EQUAL':
   /(?:>=|<=|>|<)\s*[0-9]/.test(s)?'NUMERIC_COMPARISON':
   /!\s*(?:[A-Za-z_$]|\()/.test(s)?'NEGATED_BOOLEAN':
   /\b(?:true|false)\b/.test(s)?'BOOLEAN_LITERAL':'OTHER_OR_UNKNOWN';
  const booleanForm=/^\s*!/.test(s)?'NEGATED':
   /^\s*\w[\w$.]*\s*\(/.test(s)?'CALL_RESULT':
   /\.([A-Za-z_$][\w$]*)\s*\(/.test(s)?'METHOD_RESULT':'UNKNOWN';
  return {family,input,comparison,booleanForm,value:'NOT_EVALUATED'};
 };
 const types=[],ops=new Set();
 const classify=(s)=>{
  if(types.length>=8)return null;
  atomSemantics.push(semantic(s));
  const m=/^\s*([A-Za-z_$][\w$]*)\s*(===|!==|==|!=)\s*([A-Za-z_$][\w$]*)\s*$/.exec(s);
  if(!m){types.push(/[.(\[]/.test(s)?'CALL_OR_MEMBER_OR_GROUP':'UNSUPPORTED');return null;}
  const known=values.has(m[1])&&values.has(m[3]);
  types.push(known?'PINNED_SHA40_COMPARE':'UNVERIFIED_COMPARE');
  if(!known)return null;
  const eq=values.get(m[1])===values.get(m[3]);
  return m[2]==='==='||m[2]==='=='?eq:!eq;
 };
 const evaluate=(input,n=0)=>{
  if(n>=10)return null;
  const s=strip(input);
  if(!s)return null;
  const or=split(s,'||');if(!or)return null;
  if(or.length>1){ops.add('OR');let v=false;
   for(const part of or){const next=evaluate(part,n+1);v=v===true?true:v===false?next:null;}
   return v;
  }
  const and=split(s,'&&');if(!and)return null;
  if(and.length>1){ops.add('AND');let v=true;
   for(const part of and){const next=evaluate(part,n+1);v=v===false?false:v===true?next:null;}
   return v;
  }
  return classify(s);
 };
 const value=evaluate(expression);
 return {...empty,status:'STATIC_CLASSIFIED',
  connective:ops.size>1?'MIXED':ops.has('AND')?'AND_ONLY':ops.has('OR')?'OR_ONLY':'NONE',
  atomClasses:types,atomSemantics,
  currentStaticCondition:value===true?'TRUE':value===false?'FALSE':'UNKNOWN'};
}

const classifiedExit=value=>Number.isSafeInteger(value)&&value>=0&&value<=255?
 value:null;
const safeExit=raw=>({
 head:classifiedExit(raw?.head),tracked:classifiedExit(raw?.tracked),
 whole:classifiedExit(raw?.whole)
});
export function projectCnnR10ThreeGuardsReadonly(source,raw={}){
 const empty={schema:'ZGMINI_CNN_R10_THREE_GUARD_REPLAY_V1',
  evidence:'PINNED_STATIC_REPLAY_NOT_ACTUAL_SIDECAR_EXECUTION',
  status:'STATE_UNKNOWN',gitExit:safeExit(raw.gitExit),
  gitInputProvenance:'FIXED_CHECKOUT_READ_ONLY',
  guardEvaluation:GUARDS.map((line,order)=>({order:order+1,line,
   condition:UNKNOWN,guardPassed:null,inputProvenance:'UNKNOWN'})),
  firstReplayFailure:null,firstRuntimeFailure:null,line19Structure:null,line19OperandEvidence:null,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 if(!raw.sourcePin||!raw.ledgerStable||!raw.gitVerified||
    typeof source!=='string'||source.length>131072)return empty;
 const lines=source.split(/\r?\n/);
 if(lines.length<23)return empty;
 // Only SHA literal assignments in the pinned source, never raw code/values.
 const pins=new Map();
 for(const line of lines.slice(0,18)){
  const m=line.match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([a-f0-9]{40})\2\s*;?\s*$/i);
  if(m&&SHA40.test(m[3]))pins.set(m[1],m[3].toLowerCase());
 }
 const head=typeof raw.head==='string'&&SHA40.test(raw.head)?
  raw.head.toLowerCase():null;
 const values=new Map(pins);
 const gitHeadVariables=new Set();
 const configSha=typeof raw.approved==='string'&&SHA40.test(raw.approved)?raw.approved.toLowerCase():null;
 // A name is mapped only when its assignment unambiguously reads git rev-parse.
 const prefix=lines.slice(0,23).join('\n');
 for(const m of prefix.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]{1,240})/g)){
  if(/\brev-parse\b/.test(m[2])&&/\bHEAD\b/.test(m[2])&&
     /(?:execFileSync|spawnSync|execSync)/.test(m[2])&&head)
   values.set(m[1],head);
 }
 // Narrowly handle direct boolean expressions; unsupported expressions remain
 // UNKNOWN, rather than being evaluated dynamically or guessed.
 const rows=GUARDS.map((line,order)=>{
  const next=order<2?GUARDS[order+1]-1:26;
  const statement=lines.slice(line-1,next).join(' ').replace(/\/\/.*$/,'');
  const m=statement.match(/^\s*if\s*\(\s*([A-Za-z_$][\w$]*)\s*(===|!==|==|!=)\s*([A-Za-z_$][\w$]*)\s*\)/);
  const out={order:order+1,line,condition:UNKNOWN,
   guardPassed:null,inputProvenance:'UNKNOWN',comparisonOperator:'UNKNOWN',
   staticOperandOrigins:null,operandMatchesConfig:null};
  if(m){
   const origin=name=>gitHeadVariables.has(name)?'GIT_HEAD':
    pins.has(name)?'PINNED_SHA40_LITERAL':'UNVERIFIED';
   out.comparisonOperator=({'===':'STRICT_EQUAL','!==':'STRICT_NOT_EQUAL',
    '==':'LOOSE_EQUAL','!=':'LOOSE_NOT_EQUAL'})[m[2]]??'UNKNOWN';
   out.staticOperandOrigins=[origin(m[1]),origin(m[3])];
   out.operandMatchesConfig=[m[1],m[3]].map(name=>
    configSha&&values.has(name)?values.get(name)===configSha:null);
  }
  if(!m||!SAFE_NAME.test(m[1])||!SAFE_NAME.test(m[3])||
    !values.has(m[1])||!values.has(m[3])||!/(?:throw|\bneed\s*\(\s*false|\bfail\s*\()/i.test(statement))
   return out;
  const eq=values.get(m[1])===values.get(m[3]);
  const condition=m[2]==='==='||m[2]==='=='?eq:!eq;
  out.condition=condition?'TRUE':'FALSE';
  out.guardPassed=!condition;
  out.inputProvenance='PINNED_LITERAL_AND_GIT_HEAD_REPLAY';
  return out;
 });
 let first=null,priorVerified=true;
 for(const row of rows){
  if(row.guardPassed===null){priorVerified=false;continue;}
  if(priorVerified&&row.guardPassed===false&&first===null)first='LINE_'+row.line;
  if(row.guardPassed===false)priorVerified=false;
 }
 return {...empty,status:rows.every(r=>r.guardPassed!==null)?'REPLAY_EVALUATED':'PARTIAL_REPLAY',
  guardEvaluation:rows,firstReplayFailure:first,
  line19Structure:classifyPinnedCnnR10Line19Readonly(source),
  line19OperandEvidence:projectCnnR10Line19OperandsReadonly(source,raw)};
}
