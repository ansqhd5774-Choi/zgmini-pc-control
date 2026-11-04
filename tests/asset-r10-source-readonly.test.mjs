import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectAssetR10SourceBytes,R10_SOURCE_FILES} from '../controller/asset-r10-source-readonly.mjs';

const SHA='a'.repeat(40);
const digest=s=>createHash('sha256').update(s).digest('hex');
function fixture(t){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'r10-source-a-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const root=path.join(temp,'ZGmini'),dataRoot=path.join(root,'data');
 const pc=path.join(dataRoot,'pc-writer');
 const checkout=path.join(root,'projects','zgmini-earnings-history-pc-release');
 fs.mkdirSync(pc,{recursive:true});fs.mkdirSync(checkout,{recursive:true});
 fs.writeFileSync(path.join(pc,'config.json'),JSON.stringify({source:SHA,
  credentials:'PRIVATE_TOKEN_NOT_TO_BE_PRINTED'}));
 const contents=['R10_PUBLIC_BYTE_A','R10_PUBLIC_BYTE_B'];
 const write=(relative,value)=>{
  const full=path.join(checkout,...relative.split('/'));
  fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,value);
  return full;
 };
 R10_SOURCE_FILES.forEach((file,index)=>write(file,contents[index]));
 const trace={sourceResolved:false,lastWriterEvidence:{sourceHead:SHA,status:'VERIFIED'},
  historicalCheckoutCandidate:{gitVerified:true,head:SHA,trackedDirty:false,
   sourceRoot:'projects/zgmini-earnings-history-pc-release'}};
 const inspect=(override={})=>inspectAssetR10SourceBytes(dataRoot,{
  strictPlatform:false,coreTaskXml:'<Task><Command>wscript.exe</Command></Task>',
  inspectSource:()=>({...trace,...override}),
 });
 return {temp,root,dataRoot,checkout,pc,trace,inspect,write,contents};
}

test('two exact R10 source byte hashes with separate historical/non-runtime labels',t=>{
 const f=fixture(t),result=f.inspect();
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'ASSET_R10_SOURCE_BYTES_READONLY');
 assert.equal(result.sourceCandidate.type,'HISTORICAL_CHECKOUT_ONLY');
 assert.equal(result.sourceIdentityConsistent,true);
 assert.equal(result.coreTaskSourceLinked,false);
 assert.equal(result.runtimeSourceVerified,false);
 assert.deepEqual(result.files,R10_SOURCE_FILES.map((file,i)=>({path:file,
  exists:true,sha256:digest(f.contents[i])})));
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);assert.equal(result.d1Writes,0);
 assert.equal(result.sqliteOpened,false);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_TOKEN_NOT_TO_BE_PRINTED|R10_PUBLIC_BYTE/);
});

test('unresolved Core task and no trusted checkout fail closed',t=>{
 const f=fixture(t),r=f.inspect({historicalCheckoutCandidate:null});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'ASSET_R10_CHECKOUT_NOT_RESOLVED');
 assert.equal(r.sourceCandidate,null);
 assert.equal(r.files.every(x=>x.sha256===null),true);
});

test('tracked dirty or mismatched Writer does not certify source identity',t=>{
 const f=fixture(t);
 f.trace.historicalCheckoutCandidate.trackedDirty=true;
 assert.equal(f.inspect().sourceIdentityConsistent,false);
 f.trace.historicalCheckoutCandidate.trackedDirty=false;
 assert.equal(f.inspect({lastWriterEvidence:{sourceHead:'b'.repeat(40),status:'VERIFIED'}})
  .sourceIdentityConsistent,false);
});

test('Task static link is distinct from actual runtime execution proof',t=>{
 const f=fixture(t),r=f.inspect({sourceResolved:true,
  sourceRoot:'projects/zgmini-earnings-history-pc-release',
  sourceHead:SHA,trackedDirty:[]});
 assert.equal(r.sourceCandidate.type,'CORE_TASK_STATIC_CHAIN');
 assert.equal(r.coreTaskSourceLinked,true);
 assert.equal(r.runtimeSourceVerified,false);
});

test('escaping checkout path, symlinked file and oversized file are rejected',t=>{
 const f=fixture(t);
 const bad=f.inspect({historicalCheckoutCandidate:{gitVerified:true,head:SHA,
  trackedDirty:false,sourceRoot:'projects/../../private'}});
 assert.equal(bad.status,'BLOCKED');
 const file=path.join(f.checkout,...R10_SOURCE_FILES[0].split('/'));
 fs.unlinkSync(file);
 const external=path.join(f.temp,'private');fs.writeFileSync(external,'PRIVATE_CONTENT');
 fs.symlinkSync(external,file);
 assert.equal(f.inspect().files[0].exists,false);
 const second=path.join(f.checkout,...R10_SOURCE_FILES[1].split('/'));
 fs.writeFileSync(second,'Z'.repeat(1_048_577));
 assert.equal(f.inspect().files[1].exists,false);
 assert.doesNotMatch(JSON.stringify(f.inspect()),/PRIVATE_CONTENT/);
});

test('incorrect or unapproved platform/root never explores arbitrary files',t=>{
 const f=fixture(t);
 assert.equal(inspectAssetR10SourceBytes('relative/path',{strictPlatform:false}).status,'BLOCKED');
 const other=path.join(f.temp,'Other','data');fs.mkdirSync(other,{recursive:true});
 assert.equal(inspectAssetR10SourceBytes(other,{strictPlatform:false,
  inspectSource:()=>{throw Error('MUST_NOT_CALL')}}).status,'BLOCKED');
});
