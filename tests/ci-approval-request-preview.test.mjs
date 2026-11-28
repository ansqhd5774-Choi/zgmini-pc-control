import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {prepareScopedRequestPreview as prepare,prepareExistingApprovalRequest as prepareExisting} from '../ci-approval/request-preview.mjs';
import {manifestFingerprint,CONTROLLER_POST_OPERATIONS} from '../tools/maintenance-contract.mjs';
import {verifyMaintenanceIssue} from '../tools/maintenance-request.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const hash=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
function fixture(effect='B_WRITER_SOURCE',mode){
 const writer=effect==='B_WRITER_SOURCE',path=writer?'approvals/writer-updates/w05-r304-maintenance-window-20261119.json':'approvals/controller-updates/synthetic.json';
 const cp={installedSha:'b'.repeat(40),targetSha:'a'.repeat(40),allowFiles:[{path:'controller/example.mjs',sha256:'c'.repeat(64)}],purpose:'pc-controller-maintenance',postOperation:CONTROLLER_POST_OPERATIONS[0],postSourceBranch:'main',postSourceSha:'d'.repeat(40)};
 const cm={schema:'ZGMINI_PC_UPDATE_V1',...cp,approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',ref:'https://github.com/'+repo+'/pull/1'},checks:{targetSha:cp.targetSha,status:'PASS',manifestSha256:manifestFingerprint(cp.allowFiles).sha256},backup:{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:cp.installedSha}}};
 const m=writer?JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8')):cm;
 if(writer&&mode!==undefined){if(mode===null)delete m.coreMaintenance;else m.coreMaintenance=mode;}
 const bytes=Buffer.from(JSON.stringify(m)),targetSha=writer?m.candidateSourceSha:m.targetSha;
 const pin={repository:repo,revision:'a'.repeat(40),path,blobSha:hash('sha1',Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])),sha256:hash('sha256',bytes)};
 const observation={repository:repo,revision:pin.revision,path,blobSha:pin.blobSha,bytes};
 const request=writer?{schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',requestId:'12345678-1234-4234-8234-123456789abc',chatId:'12345678-1234-4234-8234-123456789abd',operation:'pc-writer-source-install',controlRepository:repo,approvalManifestPath:path,approvalManifestSha256:pin.sha256}:{schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId:'pc-update-12345678-1234-4234-8234-123456789abc',chatId:'chat-test',operation:'controller-update',controlRepository:repo,targetControllerSha:targetSha,approvalManifestSha256:pin.sha256};
 return {effect,pin,observation,request,targetSha,requestState:'NEW',context:writer?{observedHead:m.baseHead,observedConfigSha:m.baseConfigSourceSha}:{actor:'ansqhd5774-Choi',installedSha:m.installedSha}};
}
function check(r,state='REQUEST_PREVIEW_ONLY'){assert.equal(r.state,state);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);}
test('Controller existing readback envelope contract',()=>{const v=fixture('B_CONTROLLER_INSTALL'),r=prepare(v);check(r);assert.equal(r.preview.title,'pc-controller-update');assert.equal(verifyMaintenanceIssue(r.preview,{number:1,title:r.preview.title,body:r.preview.body,user:{login:'ansqhd5774-Choi'},state:'open',labels:[{name:'pc-maintenance'}]}).requestId,v.request.requestId);});
test('Writer preserves original request and deterministic body',()=>{const v=fixture(),a=prepare(v),b=prepare(v);check(a);assert.deepEqual(a,b);assert.deepEqual(JSON.parse(a.preview.body),v.request);assert.equal(a.bodySha256,hash('sha256',a.preview.body));});
for(const [mode,labels] of [[null,['pc-writer-b-install']],['PAUSE_NEW_STARTS_DRAIN_360S_V1',['pc-writer-b-install']],['PAUSE_NEW_STARTS_DRAIN_1200S_V1',['pc-writer-b-install','pc-writer-b-extended-drain-1200']],['PAUSE_NEW_STARTS_DRAIN_2400S_V1',['pc-writer-b-install','pc-writer-b-extended-drain-2400']]])test('exact Writer labels '+mode,()=>{const r=prepare(fixture(undefined,mode));check(r);assert.deepEqual(r.preview.labels,labels);});
for(const [name,edit,state] of [['consumed',v=>{v.requestState='CONSUMED'},'WAIT_RESOURCE'],['unknown',v=>{v.requestState='UNKNOWN'},'WAIT_RESOURCE'],['wrong hash',v=>{v.request.approvalManifestSha256='0'.repeat(64)},'REJECTED'],['wrong target',v=>{v.targetSha='e'.repeat(40)},'REJECTED'],['extra command',v=>{v.request.command='x'},'REJECTED'],['C excluded',v=>{v.effect='C_ADMIN'},'OUT_OF_SCOPE']])test(name,()=>{const v=fixture();edit(v);const r=prepare(v);check(r,state);assert.equal(Object.hasOwn(r,'preview'),false);});

function selectiveFixture(){
 const v=fixture('B_CONTROLLER_INSTALL'),m=JSON.parse(v.observation.bytes);
 m.controllerOnlyInstall=true;
 m.selectiveSource={schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',branch:'codex/selective-test',mainSha:'f'.repeat(40),customPaths:[]};
 const source=(path,obj)=>{
  const bytes=Buffer.from(JSON.stringify(obj)),pin={repository:repo,revision:v.pin.revision,path,blobSha:hash('sha1',Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])),sha256:hash('sha256',bytes)};
  return [pin,{repository:repo,revision:pin.revision,path,blobSha:pin.blobSha,bytes}];
 };
 [v.pin,v.observation]=source('approvals/controller-updates/'+m.targetSha+'.json',m);
 v.request.approvalManifestSha256=v.pin.sha256;
 [v.selectivePin,v.selectiveObservation]=source('approvals/controller-selective-targets/'+m.targetSha+'.json',{schema:'ZGMINI_CONTROLLER_SELECTIVE_PIN_V1',installedSha:m.installedSha,targetSha:m.targetSha,sourceMainSha:m.selectiveSource.mainSha,targetBranch:m.selectiveSource.branch,customPaths:[],allowFiles:m.allowFiles,approvalRef:m.approval.ref});
 return v;
}
test('selective preview remains distinct and preserves existing envelope',()=>{
 const v=selectiveFixture(),r=prepare(v);check(r,'SELECTIVE_REQUEST_PREVIEW_ONLY');
 assert.equal(r.mode,'SHADOW_ONLY');assert.equal(r.selectivePinSha256,v.selectivePin.sha256);assert.equal(r.approvalRevision,v.pin.revision);
 assert.equal(r.requestId,v.request.requestId);assert.deepEqual(JSON.parse(r.preview.body),v.request);assert.equal(r.bodySha256,hash('sha256',r.preview.body));assert.deepEqual(r,prepare(v));
 assert.equal(verifyMaintenanceIssue(r.preview,{number:1,title:r.preview.title,body:r.preview.body,user:{login:'ansqhd5774-Choi'},state:'open',labels:[{name:'pc-maintenance'}]}).requestId,v.request.requestId);
});
for(const [name,edit,state] of [
 ['missing pin',v=>{delete v.selectivePin},'EVIDENCE_MISSING'],
 ['tampered pin',v=>{v.selectiveObservation.bytes=Buffer.from('{}')},'REJECTED'],
 ['non-buffer pin',v=>{v.selectiveObservation.bytes=new Uint8Array([1])},'INVALID'],
 ['consumed',v=>{v.requestState='CONSUMED'},'WAIT_RESOURCE'],
 ['unknown',v=>{v.requestState='UNKNOWN'},'WAIT_RESOURCE'],
 ['wrong revision',v=>{v.selectivePin.revision='e'.repeat(40)},'REJECTED']
])test('selective preview '+name,()=>{const v=selectiveFixture();edit(v);const r=prepare(v);check(r,state);assert.equal(Object.hasOwn(r,'preview'),false);});
test('Writer does not accept unrelated selective pin',()=>{const v=fixture();v.selectivePin=selectiveFixture().selectivePin;const r=prepare(v);check(r,'REJECTED');assert.equal(Object.hasOwn(r,'preview'),false);});

function existingInput(v){
 const {request,...scope}=v;
 return {...scope,requestIdentity:{requestId:request.requestId,chatId:request.chatId}};
}
for(const [name,make] of [
 ['Controller',()=>fixture('B_CONTROLLER_INSTALL')],
 ['Writer',()=>fixture()],
 ['selective Controller',selectiveFixture]
])test(name+' existing approval reuses exact request identity across CI reruns',()=>{
 const v=make(),input=existingInput(v),r=prepareExisting(input);
 assert.deepEqual(r,prepare(v));
 assert.deepEqual(prepareExisting(input),r);
 assert.equal(r.requestId,v.request.requestId);
 assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
});
for(const [name,edit,state] of [
 ['missing identity',v=>{delete v.requestIdentity},'EVIDENCE_MISSING'],
 ['two identity sources',v=>{v.request=fixture().request},'INVALID'],
 ['consumed',v=>{v.requestState='CONSUMED'},'WAIT_RESOURCE'],
 ['unknown',v=>{v.requestState='UNKNOWN'},'WAIT_RESOURCE'],
 ['invalid identity',v=>{v.requestIdentity.requestId='invalid'},'REJECTED'],
 ['changed bytes',v=>{v.observation.bytes=Buffer.from('{}')},'REJECTED']
])test('existing approval '+name,()=>{
 const v=existingInput(fixture());edit(v);const r=prepareExisting(v);
 check(r,state);assert.equal(Object.hasOwn(r,'preview'),false);
});


import {preparePublicWriter4135PolicyPreview,PUBLIC_WRITER_4135} from '../ci-approval/request-preview.mjs';
function public4135Fixture(){
 const fixed=PUBLIC_WRITER_4135;
 const bytes=readFileSync(new URL('../'+fixed.manifestPath,import.meta.url));
 const m=JSON.parse(bytes);
 const pin={repository:repo,revision:'a'.repeat(40),path:fixed.manifestPath,
  blobSha:hash('sha1',Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])),
  sha256:hash('sha256',bytes)};
 const sourceHeadSha='b'.repeat(40),controlHead='c'.repeat(40);
 const file=(revision,path)=>{
  const bytes=Buffer.from('source-only fixture '+path);
  return {repository:repo,revision,path,bytes,
   blobSha:hash('sha1',Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes]))};
 };
 return {requestInput:{effect:'B_WRITER_SOURCE',pin,observation:{repository:repo,
  revision:pin.revision,path:pin.path,blobSha:pin.blobSha,bytes},
  requestIdentity:{requestId:'12345678-1234-4234-8234-123456789abc',
   chatId:'12345678-1234-4234-8234-123456789abd'},requestState:'NEW',
  targetSha:m.candidateSourceSha,context:{observedHead:m.baseHead,observedConfigSha:m.baseConfigSourceSha}},
  sourceHeadSha,controlHead,installedControllerSha:'d'.repeat(40),
  sourceWorkflow:file(sourceHeadSha,fixed.sourceWorkflowPath),
  receiverWorkflow:file(controlHead,fixed.receiverWorkflowPath),
  adapter:file(controlHead,fixed.adapterPath)};
}
test('exact #4135 native preview binds future first attempt and separate final main pin without an installed grant',()=>{
 const x=public4135Fixture(),r=preparePublicWriter4135PolicyPreview(x);
 check(r,'PUBLIC_WRITER_POLICY_PREVIEW_ONLY');assert.equal(r.canInstall,false);
 assert.equal(r.operationalWrites,0);assert.equal(r.proposedPolicy.effect,'B_WRITER_SOURCE');
 assert.equal(r.proposedPolicy.sourceRunMode,'EVENT_COMPLETION_V1');
 assert.equal(Object.hasOwn(r.proposedPolicy,'sourceRunId'),false);
 assert.equal(r.proposedPolicy.sourceAttempt,1);
 assert.equal(r.proposedPolicy.nativeWriterBControlSha,x.controlHead);
 assert.equal(r.proposedPolicy.nativeWriterBAdapterSha256,hash('sha256',x.adapter.bytes));
 assert.equal(r.proposedPolicy.approvedRequestSha256,hash('sha256',r.body));
 assert.equal(r.proposedPolicySha256,hash('sha256',JSON.stringify(r.proposedPolicy)));
 assert.deepEqual(r,preparePublicWriter4135PolicyPreview(x));
 assert.equal(Object.hasOwn(r,'installedProof'),false);
});
for(const [name,edit,state] of [
 ['original request',x=>{x.requestInput.requestIdentity.requestId=PUBLIC_WRITER_4135.originalRequestId},'REJECTED'],
 ['different approval',x=>{x.requestInput.pin.sha256='0'.repeat(64)},'REJECTED'],
 ['consumed',x=>{x.requestInput.requestState='CONSUMED'},'WAIT_RESOURCE'],
 ['missing main',x=>{delete x.controlHead},'EVIDENCE_MISSING'],
 ['same source and main',x=>{x.sourceHeadSha=x.controlHead},'EVIDENCE_MISSING'],
 ['receiver revision drift',x=>{x.receiverWorkflow.revision=x.sourceHeadSha},'EVIDENCE_MISSING'],
 ['adapter changed bytes',x=>{x.adapter.bytes=Buffer.from('other')},'EVIDENCE_MISSING']
])test('exact #4135 policy preview refuses '+name,()=>{
 const x=public4135Fixture();edit(x);const r=preparePublicWriter4135PolicyPreview(x);
 check(r,state);assert.equal(Object.hasOwn(r,'proposedPolicy'),false);
});
