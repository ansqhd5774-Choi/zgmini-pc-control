import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {create996NativeConsentReader}
 from '../tools/controller-996-native-consent-reader.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const path='docs/CONTROLLER_996_C_APPROVAL_R1.json';
const commit='a'.repeat(40);
const bytes=Buffer.from('{"schema":"TEST_ONLY_NO_REAL_CONSENT"}\n');
const blobSha=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`))
 .update(bytes).digest('hex');

function fixture({actor='ansqhd5774-Choi',fullRepo=repo,privateRepo=true,
 blob={},pages}={}){
 const calls=[];
 const replies={
  'issues/996':{status:200,data:{number:996,title:'pc-controller-update',
   user:{login:'ansqhd5774-Choi'}}},
  [`contents/${path}?ref=${commit}`]:{status:200,data:{type:'file',path,
   encoding:'base64',size:bytes.length,content:bytes.toString('base64'),
   sha:blobSha,...blob}},
 };
 const githubReader={
  authenticateReadOnly(){calls.push('AUTH');return {actor,repository:fullRepo,
   private:privateRepo,readOnly:true,executionAuthorized:false};},
  get(route){calls.push(route);
   if(route.startsWith('issues/996/comments?')){
    const p=Number(route.split('&page=')[1]);
    return {status:200,data:(pages??[[]])[p-1]??[]};
   }
   return replies[route]??{status:404,data:{}};
  },
 };
 return {reader:create996NativeConsentReader({githubReader}),replies,calls};
}

test('authenticated original issue, immutable Git blob and complete comments produce evidence, not C authority',()=>{
 const f=fixture({pages:[[{id:123,body:'not consent',user:{login:'other'}}]]});
 const data=f.reader.readOnce({manifestCommitSha:commit});
 assert.equal(data.gitRead.bytes.toString('utf8'),bytes.toString('utf8'));
 assert.equal(data.gitRead.commitSha,commit);
 assert.equal(data.commentsReadback.complete,true);
 assert.equal(data.commentsReadback.comments.length,1);
 assert.equal(data.operationalWrites,0);
 assert.equal(data.issuePosts,0);
 assert.equal(data.executionAuthorized,false);
 assert.deepEqual(f.calls,['AUTH','issues/996',
  `contents/${path}?ref=${commit}`,'issues/996/comments?per_page=100&page=1']);
 assert.throws(()=>f.reader.readOnce({manifestCommitSha:commit}),
  /C_CONSENT_READ_ALREADY_ATTEMPTED/);
});

test('only a pinned immutable 40-digit commit may start consent GET',()=>{
 const f=fixture();
 assert.throws(()=>f.reader.readOnce({manifestCommitSha:'main'}),
  /C_CONSENT_COMMIT_UNPINNED/);
 assert.equal(f.calls.length,0);
});

test('untrusted identity, repo and private state never produce consent evidence',()=>{
 for(const variant of [{actor:'github-actions[bot]'},
  {fullRepo:'other/repo'},{privateRepo:false}]){
  const f=fixture(variant);
  assert.throws(()=>f.reader.readOnce({manifestCommitSha:commit}),
   /C_CONSENT_GITHUB_ORIGIN_UNVERIFIED/);
  assert.deepEqual(f.calls,['AUTH']);
 }
});

test('tampered Git content, wrong blob SHA or missing exact object fail closed',()=>{
 for(const blob of [{content:'%%%bad'},
  {sha:'f'.repeat(40)},{size:bytes.length+1},{type:'dir'},
  {path:'docs/other.json'},{encoding:'utf-8'},
  {content:Buffer.from('other').toString('base64')},
 ]){
  const f=fixture({blob});
  assert.throws(()=>f.reader.readOnce({manifestCommitSha:commit}),
   /C_CONSENT_GIT_|C_CONSENT_IMMUTABLE_/);
 }
 const f=fixture();f.replies['issues/996'].status=404;
 assert.throws(()=>f.reader.readOnce({manifestCommitSha:commit}),
  /C_CONSENT_ORIGINAL_ISSUE_UNVERIFIED/);
});

test('full comment pagination only, no duplicate IDs, invalid pages reject',()=>{
 const hundred=Array.from({length:100},(_,i)=>({id:i+1}));
 const f=fixture({pages:[hundred,[{id:101}]]});
 assert.equal(f.reader.readOnce({manifestCommitSha:commit}).commentsReadback.comments.length,101);
 assert.equal(f.calls.filter(x=>x.includes('comments?')).length,2);
 const dup=fixture({pages:[[{id:12},{id:12}]]});
 assert.throws(()=>dup.reader.readOnce({manifestCommitSha:commit}),
  /C_CONSENT_COMMENTS_DUPLICATE_OR_INVALID_ID/);
 const invalid=fixture({pages:[Array.from({length:101},(_,i)=>({id:i+1}))]});
 assert.throws(()=>invalid.reader.readOnce({manifestCommitSha:commit}),
  /C_CONSENT_COMMENTS_PAGE_UNVERIFIED/);
});

test('read-only approval adapter contains no hidden PC/GitHub mutation API',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../tools/controller-996-native-consent-reader.mjs',import.meta.url)),'utf8');
 assert.doesNotMatch(source,/\b(?:writeFileSync|renameSync|unlinkSync|mkdirSync|rmSync|cpSync|execFileSync|spawnSync)\s*\(/);
 assert.doesNotMatch(source,/\b(?:fetch|https\.request|http\.request|process\.kill)\s*\(/);
});
