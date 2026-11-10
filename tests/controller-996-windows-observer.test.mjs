import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {collect996WindowsEvidence,REQUEST_996}
 from '../tools/controller-996-windows-observer.mjs';

const sha=v=>createHash('sha256').update(v).digest('hex');
const at='2026-11-10T01:36:10.335Z';
const ownerNonce='e34f449e-5ab2-4a72-8bc3-f55f0b690d22';
const write=(root,relative,value)=>{
 const target=path.join(root,relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,typeof value==='string'?value:JSON.stringify(value));
 return target;
};
function fixture(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-readonly-'));
 const roots={control:path.join(temp,'control'),maintenance:path.join(temp,'maintenance'),
  writer:path.join(temp,'writer')};
 for(const root of Object.values(roots))fs.mkdirSync(root);
 const id=REQUEST_996.requestId;
 const ledger={requestId:id,issueNumber:996,installedShaBefore:REQUEST_996.controllerSha,
  targetSha:REQUEST_996.targetSha,status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
  firstFail:'INTAKE_PAUSED',code:'RUNNER_SET_DRIFT',updatedAt:at};
 const owner={pid:12345,nonce:ownerNonce,at};
 const marker={requestOwnerPid:12345,nonce:ownerNonce,at};
 const files=['controller/supervisor.mjs','controller/agent.mjs',
  'controller/worker.mjs','controller/host.mjs','config/operations.json'];
 const sourceBytes={};
 const originalFiles={};const stagedFiles={};
 const backup=`backups/controller-update-${id}/stage`;
 for(const rel of files){
  const before=rel+' old',next=rel+' next';
  sourceBytes[`${REQUEST_996.controllerSha}:${rel}`]=Buffer.from(before);
  sourceBytes[`${REQUEST_996.targetSha}:${rel}`]=Buffer.from(next);
  originalFiles[rel]=sha(before);stagedFiles[rel]=sha(next);
  write(roots.control,rel,before);write(roots.control,`${backup}/${rel}`,next);
 }
 write(roots.control,'host.json',{
  controllerSourceSha:REQUEST_996.controllerSha,controllerFiles:originalFiles});
 write(roots.control,`${backup}/host.json`,{
  controllerSourceSha:REQUEST_996.targetSha,controllerFiles:stagedFiles});
 write(roots.maintenance,`ledger/${id}.json`,ledger);
 write(roots.maintenance,'leases/controller-install/owner.json',owner);
 write(roots.maintenance,'leases/controller-install/RECOVERY_REQUIRED.json',marker);
 write(roots.maintenance,`backlog/${id}.json`,{
  schema:'ZGMINI_PC_BACKLOG_V1',requestId:id,pausedAt:at,resumedAt:null,
  windows:[{pausedAt:at,resumedAt:null}],replays:{}});
 const maintainerFiles=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs','tools/source-bundle-register.mjs'];
 const maintenanceMap={};
 for(const rel of maintainerFiles){
  const bytes=rel+' maintainer';maintenanceMap[rel]=sha(bytes);
  sourceBytes[`${REQUEST_996.maintainerSha}:${rel}`]=Buffer.from(bytes);
  write(roots.maintenance,rel,bytes);
 }
 write(roots.maintenance,'MAINTENANCE_INSTALL.json',{
  schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha:REQUEST_996.maintainerSha,
  files:maintenanceMap});
 write(roots.control,'leases/supervisor/owner.json',{
  pid:2222,nonce:ownerNonce,bootAt:Date.now()-os.uptime()*1000});
 write(roots.control,'SUPERVISOR_STATUS.json',{
  pid:2222,sourceSha:REQUEST_996.controllerSha,mode:'LISTENING',children:Array(6).fill('child'),
  at:new Date().toISOString()});
 for(const file of ['config.json','quota-runner.cmd','run-local.cmd'])write(roots.writer,file,'protected '+file);
 const runners=Array.from({length:6},(_,i)=>({
  name:`zgmini-pc-0${i+1}`,status:'online',busy:false}));
 const issue={number:996,title:'pc-controller-update',user:{login:'ansqhd5774-Choi'},
  body:JSON.stringify({requestId:id,targetControllerSha:REQUEST_996.targetSha,
   secret:'SHOULD_NEVER_LEAK'})};
 const apiResults={'actions/workflows/pc-job.yml':{state:'disabled_manually'},
  'actions/runners?per_page=100':{total_count:7,runners:[...runners,
   {name:'unrelated-spare',status:'offline',busy:true}]},'issues/996':issue};
 const api=route=>apiResults[route];
 const capture=(overrides={})=>collect996WindowsEvidence({roots,api,
  isAlive:pid=>pid===12345?false:pid===2222?true:null,
  readTask:name=>'a'.repeat(64),
  sourceRead:(commit,rel)=>sourceBytes[`${commit}:${rel}`],...overrides});
 return {temp,roots,capture,apiResults,owner,marker,id};
}
const withFixture=(name,fn)=>test(name,()=>{
 const f=fixture();try{fn(f);}finally{fs.rmSync(f.temp,{recursive:true,force:true});}
});

withFixture('7 runners including unrelated spare: exact six are valid, no C authorization',f=>{
 const result=f.capture();
 assert.equal(result.status,'C_EVIDENCE_GAPS');
 assert.equal(result.checks.dedicatedRunnersReady,true);
 assert.equal(result.independentRunnersObserved,1);
 assert.equal(result.checks.ownerDead,true);
 assert.equal(result.checks.installedControllerVerified,true);
 assert.equal(result.checks.stagedFilesVerified,true);
 assert.equal(result.checks.protectedBaselineVerified,false);
 assert.equal(result.checks.workflowDisableActorVerified,false);
 assert.equal(result.protectedBaselineSha256,null);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.pcRetries,0);
 assert.equal(Object.keys(result.digests).length,7);
 const output=JSON.stringify(result);
 assert.doesNotMatch(output,/12345|e34f449e|SHOULD_NEVER_LEAK/);
});

withFixture('original lease owner alive blocks C eligibility',f=>{
 const result=f.capture({isAlive:()=>true});
 assert.equal(result.checks.ownerDead,false);
 assert.equal(result.status,'C_EVIDENCE_GAPS');
});

withFixture('supervisor PID must be alive, unlike the stale install owner',f=>{
 const result=f.capture({isAlive:()=>false});
 assert.equal(result.checks.supervisorVerified,false);
});

withFixture('supervisor identity must belong to the current boot',f=>{
 const target=path.join(f.roots.control,'leases/supervisor/owner.json');
 const value=JSON.parse(fs.readFileSync(target,'utf8'));
 value.bootAt-=86400000;
 fs.writeFileSync(target,JSON.stringify(value));
 assert.equal(f.capture().checks.supervisorVerified,false);
});

withFixture('controller source drift detected without mutation',f=>{
 write(f.roots.control,'controller/worker.mjs','tampered');
 assert.equal(f.capture().checks.installedControllerVerified,false);
});

withFixture('self-consistent staged host hash does not bypass immutable Git source',f=>{
 const rel='controller/worker.mjs',next='unapproved staged bytes';
 const root=`backups/controller-update-${f.id}/stage`;
 write(f.roots.control,`${root}/${rel}`,next);
 const hostPath=path.join(f.roots.control,root,'host.json');
 const host=JSON.parse(fs.readFileSync(hostPath,'utf8'));
 host.controllerFiles[rel]=sha(next);
 fs.writeFileSync(hostPath,JSON.stringify(host));
 assert.equal(f.capture().checks.stagedFilesVerified,false);
});

withFixture('staged unlisted file stops evidence classification',f=>{
 write(f.roots.control,`backups/controller-update-${f.id}/stage/controller/hidden.mjs`,'extra');
 assert.throws(()=>f.capture(),{code:'STAGE_FILE_SET_DRIFT'});
});

withFixture('protected previous baseline absence is explicit, never synthesized',f=>{
 const result=f.capture();
 assert.equal(result.checks.stageOnly,true);
 assert.equal(result.checks.protectedBaselineVerified,false);
 assert.equal(result.digests.protectedSnapshot,undefined);
});

withFixture('recovery claim already present is not an ordinary free lease',f=>{
 fs.mkdirSync(path.join(f.roots.maintenance,'leases/controller-recovery'));
 assert.equal(f.capture().checks.recoveryClaimAbsent,false);
});

withFixture('workflow active while paused remains a mismatch',f=>{
 f.apiResults['actions/workflows/pc-job.yml'].state='active';
 assert.equal(f.capture().checks.workflowDisabled,false);
});

withFixture('unreachable GitHub cannot produce successful evidence',f=>{
 assert.throws(()=>f.capture({api:()=>{throw Error('offline');}}),/offline/);
});

withFixture('issue identity and target must be pinned',f=>{
 f.apiResults['issues/996'].body=JSON.stringify({requestId:f.id,
  targetControllerSha:'f'.repeat(40)});
 assert.equal(f.capture().checks.originalIssuePinned,false);
});

withFixture('duplicate dedicated runner row invalidates dedicated count',f=>{
 const arr=f.apiResults['actions/runners?per_page=100'].runners;
 arr.push({...arr[0]});
 assert.equal(f.capture().checks.dedicatedRunnersReady,false);
});

withFixture('incomplete paginated runner inventory cannot prove six unique seats',f=>{
 f.apiResults['actions/runners?per_page=100'].total_count=108;
 const observation=f.capture();
 assert.equal(observation.checks.runnerListComplete,false);
 assert.equal(observation.checks.dedicatedRunnersReady,false);
});

test('production observer has no source path to operational writes or auto issue posting',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../tools/controller-996-windows-observer.mjs',import.meta.url)),'utf8');
 assert.doesNotMatch(source,/\b(?:writeFileSync|renameSync|unlinkSync|mkdirSync|rmSync|cpSync|killSync)\s*\(/);
 assert.doesNotMatch(source,/\b(?:fetch|https\.request|http\.request)\s*\(/);
 assert.doesNotMatch(source,/--method\s*["'`]?(?:POST|PUT|DELETE)/);
});
