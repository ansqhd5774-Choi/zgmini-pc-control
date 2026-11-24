import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readVerifiedPcJobReceipt} from '../controller/issue-lifecycle-github-reader.mjs';
import {classifyIssueCompletion} from '../controller/issue-lifecycle-eligibility.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const sha='a'.repeat(40),execution='b'.repeat(40),commit='c'.repeat(40);
const issueNumber=1299,runId=43166235600,commentId=4123456789,attempt=1,seat=3;
const request={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-unblock-test-r1',
  operation:'release-calendar-runtime-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'main',sourceSha:sha};
const report={schema:'ZGMINI_PC_RESULT_V1',jobId:'run-43166235600-1-seat-3',
 requestId:request.requestId,controlRepository:REPO,controlSourceSha:execution,
 sourceRepository:request.sourceRepository,requestedSourceSha:sha,
 sourceBranch:request.sourceBranch,operation:request.operation,seat,status:'PASS',
 code:'RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY',firstFail:null,exitCode:0,
 operationalWrites:0,providerCalls:0,d1Writes:0,protectedStateUnchanged:true,
 protectedBeforeSha256:'e'.repeat(64),protectedAfterSha256:'e'.repeat(64),
 actualExecutionSha:execution,result:{status:'PASS',code:'RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY'}};
const fields=['schema','jobId','requestId','controlRepository','controlSourceSha',
 'sourceRepository','requestedSourceSha','sourceBranch','operation','seat','status',
 'code','firstFail','exitCode','operationalWrites','providerCalls','d1Writes',
 'protectedStateUnchanged','protectedBeforeSha256','protectedAfterSha256','actualExecutionSha'];
const contents=data=>{
 const bytes=Buffer.from(data,'utf8');
 return {type:'file',encoding:'base64',size:bytes.length,
   content:bytes.toString('base64'),
   sha:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')};
};
const make=()=>{
 const json=JSON.stringify(report),txt=fields.map(f=>f+'='+
   (report[f]===null?'null':String(report[f]))).join('\r\n')+'\r\n';
 const fence=String.fromCharCode(96).repeat(3);
 const body='<!-- zgmini-pc-result:43166235600:1:3 -->\n'+
  'results/43166235600-1-seat-3.json\nresults/43166235600-1-seat-3.txt\n'+
  fence+'json\n'+json+fence+'\n'+fence+'text\n'+txt+fence;
 const prefix='repos/'+REPO+'/';
 const paths=new Map([
  [prefix+'issues/'+issueNumber,{number:issueNumber,state:'open',body:JSON.stringify(request),
     repository_url:'https://api.github.com/repos/'+REPO}],
  [prefix+'actions/runs/'+runId,{id:runId,status:'completed',conclusion:'success',
     event:'issues',name:'ZGMINI PC Job',run_attempt:1,repository:{full_name:REPO}}],
  [prefix+'issues/comments/'+commentId,{id:commentId,body,
     issue_url:'https://api.github.com/repos/'+REPO+'/issues/'+issueNumber,
     user:{login:'github-actions[bot]'}}],
  [prefix+'contents/results/43166235600-1-seat-3.json?ref='+commit,contents(json)],
  [prefix+'contents/results/43166235600-1-seat-3.txt?ref='+commit,contents(txt)]
 ]);
 const args={issueNumber,runId,commentId,attempt,seat,artifactCommitSha:commit,
   githubGet:async path=>({status:paths.has(path)?200:404,data:paths.get(path)})};
 return {paths,args,prefix};
};
test('successful pinned pair never authorizes closure',async()=>{
 const {args}=make();
 const got=await readVerifiedPcJobReceipt(args);
 assert.equal(got.verified,true);
 assert.equal(got.artifactCommitSha,commit);
 const decision=classifyIssueCompletion({
   issue:{number:issueNumber,state:'open',body:JSON.stringify(request)},
   request,result:got.report,evidence:got.evidence,
   intent:{autoCloseEnabled:true,kind:'SINGLE_READONLY_DIAGNOSTIC',
     objectiveSatisfied:true,approvedByIndependentPolicy:true,requestId:request.requestId}
 });
 assert.deepEqual({eligible:decision.eligible,closeAuthorized:decision.closeAuthorized},
  {eligible:true,closeAuthorized:false});
});
const faults=[
 ['missing API',x=>delete x.args.githubGet,'UNTRUSTED_READER_ARGUMENT'],
 ['untrusted commit id',x=>x.args.artifactCommitSha='main','UNTRUSTED_READER_ARGUMENT'],
 ['cross issue response',x=>x.paths.get(x.prefix+'issues/'+issueNumber).number=700,'GITHUB_OBJECT_PROVENANCE_MISMATCH'],
 ['foreign issue repository',x=>x.paths.get(x.prefix+'issues/'+issueNumber).repository_url='https://api.github.com/repos/foo/bar','GITHUB_OBJECT_PROVENANCE_MISMATCH'],
 ['foreign run response',x=>x.paths.get(x.prefix+'actions/runs/'+runId).repository.full_name='foo/bar','GITHUB_OBJECT_PROVENANCE_MISMATCH'],
 ['wrong event',x=>x.paths.get(x.prefix+'actions/runs/'+runId).event='pull_request','GITHUB_OBJECT_PROVENANCE_MISMATCH'],
 ['misbound comment',x=>x.paths.get(x.prefix+'issues/comments/'+commentId).issue_url='https://api.github.com/repos/'+REPO+'/issues/42','GITHUB_OBJECT_PROVENANCE_MISMATCH'],
 ['tampered Git blob',x=>x.paths.get(x.prefix+'contents/results/43166235600-1-seat-3.json?ref='+commit).sha='f'.repeat(40),'PINNED_BLOB_UNVERIFIED'],
 ['missing TXT file',x=>x.paths.delete(x.prefix+'contents/results/43166235600-1-seat-3.txt?ref='+commit),'PINNED_BLOB_UNVERIFIED'],
 ['altered TXT with valid Git blob',x=>x.paths.set(x.prefix+'contents/results/43166235600-1-seat-3.txt?ref='+commit,contents('status=BLOCKED\r\n')),'PAIR_FIELD_MISMATCH'],
 ['comment author not bot',x=>x.paths.get(x.prefix+'issues/comments/'+commentId).user.login='attacker','RESULT_COMMENT_UNVERIFIED'],
 ['forged comment JSON',x=>{const c=x.paths.get(x.prefix+'issues/comments/'+commentId);c.body=c.body.replace('"status":"PASS"','"status":"BLOCKED"');},'RESULT_COMMENT_CONTENT_MISMATCH'],
 ['forged comment TXT',x=>{const c=x.paths.get(x.prefix+'issues/comments/'+commentId);c.body=c.body.replace('status=PASS','status=BLOCKED');},'RESULT_COMMENT_CONTENT_MISMATCH'],
 ['GitHub GET throws',x=>x.args.githubGet=async()=>{throw Error('down');},'GITHUB_OBJECT_PROVENANCE_MISMATCH'],
 ['non-success workflow',x=>x.paths.get(x.prefix+'actions/runs/'+runId).conclusion='failure','GITHUB_RUN_NOT_SUCCESS']
];
for(const [name,mutate,expected] of faults){
 test(name,async()=>{const x=make();mutate(x);
   assert.equal((await readVerifiedPcJobReceipt(x.args)).reason,expected);
 });
}
