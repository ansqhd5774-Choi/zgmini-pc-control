import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verify996OfflineGitBytesReadOnly} from
  '../tools/controller-996-git-byte-offline-readonly-r4.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const C='automation/pc-control',M='automation/pc-maintenance';
const STAGE=`${C}/backups/controller-update-${REQ}/stage`;
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`))
  .update(b).digest('hex');
const MAINT=[
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs',
  'tools/source-bundle-register.mjs',
];
const commits={
  installed:'badad9124157879d7a645b64f2768113d632355b',
  staged:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
  maintainer:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
};
const treeShas={
  installed:'425f27b64f3e748cfdaa71c1eaae306d4c082997',
  staged:'9170dad62a019a48e6f261694bfb0d9c59120b46',
  maintainer:'b4dd0dfb243a895acc739a8922b084384e4318f5',
};
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-offline-'));
  const local=rel=>path.join(root,...rel.split('/'));
  const put=(rel,bytes)=>{
    fs.mkdirSync(path.dirname(local(rel)),{recursive:true});
    fs.writeFileSync(local(rel),bytes);
    return hash(bytes);
  };
  const maps={installed:{},staged:{},maintainer:{}};
  const files={installed:{},staged:{},maintainer:{}};
  const add=(kind,base,rel,bytes)=>{
    maps[kind][rel]=put(`${base}/${rel}`,bytes);
    files[kind][rel]={sha256:hash(bytes),gitBlobSha1:blob(bytes),
      size:bytes.length};
  };
  for(let i=0;i<39;i++){
    const rel=i===0?'config/operations.json':
      `controller/source-${String(i).padStart(2,'0')}.mjs`;
    add('staged',STAGE,rel,Buffer.from('STAGED:'+rel));
    if(i<38)add('installed',C,rel,Buffer.from('INSTALLED:'+rel));
  }
  for(const rel of MAINT)add('maintainer',M,rel,Buffer.from('MAINT:'+rel));
  const pins={
    installed:put(`${C}/host.json`,Buffer.from(JSON.stringify({
      controllerSourceSha:commits.installed,controllerFiles:maps.installed}))),
    staged:put(`${STAGE}/host.json`,Buffer.from(JSON.stringify({
      controllerSourceSha:commits.staged,controllerFiles:maps.staged}))),
    maintainer:put(`${M}/MAINTENANCE_INSTALL.json`,Buffer.from(JSON.stringify({
      schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha:commits.maintainer,
      files:maps.maintainer}))),
  };
  const manifest={schema:'ZGMINI_CONTROLLER_996_GIT_BYTES_OFFLINE_MANIFEST_R4',
    commits,treeShas,files};
  const run=options=>{
    const manifestBytes=Buffer.from(JSON.stringify(manifest)+'\n');
    return verify996OfflineGitBytesReadOnly({testOnly:true,root,
      manifestBytes,expectedManifestSha256:hash(manifestBytes),
      expectedHostShas:pins,...options});
  };
  return {root,local,put,pins,manifest,files,run,
    cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('offline R4 library refuses Linux non-fixture production access',()=>{
  const r=verify996OfflineGitBytesReadOnly();
  assert.equal(r.code,'C_996_OFFLINE_ORIGINAL_WINDOWS_REQUIRED');
  assert.equal(r.executionAuthorized,false);
});
test('production direct-import cannot select a custom Git manifest digest',()=>{
  const r=verify996OfflineGitBytesReadOnly({
    expectedManifestSha256:'f'.repeat(64),
  });
  assert.equal(r.code,'C_996_OFFLINE_GIT_PIN_NOT_SEALED');
  assert.equal(r.operationalWrites,0);
  assert.equal(r.executionAuthorized,false);
});
test('offline 84-file fixture matches sealed remote blob and local SHA pins',()=>{
  const f=fixture();try{
    const r=f.run();
    assert.equal(r.status,'SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS');
    assert.deepEqual([r.installed,r.staged,r.maintainer,r.total],
      [38,39,7,84]);
    assert.equal(r.originalWindowsReadback,false);
    assert.equal(r.operationalWrites,0);
  }finally{f.cleanup();}
});
test('remote blob SHA1 drift is independently rejected',()=>{
  const f=fixture();try{
    f.files.installed['config/operations.json'].gitBlobSha1='0'.repeat(40);
    assert.equal(f.run().code,'C_996_OFFLINE_GIT_BLOB_OR_HOST_MISMATCH');
  }finally{f.cleanup();}
});
test('local source change or bad Git SHA256 both stop',()=>{
  const f=fixture();try{
    fs.writeFileSync(f.local(`${C}/controller/source-01.mjs`),'modified');
    assert.equal(f.run().code,'C_996_OFFLINE_GIT_BLOB_OR_HOST_MISMATCH');
  }finally{f.cleanup();}
  const g=fixture();try{
    g.files.staged['config/operations.json'].sha256='f'.repeat(64);
    assert.equal(g.run().code,'C_996_OFFLINE_GIT_BLOB_OR_HOST_MISMATCH');
  }finally{g.cleanup();}
});
test('unlisted stage file or missing remote pin fails before any success',()=>{
  const f=fixture();try{
    f.put(`${STAGE}/controller/unlisted.mjs`,Buffer.from('extra'));
    assert.equal(f.run().code,'C_996_OFFLINE_STAGE_UNLISTED_FILE');
  }finally{f.cleanup();}
  const g=fixture();try{
    delete g.files.installed['controller/source-01.mjs'];
    assert.equal(g.run().code,'C_996_OFFLINE_FILE_SET_DRIFT');
  }finally{g.cleanup();}
});
test('untrusted symlink and arbitrary test root are refused',()=>{
  const f=fixture();try{
    const rel=`${C}/controller/source-01.mjs`,full=f.local(rel);
    fs.renameSync(full,full+'.old');fs.symlinkSync(full+'.old',full);
    assert.equal(f.run().code,'C_996_OFFLINE_PATH_UNSAFE');
    assert.equal(f.run({root:os.tmpdir()}).code,
      'C_996_OFFLINE_TEST_ROOT_INVALID');
  }finally{f.cleanup();}
});
