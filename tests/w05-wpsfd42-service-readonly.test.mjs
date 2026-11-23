import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {verifyW05ServiceBundle,interpretW05ServicePreview,runW05ServiceStoredReadonly,
 W05_ENTRY,W05_DEP} from '../controller/w05-wpsfd42-service-readonly.mjs';

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceSha='a'.repeat(40);
const branch='codex/w05-wpsfd42-service-ci-20261123';
const txt=[
 'SOURCE_VERSION='+'b'.repeat(64),'BLS_WPSFD42_SNAPSHOT_SHA256='+'c'.repeat(64),
 'API_REQUESTS=0','SQLITE_WRITES=0','D1_WRITES=0','SCHEDULER_CHANGED=NO',
 'PUBLICATION_PERFORMED=NO',
].join('\n');
const payload={
 schemaVersion:'earnings-companion-c-r4-v1',historicalMode:'CURRENT_RETRIEVAL_NOT_PIT',
 status:'READY',sourceVersion:'b'.repeat(64),sourceStoredAt:1792660000000,
 coverage:{configured:2,ready:2,partial:0,unavailable:0},
 rows:[
  {indicatorId:'bls_ppi_services_yoy_sa',seriesId:'WPSFD42',kind:'DERIVED',
   observationPeriod:'2026-10',value:3.22,unit:'PERCENT',status:'READY'},
  {indicatorId:'bls_ppi_services_index',seriesId:'WPSFD42',kind:'RAW',
   observationPeriod:'2026-10',value:159.7,unit:'INDEX',status:'READY'},
 ]
};

function bundle(t,{script='// approved fixture',dependency='// linked fixture'}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w05-readonly-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const files={[W05_ENTRY]:sha(script),[W05_DEP]:sha(dependency)};
 for(const [file,contents] of [[W05_ENTRY,script],[W05_DEP,dependency]]){
  const output=path.join(root,'source',...file.split('/'));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,contents);
 }
 const manifest={sourceSha,sourceBranch:branch,entrypoint:W05_ENTRY,files};
 const bytes=Buffer.from(JSON.stringify(manifest));
 fs.writeFileSync(path.join(root,'manifest.json'),bytes);
 const request={operation:'w05-wpsfd42-service-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:branch,sourceSha};
 const host={approvedSources:{[sourceSha]:{root,branch,manifestSha256:sha(bytes)}}};
 return {root,request,host};
}

test('only the exact B-approved two-module bundle is eligible',t=>{
 const f=bundle(t);
 const verified=verifyW05ServiceBundle(f);
 assert.deepEqual(verified.sources.map(item=>item.file),[W05_ENTRY,W05_DEP]);
 assert.equal(verified.sourceSha,sourceSha);
 assert.equal(verifyW05ServiceBundle({request:f.request,host:{approvedSources:{}}}),null);
 assert.throws(()=>verifyW05ServiceBundle({
  request:{...f.request,sourceBranch:'other'},host:f.host,
 }),/W05_APPROVED_BRANCH_MISMATCH/);
 fs.appendFileSync(path.join(f.root,'source',...W05_ENTRY.split('/')),'\n// tampered');
 assert.throws(()=>verifyW05ServiceBundle(f),/W05_APPROVED_FILE_DRIFT/);
});

test('read-only result exposes exactly two identified service values and SHA',()=>{
 const result=interpretW05ServicePreview(payload,txt);
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'W05_SERVICE_STORED_CALC_VERIFIED');
 assert.equal(result.rows.length,2);
 assert.equal(result.sourceSnapshotSha256,'c'.repeat(64));
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.equal(result.operationalWrites,0);
 assert.deepEqual(result.rows.map(x=>x.value),[3.22,159.7]);
});

test('partial and malicious/non-service reports never pass',()=>{
 const partial=structuredClone(payload);
 partial.status='PARTIAL';partial.rows[0].status='PARTIAL';partial.rows[0].value=null;
 partial.coverage={configured:2,ready:1,partial:1,unavailable:0};
 assert.equal(interpretW05ServicePreview(partial,txt).status,'BLOCKED');
 assert.throws(()=>interpretW05ServicePreview({...payload,
  rows:[...payload.rows,{...payload.rows[0]}]},txt),/W05_SERVICE_PAYLOAD_CONTRACT/);
 assert.throws(()=>interpretW05ServicePreview(payload,txt.replace('SQLITE_WRITES=0','SQLITE_WRITES=1')),
  /W05_READONLY_REPORT_INCOMPLETE/);
 assert.throws(()=>interpretW05ServicePreview(payload,txt.replace('c'.repeat(64),'not-a-hash')),
  /W05_SERVICE_SNAPSHOT_PROVENANCE_MISSING/);
});

test('a staged source executes with fixed service-only argument and writes artifacts only in job workspace',async t=>{
 const script=[
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  "import {fileURLToPath} from 'node:url';",
  "if(process.argv.slice(2).join(' ')!=='--service-only')process.exit(8);",
  "if(!process.env.ZGMINI_PC_HOME)process.exit(9);",
  "const dir=path.dirname(fileURLToPath(import.meta.url));",
  "const prefix='EARNINGS_R4_C_SERVICE_ONLY_READ_MODEL_PREVIEW_RESULT_20261123-103000Z';",
  'fs.writeFileSync(path.join(dir,prefix+".json"),'+JSON.stringify(JSON.stringify(payload))+');',
  'fs.writeFileSync(path.join(dir,prefix+".txt"),'+JSON.stringify(txt)+');',
 ].join('\n');
 const f=bundle(t,{script});
 const dataRoot=path.join(f.root,'data');
 const workspace=path.join(f.root,'job');
 fs.mkdirSync(path.join(dataRoot,'pc-writer','storage'),{recursive:true});
 fs.writeFileSync(path.join(dataRoot,'pc-writer','storage','core.sqlite'),'fixture-placeholder');
 fs.mkdirSync(workspace);
 const result=await runW05ServiceStoredReadonly({...f,dataRoot,workspace});
 assert.equal(result.status,'PASS');
 assert.equal(result.actualExecutionSha,sourceSha);
 assert.equal(result.executionMode,'APPROVED_STORED_SERVICE_ONLY');
 assert.equal(fs.readdirSync(path.join(f.root,'source','scripts','pc-writer')).length,2);
 assert.equal(fs.readdirSync(path.join(workspace,'w05-service-source','scripts','pc-writer')).length,4);
 assert.equal(fs.readFileSync(path.join(dataRoot,'pc-writer','storage','core.sqlite'),'utf8'),'fixture-placeholder');
});

test('unapproved source is blocked before touching the source or operational DB',async()=>{
 const result=await runW05ServiceStoredReadonly({
  request:{sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha,sourceBranch:branch},
  host:{approvedSources:{}},dataRoot:'/missing',workspace:'/missing'
 });
 assert.deepEqual({status:result.status,code:result.code,candidateExecuted:result.candidateExecuted},
  {status:'BLOCKED',code:'W05_B_APPROVED_SOURCE_NOT_STAGED',candidateExecuted:false});
});
