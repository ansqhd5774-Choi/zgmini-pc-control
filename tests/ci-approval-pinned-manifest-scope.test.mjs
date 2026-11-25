import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectPinnedManifestScope as inspect} from '../ci-approval/pinned-manifest-scope.mjs';
import {manifestFingerprint,CONTROLLER_POST_OPERATIONS} from '../tools/maintenance-contract.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const hash=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
const wpath='approvals/writer-updates/w05-r304-maintenance-window-20261119.json';
function make(effect='B_WRITER_SOURCE'){
 const w=effect==='B_WRITER_SOURCE';
 const cp={installedSha:'b'.repeat(40),targetSha:'a'.repeat(40),allowFiles:[{path:'controller/example.mjs',sha256:'c'.repeat(64)}],purpose:'pc-controller-maintenance',postOperation:CONTROLLER_POST_OPERATIONS[0],postSourceBranch:'main',postSourceSha:'d'.repeat(40)};
 const cm={schema:'ZGMINI_PC_UPDATE_V1',...cp,approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',ref:'https://github.com/'+repo+'/pull/1'},checks:{targetSha:cp.targetSha,status:'PASS',manifestSha256:manifestFingerprint(cp.allowFiles).sha256},backup:{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:cp.installedSha}}};
 const bytes=w?readFileSync(new URL('../'+wpath,import.meta.url)):Buffer.from(JSON.stringify(cm));
 const manifest=JSON.parse(bytes),targetSha=w?manifest.candidateSourceSha:manifest.targetSha;
 const path=w?wpath:'approvals/controller-updates/synthetic.json';
 const pin={repository:repo,revision:'a'.repeat(40),path,blobSha:hash('sha1',Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])),sha256:hash('sha256',bytes)};
 const observation={repository:repo,revision:pin.revision,path,blobSha:pin.blobSha,bytes};
 const request=w?{schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',requestId:'12345678-1234-4234-8234-123456789abc',chatId:'12345678-1234-4234-8234-123456789abd',operation:'pc-writer-source-install',controlRepository:repo,approvalManifestPath:path,approvalManifestSha256:pin.sha256}:{schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId:'pc-update-12345678-1234-4234-8234-123456789abc',chatId:'chat-test',operation:'controller-update',controlRepository:repo,targetControllerSha:targetSha,approvalManifestSha256:pin.sha256};
 const context=w?{observedHead:manifest.baseHead,observedConfigSha:manifest.baseConfigSourceSha}:{actor:'ansqhd5774-Choi',installedSha:manifest.installedSha};
 return {effect,pin,observation,request,context,targetSha,requestState:'NEW'};
}
const match='EXACT_MANIFEST_SCOPE_MATCH_ONLY';
const cases=[
 ['Writer historical scope fixture',undefined,()=>{},match],
 ['Controller synthetic scope fixture','B_CONTROLLER_INSTALL',()=>{},match],
 ['C excluded',undefined,v=>{v.effect='C_ADMIN'},'OUT_OF_SCOPE'],
 ['D1 excluded',undefined,v=>{v.effect='B_D1_WRITE'},'OUT_OF_SCOPE'],
 ['consumed request',undefined,v=>{v.requestState='CONSUMED'},'WAIT_RESOURCE'],
 ['unknown request',undefined,v=>{v.requestState='UNKNOWN'},'WAIT_RESOURCE'],
 ['missing request state',undefined,v=>{delete v.requestState},'EVIDENCE_MISSING'],
 ['different target',undefined,v=>{v.targetSha='e'.repeat(40)},'REJECTED'],
 ['changed manifest bytes',undefined,v=>{v.observation.bytes=Buffer.from('changed')},'REJECTED'],
 ['wrong request hash',undefined,v=>{v.request.approvalManifestSha256='0'.repeat(64)},'REJECTED'],
 ['wrong Writer path',undefined,v=>{v.request.approvalManifestPath='approvals/writer-updates/other.json'},'REJECTED'],
 ['Writer config drift',undefined,v=>{v.context.observedConfigSha='e'.repeat(40)},'REJECTED'],
 ['Writer extra field',undefined,v=>{v.request.command='extra'},'REJECTED'],
 ['Writer wrong actor operation',undefined,v=>{v.request.operation='other'},'REJECTED'],
 ['Controller preimage drift','B_CONTROLLER_INSTALL',v=>{v.context.installedSha='e'.repeat(40)},'REJECTED'],
 ['Controller wrong actor','B_CONTROLLER_INSTALL',v=>{v.context.actor='other'},'REJECTED'],
 ['cross-effect path',undefined,v=>{v.effect='B_CONTROLLER_INSTALL'},'OUT_OF_SCOPE']
];
for(const [name,e,change,state] of cases)test(name,()=>{const v=make(e);change(v);const r=inspect(v);assert.equal(r.state,state);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);});

function selectiveFixture({config=false}={}){
 const v=make('B_CONTROLLER_INSTALL'),m=JSON.parse(v.observation.bytes);
 m.controllerOnlyInstall=true;
 m.selectiveSource={schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',branch:'codex/selective-test',mainSha:'f'.repeat(40),customPaths:[]};
 if(config){m.allowFiles=[{path:'config/operations.json',sha256:'c'.repeat(64)}];m.checks.manifestSha256=manifestFingerprint(m.allowFiles).sha256;}
 function source(path,obj){
  const bytes=Buffer.from(JSON.stringify(obj)),p={repository:repo,revision:v.pin.revision,path,blobSha:hash('sha1',Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])),sha256:hash('sha256',bytes)};
  return [p,{repository:repo,revision:p.revision,path,blobSha:p.blobSha,bytes}];
 }
 [v.pin,v.observation]=source('approvals/controller-updates/'+m.targetSha+'.json',m);
 v.request.approvalManifestSha256=v.pin.sha256;
 const s={schema:'ZGMINI_CONTROLLER_SELECTIVE_PIN_V1',installedSha:m.installedSha,targetSha:m.targetSha,sourceMainSha:m.selectiveSource.mainSha,targetBranch:m.selectiveSource.branch,customPaths:[],allowFiles:m.allowFiles,approvalRef:m.approval.ref};
 [v.selectivePin,v.selectiveObservation]=source('approvals/controller-selective-targets/'+m.targetSha+'.json',s);
 return {v,s,source};
}
for(const [name,change,expected] of [
 ['selective two pins',()=>{},'SELECTIVE_MANIFEST_PIN_MATCH_ONLY'],
 ['missing selective pin',({v})=>{delete v.selectivePin},'EVIDENCE_MISSING'],
 ['tampered selective bytes',({v})=>{v.selectiveObservation.bytes=Buffer.from('{}')},'REJECTED'],
 ['wrong selective revision',({v})=>{v.selectivePin.revision='e'.repeat(40)},'REJECTED'],
 ['wrong selective target path',({v})=>{v.selectivePin.path='approvals/controller-selective-targets/other.json'},'REJECTED'],
 ['valid bytes but mismatched installed SHA',({v,s,source})=>{s.installedSha='e'.repeat(40);[v.selectivePin,v.selectiveObservation]=source(v.selectivePin.path,s)},'REJECTED'],
 ['consumed selective request',({v})=>{v.requestState='CONSUMED'},'WAIT_RESOURCE'],
 ['unknown selective request',({v})=>{v.requestState='UNKNOWN'},'WAIT_RESOURCE']
])test(name,()=>{const fixture=selectiveFixture();change(fixture);const r=inspect(fixture.v);assert.equal(r.state,expected);assert.equal(r.mode,'SHADOW_ONLY');assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);});
test('selective config remains outside delegation pilot',()=>{const r=inspect(selectiveFixture({config:true}).v);assert.equal(r.state,'OUT_OF_SCOPE');assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);});
test('nonselective request rejects unexpected selective pin',()=>{const v=make('B_CONTROLLER_INSTALL');v.selectivePin=selectiveFixture().v.selectivePin;assert.equal(inspect(v).state,'REJECTED');});
