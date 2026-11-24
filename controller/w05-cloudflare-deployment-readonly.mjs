// W05 fixed active-Deployment observation, using the already approved PC OAuth.
// No request-controlled URL, shell, D1, provider call, deployment or credential output.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readFixedReadonlyBytes} from './fixed-readonly-bytes.mjs';
import {selectR6GitBinary} from './employment-r6-d1-readback-readonly.mjs';

export const CF_OPERATION='w05-cloudflare-deployment-readonly';
export const CF_WORKER='zgmini-migration-candidate-r5';
export const CF_DOMAIN='zgmini.kr';
export const CF_EXPECTED_VERSION='f115f82d-e0e5-4f31-9000-fbb9bbc467ae';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SHA40=/^[a-f0-9]{40}$/;
const ACCOUNT=/^[a-f0-9]{32}$/;
const files=['scripts/pc-writer/d1.mjs','scripts/pc-writer/d1-transient.mjs',
 'scripts/pc-writer/d1-diagnostics.mjs'];
const result=(code)=>({status:'STATE_UNKNOWN',code,worker:CF_WORKER,
 domain:CF_DOMAIN,activeDeploymentId:null,activeVersions:[],
 deploymentIdentityVerified:false,domainVerified:false,
 expectedBuildVersion:CF_EXPECTED_VERSION,expectedBuildVersionActive:false,
 sourceShaVerified:false,providerCalls:0,d1Writes:0,operationalWrites:0,
 sqliteOpened:false});
const stop=code=>{throw Object.assign(Error(code),{code});};
const validDeployment=d=>d&&UUID.test(d.id??'')&&d.strategy==='percentage'&&
 Array.isArray(d.versions)&&d.versions.length>0&&d.versions.length<=6&&
 d.versions.every(v=>UUID.test(v?.version_id??'')&&
  typeof v.percentage==='number'&&v.percentage>0&&v.percentage<=100)&&
 Math.abs(d.versions.reduce((s,v)=>s+v.percentage,0)-100)<0.0001;
export async function queryCloudflareActive({account,token,fetchImpl=fetch}={}){
 if(!ACCOUNT.test(account??'')||typeof token!=='string'||token.length<10)
  return result('CF_ACCOUNT_OR_OAUTH_UNVERIFIED');
 const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers';
 let phase='DEPLOYMENTS',active=null,activeVersions=[];
 const get=async suffix=>{
  let response,value;
  try{response=await fetchImpl(endpoint+suffix,{
   method:'GET',redirect:'error',cache:'no-store',
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   signal:AbortSignal.timeout(12000)
  });}catch{stop('CF_TRANSPORT_UNVERIFIED');}
  if(response?.status!==200)stop([401,403].includes(response?.status)?
   'CF_OAUTH_PERMISSION_UNVERIFIED':'CF_RESPONSE_HTTP_UNVERIFIED');
  try{value=await response.json();}catch{stop('CF_JSON_UNVERIFIED');}
  if(value?.success!==true||value.result===undefined||value.result===null)
   stop('CF_RESULT_UNVERIFIED');
  return value.result;
 };
 try{
  const body=await get('/scripts/'+CF_WORKER+'/deployments?per_page=5');
  const list=Array.isArray(body?.deployments)?body.deployments:
   Array.isArray(body)?body:null;
  if(!list?.length||!validDeployment(list[0]))
   stop('CF_ACTIVE_DEPLOYMENT_SHAPE_UNVERIFIED');
  active=list[0];
  phase='DEPLOYMENT_DETAIL';
  const detail=await get('/scripts/'+CF_WORKER+'/deployments/'+active.id);
  if(!validDeployment(detail)||detail.id!==active.id||
   JSON.stringify(detail.versions)!==JSON.stringify(active.versions))
   stop('CF_DEPLOYMENT_DETAIL_MISMATCH');
  phase='VERSION_DETAIL';
  for(const v of active.versions){
   const x=await get('/scripts/'+CF_WORKER+'/versions/'+v.version_id);
   if(x?.id!==v.version_id)stop('CF_VERSION_DETAIL_MISMATCH');
   activeVersions.push({versionId:v.version_id,percentage:v.percentage,
    number:Number.isSafeInteger(x.number)?x.number:null,
    createdOn:typeof x.metadata?.created_on==='string'?
     x.metadata.created_on:null});
  }
  phase='DOMAIN';
  const domains=await get('/domains');
  const rows=Array.isArray(domains)?domains:
   Array.isArray(domains?.domains)?domains.domains:null;
  if(!rows)stop('CF_DOMAIN_LIST_INVALID');
  const bound=rows.some(x=>x?.hostname===CF_DOMAIN&&
   x.service===CF_WORKER&&x.enabled===true);
  if(!bound)stop('CF_DOMAIN_BINDING_UNVERIFIED');
  return {...result('CF_ACTIVE_DEPLOYMENT_READONLY_VERIFIED'),status:'PASS',
   activeDeploymentId:active.id,activeVersions,
   deployedAt:typeof active.created_on==='string'?active.created_on:null,
   deploymentSource:typeof active.source==='string'?
     active.source.slice(0,32):null,
   expectedBuildVersionActive:activeVersions.some(v=>v.versionId===CF_EXPECTED_VERSION),
   deploymentIdentityVerified:true,domainVerified:true,
   observedAt:new Date().toISOString()};
 }catch(e){const code=/^CF_[A-Z0-9_]{3,90}$/.test(e?.code??'')?
   e.code:'CF_UNEXPECTED_UNVERIFIED';
  return {...result(code),phase,
   ...(active?{activeDeploymentId:active.id,activeVersions,
    deployedAt:typeof active.created_on==='string'?active.created_on:null}:{})};
 }
}
function approvedSource(dataRoot,config,fileSystem){
 const fixed=path.resolve(dataRoot,'..','projects',
  'zgmini-earnings-history-pc-release');
 let root;try{
  root=(fileSystem.realpathSync.native??fileSystem.realpathSync)(fixed);
  if(!fileSystem.statSync(root).isDirectory())stop('CF_SOURCE_DIRECTORY_INVALID');
 }catch{stop('CF_SOURCE_DIRECTORY_INVALID');}
 const git=selectR6GitBinary({exists:fileSystem.existsSync});
 if(!git)stop('CF_GIT_UNAVAILABLE');
 const run=args=>execFileSync(git,['--no-optional-locks','-c',
  'core.fsmonitor=false','-c','core.untrackedCache=false','-C',root,...args],
 {encoding:'utf8',timeout:10000,maxBuffer:65536,windowsHide:true,
  env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
  stdio:['ignore','pipe','ignore']}).trim();
 try{
  if(run(['rev-parse','HEAD'])!==config.source)
   stop('CF_SOURCE_HEAD_MISMATCH');
  for(const item of files){
   run(['ls-files','--error-unmatch','--',item]);
   run(['diff','--quiet','HEAD','--',item]);
   const f=path.join(root,...item.split('/'));
   const st=fileSystem.lstatSync(f);
   if(!st.isFile()||st.isSymbolicLink())stop('CF_SOURCE_FILE_UNVERIFIED');
   const real=(fileSystem.realpathSync.native??fileSystem.realpathSync)(f);
   if(!real.startsWith(root+path.sep))stop('CF_SOURCE_FILE_UNVERIFIED');
  }
 }catch(e){stop(/^CF_/.test(e?.code??'')?e.code:
   'CF_SOURCE_INTEGRITY_UNVERIFIED');}
 return root;
}
export async function inspectW05CloudflareActive(dataRoot,{
 fileSystem=fs,fetchImpl=fetch,credentialLoader=null
}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  return result('CF_DATA_ROOT_INVALID');
 const raw=readFixedReadonlyBytes(path.join(dataRoot,'pc-writer',
  'config.json'),{fileSystem,verifiedRoot:dataRoot,minBytes:2,maxBytes:131072});
 if(!raw.ok)return result('CF_CONFIG_MISSING');
 let c;try{c=JSON.parse(raw.bytes.toString('utf8'));}
 catch{return result('CF_CONFIG_INVALID');}
 if(!ACCOUNT.test(c?.account??'')||!SHA40.test(c?.source??'')||
  !UUID.test(c?.core??''))return result('CF_CONFIG_NOT_APPROVED');
 let root;try{root=approvedSource(dataRoot,c,fileSystem);}
 catch(e){return result(/^CF_/.test(e?.code??'')?e.code:
   'CF_APPROVED_SOURCE_UNVERIFIED');}
 let token;try{
  if(credentialLoader)token=await credentialLoader(root);
  else{
   const {credential}=await import(pathToFileURL(path.join(root,
    'scripts','pc-writer','d1.mjs')).href);
   token=credential(root,{apiToken:null});
  }
 }catch{return result('CF_EXISTING_WRANGLER_OAUTH_UNVERIFIED');}
 return queryCloudflareActive({account:c.account,token:String(token),fetchImpl});
}
