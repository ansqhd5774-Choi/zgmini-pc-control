import fs from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{observePublisherHostState,requireReadonlyOwnerContext}from'../tools/ci-controller-b-host-state-readonly.mjs';
const root='E:/ZGmini/automation/pc-maintenance',receipts='C:/ProgramData/ZGMINI-CI/ControllerBReceipts';
const names=['maintenance-contract.mjs','maintenance-apply.mjs','maintenance-agent.mjs','maintenance-lock.mjs','update.mjs','maintenance-ancestry.vbs','source-bundle-register.mjs'].map(n=>'tools/'+n);
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(policy){const docs=new Map(),dirs=new Set([root,receipts]);const files={};for(const n of names){const b=Buffer.from('fixed '+n);docs.set(root+'/'+n,b);files[n]=hash(b);}
 const manifest={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha:'a'.repeat(40),startupSha256:'b'.repeat(64),files,privateNote:'SECRET_NEVER_PUBLISH',...(policy?{ciControllerBPolicy:policy}:{})};
 docs.set(root+'/MAINTENANCE_INSTALL.json',Buffer.from(JSON.stringify(manifest)));
 const io={realpathSync:p=>p,lstatSync(p){if(!dirs.has(p)&&!docs.has(p))throw Object.assign(Error(),{code:'ENOENT'});return{isDirectory:()=>dirs.has(p),isSymbolicLink:()=>false,isFile:()=>docs.has(p),nlink:1,size:docs.get(p)?.length??0};},readFileSync:p=>docs.get(p)};return{docs,dirs,io,manifest};}
const v1={schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V1',enabled:true,workflowId:430972394,workflowBlobSha:'c'.repeat(40),workflowPath:'.github/workflows/ci-approval-controller-b.yml'};
test('absent isolated maintainer is observed, never invented as installed',()=>{const f=fixture();f.dirs.delete(root);const r=observePublisherHostState(f.io);assert.equal(r.maintenanceRootState,'ABSENT');assert.equal(r.executionAuthorized,false);assert.equal(r.manifestSha256,null);});
test('all seven hashes and V1 policy are read without exposing manifest',()=>{const f=fixture(v1),r=observePublisherHostState(f.io);assert.equal(r.matchingRuntimeFiles,7);assert.equal(r.policySchema,v1.schema);assert.equal(r.policyState,'VALID_FORMAT_ONLY');assert.doesNotMatch(JSON.stringify(r),/SECRET|startupSha256|privateNote/);assert.equal(r.operationalWrites,0);});
test('V2 exact effect is observed without granting execution',()=>{const p={...v1,schema:'ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V2',repositoryVisibility:'public',installedSha:'d'.repeat(40),targetSha:'e'.repeat(40),manifestSha256:'f'.repeat(64)},r=observePublisherHostState(fixture(p).io);assert.deepEqual(r.grant,{installedSha:p.installedSha,targetSha:p.targetSha,manifestSha256:p.manifestSha256});assert.equal(r.executionAuthorized,false);});
test('tampered file never counts as matching and absent policy remains absent',()=>{const f=fixture();f.docs.set(root+'/'+names[0],Buffer.from('changed'));const r=observePublisherHostState(f.io);assert.equal(r.matchingRuntimeFiles,6);assert.equal(r.policyState,'ABSENT');});
test('invalid policy and malformed manifest are distinguished',()=>{const f=fixture({...v1,enabled:false});assert.equal(observePublisherHostState(f.io).policyState,'INVALID');f.docs.set(root+'/MAINTENANCE_INSTALL.json',Buffer.from('invalid'));assert.equal(observePublisherHostState(f.io).manifestState,'UNREADABLE_OR_INVALID');});
test('junction root is not followed as authoritative state',()=>{const f=fixture(v1);f.io.realpathSync=()=>root+'-alias';assert.equal(observePublisherHostState(f.io).maintenanceRootState,'ALIAS');});
test('only exact Owner issue on actual isolated host enters read-only probe',()=>{const event={action:'opened',sender:{id:327938088},repository:{id:1442936296,full_name:'ansqhd5774-Choi/zgmini-pc-control',private:false,owner:{id:327938088}},issue:{number:1,state:'open',title:'ci-controller-b-state-readonly',user:{id:327938088},body:'{"schema":"ZGMINI_CI_CONTROLLER_B_STATE_READONLY_V1","role":"handoff"}'}},env={RUNNER_NAME:'zgmini-handoff-ci-spare-01',GITHUB_EVENT_NAME:'issues',GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1'};
 assert.equal(requireReadonlyOwnerContext(event,env,'DESKTOP-N62L0NG'),true);
 for(const mutate of [e=>e.sender.id=1,e=>e.issue.title='pc-job',e=>e.issue.body+=' ',e=>e.repository.private=true,e=>e.issue.state='closed']){const bad=structuredClone(event);mutate(bad);assert.throws(()=>requireReadonlyOwnerContext(bad,env,'DESKTOP-N62L0NG'));}
 assert.throws(()=>requireReadonlyOwnerContext(event,env,'PC'));assert.throws(()=>requireReadonlyOwnerContext(event,{...env,GITHUB_RUN_ATTEMPT:'2'},'DESKTOP-N62L0NG'));
});

test('public host observation uses immutable source and cannot publish B',()=>{
 const yaml=fs.readFileSync(new URL('../.github/workflows/pc-process-inventory-readonly.yml',import.meta.url),'utf8');
 const block=yaml.slice(yaml.indexOf('  public-controller-b-host-state:'));
 assert.match(block,/github.event.repository.private == false/);
 assert.match(block,/github.actor == 'ansqhd5774-Choi'/);
 assert.match(block,/github.event.issue.user.id == 327938088/);
 assert.match(block,/ref: d2c29d27c3552880b4874473578a54bbd4d24c89/);
 assert.match(block,/contents: read/);assert.match(block,/issues: write/);
 assert.doesNotMatch(block,/contents: write|--publish|PUBLIC_EFFECT_APPROVED|controller-b-operator|workflow_dispatch/);
 assert.match(yaml,/handoff-process-snapshot:[\s\S]*?github.event.repository.private == true/);
});
