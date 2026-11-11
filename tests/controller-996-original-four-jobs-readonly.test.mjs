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
const D05_BODY="D05 실제 계산 source 확인 의존성의 원본 접수 상태를 읽기 전용으로 대조했습니다 (2026-11-11 KST).\n\n- 원본 Issue #1227: `core-runtime-source-readonly`, requestId `pc-6f7a24d4-823d-4648-b2c3-a645a352bef7`, created `2026-11-10T12:58:56Z`, 현재 결과 댓글 0·해당 requestId 고정 JSON/TXT 미확인.\n- 같은 시간대 GitHub Actions `event=issues`의 확인된 63개 실행은 `skipped`; 정규 `.github/workflows/pc-job.yml` 실행은 0건입니다. 당시 main에는 해당 워크플로와 A급 allowlist operation이 존재했습니다. 이 증거는 실PC Runtime 실행 실패를 뜻하지 않습니다.\n- 대조: #1230의 동일 정규 A급 Windows 조회는 Run 42914966096, `PASS/WRITER_APPROVED_PREIMAGE_READONLY`, 원격 JSON/TXT 2/2입니다. 그러나 `runtimeSourceVerified=false`이므로 live Core source를 대신 입증하지 못합니다.\n\n판정: `AUTOMATION_BLOCKED / PC_JOB_INTAKE_NOT_OBSERVED` (원인 미확정). #1227의 재실행·같은 requestId 재사용 금지. 공통 총괄은 당시 workflow 활성/이벤트 수신 차이만 최소 조정하고, 실제 live Core source가 계속 필수인 경우에는 기존 원본 상태를 보존한 채 **새 고유 승인 A**가 필요한지 결정해 주세요. 이 기록만으로 현재 Core 실행을 중단하거나 D05 운영 B를 허가하지 않습니다.";
const D05_COMMENT={id:6781491296,user:{login:OWNER,id:327938088},body:D05_BODY};
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
  state.issues.get(1227).comments=1;
  state.comments.set(1227,[structuredClone(D05_COMMENT)]);
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
  assert.equal(r.entries.find(x=>x.issueNumber===1227).commentEvidence,'PINNED_OWNER_DIAGNOSTIC_NOT_RECEIPT');
  assert.ok(r.entries.every(x=>x.resultVerified===false));
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
    const g=makeFixture();g.state.issues.get(n).comments=n===1227?2:1;
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
    auth=>{delete auth.testOnly;},
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

test('only the original pinned D05 comment is classified as not a receipt',async()=>{
  for(const change of [
    f=>{f.state.comments.get(1227)[0].body+=' changed';},
    f=>{f.state.comments.get(1227)[0].id++;},
    f=>{f.state.comments.get(1227)[0].user.id=1;},
    f=>{f.state.comments.get(1227)[0].user.login='github-actions[bot]';},
    f=>{f.state.comments.get(1227).push(structuredClone(D05_COMMENT));},
    f=>{f.state.comments.set(1227,[]);}
  ]){
    const f=makeFixture();change(f);
    await blocked(f,'C_996_ORIGINAL_JOBS_UNRECOGNIZED_DIAGNOSTIC_COMMENT');
  }
});
test('D05 comment appearing on another issue remains a strict failure',async()=>{
  const f=makeFixture();
  f.state.issues.get(1219).comments=1;
  f.state.comments.set(1219,[structuredClone(D05_COMMENT)]);
  await blocked(f,'C_996_ORIGINAL_JOBS_RECEIPT_OR_COMMENT_PRESENT');
});
test('D05 comment edited between the two remote snapshots must stop',async()=>{
  const f=makeFixture();
  f.state.afterFirstPass=state=>{
    state.comments.get(1227)[0].body+=' altered';
  };
  await blocked(f,'C_996_ORIGINAL_JOBS_UNRECOGNIZED_DIAGNOSTIC_COMMENT');
});
