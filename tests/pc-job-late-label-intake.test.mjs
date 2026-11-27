import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {executeJob} from '../controller/engine.mjs';
import {attestOwnerPcJobEvent,publicPcReportProjection,publicJobLogEnvelope} from '../controller/common.mjs';
import {stagePreimageManifest} from '../controller/preimage-manifest-stager.mjs';

const wf=fs.readFileSync(new URL('../.github/workflows/pc-job.yml',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../controller/entry.mjs',import.meta.url),'utf8');
const publicA=wf.split('  public-approved-a:\n')[1]?.split('\n  # Public issue observation')[0];
const stager=fs.readFileSync(new URL('../controller/preimage-manifest-stager.mjs',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../controller/engine.mjs',import.meta.url),'utf8');

const policy={controlRepository:'ansqhd5774-Choi/zgmini-pc-control',sourceRepository:'ansqhd5774-Choi/zgmini',operations:{'core-runtime-source-readonly':{grade:'A'}}};
const request={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-late-label-source-fixture-01',chatId:'pc-label-fixture',
 operation:'core-runtime-source-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'main',sourceSha:'a'.repeat(40)};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
 GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_WORKFLOW_REF:'ansqhd5774-Choi/zgmini-pc-control/.github/workflows/pc-job.yml@refs/heads/main'};
const sender={id:327938088,login:'ansqhd5774-Choi'};
const event=(action='labeled',label='pc-job',issueOwner='ansqhd5774-Choi')=>({
 action,label:{name:label},sender,
 repository:{id:1442936296,full_name:'ansqhd5774-Choi/zgmini-pc-control',
  private:false,owner:sender},
 issue:{number:4231,title:'pc-job',user:{id:327938088,login:issueOwner},
  labels:[{name:'pc-job'}],body:JSON.stringify(request)}
});

test('workflow accepts exactly owner opened or pc-job labeled and retains pinned Windows entry',()=>{
 assert.match(wf,/types: \[opened, labeled\]/);
 assert.match(wf,/github\.event\.issue\.user\.login == 'ansqhd5774-Choi'/);
 assert.match(wf,/github\.event\.action == 'opened'/);
 assert.match(wf,/github\.event\.action == 'labeled' &&\s*github\.event\.label\.name == 'pc-job' &&\s*vars\.ZGMINI_PC_JOB_LATE_LABEL_ENABLED == 'true'/);
 assert.match(wf,/github\.event\.action == 'opened' \|\|/);
 assert.match(wf,/Late-label entry remains opt-in; duplicate claims are not replayed./);
 assert.match(wf,/contains\(github\.event\.issue\.labels\.\*\.name, 'pc-job'\)/);
 assert.match(wf,/github\.actor == 'ansqhd5774-Choi'/);
 assert.match(wf,/github\.event\.repository\.id == 1442936296/);
 assert.match(wf,/github\.event\.repository\.owner\.id == 327938088/);
 assert.match(wf,/github\.actor_id == 327938088/);
 assert.match(wf,/github\.event\.sender\.id == 327938088/);
 assert.match(wf,/github\.event\.issue\.title == 'pc-job'/);
 assert.match(wf,/github\.event\.issue\.pull_request == null/);
 assert.match(wf,/github\.workflow_ref == 'ansqhd5774-Choi\/zgmini-pc-control\/\.github\/workflows\/pc-job\.yml@refs\/heads\/main'/);
 assert.match(wf,/github\.event\.repository\.private == true/);
 assert.match(publicA,/github\.event\.repository\.private == false/);
 assert.doesNotMatch(wf.split('\njobs:')[0],/pull_request:|pull_request_target:|schedule:/);
 assert.doesNotMatch(publicA,/pull_request:|pull_request_target:|actions\/checkout/);
 assert.match(wf,/cancel-in-progress: false/);
 assert.match(wf,/E:\\ZGmini\\runtime\\node\.exe/);
 assert.match(wf,/controller\\entry\.mjs/);
 assert.match(wf,/controller\\upload\.mjs/);
 assert.doesNotMatch(wf,/workflow_dispatch:|repository_dispatch:|schedule:/);
});

test('labeled workflow admission is independently gated from opened single-run entry',()=>{
 const jobExpression=publicA.split('    if: >-\n')[1]?.split('\n    # Public visibility')[0];
 assert.ok(jobExpression,'expected fixed self-hosted job admission');
 assert.match(jobExpression,/github\.event\.action == 'opened' \|\|/);
 assert.match(jobExpression,/github\.event\.action == 'labeled'/);
 assert.match(jobExpression,/vars\.ZGMINI_PC_JOB_LATE_LABEL_ENABLED == 'true'/);
 assert.doesNotMatch(jobExpression,/vars\.ZGMINI_PC_JOB_LATE_LABEL_ENABLED == 'false'/);
 assert.match(jobExpression,/github\.event\.issue\.user\.login == 'ansqhd5774-Choi'/);
 assert.match(jobExpression,/github\.actor == 'ansqhd5774-Choi'/);
});

test('installed Controller and preimage stager share exact immutable owner Issue origin',()=>{
 const common=fs.readFileSync(new URL('../controller/common.mjs',import.meta.url),'utf8');
 assert.match(entry,/attestOwnerPcJobEvent\(event,process\.env,policy\)/);
 assert.match(entry,/PUBLIC_A_ONLY_POLICY_UNVERIFIED/);
 assert.match(stager,/attestOwnerPcJobEvent\(event,env,policy\)/);
 assert.match(common,/event\.action==='opened'/);
 assert.match(common,/event\.action==='labeled'&&event\.label\?\.name==='pc-job'/);
 assert.match(common,/event\.issue\.user\.id===ownerId/);
 assert.match(common,/!event\.issue\.pull_request/);
 // Existing requestId ledger means repeated original labels cannot execute
 // the fixed A operation twice; concurrency remains serialized per Issue.
 assert.match(engine,/DUPLICATE_REUSED_NO_EXECUTION/);
 assert.match(engine,/request-['"]\+request\.requestId/);
});

test('repeated labeled delivery reuses existing requestId ledger without another worker execution',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pc-late-label-repeat-'));
 try{
  const approvedPolicy={controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
   sourceRepository:'ansqhd5774-Choi/zgmini',seats:6,
   operations:{'core-runtime-source-readonly':{grade:'A',resource:'light',timeoutSeconds:60}}};
  const host={controllerSourceSha:'b'.repeat(40),dataRoot:path.join(root,'data')};
  const ledger=path.join(root,'ledger',request.requestId+'.json');
  fs.mkdirSync(path.dirname(ledger),{recursive:true});
  const digest=createHash('sha256').update(JSON.stringify(request)).digest('hex');
  const prior={status:'PASS',code:'CORE_READONLY_DIAGNOSIS',
   lastPass:'ALLOWLISTED_OPERATION_COMPLETED',firstFail:null};
  fs.writeFileSync(ledger,JSON.stringify({payloadSha:digest,report:prior}),{flag:'wx'});
  for(const runId of ['999901','999902']){
   const outcome=await executeJob(request,{root,policy:approvedPolicy,host,seat:1,runId});
   assert.equal(outcome.report.reused,true);
   assert.equal(outcome.report.reuseCode,'DUPLICATE_REUSED_NO_EXECUTION');
   assert.equal(outcome.report.code,prior.code);
   assert.equal(outcome.report.status,'PASS');
   assert.equal(outcome.report.operationalWrites,0);
   assert.equal(fs.existsSync(path.join(outcome.workspace,'worker-result.json')),false);
   assert.equal(fs.existsSync(outcome.file),true);
  }
  const changed={...request,sourceSha:'c'.repeat(40)};
  const refused=await executeJob(changed,{root,policy:approvedPolicy,host,seat:1,runId:'999903'});
  assert.equal(refused.report.status,'BLOCKED');
  assert.equal(refused.report.code,'DUPLICATE_REQUEST_PAYLOAD_CHANGED');
  assert.equal(fs.existsSync(path.join(refused.workspace,'worker-result.json')),false);
  assert.deepEqual(JSON.parse(fs.readFileSync(ledger,'utf8')),{payloadSha:digest,report:prior});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('preimage intake accepts labeled pc-job A without inventing scope or issuing network fetch',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error('should not fetch')};
 assert.equal(await stagePreimageManifest({env,event:event(),policy,fetchImpl}),null);
 assert.equal(await stagePreimageManifest({env,event:event('opened'),policy,fetchImpl}),null);
 assert.equal(calls,0);
});

test('labeled scoped preimage stages only approved hash-bound bytes without token forwarding',async()=>{
 const {createHash}=await import('node:crypto');
 const approval={schema:'ZGMINI_WRITER_PREIMAGE_SCOPE_APPROVAL_V1',status:'APPROVED_A_READONLY',
  scope:'PC_WRITER_APPROVED_SOURCE_PREIMAGE',sourceRoot:'projects/zgmini-earnings-history-pc-release',
  files:[{path:'scripts/pc-writer/run-local.mjs',change:'M'}],allowOtherPaths:false};
 const bytes=Buffer.from(JSON.stringify(approval));
 const hash=createHash('sha256').update(bytes).digest('hex');
 const scoped={...request,operation:'writer-install-preimage-readonly',
  preimageManifestPath:'approvals/writer-preimage/inflation-candidates-7-r1.json',
  preimageManifestSha256:hash};
 const labeled=event();labeled.issue.body=JSON.stringify(scoped);
 const token='test-only-scoped-preimage-credential-00001';
 let calls=0,observedUrl='';
 const staged=await stagePreimageManifest({env:{...env,GITHUB_SHA:'b'.repeat(40),GITHUB_TOKEN:token},
  event:labeled,policy:{...policy,operations:{...policy.operations,'writer-install-preimage-readonly':{grade:'A'}}},
  fetchImpl:async(url,options)=>{
   calls++;observedUrl=url;
   assert.equal(options.method,'GET');
   assert.equal(options.headers.Authorization,'Bearer '+token);
   return {ok:true,text:async()=>JSON.stringify({type:'file',encoding:'base64',content:bytes.toString('base64')})};
  }});
 assert.equal(calls,1);
 assert.equal(new URL(observedUrl).searchParams.get('ref'),'b'.repeat(40));
 assert.equal(staged.manifestSha256,hash);
 assert.equal(JSON.stringify(staged).includes(token),false);
});

test('late-label intake rejects unrelated labels, foreign owner, foreign actor, missing label and edits',async()=>{
 const invalid=[
  {env,event:event('labeled','other')},
  {env,event:event('labeled','pc-job','another-user')},
  {env:{...env,GITHUB_ACTOR:'another-user'},event:event()},
  {env,event:{...event(),issue:{...event().issue,labels:[]}}},
  {env,event:event('edited')},
  {env,event:{...event(),repository:{...event().repository,id:9999}}},
 ];
 for(const testCase of invalid)
  await assert.rejects(stagePreimageManifest({...testCase,policy}),{code:'PREIMAGE_STAGE_EVENT_STOP'});
});

test('public pc-job accepts only fixed owner Issue origin and rejects untrusted variants',()=>{
 const good=event('opened');
 const admission=attestOwnerPcJobEvent(good,env,policy);
 assert.equal(admission.visibility,'PUBLIC');
 assert.equal(admission.ownerVerified,true);
 assert.equal(admission.prCodeAllowed,false);
 assert.equal(attestOwnerPcJobEvent({...good,repository:{...good.repository,private:true}},env,policy).visibility,'PRIVATE');
 const invalid=[
  [{...good,repository:{...good.repository,id:123}},env],
  [{...good,repository:{...good.repository,full_name:'other/repo'}},env],
  [{...good,repository:{...good.repository,owner:{...sender,id:99}}},env],
  [{...good,repository:{...good.repository,private:'false'}},env],
  [{...good,sender:{...sender,id:99}},env],
  [{...good,sender:{...sender,login:'attacker'}},env],
  [{...good,issue:{...good.issue,user:{...sender,id:99}}},env],
  [{...good,issue:{...good.issue,user:{...sender,login:'attacker'}}},env],
  [{...good,issue:{...good.issue,pull_request:{url:'pr'}}},env],
  [{...good,issue:{...good.issue,title:'fake-job'}},env],
  [{...good,issue:{...good.issue,labels:[]}},env],
  [{...good,issue:{...good.issue,number:-1}},env],
  [{...good,action:'edited'},env],
  [{...good,action:'labeled',label:{name:'other'}},env],
  [good,{...env,GITHUB_EVENT_NAME:'pull_request'}],
  [good,{...env,GITHUB_EVENT_NAME:'pull_request_target'}],
  [good,{...env,GITHUB_WORKFLOW_REF:env.GITHUB_WORKFLOW_REF.replace('main','attacker')}],
  [good,{...env,GITHUB_REF:'refs/pull/1/merge'}],
  [good,{...env,GITHUB_RUN_ATTEMPT:'2'}],
  [good,{...env,GITHUB_ACTOR:'attacker'}],
  [good,{...env,GITHUB_REPOSITORY:'attacker/control'}],
 ];
 for(const [candidate,environment] of invalid)
  assert.throws(()=>attestOwnerPcJobEvent(candidate,environment,policy),
    /CONTROL_(REPOSITORY|WORKFLOW|OWNER|ISSUE|EVENT)/);
});
test('public pc-job preserves fixed A-grade source+report boundary',()=>{
 assert.match(entry,/policy\.operations\[raw\.operation\]\?\.grade==='A'/);
 assert.match(entry,/policy\.mutationsEnabled===false/);
 assert.match(entry,/policy\.maxAutomaticRetries===0/);
 assert.match(entry,/assertSupervisorOwner\(root,host\)/);
 assert.match(entry,/digest\(fs\.readFileSync\(path\.join\(root,rel\)\)\)===sha/);
 assert.doesNotMatch(wf,/pull_request:\s*\n|pull_request_target:/);
 assert.match(wf,/controller\\entry\.mjs/);
 assert.match(wf,/controller\\upload\.mjs/);
});

test('public JSON/TXT export never contains local private result payload or token',()=>{
 const original={schema:'ZGMINI_PC_RESULT_V1',
  jobId:'run-46021321376-1-seat-3',
  requestId:'pc-supervisor-smoke-12345678',
  operation:'runner-smoke',seat:3,status:'PASS',
  code:'RUNNER_COMMAND_EXECUTED',actualExecutionSha:'a'.repeat(40),
  result:{secret:'DO_NOT_PUBLISH_TEST_SECRET',privateConfig:'e:/ZGmini/data/private',
    source:'internal raw source',token:'ghp_fake_not_real'},
  protectedBefore:{rawSensitive:'DO_NOT_PUBLISH_TEST_SECRET'},
  prior:{unredacted:'DO_NOT_PUBLISH_TEST_SECRET'},
  collector:{environment:'DO_NOT_PUBLISH_TEST_SECRET'}};
 const sourceBefore=JSON.stringify(original);
 const publicReceipt=publicPcReportProjection(original);
 assert.deepEqual(Object.keys(publicReceipt).sort(),[
  'actualExecutionSha','code','jobId','operation','reportTransfer','requestId',
  'schema','seat','status'
 ].sort());
 assert.equal(publicReceipt.reportTransfer.status,'SUMMARY_ONLY');
 assert.equal(publicReceipt.reportTransfer.code,'PUBLIC_REPOSITORY_REDACTED');
 assert.equal(publicReceipt.code,'PUBLIC_RESULT_CODE_REDACTED');
 assert.equal(publicReceipt.status,'PASS');
 assert.doesNotMatch(JSON.stringify(publicReceipt),
  /DO_NOT_PUBLISH_TEST_SECRET|ghp_fake_not_real|private|ZGmini|internal raw source/);
 assert.equal(JSON.stringify(original),sourceBefore,'input result remains untouched');
 assert.throws(()=>publicPcReportProjection({...original,jobId:'../escape'}),
  /PUBLIC_REPORT_SCOPE_UNVERIFIED/);
});

test('public report uploader verifies repo API identity before selecting sanitized receipt',()=>{
 const upload=fs.readFileSync(new URL('../controller/upload.mjs',import.meta.url),'utf8');
 assert.match(upload,/repository=await api\(''\)/);
 assert.match(upload,/repository\.data\?\.id===1442936296/);
 assert.match(upload,/repository\.data\.owner\?\.id===327938088/);
 assert.match(upload,/typeof repository\.data\.private==='boolean'/);
 assert.match(upload,/repository\.data\.private\?report:\s*publicPcReportProjection\(report\)/);
 assert.match(upload,/REPORT_REPOSITORY_UNVERIFIED/);
 const before=upload.indexOf('const {json,txt}=renderBoundedReport');
 const after=upload.indexOf('uploadVerifiedReportPair(');
 assert.ok(before>upload.indexOf('repository=await api')&&after>before);
});

test('public A logs redact raw Worker payload while private path stays unchanged',()=>{
 const report={schema:'ZGMINI_PC_RESULT_V1',status:'PASS',
  code:'RUNNER_COMMAND_EXECUTED',result:{token:'DO_NOT_PUBLISH_TEST_SECRET'},
  privateHistory:'DO_NOT_PUBLISH_TEST_SECRET'};
 const publicLog=publicJobLogEnvelope(report,false);
 assert.deepEqual(publicLog,{status:'PASS',code:'PUBLIC_LOCAL_RESULT_REDACTED'});
 assert.doesNotMatch(JSON.stringify(publicLog),/DO_NOT_PUBLISH_TEST_SECRET/);
 assert.equal(publicJobLogEnvelope(report,true),report);
 assert.deepEqual(publicJobLogEnvelope(null,false),{
  status:'BLOCKED',code:'PUBLIC_LOCAL_RESULT_REDACTED'
 });
 // Both transports are safe only after the installed entry checks the Owner
 // Issue/Workflow identity. Never accept raw stringify or an unchecked flag.
 const byVerifiedVisibility=/publicJobLogEnvelope\(result\.report,admitted\.visibility==='PRIVATE'\)/.test(entry);
 const bySignedEvent=/publicJobLogEnvelope\(result\.report,event\?\.repository\?\.private\)/.test(entry);
 assert.ok(byVerifiedVisibility||bySignedEvent,'source must redact Public Actions logs');
 assert.match(entry,/const admitted=attestOwnerPcJobEvent\(event,process\.env,policy\)/);
 assert.doesNotMatch(entry,/console\.log\(JSON\.stringify\(result\.report\)\)/);
});


test('public A Issue comment heading uses the same projected bytes as JSON/TXT',()=>{
 const uploader=fs.readFileSync(new URL('../controller/upload.mjs',import.meta.url),'utf8');
 assert.match(uploader,/const publishedReport=JSON\.parse\(json\)/);
 assert.match(uploader,/const transfer=publishedReport\.reportTransfer/);
 assert.match(uploader,/\*\*\$\{publishedReport\.status\} — \$\{publishedReport\.code\}\*\*/);
 assert.doesNotMatch(uploader,/\*\*\$\{report\.status\} — \$\{report\.code\}\*\*/);
 // A locally held raw code must never influence the public title.
 const secret='DO_NOT_PUBLISH_TEST_SECRET';
 const raw={schema:'ZGMINI_PC_RESULT_V1',jobId:'run-150-1-seat-2',
   status:'PASS',code:secret,private:{token:secret}};
 const safe=publicPcReportProjection(raw);
 const transmittedJson=JSON.stringify(safe);
 const publishedReport=JSON.parse(transmittedJson);
 const headline=`**${publishedReport.status} — ${publishedReport.code}**`;
 assert.equal(headline,'**PASS — PUBLIC_RESULT_CODE_REDACTED**');
 assert.doesNotMatch(headline,/DO_NOT_PUBLISH_TEST_SECRET/);
});
