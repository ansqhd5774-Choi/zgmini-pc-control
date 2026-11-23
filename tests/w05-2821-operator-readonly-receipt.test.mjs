import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {ISSUE,REQUEST_ID,REPO,newReport,postAndVerify,collectReport,inspectProbeProvenance}
 from '../tools/w05-2821-operator-readonly-receipt.mjs';
const issueUrl='https://api.github.com/repos/'+REPO+'/issues/'+ISSUE;
const good=()=>({...newReport({now:new Date('2026-11-23T05:30:00Z'),
 id:'11111111-2222-4333-8444-555555555555'}),
 nodeOperator:'PASS',nodeOperatorExit:'0',probeCheckout:'PASS',operatorVbs:'PASS',approval:'PASS',
 toolHashes:'5/5',originalCas:'5/5',recoveryClaim:'ABSENT',
 claimOwner:'NONE',originalOwnerAlive:'NO',readStatus:'READ_ONLY_COLLECTED'});

test('fixed incident, immutable no-effect and no secret fields',()=>{
 const r=good();
 assert.equal(r.requestId,REQUEST_ID);
 assert.equal(r.incidentIssue,ISSUE);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.rollbackInvocations,0);
 for(const key of Object.keys(r))assert.doesNotMatch(key,/token|sid|commandline|credential|secret/i);
});

test('one POST and one exact GET verify remote receipt',()=>{
 let calls=0,body;
 const result=postAndVerify(good(),{invoke:(file,args,opts)=>{
  calls++;
  assert.equal(file,'C:/Program Files/GitHub CLI/gh.exe');
  if(calls===1){
   assert.deepEqual(args,['api','--method','POST','repos/'+REPO+'/issues/'+ISSUE+'/comments','--input','-']);
   body=JSON.parse(opts.input).body;
   assert.match(body,/W05_2821_INDEPENDENT_OPERATOR_READONLY/);
   assert.doesNotMatch(body,/authorization|password|private key/i);
   return{status:0,stdout:JSON.stringify({id:12345,body,issue_url:issueUrl})};
  }
  assert.deepEqual(args,['api','repos/'+REPO+'/issues/comments/12345']);
  return{status:0,stdout:JSON.stringify({id:12345,body,issue_url:issueUrl})};
 }});
 assert.equal(result.status,'REMOTE_RECEIPT_VERIFIED');
 assert.match(result.url,/issuecomment-12345$/);
 assert.equal(calls,2);
});

test('POST failure has no result and must not be retried',()=>{
 let calls=0;
 const r=postAndVerify(good(),{invoke:()=>{calls++;return{status:1,stdout:'error'};}});
 assert.equal(r.status,'NO_REMOTE_RECEIPT');
 assert.equal(calls,1);
});

test('ambiguous POST response must not be retried',()=>{
 let calls=0;
 const r=postAndVerify(good(),{invoke:()=>{calls++;return{status:0,stdout:'not-json'};}});
 assert.equal(r.status,'REMOTE_RECEIPT_UNVERIFIED');
 assert.equal(calls,1);
});

test('POST ACK followed by altered GET is unverified',()=>{
 let calls=0,body;
 const r=postAndVerify(good(),{invoke:(_file,_args,opts)=>{
  calls++;
  if(calls===1){
   body=JSON.parse(opts.input).body;
   return{status:0,stdout:JSON.stringify({id:12345,body,issue_url:issueUrl})};
  }
  return{status:0,stdout:JSON.stringify({id:12345,body:body+'tampered',issue_url:issueUrl})};
 }});
 assert.equal(r.status,'REMOTE_RECEIPT_UNVERIFIED');
 assert.equal(calls,2);
});

test('wrong issue, forged role, extra secret field, invalid receipt ID send zero requests',()=>{
 for(const r of [{...good(),incidentIssue:1009},{...good(),nodeOperator:'UNVERIFIED'},
  {...good(),secret:'NEVER_POST'},{...good(),receiptId:'bad'}]){
  let count=0;
  const x=postAndVerify(r,{invoke:()=>{count++;throw Error('unexpected network');}});
  assert.equal(x.status,'REPORT_UNVERIFIED');
  assert.equal(count,0);
 }
});

test('noninteractive/Runner environment cannot attest operator',()=>{
 if(process.platform!=='win32'||process.env.GITHUB_ACTIONS||process.env.RUNNER_NAME){
  const r=collectReport();
  assert.equal(r.nodeOperator,'UNVERIFIED');
  assert.equal(r.readStatus,'INDEPENDENT_WINDOWS_OPERATOR_REQUIRED');
 }
});


const hash=v=>createHash('sha256').update(v).digest('hex');
function sourceFixture({branch='main',tamperedProbe=false,tamperedVbs=false,
 forgedManifest=false}={}){
 const probe=Buffer.from('approved-inspection-script');
 const vbs=Buffer.from('approved-operator-vbs');
 const drift=Buffer.from('changed');
 const sourceSha='a'.repeat(40);
 const installedVbs=tamperedVbs?drift:vbs;
 const manifest=JSON.stringify({schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  sourceSha,files:{'tools/maintenance-ancestry.vbs':
   hash(forgedManifest?installedVbs:vbs)}});
 const cfg={
  entry:'C:/probe.mjs',
  installation:'C:/maintenance',
  readFile:file=>{
   if(file==='C:/probe.mjs')return tamperedProbe?drift:probe;
   if(file.endsWith('MAINTENANCE_INSTALL.json'))return Buffer.from(manifest);
   if(file.endsWith('maintenance-ancestry.vbs'))return installedVbs;
   throw Error('UNEXPECTED_PATH');
  },
  git:args=>{
   if(args[0]==='branch')return{status:0,stdout:branch+'\n'};
   if(args[0]==='show'&&args[1]==='HEAD:tools/w05-2821-operator-readonly-receipt.mjs')
    return{status:0,stdout:probe};
   if(args[0]==='show'&&args[1]===sourceSha+':tools/maintenance-ancestry.vbs')
    return{status:0,stdout:vbs};
   throw Error('UNEXPECTED_GIT');
  }
 };
 return cfg;
}
test('operator source provenance verifies exact main checkout plus installed WMI origin',()=>{
 assert.deepEqual(inspectProbeProvenance(sourceFixture()),
  {probeCheckout:'PASS',operatorVbs:'PASS'});
});
test('operator proof fails closed on checkout branch or script byte drift',()=>{
 assert.equal(inspectProbeProvenance(sourceFixture({branch:'codex/unsafe'})).probeCheckout,'FAIL');
 assert.deepEqual(inspectProbeProvenance(sourceFixture({tamperedProbe:true})),
  {probeCheckout:'FAIL',operatorVbs:'FAIL'});
});
test('installed WMI drift and self-consistent forged manifest cannot attest',()=>{
 for(const opts of [{tamperedVbs:true},{tamperedVbs:true,forgedManifest:true}]){
  assert.deepEqual(inspectProbeProvenance(sourceFixture(opts)),
   {probeCheckout:'PASS',operatorVbs:'FAIL'});
 }
});
