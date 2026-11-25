import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {validateSourceBundleBApproval} from '../tools/source-bundle-register.mjs';

const root=path.resolve(import.meta.dirname,'..');
const controllerSha='1543e13fdebb18267a76ebb4653535c87438c3f0';
const sourceSha='e3c6ec73238f5f4a48be7890679038ba0ccb21b6';
const sourceManifestPath='approvals/source-bundles/manifests/'+sourceSha+'.json';
const sourceManifestSha='57e9e557764ec9dc22144ac88ccc19a9b2a69caf35ecb4cf66d7053b29d2afde';
const requestId='pc-update-5d14db64-8119-4f21-9eac-6cd74ee1ac5b';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

const readApproval=()=>{
 const dir=path.join(root,'approvals/source-bundles');
 const files=fs.readdirSync(dir).filter(name=>/^[a-f0-9]{64}\.json$/.test(name));
 for(const name of files){
  const body=fs.readFileSync(path.join(dir,name));
  if(digest(body)!==name.slice(0,-5))continue;
  let obj;
  try{obj=JSON.parse(body);}catch{continue;}
  if(obj?.sourceSha===sourceSha)return {body,obj,name};
 }
 throw Error('W04_R1_CONDITIONAL_APPROVAL_NOT_STAGED');
};

test('W04 R1 minimal 18-file source inventory has pinned exact raw bytes',()=>{
 // The approved bytes are the Git object, not a reused Windows checkout:
 // a prior checkout may have transformed this already-merged manifest to CRLF.
 const raw=execFileSync('git',['show','HEAD:'+sourceManifestPath],
  {cwd:root,encoding:'buffer',maxBuffer:2_000_000});
 assert.equal(raw.includes(Buffer.from('\r\n')),false,
  'approved source manifest Git blob must be LF');
 assert.equal(digest(raw),sourceManifestSha);
 const worktree=fs.readFileSync(path.join(root,sourceManifestPath));
 if(worktree.includes(Buffer.from('\r\n')))
  assert.notEqual(digest(worktree),sourceManifestSha,
   'transformed checkout must not impersonate immutable source manifest');
 const m=JSON.parse(raw);
 assert.equal(m.schema,'ZGMINI_PC_SOURCE_BUNDLE_MANIFEST_V1');
 assert.equal(m.sourceSha,sourceSha);
 assert.equal(m.sourceBranch,'codex/w04-r1-date-minimal-20261125');
 assert.equal(m.entrypoint,'scripts/pc-writer/employment-r6-runner-stage.mjs');
 assert.equal(Object.keys(m.files).length,18);
 assert.equal(m.files[m.entrypoint],'2c30a7cd8f4d851f78732e885dd3687078e60b36fc995199929bb36fec69c59e');
});

test('W04 R1 conditional B approval preserves source closure and exact host CAS scope',()=>{
 const {body,obj,name}=readApproval();
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId,
  chatId:'chat-w04-r1-minimal-source-b-conditional',
  operation:'pc-source-bundle-register',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  targetControllerSha:controllerSha,approvalManifestSha256:digest(body)};
 assert.equal(name,request.approvalManifestSha256+'.json');
 assert.equal(obj.sourceSha,sourceSha);
 assert.equal(obj.sourceManifestSha256,sourceManifestSha);
 assert.equal(obj.backupDirectory,'E:/ZGmini/automation/pc-control/backups/source-'+requestId);
 assert.equal(obj.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3577');
 assert.deepEqual(validateSourceBundleBApproval(request,body,{actor:'ansqhd5774-Choi',installedSha:controllerSha}),obj);
 assert.throws(()=>validateSourceBundleBApproval(request,body,{actor:'ansqhd5774-Choi',
  installedSha:'3d42f226fcffde1f09885da552f9b003ea30e57e'}),/BUNDLE_B_APPROVAL_CONTRACT_INVALID/);
 assert.throws(()=>validateSourceBundleBApproval({...request,targetControllerSha:'502aac841475fa94b7cc9d56c028fd38b0554831'},body,{actor:'ansqhd5774-Choi',
  installedSha:controllerSha}),/BUNDLE_B_APPROVAL_CONTRACT_INVALID/);
});

test('W04 Source B immutable LF manifest rejects CRLF bytes as approved raw digest',()=>{
 const {body,name}=readApproval();
 assert.equal(body.includes(13),false);
 const crlf=Buffer.from(body.toString('utf8').replace(/\n/g,'\r\n'),'utf8');
 assert.notEqual(digest(crlf),name.slice(0,-5));
});
