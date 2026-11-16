import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareExactGuardCandidate,authorize,runApprovedGuard,
 REPO,OP,REQUEST_SCHEMA,APPROVAL_SCHEMA,SCOPE,TARGET,BEFORE_SHA,
 BEFORE_BYTES,PATCH,SHA} from '../tools/w03-r179-seven-readback-b.mjs';
import {sanitize} from '../tools/w03-r179-seven-readback-report.mjs';

const control='2086cfd9fb2e3f00237776dc95cdb83115ccfac1';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fixture=(pattern='if(got.length!==7)throw Error("PUBLIC_API_ROLLING_MISMATCH");const themes=[];')=>{
 assert.ok(Buffer.byteLength(pattern)<=BEFORE_BYTES);
 return Buffer.from(pattern+' '.repeat(BEFORE_BYTES-Buffer.byteLength(pattern)));
};
const manifest=()=>({schema:APPROVAL_SCHEMA,status:'APPROVED_B',
 scope:SCOPE,operation:OP,controlSourceSha:control,targetPath:TARGET,
 beforeSha256:BEFORE_SHA,beforeBytes:BEFORE_BYTES,patchId:PATCH,maxAttempts:1,
 allowProviderCalls:false,allowSqliteWrites:false,allowD1Writes:false,
 allowTaskChanges:false,allowOtherSourceChanges:false});
const request=(bytes)=>({schema:REQUEST_SCHEMA,operation:OP,
 requestId:'a9f304a0-810c-46b8-935b-2e4ad944d75f',
 chatId:'25acc496-3bb0-457c-a220-63bdf9bd657c',
 controlRepository:REPO,approvalManifestPath:
 'approvals/w03-r179-guard/r179-readback-v1.json',
 approvalManifestSha256:sha(bytes)});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:control,GITHUB_RUN_ID:'43810000001'});
const event=body=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},
 issue:{number:1640,user:{login:'ansqhd5774-Choi'},title:OP,
 labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(body)}});
const permission=()=>{const bytes=Buffer.from(JSON.stringify(manifest())+'\n');
 return {bytes,req:request(bytes),event:event(request(bytes)),env:env()};};

test('exact single 7->at least 7 readback token only; source never copied to public JSON',()=>{
 const original=fixture();
 const expected=sha(original);
 const out=prepareExactGuardCandidate(original,expected);
 const after=out.getCandidateBytes();
 assert.equal(out.status,'PREPARED_IN_MEMORY_NOT_INSTALLED');
 assert.equal(out.changedBytes,-2);
 assert.equal(after.length,original.length-2);
 assert.equal(sha(after),out.afterSha256);
 assert.equal(after.toString('utf8'),original.toString('utf8').replace('got.length!==7','got.length<7'));
 assert.equal(JSON.stringify(out).includes('const themes'),false);
 assert.notEqual(BEFORE_SHA,expected);
});
test('candidate hard-stops for bad SHA, absent/multiple token, missing context and wrong length',()=>{
 const good=fixture();
 assert.throws(()=>prepareExactGuardCandidate(good),{code:'W03_R179_GUARD_PREIMAGE_SHA_STOP'});
 const bad=[
  fixture('const themes=[]; const got=[]; throw Error("PUBLIC_API_ROLLING_MISMATCH");'),
  fixture('if(got.length!==7||got.length!==7)throw Error("PUBLIC_API_ROLLING_MISMATCH"); const themes=[];'),
  fixture('const themes=[]; if(got.length!==7)throw Error("WRONG_CODE");'),
 ];
 const codes=['W03_R179_GUARD_NOT_UNIQUE_STOP',
  'W03_R179_GUARD_NOT_UNIQUE_STOP',
  'W03_R179_GUARD_READBACK_CONTEXT_STOP'];
 bad.forEach((bytes,i)=>assert.throws(()=>prepareExactGuardCandidate(bytes,sha(bytes)),
  {code:codes[i]}));
 assert.throws(()=>prepareExactGuardCandidate(Buffer.alloc(3),sha(Buffer.alloc(3))),
  {code:'W03_R179_GUARD_PREIMAGE_SIZE_STOP'});
});
test('single use protected B manifest identity and no effect scope',()=>{
 const {bytes,req,event:ev,env:e}=permission();
 const proof=authorize({event:ev,env:e,manifestBytes:bytes});
 assert.equal(proof.manifest.maxAttempts,1);
 for(const mutate of [
  e=>e.issue.title='pc-writer-source-install',
  e=>e.issue.labels=[],
  e=>{const b=JSON.parse(e.issue.body);b.requestId='not-uuid';e.issue.body=JSON.stringify(b);},
 ]){
  const n=structuredClone(ev);mutate(n);
  assert.throws(()=>authorize({event:n,env:e,manifestBytes:bytes}),
   {code:/^W03_R179_B_/});
 }
 const m={...manifest(),allowD1Writes:true},wrong=Buffer.from(JSON.stringify(m)+'\n');
 const badReq=request(wrong);
 assert.throws(()=>authorize({event:event(badReq),env:e,manifestBytes:wrong}),
  {code:'W03_R179_B_APPROVAL_STOP'});
 assert.equal(req.controlRepository,REPO);
});
function ioFixture(bytes,{onRead=()=>{}}={}){
 let stored=Buffer.from(bytes),backup=null,lock=false,claimed=false,swaps=0;
 const journal=[];
 return {io:{
  acquire:async()=>{assert.equal(lock,false);lock=true;},
  read:async target=>{assert.equal(target,TARGET);assert.equal(lock,true);
   onRead({stored,swaps});return Buffer.from(stored);},
  claim:async()=>{assert.equal(lock,true);claimed=true;},
  backup:async()=>{assert.equal(claimed,true);backup=Buffer.from(stored);return Buffer.from(stored);},
  journal:async(_,stage)=>{journal.push(stage);},
  replace:async(_,value)=>{assert.equal(claimed,true);stored=Buffer.from(value);swaps++;},
  restore:async(_,value)=>{stored=Buffer.from(value);swaps++;},
  release:async()=>{lock=false;}
 },state:()=>({stored,backup,lock,claimed,swaps,journal})};
}
test('approved transaction changes one file under exclusive claim and restores on ambiguous readback',async()=>{
 const {bytes,event:ev,env:e}=permission();
 const proof=authorize({event:ev,env:e,manifestBytes:bytes});
 const original=fixture(),f=ioFixture(original);
 const prep=bytes=>prepareExactGuardCandidate(bytes,sha(bytes));
 const result=await runApprovedGuard(proof,f.io,{prepare:prep});
 assert.equal(result.status,'APPLIED_VERIFIED');
 assert.equal(result.applied,true);
 assert.equal(result.changedFileCount,1);
 assert.equal(result.changedByteCount,-2);
 assert.equal(f.state().swaps,1);
 assert.equal(f.state().lock,false);
 assert.equal(f.state().stored.includes(Buffer.from('got.length<7')),true);
 assert.equal(f.state().journal.at(-1),'APPLIED_VERIFIED');
 const r=sanitize({...result,requestId:ev.issue.body?JSON.parse(ev.issue.body).requestId:null,
  controlSha:control,manifestSha256:sha(bytes)},request(bytes),env());
 // Fixture differs from actual pinned before SHA: reporter must refuse and never fake success.
 assert.equal(r.status,'STATE_UNKNOWN');
});
test('one-shot preflight drift cannot consume claim, write or touch D1',async()=>{
 const {bytes,event:ev,env:e}=permission(),proof=authorize({event:ev,env:e,manifestBytes:bytes});
 const fixtureIO=ioFixture(fixture());
 const result=await runApprovedGuard(proof,fixtureIO.io);
 assert.equal(result.status,'PREFLIGHT_STOP');
 assert.equal(result.applied,false);
 assert.equal(fixtureIO.state().claimed,false);
 assert.equal(fixtureIO.state().swaps,0);
 assert.equal(fixtureIO.state().lock,false);
 assert.equal(result.d1Writes,0);
});
test('publisher receipt cannot claim a D1 write or unverified install',()=>{
 const p=permission(),req=p.req;
 const item={requestId:req.requestId,status:'APPLIED_VERIFIED',
  code:'W03_R179_B_SEVEN_CORE_READBACK_PATCHED',applied:true,
  changedFileCount:1,changedByteCount:-2,backupVerified:true,
  beforeSha256:BEFORE_SHA,afterSha256:'a'.repeat(64),
  controlSha:p.env.GITHUB_SHA,manifestSha256:req.approvalManifestSha256,
  providerCalls:0,sqliteWrites:0,d1Writes:0,taskChanges:0,otherSourceWrites:0};
 const r=sanitize(item,req,p.env);
 assert.equal(r.status,'APPLIED_VERIFIED');
 assert.equal(r.d1Writes,0);
 assert.equal(sanitize({...item,d1Writes:1},req,p.env).status,'STATE_UNKNOWN');
 assert.equal(sanitize({...item,backupVerified:false},req,p.env).status,'STATE_UNKNOWN');
 assert.equal(sanitize({...item,afterSha256:'NOT_SHA'},req,p.env).status,'STATE_UNKNOWN');
});
