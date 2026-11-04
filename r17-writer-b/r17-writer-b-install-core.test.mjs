import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  BASE,CANDIDATE,CORE_XML_HASH,CORE_TASK,CONFIG_PATH,SOURCE_ROOT,
  PATCH_HASH,BEFORE,TARGET,DIFF,authorize,performApprovedInstall,
} from './r17-writer-b-install-core.mjs';

const NEW='f348a630c8af43377bba0de147f13f761d272eee';
const RID='pc-r17-550e8400-e29b-41d4-a716-446655440000';
const CID='chat-550e8400-e29b-41d4-a716-446655440000';
function makeAuth(){
  const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',GITHUB_EVENT_NAME:'issues',
    GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
    RUNNER_NAME:'zgmini-pc-01',GITHUB_RUN_ID:'2123456',R17_CONTROL_SHA:'a'.repeat(40)};
  const event={action:'opened',repository:{private:true,full_name:env.GITHUB_REPOSITORY},
    sender:{login:env.GITHUB_ACTOR},issue:{number:377,user:{login:env.GITHUB_ACTOR},
      title:'pc-r17-writer-fivefile-install',labels:[{name:'pc-r17-writer-b-install'}]}};
  const manifest={schema:'ZGMINI_R17_WRITER_B_INSTALL_APPROVAL_V1',
    status:'APPROVED_B_INSTALL_ONCE',scope:'R17_WRITER_EXACT_FIVE_FILES_SOURCE_COMMIT',
    baseSourceSha:BASE,candidateSourceSha:CANDIDATE,patchSha256:PATCH_HASH,
    coreTaskXmlSha256:CORE_XML_HASH,sourceRoot:SOURCE_ROOT,configPath:CONFIG_PATH,
    coreTask:CORE_TASK,beforeSha256:BEFORE,targetSha256:TARGET,
    configChange:'SOURCE_SHA_ONLY',coreTaskChange:'TEMPORARY_DISABLE_RESTORE',
    allowProviderCalls:false,allowD1Writes:false,allowOtherOperationalWrites:false,runCount:1};
  const manifestBytes=Buffer.from(JSON.stringify(manifest),'utf8');
  const request={schema:'ZGMINI_R17_WRITER_B_INSTALL_REQUEST_V1',requestId:RID,
    chatId:CID,operation:'r17-writer-fivefile-install-once',
    controlRepository:env.GITHUB_REPOSITORY,candidateSourceSha:CANDIDATE,
    approvalManifestSha256:createHash('sha256').update(manifestBytes).digest('hex')};
  event.issue.body=JSON.stringify(request);
  return {env,event,manifest,manifestBytes,request};
}
function mockIo({failAt,dirty=false,alreadyInstalled=false,drainRunning=false}={}){
  const state={claimed:false,head:alreadyInstalled?NEW:BASE,
    branch:alreadyInstalled?'r17-writer-b/local':'main',config:alreadyInstalled?NEW:BASE,
    taskEnabled:true,dirty,changedFiles:alreadyInstalled?TARGET:BEFORE,drainRunning,
    history:[],stages:[]};
  const fatal=(name)=>{if(failAt===name)throw Object.assign(new Error('simulation'),{code:`R17_B_SIMULATED_${name.toUpperCase()}_STOP`});};
  const inspectBefore=()=>({sourceRoot:SOURCE_ROOT,configPath:CONFIG_PATH,coreTask:CORE_TASK,
    head:state.head,configSource:state.config,worktreeClean:!state.dirty,
    originalBranch:state.branch,coreTaskXmlSha256:CORE_XML_HASH,taskEnabled:state.taskEnabled,
    taskRunning:state.drainRunning,coreIdle:!state.drainRunning,coreLockClear:!state.drainRunning,
    existingSha256:BEFORE,absent:Object.keys(TARGET).filter(p=>!Object.hasOwn(BEFORE,p))});
  const driver={
    state,
    async claim(id){fatal('claim');if(state.claimed)throw new Error('duplicate');state.claimed=id;},
    async journal(phase){fatal(phase==='CORE_RESTORED'?'journal_post_restore':'journal_other');state.stages.push(phase);},
    async inspectBefore(){fatal('inspect');return inspectBefore();},
    async saveBaseline(){fatal('backup');state.history.push('backup');},
    async prepareIsolatedCommit(){fatal('prepare');state.history.push('prepare');return {
      sha:NEW,parent:BASE,cleanCommit:true,targetSha256:TARGET,diff:DIFF,
      patchSha256:PATCH_HASH,candidateSourceSha:CANDIDATE,
      branch:`r17-writer-b/${RID}`,sourceRef:`refs/heads/r17-writer-b/${RID}`};},
    async disableCoreTask(){state.taskEnabled=false;state.history.push('disable');fatal('disable');},
    async assertCoreDisabled(){if(state.taskEnabled)throw new Error('Core is enabled');},
    async waitForDrain({maxDrainMs}){assert.equal(maxDrainMs,180000);
      state.drainRunning=false;state.history.push('drain');fatal('drain');},
    async assertCoreDrained(){if(state.drainRunning)throw new Error('not drained');},
    async switchToPreparedCommit(){state.head=NEW;state.branch=`r17-writer-b/${RID}`;
      state.changedFiles=TARGET;state.history.push('switch');fatal('switch');},
    async assertSource({head,branch}){if(state.head!==head||state.branch!==branch||state.dirty)
      throw new Error('source mismatch');},
    async changeConfigSource(){state.config=NEW;state.history.push('config');fatal('config');},
    async assertConfigSource(expected){if(state.config!==expected)throw new Error('config mismatch');},
    async restoreCoreTask(){state.taskEnabled=true;state.history.push('restore-task');fatal('restore_task');},
    async assertCoreRestored(){if(!state.taskEnabled)throw new Error('Core still disabled');},
    async restoreConfigExactly(){state.config=BASE;state.history.push('restore-config');fatal('restore_config');},
    async restoreOriginalSource(){state.head=BASE;state.branch='main';state.changedFiles=BEFORE;
      state.history.push('restore-source');fatal('restore_source');},
    async leaveCoreDisabled(){state.taskEnabled=false;state.history.push('leave-disabled');},
  };
  return driver;
}

test('B request requires exact private owner, issue, manifest raw digest and scope',()=>{
  const fixture=makeAuth();
  assert.equal(authorize(fixture).requestId,RID);
  assert.throws(()=>authorize({...fixture,event:{...fixture.event,sender:{login:'intruder'}}}),
    /R17_B_ISSUE_AUTHORIZATION_STOP/);
  assert.throws(()=>authorize({...fixture,manifestBytes:Buffer.from('{}')}),
    /R17_B_MANIFEST_DIGEST_STOP/);
  assert.throws(()=>authorize({...fixture,request:{...fixture.request,chatId:'chat-550e8400-e29b-41d4-a716-446655440001'}}),
    /R17_B_ISSUE_REQUEST_MISMATCH_STOP/);
  const wrong=makeAuth();wrong.manifest.allowProviderCalls=true;
  wrong.manifestBytes=Buffer.from(JSON.stringify(wrong.manifest));
  wrong.request.approvalManifestSha256=createHash('sha256').update(wrong.manifestBytes).digest('hex');
  wrong.event.issue.body=JSON.stringify(wrong.request);
  assert.throws(()=>authorize(wrong),/R17_B_MANIFEST_SCOPE_STOP/);
});

test('fivefile B success: exact source/config SHA and restored Core, no provider calls',async()=>{
  const io=mockIo();
  const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.deepEqual({status:r.status,sha:r.sourceSha},{status:'R17_B_INSTALLED_VERIFIED',sha:NEW});
  assert.equal(io.state.head,NEW);assert.equal(io.state.config,NEW);
  assert.equal(io.state.taskEnabled,true);
  assert.deepEqual(io.state.history,['backup','prepare','disable','drain','switch','config','restore-task']);
  assert.equal(io.state.stages.at(-1),'VERIFIED');
});

test('active Core before disable is no-op, never temporarily disables or waits on a long run',async()=>{
  const io=mockIo({drainRunning:true});
  const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.equal(r.status,'R17_B_INSTALL_STOP');
  assert.equal(r.errorCode,'R17_B_BASELINE_DRIFT_STOP');
  assert.equal(io.state.taskEnabled,true);
  assert.equal(io.state.history.includes('disable'),false);
});

test('stale or dirty source is no-op: no task/source/config write',async()=>{
  for(const args of [{alreadyInstalled:true},{dirty:true}]){
    const io=mockIo(args);
    const before={...io.state};
    const r=await performApprovedInstall(authorize(makeAuth()),io);
    assert.equal(r.status,'R17_B_INSTALL_STOP');
    assert.equal(r.errorCode,'R17_B_BASELINE_DRIFT_STOP');
    assert.equal(io.state.taskEnabled,before.taskEnabled);
    assert.equal(io.state.head,before.head);assert.equal(io.state.config,before.config);
    assert.deepEqual(io.state.history,[]);
  }
});

test('candidate preparation fails before task change, Core remains enabled',async()=>{
  const io=mockIo({failAt:'prepare'});const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.equal(r.status,'R17_B_INSTALL_STOP');assert.equal(io.state.taskEnabled,true);
  assert.equal(io.state.head,BASE);assert.equal(io.state.config,BASE);
});

test('prepared Git branch outside the approved request-scoped ref is rejected before Core disable',async()=>{
  const io=mockIo();const orig=io.prepareIsolatedCommit;
  io.prepareIsolatedCommit=async(...args)=>({...await orig(...args),branch:'main'});
  const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.equal(r.errorCode,'R17_B_PREPARED_TREE_STOP');
  assert.equal(io.state.taskEnabled,true);assert.equal(io.state.head,BASE);
  assert.equal(io.state.history.includes('disable'),false);
});

test('failed Config registration rolls back config+Git branch before Core re-enabled',async()=>{
  const io=mockIo({failAt:'config'});const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.equal(r.status,'R17_B_INSTALL_STOP');
  assert.deepEqual(io.state.history.slice(-3),['restore-config','restore-source','restore-task']);
  assert.equal(io.state.head,BASE);assert.equal(io.state.config,BASE);
  assert.equal(io.state.taskEnabled,true);
});

test('partial source rollback failure leaves Core disabled and recovery required',async()=>{
  const io=mockIo({failAt:'restore_source'});
  // Cause a rollback by failing the first config update.
  const orig=io.changeConfigSource;io.changeConfigSource=async()=>{throw Object.assign(new Error('fail'),{code:'R17_B_CONFIG_WRITE_STOP'});};
  const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.equal(r.status,'R17_B_RECOVERY_REQUIRED');
  assert.deepEqual(r.recovery,['SOURCE_RESTORE_FAILED']);
  assert.equal(io.state.taskEnabled,false);assert.equal(io.state.config,BASE);
});

test('post-Core-restore journal failure never rolls back under enabled task',async()=>{
  const io=mockIo({failAt:'journal_post_restore'});
  const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.equal(r.status,'R17_B_RECOVERY_REQUIRED');
  assert.deepEqual(r.recovery,['POST_RESTORE_VERIFICATION']);
  assert.equal(io.state.head,NEW);assert.equal(io.state.config,NEW);
  assert.equal(io.state.taskEnabled,true);
  assert.equal(io.state.history.includes('restore-source'),false);
  assert.equal(io.state.history.includes('restore-config'),false);
});

test('disable command error with already-disabled task: restore safely',async()=>{
  const io=mockIo({failAt:'disable'});const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.equal(r.status,'R17_B_INSTALL_STOP');assert.equal(io.state.taskEnabled,true);
  assert.equal(io.state.head,BASE);assert.equal(io.state.config,BASE);
});

test('scheduler permission denial BEFORE any mutation is a bounded STOP, not stuck recovery',async()=>{
  const io=mockIo();
  io.disableCoreTask=async()=>{throw Object.assign(new Error('access denied'),
    {code:'R17_B_TASK_PERMISSION_STOP'});};
  const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.equal(r.status,'R17_B_INSTALL_STOP');
  assert.equal(r.errorCode,'R17_B_TASK_PERMISSION_STOP');
  assert.equal(io.state.taskEnabled,true);
  assert.equal(io.state.head,BASE);assert.equal(io.state.config,BASE);
  assert.equal(io.state.history.includes('restore-task'),false);
});

test('reenable error after task became enabled does not rollback underneath Core',async()=>{
  const io=mockIo({failAt:'restore_task'});
  const r=await performApprovedInstall(authorize(makeAuth()),io);
  assert.equal(r.status,'R17_B_RECOVERY_REQUIRED');
  assert.deepEqual(r.recovery,['CORE_ALREADY_ENABLED']);
  assert.equal(io.state.head,NEW);assert.equal(io.state.config,NEW);
  assert.equal(io.state.taskEnabled,true);
});
