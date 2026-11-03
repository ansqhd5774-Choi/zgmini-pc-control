import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {findR6CandidateBounded,inspectR6SqliteReadOnly,
  restoreVerifiedR6ArchiveIsolated,R6_CANDIDATE_NAME,R6_VERIFIED_ARCHIVE_SHA256}
  from '../tools/r6-candidate-isolated-recovery.mjs';

const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'r6-source-only-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const name of ['analysis','projects','data','migration','verify','isolated'])
    fs.mkdirSync(path.join(root,name));
  return root;
}
function sampleSqlite(file){
  const db=new DatabaseSync(file);
  db.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, val TEXT); INSERT INTO records VALUES (1,\'R6\');');
  db.close();
}
const synthetic={synthetic:true};

test('bounded scan checks only fixed approved roots and finds exact candidate',t=>{
  const root=fixture(t);
  assert.equal(findR6CandidateBounded({scanBase:root},synthetic).status,'NOT_FOUND');
  const dir=path.join(root,'analysis','batch','outputs');
  fs.mkdirSync(dir,{recursive:true});
  const candidate=path.join(dir,R6_CANDIDATE_NAME);
  sampleSqlite(candidate);
  const result=findR6CandidateBounded({scanBase:root},synthetic);
  assert.equal(result.status,'FOUND');
  assert.deepEqual(result.candidatePaths,[candidate]);
});

test('incomplete scan stays INCONCLUSIVE; cannot be used as restore proof',t=>{
  const root=fixture(t);
  fs.mkdirSync(path.join(root,'analysis','nested'));
  const scan=findR6CandidateBounded({scanBase:root,directoryLimit:1},synthetic);
  assert.equal(scan.status,'INCONCLUSIVE');
  assert.equal(scan.code,'R6_SCAN_DIRECTORY_LIMIT');
  const blocked=restoreVerifiedR6ArchiveIsolated({scan,
    archivePath:path.join(root,'missing.sqlite'),archiveRoot:root,
    verificationParent:path.join(root,'verify'),
    isolationParent:path.join(root,'isolated'),isolationName:'r6-safe-1'},synthetic);
  assert.equal(blocked.status,'BLOCKED');
  assert.equal(blocked.code,'R6_ORIGINAL_ABSENCE_NOT_PROVEN');
});

test('missing scan root is INCONCLUSIVE, not proof the original is absent',t=>{
  const root=fixture(t);
  fs.rmdirSync(path.join(root,'migration'));
  const scan=findR6CandidateBounded({scanBase:root},synthetic);
  assert.equal(scan.status,'INCONCLUSIVE');
  assert.equal(scan.globalAbsenceProven,false);
  assert.equal(scan.code,'R6_SCAN_ROOT_ABSENT_OR_UNAVAILABLE');
});

test('isolated SQLite quick_check and SHA do not touch original source',t=>{
  const root=fixture(t);
  const candidate=path.join(root,'analysis',R6_CANDIDATE_NAME);
  sampleSqlite(candidate);
  const before=fs.readFileSync(candidate),stat=fs.statSync(candidate,{bigint:true});
  const result=inspectR6SqliteReadOnly(candidate,{approvedRoot:root,
    verificationParent:path.join(root,'verify'),expectedSha256:sha(candidate)},synthetic);
  assert.equal(result.status,'VERIFIED');
  assert.equal(result.sqliteQuickCheck,'ok');
  assert.deepEqual(fs.readFileSync(candidate),before);
  assert.equal(fs.statSync(candidate,{bigint:true}).mtimeNs,stat.mtimeNs);
});

test('unexpected DB hash and corrupt header block registration',t=>{
  const root=fixture(t);
  const candidate=path.join(root,'analysis',R6_CANDIDATE_NAME);
  sampleSqlite(candidate);
  let result=inspectR6SqliteReadOnly(candidate,{approvedRoot:root,
    verificationParent:path.join(root,'verify'),expectedSha256:'0'.repeat(64)},synthetic);
  assert.equal(result.code,'R6_ARCHIVE_SHA_MISMATCH');
  fs.writeFileSync(candidate,Buffer.alloc(8192));
  result=inspectR6SqliteReadOnly(candidate,{approvedRoot:root,
    verificationParent:path.join(root,'verify')},synthetic);
  assert.equal(result.code,'R6_SQLITE_HEADER_INVALID');
});

test('junction/symlink paths rejected, original verified prevents archive restore',t=>{
  const root=fixture(t);
  const candidate=path.join(root,'analysis',R6_CANDIDATE_NAME);
  sampleSqlite(candidate);
  const link=path.join(root,'analysis','linked.sqlite');
  fs.symlinkSync(candidate,link);
  const inspected=inspectR6SqliteReadOnly(link,{approvedRoot:root,
    verificationParent:path.join(root,'verify')},synthetic);
  assert.equal(inspected.status,'UNUSABLE');
  const blocked=restoreVerifiedR6ArchiveIsolated({scan:{status:'ORIGINAL_UNUSABLE',existingVerified:true},
    archivePath:candidate,archiveRoot:root,verificationParent:path.join(root,'verify'),
    isolationParent:path.join(root,'isolated'),isolationName:'r6-safe-1'},synthetic);
  assert.equal(blocked.code,'R6_ORIGINAL_ALREADY_VERIFIED');
  assert.notEqual(R6_VERIFIED_ARCHIVE_SHA256,sha(candidate));
});

test('a new isolation root cannot be replayed or overwrite existing files',t=>{
  const root=fixture(t);
  const folder=path.join(root,'isolated','r6-safe-1');
  fs.mkdirSync(folder);
  const marker=path.join(folder,R6_CANDIDATE_NAME);
  fs.writeFileSync(marker,'user-data');
  const scan={status:'NOT_FOUND',operatorConfirmedOriginUnavailable:true};
  const archivePath=path.join(root,'analysis','candidate.sqlite');
  sampleSqlite(archivePath);
  const result=restoreVerifiedR6ArchiveIsolated({scan,archivePath,archiveRoot:root,
    verificationParent:path.join(root,'verify'),isolationParent:path.join(root,'isolated'),
    isolationName:'r6-safe-1'},synthetic);
  assert.equal(result.status,'BLOCKED');
  assert.equal(fs.readFileSync(marker,'utf8'),'user-data');
});

const materializedArchive=path.resolve('r6-candidate-materialized','ZGMINI',R6_CANDIDATE_NAME);
test('verified archived 20MB snapshot restores to a NEW isolated path only',
  {skip:!fs.existsSync(materializedArchive)},t=>{
  const root=fixture(t);
  const copiedArchive=path.join(root,'analysis',R6_CANDIDATE_NAME);
  fs.copyFileSync(materializedArchive,copiedArchive,fs.constants.COPYFILE_EXCL);
  const beforeHash=sha(copiedArchive);
  assert.equal(beforeHash,R6_VERIFIED_ARCHIVE_SHA256);
  const result=restoreVerifiedR6ArchiveIsolated({scan:{status:'NOT_FOUND',operatorConfirmedOriginUnavailable:true},
    archivePath:copiedArchive,archiveRoot:root,
    verificationParent:path.join(root,'verify'),
    isolationParent:path.join(root,'isolated'),
    isolationName:'r6-20261103-test'},synthetic);
  assert.equal(result.status,'RESTORED_ISOLATED_VERIFIED');
  assert.equal(sha(result.candidatePath),R6_VERIFIED_ARCHIVE_SHA256);
  assert.equal(sha(copiedArchive),beforeHash);
  const retry=restoreVerifiedR6ArchiveIsolated({scan:{status:'NOT_FOUND',operatorConfirmedOriginUnavailable:true},
    archivePath:copiedArchive,archiveRoot:root,
    verificationParent:path.join(root,'verify'),
    isolationParent:path.join(root,'isolated'),
    isolationName:'r6-20261103-test'},synthetic);
  assert.equal(retry.code,'R6_ISOLATION_ALREADY_EXISTS');
  assert.equal(sha(result.candidatePath),R6_VERIFIED_ARCHIVE_SHA256);
});
