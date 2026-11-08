import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {reportProof,runFixtureProof} from './proof-only.mjs';
import {ACTOR,CONTROL_REPOSITORY} from './contract.mjs';

function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'r6-proof-reporter-'));
 const event={repository:{full_name:CONTROL_REPOSITORY,private:true},
  sender:{login:ACTOR},issue:{number:1818,title:'pc-writer-config-b-proof-once',
   user:{login:ACTOR},labels:[{name:'pc-maintenance'}]}};
 const env={GITHUB_REPOSITORY:CONTROL_REPOSITORY,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:ACTOR,GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'111222333',
  GITHUB_WORKSPACE:dir,RUNNER_TEMP:dir,GITHUB_TOKEN:'x'.repeat(24)};
 const writer=path.join(dir,'writer-config-b-proof-result.json');
 const result={schema:'ZGMINI_WRITER_CONFIG_B_WINDOWS_PROOF_V1',
  status:'PASS',code:'WINDOWS_TEMP_FIXTURE_TESTS_PASS',
  controlSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,
  issueNumber:1818,testFiles:7,configOperationalWrites:0,
  writerOperationalWrites:0,mode:'TEMP_FIXTURE_ONLY_NOT_PRODUCTION_INSTALL'};
 fs.writeFileSync(writer,JSON.stringify(result));
 return {dir,event,env,result,close(){fs.rmSync(dir,{recursive:true,force:true});}};
}
test('proof-only mode must never invoke operational B in non-Windows environment',()=>{
 if(process.platform==='win32')return;
 const x=fixture();try{
  assert.throws(()=>runFixtureProof(x.event,x.env),
   /CONFIG_B_PROOF_WINDOWS_REQUIRED/);
 }finally{x.close();}
});
test('sanitized proof report writes two create-only artifacts with independent readback',async()=>{
 const x=fixture(),files=new Map();let puts=0,gets=0,comments=0;
 const fetchApi=async(url,opts)=>{
  if(url.endsWith('/comments')){comments++;return {status:201};}
  if(opts.method==='PUT'){
   const body=JSON.parse(opts.body);assert.equal(Object.hasOwn(body,'sha'),false);
   puts++;files.set(url,Buffer.from(body.content,'base64'));return {status:201};
  }
  if(opts.method==='GET'){
   gets++;const bytes=files.get(url.split('?')[0]);
   return {status:bytes?200:404,async json(){return {
    encoding:'base64',content:bytes?.toString('base64')}}};
  }
  throw Error('Unknown method');
 };
 try{
  const r=await reportProof(x.event,x.env,{fetchApi});
  assert.deepEqual([r.status,r.verified,r.created,puts,gets,comments],
   ['PASS',2,2,2,2,1]);
  const data=[...files.values()].map(x=>x.toString('utf8')).join('\n');
  assert.equal(data.includes(x.env.GITHUB_TOKEN),false);
 }finally{x.close();}
});
