// Windows Task evidence interpreters; no Task Scheduler calls or filesystem I/O.
// The live adapter obtains the bytes/probe and uses these exact pure guards.
import path from 'node:path';
import {taskAction} from '../controller/pc-source-readonly.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)stop(code);};

export function decodeTaskXmlBytes(raw){
 need(Buffer.isBuffer(raw)&&raw.length>=5,'WRITER_B_TASK_XML_BYTES_STOP');
 let xml;
 if(raw[0]===255&&raw[1]===254){
  need((raw.length-2)%2===0,'WRITER_B_TASK_XML_ENCODING_STOP');
  xml=raw.subarray(2).toString('utf16le');
 }else if(raw[0]===60&&raw[1]===0){
  need(raw.length%2===0,'WRITER_B_TASK_XML_ENCODING_STOP');
  xml=raw.toString('utf16le');
 }else if(raw[0]===254&&raw[1]===255){
  stop('WRITER_B_TASK_XML_ENCODING_STOP');
 }else{
  xml=raw.toString('utf8').replace(/^\ufeff/,'');
  need(Buffer.from(xml,'utf8').equals(raw[0]===239&&raw[1]===187&&raw[2]===191?
   raw.subarray(3):raw),'WRITER_B_TASK_XML_ENCODING_STOP');
 }
 need(/^\s*<\?xml|^\s*<Task\b/.test(xml),'WRITER_B_TASK_XML_STOP');
 return xml;
}

export function coreQuietFromProbe(probe,coreCycleLockExists){
 // TASK_STATE: 0 unknown, 1 disabled, 2 queued, 3 ready, 4 running.
 // Unknown/queued must not be mistaken for a drained Core.
 return probe?.enabled===false&&[1,3].includes(probe.state)&&
  probe.instances===0&&probe.relatedProcesses===0&&
  probe.unknownProcessLines===0&&coreCycleLockExists===false;
}

// A live Writer B may pause the Scheduler only after two consecutive
// read-only idle samples. Never interpret an enabled Task as already drained;
// the existing post-disable check remains mandatory for a start race.
export function coreReadyForMaintenance(probe,coreCycleLockExists){
 return probe?.enabled===true&&probe.state===3&&
  probe.instances===0&&probe.relatedProcesses===0&&
  probe.unknownProcessLines===0&&coreCycleLockExists===false;
}

export function coreMaintenanceWindowBlockCode(probe,coreCycleLockExists){
 if(coreReadyForMaintenance(probe,coreCycleLockExists))return null;
 if(coreCycleLockExists===true||probe?.instances>0||
    probe?.relatedProcesses>0||probe?.state===4)
  return 'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED';
 return 'WRITER_B_CORE_WINDOW_UNVERIFIED_DEFERRED';
}

const ENTRYPOINTS=new Set(['scripts/pc-writer/run-local.mjs',
 'scripts/pc-writer/local-cycle.mjs']);
const WRITER_DATA=/^E:\\ZGmini\\data\\pc-writer\\/i;
const NO_DYNAMIC=/[%$!*?&|><^;\r\n]/;
const LITERAL_SCRIPT=/^(?:[a-z]:\\)?[a-z0-9_./\\-]+\.(?:vbs|cmd)$/i;
const LONG_PATH=/^\\\\\?\\/;
const normalize=p=>path.win32.normalize(p.replace(LONG_PATH,'')).toLowerCase();

function literalScript(args,extension,interpreter){
 let text=String(args??'').trim();
 if(interpreter==='cmd'){
  const prefix=/^(?:\/d\s+)?\/c\s+/i.exec(text);
  need(prefix,'WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
  text=text.slice(prefix[0].length);
 }else{
  // Only fixed Windows Script Host switches; no arbitrary script parameters.
  const flags=/^(?:(?:\/\/nologo|\/\/b)\s+){0,2}/i.exec(text);
  text=text.slice(flags[0].length);
 }
 if(text.startsWith('"')&&text.endsWith('"'))text=text.slice(1,-1);
 need(!NO_DYNAMIC.test(text)&&!text.includes('"')&&
  LITERAL_SCRIPT.test(text)&&text.toLowerCase().endsWith(extension),
  'WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
 return text;
}

/**
 * Proves only the one Task Exec's literal launcher against the approved
 * first-hop LAUNCHER. It does NOT prove the downstream VBS/Sidecar chain.
 * `realpath` is an injected read-only Windows native canonicalizer.
 */
export function attestTaskFirstHopLauncher({taskXml,manifest,realpath}){
 const changed=manifest?.files?.filter(x=>ENTRYPOINTS.has(x.path.toLowerCase()))
  .map(x=>x.path)??[];
 if(changed.length===0)return {status:'NOT_APPLICABLE',
  code:'WRITER_B_FIRST_HOP_NOT_REQUIRED',runtimeChainVerified:false};
 need(typeof taskXml==='string'&&taskXml.length>0&&taskXml.length<=131072&&
  typeof realpath==='function','WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
 const actions=[...taskXml.matchAll(/<Actions(?:\s[^>]*)?>([\s\S]*?)<\/Actions>/gi)];
 need(actions.length===1,'WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
 const actionBody=actions[0][1].trim();
 const execs=[...actionBody.matchAll(/<Exec(?:\s[^>]*)?>([\s\S]*?)<\/Exec>/gi)];
 need(execs.length===1&&actionBody===execs[0][0],
  'WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
 const xml=execs[0][0];
 need([...xml.matchAll(/<Command>/gi)].length===1&&
  [...xml.matchAll(/<Arguments>/gi)].length<=1&&
  [...xml.matchAll(/<WorkingDirectory>/gi)].length<=1,
  'WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
 const action=taskAction(xml);
 const command=action.command.trim().replace(/^"([^"]+)"$/,'$1');
 need(!NO_DYNAMIC.test(command),'WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
 const lower=normalize(command),basename=path.win32.basename(lower);
 need(['wscript.exe','cscript.exe','cmd.exe'].includes(basename)&&
  (lower===basename||lower===`c:\\windows\\system32\\${basename}`),
  'WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
 const isCmd=basename==='cmd.exe';
 const script=literalScript(action.arguments,isCmd?'.cmd':'.vbs',isCmd?'cmd':'wsh');
 let absolute=script;
 if(!path.win32.isAbsolute(script)){
  const wd=action.workingDirectory.trim();
  need(path.win32.isAbsolute(wd)&&!NO_DYNAMIC.test(wd)&&
   /^[CE]:\\ZGmini\\data\\pc-writer(?:\\|$)/i.test(wd),
   'WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
  absolute=path.win32.resolve(wd,script);
 }
 need(path.win32.isAbsolute(absolute)&&!NO_DYNAMIC.test(absolute),
  'WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
 let resolved;
 try{resolved=normalize(realpath(absolute));}catch{
  stop('WRITER_B_FIRST_HOP_UNRESOLVED_STOP');
 }
 need(WRITER_DATA.test(resolved),'WRITER_B_FIRST_HOP_OUTSIDE_SCOPE_STOP');
 const consumers=manifest.runtimeDependencies?.consumers??[];
 const matches=consumers.filter(x=>x.kind==='LAUNCHER'&&
  normalize(x.path)===resolved&&
  x.dependsOn?.some(dep=>changed.includes(dep)));
 need(matches.length===1,'WRITER_B_FIRST_HOP_LAUNCHER_MISMATCH_STOP');
 return {status:'PASS',code:'FIRST_HOP_TASK_LAUNCHER_MATCH',
  consumerId:matches[0].id,runtimeChainVerified:false};
}
