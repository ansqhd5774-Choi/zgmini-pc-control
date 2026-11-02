/** Read-only trace of the registered PC Core launcher to its real Git source. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFiles=[
 'scripts/pc-writer/local-cycle.mjs',
 'scripts/pc-writer/run-local.mjs',
 'scripts/pc-writer/us-breadth-provisional-cycle.mjs',
 'scripts/pc-writer/us-breadth-provisional-publication.mjs',
 'scripts/pc-writer/quota-fetch.mjs',
 'lib/market-breadth/us-provisional-r1.mjs',
];

function xmlDecode(value){
 return value.replace(/&(amp|quot|apos|lt|gt);/g,(_,kind)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[kind]);
}
export function taskAction(xml){
 const value=String(xml);
 const get=tag=>xmlDecode(value.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`,'i'))?.[1]??'');
 return {command:get('Command'),arguments:get('Arguments'),workingDirectory:get('WorkingDirectory')};
}

function candidatePaths(text){
 // Find only script references. Never interpret a discovered command or execute it.
 const matches=String(text).match(/(?:[A-Za-z]:\\[^\r\n"'<>|]*?|(?:\.\.?[\\/])?[A-Za-z0-9_.-]+(?:[\\/][A-Za-z0-9_.-]+)*)\.(?:cmd|bat|vbs|mjs)/gi)??[];
 return [...new Set(matches.map(s=>s.trim()))].slice(0,32);
}

/** Injectable dependencies keep fixture tests independent from a real Windows PC. */
export function inspectPcSource({dataRoot,coreTaskXml,exists=fs.existsSync,
 realpath=p=>fs.realpathSync.native(p),read=p=>fs.readFileSync(p),
 git=(cwd,args)=>{
  // The isolated Runner child has a Node-only PATH. Use only fixed Git install locations.
  const binary=process.platform==='win32'?
   ['C:\\Program Files\\Git\\cmd\\git.exe','C:\\Program Files (x86)\\Git\\cmd\\git.exe'].find(fs.existsSync):'git';
  if(!binary)throw Error('PC_SOURCE_GIT_UNAVAILABLE');
  return execFileSync(binary,['-c','core.fsmonitor=false','-c','core.untrackedCache=false','-C',cwd,...args],
   {windowsHide:true,timeout:10000,maxBuffer:65536,encoding:'utf8'});
 }}={}){
 const base=path.dirname(realpath(dataRoot)),root=path.resolve(base);
 const inside=p=>p.toLowerCase().startsWith((root+path.sep).toLowerCase());
 const relative=p=>path.relative(root,p).replaceAll('\\','/');
 const action=taskAction(coreTaskXml),queue=[];
 for(const part of [action.command,action.arguments,action.workingDirectory])queue.push(...candidatePaths(part));
 const visited=new Set(),files=[];let sourceRoot=null;
 while(queue.length&&visited.size<24){
  const raw=queue.shift();
  // No arbitrary task arguments, URL, environment expansion, glob or shell.
  if(raw.includes('%')||raw.includes('$')||raw.includes('*')||raw.includes('?'))continue;
  const bases=files.length?[path.dirname(files[files.length-1].absolute),root]:[root];
  const candidates=path.isAbsolute(raw)?[raw]:bases.map(b=>path.resolve(b,raw));
  for(const candidate of candidates){
   let real;try{real=realpath(candidate);}catch{continue;}
   if(!inside(real)||visited.has(real.toLowerCase())||!exists(real))continue;
   let stat;try{stat=fs.statSync(real);}catch{continue;}
   if(!stat.isFile()||stat.size>65536)continue;
   const bytes=read(real);visited.add(real.toLowerCase());
   files.push({absolute:real,path:relative(real),sha256:sha256(bytes)});
   for(const found of candidatePaths(bytes.toString('utf8')))queue.push(found);
   let dir=path.dirname(real);
   while(inside(dir)){
    if(exists(path.join(dir,'.git'))&&exists(path.join(dir,'scripts','pc-writer','local-cycle.mjs'))){sourceRoot=dir;break;}
    dir=path.dirname(dir);
   }
   if(sourceRoot)break;
  }
  if(sourceRoot)break;
 }
 const safeFiles=files.map(({path,sha256})=>({path,sha256}));
 const result={status:'PASS',code:'PC_SOURCE_READONLY_DIAGNOSIS',
  coreTaskAction:{commandFile:path.basename(action.command),scriptFiles:candidatePaths(action.arguments).map(path.basename).slice(0,8)},
  tracedLaunchers:safeFiles,sourceResolved:!!sourceRoot,
  sourceRoot:sourceRoot?relative(sourceRoot):null,
  sourceHead:null,trackedDirty:null,requiredFiles:[],providerCalls:0,d1Writes:0,sqliteOpened:false};
 if(!sourceRoot)return result;
 try{
  result.sourceHead=git(sourceRoot,['rev-parse','HEAD']).trim();
  const dirty=git(sourceRoot,['status','--porcelain','--untracked-files=no']);
  result.trackedDirty=dirty.split(/\r?\n/).filter(Boolean).map(x=>x.slice(3)).slice(0,30);
 }catch{result.code='PC_SOURCE_GIT_READ_UNVERIFIED';return result;}
 for(const name of sourceFiles){
  const p=path.join(sourceRoot,...name.split('/'));
  let safe=null;
  try{safe=realpath(p);}catch{}
  const present=!!safe&&inside(safe)&&exists(safe);
  result.requiredFiles.push({path:name,exists:present,sha256:present?sha256(read(safe)):null});
 }
 return result;
}
