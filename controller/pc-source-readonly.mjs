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
function xmlText(xml){
 if(!Buffer.isBuffer(xml))return String(xml);
 if(xml.length>=2){
  if(xml[0]===0xff&&xml[1]===0xfe)return xml.toString('utf16le').replace(/^\uFEFF/,'');
  if(xml[0]===0xfe&&xml[1]===0xff)return Buffer.from(xml).swap16().toString('utf16le').replace(/^\uFEFF/,'');
 }
 // schtasks /XML may return BOM-less UTF-16LE on Windows.
 if(xml.length>=4&&xml[1]===0&&xml[3]===0)return xml.toString('utf16le');
 return xml.toString('utf8').replace(/^\uFEFF/,'');
}
export function taskAction(xml){
 const value=xmlText(xml);
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
  return execFileSync(binary,['--no-optional-locks','-c','core.fsmonitor=false',
   '-c','core.untrackedCache=false','-C',cwd,...args],
   {windowsHide:true,timeout:10000,maxBuffer:65536,encoding:'utf8',
    env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
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
  evidenceLevel:'STATIC_LAUNCHER_TRACE_ONLY',runtimeSourceVerified:false,
  coreTaskAction:{commandFile:path.basename(action.command),scriptFiles:candidatePaths(action.arguments).map(p=>path.basename(p)).slice(0,8)},
  tracedLaunchers:safeFiles,sourceResolved:!!sourceRoot,
  sourceRoot:sourceRoot?relative(sourceRoot):null,
  sourceHead:null,trackedDirty:null,requiredFiles:[],providerCalls:0,d1Writes:0,sqliteOpened:false};

 // The already-running Writer records Git rev-parse HEAD in a fixed checkpoint.
 // Report only bounded status metadata; never return the file's other fields.
 const writerFile=path.join(root,'data','pc-writer','local-writer-last-run.json');
 try{
  const real=realpath(writerFile);
  if(inside(real)&&exists(real)&&fs.statSync(real).size<=131072){
   const saved=JSON.parse(read(real).toString('utf8'));
   if(typeof saved?.source==='string'&&/^[0-9a-f]{40}$/.test(saved.source)){
    result.lastWriterEvidence={
     evidenceLevel:'STORED_WRITER_RUNTIME_CHECKPOINT',
     sourceHead:saved.source,
     at:typeof saved.at==='string'&&Number.isFinite(Date.parse(saved.at))?saved.at:null,
     status:typeof saved.status==='string'&&/^[A-Z0-9_]{1,80}$/.test(saved.status)?saved.status:null,
    };
   }
  }
 }catch{} // Missing/malformed historical checkpoint is not a fresh runtime failure.
 // A historical path verified by the 2026-10-31 PC Core runbook.
 // Check it only when the current launcher chain did not resolve a checkout.
 // A matching Git HEAD is NOT proof that the current Core Task executes it.
 if(!sourceRoot){
  const historical=path.join(root,'projects','zgmini-earnings-history-pc-release');
  try{
   const real=realpath(historical);
   if(inside(real)&&fs.statSync(real).isDirectory()){
    const gitMark=realpath(path.join(real,'.git'));
    if(!inside(gitMark))throw Error('GIT_MARK_OUTSIDE_ROOT');
    const markStat=fs.statSync(gitMark);
    if(markStat.isFile()){
     if(markStat.size>2048)throw Error('GIT_MARK_TOO_LARGE');
     const text=read(gitMark).toString('utf8').trim();
     const ref=/^gitdir:\s*(.+)$/i.exec(text);
     if(!ref)throw Error('GIT_MARK_INVALID');
     const dir=realpath(path.resolve(real,ref[1]));
     if(!inside(dir)||!fs.statSync(dir).isDirectory())throw Error('GIT_DIR_OUTSIDE_ROOT');
    }else if(!markStat.isDirectory())throw Error('GIT_MARK_INVALID');
    const sourceFile=realpath(path.join(real,'scripts','pc-writer','local-cycle.mjs'));
    if(!inside(sourceFile)||!fs.statSync(sourceFile).isFile())throw Error('NOT_A_WRITER_CHECKOUT');
    const candidate={
     evidenceLevel:'HISTORICAL_CHECKOUT_NOT_CORE_RUNTIME',
     sourceRoot:relative(real),gitVerified:false,head:null,trackedDirty:null,
     matchesWriterCheckpoint:null,requiredFiles:[],
    };
    try{
     const head=git(real,['rev-parse','--verify','HEAD']).trim();
     const status=git(real,['status','--porcelain','--untracked-files=no']);
     if(/^[a-f0-9]{40}$/i.test(head)&&typeof status==='string'){
      candidate.gitVerified=true;candidate.head=head.toLowerCase();
      candidate.trackedDirty=status.trim().length>0;
      if(result.lastWriterEvidence){
       candidate.matchesWriterCheckpoint=
        candidate.head===result.lastWriterEvidence.sourceHead;
      }
     }
    }catch{} // Unreadable Git evidence must remain unverified.
    for(const name of sourceFiles){
     const filename=path.join(real,...name.split('/'));
     let file=null;
     try{file=realpath(filename);}catch{}
     const safe=!!file&&inside(file)&&exists(file);
     let present=false,hash=null;
     if(safe){
      try{
       const stat=fs.statSync(file);
       present=stat.isFile();
       if(present&&stat.size<=1048576)hash=sha256(read(file));
      }catch{}
     }
     candidate.requiredFiles.push({path:name,exists:present,sha256:hash});
    }
    result.historicalCheckoutCandidate=candidate;
   }
  }catch{} // Missing, escaped or invalid historical checkout: no inferred source.
  return result;
 }

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
