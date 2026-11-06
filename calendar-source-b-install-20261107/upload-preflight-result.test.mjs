import test from 'node:test';
import assert from 'node:assert/strict';
import {writeOnce,sanitizeDiagnostic,sanitizeCandidateCheckout} from './upload-preflight-result.mjs';
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
