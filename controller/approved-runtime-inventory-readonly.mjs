// Generic, strictly read-only inventory over Controller-approved named profiles.
// The Issue payload MUST NOT supply `profile` or any path/task selector. The
// caller obtains the immutable descriptor from trusted Controller/host policy.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Reserve envelope space for Controller's report/ledger and GitHub 32KiB cap.
const MAX_REPORT_BYTES = 20 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TASK_BYTES = 256 * 1024;
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/;
const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/;
const SAFE_TASK_NAME = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,95}$/;
const SAFE_FILE_EXTENSIONS = new Set(['.cmd','.vbs','.json','.mjs','.js','.txt','.md','.ps1','.bat','.xml']);
const PRIVATE_NAME = /(?:^\.|(?:^|[-_.])(env|secret|secrets|token|tokens|password|passwords|credential|credentials|apikey|private[-_.]?key|id_rsa)(?:[-_.]|$))/i;
const fail = code => {throw Object.assign(new Error(code), {code});};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function plain(object, keys, code){
 if(!object || typeof object !== 'object' || Array.isArray(object) ||
    Object.getPrototypeOf(object) !== Object.prototype ||
    Object.keys(object).some(key => !keys.includes(key))) fail(code);
}
function segment(value){
 if(typeof value !== 'string' || value === '.' || value === '..' ||
    !SAFE_SEGMENT.test(value) || PRIVATE_NAME.test(value)) fail('INVENTORY_SELECTOR_DENIED');
 return value;
}
function relativeSelector(value){
 if(typeof value !== 'string' || value.length > 256 ||
    value.includes('\\') || value.startsWith('/') || value.includes(':'))
    fail('INVENTORY_SELECTOR_DENIED');
 return value.split('/').map(segment);
}
function name(value){
 if(typeof value !== 'string' || !SAFE_KEY.test(value)) fail('INVENTORY_KEY_INVALID');
 return value;
}
function profileSpec(profile){
 plain(profile,['id','rootSegments','files','directories','tasks'],'INVENTORY_PROFILE_INVALID');
 name(profile.id);
 if(!Array.isArray(profile.rootSegments) || profile.rootSegments.length < 1 ||
    profile.rootSegments.length > 5) fail('INVENTORY_PROFILE_INVALID');
 profile.rootSegments.forEach(segment);
 if(!Array.isArray(profile.files) || profile.files.length > 32 ||
    !Array.isArray(profile.directories) || profile.directories.length > 16 ||
    !Array.isArray(profile.tasks) || profile.tasks.length > 4)
    fail('INVENTORY_PROFILE_INVALID');
 const allKeys = new Set();
 function unique(key){name(key); if(allKeys.has(key)) fail('INVENTORY_DUPLICATE_KEY'); allKeys.add(key);}
 for(const file of profile.files){
  plain(file,['key','relativePath'],'INVENTORY_PROFILE_INVALID');
  unique(file.key);
  const parts=relativeSelector(file.relativePath);
  if(!SAFE_FILE_EXTENSIONS.has(path.posix.extname(parts.at(-1)).toLowerCase()))
   fail('INVENTORY_SELECTOR_DENIED');
 }
 for(const dir of profile.directories){
  plain(dir,['key','relativePath'],'INVENTORY_PROFILE_INVALID');
  unique(dir.key);relativeSelector(dir.relativePath);
 }
 for(const task of profile.tasks){
  plain(task,['key','name','expectedCommandBasename','expectedHour'],'INVENTORY_PROFILE_INVALID');
  unique(task.key);
  if(typeof task.name!=='string' || !SAFE_TASK_NAME.test(task.name))
   fail('INVENTORY_TASK_NAME_DENIED');
  if(own(task,'expectedCommandBasename')){
   segment(task.expectedCommandBasename);
   if(!SAFE_FILE_EXTENSIONS.has(path.extname(task.expectedCommandBasename).toLowerCase()))
    fail('INVENTORY_SELECTOR_DENIED');
  }
  if(own(task,'expectedHour') && (!Number.isInteger(task.expectedHour) ||
     task.expectedHour<0 || task.expectedHour>23)) fail('INVENTORY_PROFILE_INVALID');
 }
 return profile;
}
function real(target){
 try{return fs.realpathSync.native(target);}catch(error){
  if(error.code === 'ENOENT') return null;
  fail('INVENTORY_FILESYSTEM_UNAVAILABLE');
 }
}
function within(root, target){
 const rel=path.relative(root,target);
 return rel === '' || (!rel.startsWith('..'+path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
const samePath=(a,b)=>process.platform==='win32'?
 path.normalize(a).toLowerCase()===path.normalize(b).toLowerCase():a===b;
function safeRoot(dataRoot, rootSegments){
 if(typeof dataRoot!=='string' || !path.isAbsolute(dataRoot)) fail('INVENTORY_DATA_ROOT_INVALID');
 const base=real(dataRoot);
 if(!base || !fs.statSync(base).isDirectory()) fail('INVENTORY_DATA_ROOT_MISSING');
 let cursor=base;
 for(const part of rootSegments){
  cursor=path.join(cursor,part);
  let stat;
  try{stat=fs.lstatSync(cursor);}catch(error){
   if(error.code==='ENOENT') return {root:cursor,exists:false};
   fail('INVENTORY_FILESYSTEM_UNAVAILABLE');
  }
  if(stat.isSymbolicLink() || !stat.isDirectory()) fail('INVENTORY_REPARSE_OR_TYPE_DENIED');
  const resolved=real(cursor);
  if(!resolved || !within(base,resolved) || !samePath(resolved,cursor))
   fail('INVENTORY_REPARSE_OR_TYPE_DENIED');
 }
 return {root:cursor,exists:true};
}
function safeEntry(base, selector, type){
 const parts=relativeSelector(selector);
 let cursor=base;
 for(let i=0;i<parts.length;i++){
  cursor=path.join(cursor,parts[i]);
  let stat;
  try{stat=fs.lstatSync(cursor);}catch(error){
   if(error.code==='ENOENT') return null;
   fail('INVENTORY_FILESYSTEM_UNAVAILABLE');
  }
  if(stat.isSymbolicLink()) fail('INVENTORY_REPARSE_OR_TYPE_DENIED');
  if(i<parts.length-1 || type==='directory'){
   if(!stat.isDirectory()) fail('INVENTORY_REPARSE_OR_TYPE_DENIED');
  } else if(!stat.isFile()) fail('INVENTORY_REPARSE_OR_TYPE_DENIED');
  const resolved=real(cursor);
  if(!resolved || !within(base,resolved) || !samePath(resolved,cursor))
   fail('INVENTORY_REPARSE_OR_TYPE_DENIED');
 }
 return {path:cursor,stat:fs.lstatSync(cursor)};
}
function fileState(base, descriptor){
 const entry=safeEntry(base,descriptor.relativePath,'file');
 if(!entry)return {exists:false};
 if(entry.stat.size>MAX_FILE_BYTES) return {exists:true,status:'SIZE_LIMIT'};
 // The path is a fixed approved selector and all ancestor links were checked.
 // Verify the opened descriptor has the same file identity as the inspected one.
 const fd=fs.openSync(entry.path,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
 try{
  const actual=fs.fstatSync(fd);
  if(!actual.isFile() || actual.size!==entry.stat.size ||
     (actual.ino!==0 && entry.stat.ino!==0 && actual.ino!==entry.stat.ino))
   fail('INVENTORY_FILE_CHANGED_DURING_READ');
  const content=fs.readFileSync(fd);
  return {exists:true,sizeBytes:content.length,sha256:sha(content)};
 }finally{fs.closeSync(fd);}
}
function decodeTask(xml){
 const bytes=Buffer.isBuffer(xml)?xml:Buffer.from(String(xml??''),'utf8');
 if(bytes.length<32 || bytes.length>MAX_TASK_BYTES) return null;
 const utf16=bytes[0]===0xff&&bytes[1]===0xfe ||
   (bytes.length>=4 && bytes[1]===0 && bytes[3]===0);
 return {bytes,text:utf16?new TextDecoder('utf-16le').decode(bytes):bytes.toString('utf8')};
}
function taskState(descriptor, queryTask){
 if(typeof queryTask!=='function')return {status:'NOT_QUERIED'};
 let response;
 try{response=queryTask(descriptor.name);}catch{return {status:'QUERY_UNAVAILABLE'};}
 const xml=decodeTask(response);
 if(!xml)return {status:'QUERY_INVALID_SIZE'};
 const command=xml.text.match(/<(?:\w+:)?Command>\s*([\s\S]*?)\s*<\/(?:\w+:)?Command>/i)?.[1]??null;
 const settings=xml.text.match(/<(?:\w+:)?Settings(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?Settings>/i)?.[1]??'';
 const enabled=settings.match(/<(?:\w+:)?Enabled>\s*(true|false)\s*<\/(?:\w+:)?Enabled>/i)?.[1]??null;
 if(!command)return {status:'QUERY_NO_ACTION',xmlSha256:sha(xml.bytes)};
 // Only bounded booleans / fingerprints leave this function. Never include the
 // command, arguments, raw XML, paths or credentials in Issue output.
 const result={status:'XML_READ',xmlSha256:sha(xml.bytes),
  enabled:enabled===null?null:enabled.toLowerCase()==='true'};
 if(own(descriptor,'expectedCommandBasename')){
  const normalized=command.replace(/&quot;/gi,'"').replace(/\\/g,'/').replace(/\/$/,'');
  result.expectedCommandPresent=normalized.split('/').at(-1).toLowerCase()===
   descriptor.expectedCommandBasename.toLowerCase();
 }
 if(own(descriptor,'expectedHour')){
  const time=String(descriptor.expectedHour).padStart(2,'0');
  result.expectedHourPresent=[...xml.text.matchAll(/<(?:\w+:)?StartBoundary>([\s\S]*?)<\/(?:\w+:)?StartBoundary>/gi)]
   .some(match=>new RegExp('T'+time+':\\d\\d:\\d\\d').test(match[1]));
 }
 return result;
}

/**
 * @param {object} input Controller-provided trusted dataRoot, profile, queryTask.
 * The Issue JSON should contain only the existing seven validated fields;
 * it may select a pre-approved operation name, NEVER profile/path/task data.
 */
export function inspectApprovedRuntimeInventory({dataRoot,profile,queryTask}={}){
 profileSpec(profile);
 const root=safeRoot(dataRoot,profile.rootSegments);
 const result={status:'DONE',code:'APPROVED_RUNTIME_INVENTORY_READONLY',profileId:profile.id,
  rootExists:root.exists,files:{},directories:{},tasks:{},
  writes:0,collectorRuns:0,d1Writes:0,dbOpens:0,installationPerformed:false};
 if(root.exists){
  for(const item of profile.files) result.files[item.key]=fileState(root.root,item);
  for(const item of profile.directories)
   result.directories[item.key]={exists:!!safeEntry(root.root,item.relativePath,'directory')};
 }else{
  for(const item of profile.files) result.files[item.key]={exists:false};
  for(const item of profile.directories)result.directories[item.key]={exists:false};
 }
 for(const task of profile.tasks) result.tasks[task.key]=taskState(task,queryTask);
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>MAX_REPORT_BYTES)
  fail('INVENTORY_REPORT_OVERSIZED');
 return result;
}

/**
 * Stable A/light receiver. No feature-specific Controller branch/operation is
 * needed when onboarding a new approved profile: only the external registry
 * and its independently trusted pinned SHA-256 change. Neither registry bytes,
 * pinned hash nor profile selection may originate in pc-job Issue JSON.
 */
export function inspectApprovedRuntimeRegistry({dataRoot,queryTask,manifestBytes,
 approvedManifestSha256}={}){
 if(typeof approvedManifestSha256!=='string' || !/^[a-f0-9]{64}$/.test(approvedManifestSha256))
  fail('INVENTORY_APPROVAL_PIN_INVALID');
 if(!Buffer.isBuffer(manifestBytes) || manifestBytes.length<16 || manifestBytes.length>16384)
  fail('INVENTORY_MANIFEST_SIZE_INVALID');
 const manifestHash=sha(manifestBytes);
 if(manifestHash!==approvedManifestSha256)fail('INVENTORY_MANIFEST_APPROVAL_MISMATCH');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'));}
 catch{fail('INVENTORY_MANIFEST_INVALID_JSON');}
 plain(manifest,['schema','profiles'],'INVENTORY_MANIFEST_INVALID');
 if(manifest.schema!=='ZGMINI_APPROVED_RUNTIME_INVENTORY_PROFILES_V1' ||
    !Array.isArray(manifest.profiles) || manifest.profiles.length===0 ||
    manifest.profiles.length>8)fail('INVENTORY_MANIFEST_INVALID');
 const ids=new Set();
 for(const profile of manifest.profiles){
  profileSpec(profile); // Validate *all* selectors before any filesystem reads.
  if(ids.has(profile.id))fail('INVENTORY_DUPLICATE_PROFILE');
  ids.add(profile.id);
 }
 const profiles=manifest.profiles.map(profile=>
  inspectApprovedRuntimeInventory({dataRoot,profile,queryTask}));
 const result={status:'DONE',code:'APPROVED_RUNTIME_REGISTRY_READONLY',
  registrySha256:manifestHash,profileCount:profiles.length,profiles,
  operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false};
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>MAX_REPORT_BYTES)
  fail('INVENTORY_REPORT_OVERSIZED');
 return result;
}
