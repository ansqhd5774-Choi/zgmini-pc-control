// Read-only Core source/Writer guard preflight for an exact one-file B alignment.
// No subprocess shell, DB, provider, Controller install, scheduler mutation,
// Git checkout/reset, worktree write, API secrets, or PC operational write.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BASE,PUBLIC,SOURCE_ROOT,CONFIG,CORE_TASK,TARGET_BLOBS,
 INSTALLED_HOTFIX_PATH,INSTALLED_HOTFIX_SHA256,sha256,
 validateOneFileBefore} from './contract.mjs';
import {traceVbsDataflow} from './vbs-static-dataflow.mjs';

const WINDOWS_SYSTEM=process.env.SystemRoot??String.raw`C:\Windows`;
const GIT_CANDIDATES=[
 String.raw`C:\Program Files\Git\cmd\git.exe`,
 String.raw`C:\Program Files\Git\bin\git.exe`,
];
const GIT=GIT_CANDIDATES.find(p=>fs.existsSync(p));
const TASK_EXE=path.join(WINDOWS_SYSTEM,'System32','schtasks.exe');
const CSCRIPT=path.join(WINDOWS_SYSTEM,'System32','cscript.exe');
const TASK_PROBE=path.join(process.env.GITHUB_WORKSPACE??'','calendar-control',
 'r17-writer-b','r17-b-windows-probe.js');
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const KNOWN_VBS=Object.freeze([
 {path:String.raw`E:\ZGmini\data\pc-writer\archive-sidecar-r7\run-original-then-archive.vbs`,
  sha:'9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c'},
 {path:String.raw`E:\ZGmini\data\pc-writer\cutover-evidence\inflation-r37-2026-10-20T19-39-19-549Z\run-local-core.vbs`,
  sha:'bb3e11c0b5c8da07162b1c824e7b52e7a7c2f987c079f29713211a2413932b01'},
]);
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
const norm=p=>path.win32.normalize(p).toLowerCase();
const decodeText=bytes=>bytes[0]===255&&bytes[1]===254?
 bytes.subarray(2).toString('utf16le'):(bytes[1]===0&&bytes[3]===0?
 bytes.toString('utf16le'):bytes.toString('utf8').replace(/^\ufeff/,''));
const decodeXml=s=>s.replaceAll('&quot;','"').replaceAll('&amp;','&')
 .replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
const xmlElement=(xml,tag)=>{
 const m=xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`,'i'));
 return m?decodeXml(m[1]).trim():null;
};
// Bounded diagnostics, never serialized VBS text, paths, commands or secrets.
// This is an inventory of active-looking call expressions, NOT proof of the
// executed Windows scheduler chain (VBScript may construct or branch calls).
export function summarizeVbsCalls(source,{secondName='run-local-core.vbs'}={}){
 const joined=String(source).replace(/\r/g,'').replace(/_\s*\n\s*/g,'');
 const withoutComment=joined.split('\n').map(line=>{
  let quoted=false,out='';
  for(let i=0;i<line.length;i++){
   const ch=line[i];
   if(ch==='"'){
    if(quoted&&line[i+1]==='"'){out+='""';i++;continue;}
    quoted=!quoted;
   }
   if(ch==="'"&&!quoted)break;
   out+=ch;
  }
  return /^\s*rem\s/i.test(out)?'':out;
 }).join('\n');
 const lines=withoutComment.split('\n');
 const callSites=[];
 for(const line of lines){
  const m=line.match(/\b[a-z_][\w]*\.(Run|Exec)\s*(?:\(\s*)?(.+)$/i);
  if(!m)continue;
  const expr=m[2].trim();
  const literal=/^"(?:[^"]|"")*"\s*\)?(?:\s*,.*)?$/.test(expr);
  const kind=literal?'literal':/[&+]/.test(expr)?'concatenated':
   /^[a-z_][\w]*\s*\)?(?:\s*,.*)?$/i.test(expr)?'variable':'complex';
  callSites.push({api:m[1].toLowerCase(),argumentForm:kind,
   mentionsSecondLauncher:expr.toLowerCase().includes(secondName),
   mentionsCoreScript:/\blocal-cycle\.mjs\b/i.test(expr),
   mentionsWriterOnly:/\brun-local\.mjs\b/i.test(expr),
   mentionsRunLocalCmd:/\brun-local\.cmd\b/i.test(expr),
   mentionsSourceRoot:expr.toLowerCase().includes(norm(SOURCE_ROOT))});
 }
 return {callCount:callSites.length,callSites:callSites.slice(0,4),
  truncated:callSites.length>4,
  anyConditionalSyntax:/^\s*(if|elseif|else|select\s+case|case|for|do|while|on\s+error|goto)\b/im.test(withoutComment),
  sourceRootMentioned:withoutComment.toLowerCase().includes(norm(SOURCE_ROOT)),
  commentStripped:true};
}
export function parseCoreTaskAction(xml,{realpath=fs.realpathSync.native,
 readFile=fs.readFileSync,statFile=fs.lstatSync,knownLaunchers=KNOWN_VBS}={}){
 const actions=xml.match(/<Actions\b[^>]*>([\s\S]*?)<\/Actions>/i)?.[1]??'';
 const execs=[...actions.matchAll(/<Exec\b[^>]*>([\s\S]*?)<\/Exec>/gi)];
 need(execs.length===1,'CAL_B_TASK_EXEC_COUNT_STOP');
 const command=xmlElement(execs[0][1],'Command');
 const args=xmlElement(execs[0][1],'Arguments');
 need(command&&args,'CAL_B_TASK_ACTION_MISSING_STOP');
 if(path.win32.basename(command.replace(/^"|"$/g,'')).toLowerCase()==='wscript.exe'){
  need(Array.isArray(knownLaunchers)&&knownLaunchers.length===2,
   'CAL_B_TASK_LAUNCHER_COUNT_STOP');
  const first=knownLaunchers[0];
  need(args.toLowerCase().includes('run-original-then-archive.vbs')&&
   !/[;&|]/.test(args),'CAL_B_TASK_WRAPPER_UNKNOWN_STOP');
  const taskScript=args.match(/"?([A-Za-z]:\\[^"]*run-original-then-archive\.vbs)"?/i)?.[1];
  need(taskScript&&norm(realpath(taskScript))===norm(realpath(first.path)),
   'CAL_B_TASK_WRAPPER_PATH_STOP');
  const verified=knownLaunchers.map(spec=>{
   const stat=statFile(spec.path);
   need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<100000,
    'CAL_B_TASK_WRAPPER_FILE_STOP');
   const bytes=readFile(spec.path);
   need(sha256(bytes)===spec.sha,'CAL_B_TASK_WRAPPER_SHA_STOP');
   return decodeText(bytes);
  });
  // Immutable hashes authenticate file *identity*, but do not prove that a
  // matching token is in an executed branch. Never allow a string-presence
  // check to authorize an operational B write.
  const chain=verified.join('\n').toLowerCase();
  const callGraph=verified.map((v,i)=>({launcher:i+1,...summarizeVbsCalls(v)}));
  const causality=verified.map((v,i)=>traceVbsDataflow(v,{
   scriptPath:knownLaunchers[i].path,secondPath:knownLaunchers[1].path,
   root:SOURCE_ROOT,environment:{
    systemdrive:process.env.SystemDrive,systemroot:process.env.SystemRoot,
    windir:process.env.windir,programfiles:process.env.ProgramFiles}}));
  const allKnownTo=(g,key)=>g.entirelyDeterministic&&g.branchSeen===false&&
   g.callCount>=1&&g.calls.every(c=>c[key]===true&&
    c.shellCmdAmbiguous!==true&&c.conditional!==true);
  const causalityProven=allKnownTo(causality[0],'nextPinnedVbsDirect')&&
   allKnownTo(causality[1],'coreNodeEntrypointDirect');
  // A diagnosis cannot certify which conditional VBS action Windows actually
  // took. Even a completely literal/static candidate is NOT active runtime
  // evidence sufficient to permit the separate B source mutation.
  const diagnostic={taskCommand:'wscript.exe',firstLauncherShaVerified:true,
   secondLauncherShaVerified:true,
   containsSecondLauncher:verified[0].toLowerCase().includes('run-local-core.vbs'),
   containsSourceRoot:chain.includes(norm(SOURCE_ROOT)),
   containsLocalCycle:chain.includes('local-cycle.mjs'),
   containsRunLocalCmd:chain.includes('run-local.cmd'),callGraph,causality,
   strictStaticChainCandidate:causalityProven};
  const error=Object.assign(new Error('CAL_B_TASK_WRAPPER_STATIC_CANDIDATE_STOP'),{
   code:'CAL_B_TASK_WRAPPER_STATIC_CANDIDATE_STOP',diagnostic});
  throw error;
 }
 need(norm(command.replace(/^"|"$/g,''))===norm(NODE),
  'CAL_B_TASK_NODE_COMMAND_STOP');
 // Required explicit local-cycle script token; any command-wrapper, env var,
 // relative ambiguous script, Korea lane or extra .mjs fails read-only.
 const argMatch=args.match(/^"([^"]+local-cycle\.mjs)"\s+--publish\s*$|^([A-Za-z]:\\[^\s"]+local-cycle\.mjs)\s+--publish\s*$/i);
 need(argMatch&&!/[%]|--korea|[;&|]/i.test(args),
  'CAL_B_TASK_ENTRYPOINT_UNRESOLVED_STOP');
 const script=argMatch[1]||argMatch[2];
 need(/\\scripts\\pc-writer\\local-cycle\.mjs$/i.test(script),
  'CAL_B_TASK_ENTRYPOINT_UNRESOLVED_STOP');
 const source=path.win32.resolve(path.win32.dirname(script),'..','..');
 // E: and a validated C: junction are equivalent only after native realpath.
 const actual=realpath(source);
 need(norm(actual)===norm(realpath(SOURCE_ROOT)),
  'CAL_B_TASK_ROOT_NOT_ACTIVE_SOURCE_STOP');
 // A mismatched WorkingDirectory is acceptable for an absolute entrypoint.
 // It is not used to resolve the script and cannot override the source root.
 return {sourceRoot:SOURCE_ROOT,relativeEntrypoint:'scripts/pc-writer/local-cycle.mjs'};
}
function call(bin,args,{cwd,maxBuffer=100000}={}){
 need(bin&&fs.existsSync(bin),'CAL_B_BIN_MISSING_STOP');
 const r=spawnSync(bin,args,{cwd,encoding:null,windowsHide:true,shell:false,
  timeout:20_000,maxBuffer,env:{...process.env,GIT_TERMINAL_PROMPT:'0',
   GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0'}});
 need(!r.error&&r.status===0,'CAL_B_FIXED_READ_COMMAND_STOP');
 return r.stdout;
}
const git=(...args)=>call(GIT,['-C',SOURCE_ROOT,'-c','core.fsmonitor=false',...args]).toString('utf8').trim();
const publicGit=(...args)=>call(GIT,['-C',path.join(process.env.GITHUB_WORKSPACE??'', 'calendar-public'),'-c','core.fsmonitor=false',...args]).toString('utf8').trim();
function safeFile(relative){
 const file=path.join(SOURCE_ROOT,...relative.split('/'));
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=2_000_000,
  'CAL_B_REGULAR_HOTFIX_FILE_STOP');
 need(norm(fs.realpathSync.native(file)).startsWith(norm(fs.realpathSync.native(SOURCE_ROOT))+path.win32.sep),
  'CAL_B_HOTFIX_REALPATH_STOP');
 return fs.readFileSync(file);
}
function listNull(bytes){return bytes.toString('utf8').split('\0').filter(Boolean);}
function taskXml(){
 const bytes=call(TASK_EXE,['/Query','/TN',CORE_TASK,'/XML'],{maxBuffer:1_000_000});
 const xml=decodeText(bytes);need(/<Task\b/.test(xml),'CAL_B_TASK_XML_STOP');
 return {bytes,xml};
}
// The historic checkout is useful diagnostic evidence even when the actual
// wscript.exe chain is not provably bound to it. Never label this active.
function inspectCandidateCheckout(){
 need(GIT&&fs.existsSync(SOURCE_ROOT)&&fs.existsSync(CONFIG),
  'CAL_B_CANDIDATE_CHECKOUT_MISSING_STOP');
 const sourceHead=git('rev-parse','HEAD');
 const config=JSON.parse(fs.readFileSync(CONFIG,'utf8'));
 const publicHead=publicGit('rev-parse','HEAD');
 const publicBlob=publicGit('rev-parse',`HEAD:${INSTALLED_HOTFIX_PATH}`);
 const relevant=listNull(call(GIT,['-C',SOURCE_ROOT,'diff','--no-ext-diff',
  '--name-only','-z','HEAD','--','worker','lib','scripts/pc-writer']));
 const staged=listNull(call(GIT,['-C',SOURCE_ROOT,'diff','--no-ext-diff',
  '--cached','--name-only','-z']));
 const otherTargets=Object.entries(TARGET_BLOBS).filter(([p])=>p!==INSTALLED_HOTFIX_PATH);
 let matchingOtherBlobs=0;
 for(const [p,expected] of otherTargets){
  try{if(git('rev-parse',`HEAD:${p}`)===expected)matchingOtherBlobs++;}catch{}
 }
 const hotfixHash=sha256(safeFile(INSTALLED_HOTFIX_PATH));
 return {activeRootVerified:false,sourceHead,configSource:config.source??null,
  publicHeadPinned:publicHead===PUBLIC,publicHotfixBlobPinned:
   publicBlob===TARGET_BLOBS[INSTALLED_HOTFIX_PATH],
  otherTargetBlobMatches:matchingOtherBlobs,
  otherTargetBlobCount:otherTargets.length,
  relevantDirtyCount:relevant.length,
  soleExpectedHotfixDirty:relevant.length===1&&
   relevant[0]===INSTALLED_HOTFIX_PATH&&hotfixHash===INSTALLED_HOTFIX_SHA256,
  stagedIndexCount:staged.length,configSourceMatchesHistoric:
   config.source===BASE,sourceHeadMatchesHistoric:sourceHead===BASE};
}
export function issueAuth({env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'))}={}){
 need(env.GITHUB_REPOSITORY==='ansqhd5774-Choi/zgmini-pc-control'&&
  env.GITHUB_ACTOR==='ansqhd5774-Choi'&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1',
  'CAL_B_PREFLIGHT_EVENT_STOP');
 need(event.action==='opened'&&event.repository?.private===true&&
  event.repository?.full_name===env.GITHUB_REPOSITORY&&
  event.sender?.login===env.GITHUB_ACTOR&&
  event.issue?.user?.login===env.GITHUB_ACTOR&&
  event.issue?.title==='pc-calendar-source-preflight-once',
  'CAL_B_PREFLIGHT_ISSUE_STOP');
 need(typeof event.issue.body==='string'&&event.issue.body.length<=2048,
  'CAL_B_PREFLIGHT_BODY_STOP');
 const b=JSON.parse(event.issue.body);
 need(b.schema==='ZGMINI_CALENDAR_SOURCE_PREFLIGHT_V1'&&
  /^pc-calendar-[a-f0-9-]{36}$/.test(b.requestId??'')&&
  /^chat-[a-f0-9-]{36}$/.test(b.chatId??'')&&
  b.sourceSha===PUBLIC&&Object.keys(b).length===4,
  'CAL_B_PREFLIGHT_REQUEST_STOP');
 return {requestId:b.requestId,issue:event.issue.number};
}
export async function inspectCoreRuntime(){
 need(process.platform==='win32'&&GIT,'CAL_B_WINDOWS_GIT_STOP');
 need(fs.existsSync(SOURCE_ROOT)&&fs.existsSync(CONFIG),
  'CAL_B_SOURCE_CONFIG_MISSING_STOP');
 const {bytes:xmlBytes,xml}=taskXml();
 const active=parseCoreTaskAction(xml);
 const probe=JSON.parse(call(CSCRIPT,['//NoLogo',TASK_PROBE]).toString('utf8').trim());
 need(probe?.ok===true&&typeof probe.enabled==='boolean'&&
  Number.isInteger(probe.instances)&&Number.isInteger(probe.relatedProcesses),
  'CAL_B_TASK_COM_PROBE_STOP');
 const raw=fs.readFileSync(CONFIG),config=JSON.parse(raw.toString('utf8'));
 const source=git('rev-parse','HEAD'),branch=git('branch','--show-current');
 const baseTree=git('rev-parse','HEAD^{tree}');
 const publicHead=publicGit('rev-parse','HEAD');
 const publicHotfixBlob=publicGit('rev-parse',`HEAD:${INSTALLED_HOTFIX_PATH}`);
 const diff=listNull(call(GIT,['-C',SOURCE_ROOT,'diff','--no-ext-diff','--name-only','-z',
  'HEAD','--','worker','lib','scripts/pc-writer']));
 const staged=listNull(call(GIT,['-C',SOURCE_ROOT,'diff','--no-ext-diff','--cached',
  '--name-only','-z']));
 // Static bounded text inspection only. Importing mutable live PC code at
 // diagnostic time would violate this operation's no-code-execution promise.
 const sourceText=safeFile('lib/release-calendar.mjs').toString('utf8');
 const sourceBlock=sourceText.match(/export const RELEASE_SOURCES=Object\.freeze\(\{([\s\S]*?)\}\);/);
 need(!!sourceBlock,'CAL_B_SOURCES_STATIC_FORMAT_STOP');
 const keys=[...sourceBlock[1].matchAll(/^\s*([a-z_]+)\s*:\s*\{url:/gm)].map(m=>m[1]);
 const expected=['bls','bea','fed','fed_calendar','census','eia','usda',
  'cftc','treasury','tic','eia_epm','nyfed'];
 need(keys.length===expected.length&&
  expected.every(key=>keys.filter(x=>x===key).length===1),
  'CAL_B_SOURCES_STATIC_COUNT_STOP');
 const sourceCount=keys.length;
 const hotfix=safeFile(INSTALLED_HOTFIX_PATH);
 const b={
  sourceRoot:SOURCE_ROOT,configPath:CONFIG,coreTask:CORE_TASK,
  activeCoreSourceVerified:true,resolvedTaskSourceRoot:active.sourceRoot,
  resolvedTaskEntry:active.relativeEntrypoint,taskDefinitionVerified:true,
  head:source,configSource:config.source,originalBranch:branch,
  publicHead,publicHotfixBlob,taskEnabled:probe.enabled,
  taskStateKnown:true,
  trackedDirty:diff.map(p=>({path:p,sha256:p===INSTALLED_HOTFIX_PATH?sha256(hotfix):null,
   targetBlob:p===INSTALLED_HOTFIX_PATH?publicHotfixBlob:null})),
  indexDirty:staged,configRawSha256:sha256(raw),
  taskXmlSha256:sha256(xmlBytes),baseTreeSha:baseTree,
  sourceCount,providerCalls:0,sqliteOpened:false,d1Writes:0,
 };
 validateOneFileBefore(b);
 return {before:b,configRaw:raw,taskXmlRaw:xmlBytes,
  taskXmlNormalized:xml,hotfixBytes:hotfix};
}
export async function preflight(){
 const auth=issueAuth();
 let b;
 try{({before:b}=await inspectCoreRuntime());}
 catch(error){
  if(error?.code!=='CAL_B_TASK_WRAPPER_STATIC_CANDIDATE_STOP')throw error;
  let candidateCheckout=null,candidateCheckoutErrorCode=null;
  try{candidateCheckout=inspectCandidateCheckout();}
  catch(e){candidateCheckoutErrorCode=String(e?.code??'CAL_B_CANDIDATE_UNKNOWN_STOP').slice(0,100);}
  return {schema:'ZGMINI_CALENDAR_SOURCE_PREFLIGHT_RESULT_V1',
   status:'CAL_B_PREFLIGHT_STOP',code:error.code,requestId:auth.requestId,
   issue:auth.issue,diagnostic:error.diagnostic,candidateCheckout,
   candidateCheckoutErrorCode,activeCoreRootVerified:false,
   providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0};
 }
 const {trackedDirty:diff,indexDirty:staged}=b;
 return {schema:'ZGMINI_CALENDAR_SOURCE_PREFLIGHT_RESULT_V1',
  status:'CAL_B_PREFLIGHT_PASS',requestId:auth.requestId,
  issue:auth.issue,head:b.head,configSource:b.configSource,
  activeCoreRootVerified:true,sourceCount:b.sourceCount,dirtyRelevantFiles:diff.length,
  indexDirtyCount:staged.length,hotfixSha256:INSTALLED_HOTFIX_SHA256,
  publicHotfixBlob:b.publicHotfixBlob,configSha256:b.configRawSha256,
  taskXmlSha256:b.taskXmlSha256,
  baseTreeSha:b.baseTreeSha,originalBranch:b.originalBranch,
  providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 preflight().then(result=>{process.stdout.write(JSON.stringify(result)+'\n');
  if(result.status!=='CAL_B_PREFLIGHT_PASS')process.exitCode=1;})
  .catch(error=>{process.stdout.write(JSON.stringify({
   schema:'ZGMINI_CALENDAR_SOURCE_PREFLIGHT_RESULT_V1',status:'CAL_B_PREFLIGHT_STOP',
   code:String(error?.code??'CAL_B_PREFLIGHT_UNEXPECTED_STOP').slice(0,100),
   ...(error?.diagnostic?{diagnostic:error.diagnostic}:{}),
   providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0})+'\n');
   process.exitCode=1;});
}
