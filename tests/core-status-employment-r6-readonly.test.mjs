import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
   {groupName:'DOL_UI_WEEKLY_CLAIMS',status:'FAIL',rawBody:'DO_NOT_TRANSFER'},
   {groupName:'UNKNOWN_GROUP',status:'SUCCESS'},
  ],
  plannedGroups:[
   {groupName:'DOL_UI_WEEKLY_CLAIMS',status:'DUE',due:true,
    releaseAt:'DO_NOT_TRANSFER'},
  ],
 },{employmentR6OneYear:{
  status:'PUBLISHED',asOfDate:'2026-11-09',sourceStoredAt:1794149721916,
  sourceFeatures:28,chartReadyFeatures:21,recentlyObservedFeatures:22,
  localResultHash:'DO_NOT_TRANSFER',
 }});
 const collection=view.checkpoints['local-collection-last-run.json'].employmentR6;
 assert.deepEqual(collection,{
  status:'PARTIAL',code:'EMPLOYMENT_R6_COLLECTION_FAILED',providerRequests:2,
  groups:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'FAIL'}],
  plannedGroups:[{groupName:'DOL_UI_WEEKLY_CLAIMS',status:'DUE',due:true}],
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
