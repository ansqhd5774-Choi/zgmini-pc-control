import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE,SOURCE_ROOT,CONFIG_PATH,CORE_TASK,CORE_TASK_XML_SHA,
 APPROVED,FILES,R17_PROTECTED,hash,verifyBefore,verifyCommitted,
 replaceSourceOnly} from './contract.mjs';

const blob='b'.repeat(40),sha='a'.repeat(64);
const before=()=>({sourceRoot:SOURCE_ROOT,configPath:CONFIG_PATH,
 coreTask:CORE_TASK,head:BASE,configSource:BASE,coreEnabled:true,
 taskXmlSha:CORE_TASK_XML_SHA,originalBranch:'main',configSha256:sha,
 headTree:blob,stagedCount:0,relevantDirty:FILES.map(path=>({path,status:'M',
 sha256:APPROVED[path]}))});

test('exact approved cf43 source and exactly two B-success dirty files',()=>{
 assert.equal(verifyBefore(before()).base,BASE);
 for(const change of [b=>{b.head='d7bc4948573843766ad82c72ff392220178c36a3';},
  b=>{b.relevantDirty[0].sha256='f'.repeat(64);},
  b=>{b.relevantDirty.push({path:'lib/other.mjs',status:'M',sha256:sha});},
  b=>{b.stagedCount=1;},b=>{b.coreEnabled=false;},
  b=>{b.originalBranch='calendar-cf43-b/unapproved';}]){
  const b=before();change(b);
  assert.throws(()=>verifyBefore(b),/CAL_CF43_/);
 }
});
test('new commit diff is exactly two and R17 parents unchanged',()=>{
 const protectedBlobs=Object.fromEntries(R17_PROTECTED.map(p=>[p,blob]));
 const valid={parent:BASE,head:'d'.repeat(40),branch:'calendar-cf43-b/pc-calendar-one',
  diff:FILES.map(path=>({path,status:'M'})),storedSha256:{...APPROVED},
  r17ParentBlobs:protectedBlobs,r17ChildBlobs:{...protectedBlobs},
  stagedCount:0,relevantClean:true};
 assert.equal(verifyCommitted(valid).sha,'d'.repeat(40));
 assert.throws(()=>verifyCommitted({...valid,diff:[]}),/CAL_CF43_COMMIT_DIFF_STOP/);
 assert.throws(()=>verifyCommitted({...valid,r17ChildBlobs:{...protectedBlobs,
  [R17_PROTECTED[0]]:'f'.repeat(40)}}),/CAL_CF43_COMMIT_CONTENT_STOP/);
});
test('JSON pointer changes only config.source preserving adjacent bytes',()=>{
 const config=Buffer.from(`{\n  "source": "${BASE}",\n  "enabled": true,\n  "quota": 10\n}\n`);
 const next='f'.repeat(40);
 const updated=replaceSourceOnly(config,BASE,next);
 assert.equal(updated.toString('utf8'),config.toString('utf8').replace(BASE,next));
 assert.throws(()=>replaceSourceOnly(config,'a'.repeat(40),next),
  /CAL_CF43_POINTER_SOURCE_STOP/);
});
