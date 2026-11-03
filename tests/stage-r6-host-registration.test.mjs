import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {R6_SOURCE_FILES,R6_EXACT_SOURCE_SHA,
  draftR6HostRegistration,simulateR6HostRegistrationFixture} from '../tools/stage-r6-host-registration.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const HEAD=R6_EXACT_SOURCE_SHA;

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-host-registration-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const core=path.join(root,'data','pc-writer','storage','core.sqlite');
 const candidate=path.join(root,'approved-isolated-candidate','EMPLOYMENT_R6_CANDIDATE.sqlite');
 const stageRoot=path.join(root,'new-staging-only');
 fs.mkdirSync(path.dirname(core),{recursive:true});
 fs.mkdirSync(path.dirname(candidate),{recursive:true});fs.mkdirSync(stageRoot);
 fs.writeFileSync(core,'CORE_UNTOUCHED');fs.writeFileSync(candidate,'CANDIDATE_UNTOUCHED');
 const previous={schema:'ZGMINI_PC_HOST_V1',controllerSourceSha:'b'.repeat(40),
  dataRoot:path.join(root,'data'),controllerFiles:{'controller/engine.mjs':'e'.repeat(64)},
  approvedSources:{['a'.repeat(40)]:{root:'/existing/theme/bundle',
    branch:'codex/theme-fear-greed-integration-20261025',
    tests:['tests/theme-platform.test.mjs'],manifestSha256:'f'.repeat(64)}}};
 const files=Object.fromEntries(R6_SOURCE_FILES.map((p,i)=>[p,Buffer.from('SYNTHETIC_FILE_'+i)]));
 const hashes=Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)]));
 const manifestBytes=Buffer.from(JSON.stringify({schema:'ZGMINI_R6_SOURCE_BUNDLE_DRAFT_V1',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha:HEAD,
  sourceBranch:'codex/employment-1y-reader-r1',
  entrypoint:'scripts/pc-writer/employment-r6-runner-stage.mjs',files:hashes},null,2)+'\n');
 return {root,previous,files,hashes,manifestBytes,core,candidate,stageRoot};
}
const request=f=>({installedHost:f.previous,sourceFiles:f.files,
 manifestBytes:f.manifestBytes,sourceSha:HEAD,candidatePath:f.candidate,
 stageRoot:f.stageRoot});

test('16 sealed bytes stage only new R6 source; old host, bundle and DB preserved',t=>{
 const f=fixture(t),beforeHost=JSON.stringify(f.previous);
 const output=simulateR6HostRegistrationFixture(request(f));
 assert.equal(output.fileCount,16);
 assert.equal(output.existingApprovalsPreserved,true);
 assert.equal(JSON.stringify(f.previous),beforeHost);
 assert.equal(JSON.stringify(output.proposedHost.approvedSources['a'.repeat(40)]),
  JSON.stringify(f.previous.approvedSources['a'.repeat(40)]));
 assert.equal(JSON.stringify(output.proposedHost.controllerFiles),
  JSON.stringify(f.previous.controllerFiles));
 assert.equal(output.proposedHost.controllerSourceSha,f.previous.controllerSourceSha);
 assert.equal(output.proposedHost.employmentR6CandidatePath,f.candidate);
 const manifestBytes=fs.readFileSync(path.join(output.stageBundle,'manifest.json'));
 assert.equal(sha(manifestBytes),output.manifestSha256);
 for(const p of R6_SOURCE_FILES){
  assert.equal(sha(fs.readFileSync(path.join(output.stageBundle,'source',p))),f.hashes[p]);
 }
 assert.equal(fs.readFileSync(f.core,'utf8'),'CORE_UNTOUCHED');
 assert.equal(fs.readFileSync(f.candidate,'utf8'),'CANDIDATE_UNTOUCHED');
 assert.throws(()=>simulateR6HostRegistrationFixture(request(f)),/R6_STAGE_ALREADY_EXISTS/);
});

test('changed source bytes fail closed without staging',t=>{
 const f=fixture(t);
 f.files[R6_SOURCE_FILES[0]]=Buffer.from('MUTATED_SOURCE_BYTES');
 assert.throws(()=>simulateR6HostRegistrationFixture(request(f)),/R6_SOURCE_BYTES_DRIFT/);
 assert.deepEqual(fs.readdirSync(f.stageRoot),[]);
});

test('candidate hardlink to Core is rejected before staging',t=>{
 const f=fixture(t);
 fs.unlinkSync(f.candidate);fs.linkSync(f.core,f.candidate);
 assert.throws(()=>simulateR6HostRegistrationFixture(request(f)),/R6_CANDIDATE_CORE_ALIAS/);
 assert.deepEqual(fs.readdirSync(f.stageRoot),[]);
});

test('existing theme source SHA cannot be silently replaced',t=>{
 const f=fixture(t);
 f.previous.approvedSources[HEAD]={root:'/existing/r6/bundle',branch:'codex/employment-1y-reader-r1'};
 assert.throws(()=>simulateR6HostRegistrationFixture(request(f)),
  /R6_BUNDLE_ALREADY_REGISTERED/);
 assert.deepEqual(fs.readdirSync(f.stageRoot),[]);
});

test('isolated host snapshot restores exact original bytes after a simulated switch failure',t=>{
 const f=fixture(t),current=path.join(f.root,'host-fixture.json');
 const snapshot=path.join(f.stageRoot,'BACKUP_host.json');
 const next=path.join(f.stageRoot,'NEW_host.json');
 const original=Buffer.from(JSON.stringify(f.previous,null,2)+'\n');
 fs.writeFileSync(current,original,{flag:'wx'});
 const staged=simulateR6HostRegistrationFixture(request(f));
 fs.copyFileSync(current,snapshot,fs.constants.COPYFILE_EXCL);
 assert.equal(sha(fs.readFileSync(snapshot)),sha(original));
 fs.writeFileSync(next,JSON.stringify(staged.proposedHost,null,2)+'\n',{flag:'wx'});
 // Deliberate failure simulation: restore only the verified snapshot.
 fs.renameSync(next,current);
 assert.notEqual(sha(fs.readFileSync(current)),sha(original));
 assert.equal(sha(fs.readFileSync(snapshot)),sha(original));
 fs.copyFileSync(snapshot,current);
 assert.equal(sha(fs.readFileSync(current)),sha(original));
 assert.equal(fs.readFileSync(f.core,'utf8'),'CORE_UNTOUCHED');
 assert.equal(fs.readFileSync(f.candidate,'utf8'),'CANDIDATE_UNTOUCHED');
});

test('production entrypoint blocks all synthetic manifests that differ from canonical raw bytes',t=>{
 const f=fixture(t);
 assert.throws(()=>draftR6HostRegistration(request(f)),/R6_CANONICAL_MANIFEST_DRIFT/);
 assert.deepEqual(fs.readdirSync(f.stageRoot),[]);
});

test('Core override, source SHA override and existing candidate-path overwrite are rejected',t=>{
 const f=fixture(t);
 assert.throws(()=>simulateR6HostRegistrationFixture({...request(f),corePath:f.candidate}),
  /R6_CORE_OVERRIDE_FORBIDDEN/);
 assert.throws(()=>simulateR6HostRegistrationFixture({...request(f),sourceSha:'b'.repeat(40)}),
  /R6_SOURCE_SHA_NOT_APPROVED/);
 f.previous.employmentR6CandidatePath=path.join(f.root,'another','EMPLOYMENT_R6_CANDIDATE.sqlite');
 assert.throws(()=>simulateR6HostRegistrationFixture(request(f)),
  /R6_HOST_CANDIDATE_OVERWRITE_FORBIDDEN/);
 assert.deepEqual(fs.readdirSync(f.stageRoot),[]);
});

test('staging alias/junction is rejected before any new source write',t=>{
 const f=fixture(t),alias=path.join(f.root,'stage-alias');
 fs.symlinkSync(f.stageRoot,alias,process.platform==='win32'?'junction':'dir');
 assert.throws(()=>simulateR6HostRegistrationFixture({...request(f),stageRoot:alias}),
  /R6_STAGE_PARENT_ALIAS_OR_MISSING/);
 assert.deepEqual(fs.readdirSync(f.stageRoot),[]);
});
