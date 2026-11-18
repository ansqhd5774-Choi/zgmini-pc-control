// Read-only, fixed TaskScheduler fingerprint. Never execute/disable tasks,
// publish command lines, XML, arguments, source bytes, secrets or environment.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export const TASK='ZGMINI-PC-MarketParquet-ETF';
const sha=b=>createHash('sha256').update(b).digest('hex');
const blank=code=>({status:'STATE_UNKNOWN',code,task:TASK,taskEnabled:null,
 taskXmlSha256:null,actionKind:null,entryFileScope:null,entryFileLeaf:null,
 entryFileSha256:null,providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false});
function decode(b){
 if(!Buffer.isBuffer(b)||b.length<25||b.length>262144)return null;
 if(b[0]===255&&b[1]===254)return b.subarray(2).toString('utf16le');
 if(b[0]===254&&b[1]===255)return Buffer.from(b.subarray(2)).swap16().toString('utf16le');
 if(b[1]===0&&b[3]===0)return b.toString('utf16le');
 return b.toString('utf8').replace(/^\uFEFF/,'');
}
const tag=(s,k)=>s?.match(new RegExp('<'+k+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+k+'>','i'))?.[1]??null;
function entities(s){
 if(typeof s!=='string'||s.length>8192||/&(?!(?:amp|quot|apos|lt|gt);)/i.test(s))return null;
 return s.replace(/&(amp|quot|apos|lt|gt);/gi,(_,n)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[n.toLowerCase()]);
}
const scope=p=>{
 const v=path.win32.normalize(p).toLowerCase();
 return v.startsWith('e:\\zgmini\\data\\')?'E_DATA':
  v.startsWith('e:\\zgmini\\projects\\')?'E_PROJECTS':null;
};
function hashFile(p){
 const stat=fs.lstatSync(p),real=fs.realpathSync.native(p);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>1048576||
   scope(real)!==scope(p))return null;
 const bytes=fs.readFileSync(p);
 return Buffer.isBuffer(bytes)&&bytes.length===stat.size?sha(bytes):null;
}
const queryTask=()=>spawnSync(path.win32.join(process.env.SystemRoot||'C:\\Windows',
 'System32','schtasks.exe'),['/Query','/TN',TASK,'/XML'],{
 encoding:null,windowsHide:true,shell:false,timeout:15000,maxBuffer:262144});
export function inspectTask({platform=process.platform,query=queryTask,hashEntry=hashFile,
 clock=()=>new Date().toISOString()}={}){
 if(platform!=='win32')return blank('WINDOWS_REQUIRED');
 let q;try{q=query();}catch{return blank('TASK_QUERY_UNAVAILABLE');}
 if(q?.error||q?.status!==0)return blank('TASK_QUERY_UNAVAILABLE');
 const xml=decode(q?.stdout);
 if(!xml||!/<Task(?:\s|>)/i.test(xml))return blank('TASK_XML_INVALID');
 const enabled=tag(tag(xml,'Settings'),'Enabled')?.trim();
 const active=enabled==='true'?true:enabled==='false'?false:null;
 const exec=[...xml.matchAll(/<Exec(?:\s[^>]*)?>([\s\S]*?)<\/Exec>/gi)];
 const base={...blank('TASK_ACTION_UNVERIFIED'),taskEnabled:active,
  taskXmlSha256:sha(q.stdout),observedAtUtc:clock(),
  enabledFieldPresent:active!==null,execActionCount:Math.min(exec.length,4),
  execActionCountTruncated:exec.length>4};
 if(exec.length!==1)return {...base,code:'TASK_EXEC_ACTION_COUNT_NOT_ONE'};
 const command=entities(tag(exec[0][1],'Command'));
 const args=entities(tag(exec[0][1],'Arguments')??'');
 if(command===null||args===null)return {...base,code:'TASK_ACTION_ENCODING_UNVERIFIED'};
 const binary=path.win32.basename(command.replace(/^"|"$/g,'').trim()).toLowerCase();
 const actionKind=binary==='node.exe'?'NODE':binary==='cmd.exe'?'CMD':
  ['wscript.exe','cscript.exe'].includes(binary)?'WSCRIPT':
  ['powershell.exe','pwsh.exe'].includes(binary)?'POWERSHELL':'OTHER';
 const candidate=[...new Set(((command+' '+args).match(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+\.(?:cmd|bat|vbs|mjs|js)\b/gi)??[])
  .map(s=>path.win32.normalize(s)))];
 if(candidate.length!==1)return {...base,actionKind,code:'TASK_SOURCE_PATH_NOT_UNIQUE'};
 const p=candidate[0],root=scope(p);
 if(!root)return {...base,actionKind,code:'TASK_SOURCE_OUTSIDE_APPROVED_ROOT'};
 let sum=null;try{sum=hashEntry(p);}catch{}
 if(typeof sum!=='string'||!/^[a-f0-9]{64}$/.test(sum))
  return {...base,actionKind,entryFileScope:root,code:'TASK_SOURCE_HASH_UNAVAILABLE'};
 const leaf=path.win32.basename(p);
 if(!/^[a-z0-9][a-z0-9._-]{0,127}\.(?:cmd|bat|vbs|mjs|js)$/i.test(leaf))
  return {...base,actionKind,entryFileScope:root,code:'TASK_SOURCE_FILENAME_UNVERIFIED'};
 return {...base,status:active===null?'STATE_UNKNOWN':'PASS',
  code:active===null?'TASK_ENABLED_FIELD_ABSENT_SOURCE_FINGERPRINTED':
   'MARKETPARQUET_TASK_SOURCE_FINGERPRINTED',
  actionKind,entryFileScope:root,entryFileLeaf:leaf,entryFileSha256:sum};
}
