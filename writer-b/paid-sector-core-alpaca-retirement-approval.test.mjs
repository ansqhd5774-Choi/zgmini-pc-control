import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateWriterBManifest} from './contract.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(dir,
 '../approvals/writer-updates/paid-sector-alpaca-retirement-threefile-20261123.json'),'utf8'));
const files=[
 'scripts/pc-writer/local-cycle.mjs',
 'scripts/pc-writer/collect-local.mjs',
 'scripts/pc-writer/expanded-collection-health.mjs',
];

test('paid-sector threefile Writer B has exact approved CAS and no provider or data effects',()=>{
 assert.equal(validateWriterBManifest(manifest),manifest);
 assert.deepEqual(manifest.files.map(x=>x.path),files);
 assert.equal(manifest.candidateSourceSha,'5c7f1673b4b2ea49f401891a674289c2cc493b8f');
 assert.equal(manifest.baseHead,'c62bd5aac3353d7e146d930dbb033b82d89010cd');
 assert.equal(manifest.baseConfigSourceSha,manifest.baseHead);
 assert.equal(manifest.files[0].beforeSha256,'0cb4a9834c466d778415a12a4f8bdb62e66596dbd39ea2dd1b7550e982a0708d');
 assert.equal(manifest.files[1].beforeSha256,'dd2ec67a4a26860215c4e94e4df9b0f4d4fdeb4532e0775600a810f6a966c706');
 assert.equal(manifest.files[2].beforeSha256,'3d937ea6e157511217d965f2a6939fbb58fcdee5e90809097acf9e626e8f5c41');
 assert.equal(manifest.coreMaintenance,'PAUSE_NEW_STARTS_DRAIN_360S_V1');
 assert.equal(manifest.runtimeDependencies.taskXmlSha256,
  'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.deepEqual(manifest.runtimeDependencies.consumers[0].dependsOn,[files[0]]);
 assert.deepEqual(manifest.protectedFiles,[]);
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])assert.equal(manifest[key],false);
 assert.equal(manifest.runCount,1);
});

test('specific source names and B effects are protected from silent scope expansion',()=>{
 for(const sourcePath of ['scripts/pc-writer/sector-provisional-cycle.mjs',
  'scripts/pc-writer/sector-fear-greed-r3-etf-incremental.mjs'])
  assert.ok(!manifest.files.some(f=>f.path===sourcePath));
 const unsafe={...manifest,allowTaskDefinitionChanges:true};
 assert.throws(()=>validateWriterBManifest(unsafe),{code:'WRITER_B_SIDE_EFFECT_SCOPE_STOP'});
 const missingFirstHop={...manifest,runtimeDependencies:{...manifest.runtimeDependencies,consumers:[]}};
 assert.throws(()=>validateWriterBManifest(missingFirstHop),{code:'WRITER_B_ENTRYPOINT_CONSUMER_MISSING_STOP'});
});
