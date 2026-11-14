// ZGMINI support-only. Pure audit of two ALREADY AUTHENTICATED snapshots.
// Never obtains data from a PC, GitHub, Node FS, or Task Scheduler.
// Output contains category labels and status ONLY; no hashes, raw XML, paths,
// account names, personal information, or original values.
const knownKeys = Object.freeze([
  ['ZGMINI-PC-Local-Core','CORE_TASK_XML'],
  ['ZGMINI-PC-Local-Korea','KOREA_TASK_XML'],
  ['ZGMINI-PC-Iran-Progress-R13','RETIRED_TASK_ABSENCE'],
  ['E:/ZGmini/data/pc-writer/config.json','WRITER_CONFIG'],
  ['E:/ZGmini/data/pc-writer/quota-runner.cmd','WRITER_QUOTA_SCRIPT'],
  ['E:/ZGmini/data/pc-writer/run-local.cmd','WRITER_LOCAL_SCRIPT'],
  ['E:/ZGmini/automation/pc-control/host.json','CONTROLLER_HOST_MANIFEST']
]);
const hash64=/^[a-f0-9]{64}$/;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
  &&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const validValue=(key,value)=>{
  if(key==='ZGMINI-PC-Iran-Progress-R13')return value==='APPROVED_RETIRED_ABSENT';
  return typeof value==='string'&&hash64.test(value);
};
export function compareWatchdogProtectionSnapshots(before,current){
  const invalid={status:'SNAPSHOT_INVALID',guardWouldFail:null,readOnly:true,
    counts:null,details:[],unexpectedKeyCount:null};
  if(!isObject(before)||!isObject(current))return invalid;
  const allowed=new Set(knownKeys.map(x=>x[0]));
  const extraBefore=Object.keys(before).filter(k=>!allowed.has(k));
  const extraCurrent=Object.keys(current).filter(k=>!allowed.has(k));
  if(extraBefore.length||extraCurrent.length){
    return {...invalid,unexpectedKeyCount:extraBefore.length+extraCurrent.length};
  }
  for(const obj of [before,current]){
    if(Object.entries(obj).some(([k,v])=>!validValue(k,v)))return invalid;
  }
  const details=knownKeys.map(([key,label])=>{
    const a=Object.hasOwn(before,key),b=Object.hasOwn(current,key);
    const outcome=!a&&!b?'ABSENT_BOTH':!a?'NEWLY_PRESENT':
      !b?'MISSING_FROM_CURRENT':before[key]===current[key]?'MATCH':'VALUE_CHANGED';
    return {category:label,outcome};
  });
  const changed=details.filter(x=>x.outcome==='VALUE_CHANGED').length;
  const added=details.filter(x=>x.outcome==='NEWLY_PRESENT').length;
  const missing=details.filter(x=>x.outcome==='MISSING_FROM_CURRENT').length;
  // The production watchdog-b guard compares JSON.stringify snapshots.
  // Identical key/value semantics can still differ by insertion order.
  const guardWouldFail=JSON.stringify(before)!==JSON.stringify(current);
  const differences=changed+added+missing;
  const status=differences>0?'PROTECTED_VALUE_OR_PRESENCE_DRIFT':
    guardWouldFail?'ORDER_ONLY_SERIALIZATION_DRIFT':'NO_DRIFT';
  return {status,guardWouldFail,readOnly:true,counts:{changed,added,missing,
    absentBoth:details.filter(x=>x.outcome==='ABSENT_BOTH').length},
    details,unexpectedKeyCount:0};
}
