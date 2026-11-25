import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root=path.resolve(import.meta.dirname,'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const exactFiles=Object.freeze([
 {path:'controller/market-calendar-er1-dec31-evidence-readonly.mjs',
  sha256:'0b93d41303b366c9204f84bbeeada10aae2c02ada6c61932af5755f2f7444590'},
 {path:'controller/writer-publication-evidence-readonly.mjs',
  sha256:'206f90f4753b1146f40e9e9c9be2791f8c6958eafe05492cb54fc045f909c3b2'},
]);

test('ER1 December selective overlay two paths match merged read-only source bytes',()=>{
 assert.equal(exactFiles.length,2);
 for(const file of exactFiles){
  assert.equal(digest(fs.readFileSync(path.join(root,file.path))),file.sha256);
 }
});
