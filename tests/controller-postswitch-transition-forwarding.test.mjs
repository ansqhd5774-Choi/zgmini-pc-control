import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectPreflightEvidence}
  from '../tools/controller-postswitch-preflight.mjs';

const args=['--request-id','pc-update-877e10c8-8580-4095-a675-bef9ec032193',
  '--source-sha','a'.repeat(40)];

test('preflight forwards the exact approved Writer transition to evidence inspection',async()=>{
  const transition=Object.freeze({sourceBefore:'a'.repeat(40),sourceAfter:'b'.repeat(40)});
  const result={status:'READONLY_POSTSWITCH_EVIDENCE_VERIFIED'};
  let calls=0;
  const observed=await inspectPreflightEvidence(args,{
    writerTransition:transition,
    inspect:async(actual,options)=>{
      calls++;
      assert.deepEqual(actual,args);
      assert.equal(options.writerTransition,transition);
      return result;
    },
  });
  assert.equal(observed,result);
  assert.equal(calls,1);
});

test('preflight without an approved transition retains strict drift rejection',async()=>{
  await assert.rejects(()=>inspectPreflightEvidence(args,{
    inspect:async(_actual,{writerTransition})=>{
      assert.equal(writerTransition,null);
      throw Object.assign(new Error('PROTECTED_STATE_DRIFT'),
        {code:'PROTECTED_STATE_DRIFT'});
    },
  }),{code:'PROTECTED_STATE_DRIFT'});
});

test('preflight preserves new follow-up identity separately from historical consent',async()=>{
 const transition={historical:true},followup={latest:true};
 await inspectPreflightEvidence(args,{writerTransition:transition,writerFollowup:followup,
  inspect:async(_args,options)=>{
   assert.equal(options.writerTransition,transition);
   assert.equal(options.writerFollowup,followup);
  }});
});

test('read-only launcher passes its verified transition through to preflight',()=>{
  const source=readFileSync(new URL('../tools/controller-postswitch-launcher.mjs',
    import.meta.url),'utf8');
  assert.match(source,/const plan=await preflight\(\['--request-id',id,'--source-sha',source\],\s*\{writerTransition:WRITER_TRANSITION,writerFollowup:WRITER_FOLLOWUP,resume:RESUME_1215\}\)/);
});

test('direct C operator passes the approved transition through to preflight',()=>{
  const source=readFileSync(new URL('../tools/controller-postswitch-windows.mjs',
    import.meta.url),'utf8');
  assert.match(source,/const preflight=await inspectPreflight\(\['--request-id',id,'--source-sha',source\],\s*\{writerTransition:approval\.writerTransition \?\? null,writerFollowup:approval\.writerFollowup \?\? null,resume:approval\.resume\?\?null\}\)/);
});
