import test from 'node:test';
import assert from 'node:assert/strict';
import {routeVerifiedBotIssue} from '../agent-handoff/bot-direct-route.mjs';

const repo = 'ansqhd5774-Choi/zgmini-pc-control';
const bot = 'github-actions[bot]';
const body = () => JSON.stringify({
  schema:'ZGMINI_AGENT_HANDOFF_V1', incidentId:'handoff-123456789abc',
  origin:{repository:'ansqhd5774-Choi/zgmini',issueNumber:1009,
    requestId:'pc-123456789abc',chatId:'chat-theme1',branch:'main',
    sourceSha:'a'.repeat(40),checkpoint:'COLLECT'},
  failure:{kind:'COMMON_CONTROLLER',code:'RUNNER_IMPORT_STOP',
    lastPass:'SOURCE_CHECKED',firstFail:'RUNTIME_IMPORT',
    fileRefs:['controller/engine.mjs'],evidenceIssueNumber:1009}
});
const prepared = () => ({state:'READY_TO_ENQUEUE',
  incidentId:'handoff-123456789abc',body:body()});

function fixture() {
  const created = {repository:repo,number:1200,
    user:{login:bot},title:'agent-handoff handoff-123456789abc',
    body:body(),labels:[{name:'agent-handoff'}]};
  const comments=[];
  let postCount=0, labelCount=0, failPostAfterWrite=false,
    failPostBeforeWrite=false, dropNextLabel=false;
  const io = {
    readIssue:async () => structuredClone(created),
    listHandoffs:async () => ({repository:repo,complete:true,
      issues:[structuredClone(created)]}),
    listIssueComments:async () => structuredClone(comments),
    postIssueComment:async (number, receipt) => {
      assert.equal(number,1200); postCount++;
      if(failPostBeforeWrite)throw Error('POST_NO_WRITE');
      comments.push({user:{login:bot},body:receipt});
      if(failPostAfterWrite)throw Error('ACK_LOST');
    },
    addIssueLabel:async (number, label) => {
      assert.equal(number,1200); labelCount++;
      if(dropNextLabel){dropNextLabel=false;return;}
      created.labels.push({name:label});
    }
  };
  return {created, comments, io,
    get postCount(){return postCount;},get labelCount(){return labelCount;},
    losePostAfterWrite(){failPostAfterWrite=true;},
    losePostBeforeWrite(){failPostBeforeWrite=true;},
    loseNextLabel(){dropNextLabel=true;}
  };
}

test('bot-created incident is directly routed in isolated intake exactly once',async()=>{
  const f=fixture();
  const first=await routeVerifiedBotIssue(prepared(),1200,f.io);
  assert.equal(first.state,'ROUTE_RECORDED');
  assert.equal(first.marker,'HANDOFF_ROUTED');
  assert.equal(first.pcOperationalWrites,0);
  assert.equal(first.automaticPcRetries,0);
  assert.equal(first.automaticChatWakeups,0);
  const again=await routeVerifiedBotIssue(prepared(),1200,f.io);
  assert.equal(again.state,'ROUTE_REUSED');
  assert.equal(f.postCount,1);
  assert.equal(f.labelCount,1);
  assert.equal(f.comments.length,1);
  assert.equal(f.created.labels.filter(x=>x.name==='handoff-agent-pending').length,1);
});

test('wrong origin, changed title or body cannot be routed',async()=>{
  for(const alter of [
    f=>{f.created.user.login='ansqhd5774-Choi';},
    f=>{f.created.body='{}';},
    f=>{f.created.title='untrusted';},
    f=>{f.created.labels=[];},
    f=>{f.created.repository='untrusted/repo';}
  ]){
    const f=fixture();alter(f);
    await assert.rejects(routeVerifiedBotIssue(prepared(),1200,f.io),
      /BOT_ISSUE_READBACK_STOP/);
    assert.equal(f.postCount,0);assert.equal(f.labelCount,0);
  }
});

test('ambiguous comment POST acknowledges readback without duplicate',async()=>{
  const f=fixture();f.losePostAfterWrite();
  await routeVerifiedBotIssue(prepared(),1200,f.io);
  assert.equal(f.postCount,1);assert.equal(f.comments.length,1);
  assert.equal(f.labelCount,1);
});

test('missing comment proof stops before label',async()=>{
  const f=fixture();f.losePostBeforeWrite();
  await assert.rejects(routeVerifiedBotIssue(prepared(),1200,f.io),
    /COMMENT_POST_OUTCOME_UNKNOWN/);
  assert.equal(f.labelCount,0);
});

test('label readback failure preserves comment and resumes only missing label',async()=>{
  const f=fixture();f.loseNextLabel();
  await assert.rejects(routeVerifiedBotIssue(prepared(),1200,f.io),
    /LABEL_READBACK_STOP/);
  assert.equal(f.postCount,1);
  await routeVerifiedBotIssue(prepared(),1200,f.io);
  assert.equal(f.postCount,1);assert.equal(f.labelCount,2);
  assert.equal(f.comments.length,1);
});

test('unbounded or incomplete handoff inventory is fail-closed',async()=>{
  const f=fixture();f.io.listHandoffs=async()=>({repository:repo,complete:false,issues:[]});
  await assert.rejects(routeVerifiedBotIssue(prepared(),1200,f.io),
    /INVENTORY_INCOMPLETE/);
  assert.equal(f.postCount,0);
});

test('base handoff label lost between reads prevents a false routed success',async()=>{
  const f=fixture();let reads=0;
  const read=f.io.readIssue;
  f.io.readIssue=async number=>{
    const issue=await read(number);
    if(++reads>=2)issue.labels=issue.labels.filter(x=>x.name!=='agent-handoff');
    return issue;
  };
  await assert.rejects(routeVerifiedBotIssue(prepared(),1200,f.io),/ISSUE_DRIFT_STOP/);
  assert.equal(f.postCount,1);
  assert.equal(f.labelCount,0);
});

test('title changed while applying state label fails final readback',async()=>{
  const f=fixture();
  f.io.addIssueLabel=async(number,label)=>{
    assert.equal(number,1200);
    f.created.labels.push({name:label});
    f.created.title='untrusted';
  };
  await assert.rejects(routeVerifiedBotIssue(prepared(),1200,f.io),/LABEL_READBACK_STOP/);
  assert.equal(f.postCount,1);
  assert.equal(f.comments.length,1);
});

test('base handoff label lost while applying state label fails final readback',async()=>{
  const f=fixture();
  f.io.addIssueLabel=async(number,label)=>{
    f.created.labels.push({name:label});
    f.created.labels=f.created.labels.filter(x=>x.name!=='agent-handoff');
  };
  await assert.rejects(routeVerifiedBotIssue(prepared(),1200,f.io),/LABEL_READBACK_STOP/);
  assert.equal(f.postCount,1);
});
