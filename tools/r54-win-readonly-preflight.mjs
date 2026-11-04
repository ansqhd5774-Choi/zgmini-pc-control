// R54 one-time B preflight, strictly READ-ONLY. This is not an admission,
// freeze authority, or an installer. No Task mutation, process termination,
// shell, arbitrary Issue path, or source writes are exposed by this module.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const R54_ROOT='E:\\ZGmini\\data\\pc-writer\\theme-nine-r54';
export const R54_TASK='ZGMINI-PC-Theme-Nine-R54-Public';
export const R54_ACTION=R54_ROOT+'\\scripts\\pc-writer\\THEME_NINE_R54_PUBLIC_CYCLE.cmd';
export const R54_ACTION_SHA='0dea186a956dbc1471a4063e8c64dd5a230549477860e699bbb450a06d4360f4';
export const R54_LOCK=R54_ROOT+'\\R54_B_SOURCE_EXCLUSIVE.lock';
export const R54_ORIGINAL_SIX=Object.freeze([
 ['scripts/pc-writer/theme-nine-r54-public-connect.mjs','c6e4699d62bdef991911561623e37c205fd8bb6e5aa69907c3e93e36908fd31e'],
 ['scripts/pc-writer/theme-nine-r51-stage-current.mjs','fe079b1e2e5d2f824f6e0ff251bd2a01677fe1a477072c619b614402fbd90ae4'],
 ['scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs','dfc326e2738c1b8b82451510104ac6ad502e2a9876e0a3a76d939c412e907bb7'],
 ['scripts/pc-writer/theme-nine-r54-public-record.mjs','f2a688da40d7b5ee90ed2a27a40af05b9c63116284930f1cc26041064737d012'],
 ['scripts/pc-writer/theme-nine-r48-d1-publication.mjs','7a10fe41710dbc1a21c9f3e343c538cd96b6c5695b683f04dce48af85ede6e7e'],
 ['worker/theme-nine-r37-public.mjs','e6768dd37ebe65b9015aeb37b4a088c568ab839f085936cec8305c56ea36ce33'],
]);
const MUTATOR_FILES=Object.freeze([
 'scripts/pc-writer/theme-ten-r78-repair-and-retry.mjs',
 'scripts/pc-writer/theme-ten-r80-rebase-once.mjs',
 'scripts/pc-writer/theme-ten-r81-seven-auth-once.mjs',
 'scripts/pc-writer/build-theme-nine-r54-public-connector.mjs',
 'scripts/pc-writer/THEME_NINE_R54_PUBLIC_CONNECT.cmd',
]);
const relevant='theme-nine-r54|theme-ten-r78|theme-ten-r80|theme-ten-r81|R54_B_SOURCE_EXCLUSIVE|THEME_NINE_R54_PUBLIC|theme-nine-r51|theme-nine-r48|theme-nine-r37';
const PROCESS_PATTERN=new RegExp(relevant,'i');
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=(code,detail)=>{const err=Error(code);err.code=code;err.detail=detail;throw err;};
const requireIt=(ok,code)=>{if(!ok)fail(code);};
const winNorm=x=>String(x).replace(/\//g,'\\').toLowerCase();
const exactOne=(body,re,code)=>{
 const matches=[...body.matchAll(re)];
 if(matches.length!==1)fail(code);
 return matches[0][1];
};
const xmlText=x=>x.replace(/&amp;/g,'&').replace(/&quot;/g,'"')
 .replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');

/** Task XML cannot certify that no other launcher will start later. */
export function readR54TaskDefinition(xml,actionBytes,{actionPath=R54_ACTION,
 actionSha=R54_ACTION_SHA}={}){
 requireIt(Buffer.isBuffer(xml)&&xml.length>0&&xml.length<65536,'R54_READ_TASK_XML_INVALID');
 requireIt(Buffer.isBuffer(actionBytes)&&sha(actionBytes)===actionSha,
  'R54_READ_ACTION_SHA_DRIFT');
 const src=xml.toString('utf8');
 const settings=exactOne(src,/<Settings\b[^>]*>([\s\S]*?)<\/Settings>/g,
  'R54_READ_TASK_SETTINGS_INVALID');
 const enabled=exactOne(settings,/<Enabled>(true|false)<\/Enabled>/g,
  'R54_READ_TASK_ENABLED_UNKNOWN');
 const actions=exactOne(src,/<Actions\b[^>]*>([\s\S]*?)<\/Actions>/g,
  'R54_READ_TASK_ACTIONS_INVALID');
 requireIt([...actions.matchAll(/<Exec\b/g)].length===1&&
  !/<(?:ComHandler|SendEmail|ShowMessage|Arguments|WorkingDirectory)\b/i.test(actions),
  'R54_READ_TASK_EXTRA_ACTION_OR_ARGUMENTS');
 const command=xmlText(exactOne(actions,/<Command>([\s\S]*?)<\/Command>/g,
  'R54_READ_TASK_COMMAND_UNKNOWN').trim());
 requireIt(winNorm(command.replace(/^"(.*)"$/,'$1'))===winNorm(actionPath),
  'R54_READ_TASK_ACTION_DRIFT');
 return Object.freeze({enabled:enabled==='true',xmlSha256:sha(xml),
  actionPath:command,actionSha256:sha(actionBytes),xml:Buffer.from(xml)});
}

/** CSV with embedded commas and quoted newlines: parsing errors FAIL CLOSED. */
export function parseWmiProcessCsv(bytes){
 requireIt(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=4*1024*1024,
  'R54_READ_WMI_OUTPUT_INVALID');
 const raw=bytes.toString('utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
 requireIt(!raw.includes('\uFFFD'),'R54_READ_WMI_ENCODING_UNKNOWN');
 const records=[];let cells=[],cell='',quoted=false;
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(c==='"'){
   if(quoted&&raw[i+1]==='"'){cell+='"';i++;}
   else quoted=!quoted;
  }else if(c===','&&!quoted){cells.push(cell);cell='';}
  else if(c==='\n'&&!quoted){cells.push(cell);if(cells.some(x=>x.trim()))records.push(cells);cells=[];cell='';}
  else cell+=c;
 }
 requireIt(!quoted,'R54_READ_WMI_CSV_UNCLOSED_QUOTE');
 if(cell||cells.length){cells.push(cell);if(cells.some(x=>x.trim()))records.push(cells);}
 const headerIndex=records.findIndex(row=>row.includes('ProcessId')&&row.includes('ParentProcessId'));
 requireIt(headerIndex>=0,'R54_READ_WMI_HEADER_MISSING');
 const header=records[headerIndex].map(x=>x.trim());
 const required=['Node','CommandLine','ExecutablePath','Name','ParentProcessId','ProcessId'];
 requireIt(required.every(x=>header.includes(x)), 'R54_READ_WMI_COLUMNS_MISSING');
 const ids=new Set();
 const items=records.slice(headerIndex+1).map(row=>{
  requireIt(row.length===header.length,'R54_READ_WMI_ROW_MALFORMED');
  const val=key=>row[header.indexOf(key)].trim();
  const pid=Number(val('ProcessId')),ppid=Number(val('ParentProcessId'));
  requireIt(Number.isSafeInteger(pid)&&pid>0&&Number.isSafeInteger(ppid)&&ppid>=0
   &&!ids.has(pid),'R54_READ_WMI_PID_AMBIGUOUS');
  ids.add(pid);
  return {pid,ppid,name:val('Name'),exe:val('ExecutablePath'),cmd:val('CommandLine')};
 });
 return items;
}

export function activeR54ProcessTree(items){
 requireIt(Array.isArray(items),'R54_READ_WMI_PROCESS_LIST_INVALID');
 const seen=new Set(),roots=[];
 for(const p of items){
  requireIt(Number.isSafeInteger(p.pid)&&p.pid>0&&!seen.has(p.pid),
   'R54_READ_WMI_PID_AMBIGUOUS');
  seen.add(p.pid);
  const name=(p.name||'').toLowerCase();
  const maybeRunner=/^(node|cmd|wscript|cscript|npm|npx|pwsh|powershell)(\.exe)?$/.test(name);
  if(maybeRunner&&(!p.cmd||!p.exe))fail('R54_READ_WMI_REDACTED_POTENTIAL_LAUNCHER');
  if(PROCESS_PATTERN.test((p.cmd||'')+' '+(p.exe||'')))roots.push(p.pid);
 }
 const marked=new Set(roots);
 let changed=true;
 while(changed){changed=false;for(const p of items){
  if(marked.has(p.ppid)&&!marked.has(p.pid)){marked.add(p.pid);changed=true;}
 }}
 return {rootCount:roots.length,descendantCount:marked.size-roots.length,
  active:[...marked].sort((a,b)=>a-b)};
}

// Fixed source inventory helper rejects junction/symlinked *components*.
function pinnedFile(fsImpl,root,rel){
 requireIt(typeof rel==='string'&&rel.split('/').every(x=>/^[\w.-]+$/.test(x)
  &&x!=='.'&&x!=='..'),'R54_READ_PATH_BAD');
 const base=fsImpl.realpathSync.native(root);
 let at=base;
 for(const part of rel.split('/')){
  at=path.join(at,part);
  const st=fsImpl.lstatSync(at);
  requireIt(!st.isSymbolicLink(),'R54_READ_JUNCTION_OR_SYMLINK_DENIED');
 }
 const real=fsImpl.realpathSync.native(at);
 requireIt(winNorm(real).startsWith(winNorm(base)+winNorm(path.sep))
  &&fsImpl.statSync(real).isFile(),'R54_READ_PATH_OUTSIDE_FIXED_ROOT');
 return real;
}

function rootSafe(fsImpl,root){
 requireIt(path.isAbsolute(root),'R54_READ_ROOT_NOT_ABSOLUTE');
 const actual=fsImpl.realpathSync.native(root);
 requireIt(winNorm(actual)===winNorm(root),'R54_READ_ROOT_REPARSE_DRIFT');
 // The root's parent can be a junction as well; no implicit C: fallback.
 let at=path.parse(root).root;
 for(const p of root.slice(at.length).split(/[\\/]/).filter(Boolean)){
  at=path.join(at,p);
  requireIt(!fsImpl.lstatSync(at).isSymbolicLink(),
   'R54_READ_ROOT_JUNCTION_OR_SYMLINK_DENIED');
 }
 requireIt(fsImpl.statSync(actual).isDirectory(),'R54_READ_ROOT_NOT_DIRECTORY');
 return actual;
}

function readFiles(fsImpl,root,pins){
 const rows=[];
 for(const [rel,expected] of pins){
  const file=pinnedFile(fsImpl,root,rel);
  const actual=sha(fsImpl.readFileSync(file));
  requireIt(actual===expected,'R54_READ_ORIGINAL_SOURCE_SHA_DRIFT');
  rows.push({path:rel,sha256:actual});
 }
 return rows;
}

/**
 * Observation only, NEVER `READY_TO_SWAP`. Calls are supplied only by an
 * installed fixed-path host adapter, not by Issue JSON or user input.
 * Independent operator freeze + Task Disable + an actual exclusive B lease
 * remain mandatory after this preflight, checked again at the swap boundary.
 */
export function inspectR54BReadonly({ports,fsImpl=fs,root=R54_ROOT,
 lock=R54_LOCK,action=R54_ACTION,actionSha=R54_ACTION_SHA,
 six=R54_ORIGINAL_SIX}={}){
 requireIt(ports&&['taskXml','processCsv','volumeInfo'].every(x=>typeof ports[x]==='function'),
  'R54_READ_PORTS_REQUIRED');
 const sourceRoot=rootSafe(fsImpl,root);
 const volume=ports.volumeInfo();
 requireIt(typeof volume==='string'&&/\bNTFS\b/i.test(volume),
  'R54_READ_VOLUME_NOT_VERIFIED_NTFS');
 const cmd=pinnedFile(fsImpl,sourceRoot,'scripts/pc-writer/THEME_NINE_R54_PUBLIC_CYCLE.cmd');
 const actionBytes=fsImpl.readFileSync(cmd);
 const sixBefore=readFiles(fsImpl,sourceRoot,six);
 const xmlFirst=ports.taskXml();
 const task=readR54TaskDefinition(xmlFirst,actionBytes,{actionPath:action,actionSha});
 const processFirst=activeR54ProcessTree(parseWmiProcessCsv(ports.processCsv()));
 const sixAfter=readFiles(fsImpl,sourceRoot,six);
 const xmlSecond=ports.taskXml();
 const taskSecond=readR54TaskDefinition(xmlSecond,fsImpl.readFileSync(cmd),
  {actionPath:action,actionSha});
 const processSecond=activeR54ProcessTree(parseWmiProcessCsv(ports.processCsv()));
 requireIt(JSON.stringify(sixBefore)===JSON.stringify(sixAfter)
  &&task.xmlSha256===taskSecond.xmlSha256,
  'R54_READ_SOURCE_OR_TASK_CHANGED_DURING_OBSERVATION');
 requireIt(processFirst.active.length===0&&processSecond.active.length===0,
  'R54_READ_ACTIVE_R54_PROCESS_PRESENT');
 const parent=path.dirname(lock);
 requireIt(winNorm(parent)===winNorm(sourceRoot),'R54_READ_LOCK_ROOT_CHANGED');
 requireIt(!fsImpl.existsSync(lock),'R54_READ_LOCK_ALREADY_PRESENT');
 // Record actual manually callable scripts without executing them. The mere
 // absence of these paths does NOT prove alternate worktrees are frozen.
 const manual=MUTATOR_FILES.map(rel=>{
  const target=path.join(sourceRoot,...rel.split('/'));
  return fsImpl.existsSync(target)
   ?{path:rel,sha256:sha(fsImpl.readFileSync(pinnedFile(fsImpl,sourceRoot,rel)))}
   :{path:rel,absent:true};
 });
 return Object.freeze({status:'OBSERVED_ONLY_NEEDS_INDEPENDENT_FREEZE',
  sourceRoot,task:{enabled:task.enabled,xmlSha256:task.xmlSha256,
   actionPath:task.actionPath,actionSha256:task.actionSha256},
  originalSix:sixAfter,manual,process:{first:processFirst,second:processSecond},
  ntfsVerified:true,leaseAbsentAtTwoPointRead:true,
  independentManualFreezeVerified:false,taskDisabledByB:false,
  exclusiveBLeaseHeld:false});
}

/** Fixed read-only Windows command adapter. Refuses non-Win32 platforms. */
export function createR54ReadOnlyWindowsPorts({platform=process.platform,
 systemRoot=process.env.SystemRoot,spawn=spawnSync}={}){
 requireIt(platform==='win32'&&typeof systemRoot==='string'
  &&/^[a-z]:\\windows$/i.test(systemRoot),
  'R54_READ_NATIVE_WINDOWS_REQUIRED');
 const exec=(binary,args)=>{
  const result=spawn(path.win32.join(systemRoot,'System32',binary),args,
   {shell:false,windowsHide:true,encoding:null,maxBuffer:4*1024*1024,timeout:20000});
  if(result?.status!==0||result?.error||!Buffer.isBuffer(result.stdout))
   fail('R54_READ_FIXED_OS_COMMAND_FAILED');
  return result.stdout;
 };
 return Object.freeze({
  taskXml:()=>exec('schtasks.exe',['/Query','/TN',R54_TASK,'/XML']),
  processCsv:()=>exec('wbem\\wmic.exe',['process','get',
   'CommandLine,ExecutablePath,Name,ParentProcessId,ProcessId','/format:csv']),
  volumeInfo:()=>exec('fsutil.exe',['fsinfo','volumeinfo','E:']).toString('utf8'),
 });
}
