/** Fixed, read-only inventory of candidate PC Git origins.
 * This is NOT proof that any candidate is the live Core execution source.
 * No caller-controlled paths, commands, SQL or provider requests are accepted.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const LIMIT_PER_DIR=64;
const MAX_CANDIDATES=130;
const MAX_FILE_BYTES=2_000_000;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const validSha=value=>typeof value==='string'&&/^[0-9a-f]{40}$/i.test(value);

function defaultGit(cwd,args){
 const binary=process.platform==='win32'?
  ['C:\\Program Files\\Git\\cmd\\git.exe','C:\\Program Files (x86)\\Git\\cmd\\git.exe'].find(fs.existsSync):'git';
 if(!binary)throw Error('GIT_MISSING');
 return execFileSync(binary,
  ['--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false','-C',cwd,...args],
  {windowsHide:true,timeout:8000,maxBuffer:65536,encoding:'utf8',
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
}

/** Injectable FS/path/git are for isolated fixtures only. */
export function inspectPcSourceOrigin({dataRoot,fsOps=fs,pathOps=path,git=defaultGit}={}){
 const output={status:'PASS',code:'PC_SOURCE_ORIGIN_CANDIDATE_INVENTORY',
  evidenceLevel:'FILESYSTEM_AND_GIT_READONLY_NOT_CORE_RUNTIME',
  runtimeSourceVerified:false,configApprovedSha:null,configSourceIsString:false,
  candidates:[],candidateCount:0,configMatchCount:0,configMatchingCandidate:null,
  inventoryTruncated:false,outsideRootRejected:0,providerCalls:0,d1Writes:0,
  sqliteOpened:false,operationalWrites:0};
 const realpath=p=>fsOps.realpathSync.native?fsOps.realpathSync.native(p):fsOps.realpathSync(p);
 const exists=p=>{try{return fsOps.existsSync(p)}catch{return false}};
 const stat=p=>{try{return fsOps.statSync(p)}catch{return null}};
 let actualDataRoot,root,projects;
 try{
  actualDataRoot=realpath(dataRoot);
  root=pathOps.dirname(actualDataRoot);
  if(pathOps.basename(actualDataRoot).toLowerCase()!=='data'||
     pathOps.basename(root).toLowerCase()!=='zgmini')throw Error('UNEXPECTED_ROOT');
  projects=pathOps.join(root,'projects');
 }catch{output.code='PC_SOURCE_ORIGIN_DATA_ROOT_UNVERIFIED';return output;}
 const within=p=>{
  const relative=pathOps.relative(root,p);
  return relative===''||relative!== '..'&&!relative.startsWith('..'+pathOps.sep)&&!pathOps.isAbsolute(relative);
 };
 const safeReal=p=>{
  try{const real=realpath(p);if(within(real))return real;output.outsideRootRejected++}
  catch{}return null;
 };
 const safeHash=p=>{
  const safe=safeReal(p),s=safe&&stat(safe);
  if(!s?.isFile()||s.size<0||s.size>MAX_FILE_BYTES)return null;
  try{return sha256(fsOps.readFileSync(safe))}catch{return null;}
 };
 // Only the approved source identity is read from config; no secret or DB identifier is returned.
 const configPath=pathOps.join(actualDataRoot,'pc-writer','config.json');
 try{
  const safe=safeReal(configPath),s=safe&&stat(safe);
  if(s?.isFile()&&s.size>0&&s.size<=65536){
   const c=JSON.parse(fsOps.readFileSync(safe).toString('utf8'));
   const x=c?.source;
   const approved=[x?.sha,x?.commit,x?.commitSha,x,c?.sourceSha].find(validSha);
   if(approved)output.configApprovedSha=approved.toLowerCase();
   output.configSourceIsString=typeof x==='string'&&validSha(x);
  }
 }catch{} // Inventory stays fail-closed if the config shape cannot be verified.

 // Enumerate only direct children of E:\ZGmini\projects and its legacy folder.
 const parents=[projects,pathOps.join(projects,'legacy')];
 const verifiedParents=parents.map(safeReal).filter(safe=>safe&&stat(safe)?.isDirectory());
 const dirs=[...verifiedParents];
 for(const safe of verifiedParents){
  let entries;
  try{entries=fsOps.readdirSync(safe,{withFileTypes:true})}
  catch{continue;}
  const directories=entries.filter(entry=>entry.isDirectory()&&!entry.isSymbolicLink?.())
   .sort((a,b)=>a.name.localeCompare(b.name,'en'));
  // Process bounded batches instead of skipping every checkout when the parent
  // contains more than LIMIT_PER_DIR unrelated entries.
  for(let offset=0;offset<directories.length;offset+=LIMIT_PER_DIR){
   for(const entry of directories.slice(offset,offset+LIMIT_PER_DIR)){
    if(dirs.length>=MAX_CANDIDATES){output.inventoryTruncated=true;break;}
    const child=safeReal(pathOps.join(safe,entry.name));
    if(child&&stat(child)?.isDirectory())dirs.push(child);
   }
   if(output.inventoryTruncated)break;
  }
 }
 const distinct=[...new Set(dirs.map(s=>s.toLowerCase()))];
 if(distinct.length>MAX_CANDIDATES)output.inventoryTruncated=true;
 // A truncated inventory MUST NOT claim a unique candidate.
 const unique=[...new Map(dirs.map(dir=>[dir.toLowerCase(),dir])).values()].slice(0,MAX_CANDIDATES);
 for(const dir of unique){
  const mark=pathOps.join(dir,'.git');
  const sourceFile=pathOps.join(dir,'scripts','pc-writer','local-cycle.mjs');
  const safeMark=safeReal(mark),markStat=safeMark&&stat(safeMark);
  if(!safeMark||!markStat||!stat(sourceFile)?.isFile()||!safeReal(sourceFile))continue;
  // A worktree .git pointer must not cause git to read a repository outside E:\ZGmini.
  if(markStat.isFile()){
   if(markStat.size>2048)continue;
   let pointer;
   try{pointer=fsOps.readFileSync(safeMark).toString('utf8').trim()}
   catch{continue;}
   const ref=/^gitdir:\s*(.+)$/i.exec(pointer);
   if(!ref)continue;
   const actualGitDir=safeReal(pathOps.resolve(dir,ref[1]));
   if(!actualGitDir||!stat(actualGitDir)?.isDirectory())continue;
  }else if(!markStat.isDirectory())continue;
  const candidate={path:pathOps.relative(root,dir).replaceAll('\\','/'),
   head:null,gitVerified:false,trackedDirty:null,configShaMatches:false,
   localCycleSha256:safeHash(sourceFile),
   d1Sha256:safeHash(pathOps.join(dir,'scripts','pc-writer','d1.mjs'))};
  try{
   const actualGitDir=git(dir,['rev-parse','--absolute-git-dir']).trim();
   if(!pathOps.isAbsolute(actualGitDir)||!safeReal(actualGitDir))throw Error('GIT_DIRECTORY_OUTSIDE_ROOT');
   const head=git(dir,['rev-parse','--verify','HEAD']).trim();
   const dirty=git(dir,['status','--porcelain','--untracked-files=no']);
   if(validSha(head)&&typeof dirty==='string'){
    candidate.head=head.toLowerCase();
    candidate.gitVerified=true;
    candidate.trackedDirty=dirty.trim().length>0;
    candidate.configShaMatches=!!output.configApprovedSha&&candidate.head===output.configApprovedSha;
   }
  }catch{}
  output.candidates.push(candidate);
 }
 output.candidateCount=output.candidates.length;
 const matches=output.candidates.filter(x=>x.configShaMatches);
 output.configMatchCount=matches.length;
 if(matches.length===1&&!output.inventoryTruncated)output.configMatchingCandidate=matches[0].path;
 return output;
}
