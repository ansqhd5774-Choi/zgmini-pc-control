// Pure, bounded JSON configuration patch for exactly two approved opt-in keys.
// This module is an isolated design prototype. It never opens a PC file.
import {createHash} from 'node:crypto';

export const OPT_IN_KEYS=Object.freeze([
  'employmentR6AutoCollection',
  'employmentR6OneYearAutoPublication',
]);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const whitespace=c=>c===' '||c==='\t'||c==='\r'||c==='\n';
const skipWs=(s,i)=>{while(i<s.length&&whitespace(s[i]))i++;return i;};

function readStringEnd(s,start){
  need(s[start]==='"','CONFIG_B_JSON_STRING_STOP');
  let esc=false;
  for(let i=start+1;i<s.length;i++){
    const c=s[i];
    if(esc){esc=false;continue;}
    if(c==='\\'){esc=true;continue;}
    if(c==='"')return i+1;
  }
  stop('CONFIG_B_JSON_STRING_STOP');
}

/** Parse *only* the top-level spans; nested values and escaped keys remain opaque. */
function topLevelEntries(source){
  let i=skipWs(source,0);
  need(source[i]==='{','CONFIG_B_JSON_ROOT_STOP');
  i=skipWs(source,i+1);
  const entries=[],seen=new Set();
  while(source[i]!=='}'){
    const keyStart=i;
    const keyEnd=readStringEnd(source,keyStart);
    let key;
    try{key=JSON.parse(source.slice(keyStart,keyEnd));}
    catch{stop('CONFIG_B_JSON_KEY_STOP');}
    need(typeof key==='string'&&!seen.has(key),'CONFIG_B_DUPLICATE_KEY_STOP');
    seen.add(key);
    i=skipWs(source,keyEnd);
    need(source[i]===':','CONFIG_B_JSON_COLON_STOP');
    const valueStart=skipWs(source,i+1);
    i=valueStart;
    let inString=false,escape=false,level=0;
    for(;i<source.length;i++){
      const c=source[i];
      if(inString){
        if(escape)escape=false;
        else if(c==='\\')escape=true;
        else if(c==='"')inString=false;
        continue;
      }
      if(c==='"'){inString=true;continue;}
      if(c==='{'||c==='['){level++;continue;}
      if(c==='}'||c===']'){
        if(level===0)break;
        level--;continue;
      }
      if(c===','&&level===0)break;
    }
    const valueEnd=i;
    need(valueEnd>valueStart,'CONFIG_B_JSON_VALUE_STOP');
    entries.push({key,keyStart,valueStart,valueEnd});
    i=skipWs(source,i);
    if(source[i]===','){
      i=skipWs(source,i+1);
      need(source[i]!=='}','CONFIG_B_JSON_TRAILING_COMMA_STOP');
    }else need(source[i]==='}','CONFIG_B_JSON_END_STOP');
  }
  i=skipWs(source,i+1);
  need(i===source.length,'CONFIG_B_JSON_TRAILING_BYTES_STOP');
  return entries;
}

function validateSource(raw){
  need(Buffer.isBuffer(raw)&&raw.length>=2&&raw.length<=131072,
    'CONFIG_B_FILE_SIZE_STOP');
  const source=raw.toString('utf8');
  need(Buffer.from(source,'utf8').equals(raw)&&!source.includes('\0')&&
    source.charCodeAt(0)!==0xfeff,'CONFIG_B_ENCODING_STOP');
  let parsed;
  try{parsed=JSON.parse(source);}
  catch{stop('CONFIG_B_JSON_PARSE_STOP');}
  need(parsed&&typeof parsed==='object'&&!Array.isArray(parsed),
    'CONFIG_B_JSON_ROOT_STOP');
  const entries=topLevelEntries(source);
  for(const key of OPT_IN_KEYS){
    if(Object.hasOwn(parsed,key))
      need(typeof parsed[key]==='boolean','CONFIG_B_OPTIN_TYPE_STOP');
  }
  return {source,parsed,entries};
}

/**
 * `raw` stays on the Windows host; only changed key names and SHA may be logged.
 * No field other than two opt-in booleans is semantically changed.
 */
export function changeEmploymentOptIns(raw){
  const {source,parsed,entries}=validateSource(raw);
  const missing=OPT_IN_KEYS.filter(key=>!Object.hasOwn(parsed,key));
  const spans=entries.filter(e=>OPT_IN_KEYS.includes(e.key)&&parsed[e.key]===false)
    .sort((a,b)=>b.valueStart-a.valueStart);
  let out=source;
  for(const e of spans)
    out=out.slice(0,e.valueStart)+'true'+out.slice(e.valueEnd);
  if(missing.length){
    const updated=topLevelEntries(out),last=updated.at(-1);
    const lineEnd=out.includes('\r\n')?'\r\n':'\n';
    const multiline=out.includes('\n');
    const indent=last&&multiline?
      (out.slice(out.lastIndexOf('\n',last.keyStart-1)+1,last.keyStart).match(/^[ \t]*/)?.[0]??'  '):'  ';
    const values=missing.map(k=>JSON.stringify(k)+': true');
    if(last){
      const appendix=multiline?', '+lineEnd+indent+values.join(','+lineEnd+indent):', '+values.join(', ');
      out=out.slice(0,last.valueEnd)+appendix+out.slice(last.valueEnd);
    }else{
      const open=out.indexOf('{')+1;
      const appendix=multiline?lineEnd+'  '+values.join(','+lineEnd+'  '):values.join(', ');
      out=out.slice(0,open)+appendix+out.slice(open);
    }
  }
  let after;
  try{after=JSON.parse(out);}
  catch{stop('CONFIG_B_PATCH_INVALID_JSON_STOP');}
  need(topLevelEntries(out).length===Object.keys(after).length,
    'CONFIG_B_POST_DUPLICATE_STOP');
  for(const key of OPT_IN_KEYS)
    need(after[key]===true,'CONFIG_B_OPTIN_POSTCHECK_STOP');
  const unrelatedBefore=structuredClone(parsed),unrelatedAfter=structuredClone(after);
  for(const key of OPT_IN_KEYS){delete unrelatedBefore[key];delete unrelatedAfter[key];}
  need(JSON.stringify(unrelatedBefore)===JSON.stringify(unrelatedAfter),
    'CONFIG_B_OTHER_SETTINGS_DRIFT_STOP');
  const bytes=Buffer.from(out,'utf8');
  need(bytes.length<=131072,'CONFIG_B_RESULT_SIZE_STOP');
  const changedKeys=OPT_IN_KEYS.filter(k=>parsed[k]!==true);
  return {bytes,changed:changedKeys.length>0,changedKeys,
    beforeSha256:sha256(raw),afterSha256:sha256(bytes)};
}
