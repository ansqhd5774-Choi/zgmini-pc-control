// Support-only regression: reproduces #1370 lost-ack replay path without
// executing Watchdog main(), Windows Operator, Runner, GitHub writes, or any PC.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const source=fs.readFileSync(fileURLToPath(
  new URL('../../tools/runner-watchdog.mjs',import.meta.url)),'utf8');
const between=(a,b)=>{
  const start=source.indexOf(a),end=source.indexOf(b,start);
  assert.ok(start>=0&&end>start,'Missing pinned Watchdog segment: '+a);
  return source.slice(start,end);
};
// Execute actual extracted production functions with in-memory fs/GitHub mocks,
// not a reimplementation of validateHandoffIntent or prepareHandoff.
const validation=between('export function validateHandoffIntent(','\nfunction ghRead')
  .replace('export function','function');
const preparation=between('function prepareHandoff(','\nfunction postHandoffReceipt(');
const acknowledgement=between('function postHandoffReceipt(','\nexport async function main(');
const poll=between('async function pollHandoff(){','\n await tick();');
const helpers=[
"const handoffTitle='pc-maintenance-handoff',handoffSchema='ZGMINI_MAINTENANCE_HANDOFF_REQUEST_V1';",
"const sha40=/^[a-f0-9]{40}$/,sha64=/^[a-f0-9]{64}$/;",
"const requestIdPattern=/^pc-handoff-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;",
"const strictKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));",
"const code=x=>{throw Object.assign(Error(x),{code:x});};"
].join('\n');
const old='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const target='c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7';
const requestId='pc-handoff-810bc8a5-abca-473c-b375-63abb56c24d6';
const sha=b=>createHash('sha256').update(b).digest('hex');

function scenario(){
  let installedSource=old,posted=0,comments=[];
  const scriptBytes=Buffer.from('support fixture operator script\n');
  const approval={
    schema:'ZGMINI_MAINTENANCE_HANDOFF_V2',transition:'SEVEN_TO_SEVEN',
    approved:true,scope:'COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE',
    targetSha:target,installedSha:old,files:{
      'tools/handoff-maintenance.mjs':sha(scriptBytes)
    }
  };
  const approvalBytes=Buffer.from(JSON.stringify(approval));
  const approvalDigest=sha(approvalBytes);
  const issue={title:'pc-maintenance-handoff',state:'OPEN',
    author:{login:'ansqhd5774-Choi'},labels:[{name:'pc-maintenance'}],
    body:JSON.stringify({schema:'ZGMINI_MAINTENANCE_HANDOFF_REQUEST_V1',
      requestId,operation:'maintenance-handoff',targetSha:target,
      approvalManifestSha256:approvalDigest})};
  const mockFs={
    lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,
      nlink:1,size:approvalBytes.length}),
    readFileSync:(p)=>String(p).endsWith('handoff-maintenance.mjs')
      ?scriptBytes:approvalBytes,
    existsSync:()=>false,
  };
  const ghRead=(args)=>{
    if(args[0]==='issue'&&args[1]==='view')
      return JSON.stringify({comments});
    if(args[0]==='issue'&&args[1]==='comment'){posted++;
      comments.push({body:args[args.length-1]});return '{}';}
    throw Error('UNEXPECTED_MOCK_GITHUB_CALL');
  };
  const args={
    fs:mockFs,path,sourceRoot:'/support/repo',maintenance:'/support/maintenance',
    repo:'ansqhd5774-Choi/zgmini-pc-control',sha,
    read:()=>({sourceSha:installedSource}),
    git:(a)=>a[0]==='branch'?'main':'',
    ghRead,safeCode:x=>x,
  };
  const builder=new Function(...Object.keys(args),helpers+'\n'
    +validation+'\n'+preparation+'\n'+acknowledgement
    +'\nreturn {prepareHandoff,postHandoffReceipt};');
  const actual=builder(...Object.values(args));
  return {actual,issue,changeInstalledSource:(v)=>{installedSource=v;},
    postedCount:()=>posted};
}
test('original code prepares a trusted request before source changes',()=>{
  const s=scenario(),result=s.actual.prepareHandoff(s.issue);
  assert.equal(result.admitted.requestId,requestId);
  assert.equal(result.admitted.targetSha,target);
});
test('source order calls fresh-install preflight before cached receipt replay',()=>{
  const preflight=poll.indexOf('const plan=prepareHandoff(issue);');
  const replay=poll.indexOf('if(fs.existsSync(receiptFile)){');
  assert.ok(preflight>=0&&replay>preflight);
});
test('after successful 7-to-7 source change old-target approval blocks replay',()=>{
  const s=scenario();
  assert.equal(s.actual.prepareHandoff(s.issue).admitted.targetSha,target);
  s.changeInstalledSource(target);
  assert.throws(()=>s.actual.prepareHandoff(s.issue),
    e=>e?.code==='HANDOFF_APPROVAL_BYTES_OR_SOURCE_MISMATCH');
});
test('posting a cached receipt itself does not require old installed SHA',()=>{
  const s=scenario();s.changeInstalledSource(target);
  s.actual.postHandoffReceipt(1370,{requestId,targetSha:target,status:'PASS',
    code:'STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED'});
  assert.equal(s.postedCount(),1);
});
// Desired future regression after owner fixes bridge ordering:
// authenticated terminal receipt can be reconciled without relaunching operator.
test.todo('Owner patch: post-success replay bypasses old installed SHA preflight while retaining issue identity checks');
