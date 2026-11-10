import test from 'node:test';
import assert from 'node:assert/strict';
import {create996AuthenticatedGithubGet} from '../tools/controller-996-authenticated-github-get.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const TOKEN='github-test-credential-only';
const user={login:OWNER,id:327938088};
const repository={id:1442936296,full_name:REPO,private:true,owner:user};
const prefix=`https://api.github.com/repos/${REPO}/`;
function fakeFetch({userData=user,repoData=repository,status=200,
  responseUrl=null,raw=null,throwOnFetch=false}={}){
  const seen=[];
  const f=async (url,opts)=>{
    seen.push({url,opts});
    if(throwOnFetch)throw Error('network failure mentioning private details');
    const value=url==='https://api.github.com/user'?userData:
      url===`https://api.github.com/repos/${REPO}`?repoData:
      url.startsWith('https://api.github.com/installation/repositories?')?
        {total_count:1,repositories:[repoData]}:{body:'test'};
    return {status,url:responseUrl??url,text:async()=>raw??JSON.stringify(value)};
  };
  return {f,seen};
}
async function ready(options={}){
  const {f,seen}=fakeFetch(options);
  const reader=create996AuthenticatedGithubGet({token:TOKEN,fetchImpl:f,
    identityMode:'owner-user',testOnly:true});
  const auth=await reader.authenticateReadOnly();
  return {reader,seen,auth};
}

test('authenticated GET uses exact owner id/private repository and only GET',async()=>{
  const {reader,seen,auth}=await ready();
  assert.deepEqual(auth,{kind:'OWNER_USER_GET',actor:OWNER,
    ownerAccountId:327938088,repository:REPO,repositoryId:1442936296,
    private:true,readOnly:true,executionAuthorized:false,testOnly:true});
  const issue=await reader.get('issues/996');
  assert.equal(issue.status,200);
  const comments=await reader.get('issues/996/comments?per_page=100&page=100');
  assert.equal(comments.status,200);
  const manifest=await reader.get(`contents/docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json?ref=${'a'.repeat(40)}`);
  assert.equal(manifest.status,200);
  assert.equal(seen.length,5);
  for(const entry of seen){
    assert.equal(entry.opts.method,'GET');
    assert.equal(entry.opts.redirect,'error');
    assert.equal(entry.opts.cache,'no-store');
    assert.equal(entry.opts.headers.Authorization,`Bearer ${TOKEN}`);
    assert.equal(entry.opts.headers.Accept,'application/vnd.github+json');
    assert.equal(entry.opts.headers['X-GitHub-Api-Version'],'2022-11-28');
  }
  assert.equal(seen[2].url,prefix+'issues/996');
  assert.equal(seen[4].url,prefix+`contents/docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json?ref=${'a'.repeat(40)}`);
  assert.deepEqual(Object.keys(reader).sort(),['authenticateReadOnly','get']);
});

test('no endpoint read before authentication',async()=>{
  const {f,seen}=fakeFetch();
  const reader=create996AuthenticatedGithubGet({token:TOKEN,fetchImpl:f,
    identityMode:'owner-user',testOnly:true});
  await assert.rejects(reader.get('issues/996'),/C_996_GITHUB_GET_NOT_AUTHENTICATED/);
  assert.equal(seen.length,0);
});

test('dangerous endpoints and query aliases reject before network',async()=>{
  const {reader,seen}=await ready();
  for(const path of [
    'issues/995','issues/996/comments','issues/996/comments?per_page=1&page=1',
    'issues/996/comments?per_page=100&page=101',
    'issues/996/comments?per_page=100&page=0',
    'issues/996/comments?page=1&per_page=100',
    'issues/996?state=open','../issues/996',
    '/issues/996','https://other.invalid/issue',
    'actions/workflows/maintenance.yml/dispatches',
    'issues/996/comments?per_page=100&page=1&unexpected=1',
    'contents/docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json?ref=main',
    'contents/docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json?ref='+ 'g'.repeat(40),
  ]){
    await assert.rejects(reader.get(path),/C_996_GITHUB_GET_ENDPOINT_NOT_ALLOWED/,path);
  }
  assert.equal(seen.length,2);
});

test('owner login/id mismatch, public repo, and wrong repository fail closed',async()=>{
  for(const fixture of [
    {userData:{...user,id:327938089}},
    {userData:{...user,login:'another-owner'}},
    {repoData:{...repository,private:false}},
    {repoData:{...repository,full_name:'other/repo'}},
    {repoData:{...repository,owner:{...user,id:1}}},
  ]){
    const {f,seen}=fakeFetch(fixture);
    const reader=create996AuthenticatedGithubGet({token:TOKEN,fetchImpl:f,
      identityMode:'owner-user',testOnly:true});
    await assert.rejects(reader.authenticateReadOnly(),/C_996_GITHUB_GET_ORIGIN_IDENTITY_MISMATCH/);
    await assert.rejects(reader.get('issues/996'),/C_996_GITHUB_GET_NOT_AUTHENTICATED/);
    assert.ok(seen.length>=1&&seen.length<=2);
  }
});

test('response drift, redirection, bad HTTP and malformed JSON are rejected',async()=>{
  for(const [options,expected] of [
    [{throwOnFetch:true},'C_996_GITHUB_GET_TRANSPORT_UNVERIFIED'],
    [{status:401},'C_996_GITHUB_GET_RESPONSE_UNVERIFIED'],
    [{responseUrl:'https://other.invalid/hop'},'C_996_GITHUB_GET_RESPONSE_UNVERIFIED'],
    [{raw:'not json'},'C_996_GITHUB_GET_JSON_INVALID'],
    [{raw:''},'C_996_GITHUB_GET_BODY_BOUNDS'],
    [{raw:'x'.repeat(8_000_001)},'C_996_GITHUB_GET_BODY_BOUNDS'],
  ]){
    const {f}=fakeFetch(options);
    const reader=create996AuthenticatedGithubGet({token:TOKEN,fetchImpl:f,
      identityMode:'owner-user',testOnly:true});
    await assert.rejects(reader.authenticateReadOnly(),new RegExp(expected));
  }
});

test('authentication is one-shot and does not expose token in errors',async()=>{
  const {reader,seen}=await ready();
  await assert.rejects(reader.authenticateReadOnly(),/C_996_GITHUB_GET_SESSION_REUSE_DENIED/);
  assert.equal(seen.length,2);
  const failed=create996AuthenticatedGithubGet({token:TOKEN,
    fetchImpl:async()=>{throw Error('secret '+TOKEN);},
    identityMode:'owner-user',testOnly:true});
  await assert.rejects(failed.authenticateReadOnly(),error=>{
    assert.equal(error.code,'C_996_GITHUB_GET_TRANSPORT_UNVERIFIED');
    assert.equal(error.message.includes(TOKEN),false);
    return true;
  });
  await assert.rejects(failed.authenticateReadOnly(),
    /C_996_GITHUB_GET_SESSION_REUSE_DENIED/);
});

test('invalid token, missing fetch, and timeout outside fixed bounds reject',()=>{
  assert.throws(()=>create996AuthenticatedGithubGet({token:'short'}),/C_996_GITHUB_GET_TOKEN_UNAVAILABLE/);
  assert.throws(()=>create996AuthenticatedGithubGet({token:TOKEN,fetchImpl:null}),/C_996_GITHUB_GET_CLIENT_INVALID/);
  assert.throws(()=>create996AuthenticatedGithubGet({token:TOKEN,timeoutMs:1}),/C_996_GITHUB_GET_CLIENT_INVALID/);
  assert.throws(()=>create996AuthenticatedGithubGet({token:TOKEN,
    fetchImpl:async()=>{}}),/C_996_GITHUB_GET_INJECTED_PORT_NOT_APPROVED/);
  assert.throws(()=>create996AuthenticatedGithubGet({token:TOKEN,
    identityMode:'unknown'}),/C_996_GITHUB_GET_IDENTITY_MODE_INVALID/);
});

test('bounded response streaming rejects oversized body before buffering it',async()=>{
  const oversized=new Uint8Array(8_000_001);
  const fake=async url=>({status:200,url,headers:{get:()=>null},
    body:new ReadableStream({start(controller){controller.enqueue(oversized);controller.close();}}),
    text:async()=>{throw Error('must use bounded stream');}});
  const reader=create996AuthenticatedGithubGet({token:TOKEN,
    fetchImpl:fake,testOnly:true,identityMode:'owner-user'});
  await assert.rejects(reader.authenticateReadOnly(),/C_996_GITHUB_GET_BODY_BOUNDS/);
});

test('default installation token authenticates repository access without GET /user',async()=>{
  const {f,seen}=fakeFetch();
  const reader=create996AuthenticatedGithubGet({token:TOKEN,
    fetchImpl:f,testOnly:true});
  const auth=await reader.authenticateReadOnly();
  assert.equal(auth.kind,'INSTALLATION_REPOSITORY_GET');
  assert.equal(auth.actor,'github-app-installation');
  assert.equal(auth.ownerAccountId,327938088);
  assert.equal(auth.repositoryId,1442936296);
  assert.equal(auth.executionAuthorized,false);
  assert.equal(seen.length,2);
  assert.equal(seen.some(x=>x.url.endsWith('/user')),false);
  assert.ok(seen[1].url.includes('/installation/repositories?per_page=100&page=1'));
});

test('installation token rejects missing, duplicate, inconsistent or drifted repository access',async()=>{
  for(const data of [
    {total_count:1,repositories:[]},
    {total_count:1,repositories:[{...repository,id:12}]},
    {total_count:2,repositories:[repository,repository]},
    {total_count:1,repositories:[{...repository,owner:{...user,id:3}}]},
  ]){
    const {f}=fakeFetch();
    const reader=create996AuthenticatedGithubGet({token:TOKEN,testOnly:true,
      fetchImpl:async (url,opt)=>url.includes('/installation/repositories?')?
        {status:200,url,text:async()=>JSON.stringify(data)}:f(url,opt)});
    await assert.rejects(reader.authenticateReadOnly(),
      /C_996_GITHUB_GET_INSTALLATION_/);
  }
});
