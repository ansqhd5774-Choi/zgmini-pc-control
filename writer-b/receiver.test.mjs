import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,APPROVAL_SCHEMA,SCOPE,SOURCE_REPO,CONTROL_REPO,
 OPERATION,REQUEST_SCHEMA,ISSUE_TITLE,ISSUE_LABEL} from './contract.mjs';
import {approvalPathFromIssue,verifyReadOnlyPreflight,
 writePreflightStopEvidence} from './preflight.mjs';
import {commitApprovedWriterBOverlay} from './git-stage.mjs';
import {validateWriterBReportEvent,sanitizeWriterBResult,
 uploadWriterBReport,readWriterBLocalResult} from './report.mjs';
import {snapshotUnrelatedDirty} from './unrelated-snapshot.mjs';
import {buildLocalOverlayProvenance,writeImmutableLocalProvenance} from './provenance.mjs';

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
  coreTask:'ZGMINI-PC-Local-Core',files,protectedFiles:[],
  runtimeDependencies:{taskXmlSha256:'2'.repeat(64),consumers:[{
   id:'core-launcher',kind:'LAUNCHER',
   path:'E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs',
   sha256:H('approved-wrapper'),dependsOn:['scripts/pc-writer/run-local.mjs'],
  }]},runCount:1,
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
function localInstalledResult(x){return {
 status:'WRITER_B_INSTALLED_VERIFIED',requestId:RID,sourceSha:CHILD,
 changedPaths:x.manifest.files.map(f=>f.path),
 mode:'LOCAL_OVERLAY',localOnly:true,baseHead:BASE,
 candidateSourceSha:CANDIDATE,manifestSha256:sha256(x.manifestBytes),
 baseTreeOid:'d'.repeat(40),preparedTreeOid:'e'.repeat(40),
 provenanceSha256:'f'.repeat(64),
};}

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

test('approval preflight preserves only its exact bounded stop in run TEMP',()=>{
 const env={RUNNER_TEMP:'/tmp/zgmini-writer-b-test',GITHUB_RUN_ID:'123456'};
 let writes=[];
 const fsOps={writeFileSync:(target,value,options)=>{
  writes.push({target,value,options});
  assert.deepEqual(options,{encoding:'utf8',flag:'wx'});
 }};
 assert.equal(writePreflightStopEvidence({env,
  code:'WRITER_B_MANIFEST_HASH_STOP',fsOps}),true);
 assert.equal(writes.length,1);
 assert.ok(writes[0].target.endsWith('writer-b-preflight-stop-123456.json'));
 assert.deepEqual(JSON.parse(writes[0].value),{
  status:'WRITER_B_SETUP_STOP',code:'WRITER_B_MANIFEST_HASH_STOP',
  runId:'123456'});
 assert.equal(writePreflightStopEvidence({env,
  code:'UNSAFE_RAW_KEY=secret',fsOps}),true);
 assert.equal(JSON.parse(writes[1].value).code,
  'WRITER_B_APPROVAL_PREFLIGHT_UNEXPECTED_STOP');
 assert.equal(writePreflightStopEvidence({env:{...env,GITHUB_RUN_ID:'../bad'},
  code:'WRITER_B_MANIFEST_HASH_STOP',fsOps}),false);
 assert.equal(writes.length,2);
});

test('reporter uses matching run-scoped preflight stop only when install output absent',()=>{
 const env={RUNNER_TEMP:'/tmp/zgmini-writer-b-test',GITHUB_RUN_ID:'123456'};
 const fsOps={readFileSync:filename=>{
  if(filename.endsWith('writer-b-install-result.json'))throw Error('ENOENT');
  return JSON.stringify({status:'WRITER_B_SETUP_STOP',
   code:'WRITER_B_APPROVAL_PATH_STOP',runId:'123456'});
 }};
 const raw=readWriterBLocalResult({env,fsOps});
 assert.equal(sanitizeWriterBResult(JSON.parse(raw),RID,'123456').code,
  'WRITER_B_APPROVAL_PATH_STOP');
 const stale={readFileSync:filename=>{
  if(filename.endsWith('writer-b-install-result.json'))throw Error('ENOENT');
  return JSON.stringify({status:'WRITER_B_SETUP_STOP',
   code:'WRITER_B_APPROVAL_PATH_STOP',runId:'old-run'});
 }};
 assert.equal(readWriterBLocalResult({env,fsOps:stale}),'{}');
 const malicious={readFileSync:filename=>{
  if(filename.endsWith('writer-b-install-result.json'))throw Error('ENOENT');
  return JSON.stringify({status:'WRITER_B_INSTALLED_VERIFIED',
   code:'WRITER_B_APPROVAL_PATH_STOP',runId:'123456'});
 }};
 assert.equal(readWriterBLocalResult({env,fsOps:malicious}),'{}');
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
 assert.equal(report.deliveryStatus,'RESULT_PAIR_READBACK_VERIFIED');
});

test('partial remote result evidence never produces a verified install comment',async()=>{
 const x=fixture();let comment='';
 const apiFetch=async(url,init)=>{
  if(init.method==='PUT')return {status:201};
  if(init.method==='GET')return {status:404};
  if(init.method==='POST'){
   comment=JSON.parse(init.body).body;return {status:201};
  }
 };
 const local=localInstalledResult(x);
 const report=await uploadWriterBReport({event:x.event,env:x.env,
  rawResult:JSON.stringify(local),apiFetch});
 assert.equal(report.status,'WRITER_B_INSTALLED_VERIFIED');
 assert.equal(report.deliveryStatus,'RESULT_DELIVERY_UNVERIFIED');
 assert.equal(report.verified,0);
 assert.ok(comment.includes('WRITER_B_STATE_UNKNOWN'));
 assert.equal(comment.includes('WRITER_B_INSTALLED_VERIFIED'),false);
});

test('source result requires provenance and labels local synthetic SHA never remote-published',()=>{
 const x=fixture(),valid=localInstalledResult(x);
 const approved=x.request.approvalManifestSha256;
 assert.equal(sanitizeWriterBResult(valid,RID,'123456',approved).localOnly,true);
 assert.equal(sanitizeWriterBResult(valid,RID,'123456',approved).mode,'LOCAL_OVERLAY');
 assert.equal(sanitizeWriterBResult(valid,RID,'123456').status,
  'WRITER_B_STATE_UNKNOWN','missing approval context cannot establish install');
 assert.equal(sanitizeWriterBResult({...valid,manifestSha256:'0'.repeat(64)},
  RID,'123456',approved).status,
  'WRITER_B_STATE_UNKNOWN','different but valid SHA64 is not an approved manifest');
 assert.equal(sanitizeWriterBResult({...valid,provenanceSha256:null},RID,'123456',approved).status,
  'WRITER_B_STATE_UNKNOWN');
 assert.equal(sanitizeWriterBResult({...valid,localOnly:false},RID,'123456',approved).status,
  'WRITER_B_STATE_UNKNOWN');
});

test('remote 2/2 reports install only for the exact approved raw manifest SHA',async()=>{
 const x=fixture();
 for(const approved of [true,false]){
  const created=new Map();let comment='';
  const apiFetch=async(url,init)=>{
   if(init.method==='PUT'){
    created.set(url,Buffer.from(JSON.parse(init.body).content,'base64').toString('utf8'));
    return {status:201};
   }
   if(init.method==='GET')return {status:200,json:async()=>({encoding:'base64',
    content:Buffer.from(created.get(url.replace('?ref=main',''))??'').toString('base64')})};
   if(init.method==='POST'){
    comment=JSON.parse(init.body).body;return {status:201};
   }
   throw Error('unexpected HTTP method');
  };
  const result=localInstalledResult(x);
  if(!approved)result.manifestSha256='0'.repeat(64);
  assert.notEqual('0'.repeat(64),x.request.approvalManifestSha256);
  const output=await uploadWriterBReport({event:x.event,env:x.env,
   rawResult:JSON.stringify(result),apiFetch});
  assert.equal(output.verified,2);
  assert.equal(output.deliveryStatus,'RESULT_PAIR_READBACK_VERIFIED');
  const json=[...created.entries()].find(([url])=>url.endsWith('.json'))?.[1];
  const remote=JSON.parse(json);
  const expected=approved?'WRITER_B_INSTALLED_VERIFIED':'WRITER_B_STATE_UNKNOWN';
  assert.equal(remote.status,expected);
  assert.equal(output.status,expected);
  assert.ok(comment.includes(`Writer B evidence: **${expected}**`));
  if(!approved){
   assert.equal(remote.sourceSha,null);
   assert.equal(remote.localOnly,null);
   assert.equal(comment.includes('WRITER_B_INSTALLED_VERIFIED'),false);
  }
 }
});

test('local overlay write-once provenance is flushed/read back before Task pause',()=>{
 const x=fixture();
 const auth=verifyReadOnlyPreflight({event:x.event,env:x.env,
  manifestBytes:x.manifestBytes,controlHead:BASE});
 const prepared={sha:CHILD,parent:BASE,changedPaths:x.manifest.files.map(f=>f.path),
  sha256:Object.fromEntries(x.manifest.files.map(f=>[f.path,f.afterSha256])),
  sourceRef:`refs/heads/writer-b/${RID}`};
 const proof=buildLocalOverlayProvenance({auth,prepared,
  baseTreeOid:'d'.repeat(40),preparedTreeOid:'e'.repeat(40)});
 assert.equal(proof.record.mode,'LOCAL_OVERLAY');
 assert.equal(proof.record.localOnly,true);
 assert.equal(proof.record.changedPaths.length,3);
 assert.equal(proof.record.manifestSha,x.request.approvalManifestSha256);
 const calls=[];let saved=null;
 const fsOps={
  openSync(file,flag){assert.equal(flag,'wx');calls.push('open');
   if(saved)throw Object.assign(new Error('duplicate'),{code:'EEXIST'});return 14;},
  writeSync(fd,bytes){assert.equal(fd,14);calls.push('write');saved=Buffer.from(bytes);return bytes.length;},
  fsyncSync(fd){assert.equal(fd,14);calls.push('fsync');},
  closeSync(fd){assert.equal(fd,14);calls.push('close');},
  readFileSync(){calls.push('readback');return saved;},
 };
 const file='E:\\writer-b-fixture\\provenance.json';
 assert.equal(writeImmutableLocalProvenance({file,bytes:proof.bytes,fsOps}),proof.sha256);
 assert.deepEqual(calls,['open','write','fsync','close','readback']);
 assert.throws(()=>writeImmutableLocalProvenance({file,bytes:proof.bytes,fsOps}),
  {code:'EEXIST'});
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

test('unrelated porcelain -z rename/copy attests both paths without a global R/C gate',()=>{
 const x=fixture();
 const status=Buffer.from('R  notes/new.txt\0notes/old.txt\0'+
  'C  copies/new.txt\0copies/original.txt\0');
 const contents=new Map([['notes/new.txt','new'],
  ['copies/new.txt','copy'],['copies/original.txt','copy']]);
 const relative=file=>file.slice('/some/checkout/'.length);
 const lstat=file=>{
  const data=contents.get(relative(file));
  if(data===undefined)throw Object.assign(new Error('missing'),{code:'ENOENT'});
  return {isFile:()=>true,isSymbolicLink:()=>false,isDirectory:()=>false,
   size:Buffer.byteLength(data),mtimeMs:100,ctimeMs:101,mode:33188,ino:1,dev:2};
 };
 const readFile=file=>Buffer.from(contents.get(relative(file)));
 const take=()=>snapshotUnrelatedDirty({sourceRoot:'/some/checkout',
  statusBytes:status,manifest:x.manifest,lstat,readFile});
 const original=take();
 assert.deepEqual(original.evidence.map(x=>[x.path,x.kind]),[
  ['notes/new.txt','file'],['notes/old.txt','deleted'],
  ['copies/new.txt','file'],['copies/original.txt','file']]);
 assert.deepEqual(take(),original);
 contents.set('notes/new.txt','NEW');
 assert.notDeepEqual(take(),original,'rename destination byte drift must be detected');
 contents.set('notes/new.txt','new');
 contents.set('copies/original.txt','COPY');
 assert.notDeepEqual(take(),original,'copy original byte drift must be detected');
});

test('rename/copy target or protected overlap on either name safely rejects',()=>{
 const x=fixture(),target=x.manifest.files[0].path;
 const protectedPath='scripts/pc-writer/release-calendar.mjs';
 const withProtected={...x.manifest,protectedFiles:[{path:protectedPath,sha256:H('calendar')}]};
 for(const [row,manifest] of [
  [`R  ${target}\0notes/old.txt\0`,x.manifest],
  [`R  notes/new.txt\0${target}\0`,x.manifest],
  [`C  notes/copy.txt\0${target}\0`,x.manifest],
  [`R  ${protectedPath}\0notes/old.txt\0`,withProtected],
  [`C  notes/copy.txt\0${protectedPath}\0`,withProtected],
 ])assert.throws(()=>snapshotUnrelatedDirty({sourceRoot:'/some/checkout',
   statusBytes:Buffer.from(row),manifest,
   lstat:()=>({isFile:()=>true,isSymbolicLink:()=>false,
    isDirectory:()=>false,size:2,mtimeMs:1,ctimeMs:1,mode:33188,ino:1,dev:1}),
   readFile:()=>Buffer.from('ok')}),{code:'WRITER_B_TARGET_DIRTY_STOP'});
});

test('truncated rename or copy porcelain -z is a safe format stop',()=>{
 const x=fixture();
 for(const bad of ['R  notes/new.txt\0','C  notes/new.txt\0',
  'R  notes/new.txt\0notes/old.txt'])
  assert.throws(()=>snapshotUnrelatedDirty({sourceRoot:'/some/checkout',
   statusBytes:Buffer.from(bad),manifest:x.manifest}),
   {code:'WRITER_B_DIRTY_PORCELAIN_FORMAT_STOP'});
});
