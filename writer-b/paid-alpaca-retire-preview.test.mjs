import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePreviewSpec} from './insert-preview-readonly.mjs';
import {applyApprovedInsertions} from './insert-only-patch.mjs';

const load=name=>JSON.parse(fs.readFileSync(
 new URL('../approvals/writer-previews/paid-alpaca-retire-'+name+'-20261123.json',
 import.meta.url),'utf8'));
const entry=load('local-cycle'),collector=load('collect-local');

test('Alpaca runtime retirement retains exact PC synthetic HEAD and byte CAS',()=>{
 for(const spec of [entry,collector]){
  assert.equal(validatePreviewSpec(spec),spec);
  assert.equal(spec.baseHead,'c62bd5aac3353d7e146d930dbb033b82d89010cd');
  assert.equal(spec.insertions.every(x=>x.text.includes('if (false)')||
   x.text.includes('RETIRED_LEGACY_ALPACA')),true);
  assert.ok(spec.insertions.every(x=>!x.text.includes('fetch(')));
 }
 assert.equal(entry.beforeSha256,'0cb4a9834c466d778415a12a4f8bdb62e66596dbd39ea2dd1b7550e982a0708d');
 assert.equal(collector.beforeSha256,'dd2ec67a4a26860215c4e94e4df9b0f4d4fdeb4532e0775600a810f6a966c706');
 assert.deepEqual([entry.filePath,collector.filePath],[
  'scripts/pc-writer/local-cycle.mjs','scripts/pc-writer/collect-local.mjs']);
});

test('insertions preserve all original lines; only retired Alpaca calls are inert',async()=>{
 const spawn=entry.insertions[0].anchor;
 const x=applyApprovedInsertions(Buffer.from('const live=42;\n'+spawn+'\nconst done=1;\n'),
  entry.insertions,{filePath:entry.filePath}).toString('utf8');
 assert.ok(x.includes('const live=42;\n'));
 assert.ok(x.includes('const done=1;\n'));
 assert.match(x,/if \(false\)[^\n]*\n\s*spawnSync/);
 const spawnCalls=[];
 const mock = {execPath:'node'};
 const simulatedSpawn= new Function('spawnSync','process','path','here',
  x.replace('const live=42;','').replace('const done=1;',''));
 simulatedSpawn((...args)=>spawnCalls.push(args),mock,{join:()=>'/tmp/legacy.mjs'},'/tmp');
 assert.equal(spawnCalls.length,0);
 const source=Buffer.from('const lane="core";\n'+collector.insertions[0].anchor+
  '\ntry{\n'+collector.insertions[1].anchor+'\n}catch(error){ }\n');
 const y=applyApprovedInsertions(source,collector.insertions,
  {filePath:collector.filePath}).toString('utf8');
 assert.match(y,/if \(false\)[^\n]*\n\s*sectorFearGreedEtf=await/);
 assert.match(y,/RETIRED_LEGACY_ALPACA/);
 const collectorCalls=[];
 const evaluate=new Function('collectSectorFearGreedR3EtfIncremental','base',
  'globalThis','Date','return (async()=>{'+y+'return sectorFearGreedEtf;})()');
 const result=await evaluate(async(...args)=>collectorCalls.push(args),'/tmp',
  {fetch:()=>{throw Error('unexpected provider call');}},Date);
 assert.equal(collectorCalls.length,0);
 assert.deepEqual(result,{status:'RETIRED_LEGACY_ALPACA',providerRequests:0});
});
