import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {executeJob} from '../controller/engine.mjs';

// Windows-only isolated proof. No operational SQLite, Controller or Core task is touched.
// Unlike a mock of taskkill, this exercises executeJob -> worker -> R6 child -> grandchild.
const SOURCE_SHA='a'.repeat(40);
const CONTROLLER_SHA='b'.repeat(40);
const ENTRY='scripts/pc-writer/employment-r6-runner-stage.mjs';
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const childSource=`import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
const output=get('--output-dir');
const grandchild=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],
  {stdio:'ignore',windowsHide:true,shell:false});
fs.writeFileSync(path.join(output,'fixture-grandchild.pid'),String(grandchild.pid));
setInterval(()=>{},1000);
`;

function setup(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-win-timeout-'));
  let grandchildPid=null;
  t.after(()=>{
    // Cleanup is limited to the fixture's own recorded descendant PID.
    if(Number.isSafeInteger(grandchildPid)&&grandchildPid>0){
      try{execFileSync('taskkill.exe',['/PID',String(grandchildPid),'/T','/F'],
        {windowsHide:true,stdio:'ignore',timeout:10000});}catch{}
    }
    fs.rmSync(root,{recursive:true,force:true});
  });
  const dataRoot=path.join(root,'data');
  const core=path.join(dataRoot,'pc-writer','storage','core.sqlite');
  const candidate=path.join(root,'candidate','EMPLOYMENT_R6_CANDIDATE.sqlite');
  const bundle=path.join(root,'bundle');
  const entry=path.join(bundle,'source',ENTRY);
  for(const p of [core,candidate,entry])fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(core,'fixture-core-only');
  fs.writeFileSync(candidate,'fixture-candidate-only');
  fs.writeFileSync(entry,childSource);
  const manifest=Buffer.from(JSON.stringify({files:{[ENTRY]:digest(Buffer.from(childSource))}})+'\n');
  fs.writeFileSync(path.join(bundle,'manifest.json'),manifest);
  const host={dataRoot,controllerSourceSha:CONTROLLER_SHA,employmentR6CandidatePath:candidate,
    approvedSources:{[SOURCE_SHA]:{root:bundle,branch:'codex/employment-1y-reader-r1',
      entrypoint:ENTRY,manifestSha256:digest(manifest)}}};
  const policy={schema:'ZGMINI_PC_OPERATIONS_V1',
    controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
    sourceRepository:'ansqhd5774-Choi/zgmini',allowedActors:['ansqhd5774-Choi'],
    seats:6,mutationsEnabled:false,maxAutomaticRetries:0,maxHeavyJobs:1,
    minimumFreeMiBForHeavy:0,
    operations:{'employment-r6-candidate-stage-readonly':{
      grade:'A',resource:'heavy',timeoutSeconds:5,minimumFreeMiB:0}}};
  const request={schema:'ZGMINI_PC_JOB_V1',
    requestId:'pc-00000000-0000-4000-8000-000000000091',
    chatId:'chat-00000000-0000-4000-8000-000000000091',
    operation:'employment-r6-candidate-stage-readonly',
    sourceRepository:'ansqhd5774-Choi/zgmini',
    sourceBranch:'codex/employment-1y-reader-r1',sourceSha:SOURCE_SHA};
  return {root,core,candidate,host,policy,request,setGrandchildPid:pid=>{grandchildPid=pid;}};
}

function isAlive(pid){
  try{process.kill(pid,0);return true;}
  catch(error){if(error.code==='ESRCH')return false;throw error;}
}

test('Windows taskkill /T terminates the R6 worker child and grandchild on timeout',
  {skip:process.platform!=='win32'?'Requires actual Windows process-tree semantics':false,
    timeout:30000},async t=>{
    const f=setup(t);
    const result=await executeJob(f.request,{root:f.root,host:f.host,policy:f.policy,
      seat:1,runId:'4151991',queryTask:()=>Buffer.from('fixture task XML')});
    assert.equal(result.report.status,'FAIL');
    assert.equal(result.report.code,'JOB_EXECUTION_TIMEOUT');
    assert.equal(result.report.firstFail,'OWN_WORKER_TIMEOUT');
    assert.equal(result.report.protectedStateUnchanged,true);
    assert.equal(result.report.operationalWrites,0);
    assert.equal(result.report.providerCalls,0);
    assert.equal(result.report.d1Writes,0);
    const pidFile=path.join(result.workspace,'r6-report','fixture-grandchild.pid');
    assert.equal(fs.existsSync(pidFile),true,'Fixture must reach grandchild spawn before timeout');
    const pid=Number(fs.readFileSync(pidFile,'utf8'));
    assert.equal(Number.isSafeInteger(pid)&&pid>0,true);
    f.setGrandchildPid(pid);
    for(let n=0;n<20&&isAlive(pid);n++)await pause(100);
    assert.equal(isAlive(pid),false,'taskkill /T must leave no fixture grandchild');
    assert.equal(fs.readFileSync(f.core,'utf8'),'fixture-core-only');
    assert.equal(fs.readFileSync(f.candidate,'utf8'),'fixture-candidate-only');
  });
