import assert from 'node:assert/strict';
import test from 'node:test';
import {D30_INSTALL_CONTRACT} from '../calendar-source-d30/contract.mjs';
import {D30_WINDOWS_SOURCE_ROOT,runD30WindowsReadOnlyPreview}
  from '../calendar-source-d30/windows-preview.mjs';

const PATHS=D30_INSTALL_CONTRACT.operationalFiles.map(f=>f.path);
const ROOT=D30_WINDOWS_SOURCE_ROOT;
const bytes=Buffer.from('test bytes; not actual source\n');
const base=D30_INSTALL_CONTRACT.historicPublicSourceSha;
const candidate=D30_INSTALL_CONTRACT.sourceHead;

function fixture(){
  const calls=[];
  const host={
    calls,
    async inspectTrustedControl(){calls.push('control');return {
      repository:'ansqhd5774-Choi/zgmini-pc-control',head:'a'.repeat(40),
      authenticated:true,readOnlyAuthorized:true};},
    async inspectCandidateCheckout(){calls.push('checkout');return {
      repository:D30_INSTALL_CONTRACT.sourceRepository,
      head:candidate,objectsAvailable:true};},
    async readGitBlob(sha,rel){calls.push(['git',sha,rel]);return bytes;},
    async readWindowsFile(abs){calls.push(['pc',abs]);return bytes;},
    async inspectSourceProvenance(){calls.push('provenance');return null;},
  };
  return host;
}

test('only approved existing host methods can start the Windows preview',async()=>{
  const r=await runD30WindowsReadOnlyPreview({host:{}});
  assert.equal(r.status,'READ_ONLY_PREVIEW_BLOCKED');
  assert.equal(r.code,'ER1_D30_PREVIEW_HOST_INCOMPLETE');
  assert.equal(r.sourceWrites,0);
});

test('untrusted control checkout blocks before Git or PC file reads',async()=>{
  const h=fixture();h.inspectTrustedControl=async()=>({authenticated:false});
  const r=await runD30WindowsReadOnlyPreview({host:h});
  assert.equal(r.code,'ER1_D30_PREVIEW_CONTROL_SOURCE_UNVERIFIED');
  assert.deepEqual(h.calls,[]);
});

test('candidate must be checked out at the exact #1000 target SHA',async()=>{
  const h=fixture();h.inspectCandidateCheckout=async()=>({repository:
    D30_INSTALL_CONTRACT.sourceRepository,head:'b'.repeat(40),objectsAvailable:true});
  const r=await runD30WindowsReadOnlyPreview({host:h});
  assert.equal(r.code,'ER1_D30_PREVIEW_CANDIDATE_CHECKOUT_STOP');
  assert.deepEqual(h.calls,['control']);
});

test('reads only three fixed Windows paths and two pinned Git commits',async()=>{
  const h=fixture();
  const r=await runD30WindowsReadOnlyPreview({host:h});
  assert.equal(r.code,'ER1_D30_STAGE_PUBLIC_SOURCE_PIN_STOP');
  const git=h.calls.filter(x=>Array.isArray(x)&&x[0]==='git');
  const pc=h.calls.filter(x=>Array.isArray(x)&&x[0]==='pc');
  assert.deepEqual(git,PATHS.flatMap(p=>[['git',base,p],['git',candidate,p]]));
  assert.deepEqual(pc,PATHS.map(p=>['pc',ROOT+'\\'+p.replaceAll('/','\\')]));
  assert.equal(h.calls.includes('provenance'),false);
  assert.equal(r.sourceWrites,0);
});

test('unexpected host errors are sanitized and never expose raw source or secrets',async()=>{
  const h=fixture();h.readGitBlob=async()=>{throw new Error('TOKEN=secret data');};
  const r=await runD30WindowsReadOnlyPreview({host:h});
  assert.equal(r.code,'ER1_D30_PREVIEW_READ_STOP');
  assert.ok(JSON.stringify(r).length<32_768);
  assert.ok(!JSON.stringify(r).includes('secret'));
  assert.deepEqual({sourceWrites:r.sourceWrites,dbWrites:r.dbWrites,
    taskChanges:r.taskChanges},{sourceWrites:0,dbWrites:0,taskChanges:0});
});
