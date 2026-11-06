// One-shot historical source export. Only approved GitHub issue context can
// invoke runLive. NEVER edits the PC checkout, writer, DB or scheduler.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const STAGE_BRANCH='codex/calendar-parser-source-stage-20261107';
const TITLE='pc-calendar-parser-source-recovery-once';
const LABEL='pc-calendar-parser-source-recovery-b';
export const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const FILES=['lib/eia-calendar.mjs','lib/usda-calendar.mjs',
 'lib/cftc-calendar.mjs','lib/treasury-calendar.mjs','lib/tic-calendar.mjs'];
// SHA256 of this package's DRAFT approval.json. An operator must explicitly
// approve, update status and re-pin the new SHA before live use.
export const APPROVAL_SHA='49fc7f7daf6d027426f575e515d75b57074891b906f106c934ffed623019b367';
export const RESULT_NAME='calendar-parser-recovery-result.json';
const CAPSULE='private-parser-capsule';
const HASH40=/^[a-f0-9]{40}$/;
const HASH64=/^[a-f0-9]{64}$/;
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQ=new RegExp('^pc-calendar-parser-recovery-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const expectedExports={
 'eia-calendar.mjs':['EIA_SOURCE_URLS','parseEiaScheduleHtml','parseEiaWpsrCalendarJson'],
 'usda-calendar.mjs':['USDA_WASDE_URL','parseUsdaWasdeHtml'],
 'cftc-calendar.mjs':['CFTC_COT_URL','parseCftcCotHtml'],
 'treasury-calendar.mjs':['TREASURY_CUSIP_XML_URL','parseTreasuryCusipXml'],
 'tic-calendar.mjs':['TIC_RELEASE_DATES_URL','parseTicReleaseDatesHtml']
};
const fail=code=>{throw Error(code);};
const need=(okay,code)=>{if(!okay)fail(code);};
export const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
export const errorCode=err=>/^CAL_SOURCE_B_[A-Z0-9_]+$/.test(err?.message??'')?
 err.message:'CAL_SOURCE_B_UNEXPECTED_STOP';

export function verifyRequest(event,env){
 need(env.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  env.GITHUB_RUN_ATTEMPT==='1'&&HASH40.test(env.GITHUB_SHA??''),
  'CAL_SOURCE_B_EVENT_STOP');
 const issue=event?.issue;
 need(event?.action==='opened'&&event.repository?.private===true&&
  event.repository.full_name===REPO&&event.sender?.login===env.GITHUB_ACTOR&&
  issue?.user?.login===env.GITHUB_ACTOR&&issue.title===TITLE&&
  Number.isSafeInteger(issue.number)&&issue.number>0&&!issue.pull_request&&
  issue.labels?.some(x=>x.name===LABEL),'CAL_SOURCE_B_ISSUE_STOP');
 need(typeof issue.body==='string'&&Buffer.byteLength(issue.body)<=4096,
  'CAL_SOURCE_B_ISSUE_BODY_STOP');
 let q;try{q=JSON.parse(issue.body);}catch{fail('CAL_SOURCE_B_ISSUE_JSON_STOP');}
 need(exact(q,['schema','requestId','chatId','operation','controlRepository',
  'controlSha','approvalManifestSha256'])&&
  q.schema==='ZGMINI_CALENDAR_PARSER_SOURCE_RECOVERY_B_REQUEST_V1'&&
  REQ.test(q.requestId??'')&&CHAT.test(q.chatId??'')&&
  q.operation==='calendar-parser-source-recovery-readonly-once'&&
  q.controlRepository===REPO&&q.controlSha===env.GITHUB_SHA&&
  q.approvalManifestSha256===APPROVAL_SHA&&HASH64.test(APPROVAL_SHA),
  'CAL_SOURCE_B_SCOPE_STOP');
 return {request:q,issueNumber:issue.number};
}

export function verifyApproval(bytes,expectedSha=APPROVAL_SHA){
 need(Buffer.isBuffer(bytes)&&HASH64.test(expectedSha)&&sha(bytes)===expectedSha,
  'CAL_SOURCE_B_APPROVAL_SHA_STOP');
 let m;try{m=JSON.parse(bytes.toString('utf8'));}catch{fail('CAL_SOURCE_B_APPROVAL_JSON_STOP');}
 need(exact(m,['schema','status','scope','sourceRoot','paths','maxBytesEach',
  'privateControlRepository','stagingBranch','publication','operationalWrites','schedulerChanges',
  'runtimeClaim'])&&
  m.schema==='ZGMINI_CALENDAR_PARSER_SOURCE_RECOVERY_B_APPROVAL_V1'&&
  m.status==='APPROVED_B_SOURCE_READONLY_EXPORT_ONCE'&&
  m.scope==='READ_FIVE_FIXED_HISTORICAL_PARSER_FILES_AND_STAGE_ONLY_TO_PRIVATE_CONTROL'&&
  m.sourceRoot===SOURCE_ROOT&&JSON.stringify(m.paths)===JSON.stringify(FILES)&&
  m.maxBytesEach===1_000_000&&m.privateControlRepository===REPO&&
  m.stagingBranch===STAGE_BRANCH&&
  m.publication==='PRIVATE_CONTROL_STAGING_ONLY_NO_PUBLIC_REPO_WRITE'&&
  m.operationalWrites===false&&m.schedulerChanges===false&&
  m.runtimeClaim==='HISTORICAL_CHECKOUT_ONLY_NOT_VERIFIED_LIVE_RUNTIME',
  'CAL_SOURCE_B_APPROVAL_SCOPE_STOP');
 return m;
}

const secretChecks=[
 /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
 /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
 /\bgithub_pat_[A-Za-z0-9_]{25,}\b/,
 /\bAKIA[0-9A-Z]{16}\b/,
 /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/,
 /(?:authorization\s*[:=]\s*['"`]Bearer\s+[A-Za-z0-9._-]{20,}['"`])/i
];

/** Fixture-friendly; runLive always passes the compiled fixed five paths. */
export function inspectSourceFile(root,relative){
 need(FILES.includes(relative),'CAL_SOURCE_B_PATH_SCOPE_STOP');
 const target=path.join(root,...relative.split('/'));
 try{
  // Refuse junctions/symlinks on the root and every descendant component.
  let cursor=root;
  for(const part of ['',...relative.split('/')]){
   if(part)cursor=path.join(cursor,part);
   const st=fs.lstatSync(cursor);
   need(!st.isSymbolicLink()&&(part?st.isFile()||st.isDirectory():st.isDirectory()),
    'CAL_SOURCE_B_SYMLINK_OR_TYPE_STOP');
  }
  const stat=fs.lstatSync(target);
  need(stat.isFile()&&stat.size>0&&stat.size<=1_000_000,
   'CAL_SOURCE_B_SIZE_TYPE_STOP');
  const native=fs.realpathSync.native(root),actual=fs.realpathSync.native(target);
  const normalized=process.platform==='win32'?(s=>s.toLowerCase()):(s=>s);
  need(normalized(actual).startsWith(normalized(native+path.sep)),
   'CAL_SOURCE_B_ESCAPE_STOP');
  const bytes=fs.readFileSync(target);
  need(bytes.length===stat.size&&!bytes.includes(0),
   'CAL_SOURCE_B_BINARY_OR_RACE_STOP');
  const source=bytes.toString('utf8');
  need(!source.includes('\uFFFD'),'CAL_SOURCE_B_ENCODING_STOP');
  need(!secretChecks.some(rx=>rx.test(source)),'CAL_SOURCE_B_SECRET_PATTERN_STOP');
  for(const symbol of expectedExports[path.basename(relative)]){
   const rx=new RegExp('\\bexport\\s+(?:const|let|var|function|async\\s+function|class)\\s+'+symbol+'\\b|\\bexport\\s*\\{[^}]*\\b'+symbol+'\\b','m');
   need(rx.test(source),'CAL_SOURCE_B_EXPECTED_EXPORT_STOP');
  }
  const after=fs.lstatSync(target);
  need(after.size===stat.size&&after.mtimeMs===stat.mtimeMs,
   'CAL_SOURCE_B_FILE_CHANGED_STOP');
  return {relative,bytes,sha256:sha(bytes),size:bytes.length};
 }catch(err){
  if(/^CAL_SOURCE_B_/.test(err?.message??''))throw err;
  fail('CAL_SOURCE_B_FILE_UNAVAILABLE_STOP');
 }
}

export function inspectGit(root,paths=FILES,runner=spawnSync){
 const call=(...args)=>{
  const p=runner('git',['-C',root,...args],{encoding:'utf8',timeout:15000,
   windowsHide:true,maxBuffer:8192});
  need(!p.error&&p.status===0&&typeof p.stdout==='string'&&p.stdout.length<=8192,
   'CAL_SOURCE_B_GIT_PROVENANCE_STOP');
  return p.stdout.replace(/[\r\n]+$/g,'');
 };
 const head=call('rev-parse','--verify','HEAD').trim();
 need(HASH40.test(head),'CAL_SOURCE_B_GIT_HEAD_STOP');
 const top=call('rev-parse','--show-toplevel').trim();
 const normalize=s=>process.platform==='win32'?path.win32.normalize(s).toLowerCase():path.resolve(s);
 need(normalize(top)===normalize(root),'CAL_SOURCE_B_GIT_ROOT_STOP');
 const files=paths.map(relative=>{
  const listed=call('ls-files','--',relative);
  need(listed===''||listed===relative,'CAL_SOURCE_B_GIT_INDEX_STOP');
  const status=call('status','--short','--untracked-files=all','--',relative);
  need(status.length<=512&&!status.includes('\n'),'CAL_SOURCE_B_GIT_STATUS_STOP');
  return {path:relative,tracked:listed===relative,
   state:listed===relative?(status?'TRACKED_MODIFIED':'TRACKED_CLEAN'):'UNTRACKED',
   gitStatusCode:status?status.slice(0,2):'  '};
 });
 return {head,worktreeRootVerified:true,files};
}

// Export only when all five files and Git provenance pass. No operational writes.
export function collectSource({root=SOURCE_ROOT,inspect=inspectSourceFile,
 inspectProvenance=inspectGit}={}){
 const files=FILES.map(rel=>inspect(root,rel));
 need(files.every((f,i)=>f.relative===FILES[i]&&Buffer.isBuffer(f.bytes)&&
  f.size===f.bytes.length&&f.sha256===sha(f.bytes)),
  'CAL_SOURCE_B_COLLECT_INTEGRITY_STOP');
 const git=inspectProvenance(root,FILES);
 need(HASH40.test(git.head)&&git.worktreeRootVerified&&git.files?.length===5,
  'CAL_SOURCE_B_COLLECT_GIT_STOP');
 return {files,git};
}

export function makeResult({requestId='unknown',controlSha='unknown',status='BLOCKED',
 code='CAL_SOURCE_B_NOT_STARTED',issueNumber,git,files}={}){
 const r={schema:'ZGMINI_CALENDAR_PARSER_SOURCE_RECOVERY_B_RESULT_V1',
  requestId,status,code,controlSha,sourceEvidence:'HISTORICAL_CHECKOUT_ONLY',
  runtimeSourceVerified:false,operationalWrites:false,publicRepoWrites:false,
  retry:'NO_EXPORT_REEXECUTION_ON_UNKNOWN'};
 if(Number.isSafeInteger(issueNumber))r.issueNumber=issueNumber;
 if(git)r.git={head:git.head,worktreeRootVerified:true,files:git.files};
 if(files)r.files=files.map(f=>({path:f.relative,sha256:f.sha256,size:f.size}));
 return r;
}

export function runLive(env=process.env){
 let result=makeResult({controlSha:HASH40.test(env.GITHUB_SHA??'')?env.GITHUB_SHA:'unknown'});
 try{
  need(process.platform==='win32'&&env.GITHUB_EVENT_PATH&&env.RUNNER_TEMP,
   'CAL_SOURCE_B_WINDOWS_RUNNER_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const {request,issueNumber}=verifyRequest(event,env);
  result=makeResult({requestId:request.requestId,issueNumber,
   controlSha:env.GITHUB_SHA});
  verifyApproval(fs.readFileSync(path.join(HERE,'..','approval.json')));
  const {files,git}=collectSource();
  // Create private bytes only in runner TEMP after complete validation.
  const stage=path.join(env.RUNNER_TEMP,CAPSULE+'-'+request.requestId);
  fs.mkdirSync(stage,{recursive:false});
  for(const f of files)fs.writeFileSync(path.join(stage,path.basename(f.relative)),
   f.bytes,{flag:'wx',mode:0o600});
  result=makeResult({requestId:request.requestId,issueNumber,
   controlSha:env.GITHUB_SHA,status:'READY',code:'CAL_SOURCE_B_FIVE_FILES_STAGED_PRIVATE',git,files});
 }catch(err){
  result={...result,status:'BLOCKED',code:errorCode(err)};
 }
 return result;
}

export function resultText(result){
 return ['STATUS='+result.status,'CODE='+result.code,
  'REQUEST_ID='+result.requestId,'FILE_COUNT='+(result.files?.length??0),
  'SOURCE_EVIDENCE=HISTORICAL_CHECKOUT_ONLY',
  'RUNTIME_SOURCE_VERIFIED=NO','OPERATIONAL_WRITES=NO','PUBLIC_REPO_WRITES=NO',
  'RETRY=NO_EXPORT_REEXECUTION_ON_UNKNOWN'].join('\n')+'\n';
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=runLive(),dir=process.env.RUNNER_TEMP??os.tmpdir();
 try{
  fs.writeFileSync(path.join(dir,RESULT_NAME),JSON.stringify(result,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'calendar-parser-recovery-result.txt'),resultText(result));
 }catch{process.stderr.write('CAL_SOURCE_B_RESULT_WRITE_STOP\n');process.exitCode=2;}
 if(result.status!=='READY')process.exitCode=1;
}
