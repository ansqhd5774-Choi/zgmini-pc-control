// Pure byte-preserving provider flag rewrite; unrelated bytes never leave PC.
import {FLAGS,CANDIDATE_FLAGS,sha256} from './contract.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const escaped=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function splitLines(s){return s.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter(Boolean)??[];}
export function changeProviderFlags(raw,keys=FLAGS){
  need(keys===FLAGS||keys===CANDIDATE_FLAGS,
    'PROVIDER_B_PROFILE_KEYS_STOP');
  const names=keys.map(escaped).join('|');
  const recognizer=new RegExp(`^[ \\t]*(?:export[ \\t]+)?(${names})[ \\t]*=`,'i');
  const assign=new RegExp(`^([ \\t]*(${names})[ \\t]*=[ \\t]*)(?:["']?(?:0|1|true|false)["']?|)([ \\t]*(?:\\#[^\\r\\n]*)?)$`,'i');
  need(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=262144,
    'PROVIDER_B_FILE_SIZE_STOP');
  const original=raw.toString('utf8');
  need(Buffer.from(original,'utf8').equals(raw)&&!original.includes('\0'),
    'PROVIDER_B_ENCODING_STOP');
  const hasBom=original.charCodeAt(0)===0xfeff;
  const unmarked=hasBom?original.slice(1):original;
  const lines=splitLines(unmarked);
  need(lines.length<=8000,'PROVIDER_B_LINE_LIMIT_STOP');
  const found=new Set();
  const out=[];
  let touched=0;
  for(const line of lines){
    const eol=line.endsWith('\r\n')?'\r\n':line.endsWith('\n')?'\n':line.endsWith('\r')?'\r':'';
    const content=eol?line.slice(0,-eol.length):line;
    const marker=recognizer.exec(content);
    if(!marker){out.push(line);continue;}
    const key=marker[1];
    need(keys.includes(key),'PROVIDER_B_NONCANONICAL_FLAG_STOP');
    need(!found.has(key),'PROVIDER_B_DUPLICATE_FLAG_STOP');found.add(key);
    const match=assign.exec(content);
    need(match&&match[2]===key,'PROVIDER_B_AMBIGUOUS_ASSIGNMENT_STOP');
    const replaced=match[1]+'1'+match[3]+eol;
    out.push(replaced);
    if(replaced!==line)touched++;
  }
  const eol=unmarked.includes('\r\n')?'\r\n':unmarked.includes('\n')?'\n':unmarked.includes('\r')?'\r':'\r\n';
  for(const key of keys){
    if(found.has(key))continue;
    if(out.length>0&&!/[\r\n]$/.test(out[out.length-1]))out.push(eol);
    out.push(`${key}=1${eol}`);touched++;
  }
  const candidate=Buffer.from((hasBom?'\uFEFF':'')+out.join(''),'utf8');
  need(candidate.length<=262144,'PROVIDER_B_RESULT_SIZE_STOP');
  // Idempotent second pass and exact allowlist equality are indispensable.
  const text=candidate.toString('utf8');
  for(const key of keys){
    const count=splitLines(text).filter(line=>
      new RegExp(`^[ \\t]*${escaped(key)}[ \\t]*=[ \\t]*1(?:[ \\t]*(?:\\#[^\\r\\n]*)?)?(?:\\r?\\n|\\r)?$`).test(line)).length;
    need(count===1,'PROVIDER_B_POSTCHECK_STOP');
  }
  return {bytes:candidate,changed:touched>0,changedKeys:[...keys],
    beforeSha256:sha256(raw),afterSha256:sha256(candidate)};
}
