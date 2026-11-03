// LOCAL PROTOTYPE ONLY: independent ER1 B-grade one-shot D1 publisher.
// Does not inspect/replace the recurring Core script, source HEAD, DB schema,
// providers, scheduling, or credential files. Not wired to a live Runner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const ER1_SHA='e2179295e456a3963e09d82ae282e4ba6848352c';
export const ER1_PUBLIC_KEY='market-calendar:earnings-er1-score-public';
export const READER_HEADER='ZGMINI-ER1-97';
export const READER_URL='https://zgmini.kr/api/earnings-calendar-display?start=2026-11-02&end=2026-11-02';
export const D1_FIRST_GATE='D1_FIRST_LEGACY_READER_GATE';
const LEGACY_FHS_HEADER='ZGMINI-FHS-R3';
const LEGACY_R43_HEADER='ZGMINI-R43-MARKET-IMPORTANCE';
export const ER1_B_V2_APPROVAL='ER1_PC_OPERATION_APPROVAL_V2';
export const ER1_V2_PRIVATE_FILES=Object.freeze([
 'tools/market-calendar-er1/ER1_B_INDEPENDENT_PUBLISHER_V2.mjs',
 'tools/market-calendar-er1/ER1_PC_OPERATION_V2_ONCE.mjs',
]);
export const ER1_V2_SOURCE_HASHES=Object.freeze({
 'lib/market-calendar-er1-earnings-score.mjs':'35247642b8c1c7d0efb12e35719fd981386e29da7b32c1138cde92873f916974',
 'lib/market-calendar-er1-public-display.mjs':'710d5fcc30b2506090c04310d4e3cbad12a936e1916eb7ac392c7ead84a0f008',
 'scripts/pc-writer/market-calendar-er1-saved-score.mjs':'7034185bfeb4237d26d52e7eaa5f65ae21f2b258bf322e8d12669f84aa27eed6',
 'scripts/pc-writer/d1.mjs':'267fb175386fa007bd74b255d922fba9ee6fe71ffe953f94970beb8ba9d9ff87',
 'scripts/pc-writer/d1-transient.mjs':'f912c335675481f8646380feaebb6241ec0d877b78dbd6fa165e208fdc6d457e',
 'scripts/pc-writer/d1-diagnostics.mjs':'2e9ea54661c51d86798800e532edb10c6796694d3049844ef8b283b7ad6dfe5f',
});

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{throw Object.assign(Error(code),{code})};
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const strictObject=x=>x&&typeof x==='object'&&!Array.isArray(x);

/** The binder must be explicitly approved, never discovered by querying random D1s. */
export function bindingFingerprint(config){
 return hash(JSON.stringify([config.account,config.core,config.history]));
}

export function validateV2Approval(manifest){
 if(!strictObject(manifest)||manifest.schema!==ER1_B_V2_APPROVAL||
   manifest.status!=='APPROVED_B'||manifest.approvedScope!=='ER1_INDEPENDENT_SAVED_SCORE_AND_D1_ONE_SHOT'||
   manifest.candidateSourceSha!==ER1_SHA||
   !SHA40.test(manifest.pcConfigSourceSha)||!SHA64.test(manifest.pcBindingSha256)||
   !SHA40.test(manifest.legacyProductionSha)||
   manifest.legacyProductionRoute!=='zgmini.kr/api/earnings-calendar-display'||
   manifest.readerHeader!==READER_HEADER||manifest.probeUrl!==READER_URL||
   manifest.prePublishReaderGate!==D1_FIRST_GATE||
   manifest.publicKey!==ER1_PUBLIC_KEY||manifest.runCount!==1||
   manifest.allowCoreChanges!==false||manifest.allowProviderRequests!==false||
   manifest.allowSchemaChanges!==false||manifest.allowCredentialRefresh!==false||
   manifest.allowIndependentPublisherV2!==true||
   !strictObject(manifest.sourceSha256)||
   Object.keys(manifest.sourceSha256).length!==
     Object.keys(ER1_V2_SOURCE_HASHES).length+ER1_V2_PRIVATE_FILES.length||
   !Object.entries(ER1_V2_SOURCE_HASHES).every(([file,digest])=>manifest.sourceSha256[file]===digest)||
   !ER1_V2_PRIVATE_FILES.every(file=>SHA64.test(manifest.sourceSha256[file])))
  stop('ER1_B_V2_APPROVAL_OR_SOURCE_PIN_STOP');
 return manifest;
}

export function validateV2ConfigBinding(config,manifest){
 validateV2Approval(manifest);
 if(!strictObject(config)||config.source!==manifest.pcConfigSourceSha||
   config.collectionTarget!=='pc'||config.enabled!==true||
   !/^[0-9a-f]{32}$/.test(config.account)||
   !UUID.test(config.core)||!UUID.test(config.history)||
   bindingFingerprint(config)!==manifest.pcBindingSha256)
  stop('ER1_B_V2_PC_CONFIG_BINDING_STOP');
 return {account:config.account,core:config.core,history:config.history};
}

export function verifyV2SourceFiles(sourceRoot,manifest,{fileSystem=fs}={}){
 validateV2Approval(manifest);
 if(!path.isAbsolute(sourceRoot))stop('ER1_B_V2_SOURCE_ROOT_STOP');
 let trustedRoot;
 try{trustedRoot=fileSystem.realpathSync(sourceRoot)}catch{stop('ER1_B_V2_SOURCE_ROOT_STOP')}
 for(const [relative,digest] of Object.entries(ER1_V2_SOURCE_HASHES)){
  const file=path.join(sourceRoot,...relative.split('/'));
  let stat,real,bytes;
  try{stat=fileSystem.lstatSync(file);real=fileSystem.realpathSync(file);
   bytes=fileSystem.readFileSync(file)}catch{stop('ER1_B_V2_PINNED_FILE_MISSING_STOP')}
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>128_000||
   !real.startsWith(trustedRoot+path.sep)||hash(bytes)!==digest)
   stop('ER1_B_V2_PINNED_FILE_DRIFT_STOP');
 }
 return true;
}

const configFileJson=(file,maxBytes)=>{
 let s;try{s=fs.lstatSync(file)}catch{stop('ER1_B_V2_REQUIRED_FILE_MISSING_STOP')}
 if(!s.isFile()||s.isSymbolicLink()||s.size<16||s.size>maxBytes)
  stop('ER1_B_V2_REQUIRED_FILE_SHAPE_STOP');
 try{return JSON.parse(fs.readFileSync(file,'utf8'))}
 catch{stop('ER1_B_V2_REQUIRED_JSON_STOP')}
};

/** Uses only existing user Wrangler OAuth file; never returns credential bytes. */
export function inspectWranglerOAuth({
 file=path.join(os.homedir(),'AppData/Roaming/xdg.config/.wrangler/config/default.toml'),
 now=Date.now(),fileSystem=fs,minRemainingMs=600_000,
}={}){
 let s,raw;
 try{s=fileSystem.lstatSync(file);raw=fileSystem.readFileSync(file,'utf8')}
 catch{stop('ER1_B_V2_EXISTING_OAUTH_MISSING_STOP')}
 if(!s.isFile()||s.isSymbolicLink()||s.size<20||s.size>100_000)
  stop('ER1_B_V2_OAUTH_FILE_SHAPE_STOP');
 const expiry=Date.parse(raw.match(/expiration_time\s*=\s*"([^"]+)"/)?.[1]??'');
 const token=raw.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1]??'';
 if(!token||!Number.isFinite(expiry)||expiry-now<minRemainingMs)
  stop('ER1_B_V2_OAUTH_REFRESH_REQUIRED_STOP');
 return true;
}

/** D1-first: require the still-active legacy FHS/R43 Reader before any D1 write.
 * An absent ER1 header alone never passes this guard. The exact Cloudflare
 * deployment/route must also be attested outside this request before B approval.
 */
export async function verifyV2LegacyReader({fetchImpl=fetch}={}){
 let response;
 try{response=await fetchImpl(READER_URL,{method:'GET',redirect:'error',
  cache:'no-store',headers:{'cache-control':'no-cache'},
  signal:AbortSignal.timeout(12000)})}
 catch{stop('ER1_B_V2_READER_PROBE_UNAVAILABLE_STOP')}
 if(response.status!==200||
  response.headers?.get('x-zgmini-fhs-r3-reader')!==LEGACY_FHS_HEADER||
  response.headers?.get('x-zgmini-r43-reader')!==LEGACY_R43_HEADER||
  response.headers?.get('x-zgmini-earnings-grade-reader')!==null||
  !/^text\/html(?:;|$)/i.test(response.headers?.get('content-type')??''))
  stop('ER1_B_V2_LEGACY_READER_GATE_STOP');
 // A 200/HTML response with legacy headers can still be an empty calendar.
 // Do not mistake an empty row set for proof that existing stars render.
 const countRaw=response.headers?.get('x-display-count');
 const count=Number(countRaw);
 if(!/^[1-9][0-9]*$/.test(countRaw??'')||
    !Number.isSafeInteger(count)||count>5000)
  stop('ER1_B_V2_LEGACY_READER_EMPTY_STOP');
 let html;
 try{html=await response.text()}catch{stop('ER1_B_V2_READER_PROBE_UNAVAILABLE_STOP')}
 if(typeof html!=='string'||!html.includes('mc-importance')||!html.includes('★'))
  stop('ER1_B_V2_LEGACY_READER_EMPTY_STOP');
 return true;
}

/**
 * Restricted to one existing public D1 feed row. In production all dependency
 * injections are omitted; fixtures may inject remote and validator.
 * The calling global ledger must be reserved before this function can write.
 */
export async function publishIndependentER1Once({
 sourceRoot,pcHome,manifest,now=Date.now(),readerGate=verifyV2LegacyReader,
 remoteFactory,validatorFactory,credentialFile,sourceVerifier=verifyV2SourceFiles,
 oauthInspector=inspectWranglerOAuth,fsImpl=fs,
 globalLedgerReserved=false,
}={}){
 validateV2Approval(manifest);
 if(!globalLedgerReserved)stop('ER1_B_V2_GLOBAL_LEDGER_REQUIRED_STOP');
 if(typeof pcHome!=='string'||!path.isAbsolute(pcHome)||
   typeof sourceRoot!=='string'||!path.isAbsolute(sourceRoot)||
   !Number.isFinite(now)||now<=0)stop('ER1_B_V2_PATH_OR_TIME_STOP');
 sourceVerifier(sourceRoot,manifest);
 const config=configFileJson(path.join(pcHome,'config.json'),64_000);
 const binding=validateV2ConfigBinding(config,manifest);
 const derived=configFileJson(path.join(pcHome,'er1-input','er1-public-display.json'),1_750_000);
 const validation=validatorFactory?await validatorFactory():
  await import(pathToFileURL(path.join(sourceRoot,'lib','market-calendar-er1-public-display.mjs')).href);
 if(validation.ER1_EARNINGS_DISPLAY_PUBLIC_KEY!==ER1_PUBLIC_KEY||
   !validation.validateER1PublicDisplay(derived,{now}))
  stop('ER1_B_V2_INVALID_SAVED_DERIVED_STOP');
 const body=JSON.stringify(derived);
 if(Buffer.byteLength(body,'utf8')>1_750_000)
  stop('ER1_B_V2_PAYLOAD_SIZE_STOP');
 const digest=hash(body);
 oauthInspector({file:credentialFile,now});
 // Re-probe just before D1 access to reduce Reader deployment race exposure.
 if(await readerGate()!==true)stop('ER1_B_V2_LEGACY_READER_GATE_STOP');
 const lockPath=path.join(pcHome,'er1-input','er1-independent-publish.lock');
 let lock;
 try{lock=fsImpl.openSync(lockPath,'wx')}
 catch{stop('ER1_B_V2_LOCK_BUSY_STOP')}
 let writeStarted=false;
 try{
  const remote=remoteFactory?await remoteFactory({sourceRoot,binding}):
   await (async()=>{
    const {credential,client}=await import(pathToFileURL(path.join(sourceRoot,'scripts','pc-writer','d1.mjs')).href);
    const token=credential(sourceRoot,{apiToken:null,
     file:credentialFile??path.join(os.homedir(),'AppData/Roaming/xdg.config/.wrangler/config/default.toml'),
     refresh:()=>stop('ER1_B_V2_OAUTH_REFRESH_FORBIDDEN_STOP')});
    return client(binding,token);
   })();
  const lookup="SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key='current'";
  const old=(await remote.query(binding.core,lookup,[ER1_PUBLIC_KEY])).results?.[0]??null;
  if(old){
   if(old.body===body)return {status:'ER1_ALREADY_PUBLISHED',dbWrites:0,sha256:digest};
   stop('ER1_B_V2_EXISTING_DIFFERENT_BODY_STOP');
  }
  const at=Date.now();
  writeStarted=true;
  await remote.request(binding.core,[{sql:
   "INSERT INTO public_feed_snapshots_v1(kind,feed_key,snapshot_key,body,stored_at) VALUES('output',?,'current',?,?) ON CONFLICT(kind,feed_key,snapshot_key) DO NOTHING",
   params:[ER1_PUBLIC_KEY,body,at]}]);
  const seen=(await remote.query(binding.core,lookup,[ER1_PUBLIC_KEY])).results?.[0]??null;
  if(seen?.body!==body||seen?.stored_at!==at)
   stop('ER1_B_V2_D1_READBACK_UNKNOWN_STOP');
  return {status:'ER1_D1_PUBLISHED_AND_READBACK',dbWrites:1,sha256:digest};
 }catch(error){
  if(writeStarted)stop('ER1_B_V2_D1_OUTCOME_UNKNOWN_STOP');
  throw error;
 }finally{
  try{fsImpl.closeSync(lock)}catch{}
  // Only releases this exact one-shot lock; no generic cleanup.
  try{fsImpl.unlinkSync(lockPath)}catch{}
 }
}
