import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateRequest} from '../controller/common.mjs';
import {retainPit0408PrivateEvidence} from '../controller/employment-r6-candidate-readonly.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const req={schema:'ZGMINI_PC_JOB_V1',
 requestId:'pc-5a30cb3d-e4bc-4ac9-b8d1-a35370dc9658',
 chatId:'chat-w04-pit0408-ledger-20261120',
 operation:'employment-r6-candidate-stage-readonly',
 sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'codex/employment-1y-reader-r1',sourceSha:'a'.repeat(40),
 pit04Offset:0,pit0408Private:true};
const policy={sourceRepository:'ansqhd5774-Choi/zgmini',
 operations:{'employment-r6-candidate-stage-readonly':{}}};
const counts={coreKeys:4,coreHistoryMissing:2,coreHistoryConflict:0,
 coreHistoryAmbiguous:0,candidateOverlapConflicts:1,
 missingCandidateInternalMatch:1,missingCandidateIncomplete:0,
 missingWithoutCandidate:1,duplicateCurrentKeys:0};
function key(geo,reason,missing,conflict=false){
 return {logicalSeriesId:'STATE_INITIAL_CLAIMS',geographyCode:geo,
  observationDate:'2026-11-07',reason,coreHistoryMissing:missing,
  candidateCurrentConflict:conflict,rawPitAttested:false,repairAuthorized:false};
}
const rows=[
 key('CA','CANDIDATE_CURRENT_CONFLICT',false,true),
 key('NV','MISSING_HISTORY_NO_CANDIDATE',true),
 key('AK','MISSING_HISTORY_CANDIDATE_INTERNAL_MATCH_ONLY',true),
];
const conflict=[
 {logicalSeriesId:'STATE_INITIAL_CLAIMS',geographyType:'STATE',
  geographyCode:'CA',observationDate:'2026-11-07',reason:'CANDIDATE_CURRENT_CONFLICT'},
 {logicalSeriesId:'NATIONAL_INITIAL_CLAIMS',geographyType:'COUNTRY',
  geographyCode:'US',observationDate:'2026-11-07',reason:'CANDIDATE_CURRENT_CONFLICT'},
];
const asOfDate='2026-11-19';
const keyReview={counts,evidenceTotal:3,evidence:rows,asOfDate};
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'w04-pit0408-proof-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const root=path.join(dir,'data'),writer=path.join(root,'pc-writer');
 const outputDir=path.join(dir,'sealed');
 fs.mkdirSync(writer,{recursive:true});fs.mkdirSync(outputDir);
 const host={dataRoot:root};
 const ledger={schema:'W04_PIT0408_PRIVATE_KEYS_V1',asOfDate,
  coreStateKeyCount:4,counts,evidence:rows,
  allSeriesCandidateCurrentConflicts:conflict,
  rawPitAttested:false,repairAuthorized:false};
 return {dir,root,outputDir,host,ledger};
}
function write(f,ledger){
 const digest=sha(JSON.stringify(ledger));
 const bytes=JSON.stringify({kind:'PIT0408_PC_WORKSPACE_PRIVATE_V1',digest,ledger})+'\n';
 fs.writeFileSync(path.join(f.outputDir,'PIT0408_PRIVATE_KEY_EVIDENCE.json'),bytes);
 return {digest,bytes};
}
test('PIT0408 private request is strictly offset-zero opt-in',()=>{
 assert.equal(validateRequest(req,policy).pit0408Private,true);
 assert.throws(()=>validateRequest({...req,pit04Offset:8},policy),/REQUEST_FIELDS/);
 assert.throws(()=>validateRequest({...req,pit0408Private:false},policy),/PIT0408_PRIVATE_FLAG_INVALID/);
 assert.throws(()=>validateRequest({...req,pit0605Raw:true},policy),/REQUEST_FIELDS/);
 assert.throws(()=>validateRequest({...req,outputFile:'C:/private'},policy),/REQUEST_FIELDS/);
});
test('Controller verifies full private key ledger and 2 distinct cross-series overlaps',t=>{
 const f=fixture(t),written=write(f,f.ledger);
 const r=retainPit0408PrivateEvidence({outputDir:f.outputDir,
  host:f.host,request:req,keyReview,allSeriesConflicts:2});
 assert.equal(r.pit04PrivateEvidenceDigest,written.digest);
 assert.equal(r.evidenceFileSha256,sha(written.bytes));
 assert.equal(r.privateEvidenceReadback,true);
 assert.equal(r.evidenceFileRef,'PC_WRITER_PIT_EVIDENCE/pit0408-'+req.requestId+'.json');
 assert.equal(fs.readFileSync(path.join(f.root,'pc-writer','pit-evidence',
  'pit0408-'+req.requestId+'.json'),'utf8'),written.bytes);
 assert.equal(JSON.stringify(r).includes('geographyCode'),false);
 assert.throws(()=>retainPit0408PrivateEvidence({outputDir:f.outputDir,
  host:f.host,request:req,keyReview,allSeriesConflicts:2}),/EEXIST/);
});
test('Controller blocks mismatch of all-series conflict count or duplicate key',t=>{
 const f=fixture(t);write(f,f.ledger);
 assert.throws(()=>retainPit0408PrivateEvidence({outputDir:f.outputDir,
  host:f.host,request:req,keyReview,allSeriesConflicts:14}),/R6_PIT0408_PRIVATE_INVALID/);
 f.ledger.evidence=[rows[0],rows[0],rows[2]];
 write(f,f.ledger);
 assert.throws(()=>retainPit0408PrivateEvidence({outputDir:f.outputDir,
  host:f.host,request:req,keyReview,allSeriesConflicts:2}),/R6_PIT0408_PRIVATE_DUPLICATE/);
});
test('Controller refuses altered source digest and leaked extra fields',t=>{
 const f=fixture(t);const written=write(f,f.ledger);
 const file=path.join(f.outputDir,'PIT0408_PRIVATE_KEY_EVIDENCE.json');
 fs.writeFileSync(file,JSON.stringify({kind:'PIT0408_PC_WORKSPACE_PRIVATE_V1',
  digest:'f'.repeat(64),ledger:f.ledger})+'\n');
 assert.throws(()=>retainPit0408PrivateEvidence({outputDir:f.outputDir,
  host:f.host,request:req,keyReview,allSeriesConflicts:2}),/R6_PIT0408_PRIVATE_INVALID/);
 const extra={...f.ledger,evidence:[{...rows[0],sourceHash:'a'.repeat(64)},rows[1],rows[2]]};
 write(f,extra);
 assert.throws(()=>retainPit0408PrivateEvidence({outputDir:f.outputDir,
  host:f.host,request:req,keyReview,allSeriesConflicts:2}),/R6_PIT0408_PRIVATE_ROW_INVALID/);
 assert.notEqual(written.digest,'f'.repeat(64));
});
