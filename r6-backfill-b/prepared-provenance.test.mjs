import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {inspectR6PreparedSourceProof} from './prepared-provenance.mjs';
import {R6_ONE_SHOT} from './contract.mjs';

const H='a'.repeat(40),S='b'.repeat(40),P='c'.repeat(40),W='d'.repeat(64);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(action) {
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-provenance-'));
  try {
    const base=path.join(workspace,'data');
    const source=path.join(workspace,'projects','installed');
    const requestId=randomUUID();
    const provenanceDir=path.join(base,'writer-b-install-once',requestId);
    fs.mkdirSync(provenanceDir,{recursive:true});
    fs.mkdirSync(source,{recursive:true});
    const manifest={schema:R6_ONE_SHOT.approvalSchema,
      approvalState:'APPROVED_B_ONE_SHOT',scope:R6_ONE_SHOT.scope,
      sourceRepository:R6_ONE_SHOT.sourceRepository,sourceSha:S,controlSha:H,
      coreDatabasePath:R6_ONE_SHOT.coreDatabasePath,runCount:1,
      maxBlsRequests:18,maxDolRequests:2,maxTotalRequests:20,
      blsUnregistered24hLimit:25,allowProviderCalls:true,
      allowLocalRawDbWrites:true,allowD1Writes:false,
      allowSchedulerChanges:false,allowCoreSourceChanges:false,
      maxAutomaticRetries:0};
    const manifestBytes=Buffer.from(JSON.stringify(manifest));
    const pins={controlSha:H,sourceSha:S,approvalManifestSha256:digest(manifestBytes)};
    const record={schema:'ZGMINI_PC_WRITER_B_LOCAL_OVERLAY_PROVENANCE_V1',
      mode:'LOCAL_OVERLAY',localOnly:true,requestId,manifestSha:W,
      baseHead:'f'.repeat(40),baseTreeOid:'1'.repeat(40),
      candidateSourceSha:S,preparedLocalSha:P,preparedTreeOid:'2'.repeat(40),
      localRef:`refs/heads/writer-b/${requestId}`,
      changedPaths:['scripts/pc-writer/test.mjs'],fileHashes:[{
        path:'scripts/pc-writer/test.mjs',change:'modify',
        beforeSha256:'5'.repeat(64),afterSha256:'6'.repeat(64)}]};
    const configFile=path.join(base,'config.json');
    const provenanceFile=path.join(provenanceDir,'provenance.json');
    fs.writeFileSync(configFile,JSON.stringify({source:P}));
    fs.writeFileSync(provenanceFile,JSON.stringify(record)+'\n');
    const context={pins,manifestBytes,writerBRequestId:requestId,
      expectedWriterBManifestSha256:W,trustedInstalledSourceRoot:source,
      base,fixtureSourceBase:path.dirname(source),platform:'linux',fixture:true,
      gitInspect:()=>({head:P,affectedPathsClean:true})};
    return action({context,base,source,record,provenanceFile,provenanceDir,
      configFile,requestId});
  } finally {fs.rmSync(workspace,{recursive:true,force:true});}
}
const inspect=context=>inspectR6PreparedSourceProof(context);

test('S0 and synthetic prepared P remain distinct and proof never executes',()=>fixture(({context})=>{
  const result=inspect(context);
  assert.equal(result.status,'PREPARED_SOURCE_READONLY_VERIFIED_NOT_EXECUTABLE');
  assert.equal(result.approvedCandidateSourceSha,S);
  assert.equal(result.installedPreparedSha,P);
  assert.notEqual(result.approvedCandidateSourceSha,result.installedPreparedSha);
  assert.equal(result.executable,false);
  assert.equal(result.allowProviderCalls,false);
  assert.equal(result.allowDbWrites,false);
}));

test('config.source must be prepared P, never approved candidate S0',()=>fixture(({context,configFile})=>{
  fs.writeFileSync(configFile,JSON.stringify({source:S}));
  assert.throws(()=>inspect(context),{code:'R6_B_PREPARED_CONFIG_PREPARED_SHA_STOP'});
}));

test('prepared HEAD and dirty checked paths fail independently',()=>fixture(({context})=>{
  assert.throws(()=>inspect({...context,gitInspect:()=>({head:S,affectedPathsClean:true})}),
    {code:'R6_B_PREPARED_INSTALLED_HEAD_OR_DIRTY_STOP'});
  assert.throws(()=>inspect({...context,gitInspect:()=>({head:P,affectedPathsClean:false})}),
    {code:'R6_B_PREPARED_INSTALLED_HEAD_OR_DIRTY_STOP'});
}));

test('S0 candidate mismatch, exact writer manifest SHA mismatch both fail closed',()=>fixture(({context,record,provenanceFile})=>{
  fs.writeFileSync(provenanceFile,JSON.stringify({...record,candidateSourceSha:P}));
  assert.throws(()=>inspect(context),{code:'R6_B_PREPARED_PROVENANCE_CONTRACT_STOP'});
  fs.writeFileSync(provenanceFile,JSON.stringify(record));
  assert.throws(()=>inspect({...context,expectedWriterBManifestSha256:'a'.repeat(64)}),
    {code:'R6_B_PREPARED_PROVENANCE_CONTRACT_STOP'});
}));

test('manifest bytes cannot be forged by matching a plausible JSON shape',()=>fixture(({context})=>{
  assert.throws(()=>inspect({...context,manifestBytes:Buffer.concat([context.manifestBytes,Buffer.from(' ')])}),
    /R6_B_APPROVAL_HASH_STOP/);
}));

test('provenance file symlink or parent directory symlink is rejected',()=>fixture(({context,provenanceFile,provenanceDir,requestId,base})=>{
  const backup=path.join(base,'backup.json');
  fs.renameSync(provenanceFile,backup);
  fs.symlinkSync(backup,provenanceFile);
  assert.throws(()=>inspect(context),{code:'R6_B_PREPARED_FILE_SHAPE_STOP'});
  fs.unlinkSync(provenanceFile);
  fs.renameSync(backup,provenanceFile);
  const elsewhere=path.join(base,'elsewhere');
  fs.renameSync(provenanceDir,elsewhere);
  fs.symlinkSync(elsewhere,path.join(base,'writer-b-install-once',requestId),'dir');
  assert.throws(()=>inspect(context),{code:'R6_B_PREPARED_PATH_ALIAS_STOP'});
}));

test('installed source root outside trusted projects tree is rejected',()=>fixture(({context,base})=>{
  assert.throws(()=>inspect({...context,trustedInstalledSourceRoot:base}),
    {code:'R6_B_PREPARED_INSTALLED_SOURCE_PATH_STOP'});
}));

test('arbitrary git callback cannot produce an executable proof',()=>fixture(({context})=>{
  const result=inspect({...context,gitInspect:()=>({head:P,affectedPathsClean:true,executable:true})});
  assert.equal(result.executable,false);
}));

test('provenance record unknown field and path traversal fail',()=>fixture(({context,record,provenanceFile})=>{
  fs.writeFileSync(provenanceFile,JSON.stringify({...record,authorize:true}));
  assert.throws(()=>inspect(context),{code:'R6_B_PREPARED_PROVENANCE_CONTRACT_STOP'});
  fs.writeFileSync(provenanceFile,JSON.stringify({...record,
    changedPaths:['../config.json'],fileHashes:[{...record.fileHashes[0],path:'../config.json'}]}));
  assert.throws(()=>inspect(context),{code:'R6_B_PREPARED_PROVENANCE_FILE_HASH_STOP'});
}));

test('writer request id must be strict UUID, not path injection',()=>fixture(({context})=>{
  assert.throws(()=>inspect({...context,writerBRequestId:'../outside'}),
    {code:'R6_B_PREPARED_TRUST_INPUT_STOP'});
}));
