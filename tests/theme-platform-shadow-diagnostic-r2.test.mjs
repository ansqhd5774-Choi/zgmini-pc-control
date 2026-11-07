import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
const start=source.indexOf('function interpretShadowOutcome(');
const end=source.indexOf('\nasync function runApprovedShadowReadOnly',start);
assert.ok(start>0&&end>start);
const interpret=vm.runInNewContext(source.slice(start,end)+'\ninterpretShadowOutcome',{
 Buffer,need:(v,code)=>{if(!v)throw Object.assign(new Error(code),{code});}
});
const ids=Array.from({length:10},(_,i)=>'theme-'+(i+1));
const record=(status,code)=>({id:'theme-1',kind:'provisional',status,
 stage:'calculate',code,secret:'DO_NOT_LEAK'});
const body=(overrides={})=>({status:'COMPLETE',providerCalls:0,d1Writes:0,
 schedulerWrites:0,publicConnection:'NOT_ACTIVATED',
 checkpointPersistence:'TRANSIENT_MEMORY_ONLY',publicTargetIds:ids,
 coverage:{public:{status:'COMPLETE',themes:10,expectedPhases:20,
 complete:20,blocked:0,pending:0},private:{status:'COMPLETE',themes:1,
 expectedPhases:2,complete:2,blocked:0,pending:0}},
 results:[record('COMPLETE',null)],...overrides});
const run=(code,doc)=>interpret({exitCode:code,stdout:JSON.stringify(doc)});

test('public and private complete is PASS and returns only safe rows',()=>{
 const r=run(0,body());
 assert.equal(r.status,'PASS');assert.equal(r.publicCoverageStatus,'COMPLETE');
 assert.equal(r.privateCoverageStatus,'COMPLETE');
 assert.equal(r.phaseRows.length,1);
 assert.ok(!JSON.stringify(r).includes('DO_NOT_LEAK'));
 assert.ok(!Object.hasOwn(r,'results'));
});

test('public fully complete and private blocked is public PASS only',()=>{
 const b=body({status:'PARTIAL',coverage:{...body().coverage,
  private:{status:'PARTIAL',themes:1,expectedPhases:2,
   complete:0,blocked:2,pending:0}}});
 const r=run(2,b);
 assert.equal(r.status,'PASS');assert.equal(r.publicCoverageStatus,'COMPLETE');
 assert.equal(r.privateCoverageStatus,'PARTIAL');
 assert.equal(r.privateCoverage.blocked,2);
});

test('public ten blocked is still BLOCKED with individual safe cause',()=>{
 const b=body({status:'PARTIAL',coverage:{...body().coverage,
  public:{status:'PARTIAL',themes:10,expectedPhases:20,
   complete:10,blocked:10,pending:0}},
  results:[record('BLOCKED','THEME_STORED_CONFIGURED_PROVISIONAL_PUBLIC_BASE_REQUIRED')]});
 const r=run(2,b);
 assert.equal(r.status,'BLOCKED');assert.equal(r.publicComplete,10);
 assert.equal(r.phaseRows[0].code,'THEME_STORED_CONFIGURED_PROVISIONAL_PUBLIC_BASE_REQUIRED');
});

test('abnormal exit, missing private, raw data, or oversized rows cannot yield a false PASS or leak',()=>{
 const r=run(2,body({status:'PARTIAL',results:Array.from({length:90},()=>({
  id:'key=SECRET',kind:'evil',status:'COMPLETE',stage:'secret-stuff!',code:'TOKEN:SECRET',raw:'secret'}))}));
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.phaseRows.length,64);assert.equal(r.phaseRowsTruncated,true);
 assert.equal(r.phaseRows[0].id,'REDACTED');
 assert.equal(r.phaseRows[0].code,null);
 assert.ok(!JSON.stringify(r).includes('SECRET'));
 const noPrivate=body({coverage:{public:body().coverage.public}});
 assert.throws(()=>run(0,noPrivate),{code:'SHADOW_PRIVATE_COVERAGE_INVALID'});
 assert.throws(()=>run(0,body({coverage:{...body().coverage,
  public:{...body().coverage.public,complete:-1,blocked:21}}})),
  {code:'SHADOW_PUBLIC_COVERAGE_INVALID'});
 const masked=run(0,body({sourceMode:'SECRET',d1Reads:{token:'SECRET'},
  publicApiReads:'SECRET',coverage:{...body().coverage,
   private:{...body().coverage.private,extraSecret:'SECRET'}}}));
 assert.equal(masked.status,'PASS');
 assert.equal(masked.sourceMode,null);
 assert.equal(masked.d1Reads,null);
 assert.equal(masked.publicApiReads,null);
 assert.ok(!JSON.stringify(masked).includes('SECRET'));
 assert.throws(()=>run(0,body({d1Writes:1})),{code:'SHADOW_READONLY_CONTRACT_NOT_PROVEN'});
 assert.throws(()=>interpret({exitCode:2,stdout:'x'.repeat(2_000_001)}),
  {code:'SHADOW_OUTPUT_BOUNDS'});
});
