import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createControllerAdmissionLane,readControllerLanePending} from '../tools/maintenance-agent.mjs';

const lane='controller-install';
const first=`${lane}:${'a'.repeat(40)}:${'b'.repeat(64)}`;
const second=`${lane}:${'c'.repeat(40)}:${'d'.repeat(64)}`;
const queueA='queue-controller-a';
const queueB='queue-controller-b';
function scratch(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-lane-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 return dir;
}
const claimInput=(key=first,queueId=queueA)=>({lane,key,queueId});

test('six concurrent candidates have one durable whole-lane winner, no per-run E logs',async t=>{
 const stateDir=scratch(t),states=Array.from({length:6},()=>createControllerAdmissionLane({stateDir}));
 const results=await Promise.all(states.map(agent=>Promise.resolve().then(()=>agent.claim(claimInput()))));
 assert.equal(results.filter(item=>item.acquired===true).length,1);
 assert.equal(results.filter(item=>item.acquired===false).length,5);
 assert.equal(states[0].read().phase,'HELD');
 assert.deepEqual(fs.readdirSync(stateDir),['CONTROLLER_ADMISSION_LANE.json']);
});

test('six separate Node processes contend on one atomic fixed-file claim',async t=>{
 const stateDir=scratch(t);
 const moduleUrl=pathToFileURL(fileURLToPath(new URL('../tools/maintenance-agent.mjs',import.meta.url))).href;
 const source=`import {createControllerAdmissionLane} from ${JSON.stringify(moduleUrl)};
  const received=createControllerAdmissionLane({stateDir:${JSON.stringify(stateDir)}})
   .claim(${JSON.stringify(claimInput())});
  process.stdout.write(JSON.stringify(received));`;
 const contenders=Array.from({length:6},()=>new Promise((resolve,reject)=>{
  const processHandle=spawn(process.execPath,['--input-type=module','--eval',source],
   {stdio:['ignore','pipe','pipe']});
  let output='',errors='';
  processHandle.stdout.on('data',chunk=>output+=chunk);
  processHandle.stderr.on('data',chunk=>errors+=chunk);
  processHandle.on('error',reject);
  processHandle.on('close',code=>{
   if(code!==0){reject(Error(errors||`CHILD_EXIT_${code}`));return;}
   try{resolve(JSON.parse(output));}catch(error){reject(error);}
  });
 }));
 const outcomes=await Promise.all(contenders);
 assert.equal(outcomes.filter(row=>row.acquired===true).length,1);
 assert.equal(createControllerAdmissionLane({stateDir}).read().phase,'HELD');
 assert.deepEqual(fs.readdirSync(stateDir),['CONTROLLER_ADMISSION_LANE.json']);
});

test('restart, another target, and same queue cannot submit while the prior claim is unresolved',t=>{
 const stateDir=scratch(t),firstProcess=createControllerAdmissionLane({stateDir});
 assert.equal(firstProcess.claim(claimInput()).acquired,true);
 const restarted=createControllerAdmissionLane({stateDir});
 assert.equal(restarted.claim(claimInput()).acquired,false);
 assert.equal(restarted.claim(claimInput(second,queueB)).acquired,false);
 assert.equal(restarted.read().key,first);
});

test('UNKNOWN and RECOVERY_REQUIRED never authorize release',async t=>{
 const stateDir=scratch(t);
 let proof={verified:true,key:first,queueId:queueA,issueNumber:123,
  status:'UNKNOWN',postVerified:true};
 const receiver=createControllerAdmissionLane({stateDir,
  verifyTerminalEvidence:async()=>proof});
 receiver.claim(claimInput());
 assert.equal((await receiver.settle(claimInput())).status,'STATE_UNKNOWN');
 proof={...proof,status:'RECOVERY_REQUIRED',rollbackVerified:true};
 assert.equal((await receiver.settle(claimInput())).status,'STATE_UNKNOWN');
 proof={...proof,status:'BLOCKED',untouchedVerified:false};
 assert.equal((await receiver.settle(claimInput())).status,'STATE_UNKNOWN');
 assert.equal(receiver.read().phase,'HELD');
});

test('verified terminal proof permits next target, never resubmits the same settled queue',async t=>{
 const stateDir=scratch(t);
 const receiver=createControllerAdmissionLane({stateDir,
  verifyTerminalEvidence:async()=>({verified:true,key:first,queueId:queueA,
   issueNumber:123,status:'BLOCKED',untouchedVerified:true})});
 receiver.claim(claimInput());
 assert.equal((await receiver.settle(claimInput())).status,'SETTLED');
 assert.equal(receiver.claim(claimInput()).acquired,false);
 assert.equal(receiver.claim(claimInput(second,queueB)).acquired,true);
 assert.equal(receiver.read().generation,2);
 assert.deepEqual(fs.readdirSync(stateDir),['CONTROLLER_ADMISSION_LANE.json']);
});

test('orphan lock, interrupted swap, and malformed ledger are UNKNOWN without cleanup/retry',t=>{
 const stateDir=scratch(t),receiver=createControllerAdmissionLane({stateDir});
 const gate=path.join(stateDir,'CONTROLLER_ADMISSION_LANE_LOCK');
 fs.mkdirSync(gate);
 const orphan=receiver.claim(claimInput());
 assert.equal(orphan.status,'STATE_UNKNOWN');
 assert.equal(orphan.acquired,undefined);
 assert.equal(fs.existsSync(gate),true);
 fs.rmdirSync(gate);
 receiver.claim(claimInput());
 fs.writeFileSync(path.join(stateDir,'CONTROLLER_ADMISSION_LANE.json.swap'),'unfinished');
 const swapResult=receiver.claim(claimInput(second,queueB));
 assert.equal(swapResult.status,'STATE_UNKNOWN');
 assert.equal(swapResult.acquired,undefined);
 fs.unlinkSync(path.join(stateDir,'CONTROLLER_ADMISSION_LANE.json.swap'));
 fs.writeFileSync(path.join(stateDir,'CONTROLLER_ADMISSION_LANE.json'),'{broken');
 const damaged=receiver.claim(claimInput(second,queueB));
 assert.equal(damaged.status,'STATE_UNKNOWN');
 assert.equal(damaged.acquired,undefined);
});

test('33 OPEN but verified terminal Controller Issues do not block a new B request',async()=>{
 const issues=Array.from({length:33},(_,i)=>({number:i+100,
  title:'pc-controller-update',state:'OPEN'}));
 const r=await readControllerLanePending({issues,readTrustedOutcome:async issue=>({
  verified:true,issueNumber:issue.number,status:'SUCCEEDED',safeTerminal:true,
  postVerified:true})});
 assert.deepEqual(r,{authoritative:true,pending:false});
});

test('manual pending, uncertain receipt and unrelated R54 Writer are distinguished',async()=>{
 const manual={number:300,title:'pc-controller-update',state:'OPEN'};
 const unrelated={number:301,title:'pc-r54-publish',state:'OPEN'};
 const active=await readControllerLanePending({issues:[unrelated,manual],
  readTrustedOutcome:async issue=>({verified:true,issueNumber:issue.number,
   status:'RUNNING',safeTerminal:false})});
 assert.deepEqual(active,{authoritative:true,pending:true});
 const uncertain=await readControllerLanePending({issues:[manual],
  readTrustedOutcome:async()=>({verified:false})});
 assert.deepEqual(uncertain,{authoritative:false,pending:null});
 const notProven=await readControllerLanePending({issues:[manual],
  readTrustedOutcome:async()=>({verified:true,issueNumber:manual.number,
   status:'BLOCKED',safeTerminal:true,untouchedVerified:false})});
 assert.deepEqual(notProven,{authoritative:true,pending:true});
 const writerOnly=await readControllerLanePending({issues:[unrelated],
  readTrustedOutcome:async()=>{throw Error('unrelated must not be read');}});
 assert.deepEqual(writerOnly,{authoritative:true,pending:false});
});
