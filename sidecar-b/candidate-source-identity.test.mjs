import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256,PREIMAGE} from './contract.mjs';

const APPROVED_SOURCE='24077edc2fb4196e83ba202fdd9681b1fe841447';
const OLD_INSTALLED_SOURCE='f7ed1e44957b5a8994163c1f2e5bd23bc1cb9ab5';
const AFTER='a7051e99990a1781b1cdda83398b1d01aefc7885f0e23863abb4279c5bb5b548';
test('approved R10 Sidecar candidate matches exact preimage except one SHA40 literal',()=>{
 const after=fs.readFileSync(new URL('./approved/archive-run-r1-20261124.mjs',import.meta.url));
 assert.equal(after.length,11478);
 assert.equal(sha256(after),AFTER);
 const text=after.toString('utf8');
 assert.equal(text.split(APPROVED_SOURCE).length,2);
 assert.equal(text.includes(OLD_INSTALLED_SOURCE),false);
 const before=Buffer.from(text.replace(APPROVED_SOURCE,OLD_INSTALLED_SOURCE),'utf8');
 assert.equal(before.length,after.length);
 assert.equal(sha256(before),PREIMAGE);
});
