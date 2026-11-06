import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha,FILES,APPROVAL_SHA,SOURCE_ROOT,REPO,verifyRequest,verifyApproval,
 inspectSourceFile,inspectGit,collectSource,makeResult,resultText}
 from './export.mjs';
import {putPrivateFile} from './upload.mjs';

const names={
 'eia-calendar.mjs':'export const EIA_SOURCE_URLS={};export function parseEiaScheduleHtml(){} export function parseEiaWpsrCalendarJson(){}',
 'usda-calendar.mjs':'export const USDA_WASDE_URL="https://x";export function parseUsdaWasdeHtml(){}',
 'cftc-calendar.mjs':'export const CFTC_COT_URL="https://x";export function parseCftcCotHtml(){}',
 'treasury-calendar.mjs':'export const TREASURY_CUSIP_XML_URL="https://x";export function parseTreasuryCusipXml(){}',
 'tic-calendar.mjs':'export const TIC_RELEASE_DATES_URL="https://x";export function parseTicReleaseDatesHtml(){}'
};
const fixture=()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-source-b-test-'));
 fs.mkdirSync(path.join(dir,'lib'));
 for(const file of FILES)fs.writeFileSync(path.join(dir,file),names[path.basename(file)]);
 return dir;
};
const withFixture=fn=>{
 const dir=fixture();
 try{return fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}
};

test('five expected parsers are sized, hashed and stay in allowed root',()=>withFixture(dir=>{
 const files=FILES.map(rel=>inspectSourceFile(dir,rel));
 assert.equal(files.length,5);
 for(const file of files){
  assert.equal(file.sha256,sha(file.bytes));
  assert.ok(file.size>0&&file.size<=1_000_000);
 }
 assert.throws(()=>inspectSourceFile(dir,'lib/not-approved.mjs'),
  /CAL_SOURCE_B_PATH_SCOPE_STOP/);
}));

test('symlink is refused and original external file is never dereferenced',()=>withFixture(dir=>{
 const file=path.join(dir,'lib','tic-calendar.mjs');
 const external=path.join(dir,'other.mjs');
 fs.writeFileSync(external,names['tic-calendar.mjs']);
 fs.unlinkSync(file);
 fs.symlinkSync(external,file);
 assert.throws(()=>inspectSourceFile(dir,'lib/tic-calendar.mjs'),
  /CAL_SOURCE_B_SYMLINK_OR_TYPE_STOP/);
}));

test('hardcoded credential pattern and missing parser export both stop',()=>withFixture(dir=>{
 const file=path.join(dir,'lib','usda-calendar.mjs');
 fs.appendFileSync(file,'\nconst token="ghp_'+'A'.repeat(36)+'";');
 assert.throws(()=>inspectSourceFile(dir,'lib/usda-calendar.mjs'),
  /CAL_SOURCE_B_SECRET_PATTERN_STOP/);
 fs.writeFileSync(file,'export const USDA_WASDE_URL="https://x";');
 assert.throws(()=>inspectSourceFile(dir,'lib/usda-calendar.mjs'),
  /CAL_SOURCE_B_EXPECTED_EXPORT_STOP/);
}));

test('too-large parser is blocked before export',()=>withFixture(dir=>{
 fs.writeFileSync(path.join(dir,'lib','eia-calendar.mjs'),'a'.repeat(1_000_001));
 assert.throws(()=>inspectSourceFile(dir,'lib/eia-calendar.mjs'),
  /CAL_SOURCE_B_SIZE_TYPE_STOP/);
}));

test('Git HEAD, exact root and per-file provenance are collected',()=>withFixture(dir=>{
 const fake=(cmd,args)=>{
  assert.equal(cmd,'git');
  assert.equal(args[0],'-C');
  const command=args.slice(2).join(' ');
  const output=command==='rev-parse --verify HEAD'?'a'.repeat(40):
   command==='rev-parse --show-toplevel'?dir:
   command.startsWith('ls-files -- ')?command.slice('ls-files -- '.length):'';
  return {status:0,stdout:output,error:null};
 };
 const git=inspectGit(dir,FILES,fake);
 assert.equal(git.head,'a'.repeat(40));
 assert.ok(git.files.every(x=>x.tracked&&x.state==='TRACKED_CLEAN'));
 assert.equal(collectSource({root:dir,inspectProvenance:()=>git}).files.length,5);
 const wrong=()=>({status:0,stdout:'/different/root'});
 assert.throws(()=>inspectGit(dir,FILES,wrong),/CAL_SOURCE_B_GIT_HEAD_STOP/);
}));

test('approved B manifest is sha-pinned and tampered status fails closed',()=>{
 const bytes=fs.readFileSync(new URL('../approval.json',import.meta.url));
 assert.equal(sha(bytes),APPROVAL_SHA);
 assert.equal(verifyApproval(bytes).sourceRoot,SOURCE_ROOT);
 const m=JSON.parse(bytes);
 m.status='DRAFT_REQUIRES_EXACT_B_APPROVAL';
 assert.throws(()=>verifyApproval(Buffer.from(JSON.stringify(m)),
  sha(Buffer.from(JSON.stringify(m)))),/CAL_SOURCE_B_APPROVAL_SCOPE_STOP/);
 assert.throws(()=>verifyApproval(Buffer.from(JSON.stringify(m))),
  /CAL_SOURCE_B_APPROVAL_SHA_STOP/);
});

test('issue request exact auth scope rejects tampered manifest',()=>{
 const requestId='pc-calendar-parser-recovery-12345678-1234-4234-a234-1234567890ab';
 const chatId='chat-12345678-1234-4234-a234-1234567890ab';
 const controlSha='a'.repeat(40);
 const body={schema:'ZGMINI_CALENDAR_PARSER_SOURCE_RECOVERY_B_REQUEST_V1',
  requestId,chatId,operation:'calendar-parser-source-recovery-readonly-once',
  controlRepository:REPO,controlSha,approvalManifestSha256:APPROVAL_SHA};
 const event={action:'opened',repository:{private:true,full_name:REPO},
  sender:{login:'ansqhd5774-Choi'},issue:{title:'pc-calendar-parser-source-recovery-once',
   number:123,user:{login:'ansqhd5774-Choi'},
   labels:[{name:'pc-calendar-parser-source-recovery-b'}],body:JSON.stringify(body)}};
 const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:controlSha};
 assert.equal(verifyRequest(event,env).request.requestId,requestId);
 event.repository.private=false;
 assert.throws(()=>verifyRequest(event,env),/CAL_SOURCE_B_ISSUE_STOP/);
 event.repository.private=true;
 body.approvalManifestSha256='b'.repeat(64);
 event.issue.body=JSON.stringify(body);
 assert.throws(()=>verifyRequest(event,env),/CAL_SOURCE_B_SCOPE_STOP/);
});

test('sanitized result never contains raw parser bytes or tokens',()=>{
 const r=makeResult({requestId:'sample',status:'READY',files:[{
  relative:'lib/eia-calendar.mjs',bytes:Buffer.from('PRIVATE_SOURCE_DO_NOT_LOG'),
  size:24,sha256:'0'.repeat(64)}]});
 assert.ok(!JSON.stringify(r).includes('PRIVATE_SOURCE_DO_NOT_LOG'));
 assert.equal(r.runtimeSourceVerified,false);
 assert.equal(r.publicRepoWrites,false);
 assert.ok(!resultText(r).includes('PRIVATE_SOURCE_DO_NOT_LOG'));
});

test('private staging exact write/readback rejects changed remote content',async()=>{
 const bytes=Buffer.from('fixture parser source');
 let stored;
 const fake=async(url,opts)=>{
  if(opts.method==='PUT'){
   assert.equal(JSON.parse(opts.body).branch,'codex/calendar-parser-source-stage-20261107');
   stored=Buffer.from(JSON.parse(opts.body).content,'base64');
   return {status:201};
  }
  assert.ok(url.includes('?ref=codex%2Fcalendar-parser-source-stage-20261107'));
  if(stored)return {status:200,json:async()=>({encoding:'base64',content:stored.toString('base64')})};
  return {status:404};
 };
 const args={fetchImpl:fake,auth:{},api:'https://api.github.com/repos/private/control'};
 assert.equal(await putPrivateFile('results/a.mjs',bytes,args),'NEW_STAGED_VERIFIED');
 assert.equal(await putPrivateFile('results/a.mjs',bytes,args),'ALREADY_STAGED_VERIFIED');
 await assert.rejects(putPrivateFile('results/a.mjs',Buffer.from('different'),args),
  /CAL_SOURCE_B_REMOTE_CONTENT_CONFLICT_STOP/);
 await assert.rejects(putPrivateFile('results/a.mjs',bytes,{...args,branch:'main'}),
  /CAL_SOURCE_B_STAGE_BRANCH_SCOPE_STOP/);
});
