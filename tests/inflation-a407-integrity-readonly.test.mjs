import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {A407_ENTRY,stageA401Bundle} from '../controller/inflation-a401-private23-readonly.mjs';
import {summarizeA407,inspectA407IntegrityReadonly} from '../controller/inflation-a407-integrity-readonly.mjs';

const ORIGINAL=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
const CANDIDATE=['2','16','22','23','24','29'];
const FILES=[
 'lib/inflation-causal-candidates-public-7-catalog.mjs',
 'lib/inflation-causal-public-catalog.mjs',
 'scripts/pc-writer/inflation-a401-baseline23-readonly.mjs',
 A407_ENTRY,
 'scripts/pc-writer/inflation-causal-candidates-public-7-preview-r1.mjs',
 'scripts/pc-writer/inflation-causal-public-preview-r1.mjs',
 'worker/inflation-causal-candidates-public-7-r1.mjs',
 'worker/inflation-causal-public-r1.mjs'
];
const digest=b=>createHash('sha256').update(b).digest('hex');
const HASH='e'.repeat(64);
function row(id,candidate=false){
 const proof=candidate?'CANDIDATE_PARSED_AND_DOUBLE_READ_FINGERPRINT':
  ['12','13','14','19','1'].includes(id)?'PIT_SNAPSHOT_AND_CHUNKS_HASH_MATCHED':
  id==='18'?'SQLITE_BODY_DOUBLE_READ_FINGERPRINT':
  ['21','26'].includes(id)?'PARSED_AND_ARCHIVE_DOUBLE_READ_FINGERPRINT':
  id==='31'?'SCE_PARSED_WITH_REFERENCE_FINGERPRINT':
  'SOURCE_FILE_DOUBLE_READ_FINGERPRINT';
 const base={id,sha256:HASH,proof,secret:'should-never-appear'};
 if(proof==='PIT_SNAPSHOT_AND_CHUNKS_HASH_MATCHED')base.chunkCount=1;
 if(['21','26'].includes(id))base.archiveSha256=HASH;
 if(id==='31'){base.metadataSha256=HASH;base.archiveRefSha256=HASH;}
 return base;
}
function report(){return {
 status:'PASS',code:'A407_STORED_25_LOCAL_FINGERPRINTS_VERIFIED',
 expectedOriginal:19,expectedCandidate:6,originalVerified:19,candidateVerified:6,
 census:'MISSING',evidenceScope:'FIXED_PRIVATE_SOURCES_READONLY',
 original:ORIGINAL.map(id=>row(id)),candidate:CANDIDATE.map(id=>row(id,true)),
 checkpoints:{inflation19:{sha256:HASH,proof:'CHECKPOINT_FILE_DOUBLE_READ_FINGERPRINT'},
  candidates7:{sha256:HASH,proof:'CHECKPOINT_FILE_DOUBLE_READ_FINGERPRINT'}},
 providerCalls:0,d1Writes:0,sqliteWrites:0,sourceWrites:0,taskChanges:0,operationalWrites:0,
 originalRawValues:'never-public',token:'never-public'
};}
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'a407-controller-'));
 const workspace=path.join(root,'work'),bundle=path.join(root,'bundle'),sourceSha='a'.repeat(40);
 fs.mkdirSync(workspace);fs.mkdirSync(path.join(bundle,'source'),{recursive:true});
 const files={};
 for(const rel of FILES){
  const content=Buffer.from('// synthetic approved fixed source '+rel);
  const file=path.join(bundle,'source',rel);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);
  files[rel]=digest(content);
 }
 const manifest={schema:'ZGMINI_PC_SOURCE_BUNDLE_MANIFEST_V1',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha,sourceBranch:'main',
  entrypoint:A407_ENTRY,files};
 const bytes=Buffer.from(JSON.stringify(manifest));
 fs.writeFileSync(path.join(bundle,'manifest.json'),bytes);
 return {root,bundle,request:{sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha},
  context:{workspace,dataRoot:'E:/ZGmini/data',host:{approvedSources:{
   [sourceSha]:{root:bundle,branch:'main',entrypoint:A407_ENTRY,manifestSha256:digest(bytes)}}}}};
}
function cleanup(f){fs.rmSync(f.root,{recursive:true,force:true});}
test('projects only 19+6 fixed source hashes and 2 checkpoints without raw values',()=>{
 const r=summarizeA407(report());
 assert.equal(r.status,'PASS');assert.equal(r.original.length,19);
 assert.equal(r.candidate.length,6);assert.equal(Object.keys(r.checkpoints).length,2);
 assert.equal(r.sqliteReadOnly,true);
 assert.equal(JSON.stringify(r).includes('should-never-appear'),false);
 assert.equal(JSON.stringify(r).includes('never-public'),false);
});
for(const [name,edit] of Object.entries({
 duplicate:r=>r.original[0].id='3',
 originalMissing:r=>r.original.pop(),
 candidateMissing:r=>r.candidate.pop(),
 checksum:r=>r.original[0].sha256='not-a-hash',
 badProof:r=>r.original[0].proof='FAKE_PROVIDER_HASH',
 badPitChunks:r=>r.original[0].chunkCount=-1,
 wrongCensus:r=>r.census='READY',
 write:r=>r.d1Writes=1,
 provider:r=>r.providerCalls=1,
 noCheckpoint:r=>delete r.checkpoints.inflation19,
 falsePass:r=>r.originalVerified=18,
 partial:r=>r.status='PARTIAL'
}))test('rejects invalid A407 '+name,()=>{const r=report();edit(r);assert.throws(()=>summarizeA407(r));});
test('exact 8-file immutable B host bundle stages before execution, with minimal child environment',()=>{
 const f=fixture();try{
  let calls=0;
  const r=inspectA407IntegrityReadonly(f.request,f.context,{run:(node,args,options)=>{
   calls++;
   assert.ok(fs.existsSync(args[1]));assert.equal(path.basename(args[1]),path.basename(A407_ENTRY));
   assert.equal(options.shell,false);assert.equal(options.timeout,45000);
   assert.equal(Object.hasOwn(options.env,'GITHUB_TOKEN'),false);
   return {status:0,stdout:JSON.stringify(report())};
  }});
  assert.equal(r.status,'PASS');assert.equal(calls,1);
  assert.ok(fs.existsSync(path.join(f.context.workspace,'a407-approved-source',FILES[0])));
 }finally{cleanup(f);}
});
test('manifest cannot add an unapproved eighth-plus source file',()=>{
 const f=fixture();try{
  const file=path.join(f.bundle,'source','worker','unapproved.mjs');
  fs.writeFileSync(file,'// extra');
  const location=path.join(f.bundle,'manifest.json');
  const manifest=JSON.parse(fs.readFileSync(location,'utf8'));
  manifest.files['worker/unapproved.mjs']=digest(Buffer.from('// extra'));
  const bytes=Buffer.from(JSON.stringify(manifest));fs.writeFileSync(location,bytes);
  f.context.host.approvedSources[f.request.sourceSha].manifestSha256=digest(bytes);
  const r=inspectA407IntegrityReadonly(f.request,f.context,{run:()=>{
   assert.fail('unapproved bundle must never execute');}});
  assert.equal(r.status,'BLOCKED');assert.equal(r.code,'A407_BUNDLE_SCOPE');
 }finally{cleanup(f);}
});
test('source bytes drift blocks without executing child',()=>{
 const f=fixture();try{
  fs.appendFileSync(path.join(f.bundle,'source',A407_ENTRY),'// drift');
  const r=inspectA407IntegrityReadonly(f.request,f.context,{run:()=>{
   assert.fail('drift must never execute');}});
  assert.equal(r.status,'BLOCKED');assert.equal(r.code,'A407_READBACK_UNVERIFIED');
 }finally{cleanup(f);}
});
test('wrong data root and unregistered SHA are rejected',()=>{
 const f=fixture();try{
  const badRoot=inspectA407IntegrityReadonly(f.request,{...f.context,dataRoot:'C:/anywhere'});
  assert.equal(badRoot.code,'A407_DATA_ROOT_DENIED');
  const other=inspectA407IntegrityReadonly({...f.request,sourceSha:'b'.repeat(40)},f.context);
  assert.equal(other.status,'BLOCKED');
 }finally{cleanup(f);}
});
test('child failure/partial cannot become a successful A407 result',()=>{
 const f=fixture();try{
  const partial=inspectA407IntegrityReadonly(f.request,f.context,{run:()=>({
   status:1,stdout:JSON.stringify({...report(),status:'PARTIAL'})})});
  assert.equal(partial.status,'BLOCKED');
 }finally{cleanup(f);}
});
