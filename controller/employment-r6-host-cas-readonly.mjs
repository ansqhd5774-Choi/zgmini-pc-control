// A-grade, read-only host CAS proof for the already approved employment R6 B registration.
// Never mutate host.json or the candidate database; never report host contents.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const R6_SOURCE_SHA='afdd8fab1c03b321e4b8b0853bb236c0800a0a14';
export const R6_MANIFEST_SHA256='42afb8fe4f0ecdeb551256ec897bb99b1e850420dd0f5bc7b74ec03db2f46c81';
export const R6_CANDIDATE_PATH='E:/ZGmini/data/employment-r6-candidate-isolated-20261103/EMPLOYMENT_R6_CANDIDATE.sqlite';
const HOST_PATH=fileURLToPath(new URL('../host.json',import.meta.url));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const SHA40=/^[a-f0-9]{40}$/;
const fail=code=>({status:'BLOCKED',code,hostChanged:false,providerCalls:0,
  d1Writes:0,sqliteOpened:false,operationalWrites:0});

/** The optional path and join dependency are for isolated, non-Windows fixture tests. */
export function inspectEmploymentR6HostCas({host:liveHost,hostPath=HOST_PATH,join=path.join}={}){
 let raw,host;
 try{raw=fs.readFileSync(hostPath);host=JSON.parse(raw.toString('utf8'));}
 catch{return fail('R6_HOST_BYTES_UNAVAILABLE_OR_INVALID');}
 if(!host||typeof host!=='object'||Array.isArray(host)||
   !host.approvedSources||typeof host.approvedSources!=='object'||
   Array.isArray(host.approvedSources)||!SHA40.test(host.controllerSourceSha??'')){
  return fail('R6_HOST_CONTRACT_INVALID');
 }
 if(!liveHost||JSON.stringify(liveHost)!==JSON.stringify(host)){
  return fail('R6_HOST_CONTEXT_CHANGED');
 }
 const hostOriginalSha256=sha256(raw);
 const already=host.approvedSources[R6_SOURCE_SHA];
 if(already!==undefined){
  const expected={root:join(path.dirname(hostPath),'source-bundles','r6-bundle-'+R6_SOURCE_SHA),
   branch:'codex/employment-1y-reader-r1',
   entrypoint:'scripts/pc-writer/employment-r6-runner-stage.mjs',
   manifestSha256:R6_MANIFEST_SHA256};
  const valid=Object.entries(expected).every(([key,value])=>already?.[key]===value)
    &&host.employmentR6CandidatePath===R6_CANDIDATE_PATH;
  return valid?{status:'PASS',code:'R6_HOST_ALREADY_REGISTERED',
   installedControllerSha:host.controllerSourceSha,hostOriginalSha256,
   registrationExists:true,providerCalls:0,d1Writes:0,sqliteOpened:false,
   operationalWrites:0}:fail('R6_HOST_REGISTRATION_CONFLICT');
 }
 if(host.employmentR6CandidatePath!==undefined&&
    host.employmentR6CandidatePath!==R6_CANDIDATE_PATH){
  return fail('R6_HOST_CANDIDATE_PATH_CONFLICT');
 }
 const proposal=structuredClone(host);
 proposal.approvedSources[R6_SOURCE_SHA]={
  root:join(path.dirname(hostPath),'source-bundles','r6-bundle-'+R6_SOURCE_SHA),
  branch:'codex/employment-1y-reader-r1',
  entrypoint:'scripts/pc-writer/employment-r6-runner-stage.mjs',
  manifestSha256:R6_MANIFEST_SHA256};
 proposal.employmentR6CandidatePath=R6_CANDIDATE_PATH;
 return {status:'PASS',code:'R6_HOST_CAS_READONLY_READY',
  installedControllerSha:host.controllerSourceSha,
  hostOriginalSha256,proposedSha256:sha256(Buffer.from(JSON.stringify(proposal,null,2)+'\n')),
  registrationExists:false,sourceSha:R6_SOURCE_SHA,
  sourceManifestSha256:R6_MANIFEST_SHA256,
  providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0};
}
