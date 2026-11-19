import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateRequest} from '../controller/common.mjs';
import {
 projectPit0605Aggregate,retainPit0605PrivateEvidence,
} from '../controller/employment-r6-candidate-readonly.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const classes={
 ORIGINAL_VERSION_AND_HISTORICAL_AVAILABILITY_PROVED:0,
 RAW_OBSERVATION_MATCH_HISTORICAL_TIME_UNPROVEN:1,
 RAW_OBSERVATION_OR_REVISION_CONFLICT:1,
 RAW_NOT_FOUND_IN_CHECKED_SCOPE:0,
};
const raw={
 kind:'ZGMINI_W04_PIT0605_AGGREGATE_ONLY_V1',
 status:'HOLD_HISTORICAL_PIT_UNATTESTED',checkedAt:'2026-11-19T13:00:00.000Z',
 missingHistoryKeys:2,counts:classes,
 checkedRawSnapshots:1,acceptedDOLSnapshots:1,malformedRawSnapshotGroups:0,
 rejectedRawSnapshots:{bodyOrId:0,metadata:0,run:0,parser:0},
 historicalVersionAttested:false,repairAuthorized:false,
 operationalWrites:0,providerCalls:0,d1Writes:0,
 evidenceDigest:'a'.repeat(64),
};
const request={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-550eed72-331c-4cf4-a099-707e6450c1b2',
 chatId:'chat-w04-pit0605',operation:'employment-r6-candidate-stage-readonly',
 sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'codex/employment-1y-reader-r1',
 sourceSha:'a'.repeat(40),pit0605Raw:true};
const policy={sourceRepository:'ansqhd5774-Choi/zgmini',
 operations:{'employment-r6-candidate-stage-readonly':{}}};

test('PIT0605 request is explicit and cannot overlap PIT04 or add unrecognized keys',()=>{
 assert.equal(validateRequest(request,policy).pit0605Raw,true);
 assert.throws(()=>validateRequest({...request,pit04Offset:0},policy),/REQUEST_FIELDS/);
 assert.throws(()=>validateRequest({...request,pit0605Raw:false},policy),/PIT0605_FLAG_INVALID/);
 assert.throws(()=>validateRequest({...request,arbitraryPath:'C:/secret'},policy),/REQUEST_FIELDS/);
});
test('controller emits only count partition and attestation digest',()=>{
 const projection=projectPit0605Aggregate(raw);
 assert.equal(projection.missingHistoryKeys,2);
 assert.equal(Object.values(projection.counts).reduce((a,b)=>a+b,0),2);
 assert.equal(projection.repairAuthorized,false);
 assert.equal('sourceHash' in projection,false);
 assert.throws(()=>projectPit0605Aggregate({...raw,
  counts:{...classes,RAW_OBSERVATION_OR_REVISION_CONFLICT:2}}),/R6_PIT0605_REPORT_INVALID/);
});
test('PC Writer protected data root keeps private keys locally, not in projection',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'w04-pit0605-controller-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const home=path.join(temp,'data'),writer=path.join(home,'pc-writer'),
  output=path.join(temp,'sealed-output');
 fs.mkdirSync(writer,{recursive:true});fs.mkdirSync(output);
 const rows=[
  {logicalSeriesId:'STATE_INITIAL_CLAIMS',geographyCode:'AK',
   observationDate:'2025-07-26',sourceHash:'1'.repeat(64)},
  {logicalSeriesId:'STATE_INITIAL_CLAIMS',geographyCode:'AL',
   observationDate:'2025-07-26',sourceHash:'2'.repeat(64)},
 ];
 const digest=sha(JSON.stringify(rows)),aggregate=projectPit0605Aggregate({
  ...raw,evidenceDigest:digest});
 const bytes=JSON.stringify({kind:'PIT0605_PC_WORKSPACE_PRIVATE_V1',digest,rows})+'\n';
 fs.writeFileSync(path.join(output,'PIT0605_PRIVATE_KEY_EVIDENCE.json'),bytes);
 const retained=retainPit0605PrivateEvidence({
  outputDir:output,host:{dataRoot:home},request,aggregate});
 assert.equal(retained.privateEvidenceReadback,true);
 assert.equal(retained.evidenceFileSha256,sha(bytes));
 assert.equal(retained.evidenceFileRef.includes('pc-550eed72'),true);
 const persisted=path.join(writer,'pit-evidence','pit0605-'+request.requestId+'.json');
 assert.equal(fs.readFileSync(persisted,'utf8'),bytes);
 assert.equal(JSON.stringify(aggregate).includes('geographyCode'),false);
 assert.throws(()=>retainPit0605PrivateEvidence({
  outputDir:output,host:{dataRoot:home},request,aggregate}),/EEXIST/);
});
test('PC private writer refuses mismatched key evidence digest',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'w04-pit0605-invalid-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const home=path.join(temp,'data'),output=path.join(temp,'output');
 fs.mkdirSync(path.join(home,'pc-writer'),{recursive:true});fs.mkdirSync(output);
 fs.writeFileSync(path.join(output,'PIT0605_PRIVATE_KEY_EVIDENCE.json'),
  JSON.stringify({kind:'PIT0605_PC_WORKSPACE_PRIVATE_V1',
   digest:'b'.repeat(64),rows:[]}));
 assert.throws(()=>retainPit0605PrivateEvidence({
  outputDir:output,host:{dataRoot:home},request,
  aggregate:projectPit0605Aggregate(raw)}),/R6_PIT0605_PRIVATE_INVALID/);
});
