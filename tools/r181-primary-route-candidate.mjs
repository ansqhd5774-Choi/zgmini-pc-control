// Correct R181 URL owner is r181-primary.mjs, pinned by actual Windows #1541.
// This helper never executes or exports the private PC code.
// W03 R181 PC-only source: stage a candidate in memory, never install it here.
// This module has no file-system, process, provider, DB, task, or network effects.
import {createHash} from 'node:crypto';

export const PINNED_R181_PRIMARY_SHA256='da433fe2febea455343b66424b2b6e9d6680575f21f2552fc0be8d3bd95aa5c9';
const OLD_ROUTE='/api/v1/bars/stocks/';
const CURRENT_ROUTE='/api/v1/bars/stocks/us/';
const MAX_BYTES=8192;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const denied=(code,sha256=null)=>({
 status:'STOP',code,observedPreimageSha256:sha256,
 candidateSha256:null,candidateBytesCount:null,
 operationalWrites:0,providerCalls:0,d1Writes:0,applied:false,
});
const count=(str,part)=>str.split(part).length-1;

// Confirm a path substring is a real JavaScript string/template literal.
// A matching URL inside a comment, regex literal or ordinary source text
// must never authorize a replacement.
function quotedAt(source,offset){
 let mode='CODE',quote=null,escaped=false;
 for(let i=0;i<offset;i++){
  const c=source[i],n=source[i+1];
  if(mode==='LINE'){if(c==='\n')mode='CODE';continue;}
  if(mode==='BLOCK'){
   if(c==='*'&&n==='/'){mode='CODE';i++;}
   continue;
  }
  if(mode==='STRING'){
   if(escaped){escaped=false;continue;}
   if(c==='\\'){escaped=true;continue;}
   if(c===quote){mode='CODE';quote=null;}
   continue;
  }
  if(c==='/'&&n==='/'){mode='LINE';i++;continue;}
  if(c==='/'&&n==='*'){mode='BLOCK';i++;continue;}
  if(c==='"'||c==="'"||c===String.fromCharCode(96)){
   mode='STRING';quote=c;
  }
 }
 return mode==='STRING';
}

// Reviewable pure primitive for isolated test fixtures. Runtime callers must
// use preparePinnedR181PrimaryRouteCandidate, not a caller-selected old SHA.
export function prepareR181PrimaryRouteCandidateForExactPreimage(bytes,expectedSha256){
 if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>MAX_BYTES)
  return denied('R181_PREIMAGE_UNSAFE_BYTES');
 if(typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedSha256))
  return denied('R181_EXPECTED_SHA_INVALID');
 const actual=hash(bytes);
 if(actual!==expectedSha256)return denied('R181_PREIMAGE_SHA_MISMATCH',actual);
 const source=bytes.toString('utf8');
 if(!Buffer.from(source,'utf8').equals(bytes))
  return denied('R181_PREIMAGE_NOT_UTF8',actual);
 if(source.includes(CURRENT_ROUTE))
  return denied('R181_CURRENT_ROUTE_ALREADY_PRESENT',actual);
 if(count(source,OLD_ROUTE)!==1)
  return denied('R181_LEGACY_ROUTE_NOT_UNIQUE',actual);
 const location=source.indexOf(OLD_ROUTE);
 if(!quotedAt(source,location))
  return denied('R181_ROUTE_NOT_IN_STRING_LITERAL',actual);
 if(!source.includes('getmarkethistory.com')||
    !/\bexport\s+function\b/.test(source)||!/\bSPY\b/.test(source))
  return denied('R181_SOURCE_CONTEXT_UNVERIFIED',actual);
 const changed=source.slice(0,location)+CURRENT_ROUTE+
  source.slice(location+OLD_ROUTE.length);
 const candidate=Buffer.from(changed,'utf8');
 if(candidate.length!==bytes.length+3||count(changed,CURRENT_ROUTE)!==1||
    count(changed,OLD_ROUTE)!==1||!changed.includes('getmarkethistory.com'))
  return denied('R181_CANDIDATE_INVARIANT_FAILED',actual);
 const result={
  status:'PREPARED_CANDIDATE_ONLY',
  code:'R181_SINGLE_STATIC_ROUTE_CANDIDATE',
  observedPreimageSha256:actual,candidateSha256:hash(candidate),
  candidateBytesCount:candidate.length,changedByteCount:3,
  operationalWrites:0,providerCalls:0,d1Writes:0,applied:false,
  requiresIndependentBApproval:true,requiresRuntimeHttpRetest:true,
 };
 // Never accidentally put PC-only source bytes into a JSON/TXT/Issue record.
 // The independent approved B apply owner must obtain and rehash this clone
 // locally, CAS-check the original, journal/backup, and then read back.
 Object.defineProperty(result,'getPrivateCandidateBytes',{
  enumerable:false,value:()=>Buffer.from(candidate),
 });
 return result;
}

export function preparePinnedR181PrimaryRouteCandidate(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length!==4328)
  return denied('R181_PRIMARY_PREIMAGE_SIZE_STOP');
 return prepareR181PrimaryRouteCandidateForExactPreimage(bytes,PINNED_R181_PRIMARY_SHA256);
}
