#!/usr/bin/env node
// Read-only fixed B admission: verifies reviewed control source and returns
// only the immutable candidate commit to the fixed GitHub checkout step.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readCommittedSidecarApproval} from './trusted-approval.mjs';
const STOP=c=>{throw Object.assign(Error(c),{code:c});};
const need=(ok,c)=>{if(!ok)STOP(c);};
export function preflightApprovedSidecarB({event,env,controlRoot,read=readCommittedSidecarApproval}){
 const proof=read({event,env,controlRoot});
 need(proof?.manifest?.approvedSourceSha&&
  /^[0-9a-f]{40}$/.test(proof.manifest.approvedSourceSha),
  'SIDECAR_B_PREFLIGHT_SOURCE_STOP');
 return Object.freeze({requestId:proof.request.requestId,
  candidateSourceSha:proof.manifest.approvedSourceSha});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  need(typeof env.GITHUB_WORKSPACE==='string'&&
   typeof env.GITHUB_EVENT_PATH==='string'&&
   typeof env.GITHUB_OUTPUT==='string','SIDECAR_B_PREFLIGHT_ENV_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const controlRoot=path.join(env.GITHUB_WORKSPACE,'cnn-b-control');
  const out=preflightApprovedSidecarB({event,env,controlRoot});
  fs.appendFileSync(env.GITHUB_OUTPUT,'candidateSourceSha='+out.candidateSourceSha+'\n');
  process.stdout.write('SIDECAR_B_PINNED_SOURCE_PREFLIGHT_PASS\n');
 }catch(e){
  const code=/^SIDECAR_B_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
   e.code:'SIDECAR_B_PREFLIGHT_UNVERIFIED_STOP';
  process.stderr.write(code+'\n');process.exitCode=1;
 }
}
