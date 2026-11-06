import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,APPROVAL_SCHEMA,SCOPE,SOURCE_REPO,CONTROL_REPO,
 OPERATION,REQUEST_SCHEMA,ISSUE_TITLE,ISSUE_LABEL} from './contract.mjs';
import {approvalPathFromIssue,verifyReadOnlyPreflight} from './preflight.mjs';
import {commitApprovedWriterBOverlay} from './git-stage.mjs';
import {validateWriterBReportEvent,sanitizeWriterBResult,
 uploadWriterBReport} from './report.mjs';
import {snapshotUnrelatedDirty} from './unrelated-snapshot.mjs';

const RID='01234567-89ab-4cde-8fab-0123456789ab';
const CID='11234567-89ab-4cde-8fab-1123456789ab';
const BASE='a'.repeat(40),CANDIDATE='b'.repeat(40),CHILD='c'.repeat(40);
const H=x=>sha256(Buffer.from(x));
function fixture(){
 const overlay=new Map([
  ['scripts/pc-writer/run-local.mjs',Buffer.from('new-local')],
  ['scripts/pc-writer/inflation-causal-public-auto-publication-r1.mjs',
   Buffer.from('new-publication')],
  ['scripts/pc-writer/inflation-causal-public-auto-publication-r1.test.mjs',
   Buffer.from('new-test')],
 ]);
 const files=[...overlay.entries()].map(([p,b],i)=>({path:p,
  change:i===0?'M':'A',beforeSha256:i===0?H('old-local'):null,
  afterSha256:sha256(b)}));
 const manifest={schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
  sourceRepository:SOURCE_REPO,sourceBranch:'main',candidateSourceSha:CANDIDATE,
  baseHead:BASE,baseConfigSourceSha:BASE,
  sourceRoot:'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release',
  configPath:'E:\\ZGmini\\data\\pc-writer\\config.json',
  coreTask:'ZGMINI-PC-Local-Core',files,protectedFiles:[],runCount:1,
  allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
  allowTaskDefinitionChanges:false,allowOtherSourceChanges:false};
 const manifestBytes=Buffer.from(JSON.stringify(manifest));
 const request={schema:REQUEST_SCHEMA,requestId:RID,chatId:CID,
  operation:OPERATION,controlRepository:CONTROL_REPO,
  approvalManifestPath:'approvals/writer-updates/inflation19.json',
  approvalManifestSha256:sha256(manifestBytes)};
 const event={action:'opened',repository:{full_name:CONTROL_REPO,private:true},
  sender:{login:'ansqhd5774-Choi'},issue:{number:721,
   title:ISSUE_TITLE,user:{login:'ansqhd5774-Choi'},
   labels:[{name:ISSUE_LABEL}],body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:BASE,GITHUB_RUN_ID:'123456',
  GITHUB_TOKEN:'fixture-secret-token-never-log'};
 return {manifest,manifestBytes,request,event,env,overlay};
}

test('owner Issue preflight derives candidate only from verified approval bytes',()=>{
 const x=fixture();
 assert.equal(approvalPathFromIssue(x.event),x.request.approvalManifestPath);
 const signed=verifyReadOnlyPreflight({event:x.event,env:x.env,
  manifestBytes:x.manifestBytes,controlHead:BASE});
 assert.equal(signed.manifest.candidateSourceSha,CANDIDATE);
 assert.throws(()=>verifyReadOnlyPreflight({event:x.event,
  env:x.env,manifestBytes:x.manifestBytes,controlHead:CHILD}),
  {code:'WRITER_B_CONTROL_SOURCE_DRIFT_STOP'});
 assert.throws(()=>verifyReadOnlyPreflight({event:x.event,
  env:x.env,manifestBytes:Buffer.from('{}'),controlHead:BASE}),
  {code:'WRITER_B_MANIFEST_HASH_STOP'});
});

test('exact overlay stages only three approved M/A paths and request-local ref',()=>{
 const x=fixture();const calls=[];
 const run=(stage,...args)=>{
  calls.push(args[0]);
  if(args[0]==='write-tree')return 'd'.repeat(40);
  if(args[0]==='diff-tree')return x.manifest.files.map(f=>
   `${f.change}\t${f.path}`).join('\n');
  if(args[0]==='rev-parse')return CHILD;
  return '';
 };
 const runRaw=(stage,args,{stdin}={})=>{
  if(args[0]==='hash-object')return Buffer.from('e'.repeat(40));
  if(args[0]==='commit-tree')return Buffer.from(CHILD);
  if(args[0]==='cat-file')return Buffer.from('commit');
  if(args[0]==='show')return x.overlay.get(args[1].slice(CHILD.length+1));
  throw Error(args[0]);
 };
 const ref=`refs/heads/writer-b/${RID}`;
 const result=commitApprovedWriterBOverlay({stage:'TEMP_STAGE',base:BASE,
  manifestFiles:x.manifest.files,overlay:x.overlay,requestRef:ref,run,runRaw});
 assert.equal(result.sha,CHILD);
 assert.equal(result.parent,BASE);
 assert.deepEqual(result.changedPaths,x.manifest.files.map(f=>f.path));
 assert.equal(calls.filter(x=>x==='update-index').length,3);
 assert.equal(calls.filter(x=>x==='update-ref').length,1);
});

test('overlay rejects unexpected files, unapproved hashes, and fixed R17 refs',()=>{
 const x=fixture();const noop=()=>{throw Error('should not reach git');};
 assert.throws(()=>commitApprovedWriterBOverlay({stage:'TEMP_STAGE',base:BASE,
  manifestFiles:x.manifest.files,overlay:new Map([...x.overlay,
   ['scripts/pc-writer/extra.mjs',Buffer.from('bad')]]),
  requestRef:`refs/heads/writer-b/${RID}`,run:noop,runRaw:noop}),
  {code:'WRITER_B_STAGE_CONTRACT_STOP'});
 const wrong=new Map(x.overlay);wrong.set(x.manifest.files[0].path,Buffer.from('wrong'));
 assert.throws(()=>commitApprovedWriterBOverlay({stage:'TEMP_STAGE',base:BASE,
  manifestFiles:x.manifest.files,overlay:wrong,
  requestRef:`refs/heads/writer-b/${RID}`,run:noop,runRaw:noop}),
  {code:'WRITER_B_STAGE_OVERLAY_HASH_STOP'});
 assert.throws(()=>commitApprovedWriterBOverlay({stage:'TEMP_STAGE',base:BASE,
  manifestFiles:x.manifest.files,overlay:x.overlay,
  requestRef:`refs/heads/r17-writer-b/${RID}`,run:noop,runRaw:noop}),
  {code:'WRITER_B_STAGE_CONTRACT_STOP'});
});

test('reporter refuses arbitrary Issue and does not inflate setup to installed',()=>{
 const x=fixture();
 assert.equal(validateWriterBReportEvent(x.event,x.env).requestId,RID);
 assert.throws(()=>validateWriterBReportEvent({ ...x.event,issue:{...x.event.issue,
  labels:[]}},x.env),{code:'WRITER_B_REPORT_EVENT_STOP'});
 assert.equal(sanitizeWriterBResult({status:'WRITER_B_SETUP_STOP',
  code:'WRITER_B_APPROVAL_PATH_STOP'},RID,'123456').status,
  'WRITER_B_SETUP_STOP');
 assert.equal(sanitizeWriterBResult({status:'WRITER_B_INSTALLED_VERIFIED',
  sourceSha:CHILD,requestId:'wrong',changedPaths:['lib/a.mjs']},RID,'123456').status,
  'WRITER_B_STATE_UNKNOWN');
});

test('one-shot reporter uses create-only, checks back, comments without raw data',async()=>{
 const x=fixture(),created=new Map();
 const apiFetch=async(url,init)=>{
  if(init.method==='PUT'){
   const body=JSON.parse(init.body);
   assert.equal(Object.hasOwn(body,'sha'),false);
   created.set(url,Buffer.from(body.content,'base64').toString('utf8'));
   return {status:201};
  }
  if(init.method==='GET')return {status:200,json:async()=>({encoding:'base64',
   content:Buffer.from(created.get(url.replace('?ref=main',''))??'').toString('base64')})};
  if(init.method==='POST'){
   const body=JSON.parse(init.body).body;
   assert.equal(body.includes(x.env.GITHUB_TOKEN),false);
   return {status:201};
  }
  throw Error(init.method);
 };
 const report=await uploadWriterBReport({event:x.event,env:x.env,
  rawResult:JSON.stringify({status:'WRITER_B_PREFLIGHT_STOP',
   code:'WRITER_B_CANDIDATE_HASH_STOP',requestId:RID}),apiFetch});
 assert.deepEqual({status:report.status,created:report.created,verified:report.verified},
  {status:'WRITER_B_PREFLIGHT_STOP',created:2,verified:2});
});

test('unrelated large untracked file is metadata-only and never global size gate',()=>{
 const x=fixture();let readCount=0;
 const status=Buffer.from('?? scratch/large-archive.bin\0 M notes/ongoing.txt\0');
 const stat=file=>({isFile:()=>true,isSymbolicLink:()=>false,
  isDirectory:()=>false,size:file.includes('large-archive')?2_000_000_000:12,
  mtimeMs:100,ctimeMs:101,mode:33188,ino:4,dev:6});
 const readFile=file=>{readCount++;
  assert.ok(file.endsWith('notes/ongoing.txt'));return Buffer.from('ongoing user');};
 const a=snapshotUnrelatedDirty({sourceRoot:'/some/checkout',statusBytes:status,
  manifest:x.manifest,lstat:stat,readFile});
 assert.equal(a.evidence.length,2);
 assert.equal(a.evidence[0].sha256,undefined);
 assert.equal(readCount,1);
 assert.deepEqual(snapshotUnrelatedDirty({sourceRoot:'/some/checkout',
  statusBytes:status,manifest:x.manifest,lstat:stat,readFile}),a);
});

test('target dirty remains strict rejection regardless of unrelated size',()=>{
 const x=fixture();
 assert.throws(()=>snapshotUnrelatedDirty({sourceRoot:'/some/checkout',
  statusBytes:Buffer.from(' M scripts/pc-writer/run-local.mjs\0'),
  manifest:x.manifest,lstat:()=>{throw Error('must not stat target');}}),
  {code:'WRITER_B_TARGET_DIRTY_STOP'});
});
