import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {run996NativeOwnerCOnce} from '../tools/controller-996-c-native-owner-operator.mjs';
const operator=fileURLToPath(new URL('../tools/controller-996-c-native-owner-operator.mjs',import.meta.url));
const source=fs.readFileSync(operator,'utf8');

test('direct import and caller-shaped execution context cannot acquire the private entry',async()=>{
 for(const args of [{manifestCommitSha:'a'.repeat(40)},
  {manifestCommitSha:'a'.repeat(40),testOnly:true,executionAuthorized:true,
   sealedOwnerEntry:{manifestCommitSha:'a'.repeat(40)}}]){
  const r=await run996NativeOwnerCOnce(args);
  assert.equal(r.status,'BLOCKED_BEFORE_C_WRITE');
  assert.equal(r.phase,'NO_WRITE');assert.equal(r.executionAuthorized,false);
  assert.ok(['C_996_OWNER_ORIGINAL_WINDOWS_ONLY',
   'C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED'].includes(r.code));
 }
});

test('execution rejects synthetic verifier before any dynamic import or PC mutation',()=>{
 const input={fixtureOnly:false,executionAuthorized:false,operatorStarted:false,
  bootstrapSha256:'0'.repeat(64)};
 const r=spawnSync(process.execPath,[operator,'--execute-once','a'.repeat(40)],
  {input:JSON.stringify(input),encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(r.status,2);const result=JSON.parse(r.stdout);
 assert.equal(result.originalPcWrites,0);
 assert.ok(['C_996_OWNER_ORIGINAL_WINDOWS_ONLY',
  'C_996_OWNER_AUTHENTICATION_SOURCE_UNTRUSTED'].includes(result.code));
});

test('fixture receipt never grants the explicit execution mode',()=>{
 const r=spawnSync(process.execPath,[operator,'--execute-once','a'.repeat(40)],
  {input:JSON.stringify({fixtureOnly:true,executionAuthorized:false,operatorStarted:false}),
   encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(r.status,2);
 assert.equal(JSON.parse(r.stdout).code,'C_996_OWNER_HANDOFF_EVIDENCE_DRIFT');
});

test('trusted bootstrap implementation pin matches immutable Git LF bytes',()=>{
 const bootstrap=fs.readFileSync(fileURLToPath(new URL('../tools/controller-996-c-native-trusted-bootstrap.mjs',import.meta.url)), 'utf8').replaceAll('\r\n','\n');
 const pin=source.match(/const TRUSTED_BOOTSTRAP_SHA256='([a-f0-9]{64})'/)?.[1];
 assert.equal(createHash('sha256').update(bootstrap).digest('hex'),pin);
 assert.ok(source.indexOf('claimed.bootstrapSha256===TRUSTED_BOOTSTRAP_SHA256')<
  source.indexOf('const imports=pin996ReviewImports(claimed)'));
});

test('Windows launch modes are mutually exclusive and retain OS file pins',()=>{
 for(const name of ['VERIFY_996_WINDOWS_OUTER_ANCHOR.ps1','VERIFY_996_WINDOWS_TRUSTED_SNAPSHOT.ps1']){
  const ps=fs.readFileSync(fileURLToPath(new URL('../tools/'+name,import.meta.url)),'utf8');
  assert.match(ps,/\$ReviewOperatorHandoff -and \$ExecuteOperatorOnce/);
  assert.match(ps,/Zgmini996WindowsSourceSnapshot/);
  assert.doesNotMatch(ps,/-ExecutionPolicy\s+(?:Bypass|Unrestricted)/i);
 }
 assert.match(source,/consent\?\.consentCommentId===sealedOwnerEntry\.ownerConsentCommentId/);
 assert.ok(source.indexOf('C_996_OWNER_EXACT_EXECUTION_CONSENT_CHANGED')<source.indexOf("phase='RESERVATION_PROPOSAL'"));
});
