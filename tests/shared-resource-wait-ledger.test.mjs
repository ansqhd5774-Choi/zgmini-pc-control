import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResourceWait} from '../shared-resource/lifecycle.mjs';
import {persistResourceWait, resourceWaitCommentBody, parseResourceWaitComment}
  from '../agent-handoff/resource-wait-ledger.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const wait=prepareResourceWait({
  resourceKey:'controller-install',
  origin:{repository:repo,issueNumber:1092,
    requestId:'9b4e50f9-8674-4894-9c5e-8ba454d6f79d',
    chatId:'e94b51bd-0c27-4257-b430-c8f69fa6728e',
    sourceSha:'a'.repeat(40),manifestSha256:'b'.repeat(64)},
  evidence:{runId:42636354244,
    status:'WRITER_B_PREFLIGHT_STOP',code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED',
    resultJsonPath:'results/writer-b-source-install-9b4e50f9.json',
    resultTxtPath:'results/writer-b-source-install-9b4e50f9.txt',
    resultPairReadbackVerified:true},
  safePoint:'UNCLAIMED_UNTOUCHED',releaseCondition:'CORE_IDLE_WINDOW_VERIFIED'});

function fixture(){
  const comments=[];let posts=0,reads=0,scans=0;
  let rejectPost=false,postBeforeReject=false,corruptReadback=false;
  return {
    control: {setLostBefore(){rejectPost=true;},setLostAfter(){rejectPost=true;postBeforeReject=true;},
      corrupt(){corruptReadback=true;},
      get posts(){return posts;},get reads(){return reads;},get scans(){return scans;},
      comments},
    io:{
      listComments: async()=>{scans++;return comments;},
      postComment: async body=>{
        posts++;
        if(!rejectPost||postBeforeReject)
          comments.push({id:70001,user:{login:'github-actions[bot]'},
            issue_url:`https://api.github.com/repos/${repo}/issues/68`,body});
        if(rejectPost)throw Error('POST_ACK_UNKNOWN');
        return {id:70001};
      },
      getComment: async id=>{
        reads++;
        const x=comments.find(v=>v.id===id);
        return corruptReadback?{...x,body:'spoofed'}:x;
      }
    }
  };
}

test('first verified wait is read-back recorded, duplicate is reused',async()=>{
  const {control,io}=fixture();
  const first=await persistResourceWait(wait,io);
  assert.equal(first.state,'WAIT_RECORDED');
  assert.equal(control.posts,1);
  assert.equal(control.reads,1);
  assert.equal(control.comments.length,1);
  assert.deepEqual(parseResourceWaitComment(control.comments[0]),wait);
  const second=await persistResourceWait(wait,io);
  assert.equal(second.state,'WAIT_REUSED');
  assert.equal(control.posts,1);
});

test('ambiguous POST never automatically retries; read-back can reconcile',async()=>{
  const after=fixture();after.control.setLostAfter();
  assert.equal((await persistResourceWait(wait,after.io)).state,
    'WAIT_POST_RECONCILED');
  assert.equal(after.control.posts,1);
  const before=fixture();before.control.setLostBefore();
  await assert.rejects(()=>persistResourceWait(wait,before.io),/POST_OUTCOME_UNKNOWN/);
  assert.equal(before.control.posts,1);
});

test('spoofed comment and false success receipt cannot close wait',async()=>{
  const {control,io}=fixture();
  control.comments.push({id:3,user:{login:'untrusted'},
    issue_url:`https://api.github.com/repos/${repo}/issues/68`,
    body:resourceWaitCommentBody(wait)});
  assert.equal((await persistResourceWait(wait,io)).state,'WAIT_RECORDED');
  const altered=fixture();altered.control.corrupt();
  await assert.rejects(()=>persistResourceWait(wait,altered.io),
    /POST_READBACK_UNVERIFIED/);
  assert.equal(altered.control.posts,1);
});

test('malformed bot marker and excessive inventory fail closed',async()=>{
  const x=fixture();
  x.control.comments.push({id:5,user:{login:'github-actions[bot]'},
    issue_url:`https://api.github.com/repos/${repo}/issues/68`,
    body:resourceWaitCommentBody(wait).replace('WAITING_SHARED_RESOURCE','COMPLETE')});
  await assert.rejects(()=>persistResourceWait(wait,x.io),
    /READBACK_MISMATCH|BODY_INVALID/);
  const y=fixture();
  y.control.comments.push(...Array(2001).fill({}));
  await assert.rejects(()=>persistResourceWait(wait,y.io),/INVENTORY_INCOMPLETE/);
});
