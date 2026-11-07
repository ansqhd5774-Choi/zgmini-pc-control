import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import vm from 'node:vm';

const sha=x=>createHash('sha256').update(x).digest('hex');
const scheduledTimeouts=[];
const controllerSource=fs.readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
const inlineStart=controllerSource.lastIndexOf("const SHADOW_BRANCH=");
assert.ok(inlineStart>0,'production inline helper absent');
// Evaluate the exact function source copied into an installable Controller
// file, with only its existing Node imports injected as read-only bindings.
const inline=vm.runInNewContext(controllerSource.slice(inlineStart)+
 '\n({verifyApprovedShadowBundle,interpretShadowOutcome,runApprovedShadowReadOnly,SHADOW_BRANCH,SHADOW_ENTRY})',
 {fs,path,digest:sha,need:(v,code)=>{if(!v)throw Object.assign(new Error(code),{code});},
  spawn,process,Buffer,setTimeout:(callback,ms)=>{
   scheduledTimeouts.push(ms);return setTimeout(callback,ms);
  },clearTimeout});
const {verifyApprovedShadowBundle,interpretShadowOutcome,runApprovedShadowReadOnly,
 SHADOW_BRANCH,SHADOW_ENTRY}=inline;
const SHA='074028fb54f71faa70e465c90a02161f43ce3ef8';
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-shadow-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,'source');
 const entry=path.join(source,SHADOW_ENTRY);
 fs.mkdirSync(path.dirname(entry),{recursive:true});
 const bytes='console.log("fixture")\n';
 fs.writeFileSync(entry,bytes);
 const manifest={sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha:SHA,
  sourceBranch:SHADOW_BRANCH,entrypoint:SHADOW_ENTRY,
  files:{[SHADOW_ENTRY]:sha(bytes)}};
 const buf=Buffer.from(JSON.stringify(manifest));
 fs.writeFileSync(path.join(root,'manifest.json'),buf);
 const request={sourceRepository:manifest.sourceRepository,
  sourceSha:SHA,sourceBranch:SHADOW_BRANCH};
 const host={approvedSources:{[SHA]:{root,branch:SHADOW_BRANCH,
  entrypoint:SHADOW_ENTRY,manifestSha256:sha(buf)}}};
 return {root,entry,request,host,manifest};
}

test('fixed branch, approved exact SHA and every bundled source byte verified',t=>{
 const x=fixture(t);
 assert.equal(verifyApprovedShadowBundle(x).verifiedFileCount,1);
 fs.appendFileSync(x.entry,'tamper');
 assert.throws(()=>verifyApprovedShadowBundle(x),{code:'SHADOW_SOURCE_FILE_DRIFT'});
});

test('unapproved source, branch and repository never execute',t=>{
 const x=fixture(t);
 assert.throws(()=>verifyApprovedShadowBundle({...x,request:{...x.request,sourceSha:'a'.repeat(40)}}),
  {code:'SHADOW_SOURCE_NOT_APPROVED'});
 assert.throws(()=>verifyApprovedShadowBundle({...x,request:{...x.request,sourceBranch:'main'}}),
  {code:'SHADOW_BRANCH_DENIED'});
 assert.throws(()=>verifyApprovedShadowBundle({...x,request:{...x.request,sourceRepository:'evil/repo'}}),
  {code:'SHADOW_REPOSITORY_DENIED'});
});

test('manifest identity drift and traversal never execute',t=>{
 const x=fixture(t);
 x.manifest.files={'../outside.mjs':sha('malicious')};
 const bytes=Buffer.from(JSON.stringify(x.manifest));
 fs.writeFileSync(path.join(x.root,'manifest.json'),bytes);
 x.host.approvedSources[SHA].manifestSha256=sha(bytes);
 assert.throws(()=>verifyApprovedShadowBundle(x),
  {code:'SHADOW_ENTRY_MISSING'});
 x.manifest.files[SHADOW_ENTRY]=sha(fs.readFileSync(x.entry));
 const newer=Buffer.from(JSON.stringify(x.manifest));
 fs.writeFileSync(path.join(x.root,'manifest.json'),newer);
 x.host.approvedSources[SHA].manifestSha256=sha(newer);
 assert.throws(()=>verifyApprovedShadowBundle(x),
  {code:'SHADOW_MANIFEST_FILE_PATH_INVALID'});
});

test('real dependency closure accepts worker, approved hyparquet and root package.json only when hashed',t=>{
 const x=fixture(t);
 const worker='worker/theme-nine-r88-provisional.mjs';
 const pathWorker=path.join(x.root,'source',worker);
 fs.mkdirSync(path.dirname(pathWorker),{recursive:true});
 fs.writeFileSync(pathWorker,'export const marker=true;\n');
 const decoder='vendor/hyparquet-1.31.2/src/index.js';
 const pathDecoder=path.join(x.root,'source',decoder);
 fs.mkdirSync(path.dirname(pathDecoder),{recursive:true});
 fs.writeFileSync(pathDecoder,'export const parquetReadObjects=()=>[];\n');
 fs.writeFileSync(path.join(x.root,'source','package.json'),'{"type":"module"}\n');
 x.manifest.files[worker]=sha(fs.readFileSync(pathWorker));
 x.manifest.files[decoder]=sha(fs.readFileSync(pathDecoder));
 x.manifest.files['package.json']=sha(fs.readFileSync(path.join(x.root,'source','package.json')));
 const raw=Buffer.from(JSON.stringify(x.manifest));
 fs.writeFileSync(path.join(x.root,'manifest.json'),raw);
 x.host.approvedSources[SHA].manifestSha256=sha(raw);
 assert.equal(verifyApprovedShadowBundle(x).verifiedFileCount,4);
 fs.appendFileSync(pathWorker,'modified');
 assert.throws(()=>verifyApprovedShadowBundle(x),{code:'SHADOW_SOURCE_FILE_DRIFT'});
});

test('unlisted transitive module is denied even when approved files match',t=>{
 const x=fixture(t);
 const rogue=path.join(x.root,'source','worker','secret-unlisted.mjs');
 fs.mkdirSync(path.dirname(rogue),{recursive:true});
 fs.writeFileSync(rogue,'export const unapproved=true;\n');
 assert.throws(()=>verifyApprovedShadowBundle(x),
  {code:'SHADOW_SOURCE_UNLISTED_OR_LINKED'});
});

function outcome(overrides={}){
 const ids=['robotics','cloud-saas','autonomous-driving','nuclear-smr',
  'defense','fintech','cybersecurity','biotech','data-center-power','space-satellite'];
 return {status:'COMPLETE',providerCalls:0,d1Writes:0,schedulerWrites:0,
  publicConnection:'NOT_ACTIVATED',checkpointPersistence:'TRANSIENT_MEMORY_ONLY',
  publicTargetIds:ids,coverage:{public:{status:'COMPLETE',themes:10,
   expectedPhases:20,complete:20,blocked:0,pending:0},private:{status:'COMPLETE',themes:1,
   expectedPhases:2,complete:2,blocked:0,pending:0}},...overrides};
}

test('valid complete ten-theme shadow is PASS, with no raw result exposure',()=>{
 const res=interpretShadowOutcome({exitCode:0,stdout:JSON.stringify(outcome())});
 assert.equal(res.status,'PASS');
 assert.equal(res.publicTargetCount,10);
 assert.equal(res.publicComplete,20);
 assert.equal(res.d1Writes,0);
 assert.ok(!('results' in res));
});

test('missing coverage, false zero-write claim, or small theme set fails closed',()=>{
 assert.throws(()=>interpretShadowOutcome({exitCode:0,
  stdout:JSON.stringify(outcome({d1Writes:1}))}),
  {code:'SHADOW_READONLY_CONTRACT_NOT_PROVEN'});
 assert.throws(()=>interpretShadowOutcome({exitCode:0,
  stdout:JSON.stringify(outcome({publicTargetIds:['robotics']}))}),
  {code:'SHADOW_PUBLIC_TARGETS_UNDER_MINIMUM'});
 assert.throws(()=>interpretShadowOutcome({exitCode:0,
  stdout:JSON.stringify(outcome({coverage:{public:{}}}))}),
  {code:'SHADOW_PUBLIC_COVERAGE_INVALID'});
});

test('partial shadow is BLOCKED but retains explicit PARTIAL replay status',()=>{
 const body=outcome({status:'PARTIAL',coverage:{...outcome().coverage,public:{status:'PARTIAL',
  themes:10,expectedPhases:20,complete:15,blocked:3,pending:2}}});
 const res=interpretShadowOutcome({exitCode:2,stdout:JSON.stringify(body)});
 assert.equal(res.status,'BLOCKED');
 assert.equal(res.replayStatus,'PARTIAL');
 assert.equal(res.publicBlocked,3);
});

test('real CLI STOP on stderr yields sanitized BLOCKED, without leaking stderr',()=>{
 const res=interpretShadowOutcome({exitCode:2,stdout:'',
  stderr:JSON.stringify({status:'STOP',reason:'THEME_STORED_INPUT_UNAVAILABLE',
   d1Writes:0,schedulerWrites:0,secret:'sensitive'})});
 assert.equal(res.status,'BLOCKED');
 assert.equal(res.code,'THEME_STORED_INPUT_UNAVAILABLE');
 assert.ok(!JSON.stringify(res).includes('sensitive'));
 assert.throws(()=>interpretShadowOutcome({exitCode:2,stdout:'',
  stderr:'access_key=abc123'}),{code:'SHADOW_OUTPUT_JSON_INVALID'});
});

test('single fixed Node launch with no arbitrary args, no fixture write, sanitized summary',async t=>{
 const x=fixture(t);
 let invocation;
 const spawnImpl=(exe,args,opts)=>{
  invocation={exe,args,opts};
  const child=new EventEmitter();
  child.stdout=new PassThrough();child.stderr=new PassThrough();
  queueMicrotask(()=>{
   child.stdout.end(JSON.stringify(outcome()));child.stderr.end();
   child.emit('close',0);
  });
  return child;
 };
 const result=await runApprovedShadowReadOnly({request:x.request,host:x.host,
  dataRoot:x.root,spawnImpl});
 assert.deepEqual(Array.from(invocation.args.slice(-2)),[x.entry,'--platform-shadow']);
 assert.equal(invocation.opts.env.ZGMINI_DATA_ROOT,fs.realpathSync(x.root));
 assert.equal(invocation.opts.env.TEMP,process.env.TEMP);
 assert.equal(invocation.opts.env.TMP,process.env.TMP);
 assert.equal(invocation.opts.stdio[0],'ignore');
 assert.equal(result.status,'PASS');
 assert.equal(result.actualExecutionSha,SHA);
 assert.equal(result.requestedSourceSha,SHA);
 assert.equal(result.candidateExecuted,true);
 assert.ok(scheduledTimeouts.includes(210000),'shadow must exit before 240s worker timeout');
 assert.ok(!Object.hasOwn(result,'results'));
});

test('actual installable Controller dispatches one shadow operation with A policy',()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const embedded=fs.readFileSync(path.join(root,'controller','operations.mjs'),'utf8');
 assert.ok(embedded.includes("if(request.operation==='theme-platform-shadow-readonly')"));
 const policy=JSON.parse(fs.readFileSync(path.join(root,'config','operations.json')));
 assert.deepEqual(policy.operations['theme-platform-shadow-readonly'],
  {grade:'A',timeoutSeconds:240,resource:'heavy',minimumFreeMiB:1536});
});

test('dispatch treats only missing B-approved source as BLOCKED, not hash drift',async()=>{
 const start=controllerSource.indexOf(" if(request.operation==='theme-platform-shadow-readonly'){");
 const end=controllerSource.indexOf(" if(request.operation==='theme-common-tests'){",start);
 assert.ok(start>=0&&end>start,'production dispatch branch missing');
 const dispatch=vm.runInNewContext('(async(request,host,dataRoot,runApprovedShadowReadOnly)=>{'+
  controllerSource.slice(start,end)+'})');
 const missing=Object.assign(new Error('missing'),{code:'SHADOW_SOURCE_NOT_APPROVED'});
 const response=await dispatch({operation:'theme-platform-shadow-readonly',sourceSha:SHA},null,null,
  async()=>{throw missing;});
 assert.equal(response.status,'BLOCKED');
 assert.equal(response.actualExecutionSha,null);
 assert.equal(response.candidateExecuted,false);
 assert.equal(response.requestedSourceSha,SHA);
 await assert.rejects(dispatch({operation:'theme-platform-shadow-readonly',sourceSha:SHA},null,null,
  async()=>{throw Object.assign(new Error('drift'),{code:'SHADOW_SOURCE_FILE_DRIFT'});}),
  {code:'SHADOW_SOURCE_FILE_DRIFT'});
});
