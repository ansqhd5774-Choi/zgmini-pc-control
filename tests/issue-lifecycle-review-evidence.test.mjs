import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPcJobReceiptPair} from '../controller/issue-lifecycle-review-evidence.mjs';
import {classifyIssueCompletion} from '../controller/issue-lifecycle-eligibility.mjs';

const sourceSha='a'.repeat(40),controllerSha='b'.repeat(40);
const request={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-check-fixed-001',operation:'release-calendar-runtime-readonly',
 sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha};
const result={schema:'ZGMINI_PC_RESULT_V1',jobId:'run-43166235600-1-seat-3',requestId:request.requestId,
 controlRepository:'ansqhd5774-Choi/zgmini-pc-control',controlSourceSha:controllerSha,
 actualExecutionSha:controllerSha,sourceRepository:request.sourceRepository,
 requestedSourceSha:sourceSha,sourceBranch:'main',operation:request.operation,seat:3,status:'PASS',
 code:'RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY',firstFail:null,exitCode:0,
 operationalWrites:0,providerCalls:0,d1Writes:0,protectedStateUnchanged:true,
 protectedBeforeSha256:'c'.repeat(64),protectedAfterSha256:'c'.repeat(64),
 result:{status:'PASS',code:'RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY'}};
const fields=['schema','jobId','requestId','controlRepository','controlSourceSha','sourceRepository',
 'requestedSourceSha','sourceBranch','operation','seat','status','code','firstFail','exitCode',
 'operationalWrites','providerCalls','d1Writes','protectedStateUnchanged',
 'protectedBeforeSha256','protectedAfterSha256','actualExecutionSha'];
const build=()=>({
 issue:{number:1299,state:'open',body:JSON.stringify(request)},
 run:{id:43166235600,status:'completed',conclusion:'success',run_attempt:1},
 comment:{user:{login:'github-actions[bot]'},body:
   '<!-- zgmini-pc-result:43166235600:1:3 -->\n'+
   'results/43166235600-1-seat-3.json\nresults/43166235600-1-seat-3.txt'},
 jsonText:JSON.stringify(result),
 txtText:fields.map(f=>f+'='+(result[f]===null?'null':String(result[f]))).join('\r\n')+'\r\n',
 attempt:1,seat:3
});
test('valid paired GitHub result is a human review candidate only',()=>{
 const p=build(),a=verifyPcJobReceiptPair(p);
 assert.equal(a.verified,true);
 const decision=classifyIssueCompletion({issue:p.issue,request,result:a.report,evidence:a.evidence,
  intent:{autoCloseEnabled:true,kind:'SINGLE_READONLY_DIAGNOSTIC',objectiveSatisfied:true,
   approvedByIndependentPolicy:true,requestId:request.requestId}});
 assert.equal(decision.eligible,true);
 assert.equal(decision.closeAuthorized,false);
});
const cases=[
 ['no trusted snapshot',p=>delete p.comment,'MISSING_TRUSTED_SNAPSHOT'],
 ['cancelled workflow',p=>p.run.conclusion='cancelled','GITHUB_RUN_NOT_SUCCESS'],
 ['wrong attempt',p=>p.run.run_attempt=2,'GITHUB_RUN_NOT_SUCCESS'],
 ['wrong job id',p=>{let x=JSON.parse(p.jsonText);x.jobId='wrong';p.jsonText=JSON.stringify(x);},'REPORT_ID_MISMATCH'],
 ['txt changed',p=>p.txtText=p.txtText.replace('status=PASS','status=BLOCKED'),'PAIR_FIELD_MISMATCH'],
 ['duplicate txt field',p=>p.txtText+='status=PASS\r\n','INVALID_TXT'],
 ['non-bot comment',p=>p.comment.user.login='attacker','RESULT_COMMENT_UNVERIFIED'],
 ['wrong comment marker',p=>p.comment.body=p.comment.body.replace('43166235600:1:3','43166235600:1:4'),'RESULT_COMMENT_UNVERIFIED'],
 ['missing remote txt URL',p=>p.comment.body=p.comment.body.replace('results/43166235600-1-seat-3.txt','none'),'RESULT_COMMENT_UNVERIFIED'],
 ['different original request',p=>p.issue.body=JSON.stringify({...request,requestId:'other'}),'ISSUE_REQUEST_MISMATCH'],
 ['partial report',p=>{let x=JSON.parse(p.jsonText);x.reportTransfer={status:'SUMMARY_ONLY'};p.jsonText=JSON.stringify(x);},'PARTIAL_REPORT'],
 ['invalid json',p=>p.jsonText='{','INVALID_JSON'],
 ['missing core verification',p=>{let x=JSON.parse(p.jsonText);delete x.code;p.jsonText=JSON.stringify(x);},'PAIR_FIELD_MISMATCH']
];
for(const [name,mutate,expected] of cases){
 test(name,()=>{const p=build();mutate(p);assert.equal(verifyPcJobReceiptPair(p).reason,expected);});
}
