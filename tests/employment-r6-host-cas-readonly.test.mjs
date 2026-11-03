import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectEmploymentR6HostCas,R6_SOURCE_SHA,R6_MANIFEST_SHA256,R6_CANDIDATE_PATH}
 from '../controller/employment-r6-host-cas-readonly.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const source='9'.repeat(40);
test('unchanged byte host CAS equals exact pretty-printed host proposal; no writes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zg-r6-cas-'));
 try{
  const hostPath=path.join(root,'host.json');
  const original={controllerSourceSha:source,approvedSources:{['0'.repeat(40)]:{branch:'other'}},dataRoot:'E:/ZGmini/data'};
  const bytes=JSON.stringify(original,null,2)+'\n';
  fs.writeFileSync(hostPath,bytes);
  const r=inspectEmploymentR6HostCas({hostPath,host:original});
  assert.equal(r.status,'PASS');assert.equal(r.code,'R6_HOST_CAS_READONLY_READY');
  assert.equal(r.hostOriginalSha256,hash(bytes));
  const proposal=structuredClone(original);
  proposal.approvedSources[R6_SOURCE_SHA]={root:path.join(root,'source-bundles','r6-bundle-'+R6_SOURCE_SHA),branch:'codex/employment-1y-reader-r1',entrypoint:'scripts/pc-writer/employment-r6-runner-stage.mjs',manifestSha256:R6_MANIFEST_SHA256};
  proposal.employmentR6CandidatePath=R6_CANDIDATE_PATH;
  assert.equal(r.proposedSha256,hash(JSON.stringify(proposal,null,2)+'\n'));
  assert.equal(fs.readFileSync(hostPath,'utf8'),bytes);
  assert.equal(r.operationalWrites,0);assert.equal(r.sqliteOpened,false);
  assert.equal(JSON.stringify(r).includes('other'),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('missing host is blocked without creating paths',()=>{
 const p=path.join(os.tmpdir(),'zg-r6-nonexistent-'+process.pid,'host.json');
 const r=inspectEmploymentR6HostCas({hostPath:p});
 assert.equal(r.code,'R6_HOST_BYTES_UNAVAILABLE_OR_INVALID');
 assert.equal(fs.existsSync(p),false);
});
test('invalid controller identity or prior conflicting R6 source is blocked',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zg-r6-cas-conflict-'));
 try{
  const hostPath=path.join(root,'host.json');
  fs.writeFileSync(hostPath,JSON.stringify({controllerSourceSha:'invalid',approvedSources:{}}));
  assert.equal(inspectEmploymentR6HostCas({hostPath}).code,'R6_HOST_CONTRACT_INVALID');
  const existing={controllerSourceSha:source,approvedSources:{[R6_SOURCE_SHA]:{root:'other'}}};
  fs.writeFileSync(hostPath,JSON.stringify(existing));
  assert.equal(inspectEmploymentR6HostCas({hostPath,host:existing}).code,'R6_HOST_REGISTRATION_CONFLICT');
  const conflict={controllerSourceSha:source,approvedSources:{},employmentR6CandidatePath:'other'};
  fs.writeFileSync(hostPath,JSON.stringify(conflict));
  assert.equal(inspectEmploymentR6HostCas({hostPath,host:conflict}).code,'R6_HOST_CANDIDATE_PATH_CONFLICT');
  assert.equal(inspectEmploymentR6HostCas({hostPath,host:existing}).code,'R6_HOST_CONTEXT_CHANGED');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
