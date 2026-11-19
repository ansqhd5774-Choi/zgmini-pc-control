import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHandoff,fingerprintHandoff,routeHandoff} from '../agent-handoff/contract.mjs';
import {selectionReceipt,HANDOFF_BOT,HANDOFF_OWNER,HANDOFF_REPOSITORY} from '../agent-handoff/queue-selector.mjs';
import {WORK_SCHEMA,WORK_RECEIPT,parseWorkUpdate,workReceipt,evaluateWorkUpdate} from '../agent-handoff/work-progress-contract.mjs';
import {validateWorkEvent,processWorkComment,isWorkUpdateComment} from '../agent-handoff/work-progress-broker.mjs';

const owner=HANDOFF_OWNER;
const issueUrl=n=>'https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/'+n;
function fixture(number=2201) {
  const data={schema:'ZGMINI_AGENT_HANDOFF_V1',incidentId:'handoff-test-progress-'+number,
    origin:{repository:HANDOFF_REPOSITORY,issueNumber:number-1,
      requestId:'request-'+number+'-20261116',chatId:'chat-test-abc123',
      branch:'main',sourceSha:'a'.repeat(40),checkpoint:'OTHER'},
    failure:{kind:'COMMON_WRITER',code:'WRITER_B_PC_PREIMAGE_STOP',
      lastPass:'NOT_RECORDED',firstFail:'NOT_RECORDED',
      fileRefs:['results/evidence.json'],evidenceIssueNumber:number-1}};
  const parsed=parseHandoff(JSON.stringify(data));
  const routed=routeHandoff(parsed);
  const issue={repository:HANDOFF_REPOSITORY,number,state:'open',
    user:{login:HANDOFF_BOT},title:'agent-handoff '+data.incidentId,
    labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}],
    body:JSON.stringify(data)};
  const route={user:{login:HANDOFF_BOT},issue_url:issueUrl(number),id:1,
    body:['HANDOFF_ROUTED','incidentId: '+data.incidentId,
      'fingerprint: '+fingerprintHandoff(parsed),'role: '+routed.role,
      'state: AWAITING_AGENT_CONFIGURATION','checkpoint: OTHER',
      'PC retries: 0','operationalWrites: 0',
      'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'].join('\n')};
  const selected={user:{login:HANDOFF_BOT},id:2,issue_url:issueUrl(number),
    body:selectionReceipt(parsed,fingerprintHandoff(parsed))};
  return {issue,parsed,comments:[route,selected]};
}
function makeUpdate(f,number,state,id=100) {
  return {id,user:{login:owner},issue_url:issueUrl(number),
    body:JSON.stringify({schema:WORK_SCHEMA,
      updateId:'work-'+number+'-'+id+'-20261116',
      incidentId:f.parsed.incidentId,
      fingerprint:fingerprintHandoff(f.parsed),
      role:routeHandoff(f.parsed).role,state})};
}
const ownerReceipt=(f,c)=>({user:{login:HANDOFF_BOT},id:c.id+1,
  issue_url:issueUrl(f.issue.number),
  body:workReceipt(parseWorkUpdate(c.body),c.id)});

test('acknowledge only one authenticated selected issue',()=>{
  const f=fixture();
  const c=makeUpdate(f,f.issue.number,'ACKNOWLEDGED');
  const r=evaluateWorkUpdate(f.issue,[...f.comments,c],c);
  assert.equal(r.state,'READY');assert.equal(r.progressState,'ACKNOWLEDGED');
  assert.match(r.receipt,/aiExecution: NOT_ATTESTED/);
  assert.equal(evaluateWorkUpdate(f.issue,[...f.comments,c,ownerReceipt(f,c)],c).state,'ALREADY_RECORDED');
  assert.throws(()=>evaluateWorkUpdate(f.issue,[f.comments[0],c],c),/AUTHENTICATED_SELECTION_REQUIRED/);
});

test('work progression is ordered and independently acknowledged',()=>{
  const f=fixture();
  const a=makeUpdate(f,f.issue.number,'ACKNOWLEDGED',100);
  const b=makeUpdate(f,f.issue.number,'WORKING',200);
  const waiting=makeUpdate(f,f.issue.number,'WAITING_EVIDENCE',300);
  let history=[...f.comments,a,ownerReceipt(f,a),b];
  assert.equal(evaluateWorkUpdate(f.issue,history,b).state,'READY');
  history=[...history,ownerReceipt(f,b),waiting];
  assert.equal(evaluateWorkUpdate(f.issue,history,waiting).state,'READY');
  const after=[...history,ownerReceipt(f,waiting)];
  assert.equal(evaluateWorkUpdate(f.issue,after,waiting).state,'ALREADY_RECORDED');
  const next=makeUpdate(f,f.issue.number,'WORKING',400);
  assert.equal(evaluateWorkUpdate(f.issue,[...after,next],next).state,'READY');
  assert.throws(()=>evaluateWorkUpdate(f.issue,[...f.comments,b],b),/TRANSITION_STOP/);
  assert.throws(()=>evaluateWorkUpdate(f.issue,[...f.comments,a,b],b),/PRIOR_RECEIPT_MISSING/);
});

test('owner-only, identity and receipt-fingerprint checks fail closed',()=>{
  const f=fixture();const a=makeUpdate(f,f.issue.number,'ACKNOWLEDGED');
  const comments=[...f.comments,a];
  assert.throws(()=>evaluateWorkUpdate({...f.issue,state:'closed'},comments,a),/ISSUE_OR_INVENTORY_STOP/);
  assert.throws(()=>evaluateWorkUpdate(f.issue,comments,{...a,user:{login:'stranger'}}),/SOURCE_IDENTITY_STOP/);
  assert.throws(()=>evaluateWorkUpdate(f.issue,comments,{...a,body:a.body.replace('ACKNOWLEDGED','WORKING')}),/SOURCE_COMMENT_READBACK_STOP/);
  assert.throws(()=>evaluateWorkUpdate(f.issue,[...comments,{...ownerReceipt(f,a),body:workReceipt(parseWorkUpdate(a.body),a.id).replace('state: ACKNOWLEDGED','state: WORKING')}],a),/RECEIPT_CONFLICT_STOP/);
  assert.throws(()=>parseWorkUpdate(JSON.stringify({schema:WORK_SCHEMA})),/FIELDS_STOP/);
  const forged={...a,body:a.body.replace(f.parsed.incidentId,'handoff-forged-other')};
  assert.throws(()=>evaluateWorkUpdate(f.issue,[...f.comments,forged],forged),/ORIGIN_PROOF_MISMATCH/);
});

test('bot receipt cannot claim actual AI execution or runtime result',()=>{
  const f=fixture(),a=makeUpdate(f,f.issue.number,'ACKNOWLEDGED');
  const entry=workReceipt(parseWorkUpdate(a.body),a.id);
  assert.ok(entry.startsWith(WORK_RECEIPT+'\n'));
  assert.match(entry,/evidence: OWNER_GITHUB_COMMENT_ONLY/);
  assert.doesNotMatch(entry,/^state: (?:APPLIED_VERIFIED|OWNER_RESUMED|TESTED)$/m);
});

test('event requires real owner-authored comment, accepted repository and label',()=>{
  const f=fixture(),a=makeUpdate(f,f.issue.number,'ACKNOWLEDGED');
  const event={repository:{full_name:HANDOFF_REPOSITORY,private:true},
    action:'created',issue:f.issue,comment:a};
  const env={GITHUB_REPOSITORY:HANDOFF_REPOSITORY,
    GITHUB_EVENT_NAME:'issue_comment',GITHUB_ACTOR:owner};
  assert.doesNotThrow(()=>validateWorkEvent(event,env));
  assert.throws(()=>validateWorkEvent({...event,comment:{...a,user:{login:'attacker'}}},env));
  assert.throws(()=>validateWorkEvent(event,{...env,GITHUB_ACTOR:'attacker'}));
  assert.throws(()=>validateWorkEvent({...event,repository:{...event.repository,private:false}},env));
  assert.throws(()=>validateWorkEvent({...event,issue:{...f.issue,labels:[]}},env));
});

test('processes once and reconciles lost POST without duplicate posting',async()=>{
  const f=fixture(),a=makeUpdate(f,f.issue.number,'ACKNOWLEDGED');
  let comments=[...f.comments,a],posts=0;
  const event={issue:f.issue,comment:a};
  const io={readIssue:async()=>structuredClone(f.issue),
    readComments:async()=>structuredClone(comments),
    postComment:async(n,body)=>{posts++;comments.push({id:300,
      user:{login:HANDOFF_BOT},issue_url:issueUrl(n),body});throw Error('ack lost');}};
  const result=await processWorkComment(event,io);
  assert.equal(result.state,'WORK_STATUS_RECORDED');
  assert.equal(result.pcOperationalWrites,0);
  assert.equal(posts,1);
  const again=await processWorkComment(event,io);
  assert.equal(again.state,'ALREADY_RECORDED');assert.equal(posts,1);
});

test('unconfirmed write outcome and issue drift remain safe stops',async()=>{
  const f=fixture(),a=makeUpdate(f,f.issue.number,'ACKNOWLEDGED');
  const comments=[...f.comments,a];const event={issue:f.issue,comment:a};
  const io={readIssue:async()=>structuredClone(f.issue),
    readComments:async()=>structuredClone(comments),
    postComment:async()=>{throw Error('network unknown');}};
  await assert.rejects(()=>processWorkComment(event,io),/WRITE_OUTCOME_UNKNOWN/);
  let reads=0;const drift={...io,readIssue:async()=>{
    reads++;return reads===1?structuredClone(f.issue):{...f.issue,state:'closed'};
  }};
  await assert.rejects(()=>processWorkComment(event,drift),/PREWRITE_ISSUE_DRIFT/);
});

test('009 permits a verified work update after 405 unrelated comments',()=>{
  const f=fixture(),a=makeUpdate(f,f.issue.number,'ACKNOWLEDGED',900);
  const unrelated=Array.from({length:402},(_,i)=>({
    id:i+10,user:{login:'community-reader'},issue_url:issueUrl(f.issue.number),
    body:'discussion '+i
  }));
  const all=[...f.comments,...unrelated,a];
  assert.equal(all.length,405);
  assert.equal(evaluateWorkUpdate(f.issue,all,a).state,'READY');
  assert.equal(evaluateWorkUpdate(f.issue,[...all,ownerReceipt(f,a)],a).state,'ALREADY_RECORDED');
});

test('009 owner work history accepts JSON whitespace and reordered fields without changing proof',()=>{
 const f=fixture(),first=makeUpdate(f,f.issue.number,'ACKNOWLEDGED',700);
 const reordered=JSON.stringify({state:'ACKNOWLEDGED',
  ...JSON.parse(first.body)},null,2);
 const c={...first,body:'  \n'+reordered+'\n'};
 assert.equal(isWorkUpdateComment(c.body),true);
 assert.equal(isWorkUpdateComment('{"schema":"ZGMINI_HANDOFF_WORK_UPDATE_V1","forged":1}'),false);
 const env={GITHUB_REPOSITORY:HANDOFF_REPOSITORY,
  GITHUB_EVENT_NAME:'issue_comment',GITHUB_ACTOR:owner};
 const event={repository:{full_name:HANDOFF_REPOSITORY,private:true},
  action:'created',issue:f.issue,comment:c};
 assert.doesNotThrow(()=>validateWorkEvent(event,env));
 const receipt=ownerReceipt(f,c);
 assert.equal(evaluateWorkUpdate(f.issue,[...f.comments,c],c).state,'READY');
 assert.equal(evaluateWorkUpdate(f.issue,[...f.comments,c,receipt],c).state,'ALREADY_RECORDED');
});
