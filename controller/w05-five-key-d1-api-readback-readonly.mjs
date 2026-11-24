// W05 fixed A-grade five-key D1->public API readback.
// Reuses the already authenticated Writer D1 client and the approved source
// checkout. No arbitrary SQL, credentials in receipts, provider calls,
// D1/SQLite writes, Cloudflare deployment, or scheduler mutation.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {selectR6GitBinary} from './employment-r6-d1-readback-readonly.mjs';

export const W05_FIVE_OPERATION='w05-five-key-d1-api-readback-readonly';
export const W05_SOURCE_FILES=Object.freeze([
 'scripts/api-site/compare-five-public-readbacks-r1.mjs',
 'scripts/api-site/five-key-inplace-readback-prework-r12.mjs',
 'scripts/api-site/five-key-public-api-reader-r1.mjs',
 'worker/theme-paid-contract.mjs',
 'worker/public-display-freshness.mjs',
 'worker/employment-r6-public-display.mjs',
 'worker/inflation-causal-public-r1.mjs',
 'worker/inflation-causal-candidates-public-7-r1.mjs',
 'lib/market-score/employment-r6-formula.mjs',
 'lib/market-score/employment-r6-window.mjs',
 'lib/inflation-causal-public-catalog.mjs',
 'lib/inflation-causal-candidates-public-7-catalog.mjs',
]);
const D1_CLIENT_FILES=Object.freeze([
 'scripts/pc-writer/d1.mjs',
 'scripts/pc-writer/d1-transient.mjs',
 'scripts/pc-writer/d1-diagnostics.mjs',
]);
const SLOTS=Object.freeze(['inflation19','inflation7','calendar','theme','employment']);
const SHA40=/^[a-f0-9]{40}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATUS=/^[A-Z][A-Z0-9_]{2,90}$/;
const SHA256=/^[a-f0-9]{64}$/;
const defaultResult=(code,status='STATE_UNKNOWN')=>({
 status,code,keysChecked:0,results:[],liveD1ApiCompared:false,
 sourceCheckoutVerified:false,ownerAuthorizationVerified:false,
 deploymentIdentityVerified:false,runtimeVerified:false,
 providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false
});
const fail=code=>{throw Object.assign(new Error(code),{code});};
const safeTime=t=>typeof t==='string'&&Number.isFinite(Date.parse(t))&&
 new Date(t).toISOString()===t;
const safeRow=r=>{
 const out={slot:r.slot,status:r.status};
 if(SHA256.test(r.d1BodySha256??''))out.d1BodySha256=r.d1BodySha256;
 if(Number.isSafeInteger(r.d1StoredAt)&&r.d1StoredAt>0)out.d1StoredAt=r.d1StoredAt;
 for(const key of ['d1ReadAt','apiObservedAt'])if(safeTime(r[key]))out[key]=r[key];
 if(Number.isInteger(r.httpStatus)&&r.httpStatus>=100&&r.httpStatus<=599)
  out.httpStatus=r.httpStatus;
 if(r.slot==='theme')out.rollingAndSidecarsVerified=false;
 return out;
};

// Converts the protected process's already redacted readback into a minimal
// pc-job result. Even 5/5 structural matches do not prove active Deployment
// identity, source availability vintage, or historical point-in-time lineage.
export function summarizeW05FiveKeyEvidence(receipt,{sourceSha=null}={}){
 const rows=receipt?.results;
 if(receipt?.schema!=='ZGMINI_W05_FIVE_KEY_INPLACE_PREWORK_R12'||
    !Array.isArray(rows)||rows.length!==5||receipt.keysChecked!==5||
    rows.some((r,i)=>r?.slot!==SLOTS[i]||!STATUS.test(r.status??'')))
  return defaultResult('W05_READBACK_RECEIPT_INVALID');
 const results=rows.map(safeRow);
 const allStructural=results.every(r=>r.status==='STRUCTURAL_MATCH_NOT_RUNTIME_PROOF');
 return {...defaultResult(allStructural?
  'W05_FIVE_KEY_STRUCTURAL_ONLY_DEPLOYMENT_UNVERIFIED':
  'W05_FIVE_KEY_COMPARISON_PARTIAL_OR_UNVERIFIED','PARTIAL'),
  keysChecked:5,results,liveD1ApiCompared:true,
  sourceCheckoutVerified:SHA40.test(sourceSha??''),
  sourceSha:SHA40.test(sourceSha??'')?sourceSha:null,
  structuralMatches:results.filter(r=>r.status==='STRUCTURAL_MATCH_NOT_RUNTIME_PROOF').length,
  // The A-grade registration does not attest Cloudflare active Deployment.
  ownerAuthorizationVerified:false,deploymentIdentityVerified:false,
  runtimeVerified:false};
}

export async function compareW05FiveKeyWithApprovedReaders({
 queryFixed,readApi,createAdapter,collect,sourceSha=null,clock=Date.now}={}){
 if(![queryFixed,readApi,createAdapter,collect,clock].every(f=>typeof f==='function'))
  return defaultResult('W05_APPROVED_READERS_NOT_AVAILABLE');
 try{
  const db=createAdapter(queryFixed);
  const receipt=await collect({db,readApi,clock});
  return summarizeW05FiveKeyEvidence(receipt,{sourceSha});
 }catch{return defaultResult('W05_READBACK_EXECUTION_UNVERIFIED');}
}
const configSafe=c=>SHA40.test(c?.source??'')&&
 /^[0-9a-f]{32}$/.test(c?.account??'')&&UUID.test(c?.core??'');

// Reuse the same fixed, already installed Writer checkout and git integrity
// checks as the separate W01/W04 A-grade D1 readbacks.
function approvedCheckout(dataRoot,config,fileSystem){
 const fixed=path.resolve(dataRoot,'..','projects','zgmini-earnings-history-pc-release');
 let root;
 try{
  root=(fileSystem.realpathSync.native??fileSystem.realpathSync)(fixed);
  if(!fileSystem.statSync(root).isDirectory())fail('W05_SOURCE_CHECKOUT_UNVERIFIED');
 }catch{fail('W05_SOURCE_CHECKOUT_UNVERIFIED');}
 const gitBinary=selectR6GitBinary({exists:fileSystem.existsSync});
 if(!gitBinary)fail('W05_GIT_UNAVAILABLE');
 const git=args=>execFileSync(gitBinary,
  ['--no-optional-locks','-c','core.fsmonitor=false',
   '-c','core.untrackedCache=false','-C',root,...args],{
    encoding:'utf8',timeout:10000,maxBuffer:65536,windowsHide:true,
    env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
    stdio:['ignore','pipe','ignore']
  }).trim();
 let head;
 try{head=git(['rev-parse','HEAD']);}catch{fail('W05_SOURCE_HEAD_UNVERIFIED');}
 if(head!==config.source)fail('W05_APPROVED_SOURCE_SHA_MISMATCH');
 for(const p of [...D1_CLIENT_FILES,...W05_SOURCE_FILES]){
  try{
   git(['ls-files','--error-unmatch','--',p]);
   git(['diff','--quiet','HEAD','--',p]);
   const relative=p.split('/'),file=path.join(root,...relative);
   const stat=fileSystem.lstatSync(file);
   if(!stat.isFile()||stat.isSymbolicLink())fail('W05_SOURCE_FILE_UNVERIFIED');
   const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(file);
   const subpath=path.relative(root,real);
   if(!subpath||subpath==='..'||subpath.startsWith('..'+path.sep)||
      path.isAbsolute(subpath))fail('W05_SOURCE_FILE_UNVERIFIED');
  }catch{fail('W05_SOURCE_FILE_UNVERIFIED');}
 }
 return root;
}

export async function inspectW05FiveKeyD1ApiReadback(dataRoot,{
 fileSystem=fs,sourceLoader=null,clientLoader=null,clock=Date.now
}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return defaultResult('W05_DATA_ROOT_INVALID');
 const read=readFixedReadonlyBytes(path.join(dataRoot,'pc-writer','config.json'),
  {fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131072});
 if(!read.ok)return defaultResult('W05_WRITER_CONFIG_NOT_AVAILABLE');
 let config;
 try{config=JSON.parse(read.bytes.toString('utf8'));}
 catch{return defaultResult('W05_WRITER_CONFIG_INVALID');}
 if(!configSafe(config))return defaultResult('W05_WRITER_CONFIG_UNAPPROVED');
 let root;
 try{root=approvedCheckout(dataRoot,config,fileSystem);}
 catch(e){return defaultResult(STATUS.test(e?.code??'')?e.code:
  'W05_SOURCE_INTEGRITY_UNVERIFIED');}
 let modules;
 try{
  modules=sourceLoader?await sourceLoader(root):{
   ...(await import(pathToFileURL(path.join(root,'scripts','api-site',
    'five-key-inplace-readback-prework-r12.mjs')).href)),
   ...(await import(pathToFileURL(path.join(root,'scripts','api-site',
    'five-key-public-api-reader-r1.mjs')).href))
  };
 }catch{return defaultResult('W05_COMPARATOR_MODULE_IMPORT_FAILED');}
 const {createW05ReadonlyD1Adapter,collectFiveKeyInPlace,
  readW05PublicApi}=modules;
 if(![createW05ReadonlyD1Adapter,collectFiveKeyInPlace,
       readW05PublicApi].every(x=>typeof x==='function'))
  return defaultResult('W05_COMPARATOR_EXPORT_UNVERIFIED');
 let queryFixed;
 try{
  if(clientLoader)queryFixed=await clientLoader({root,config});
  else{
   const {client,credential}=await import(pathToFileURL(
    path.join(root,'scripts','pc-writer','d1.mjs')).href);
   const remote=client(config,()=>credential(root));
   queryFixed=async(sql,params)=>
    (await remote.query(config.core,sql,params)).results?.[0]??null;
  }
 }catch{return defaultResult('W05_APPROVED_D1_CLIENT_UNVERIFIED');}
 return compareW05FiveKeyWithApprovedReaders({
  queryFixed,readApi:readW05PublicApi,
  createAdapter:createW05ReadonlyD1Adapter,collect:collectFiveKeyInPlace,
  sourceSha:config.source,clock});
}
