import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {R6_SOURCE_FILES,R6_EXACT_SOURCE_SHA,simulateR6HostRegistrationFixture}
  from '../tools/stage-r6-host-registration.mjs';
import {applyPreparedR6HostB,simulateR6HostApplyBFixture}
  from '../tools/apply-r6-host-overlay-b.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const SOURCE=R6_EXACT_SOURCE_SHA;
const ORIGIN={verified:true,sameUserAndSession:true,maintainerIndependent:true};

function build(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'r6-host-b-apply-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const core=path.join(root,'data','pc-writer','storage','core.sqlite');
  const candidate=path.join(root,'candidate','EMPLOYMENT_R6_CANDIDATE.sqlite');
  const hostPath=path.join(root,'host.json');
  const stageRoot=path.join(root,'staging');
  fs.mkdirSync(path.dirname(core),{recursive:true});
  fs.mkdirSync(path.dirname(candidate),{recursive:true});
  fs.mkdirSync(stageRoot);
  fs.writeFileSync(core,Buffer.from('CORE_CONSTANT'));
  fs.writeFileSync(candidate,Buffer.from('ISOLATED_CANDIDATE_CONSTANT'));
  const host={schema:'ZGMINI_PC_HOST_V1',controllerSourceSha:'c'.repeat(40),
    dataRoot:path.join(root,'data'),existingPolicy:{maxConcurrent:1,neverExpand:true},
    approvedSources:{['b'.repeat(40)]:{root:path.join(root,'sealed-older'),branch:'previous',
      manifestSha256:'e'.repeat(64)}}};
  const beforeBytes=Buffer.from(JSON.stringify(host,null,2)+'\n');
  fs.writeFileSync(hostPath,beforeBytes);
  const files=Object.fromEntries(R6_SOURCE_FILES.map((p,i)=>
    [p,Buffer.from(`SEALED_SYNTHETIC_${i}_R6_ONLY`)]));
  const hashes=Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)]));
  const manifestBytes=Buffer.from(JSON.stringify({schema:'ZGMINI_R6_SOURCE_BUNDLE_DRAFT_V1',
    sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha:SOURCE,
    sourceBranch:'codex/employment-1y-reader-r1',
    entrypoint:'scripts/pc-writer/employment-r6-runner-stage.mjs',files:hashes},null,2)+'\n');
  const staged=simulateR6HostRegistrationFixture({installedHost:host,sourceFiles:files,
    manifestBytes,sourceSha:SOURCE,candidatePath:candidate,stageRoot});
  const proposedHost=staged.proposedHost;
  const afterBytes=Buffer.from(JSON.stringify(proposedHost,null,2)+'\n');
  const backupDirectory=path.join(root,'backup-r6-only');
  const approval={schema:'ZGMINI_R6_HOST_B_APPLY_V1',scope:'PC_CONTROL_HOST_R6_ONLY',
    hostPath,candidatePath:candidate,stageBundle:staged.stageBundle,backupDirectory,
    sourceSha:SOURCE,sourceManifestSha256:sha(manifestBytes),
    installedControllerSha:host.controllerSourceSha,
    hostSha256:sha(beforeBytes),proposedHostSha256:sha(afterBytes)};
  const fixed={...approval,core,hostPath,candidate,backupDirectory,proposedHost,beforeBytes,afterBytes};
  let n=0;
  fixed.probe=()=>{n++;
    return {workflowState:'disabled_manually',installLeaseHeldByThisOperator:true,
      inFlightPcJobs:0,uploadsPending:0,controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
      observedAt:new Date().toISOString(),runners:Array.from({length:6},(_,i)=>({
        name:`zgmini-pc-0${i+1}`,online:true,busy:false}))};};
  fixed.probeCount=()=>n;
  fixed.run=(runtimeProbe=fixed.probe,windowsProvenance=ORIGIN)=>
    simulateR6HostApplyBFixture({approval,proposedHost,runtimeProbe,windowsProvenance},
      approval.sourceManifestSha256);
  return fixed;
}

test('B host overlay installs 16 sealed files; existing fields, candidate and Core unchanged',t=>{
  const f=build(t);
  const dbBefore=[sha(fs.readFileSync(f.core)),sha(fs.readFileSync(f.candidate))];
  const out=f.run();
  assert.equal(out.status,'APPLIED');
  assert.equal(f.probeCount(),3);
  assert.equal(sha(fs.readFileSync(f.hostPath)),f.proposedHostSha256);
  assert.equal(fs.readFileSync(f.hostPath,'utf8'),f.afterBytes.toString('utf8'));
  assert.equal(sha(fs.readFileSync(path.join(f.backupDirectory,'HOST_BEFORE.bytes'))),
    f.hostSha256);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.backupDirectory,'APPLIED.json'))).status,
    'APPLIED');
  assert.deepEqual([sha(fs.readFileSync(f.core)),sha(fs.readFileSync(f.candidate))],dbBefore);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.hostPath)).existingPolicy,
    {maxConcurrent:1,neverExpand:true});
  assert.throws(()=>f.run(),/R6_B_APPROVAL_OR_HOST_CAS_MISMATCH/);
});

test('independent Windows/lease/runner gates fail before any host or backup write',t=>{
  const f=build(t);
  const badProbe=()=>({...f.probe(),runners:[{name:'zgmini-pc-01',online:true,busy:false}]});
  assert.throws(()=>f.run(badProbe),/R6_B_IDLE_LEASE_NOT_VERIFIED/);
  assert.throws(()=>f.run(f.probe,{verified:false}),/R6_B_WINDOWS_ORIGIN_NOT_VERIFIED/);
  assert.deepEqual(fs.readFileSync(f.hostPath),f.beforeBytes);
  assert.equal(fs.existsSync(f.backupDirectory),false);
  if(process.platform!=='win32'){
    assert.throws(()=>applyPreparedR6HostB({approval:f,proposedHost:f.proposedHost,
      runtimeProbe:f.probe,windowsProvenance:ORIGIN}),/R6_B_WINDOWS_REQUIRED/);
  }
});

test('pre-swap host CAS change blocks overlay and keeps earlier snapshot',t=>{
  const f=build(t);
  let calls=0;
  const mutateBetweenProbes=()=>{
    calls++;
    if(calls===2)fs.appendFileSync(f.hostPath,' ');
    return f.probe();
  };
  assert.throws(()=>f.run(mutateBetweenProbes),/R6_B_PRE_APPLY_CAS_CHANGED/);
  assert.equal(fs.existsSync(path.join(f.backupDirectory,'HOST_BEFORE.bytes')),true);
  assert.equal(sha(fs.readFileSync(path.join(f.backupDirectory,'HOST_BEFORE.bytes'))),
    f.hostSha256);
  assert.notEqual(sha(fs.readFileSync(f.hostPath)),f.proposedHostSha256);
  assert.equal(fs.existsSync(path.join(f.backupDirectory,'APPLIED.json')),false);
});

test('post-swap gate failure performs byte-exact rollback from isolated backup',t=>{
  const f=build(t);
  let calls=0;
  const failThird=()=>{
    calls++;
    if(calls===3)return {...f.probe(),inFlightPcJobs:1};
    return f.probe();
  };
  const outcome=f.run(failThird);
  assert.equal(outcome.status,'ROLLED_BACK');
  assert.equal(outcome.code,'R6_B_IDLE_LEASE_NOT_VERIFIED');
  assert.deepEqual(fs.readFileSync(f.hostPath),f.beforeBytes);
  assert.equal(sha(fs.readFileSync(path.join(f.backupDirectory,'HOST_BEFORE.bytes'))),
    f.hostSha256);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.backupDirectory,'ROLLED_BACK.json'))).status,
    'ROLLED_BACK');
  assert.equal(fs.readFileSync(f.core,'utf8'),'CORE_CONSTANT');
  assert.equal(fs.readFileSync(f.candidate,'utf8'),'ISOLATED_CANDIDATE_CONSTANT');
});

test('attempt to alter any existing host field is rejected without disk mutation',t=>{
  const f=build(t);
  f.proposedHost.existingPolicy.maxConcurrent=2;
  assert.throws(()=>f.run(),/R6_B_HOST_SCOPE_EXPANDED/);
  assert.deepEqual(fs.readFileSync(f.hostPath),f.beforeBytes);
  assert.equal(fs.existsSync(f.backupDirectory),false);
});

test('candidate Core alias fails before creating backup',t=>{
  const f=build(t);
  fs.unlinkSync(f.candidate);fs.linkSync(f.core,f.candidate);
  assert.throws(()=>f.run(),/R6_B_CANDIDATE_CORE_ALIAS/);
  assert.deepEqual(fs.readFileSync(f.hostPath),f.beforeBytes);
  assert.equal(fs.existsSync(f.backupDirectory),false);
});
