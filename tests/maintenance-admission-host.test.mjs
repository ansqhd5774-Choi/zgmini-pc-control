import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {createMaintenanceAgent,pollControllerAdmissionBridge} from '../tools/maintenance-agent.mjs';
import {manifestFingerprint} from '../tools/maintenance-contract.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const installed='a'.repeat(40),target='b'.repeat(40);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const blob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

function approvedFeed(){
 const allowFiles=[{path:'controller/operations.mjs',sha256:'c'.repeat(64)}];
 const manifest={schema:'ZGMINI_PC_UPDATE_V1',installedSha:installed,targetSha:target,
  allowFiles,purpose:'pc-controller-maintenance',
  approval:{grade:'B',ref:`https://github.com/${repo}/pull/28`,
   scope:'PC_CONTROL_CONTROLLER_UPDATE'},
  checks:{targetSha:target,status:'PASS',manifestSha256:manifestFingerprint(allowFiles).sha256},
  backup:{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installed}},
  postOperation:'core-status',postSourceBranch:'main',postSourceSha:target};
 const rawManifest=Buffer.from(JSON.stringify(manifest));
 const queueId='queue-12345678',ref=`https://github.com/${repo}/issues/123#issuecomment-456`;
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-11223344-5566-4788-9aab-ccddeeff0011',
  chatId:'chat-22334455-6677-4889-9aab-ddeeff001122',
  operation:'controller-update',controlRepository:repo,targetControllerSha:target,
  approvalManifestSha256:digest(rawManifest)};
 const payload={schema:'ZGMINI_CONTROLLER_READY_FEED_V1',items:[{
  schema:'ZGMINI_CONTROLLER_ADMISSION_ITEM_V1',queueId,resourceLane:'controller-install',
  status:'READY',request,dependencies:[],
  executionIntent:{action:'SUBMIT_APPROVED_B_ONCE',approvalRef:ref}}]};
 const bytes=Buffer.from(JSON.stringify(payload));
 const metadata={type:'file',path:'coordination/controller-admission-ready.json',
  encoding:'base64',size:bytes.length,sha:blob(bytes),content:bytes.toString('base64')};
 return {rawManifest,queueId,request,ref,metadata};
}

test('default bridge is inert, without GitHub API or E: access',async()=>{
 let called=0;
 const r=await pollControllerAdmissionBridge({githubGet:()=>{called++;throw Error('unexpected');}});
 assert.deepEqual(r,{status:'DISABLED',code:'QUEUE_HOST_NOT_ACTIVATED'});
 assert.equal(called,0);
});

test('manual B lane not unified denies READY network fetch',async()=>{
 let called=0;
 const r=await pollControllerAdmissionBridge({activated:true,
  githubGet:()=>{called++;throw Error('unexpected');}});
 assert.deepEqual(r,{status:'WAITING_RESOURCE',code:'QUEUE_MANUAL_LANE_NOT_UNIFIED'});
 assert.equal(called,0);
});

test('activation without trusted approval and lane callbacks remains no-op',async()=>{
 let called=0;
 const r=await pollControllerAdmissionBridge({activated:true,manualLaneUnified:true,
  githubGet:()=>{called++;throw Error('unexpected');}});
 assert.deepEqual(r,{status:'WAITING_SETUP',code:'QUEUE_TRUSTED_HOST_ADAPTER_MISSING'});
 assert.equal(called,0);
});

test('trusted empty main READY feed never submits an Issue',async()=>{
 const bytes=Buffer.from(JSON.stringify({schema:'ZGMINI_CONTROLLER_READY_FEED_V1',items:[]}));
 let fetched=0,submitted=0;
 const r=await pollControllerAdmissionBridge({activated:true,manualLaneUnified:true,
  githubGet:async url=>{fetched++;assert.match(url,/\/contents\/coordination\/controller-admission-ready\.json\?ref=main$/);
   return {type:'file',path:'coordination/controller-admission-ready.json',
    encoding:'base64',size:bytes.length,sha:blob(bytes),content:bytes.toString('base64')};},
  verifyBExecutionApproval:async()=>{throw Error('unexpected');},
  readControllerState:async()=>{throw Error('unexpected');},
  loadApprovedManifest:async()=>{throw Error('unexpected');},
  readExisting:async()=>{throw Error('unexpected');},
  readLanePending:async()=>{throw Error('unexpected');},
  claimLane:async()=>{throw Error('unexpected');},
  submitIssue:async()=>{submitted++;throw Error('unexpected');}});
 assert.deepEqual(r,{status:'EMPTY',code:'QUEUE_READY_EMPTY'});
 assert.equal(fetched,1);assert.equal(submitted,0);
});

test('source bridge admits only with explicit trusted full callback contract',async()=>{
 const f=approvedFeed();let submitted=0,claimed=0,remote=null;
 const r=await pollControllerAdmissionBridge({activated:true,manualLaneUnified:true,
  githubGet:async()=>f.metadata,
  verifyBExecutionApproval:async q=>({...q,verified:true,actor:'ansqhd5774-Choi'}),
  readControllerState:async()=>({installedSha:installed,activeInstallLease:false}),
  loadApprovedManifest:async()=>({sourceRef:'main',approvalRefConfirmed:true,bytes:f.rawManifest}),
  readExisting:async()=>remote,
  readLanePending:async()=>({authoritative:true,pending:false}),
  claimLane:async()=>{claimed++;return {acquired:true};},
  submitIssue:async issue=>{
   submitted++;remote={issueNumber:201,title:issue.title,labels:issue.labels,
    author:'ansqhd5774-Choi',request:JSON.parse(issue.body),status:'QUEUED'};
   return {issueNumber:201};
  }});
 assert.equal(r.status,'ADMITTED');assert.equal(r.issueNumber,201);
 assert.equal(claimed,1);assert.equal(submitted,1);
});

test('an unmet earlier dependency does not globally block a separate READY item',async()=>{
 const f=approvedFeed();
 const decoded=JSON.parse(Buffer.from(f.metadata.content,'base64').toString('utf8'));
 decoded.items[0].dependencies=['queue-prereq123'];
 const second={...decoded.items[0],queueId:'queue-87654321',dependencies:[],
  request:{...decoded.items[0].request,
   requestId:'pc-99887766-6655-4433-8899-aabbccddeeff'}};
 decoded.items.push(second);
 const bytes=Buffer.from(JSON.stringify(decoded));
 const metadata={...f.metadata,size:bytes.length,sha:blob(bytes),content:bytes.toString('base64')};
 let accepted=null,submits=0;
 const r=await pollControllerAdmissionBridge({activated:true,manualLaneUnified:true,
  githubGet:async()=>metadata,
  verifyBExecutionApproval:async q=>({...q,verified:true,actor:'ansqhd5774-Choi'}),
  readControllerState:async()=>({installedSha:installed,activeInstallLease:false,
   completedDependencies:[]}),
  loadApprovedManifest:async()=>({sourceRef:'main',approvalRefConfirmed:true,bytes:f.rawManifest}),
  readExisting:async()=>accepted,
  readLanePending:async()=>({authoritative:true,pending:false}),
  claimLane:async()=>({acquired:true}),
  submitIssue:async issue=>{
   submits++;accepted={issueNumber:203,title:issue.title,labels:issue.labels,
    author:'ansqhd5774-Choi',request:JSON.parse(issue.body),status:'QUEUED'};
   return {issueNumber:203};
  }});
 assert.equal(r.status,'ADMITTED');assert.equal(r.issueNumber,203);
 assert.equal(accepted.request.requestId,second.request.requestId);
 assert.equal(submits,1);
});

test('trusted completed first queue item is skipped instead of starving a later item',async()=>{
 const f=approvedFeed();
 const decoded=JSON.parse(Buffer.from(f.metadata.content,'base64').toString('utf8'));
 const second={...decoded.items[0],queueId:'queue-87654321',dependencies:[],
  request:{...decoded.items[0].request,
   requestId:'pc-99887766-6655-4433-8899-aabbccddeeff'}};
 decoded.items.push(second);
 const bytes=Buffer.from(JSON.stringify(decoded));
 const metadata={...f.metadata,size:bytes.length,sha:blob(bytes),content:bytes.toString('base64')};
 let accepted=null;
 const r=await pollControllerAdmissionBridge({activated:true,manualLaneUnified:true,
  githubGet:async()=>metadata,
  verifyBExecutionApproval:async q=>({...q,verified:true,actor:'ansqhd5774-Choi'}),
  readControllerState:async()=>({installedSha:installed,activeInstallLease:false,
   completedDependencies:[f.queueId]}),
  loadApprovedManifest:async()=>({sourceRef:'main',approvalRefConfirmed:true,bytes:f.rawManifest}),
  readExisting:async()=>accepted,
  readLanePending:async()=>({authoritative:true,pending:false}),
  claimLane:async()=>({acquired:true}),
  submitIssue:async issue=>{
   accepted={issueNumber:204,title:issue.title,labels:issue.labels,
    author:'ansqhd5774-Choi',request:JSON.parse(issue.body),status:'QUEUED'};
   return {issueNumber:204};
  }});
 assert.equal(r.status,'ADMITTED');assert.equal(accepted.request.requestId,second.request.requestId);
});

test('uncertain Controller state blocks Issue claim and submission',async()=>{
 const f=approvedFeed();let claimed=0,submitted=0;
 const r=await pollControllerAdmissionBridge({activated:true,manualLaneUnified:true,
  githubGet:async()=>f.metadata,
  verifyBExecutionApproval:async q=>({...q,verified:true,actor:'ansqhd5774-Choi'}),
  readControllerState:async()=>({installedSha:null,activeInstallLease:false}),
  loadApprovedManifest:async()=>null,readExisting:async()=>null,
  readLanePending:async()=>({authoritative:true,pending:false}),
  claimLane:async()=>{claimed++;return {acquired:true};},
  submitIssue:async()=>{submitted++;return {issueNumber:201};}});
 assert.deepEqual(r,{status:'STATE_UNKNOWN',code:'QUEUE_CONTROLLER_STATE_UNVERIFIED'});
 assert.equal(claimed,0);assert.equal(submitted,0);
});

test('optional admission callback failure does not fail the existing maintenance receiver poll',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-admission-host-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const leaseRoot=path.join(root,'leases');fs.mkdirSync(leaseRoot);
 const execFileImpl=async(_binary,args)=>{
  if(args[0]==='repo')return {stdout:JSON.stringify({isPrivate:true,nameWithOwner:repo})};
  if(args[0]==='issue'&&args[1]==='list')return {stdout:'[]'};
  throw Error('unexpected command');
 };
 const agent=createMaintenanceAgent({stateDir:root,leaseRoot,execFileImpl,
  controllerAdmission:{get activated(){throw Error('untrusted callback crash');}}});
 const out=await agent.pollOnce();
 assert.deepEqual(out,[{status:'STATE_UNKNOWN',code:'QUEUE_HOST_CALLBACK_FAILED'}]);
});
