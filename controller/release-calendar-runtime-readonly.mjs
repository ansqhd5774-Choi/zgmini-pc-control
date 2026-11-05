// A/light fixed read-only release-calendar source inventory.
// Runtime process identity is deliberately not inferred from Git or checkpoints.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const SHA40=/^[0-9a-f]{40}$/i;
const KEY=/^[a-z][a-z0-9_-]{0,48}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha=value=>typeof value==='string'&&SHA40.test(value)?value.toLowerCase():null;
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const validKey=value=>typeof value==='string'&&KEY.test(value);
const inside=(root,other)=>{
 const relative=path.relative(root,other);
 return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);
};

function defaultGitHead(dir){
 const exe=process.platform==='win32'
  ?['C:\\Program Files\\Git\\cmd\\git.exe','C:\\Program Files (x86)\\Git\\cmd\\git.exe'].find(fs.existsSync)
  :'git';
 if(!exe)return null;
 try{return sha(execFileSync(exe,['--no-optional-locks','-c','core.fsmonitor=false','-C',dir,'rev-parse','--verify','HEAD'],
  {windowsHide:true,timeout:5000,maxBuffer:1024,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}}).trim());}
 catch{return null;}
}

export function inspectReleaseCalendarRuntime(dataRoot,{fileSystem=fs,gitHead=defaultGitHead}={}){
 const out={status:'BLOCKED',code:'RELEASE_CALENDAR_DATA_ROOT_UNVERIFIED',
  evidenceLevel:'CHECKPOINT_AND_SOURCE_INVENTORY_NOT_LIVE_PROCESS',runtimeSourceVerified:false,
  configuredSourceSha:null,collection:null,candidates:[],candidateCount:0,
  inventoryTruncated:false,providerCalls:0,sqliteOpened:false,d1Writes:0,operationalWrites:0};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return out;
 const real=p=>{try{return fileSystem.realpathSync(p)}catch{return null}};
 const actualData=real(dataRoot),root=actualData&&path.dirname(actualData);
 if(!actualData||path.basename(actualData).toLowerCase()!=='data'||path.basename(root).toLowerCase()!=='zgmini')return out;
 const safeFile=(file,maxBytes)=>{
  const resolved=real(file);
  if(!resolved||!inside(root,resolved))return null;
  let s;try{s=fileSystem.lstatSync(file);}catch{return null;}
  if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>maxBytes)return null;
  try{return {bytes:fileSystem.readFileSync(resolved),modifiedAt:s.mtime.toISOString()}}catch{return null;}
 };
 const jsonFile=(file,maxBytes)=>{
  const data=safeFile(file,maxBytes);
  if(!data)return null;
  try{return {body:JSON.parse(data.bytes.toString('utf8')),modifiedAt:data.modifiedAt}}
  catch{return null;}
 };
 const home=path.join(actualData,'pc-writer');
 const config=jsonFile(path.join(home,'config.json'),65536)?.body;
 out.configuredSourceSha=sha([config?.source?.sha,config?.source?.commit,config?.source?.commitSha,config?.source,config?.sourceSha].find(sha));
 const saved=jsonFile(path.join(home,'local-collection-last-run.json'),131072);
 if(saved){
  const report=saved.body?.releaseCalendar;
  const sources=report?.sources&&typeof report.sources==='object'&&!Array.isArray(report.sources)?report.sources:{};
  const sourceKeys=Object.keys(sources).filter(validKey).sort().slice(0,32);
  out.collection={modifiedAt:saved.modifiedAt,at:date(saved.body?.at),
   sourceSha:sha(saved.body?.source),
   calendarStatus:typeof report?.status==='string'&&/^[A-Z_]{2,40}$/.test(report.status)?report.status:null,
   providerRequests:Number.isSafeInteger(report?.providerRequests)&&report.providerRequests>=0?report.providerRequests:null,
   sourceKeys,sourceCount:sourceKeys.length};
 }
 // Search only direct checkouts in the approved E:\\ZGmini\\projects tree.
 // Unlike the old 64-entry inventory, a large root does not skip every child.
 const projectRoot=path.join(root,'projects');
 for(const parent of [projectRoot,path.join(projectRoot,'legacy')]){
  const resolvedParent=real(parent);
  if(!resolvedParent||!inside(root,resolvedParent))continue;
  let entries;try{entries=fileSystem.readdirSync(resolvedParent,{withFileTypes:true})}catch{continue;}
  if(entries.length>2048){out.inventoryTruncated=true;entries=entries.slice(0,2048);}
  for(const item of entries){
   if(!item.isDirectory()||item.isSymbolicLink?.())continue;
   const dir=path.join(resolvedParent,item.name),resolved=real(dir);
   if(!resolved||!inside(root,resolved))continue;
   const collector=safeFile(path.join(resolved,'scripts','pc-writer','collect-local.mjs'),1048576);
   const module=safeFile(path.join(resolved,'lib','release-calendar.mjs'),1048576);
   if(!collector||!module)continue;
   out.candidateCount++;
   if(out.candidates.length>=32){out.inventoryTruncated=true;continue;}
   const source=module.bytes.toString('utf8');
   const match=source.match(/export\s+const\s+RELEASE_SOURCES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
   const keys=match?[...match[1].matchAll(/^\s*([a-z][a-z0-9_]*)\s*:/gm)].map(m=>m[1]).filter(validKey).slice(0,32):[];
   const head=gitHead(resolved);
   out.candidates.push({path:path.relative(root,resolved).replaceAll('\\','/'),head,
    matchesConfiguredSource:!!head&&head===out.configuredSourceSha,
    matchesCollectionSource:!!head&&head===out.collection?.sourceSha,
    collectorCallsCalendar:/\bcollectReleaseCalendar\s*\(/.test(collector.bytes.toString('utf8')),
    moduleSha256:hash(module.bytes),collectorSha256:hash(collector.bytes),
    sourceKeys:keys,sourceCount:keys.length});
  }
 }
 out.status='PASS';out.code='RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY';
 return out;
}
