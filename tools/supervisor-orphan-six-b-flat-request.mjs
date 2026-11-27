// Common source-only strict parser for orphan-six B Issue body. No OS/IO.
const FIELDS=['schema','requestId','chatId','operation','controlRepository',
 'targetControllerSha','approvalManifestSha256'];
const ws=ch=>ch===' '||ch==='\n'||ch==='\r'||ch==='\t';

// The existing maintainer's request shape is a flat seven-field JSON object.
// Tokenize raw bytes, not JSON.parse alone: duplicate keys must never survive
// the last-key-wins JSON parser behavior.
export function parseOrphanSixBFlatRequest(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>16384)throw Error('ORPHAN_SIX_B_RAW_REQUEST_DENIED');
 let i=0;
 const skip=()=>{while(i<raw.length&&ws(raw[i]))i++;};
 const value=()=>{
  skip();
  if(raw[i]!=='"')throw Error('ORPHAN_SIX_B_RAW_REQUEST_DENIED');
  const start=i++;
  let escape=false;
  for(;i<raw.length;i++){
   const ch=raw[i];
   if(escape){escape=false;continue;}
   if(ch==='\\'){escape=true;continue;}
   if(ch==='"'){i++;const token=raw.slice(start,i);return JSON.parse(token);}
  }
  throw Error('ORPHAN_SIX_B_RAW_REQUEST_DENIED');
 };
 skip();
 if(raw[i++]!=='{')throw Error('ORPHAN_SIX_B_RAW_REQUEST_DENIED');
 const out=Object.create(null);
 skip();
 if(raw[i]==='}')throw Error('ORPHAN_SIX_B_RAW_REQUEST_DENIED');
 while(i<raw.length){
  const key=value();
  if(!FIELDS.includes(key)||Object.hasOwn(out,key))
   throw Error('ORPHAN_SIX_B_RAW_REQUEST_DENIED');
  skip();
  if(raw[i++]!==':')throw Error('ORPHAN_SIX_B_RAW_REQUEST_DENIED');
  out[key]=value();
  skip();
  if(raw[i]==='}'){i++;break;}
  if(raw[i++]!==',')throw Error('ORPHAN_SIX_B_RAW_REQUEST_DENIED');
 }
 skip();
 if(i!==raw.length||Object.keys(out).length!==FIELDS.length||
    FIELDS.some(x=>typeof out[x]!=='string'))
  throw Error('ORPHAN_SIX_B_RAW_REQUEST_DENIED');
 return Object.freeze(Object.assign({},out));
}

