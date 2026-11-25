import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

// Entry executes under GitHub Actions and owns runtime side effects. Lock the
// optional-import boundary in source so an unrelated PC operation cannot be
// stopped by a missing preimage-only module before the common engine loads.
test('preimage module import is scoped to approved preimage requests',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL('../controller/entry.mjs',import.meta.url)),'utf8');
 const start=source.indexOf("let approvedPreimageScope=null;");
 const guard=source.indexOf("if(Object.hasOwn(raw,'preimageManifestPath')){",start);
 const stage=source.indexOf("importFailureStage='PREIMAGE_STAGE_IMPORT';",guard);
 const importer=source.indexOf("await import('./preimage-manifest-contract.mjs')",stage);
 const closer=source.indexOf("\n }\n // Delay engine/operations",importer);
 const engine=source.indexOf("await import('./engine.mjs')",closer);
 assert.ok(start>=0&&guard>start&&stage>guard&&importer>stage&&closer>importer&&engine>closer);
 assert.match(source.slice(start,guard),/approvedPreimageScope=null/);
 assert.match(source.slice(guard,closer),/approvedPreimageScope=readStagedPreimageScope\(\{env:process\.env,request:raw\}\)/);
 assert.equal(source.split("await import('./preimage-manifest-contract.mjs')").length,2);
});

test('preimage requests still require attested staging modules',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL('../controller/entry.mjs',import.meta.url)),'utf8');
 const verify=source.indexOf("if(Object.hasOwn(raw,'preimageManifestPath'))need([");
 const stage=source.indexOf("if(Object.hasOwn(raw,'preimageManifestPath')){",verify);
 assert.ok(verify>=0&&stage>verify);
 assert.match(source.slice(verify,stage),/PREIMAGE_STAGE_SOURCE_NOT_ATTESTED/);
});
