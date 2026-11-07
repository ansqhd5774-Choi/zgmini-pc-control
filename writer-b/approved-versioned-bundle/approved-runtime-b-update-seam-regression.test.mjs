import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
const patch=fs.readFileSync(new URL('./update-mjs-generic-b-optin.patch',import.meta.url),'utf8');

test('old update.mjs subcommand implementation not touched by proposed patch',()=>{
 const removed=patch.split('\n').filter(s=>s.startsWith('-')&&!s.startsWith('---'));
 assert.deepEqual(removed,[
  '-export async function command(args=process.argv.slice(2)) {',
  '- const cmd=args[0],requestId=safeId(args[2]);',
 ]);
 assert.match(patch,/const requestId=safeId\(args\[2\]\)/);
 for(const old of ['source-bundle-status','source-bundle-apply','r54-b-status',
  'r54-b-apply','host-r6-status','host-r6-apply']){
  assert.equal(patch.includes('- if(cmd===\''+old+'\')'),false);
 }
});

test('new commands are opt-in, default null before legacy slug parser',()=>{
 assert.match(patch,/approvedRuntimeBHook=null/);
 const newBranch=patch.indexOf("if(cmd==='approved-runtime-b-status'");
 const oldParser=patch.indexOf('const requestId=safeId(args[2])');
 assert.ok(newBranch>0&&oldParser>newBranch);
 assert.match(patch,/B_UPDATE_HOOK_NOT_INSTALLED/);
});
