import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../controller/report-upload-verified.mjs',import.meta.url));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
test('#3650 selected Controller upload module is the exact CI-approved main source',()=>{
 const bytes=fs.readFileSync(source);
 assert.equal(sha256(bytes),'65639a1281c1a39bf35bed773c1814aa973c38cd88bdb45a87f0081730887585');
 const code=bytes.toString('utf8');
 assert.match(code,/postPutGetStatus/);
 assert.match(code,/REPORT_FILE_READBACK_NOT_VERIFIED/);
});
