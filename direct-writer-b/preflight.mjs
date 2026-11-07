#!/usr/bin/env node
// Fixed read-only manifest authorization BEFORE checkout of the candidate.
// Only a 40-byte source SHA is emitted to the GitHub Actions output file.
// Neither the Issue body nor this tool can choose a repository, command or path.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadApprovedRaw,DIRECT_B_RESULT} from './run.mjs';

const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};

export function approvedCandidateSource(auth){
 need(['PIN_REGISTRY_CAS','VERSIONED_BUNDLE_ACTIVATE',
   'CONFIGURED_THEMES_REPEAT_UPGRADE'].includes(auth?.mode)&&
  SHA40.test(auth?.manifest?.sourceSha??'')&&
  SHA40.test(auth?.controlSha??'')&&
  SHA64.test(auth?.request?.approvalManifestSha256??''),
  'DIRECT_B_CANDIDATE_SOURCE_UNVERIFIED');
 return Object.freeze({repository:'ansqhd5774-Choi/zgmini',
  sourceSha:auth.manifest.sourceSha});
}

export function appendCandidatePin(auth,{outputFile,append=fs.appendFileSync}={}){
 const pin=approvedCandidateSource(auth);
 need(typeof outputFile==='string'&&path.isAbsolute(outputFile),
  'DIRECT_B_ACTIONS_OUTPUT_STOP');
 append(outputFile,`candidateSourceSha=${pin.sourceSha}\n`,{encoding:'utf8'});
 return pin;
}

async function main(){
 need(process.platform==='win32'&&process.argv.length===2,
  'DIRECT_B_WINDOWS_REQUIRED');
 const env=process.env;
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const controlRoot=path.join(env.GITHUB_WORKSPACE??'','generic-b-control');
 const auth=loadApprovedRaw({event,env,controlRoot});
 return appendCandidatePin(auth,{outputFile:env.GITHUB_OUTPUT});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();console.log('DIRECT_B_CANDIDATE_PIN_VERIFIED');}
 catch(error){
  const code=/^DIRECT_B_[A-Z0-9_]{1,100}$/.test(error?.code??'')?
   error.code:'DIRECT_B_PREFLIGHT_UNAVAILABLE';
  try{
   const root=process.env.RUNNER_TEMP;
   need(typeof root==='string'&&path.isAbsolute(root),'DIRECT_B_TEMP_STOP');
   fs.writeFileSync(path.join(root,DIRECT_B_RESULT),JSON.stringify({
    status:'DIRECT_B_PREFLIGHT_STOP',code,requestId:null})+'\n',{flag:'wx'});
  }catch{/* Preserve failure without replay; reporter may show UNKNOWN. */}
  console.error(code);process.exitCode=2;
 }
}
