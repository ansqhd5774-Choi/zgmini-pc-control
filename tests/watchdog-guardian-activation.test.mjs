import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateActivation,statusReady} from '../watchdog-b/guardian-activation.mjs';
import {normalizeResult} from '../watchdog-b/guardian-result.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digest=buf=>createHash('sha256').update(buf).digest('hex');
const target='d01229adacc3c23f50bb119d146e291ff7e15012';
const replacement='d0d788996c15a94dcd1db540b9c624f950b3ce827589fdadc56a593f1b71cfc8';
const requestId='pc-watchdog-activate-5ee17f39-2dfd-4d2f-919a-947ea87e1fb4';
const helperDigest=digest(fs.readFileSync(path.join(root,'watchdog-b/guardian-rotate.vbs')));
const scriptDigest=digest(fs.readFileSync(path.join(root,'watchdog-b/guardian-activation.mjs')));
function fixture(){
 return {
  event:{action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
    sender:{login:'ansqhd5774-Choi'},
    issue:{number:1402,user:{login:'ansqhd5774-Choi'},
      title:'pc-watchdog-guardian-activate',labels:[{name:'pc-maintenance'}]}},
  body:{schema:'ZGMINI_PC_WATCHDOG_ACTIVATION_B_REQUEST_V1',
    requestId,operation:'watchdog-guardian-activate',targetSha:target,
    approvalManifestSha256:'a'.repeat(64)},
  approval:{schema:'ZGMINI_PC_WATCHDOG_ACTIVATION_B_MANIFEST_V1',
    approved:true,scope:'ONE_GUARDIAN_WATCHDOG_PROCESS_ACTIVATION_ONLY',
    targetSha:target,installedSha256:replacement,
    installedScope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1',
    guardianHelperSha256:helperDigest,
    activationScriptSha256:scriptDigest,
    stageRequestId:'pc-watchdog-b-a8063bdf-2bd7-4690-9c75-9726a00e6fe1',
    oldStageIssueNumber:1376,
    expectedControllerSha:'badad9124157879d7a645b64f2768113d632355b',
    effect:'ONE_EXACT_WATCHDOG_PROCESS_EXIT_GUARDIAN_RESTART',approvalBasis:'approved'},
  digest:'a'.repeat(64)
 };
}
const check=f=>validateActivation(f.event,f.body,f.approval,f.digest,helperDigest);
test('only authenticated owner, exact source, staged receipt and identity helper are admitted',()=>{
 const x=fixture();assert.deepEqual(check(x),{requestId,issueNumber:1402});
});
test('untrusted actors, arbitrary operations and widened scope never authorize process stop',()=>{
 const mutations=[
  x=>{x.event.sender.login='intruder';},
  x=>{x.event.issue.labels=[];},
  x=>{x.event.issue.title='pc-controller-update';},
  x=>{x.body.requestId='bad';},
  x=>{x.body.requestId='pc-watchdog-activate-aaaa1111-1a11-4a11-8a11-aaaaaaaa1111';},
  x=>{x.body.operation='terminate-process';},
  x=>{x.body.command='cmd.exe';},
  x=>{x.approval.approved=false;},
  x=>{x.approval.scope='ANY_PROCESS_TERMINATION';},
  x=>{x.approval.guardianHelperSha256='0'.repeat(64);},
  x=>{x.approval.activationScriptSha256='0'.repeat(64);},
  x=>{x.approval.oldStageIssueNumber=1372;},
  x=>{x.digest='0'.repeat(64);}
 ];
 for(const mutate of mutations){const x=fixture();mutate(x);
  assert.throws(()=>check(x),/WATCHDOG_ACTIVATION_/);
 }
});
test('on-disk STAGED and recent matching healthy owner are required',()=>{
 const now=Date.parse('2026-11-15T02:00:00Z');
 const x={owner:{pid:444,nonce:'55c14fab-c6db-4e7c-9953-0374a7bdf158'},
  status:{state:'HEALTHY',pid:444,at:new Date(now-1000).toISOString()},
  now,source:replacement,
  manifest:{sha256:replacement,scope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1',
    approvedTargetSourceSha:target},
  stage:{schema:'ZGMINI_PC_WATCHDOG_B_RESULT_V1',
    requestId:'pc-watchdog-b-a8063bdf-2bd7-4690-9c75-9726a00e6fe1',
    issueNumber:1376,targetSha:target,targetSourceSha256:replacement,
    status:'STAGED',writes:2}};
 assert.equal(statusReady(x),true);
 for(const mutate of [
  x=>{x.status.pid=778;},
  x=>{x.status.state='PAUSED';},
  x=>{x.stage.status='BLOCKED';},
  x=>{x.stage.writes=1;},
  x=>{x.manifest.scope='RUNNER_RECOVERY_ONLY';},
  x=>{x.source='f'.repeat(64);}
 ]){const v=JSON.parse(JSON.stringify(x));mutate(v);
  assert.throws(()=>statusReady(v),/WATCHDOG_ACTIVATION_/);
 }
});
test('reported PASS requires exact Guardian attestation and different old/new PIDs',()=>{
 const good={status:'PASS',code:'WATCHDOG_GUARDIAN_NEW_RUNTIME_ATTESTED',
  oldPid:443,newPid:444,watchdogFileWrites:0};
 assert.equal(normalizeResult(JSON.stringify(good)).newProcessAttested,true);
 assert.equal(normalizeResult(JSON.stringify({...good,newPid:443})).status,'STATE_UNKNOWN');
 assert.equal(normalizeResult(JSON.stringify({...good,code:'FAKE_PASS'})).status,'STATE_UNKNOWN');
 assert.equal(normalizeResult('garbage').status,'STATE_UNKNOWN');
});
test('fixed identity witness does not contain process-tree termination or arbitrary shell',()=>{
 const helper=fs.readFileSync(path.join(root,'watchdog-b/guardian-rotate.vbs'),'utf8');
 assert.match(helper,/watch\.Terminate\(0\)/);
 assert.match(helper,/wscript\.exe/);
 assert.match(helper,/guardian\.SessionId/);
 assert.match(helper,/WATCHDOG_RUNTIME_ATTESTED/);
 const executableLines=helper.split(/\r?\n/).filter(line=>!/^\s*'/.test(line)).join('\n');
 assert.doesNotMatch(executableLines,/taskkill\s+\/T/i);
 assert.equal((helper.match(/\.Terminate\(0\)/g)||[]).length,1);
});

test('immutable production B manifest pins exact submitted helper and runner bytes',()=>{
 const approved=JSON.parse(fs.readFileSync(path.join(root,
  'approvals/watchdog-activations/d01229adacc3c23f50bb119d146e291ff7e15012.json')));
 assert.equal(approved.approved,true);
 assert.equal(approved.activationScriptSha256,scriptDigest);
 assert.equal(approved.guardianHelperSha256,helperDigest);
 assert.equal(approved.effect,'ONE_EXACT_WATCHDOG_PROCESS_EXIT_GUARDIAN_RESTART');
});
