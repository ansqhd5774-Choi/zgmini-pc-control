import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectOriginalNov6InputVintage,inspectExtraEr1ArchiveCandidates,summarizeOriginalPriorActualContent,validIssue} from '../er1-nov30-saved-actual-audit.mjs';

const digest=arr=>createHash('sha256').update(JSON.stringify(arr)).digest('hex');
const EVENT_ENV={
  GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened'
};
const original474Request=()=>({
  schema:'ZGMINI_ER1_NOV30_ORIGINAL_COHORT_A_V1',
  operation:'original-cohort-read-only',
  originalIssueNumber:474,
  sourceSha:'a6dd77d19ccfcb79ddcdd0b4a6f495ec3888e24a',
  requestId:'pc-nov30-actual-550e8400-e29b-41d4-a716-446655440000',
  chatId:'chat-550e8400-e29b-41d4-a716-446655440001'
});
const original474Event=(req=original474Request())=>({
  action:'opened',
  issue:{title:'pc-er1-nov30-saved-actual-audit',
    labels:[{name:'pc-er1-approved'}],
    user:{login:'ansqhd5774-Choi'},body:JSON.stringify(req)}
});
function originalVintageFixture(t){
  const pcHome=fs.mkdtempSync(path.join(os.tmpdir(),'er1-nov-vintage-'));
  t.after(()=>fs.rmSync(pcHome,{recursive:true,force:true}));
  const root=path.join(pcHome,'er1-input','nov30-forward-days');
  fs.mkdirSync(root,{recursive:true});
  const historical=new Map();
  for(let i=1;i<=30;i++){
    const day='2026-11-'+String(i).padStart(2,'0');
    const rows=i===7?[{symbol:'ZZZ',name:'Fixture Z'}]:
      i===16?[{symbol:'AAA',name:'Fixture A'}]:[];
    const body={date:day,pre:rows,after:[],notSupplied:[]};
    if(i<=14)fs.writeFileSync(path.join(root,day+'.json'),
      JSON.stringify({storedAt:'2026-11-05T08:00:00.000Z',body}));
    else historical.set(day,{
      body,storedAt:Date.parse('2026-11-05T08:00:00.000Z'),
      snapshotKey:'2026-11-05'
    });
  }
  return {pcHome,root,historical};
}

test('original November source date-keyed vintages reconstruct 30/30 without current DB or GET',async t=>{
  const {pcHome,historical}=originalVintageFixture(t);
  let calls=0;
  const report=await inspectOriginalNov6InputVintage({
    pcHome,readDatedCore:day=>{calls++;return historical.get(day)??null}
  });
  assert.equal(report.validDays,30);
  assert.equal(report.privateDays,14);
  assert.equal(report.coreVintageDays,16);
  assert.equal(calls,16);
  assert.equal(report.candidateSymbols,2);
  assert.equal(report.collectorOrderedCandidateSetSha256,digest(['ZZZ','AAA']));
  assert.equal(report.original474CohortHashComparison,'MISMATCH');
  assert.equal(report.originalCohortCachedSymbols,null);
  assert.equal(report.providerCalls,0);
  assert.equal(report.coreWrites,0);
  assert.equal(report.d1Writes,0);
  assert.equal(JSON.stringify(report).includes('ZZZ'),false);
  assert.equal(JSON.stringify(report).includes('AAA'),false);
});

test('never substitute live current data when an original date-keyed Core row is missing',async t=>{
  const {pcHome,historical}=originalVintageFixture(t);
  historical.delete('2026-11-20');
  const report=await inspectOriginalNov6InputVintage({
    pcHome,readDatedCore:day=>historical.get(day)??null
  });
  assert.equal(report.validDays,29);
  assert.equal(report.missingDays,1);
  assert.equal(report.collectorOrderedCandidateSetSha256,null);
  assert.equal(report.original474CohortHashComparison,'NOT_EVALUATED');
  assert.equal(report.code,'NOV30_474_VINTAGE_INCOMPLETE');
});

test('post-collector and invalid day observations are rejected as historical evidence',async t=>{
  const {pcHome,root,historical}=originalVintageFixture(t);
  const file=path.join(root,'2026-11-07.json');
  const body=JSON.parse(fs.readFileSync(file,'utf8'));
  body.storedAt='2026-11-07T00:00:00.000Z';
  fs.writeFileSync(file,JSON.stringify(body));
  historical.set('2026-11-16',{
    ...historical.get('2026-11-16'),
    storedAt:Date.parse('2026-11-07T00:00:00.000Z')
  });
  const r=await inspectOriginalNov6InputVintage({
    pcHome,readDatedCore:day=>historical.get(day)??null
  });
  assert.equal(r.invalidDays,2);
  assert.equal(r.validDays,28);
  assert.equal(r.candidateSymbols,null);
  assert.equal(r.original474CohortHashComparison,'NOT_EVALUATED');
  assert.equal(r.providerCalls,0);
});

test('original vintage A request is fixed to #474 and cannot choose dates or sources',()=>{
  const fixed={...original474Request(),
    schema:'ZGMINI_ER1_NOV30_ORIGINAL_VINTAGE_A_V1',
    operation:'original-vintage-read-only'};
  const admitted=validIssue(original474Event(fixed),EVENT_ENV);
  assert.equal(admitted.inspectOriginalVintage,true);
  assert.equal(admitted.pinnedAsOf,'2026-11-06');
  for(const modified of [
    {asOf:'2026-11-07'}, {originalIssueNumber:473},
    {sourceSha:'0'.repeat(40)}, {operation:'private-collect'},
    {originalRunCutoff:'2026-11-07T00:00:00Z'}]){
    assert.throws(()=>validIssue(original474Event({...fixed,...modified}),EVENT_ENV),
      /NOV30_SAVED_AUDIT_CONTRACT_STOP/);
  }
  const legacy=validIssue(original474Event(original474Request()),EVENT_ENV);
  assert.equal(legacy.inspectOriginalVintage,false);
});

test('fixed #474 prior actual aggregates exclude null and post-as-of earnings',()=>{
  const history={kind:'READ',rows:[
    {date:'2026-11-04',eps:0,revenue:0},
    {date:'2026-11-05',eps:null,revenue:44},
    {date:'2026-11-01',eps:3,revenue:null},
    {date:'2026-11-06',eps:5,revenue:60},
    {date:'2026-11-20',eps:8,revenue:80}
  ]};
  assert.deepEqual(summarizeOriginalPriorActualContent(history),{
    epsRows:2,revenueRows:2,bothRows:1
  });
  assert.deepEqual(summarizeOriginalPriorActualContent({kind:'MISSING',rows:[]}),{
    epsRows:0,revenueRows:0,bothRows:0
  });
  assert.deepEqual(summarizeOriginalPriorActualContent({kind:'INVALID',rows:history.rows}),{
    epsRows:0,revenueRows:0,bothRows:0
  });
});

test('nearby raw scan finds only new matching original symbols, never duplicate files',t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'er1-nearby-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const input=path.join(home,'er1-input');fs.mkdirSync(input);
  const extra='nov30-legacy-symbol-history',known='dec31-symbol-batch-a';
  fs.mkdirSync(path.join(input,extra));fs.mkdirSync(path.join(input,known));
  const write=(dir,symbol,storedAt)=>{
    fs.writeFileSync(path.join(input,dir,symbol+'.json'),JSON.stringify({
      storedAt,body:[{symbol,date:'2026-11-03',eps:0,revenue:18}]
    }));
  };
  write(extra,'AAA','2026-11-05T02:00:00.000Z');
  write(extra,'BBB','2026-11-06T13:00:00.000Z');
  write(known,'BBB','2026-11-05T02:00:00.000Z');
  const x=inspectExtraEr1ArchiveCandidates(input,['AAA','BBB','CCC']);
  assert.equal(x.status,'PASS');
  assert.equal(x.inspectedFolders,1);
  assert.equal(x.candidateFiles,2);
  assert.equal(x.shapeValidFiles,2);
  assert.equal(x.extraOriginalSymbols,1);
  assert.equal(x.extraOriginalWithPriorBothActual,1);
  assert.equal(x.extraOriginalPreRunWithPriorBothActual,1);
  assert.equal(x.providerCalls,0);
  assert.equal(JSON.stringify(x).includes('AAA'),false);
  assert.equal(JSON.stringify(x).includes(extra),false);
});

test('nearby scan rejects malformed candidate, and bounds unsafe root inventory',t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'er1-nearby-invalid-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const input=path.join(home,'er1-input');fs.mkdirSync(input);
  const dir=path.join(input,'dec31-candidate-cache');fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'AAA.json'),'{"notRaw":true}');
  const x=inspectExtraEr1ArchiveCandidates(input,['AAA']);
  assert.equal(x.status,'PASS');
  assert.equal(x.invalidFiles,1);
  assert.equal(x.extraOriginalSymbols,0);
  assert.equal(inspectExtraEr1ArchiveCandidates(path.join(home,'absent'),['AAA']).status,
    'NOT_VERIFIED');
  for(let i=0;i<128;i++)
    fs.writeFileSync(path.join(input,'extra-'+i),'x');
  const bound=inspectExtraEr1ArchiveCandidates(input,['AAA']);
  assert.equal(bound.status,'PARTIAL');
  assert.equal(bound.code,'NEARBY_ARCHIVE_ROOT_LIMIT');
});
