import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {TextDecoder} from 'node:util';

export const R54_RUNTIME_TASK='ZGMINI-PC-Theme-Nine-R54-Public';
export const R54_RUNTIME_ACTION='E:\\ZGmini\\data\\pc-writer\\theme-nine-r54\\scripts\\pc-writer\\THEME_NINE_R54_PUBLIC_CYCLE.cmd';
export const R54_RUNTIME_ACTION_SHA256='0dea186a956dbc1471a4063e8c64dd5a230549477860e699bbb450a06d4360f4';
const R54_DATA_ROOT='E:/ZGmini/data';
const R54_ACTION_PARTS=Object.freeze(['pc-writer','theme-nine-r54','scripts','pc-writer','THEME_NINE_R54_PUBLIC_CYCLE.cmd']);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const base=()=>({schema:'ZGMINI_R54_RUNTIME_BINDING_READONLY_V1',scope:'FIXED_R54_TASK_AND_ACTION_ONLY',
 taskName:R54_RUNTIME_TASK,taskXmlSha256:null,enabled:null,actionSha256:null,
 taskActionMatches:false,actionBytesMatch:false,bindingVerified:false,workingDirectoryObserved:false,
 workingDirectoryStatus:'NOT_PRESENT',lastRun:'UNKNOWN',lastResult:'UNKNOWN',
 cycleEvidence:'UNVERIFIED_PATH',providerCalls:0,d1Writes:0,operationalWrites:0});
const fail=(out,code,status='BLOCKED')=>({...out,status,code});

function decodeXml(raw){
 if(!Buffer.isBuffer(raw)||raw.length===0||raw.length>=65536)throw Error('R54_TASK_XML_BYTES_INVALID');
 let src;
 try{
  if(raw[0]===0xfe&&raw[1]===0xff)throw Error('UNSUPPORTED');
  const utf16=raw[0]===0xff&&raw[1]===0xfe;
  if(utf16&&raw.length%2)throw Error('TRUNCATED');
  src=new TextDecoder(utf16?'utf-16le':'utf-8',{fatal:true}).decode(utf16?raw.subarray(2):raw).replace(/^\uFEFF/,'');
 }catch{throw Error('R54_TASK_XML_ENCODING_UNKNOWN');}
 if(src.includes('\u0000')||/<!DOCTYPE|<!ENTITY/i.test(src))throw Error('R54_TASK_XML_SHAPE_INVALID');
 return src;
}

function inspectXml(raw){
 const src=decodeXml(raw);
 const settings=[...src.matchAll(/<Settings(?:\s[^>]*)?>([\s\S]*?)<\/Settings>/gi)];
 const actions=[...src.matchAll(/<Actions(?:\s[^>]*)?>([\s\S]*?)<\/Actions>/gi)];
 if(settings.length!==1||actions.length!==1)throw Error('R54_TASK_XML_SHAPE_INVALID');
 const enabled=[...settings[0][1].matchAll(/<Enabled>\s*(true|false)\s*<\/Enabled>/gi)];
 const execs=[...actions[0][1].matchAll(/<Exec(?:\s[^>]*)?>([\s\S]*?)<\/Exec>/gi)];
 if(enabled.length!==1||execs.length!==1||actions[0][1].replace(execs[0][0],'').trim())throw Error('R54_TASK_XML_ACTION_INVALID');
 const body=execs[0][1];
 const commands=[...body.matchAll(/<Command>([^<]+)<\/Command>/gi)];
 const workingDirectories=[...body.matchAll(/<WorkingDirectory>([^<]*)<\/WorkingDirectory>/gi)];
 const remainder=commands.length===1?body.replace(commands[0][0],''):'INVALID_COMMAND';
 const otherTags=workingDirectories.length===1?remainder.replace(workingDirectories[0][0],''):remainder;
 if(commands.length!==1||workingDirectories.length>1||/<Arguments\b/i.test(body)
   ||otherTags.trim())
  throw Error('R54_TASK_XML_ACTION_INVALID');
 const command=commands[0][1].trim();
 const normalize=x=>x.replace(/\//g,'\\').toLowerCase();
 if(command.includes('&')||normalize(command)!==normalize(R54_RUNTIME_ACTION))throw Error('R54_TASK_ACTION_CHANGED');
 return {enabled:enabled[0][1].toLowerCase()==='true',taskXmlSha256:sha256(raw),
  workingDirectoryObserved:workingDirectories.length===1};
}

function within(root,resolved){
 const rel=path.relative(root,resolved);
 return rel===''||(rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel));
}

/** Exact installed action, with segment reparse and during-read checks.
 * `root`/`fsOps` overrides are isolated test ports, never PC job inputs. */
export function readR54PinnedActionBytes({root=R54_DATA_ROOT,fsOps=fs}={}){
 if(typeof root!=='string'||!path.isAbsolute(root))throw Error('R54_ACTION_ROOT_UNAVAILABLE');
 const rootStat=fsOps.lstatSync(root);
 if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw Error('R54_ACTION_ROOT_UNAVAILABLE');
 const real=x=>fsOps.realpathSync.native?fsOps.realpathSync.native(x):fsOps.realpathSync(x);
 const canonical=real(root);
 let current=root;
 for(let i=0;i<R54_ACTION_PARTS.length;i++){
  current=path.join(current,R54_ACTION_PARTS[i]);
  const before=fsOps.lstatSync(current),last=i===R54_ACTION_PARTS.length-1;
  if(before.isSymbolicLink()||(last?!before.isFile():!before.isDirectory())
    ||!within(canonical,real(current)))throw Error('R54_ACTION_PATH_UNSAFE');
  if(last){
   if(before.size<1||before.size>1048576)throw Error('R54_ACTION_SIZE_INVALID');
   const bytes=fsOps.readFileSync(current),after=fsOps.lstatSync(current);
   if(!after.isFile()||after.isSymbolicLink()||after.size!==before.size
     ||after.mtimeMs!==before.mtimeMs||bytes.length!==before.size
     ||!within(canonical,real(current)))throw Error('R54_ACTION_CHANGED_DURING_READ');
   return bytes;
  }
 }
 throw Error('R54_ACTION_FILE_UNAVAILABLE');
}

/** A/light observation only: no scheduler mutation, no source update, no raw XML output.
 * Injectable ports are only for isolated tests, never request-controlled. */
export function inspectR54RuntimeBinding({queryTask,hashAction=sha256,
 readActionBytes=()=>readR54PinnedActionBytes()}={}){
 const out=base();
 if(typeof queryTask!=='function')return fail(out,'R54_TASK_QUERY_UNAVAILABLE');
 let raw;
 try{raw=queryTask(R54_RUNTIME_TASK);}catch(error){
  const msg=String(error?.stderr??'');
  const missing=/cannot find the file|does not exist|지정.*(?:파일|작업).*찾을 수 없/i.test(msg);
  return fail(out,missing?'R54_TASK_NOT_FOUND':'R54_TASK_QUERY_UNAVAILABLE');
 }
 let observed;
 try{observed=inspectXml(raw);}catch(error){
  return fail({...out,taskXmlSha256:Buffer.isBuffer(raw)&&raw.length<65536?sha256(raw):null},
   /^R54_/.test(error?.message)?error.message:'R54_TASK_XML_UNVERIFIED');
 }
 out.taskXmlSha256=observed.taskXmlSha256;
 out.enabled=observed.enabled;
 out.taskActionMatches=true;
 out.workingDirectoryObserved=observed.workingDirectoryObserved;
 if(observed.workingDirectoryObserved)out.workingDirectoryStatus='OBSERVED_UNVERIFIED';
 let actionBytes;
 try{actionBytes=readActionBytes();}catch{return fail(out,'R54_ACTION_FILE_UNAVAILABLE');}
 if(!Buffer.isBuffer(actionBytes)||actionBytes.length<1||actionBytes.length>1048576)return fail(out,'R54_ACTION_FILE_INVALID');
 out.actionSha256=hashAction(actionBytes);
 out.actionBytesMatch=out.actionSha256===R54_RUNTIME_ACTION_SHA256;
 if(!out.actionBytesMatch)return fail(out,'R54_ACTION_SOURCE_DRIFT','FAIL');
 if(!out.enabled)return fail(out,'R54_TASK_DISABLED','FAIL');
 if(out.workingDirectoryObserved)return {...out,status:'PASS',code:'R54_TASK_ACTION_OBSERVED_WORKDIR_UNVERIFIED'};
 return {...out,status:'PASS',code:'R54_TASK_BINDING_VERIFIED',bindingVerified:true};
}
