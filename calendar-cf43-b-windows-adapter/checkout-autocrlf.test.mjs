import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('B once workflow fixes checkout line endings before checkout',()=>{
 const yml=fs.readFileSync(path.join(dir,'pc-calendar-cf43-two-approved-b-once.yml'),'utf8');
 const env=yml.match(/\n    env:\n([\s\S]*?)\n    steps:/)?.[1];
 assert.ok(env,'job environment is present before checkout');
 assert.match(env,/^      GIT_CONFIG_COUNT: ['"]?1['"]?$/m);
 assert.match(env,/^      GIT_CONFIG_KEY_0: core\.autocrlf$/m);
 assert.match(env,/^      GIT_CONFIG_VALUE_0: ['"]?false['"]?$/m);
 assert.ok(yml.indexOf('    env:')<yml.indexOf('    steps:'),'set Git configuration before checkout');
 assert.match(yml,/ref: \$\{\{ github\.sha \}\}/);
});

test('approval manifest immutable SHA is byte-sensitive to CRLF',()=>{
 const approval=fs.readFileSync(path.join(dir,'approval.json'));
 assert.equal(digest(approval),'cbacc099dfe2e45527597c7ab359fdb25e839536395d4be0ff32885c3ca2bf80');
 const lf=approval.toString('utf8');
 assert.equal((lf.match(/\r/g)||[]).length,0);
 assert.ok((lf.match(/\n/g)||[]).length>0);
 const crlf=Buffer.from(lf.replace(/\n/g,'\r\n'));
 assert.notEqual(digest(crlf),digest(approval));
});
