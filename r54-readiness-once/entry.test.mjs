import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspect,validateRequest,TITLE,SCHEMA,REPO,OWNER,TASK_NAMES} from './entry.mjs';

const id='12345678-1234-4123-8123-123456789abc';
const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:OWNER,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_SHA:'a'.repeat(40)};
const request={schema:SCHEMA,operation:'r54-readiness-readonly-once',
 requestId:'pc-theme-r54-readiness-'+id,chatId:'chat-'+id,controlSha:env.GITHUB_SHA};
const event={action:'opened',repository:{private:true,full_name:REPO},issue:{number:301,
 user:{login:OWNER},title:TITLE,labels:[],body:JSON.stringify(request)}};

test('exact issue and immutable request are accepted',()=>{
 assert.deepEqual(validateRequest(event,env),request);
});
test('request cannot choose operation or source',()=>{
 const replaced={...request,operation:'shell'};
 assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify(replaced)}},env),
  /R54_READINESS_REQUEST_DENIED/);
 const extra={...request,command:'schtasks /Delete'};
 assert.throws(()=>validateRequest({...event,issue:{...event.issue,body:JSON.stringify(extra)}},env),
  /R54_READINESS_REQUEST_DENIED/);
});
test('task failure is isolated and does not mask other task results',()=>{
 const seen=[];
 const r=inspect({freeMiB:1488,dataRoot:'R54-fixture',
  taskQuery:name=>{seen.push(name);if(name===TASK_NAMES[1]){
   const error=Object.assign(new Error('not found'),{status:1});throw error;
  }return Buffer.from('<Task/>');},
  list:()=>[]});
 assert.deepEqual(seen,TASK_NAMES);
 assert.equal(r.tasks[0].found,true);
 assert.equal(r.tasks[1].found,false);
 assert.equal(r.tasks[1].exitCode,1);
 assert.equal(r.tasks[2].found,true);
 assert.equal(r.freeMiB,1488);
});
test('observation contains no raw XML or error stderr',()=>{
 const r=inspect({freeMiB:1700,dataRoot:'R54-fixture',
  taskQuery:name=>{if(name===TASK_NAMES[2])throw Object.assign(new Error('secret'),{status:1,stderr:'secret'});
   return Buffer.from('<Task><Password>secret</Password></Task>');},
  list:()=>[]});
 const body=JSON.stringify(r);
 assert.equal(body.includes('<Task>'),false);
 assert.equal(body.includes('secret'),false);
});

test('installed R54, R47 report and raw manifests are observed only by hash and dates',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-readonly-proof-'));
 try{
  const write=(relative,content)=>{
   const p=path.join(root,relative);
   fs.mkdirSync(path.dirname(p),{recursive:true});
   fs.writeFileSync(p,content);return p;
  };
  const script='// legacy installed revision; SECRET_MUST_NOT_LEAK';
  write('pc-writer/theme-nine-r54/scripts/pc-writer/theme-nine-r54-public-connect.mjs',script);
  write('pc-writer/theme-nine-r54/scripts/pc-writer/THEME_NINE_R54_PUBLIC_CYCLE.cmd','@echo off');
  write('pc-writer/theme-nine-r48/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd','@echo off');
  write('themes/legacy-nine-r23/raw-manifest.json',JSON.stringify({files:[]}));
  write('themes/legacy-nine-r35-delta/raw-manifest.json',JSON.stringify({files:[
   {symbol:'SPY',lastVerifiedNYDay:'2026-10-30'}]}));
  write('pc-writer/theme-nine-r48/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE_1_2.json',
   JSON.stringify({status:'PRIVATE_SAVED',freshness:{targetClosedNYDay:'2026-11-03',
    lastVerifiedSpyNYDay:'2026-10-30'},raw:'SECRET_MUST_NOT_LEAK'}));
  write('pc-writer/theme-nine-r54/logs/THEME_NINE_R54_CYCLE_1_2.txt',
   'SECRET_MUST_NOT_LEAK\nTHEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT\nRESULT=STOP_OR_PENDING_REVIEW_TXT\n');
  const result=inspect({dataRoot:root,freeMiB:900,taskQuery:()=>'<Task/>',list:fs.readdirSync});
  assert.equal(result.sourceLineage.installed.r54Connect.sha256,
   createHash('sha256').update(script).digest('hex'));
  assert.equal(result.sourceLineage.manifests.r35.latestSpyDay,'2026-10-30');
  assert.equal(result.sourceLineage.recentRuns.r47.files[0].detail.targetClosedNYDay,'2026-11-03');
  assert.deepEqual(result.sourceLineage.recentRuns.r54.files[0].detail.errors,
   ['THEME_NINE_R54_SOURCE_MANIFEST_SHA_DRIFT']);
  assert.equal(JSON.stringify(result).includes('SECRET_MUST_NOT_LEAK'),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
