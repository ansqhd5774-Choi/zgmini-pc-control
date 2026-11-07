import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {changeProviderFlags} from './patch.mjs';
import {FLAGS,FILE,APPROVAL_SCHEMA,SCOPE,verifyApproval,
  authorize,REQUEST_SCHEMA,OPERATION,CONTROL_REPO,ACTOR,ISSUE_TITLE,ISSUE_LABEL,
  sha256} from './contract.mjs';
import {applyApprovedFlags,loadAuthorization} from './run.mjs';
import {sanitizeReport,uploadReport} from './report.mjs';

const manifest={schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
  targetPath:FILE,changes:FLAGS.map(key=>({key,value:'1'})),runCount:1,
  allowOtherChanges:false,allowProviderCalls:false,allowTaskChanges:false,
  allowSourceChanges:false,allowDbWrites:false};
const request=()=>({schema:REQUEST_SCHEMA,requestId:randomUUID(),
  chatId:randomUUID(),operation:OPERATION,controlRepository:CONTROL_REPO,
  approvalManifestPath:'approvals/writer-config/inflation19-flags-20261108.json',
  approvalManifestSha256:sha256(Buffer.from(JSON.stringify(manifest)))});
const event=req=>({repository:{full_name:CONTROL_REPO,private:true},
  sender:{login:ACTOR},issue:{number:712,title:ISSUE_TITLE,
    user:{login:ACTOR},labels:[{name:ISSUE_LABEL}],body:JSON.stringify(req)}});
const env={GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:ACTOR,GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123'};

test('exact 2-key contract rejects arbitrary env keys and side effects',()=>{
  assert.equal(verifyApproval(manifest),manifest);
  assert.throws(()=>verifyApproval({...manifest,changes:[...manifest.changes,
    {key:'API_KEY',value:'1'}]}));
  assert.throws(()=>verifyApproval({...manifest,allowProviderCalls:true}));
  assert.throws(()=>verifyApproval({...manifest,targetPath:'C:\\other.env'}));
});
test('issue owner, unique request and raw manifest hash are required',()=>{
  const req=request();
  const ok=authorize({event:event(req),env,manifestBytes:Buffer.from(JSON.stringify(manifest))});
  assert.equal(ok.request.requestId,req.requestId);
  assert.throws(()=>authorize({event:event(req),env,
    manifestBytes:Buffer.from(JSON.stringify({...manifest,runCount:2}))}));
  assert.throws(()=>authorize({event:{...event(req),sender:{login:'other'}},env,
    manifestBytes:Buffer.from(JSON.stringify(manifest))}));
});
test('workspace manifest must match exact owner event and pinned control SHA',()=>{
  const req=request(),root=fs.mkdtempSync(path.join(os.tmpdir(),'config-b-auth-'));
  const sub=path.join(root,'approvals','writer-config');
  fs.mkdirSync(sub,{recursive:true});
  fs.writeFileSync(path.join(sub,'inflation19-flags-20261108.json'),
    JSON.stringify(manifest));
  const e={...env,GITHUB_EVENT_PATH:path.join(root,'event.json')};
  fs.writeFileSync(e.GITHUB_EVENT_PATH,JSON.stringify(event(req)));
  const auth=loadAuthorization({env:e,controlRoot:root,head:()=>env.GITHUB_SHA});
  assert.equal(auth.request.requestId,req.requestId);
  assert.throws(()=>loadAuthorization({env:e,controlRoot:root,
    head:()=> 'b'.repeat(40)}),{code:'PROVIDER_B_CONTROL_SHA_STOP'});
  fs.writeFileSync(path.join(sub,'inflation19-flags-20261108.json'),
    JSON.stringify({...manifest,runCount:2}));
  assert.throws(()=>loadAuthorization({env:e,controlRoot:root,
    head:()=>env.GITHUB_SHA}),{code:'PROVIDER_B_MANIFEST_HASH_STOP'});
});
test('CRLF, BOM, comments, secret bytes and unrelated keys preserved',()=>{
  const secret='FRED_API_KEY=sensitive-super-secret';
  const original=Buffer.from('\uFEFF'+secret+'\r\n' +
    'ZGMINI_INFL19_RECURRING_APPROVED="0" # approval\r\n'+
    'UNRELATED=바이트 유지\r\nZGMINI_INFL19_GAS_DAILY_APPROVED=false\r\n');
  const x=changeProviderFlags(original);
  assert.equal(x.changed,true);
  assert.equal(x.bytes.toString().includes(secret+'\r\n'),true);
  assert.equal(x.bytes.toString().includes('UNRELATED=바이트 유지\r\n'),true);
  assert.equal(x.bytes.toString().includes('ZGMINI_INFL19_RECURRING_APPROVED=1 # approval'),true);
  assert.equal(changeProviderFlags(x.bytes).changed,false);
  assert.equal(x.bytes[0],0xef);
});
test('absent keys append, EOF and LF preserved',()=>{
  const orig=Buffer.from('X=1\nY=2');
  const x=changeProviderFlags(orig);
  assert.equal(x.bytes.toString(),`X=1\nY=2\n${FLAGS[0]}=1\n${FLAGS[1]}=1\n`);
  assert.equal(changeProviderFlags(x.bytes).changed,false);
});
test('duplicate, export, ambiguous and invalid encoding always STOP',()=>{
  assert.throws(()=>changeProviderFlags(Buffer.from(`${FLAGS[0]}=0\n${FLAGS[0]}=1`)),
    {code:'PROVIDER_B_DUPLICATE_FLAG_STOP'});
  assert.throws(()=>changeProviderFlags(Buffer.from(`export ${FLAGS[0]}=0`)),
    {code:'PROVIDER_B_AMBIGUOUS_ASSIGNMENT_STOP'});
  assert.throws(()=>changeProviderFlags(Buffer.from(`${FLAGS[0]}=$(bad)`)),
    {code:'PROVIDER_B_AMBIGUOUS_ASSIGNMENT_STOP'});
  assert.throws(()=>changeProviderFlags(Buffer.from([0xff,0xfe,0xfd])),
    {code:'PROVIDER_B_ENCODING_STOP'});
  assert.throws(()=>changeProviderFlags(Buffer.from(`${FLAGS[0].toLowerCase()}=0`)),
    {code:'PROVIDER_B_NONCANONICAL_FLAG_STOP'});
});
function sandbox(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-config-b-test-'));
  const target=path.join(root,'providers.env');
  const journalRoot=path.join(root,'journals');
  const sharedLock=path.join(root,'source-install.lock');
  return {root,target,journalRoot,sharedLock};
}
function auth(){const req=request();return {request:req,controlSha:'a'.repeat(40)};}
test('full exact B apply: one-shot lock, backup and no secret disclosure',()=>{
  const envFile=sandbox();
  const original=Buffer.from('API_KEY=secret-do-not-print\r\nX=keep\r\n');
  fs.writeFileSync(envFile.target,original);
  const a=auth(),r=applyApprovedFlags(a,envFile);
  assert.equal(r.status,'PROVIDER_B_APPLIED_VERIFIED');
  assert.equal(r.backupVerified,true);
  assert.deepEqual(r.changedKeys,FLAGS);
  assert.equal(fs.existsSync(envFile.sharedLock),false);
  assert.equal(fs.readFileSync(path.join(envFile.journalRoot,a.request.requestId,
    'providers.original.bin')).equals(original),true);
  assert.equal(fs.readFileSync(envFile.target,'utf8').includes('API_KEY=secret-do-not-print'),true);
  assert.equal(JSON.stringify(r).includes('secret-do-not-print'),false);
  const replay=applyApprovedFlags(a,envFile);
  assert.equal(replay.status,'PROVIDER_B_PREFLIGHT_STOP');
});
test('shared Writer lock contention: no env change, no request claim',()=>{
  const e=sandbox(),original=Buffer.from('X=unchanged\n');fs.writeFileSync(e.target,original);
  fs.writeFileSync(e.sharedLock,'other-writer-source');
  const a=auth(),r=applyApprovedFlags(a,e);
  assert.equal(r.status,'PROVIDER_B_PREFLIGHT_STOP');
  assert.equal(r.code,'PROVIDER_B_SHARED_WRITER_BUSY_STOP');
  assert.equal(fs.readFileSync(e.target).equals(original),true);
  assert.equal(fs.existsSync(path.join(e.journalRoot,a.request.requestId)),false);
});
test('CAS drift before switch: keep concurrent edit, do not rollback it',()=>{
  const e=sandbox(),original=Buffer.from('X=unchanged\n');fs.writeFileSync(e.target,original);
  const a=auth();
  const r=applyApprovedFlags(a,{...e,beforeSwitch:()=>fs.writeFileSync(e.target,'X=concurrent\n')});
  assert.equal(r.status,'PROVIDER_B_STOP_UNTOUCHED');
  assert.equal(r.code,'PROVIDER_B_CONCURRENT_FILE_DRIFT_STOP');
  assert.equal(fs.readFileSync(e.target,'utf8'),'X=concurrent\n');
});
test('report outputs only safe fixed keys, hashes and codes',()=>{
  const req=request();
  const raw={status:'PROVIDER_B_APPLIED_VERIFIED',code:'PROVIDER_B_TWO_FLAGS_SET',
    requestId:req.requestId,changedKeys:FLAGS,manifestSha256:req.approvalManifestSha256,
    controlSha:'a'.repeat(40),beforeSha256:'a'.repeat(64),
    afterSha256:'b'.repeat(64),backupVerified:true,
    SECRET:'never-return-me'};
  const result=sanitizeReport(raw,req,env);
  assert.equal(JSON.stringify(result).includes('never-return-me'),false);
  assert.deepEqual(result.changedKeys,FLAGS);
  assert.equal(sanitizeReport({...raw,changedKeys:['API_KEY']},req,env).status,
    'PROVIDER_B_STATE_UNKNOWN');
  assert.equal(sanitizeReport({...raw,code:'PROVIDER_B_SOME_OTHER_CODE'},req,env).status,
    'PROVIDER_B_STATE_UNKNOWN');
});
test('create-only JSON/TXT 2/2 exact GET readback and bounded comment',async()=>{
  const req=request(),e=event(req),files=new Map(),writes=[];
  const fakeFetch=async(url,opts)=>{
    if(url.includes('/comments')){
      const comment=JSON.parse(opts.body).body;
      assert.equal(comment.includes('secret-never'),false);
      return {status:201};
    }
    const clean=url.replace('?ref=main','');
    if(opts.method==='PUT'){
      assert.equal(files.has(clean),false);
      files.set(clean,JSON.parse(opts.body).content);writes.push(clean);
      return {status:201};
    }
    if(opts.method==='GET')return {status:files.has(clean)?200:404,
      json:async()=>({encoding:'base64',content:files.get(clean)})};
    throw new Error('unexpected request');
  };
  const report=await uploadReport({event:e,
    env:{...env,GITHUB_TOKEN:'x'.repeat(25)},
    rawResult:JSON.stringify({status:'PROVIDER_B_APPLIED_VERIFIED',
      code:'PROVIDER_B_TWO_FLAGS_SET',requestId:req.requestId,
      changedKeys:FLAGS,manifestSha256:req.approvalManifestSha256,
      controlSha:env.GITHUB_SHA,beforeSha256:'a'.repeat(64),
      afterSha256:'b'.repeat(64),backupVerified:true,
      SECRET:'secret-never'}),fetchApi:fakeFetch});
  assert.equal(report.delivery,'RESULT_PAIR_READBACK_VERIFIED');
  assert.equal(report.verified,2);
  assert.equal(writes.length,2);
  assert.equal([...files.values()].some(v=>
    Buffer.from(v,'base64').toString().includes('secret-never')),false);
});
test('one JSON upload failure cannot be called 2/2 verified',async()=>{
  const req=request(),e=event(req),files=new Map();
  const fakeFetch=async(url,opts)=>{
    if(url.includes('/comments')){
      assert.equal(JSON.parse(opts.body).body.includes('RESULT_DELIVERY_UNVERIFIED'),true);
      return {status:201};
    }
    const clean=url.replace('?ref=main','');
    if(opts.method==='PUT'){
      if(clean.endsWith('.json'))return {status:403};
      files.set(clean,JSON.parse(opts.body).content);return {status:201};
    }
    if(opts.method==='GET')return {status:files.has(clean)?200:404,
      json:async()=>({encoding:'base64',content:files.get(clean)})};
  };
  const result=await uploadReport({event:e,
    env:{...env,GITHUB_TOKEN:'x'.repeat(25)},
    rawResult:JSON.stringify({status:'PROVIDER_B_STOP_RESTORED',
      code:'PROVIDER_B_BACKUP_READBACK_STOP',requestId:req.requestId}),
    fetchApi:fakeFetch});
  assert.equal(result.delivery,'RESULT_DELIVERY_UNVERIFIED');
  assert.equal(result.verified,1);
  assert.equal(result.status,'PROVIDER_B_STATE_UNKNOWN');
});
