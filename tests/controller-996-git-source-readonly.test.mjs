import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verify996GitSourceReadOnly} from
  '../tools/controller-996-git-source-readonly.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const CORE='badad9124157879d7a645b64f2768113d632355b';
const STAGE='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const MAINT='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const C='automation/pc-control';
const M='automation/pc-maintenance';
const S=`${C}/backups/controller-update-${REQ}/stage`;
const MAINT_FILES=[
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs',
  'tools/source-bundle-register.mjs',
];
const digest=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
  const git=new Map();
  const local=rel=>path.join(root,...rel.split('/'));
  const put=(rel,buf)=>{
    fs.mkdirSync(path.dirname(local(rel)),{recursive:true});
    fs.writeFileSync(local(rel),buf);
    return digest(buf);
  };
  const maps={installed:{},staged:{},maintainer:{}};
  for(let i=0;i<39;i++){
    const rel=i===0?'config/operations.json':
      `controller/source-${String(i).padStart(2,'0')}.mjs`;
    const staged=Buffer.from('stage '+rel);
    maps.staged[rel]=put(`${S}/${rel}`,staged);
    git.set(STAGE+':'+rel,staged);
    if(i<38){
      const installed=Buffer.from('installed '+rel);
      maps.installed[rel]=put(`${C}/${rel}`,installed);
      git.set(CORE+':'+rel,installed);
    }
  }
  for(const rel of MAINT_FILES){
    const bytes=Buffer.from('maintainer '+rel);
    maps.maintainer[rel]=put(`${M}/${rel}`,bytes);
    git.set(MAINT+':'+rel,bytes);
  }
  const pins={
    installed:put(`${C}/host.json`,Buffer.from(JSON.stringify({
      controllerSourceSha:CORE,controllerFiles:maps.installed}))),
    staged:put(`${S}/host.json`,Buffer.from(JSON.stringify({
      controllerSourceSha:STAGE,controllerFiles:maps.staged}))),
    maintainer:put(`${M}/MAINTENANCE_INSTALL.json`,Buffer.from(JSON.stringify({
      schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha:MAINT,
      files:maps.maintainer}))),
  };
  const run=options=>verify996GitSourceReadOnly({testOnly:true,
    root,expected:pins,gitSourceRead:(commit,rel)=>git.get(commit+':'+rel),
    ...options});
  return {root,local,put,git,run,pins,maps,
    cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('production call is refused on non-original environment',()=>{
  const r=verify996GitSourceReadOnly();
  assert.equal(r.code,'C_996_SOURCE_ORIGINAL_WINDOWS_REQUIRED');
  assert.equal(r.executionAuthorized,false);
});
test('a dedicated temp fixture validates 38 + 39 + 7 exact Git bytes',()=>{
  const f=fixture();
  try{
    const r=f.run();
    assert.equal(r.status,'SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS');
    assert.deepEqual([r.installed,r.staged,r.maintainer,r.total],
      [38,39,7,84]);
    assert.equal(r.executionAuthorized,false);
    assert.equal(r.operationalWrites,0);
    assert.equal(r.workflowPuts,0);
  }finally{f.cleanup();}
});
test('Git object drift is not mistaken for a matching local manifest',()=>{
  const f=fixture();
  try{
    f.git.set(CORE+':controller/source-01.mjs',Buffer.from('different'));
    assert.equal(f.run().code,'C_996_SOURCE_GIT_BYTES_DRIFT');
  }finally{f.cleanup();}
});
test('a local source modification fails before a Git success claim',()=>{
  const f=fixture();
  try{
    fs.writeFileSync(f.local(`${S}/controller/source-01.mjs`),'changed');
    assert.equal(f.run().code,'C_996_SOURCE_FILE_SHA_DRIFT');
  }finally{f.cleanup();}
});
test('an extra staged file is rejected',()=>{
  const f=fixture();
  try{
    f.put(`${S}/controller/unlisted.mjs`,Buffer.from('extra'));
    assert.equal(f.run().code,'C_996_SOURCE_STAGE_EXTRA_OR_MISSING');
  }finally{f.cleanup();}
});
test('a symlink to a source file is rejected before bytes are trusted',()=>{
  const f=fixture();
  try{
    const target=f.local(`${C}/controller/source-01.mjs`);
    fs.renameSync(target,target+'.old');
    fs.symlinkSync(target+'.old',target);
    assert.equal(f.run().code,'C_996_SOURCE_PATH_UNSAFE');
  }finally{f.cleanup();}
});
test('the caller cannot redirect a test fixture into an arbitrary root',()=>{
  const f=fixture();
  try{
    assert.equal(f.run({root:os.tmpdir()}).code,
      'C_996_SOURCE_TEST_ROOT_INVALID');
  }finally{f.cleanup();}
});
test('a changed original manifest SHA is not accepted',()=>{
  const f=fixture();
  try{
    fs.writeFileSync(f.local(`${C}/host.json`),'{}');
    assert.equal(f.run().code,'C_996_SOURCE_HOST_SHA_DRIFT');
  }finally{f.cleanup();}
});
