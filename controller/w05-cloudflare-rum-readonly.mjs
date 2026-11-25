// Fixed, approved read-only Cloudflare RUM query; no request-controlled query,
// account, URLs, time range, credentials, output of private raw payloads, or writes.
// Uses the installed Wrangler OAuth path and source integrity model of W05 GET.
// This NEW operation is not an installation or evidence of Account Analytics: Read.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {selectR6GitBinary} from './employment-r6-d1-readback-readonly.mjs';
import {buildRumQuery,parseRumGraphql,buildRumBrowserQuery,
 parseRumBrowserGraphql,RUM_HOST} from './cloudflare-rum-field-parser.mjs';

export const RUM_OPERATION='w05-cloudflare-rum-readonly';
const ACCOUNT=/^[a-f0-9]{32}$/;
const SHA40=/^[a-f0-9]{40}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const credentialFiles=['scripts/pc-writer/d1.mjs',
 'scripts/pc-writer/d1-transient.mjs','scripts/pc-writer/d1-diagnostics.mjs'];
const result=(code,phase)=>({status:'STATE_UNKNOWN',code,phase,host:RUM_HOST,
 source:'CLOUDFLARE_RUM_FIELD_GROUPS_PROVISIONAL',window:null,
 fieldP75ValuesPresent:false,siteGoodCertified:false,
 metricSampleSizesVerified:false,cruxEquivalent:false,mergeBlocking:false,
 observations:[],cloudflareApiCalls:0,providerCalls:0,d1Writes:0,
 operationalWrites:0,sqliteOpened:false});
const stop=code=>{throw Object.assign(Error(code),{code});};
const cleanCode=e=>/^CF_RUM_[A-Z0-9_]{3,80}$/.test(e?.code??'')?
 e.code:'CF_RUM_UNVERIFIED';
export function rumWindow({nowMs=Date.now()}={}){
 if(!Number.isFinite(nowMs)||nowMs<=0)stop('CF_RUM_CLOCK_INVALID');
 const endMs=Math.floor(nowMs/86400000)*86400000;
 if(endMs<=0)stop('CF_RUM_CLOCK_INVALID');
 return {startUtc:new Date(endMs-7*86400000).toISOString(),
  endUtc:new Date(endMs).toISOString()};
}
export async function queryCloudflareRum({account,token,fetchImpl=fetch,nowMs=Date.now()}={}){
 if(!ACCOUNT.test(account??'')||typeof token!=='string'||token.length<10)
  return result('CF_RUM_ACCOUNT_OR_AUTH_UNVERIFIED','AUTH');
 let window;
 try{window=rumWindow({nowMs});}
 catch(e){return result(cleanCode(e),'WINDOW');}
 let payload;try{payload=buildRumQuery({accountTag:account,...window});}
 catch(e){return result(cleanCode(e),'QUERY');}
 const base={...result('CF_RUM_UNVERIFIED','QUERY'),window,cloudflareApiCalls:1};
 let response;
 try{
  response=await fetchImpl(payload.endpoint,{
   method:'POST',redirect:'error',cache:'no-store',
   headers:{Authorization:'Bearer '+token,
    'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({query:payload.query,variables:payload.variables}),
   signal:AbortSignal.timeout(12000)
  });
 }catch{return {...base,code:'CF_RUM_TRANSPORT_UNVERIFIED',phase:'NETWORK'};}
 if([401,403].includes(response?.status))
  return {...base,code:'CF_RUM_ANALYTICS_PERMISSION_UNVERIFIED',phase:'AUTH'};
 if(response?.status!==200)
  return {...base,code:'CF_RUM_HTTP_UNVERIFIED',phase:'HTTP'};
 if(Number(response.headers?.get?.('content-length')??0)>131072)
  return {...base,code:'CF_RUM_RESPONSE_OVERSIZE',phase:'JSON'};
 let raw;
 try{raw=await response.text();}
 catch{return {...base,code:'CF_RUM_BODY_UNVERIFIED',phase:'JSON'};}
 if(raw.length>131072)return {...base,code:'CF_RUM_RESPONSE_OVERSIZE',phase:'JSON'};
 let parsed;
 try{parsed=parseRumGraphql(JSON.parse(raw),window);}
 catch(e){return {...base,code:cleanCode(e),phase:'VALIDATION'};}
 // A browser breakdown is requested only for the observed missing mobile
 // INP with a positive Web Vitals event group and reported INP total zero.
 // It cannot override the four original P75 values or certify field Good.
 const target=parsed.observations?.find(x=>
  x.route==='/economic-indicators/'&&x.device==='mobile');
 const inspect=target?.groupEventCount>0&&target.metrics?.inpMs?.p75===null&&
  target.metricReportedTotals?.inpMs===0;
 let browserEvidence='NOT_REQUESTED',cloudflareApiCalls=1;
 if(inspect){
  cloudflareApiCalls=2;
  browserEvidence={status:'UNVERIFIED',code:'CF_RUM_BROWSER_QUERY_UNVERIFIED'};
  try{
   const browser=buildRumBrowserQuery({accountTag:account,...window});
   const bresp=await fetchImpl(browser.endpoint,{
    method:'POST',redirect:'error',cache:'no-store',
    headers:{Authorization:'Bearer '+token,
     'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({query:browser.query,variables:browser.variables}),
    signal:AbortSignal.timeout(12000)
   });
   if(bresp?.status===200&&
      Number(bresp.headers?.get?.('content-length')??0)<=65536){
    const braw=await bresp.text();
    if(braw.length<=65536){
     const evidence=parseRumBrowserGraphql(JSON.parse(braw),window);
     const browserCount=evidence.groups.reduce((s,r)=>s+r.groupEventCount,0);
     browserEvidence={...evidence,
      countsMatchPrimaryGroup:browserCount===target.groupEventCount};
    }
   }
  }catch{
   // This optional diagnostic is independent of the authenticated P75 read.
   // Never expose a provider response, raw UA, credentials, or error details.
  }
 }
 const valuesPresent=parsed.fieldP75ValuesPresent===true;
 return {...base,...parsed,status:valuesPresent?'PASS':'STATE_UNKNOWN',
  phase:'DONE',cloudflareApiCalls,browserEvidence,providerCalls:0,d1Writes:0,
  operationalWrites:0,sqliteOpened:false,siteGoodCertified:false,
  metricSampleSizesVerified:false,cruxEquivalent:false,mergeBlocking:false};
}
function approvedCredentialRoot(dataRoot,c,fileSystem){
 const fixed=path.resolve(dataRoot,'..','projects',
  'zgmini-earnings-history-pc-release');
 let root;
 try{
  root=(fileSystem.realpathSync.native??fileSystem.realpathSync)(fixed);
  if(!fileSystem.statSync(root).isDirectory())stop('CF_RUM_SOURCE_UNVERIFIED');
 }catch{stop('CF_RUM_SOURCE_UNVERIFIED');}
 const git=selectR6GitBinary({exists:fileSystem.existsSync});
 if(!git)stop('CF_RUM_SOURCE_UNVERIFIED');
 const run=args=>execFileSync(git,['--no-optional-locks','-c',
  'core.fsmonitor=false','-c','core.untrackedCache=false','-C',root,...args],
  {encoding:'utf8',timeout:10000,maxBuffer:65536,windowsHide:true,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
   stdio:['ignore','pipe','ignore']}).trim();
 try{
  if(run(['rev-parse','HEAD'])!==c.source)stop('CF_RUM_SOURCE_UNVERIFIED');
  for(const item of credentialFiles){
   run(['ls-files','--error-unmatch','--',item]);
   run(['diff','--quiet','HEAD','--',item]);
   const f=path.join(root,...item.split('/'));
   const st=fileSystem.lstatSync(f);
   if(!st.isFile()||st.isSymbolicLink())stop('CF_RUM_SOURCE_UNVERIFIED');
   const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(f);
   if(!real.startsWith(root+path.sep))stop('CF_RUM_SOURCE_UNVERIFIED');
  }
 }catch{stop('CF_RUM_SOURCE_UNVERIFIED');}
 return root;
}
export async function inspectW05CloudflareRum(dataRoot,{
 fileSystem=fs,fetchImpl=fetch,credentialLoader=null,nowMs=Date.now()
}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return result('CF_RUM_DATA_ROOT_INVALID','CONFIG');
 const raw=readFixedReadonlyBytes(path.join(dataRoot,'pc-writer','config.json'),
  {fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131072});
 if(!raw.ok)return result('CF_RUM_CONFIG_MISSING','CONFIG');
 let c;try{c=JSON.parse(raw.bytes.toString('utf8'));}
 catch{return result('CF_RUM_CONFIG_INVALID','CONFIG');}
 if(!ACCOUNT.test(c?.account??'')||!SHA40.test(c?.source??'')||
  !UUID.test(c?.core??''))return result('CF_RUM_CONFIG_UNVERIFIED','CONFIG');
 let root;
 try{root=approvedCredentialRoot(dataRoot,c,fileSystem);}
 catch{return result('CF_RUM_SOURCE_UNVERIFIED','SOURCE');}
 let token;
 try{
  if(credentialLoader)token=await credentialLoader(root);
  else{
   const {credential}=await import(pathToFileURL(path.join(root,
    'scripts','pc-writer','d1.mjs')).href);
   token=credential(root,{apiToken:null});
  }
 }catch{return result('CF_RUM_EXISTING_OAUTH_UNVERIFIED','AUTH');}
 return queryCloudflareRum({account:c.account,token,fetchImpl,nowMs});
}
