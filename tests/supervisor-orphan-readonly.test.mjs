import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessOrphanRunnerPreflight} from '../controller/orphan-runner-readonly-contract.mjs';

const sha='a'.repeat(40);
const now=Date.parse('2026-11-27T08:05:00Z');
const sep=String.fromCharCode(92);
const root=['E:','ZGmini','automation','pc-control'].join(sep);
const listener=i=>({
 pid:1000+i,name:'Runner.Listener.exe',
 executablePath:[root,'runners',String(i).padStart(2,'0'),'bin','Runner.Listener.exe'].join(sep)
});
const worker=()=>({pid:1199,name:'Runner.Worker.exe',
 executablePath:[root,'runners','01','bin','Runner.Worker.exe'].join(sep)});
const service=()=>({pid:1200,name:'Runner.Listener.exe',executablePath:'',
 sessionId:0,serviceAncestor:true,serviceObservationAvailable:true});
const valid=()=>({
 oldOwner:{pid:9000,nonce:'6079df7b-3936-47b5-a419-373d9c32175f'},
 oldHeartbeat:{pid:9000,sourceSha:sha,mode:'LISTENING',
  at:'2026-11-27T08:03:00Z',
  children:Array.from({length:6},(_,i)=>({seat:i+1,pid:9100+i}))},
 oldSupervisorAlive:false,controllerFilesVerified:true,
 installedControllerSha:sha,expectedControllerSha:sha,
 watchdogInstalledMatch:true,watchdogOwnerVerified:true,
 workflowState:'active',installLeaseHeld:false,relatedLeasesAbsent:true,
 githubRunners:Array.from({length:6},(_,i)=>({name:'zgmini-pc-0'+(i+1),status:'online'})),
 wmiRows:[...Array.from({length:6},(_,i)=>listener(i+1)),worker(),service()],
 controllerRoot:root,canonicalize:s=>s,now,pidAlive:pid=>pid!==9000
});

test('six live seats and registered service listener are diagnostic only',()=>{
 const result=assessOrphanRunnerPreflight(valid());
 assert.equal(result.status,'READ_ONLY_CANDIDATE');
 assert.equal(result.code,'ORPHAN_SIX_CONTROLLER_LISTENERS_PRESERVED');
 assert.equal(result.controllerListenerCount,6);
 assert.equal(result.workerCount,1);
 assert.equal(result.serviceListenerExceptions,1);
 assert.equal(result.promotionAuthorized,false);
 assert.equal(result.runnerTerminationAuthorized,false);
 assert.equal(result.supervisorSpawnAuthorized,false);
 assert.equal(result.leaseMutationAuthorized,false);
 assert.equal(result.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(result),/9000|6079df7b|Runner.Listener.exe/);
});

test('dead owner, installed source, old seat lineage and roster mandatory',()=>{
 const mutations=[
  x=>{x.installedControllerSha='b'.repeat(40);},
  x=>{x.controllerFilesVerified=false;},
  x=>{x.watchdogInstalledMatch=false;},
  x=>{x.watchdogOwnerVerified=false;},
  x=>{x.workflowState='disabled_manually';},
  x=>{x.installLeaseHeld=true;},
  x=>{x.relatedLeasesAbsent=false;},
  x=>{x.oldSupervisorAlive=true;},
  x=>{x.pidAlive=()=>null;},
  x=>{x.oldOwner.pid=9001;},
  x=>{x.oldOwner.nonce='';},
  x=>{x.oldHeartbeat.pid=9001;},
  x=>{x.oldHeartbeat.mode='DRAIN';},
  x=>{x.oldHeartbeat.sourceSha='b'.repeat(40);},
  x=>{x.oldHeartbeat.children=x.oldHeartbeat.children.slice(1);},
  x=>{x.oldHeartbeat.children[5].seat=1;},
  x=>{x.oldHeartbeat.children[5].pid=9100;},
  x=>{x.oldHeartbeat.at='2026-11-27T08:04:50Z';},
  x=>{x.oldHeartbeat.at='2026-11-28T08:00:00Z';},
  x=>{x.githubRunners[2].status='offline';},
  x=>{x.githubRunners.push({name:'zgmini-pc-07',status:'online'});},
 ];
 for(let i=0;i<mutations.length;i++){
  const x=valid();mutations[i](x);
  const result=assessOrphanRunnerPreflight(x);
  assert.equal(result.status,'BLOCKED','mutation '+i);
  assert.equal(result.supervisorSpawnAuthorized,false);
 }
});

test('duplicate seats, WMI unknown paths and PID ambiguity fail closed',()=>{
 const mutations=[
  x=>{x.wmiRows.splice(1,1);},
  x=>{x.wmiRows[5].executablePath=x.wmiRows[4].executablePath;},
  x=>{x.wmiRows[5].pid=x.wmiRows[4].pid;},
  x=>{x.wmiRows[2].executablePath=['E:','Other','bin','Runner.Listener.exe'].join(sep);},
  x=>{x.wmiRows[2].executablePath='';},
  x=>{x.wmiRows[2].executablePath='C:relative.exe';},
  x=>{x.wmiRows.push({...service(),pid:1300});},
  x=>{x.wmiRows[7].serviceAncestor=false;},
  x=>{x.wmiRows[7].sessionId=1;},
  x=>{x.wmiRows[0].pid=9000;},
  x=>{x.canonicalize=()=>{throw Error('junction not verified');};},
  x=>{x.controllerRoot='.';},
  x=>{x.wmiRows[0].name='cmd.exe';},
 ];
 for(let i=0;i<mutations.length;i++){
  const x=valid();mutations[i](x);
  const result=assessOrphanRunnerPreflight(x);
  assert.equal(result.status,'BLOCKED','mutation '+i);
  assert.equal(result.promotionAuthorized,false);
  assert.equal(result.leaseMutationAuthorized,false);
 }
});

test('read-only module cannot start, terminate, archive or change leases',()=>{
 const source=fs.readFileSync(new URL('../controller/orphan-runner-readonly-contract.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bspawn\s*\(|\bexecFile\s*\(|\bexecFileSync\s*\(|\bkill\s*\(/);
 assert.doesNotMatch(source,/unlinkSync|renameSync|writeFileSync|mkdirSync|workflow_dispatch|taskkill|Stop-Process/);
 assert.match(source,/supervisorSpawnAuthorized:false/);
 assert.match(source,/runnerTerminationAuthorized:false/);
 assert.match(source,/leaseMutationAuthorized:false/);
});
