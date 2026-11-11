import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=rel=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const harness=read('tests/controller-996-cng-windows-temp-harness.c');
const runner=read('tools/RUN_996_CNG_TEMP_CRYPTO_ONCE.cmd');
const vectorGenerator=read('tests/generate-controller-996-cng-vectors.mjs');

test('CNG native harness pins ONLY the existing shared queue PC and blocks original E:',()=>{
  assert.match(harness,/DESKTOP-N62L0NG/);
  assert.match(harness,/GetFileAttributesW\(L"E:\\\\ZGmini"\)/);
  assert.match(harness,/ERROR_ACCESS_DENIED|Fail closed on access denied/);
  assert.match(harness,/C996_CNG_WINDOWS_TEMP_TEST_ONLY/);
  assert.match(harness,/C996_CNG_WINDOWS_TEMP_CRYPTO_PASS_NOT_OWNER_OR_WINPE_PROOF/);
  assert.doesNotMatch(harness,/\b(MoveFile|SetFileInformationByHandle|DeleteFile|CreateFile|RemoveDirectory)\s*\(/);
});
test('one-shot CMD builds into user C: TEMP with VS x64 and has no retry/cleanup',()=>{
  assert.match(runner,/DESKTOP-N62L0NG/);
  assert.match(runner,/C996_TEST_TEMP=%TEMP%/);
  assert.match(runner,/C996_TEST_TEMP:~0,3%/);
  assert.match(runner,/VsDevCmd\.bat/);
  assert.match(runner,/\-arch=x64 -host_arch=x64/);
  assert.match(runner,/\/DC996_CNG_WINDOWS_TEMP_TEST_ONLY=1/);
  assert.match(runner,/C996_OUTPUT%\\build\.txt/);
  assert.match(runner,/C996_OUTPUT%\\result\.txt/);
  assert.doesNotMatch(runner,/\b(powershell|rmdir|del\s|erase\s|schtasks|gh\s|git\s|robocopy)\b/i);
});
test('vectors are ephemeral TEST RSA key only and output public fixtures, not Owner trust',()=>{
  assert.match(vectorGenerator,/generateKeyPairSync\('rsa'/);
  assert.match(vectorGenerator,/C996_PUBLIC_TEST_VECTORS_CREATED_NO_PRIVATE_KEY/);
  assert.match(vectorGenerator,/c996_wrong_salt_signature/);
  assert.match(vectorGenerator,/c996_pkcs1_signature/);
  assert.match(vectorGenerator,/flag:'wx'/);
  assert.doesNotMatch(vectorGenerator,/privateKey\.export|writeFileSync\([^)]*privateKey/);
});
