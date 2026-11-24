import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readCommittedSidecarApproval} from './trusted-approval.mjs';
import {TITLE,LABEL,REQUEST_SCHEMA} from './admission.mjs';
import {SCHEMA,TARGET,PREIMAGE,sha256} from './contract.mjs';

const HEAD='a'.repeat(40),SHA='b'.repeat(64),
 ID='8f265fcb-45b7-43b8-acd2-40976524db91';
const relative='approvals/sidecar-b/cnn-r10.json';
const manifest={schema:SCHEMA,status:'APPROVED_B',requestId:ID,
 target:TARGET,beforeSha256:PREIMAGE,afterSha256:'c'.repeat(64),
 approvedContentSha256:'c'.repeat(64),approvedSourceSha:HEAD,
 installedHead:HEAD,installedConfigSource:HEAD,taskDefinitionSha256:SHA,
 wrapperSha256:SHA,allowProviderCalls:false,allowDbChanges:false,
 allowD1Writes:false,allowTaskChanges:false,runCount:1};
const raw=Buffer.from(JSON.stringify(manifest));
const req={schema:REQUEST_SCHEMA,requestId:ID,
 approvalManifestPath:relative,approvalManifestSha256:sha256(raw),
 controlHead:HEAD};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:HEAD};
const event={repository:{full_name:env.GITHUB_REPOSITORY,private:true},
 sender:{login:'ansqhd5774-Choi'},
 issue:{number:100,title:TITLE,user:{login:'ansqhd5774-Choi'},
 labels:[{name:LABEL}],body:JSON.stringify(req)}};
function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cnn-sidecar-control-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const dir=path.join(root,'approvals','sidecar-b');
 fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'cnn-r10.json');
 fs.writeFileSync(file,raw);
 const git=(r,args)=>({status:0,stdout:args[0]==='rev-parse'?HEAD+'\n':''});
 const read=(changed={})=>readCommittedSidecarApproval({
  controlRoot:root,event,env,runGit:git,...changed
 });
 return {root,file,git,read};
}
test('pinned tracked manifest, owner issue and exact approval bytes pass',t=>{
 const f=setup(t);
 const a=f.read();
 assert.equal(a.manifest.requestId,ID);
 assert.equal(a.manifestSha256,sha256(raw));
});
test('drifted control HEAD and untracked approval stop before use',t=>{
 const f=setup(t);
 assert.throws(()=>f.read({runGit:(r,args)=>({
  status:0,stdout:args[0]==='rev-parse'?'f'.repeat(40):''
 })}),e=>e.code==='SIDECAR_B_CONTROL_HEAD_STOP');
 assert.throws(()=>f.read({runGit:(r,args)=>({
  status:args[0]==='ls-files'?1:0,
  stdout:args[0]==='rev-parse'?HEAD:''
 })}),e=>e.code==='SIDECAR_B_APPROVAL_UNTRACKED_STOP');
});
test('dirty tracked manifest, missing approval and forged request hash stop',t=>{
 const f=setup(t);
 assert.throws(()=>f.read({runGit:(r,args)=>({
  status:args[0]==='diff'?1:0,stdout:args[0]==='rev-parse'?HEAD:''
 })}),e=>e.code==='SIDECAR_B_APPROVAL_DIRTY_STOP');
 fs.unlinkSync(f.file);
 assert.throws(()=>f.read(),e=>e.code==='SIDECAR_B_APPROVAL_FILE_STOP');
 fs.writeFileSync(f.file,Buffer.from(JSON.stringify({...manifest,afterSha256:'d'.repeat(64)})));
 assert.throws(()=>f.read(),e=>e.code==='SIDECAR_B_APPROVAL_BYTES_STOP');
});
test('Issue cannot point outside reviewed approval directory or inject fields',t=>{
 const f=setup(t);
 for(const extra of [{approvalManifestPath:'../../secrets.json'}, {additional:'command'}]){
  const altered={...event,issue:{...event.issue,
   body:JSON.stringify({...req,...extra})}};
  assert.throws(()=>f.read({event:altered}),e=>
   e.code==='SIDECAR_B_APPROVAL_PATH_STOP'||
   e.code==='SIDECAR_B_REQUEST_SCOPE_STOP');
 }
});
test('unapproved Issue actor fails even with perfect committed manifest',t=>{
 const f=setup(t);
 assert.throws(()=>f.read({event:{...event,sender:{login:'outsider'}}}),
  e=>e.code==='SIDECAR_B_EVENT_ORIGIN_STOP');
});
