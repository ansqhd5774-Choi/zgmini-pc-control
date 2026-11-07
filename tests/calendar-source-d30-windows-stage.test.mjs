import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {D30_INSTALL_CONTRACT} from '../calendar-source-d30/contract.mjs';
import {mergeTextThreeWay,previewD30ThreeFiles,
  stageApprovedD30ThreeFiles,verifyApprovedD30AfterBytes}
  from '../calendar-source-d30/windows-stage.mjs';

const buf=text=>Buffer.from(text,'utf8');
const src=()=>({
  base:buf('opening\nours-old\nseparator\ntheirs-old\nclosing\n'),
  ours:buf('opening\nours-new\nseparator\ntheirs-old\nclosing\n'),
  theirs:buf('opening\nours-old\nseparator\ntheirs-new\nclosing\n'),
});
const isolated=fn=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d30-stage-test-'));
  try{return fn(dir);}finally{assert.deepEqual(fs.readdirSync(dir),[]);fs.rmdirSync(dir);}
};

test('clean 3-way merge preserves independent PC and PR changes without source writes',()=>{
  isolated(tempRoot=>{
    const r=mergeTextThreeWay({...src(),tempRoot});
    assert.equal(r.bytes.toString('utf8'),
      'opening\nours-new\nseparator\ntheirs-new\nclosing\n');
    assert.equal(r.preservedVerified,true);
    assert.equal(r.conflictCount,0);
    assert.equal(r.sourceWrites,0);
  });
});

test('conflicting PC and PR edit stops with no operational write and temp cleanup',()=>{
  isolated(tempRoot=>{
    const s=src();
    s.theirs=buf('opening\nother-change\nseparator\ntheirs-old\nclosing\n');
    assert.throws(()=>mergeTextThreeWay({...s,tempRoot}),
      {code:'ER1_D30_STAGE_MERGE_CONFLICT_STOP'});
  });
});

test('mixed line endings stop before merge staging',()=>{
  isolated(tempRoot=>{
    const s=src();
    s.ours=buf('opening\r\nours-new\nseparator\ntheirs-old\nclosing\n');
    assert.throws(()=>mergeTextThreeWay({...s,tempRoot}),
      {code:'ER1_D30_STAGE_MIXED_EOL_STOP'});
  });
});

test('unrecognized source key is rejected outside exact three-file scope',()=>{
  const paths=D30_INSTALL_CONTRACT.operationalFiles.map(f=>f.path);
  const data=Object.fromEntries(paths.map(p=>[p,buf('fixture\n')]));
  const withExtra={...data,'lib/unapproved.mjs':buf('fixture\n')};
  assert.throws(()=>previewD30ThreeFiles({publicBases:data,
    windowsPreimages:data,candidateTargets:withExtra}),
  {code:'ER1_D30_STAGE_THREE_PATH_SCOPE_STOP'});
});

test('PR candidate or public base bytes must match exact pinned SHA256/Git blob',()=>{
  const paths=D30_INSTALL_CONTRACT.operationalFiles.map(f=>f.path);
  const data=Object.fromEntries(paths.map(p=>[p,buf('fixture\n')]));
  assert.throws(()=>previewD30ThreeFiles({publicBases:data,
    windowsPreimages:data,candidateTargets:data}),
  {code:'ER1_D30_STAGE_PUBLIC_SOURCE_PIN_STOP'});
});

test('approved staging helper cannot accept fabricated source fixture',()=>{
  const paths=D30_INSTALL_CONTRACT.operationalFiles.map(f=>f.path);
  const data=Object.fromEntries(paths.map(p=>[p,buf('fixture\n')]));
  assert.throws(()=>stageApprovedD30ThreeFiles({publicBases:data,
    windowsPreimages:data,candidateTargets:data,approvedBManifest:{}}),
  {code:'ER1_D30_STAGE_PUBLIC_SOURCE_PIN_STOP'});
});

test('staging exact after SHA is independently compared with approved manifest',()=>{
  const files=Object.fromEntries(D30_INSTALL_CONTRACT.operationalFiles.map(f=>
    [f.path,{afterSha256:f.targetSha256,preservedVerified:true}]));
  const preview={status:'READ_ONLY_PREVIEW_COMPLETE',files};
  const approved={files:D30_INSTALL_CONTRACT.operationalFiles.map(f=>
    ({path:f.path,afterSha256:f.targetSha256}))};
  assert.equal(verifyApprovedD30AfterBytes(preview,approved),true);
  approved.files[1].afterSha256='a'.repeat(64);
  assert.throws(()=>verifyApprovedD30AfterBytes(preview,approved),
    {code:'ER1_D30_STAGE_APPROVED_BYTES_DRIFT'});
});
