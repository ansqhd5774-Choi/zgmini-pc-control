import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectPinnedApprovalSource as inspect} from '../ci-approval/approval-source-integrity.mjs';
function fixture(){
 const bytes=Buffer.from('existing policy bytes\n');
 const pin={repository:'ansqhd5774-Choi/zgmini-pc-control',revision:'a'.repeat(40),path:'docs/PC_AUTOMATION_STANDARD.md',blobSha:createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),sha256:createHash('sha256').update(bytes).digest('hex')};
 const {sha256,...metadata}=pin;void sha256;
 return {pin,observation:{...metadata,bytes}};
}
const cases=[
 ['exact bytes',()=>{},'PIN_MATCH_ONLY'],
 ['wrong repository',v=>{v.observation.repository='other/repo'},'REJECTED'],
 ['wrong revision',v=>{v.observation.revision='b'.repeat(40)},'REJECTED'],
 ['wrong path',v=>{v.observation.path='docs/other.md'},'REJECTED'],
 ['wrong blob',v=>{v.observation.blobSha='b'.repeat(40)},'REJECTED'],
 ['changed bytes',v=>{v.observation.bytes=Buffer.from('changed')},'REJECTED'],
 ['wrong sha256 pin',v=>{v.pin.sha256='0'.repeat(64)},'REJECTED'],
 ['wrong blob pin',v=>{v.pin.blobSha=v.observation.blobSha='0'.repeat(40)},'REJECTED'],
 ['mutable ref',v=>{v.pin.revision='main'},'INVALID'],
 ['arbitrary path',v=>{v.pin.path='ci-approval/self.json'},'INVALID'],
 ['path traversal',v=>{v.pin.path='approvals/writer-updates/../x.json'},'INVALID'],
 ['empty bytes',v=>{v.observation.bytes=Buffer.alloc(0)},'EVIDENCE_MISSING'],
 ['non-byte source',v=>{v.observation.bytes='text'},'EVIDENCE_MISSING'],
 ['self-declared approved field',v=>{v.pin.approved=true},'INVALID'],
 ['missing pin',v=>{v.pin=null},'INVALID'],
 ['approved status is not authority',v=>{v.observation.approved=true},'EVIDENCE_MISSING']
];
for(const [name,change,state] of cases)test(name,()=>{const v=fixture();change(v);const r=inspect(v.pin,v.observation);assert.equal(r.state,state);assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);});
