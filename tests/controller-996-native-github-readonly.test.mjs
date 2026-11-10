import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {create996NativeGitHubReadOnly} from '../tools/controller-996-native-github-readonly.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
function fixture(t,{login='ansqhd5774-Choi',privateRepo=true}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const calls=[];
 const commandApi=route=>{
  calls.push(route);
  if(route==='user')return {status:200,data:{login}};
  if(route===`repos/${repo}`)return {status:200,data:{full_name:repo,
   private:privateRepo}};
  if(route.includes('results/missing'))return {status:404,data:{}};
  return {status:200,data:[]};
 };
 const gateway=create996NativeGitHubReadOnly({root,testOnly:true,commandApi});
 return {gateway,calls,commandApi,root};
}

test('fixed account and private repository are authenticated before GET',t=>{
 const f=fixture(t);
 assert.throws(()=>f.gateway.get('issues?state=all&sort=created&direction=desc&per_page=100&page=1'),
  /C_GITHUB_READER_NOT_AUTHENTICATED/);
 assert.equal(f.calls.length,0);
 const verified=f.gateway.authenticateReadOnly();
 assert.equal(verified.actor,'ansqhd5774-Choi');
 assert.equal(verified.executionAuthorized,false);
 const result=f.gateway.get('issues?state=all&sort=created&direction=desc&per_page=100&page=1');
 assert.equal(result.status,200);
 assert.deepEqual(f.calls,['user',`repos/${repo}`,
  `repos/${repo}/issues?state=all&sort=created&direction=desc&per_page=100&page=1`]);
 assert.throws(()=>f.gateway.authenticateReadOnly(),/C_GITHUB_READER_ALREADY_AUTHENTICATED/);
});

test('only fixed issue/comments/results and original owner approval GET routes are allowlisted',t=>{
 const f=fixture(t);f.gateway.authenticateReadOnly();
 for(const route of [
  'issues/996',
  'issues/996/comments?per_page=100&page=1',
  `contents/docs/CONTROLLER_996_C_APPROVAL_R1.json?ref=${'a'.repeat(40)}`,
  'issues?state=all&sort=created&direction=desc&per_page=100&page=1',
  'issues/1270/comments?per_page=100&page=3',
  'contents/results/123456789-1-seat-2.json',
  'contents/results/123456789-1-seat-2.txt',
 ])assert.equal(f.gateway.get(route).status,200);
 const count=f.calls.length;
 for(const route of ['issues?since=2026-11-10',
  'issues/997','issues/996?x=1',
  'contents/docs/CONTROLLER_996_C_APPROVAL_R1.json?ref=main',
  'contents/docs/CONTROLLER_996_C_APPROVAL_R1.json?ref=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&x=1',
  'issues/1270/comments','issues/1270/comments?per_page=100&page=0',
  'contents/other/abc.json','issues/1270/comments?per_page=100&page=1&x=POST',
  '../contents/results/123456789-1-seat-2.json','actions/workflows/pc-job.yml/enable',
  'contents/results/123456789-1-seat-2.json?ref=other',
 ])assert.throws(()=>f.gateway.get(route),/C_GITHUB_GET_ROUTE_NOT_ALLOWLISTED/);
 assert.equal(f.calls.length,count);
});

test('different login, public repository or credential failure cannot authenticate',t=>{
 const a=fixture(t,{login:'github-actions[bot]'});
 assert.throws(()=>a.gateway.authenticateReadOnly(),/C_GITHUB_READER_IDENTITY_MISMATCH/);
 const b=fixture(t,{privateRepo:false});
 assert.throws(()=>b.gateway.authenticateReadOnly(),/C_GITHUB_READER_IDENTITY_MISMATCH/);
 const c=fixture(t);
 const bad=create996NativeGitHubReadOnly({testOnly:true,root:c.root,
  commandApi:()=>{throw Error('unauthorized');}});
 assert.throws(()=>bad.authenticateReadOnly(),/unauthorized/);
});

test('a 404 is accepted only for the exact fixed result path',t=>{
 const f=fixture(t);f.gateway.authenticateReadOnly();
 const route='contents/results/123456789-1-seat-2.txt';
 const g=create996NativeGitHubReadOnly({root:f.root,testOnly:true,
  commandApi:r=>r==='user'?{status:200,data:{login:'ansqhd5774-Choi'}}:
   r===`repos/${repo}`?{status:200,data:{full_name:repo,private:true}}:
   {status:404,data:{}}});
 g.authenticateReadOnly();
 assert.equal(g.get(route).status,404);
 assert.throws(()=>g.get('issues?state=all&sort=created&direction=desc&per_page=100&page=1'),
  /C_GITHUB_LIST_READ_FAILED/);
});

test('Linux or injected command API cannot masquerade as an original production PC',t=>{
 const f=fixture(t);
 assert.throws(()=>create996NativeGitHubReadOnly({root:f.root,testOnly:false,
  commandApi:f.commandApi}),/C_ORIGINAL_WINDOWS_AUTHENTICATED_READER_REQUIRED/);
 assert.throws(()=>create996NativeGitHubReadOnly({root:'/tmp',testOnly:true,
  commandApi:f.commandApi}),/C_GITHUB_TEST_ROOT_OR_PORT_REJECTED/);
});
