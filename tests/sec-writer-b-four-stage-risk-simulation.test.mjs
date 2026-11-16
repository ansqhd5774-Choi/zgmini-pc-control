import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,validateWriterBManifest,APPROVAL_SCHEMA,SCOPE,SOURCE_REPO} from '../writer-b/contract.mjs';
import {applyApprovedInsertions,materializeApprovedWriterFile} from '../writer-b/insert-only-patch.mjs';

const H=value=>sha256(Buffer.from(value));
const PC_HEAD='f59e999082fd3b21893f0f74fc1913441ec80bba';
const NEW_MAIN='27c76e799f07d54b1a9cd2c41243fb12360c59a0';
const A_PREIMAGE=[
 ['scripts/pc-writer/quota-fetch.mjs','5ff750e1abf607e4a207bed16c20394406ca2ba8fe4ca42e2c514a155c87818b'],
 ['scripts/pc-writer/collect-local.mjs','588624ec4e7ac3a944abb3971663091e087cea70ec8324d1c9cfc137a7386e99'],
 ['scripts/pc-writer/collect-sec-fund-flow-pit.mjs','08638e14deb937386e8ed0440eefa32bb91ad440338680b4d89363c693e30611'],
 ['scripts/pc-writer/backfill-sec-fund-flow-raw-r1.mjs','3916fbed8a4e4b9f5f6c9c9efbbdff3382de0df9e5995bd0039ac91aa1f5b233'],
 ['scripts/pc-writer/earnings-r5-sec-history-backfill.mjs','a67df0f9466990de9ccb023852d5a2391d4bcceafde8a2f1a2c6ded4e9228e10'],
 ['scripts/pc-writer/earnings-r5-official-refresh-r1.mjs','241085e264270c3d5d21fcd96120e5a9962aac160e1b964f269215f64ed4cf05'],
 ['lib/market-score/breadth-r2-provider-client.mjs','43ec8718d7db768d93a2ed3fe22828b4f9bcfae778f00645863f6261b93c17eb']
];
const A_NEW=['scripts/pc-writer/sec-request-controls.mjs','scripts/pc-writer/sec-guard-runtime-config.mjs'];
function fixtureManifest(){
 return {
  schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
  sourceRepository:SOURCE_REPO,sourceBranch:'main',
  candidateSourceSha:NEW_MAIN,baseHead:PC_HEAD,baseConfigSourceSha:PC_HEAD,
  sourceRoot:'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release',
  configPath:'E:\\ZGmini\\data\\pc-writer\\config.json',
  coreTask:'ZGMINI-PC-Local-Core',
  files:[
   ...A_PREIMAGE.map(([path,beforeSha256])=>({path,change:'M',beforeSha256,afterSha256:H('MOCK_AFTER:'+path)})),
   ...A_NEW.map(path=>({path,change:'A',beforeSha256:null,afterSha256:H('MOCK_NEW:'+path)}))
  ],
  protectedFiles:[],runtimeDependencies:{taskXmlSha256:null,consumers:[]},
  runCount:1,allowProviderCalls:false,allowDbChanges:false,
  allowD1Writes:false,allowTaskDefinitionChanges:false,
  allowOtherSourceChanges:false,
 };
}
test('A readback: seven existing and two absent paths, none falsely installed',()=>{
 const files=fixtureManifest().files;
 assert.equal(files.length,9);
 assert.equal(files.filter(x=>x.change==='M').length,7);
 assert.equal(files.filter(x=>x.change==='A').length,2);
});
test('STRUCTURALLY valid synthetic Writer B is not an actual issued approval',()=>{
 const m=fixtureManifest();
 assert.equal(validateWriterBManifest(m),m);
 assert.ok(m.files.every(x=>x.afterSha256===H((x.change==='M'?'MOCK_AFTER:':'MOCK_NEW:')+x.path)));
});
test('missing real PC after SHA for any modified file fails B contract',()=>{
 const m=fixtureManifest();m.files[0].afterSha256=null;
 assert.throws(()=>validateWriterBManifest(m),{code:'WRITER_B_FILE_CONTRACT_STOP'});
});
test('missing new-file after SHA also fails B contract',()=>{
 const m=fixtureManifest();m.files.at(-1).afterSha256=null;
 assert.throws(()=>validateWriterBManifest(m),{code:'WRITER_B_FILE_CONTRACT_STOP'});
});
test('known A beforeHash rejects an unverified opaque PC preimage',()=>{
 const t=fixtureManifest().files[0],candidate=Buffer.from('MOCK CANDIDATE');
 const entry={...t,candidateSha256:sha256(candidate),
  insertions:[{anchor:'// approved anchor',position:'after',text:'const guarded=true;\n'}]};
 assert.throws(()=>materializeApprovedWriterFile(entry,candidate,
  Buffer.from('// approved anchor\noriginal app\n')),
  {code:'WRITER_B_INSERT_PREIMAGE_DRIFT_STOP'});
});
test('source HEAD/config mismatch is rejected',()=>{
 const m=fixtureManifest();m.baseConfigSourceSha=NEW_MAIN;
 assert.throws(()=>validateWriterBManifest(m),{code:'WRITER_B_SOURCE_CONTRACT_STOP'});
});
test('provider/DB/Task side effects remain forbidden in B source install',()=>{
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskDefinitionChanges']){
  const m=fixtureManifest();m[key]=true;
  assert.throws(()=>validateWriterBManifest(m),{code:'WRITER_B_SIDE_EFFECT_SCOPE_STOP'});
 }
});
test('protected existing file overlap is rejected',()=>{
 const m=fixtureManifest();m.protectedFiles=[{path:m.files[0].path,sha256:H('SAME')}];
 assert.throws(()=>validateWriterBManifest(m),{code:'WRITER_B_PROTECTED_OVERLAP_STOP'});
});
test('fixture insert preserves original lines and deterministic after hash',()=>{
 const original=Buffer.from('const existing=true;\n// approved anchor\nrun();\n');
 const inserts=[{anchor:'// approved anchor',position:'before',text:'const safe=true;\n'}];
 const after=applyApprovedInsertions(original,inserts);
 assert.equal(after.toString(),'const existing=true;\nconst safe=true;\n// approved anchor\nrun();\n');
 const candidate=Buffer.from('const candidate=true;\n');
 const entry={path:'scripts/pc-writer/quota-fetch.mjs',change:'M',
  beforeSha256:sha256(original),afterSha256:sha256(after),
  candidateSha256:sha256(candidate),insertions:inserts};
 assert.deepEqual(materializeApprovedWriterFile(entry,candidate,original),after);
});
test('insert-only rejects ambiguous anchors',()=>{
 const original=Buffer.from('// approved anchor\n// approved anchor\n');
 assert.throws(()=>applyApprovedInsertions(original,
  [{anchor:'// approved anchor',position:'after',text:'const x=1;\n'}]),
  {code:'WRITER_B_INSERT_ANCHOR_MATCH_STOP'});
});
test('insert-only refuses PC source drift',()=>{
 const original=Buffer.from('const existing=true;\n// approved anchor\n');
 const candidate=Buffer.from('const candidate=true;\n');
 const ins=[{anchor:'// approved anchor',position:'before',text:'const x=1;\n'}];
 const after=applyApprovedInsertions(original,ins);
 const entry={path:'scripts/pc-writer/quota-fetch.mjs',change:'M',
  beforeSha256:sha256(original),afterSha256:sha256(after),
  candidateSha256:sha256(candidate),insertions:ins};
 assert.throws(()=>materializeApprovedWriterFile(entry,candidate,Buffer.from('const changed=true;\n// approved anchor\n')),
  {code:'WRITER_B_INSERT_PREIMAGE_DRIFT_STOP'});
});
test('unapproved full file replacement cannot bypass candidate after hash',()=>{
 const t=fixtureManifest().files[0];
 assert.throws(()=>materializeApprovedWriterFile(t,Buffer.from('NOT APPROVED')),
  {code:'WRITER_B_OVERLAY_CANDIDATE_DRIFT_STOP'});
});
test('static B syntax does not prove which live Core process uses modified source',()=>{
 const m=fixtureManifest();
 assert.deepEqual(m.runtimeDependencies.consumers,[]);
 assert.equal(validateWriterBManifest(m),m);
});
