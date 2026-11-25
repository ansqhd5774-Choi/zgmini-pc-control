import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rumWindow,queryCloudflareRum,inspectW05CloudflareRum,RUM_OPERATION}
 from '../controller/w05-cloudflare-rum-readonly.mjs';
import {GRAPHQL_ENDPOINT,GOOD} from '../controller/cloudflare-rum-field-parser.mjs';

const ACCOUNT='a'.repeat(32),TOKEN='test-token-not-real';
const NOW=Date.parse('2026-11-25T12:20:00Z');
const Q={largestContentfulPaintP75:2300000,
 interactionToNextPaintP75:180000,cumulativeLayoutShiftP75:0.09};
const paths=['/','/economic-indicators/'];
const devices=['mobile','desktop'];
const rows=()=>paths.flatMap(route=>devices.map(device=>({
 count:220,dimensions:{requestHost:'zgmini.kr',requestPath:route,
  deviceType:device},quantiles:Q
})));
const body=(data=rows())=>JSON.stringify({data:{viewer:{accounts:[
 {rumWebVitalsEventsAdaptiveGroups:data}]}}});
const setup=(status=200,json=body())=>{
 const calls=[];
 return {calls,fetchImpl:async(url,opt)=>{
  calls.push({url,method:opt.method,headers:opt.headers,body:opt.body,
   redirect:opt.redirect,cache:opt.cache});
  return {status,headers:{get:()=>null},text:async()=>json};
 }};
};
test('RUM calendar fixed to previous seven complete UTC days',()=>{
 assert.deepEqual(rumWindow({nowMs:NOW}),{
  startUtc:'2026-11-18T00:00:00.000Z',
  endUtc:'2026-11-25T00:00:00.000Z'});
 assert.throws(()=>rumWindow({nowMs:NaN}),/CF_RUM_CLOCK_INVALID/);
});
test('official GraphQL POST is one fixed authorized query, no request-controlled URL or data writes',async()=>{
 const {calls,fetchImpl}=setup();
 const result=await queryCloudflareRum({account:ACCOUNT,token:TOKEN,
  fetchImpl,nowMs:NOW});
 assert.equal(result.status,'PASS');
 assert.equal(result.fieldP75ValuesPresent,true);
 assert.equal(result.observations.length,4);
 assert(result.observations.every(r=>r.groupEventCount===220));
 assert.equal(result.observations[0].metrics.lcpMs.p75,2300);
 assert.equal(result.observations[0].metrics.inpMs.p75,180);
 assert.equal(result.observations[0].metrics.cls.p75,0.09);
 assert.equal(result.siteGoodCertified,false);
 assert.equal(result.cruxEquivalent,false);
 assert.equal(result.metricSampleSizesVerified,false);
 assert.equal(result.operationalWrites,0);assert.equal(result.d1Writes,0);
 assert.equal(result.providerCalls,0);assert.equal(result.cloudflareApiCalls,1);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,GRAPHQL_ENDPOINT);
 assert.equal(calls[0].method,'POST');assert.equal(calls[0].redirect,'error');
 assert.equal(calls[0].cache,'no-store');
 assert.equal(calls[0].headers.Authorization,'Bearer '+TOKEN);
 assert.equal(calls[0].headers['Content-Type'],'application/json');
 const sent=JSON.parse(calls[0].body);
 assert.equal(sent.variables.account,ACCOUNT);
 assert.equal(sent.variables.end,'2026-11-25T00:00:00.000Z');
 assert.match(sent.query,/requestPath_in/);assert.match(sent.query,/bot: 0/);
 assert.doesNotMatch(JSON.stringify(result),new RegExp(TOKEN+'|'+ACCOUNT));
});
test('invalid credential or account never makes a request',async()=>{
 const q=setup();
 const x=await queryCloudflareRum({account:'bad',token:TOKEN,nowMs:NOW,
  fetchImpl:q.fetchImpl});
 assert.equal(x.status,'STATE_UNKNOWN');
 assert.equal(x.code,'CF_RUM_ACCOUNT_OR_AUTH_UNVERIFIED');
 assert.equal(x.cloudflareApiCalls,0);assert.equal(q.calls.length,0);
 const y=await queryCloudflareRum({account:ACCOUNT,token:'',nowMs:NOW,
  fetchImpl:q.fetchImpl});
 assert.equal(y.cloudflareApiCalls,0);assert.equal(q.calls.length,0);
});
test('HTTP auth, transport, unexpected HTTP and GraphQL errors fail closed and redact',async()=>{
 for(const status of [401,403,429,500]){
  const q=setup(status);
  const x=await queryCloudflareRum({account:ACCOUNT,token:TOKEN,
   fetchImpl:q.fetchImpl,nowMs:NOW});
  assert.equal(x.status,'STATE_UNKNOWN');assert.equal(x.cloudflareApiCalls,1);
  assert.equal(x.code,[401,403].includes(status)?
   'CF_RUM_ANALYTICS_PERMISSION_UNVERIFIED':'CF_RUM_HTTP_UNVERIFIED');
  assert.doesNotMatch(JSON.stringify(x),new RegExp(ACCOUNT+'|'+TOKEN));
 }
 const err=setup(200,JSON.stringify({errors:[{message:'token '+TOKEN}]}));
 const x=await queryCloudflareRum({account:ACCOUNT,token:TOKEN,
  fetchImpl:err.fetchImpl,nowMs:NOW});
 assert.equal(x.status,'STATE_UNKNOWN');
 assert.equal(x.code,'CF_RUM_GRAPHQL_ERRORS');
 assert.doesNotMatch(JSON.stringify(x),new RegExp(TOKEN));
 const tr=await queryCloudflareRum({account:ACCOUNT,token:TOKEN,
  nowMs:NOW,fetchImpl:async()=>{throw Error('sensitive secret '+TOKEN)}});
 assert.equal(tr.code,'CF_RUM_TRANSPORT_UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(tr),new RegExp(TOKEN));
});
test('invalid JSON, oversized data and malformed group fail closed',async()=>{
 const input=[
  [setup(200,'{invalid'),'CF_RUM_UNVERIFIED'],
  [setup(200,'x'.repeat(131073)),'CF_RUM_RESPONSE_OVERSIZE'],
  [setup(200,JSON.stringify({data:{viewer:{accounts:[]}}})),
   'CF_RUM_ACCOUNT_SCOPE_INVALID']
 ];
 for(const [q,code] of input){
  const x=await queryCloudflareRum({account:ACCOUNT,token:TOKEN,
   fetchImpl:q.fetchImpl,nowMs:NOW});
  assert.equal(x.code,code);assert.equal(x.status,'STATE_UNKNOWN');
  assert.equal(x.cloudflareApiCalls,1);
 }
});
test('zero, missing or over-Good metrics are reported without site certification',async()=>{
 const missing=rows().map(x=>({...x,count:0}));
 let q=setup(200,body(missing));
 const z=await queryCloudflareRum({account:ACCOUNT,token:TOKEN,
  fetchImpl:q.fetchImpl,nowMs:NOW});
 assert.equal(z.status,'STATE_UNKNOWN');
 assert.equal(z.fieldP75ValuesPresent,false);
 assert.equal(z.siteGoodCertified,false);
 q=setup(200,body(rows().map(x=>({...x,quantiles:{
  ...Q,cumulativeLayoutShiftP75:GOOD.cls+0.01}}))));
 const bad=await queryCloudflareRum({account:ACCOUNT,token:TOKEN,
  fetchImpl:q.fetchImpl,nowMs:NOW});
 assert.equal(bad.status,'PASS');
 assert.equal(bad.code,'CF_RUM_REFERENCE_EXCEEDED');
 assert.equal(bad.siteGoodCertified,false);
});
test('untrusted dataRoot cannot query or load credentials',async()=>{
 const q=setup();
 const x=await inspectW05CloudflareRum('relative/path',{
  fetchImpl:q.fetchImpl,nowMs:NOW});
 assert.equal(x.code,'CF_RUM_DATA_ROOT_INVALID');
 assert.equal(x.cloudflareApiCalls,0);assert.equal(q.calls.length,0);
});
test('A/light operation is a single fixed allowlist entry, not Controller mutation',()=>{
 const cfg=JSON.parse(readFileSync(new URL('../config/operations.json',import.meta.url)));
 assert.deepEqual(cfg.operations[RUM_OPERATION],
  {grade:'A',timeoutSeconds:60,resource:'light'});
 assert.equal(cfg.mutationsEnabled,false);
 const controller=readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 assert.match(controller,/inspectW05CloudflareRum\(dataRoot\)/);
 assert.doesNotMatch(controller,/request\.cloudflare|request\.graphql|request\.url/);
});


// B-only source approval checks: staging must never be confused with runtime install.
// The independently recovered #3516 lease remains a separate, current CAS condition.
import {manifestFingerprint,validateControllerSelectivePin,
 validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';
const RUM_B_TARGET='c747525082454ed27d7f0c665562e408a9c139ee';
const RUM_B_INSTALLED='83679b013ac9a9820331d93311ec97e572b18e13';
const RUM_B_MAN=JSON.parse(readFileSync(new URL(
 '../approvals/controller-updates/'+RUM_B_TARGET+'.json',import.meta.url),'utf8'));
const RUM_B_PIN=JSON.parse(readFileSync(new URL(
 '../approvals/controller-selective-targets/'+RUM_B_TARGET+'.json',import.meta.url),'utf8'));
test('RUM B proposal pins only four Controller/config files with last confirmed preimage',()=>{
 assert.equal(RUM_B_MAN.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(RUM_B_MAN.installedSha,RUM_B_INSTALLED);
 assert.equal(RUM_B_MAN.targetSha,RUM_B_TARGET);
 assert.equal(RUM_B_MAN.controllerOnlyInstall,true);
 assert.equal(RUM_B_MAN.purpose,'pc-controller-maintenance');
 assert.equal(RUM_B_MAN.approval.grade,'B');
 assert.equal(RUM_B_MAN.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.match(RUM_B_MAN.approval.ref,
  /^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/\d+$/);
 assert.deepEqual(RUM_B_MAN.allowFiles.map(x=>x.path),[
  'config/operations.json','controller/cloudflare-rum-field-parser.mjs',
  'controller/operations.mjs','controller/w05-cloudflare-rum-readonly.mjs']);
 assert.equal(RUM_B_MAN.checks.status,'PASS');
 assert.equal(RUM_B_MAN.checks.targetSha,RUM_B_TARGET);
 assert.equal(manifestFingerprint(RUM_B_MAN.allowFiles).sha256,
  '917255f22a8f52579c6428ccb3cd1a9c7960d9248b00f247e1e19b30b929c83a');
 assert.equal(RUM_B_MAN.checks.manifestSha256,
  '917255f22a8f52579c6428ccb3cd1a9c7960d9248b00f247e1e19b30b929c83a');
 assert.equal(validateControllerSelectivePin(RUM_B_MAN,RUM_B_PIN),true);
 assert.equal(validateControllerOnlyInstallDelta(
  RUM_B_MAN.allowFiles.map(x=>x.path),RUM_B_MAN.allowFiles),true);
});
test('RUM B exact source overlay takes no unrelated main Controller operations',()=>{
 assert.equal(RUM_B_MAN.selectiveSource.schema,'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1');
 assert.equal(RUM_B_MAN.selectiveSource.branch,'codex/ci-cloudflare-rum-b-overlay-20261125');
 assert.equal(RUM_B_MAN.selectiveSource.mainSha,
  '4bd6653382c28060bbf12ca8341acb8c30e5f8e3');
 assert.deepEqual([...RUM_B_MAN.selectiveSource.customPaths].sort(),[
  'config/operations.json','controller/operations.mjs']);
 assert.equal(RUM_B_MAN.backup.strategy,'VERSIONED_SNAPSHOT');
 assert.deepEqual(RUM_B_MAN.backup.rollback,
  {kind:'RESTORE_INSTALLED_SHA',sha:RUM_B_INSTALLED});
 assert.equal(RUM_B_MAN.postOperation,'core-status');
 assert.equal(RUM_B_MAN.postSourceBranch,'main');
 assert.equal(RUM_B_MAN.postSourceSha,'b6049aac81b3442a58b08050ee138921f87a09e6');
 assert.equal(RUM_B_PIN.sourceMainSha,RUM_B_MAN.selectiveSource.mainSha);
 assert.deepEqual(RUM_B_PIN.allowFiles,RUM_B_MAN.allowFiles);
 assert.throws(()=>validateControllerSelectivePin(RUM_B_MAN,{
  ...RUM_B_PIN,targetSha:'0'.repeat(40)}),/SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerOnlyInstallDelta([
  ...RUM_B_MAN.allowFiles.map(x=>x.path),'controller/engine.mjs'],
  RUM_B_MAN.allowFiles),/ALLOWFILE_DIFF_MISMATCH/);
});
