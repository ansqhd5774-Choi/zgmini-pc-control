import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyHandoffReceipt} from '../agent-handoff/intake-receipt-readonly.mjs';
import {runWatch} from '../agent-handoff/intake-watch-5s.mjs';
import {routeHandoff,fingerprintHandoff} from '../agent-handoff/contract.mjs';
import {selectionReceipt} from '../agent-handoff/queue-selector.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const url='https://api.github.com/repos/'+repo+'/issues/101';
const body={schema:'ZGMINI_AGENT_HANDOFF_V1',incidentId:'handoff-watch-20261117-test',
  origin:{repository:repo,issueNumber:101,requestId:'watch-abc123456',chatId:'chat-watch-1',branch:'codex/watch',
    sourceSha:'a'.repeat(40),checkpoint:'SOURCE'},
  failure:{kind:'COMMON_CONTROLLER',code:'CONTROLLER_TEST_STOP',lastPass:'SOURCE_CHECKED',
    firstFail:'RUNTIME_IMPORT_STOP',fileRefs:['controller/entry.mjs'],evidenceIssueNumber:101}};
const issue={number:101,title:'agent-handoff '+body.incidentId,body:JSON.stringify(body),
  user:{login:'ansqhd5774-Choi'},state:'open',labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}]};
const routed=routeHandoff(body);
const botReceipt=['HANDOFF_ROUTED','incidentId: '+body.incidentId,'fingerprint: '+fingerprintHandoff(body),
 'role: '+routed.role,'state: AWAITING_AGENT_CONFIGURATION','checkpoint: SOURCE','PC retries: 0',
 'operationalWrites: 0','Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'].join('\n');
const comment=(body,user='github-actions[bot]')=>({body,issue_url:url,user:{login:user}});
const response=(value,status=200)=>({status,json:async()=>value});
const fakeFetch=(receiptComments,log=[])=>async (u,options)=>{
 log.push({u,method:options.method});
 if(u.endsWith('/issues/101')) return response(issue);
 if(u.includes('/issues/101/comments?'))return response(receiptComments);
 throw Error('UNEXPECTED_URL');
};

test('only authenticated exact bot receipt and candidate count as routed',async()=>{
 const log=[];
 const comments=[comment(botReceipt),comment(selectionReceipt(body,fingerprintHandoff(body)))];
 const result=await verifyHandoffReceipt({token:'test-auth',issueNumber:101,fetchImpl:fakeFetch(comments,log)});
 assert.equal(result.state,'ALREADY_SELECTED');
 assert.equal(result.receiptVerified,true);
 assert.equal(result.chatDelivered,false);
 assert.equal(result.noWrite,true);
 assert.equal(log.length,2);
 assert.ok(log.every(x=>x.method==='GET'));
});

test('forged, missing or untrusted comment never confirms intake',async()=>{
 for(const comments of [[comment(botReceipt,'not-a-bot')],[comment('HANDOFF_ROUTED\nBAD')],[]]){
  const result=await verifyHandoffReceipt({token:'test-auth',issueNumber:101,fetchImpl:fakeFetch(comments)});
  assert.equal(result.receiptVerified,false);assert.equal(result.chatDelivered,false);
 }
});

test('truncated multipage inventory does not claim accepted work',async()=>{
 let total=0;
 const result=await verifyHandoffReceipt({token:'test-auth',issueNumber:101,fetchImpl:async(u)=>{
  total++;return response(u.endsWith('/issues/101')?issue:Array(100).fill(comment('test')));
 }});
 assert.equal(result.state,'COMMENT_INVENTORY_INCOMPLETE');assert.equal(result.receiptVerified,false);assert.equal(total,5);
});

test('authentication failure cannot be promoted to verified intake',async()=>{
 await assert.rejects(()=>verifyHandoffReceipt({token:'',issueNumber:101}),/AUTH_REQUIRED/);
 await assert.rejects(()=>verifyHandoffReceipt({token:'x',issueNumber:101,fetchImpl:async()=>response({},403)}),/HTTP_403/);
});

test('slow independent receipt verification never stops the 5s list poll',async()=>{
 const signal=new AbortController();let polls=0,receiptChecks=0,release;
 const receiptVerifier=()=>{receiptChecks++;return new Promise(r=>{release=r;});};
 let waits=0;
 await runWatch({token:'test',signal:signal.signal,clock:()=>1000000000,
  sleep:async()=>{waits++;if(waits===3)signal.abort();await Promise.resolve();},
  fetchImpl:async(url)=>{assert.match(url,/labels=agent-handoff/);polls++;
   return response([{number:101,updated_at:'2026-11-17T01:00:0'+polls+'Z',labels:[{name:'agent-handoff'}]}]);},
  receiptVerifier,onReport:()=>{}});
 assert.equal(polls,3);assert.equal(receiptChecks,1);
 release({issueNumber:101,state:'ALREADY_SELECTED',receiptVerified:true,chatDelivered:false,noWrite:true});
 await Promise.resolve();await Promise.resolve();
});
