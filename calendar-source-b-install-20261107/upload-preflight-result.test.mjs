import test from 'node:test';
import assert from 'node:assert/strict';
import {writeOnce,sanitizeDiagnostic,sanitizeCandidateCheckout,
 sanitizeCycleCheckpoint} from './upload-preflight-result.mjs';
function fake(){
 const memory=new Map();let puts=0;
 const fetchImpl=async(url,opts={})=>{
  const key=url.split('?')[0];
  if(opts.method==='PUT'){
   puts++;
   const data=JSON.parse(opts.body);
   memory.set(key,Buffer.from(data.content,'base64'));
   return {status:201};
  }
  if(!memory.has(key))return {status:404};
  return {status:200,json:async()=>({encoding:'base64',
   content:memory.get(key).toString('base64')})};
 };
 return {fetchImpl,memory,putCount:()=>puts};
}
test('one-shot evidence upload performs exact readback and no duplicate PUT',async()=>{
 const f=fake(),bytes=Buffer.from('sanitized result\n');
 await writeOnce('results/calendar-source-preflight-test/result.txt',bytes,
  {fetchImpl:f.fetchImpl,auth:{}});
 await writeOnce('results/calendar-source-preflight-test/result.txt',bytes,
  {fetchImpl:f.fetchImpl,auth:{}});
 assert.equal(f.putCount(),1);
});
test('same path different bytes refuses to overwrite',async()=>{
 const f=fake();
 await writeOnce('results/calendar-source-preflight-test/result.json',
  Buffer.from('{}'),{fetchImpl:f.fetchImpl,auth:{}});
 await assert.rejects(()=>writeOnce('results/calendar-source-preflight-test/result.json',
  Buffer.from('{"changed":true}'),{fetchImpl:f.fetchImpl,auth:{}}),
  /CAL_B_EVIDENCE_CONFLICT_STOP/);
 assert.equal(f.putCount(),1);
});
test('ambiguous PUT without matching readback does not pretend success',async()=>{
 const f=async()=>({status:404});
 await assert.rejects(()=>writeOnce('results/calendar-source-preflight-test/result.json',
  Buffer.from('{}'),{fetchImpl:f,auth:{}}),
  /CAL_B_EVIDENCE_UNCONFIRMED_STOP/);
});
test('diagnostic export allowlists only boolean call graph, never raw commands or secrets',()=>{
 const safe=sanitizeDiagnostic({taskCommand:'wscript.exe',secret:'API_KEY_123',
  firstLauncherShaVerified:true,callGraph:[{callCount:1,
   callSites:[{api:'run',argumentForm:'concatenated',
    raw:'Bearer sensitive-secret',mentionsCoreScript:true}]}],
  causality:[{callCount:1,allCallArgumentsResolved:false,branchSeen:true,
   calls:[{api:'run',argumentForm:'UNRESOLVED',resolved:false,
    reason:'UNSAFE_RAW_SECRET',raw:'Bearer sensitive-secret'}]}]});
 const encoded=JSON.stringify(safe);
 assert.equal(encoded.includes('API_KEY_123'),false);
 assert.equal(encoded.includes('Bearer'),false);
 assert.equal(safe.callGraph[0].callSites[0].argumentForm,'concatenated');
});
test('candidate checkout is explicitly non-active, only SHA/count/flags exported',()=>{
 const sanitized=sanitizeCandidateCheckout({activeRootVerified:true,rawConfig:'super-secret',
  sourceHead:'a'.repeat(40),configSource:'b'.repeat(40),
  publicHeadPinned:true,otherTargetBlobMatches:9,otherTargetBlobCount:9,
  soleExpectedHotfixDirty:true,stagedIndexCount:0});
 assert.equal(sanitized.activeRootVerified,false);
 assert.equal(sanitized.otherTargetBlobMatches,9);
 assert.equal(JSON.stringify(sanitized).includes('super-secret'),false);
});
test('third A exact relative dirty and two known mismatches safely export',()=>{
 const sha='a'.repeat(40),sum='b'.repeat(64);
 const v=sanitizeCandidateCheckout({dirtyFiles:[{path:'lib/release-calendar.mjs',
  status:'M',fileSha256:sum},{path:'E:\\private\\key.txt',status:'M',fileSha256:sum}],
  targetBlobMismatches:[{path:'lib/eia-calendar.mjs',localBlob:sha,
   publicBlob:'ba6b9760481af53501abeb2b454d8f7683908a8e'},
   {path:'E:\\private\\key.txt',localBlob:sha,publicBlob:sha}]});
 assert.equal(v.dirtyFiles[0].path,'lib/release-calendar.mjs');
 assert.equal(v.dirtyFiles[1].path,'OTHER_RELEVANT_DIRTY');
 assert.equal(v.targetBlobMismatches[0].path,'lib/eia-calendar.mjs');
 assert.equal(v.targetBlobMismatches[1].path,null);
 assert.equal(JSON.stringify(v).includes('private'),false);
});
test('third A VBS hop basename output never leaks path or credential-looking name',()=>{
 const safe=sanitizeDiagnostic({causality:[{callCount:1,calls:[{
  api:'run',resolved:true,argumentForm:'concatenated',
  commandShape:{executableBasename:'node.exe',scriptBasename:'local-cycle.mjs',
   scriptExtension:'.mjs',scriptRooted:true,approvedRootMatch:true,
   nextHopKind:'CORE_LOCAL_CYCLE',oneHopCmdParsed:false,
   raw:'E:\\SECRET\\TOKEN_URL'}}]}]});
 const shape=safe.causality[0].calls[0].commandShape;
 assert.equal(shape.executableBasename,'node.exe');
 assert.equal(shape.nextHopKind,'CORE_LOCAL_CYCLE');
 assert.equal(JSON.stringify(safe).includes('TOKEN_URL'),false);
 const redacted=sanitizeDiagnostic({causality:[{calls:[{commandShape:{
  executableBasename:'secret-password.exe',scriptBasename:'token-secret-value.mjs',
  nextHopKind:'UNTRUSTED'}}]}]});
 assert.equal(redacted.causality[0].calls[0].commandShape.executableBasename,'OTHER_EXECUTABLE');
 assert.equal(redacted.causality[0].calls[0].commandShape.scriptBasename,'OTHER_SCRIPT');
 assert.equal(redacted.causality[0].calls[0].commandShape.nextHopKind,'UNKNOWN');
 assert.equal(JSON.stringify(redacted).includes('token-secret-value'),false);
});
test('publication checkpoint projection remains whitelist-only on upload',()=>{
 const safe=sanitizeCycleCheckpoint({exists:true,status:'PUBLICATION_NOT_VERIFIED',
  publicationExit:1,progressiveReason:'AUXILIARY_INPUTS_CHANGED',
  rawError:'access-token=private'});
 assert.equal(safe.publicationExit,1);
 assert.equal(safe.progressiveReason,'AUXILIARY_INPUTS_CHANGED');
 assert.equal(JSON.stringify(safe).includes('access-token'),false);
 const date=sanitizeCycleCheckpoint({exists:true,
  modifiedAt:'2026-11-06T17:49:30.743Z injected-secret'});
 assert.equal(date.modifiedAt,null);
});
