import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHandoff,fingerprintHandoff,routeHandoff} from '../agent-handoff/contract.mjs';
import {selectionReceipt} from '../agent-handoff/queue-selector.mjs';
import {DIAGNOSIS_SCHEMA,DIAGNOSIS_RECEIPT,REPO,OWNER,parseDiagnosis,verifyDiagnosis} from '../agent-handoff/diagnosis-result.mjs';
import {returnDiagnosis} from '../agent-handoff/diagnosis-broker.mjs';
const url=n=>`https://api.github.com/repos/${REPO}/issues/${n}`;
function fixture(){
 const q={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-original-11111111',chatId:'chat-original',
  operation:'writer-install-preimage-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'main',sourceSha:'a'.repeat(40),
  preimageManifestPath:'approvals/writer-preimage/safe-scope.json',preimageManifestSha256:'b'.repeat(64)};
 const issue=(number,body)=>({number,title:'pc-job',state:'open',user:{login:OWNER},
  labels:[{name:'pc-job'}],body:JSON.stringify(body)});
 const origin=issue(201,q),next={...q,requestId:'pc-next-22222222',chatId:'chat-next',sourceSha:'c'.repeat(40)},evidence=issue(203,next);
 const h=parseHandoff(JSON.stringify({schema:'ZGMINI_AGENT_HANDOFF_V1',incidentId:'handoff-diagnosis-fixture-20261119',
  origin:{repository:REPO,issueNumber:201,requestId:q.requestId,chatId:q.chatId,branch:q.sourceBranch,sourceSha:q.sourceSha,checkpoint:'SOURCE'},
  failure:{kind:'COMMON_RUNNER',code:'RUNNER_JOB_CANCELLED_NO_RECEIPT',lastPass:'RUNNER_ASSIGNED',firstFail:'JOB_STEP_START_UNVERIFIED',fileRefs:[],evidenceIssueNumber:201}}));
 const incident={...issue(202,h),repository:REPO,title:'diagnose cancelled read',
  labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}]};
 const result={schema:DIAGNOSIS_SCHEMA,resultId:'result-diagnosis-fixture-20261119',
  incidentId:h.incidentId,fingerprint:fingerprintHandoff(h),evidenceIssueNumber:203};
 const run={id:9001,status:'completed',conclusion:'success',run_attempt:1,
  repository:{full_name:REPO},actor:{login:OWNER},event:'issues',name:'ZGMINI PC Job'};
 const report={schema:'ZGMINI_PC_RESULT_V1',jobId:'run-9001-1-seat-3',requestId:next.requestId,
  chatId:next.chatId,operation:next.operation,requestedSourceSha:next.sourceSha,
  sourceRepository:next.sourceRepository,sourceBranch:next.sourceBranch,seat:3,
  status:'PASS',code:'WRITER_APPROVED_PREIMAGE_READONLY',operationalWrites:0,
  providerCalls:0,d1Writes:0,sqliteOpened:false,protectedStateUnchanged:true,
  result:{status:'PASS',code:'WRITER_APPROVED_PREIMAGE_READONLY'}};
 const pc=()=>[{id:12,user:{login:'github-actions[bot]'},issue_url:url(203),
  body:'<!-- zgmini-pc-result:9001:1:3 -->\n```json\n'+JSON.stringify(report)+'\n```'}];
 const comment={id:30,user:{login:OWNER},issue_url:url(202),body:JSON.stringify(result)};
 const route={id:1,user:{login:'github-actions[bot]'},issue_url:url(202),body:[
  'HANDOFF_ROUTED',`incidentId: ${h.incidentId}`,`fingerprint: ${result.fingerprint}`,
  `role: ${routeHandoff(h).role}`,'state: AWAITING_AGENT_CONFIGURATION','checkpoint: SOURCE',
  'PC retries: 0','operationalWrites: 0','Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'].join('\n')};
 const selected={id:2,user:{login:'github-actions[bot]'},issue_url:url(202),body:selectionReceipt(h,result.fingerprint)};
 const rows=new Map([[201,[]],[202,[route,selected,comment]],[203,pc()]]);
 const issues=new Map([[201,origin],[202,incident],[203,evidence]]);
 const txt=()=>`jobId=${report.jobId}\nrequestId=${report.requestId}\nstatus=${report.status}\n`;
 const input=()=>({incident,result,origin,evidence,report,txt:txt(),run,comments:pc()});
 const io={issue:async n=>structuredClone(issues.get(n)),comments:async n=>structuredClone(rows.get(n)),
  run:async()=>run,file:async p=>p.endsWith('.json')?JSON.stringify(report):txt(),
  post:async(n,body)=>rows.get(n).push({id:100+n,user:{login:'github-actions[bot]'},issue_url:url(n),body})};
 return {incident,result,origin,evidence,report,run,pc,rows,issues,input,io,
  event:{repository:{full_name:REPO,private:true},action:'created',issue:incident,comment},
  env:{GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issue_comment',GITHUB_ACTOR:OWNER}};
}
test('diagnosis returns real readonly query evidence without a PR/CI requirement',()=>{
 const f=fixture(),out=verifyDiagnosis(f.input());
 assert.ok(out.startsWith(DIAGNOSIS_RECEIPT+'\n'));
 assert.match(out,/READ_AND_PROTECTION_VERIFIED/);
 assert.match(out,/incidentResolution: NOT_ASSERTED/);
 assert.doesNotMatch(out,/APPLIED_VERIFIED|OWNER_RESUMED/);
});
test('limited read evidence never asserts system protection verified',()=>{
 const f=fixture();Object.assign(f.report,{status:'STATE_UNKNOWN',
  code:'READONLY_RESULT_PROTECTION_UNVERIFIED',protectedStateUnchanged:null,
  workerOutcome:{status:'PASS',code:f.report.result.code}});
 assert.match(verifyDiagnosis(f.input()),/READ_VERIFIED_PROTECTION_UNVERIFIED/);
});
test('strict data-only diagnosis contract rejects extra fields, malformed identity and self-selected commands',()=>{
 const f=fixture();assert.equal(parseDiagnosis(JSON.stringify(f.result)).schema,DIAGNOSIS_SCHEMA);
 for(const x of [{...f.result,cmd:'anything'},{...f.result,evidenceIssueNumber:0},
  {...f.result,fingerprint:'x'}, {...f.result,schema:'other'}])assert.throws(()=>parseDiagnosis(JSON.stringify(x)));
});
for(const [field,value] of [['operationalWrites',1],['providerCalls',1],['d1Writes',1],
 ['sqliteOpened',true],['protectedStateUnchanged',false],['requestId','another-request'],
 ['operation','arbitrary-shell'],['requestedSourceSha','f'.repeat(40)],['status','FAIL']]){
 test(`diagnosis rejects unsafe or mismatched ${field}`,()=>{
  const f=fixture();f.report[field]=value;assert.throws(()=>verifyDiagnosis(f.input()));
 });
}
test('same operation but different approved file scope is rejected',()=>{
 const f=fixture();const q=JSON.parse(f.evidence.body);q.preimageManifestSha256='f'.repeat(64);
 f.evidence.body=JSON.stringify(q);assert.throws(()=>verifyDiagnosis(f.input()),/READ_SCOPE_CHANGED/);
});
test('origin request binding cannot be replaced by an unrelated successful query',()=>{
 const f=fixture();const q=JSON.parse(f.origin.body);q.requestId='pc-other-99999999';
 f.origin.body=JSON.stringify(q);assert.throws(()=>verifyDiagnosis(f.input()),/ORIGIN_BINDING/);
});
test('wrong actor/run/attempt and missing or edited result pairs fail',()=>{
 for(const delta of [{actor:{login:'other'}},{run_attempt:2},{name:'other'},
  {event:'workflow_dispatch'},{conclusion:'failure'}]){
  const f=fixture();Object.assign(f.run,delta);assert.throws(()=>verifyDiagnosis(f.input()));
 }
 const f=fixture();assert.throws(()=>verifyDiagnosis({...f.input(),txt:'missing'}));
 assert.throws(()=>verifyDiagnosis({...f.input(),comments:[]}));
 const comments=f.pc();comments[0].body=comments[0].body.replace('"seat":3','"seat":2');
 assert.throws(()=>verifyDiagnosis({...f.input(),comments}));
});
test('broker delivers to exact incident and origin once; repeats only read existing receipts',async()=>{
 const f=fixture();const out=await returnDiagnosis(f.event,f.env,f.io);
 assert.equal(out.state,'DIAGNOSIS_RETURNED_TO_ORIGIN');
 assert.equal(f.rows.get(201).length,1);assert.equal(f.rows.get(202).length,4);
 await returnDiagnosis(f.event,f.env,f.io);
 assert.equal(f.rows.get(201).length,1);assert.equal(f.rows.get(202).length,4);
});
test('lost POST response is reconciled rather than duplicated',async()=>{
 const f=fixture(),post=f.io.post;f.io.post=async(...a)=>{await post(...a);throw Error('lost');};
 await returnDiagnosis(f.event,f.env,f.io);assert.equal(f.rows.get(201).length,1);
});
test('partial return resumes remaining delivery without replaying the PC query',async()=>{
 const f=fixture(),post=f.io.post;let fail=true;
 f.io.post=async(n,b)=>{if(n===201&&fail)throw Error('unavailable');return post(n,b);};
 await assert.rejects(returnDiagnosis(f.event,f.env,f.io),/POST_OUTCOME_UNKNOWN/);
 assert.equal(f.rows.get(202).length,4);assert.equal(f.rows.get(201).length,0);
 fail=false;await returnDiagnosis(f.event,f.env,f.io);
 assert.equal(f.rows.get(202).length,4);assert.equal(f.rows.get(201).length,1);
});
test('untrusted events, missing selection, source drift and conflicting receipts block return',async()=>{
 const f=fixture();await assert.rejects(returnDiagnosis(f.event,{...f.env,GITHUB_ACTOR:'other'},f.io));
 f.rows.get(202).splice(1,1);await assert.rejects(returnDiagnosis(f.event,f.env,f.io),/SELECTION/);
 const g=fixture();g.rows.get(201).push({user:{login:'github-actions[bot]'},issue_url:url(201),body:DIAGNOSIS_RECEIPT+'\nconflict'});
 await assert.rejects(returnDiagnosis(g.event,g.env,g.io),/RECEIPT_CONFLICT/);
});
