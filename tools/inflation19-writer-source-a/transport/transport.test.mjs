import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SCHEMA,ISSUE_TITLE,ISSUE_LABEL,OPERATION,SOURCE_BRANCH,SOURCE_REPO,
 SOURCE_SHA,validateEvent} from './contract.mjs';
import {executeInventory,safeResult,resultPath} from './entry.mjs';
import {uploadReport} from './upload.mjs';

const id='pc-12345678-1234-4123-8123-123456789abc';
const chat='chat-abcdefab-abcd-4def-8def-abcdefabcdef';
const event={action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',
 private:true},issue:{number:400,title:ISSUE_TITLE,user:{login:'ansqhd5774-Choi'},
 labels:[{name:ISSUE_LABEL}],body:JSON.stringify({schema:SCHEMA,requestId:id,
 chatId:chat,operation:OPERATION,sourceRepository:SOURCE_REPO,
 sourceBranch:SOURCE_BRANCH,sourceSha:SOURCE_SHA})}};
const env={GITHUB_EVENT_ACTION:'opened',GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_TOKEN:'test-token-is-at-least-twenty-characters',
 SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32'};
const hashes={
 'scripts/pc-writer/run-local.mjs':{status:'PRESENT',sha256:'a'.repeat(64)},
 'scripts/pc-writer/inflation-causal-public-auto-publication-r1.mjs':{status:'ABSENT'},
 'scripts/pc-writer/inflation-causal-public-auto-publication-r1.test.mjs':{status:'ABSENT'},
};
const raw={schema:'ZGMINI_INFL19_WRITER_SOURCE_INVENTORY_A_V1',
 status:'PASS_READONLY',code:'INFL19_A_SOURCE_IDENTITY_OBSERVED',
 sourceRoot:'e:\\zgmini\\projects\\op-root',
 sourceHeadSha:'a'.repeat(40),configApprovedSha:'a'.repeat(40),
 configMatchesHead:true,targetFilesDirty:false,
 taskXmlSha256:'b'.repeat(64),actionExe:'wscript.exe',files:hashes,
 providerCalls:0,d1Writes:0,pcSourceWrites:0,configWrites:0,taskWrites:0};
const blockedAction={schema:'ZGMINI_INFL19_WRITER_SOURCE_INVENTORY_A_V1',
 status:'BLOCKED',code:'INFL19_A_SCRIPT_REFERENCE_UNRESOLVED',
 taskXmlSha256:'c'.repeat(64),actionExe:'wscript.exe',
 launcherArgumentShape:'VBS_WITH_FLAGS',
 taskXml:'RAW_XML_DENIED',arguments:'RAW_ARGS_DENIED',token:'SECRET_DENIED',
 providerCalls:0,d1Writes:0,pcSourceWrites:0,configWrites:0,taskWrites:0};
const blockedR38={schema:'ZGMINI_INFL19_WRITER_SOURCE_INVENTORY_A_V1',
 status:'BLOCKED',code:'INFL19_A_R38_DISPATCH_UNVERIFIED',
 taskXmlSha256:'b'.repeat(64),actionExe:'wscript.exe',
 launcherSha256:'c'.repeat(64),originSha256:'d'.repeat(64),
 staticScriptBasename:'local-cycle.mjs',
 staticEvidence:'REFERENCE_ONLY_NOT_EXECUTION_PROVEN',
 launcherPath:'SECRET_PATH_DENIED',originContents:'SECRET_RAW_VBS_DENIED',
 scriptPath:'SECRET_SOURCE_DENIED',configSecret:'SECRET_CONFIG_DENIED',
 providerCalls:0,d1Writes:0,pcSourceWrites:0,configWrites:0,taskWrites:0};
const copy=v=>structuredClone(v);

test('fixed owner, label, one-shot UUID and immutable source pin are required',()=>{
 assert.equal(validateEvent(event,env).requestId,id);
 assert.throws(()=>validateEvent({...event,repository:{...event.repository,private:false}},env),
  /INFL19_A_EVENT_DENIED/);
 assert.throws(()=>validateEvent({...event,issue:{...event.issue,labels:[]}},env),
  /INFL19_A_EVENT_DENIED/);
 const invalid=copy(event);
 invalid.issue.body=JSON.stringify({...JSON.parse(invalid.issue.body),sourceSha:'f'.repeat(40)});
 assert.throws(()=>validateEvent(invalid,env),/INFL19_A_REQUEST_DENIED/);
});

test('sanitizer retains exactly three approved source identities only',()=>{
 const result=safeResult({...raw,secret:'MUST_NOT_APPEAR'},
  {requestId:id,chatId:chat});
 assert.equal(result.status,'PASS_READONLY');
 assert.equal(result.files['scripts/pc-writer/run-local.mjs'].sha256,'a'.repeat(64));
 assert.equal('secret' in result,false);
 assert.equal(result.pcSourceWrites,0);
 assert.equal(safeResult({...raw,providerCalls:1},{requestId:id,chatId:chat}).status,'BLOCKED');
});

test('entry writes one unique run-owned result and never logs child stderr',t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'infl19-readonly-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const captured=[];
 const run=()=>executeInventory({event,env,resultDir:tmp,scriptPath:'/tmp/fixed-inventory.mjs',
  spawn:(bin,args,opt)=>{captured.push({bin,args,opt});return {status:0,stdout:JSON.stringify(raw),stderr:'TOKEN_SECRET'}}});
 const result=run().result;
 assert.equal(result.status,'PASS_READONLY');
 assert.equal(captured[0].opt.env.GITHUB_TOKEN,undefined);
 const written=fs.readFileSync(resultPath(tmp,id,400),'utf8');
 assert.equal(written.includes('TOKEN_SECRET'),false);
 assert.notEqual(resultPath(tmp,id,400),resultPath(tmp,id,401));
 assert.throws(()=>resultPath(tmp,id,0),/INFL19_A_RESULT_ID_DENIED/);
 assert.throws(run,/EEXIST/);
});

test('nonzero child exit cannot be transformed into a PASS',t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'infl19-readonly-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const r=executeInventory({event,env,resultDir:tmp,scriptPath:'/tmp/fixed-inventory.mjs',
  spawn:()=>({status:1,stdout:JSON.stringify(raw)})});
 assert.equal(r.result.status,'BLOCKED');
});

test('nonzero BLOCKED child preserves exactly three safe action details',t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'infl19-readonly-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const r=executeInventory({event,env,resultDir:tmp,scriptPath:'/tmp/fixed-inventory.mjs',
  spawn:()=>({status:1,stdout:JSON.stringify(blockedAction)})});
 assert.equal(r.result.status,'BLOCKED');
 assert.equal(r.result.code,'INFL19_A_SCRIPT_REFERENCE_UNRESOLVED');
 assert.equal(r.result.taskXmlSha256,'c'.repeat(64));
 assert.equal(r.result.actionExe,'wscript.exe');
 assert.equal(r.result.launcherArgumentShape,'VBS_WITH_FLAGS');
 assert.equal('taskXml' in r.result,false);
 assert.equal('arguments' in r.result,false);
 assert.equal('token' in r.result,false);
 const invalid=safeResult({...blockedAction,launcherArgumentShape:'RAW_ARGS_DENIED'},
  {requestId:id,chatId:chat});
 assert.equal('taskXmlSha256' in invalid,false);
});

test('R38 static BLOCKED keeps two hashes and allowlisted script kind only',()=>{
 const r=safeResult(blockedR38,{requestId:id,chatId:chat});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'INFL19_A_R38_DISPATCH_UNVERIFIED');
 assert.equal(r.taskXmlSha256,'b'.repeat(64));
 assert.equal(r.launcherSha256,'c'.repeat(64));
 assert.equal(r.originSha256,'d'.repeat(64));
 assert.equal(r.staticScriptBasename,'local-cycle.mjs');
 assert.equal(r.staticEvidence,'REFERENCE_ONLY_NOT_EXECUTION_PROVEN');
 assert.equal('sourceRoot' in r,false);
 for(const secret of ['SECRET_PATH_DENIED','SECRET_RAW_VBS_DENIED',
  'SECRET_SOURCE_DENIED','SECRET_CONFIG_DENIED'])
  assert.doesNotMatch(JSON.stringify(r),new RegExp(secret));
 for(const altered of [
  {...blockedR38,originSha256:'invalid'},
  {...blockedR38,staticScriptBasename:'evil.mjs'},
  {...blockedR38,staticEvidence:'EXECUTION_PROVEN'},
  {...blockedR38,d1Writes:1},
 ]){
  const blocked=safeResult(altered,{requestId:id,chatId:chat});
  assert.equal(blocked.status,'BLOCKED');
  assert.equal('originSha256' in blocked,false);
  assert.equal('staticScriptBasename' in blocked,false);
 }
});

test('R38 nonzero child remains BLOCKED and retains sanitized static evidence',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'infl19-r38-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const got=executeInventory({event,env,resultDir:temp,
  scriptPath:'/tmp/fixed-inventory.mjs',
  spawn:()=>({status:1,stdout:JSON.stringify(blockedR38)})});
 assert.equal(got.result.status,'BLOCKED');
 assert.equal(got.result.code,'INFL19_A_R38_DISPATCH_UNVERIFIED');
 assert.equal(got.result.originSha256,'d'.repeat(64));
 const body=fs.readFileSync(resultPath(temp,id,400),'utf8');
 assert.equal(body.includes('SECRET_'),false);
});

test('uploader posts bounded JSON TXT and one comment without PC writes',async()=>{
 const report=safeResult(raw,{requestId:id,chatId:chat});
 const requests=[];
 const fake=async (url,opt)=>{requests.push({url,opt});
  if(opt.method==='GET')return {status:200,json:async()=>[]};
  return {status:opt.method==='PUT'?201:201}};
 const answer=await uploadReport({event,env,
  readReport:()=>JSON.stringify(report),apiFetch:fake});
 assert.equal(answer.files,2);
 assert.deepEqual(requests.map(x=>x.opt.method),['GET','PUT','PUT','POST']);
 const posted=JSON.parse(requests[3].opt.body).body;
 assert.equal(posted.includes('sourceRoot'),true);
 assert.equal(posted.includes('TOKEN_SECRET'),false);
 assert.equal(JSON.parse(requests[1].opt.body).content.length>0,true);
});

test('uploader never sends duplicate comment or re-executes on existing marker',async()=>{
 const calls=[];
 const fake=async (url,opt)=>{calls.push(opt.method);
  return {status:200,json:async()=>[{user:{login:'github-actions[bot]',type:'Bot'},
   body:`<!-- zgmini-infl19-writer-source-a:400:${id} -->`}]}};
 const r=await uploadReport({event,env,readReport:()=>JSON.stringify(raw),apiFetch:fake});
 assert.equal(r.code,'INFL19_A_ALREADY_REPORTED');
 assert.deepEqual(calls,['GET']);
});

test('attacker-supplied copied marker never suppresses a genuine report',async()=>{
 const calls=[];
 const fake=async (url,opt)=>{calls.push(opt.method);
  if(opt.method==='GET')return {status:200,json:async()=>[{
   user:{login:'ansqhd5774-Choi',type:'User'},
   body:`<!-- zgmini-infl19-writer-source-a:400:${id} -->`}]};
  return {status:201};
 };
 const r=await uploadReport({event,env,readReport:()=>JSON.stringify(raw),apiFetch:fake});
 assert.equal(r.files,2);
 assert.deepEqual(calls,['GET','PUT','PUT','POST']);
});

test('missing report TXT preserves unknown state instead of false',async()=>{
 let received='';
 const fake=async (url,opt)=>{
  if(opt.method==='GET')return {status:200,json:async()=>[]};
  if(opt.method==='PUT'&&url.endsWith('.txt'))
   received=Buffer.from(JSON.parse(opt.body).content,'base64').toString('utf8');
  return {status:201};
 };
 const r=await uploadReport({event,env,readReport:()=>'{not-json',apiFetch:fake});
 assert.equal(r.status,'BLOCKED');
 assert.match(received,/CONFIG_MATCHES_HEAD=UNKNOWN/);
 assert.match(received,/TARGET_FILES_DIRTY=UNKNOWN/);
});

test('uploader BLOCKED TXT and JSON expose only whitelisted action shape',async()=>{
 const reports=[];
 const fake=async (url,opt)=>{
  if(opt.method==='GET')return {status:200,json:async()=>[]};
  if(opt.method==='PUT')reports.push({url,body:Buffer.from(
   JSON.parse(opt.body).content,'base64').toString('utf8')});
  return {status:201};
 };
 const report=safeResult(blockedAction,{requestId:id,chatId:chat});
 const answer=await uploadReport({event,env,readReport:()=>JSON.stringify(report),apiFetch:fake});
 assert.equal(answer.status,'BLOCKED');
 assert.equal(reports.length,2);
 const txt=reports.find(x=>x.url.endsWith('.txt')).body;
 const json=JSON.parse(reports.find(x=>x.url.endsWith('.json')).body);
 assert.match(txt,/TASK_XML_SHA256=c{64}/);
 assert.match(txt,/ACTION_EXE=wscript\.exe/);
 assert.match(txt,/LAUNCHER_ARGUMENT_SHAPE=VBS_WITH_FLAGS/);
 assert.match(txt,/CONFIG_MATCHES_HEAD=UNKNOWN/);
 assert.match(txt,/TARGET_FILES_DIRTY=UNKNOWN/);
 assert.equal(json.launcherArgumentShape,'VBS_WITH_FLAGS');
 for(const denied of ['RAW_XML_DENIED','RAW_ARGS_DENIED','SECRET_DENIED']){
  assert.doesNotMatch(txt,new RegExp(denied));
  assert.doesNotMatch(JSON.stringify(json),new RegExp(denied));
 }
});

test('uploader R38 TXT JSON and comment preserve only bounded static hashes',async()=>{
 const requests=[];
 const fake=async (url,opt)=>{
  requests.push({url,opt});
  if(opt.method==='GET')return {status:200,json:async()=>[]};
  return {status:201};
 };
 const bounded=safeResult(blockedR38,{requestId:id,chatId:chat});
 const response=await uploadReport({event,env,readReport:()=>JSON.stringify(bounded),
  apiFetch:fake});
 assert.equal(response.status,'BLOCKED');
 const uploaded=requests.filter(x=>x.opt.method==='PUT').map(x=>({
  name:x.url,body:Buffer.from(JSON.parse(x.opt.body).content,'base64').toString('utf8')}));
 const json=JSON.parse(uploaded.find(x=>x.name.endsWith('.json')).body);
 const txt=uploaded.find(x=>x.name.endsWith('.txt')).body;
 const comment=JSON.parse(requests.find(x=>x.opt.method==='POST').opt.body).body;
 assert.equal(json.originSha256,'d'.repeat(64));
 assert.equal(json.launcherSha256,'c'.repeat(64));
 assert.equal(json.staticScriptBasename,'local-cycle.mjs');
 assert.match(txt,/R38_ORIGIN_SHA256=d{64}/);
 assert.match(txt,/R38_LAUNCHER_SHA256=c{64}/);
 assert.match(txt,/R38_EVIDENCE=REFERENCE_ONLY_NOT_EXECUTION_PROVEN/);
 assert.doesNotMatch(txt,/LAUNCHER_ARGUMENT_SHAPE=undefined/);
 for(const output of [txt,JSON.stringify(json),comment]){
  assert.doesNotMatch(output,/SECRET_/);
  assert.doesNotMatch(output,/scriptPath|originContents|launcherPath|configSecret/);
 }
});

test('missing prior comment state stops before any outbound result mutation',async()=>{
 const calls=[];
 await assert.rejects(uploadReport({event,env,readReport:()=>JSON.stringify(raw),
  apiFetch:async(_,opt)=>{calls.push(opt.method);return {status:503}}}),
  /INFL19_A_COMMENT_STATE_UNKNOWN/);
 assert.deepEqual(calls,['GET']);
});

test('Workflow is fixed issue-gated, self-hosted, and token in uploader only',()=>{
 const yaml=fs.readFileSync(new URL('./pc-inflation19-writer-source-a.yml',import.meta.url),'utf8');
 assert.match(yaml,/runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
 assert.match(yaml,/types: \[opened\]/);
 assert.match(yaml,/github\.actor == 'ansqhd5774-Choi'/);
 assert.match(yaml,/github\.event\.issue\.title == 'pc-inflation19-writer-source-inventory-a'/);
 assert.match(yaml,/contains\(github\.event\.issue\.labels\.\*\.name, 'pc-inflation19-writer-source-inventory-a'\)/);
 assert.equal((yaml.match(/GITHUB_TOKEN:/g)??[]).length,1);
 assert.match(yaml,/github\.run_attempt == 1/);
 assert.match(yaml,/group: inflation19-writer-source-a-single-lane/);
 assert.equal((yaml.match(/actions\/checkout@/g)??[]).length,1);
 assert.doesNotMatch(yaml,/workflow_dispatch|shell:\s*powershell|ubuntu-latest/);
});
