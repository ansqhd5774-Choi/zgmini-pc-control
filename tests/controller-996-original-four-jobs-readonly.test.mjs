import test from 'node:test';
import assert from 'node:assert/strict';
import {create996FourOriginalJobsReadOnlyReader} from
  '../tools/controller-996-original-four-jobs-readonly.mjs';

const OWNER='ansqhd5774-Choi';
const entries=[
  [1217,'pc-8da91b23-f5d6-4a94-bcd5-13b0dfcdee61',
    'chat-67a52680-bdae-4afb-8047-7dee6264e503','core-runtime-source-readonly'],
  [1219,'pc-e2710720-1a35-4a75-ab37-4940ecd33edd',
    'chat-a6d121b8-b770-4dcd-a4ca-26a6cae3e531','core-runtime-source-readonly'],
  [1226,'pc-60ed9565-9b87-4099-a4d2-db9235a3cfd4',
    'chat-fed29d4e-d3da-4363-a1b8-398da674d6a5','core-status'],
  [1227,'pc-6f7a24d4-823d-4648-b2c3-a645a352bef7',
    'chat-94ed8b6e-9bb8-4afd-a6f1-9e96f5893a76','core-runtime-source-readonly'],
];
const auth=()=>({kind:'INSTALLATION_REPOSITORY_GET',
  actor:'github-app-installation',
  repository:'ansqhd5774-Choi/zgmini-pc-control',
  repositoryId:1442936296,ownerAccountId:327938088,
  private:true,readOnly:true,executionAuthorized:false,testOnly:false});
function makeFixture(){
  const issues=new Map(entries.map(([n,requestId,chatId,operation])=>[
    n,{number:n,user:{login:OWNER,id:327938088},
      state:'open',comments:0,labels:[{name:'pc-job'}],
      updated_at:'2026-11-10T12:58:56Z',
      body:JSON.stringify({schema:'ZGMINI_PC_JOB_V1',requestId,chatId,
        operation,sourceRepository:'ansqhd5774-Choi/zgmini',
        sourceBranch:'main',sourceSha:'643b7c7c4372ffad552443fc312c6cb1b944e2fc'})},
  ]));
  const state={issues,comments:new Map(),requests:[],pass:0,
    afterFirstPass:null,auth:auth()};
  const reader=create996FourOriginalJobsReadOnlyReader({githubReader:{
    authenticateReadOnly:async()=>structuredClone(state.auth),
    get:async path=>{
      state.requests.push(path);
      const issue=/^issues\/(\d+)$/.exec(path);
      if(issue){
        const n=Number(issue[1]);
        if(n===1217)state.pass++;
        if(n===1217&&state.pass===2&&state.afterFirstPass)
          state.afterFirstPass(state);
        return {status:200,data:structuredClone(state.issues.get(n))};
      }
      const comments=/^issues\/(\d+)\/comments\?per_page=100&page=1$/.exec(path);
      if(comments){const n=Number(comments[1]);
        return {status:200,data:structuredClone(state.comments.get(n)||[])};
      }
      throw Error('unexpected API route');
    },
  }});
  return {state,reader};
}
async function blocked(f,code){
  await assert.rejects(()=>f.reader.readOnce(),{code});
}

test('four exact original jobs unresolved, never replayed or promoted',async()=>{
  const f=makeFixture();const r=await f.reader.readOnce();
  assert.equal(r.status,'FOUR_ORIGINAL_JOBS_UNRESOLVED_GET_ONLY');
  assert.equal(r.originalIssueCount,4);
  assert.deepEqual(r.entries.map(x=>x.issueNumber),[1217,1219,1226,1227]);
  assert.ok(r.entries.every(x=>x.nextAction==='OWNER_REPLAN_REVIEW_REQUIRED'&&
    x.resultVerified===false&&x.state==='open'));
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.productionExecutable,false);
  assert.equal(r.issuePosts,0);
  assert.equal(r.pcRetries,0);
  assert.equal(f.state.requests.length,16);
  await assert.rejects(()=>f.reader.readOnce(),
    /C_996_ORIGINAL_JOBS_REPEATED_READ_DENIED/);
});

test('closed Issue or nonzero declared comments cannot pass',async()=>{
  for(const n of [1217,1219,1226,1227]){
    const f=makeFixture();f.state.issues.get(n).state='closed';
    await blocked(f,'C_996_ORIGINAL_JOBS_STATUS_OR_ORIGIN_DRIFT');
    const g=makeFixture();g.state.issues.get(n).comments=1;
    await blocked(g,'C_996_ORIGINAL_JOBS_STATUS_OR_ORIGIN_DRIFT');
  }
});

test('actual comment not treated as empty merely because Issue claims zero',async()=>{
  const f=makeFixture();f.state.comments.set(1219,[{id:1,body:'bot result'}]);
  await blocked(f,'C_996_ORIGINAL_JOBS_RECEIPT_OR_COMMENT_PRESENT');
});

test('user, label and exact source scope drift are blocked',async()=>{
  for(const mutate of [
    i=>{i.user.id=1;},
    i=>{i.labels=[];},
    i=>{const b=JSON.parse(i.body);b.sourceSha='a'.repeat(40);i.body=JSON.stringify(b);},
    i=>{const b=JSON.parse(i.body);b.requestId='another';i.body=JSON.stringify(b);},
    i=>{const b=JSON.parse(i.body);b.extra=true;i.body=JSON.stringify(b);},
  ]){
    const f=makeFixture();mutate(f.state.issues.get(1226));
    await assert.rejects(f.reader.readOnce(),error=>
      ['C_996_ORIGINAL_JOBS_STATUS_OR_ORIGIN_DRIFT',
       'C_996_ORIGINAL_JOBS_REQUEST_BYTES_DRIFT'].includes(error.code));
  }
});

test('changing the remote snapshot between complete passes blocks',async()=>{
  const f=makeFixture();f.state.afterFirstPass=state=>{
    state.issues.get(1219).updated_at='2026-11-11T03:00:00Z';
  };
  await blocked(f,'C_996_ORIGINAL_JOBS_READBACK_CHANGED');
});

test('synthetic origin or wrong service token identity blocks',async()=>{
  for(const mutate of [
    auth=>{auth.testOnly=true;},
    auth=>{auth.repositoryId=1;},
    auth=>{auth.actor=OWNER;},
    auth=>{auth.readOnly=false;},
  ]){
    const f=makeFixture();mutate(f.state.auth);
    await blocked(f,'C_996_ORIGINAL_JOBS_GITHUB_GET_ORIGIN_UNVERIFIED');
    assert.equal(f.state.requests.length,0);
  }
});

test('reader has no mutation or execution methods',()=>{
  const f=makeFixture();assert.deepEqual(Object.keys(f.reader),['readOnce']);
});
