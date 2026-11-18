import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import os from'node:os';import path from'node:path';import{createHash}from'node:crypto';
import{A401_ENTRY,summarizeA401,stageA401Bundle,inspectA401Private23}from'../controller/inflation-a401-private23-readonly.mjs';
const ids=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
function report(){const rows=a=>a.map(id=>({id,status:'PRESENT_VALID',value:123,secret:'do-not-emit'}));return{status:'PASS',expected:23,originalReady:19,additionalReady:4,verified:23,original:rows(ids),additional:rows(['2','16','24','29']),providerCalls:0,sqliteWrites:0,d1Writes:0,sourceWrites:0,taskChanges:0};}
test('projects only fixed 23 IDs/status/counts and strips child values and unrelated fields',()=>{
 const r=summarizeA401(report());assert.equal(r.status,'PASS');assert.equal(r.verified,23);assert.equal(r.sqliteReadOnly,true);
 assert.equal(JSON.stringify(r).includes('do-not-emit'),false);assert.equal(JSON.stringify(r).includes('value'),false);
});
for(const[name,change]of Object.entries({duplicate:r=>r.original[0].id='3',count:r=>r.verified=22,missing:r=>r.additional.pop(),writes:r=>r.sqliteWrites=1,provider:r=>r.providerCalls=1,falsePass:r=>r.original[0].status='UNVERIFIED'}))test('rejects inconsistent '+name,()=>{const r=report();change(r);assert.throws(()=>summarizeA401(r));});
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'a401-bundle-')),workspace=path.join(root,'work'),bundle=path.join(root,'bundle');fs.mkdirSync(workspace);fs.mkdirSync(path.join(bundle,'source/scripts/pc-writer'),{recursive:true});const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=Buffer.from('// isolated approved fixture only');fs.writeFileSync(path.join(bundle,'source',A401_ENTRY),bytes);const sourceSha='a'.repeat(40),m={sourceSha,sourceBranch:'main',entrypoint:A401_ENTRY,files:{[A401_ENTRY]:sha(bytes)}};const raw=Buffer.from(JSON.stringify(m));fs.writeFileSync(path.join(bundle,'manifest.json'),raw);return{root,bundle,request:{sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha},context:{workspace,dataRoot:'E:/ZGmini/data',host:{approvedSources:{[sourceSha]:{root:bundle,branch:'main',entrypoint:A401_ENTRY,manifestSha256:sha(raw)}}}}};}
test('requires B registered source bundle and copies exact bytes to workspace before child execution',()=>{const f=fixture();try{let called=false;const r=inspectA401Private23(f.request,f.context,{run:(node,args,options)=>{called=true;assert.ok(fs.existsSync(args[1]));assert.equal(Object.hasOwn(options.env,'GITHUB_TOKEN'),false);assert.equal(options.shell,false);return{status:0,stdout:JSON.stringify(report())};}});assert.equal(called,true);assert.equal(r.status,'PASS');}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
test('source file drift blocks before invoking any child',()=>{const f=fixture();try{fs.appendFileSync(path.join(f.bundle,'source',A401_ENTRY),'// changed');let calls=0;const r=inspectA401Private23(f.request,f.context,{run:()=>{calls++;}});assert.equal(calls,0);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'A401_SOURCE_BYTES_DRIFT');}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
test('arbitrary request cannot use an unregistered app checkout',()=>{const f=fixture();try{assert.throws(()=>stageA401Bundle({...f.request,sourceSha:'b'.repeat(40)},f.context),{code:'A401_BUNDLE_NOT_APPROVED'});}finally{fs.rmSync(f.root,{recursive:true,force:true});}});

test('another host data root cannot silently read the fixed operating PC root',()=>{const f=fixture();try{f.context.dataRoot='C:/other-data';let calls=0;const r=inspectA401Private23(f.request,f.context,{run:()=>{calls++;}});assert.equal(calls,0);assert.equal(r.code,'A401_DATA_ROOT_DENIED');}finally{fs.rmSync(f.root,{recursive:true,force:true});}});

function addSyntheticBundleFiles(f, extraFiles){
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const manifestPath=path.join(f.bundle,'manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 for(const[relativePath,text]of Object.entries(extraFiles)){
  const bytes=Buffer.from(text),file=path.join(f.bundle,'source',relativePath);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,bytes);
  manifest.files[relativePath]=sha(bytes);
 }
 const raw=Buffer.from(JSON.stringify(manifest));
 fs.writeFileSync(manifestPath,raw);
 f.context.host.approvedSources[f.request.sourceSha].manifestSha256=sha(raw);
 return manifest;
}
const w01ClosureSix={
 'lib/inflation-causal-candidates-public-7-catalog.mjs':'// synthetic catalog fixture',
 'lib/inflation-causal-public-catalog.mjs':'// synthetic public catalog fixture',
 'scripts/pc-writer/inflation-causal-candidates-public-7-preview-r1.mjs':'// synthetic candidate preview fixture',
 'scripts/pc-writer/inflation-causal-public-preview-r1.mjs':'// synthetic preview fixture',
 'worker/inflation-causal-candidates-public-7-r1.mjs':'// synthetic candidate worker fixture',
 'worker/inflation-causal-public-r1.mjs':'// synthetic public worker fixture'
};
test('fixed seven-file W01 closure stages precisely the two required worker contracts',()=>{
 const f=fixture();try{
  const manifest=addSyntheticBundleFiles(f,w01ClosureSix);
  assert.equal(Object.keys(manifest.files).length,7);
  const staged=stageA401Bundle(f.request,f.context);
  for(const[relativePath,fixtureText]of Object.entries(w01ClosureSix)){
   assert.equal(fs.readFileSync(path.join(staged.cwd,relativePath),'utf8'),fixtureText);
  }
  assert.ok(fs.existsSync(staged.entry));
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('unlisted worker module is blocked even with internally consistent manifest digest',()=>{
 const f=fixture();try{
  addSyntheticBundleFiles(f,{'worker/other.mjs':'// denied synthetic module'});
  assert.throws(()=>stageA401Bundle(f.request,f.context),{code:'A401_BUNDLE_PATH'});
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('approved worker module byte drift blocks before child execution',()=>{
 const f=fixture();try{
  addSyntheticBundleFiles(f,w01ClosureSix);
  fs.appendFileSync(path.join(f.bundle,'source','worker/inflation-causal-public-r1.mjs'),'// drift');
  let calls=0;
  const result=inspectA401Private23(f.request,f.context,{run:()=>{calls++;}});
  assert.equal(calls,0);assert.equal(result.status,'BLOCKED');assert.equal(result.code,'A401_SOURCE_BYTES_DRIFT');
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
