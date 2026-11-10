import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {plan996WindowsArchive,simulate996WindowsArchiveAdapter} from
  '../tools/controller-996-windows-archive-adapter.mjs';

const UUID='70a4c347-25ea-4fc6-83d2-c0c670115249';
const ORIGINAL='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const READY='READY_TO_RELEASE_INSTALL.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const FILES={
  oldC:{'owner.json':'old C owner','PREPARED.json':'old C prepared'},
  install:{'owner.json':'old install owner',
    'RECOVERY_REQUIRED.json':'old install recovery'},
  continuation:{'owner.json':JSON.stringify({requestId:UUID,
    nonce:'fixture-nonce'}),
    'PREPARED.json':'new C prepared',
    [READY]:JSON.stringify({schema:'ZGMINI_996_CONTINUATION_READY_V1',
      name:'READY_TO_RELEASE_INSTALL',requestId:UUID,
      originalRequestId:ORIGINAL,finalReleasePending:true,
      oldCArchiveOwnerSha256:sha(Buffer.from('old C owner')),
      installOwnerSha256:sha(Buffer.from('old install owner')),
      installRecoverySha256:sha(Buffer.from('old install recovery')),
      ownerNonce:'fixture-nonce',
      sourceLockSha256:'a'.repeat(64)})},
};
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
  const dir=rel=>path.join(root,...rel.split('/'));
  const expected={};
  for(const [key,files] of Object.entries(FILES)){
    const folder=dir('leases/'+key);
    fs.mkdirSync(folder,{recursive:true});
    expected[key]={};
    for(const [name,content] of Object.entries(files)){
      const b=Buffer.from(content);
      fs.writeFileSync(path.join(folder,name),b);
      expected[key][name]=sha(b);
    }
  }
  fs.mkdirSync(dir('archives'));
  const plan=plan996WindowsArchive(UUID);
  let calls=0;
  let beforeMove=null;
  const port={moveNoReplace:(rootArg,srcRel,dstRel)=>{
    assert.equal(rootArg,root);
    if(beforeMove)beforeMove(srcRel,dstRel);
    // Strict fake .NET Directory.Move port for Linux fixtures. On Windows the
    // real API, not a check followed by rename, must ensure no replacement.
    if(fs.existsSync(dir(dstRel))){
      const e=Error('destination exists');e.code='EEXIST';throw e;
    }
    fs.renameSync(dir(srcRel),dir(dstRel));
  }};
  const readLive=()=>{calls++;
    return {workflowState:'active',protectionVerified:true,
      controllerConflictCount:0,writerConflictCount:0};};
  const run=options=>simulate996WindowsArchiveAdapter({testOnly:true,root,
    plan,expected,port,readLive,...options});
  return {root,dir,expected,plan,port,run,readLive,
    beforeMove:cb=>{beforeMove=cb;},calls:()=>calls,
    cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('production usage cannot mutate or invoke a Windows move',()=>{
  const r=simulate996WindowsArchiveAdapter();
  assert.equal(r.code,'C_996_WINDOWS_ARCHIVE_PRODUCTION_DISABLED');
  assert.equal(r.executionAuthorized,false);
});
test('pure Windows plan has fixed same-volume no-replace paths',()=>{
  const p=plan996WindowsArchive(UUID);
  assert.deepEqual(p.steps.map(s=>s.name),['oldC','continuation','install']);
  assert.equal(p.steps.every(s=>s.source.startsWith('E:\\ZGmini\\')&&
    s.destination.startsWith('E:\\ZGmini\\')&&
    s.intendedNativeOperation==='DOTNET_DIRECTORY_MOVE_NO_REPLACE'),true);
  assert.equal(p.productionExecutable,false);
  assert.throws(()=>plan996WindowsArchive('../outside'));
});
test('three fixed archive steps run in order with zero operational effects',()=>{
  const f=fixture();
  try{
    const r=f.run();
    assert.equal(r.status,'C_996_WINDOWS_ARCHIVE_TEST_ONLY_PASS');
    assert.equal(r.steps,3);
    assert.equal(r.installArchivedLast,true);
    assert.equal(r.continuationBeforeInstall,true);
    for(const step of f.plan.steps){
      assert.equal(fs.existsSync(f.dir('leases/'+step.name)),false);
      assert.equal(fs.existsSync(f.dir('archives/'+step.name)),true);
    }
    assert.equal(r.executionAuthorized,false);
    assert.equal(r.workflowPuts,0);
    assert.equal(r.issuePosts,0);
  }finally{f.cleanup();}
});
test('pre-existing empty archive prevents every move',()=>{
  const f=fixture();
  try{
    fs.mkdirSync(f.dir('archives/install'));
    assert.equal(f.run().code,'C_996_WINDOWS_ARCHIVE_DESTINATION_EXISTS');
    for(const step of f.plan.steps)
      assert.equal(fs.existsSync(f.dir('leases/'+step.name)),true);
  }finally{f.cleanup();}
});
test('destination created immediately before move cannot be replaced by port',()=>{
  const f=fixture();
  try{
    f.beforeMove((src,dst)=>{
      if(src==='leases/oldC'){
        fs.mkdirSync(f.dir(dst));
        fs.writeFileSync(f.dir(dst+'/sentinel.txt'),'preserve');
      }
    });
    assert.equal(f.run().code,'C_996_WINDOWS_ARCHIVE_STATE_UNKNOWN');
    assert.equal(fs.readFileSync(f.dir('archives/oldC/sentinel.txt'),'utf8'),
      'preserve');
    assert.equal(fs.existsSync(f.dir('leases/oldC')),true);
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
  }finally{f.cleanup();}
});
test('interruption after old C archival retains install barrier',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'AFTER_OLD_C'});
    assert.equal(r.code,'C_996_WINDOWS_ARCHIVE_INJECTED_INTERRUPTION');
    assert.equal(fs.existsSync(f.dir('archives/oldC')),true);
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
    assert.equal(fs.existsSync(f.dir('leases/continuation')),true);
    assert.equal(f.run().code,'C_996_WINDOWS_ARCHIVE_STATE_UNKNOWN');
  }finally{f.cleanup();}
});
test('interruption after continuation archive preserves canonical install lock',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'AFTER_CONTINUATION'});
    assert.equal(r.code,'C_996_WINDOWS_ARCHIVE_INJECTED_INTERRUPTION');
    assert.equal(fs.existsSync(f.dir('archives/oldC')),true);
    assert.equal(fs.existsSync(f.dir('archives/continuation')),true);
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
    assert.equal(fs.existsSync(f.dir('archives/install')),false);
    assert.equal(r.executionAuthorized,false);
    assert.equal(f.run().code,'C_996_WINDOWS_ARCHIVE_STATE_UNKNOWN');
  }finally{f.cleanup();}
});
test('interruption after last install move archives all three, never retries',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'AFTER_INSTALL'});
    assert.equal(r.code,'C_996_WINDOWS_ARCHIVE_INJECTED_INTERRUPTION');
    assert.equal(fs.existsSync(f.dir('archives/oldC')),true);
    assert.equal(fs.existsSync(f.dir('archives/continuation')),true);
    assert.equal(fs.existsSync(f.dir('archives/install')),true);
    assert.equal(fs.existsSync(f.dir('leases/install')),false);
    assert.equal(f.run().code,'C_996_WINDOWS_ARCHIVE_STATE_UNKNOWN');
  }finally{f.cleanup();}
});
test('malformed release intent cannot remove install admission barrier',()=>{
  const f=fixture();
  try{
    const content=Buffer.from(JSON.stringify({schema:
      'ZGMINI_996_CONTINUATION_READY_V1',name:'READY_TO_RELEASE_INSTALL',
      requestId:UUID,originalRequestId:ORIGINAL,finalReleasePending:false,
      oldCArchiveOwnerSha256:FILES.oldC['owner.json'],
      installOwnerSha256:FILES.install['owner.json'],
      sourceLockSha256:'a'.repeat(64)}));
    fs.writeFileSync(f.dir('leases/continuation/'+READY),content);
    f.expected.continuation[READY]=sha(content);
    const r=f.run();
    assert.equal(r.code,'C_996_WINDOWS_ARCHIVE_READY_PROOF_INVALID');
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
    assert.equal(fs.existsSync(f.dir('archives/continuation')),true);
    assert.equal(fs.existsSync(f.dir('archives/install')),false);
  }finally{f.cleanup();}
});
test('ready marker nonce and install recovery provenance mismatches block',()=>{
  for(const field of ['ownerNonce','installRecoverySha256']){
    const f=fixture();
    try{
      const readyPath=f.dir('leases/continuation/'+READY);
      const ready=JSON.parse(fs.readFileSync(readyPath,'utf8'));
      ready[field]=field==='ownerNonce'?'wrong-nonce':'b'.repeat(64);
      const bytes=Buffer.from(JSON.stringify(ready));
      fs.writeFileSync(readyPath,bytes);
      f.expected.continuation[READY]=sha(bytes);
      const r=f.run();
      assert.equal(r.code,'C_996_WINDOWS_ARCHIVE_READY_PROOF_INVALID');
      assert.equal(fs.existsSync(f.dir('leases/install')),true);
    }finally{f.cleanup();}
  }
});
test('a different post-release lease does not overwrite the old archive',()=>{
  const f=fixture();
  try{
    const move=f.port.moveNoReplace;
    f.port.moveNoReplace=(root,from,to)=>{
      move(root,from,to);
      if(from==='leases/install'){
        fs.mkdirSync(f.dir('leases/install'));
        fs.writeFileSync(f.dir('leases/install/owner.json'),'next owner');
      }
    };
    const r=f.run();
    assert.equal(r.status,'C_996_WINDOWS_ARCHIVE_TEST_ONLY_PASS');
    assert.equal(r.postReleaseDifferentLeaseObserved,true);
    assert.equal(r.postReleaseOwnerVerified,false);
    assert.equal(fs.readFileSync(f.dir('archives/install/owner.json'),'utf8'),
      'old install owner');
    assert.equal(fs.readFileSync(f.dir('leases/install/owner.json'),'utf8'),
      'next owner');
  }finally{f.cleanup();}
});
test('late Writer conflict after old C archive blocks install release',()=>{
  const f=fixture();
  try{
    let count=0;
    const readLive=()=>({workflowState:'active',protectionVerified:true,
      controllerConflictCount:0,writerConflictCount:++count===2?1:0});
    const r=f.run({readLive});
    assert.equal(r.code,'C_996_WINDOWS_ARCHIVE_LATE_CONFLICT');
    assert.equal(fs.existsSync(f.dir('archives/oldC')),true);
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
  }finally{f.cleanup();}
});
test('Writer racing at final release keeps the original install lease',()=>{
  const f=fixture();
  try{
    let calls=0;
    const readLive=()=>({workflowState:'active',protectionVerified:true,
      controllerConflictCount:0,writerConflictCount:++calls===3?1:0});
    const r=f.run({readLive});
    assert.equal(r.code,'C_996_WINDOWS_ARCHIVE_LATE_CONFLICT');
    assert.equal(fs.existsSync(f.dir('archives/oldC')),true);
    assert.equal(fs.existsSync(f.dir('archives/continuation')),true);
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
    assert.equal(fs.existsSync(f.dir('archives/install')),false);
  }finally{f.cleanup();}
});
test('symlink in source is rejected during preflight',()=>{
  const f=fixture();
  try{
    const target=f.dir('leases/oldC/owner.json');
    fs.renameSync(target,target+'.orig');
    fs.symlinkSync(target+'.orig',target);
    assert.equal(f.run().code,'C_996_WINDOWS_ARCHIVE_CONTENT_REDIRECT');
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
  }finally{f.cleanup();}
});
test('a symlinked archive parent is rejected before any move',()=>{
  const f=fixture();
  try{
    fs.renameSync(f.dir('archives'),f.dir('other-archives'));
    fs.symlinkSync(f.dir('other-archives'),f.dir('archives'),'dir');
    assert.equal(f.run().code,'C_996_WINDOWS_ARCHIVE_REDIRECT');
    assert.equal(fs.existsSync(f.dir('leases/oldC')),true);
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
    assert.equal(fs.readdirSync(f.dir('other-archives')).length,0);
  }finally{f.cleanup();}
});
test('a symlinked intermediate fixture parent is rejected before any move',()=>{
  const f=fixture();
  try{
    const actual=f.dir('actual');
    const nested=path.join(actual,'zgmini-996-test-nested');
    fs.mkdirSync(nested,{recursive:true});
    fs.symlinkSync(actual,f.dir('redirect'),'dir');
    const fakeRoot=f.dir('redirect/zgmini-996-test-nested');
    assert.equal(f.run({root:fakeRoot}).code,
      'C_996_WINDOWS_ARCHIVE_FIXTURE_INVALID');
    assert.equal(fs.existsSync(f.dir('leases/oldC')),true);
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
  }finally{f.cleanup();}
});
test('changing a source SHA during a prior archive blocks later steps',()=>{
  const f=fixture();
  try{
    f.beforeMove((src)=>{
      if(src==='leases/oldC')fs.writeFileSync(
        f.dir('leases/install/owner.json'),'tampered');
    });
    const r=f.run();
    assert.equal(r.code,'C_996_WINDOWS_ARCHIVE_INSTALL_BARRIER_LOST');
    assert.equal(fs.existsSync(f.dir('leases/install')),true);
  }finally{f.cleanup();}
});
test('altered or externally constructed Windows move plans are rejected',()=>{
  const f=fixture();
  try{
    const fake={...f.plan,steps:f.plan.steps.map(s=>({...s}))};
    fake.steps[0].destination='C:\\Unauthorized\\outside';
    assert.equal(f.run({plan:fake}).code,
      'C_996_WINDOWS_ARCHIVE_TEST_PORT_UNVERIFIED');
    assert.equal(fs.existsSync(f.dir('leases/oldC')),true);
  }finally{f.cleanup();}
});
