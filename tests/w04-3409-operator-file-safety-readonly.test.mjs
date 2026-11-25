import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {classify3409OperatorReadStrictFile,inspect3409OperatorFileSafetyReadonly}
 from '../tools/w04-3409-operator-file-safety-readonly.mjs';

const names=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
 'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
 'tools/update.mjs','tools/maintenance-ancestry.vbs',
 'tools/source-bundle-register.mjs'];
const stat=({type='file',links=1,size=500}={})=>({
 isFile:()=>type==='file',isSymbolicLink:()=>type==='symlink',
 nlink:links,size
});
const mock=({bad=null,manifestLinks=1,evil=false}={})=>{
 const root=path.resolve('E:/ZGmini/automation/pc-maintenance');
 const manifest={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  files:Object.fromEntries((evil?[...names,'../private']:names).map(k=>[k,'placeholder']))};
 let reads=0,stats=0;
 const fileSystem={
  lstatSync:p=>{
   stats++;
   if(p.endsWith('MAINTENANCE_INSTALL.json'))return stat({links:manifestLinks});
   if(bad&&p.replaceAll('\\','/').endsWith(bad))return stat({links:2});
   return stat();
  }
 };
 const read=(p,{verifiedRoot,minBytes,maxBytes})=>{
  reads++;
  assert.equal(p,path.join(root,'MAINTENANCE_INSTALL.json'));
  assert.equal(verifiedRoot,root);
  assert.equal(minBytes,1);assert.equal(maxBytes,32768);
  return {ok:true,bytes:Buffer.from(JSON.stringify(manifest))};
 };
 return {root,fileSystem,read,metrics:()=>({reads,stats})};
};
test('file label differentiates hardlink rejection, symlink, size and missing file',()=>{
 const f='E:/ZGmini/automation/pc-maintenance/MAINTENANCE_INSTALL.json';
 assert.equal(classify3409OperatorReadStrictFile(f,32768,{stat:()=>stat()}),
  'SAFE_BY_EXISTING_PREDICATE');
 assert.equal(classify3409OperatorReadStrictFile(f,32768,{stat:()=>stat({links:2})}),
  'LINK_COUNT_REJECTED');
 assert.equal(classify3409OperatorReadStrictFile(f,32768,{stat:()=>stat({links:0})}),
  'LINK_COUNT_REJECTED');
 assert.equal(classify3409OperatorReadStrictFile(f,32768,{stat:()=>stat({type:'symlink'})}),
  'NOT_REGULAR_OR_LINK');
 assert.equal(classify3409OperatorReadStrictFile(f,32768,{stat:()=>stat({size:40000})}),
  'SIZE_INVALID');
 assert.equal(classify3409OperatorReadStrictFile(f,32768,{stat:()=>{throw Object.assign(Error(),{code:'ENOENT'})}}),
  'FILE_MISSING');
});
test('exact installed manifest and files report first actual failed predicate without raw contents',()=>{
 const fixture=mock({bad:'tools/update.mjs'});
 const result=inspect3409OperatorFileSafetyReadonly(fixture);
 assert.equal(result.status,'PREFLIGHT_REJECTED');
 assert.equal(result.firstReject,'tools/update.mjs');
 assert.equal(result.files.length,names.length+1);
 assert.equal(result.files.find(x=>x.key==='tools/update.mjs').state,'LINK_COUNT_REJECTED');
 assert.equal(fixture.metrics().reads,1);
 assert.equal(result.operationalWrites,0);assert.equal(result.providerCalls,0);assert.equal(result.d1Writes,0);
 assert.doesNotMatch(JSON.stringify(result),/placeholder|nonce|private|token/i);
});
test('manifest itself can fail before any secondary installed checks',()=>{
 const result=inspect3409OperatorFileSafetyReadonly(mock({manifestLinks:2}));
 assert.equal(result.firstReject,'INSTALL_MANIFEST');
 assert.equal(result.status,'PREFLIGHT_REJECTED');
});
test('unsafe manifest names cannot be traversed',()=>{
 const fixture=mock({evil:true});
 const result=inspect3409OperatorFileSafetyReadonly(fixture);
 assert.equal(result.status,'UNVERIFIED');
 assert.equal(result.code,'OPERATOR_MANIFEST_FILE_SCOPE_UNVERIFIED');
 assert.equal(fixture.metrics().stats,1);
});
test('all exact original predicates accepted means no claimed operator recovery success',()=>{
 const x=inspect3409OperatorFileSafetyReadonly(mock());
 assert.equal(x.status,'PREFLIGHT_FILES_OK');
 assert.equal(x.firstReject,null);
 assert.equal(x.operationalWrites,0);
 assert.equal(Object.hasOwn(x,'recoveryAttempted'),false);
});

const readbackFixture=({updateBytes=171000,corruptUpdateHash=false,updateLinks=1}={})=>{
 const root=path.resolve('E:/ZGmini/automation/pc-maintenance');
 const data=Object.fromEntries(names.map(name=>[
  name,name==='tools/update.mjs'?Buffer.alloc(updateBytes,0x61):Buffer.from('fixed:'+name)
 ]));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const manifest={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
  files:Object.fromEntries(names.map(name=>[name,sha(data[name])]))};
 if(corruptUpdateHash)manifest.files['tools/update.mjs']='0'.repeat(64);
 const manifestBytes=Buffer.from(JSON.stringify(manifest));
 const rel=p=>p.replaceAll('\\','/').slice(root.replaceAll('\\','/').length+1);
 const fileSystem={
  lstatSync:p=>{
   const key=rel(p);
   if(key==='MAINTENANCE_INSTALL.json')return stat({size:manifestBytes.length});
   if(!Object.hasOwn(data,key))throw Error('unexpected path');
   return stat({size:data[key].length,links:key==='tools/update.mjs'?updateLinks:1});
  }
 };
 const read=(p,{verifiedRoot,minBytes,maxBytes})=>{
  assert.equal(verifiedRoot,root);
  assert.equal(minBytes,1);
  const key=rel(p);
  const bytes=key==='MAINTENANCE_INSTALL.json'?manifestBytes:data[key];
  assert.ok(Buffer.isBuffer(bytes),'only manifest and fixed allowlisted paths');
  assert.ok(bytes.length<=maxBytes,'bounded caller read limit');
  return {ok:true,bytes};
 };
 return {root,fileSystem,read};
};
test('corrected packet admits actual 171 KiB class update.mjs and verifies all manifest hashes',()=>{
 const r=inspect3409OperatorFileSafetyReadonly(readbackFixture());
 assert.equal(r.status,'PREFLIGHT_REJECTED'); // legacy fixed 128-KiB diagnostic remains untouched
 assert.equal(r.firstReject,'tools/update.mjs');
 assert.equal(r.correctedPacketReadback.status,'PREFLIGHT_FILE_BYTES_MATCH');
 assert.equal(r.correctedPacketReadback.observedUpdateBytes,171000);
 assert.equal(r.correctedPacketReadback.files.length,names.length);
 assert.ok(r.correctedPacketReadback.files.every(x=>x.state==='MANIFEST_HASH_MATCH'));
 assert.equal(r.correctedPacketReadback.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(r),/'sha256"|0x61|fixed:tools|0{64}/);
});
test('corrected packet readback refuses modified update source, excessive size, and linked file',()=>{
 for(const [scenario,expected] of [
  [{corruptUpdateHash:true},'MANIFEST_HASH_MISMATCH'],
  [{updateBytes:300000},'SIZE_INVALID'],
  [{updateLinks:2},'LINK_COUNT_REJECTED']
 ]){
  const r=inspect3409OperatorFileSafetyReadonly(readbackFixture(scenario));
  const proof=r.correctedPacketReadback;
  assert.equal(proof.status,'PREFLIGHT_UNVERIFIED');
  assert.equal(proof.firstReject,'tools/update.mjs');
  assert.equal(proof.files.find(x=>x.key==='tools/update.mjs').state,expected);
  assert.equal(proof.operationalWrites,0);
 }
});
