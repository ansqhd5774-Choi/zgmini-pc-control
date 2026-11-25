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
