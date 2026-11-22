import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {admitPublication,publicationCheckoutOutput} from '../tools/publication-preflight.mjs';
import {APPROVAL_SCHEMA,REQUEST_SCHEMA,CONTROL_REPOSITORY,SOURCE_REPOSITORY,
 operationSpec,sha256} from '../tools/publication-contract.mjs';
test('approval on a later comment page selects the exact reviewed SHA, not current main',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-publication-admission-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const id='pc-publication-12345678-1234-4123-8123-123456789abc',actor='ansqhd5774-Choi';
 const spec=operationSpec('census-qfr-margin-once');
 const doc={schema:APPROVAL_SCHEMA,requestId:id,operation:'census-qfr-margin-once',
  sourceRepository:SOURCE_REPOSITORY,publisherSha:'a'.repeat(40),operationalSha:'b'.repeat(40),
  snapshotKey:spec.snapshotKey,publisherFiles:Object.fromEntries(spec.sourceFiles.map(p=>[p,'c'.repeat(64)])),
  approval:{grade:'B',scope:spec.approvalScope,actor,issueNumber:84},
  execution:{mode:'ONCE',maxAutomaticRetries:0,maxD1Keys:1,provider:spec.provider}};
 const raw=Buffer.from(JSON.stringify(doc)),hash=sha256(raw);
 const event={action:'opened',repository:{private:true},issue:{number:99,labels:[{name:'pc-publication'}],
  body:JSON.stringify({schema:REQUEST_SCHEMA,requestId:id,chatId:'chat-12345678-1234-4123-8123-123456789abc',
   operation:doc.operation,controlRepository:CONTROL_REPOSITORY,approvalManifestSha256:hash})}};
 const file=path.join(dir,'event.json');fs.writeFileSync(file,JSON.stringify(event));
 const environment={GITHUB_TOKEN:'fixture-not-a-credential',GITHUB_EVENT_PATH:file,GITHUB_ACTOR:actor,
  GITHUB_REPOSITORY:CONTROL_REPOSITORY,GITHUB_EVENT_NAME:'issues'};
 const routes=[];
 const githubGet=async route=>{
  routes.push(route);
  if(route.startsWith('contents/'))return {encoding:'base64',content:raw.toString('base64')};
  if(route==='issues/84')return {user:{login:actor}};
  if(route.endsWith('page=1'))return Array.from({length:100},()=>({user:{login:actor},body:'historical note'}));
  return [{user:{login:actor},body:`ZGMINI_B_PUBLICATION_APPROVED ${id} ${hash}`}];
 };
 const {validated}=await admitPublication({environment,githubGet});
 assert.equal(publicationCheckoutOutput(validated),'publisherSha='+'a'.repeat(40)+'\n');
 assert.ok(routes.includes('issues/84/comments?per_page=100&page=2'));
 await assert.rejects(admitPublication({environment,githubGet:async route=>route.includes('/comments?')?[]:githubGet(route)}),/EXPLICIT_B_APPROVAL_NOT_FOUND/);
 assert.throws(()=>publicationCheckoutOutput({approval:{publisherSha:'a\nINJECT=1'}}),/PUBLISHER_SHA_INVALID/);
});

test('existing workflow verifies effect approval before exact publisher checkout and retains opt-in',()=>{
 const workflow=fs.readFileSync(new URL('../.github/workflows/pc-publication-b.yml',import.meta.url),'utf8');
 const admission=workflow.indexOf('tools\\publication-preflight.mjs');
 const checkout=workflow.indexOf('ref: ${{ steps.publication.outputs.publisherSha }}');
 assert.ok(admission>0&&checkout>admission);
 assert.match(workflow,/ZGMINI_B_PUBLICATION_APPLY_ENABLED == 'true'/);
 assert.match(workflow,/GITHUB_TOKEN: \$\{\{ github.token \}\}/);
});
