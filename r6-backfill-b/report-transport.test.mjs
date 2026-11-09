import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {R6_ONE_SHOT} from './contract.mjs';
import {validateR6BReportEvent,sanitizeR6BTransportResult,
 uploadR6BReport,readR6BLocalResult} from './report-transport.mjs';

const requestId='11111111-1111-4111-8111-111111111111';
const chatId='22222222-2222-4222-8222-222222222222';
const req={schema:R6_ONE_SHOT.schema,operation:'employment-r6-backfill-once',
 requestId,chatId,sourceSha:'a'.repeat(40),controlSha:'b'.repeat(40),
 approvalManifestSha256:'c'.repeat(64)};
const event={action:'opened',repository:{full_name:R6_ONE_SHOT.repository,private:true},
 sender:{login:R6_ONE_SHOT.owner},
 issue:{number:8001,user:{login:R6_ONE_SHOT.owner},title:R6_ONE_SHOT.issueTitle,
  labels:[{name:R6_ONE_SHOT.issueLabel}],body:JSON.stringify(req)}};
const env={GITHUB_REPOSITORY:R6_ONE_SHOT.repository,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:R6_ONE_SHOT.owner,
 GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'f'.repeat(40),
 GITHUB_RUN_ID:'42563264917',GITHUB_TOKEN:'x'.repeat(30)};

test('report entry accepts exact owner-private first-run request, not Issue-controlled effect pins',()=>{
 assert.equal(validateR6BReportEvent(event,env).requestId,requestId);
 assert.throws(()=>validateR6BReportEvent({...event,
  issue:{...event.issue,body:JSON.stringify({...req,untrustedCallback:'run'})}},env),
 /R6_B_REPORT_REQUEST_STOP/);
 assert.throws(()=>validateR6BReportEvent({...event,
  sender:{login:'forged-user'}},env),/R6_B_REPORT_EVENT_STOP/);
 assert.throws(()=>validateR6BReportEvent(event,{...env,GITHUB_RUN_ATTEMPT:'2'}),
  /R6_B_REPORT_EVENT_STOP/);
});

test('report does not promote false or unknown effect proof to success',()=>{
 const forged={schema:'ZGMINI_R6_BACKFILL_B_RESULT_V1',requestId,
  status:'SUCCESS',code:'R6_B_BACKFILL_STORED',providerRequests:2,
  blsRequests:2,dolRequests:0,d1Writes:0,schedulerWrites:0,
  groupResults:[{groupName:'BLS_ECI',status:'SUCCESS',providerRequests:2}]};
 assert.equal(sanitizeR6BTransportResult(forged,requestId,'123').status,
  'STATE_UNKNOWN');
 assert.equal(sanitizeR6BTransportResult({...forged,effectsVerified:true,
  schedulerWrites:1},requestId,'123').status,'STATE_UNKNOWN');
 const valid=sanitizeR6BTransportResult({...forged,effectsVerified:true},
  requestId,'123');
 assert.equal(valid.status,'SUCCESS');
 assert.equal(valid.providerRequests,2);
 assert.equal(valid.retry,'NO_AUTO_RETRY');
 assert.equal(sanitizeR6BTransportResult({...forged,
  requestId:'00000000-0000-4000-8000-000000000000',effectsVerified:true},
 requestId,'123').status,'STATE_UNKNOWN');
});

test('exact known no-effect host refusal stays BLOCKED, never successful',()=>{
 const result=sanitizeR6BTransportResult({schema:'ZGMINI_R6_B_WINDOWS_HOST_V1',
  requestId,status:'BLOCKED',code:'R6_B_EFFECT_APPROVAL_PINS_NOT_INSTALLED',
  allowProviderCalls:false,allowDbWrites:false,providerRequests:0},requestId,'123');
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.effectsVerified,false);
 assert.equal(result.providerRequests,0);
});

test('remote evidence uses atomic pair helper and exact Issue only; failed pair degrades comment',async()=>{
 let records=[];
 const atomicUpload=async(args)=>{
  records.push({kind:'pair',paths:args.outputs.map(x=>x[0]),contents:args.outputs.map(x=>x[1])});
  return {created:2,verified:2,delivery:'RESULT_PAIR_READBACK_VERIFIED'};
 };
 const apiFetch=async(url,options)=>{
  records.push({kind:'comment',url,body:JSON.parse(options.body).body,
   hasToken:typeof options.headers.authorization==='string'});
  return {status:201};
 };
 const rawResult=JSON.stringify({schema:'ZGMINI_R6_B_WINDOWS_HOST_V1',
  requestId,status:'BLOCKED',code:'R6_B_EFFECT_APPROVAL_PINS_NOT_INSTALLED',
  allowProviderCalls:false,allowDbWrites:false,providerRequests:0});
 const out=await uploadR6BReport({event,env,rawResult,atomicUpload,apiFetch});
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.verified,2);
 assert.deepEqual(records[0].paths,[
  `results/employment-r6-backfill-${requestId}.json`,
  `results/employment-r6-backfill-${requestId}.txt`]);
 assert.doesNotMatch(records[0].contents.join('\n'),/Bearer|x{20}/);
 assert.match(records[1].body,/RESULT_READBACK: 2\/2/);
 records=[];
 const bad=await uploadR6BReport({event,env,rawResult,apiFetch,
  atomicUpload:async()=>({created:null,verified:1,
   delivery:'RESULT_PAIR_REF_UNVERIFIED_READ_ONLY_RECONCILE'})});
 assert.equal(bad.status,'STATE_UNKNOWN');
 assert.match(records[0].body,/RESULT_READBACK: 1\/2/);
});

test('event validation happens before any remote upload or comment',async()=>{
 let attempts=0;
 await assert.rejects(uploadR6BReport({event:{...event,action:'edited'},
  env,rawResult:'{}',atomicUpload:async()=>{attempts++;},
  apiFetch:async()=>{attempts++;}}),/R6_B_REPORT_EVENT_STOP/);
 assert.equal(attempts,0);
});

test('local result reading never opens arbitrary paths and rejects oversized output',()=>{
 const io={readFileSync:()=>'{"status":"OK"}'};
 assert.equal(readR6BLocalResult({env:{RUNNER_TEMP:'relative'},io}),'{}');
 const base=process.platform==='win32'?'C:\\Temp':'/tmp';
 assert.equal(readR6BLocalResult({env:{RUNNER_TEMP:base},io}),'{"status":"OK"}');
 assert.equal(readR6BLocalResult({env:{RUNNER_TEMP:base},
  io:{readFileSync:()=> 'x'.repeat(8200)}}),'{}');
});

test('workflow has an unconditional inactive gate and no accidental schedule or effect CLI',()=>{
 const here=path.dirname(fileURLToPath(import.meta.url));
 const wf=fs.readFileSync(path.resolve(here,'../.github/workflows/pc-employment-r6-backfill-b-once.yml'),'utf8');
 assert.match(wf,/\n\s+false &&/);
 assert.match(wf,/github\.run_attempt == 1/);
 assert.match(wf,/github\.event\.issue\.title == 'pc-employment-r6-backfill-one-shot'/);
 assert.match(wf,/persist-credentials: false/);
 assert.match(wf,/run: 'exit \/b 1'/);
 assert.doesNotMatch(wf,/\n\s+schedule:|workflow_dispatch:|node\.exe[^\n]*collect|curl[^\n]*bls/);
});
