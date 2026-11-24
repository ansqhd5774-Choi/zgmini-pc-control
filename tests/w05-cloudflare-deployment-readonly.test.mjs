import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {queryCloudflareActive,CF_WORKER,CF_DOMAIN,CF_EXPECTED_VERSION}
 from '../controller/w05-cloudflare-deployment-readonly.mjs';

const ACCOUNT='a'.repeat(32);
const DEPLOYMENT='ed4b323c-f134-43cd-9450-79b7d91aabf9';
const ROW={id:DEPLOYMENT,strategy:'percentage',
 created_on:'2026-11-24T08:59:38.000Z',source:'git',
 versions:[{version_id:CF_EXPECTED_VERSION,percentage:100}]};
function setup({override={},status=200,domainService=CF_WORKER}={}){
 const calls=[];
 const fetchImpl=async (url,options)=>{
  calls.push({url,method:options.method,redirect:options.redirect});
  let result;
  if(url.endsWith('/deployments?per_page=5'))result={deployments:[ROW]};
  else if(url.endsWith('/deployments/'+DEPLOYMENT))result=ROW;
  else if(url.endsWith('/versions/'+CF_EXPECTED_VERSION))result={
   id:CF_EXPECTED_VERSION,number:123,
   metadata:{created_on:'2026-11-24T08:59:36.000Z'}};
  else if(url.endsWith('/domains'))result=[{
   hostname:CF_DOMAIN,service:domainService,enabled:true}];
  else throw Error('UNEXPECTED_NETWORK_ENDPOINT');
  return {status,json:async()=>({success:true,result:
    Object.hasOwn(override,url)?override[url]:result})};
 };
 return {fetchImpl,calls};
}
test('fixed official read-only Cloudflare GETs identify the active deployment, 100% version and bound domain',async()=>{
 const {fetchImpl,calls}=setup();
 const r=await queryCloudflareActive({account:ACCOUNT,token:'secret-test-only',
  fetchImpl});
 assert.equal(r.status,'PASS');
 assert.equal(r.code,'CF_ACTIVE_DEPLOYMENT_READONLY_VERIFIED');
 assert.equal(r.activeDeploymentId,DEPLOYMENT);
 assert.equal(r.activeVersions[0].versionId,CF_EXPECTED_VERSION);
 assert.equal(r.activeVersions[0].percentage,100);
 assert.equal(r.expectedBuildVersionActive,true);
 assert.equal(r.domainVerified,true);
 assert.equal(r.deploymentIdentityVerified,true);
 assert.equal(r.sourceShaVerified,false);
 assert.equal(r.d1Writes,0);assert.equal(r.operationalWrites,0);
 assert.equal(r.providerCalls,0);
 assert.equal(calls.length,4);
 assert.ok(calls.every(x=>x.method==='GET'&&x.redirect==='error'&&
  x.url.startsWith('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
   '/workers/')));
 assert.doesNotMatch(JSON.stringify(r),/secret-test-only/);
});
test('same Worker version metadata does not imply source SHA attestation',async()=>{
 const {fetchImpl}=setup();
 const r=await queryCloudflareActive({account:ACCOUNT,
  token:'secret-test-only',fetchImpl});
 assert.equal(r.sourceShaVerified,false);
 assert.equal(r.status,'PASS');
});
test('missing custom-domain binding retains observed deployment but does not pass',async()=>{
 const {fetchImpl}=setup({domainService:'wrong-worker'});
 const r=await queryCloudflareActive({account:ACCOUNT,
  token:'secret-test-only',fetchImpl});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'CF_DOMAIN_BINDING_UNVERIFIED');
 assert.equal(r.activeDeploymentId,DEPLOYMENT);
 assert.equal(r.deploymentIdentityVerified,false);
 assert.equal(r.domainVerified,false);
});
test('Cloudflare 403 is authorization unknown not fabricated deployment success',async()=>{
 const {fetchImpl}=setup({status:403});
 const r=await queryCloudflareActive({account:ACCOUNT,
  token:'secret-test-only',fetchImpl});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'CF_OAUTH_PERMISSION_UNVERIFIED');
 assert.equal(r.activeDeploymentId,null);
});
test('reject untrusted account, credential, malformed percent and mismatched detail',async()=>{
 const {fetchImpl,calls}=setup();
 const rejected=await queryCloudflareActive({account:'wrong',
  token:'secret-test-only',fetchImpl});
 assert.equal(rejected.status,'STATE_UNKNOWN');
 assert.equal(calls.length,0);
 const listURL='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
  '/workers/scripts/'+CF_WORKER+'/deployments?per_page=5';
 const bad=setup({override:{[listURL]:{deployments:[{
  ...ROW,versions:[{version_id:CF_EXPECTED_VERSION,percentage:99}]
 }]}}});
 const r=await queryCloudflareActive({account:ACCOUNT,
  token:'secret-test-only',fetchImpl:bad.fetchImpl});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'CF_ACTIVE_DEPLOYMENT_SHAPE_UNVERIFIED');
 const detailURL='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
  '/workers/scripts/'+CF_WORKER+'/deployments/'+DEPLOYMENT;
 const diff=setup({override:{[detailURL]:{
  ...ROW,versions:[{version_id:CF_EXPECTED_VERSION,percentage:50},
                  {version_id:'c13a4eb1-64f3-4df2-8e81-09dc1998d888',percentage:50}]
 }}});
 const mismatch=await queryCloudflareActive({account:ACCOUNT,
  token:'secret-test-only',fetchImpl:diff.fetchImpl});
 assert.equal(mismatch.code,'CF_DEPLOYMENT_DETAIL_MISMATCH');
});
test('installed operation uses fixed A/light allowlist, never accepts request URL',()=>{
 const ops=readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 const config=JSON.parse(readFileSync(new URL('../config/operations.json',import.meta.url)));
 const p=config.operations['w05-cloudflare-deployment-readonly'];
 assert.deepEqual(p,{grade:'A',timeoutSeconds:90,resource:'light'});
 assert.equal(config.mutationsEnabled,false);
 assert.match(ops,/inspectW05CloudflareActive\(dataRoot\)/);
 assert.doesNotMatch(ops,/request\.cloudflare|request\.url/);
});

test('W05 Cloudflare B candidate remains source-only until exact approved CAS install',()=>{
 const config=JSON.parse(readFileSync(new URL('../config/operations.json',import.meta.url)));
 assert.equal(config.operations['w05-cloudflare-deployment-readonly'].grade,'A');
 assert.equal(config.mutationsEnabled,false);
});
