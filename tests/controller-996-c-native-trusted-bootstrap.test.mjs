import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {verify996CTrustedBootstrapReadOnly} from
  '../tools/controller-996-c-native-trusted-bootstrap.mjs';

const source=fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../tools/controller-996-c-native-trusted-bootstrap.mjs'),'utf8');
const operator=fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../tools/controller-996-c-native-owner-operator.mjs'),'utf8');
const consentReader=fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../tools/controller-996-native-continuation-consent-reader.mjs'),'utf8');

test('Linux and synthetic permission flags cannot claim bootstrap authorization',()=>{
  assert.notEqual(process.platform,'win32');
  for(const args of [undefined,{},
    {manifestCommitSha:'a'.repeat(40)},
    {manifestCommitSha:'a'.repeat(40),testOnly:true,
      authorized:true,operatorStarted:true,root:'/tmp/zgmini-996-test'}]){
    const result=verify996CTrustedBootstrapReadOnly(args);
    assert.equal(result.status,'BOOTSTRAP_NO_GO');
    assert.equal(result.code,'C_996_BOOTSTRAP_ORIGINAL_WINDOWS_ONLY');
    assert.equal(result.executionAuthorized,false);
    assert.equal(result.operatorStarted,false);
    assert.equal(result.originalPcWrites,0);
    assert.equal(result.githubWrites,0);
    assert.equal(result.externalOsTrustAnchorVerified,false);
  }
});

test('bootstrap is read-only, has no plugin import, verifies exact independent source stages',()=>{
  assert.doesNotMatch(source,/\bimport\s*\(/);
  assert.match(source,/bootstrapSha256/);
  assert.match(source,/const FILES=Object\.freeze\(\[\s*SELF,/);
  assert.match(source,/filesCheckedAtS1:FILES\.length,/);
  assert.match(source,/filesCheckedAtS2:3/);
  assert.match(source,/ownerConsentCommentId:approved\[0\]\.id/);
  assert.match(source,/sourceLockSha256/);
  assert.match(source,/packageSha256/);
  assert.match(source,/CONTINUATION_C_CONSENT_V1/);
  assert.match(source,/CONTINUATION_C_REVOKE_V1/);
  assert.match(source,/sha\(Buffer\.from\(issue\.body\)\)===BODY_SHA/);
  assert.match(source,/operatorStarted:false/);
  assert.match(source,/executionAuthorized:false/);
  assert.match(source,/Get-FileHash/);
  assert.doesNotMatch(source,/(?:-X|--method)['",\s]*(?:POST|PUT|DELETE|PATCH)/);
  assert.doesNotMatch(source,/\b(?:renameSync|mkdirSync|writeFileSync|openSync|unlinkSync|rmSync|rmdirSync|spawnSync)\s*\(/);
  assert.doesNotMatch(source,/run996NativeOwnerCOnce/);
});

test('review bootstrap and owner operator share one exact 16-entry source lock',()=>{
  const bootstrapBlock=source.match(/const FILES=Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1];
  const operatorBlock=operator.match(/const FILES=\[([\s\S]*?)\];/)?.[1];
  assert.ok(bootstrapBlock&&operatorBlock);
  const files=block=>[...block.matchAll(/'((?:tools\/)[^']+)'/g)].map(m=>m[1]);
  const bootstrapPaths=files(bootstrapBlock);
  const operatorPaths=files(operatorBlock);
  assert.match(bootstrapBlock,/^\s*SELF,/);
  assert.match(operatorBlock,/^\s*SELF_REPO,/);
  bootstrapPaths.unshift('tools/controller-996-c-native-trusted-bootstrap.mjs');
  operatorPaths.unshift('tools/controller-996-c-native-owner-operator.mjs');
  assert.equal(bootstrapPaths.length,16);
  assert.equal(new Set(bootstrapPaths).size,16);
  assert.deepEqual(bootstrapPaths.sort(),operatorPaths.sort());
});

test('bootstrap exact Owner comment matches canonical consent reader field order',()=>{
  const block=source.split('function expectedConsent(')[1]
    ?.split('function validateManifest(')[0];
  const canonical=consentReader.split('export function format996ContinuationConsentBody(')[1]
    ?.split('function gitBlobSha(')[0];
  assert.ok(block&&canonical);
  const fields=['operatorSha256','bootstrapSha256','packageSha256','sourceLockSha256'];
  const positions=s=>fields.map(field=>s.indexOf('`'+field+'=${'));
  for(const s of [block,canonical]){
    const indexes=positions(s);
    assert.ok(indexes.every(x=>x>0));
    assert.deepEqual(indexes,[...indexes].sort((a,b)=>a-b));
  }
});
