import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inspectTask} from './marketparquet-task-source-readonly.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim} from '../r17-writer-b/r17-b-claim.mjs';
export const OPERATION='marketparquet-exact-task-retire-once';
export const REQUEST_SCHEMA='ZGMINI_MP_TASK_RETIRE_REQUEST_V1';
export const TASK='ZGMINI-PC-MarketParquet-ETF';
export const PROTECTED_TASK='ZGMINI-PC-GetMarketHistory-ETF';
export const ENTRY=String.raw`E:\ZGmini\data\theme-market-history-r131\marketparquet-r167\r167-cycle.mjs`;
export const PINS=Object.freeze({xml:'784ce63cb8c947abed116c2d754a3d24985f73d41ddaf9afdd44d43b246a7126',entry:'4cad9645ff306cc5d2ea9f86fb8922f78f4b19dd706d6386ec01b0bbabe0b673',protectedXml:'3e4f0e387e36049352fe4e6135eabd311c4862cec186a17a2f8eaf6dee3a677e'});
const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
const ROOT=String.raw`E:\ZGmini\data\pc-writer\marketparquet-task-retire`;
const SHARED=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANIFEST=/^approvals\/marketparquet-retire\/[a-z0-9-]{6,80}\.json$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c});};
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const proofs=new WeakSet();
const REVIEWED=['tools/marketparquet-task-retire-once.mjs','tools/marketparquet-task-retire-report.mjs','tools/marketparquet-task-source-readonly.mjs','r17-writer-b/r17-b-claim.mjs','.github/workflows/pc-writer-b-source-once.yml'];
export function authorize({event,env,manifestBytes}){
 need(env.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&env.GITHUB_ACTOR===OWNER&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')&&event.repository?.full_name===REPO&&event.repository.private===true&&event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&event.issue.title===OPERATION&&!event.issue.pull_request&&Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&event.issue.labels?.some(x=>x.name==='pc-writer-b-install'),'MP_RETIRE_EVENT_STOP');
 const r=JSON.parse(event.issue.body);
 need(exact(r,['schema','requestId','chatId','operation','controlRepository','approvalManifestPath','approvalManifestSha256'])&&r.schema===REQUEST_SCHEMA&&r.operation===OPERATION&&r.controlRepository===REPO&&UUID.test(r.requestId)&&UUID.test(r.chatId)&&MANIFEST.test(r.approvalManifestPath)&&/^[a-f0-9]{64}$/.test(r.approvalManifestSha256)&&Buffer.isBuffer(manifestBytes)&&sha(manifestBytes)===r.approvalManifestSha256,'MP_RETIRE_REQUEST_STOP');
 const m=JSON.parse(manifestBytes.toString('utf8'));
 need(exact(m,['schema','status','requestId','controlSourceSha','taskName','taskXmlSha256','entrySha256','protectedTaskName','protectedTaskXmlSha256','maxDisables','allowProviderCalls','allowSourceWrites','allowDatabaseWrites','allowOtherTaskChanges'])&&m.schema==='ZGMINI_MP_TASK_RETIRE_APPROVAL_V1'&&m.status==='APPROVED_B'&&m.requestId===r.requestId&&/^[a-f0-9]{40}$/.test(m.controlSourceSha)&&m.taskName===TASK&&m.taskXmlSha256===PINS.xml&&m.entrySha256===PINS.entry&&m.protectedTaskName===PROTECTED_TASK&&m.protectedTaskXmlSha256===PINS.protectedXml&&m.maxDisables===1&&['allowProviderCalls','allowSourceWrites','allowDatabaseWrites','allowOtherTaskChanges'].every(k=>m[k]===false),'MP_RETIRE_MANIFEST_STOP');
 const p=Object.freeze({request:Object.freeze(r),manifest:Object.freeze(m),controlSha:env.GITHUB_SHA});proofs.add(p);return p;
}
export function equivalentDefinition(a,b){
 const normalize=s=>s.replace(/<Settings(?:\s[^>]*)?>[\s\S]*?<\/Settings>/i,t=>t.replace(/<Enabled>\s*(?:true|false)\s*<\/Enabled>/gi,'')).replace(/>\s+</g,'><').replace(/^\uFEFF/,'').trim();
 return typeof a==='string'&&typeof b==='string'&&/<Settings(?:\s|>)/.test(a)&&/<Settings(?:\s|>)/.test(b)&&normalize(a)===normalize(b);
}
function xml(task){const r=spawnSync(path.win32.join(process.env.SystemRoot??'C:/Windows','System32','schtasks.exe'),['/Query','/TN',task,'/XML'],{encoding:null,windowsHide:true,shell:false,timeout:15000,maxBuffer:262144});need(!r.error&&r.status===0&&Buffer.isBuffer(r.stdout),'MP_RETIRE_XML_READ_STOP');return r.stdout;}
function decode(b){return (b[0]===255&&b[1]===254?b.subarray(2).toString('utf16le'):b[1]===0?b.toString('utf16le'):b.toString('utf8')).replace(/^\uFEFF/,'');}
function ps(script){const r=spawnSync(path.win32.join(process.env.SystemRoot??'C:/Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:8192});need(!r.error&&r.status===0,'MP_RETIRE_COM_ACCESS_STOP');return r.stdout.trim();}
export function nativeRead(){
 need(process.platform==='win32','MP_RETIRE_WINDOWS_REQUIRED_STOP');
 const source=inspectTask();need(source.taskXmlSha256&&source.entryFileSha256===PINS.entry&&source.entryFileLeaf==='r167-cycle.mjs','MP_RETIRE_SOURCE_STOP');
 const state=JSON.parse(ps("$ErrorActionPreference='Stop';$s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\\');$t=$f.GetTask('"+TASK+"');$g=$f.GetTask('"+PROTECTED_TASK+"');$p=@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*r167-cycle.mjs*' });[pscustomobject]@{enabled=[bool]$t.Enabled;instances=[int]$t.GetInstances(0).Count;state=[int]$t.State;protectedEnabled=[bool]$g.Enabled;sourceProcesses=$p.Count}|ConvertTo-Json -Compress"));
 return {...state,xml:xml(TASK),protectedXml:xml(PROTECTED_TASK),entrySha256:source.entryFileSha256};
}
export async function retire(proof,io,{digest=sha}={}){
 need(proofs.has(proof),'MP_RETIRE_UNAUTHENTICATED_STOP');
 let lock=null,attempted=false,claimed=false,retain=false;
 const base={schema:'ZGMINI_MP_TASK_RETIRE_RESULT_V1',requestId:proof.request.requestId,controlSha:proof.controlSha,providerCalls:0,sourceWrites:0,d1Writes:0,sqliteWrites:0,taskDisabled:false,protectedTaskUnchanged:false,noFutureHttpGuaranteed:false};
 try{
  lock=await io.acquire(proof.request.requestId);
  const before=await io.read();
  need(before.enabled===true&&before.instances===0&&before.state===3&&before.sourceProcesses===0&&before.protectedEnabled===true&&before.entrySha256===PINS.entry&&digest(before.xml)===PINS.xml&&digest(before.protectedXml)===PINS.protectedXml,'MP_RETIRE_PREIMAGE_STOP');
  await io.claim(lock,proof.request.requestId);claimed=true;
  const backup=await io.backup(before.xml,proof.request.requestId);need(backup===PINS.xml,'MP_RETIRE_BACKUP_STOP');
  const again=await io.read();need(again.enabled===true&&again.instances===0&&again.state===3&&again.sourceProcesses===0&&again.protectedEnabled===true&&again.entrySha256===PINS.entry&&digest(again.xml)===PINS.xml&&digest(again.protectedXml)===PINS.protectedXml,'MP_RETIRE_PRE_DISABLE_DRIFT_STOP');
  attempted=true;await io.disable();
  const after=await io.read();need(after.enabled===false&&after.instances===0&&after.state===1&&after.sourceProcesses===0&&after.protectedEnabled===true&&after.entrySha256===PINS.entry&&digest(after.protectedXml)===PINS.protectedXml&&equivalentDefinition(decode(before.xml),decode(after.xml)),'MP_RETIRE_POSTCHECK_STOP');
  return {...base,status:'PASS',code:'MP_RETIRE_EXACT_TASK_DISABLED_READBACK_VERIFIED',taskDisabled:true,protectedTaskUnchanged:true,beforeXmlSha256:PINS.xml,afterXmlSha256:digest(after.xml),entrySha256:PINS.entry,protectedTaskXmlSha256:PINS.protectedXml};
 }catch(e){retain=attempted||claimed;return {...base,status:attempted?'STATE_UNKNOWN':'PREFLIGHT_STOP',code:/^MP_RETIRE_[A-Z0-9_]+$/.test(e.code??'')?e.code:'MP_RETIRE_UNCLASSIFIED_STOP',disableAttempted:attempted};}
 finally{if(lock)await io.release(lock,proof.request.requestId,retain);}
}
export function nativeIO(){return {
 acquire:id=>acquireInstallLock({journalRoot:ROOT,requestId:id,sharedLock:SHARED}),
 claim:(lock,id)=>createInstallJournal({journalRoot:ROOT,requestId:id,sharedLock:SHARED,fd:lock.fd}),
 read:nativeRead,
 backup:(bytes,id)=>{const f=path.join(ROOT,id,'original-task.xml');fs.writeFileSync(f,bytes,{flag:'wx'});const fd=fs.openSync(f,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return sha(fs.readFileSync(f));},
 disable:()=>ps("$ErrorActionPreference='Stop';$s=New-Object -ComObject Schedule.Service;$s.Connect();$s.GetFolder('\\').GetTask('"+TASK+"').Enabled=$false;'DISABLED'"),
 release:(lock,id,retain)=>releaseInstallClaim({fd:lock.fd,sharedLock:SHARED,requestId:id,retain}),
};}
function git(root,args){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-C',root,...args],{encoding:null,windowsHide:true,shell:false,timeout:20000,maxBuffer:524288});need(!r.error&&r.status===0,'MP_RETIRE_SOURCE_READ_STOP');return r.stdout;}
export async function entry({event,env,root,io=nativeIO()}){
 need(process.platform==='win32','MP_RETIRE_WINDOWS_REQUIRED_STOP');
 need(git(root,['rev-parse','HEAD']).toString().trim()===env.GITHUB_SHA,'MP_RETIRE_HEAD_STOP');
 const r=JSON.parse(event.issue.body);need(MANIFEST.test(r.approvalManifestPath),'MP_RETIRE_MANIFEST_PATH_STOP');
 const bytes=git(root,['cat-file','blob','HEAD:'+r.approvalManifestPath]);const p=authorize({event,env,manifestBytes:bytes});
 git(root,['merge-base','--is-ancestor',p.manifest.controlSourceSha,'HEAD']);git(root,['diff','--exit-code',p.manifest.controlSourceSha,'HEAD','--',...REVIEWED]);git(root,['diff','--exit-code','HEAD','--',...REVIEWED]);
 return retire(p,io);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;try{result=await entry({event:JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),env:process.env,root:path.join(process.env.GITHUB_WORKSPACE,'writer-b-control')});}catch(e){result={status:'PREFLIGHT_STOP',code:/^MP_RETIRE_[A-Z0-9_]+$/.test(e.code??'')?e.code:'MP_RETIRE_SETUP_STOP',taskDisabled:false,providerCalls:0,d1Writes:0};}
 fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'mp-task-retire-result.json'),JSON.stringify(result)+'\n',{flag:'wx'});console.log(result.status+' '+result.code);if(result.status!=='PASS')process.exitCode=1;
}
