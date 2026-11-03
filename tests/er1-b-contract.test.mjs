import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 sha256,validateIssue,validateApprovalBytes,validateBundleHashes,
 safeCandidateResult,SOURCE_FILES,CONTROL_REPO,ACTOR,ER1_SOURCE_SHA,
} from '../er1-b-contract.mjs';
import {executeOnce,sanitizedEnv,prepareCheckoutWorkspace,
 reserveGlobalOnce,saveResult,resultFileName} from '../er1-b-entry.mjs';
import {sanitizeReport,submitReport} from '../er1-b-upload.mjs';

const uuid='34585fa0-987f-432d-bacd-4f03c3c0e1ef';
const requestId='pc-er1-'+uuid;
const chatId='chat-'+uuid;
const env=()=>({GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_ACTOR:ACTOR,
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',RUNNER_NAME:'zgmini-pc-01',
 GITHUB_TOKEN:'example-only-fake-token-with-enough-length'});
const request=()=>({schema:'ZGMINI_ER1_PC_B_JOB_V1',requestId,chatId,
 operation:'er1-saved-score-and-d1-publish-once',controlRepository:CONTROL_REPO,
 candidateSourceSha:ER1_SOURCE_SHA,approvalManifestSha256:'a'.repeat(64)});
const event=()=>({action:'opened',repository:{private:true,full_name:CONTROL_REPO},
 sender:{login:ACTOR},issue:{number:501,user:{login:ACTOR},
 title:'pc-er1-approved-one-shot',labels:[{name:'pc-er1-approved'}],
 body:JSON.stringify(request())}});
const manifest=()=>({schema:'ER1_PC_OPERATION_APPROVAL_V1',status:'APPROVED_B',
 approvedScope:'ER1_SAVED_SCORE_AND_D1_ONE_SHOT',candidateSourceSha:ER1_SOURCE_SHA,
 pcOperationalSourceSha:'a'.repeat(40),pcD1Sha256:'b'.repeat(64),
 pcHome:String.raw`E:\ZGmini\data\pc-writer`,dataRoot:String.raw`E:\ZGmini\data`,
 probeUrl:'https://zgmini.kr/api/earnings-calendar-display?start=2026-11-02&end=2026-11-02',
 readerHeader:'ZGMINI-ER1-97',allowProviderRequests:false,
 allowCoreChanges:false,allowSchemaChanges:false,runCount:1,
 controlLedgerPath:'results/er1-b-global-once.json',allowControlLedgerWrite:true,
 sourceSha256:Object.fromEntries(SOURCE_FILES.map((x,i)=>[x,sha256(Buffer.from('source-'+i))])),
});
const approved=()=>{
 const bytes=Buffer.from(JSON.stringify(manifest()));
 const e=event(),r=JSON.parse(e.issue.body);
 r.approvalManifestSha256=sha256(bytes);e.issue.body=JSON.stringify(r);
 return {e,bytes};
};
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-er1-b-fixture-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const packageRoot=path.join(root,'er1_once_candidate');fs.mkdirSync(packageRoot);
 const {e,bytes}=approved();
 fs.writeFileSync(path.join(packageRoot,'ER1_PC_OPERATION_APPROVAL.json'),bytes);
 SOURCE_FILES.forEach((relative,i)=>{
  const p=path.join(packageRoot,...relative.split('/'));
  fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'source-'+i);
 });
 return {root,packageRoot,e};
}
function checkoutFixture(t){
 const workRoot=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-er1-checkout-'));
 t.after(()=>fs.rmSync(workRoot,{recursive:true,force:true}));
 const controlRoot=path.join(workRoot,'er1-control');
 const sourceRoot=path.join(workRoot,'er1-source');
 fs.mkdirSync(controlRoot);fs.mkdirSync(sourceRoot);
 const {e,bytes}=approved();
 fs.mkdirSync(path.join(controlRoot,'approval'));
 fs.mkdirSync(path.join(controlRoot,'operator'));
 fs.writeFileSync(path.join(controlRoot,'approval','ER1_PC_OPERATION_APPROVAL.json'),bytes);
 fs.writeFileSync(path.join(controlRoot,'operator','ER1_PC_OPERATION_ONCE.mjs'),'source-4');
 SOURCE_FILES.slice(0,4).forEach((relative,i)=>{
  const p=path.join(sourceRoot,...relative.split('/'));
  fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'source-'+i);
 });
 const approvedControl='c'.repeat(40);
 const checkoutEnv={...env(),GITHUB_WORKSPACE:workRoot,
  ER1_APPROVED_CONTROL_SHA:approvedControl,ER1_APPROVED_SOURCE_SHA:ER1_SOURCE_SHA};
 return {workRoot,controlRoot,sourceRoot,e,checkoutEnv,approvedControl};
}

test('exact issue request, private actor, installed Runner and one-shot label admitted',()=>{
 const e=event();assert.equal(validateIssue(e,env()).requestId,requestId);
 for(const variant of [
  {event:{...e,repository:{...e.repository,private:false}}},
  {event:{...e,sender:{login:'stranger'}}},
  {event:{...e,issue:{...e.issue,labels:[]}}},
  {event:{...e,issue:{...e.issue,user:{login:'stranger'}}}},
  {environment:{...env(),RUNNER_NAME:'hosted-runner'}},
  {environment:{...env(),GITHUB_ACTOR:'stranger'}},
 ])assert.throws(()=>validateIssue(variant.event??e,variant.environment??env()),
  /ER1_B_(ISSUE_AUTHORIZATION|TRUSTED_RUNNER_EVENT)_STOP|ER1_B_TRUSTED_RUNNER_EVENT_REQUIRED/);
});

test('request rejects arbitrary shell, paths, URLs, extra keys and invalid IDs',()=>{
 const e=event(),base=JSON.parse(e.issue.body);
 for(const patch of [{command:'whoami'},{workingDirectory:'C:\\Windows'},
  {script:'powershell.exe'},{requestId:'pc-er1-../../root'},
  {candidateSourceSha:'z'.repeat(40)}]){
  const x={...e,issue:{...e.issue,body:JSON.stringify({...base,...patch})}};
  assert.throws(()=>validateIssue(x,env()),/ER1_B_REQUEST_SCHEMA_STOP/);
 }
});

test('raw manifest hash, approval grade, PC sha and exact source files are mandatory',()=>{
 const {e,bytes}=approved(),r=validateIssue(e,env());
 assert.equal(validateApprovalBytes(bytes,r).status,'APPROVED_B');
 assert.throws(()=>validateApprovalBytes(Buffer.from(bytes.toString()+' '),r),
  /ER1_B_APPROVAL_HASH_STOP/);
 for(const patch of [{status:'PENDING_B'},{runCount:2},{allowProviderRequests:true},
  {pcD1Sha256:'not-a-hash'},{sourceSha256:{'random.mjs':'f'.repeat(64)}}]){
  const changed=Buffer.from(JSON.stringify({...manifest(),...patch}));
  assert.throws(()=>validateApprovalBytes(changed,{...r,approvalManifestSha256:sha256(changed)}),
   /ER1_B_APPROVAL_SCOPE_STOP/);
 }
});

test('verified package digests are checked before any candidate import/execution',(t)=>{
 const {packageRoot}=fixture(t),m=manifest();
 assert.equal(validateBundleHashes({manifest:m,root:packageRoot,
  pathJoin:path.join,readFile:p=>fs.readFileSync(p)}),true);
 fs.writeFileSync(path.join(packageRoot,SOURCE_FILES[0]),'tampered');
 assert.throws(()=>validateBundleHashes({manifest:m,root:packageRoot,
  pathJoin:path.join,readFile:p=>fs.readFileSync(p)}),
 /ER1_B_PACKAGE_SOURCE_DRIFT_STOP/);
});

test('candidate stdout is never accepted as proof; only strict result-file readback',()=>{
 const pass='STATUS=PASS\nCODE=ER1_D1_PUBLISHED_AND_READBACK\nD1_WRITES=1\n'+
  'PROVIDER_REQUESTS=0\nRAW_EARNINGS_EXPORTED=NO\n';
 assert.deepEqual(safeCandidateResult(pass,0),
  {status:'PASS',code:'ER1_D1_PUBLISHED_AND_READBACK',d1Writes:1});
 assert.equal(safeCandidateResult(pass,1).status,'STATE_UNKNOWN');
 assert.equal(safeCandidateResult(pass.replace('D1_WRITES=1','D1_WRITES=0'),0).status,'STATE_UNKNOWN');
 assert.equal(safeCandidateResult(pass.replace('RAW_EARNINGS_EXPORTED=NO','RAW_EARNINGS_EXPORTED=YES'),0).status,'STATE_UNKNOWN');
 assert.equal(safeCandidateResult('STATUS=PASS\nD1_WRITES=1',0).status,'STATE_UNKNOWN');
});

test('one-shot marker prevents another operation even if a second issue uses new ID',async t=>{
 const {root,packageRoot,e}=fixture(t);let launches=0;
 const run=()=>executeOnce({root,event:e,env:env(),strictPlatform:false,
  preflight:async()=>{},reserveGlobal:async()=>true,spawnCandidate:()=>{
   launches++;fs.writeFileSync(path.join(packageRoot,'ER1_PC_OPERATION_RESULT.txt'),
    'STATUS=PASS\nCODE=ER1_D1_PUBLISHED_AND_READBACK\nD1_WRITES=1\nPROVIDER_REQUESTS=0\nRAW_EARNINGS_EXPORTED=NO');
   return {status:0};
  }});
 assert.equal((await run()).status,'PASS');
 await assert.rejects(run(),/ER1_B_ALREADY_ATTEMPTED_STOP/);
 assert.equal(launches,1);
 assert.equal(fs.existsSync(path.join(root,'ER1_B_ONE_SHOT_ATTEMPTED.json')),true);
});

test('read-only preflight failure has no attempt marker and never launches candidate',async t=>{
 const {root,e}=fixture(t);let launches=0;
 const result=await executeOnce({root,event:e,env:env(),strictPlatform:false,
  preflight:async()=>{throw Error('ER1_CORE_SOURCE_UNRESOLVED_OR_AMBIGUOUS_STOP')},
  reserveGlobal:async()=>{assert.fail('must never reserve before preflight')},
  spawnCandidate:()=>{launches++;return {status:0}}});
 assert.equal(result.status,'BLOCKED');assert.equal(launches,0);
 assert.equal(fs.existsSync(path.join(root,'ER1_B_ONE_SHOT_ATTEMPTED.json')),false);
});

test('child result missing after attempt is UNKNOWN, never false PASS or automatic retry',async t=>{
 const {root,e}=fixture(t);
 const result=await executeOnce({root,event:e,env:env(),strictPlatform:false,
  preflight:async()=>{},reserveGlobal:async()=>true,
  spawnCandidate:()=>({status:0})});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(fs.existsSync(path.join(root,'ER1_B_ONE_SHOT_ATTEMPTED.json')),true);
});

test('scorer subprocess excludes GitHub secret token from environment',()=>{
 const x=sanitizedEnv({...env(),TEMP:'C:\\Temp',SystemRoot:'C:\\Windows',
  SECRET_PRIVATE_KEY:'do-not-pass'});
 assert.equal(x.GITHUB_TOKEN,undefined);assert.equal(x.SECRET_PRIVATE_KEY,undefined);
 assert.equal(x.TEMP,'C:\\Temp');
});

test('GitHub control-file create-only reservation is required and fail-closed',async()=>{
 const r=request();const call=[];
 assert.equal(await reserveGlobalOnce({request:r,issueNumber:501,env:env(),
  apiFetch:async(url,options)=>{call.push({url,options});return {status:201}}}),true);
 assert.equal(call.length,1);assert.equal(call[0].options.method,'PUT');
 assert.match(call[0].url,/results\/er1-b-global-once\.json$/);
 assert.equal(call[0].options.body.includes('example-only-fake-token'),false);
 await assert.rejects(reserveGlobalOnce({request:r,issueNumber:501,env:env(),
  apiFetch:async()=>({status:422})}),/ER1_B_GLOBAL_ONESHOT_ALREADY_OR_CONFLICT_STOP/);
 await assert.rejects(reserveGlobalOnce({request:r,issueNumber:501,env:env(),
  apiFetch:async()=>{throw Error('network unknown')}}),
  /ER1_B_GLOBAL_RESERVATION_STATE_UNKNOWN_STOP/);
});

test('two physically distinct fixture roots share global one-shot reservation',async t=>{
 const a=fixture(t),b=fixture(t);let reserved=false,launches=0;
 const reserve=async()=>{
  if(reserved)throw Error('ER1_B_GLOBAL_ONESHOT_ALREADY_OR_CONFLICT_STOP');
  reserved=true;return true;
 };
 const run=x=>executeOnce({root:x.root,event:x.e,env:env(),strictPlatform:false,
  preflight:async()=>{},reserveGlobal:reserve,spawnCandidate:()=>{
   launches++;fs.writeFileSync(path.join(x.packageRoot,'ER1_PC_OPERATION_RESULT.txt'),
    'STATUS=PASS\nCODE=ER1_D1_PUBLISHED_AND_READBACK\nD1_WRITES=1\n'+
    'PROVIDER_REQUESTS=0\nRAW_EARNINGS_EXPORTED=NO');return {status:0};
  }});
 assert.equal((await run(a)).status,'PASS');
 assert.equal((await run(b)).status,'BLOCKED');
 assert.equal(launches,1);
});

test('per-request immutable result files cannot block unrelated preflight results',t=>{
 const {root}=fixture(t);
 const a=saveResult({requestId,status:'BLOCKED',code:'ER1_B_APPROVAL_SCOPE_STOP',d1Writes:0},{root});
 const second='pc-er1-45673fa0-987f-432d-bacd-4f03c3c0e1ef';
 const b=saveResult({requestId:second,status:'STATE_UNKNOWN',code:'ER1_B_EXECUTION_UNVERIFIED',d1Writes:'UNKNOWN'},{root});
 assert.equal(a.status,'BLOCKED');assert.equal(b.status,'STATE_UNKNOWN');
 assert.notEqual(resultFileName(requestId),resultFileName(second));
 assert.equal(fs.existsSync(path.join(root,resultFileName(second))),true);
});

test('upload sanitizes untrusted fields and ties report to exact request ID',async()=>{
 const dirty={schema:'anything',requestId,code:'ER1_D1_PUBLISHED_AND_READBACK',
  status:'PASS',d1Writes:1,token:'do-not-export',rawEPS:'secret'};
 const good=sanitizeReport(dirty,requestId);
 assert.equal(good.rawEPS,undefined);assert.equal(good.token,undefined);
 assert.equal(sanitizeReport(dirty,'pc-er1-other').status,'STATE_UNKNOWN');
 const {e}=approved(),requests=[];
 const result=await submitReport({event:e,env:env(),readReport:()=>JSON.stringify(dirty),
  apiFetch:async(url,options)=>{requests.push({url,options});return {ok:true}}});
 assert.equal(result.uploaded,2);assert.equal(requests.length,3);
 for(const x of requests){assert.equal(x.options.method==='POST'||x.options.method==='PUT',true);
  assert.equal(x.options.body.includes('do-not-export'),false);
  assert.equal(x.options.body.includes('secret'),false);
 }
});

test('exact dual Git checkout source SHA verified and private operator staged only in workspace',t=>{
 const x=checkoutFixture(t);
 const result=prepareCheckoutWorkspace({...x,event:x.e,env:x.checkoutEnv,
  strictPlatform:false,gitSha:p=>p===x.controlRoot?x.approvedControl:ER1_SOURCE_SHA,
  gitDirty:()=>''});
 assert.equal(result.sourceRoot,x.sourceRoot);
 assert.equal(fs.readFileSync(path.join(x.sourceRoot,
  'tools','market-calendar-er1','ER1_PC_OPERATION_ONCE.mjs'),'utf8'),'source-4');
 assert.equal(fs.existsSync(path.join(x.sourceRoot,'ER1_PC_OPERATION_APPROVAL.json')),true);
 assert.equal(fs.existsSync(path.join(x.workRoot,'ER1_B_ONE_SHOT_ATTEMPTED.json')),false);
});

test('checkout SHA drift stops before workspace staging or any operational write',t=>{
 const x=checkoutFixture(t);
 assert.throws(()=>prepareCheckoutWorkspace({...x,event:x.e,env:x.checkoutEnv,
  strictPlatform:false,gitSha:()=>x.approvedControl,gitDirty:()=>''}),
  /ER1_B_CHECKOUT_SHA_OR_DIRTY_STOP/);
 assert.equal(fs.existsSync(path.join(x.sourceRoot,
  'tools','market-calendar-er1','ER1_PC_OPERATION_ONCE.mjs')),false);
});

test('dedicated B workflow uses official pinned checkout, self-hosted CMD, no event-body command',()=>{
 const own=path.dirname(fileURLToPath(import.meta.url));
 const yaml=fs.readFileSync(path.resolve(own,'../.github/workflows/pc-er1-approved-once.yml'),'utf8');
 assert.match(yaml,/runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
 assert.match(yaml,/shell: cmd/);
 assert.match(yaml,/concurrency:[\s\S]*?cancel-in-progress: false/);
 assert.match(yaml,/actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/g);
 assert.match(yaml,/persist-credentials: false/g);
 assert.match(yaml,/ref: 611b3dccf361ce66e78daf0b4108396de7c9101e/);
 assert.doesNotMatch(yaml,/\$\{\{\s*github\.event\.issue\.body\s*\}\}/);
 assert.match(yaml,/"%GITHUB_WORKSPACE%\\er1-control\\er1-b-entry\.mjs"/);
 assert.match(yaml,/"%GITHUB_WORKSPACE%\\er1-control\\er1-b-upload\.mjs"/);
});
