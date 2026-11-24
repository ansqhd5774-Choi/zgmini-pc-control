import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,authorizeWriterBIssue,APPROVAL_SCHEMA,SCOPE,SOURCE_REPO,
 REQUEST_SCHEMA,OPERATION,CONTROL_REPO,ISSUE_LABEL,ISSUE_TITLE} from './contract.mjs';
import {performWriterBInstall,verifyWriterBPreimage,
  verifyWriterBCandidate,verifyPreparedWriterCommit} from './installer.mjs';

const NEXT='f'.repeat(40),RID='01234567-89ab-4cde-8fab-0123456789ab';
const H=value=>sha256(Buffer.from(value));
function manifest(){
 return {
  schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
  sourceRepository:SOURCE_REPO,
  sourceBranch:'fix/economic12-inflation-legacy4-r35-20261021',
  candidateSourceSha:'b'.repeat(40),baseHead:'a'.repeat(40),
  baseConfigSourceSha:'a'.repeat(40),
  sourceRoot:'E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release',
  configPath:'E:\\ZGmini\\data\\pc-writer\\config.json',
  coreTask:'ZGMINI-PC-Local-Core',
  files:[
   {path:'scripts/pc-writer/run-local.mjs',change:'M',
    beforeSha256:H('old-local'),afterSha256:H('new-local')},
   {path:'scripts/pc-writer/inflation-causal-public-auto-publication-r1.mjs',
    change:'A',beforeSha256:null,afterSha256:H('new-publication')},
   {path:'scripts/pc-writer/inflation-causal-public-auto-publication-r1.test.mjs',
    change:'A',beforeSha256:null,afterSha256:H('new-test')},
  ],
  protectedFiles:[{path:'scripts/pc-writer/release-calendar.mjs',sha256:H('calendar')}],
  runtimeDependencies:{taskXmlSha256:'2'.repeat(64),consumers:[{
   id:'core-launcher',kind:'LAUNCHER',
   path:'E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs',
   sha256:H('approved-wrapper'),dependsOn:['scripts/pc-writer/run-local.mjs'],
  }]},
  runCount:1,allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
  allowTaskDefinitionChanges:false,allowOtherSourceChanges:false,
 };
}
const auth=(overrides={})=>{
 const bytes=Buffer.from(JSON.stringify({...manifest(),...overrides}));
 return authorizeWriterBIssue({
  manifestBytes:bytes,
  env:{GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_EVENT_NAME:'issues',
   GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
   GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40)},
  event:{repository:{full_name:CONTROL_REPO,private:true},
   sender:{login:'ansqhd5774-Choi'},issue:{user:{login:'ansqhd5774-Choi'},
    title:ISSUE_TITLE,number:777,labels:[{name:ISSUE_LABEL}],
    body:JSON.stringify({schema:REQUEST_SCHEMA,requestId:RID,
     chatId:'11234567-89ab-4cde-8fab-1123456789ab',operation:OPERATION,
     controlRepository:CONTROL_REPO,
     approvalManifestPath:'approvals/writer-updates/inflation19-20261107.json',
     approvalManifestSha256:sha256(bytes)})}},
 });
};
const map=(m,k)=>Object.fromEntries(m.map(x=>[x.path,x[k]]));

function mockIO({failAt=null,rollbackFail=false,dirtyTarget=false,
 candidateWrong=false,otherDirty=false,resumeUnconfirmedOnce=false}={}){
 const m=manifest(),files=map(m.files,'beforeSha256'),
  protectedFiles=map(m.protectedFiles,'sha256');
 const runtimeConsumers=map(m.runtimeDependencies.consumers,'sha256');
 const state={head:m.baseHead,config:m.baseHead,branch:'main',coreEnabled:true,
  acquired:false,claimed:false,released:false,retained:false,
  unrelatedTrackedDirty:otherDirty,steps:[],files:{...files},resumeCalls:0};
 const mark=step=>{state.steps.push(step);};
 const fatal=stage=>{if(failAt===stage)
  throw Object.assign(new Error(stage),{code:'WRITER_B_SIMULATED_'+stage.toUpperCase()+'_STOP'});};
 const io={
  async acquireSharedWriterLock(id){assert.equal(id,RID);mark('lock');state.acquired=true;fatal('lock');},
  async readPcPreimage(){mark('preimage');fatal('preimage');return {
   sourceRoot:m.sourceRoot,configPath:m.configPath,coreTask:m.coreTask,
   head:state.head,configSource:state.config,originalBranch:'main',
   originalConfigSha256:'1'.repeat(64),originalTaskDefinitionSha256:'2'.repeat(64),
   coreTaskEnabled:state.coreEnabled,targetPathsClean:!dirtyTarget,
   beforeSha256:{...state.files},protectedSha256:{...protectedFiles},
   runtimeConsumerSha256:{...runtimeConsumers},
   unrelatedTrackedDirty:state.unrelatedTrackedDirty,
  };},
  async readCandidate(){mark('candidate');fatal('candidate');const hashes=map(m.files,'afterSha256');
   if(candidateWrong)hashes[m.files[0].path]='0'.repeat(64);
   return {sourceSha:m.candidateSourceSha,clean:true,sha256:hashes};},
  async claimRequest(id){assert.equal(id,RID);state.claimed=true;mark('claim');fatal('claim');},
  async backupOriginal(){mark('backup');fatal('backup');},
  async prepareIsolatedCommit(){mark('prepare');fatal('prepare');return {
   sha:NEXT,parent:m.baseHead,clean:true,changedPaths:m.files.map(x=>x.path),
   baseTreeOid:'1'.repeat(40),preparedTreeOid:'2'.repeat(40),
   provenanceSha256:'3'.repeat(64),mode:'LOCAL_OVERLAY',localOnly:true,
   sha256:map(m.files,'afterSha256'),
  };},
  async waitForCoreIdleWindow(phase='PRECLAIM'){
   mark(phase==='POST_PREPARE'?'window-final':'window');fatal('window');
  },
  async pauseCore(){mark('pause');state.coreEnabled=false;fatal('pause');},
  async waitForCoreDrain(){mark('drain');fatal('drain');},
  async assertCoreQuiet(){mark('quiet');if(state.coreEnabled)
    throw Object.assign(new Error('enabled'),{code:'WRITER_B_CORE_STILL_ACTIVE_STOP'});},
  async switchPreparedSource(){mark('switch');state.head=NEXT;
   state.branch='writer-b/'+RID;state.files=map(m.files,'afterSha256');fatal('switch');},
  async assertWriterSource(){mark('assert-source');
   assert.equal(state.head,NEXT);assert.deepEqual(state.files,map(m.files,'afterSha256'));},
  async changeConfigSource(from,to){mark('config');assert.equal(from,m.baseHead);
   state.config=to;fatal('config');},
  async assertConfigSource(sha){mark('assert-config');assert.equal(state.config,sha);},
  async restoreCore(){mark('resume');state.resumeCalls++;
   if(!(resumeUnconfirmedOnce&&state.resumeCalls===1))state.coreEnabled=true;
   fatal('resume');},
  async verifyCoreDefinitionUnchanged(){mark('task-verify');fatal('task-verify');
   assert.equal(state.coreEnabled,true);},
  async restoreOriginalConfig(){mark('rollback-config');state.config=m.baseHead;
   if(rollbackFail)throw new Error('recovery unavailable');},
  async restoreOriginalSource(){mark('rollback-source');state.head=m.baseHead;
   state.branch='main';state.files={...files};if(rollbackFail)throw new Error('recovery unavailable');},
  async verifyOriginalState(){mark('original-verify');assert.equal(state.head,m.baseHead);
   assert.equal(state.config,m.baseHead);assert.equal(state.coreEnabled,true);
   assert.deepEqual(state.files,files);},
  async releaseSharedWriterLock({requestId,retain}){assert.equal(requestId,RID);
   mark('release');state.released=true;state.retained=retain;
   if(failAt==='release')throw new Error('lease drift');},
 };
 return {io,state};
}

const maintenanceAuth=()=>auth({coreMaintenance:'PAUSE_NEW_STARTS_DRAIN_360S_V1'});
const extendedMaintenanceAuth=()=>auth({coreMaintenance:'PAUSE_NEW_STARTS_DRAIN_1200S_V1'});
test('explicitly approved long drain keeps Core paused until natural finish, then restores',async()=>{
 const {io,state}=mockIO({failAt:'window'});
 let running=true;
 io.waitForCoreDrain=async()=>{
  assert.equal(state.coreEnabled,false);
  assert.equal(state.head,manifest().baseHead);
  state.steps.push('long-running-core-finishes');running=false;
 };
 const originalQuiet=io.assertCoreQuiet;
 io.assertCoreQuiet=async()=>{assert.equal(running,false);await originalQuiet();};
 const out=await performWriterBInstall(extendedMaintenanceAuth(),io);
 assert.equal(out.status,'WRITER_B_INSTALLED_VERIFIED');
 assert.ok(state.steps.indexOf('long-running-core-finishes')<state.steps.indexOf('switch'));
 assert.equal(state.coreEnabled,true);
 assert.equal(state.retained,false);
 assert.equal(state.steps.some(step=>step.startsWith('window')),false);
});
test('long drain timeout restores source, config and Task without switching files',async()=>{
 const {io,state}=mockIO({failAt:'drain'});
 const out=await performWriterBInstall(extendedMaintenanceAuth(),io);
 assert.equal(out.status,'WRITER_B_INSTALL_STOP_RESTORED');
 assert.equal(state.coreEnabled,true);
 assert.equal(state.head,manifest().baseHead);
 assert.equal(state.config,manifest().baseHead);
 assert.equal(state.steps.includes('switch'),false);
 assert.equal(state.retained,false);
});
test('approved maintenance stages before inhibition and drains active Core without natural-idle lottery',async()=>{
 const {io,state}=mockIO({failAt:'window'});
 let active=true;
 io.waitForCoreDrain=async()=>{
  assert.equal(state.coreEnabled,false);
  assert.equal(state.head,manifest().baseHead);
  state.steps.push('running-core-finishes');active=false;
 };
 const quiet=io.assertCoreQuiet;
 io.assertCoreQuiet=async()=>{assert.equal(active,false);await quiet();};
 const out=await performWriterBInstall(maintenanceAuth(),io);
 assert.equal(out.status,'WRITER_B_INSTALLED_VERIFIED');
 assert.ok(state.steps.indexOf('prepare')<state.steps.indexOf('pause'));
 assert.ok(state.steps.indexOf('running-core-finishes')<state.steps.indexOf('switch'));
 assert.equal(state.steps.some(s=>s.startsWith('window')),false);
 assert.equal(state.coreEnabled,true);assert.equal(state.retained,false);
});

test('maintenance preparation failure leaves scheduling untouched',async()=>{
 const {io,state}=mockIO({failAt:'prepare'});
 const out=await performWriterBInstall(maintenanceAuth(),io);
 assert.equal(out.status,'WRITER_B_INSTALL_STOP_RESTORED');
 assert.equal(state.steps.includes('pause'),false);
 assert.equal(state.coreEnabled,true);assert.equal(state.head,manifest().baseHead);
});

test('maintenance pause, drain and source failures restore exact originals before release',async()=>{
 for(const failAt of ['pause','drain','switch','config']){
  const {io,state}=mockIO({failAt});
  const out=await performWriterBInstall(maintenanceAuth(),io);
  assert.equal(out.status,'WRITER_B_INSTALL_STOP_RESTORED',failAt);
  assert.equal(state.coreEnabled,true,failAt);
  assert.equal(state.head,manifest().baseHead,failAt);
  assert.equal(state.config,manifest().baseHead,failAt);
  assert.equal(state.retained,false,failAt);
  if(failAt==='drain')assert.equal(state.steps.includes('switch'),false);
 }
});

test('maintenance restore failure retains ownership and never reports success',async()=>{
 const {io,state}=mockIO();
 io.waitForCoreDrain=async()=>{throw Object.assign(new Error('timeout'),
  {code:'WRITER_B_CORE_NATURAL_DRAIN_TIMEOUT_STOP'});};
 io.restoreCore=async()=>{throw new Error('cannot restore');};
 const out=await performWriterBInstall(maintenanceAuth(),io);
 assert.equal(out.status,'WRITER_B_RECOVERY_REQUIRED');
 assert.equal(state.retained,true);assert.equal(state.steps.includes('switch'),false);
});

test('B coordinator rejects forged registration flags before lock or other I/O',async()=>{
 const {io,state}=mockIO();
 await assert.rejects(performWriterBInstall({manifest:manifest(),
  manifestSha256:'e'.repeat(64),requestId:RID,
  registeredB:true,exactOneShot:true},io),
 {code:'WRITER_B_UNVERIFIED_ISSUE_STOP'});
 assert.deepEqual(state.steps,[]);
});

test('preimage compares actual 3-file SHA and scoped dirty, ignoring unrelated dirty',()=>{
 const m=manifest(),{io,state}=mockIO({otherDirty:true});
 assert.equal(state.unrelatedTrackedDirty,true);
 assert.throws(()=>verifyWriterBPreimage(m,{sourceRoot:m.sourceRoot}),
  {code:'WRITER_B_PC_PREIMAGE_STOP'});
});

test('preimage guard records only a bounded failing-check label',async()=>{
 const m=manifest(),{io}=mockIO(),good=await io.readPcPreimage();
 for(const [field,wrong,gate] of [
  ['head','f'.repeat(40),'HEAD'],
  ['configSource','f'.repeat(40),'CONFIG_SOURCE'],
  ['coreTaskEnabled',false,'TASK_ENABLED'],
  ['targetPathsClean',false,'TARGET_PATHS_CLEAN'],
  ['beforeSha256',{},'BEFORE_KEYSET'],
 ]){
  assert.throws(()=>verifyWriterBPreimage(m,{...good,[field]:wrong}),error=>{
   assert.equal(error.code,'WRITER_B_PC_PREIMAGE_STOP');
   assert.equal(error.preimageCheck,gate);
   assert.equal(JSON.stringify(error).includes(m.baseHead),false);
   return true;
  });
 }
});
test('preimage guard stops before claim and reports which gate failed',async()=>{
 const {io,state}=mockIO({dirtyTarget:true});
 const out=await performWriterBInstall(auth(),io);
 assert.equal(out.status,'WRITER_B_PREFLIGHT_STOP');
 assert.equal(out.code,'WRITER_B_PC_PREIMAGE_STOP');
 assert.equal(out.preimageCheck,'TARGET_PATHS_CLEAN');
 assert.equal(state.claimed,false);
 assert.deepEqual(state.steps,['lock','preimage','release']);
});

test('candidate source and exact prepared file diff must match per-file approval',()=>{
 const m=manifest();
 assert.throws(()=>verifyWriterBCandidate(m,{sourceSha:m.candidateSourceSha,
  clean:true,sha256:{}}),{code:'WRITER_B_CANDIDATE_SOURCE_STOP'});
 assert.throws(()=>verifyPreparedWriterCommit(m,{sha:NEXT,parent:m.baseHead,
  clean:true,changedPaths:[m.files[0].path],sha256:map(m.files,'afterSha256')}),
  {code:'WRITER_B_PREPARED_SCOPE_STOP'});
});

test('normal 3-file B install: HEAD/config sha consistent, task returned, no unrelated dirty change',async()=>{
 const {io,state}=mockIO({otherDirty:true});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_INSTALLED_VERIFIED');
 assert.equal(result.sourceSha,NEXT);assert.equal(state.head,NEXT);
 assert.equal(result.localOnly,true);
 assert.equal(result.mode,'LOCAL_OVERLAY');
 assert.equal(result.baseHead,manifest().baseHead);
 assert.equal(result.preparedTreeOid,'2'.repeat(40));
 assert.equal(state.config,NEXT);assert.equal(state.coreEnabled,true);
 assert.equal(state.unrelatedTrackedDirty,true);
 assert.equal(state.retained,false);
 assert.deepEqual(state.steps,['lock','preimage','candidate','window','claim','backup','prepare',
  'window-final','pause','drain','quiet','switch','assert-source','config','assert-config','resume',
  'task-verify','assert-source','assert-config','release']);
});

test('target dirty mismatch refuses before claim, never mutates Writer or config',async()=>{
 const {io,state}=mockIO({dirtyTarget:true});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_PREFLIGHT_STOP');
 assert.equal(result.code,'WRITER_B_PC_PREIMAGE_STOP');
 assert.equal(state.claimed,false);assert.equal(state.coreEnabled,true);
 assert.equal(state.head,manifest().baseHead);assert.equal(state.config,manifest().baseHead);
 assert.equal(state.released,true);assert.equal(state.retained,false);
});

test('missing relative runtime import preflight refuses before claim and Task changes',async()=>{
 const {io,state}=mockIO({otherDirty:true});
 io.readCandidate=async()=>{
  state.steps.push('candidate');
  throw Object.assign(new Error('unapproved import not on PC'),{
   code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP',
   diagnostic:{sourceKind:'APPROVED_AFTER',
    sourcePath:'scripts/pc-writer/run-local.mjs',
    dependencyPath:'scripts/pc-writer/required.mjs',reason:'NOT_FOUND',
    secret:'must-never-forward'}});
 };
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_PREFLIGHT_STOP');
 assert.equal(result.code,'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
 assert.deepEqual(result.diagnostic,{
  sourceKind:'APPROVED_AFTER',
  sourcePath:'scripts/pc-writer/run-local.mjs',
  dependencyPath:'scripts/pc-writer/required.mjs',reason:'NOT_FOUND'});
 assert.equal(state.claimed,false);
 assert.equal(state.coreEnabled,true);
 assert.equal(state.head,manifest().baseHead);
 assert.equal(state.config,manifest().baseHead);
 assert.equal(state.released,true);
 assert.deepEqual(state.steps,['lock','preimage','candidate','release']);
});

test('multiple missing imports remain one fail-closed preclaim result',async()=>{
 const {io,state}=mockIO();
 const first={sourceKind:'APPROVED_AFTER',
  sourcePath:'worker/employment-r6.mjs',
  dependencyPath:'lib/employment-r6-formula.mjs',reason:'NOT_FOUND'};
 const second={sourceKind:'APPROVED_AFTER',
  sourcePath:'worker/employment-r6.mjs',
  dependencyPath:'lib/employment-r4-shadow-contract.mjs',reason:'READ_ERROR'};
 io.readCandidate=async()=>{
  state.steps.push('candidate');
  throw Object.assign(new Error('untrusted private details'),{
   code:'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP',
   diagnostic:{...first,secret:'NEVER_FORWARD'},
   diagnostics:[first,{...second,secret:'NEVER_FORWARD'}],
   diagnosticsOmitted:0,
  });
 };
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_PREFLIGHT_STOP');
 assert.equal(result.code,'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP');
 assert.deepEqual(result.diagnostic,first);
 assert.deepEqual(result.diagnostics,[first,second]);
 assert.equal(result.diagnosticsOmitted,0);
 assert.equal(JSON.stringify(result).includes('NEVER_FORWARD'),false);
 assert.deepEqual(state.steps,['lock','preimage','candidate','release']);
 assert.equal(state.claimed,false);
 assert.equal(state.head,manifest().baseHead);
 assert.equal(state.config,manifest().baseHead);
 assert.equal(state.coreEnabled,true);
});

test('wrong candidate hash refuses before claim without touching PC source',async()=>{
 const {io,state}=mockIO({candidateWrong:true});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_PREFLIGHT_STOP');
 assert.equal(result.code,'WRITER_B_CANDIDATE_HASH_STOP');
 assert.equal(state.claimed,false);assert.equal(state.head,manifest().baseHead);
});

test('known R17 shared lock busy and one-shot replay remain distinguishable, no PC mutation',async()=>{
 for(const [upstream,publicCode] of [
  ['R17_B_SHARED_INSTALL_BUSY_NOOP_STOP','WRITER_B_SHARED_INSTALL_BUSY_NOOP_STOP'],
  ['R17_B_REQUEST_ALREADY_CLAIMED_STOP','WRITER_B_REQUEST_ALREADY_CLAIMED_STOP'],
  ['R17_B_SHARED_INSTALL_LOCK_STOP','WRITER_B_SHARED_INSTALL_LOCK_STOP'],
 ]){
  const {io,state}=mockIO();
  io.acquireSharedWriterLock=async()=>{
   throw Object.assign(new Error('nonpublic detail'),{code:upstream});
  };
  const result=await performWriterBInstall(auth(),io);
  assert.equal(result.status,'WRITER_B_PREFLIGHT_STOP');
  assert.equal(result.code,publicCode);
  assert.equal(state.claimed,false);
  assert.equal(state.head,manifest().baseHead);
  assert.equal(state.coreEnabled,true);
 }
});

test('claim init/lock drift retain exact bounded diagnostics; unknown upstream stays generic',async()=>{
 for(const [upstream,expected] of [
  ['R17_B_CLAIM_INITIALIZATION_STOP','WRITER_B_CLAIM_INITIALIZATION_STOP'],
  ['R17_B_SHARED_LOCK_DRIFT_STOP','WRITER_B_SHARED_LOCK_DRIFT_STOP'],
  ['R17_B_UNREVIEWED_INTERNAL','WRITER_B_ADAPTER_UNEXPECTED_STOP'],
 ]){
  const {io,state}=mockIO();
  io.claimRequest=async()=>{
   throw Object.assign(new Error('private error message'),{code:upstream});
  };
  const result=await performWriterBInstall(auth(),io);
  assert.equal(result.status,'WRITER_B_PREFLIGHT_STOP');
  assert.equal(result.code,expected);
  assert.equal(state.head,manifest().baseHead);
  assert.equal(state.released,true);
  assert.equal(state.steps.includes('pause'),false);
 }
});

test('partially switched source is restored with exact previous source/config',async()=>{
 const {io,state}=mockIO({failAt:'switch'});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_INSTALL_STOP_RESTORED');
 assert.equal(result.recovery,'ORIGINAL_VERIFIED');
 assert.equal(state.head,manifest().baseHead);assert.equal(state.config,manifest().baseHead);
 assert.equal(state.coreEnabled,true);assert.equal(state.retained,false);
});

test('partial config change rolls back both config and source before resuming Core',async()=>{
 const {io,state}=mockIO({failAt:'config'});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_INSTALL_STOP_RESTORED');
 assert.deepEqual(state.steps.slice(-6),['quiet','rollback-config','rollback-source',
  'resume','original-verify','release']);
 assert.equal(state.config,manifest().baseHead);assert.equal(state.head,manifest().baseHead);
});

test('busy natural Core defers before claim, backup, and Task pause; source/config untouched',async()=>{
 const {io,state}=mockIO({failAt:'window',otherDirty:true});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_PREFLIGHT_STOP');
 assert.equal(result.code,'WRITER_B_SIMULATED_WINDOW_STOP');
 assert.equal(state.claimed,false);
 assert.equal(state.steps.includes('backup'),false);
 assert.equal(state.steps.includes('prepare'),false);
 assert.equal(state.head,manifest().baseHead);
 assert.equal(state.config,manifest().baseHead);
 assert.equal(state.coreEnabled,true);
 assert.equal(state.steps.includes('pause'),false);
 assert.equal(state.steps.includes('switch'),false);
 assert.equal(state.steps.includes('resume'),false);
 assert.equal(state.retained,false);
 assert.equal(state.unrelatedTrackedDirty,true);
});

test('Task pause or Core natural-drain timeout resumes original Task without switching Writer',async()=>{
 for(const failAt of ['pause','drain']){
  const {io,state}=mockIO({failAt});
  const result=await performWriterBInstall(auth(),io);
  assert.equal(result.status,'WRITER_B_INSTALL_STOP_RESTORED',failAt);
  assert.equal(result.recovery,'ORIGINAL_VERIFIED',failAt);
  assert.equal(state.head,manifest().baseHead,failAt);
  assert.equal(state.config,manifest().baseHead,failAt);
  assert.equal(state.coreEnabled,true,failAt);
  assert.equal(state.steps.includes('switch'),false,failAt);
  assert.equal(state.steps.includes('rollback-source'),false,failAt);
  assert.equal(state.retained,false,failAt);
 }
});

test('recovery uncertainty retains shared lock and refuses automatic repeat',async()=>{
 const {io,state}=mockIO({failAt:'config',rollbackFail:true});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_RECOVERY_REQUIRED');
 assert.equal(result.recovery,'RECONCILE_EXACT_REQUEST_NO_RETRY');
 assert.equal(state.retained,true);
});

test('unverified lock finalize never yields a successful install status',async()=>{
 const {io,state}=mockIO({failAt:'release'});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_RECOVERY_REQUIRED');
 assert.equal(result.code,'WRITER_B_LOCK_FINALIZE_STOP');
 assert.equal(state.released,true);
});

test('release lock owner drift cannot claim install verified and keeps exact error',async()=>{
 const {io}=mockIO();
 io.releaseSharedWriterLock=async()=>{
  throw Object.assign(new Error('nonpublic lock owner detail'),
   {code:'R17_B_SHARED_LOCK_DRIFT_STOP'});
 };
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_RECOVERY_REQUIRED');
 assert.equal(result.code,'WRITER_B_SHARED_LOCK_DRIFT_STOP');
 assert.equal(result.recovery,'READ_ONLY_RECONCILE_LOCK_AND_SOURCE');
});

test('enable returned without actually enabling: rollback re-enables task after source restoration',async()=>{
 const {io,state}=mockIO({resumeUnconfirmedOnce:true});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_INSTALL_STOP_RESTORED');
 assert.equal(result.code,'WRITER_B_ADAPTER_UNEXPECTED_STOP');
 assert.equal(result.recovery,'ORIGINAL_VERIFIED');
 assert.equal(state.head,manifest().baseHead);
 assert.equal(state.config,manifest().baseHead);
 assert.equal(state.coreEnabled,true);
 assert.equal(state.resumeCalls,2);
 assert.equal(state.retained,false);
});

test('post-preparation Core cycle naturally finishes before the second bounded idle window returns',async()=>{
 const {io,state}=mockIO();
 const original=io.waitForCoreIdleWindow;
 io.waitForCoreIdleWindow=async phase=>{
  if(phase!=='POST_PREPARE')return original(phase);
  state.steps.push('window-final','core-cycle-observed','core-cycle-finished');
 };
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_INSTALLED_VERIFIED');
 assert.ok(state.steps.indexOf('prepare')<state.steps.indexOf('window-final'));
 assert.ok(state.steps.indexOf('core-cycle-finished')<state.steps.indexOf('pause'));
 assert.equal(state.coreEnabled,true);assert.equal(state.retained,false);
});

test('active Core after candidate preparation defers after bounded final wait, with original state verified',async()=>{
 const {io,state}=mockIO();const initial=io.waitForCoreIdleWindow;
 io.waitForCoreIdleWindow=async phase=>{
  if(phase!=='POST_PREPARE')return initial(phase);
  state.steps.push('window-final');
  throw Object.assign(new Error('busy core'),{code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED'});
 };
 const out=await performWriterBInstall(auth(),io);
 assert.equal(out.status,'WRITER_B_INSTALL_STOP_RESTORED');
 assert.equal(out.code,'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED');
 assert.equal(out.recovery,'ORIGINAL_VERIFIED');
 assert.equal(state.claimed,true);assert.equal(state.coreEnabled,true);
 assert.equal(state.steps.includes('pause'),false);
 assert.equal(state.steps.includes('switch'),false);
 assert.equal(state.head,manifest().baseHead);assert.equal(state.config,manifest().baseHead);
});

test('unknown Core state at final idle window never becomes a permitted pause',async()=>{
 const {io,state}=mockIO();const initial=io.waitForCoreIdleWindow;
 io.waitForCoreIdleWindow=async phase=>{
  if(phase!=='POST_PREPARE')return initial(phase);
  state.steps.push('window-final');
  throw Object.assign(new Error('unverified'),{code:'WRITER_B_CORE_WINDOW_UNVERIFIED_DEFERRED'});
 };
 const out=await performWriterBInstall(auth(),io);
 assert.equal(out.status,'WRITER_B_INSTALL_STOP_RESTORED');
 assert.equal(out.code,'WRITER_B_CORE_WINDOW_UNVERIFIED_DEFERRED');
 assert.equal(state.steps.includes('pause'),false);
 assert.equal(state.steps.includes('switch'),false);
 assert.equal(state.retained,false);
});

test('Task XML drift at final pause has distinct bounded failure code and no source switch',async()=>{
 const {io,state}=mockIO();
 io.pauseCore=async()=>{
  state.steps.push('pause');
  throw Object.assign(new Error('Task XML bytes are not returned'),
   {code:'WRITER_B_CORE_PREPAUSE_TASK_XML_DRIFT_STOP'});
 };
 const out=await performWriterBInstall(auth(),io);
 assert.equal(out.status,'WRITER_B_INSTALL_STOP_RESTORED');
 assert.equal(out.code,'WRITER_B_CORE_PREPAUSE_TASK_XML_DRIFT_STOP');
 assert.equal(state.steps.includes('window-final'),true);
 assert.equal(state.steps.includes('switch'),false);
 assert.equal(state.retained,false);assert.equal(state.coreEnabled,true);
});

test('Core restarts after the second idle window: final instant safety check still rejects',async()=>{
 const {io,state}=mockIO();
 io.pauseCore=async()=>{
  state.steps.push('pause');
  throw Object.assign(new Error('Core activity'),
   {code:'WRITER_B_CORE_PREPAUSE_RACE_DEFERRED'});
 };
 const out=await performWriterBInstall(auth(),io);
 assert.equal(out.status,'WRITER_B_INSTALL_STOP_RESTORED');
 assert.equal(out.code,'WRITER_B_CORE_PREPAUSE_RACE_DEFERRED');
 assert.equal(state.steps.includes('window-final'),true);
 assert.equal(state.steps.includes('switch'),false);
 assert.equal(state.retained,false);assert.equal(state.coreEnabled,true);
});

test('late-window restore uncertainty retains the original claim without another attempt',async()=>{
 const {io,state}=mockIO();const initial=io.waitForCoreIdleWindow;
 io.waitForCoreIdleWindow=async phase=>{
  if(phase!=='POST_PREPARE')return initial(phase);
  state.steps.push('window-final');
  throw Object.assign(new Error('Core timeout'),{code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED'});
 };
 io.verifyOriginalState=async()=>{state.steps.push('verify-original');
  throw Object.assign(new Error('unverified'),{code:'WRITER_B_ORIGINAL_STATE_STOP'});
 };
 const out=await performWriterBInstall(auth(),io);
 assert.equal(out.status,'WRITER_B_RECOVERY_REQUIRED');
 assert.equal(out.code,'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED');
 assert.equal(out.recovery,'RECONCILE_EXACT_REQUEST_NO_RETRY');
 assert.equal(state.retained,true);assert.equal(state.steps.includes('switch'),false);
});

test('late failure reacquires a maintenance window before restoring an already resumed Writer',async()=>{
 const {io,state}=mockIO();let checks=0;const verify=io.assertWriterSource;
 io.assertWriterSource=async()=>{await verify();if(++checks===2)throw Object.assign(Error('late'),{code:'WRITER_B_LATE_READBACK_STOP'});};
 io.prepareRollback=async()=>{state.steps.push('rollback-pause');assert.equal(state.coreEnabled,true);state.coreEnabled=false;};
 const out=await performWriterBInstall(maintenanceAuth(),io);
 assert.equal(out.status,'WRITER_B_INSTALL_STOP_RESTORED');assert.equal(state.head,manifest().baseHead);
 assert.equal(state.config,manifest().baseHead);assert.equal(state.coreEnabled,true);assert.equal(state.retained,false);
 assert.ok(state.steps.indexOf('rollback-pause')<state.steps.indexOf('rollback-config'));
 assert.ok(state.steps.lastIndexOf('drain')<state.steps.indexOf('rollback-config'));
});
test('rollback refuses external drift and preserves both failures without overwriting source',async()=>{
 const {io,state}=mockIO();let checks=0;const verify=io.assertWriterSource;
 io.assertWriterSource=async()=>{await verify();if(++checks===2)throw Object.assign(Error('late'),{code:'WRITER_B_LATE_READBACK_STOP'});};
 io.prepareRollback=async()=>{throw Object.assign(Error('external change'),{code:'WRITER_B_CONFIG_ROLLBACK_DRIFT_STOP'});};
 const out=await performWriterBInstall(maintenanceAuth(),io);
 assert.equal(out.status,'WRITER_B_RECOVERY_REQUIRED');assert.equal(out.code,'WRITER_B_LATE_READBACK_STOP');
 assert.equal(out.rollbackFailureCode,'WRITER_B_CONFIG_ROLLBACK_DRIFT_STOP');assert.equal(state.retained,true);
 assert.equal(state.steps.includes('rollback-config'),false);assert.equal(state.steps.includes('rollback-source'),false);
});
