import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectR54BOriginalSource} from '../tools/update.mjs';

test('source inventory rejects unknown or absent R54 Writer root read-only',()=>{
 const root=path.join(os.tmpdir(),'r54-b-never-existent-'+process.pid);
 assert.throws(()=>inspectR54BOriginalSource({root}),/ENOENT/);
});

test('wrong installed bytes stop at first of exactly pinned six files',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-b-src-'));
 const target=path.join(root,'scripts','pc-writer','theme-nine-r54-public-connect.mjs');
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,'not-the-approved-source');
 assert.throws(()=>inspectR54BOriginalSource({root}),
  /R54_B_ORIGINAL_SOURCE_SHA_DRIFT/);
});

test('source root symlink is not followed as a trusted installation',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-b-root-'));
 const alias=root+'-alias';
 fs.symlinkSync(root,alias,'dir');
 assert.throws(()=>inspectR54BOriginalSource({root:alias}),
  /R54_B_SOURCE_ROOT_REDIRECT/);
});
