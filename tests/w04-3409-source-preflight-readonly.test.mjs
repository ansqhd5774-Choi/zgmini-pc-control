import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyW043409SourcePreflight,inspectW043409SourcePreflightReadonly}
 from '../tools/w04-3409-source-preflight-readonly.mjs';
const source='fcb098d20fb9a6c48f371786c69f7f1fdf5bc34a';
const hash='fdf3d2e1821e8429106072677f63f8abb86bf4d0d3ce16143da8ff08fb134e05';
const head='b8e866edf352a23117830dd9e8a545b652ccc06c';
const data=()=>({head,objectExit:0,ancestorExit:0,rootValid:true,toolHash:hash});
test('fixed W04 ancestry and local tool source ready only with all evidence',()=>{
 const v=classifyW043409SourcePreflight(data());
 assert.equal(v.status,'PASS');
 assert.equal(v.code,'SOURCE_READY_IN_RUNNER_WORKSPACE');
 assert.equal(v.sourceSha,source);
 assert.equal(v.operationalWrites,0);
 assert.equal(v.gitFetches,0);
 assert.equal(v.scope,'OPERATING_PC_ACTIONS_WORKSPACE_NOT_INDEPENDENT_OPERATOR');
});
for(const [label,values,code] of [
 ['object absent',{objectExit:128,ancestorExit:null},'SOURCE_OBJECT_ABSENT'],
 ['head behind',{ancestorExit:1},'SOURCE_HEAD_NOT_DESCENDANT'],
 ['tool changed',{toolHash:'0'.repeat(64)},'SOURCE_TOOL_BYTES_MISMATCH'],
 ['root wrong',{rootValid:false},'SOURCE_REPOSITORY_MISMATCH'],
 ['head unavailable',{head:null},'SOURCE_CHECK_UNVERIFIED'],
 ['git error',{objectExit:null},'SOURCE_CHECK_UNVERIFIED'],
]){
 test('W04 preflight classifies '+label,()=>{
  const v=classifyW043409SourcePreflight({...data(),...values});
  assert.equal(v.status,'UNVERIFIED');
  assert.equal(v.code,code);
 });
}
test('fixed probe passes no user commands and does not run source mutation',()=>{
 const args=[];
 const runGit=a=>{
  args.push(a);
  const sub=a[0];
  if(sub==='rev-parse'&&a[1]==='--show-toplevel')
   return {exitCode:0,stdout:'E:/ZGmini/projects/zgmini-pc-control'};
  if(sub==='rev-parse')return {exitCode:0,stdout:head};
  return {exitCode:0,stdout:''};
 };
 const r=inspectW043409SourcePreflightReadonly({runGit,readTool:()=>hash});
 assert.equal(r.code,'SOURCE_READY_IN_RUNNER_WORKSPACE');
 assert.deepEqual(args,[
  ['rev-parse','--show-toplevel'],
  ['rev-parse','--verify','HEAD^{commit}'],
  ['cat-file','-e',source+'^{commit}'],
  ['merge-base','--is-ancestor',source,'HEAD']
 ]);
 assert.equal(args.flat().some(x=>/fetch|reset|clean|checkout|push/i.test(x)),false);
});
test('object missing never checks ancestry or fabricates success',()=>{
 const args=[];
 const r=inspectW043409SourcePreflightReadonly({
  runGit:a=>{args.push(a);return a[0]==='cat-file'?
   {exitCode:128,stdout:'do not disclose internal Git stderr'}:
   {exitCode:0,stdout:a[1]==='--show-toplevel'?
    'E:/ZGmini/projects/zgmini-pc-control':head};},
  readTool:()=>hash
 });
 assert.equal(r.code,'SOURCE_OBJECT_ABSENT');
 assert.equal(args.some(a=>a[0]==='merge-base'),false);
 assert.equal(JSON.stringify(r).includes('internal Git stderr'),false);
});
