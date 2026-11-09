import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {inspectR6ActivationCheckout} from './activation-context.mjs';
import {R6_ONE_SHOT} from './contract.mjs';

const H='a'.repeat(40),S='b'.repeat(40),A='c'.repeat(40);
const manifest={schema:R6_ONE_SHOT.approvalSchema,
  approvalState:'APPROVED_B_ONE_SHOT',scope:R6_ONE_SHOT.scope,
  sourceRepository:R6_ONE_SHOT.sourceRepository,sourceSha:S,controlSha:H,
  coreDatabasePath:R6_ONE_SHOT.coreDatabasePath,runCount:1,
  maxBlsRequests:18,maxDolRequests:2,maxTotalRequests:20,
  blsUnregistered24hLimit:25,allowProviderCalls:true,
  allowLocalRawDbWrites:true,allowD1Writes:false,
  allowSchedulerChanges:false,allowCoreSourceChanges:false,
  maxAutomaticRetries:0};
const M=Buffer.from(JSON.stringify(manifest));
const SHA=createHash('sha256').update(M).digest('hex');

function fixture(callback){
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-activation-'));
  try{
    const root=path.join(workspace,'r6-activation');
    fs.mkdirSync(path.join(root,'r6-backfill-b'),{recursive:true});
    fs.writeFileSync(path.join(root,'r6-backfill-b','activation-pins.json'),
      JSON.stringify({schema:'ZGMINI_R6_B_WORKFLOW_APPROVAL_PINS_V1',
      controlSha:H,sourceSha:S,approvalManifestSha256:SHA}));
    fs.writeFileSync(path.join(root,'r6-backfill-b','approved-effect-manifest.json'),M);
    const requestId=randomUUID(),chatId=randomUUID();
    const event={action:'opened',repository:{private:true,full_name:R6_ONE_SHOT.repository},
      sender:{login:R6_ONE_SHOT.owner},issue:{title:R6_ONE_SHOT.issueTitle,
      user:{login:R6_ONE_SHOT.owner},labels:[{name:R6_ONE_SHOT.issueLabel}],
      body:JSON.stringify({schema:R6_ONE_SHOT.schema,operation:'employment-r6-backfill-once',
        requestId,chatId,sourceSha:S,controlSha:H,approvalManifestSha256:SHA})}};
    const env={GITHUB_REPOSITORY:R6_ONE_SHOT.repository,GITHUB_ACTOR:R6_ONE_SHOT.owner,
      GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
      GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:A,GITHUB_WORKSPACE:workspace};
    return callback({workspace,root,event,env,requestId,
      gitInspect:()=>({head:A,dirty:false})});
  } finally {fs.rmSync(workspace,{recursive:true,force:true});}
}
const check=({event,env,gitInspect})=>inspectR6ActivationCheckout({
  event,env,gitInspect,platform:'win32',fixture:true});

test('approved activation SHA and manifest bytes create only a read-only proof',()=>fixture(data=>{
  const result=check(data);
  assert.equal(result.status,'ACTIVATION_READONLY_VERIFIED_NOT_EXECUTABLE');
  assert.equal(result.requestId,data.requestId);
  assert.equal(result.activationSha,A);
  assert.equal(result.pins.approvalManifestSha256,SHA);
  assert.equal(result.executable,false);
}));

test('activation proof expects exact disabled workflow checkout path',()=>fixture(data=>{
  const workflow=fs.readFileSync(new URL(
    '../.github/workflows/pc-employment-r6-backfill-b-once.yml',import.meta.url),'utf8');
  assert.match(workflow,/path:\s*r6-activation\s*$/m);
  assert.match(workflow,/false\s*&&/);
  assert.equal(check(data).verifiedCheckoutRoot,data.root);
  const wrongPath=path.join(data.workspace,'r6-workflow-control');
  fs.renameSync(data.root,wrongPath);
  assert.throws(()=>check(data),{code:'R6_B_ACTIVATION_CHECKOUT_UNAVAILABLE'});
}));

test('forged Issue pins cannot change reviewed H/S/M',()=>fixture(data=>{
  const request=JSON.parse(data.event.issue.body);
  request.sourceSha='d'.repeat(40);
  data.event.issue.body=JSON.stringify(request);
  assert.throws(()=>check(data),/R6_B_IMMUTABLE_PIN_STOP/);
}));

test('activation worktree dirty or wrong event SHA stops before manifest trust',()=>fixture(data=>{
  assert.throws(()=>check({...data,gitInspect:()=>({head:A,dirty:true})}),
    {code:'R6_B_ACTIVATION_SHA_OR_DIRTY_STOP'});
  data.env.GITHUB_SHA='d'.repeat(40);
  assert.throws(()=>check(data),{code:'R6_B_ACTIVATION_SHA_OR_DIRTY_STOP'});
}));

test('manifest tampering rejects exact SHA even when same-approved-looking JSON',()=>fixture(data=>{
  const file=path.join(data.root,'r6-backfill-b','approved-effect-manifest.json');
  fs.appendFileSync(file,' ');
  assert.throws(()=>check(data),{code:'R6_B_ACTIVATION_MANIFEST_HASH_STOP'});
}));

test('unknown activation pins JSON field fails closed',()=>fixture(data=>{
  const file=path.join(data.root,'r6-backfill-b','activation-pins.json');
  const pins=JSON.parse(fs.readFileSync(file,'utf8'));
  fs.writeFileSync(file,JSON.stringify({...pins,allowDbWrites:true}));
  assert.throws(()=>check(data),{code:'R6_B_ACTIVATION_PINS_CONTRACT_STOP'});
}));

test('activation artifact parent symlink or junction cannot escape trusted checkout',()=>fixture(data=>{
  const folder=path.join(data.root,'r6-backfill-b');
  const outside=path.join(data.workspace,'outside-artifacts');
  fs.renameSync(folder,outside);
  fs.symlinkSync(outside,folder,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>check(data),
    {code:'R6_B_ACTIVATION_ARTIFACT_PARENT_SHAPE_STOP'});
}));
