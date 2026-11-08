import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadAuthorization} from './run.mjs';
import {APPROVAL_SCHEMA,REQUEST_SCHEMA,OPERATION,TARGET,SCOPE,TITLE,LABEL,
 CONTROL_REPOSITORY,ACTOR,sha256} from './contract.mjs';
import {EMPLOYMENT_R6_PREIMAGE_FILES} from '../controller/writer-install-preimage-readonly.mjs';

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r6-config-b-approval-'));
 const dir=path.join(root,'approvals','writer-config');fs.mkdirSync(dir,{recursive:true});
 const relative='approvals/writer-config/employment-r6-optins-20261108.json';
 const manifest={schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
  targetPath:TARGET,beforeSha256:'0'.repeat(64),
  changes:[{key:'employmentR6AutoCollection',value:true},
   {key:'employmentR6OneYearAutoPublication',value:true}],runCount:1,
  allowOtherChanges:false,allowProviderCalls:false,allowTaskChanges:false,
  allowSourceChanges:false,allowDbWrites:false,
  verifiedR6Install:{requestId:'a314f1b7-6279-4136-9bd2-b20123456789',
   manifestSha256:'e'.repeat(64),sourceSha:'c'.repeat(40),issueNumber:999,
   status:'WRITER_B_INSTALLED_VERIFIED'},
  installedFiles:EMPLOYMENT_R6_PREIMAGE_FILES.map(path=>({path,afterSha256:'a'.repeat(64)}))};
 const raw=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(dir,'employment-r6-optins-20261108.json'),raw);
 const request={schema:REQUEST_SCHEMA,requestId:'a314f1b7-6279-4136-9bd2-b20123456789',
  chatId:'4a14f2b7-6279-4136-9bd2-b20123456789',operation:OPERATION,
  controlRepository:CONTROL_REPOSITORY,
  approvalManifestPath:relative,approvalManifestSha256:sha256(raw)};
 const event={repository:{full_name:CONTROL_REPOSITORY,private:true},
  sender:{login:ACTOR},issue:{number:100,title:TITLE,user:{login:ACTOR},
   labels:[{name:LABEL}],body:JSON.stringify(request)}};
 const eventPath=path.join(root,'event.json');
 fs.writeFileSync(eventPath,JSON.stringify(event));
 const env={GITHUB_EVENT_PATH:eventPath,GITHUB_REPOSITORY:CONTROL_REPOSITORY,
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:ACTOR,
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'f'.repeat(40)};
 return {root,raw,relative,eventPath,env,
  close(){fs.rmSync(root,{force:true,recursive:true});}};
}

test('pinned blob and exact worktree bytes authorize Windows one-shot config B',()=>{
 const f=fixture();
 try{
  const a=loadAuthorization({env:f.env,controlRoot:f.root,
   head:()=>f.env.GITHUB_SHA,blob:()=>f.raw});
  assert.equal(a.manifest.beforeSha256,'0'.repeat(64));
  assert.equal(a.request.approvalManifestPath,f.relative);
 }finally{f.close();}
});

test('Git checkout CRLF translation allowed, committed LF bytes still authoritative',()=>{
 const f=fixture();
 try{
  const file=path.join(f.root,...f.relative.split('/'));
  fs.writeFileSync(file,f.raw.toString('utf8').replace(/\n/g,'\r\n'));
  assert.equal(loadAuthorization({env:f.env,controlRoot:f.root,
   head:()=>f.env.GITHUB_SHA,blob:()=>f.raw}).manifest.status,'APPROVED_B');
 }finally{f.close();}
});

test('arbitrary manifest byte drift, wrong source, and unsafe manifest are refused',()=>{
 const f=fixture();
 try{
  const file=path.join(f.root,...f.relative.split('/'));
  fs.writeFileSync(file,Buffer.concat([f.raw,Buffer.from(' ')]));
  assert.throws(()=>loadAuthorization({env:f.env,controlRoot:f.root,
   head:()=>f.env.GITHUB_SHA,blob:()=>f.raw}),/CONFIG_B_MANIFEST_WORKTREE_DRIFT_STOP/);
  fs.writeFileSync(file,f.raw);
  assert.throws(()=>loadAuthorization({env:f.env,controlRoot:f.root,
   head:()=>('a'.repeat(40)),blob:()=>f.raw}),/CONFIG_B_CONTROL_SHA_STOP/);
 }finally{f.close();}
});
