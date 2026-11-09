import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVerifiedPcBotResult,main} from '../tools/controller-postswitch-windows.mjs';

const target='badad9124157879d7a645b64f2768113d632355b';
const source='b'.repeat(40),requestId='pc-15d95132-768f-4c43-bf0b-1cb6df7de9d1';
const result=()=>({schema:'ZGMINI_PC_RESULT_V1',requestId,
  jobId:'run-123-1-seat-3',status:'PASS',code:'CORE_READONLY_DIAGNOSIS',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  controlSourceSha:target,actualExecutionSha:target,
  sourceRepository:'ansqhd5774-Choi/zgmini',requestedSourceSha:source,
  protectedStateUnchanged:true,operationalWrites:0,providerCalls:0,d1Writes:0});
const comment=(value=result(),user='github-actions[bot]')=>({
  user:{login:user},body:'<!-- zgmini-pc-result:123:1:3 -->\nJSON 결과:\n'+
    String.fromCharCode(96).repeat(3)+'json\n'+JSON.stringify(value)+'\n'+
    String.fromCharCode(96).repeat(3)});

test('only one exact A-grade bot result can prove success',()=>{
  assert.equal(parseVerifiedPcBotResult([comment()],requestId,target,source).status,'PASS');
  assert.equal(parseVerifiedPcBotResult([],requestId,target,source),null);
  assert.equal(parseVerifiedPcBotResult([comment(result(),'attacker')],requestId,target,source),null);
  assert.equal(parseVerifiedPcBotResult([comment({...result(),requestId:'other'})],
    requestId,target,source),null);
});
test('wrong source, status, protection, effects or duplicate report is a hard stop',()=>{
  const rows=[
    {...result(),status:'FAIL'},
    {...result(),actualExecutionSha:'0'.repeat(40)},
    {...result(),controlSourceSha:'0'.repeat(40)},
    {...result(),requestedSourceSha:'0'.repeat(40)},
    {...result(),protectedStateUnchanged:false},
    {...result(),operationalWrites:1},
    {...result(),providerCalls:1},
    {...result(),d1Writes:1},
  ];
  for(const row of rows)assert.throws(()=>
    parseVerifiedPcBotResult([comment(row)],requestId,target,source));
  assert.throws(()=>parseVerifiedPcBotResult([comment(),comment()],
    requestId,target,source),/POSTSWITCH_RESULT_DUPLICATE_UNCERTAIN/);
});
test('malformed trusted bot body fails closed',()=>{
  const bad={user:{login:'github-actions[bot]'},
    body:'<!-- zgmini-pc-result:123:1:3 -->\nno JSON'};
  assert.throws(()=>parseVerifiedPcBotResult([bad],requestId,target,source),
    /POSTSWITCH_RESULT_BOT_BODY_INCOMPLETE/);
});
test('C operator refuses non-Windows / noninteractive environments before I/O',async()=>{
  await assert.rejects(()=>main([]),/POSTSWITCH_DIRECT_WINDOWS_C_OPERATOR_REQUIRED/);
});
