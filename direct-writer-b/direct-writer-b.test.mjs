import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyOpenedOwnerIssue,approvalPathFor,authorizeApprovedRaw,
  loadApprovedRaw,applyApprovedOnce,DIRECT_B_RESULT} from './run.mjs';
import {sanitizeDirectBReport,uploadDirectBReport} from './report.mjs';
import {SCHEMA as BUNDLE_SCHEMA,SCOPE as BUNDLE_SCOPE}
  from '../writer-b/approved-versioned-bundle/versioned-bundle-plan.mjs';
import {PIN_CAS_SCHEMA,PIN_CAS_SCOPE}
  from '../writer-b/approved-versioned-bundle/approved-registry-cas.mjs';

const digest=b=>createHash('sha256').update(b).digest('hex');
const requestId='abeb79fe-03b3-4f7c-9df3-f521bff31c50';
const chatId='bc5fe67b-c68d-4b62-9448-6b15a05e9241';
const sourceSha='0c97599431882245a156470bd51290e327e7ee78';
const controlSha='a'.repeat(40);
const req=(sha)=>({schema:'ZGMINI_PC_APPROVED_RUNTIME_B_ACTIONS_REQUEST_V1',
  requestId,chatId,operation:'pc-approved-runtime-b',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  approvalManifestSha256:sha});
const env=()=>({GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:controlSha,GITHUB_RUN_ID:'4117',GITHUB_TOKEN:'t'.repeat(24)});
const event=(body)=>({repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',
  private:true},sender:{login:'ansqhd5774-Choi'},issue:{
  user:{login:'ansqhd5774-Choi'},title:'pc-approved-runtime-b',
  number:415,labels:[{name:'pc-writer-b-install'}],body}});
const manifest=(kind='bundle')=>(kind==='bundle'?
  {schema:BUNDLE_SCHEMA,status:'APPROVED',scope:BUNDLE_SCOPE,
    sourceSha,profileId:'common-job'}:
  {schema:PIN_CAS_SCHEMA,status:'APPROVED_B',scope:PIN_CAS_SCOPE,
    sourceSha,profileId:'common-job'});
function fixture(kind='bundle'){
  const raw=Buffer.from(JSON.stringify(manifest(kind))+'\n');
  const request=req(digest(raw));
  const ev=event(JSON.stringify(request));
  const auth=authorizeApprovedRaw({event:ev,env:env(),raw,
    worktree:raw,actualHead:controlSha});
  return {raw,request,ev,auth};
}

test('fixed owner/private one-shot issue, content digest pinned path',()=>{
  const f=fixture();
  assert.deepEqual(verifyOpenedOwnerIssue(f.ev,env()),f.request);
  assert.equal(approvalPathFor(f.request),
    `approvals/approved-runtime-b/${digest(f.raw)}.json`);
  assert.equal(f.auth.mode,'VERSIONED_BUNDLE_ACTIVATE');
  assert.equal(f.auth.approvalPath,approvalPathFor(f.request));
});

test('scope and sender cannot be self-granted by arbitrary Issue',()=>{
  const f=fixture();
  for(const mutate of [
    e=>{e.issue.title='anything';},
    e=>{e.sender.login='attacker';},
    e=>{e.issue.user.login='attacker';},
    e=>{e.repository.private=false;},
    e=>{e.issue.labels=[];},
    e=>{e.issue.pull_request={};},
    e=>{e.issue.body=JSON.stringify({...f.request,command:'evil.exe'});},
    e=>{e.issue.body=JSON.stringify({...f.request,approvalManifestSha256:'../../etc'});},
  ]){
    const x=structuredClone(f.ev);mutate(x);
    assert.throws(()=>verifyOpenedOwnerIssue(x,env()),/DIRECT_B_/);
  }
  const retry={...env(),GITHUB_RUN_ATTEMPT:'2'};
  assert.throws(()=>verifyOpenedOwnerIssue(f.ev,retry),/DIRECT_B_ISSUE_OWNER_STOP/);
});

test('fixed Git blob identity, working file identity and SHA must all agree',()=>{
  const f=fixture();
  assert.equal(loadApprovedRaw({event:f.ev,env:env(),controlRoot:'/fake',
    readFile:()=>f.raw,gitBlob:(_,rel)=>{
      assert.equal(rel,approvalPathFor(f.request));return f.raw;},
    gitHead:()=>controlSha}).mode,'VERSIONED_BUNDLE_ACTIVATE');
  for(const partial of [
    {raw:Buffer.from('other')},{worktree:Buffer.from('other')},
    {actualHead:'c'.repeat(40)},
  ]){
    assert.throws(()=>authorizeApprovedRaw({event:f.ev,env:env(),
      raw:f.raw,worktree:f.raw,actualHead:controlSha,...partial}),/DIRECT_B_/);
  }
});

test('unreviewed or broadened effects cannot pass manifest authorization',()=>{
  for(const changed of [{...manifest(),scope:'ARBITRARY_SHELL'},
    {...manifest(),status:'PROPOSED'},
    {...manifest(),sourceSha:'main'},
    {...manifest(),profileId:''}]){
    const raw=Buffer.from(JSON.stringify(changed));
    assert.throws(()=>authorizeApprovedRaw({event:event(JSON.stringify(req(digest(raw)))),
      env:env(),raw,worktree:raw,actualHead:controlSha}),/DIRECT_B_/);
  }
});

test('ABSENT native bridge returns first-fail and invokes no writer effect',async()=>{
  const f=fixture();let called=0;
  await assert.rejects(applyApprovedOnce(f.auth,{
    bundleRunner:async()=>{called++;return {status:'PASS'};}}),
    /DIRECT_B_NATIVE_BRIDGE_NOT_INSTALLED/);
  assert.equal(called,0);
});

test('reviewed injected B adapter only: source-only module routing',async()=>{
  for(const kind of ['bundle','pin']){
    const f=fixture(kind);
    let seen;
    const mode=kind==='bundle'?'VERSIONED_BUNDLE_ACTIVATE':'PIN_REGISTRY_CAS';
    const result=await applyApprovedOnce(f.auth,{
      makeApprovedNativeAdapter:async()=>({originVerified:true,
        effect:mode,sourceSha,adapter:{},trustedProfiles:{}}),
      bundleRunner:async arg=>{seen=arg;return {status:'PASS',endToEndDone:true,reportStatus:'JSON_TXT_2_OF_2'};},
      pinRunner:async arg=>{seen=arg;return {status:'PASS',endToEndDone:true,reportStatus:'JSON_TXT_2_OF_2'};}});
    assert.equal(result.status,'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED');
    assert.equal(result.mode,mode);
    assert.equal(seen.pinnedApproval.sourceSha,sourceSha);
    assert.equal(seen.pinnedApproval.requestId,requestId);
    assert.equal(seen.adapter!==undefined,true);
  }
  const f=fixture();
  await assert.rejects(applyApprovedOnce(f.auth,{
    makeApprovedNativeAdapter:async()=>({originVerified:false,
      effect:'VERSIONED_BUNDLE_ACTIVATE',sourceSha,adapter:{}})}),
    /DIRECT_B_NATIVE_BRIDGE_UNVERIFIED/);
});

test('PIN and bundle PASS without complete local JSON/TXT ledger is UNKNOWN',async()=>{
  for(const kind of ['bundle','pin']){
    const f=fixture(kind);
    const mode=kind==='bundle'?'VERSIONED_BUNDLE_ACTIVATE':'PIN_REGISTRY_CAS';
    const result=await applyApprovedOnce(f.auth,{
      makeApprovedNativeAdapter:async()=>({originVerified:true,
        effect:mode,sourceSha,adapter:{},trustedProfiles:{}}),
      bundleRunner:async()=>({status:'PASS',endToEndDone:false,
        reportStatus:'INCOMPLETE',evidenceRecoveryRequired:true}),
      pinRunner:async()=>({status:'PASS',endToEndDone:false,
        reportStatus:'INCOMPLETE',evidenceRecoveryRequired:true})});
    assert.equal(result.status,'DIRECT_B_EFFECT_UNKNOWN');
    assert.equal(result.code,'DIRECT_B_LEDGER_INCOMPLETE');
    assert.equal(result.operationSucceeded,false);
    const cleaned=sanitizeDirectBReport(result,f.request,env());
    assert.equal(cleaned.operationSucceeded,false);
  }
});

test('local success remains explicitly unpublished and cannot fake hashes',()=>{
  const f=fixture();
  const raw={status:'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED',
    code:'DIRECT_B_LOCAL_EFFECT_PASS',requestId,mode:f.auth.mode,
    manifestSha256:digest(f.raw),controlSha,sourceSha,
    operationSucceeded:true,reportStatus:'JSON_TXT_2_OF_2',
    rawApiKey:'do not expose'};
  const clean=sanitizeDirectBReport(raw,f.request,env());
  assert.equal(clean.status,'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED');
  assert.equal(clean.runtimeEffectProof,'LOCAL_EXECUTOR_PASS_REPORT_PENDING');
  assert.equal(clean.rawApiKey,undefined);
  assert.equal(sanitizeDirectBReport({...raw,reportStatus:'INCOMPLETE'},
    f.request,env()).status,'DIRECT_B_STATE_UNKNOWN');
  assert.equal(sanitizeDirectBReport({...raw,sourceSha:'invalid'},f.request,env())
    .status,'DIRECT_B_STATE_UNKNOWN');
});

function fakeGithub({failReadbackTxt=false,ambiguousPut=false}={}){
  const objects=new Map(),calls=[];
  return {calls,objects,async fetch(url,opt){
    calls.push({url,method:opt.method});
    if(opt.method==='PUT'){
      const bytes=Buffer.from(JSON.parse(opt.body).content,'base64');
      if(!ambiguousPut)objects.set(url,bytes);
      return {status:ambiguousPut?409:201};
    }
    if(opt.method==='GET'){
      const key=url.split('?ref=')[0];
      const item=objects.get(key);
      if(!item||(failReadbackTxt&&key.endsWith('.txt')))return {status:404};
      return {status:200,json:async()=>({encoding:'base64',
        content:item.toString('base64')})};
    }
    if(opt.method==='POST')return {status:201};
    throw Error('Unexpected HTTP method');
  }};
}

test('report pair create-only, readback 2/2, bounded proof, no raw secrets',async()=>{
  const f=fixture();const http=fakeGithub();
  const raw={status:'DIRECT_B_PREFLIGHT_STOP',
    code:'DIRECT_B_NATIVE_BRIDGE_NOT_INSTALLED',requestId:null,
    secret:'NEVER_UPLOAD_ME'};
  const result=await uploadDirectBReport({event:f.ev,env:env(),
    rawResult:JSON.stringify(raw),fetchApi:http.fetch});
  assert.equal(result.created,2);
  assert.equal(result.verified,2);
  assert.equal(result.status,'DIRECT_B_PREFLIGHT_STOP');
  assert.equal(http.calls.filter(x=>x.method==='PUT').length,2);
  assert.equal(http.calls.filter(x=>x.method==='POST').length,1);
  assert.equal([...http.objects.values()].some(b=>b.includes('NEVER_UPLOAD_ME')),false);
});

test('ambiguous or partial report cannot be labeled published success or auto-retried',async()=>{
  const f=fixture();
  const ok={status:'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED',
    code:'DIRECT_B_LOCAL_EFFECT_PASS',requestId,mode:'VERSIONED_BUNDLE_ACTIVATE',
    manifestSha256:digest(f.raw),controlSha,sourceSha,
    operationSucceeded:true,reportStatus:'JSON_TXT_2_OF_2'};
  const http=fakeGithub({failReadbackTxt:true});
  const result=await uploadDirectBReport({event:f.ev,env:env(),
    rawResult:JSON.stringify(ok),fetchApi:http.fetch});
  assert.equal(result.status,'DIRECT_B_STATE_UNKNOWN');
  assert.equal(result.delivery,'RESULT_DELIVERY_UNVERIFIED');
  assert.equal(http.calls.filter(x=>x.method==='PUT').length,2);
  const unknown=fakeGithub({ambiguousPut:true});
  const lost=await uploadDirectBReport({event:f.ev,env:env(),
    rawResult:JSON.stringify(ok),fetchApi:unknown.fetch});
  assert.equal(lost.verified,0);
  assert.equal(unknown.calls.filter(x=>x.method==='PUT').length,2);
});

test('workflow remains inert local candidate, exact one-shot Windows shared writer lane',()=>{
  const dir=path.dirname(fileURLToPath(import.meta.url));
  const yml=fs.readFileSync(path.join(dir,'../.github/workflows/pc-approved-runtime-b-once.yml'),'utf8');
  assert.match(yml,/types:\s*\[opened\]/);
  assert.match(yml,/github\.run_attempt == 1/);
  assert.match(yml,/github\.event\.repository\.private == true/);
  assert.match(yml,/github\.event\.issue\.title == 'pc-approved-runtime-b'/);
  assert.match(yml,/zgmini-writer-source-b-one-at-a-time/);
  assert.match(yml,/runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
  assert.match(yml,/persist-credentials: false/);
  assert.match(yml,/report\.mjs/);
  assert.match(yml,/if: always\(\)/);
  assert.equal(DIRECT_B_RESULT,'approved-runtime-b-once-result.json');
});

function configuredApproval(){
  return {schema:'ZGMINI_CONFIGURED_RUNTIME_B_APPROVAL_V1',
    status:'APPROVED_B',scope:'PC_WRITER_CONFIGURED_THEME_REPEAT_UPGRADE_ONLY',
    sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha,
    profileId:'configured-themes',
    runnerPath:'scripts/pc-writer/theme-config-package-runner.mjs',
    packageManifestSha256:'b'.repeat(64),
    runtimeMode:'REPEATABLE_ACTIVE_RUNTIME',
    runtimePreimage:{
      activeRuntimeSha256:'c'.repeat(64),
      taskXmlSha256:'d'.repeat(64),
      scheduledCmdSha256:'e'.repeat(64),
      scheduledVbsSha256:'f'.repeat(64)},
    effects:{providerCalls:false,dbWrites:false,d1Writes:false,
      taskDefinitionChanges:false,newTasks:false,
      otherOperationalFiles:false}};
}
function configuredFixture(manifest=configuredApproval()){
  const raw=Buffer.from(JSON.stringify(manifest)+'\n');
  const request=req(digest(raw));
  const auth=authorizeApprovedRaw({event:event(JSON.stringify(request)),
    env:env(),raw,worktree:raw,actualHead:controlSha});
  return {raw,request,auth};
}
test('configured repeat B has distinct fixed approval profile and pinned preimages',()=>{
  const f=configuredFixture();
  assert.equal(f.auth.mode,'CONFIGURED_THEMES_REPEAT_UPGRADE');
  assert.equal(f.auth.manifest.packageManifestSha256,'b'.repeat(64));
  for(const modify of [
    m=>{m.runnerPath='scripts/arbitrary.mjs';},
    m=>{m.effects.dbWrites=true;},
    m=>{m.runtimeMode='FIRST_SINGLE_CMD_UPGRADE';},
    m=>{m.runtimePreimage.taskXmlSha256=null;},
    m=>{m.profileId='unregistered';},
  ]){
    const m=configuredApproval();modify(m);
    assert.throws(()=>configuredFixture(m),/DIRECT_B_EFFECT_SCOPE_STOP/);
  }
});
test('configured B routes exact pinned manifest into existing dispatcher',async()=>{
  const f=configuredFixture();let calls=0;
  const result=await applyApprovedOnce(f.auth,{configuredRunner:async pins=>{
    calls++;assert.equal(pins.requestId,requestId);
    assert.equal(pins.sourceSha,sourceSha);
    assert.equal(pins.approvalSha256,digest(f.raw));
    assert.equal(pins.packageManifestSha256,'b'.repeat(64));
    assert.deepEqual(pins.runtimePreimage,f.auth.manifest.runtimePreimage);
    return {status:'DONE',sourceSha,
      verified:'PC_RUNTIME_SOURCE_TASK_MANUAL_ACTIVE_ROLLBACK'};
  }});
  assert.equal(calls,1);
  assert.equal(result.mode,'CONFIGURED_THEMES_REPEAT_UPGRADE');
  assert.equal(result.status,'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED');
  const cleaned=sanitizeDirectBReport(result,f.request,env());
  assert.equal(cleaned.mode,'CONFIGURED_THEMES_REPEAT_UPGRADE');
  assert.equal(cleaned.status,'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED');
  const http=fakeGithub();
  const delivered=await uploadDirectBReport({event:event(JSON.stringify(f.request)),
    env:env(),rawResult:JSON.stringify(result),fetchApi:http.fetch});
  assert.equal(delivered.verified,2);
  assert.equal(delivered.status,'DIRECT_B_EFFECT_PASS_NOT_PUBLISHED');
});
test('missing fixed Windows receiver blocks configured B before install',async()=>{
  const f=configuredFixture();
  const result=await applyApprovedOnce(f.auth);
  assert.equal(result.status,'DIRECT_B_EFFECT_BLOCKED');
  assert.equal(result.operationSucceeded,false);
  const wrongSource=await applyApprovedOnce(f.auth,{configuredRunner:async()=>({
    status:'DONE',sourceSha:'a'.repeat(40),
    verified:'PC_RUNTIME_SOURCE_TASK_MANUAL_ACTIVE_ROLLBACK'})});
  assert.equal(wrongSource.status,'DIRECT_B_EFFECT_BLOCKED');
  const uncertain=await applyApprovedOnce(f.auth,{configuredRunner:async()=>({
    status:'STATE_UNKNOWN'})});
  assert.equal(uncertain.status,'DIRECT_B_EFFECT_UNKNOWN');
});
