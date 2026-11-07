import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SCOPE,CANDIDATE_SCOPE,FILE,FLAGS,CANDIDATE_FLAGS,
  verifyApproval,authorize,flagProfileForPath,isAllowedManifestPath,sha256} from './contract.mjs';
import {changeProviderFlags} from './patch.mjs';
import {sanitizeReport} from './report.mjs';
import {applyApprovedFlags} from './run.mjs';

const legacyPath='approvals/writer-config/inflation19-flags-fixture0001.json';
const candidatePath='approvals/writer-config/inflation-candidate-flags-fixture0001.json';
const profileManifest=(scope,keys)=>({
 schema:'ZGMINI_WRITER_PROVIDER_FLAGS_B_APPROVAL_V1',
 status:'APPROVED_B',scope,targetPath:FILE,
 changes:keys.map(key=>({key,value:'1'})),runCount:1,
 allowOtherChanges:false,allowProviderCalls:false,allowTaskChanges:false,
 allowSourceChanges:false,allowDbWrites:false,
});
const expectCode=(fn,code)=>assert.throws(fn,e=>e?.code===code);
const hex40='a'.repeat(40),hex64='b'.repeat(64);
const mkRequest=path=>({schema:'ZGMINI_WRITER_PROVIDER_FLAGS_B_REQUEST_V1',
 requestId:randomUUID(),chatId:randomUUID(),
 operation:'pc-writer-provider-flags-once',
 controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
 approvalManifestPath:path,approvalManifestSha256:hex64});
const env=()=>({
 GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
 GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:hex40,
});
const issue=req=>({repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
 sender:{login:'ansqhd5774-Choi'},
 issue:{user:{login:'ansqhd5774-Choi'},title:'pc-writer-provider-flags-once',
 labels:[{name:'pc-writer-b-install'}],number:42,body:JSON.stringify(req)}});

test('two profile paths are exact, distinct and cannot be broadened',()=>{
 assert.equal(isAllowedManifestPath(legacyPath),true);
 assert.equal(isAllowedManifestPath(candidatePath),true);
 for(const bad of ['approvals/writer-config/foo-flags-fixture0001.json',
  'approvals/writer-config/inflation-candidate-flags-../xxx.json',
  'approvals/writer-config/inflation-candidate-flags-fixture0001.json/extra']){
  assert.equal(isAllowedManifestPath(bad),false);
 }
 assert.deepEqual(flagProfileForPath(candidatePath)?.flags,CANDIDATE_FLAGS);
 assert.deepEqual(flagProfileForPath(legacyPath)?.flags,FLAGS);
});
test('legacy and candidate exact-two-key approval only, swapped profile blocked',()=>{
 const legacy=profileManifest(SCOPE,FLAGS),candidate=profileManifest(CANDIDATE_SCOPE,CANDIDATE_FLAGS);
 assert.equal(verifyApproval(legacy,{approvalManifestPath:legacyPath}),legacy);
 assert.equal(verifyApproval(candidate,{approvalManifestPath:candidatePath}),candidate);
 assert.equal(verifyApproval(legacy),legacy);
 expectCode(()=>verifyApproval(candidate),'PROVIDER_B_MANIFEST_PROFILE_STOP');
 expectCode(()=>verifyApproval(candidate,{approvalManifestPath:legacyPath}),
  'PROVIDER_B_MANIFEST_PROFILE_STOP');
 expectCode(()=>verifyApproval(legacy,{approvalManifestPath:candidatePath}),
  'PROVIDER_B_MANIFEST_PROFILE_STOP');
 expectCode(()=>verifyApproval(candidate,{approvalManifestPath:'approvals/writer-config/unknown.json'}),
  'PROVIDER_B_MANIFEST_PROFILE_STOP');
 for(const m of [
  {...candidate,changes:[...candidate.changes,{key:'API_KEY',value:'1'}]},
  {...candidate,changes:[{key:CANDIDATE_FLAGS[1],value:'1'},{key:CANDIDATE_FLAGS[0],value:'1'}]},
  {...candidate,changes:[{key:CANDIDATE_FLAGS[0],value:'1'},{key:'API_KEY',value:'1'}]},
  {...candidate,allowProviderCalls:true}
 ])expectCode(()=>verifyApproval(m,{approvalManifestPath:candidatePath}),
  m.allowProviderCalls?'PROVIDER_B_MANIFEST_SCOPE_STOP':'PROVIDER_B_CHANGE_SCOPE_STOP');
});
test('one-shot exact owner issue, pinned manifest bytes and profile cannot be forged',()=>{
 const manifest=profileManifest(CANDIDATE_SCOPE,CANDIDATE_FLAGS);
 const bytes=Buffer.from(JSON.stringify(manifest));
 const req={...mkRequest(candidatePath),approvalManifestSha256:sha256(bytes)};
 const auth=authorize({event:issue(req),env:env(),manifestBytes:bytes});
 assert.equal(auth.manifest.scope,CANDIDATE_SCOPE);
 assert.equal(auth.request.requestId,req.requestId);
 expectCode(()=>authorize({event:issue({...req,approvalManifestPath:legacyPath}),env:env(),manifestBytes:bytes}),
  'PROVIDER_B_MANIFEST_PROFILE_STOP');
 expectCode(()=>authorize({event:issue({...req,approvalManifestSha256:hex64}),env:env(),manifestBytes:bytes}),
  'PROVIDER_B_MANIFEST_HASH_STOP');
});
test('candidate flags preserve secret, legacy flags and CRLF bytes; second pass unchanged',()=>{
 const input=Buffer.from('API_SECRET=sensitive-hidden\r\nZGMINI_INFL19_RECURRING_APPROVED=1\r\n# comment\r\n','utf8');
 const result=changeProviderFlags(input,CANDIDATE_FLAGS);
 assert.equal(result.changed,true);
 const text=result.bytes.toString('utf8');
 assert.ok(text.startsWith(input.toString('utf8')));
 assert.ok(text.includes(CANDIDATE_FLAGS[0]+'=1\r\n'));
 assert.ok(text.includes(CANDIDATE_FLAGS[1]+'=1\r\n'));
 assert.equal(result.changedKeys.length,2);
 assert.equal(changeProviderFlags(result.bytes,CANDIDATE_FLAGS).changed,false);
 assert.equal(sha256(input),result.beforeSha256);
 assert.equal(sha256(result.bytes),result.afterSha256);
});
test('legacy default behavior unchanged, candidate flags remain untouched',()=>{
 const input=Buffer.from('ZGMINI_INFLATION_CANDIDATE_CORE_APPROVED=0\nSECRET=hidden\n');
 const result=changeProviderFlags(input);
 assert.equal(result.changed,true);
 assert.ok(result.bytes.toString('utf8').startsWith(input.toString('utf8')));
 for(const key of FLAGS)assert.ok(result.bytes.toString('utf8').includes(key+'=1'));
 assert.equal(changeProviderFlags(result.bytes).changed,false);
});
test('malformed target keys, duplicates and mixed profiles denied',()=>{
 const duplicate=Buffer.from(CANDIDATE_FLAGS[0]+'=0\n'+CANDIDATE_FLAGS[0]+'=1\n');
 expectCode(()=>changeProviderFlags(duplicate,CANDIDATE_FLAGS),'PROVIDER_B_DUPLICATE_FLAG_STOP');
 expectCode(()=>changeProviderFlags(Buffer.from('x=y\n'),['UNAPPROVED','KEY']),
  'PROVIDER_B_PROFILE_KEYS_STOP');
 const wrongCase=Buffer.from(CANDIDATE_FLAGS[0].toLowerCase()+'=0\n');
 expectCode(()=>changeProviderFlags(wrongCase,CANDIDATE_FLAGS),'PROVIDER_B_NONCANONICAL_FLAG_STOP');
});
test('candidate full one-shot B transaction changes only candidate flags, preserves old flags and secrets',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-candidate-b-'));
 const target=path.join(root,'providers.env');
 const journalRoot=path.join(root,'journal');
 const sharedLock=path.join(root,'writer-shared.lock');
 const original=Buffer.from('API_KEY=private\r\n'+FLAGS[0]+'=0\r\n'+FLAGS[1]+'=1\r\n');
 fs.writeFileSync(target,original);
 const manifest=profileManifest(CANDIDATE_SCOPE,CANDIDATE_FLAGS);
 const req=mkRequest(candidatePath);
 const auth={request:req,manifest,controlSha:hex40};
 const r=applyApprovedFlags(auth,{target,journalRoot,sharedLock});
 assert.equal(r.status,'PROVIDER_B_APPLIED_VERIFIED');
 assert.deepEqual(r.changedKeys,CANDIDATE_FLAGS);
 assert.ok(fs.readFileSync(target,'utf8').startsWith(original.toString('utf8')));
 assert.equal(r.backupVerified,true);
 assert.ok(fs.readFileSync(target+'.provider-b-'+req.requestId+'.original.bin').equals(original));
 assert.equal(fs.existsSync(sharedLock),false);
 assert.equal(JSON.stringify(r).includes('private'),false);
 assert.equal(applyApprovedFlags(auth,{target,journalRoot,sharedLock}).status,
  'PROVIDER_B_PREFLIGHT_STOP');
});
test('candidate B transaction rejects legacy-path or missing-manifest spoof without modifying file',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-candidate-b-negative-'));
 const target=path.join(root,'providers.env');
 const journalRoot=path.join(root,'journal');
 const sharedLock=path.join(root,'writer-shared.lock');
 const original=Buffer.from('API_KEY=keep\n');fs.writeFileSync(target,original);
 const req=mkRequest(legacyPath);
 const auth={request:req,manifest:profileManifest(CANDIDATE_SCOPE,CANDIDATE_FLAGS),controlSha:hex40};
 expectCode(()=>applyApprovedFlags(auth,{target,journalRoot,sharedLock}),
  'PROVIDER_B_PROFILE_KEYS_STOP');
 expectCode(()=>applyApprovedFlags({request:{...req,approvalManifestPath:candidatePath},controlSha:hex40},
  {target,journalRoot,sharedLock}),'PROVIDER_B_PROFILE_KEYS_STOP');
 assert.ok(fs.readFileSync(target).equals(original));
 assert.equal(fs.existsSync(journalRoot),false);
 assert.equal(fs.existsSync(sharedLock),false);
});
test('sanitized report selects approved keys from manifest path, never leaks raw data',()=>{
 const req=mkRequest(candidatePath);const input={
 status:'PROVIDER_B_APPLIED_VERIFIED',code:'PROVIDER_B_TWO_FLAGS_SET',
 changedKeys:[...CANDIDATE_FLAGS],requestId:req.requestId,
 manifestSha256:req.approvalManifestSha256,
 controlSha:hex40,beforeSha256:hex64,afterSha256:hex64,backupVerified:true,
 irrelevant:'secret',
 };
 const output=sanitizeReport(input,req,{GITHUB_RUN_ID:'10042'});
 assert.equal(output.status,'PROVIDER_B_APPLIED_VERIFIED');
 assert.deepEqual(output.changedKeys,CANDIDATE_FLAGS);
 assert.equal('irrelevant' in output,false);
 assert.equal(sanitizeReport({...input,changedKeys:FLAGS},req,{GITHUB_RUN_ID:'10042'}).status,'PROVIDER_B_STATE_UNKNOWN');
 assert.equal(sanitizeReport(input,{...req,approvalManifestPath:legacyPath},{GITHUB_RUN_ID:'10042'}).status,
  'PROVIDER_B_STATE_UNKNOWN');
});
