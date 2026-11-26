#!/usr/bin/env node
// Fixed read-only B preflight for the existing Writer B issue receiver.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readCommittedTaskCreateB} from './trusted-approval.mjs';
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
export function preflightTaskCreateB({event,env,controlRoot,read=readCommittedTaskCreateB}){
 const proof=read({event,env,controlRoot});
 need(/^[a-f0-9]{40}$/.test(proof.manifest?.candidateSourceSha??''),
  'TASK_CREATE_B_CANDIDATE_SOURCE_STOP');
 return Object.freeze({requestId:proof.request.requestId,
  candidateSourceSha:proof.manifest.candidateSourceSha});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  need(typeof env.GITHUB_WORKSPACE==='string'&&
   typeof env.GITHUB_EVENT_PATH==='string'&&
   typeof env.GITHUB_OUTPUT==='string','TASK_CREATE_B_PREFLIGHT_ENV_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const result=preflightTaskCreateB({event,env,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'writer-b-control')});
  fs.appendFileSync(env.GITHUB_OUTPUT,
   'candidateSourceSha='+result.candidateSourceSha+'\n');
  process.stdout.write('TASK_CREATE_B_SOURCE_PIN_VERIFIED\n');
 }catch(e){
  const code=/^TASK_CREATE_B_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
   e.code:'TASK_CREATE_B_PREFLIGHT_UNKNOWN_STOP';
  process.stderr.write(code+'\n');process.exitCode=1;
 }
}
