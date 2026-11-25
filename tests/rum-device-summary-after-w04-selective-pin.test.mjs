import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {manifestFingerprint,validateControllerOnlyInstallDelta} from '../tools/maintenance-contract.mjs';

const root=path.resolve(import.meta.dirname,'..');
const parserPath='controller/cloudflare-rum-field-parser.mjs';
const parserSha256='f3364bebe79c8b126f259ea34322475cd925d0700ec9cc301c2e335f23067ce6';
const files=[{path:parserPath,sha256:parserSha256}];

test('RUM excluded-device selective candidate uses reviewed single-file parser bytes',()=>{
 assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,parserPath))).digest('hex'),parserSha256);
 assert.equal(manifestFingerprint(files).sha256,'c9fa54df00426c82f9e18eec88257de142596fe1dd4bcb14bde1cc56c050cac3');
 assert.equal(validateControllerOnlyInstallDelta([parserPath],files),true);
 assert.throws(()=>validateControllerOnlyInstallDelta([parserPath,'controller/operations.mjs'],files),/ALLOWFILE_DIFF_MISMATCH/);
});
