import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyARequest,authorizeARegistry,approvalPath,inspectApprovedA}
 from './run.mjs';
import {sanitizeAReport,uploadAReport} from './report.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const requestId='0b6401fa-34ca-4428-b9ec-35471ddf7cc2';
const chatId='60401c9d-09c5-471b-aeaa-a37b33bd2cf2';
const sourceSha='2'.repeat(40),controlSha='a'.repeat(40);
const profile={id:'configuredThemeRuntime',binding:{
 sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'codex/theme-fear-greed-integration-20261025',
 sourceSha:'1'.repeat(40)}, // Stable A registration; not each feature commit.
 rootSegments:['pc-writer','theme-config-tool'],
 files:[
  {key:'installed',relativePath:'INSTALL_RESULT.json'},
  {key:'active',relativePath:'ACTIVE_RUNTIME.json'},
  {key:'scheduledCmd',relativePath:'THEME_SCHEDULED.cmd'},
  {key:'scheduledVbs',relativePath:'THEME_SCHEDULED.vbs'},
 ],directories:[{key:'versions',relativePath:'versions'},
 {key:'backups',relativePath:'backups'}],
 tasks:[{key:'configuredTask',name:'ZGMINI-PC-Configured-Themes',expectedHour:13}]};
const registry=Buffer.from(JSON.stringify({
 schema:'ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1',profiles:[profile],
})+'\n');
const request={schema:'ZGMINI_PC_APPROVED_RUNTIME_A_REQUEST_V1',
 requestId,chatId,operation:'approved-runtime-inventory-readonly',
 sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'codex/theme-fear-greed-integration-20261025',
 sourceSha,approvalManifestSha256:sha(registry)};
const event={repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{number:811,user:{login:'ansqhd5774-Choi'},
 title:'pc-approved-runtime-a',labels:[{name:'pc-runtime-inventory-a'}],
 body:JSON.stringify(request)}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_SHA:controlSha,GITHUB_RUN_ID:'12345678'};
const auth=()=>authorizeARegistry({event,env,raw:registry,worktree:registry,head:controlSha});
const xml='<Task><Triggers><CalendarTrigger><StartBoundary>2026-11-08T13:00:00</StartBoundary></CalendarTrigger></Triggers><Settings><Enabled>true</Enabled></Settings><Actions><Exec><Command>wscript.exe</Command><Arguments>SECRET_NEVER_RETURN</Arguments></Exec></Actions></Task>';
const fixture=fn=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'approved-mode-a-'));
 try{
  const home=path.join(root,'pc-writer','theme-config-tool');
  fs.mkdirSync(path.join(home,'versions'),{recursive:true});
  fs.mkdirSync(path.join(home,'backups'));
  fs.writeFileSync(path.join(home,'INSTALL_RESULT.json'),'PROVEN_INSTALLED');
  fs.writeFileSync(path.join(home,'THEME_SCHEDULED.cmd'),'APPROVED_CMD');
  fs.writeFileSync(path.join(home,'THEME_SCHEDULED.vbs'),'APPROVED_VBS');
  return fn({root,home});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
};

test('fixed owner/private/opened one-shot and exact digest-pinned manifest',()=>{
 const r=verifyARequest(event,env);
 assert.equal(r.requestId,requestId);
 assert.ok(approvalPath(r).endsWith(sha(registry)+'.json'));
 assert.equal(auth().profiles[0].id,'configuredThemeRuntime');
 const noLabel={...event,issue:{...event.issue,labels:[]}};
 assert.equal(verifyARequest(noLabel,env).requestId,requestId);
});
test('Issue body cannot select path, task, profile, or arbitrary shell',()=>{
 for(const injected of ['path','task','profile','shell']){
  const evil={...event,issue:{...event.issue,body:JSON.stringify({...request,[injected]:'C:/unsafe'})}};
  assert.throws(()=>verifyARequest(evil,env),{code:'A_RUNTIME_REQUEST_SCOPE_STOP'});
 }
 for(const wrong of [{...env,GITHUB_ACTOR:'other'},
  {...env,GITHUB_RUN_ATTEMPT:'2'}])
  assert.throws(()=>verifyARequest(event,wrong),{code:'A_RUNTIME_OWNER_STOP'});
});
test('modified worktree, manifest digest or control source cannot authorize',()=>{
 assert.throws(()=>authorizeARegistry({event,env,raw:registry,
  worktree:Buffer.from('different'),head:controlSha}),{code:'A_RUNTIME_REGISTRY_BYTES_STOP'});
 assert.throws(()=>authorizeARegistry({event,env,raw:registry,
  worktree:registry,head:'b'.repeat(40)}),{code:'A_RUNTIME_REGISTRY_BYTES_STOP'});
 const evil={...event,issue:{...event.issue,body:JSON.stringify({...request,
  approvalManifestSha256:'f'.repeat(64)})}};
 assert.throws(()=>authorizeARegistry({event:evil,env,raw:registry,
  worktree:registry,head:controlSha}),{code:'A_RUNTIME_REGISTRY_BYTES_STOP'});
});
test('fixed approved profile remains readable after feature source SHA changes',()=>{
 assert.notEqual(request.sourceSha,profile.binding.sourceSha);
 assert.equal(auth().profiles.length,1);
 fixture(({root})=>{
  const result=inspectApprovedA(auth(),{dataRoot:root,queryTask:()=>xml});
  assert.equal(result.status,'DONE');
  assert.equal(result.profiles[0].runtimeMode,'FIRST_SINGLE_CMD_UPGRADE');
  assert.equal(result.profiles[0].files.active.exists,false);
  assert.equal(result.profiles[0].files.installed.sha256,sha('PROVEN_INSTALLED'));
  assert.equal(result.profiles[0].tasks.configuredTask.xmlSha256,sha(xml));
  assert.equal(result.taskChecksComplete,true);
  assert.equal(result.operationalWrites,0);
  assert.ok(!JSON.stringify(result).includes('SECRET_NEVER_RETURN'));
 });
});
test('ACTIVE presence yields repeatable runtime with exact SHA and no PC write',()=>{
 fixture(({root,home})=>{
  fs.writeFileSync(path.join(home,'ACTIVE_RUNTIME.json'),'REPEATABLE_POINTER');
  const before=fs.readdirSync(home).sort();
  const result=inspectApprovedA(auth(),{dataRoot:root,queryTask:()=>xml});
  assert.equal(result.profiles[0].runtimeMode,'REPEATABLE_ACTIVE_RUNTIME');
  assert.equal(result.profiles[0].files.active.sha256,sha('REPEATABLE_POINTER'));
  assert.deepEqual(fs.readdirSync(home).sort(),before);
 });
});
test('ACTIVE alone is a valid repeatable preimage without INSTALL_RESULT',()=>{
 fixture(({root,home})=>{
  fs.writeFileSync(path.join(home,'ACTIVE_RUNTIME.json'),'REPEATABLE_POINTER');
  fs.unlinkSync(path.join(home,'INSTALL_RESULT.json'));
  const result=inspectApprovedA(auth(),{dataRoot:root,queryTask:()=>xml});
  assert.equal(result.profiles[0].runtimeMode,'REPEATABLE_ACTIVE_RUNTIME');
  assert.equal(result.profiles[0].files.installed.exists,false);
  assert.equal(result.fileHashesComplete,true);
 });
});
test('mode snapshot race returns BLOCKED/UNKNOWN instead of selecting a B mode',()=>{
 const authn=auth();let calls=0;
 const result=inspectApprovedA(authn,{dataRoot:'/unused',queryTask:()=>xml,
  inspect:()=>({status:'DONE',rootExists:true,files:{
   installed:{exists:true,sha256:sha('installed'),sizeBytes:9},
   active:calls++===0?{exists:false}:{exists:true,sha256:sha('new'),sizeBytes:3},
   scheduledCmd:{exists:true,sha256:sha('cmd'),sizeBytes:3},
   scheduledVbs:{exists:true,sha256:sha('vbs'),sizeBytes:3},
  },tasks:{configuredTask:{status:'XML_READ'}}})});
 assert.equal(result.blockedProfiles,1);
 assert.equal(result.profiles[0].runtimeMode,'STATE_UNKNOWN_CHANGED_DURING_READ');
 assert.equal(result.fileHashesComplete,false);
});
test('Task XML changing between snapshots never yields a decided runtime mode',()=>{
 fixture(({root})=>{
  let calls=0;
  const result=inspectApprovedA(auth(),{dataRoot:root,
   queryTask:()=>xml.replace('2026-11-08',calls++===0?'2026-11-08':'2026-11-09')});
  assert.equal(result.profiles[0].runtimeMode,'STATE_UNKNOWN_CHANGED_DURING_READ');
  assert.equal(result.taskChecksComplete,false);
  assert.equal(result.blockedProfiles,1);
 });
});
test('unavailable Task metadata never becomes taskChecksComplete=true',()=>{
 fixture(({root})=>{
  const result=inspectApprovedA(auth(),{dataRoot:root,
   queryTask:()=>{throw Error('Sensitive Task failure');}});
  assert.equal(result.taskChecksComplete,false);
  assert.equal(result.profiles[0].tasks.configuredTask.status,'QUERY_UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('Sensitive Task'));
 });
});
test('reporter allows only fingerprint/metadata and strips arbitrary local secrets',()=>{
 fixture(({root})=>{
  const local={schema:'ZGMINI_APPROVED_RUNTIME_A_LOCAL_RESULT_V1',
   requestId,...inspectApprovedA(auth(),{dataRoot:root,queryTask:()=>xml})};
  local.profiles[0].secret='SENSITIVE_DO_NOT_UPLOAD';
  local.profiles[0].files.untrusted={exists:true,sha256:'private-key',
   content:'SENSITIVE_DO_NOT_UPLOAD'};
  const report=sanitizeAReport(local,request,env);
  assert.equal(report.status,'DONE');
  assert.equal(report.profiles[0].runtimeMode,'FIRST_SINGLE_CMD_UPGRADE');
  assert.ok(!JSON.stringify(report).includes('SENSITIVE_DO_NOT_UPLOAD'));
  assert.equal(report.operationalWrites,0);
 });
});
test('JSON/TXT create-only pair 2/2 readback and incomplete report no PASS claim',async()=>{
 const records=new Map();let comments=0;
 const fakeFetch=async(url,opts)=>{
  if(opts.method==='PUT'){
   const v=JSON.parse(opts.body);records.set(url,Buffer.from(v.content,'base64'));
   return {status:201};
  }
  if(opts.method==='GET'){
   const bytes=records.get(url.replace('?ref=main',''));
   return {status:bytes?200:404,json:async()=>({encoding:'base64',
    content:bytes?.toString('base64')})};
  }
  comments++;
  return {status:201};
 };
 const outcome=await uploadAReport({event,env:{...env,GITHUB_TOKEN:'x'.repeat(30)},
  rawResult:JSON.stringify({status:'BLOCKED',code:'A_RUNTIME_WINDOWS_REQUIRED',
   requestId}),fetchApi:fakeFetch});
 assert.equal(outcome.status,'BLOCKED');
 assert.equal(outcome.delivery,'RESULT_PAIR_READBACK_VERIFIED');
 assert.equal(outcome.created,2);assert.equal(outcome.verified,2);
 assert.equal(comments,1);
 const fallback=sanitizeAReport({status:'DONE',requestId,
  schema:'ZGMINI_APPROVED_RUNTIME_A_LOCAL_RESULT_V1'},request,env);
 assert.equal(fallback.status,'STATE_UNKNOWN');
});
test('workflow only names fixed Windows Runner, no arbitrary shell and no B stage',()=>{
 const dirname=path.dirname(fileURLToPath(import.meta.url));
 const text=fs.readFileSync(path.join(dirname,'pc-approved-runtime-a-once.yml'),'utf8');
 assert.ok(text.includes('runs-on: [self-hosted, Windows, X64, zgmini-pc-control]'));
 assert.ok(text.includes('persist-credentials: false'));
 assert.ok(text.includes('github.run_attempt == 1'));
 assert.ok(text.includes('if: always() && steps.control.outcome'));
 assert.ok(!text.includes('--install'));
 assert.ok(!text.includes('--apply'));
});
