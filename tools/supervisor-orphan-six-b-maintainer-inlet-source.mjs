// Source-only candidate adapter for a future independently approved B maintainer.
// No installed receiver route, CLI, GitHub calls, filesystem, lease, Windows
// signal, or change to the nine pinned maintenance files is made here.
// All callbacks are read-only. A CANDIDATE_ONLY result grants NO OS authority.
import {ORPHAN_SIX_B_TITLE,validateOrphanSixBRequest}
 from './supervisor-orphan-six-b-admission.mjs';
import {receiveOrphanSixBApprovalSource}
 from './supervisor-orphan-six-b-receiver-source.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const LABEL='pc-maintenance';
const FIELDS=['schema','requestId','chatId','operation','controlRepository',
 'targetControllerSha','approvalManifestSha256'];
const reject=code=>Object.freeze({
 status:'BLOCKED',code,executionStarted:false,
 approvalSourceVerified:false,effectAuthorized:false,
 runnerStopAuthorized:false,operationalWrites:0,automaticRetries:0
});
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

export async function inspectOrphanSixBMaintainerInletSource({
 issue,attestCurrentMaintainerSource,readOriginalOneUseClaim,
 getMainManifest,getPullRequest,getOwnerEffectComments,getInstalledReadback
}={}){
 // A future trusted installed maintainer still owns every OS/write boundary.
 if(issue?.title!==ORPHAN_SIX_B_TITLE||
    (issue.state!=='OPEN'&&issue.state!=='open')||
    !Number.isSafeInteger(issue.number)||issue.number<1||
    issue.author?.login!==OWNER||
    !Array.isArray(issue.labels)||!issue.labels.some(x=>x?.name===LABEL))
  return reject('ORPHAN_SIX_B_UNTRUSTED_ISSUE');
 try{
  const parsed=parseOrphanSixBFlatRequest(issue.body);
  validateOrphanSixBRequest(parsed,{actor:OWNER,repo:REPO});
 }catch{return reject('ORPHAN_SIX_B_RAW_REQUEST_INVALID');}
 if([attestCurrentMaintainerSource,readOriginalOneUseClaim,
    getMainManifest,getPullRequest,getOwnerEffectComments,
    getInstalledReadback].some(x=>typeof x!=='function'))
  return reject('ORPHAN_SIX_B_SOURCE_READ_PORTS_MISSING');
 try{
  // A source-only test may inject this attestation, but the adapter neither
  // creates evidence nor permits an install/signal. Real source must be
  // attested by the installed independent B maintainer before use.
  const installed=await attestCurrentMaintainerSource();
  if(installed?.origin!=='PRIVATE_INDEPENDENT_B_MAINTAINER'||
     installed.verifiedNinePinnedMaintainerFiles!==true||
     installed.currentMaintainerSourceUnchangedVerified!==true)
   return reject('ORPHAN_SIX_B_MAINTAINER_SOURCE_UNVERIFIED');
  const result=await receiveOrphanSixBApprovalSource({issue,
   readOriginalOneUseClaim,getMainManifest,getPullRequest,
   getOwnerEffectComments,getInstalledReadback});
  // Even a verified source candidate MUST remain non-executable.
  if(result?.status!=='CANDIDATE_ONLY')return reject(result?.code??'ORPHAN_SIX_B_SOURCE_BLOCKED');
  return Object.freeze({...reject(result.code),status:'CANDIDATE_ONLY',
   approvalSourceVerified:true,requestId:result.requestId,
   manifestRawSha256:result.manifestRawSha256,
   nextAction:'SEPARATE_INSTALLED_B_PRIVATE_CAS_AND_EFFECT_APPROVAL_REQUIRED'});
 }catch{return reject('ORPHAN_SIX_B_SOURCE_READBACK_UNKNOWN');}
}
