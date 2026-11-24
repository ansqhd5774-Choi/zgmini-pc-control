// R10 source-pinned, read-only three-guard replay. Never executes the
// operational Sidecar, imports its code, or publishes its source / SHA values.
// "Replay" cannot prove which branch an earlier Sidecar process executed.
const SHA40=/^[a-f0-9]{40}$/i;
const SAFE_NAME=/^[A-Za-z_$][\w$]*$/;
const GUARDS=Object.freeze([19,21,23]);
const UNKNOWN='UNKNOWN';
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
  firstReplayFailure:null,firstRuntimeFailure:null,
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
   guardPassed:null,inputProvenance:'UNKNOWN'};
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
  guardEvaluation:rows,firstReplayFailure:first};
}
