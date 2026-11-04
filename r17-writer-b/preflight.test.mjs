import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvent,validateManifest,applyTwoFilePatch,buildCandidateOverlay,overlayFromPatchedBytes,digest,BASE,PATCH_HASH,
  OLD,ADDED,FIVE,OLD_HASHES} from './contract.mjs';
import {verifyImports,runReadOnly} from './entry.mjs';

const id='12345678-1234-4234-8234-123456789abc';
const candidateSourceSha='d'.repeat(40);
const request={schema:'ZGMINI_R17_WRITER_B_PREFLIGHT_REQUEST_V1',
  requestId:`pc-r17-${id}`,chatId:`chat-${id}`,
  operation:'r17-writer-fivefile-preflight-only',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  candidateSourceSha,approvalManifestSha256:'0'.repeat(64)};
const event=()=>({action:'opened',repository:{private:true,
  full_name:'ansqhd5774-Choi/zgmini-pc-control'},sender:{login:'ansqhd5774-Choi'},
  issue:{number:777,user:{login:'ansqhd5774-Choi'},title:'pc-r17-writer-fivefile-preflight',
    labels:[{name:'pc-r17-writer-b-preflight'}],body:JSON.stringify(request)}});
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',RUNNER_NAME:'zgmini-pc-01',
  GITHUB_RUN_ID:'12345',GITHUB_RUN_ATTEMPT:'1',R17_CONTROL_SHA:'c'.repeat(40)};
const manifest=()=>({schema:'ZGMINI_R17_WRITER_B_PREFLIGHT_APPROVAL_V1',
  status:'APPROVED_B_PREFLIGHT_ONLY',scope:'R17_WRITER_5FILE_PREFLIGHT_ONLY',
  installedHeadSha:BASE,approvedConfigSourceSha:BASE,
  candidateSourceSha,patchSha256:PATCH_HASH,
  coreTaskXmlSha256:'e'.repeat(64),
  existingFiles:[...OLD],absentFiles:[...ADDED],
  beforeSha256:{...OLD_HASHES},
  newSha256:Object.fromEntries(ADDED.map(p=>[p,'a'.repeat(64)])),
  pcDataRoot:String.raw`E:\ZGmini\data\pc-writer`,
  pcSourceRoot:String.raw`E:\ZGmini\projects\actual-approved-worktree`,
  allowOperationalWrites:false,allowProviderCalls:false,allowD1Writes:false,
  allowConfigChanges:false,allowTaskChanges:false,runCount:1});
const wrappedManifest=(m)=>{
  const raw=Buffer.from(JSON.stringify(m));
  return {raw,req:{...request,approvalManifestSha256:digest(raw)}};
};

test('accept only private, author-controlled, one-attempt, fixed runner issue',()=>{
  assert.deepEqual(validateEvent(event(),env),request);
  for(const mut of [
    e=>e.issue.user.login='unknown',
    e=>e.repository.private=false,
    e=>e.issue.labels=[],
    e=>e.issue.body=JSON.stringify({...request,command:'cmd /c anything'}),
  ]){const e=event();mut(e);assert.throws(()=>validateEvent(e,env),/R17_B_/)}
  assert.throws(()=>validateEvent(event(),{...env,GITHUB_RUN_ATTEMPT:'2'}),/R17_B_EVENT_CONTEXT_STOP/);
  assert.throws(()=>validateEvent(event(),{...env,RUNNER_NAME:'hosted-linux'}),/R17_B_EVENT_CONTEXT_STOP/);
});

test('reject unsigned/different approval bytes, widened rights or file set',()=>{
  const good=wrappedManifest(manifest());
  assert.equal(validateManifest(good.raw,good.req).installedHeadSha,BASE);
  assert.throws(()=>validateManifest(good.raw,{...good.req,approvalManifestSha256:'f'.repeat(64)}),/R17_B_APPROVAL_BYTES_STOP/);
  for(const mut of [
    x=>x.allowD1Writes=true,
    x=>x.runCount=2,
    x=>x.existingFiles.push('scripts/pc-writer/other.mjs'),
    x=>x.absentFiles.pop(),
    x=>x.pcSourceRoot=String.raw`C:\unapproved`,
    x=>x.beforeSha256[OLD[0]]='f'.repeat(64),
    x=>x.newSha256[ADDED[0]]='invalid',
  ]){const m=manifest();mut(m);const x=wrappedManifest(m);
    assert.throws(()=>validateManifest(x.raw,x.req),/R17_B_APPROVAL_SCOPE_STOP/);}
});

const p1=OLD[0],p2=OLD[1];
const patch=`diff --git a/${p1} b/${p1}\n`+
  `index abcd123..1234abc 100644\n--- a/${p1}\n+++ b/${p1}\n`+
  `@@ -1,2 +1,2 @@\n a\n-b\n+B\n`+
  `diff --git a/${p2} b/${p2}\n`+
  `index 1234abc..abcd123 100644\n--- a/${p2}\n+++ b/${p2}\n`+
  `@@ -1,1 +1,1 @@\n-x\n+y\n`;
test('two-file patch is verified in-memory against precise old bytes',()=>{
  const got=applyTwoFilePatch(Buffer.from(patch),{[p1]:'a\nb\n',[p2]:'x\n'});
  assert.equal(got[p1],'a\nB\n');assert.equal(got[p2],'y\n');
  assert.throws(()=>applyTwoFilePatch(Buffer.from(patch),{[p1]:'a\nwrong\n',[p2]:'x\n'}),/R17_B_PATCH_CONTEXT_STOP/);
  assert.throws(()=>applyTwoFilePatch(Buffer.from(patch.replaceAll(p1,'scripts/pc-writer/unknown.mjs')),{[p1]:'a\nb\n',[p2]:'x\n'}),/R17_B_PATCH_FILESET_STOP/);
});

test('shifted Git hunk positions require unique exact original context',()=>{
  const got=applyTwoFilePatch(Buffer.from(patch),{
    [p1]:'prelude\na\nb\n',[p2]:'heading\nx\n',
  });
  assert.equal(got[p1],'prelude\na\nB\n');
  assert.equal(got[p2],'heading\ny\n');
  assert.throws(()=>applyTwoFilePatch(Buffer.from(patch),{
    [p1]:'prelude\na\nb\nprelude\na\nb\n',[p2]:'heading\nx\n',
  }),/R17_B_PATCH_CONTEXT_STOP/);
  assert.throws(()=>applyTwoFilePatch(Buffer.from(patch),{
    [p1]:'prelude\na\nnot-the-original\n',[p2]:'heading\nx\n',
  }),/R17_B_PATCH_CONTEXT_STOP/);
});

test('Windows CRLF source is matched exactly and its original EOL is retained',()=>{
  const got=applyTwoFilePatch(Buffer.from(patch),{
    [p1]:'header\r\na\r\nb\r\n',[p2]:'x\r\n',
  });
  assert.equal(got[p1],'header\r\na\r\nB\r\n');
  assert.equal(got[p2],'y\r\n');
  assert.throws(()=>applyTwoFilePatch(Buffer.from(patch),{
    [p1]:'a\r\nb\n',[p2]:'x\r\n',
  }),/R17_B_PATCH_CONTEXT_STOP/);
});

test('parser reports bounded hunk and EOL reasons without source contents',()=>{
  assert.throws(()=>applyTwoFilePatch(Buffer.from(patch),{
    [p1]:'a\r\nb\n',[p2]:'x\n',
  }),error=>{
    assert.equal(error.code,'R17_B_PATCH_CONTEXT_STOP');
    assert.deepEqual(error.diagnostic,{
      file:'local-cycle',hunkOldStart:null,reason:'MIXED_EOL',matchCount:null,
    });
    assert(!JSON.stringify(error.diagnostic).includes('a\\r'));
    return true;
  });
  assert.throws(()=>applyTwoFilePatch(Buffer.from(patch),{
    [p1]:'a\nwrong\n',[p2]:'x\n',
  }),error=>{
    assert.deepEqual(error.diagnostic,{
      file:'local-cycle',hunkOldStart:1,reason:'NO_MATCH',matchCount:0,
    });
    return true;
  });
  assert.throws(()=>applyTwoFilePatch(Buffer.from(patch),{
    [p1]:'prelude\na\nb\nprelude\na\nb\n',[p2]:'x\n',
  }),error=>{
    assert.deepEqual(error.diagnostic,{
      file:'local-cycle',hunkOldStart:1,reason:'MULTIPLE_MATCH',matchCount:2,
    });
    return true;
  });
});

test('PR old full files are not required: 2 old targets derive only from a23 patch',()=>{
  const newFiles=Object.fromEntries(ADDED.map(p=>[p,Buffer.from('export const fresh = true;\n')]));
  const newSha256=Object.fromEntries(ADDED.map(p=>[p,digest(newFiles[p])]));
  const built=buildCandidateOverlay({originals:{[p1]:'a\nb\n',[p2]:'x\n'},
    patchBytes:Buffer.from(patch),newFiles,newSha256});
  assert.equal(built.overlay.get(p1).toString(),'a\nB\n');
  assert.equal(built.overlay.get(p2).toString(),'y\n');
  assert.deepEqual(Object.keys(built.oldTargetSha256).sort(),OLD.slice().sort());
  const bad={...newFiles,[ADDED[0]]:Buffer.from('unapproved bytes')};
  assert.throws(()=>buildCandidateOverlay({originals:{[p1]:'a\nb\n',[p2]:'x\n'},
    patchBytes:Buffer.from(patch),newFiles:bad,newSha256}),/R17_B_CANDIDATE_SHA_STOP/);
});

test('mixed-EOL logical-line validation does not mutate installed bytes',()=>{
 const untouched=Buffer.from('a\r\nb\n');
 const normalized=untouched.toString('utf8').replace(/\r\n/g,'\n');
 const validated=applyTwoFilePatch(Buffer.from(patch),{
   [p1]:normalized,[p2]:'x\n',
 });
 assert.equal(validated[p1],'a\nB\n');
 assert.equal(untouched.toString('utf8'),'a\r\nb\n');
 const patchedOld={
   [p1]:Buffer.from('a\r\nB\n'),
   [p2]:Buffer.from('y\n'),
 };
 const newFiles=Object.fromEntries(ADDED.map(p=>[p,Buffer.from('export {};\n')]));
 const newSha256=Object.fromEntries(ADDED.map(p=>[p,digest(newFiles[p])]));
 const result=overlayFromPatchedBytes({patchedOld,newFiles,newSha256});
 assert(result.overlay.get(p1).equals(patchedOld[p1]));
 assert.equal(result.oldTargetSha256[p1],digest(patchedOld[p1]));
 assert.equal(result.overlay.size,5);
 assert.throws(()=>overlayFromPatchedBytes({
   patchedOld:{[p1]:'untrusted string',[p2]:patchedOld[p2]},
   newFiles,newSha256,
 }),/R17_B_PATCH_TARGET_MISMATCH_STOP/);
});

test('relative import closure accepts overlay and rejects missing deps',()=>{
  const map=new Map(FIVE.map(p=>[p,Buffer.from('// harmless\n')]));
  map.set(ADDED[0],Buffer.from(`import '../other/dependency.mjs';\n`));
  const base=(root,relative,probe=false)=>relative==='scripts/other/dependency.mjs'?
    (probe?true:Buffer.from('export const ok=true;\n')):
    probe?false:(()=>{throw Error('missing')})();
  assert.equal(verifyImports('/unused',map,base).verifiedImportFiles,6);
  assert.throws(()=>verifyImports('/unused',map,()=>false),/R17_B_IMPORT_RESOLUTION_STOP/);
});

function preflightFixture(){
  const m=manifest();
  m.coreTaskXmlSha256=digest(Buffer.from('FIXED_TASK_XML'));
  const {raw,req}=wrappedManifest(m),e=event();
  e.issue.body=JSON.stringify(req);
  const called=[];
  const opts={event:e,env,controlRoot:'/review/control',candidateRoot:'/review/source',
    readApproval:()=>{called.push('read-approval');return raw},
    readConfig:()=>{called.push('read-config');return {source:BASE}},
    gitCommit:root=>root.endsWith('control')?'c'.repeat(40):
      root.endsWith('source')?candidateSourceSha:BASE,
    gitStatus:()=>'',
    resolveRealRoot:root=>root,
    taskXml:()=>Buffer.from('FIXED_TASK_XML'),
    readPcFile:()=>Buffer.from('original fixture is deliberately not live'),
    inspectAbsence:()=>{called.push('inspect-absence');return true},
    gitApplyCheck:()=>{called.push('git-apply-check');return true},
  };
  return {opts,called};
}
test('JSDoc type-only imports do not become runtime dependencies',()=>{
 const map=new Map(FIVE.map(p=>[p,Buffer.from('// harmless\n')]));
 map.set(ADDED[0],Buffer.from(
   `/** @param {import('../../worker/runtime-contracts').ProjectionId} id */\n`+
   `/** @returns {import('../../worker/projection-checkpoint-r52.mjs').Result} */\n`+
   `const ok=true;\n`));
 assert.equal(verifyImports('/unused',map,()=>false).verifiedImportFiles,5);
 map.set(ADDED[0],Buffer.from(
   `/** @param {import('../../worker/runtime-contracts').ProjectionId} id */\n`+
   `export async function f(){ return import('../../worker/runtime-required.mjs'); }\n`));
 assert.throws(()=>verifyImports('/unused',map,()=>false),error=>{
   assert.equal(error.code,'R17_B_IMPORT_RESOLUTION_STOP');
   assert.deepEqual(error.diagnostic,{
     sourceKind:'OVERLAY',sourcePath:ADDED[0],
     dependencyPath:'worker/runtime-required.mjs',reason:'MISSING',
   });
   return true;
 });
});

test('read-only preflight refuses PC HEAD mismatch before reading config or applying patch',()=>{
  const {opts,called}=preflightFixture();
  const original=opts.gitCommit;
  opts.gitCommit=root=>root.startsWith('E:')?'f'.repeat(40):original(root);
  assert.throws(()=>runReadOnly(opts),/R17_B_PC_SOURCE_DRIFT_STOP/);
  assert(!called.includes('read-config'));
  assert(!called.includes('git-apply-check'));
});
test('read-only preflight stops on tracked or untracked PC source drift',()=>{
  const {opts,called}=preflightFixture();
  opts.gitStatus=root=>root.startsWith('E:')?' M scripts/pc-writer/run-local.mjs':'';
  assert.throws(()=>runReadOnly(opts),/R17_B_PC_DIRTY_STOP/);
  assert(!called.includes('read-config'));
  assert(!called.includes('git-apply-check'));
});
test('read-only preflight stops on config.source SHA mismatch',()=>{
  const {opts,called}=preflightFixture();
  opts.readConfig=()=>{called.push('read-config');return {source:'e'.repeat(40)}};
  assert.throws(()=>runReadOnly(opts),/R17_B_CONFIG_PIN_STOP/);
  assert(!called.includes('git-apply-check'));
});
test('read-only preflight stops on exact Core Task XML fingerprint mismatch',()=>{
  const {opts,called}=preflightFixture();
  opts.taskXml=()=>Buffer.from('DRIFTED_TASK_XML');
  assert.throws(()=>runReadOnly(opts),/R17_B_TASK_IDENTITY_STOP/);
  assert(!called.includes('inspect-absence'));
  assert(!called.includes('git-apply-check'));
});
test('read-only preflight stops on two installed source SHA mismatch',()=>{
  const {opts,called}=preflightFixture();
  assert.throws(()=>runReadOnly(opts),/R17_B_EXISTING_SHA_STOP/);
  assert(!called.includes('inspect-absence'));
  assert(!called.includes('git-apply-check'));
});

function fullFixture({missingImport=false}={}){
  const {opts,called}=preflightFixture();
  const newFiles=Object.fromEntries(ADDED.map(p=>
    [p,Buffer.from('export const safe = true;\n')]));
  if(missingImport)newFiles[ADDED[0]]=Buffer.from("import '../missing-module.mjs';\n");
  const m=manifest();
  m.coreTaskXmlSha256=digest(Buffer.from('FIXED_TASK_XML'));
  m.newSha256=Object.fromEntries(ADDED.map(p=>[p,digest(newFiles[p])]));
  const {raw,req}=wrappedManifest(m);
  opts.event.issue.body=JSON.stringify(req);
  opts.readApproval=()=>raw;
  const originals={[p1]:Buffer.from('a\nb\n'),[p2]:Buffer.from('x\n')};
  opts.readPcFile=(root,p)=>originals[p];
  opts.readCandidate=p=>{called.push(`read-candidate:${p}`);return newFiles[p]};
  opts.readPatch=()=>{called.push('read-private-patch');return Buffer.from(patch)};
  opts.hash=rawBytes=>{
    const b=Buffer.from(rawBytes);
    if(b.equals(originals[p1]))return OLD_HASHES[p1];
    if(b.equals(originals[p2]))return OLD_HASHES[p2];
    if(b.equals(Buffer.from(patch)))return PATCH_HASH;
    return digest(b);
  };
  return {opts,called};
}

test('FULL R17 B preflight fixture PASS without operational mutation and no OLD PR read',()=>{
  const {opts,called}=fullFixture();
  const result=runReadOnly(opts);
  assert.equal(result.status,'PASS');
  assert.equal(result.code,'R17_B_PREFLIGHT_PASS');
  assert.equal(result.existingHashesMatched,2);
  assert.equal(result.candidateHashesMatched,3);
  assert.equal(result.verifiedImportFiles,5);
  assert.deepEqual([result.providerCalls,result.d1Writes,result.pcSourceWrites,
    result.operationalConfigWrites,result.taskWrites],[0,0,0,0,0]);
  assert.equal(called.filter(x=>x.startsWith('read-candidate:')).length,3);
  assert(called.includes('read-private-patch'));
  assert(called.includes('git-apply-check'));
});

test('native Git check runs before parser mismatch and remains fail-closed',()=>{
  const {opts,called}=fullFixture();
  const priorRead=opts.readPcFile,priorHash=opts.hash;
  const mixed=Buffer.from('a\r\nb\n');
  opts.readPcFile=(root,p)=>p===p1?mixed:priorRead(root,p);
  opts.hash=bytes=>Buffer.from(bytes).equals(mixed)?OLD_HASHES[p1]:priorHash(bytes);
  assert.throws(()=>runReadOnly(opts),error=>{
    assert.equal(error.code,'R17_B_PATCH_CONTEXT_STOP');
    assert.deepEqual(error.diagnostic,{
      file:'local-cycle',hunkOldStart:null,reason:'MIXED_EOL',
      matchCount:null,nativeGitApplyCheck:'PASS',
    });
    return true;
  });
  assert(called.indexOf('git-apply-check')>called.indexOf('read-private-patch'));
  assert.equal(called.filter(x=>x==='git-apply-check').length,1);
});

test('preflight refuses an already present newly approved file before package execution',()=>{
  const {opts,called}=fullFixture();
  opts.inspectAbsence=()=>false;
  assert.throws(()=>runReadOnly(opts),/R17_B_NEW_FILE_PRESENT_STOP/);
  assert(!called.includes('read-private-patch'));
  assert(!called.includes('git-apply-check'));
});

test('preflight refuses an unresolved transitive source import',()=>{
  const {opts}=fullFixture({missingImport:true});
  assert.throws(()=>runReadOnly(opts),/R17_B_IMPORT_RESOLUTION_STOP/);
});
