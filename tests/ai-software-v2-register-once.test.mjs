import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {
 CONTROL_REPO,SOURCE_SHA,REQUEST_SCHEMA,REQUEST_SCOPE,REQUEST_TITLE,FILES,
 validateRequest,checkedSourceFiles,validatedManifestEntries,
} from '../tools/ai-software-v2-register-once.mjs';

function approvedIssue(){
 const request={schema:REQUEST_SCHEMA,requestId:`pc-ai-software-${randomUUID()}`,
  scope:REQUEST_SCOPE,sourceSha:SOURCE_SHA,
  definitionSha256:FILES['config/theme-ai-software-v2.json'],
  selectionSha256:FILES['theme-evidence/ai-software-selection.json'],
  aumSha256:FILES['theme-evidence/ai-software-aum.json']};
 return {event:{action:'opened',repository:{private:true,full_name:CONTROL_REPO},
  sender:{login:'ansqhd5774-Choi'},issue:{number:300,title:REQUEST_TITLE,
   user:{login:'ansqhd5774-Choi'},body:JSON.stringify(request)}},
  env:{GITHUB_REPOSITORY:CONTROL_REPO},request};
}

test('fixed fully approved one-time Issue passes admission',()=>{
 const {event,env,request}=approvedIssue();
 assert.deepEqual(validateRequest(event,env),request);
});

test('reject Issue author, non-private repo, title and operation scope drift',()=>{
 for(const mutation of [
  x=>{x.event.issue.user.login='other'},
  x=>{x.event.sender.login='other'},
  x=>{x.event.repository.private=false},
  x=>{x.event.issue.title='pc-job'},
  x=>{x.request.scope='AI_SOFTWARE_V2_PUBLIC_PUBLISH'},
  x=>{x.request.sourceSha='b'.repeat(40)},
  x=>{x.request.selectionSha256='0'.repeat(64)},
  x=>{x.request.definitionSha256='0'.repeat(64)},
  x=>{x.request.aumSha256='0'.repeat(64)},
  x=>{x.request.requestId='please-run-cmd'},
 ]){
  const x=approvedIssue();mutation(x);
  x.event.issue.body=JSON.stringify(x.request);
  assert.throws(()=>validateRequest(x.event,x.env),/AI_V2_/);
 }
});

test('reject extra fields/argument-injection payload and Markdown Issue text',()=>{
 const x=approvedIssue();x.request.command='powershell -Command whatever';
 x.event.issue.body=JSON.stringify(x.request);
 assert.throws(()=>validateRequest(x.event,x.env),/AI_V2_REQUEST_FIELDS_DENIED/);
 x.event.issue.body='```json\n'+JSON.stringify(approvedIssue().request)+'\n```';
 assert.throws(()=>validateRequest(x.event,x.env),/AI_V2_REQUEST_JSON_DENIED/);
});

test('tampered source bytes fail before any Windows operational side effect',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ai-v2-once-'));
 try{
  fs.mkdirSync(path.join(root,'config'));
  fs.mkdirSync(path.join(root,'theme-evidence'));
  fs.writeFileSync(path.join(root,'config','theme-ai-software-v2.json'),'{}\n');
  fs.writeFileSync(path.join(root,'theme-evidence','ai-software-selection.json'),'{}\n');
  fs.writeFileSync(path.join(root,'theme-evidence','ai-software-aum.json'),'{}\n');
  assert.throws(()=>checkedSourceFiles(root),/AI_V2_APPROVED_SOURCE_SHA_MISMATCH/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('approval source contains exactly three allowed input files',()=>{
 assert.deepEqual(Object.keys(FILES),[
  'config/theme-ai-software-v2.json',
  'theme-evidence/ai-software-selection.json',
  'theme-evidence/ai-software-aum.json']);
 assert.ok(Object.values(FILES).every(s=>/^[a-f0-9]{64}$/.test(s)));
});

test('installed dependency closure permits verified root and nested files',()=>{
 const entries=validatedManifestEntries({
  'package.json':'f'.repeat(64),
  'scripts/pc-writer/theme-config-tool.mjs':'a'.repeat(64),
  'scripts/pc-writer/theme-config-registry.mjs':'b'.repeat(64),
 });
 assert.equal(entries.length,3);
});

test('installed manifest rejects traversal, absolute paths, malformed hashes',()=>{
 for(const invalid of ['../secret','scripts/../secret','C:/file','/absolute','scripts//bad','./file']){
  assert.throws(()=>validatedManifestEntries({[invalid]:'a'.repeat(64),
   'scripts/pc-writer/theme-config-tool.mjs':'a'.repeat(64),
   'scripts/pc-writer/theme-config-registry.mjs':'b'.repeat(64)}),/AI_V2_INSTALLED_FILE_LIST_DENIED/);
 }
 assert.throws(()=>validatedManifestEntries({'package.json':'0',
  'scripts/pc-writer/theme-config-tool.mjs':'a'.repeat(64),
  'scripts/pc-writer/theme-config-registry.mjs':'b'.repeat(64)}),/AI_V2_INSTALLED_FILE_LIST_DENIED/);
});
