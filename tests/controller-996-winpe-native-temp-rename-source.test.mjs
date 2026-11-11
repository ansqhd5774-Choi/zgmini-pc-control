// Static test of UNBUILT Windows proof candidate. This is not native OS proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const file=fileURLToPath(new URL('../tools/controller-996-winpe-native-temp-rename.c',import.meta.url));
const src=fs.readFileSync(file,'utf8');

test('build requires x64 TEST-only macro and rejects original ZGMINI E: machine',()=>{
  assert.match(src,/#ifndef C996_NATIVE_TEMP_TEST_ONLY[\s\S]+?#error/);
  assert.match(src,/#ifndef _WIN64[\s\S]+?#error/);
  assert.match(src,/GetComputerNameW/);
  assert.match(src,/GetEnvironmentVariableW\(L"RUNNER_NAME"/);
  assert.match(src,/#ifndef C996_NATIVE_INTERACTIVE_TEMP_TEST_ONLY/);
  assert.match(src,/GetFileAttributesW\(L"E:\\\\ZGmini"\)/);
  assert.match(src,/GetTempPathW/);
  assert.match(src,/C996_FIXTURE_PREFIX/);
  assert.match(src,/while \(count > 3 && full_path\[count - 1\] == L'\\\\'\) --count;/);
});

test('Windows native primitive is handle-based FileRenameInfo without replacement',()=>{
  assert.match(src,/CreateFileW\(/);
  assert.match(src,/FILE_FLAG_BACKUP_SEMANTICS\s*\|\s*FILE_FLAG_OPEN_REPARSE_POINT/);
  assert.match(src,/GetFileInformationByHandleEx\(h, FileIdInfo/);
  assert.match(src,/offsetof\(FILE_RENAME_INFO, FileName\)/);
  assert.match(src,/ReplaceIfExists\s*=\s*FALSE/);
  assert.match(src,/RootDirectory\s*=\s*root_handle/);
  assert.match(src,/SetFileInformationByHandle\(source_handle, FileRenameInfo/);
  assert.match(src,/archive_handle\s*=\s*c996_open_dir\(archive,[\s\S]+?FILE_SHARE_DELETE\)/);
  assert.match(src,/C996_RENAME_DONE/);
  assert.doesNotMatch(src,/\bMoveFileExW\s*\(|\bMoveFileW\s*\(|\bRemoveDirectoryW\s*\(|\bDeleteFileW\s*\(/);
});

test('renamed-but-not-verified remains UNKNOWN with no automated fallback',()=>{
  assert.match(src,/RENAME_RESULT_UNKNOWN/);
  assert.match(src,/RENAME_DENIED_OR_COLLISION/);
  assert.doesNotMatch(src,/system\s*\(|WinExec\s*\(|ShellExecute\s*\(/);
});
