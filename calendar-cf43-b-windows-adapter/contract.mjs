import {createHash} from 'node:crypto';

export const BASE='cf43e65bbf72f56b70a52bc5a650a0cb5682b6bc';
export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const CONFIG_PATH=String.raw`E:\ZGmini\data\pc-writer\config.json`;
export const CORE_TASK='ZGMINI-PC-Local-Core';
export const CORE_TASK_XML_SHA='dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028';
export const APPROVED=Object.freeze({
 'lib/release-calendar.mjs':'d12028f9b9c66d63a10d1e1b93d0846b5bf8d9e7c49fed2be6efefd9694f8d0b',
 'scripts/pc-writer/release-calendar.mjs':'3fa8e1039fcedd3b2fb07b888996f845c6b7102505acdba7608818cb56238871',
});
export const R17_PROTECTED=Object.freeze([
 'scripts/pc-writer/us-breadth-provisional-cycle.mjs',
 'scripts/pc-writer/us-breadth-sip-premarket-cycle.mjs',
 'lib/market-breadth/us-premarket-sip-r1.mjs',
]);
export const FILES=Object.freeze(Object.keys(APPROVED));
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code});};
const requireThat=(x,code)=>{if(!x)stop(code);};
const exact=(a,b)=>Array.isArray(a)&&a.length===b.length&&b.every(x=>a.includes(x));
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;

export function verifyBefore(b){
 requireThat(b?.sourceRoot===SOURCE_ROOT&&b?.configPath===CONFIG_PATH&&
  b?.coreTask===CORE_TASK&&b?.head===BASE&&b?.configSource===BASE,
  'CAL_CF43_BASE_DRIFT_STOP');
 requireThat(b?.taskXmlSha===CORE_TASK_XML_SHA&&b?.coreEnabled===true,
  'CAL_CF43_CORE_STATE_STOP');
 requireThat(Array.isArray(b?.relevantDirty)&&
  exact(b.relevantDirty.map(x=>x.path),FILES)&&
  b.relevantDirty.every(x=>x.status==='M'&&APPROVED[x.path]===x.sha256),
  'CAL_CF43_APPROVED_DIRTY_STOP');
 requireThat(b?.stagedCount===0,'CAL_CF43_STAGED_INDEX_STOP');
 requireThat(SHA64.test(b?.configSha256??'')&&SHA40.test(b?.headTree??'')&&
  typeof b?.originalBranch==='string'&&
  (b.originalBranch===''||(/^[A-Za-z][A-Za-z0-9_./-]{0,100}$/.test(b.originalBranch)&&
   !b.originalBranch.startsWith('calendar-cf43-b/'))),
  'CAL_CF43_BASELINE_EVIDENCE_STOP');
 return {base:BASE,configSha256:b.configSha256,headTree:b.headTree,
  branch:b.originalBranch,taskXmlSha:b.taskXmlSha};
}
export function verifyCommitted(c){
 requireThat(c?.parent===BASE&&SHA40.test(c?.head??'')&&c.head!==BASE&&
  c.branch?.startsWith('calendar-cf43-b/pc-calendar-')&&
  Array.isArray(c.diff)&&
  exact(c.diff.map(x=>`${x.status}:${x.path}`),FILES.map(x=>`M:${x}`)),
  'CAL_CF43_COMMIT_DIFF_STOP');
 requireThat(FILES.every(x=>c.storedSha256?.[x]===APPROVED[x])&&
  R17_PROTECTED.every(x=>c.r17ParentBlobs?.[x]===c.r17ChildBlobs?.[x])&&
  c.stagedCount===0&&c.relevantClean===true,
  'CAL_CF43_COMMIT_CONTENT_STOP');
 return {sha:c.head,branch:c.branch};
}
export function replaceSourceOnly(bytes,from,to){
 requireThat(SHA40.test(from)&&SHA40.test(to),'CAL_CF43_POINTER_SHA_STOP');
 const text=Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes);
 const match=[...text.matchAll(/"source"\s*:\s*"([a-f0-9]{40})"/g)];
 requireThat(match.length===1&&match[0][1]===from,'CAL_CF43_POINTER_SOURCE_STOP');
 const changed=text.slice(0,match[0].index)+match[0][0].replace(from,to)+
  text.slice(match[0].index+match[0][0].length);
 const old=JSON.parse(text),updated=JSON.parse(changed);
 requireThat(JSON.stringify({...old,source:to})===JSON.stringify(updated),
  'CAL_CF43_POINTER_FIELDS_STOP');
 return Buffer.from(changed,'utf8');
}
