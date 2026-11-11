import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {create996InstalledGhGetReadOnly} from
  '../tools/controller-996-c-installed-gh-get-readonly.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
function fixture(t,override={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),
    'zgmini-996-test-gh-readonly-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const seen=[];
  const run=(file,args,options)=>{
    seen.push({file,args,options});
    const route=args[args.length-1];
    if(route==='user')return JSON.stringify({login:OWNER,id:327938088});
    if(route===`repos/${REPO}`)return JSON.stringify({
      id:1442936296,full_name:REPO,private:true,
      owner:{login:OWNER,id:327938088},
    });
    if(override[route])return JSON.stringify(override[route]);
    return JSON.stringify({number:996,state:'open'});
  };
  const client=create996InstalledGhGetReadOnly({testOnly:true,testRoot:root,run});
  return {root,client,seen};
}

test('only fixed gh.exe GET routes, no shell, no token or mutation',async t=>{
  const {client,seen}=fixture(t);
  const auth=await client.authenticateReadOnly();
  assert.equal(auth.kind,'OWNER_USER_GET');
  assert.equal(auth.testOnly,true);
  assert.equal(auth.executionAuthorized,false);
  const issue=await client.get('issues/996');
  assert.equal(issue.status,200);
  await client.get('issues/996/comments?per_page=100&page=1');
  await client.get('contents/docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json?ref='+
    'a'.repeat(40));
  assert.equal(seen.length,5);
  for(const call of seen){
    assert.equal(call.file,'C:/Program Files/GitHub CLI/gh.exe');
    assert.deepEqual(call.args.slice(0,3),['api','--method','GET']);
    assert.equal(call.options.shell,undefined);
    assert.equal(call.options.windowsHide,true);
  }
});

test('rejects unlisted endpoints and repeated authentication',async t=>{
  const {client,seen}=fixture(t);
  await assert.rejects(client.get('issues/996'),
    /C_996_INSTALLED_GH_GET_NOT_AUTHORIZED/);
  await client.authenticateReadOnly();
  await assert.rejects(client.get('issues/996/comments?per_page=100&page=101'),
    /C_996_INSTALLED_GH_GET_NOT_AUTHORIZED/);
  await assert.rejects(client.get('actions/workflows/pc-job.yml'),
    /C_996_INSTALLED_GH_GET_NOT_AUTHORIZED/);
  await assert.rejects(client.authenticateReadOnly(),
    /C_996_INSTALLED_GH_AUTH_REUSED/);
  assert.equal(seen.length,2);
});

test('fixed workflow GET authenticates owner and repository without generic route expansion',async t=>{
  const endpoint=`repos/${REPO}/actions/workflows/pc-job.yml`;
  const {client,seen}=fixture(t,{[endpoint]:{
    id:23123,path:'.github/workflows/pc-job.yml',state:'active',
  }});
  assert.equal(client.readWorkflowStateReadOnly(),'active');
  assert.equal(seen.length,3);
  for(const call of seen){
    assert.deepEqual(call.args.slice(0,3),['api','--method','GET']);
  }
  await assert.rejects(client.get('actions/workflows/pc-job.yml'),
    /C_996_INSTALLED_GH_GET_NOT_AUTHORIZED/);
  await assert.rejects(client.authenticateReadOnly(),
    /C_996_INSTALLED_GH_AUTH_REUSED/);
});

test('missing or disabled workflow cannot pass the fixed GET reader',t=>{
  const endpoint=`repos/${REPO}/actions/workflows/pc-job.yml`;
  for(const value of [
    {id:23123,path:'.github/workflows/pc-job.yml',state:'disabled_manually'},
    {id:23123,path:'other.yml',state:'active'},
    {path:'.github/workflows/pc-job.yml',state:'active'},
  ]){
    const {client}=fixture(t,{[endpoint]:value});
    assert.throws(()=>client.readWorkflowStateReadOnly(),
      /C_996_INSTALLED_GH_WORKFLOW_STATE_UNVERIFIED/);
  }
});

test('cannot use production entrypoint or arbitrary synthetic path on Linux',()=>{
  assert.throws(()=>create996InstalledGhGetReadOnly(),
    /C_996_INSTALLED_GH_ORIGINAL_WINDOWS_ONLY/);
  assert.throws(()=>create996InstalledGhGetReadOnly({testOnly:true,
    testRoot:'/tmp',run:()=>{}}),/C_996_INSTALLED_GH_TEST_ROOT_INVALID/);
});

const repoRoute=route=>`repos/${REPO}/${route}`;
const runner=(id,labels=['self-hosted','Windows','X64','zgmini-pc-control'])=>({
  id,name:`zgmini-pc-${String(id).padStart(2,'0')}`,status:'offline',busy:false,
  labels:labels.map((name,n)=>({id:1000+id*100+n,name,type:'read-only'})),
});
test('fixed Runner GET normalizes label objects but never expands generic consent GET',async t=>{
  const route=repoRoute('actions/runners?per_page=100&page=1');
  const {client,seen}=fixture(t,{[route]:{total_count:2,runners:[runner(1),runner(2)]}});
  const out=client.readPcJobRunnersReadOnly();
  assert.equal(out.status,'RUNNER_INVENTORY_GET_ONLY');
  assert.equal(out.totalCount,2);
  assert.deepEqual(out.runners[0].labels,
    ['self-hosted','Windows','X64','zgmini-pc-control']);
  assert.equal(out.executionAuthorized,false);
  await assert.rejects(client.get('actions/runners?per_page=100&page=1'),
    /C_996_INSTALLED_GH_GET_NOT_AUTHORIZED/);
  assert.equal(seen.length,3);
  assert.ok(seen.every(x=>x.args[1]==='--method'&&x.args[2]==='GET'));
});
test('Runner reader requires complete pagination, stable count and unique IDs',t=>{
  const route1=repoRoute('actions/runners?per_page=100&page=1');
  const route2=repoRoute('actions/runners?per_page=100&page=2');
  const hundred=Array.from({length:100},(_,i)=>runner(i+1));
  const {client}=fixture(t,{[route1]:{total_count:101,runners:hundred},
    [route2]:{total_count:101,runners:[runner(101)]}});
  const out=client.readPcJobRunnersReadOnly();
  assert.equal(out.runners.length,101);
  const {client:missing}=fixture(t,{[route1]:{total_count:101,runners:hundred}});
  assert.throws(()=>missing.readPcJobRunnersReadOnly(),
    /C_996_INSTALLED_GH_PAGE_INVALID/);
  const {client:duplicate}=fixture(t,{[route1]:{total_count:2,runners:[runner(1),runner(1)]}});
  assert.throws(()=>duplicate.readPcJobRunnersReadOnly(),
    /C_996_INSTALLED_GH_RUNNER_ROW_INVALID/);
});
test('Runner reader rejects malformed GH label objects, status and count',t=>{
  const route=repoRoute('actions/runners?per_page=100&page=1');
  for(const bad of [
    {...runner(1),labels:['Windows']},
    {...runner(1),status:'unknown'},
    {...runner(1),busy:'false'},
    {...runner(1),labels:[{id:1,name:'Windows'},{id:2,name:'Windows'}]},
  ]){
    const {client}=fixture(t,{[route]:{total_count:1,runners:[bad]}});
    assert.throws(()=>client.readPcJobRunnersReadOnly(),
      /C_996_INSTALLED_GH_RUNNER_(?:ROW|LABEL)_INVALID/);
  }
  const {client:badCount}=fixture(t,{[route]:{total_count:-1,runners:[]}});
  assert.throws(()=>badCount.readPcJobRunnersReadOnly(),
    /C_996_INSTALLED_GH_PAGE_INVALID/);
});
test('three fixed workflow run-status GETs authenticate, count and deny generic route',async t=>{
  const overrides={};
  for(const [status,id] of [['queued',1],['in_progress',2],['waiting',3]]){
    overrides[repoRoute(`actions/workflows/pc-job.yml/runs?status=${status}&per_page=100&page=1`)]=
      {total_count:1,workflow_runs:[{id,status,event:'issues'}]};
  }
  const {client,seen}=fixture(t,overrides);
  const out=client.readPcJobRunsReadOnly();
  assert.deepEqual(out.counts,{queued:1,in_progress:1,waiting:1});
  assert.equal(out.executionAuthorized,false);
  await assert.rejects(client.get('actions/workflows/pc-job.yml/runs?status=queued&per_page=100&page=1'),
    /C_996_INSTALLED_GH_GET_NOT_AUTHORIZED/);
  assert.equal(seen.length,5);
});
test('workflow run evidence with wrong event, status or partial response blocks',t=>{
  const route=repoRoute('actions/workflows/pc-job.yml/runs?status=queued&per_page=100&page=1');
  for(const bad of [
    {total_count:1,workflow_runs:[{id:1,status:'completed',event:'issues'}]},
    {total_count:1,workflow_runs:[{id:1,status:'queued',event:'pull_request'}]},
    {total_count:3,workflow_runs:[{id:1,status:'queued',event:'issues'}]},
  ]){
    const {client}=fixture(t,{[route]:bad});
    assert.throws(()=>client.readPcJobRunsReadOnly(),
      /C_996_INSTALLED_GH_(?:WORKFLOW_RUN_INVALID|RUN_PAGINATION_INCOMPLETE)/);
  }
});
