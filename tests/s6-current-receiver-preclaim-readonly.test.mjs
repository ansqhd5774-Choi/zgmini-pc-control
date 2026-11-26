import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {
 authenticateProcess,SCHEMA,TITLE,ROLE_OPERATION,
 projectS6ActiveReceiverIntakeReadonly,inspectS6ActiveReceiverIntakeReadonly
} from '../tools/pc-process-inventory-readonly.mjs';

const REQUEST='pc-s6-63afb126-72dc-4ec5-a721-4819771fa9ee';
const ISSUE=4069,now=Date.parse('2026-11-26T19:11:00.000Z');
const owner={pid:301,nonce:'81818181-9a91-4a91-9a91-818181818181'};
const receiver=()=>({pid:301,at:'2026-11-26T19:10:32.000Z',
 status:'LISTENING',
 results:[
  {requestId:REQUEST,status:'BLOCKED',code:'S6_ONCE_RUNNER_BUSY_OR_UNVERIFIED',
   executionStarted:false,unsafeRaw:'PRIVATE_WORD'},
  {requestId:'pc-s6-11111111-1111-4111-8111-111111111111',
   status:'BLOCKED',code:'S6_PRIVATE_UNRELATED'}
 ]});
const project=(raw={})=>projectS6ActiveReceiverIntakeReadonly({
 receiver:receiver(),owner,ownerAlive:true,ledgerPresent:false,...raw
},now);

test('exact S6 B intake A accepts only scoped owner operating issue',()=>{
 const req={schema:SCHEMA,operation:ROLE_OPERATION,role:'operating',
  requestId:'3b7b3d96-cdd8-47c0-b15a-a690201c8142',
  probe:'controller-s6-active-receiver-intake-readonly'};
 const e={action:'opened',repository:{
  full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
  issue:{number:4073,user:{login:'ansqhd5774-Choi'},title:TITLE,body:JSON.stringify(req)}};
 const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
  GITHUB_RUN_ID:'45890000000',GITHUB_RUN_ATTEMPT:'1'};
 assert.equal(authenticateProcess(e,env,'operating').s6ActiveIntake,true);
 assert.throws(()=>authenticateProcess(e,env,'handoff'));
 assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,body:JSON.stringify({
  ...req,path:'C:/private'})}},env,'operating'));
});

test('S6 receiver preclaim A exposes only bounded fixed code after verified owner',()=>{
 const got=project();
 assert.equal(got.status,'READ_ONLY_OBSERVED');
 assert.equal(got.code,'S6_INTAKE_RECEIVER_CODE_OBSERVED');
 assert.equal(got.receiverFresh,true);
 assert.equal(got.receiverOwnerVerified,true);
 assert.equal(got.receiverClaimPresent,false);
 assert.equal(got.preclaimStatus,'BLOCKED');
 assert.equal(got.preclaimCode,'S6_ONCE_RUNNER_BUSY_OR_UNVERIFIED');
 assert.equal(got.targetInLatestPoll,true);
 assert.equal(got.issueNumber,ISSUE);
 assert.equal(got.operationalEffectProven,false);
 assert.equal(got.replayAuthorized,false);
 assert.equal(got.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(got),/PRIVATE_WORD|nonce|81818181|301|unsafeRaw/);
 const without=project({receiver:{...receiver(),results:[]}});
 assert.equal(without.code,'S6_INTAKE_NOT_FOUND_IN_LAST_POLL');
 assert.equal(without.receiverClaimPresent,false);
 assert.equal(without.targetInLatestPoll,false);
});

test('S6 intake A fails closed on stale timestamp, PID/owner, changed state or raw secret',()=>{
 const old=project({receiver:{...receiver(),at:'2026-11-26T19:07:30.000Z'}});
 assert.equal(old.status,'STATE_UNKNOWN');
 assert.equal(old.code,'S6_INTAKE_RECEIVER_POLL_STALE_OR_UNVERIFIED');
 assert.equal(old.preclaimCode,null);
 const wrong=project({owner:{...owner,pid:999}});
 assert.equal(wrong.code,'S6_INTAKE_RECEIVER_OWNER_UNVERIFIED');
 assert.equal(wrong.preclaimCode,null);
 const pending=project({receiver:{...receiver(),status:'POLL_WAIT'}});
 assert.equal(pending.code,'S6_INTAKE_RECEIVER_NOT_LISTENING');
 const injection=project({receiver:{...receiver(),results:[
  {requestId:REQUEST,status:'BLOCKED',code:'C:/secrets/PRIVATE_WORD'}
 ]}});
 assert.equal(injection.code,'S6_INTAKE_RESULT_UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(injection),/PRIVATE_WORD|C:\/secrets/);
 const collision=project({receiver:{...receiver(),results:[
  receiver().results[0],receiver().results[0]]}});
 assert.equal(collision.code,'S6_INTAKE_RESULT_DUPLICATED');
});

test('S6 fixed-file A reads only receiver+owner and exact hashed current request ledger',()=>{
 const root='E:/ZGmini/automation/pc-maintenance';
 const dir=path.join(root,'requests');
 const file=path.join(dir,createHash('sha256').update(REQUEST).digest('hex')+'.json');
 const raw={...receiver()};
 const files=new Map([
  [path.join(root,'RECEIVER_STATUS.json'),Buffer.from(JSON.stringify(raw))],
  [path.join(root,'leases/receiver/owner.json'),Buffer.from(JSON.stringify(owner))]
 ]);
 const io={
  lstatSync(p){
   if(p===dir)return {isDirectory:()=>true,isSymbolicLink:()=>false};
   const b=files.get(p);
   if(!b)throw Object.assign(Error('not found'),{code:'ENOENT'});
   return {size:b.length,nlink:1,isFile:()=>true,isSymbolicLink:()=>false};
  },
  readFileSync(p){return files.get(p)}
 };
 const run=()=>inspectS6ActiveReceiverIntakeReadonly({
  io,maintenanceHome:root,now,isAlive:pid=>pid===301
 });
 const empty=run();
 assert.equal(empty.status,'READ_ONLY_OBSERVED');
 assert.equal(empty.receiverClaimPresent,false);
 files.set(file,Buffer.from(JSON.stringify({schema:'ZGMINI_PC_MAINTENANCE_LEDGER_V1',
  issueNumber:ISSUE,requestId:REQUEST,status:'RUNNING',nonce:'PRIVATE_WORD'})));
 const claimed=run();
 assert.equal(claimed.receiverClaimPresent,true);
 assert.equal(claimed.receiverClaimStatus,'RUNNING');
 assert.doesNotMatch(JSON.stringify(claimed),/PRIVATE_WORD|nonce/);
 files.set(file,Buffer.from(JSON.stringify({schema:'WRONG',
  issueNumber:ISSUE,requestId:REQUEST,status:'RUNNING'})));
 assert.equal(run().code,'S6_INTAKE_RECEIVER_CLAIM_IDENTITY_UNVERIFIED');
});
