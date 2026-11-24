import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,authorizeWriterBIssue,validateWriterBManifest,
  isScopedWriterPath,REQUEST_SCHEMA,APPROVAL_SCHEMA,OPERATION,SCOPE,
  CONTROL_REPO,SOURCE_REPO,ISSUE_TITLE,ISSUE_LABEL} from './contract.mjs';

const H=value=>sha256(Buffer.from(value));
const A='a'.repeat(40),B='b'.repeat(40);
export function manifest(){
 return {
  schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
  sourceRepository:SOURCE_REPO,sourceBranch:'fix/economic12-inflation-legacy4-r35-20261021',
  candidateSourceSha:B,baseHead:A,baseConfigSourceSha:A,
  sourceRoot:'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release',
  configPath:'E:\\ZGmini\\data\\pc-writer\\config.json',
  coreTask:'ZGMINI-PC-Local-Core',
  files:[
   {path:'scripts/pc-writer/run-local.mjs',change:'M',beforeSha256:H('old-local'),afterSha256:H('new-local')},
   {path:'scripts/pc-writer/inflation-causal-public-auto-publication-r1.mjs',
    change:'A',beforeSha256:null,afterSha256:H('new-publication')},
   {path:'scripts/pc-writer/inflation-causal-public-auto-publication-r1.test.mjs',
    change:'A',beforeSha256:null,afterSha256:H('new-test')},
  ],
  protectedFiles:[{path:'scripts/pc-writer/release-calendar.mjs',sha256:H('calendar')}],
  runtimeDependencies:{taskXmlSha256:'2'.repeat(64),consumers:[{
   id:'core-launcher',kind:'LAUNCHER',
   path:'E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs',
   sha256:H('approved-wrapper'),dependsOn:['scripts/pc-writer/run-local.mjs'],
  }]},
  runCount:1,allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
  allowTaskDefinitionChanges:false,allowOtherSourceChanges:false,
 };
}
const RID='01234567-89ab-4cde-8fab-0123456789ab';
const CID='11234567-89ab-4cde-8fab-1123456789ab';
const ENV={GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
 GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:A};
const EVENT={repository:{full_name:CONTROL_REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{user:{login:'ansqhd5774-Choi'},
 title:ISSUE_TITLE,labels:[{name:ISSUE_LABEL}],number:777}};
function authFixture(overrides={}){
 const m=manifest(),bytes=Buffer.from(JSON.stringify(m));
 const request={schema:REQUEST_SCHEMA,requestId:RID,chatId:CID,
  operation:OPERATION,controlRepository:CONTROL_REPO,
  approvalManifestPath:'approvals/writer-updates/inflation19-20261107.json',
  approvalManifestSha256:sha256(bytes)};
 return {manifest:m,manifestBytes:bytes,env:{...ENV},
  event:{...EVENT,issue:{...EVENT.issue,body:JSON.stringify(request)}},request,...overrides};
}

test('3-file Inflation19 manifest validates without hard-coded filename values',()=>{
 const m=manifest();assert.equal(validateWriterBManifest(m),m);
 const extra={...m,files:[...m.files,{path:'lib/extra-feature.mjs',change:'A',
   beforeSha256:null,afterSha256:H('future')}]};
 assert.equal(validateWriterBManifest(extra),extra);
});

test('reserved maintenance is exact opt-in bound to approved original Task XML',()=>{
 const m={...manifest(),coreMaintenance:'PAUSE_NEW_STARTS_DRAIN_360S_V1'};
 assert.equal(validateWriterBManifest(m),m);
 const longer={...m,coreMaintenance:'PAUSE_NEW_STARTS_DRAIN_1200S_V1'};
 assert.equal(validateWriterBManifest(longer),longer);
 for(const coreMaintenance of [true,'DISABLE','PAUSE_NEW_STARTS_DRAIN_999S_V1',
  'PAUSE_NEW_STARTS_DRAIN_1800S_V1',null])
  assert.throws(()=>validateWriterBManifest({...m,coreMaintenance}),
   {code:'WRITER_B_MAINTENANCE_APPROVAL_STOP'});
 assert.throws(()=>validateWriterBManifest({...m,runtimeDependencies:{
  ...m.runtimeDependencies,taskXmlSha256:null}}),
  {code:'WRITER_B_MAINTENANCE_APPROVAL_STOP'});
});

test('strict path scope and duplicate names prevent traversal and accidental targets',()=>{
 for(const candidate of ['../.env','scripts/pc-writer/../../secrets.mjs',
  'scripts/pc-writer/evil.cmd','E:\\ZGmini\\secrets.mjs','scripts/pc-writer/.hidden.mjs',
  'scripts/pc-writer/no.mjs/'] )assert.equal(isScopedWriterPath(candidate),false,candidate);
 assert.equal(isScopedWriterPath('scripts/pc-writer/feature-x.mjs'),true);
 assert.throws(()=>validateWriterBManifest({...manifest(),files:[
  ...manifest().files,{...manifest().files[0],path:'SCRIPTS/PC-WRITER/RUN-LOCAL.MJS'}]}),
  {code:'WRITER_B_FILE_DUPLICATE_STOP'});
});

test('scope refuses task/DB/D1 side effects, delete, overlaps and no-op targets',()=>{
 const m=manifest();
 assert.throws(()=>validateWriterBManifest({...m,allowProviderCalls:true}),
  {code:'WRITER_B_SIDE_EFFECT_SCOPE_STOP'});
 assert.throws(()=>validateWriterBManifest({...m,files:[
  {...m.files[0],change:'D'},...m.files.slice(1)]}),
  {code:'WRITER_B_FILE_CONTRACT_STOP'});
 assert.throws(()=>validateWriterBManifest({...m,files:[
  {...m.files[0],afterSha256:m.files[0].beforeSha256},...m.files.slice(1)]}),
  {code:'WRITER_B_NOOP_FILE_STOP'});
 assert.throws(()=>validateWriterBManifest({...m,protectedFiles:[
  {...m.protectedFiles[0],path:m.files[0].path}]}),
  {code:'WRITER_B_PROTECTED_OVERLAP_STOP'});
});

test('shared entrypoint requires only declared and hash-anchored runtime consumers',()=>{
 const m=manifest();
 assert.throws(()=>validateWriterBManifest({...m,
  runtimeDependencies:{taskXmlSha256:null,consumers:[]}}),
  {code:'WRITER_B_ENTRYPOINT_CONSUMER_MISSING_STOP'});
 assert.throws(()=>validateWriterBManifest({...m,
  runtimeDependencies:{taskXmlSha256:'2'.repeat(64),consumers:[
   {...m.runtimeDependencies.consumers[0],path:'E:\\outside\\not-allowed.vbs'}]}}),
  {code:'WRITER_B_RUNTIME_CONSUMER_STOP'});
 const unrelatedFeature={...m,files:[m.files[1]],
  runtimeDependencies:{taskXmlSha256:null,consumers:[]}};
 assert.equal(validateWriterBManifest(unrelatedFeature),unrelatedFeature);
});

test('GitHub B Issue authenticates private owner, exact id and raw manifest hash',()=>{
 const a=authFixture();const ok=authorizeWriterBIssue(a);
 assert.equal(ok.manifest.files.length,3);
 assert.equal(ok.requestId,RID);
 assert.equal(Object.isFrozen(ok.manifest),true);
 assert.equal(Object.isFrozen(ok.manifest.files[0]),true);
 assert.throws(()=>authorizeWriterBIssue({...a,manifestBytes:Buffer.from('{}')}),
  {code:'WRITER_B_MANIFEST_HASH_STOP'});
 assert.throws(()=>authorizeWriterBIssue({...a,env:{...a.env,GITHUB_RUN_ATTEMPT:'2'}}),
  {code:'WRITER_B_ISSUE_AUTH_STOP'});
 assert.throws(()=>authorizeWriterBIssue({...a,event:{...a.event,
  issue:{...a.event.issue,labels:[]}}}),{code:'WRITER_B_ISSUE_AUTH_STOP'});
 assert.throws(()=>authorizeWriterBIssue({...a,event:{...a.event,
  issue:{...a.event.issue,body:JSON.stringify({...a.request,
    approvalManifestPath:'../../unapproved.json'})}}}),
  {code:'WRITER_B_REQUEST_CONTRACT_STOP'});
});
