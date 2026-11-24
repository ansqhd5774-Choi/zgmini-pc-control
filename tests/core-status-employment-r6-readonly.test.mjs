import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readCore} from '../controller/operations.mjs';

function fixture(t,collection,writer){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-core-status-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const dataRoot=path.join(temp,'data');
 const directory=path.join(dataRoot,'pc-writer');
 fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'local-collection-last-run.json'),
  JSON.stringify({status:'COMPLETE',employmentR6Collection:collection,
   secret:'DO_NOT_TRANSFER'}));
 fs.writeFileSync(path.join(directory,'local-writer-last-run.json'),
  JSON.stringify({status:'VERIFIED',...writer,privateRaw:'DO_NOT_TRANSFER'}));
 return readCore(dataRoot,{queryTask:()=>Buffer.from('fixed-task-xml'),
  retiredTaskEvidence:()=> 'APPROVED_RETIRED_ABSENT'});
}

test('core-status projects bounded R6 collection and publication evidence',t=>{
 const view=fixture(t,{
  status:'PARTIAL',providerRequests:2,code:'EMPLOYMENT_R6_COLLECTION_FAILED',
  groups:[
   {groupName:'DOL_UI_WEEKLY_CLAIMS',status:'FAIL',failureCode:'HTTP_403',providerRequests:1,rawBody:'DO_NOT_TRANSFER'},
   {groupName:'UNKNOWN_GROUP',status:'SUCCESS'},
  ],
  plannedGroups:[
   {groupName:'DOL_UI_WEEKLY_CLAIMS',status:'DUE',due:true,
    releaseAt:'DO_NOT_TRANSFER'},
   {groupName:'BLS_JOLTS',status:'CIRCUIT_OPEN',due:false,failureCode:'BLS_REQUEST_NOT_PROCESSED'},
  ],
 },{employmentR6OneYear:{
  status:'PUBLISHED',asOfDate:'2026-11-09',sourceStoredAt:1794149721916,
  sourceFeatures:28,chartReadyFeatures:21,recentlyObservedFeatures:22,
  localResultHash:'DO_NOT_TRANSFER',
 }});
 const collection=view.checkpoints['local-collection-last-run.json'].employmentR6;
 assert.deepEqual(collection,{
  status:'PARTIAL',code:'EMPLOYMENT_R6_COLLECTION_FAILED',providerRequests:2,
  groups:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'FAIL',failureCode:'HTTP_403',providerRequests:1}],
  plannedGroups:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'DUE',due:true},
   {groupName:'BLS_JOLTS',status:'CIRCUIT_OPEN',failureCode:'BLS_REQUEST_NOT_PROCESSED',due:false}],
 });
 const publication=view.checkpoints['local-writer-last-run.json'].employmentR6;
 assert.deepEqual(publication,{
  status:'PUBLISHED',failureCode:null,asOfDate:'2026-11-09',
  sourceStoredAt:1794149721916,sourceFeatures:28,chartReadyFeatures:21,
  recentlyObservedFeatures:22,
 });
 assert(!JSON.stringify(view).includes('DO_NOT_TRANSFER'));
});

test('core-status exposes only R6-scoped Writer failure code',t=>{
 const view=fixture(t,{status:'DISABLED',providerRequests:0,groups:[],plannedGroups:[]},{
  employmentR6OneYear:{status:'DISABLED'},
  failures:[
   {id:'other-output',reason:'OTHER_FAILURE'},
   {id:'employment-r6-one-year-publication',reason:'R6_PUBLICATION_MISSING'},
  ],
 });
 const result=view.checkpoints['local-writer-last-run.json'].employmentR6;
 assert.equal(result.status,'DISABLED');
 assert.equal(result.failureCode,'R6_PUBLICATION_MISSING');
 assert(!JSON.stringify(result).includes('OTHER_FAILURE'));
});

test('core-status excludes malformed R6 diagnostic fields and unknown groups',t=>{
 const view=fixture(t,{
  status:'FAIL',providerRequests:100001,
  groups:[
   {groupName:'DOL_UI_WEEKLY_CLAIMS',status:'FAIL',failureCode:'HTTP_403 https://token',providerRequests:-1},
   {groupName:'BLS_JOLTS',status:'PARTIAL',failureCode:'NO_OBSERVATIONS',providerRequests:2},
   {groupName:'UNAPPROVED',status:'FAIL',failureCode:'SECRET'},
  ],
  plannedGroups:[{groupName:'BLS_ECI',status:'CIRCUIT_OPEN',due:false,failureCode:'BLS_REQUEST_NOT_PROCESSED'}],
 },{});
 const c=view.checkpoints['local-collection-last-run.json'].employmentR6;
 assert.equal(c.providerRequests,null);
 assert.deepEqual(c.groups,[
  {groupName:'DOL_UI_WEEKLY_CLAIMS',status:'FAIL'},
  {groupName:'BLS_JOLTS',status:'PARTIAL',failureCode:'NO_OBSERVATIONS',providerRequests:2},
 ]);
 assert.deepEqual(c.plannedGroups,[
  {groupName:'BLS_ECI',status:'CIRCUIT_OPEN',failureCode:'BLS_REQUEST_NOT_PROCESSED',due:false},
 ]);
 assert(!JSON.stringify(view).includes('https://token'));
 assert(!JSON.stringify(view).includes('UNAPPROVED'));
});

test('core-status verifies stored R6 public-result checksum without leaking body or raw input',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-checksum-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const dataRoot=path.join(temp,'data'),pc=path.join(dataRoot,'pc-writer');
 const results=path.join(pc,'employment-r6-public-results');
 fs.mkdirSync(results,{recursive:true});
 const body={kind:'EMPLOYMENT_R6_ONE_YEAR_STORED_DISPLAY_R1',
  asOfDate:'2026-11-20',sourceStoredAt:1795124109099,
  methodologyVersion:'EMP-R6-FORMULA-R2-CPS-2025-10',formulaHash:'sha256:'+'a'.repeat(64),
  indicators:Array.from({length:29},(_,i)=>({id:'F'+i,status:'READY'})),
  secret:'PRIVATE_RAW_PAYLOAD_NOT_FOR_CONTROLLER'};
 const hash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 const resultFile=path.join(results,hash+'.json');
 fs.writeFileSync(resultFile,JSON.stringify(body));
 fs.writeFileSync(path.join(pc,'local-writer-last-run.json'),JSON.stringify({
  status:'VERIFIED',employmentR6OneYear:{
   status:'PUBLISHED',asOfDate:body.asOfDate,
   sourceStoredAt:body.sourceStoredAt,localResultHash:hash,localResultStored:true,
   sourceFeatures:29,chartReadyFeatures:23,recentlyObservedFeatures:23
  }
 }));
 const read=()=>readCore(dataRoot,{queryTask:()=>Buffer.from('fixture-task'),
  retiredTaskEvidence:()=> 'APPROVED_RETIRED_ABSENT'})
 const verified=read().checkpoints['local-writer-last-run.json'].employmentR6;
 assert.equal(verified.localResultReadback,'VERIFIED');
 assert.equal(verified.methodologyVersion,'EMP-R6-FORMULA-R2-CPS-2025-10');
 assert.equal(verified.formulaHash,'sha256:'+'a'.repeat(64));
 assert.equal(verified.localResultHash,hash);
 assert.equal(verified.sourceStoredAt,1795124109099);
 assert.equal(verified.localResultStored,true);
 assert(!JSON.stringify(verified).includes('PRIVATE_RAW_PAYLOAD'));
 fs.writeFileSync(resultFile,JSON.stringify({...body,secret:'TAMPERED'}));
 assert.equal(read().checkpoints['local-writer-last-run.json'].employmentR6.localResultReadback,'HASH_MISMATCH');
 fs.writeFileSync(resultFile,JSON.stringify({...body,methodologyVersion:null}));
 const alteredHash=createHash('sha256').update(JSON.stringify({...body,methodologyVersion:null})).digest('hex');
 const mismatchedCheckpoint=read().checkpoints['local-writer-last-run.json'].employmentR6;
 assert.equal(mismatchedCheckpoint.localResultReadback,'HASH_MISMATCH');
 assert.equal(mismatchedCheckpoint.methodologyVersion,undefined);
 fs.unlinkSync(resultFile);
 assert.equal(read().checkpoints['local-writer-last-run.json'].employmentR6.localResultReadback,'MISSING');
});

test('core-status retains canonical R6 release and retry timestamps without raw-body exposure',t=>{
 const view=fixture(t,{
  status:'NOOP',providerRequests:0,groups:[],
  plannedGroups:[
   {groupName:'DOL_UI_WEEKLY_CLAIMS',status:'CIRCUIT_OPEN',
    due:false,failureCode:'DOL_RELEASE_OBSERVATION_STALE',
    retryAt:'2026-11-24T13:50:37.666Z',
    providerResponse:'PRIVATE_RAW_BODY_NEVER_EXPORT'},
   {groupName:'BLS_JOLTS',status:'RELEASE_ALREADY_STORED',due:false,
    releaseAt:'2026-11-24T13:00:00.000Z',
    collectAt:'2026-11-24T13:10:00.000Z'},
   {groupName:'BLS_ECI',status:'CIRCUIT_OPEN',due:false,
    retryAt:'2026-11-24T13:50:37Z',
    releaseAt:'2026-02-30T13:00:00.000Z',
    collectAt:'2026-11-24T13:10:00+00:00',
    rawToken:'PRIVATE_TOKEN_NEVER_EXPORT'},
   {groupName:'BLS_BED',status:'WAITING_FOR_COLLECTION_WINDOW',due:false,
    retryAt:'https://example.com/secret?token=LEAK',
    releaseAt:'2026-11-24T14:00:00.000Z',
    collectAt:'2026-11-24T14:10:00.000Z'},
  ],
 },{});
 const actual=view.checkpoints['local-collection-last-run.json'].employmentR6;
 assert.deepEqual(actual.plannedGroups,[
  {groupName:'DOL_UI_WEEKLY_CLAIMS',status:'CIRCUIT_OPEN',
   failureCode:'DOL_RELEASE_OBSERVATION_STALE',due:false,
   retryAt:'2026-11-24T13:50:37.666Z'},
  {groupName:'BLS_JOLTS',status:'RELEASE_ALREADY_STORED',
   due:false,releaseAt:'2026-11-24T13:00:00.000Z',
   collectAt:'2026-11-24T13:10:00.000Z'},
  {groupName:'BLS_ECI',status:'CIRCUIT_OPEN',due:false},
  {groupName:'BLS_BED',status:'WAITING_FOR_COLLECTION_WINDOW',
   due:false,releaseAt:'2026-11-24T14:00:00.000Z',
   collectAt:'2026-11-24T14:10:00.000Z'},
 ]);
 assert.equal(actual.providerRequests,0);
 assert.doesNotMatch(JSON.stringify(view),/PRIVATE_RAW_BODY|PRIVATE_TOKEN|LEAK|example\\.com/);
});


test('R6 row-change counter projection retains bounded real zero and positive counts',t=>{
 const report=fixture(t,{status:'SUCCESS',providerRequests:2,
  groups:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'SUCCESS',providerRequests:2,
   collectedRows:31000,inserted:0,revised:1,noop:30999,rejected:0,
   historyRowsAdded:1,rawSnapshots:2,rawSnapshotNoops:1,
   runId:'DO_NOT_TRANSFER',rawBody:'DO_NOT_TRANSFER'}],
  plannedGroups:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'RELEASE_ALREADY_STORED',
    due:false,collectedRows:55,inserted:8}]},{}).checkpoints['local-collection-last-run.json'].employmentR6;
 assert.deepEqual(report.groups,[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'SUCCESS',providerRequests:2,
  collectedRows:31000,inserted:0,revised:1,noop:30999,rejected:0,
  historyRowsAdded:1,rawSnapshots:2,rawSnapshotNoops:1}]);
 assert.deepEqual(report.plannedGroups,[{groupName:'DOL_UI_WEEKLY_CLAIMS',
  status:'RELEASE_ALREADY_STORED',due:false}]);
 assert(!JSON.stringify(report).includes('DO_NOT_TRANSFER'));
});

test('R6 row-change counter projection refuses missing invalid and unbounded values',t=>{
 const report=fixture(t,{status:'PARTIAL',providerRequests:0,
  groups:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'PARTIAL',
   collectedRows:0,inserted:-1,revised:1.5,noop:'0',rejected:NaN,
   historyRowsAdded:1000001,rawSnapshots:1,rawSnapshotNoops:undefined,
   extra:'PRIVATE_KEY_NOT_FOR_OUTPUT'}],plannedGroups:[]},{}).checkpoints['local-collection-last-run.json'].employmentR6;
 assert.deepEqual(report.groups,[{groupName:'DOL_UI_WEEKLY_CLAIMS',
  status:'PARTIAL',collectedRows:0,rawSnapshots:1}]);
 assert(!JSON.stringify(report).includes('PRIVATE_KEY_NOT_FOR_OUTPUT'));
});
