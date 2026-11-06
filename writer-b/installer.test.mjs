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
  runCount:1,allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
  allowTaskDefinitionChanges:false,allowOtherSourceChanges:false,
 };
}
const auth=()=>{
 const bytes=Buffer.from(JSON.stringify(manifest()));
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
 candidateWrong=false,otherDirty=false}={}){
 const m=manifest(),files=map(m.files,'beforeSha256'),
  protectedFiles=map(m.protectedFiles,'sha256');
 const state={head:m.baseHead,config:m.baseHead,branch:'main',coreEnabled:true,
  acquired:false,claimed:false,released:false,retained:false,
  unrelatedTrackedDirty:otherDirty,steps:[],files:{...files}};
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
   unrelatedTrackedDirty:state.unrelatedTrackedDirty,
  };},
  async readCandidate(){mark('candidate');fatal('candidate');const hashes=map(m.files,'afterSha256');
   if(candidateWrong)hashes[m.files[0].path]='0'.repeat(64);
   return {sourceSha:m.candidateSourceSha,clean:true,sha256:hashes};},
  async claimRequest(id){assert.equal(id,RID);state.claimed=true;mark('claim');fatal('claim');},
  async backupOriginal(){mark('backup');fatal('backup');},
  async prepareIsolatedCommit(){mark('prepare');fatal('prepare');return {
   sha:NEXT,parent:m.baseHead,clean:true,changedPaths:m.files.map(x=>x.path),
   sha256:map(m.files,'afterSha256'),
  };},
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
  async restoreCore(){mark('resume');state.coreEnabled=true;fatal('resume');},
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
 assert.equal(state.config,NEXT);assert.equal(state.coreEnabled,true);
 assert.equal(state.unrelatedTrackedDirty,true);
 assert.equal(state.retained,false);
 assert.deepEqual(state.steps,['lock','preimage','candidate','claim','backup','prepare',
  'pause','drain','quiet','switch','assert-source','config','assert-config','resume',
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

test('wrong candidate hash refuses before claim without touching PC source',async()=>{
 const {io,state}=mockIO({candidateWrong:true});
 const result=await performWriterBInstall(auth(),io);
 assert.equal(result.status,'WRITER_B_PREFLIGHT_STOP');
 assert.equal(result.code,'WRITER_B_CANDIDATE_HASH_STOP');
 assert.equal(state.claimed,false);assert.equal(state.head,manifest().baseHead);
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
