import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TITLE,SCHEMA,OUTPUT,REPO,PIN,authenticate,
 classifyR179Static,execute} from '../tools/w03-r179-guard-shape-readonly.mjs';
import {sanitize} from '../tools/w03-r179-guard-shape-report.mjs';
const requestId='ee5e8bf5-60ad-4ddf-bbb9-1c9e37f61480';
const chatId='6c8f54bb-fccd-4ed6-8115-d4c280180fd5';
const sha40='3cbd9490601cb8dffb4011dda8d063f7f87472e0';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const req=()=>({schema:SCHEMA,operation:TITLE,requestId,chatId,
 controlRepository:REPO,controlSourceSha:sha40,r179ExpectedSha256:PIN});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:sha40,GITHUB_RUN_ID:'43860000001'});
const event=()=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{number:1699,title:TITLE,
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
  body:JSON.stringify(req())}});
const specimen=(lines)=>{
 const src=[...lines,...Array(12).fill('// fixture line padding')].join('\n');
 const bytes=Buffer.from(src);
 assert.ok(bytes.length<10822);
 return Buffer.from(src+' '.repeat(10822-bytes.length));
};
test('only exact private one-shot request can inspect the pinned protected source',()=>{
 assert.equal(authenticate(event(),env()).requestId,requestId);
 for(const mutate of [
  e=>e.issue.title='w03-r179-readback-guard-install',
  e=>e.repository.private=false,
  e=>e.issue.labels=[],
  e=>{const r=JSON.parse(e.issue.body);r.controlSourceSha='e'.repeat(40);
   e.issue.body=JSON.stringify(r);},
  e=>{const r=JSON.parse(e.issue.body);r.r179ExpectedSha256='f'.repeat(64);
   e.issue.body=JSON.stringify(r);}
 ]){
  const ev=event();mutate(ev);
  assert.throws(()=>authenticate(ev,env()),{code:/W03_R179_SHAPE_/});
 }
});
test('fail-closed shape classifier distinguishes duplicate old token and multiple 7-guards',()=>{
 const bytes=specimen([
  '// SECRET_TOKEN_VALUE=secret123',
  'const got={length:7},themes=[];',
  'if(got.length!==7)throw Error("PUBLIC_API_ROLLING_MISMATCH");',
  'if(got.length!==7)throw Error("DIFFERENT_REQUIREMENT");',
  'if(themes.length < 7)throw Error("SOMETHING_ELSE");',
  'const another=rows.length >= 10;',
 ]);
 const shape=classifyR179Static(bytes,sha(bytes));
 assert.equal(shape.exactOldCount,2);
 assert.equal(shape.oldMatches.length,2);
 assert.equal(shape.rollingMarkerCount,1);
 assert.equal(shape.comparisonCount,4);
 assert.ok(shape.comparisons.some(x=>x.nameClass==='GOT'&&x.count===7));
 assert.ok(shape.comparisons.some(x=>x.nameClass==='THEMES'&&x.operator==='<'));
 assert.ok(shape.comparisons.some(x=>x.nameClass==='ROWS'&&x.count===10));
 assert.equal(shape.providerCalls,0);
 assert.ok(!JSON.stringify(shape).includes('SECRET_TOKEN_VALUE'));
 assert.throws(()=>classifyR179Static(bytes),{code:'W03_R179_SHAPE_SOURCE_PIN_STOP'});
});
test('no exact legacy token is not automatically a R179 patch approval',()=>{
 const bytes=specimen(['const got={length:10};',
  'if (got.length !== 7) throw Error("PUBLIC_API_ROLLING_MISMATCH");']);
 const shape=classifyR179Static(bytes,sha(bytes));
 assert.equal(shape.exactOldCount,0);
 assert.equal(shape.comparisons[0].nameClass,'GOT');
 assert.equal(shape.comparisons[0].operator,'!==');
 assert.equal(shape.comparisons[0].nearRollingMarker,true);
});
test('output and reporter redact raw code and fail closed on malformed shape',()=>{
 const bytes=specimen(['const got={length:10};',
  'if(got.length!==7)throw Error("PUBLIC_API_ROLLING_MISMATCH");']);
 const output=execute({event:event(),env:env(),inspect:()=>
  classifyR179Static(bytes,sha(bytes))});
 const safe=sanitize(output,req(),env());
 assert.equal(safe.status,'PASS');
 assert.equal(safe.payload.exactOldCount,1);
 assert.equal(safe.payload.publisherExecuted,false);
 assert.equal(safe.payload.sourceOnly,true);
 assert.equal(safe.payload.pcWrites,0);
 const untrusted={...output,payload:{...output.payload,
  comparisons:[...output.payload.comparisons,{nameClass:'TOKEN_LEAK',
   operator:'===',count:7,line:1,nearRollingMarker:true}]}};
 assert.equal(sanitize(untrusted,req(),env()).status,'STATE_UNKNOWN');
 const drift={...output,payload:{...output.payload,sourceSha256:'bad'}};
 assert.equal(sanitize(drift,req(),env()).status,'STATE_UNKNOWN');
});
