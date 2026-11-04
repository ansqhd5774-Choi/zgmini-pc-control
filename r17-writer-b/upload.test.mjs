import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeReport,uploadReport} from './upload.mjs';
import {OLD,REPO,OWNER} from './contract.mjs';

const uid='a62d8a8e-eafb-4a30-898e-8b4b70bbc5c1';
const requestId='pc-r17-'+uid;
const sha='a'.repeat(64);
const valid={requestId,status:'PASS',code:'R17_B_PREFLIGHT_PASS',
 existingHashesMatched:2,newlyAbsent:3,candidateHashesMatched:3,
 patchMatched:true,configPinMatched:true,taskXmlMatched:true,
 installedHeadMatched:true,verifiedImportFiles:51,
 oldTargetSha256:Object.fromEntries(OLD.map(x=>[x,sha])),runId:'123456'};
const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:OWNER,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',RUNNER_NAME:'zgmini-pc-01',GITHUB_RUN_ID:'123456',
 GITHUB_RUN_ATTEMPT:'1',R17_CONTROL_SHA:'76fa2dd3ccf5604148e93a9452351ddbbb7c5f59',
 GITHUB_TOKEN:'fake-test-token-with-enough-length'};
const body={schema:'ZGMINI_R17_WRITER_B_PREFLIGHT_REQUEST_V1',requestId,
 chatId:'chat-'+uid,operation:'r17-writer-fivefile-preflight-only',
 controlRepository:REPO,candidateSourceSha:'81c8ee543c164fc16c8c760d504b113428d01d4a',
 approvalManifestSha256:'f'.repeat(64)};
const event={action:'opened',repository:{private:true,full_name:REPO},
 sender:{login:OWNER},issue:{number:812,user:{login:OWNER},
 title:'pc-r17-writer-fivefile-preflight',labels:[{name:'pc-r17-writer-b-preflight'}],
 body:JSON.stringify(body)}};

test('only full read-only evidence can be reported PASS',()=>{
 const r=sanitizeReport(valid,requestId);
 assert.equal(r.status,'PASS');
 assert.equal(r.verifiedImportFiles,51);
 assert.deepEqual(Object.keys(r.oldTargetSha256),OLD);
 assert.equal(r.pcSourceWrites,0);
 assert.equal(r.d1Writes,0);
 const bad=sanitizeReport({...valid,oldTargetSha256:{[OLD[0]]:sha}},requestId);
 assert.equal(bad.status,'STATE_UNKNOWN');
 assert.equal(bad.code,'R17_B_REPORT_UNVERIFIED');
});

test('mismatched request and missing result fail closed without data',()=>{
 const r=sanitizeReport({...valid,requestId:'pc-r17-bad'},requestId);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.oldTargetSha256,undefined);
 const absent=sanitizeReport({},requestId);
 assert.equal(absent.status,'STATE_UNKNOWN');
});

test('result upload is exact 2 create-only files and sanitized Issue comment',async()=>{
 const calls=[];
 const out=await uploadReport({event,env,readReport:()=>JSON.stringify(valid),
  apiFetch:async(url,options)=>{calls.push({url,options});return {status:201,ok:true}}});
 assert.deepEqual(out,{status:'PASS',code:'R17_B_PREFLIGHT_PASS',saved:2});
 assert.equal(calls.length,3);
 for(const [i,x] of calls.entries()){
  assert.ok(x.url.startsWith(`https://api.github.com/repos/${REPO}/`));
  assert.ok(!JSON.stringify(x.options.body).includes(env.GITHUB_TOKEN));
  if(i<2){assert.equal(x.options.method,'PUT');assert.ok(x.url.endsWith(i===0?'.json':'.txt'));
    const uploaded=JSON.parse(x.options.body);
    assert.equal(uploaded.sha,undefined); // create-only, not an overwrite
    assert.ok(uploaded.content.length>12);
  }else{assert.equal(x.options.method,'POST');assert.ok(x.url.endsWith('/issues/812/comments'));
    assert.match(JSON.parse(x.options.body).body,/R17 Writer B read-only preflight/);
  }
 }
});

test('upload of absent result reports UNKNOWN, not PASS',async()=>{
 const comments=[];
 const r=await uploadReport({event,env,readReport:()=>{throw Error('not found')},
  apiFetch:async(url,o)=>{if(url.endsWith('/comments'))comments.push(JSON.parse(o.body).body);return {status:201,ok:true}}});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.match(comments[0],/R17_B_RESULT_REQUEST_MISMATCH/);
});

test('reject untrusted actor before any API call',async()=>{
 let called=false;
 await assert.rejects(()=>uploadReport({event,env:{...env,GITHUB_ACTOR:'other'},
  readReport:()=>JSON.stringify(valid),apiFetch:async()=>{called=true;return {status:201,ok:true}}}),
  /R17_B_EVENT_CONTEXT_STOP/);
 assert.equal(called,false);
});
