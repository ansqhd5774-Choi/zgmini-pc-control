import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectPrivateOrphanWmiEvidence,readPrivateOrphanWmiEvidence,
 inspectPrivateOrphanWmiReadonly} from '../tools/supervisor-orphan-private-wmi.mjs';

const slash=String.fromCharCode(92);
const root=['E:','ZGmini','automation','pc-control'].join(slash);
const exe=(seat,role='Listener')=>
 [root,'runners',String(seat).padStart(2,'0'),'bin','Runner.'+role+'.exe'].join(slash);
const oldAt='2026-11-26T23:10:00.000Z';
const observed='2026-11-26T23:40:00.000Z';
const started='2026-11-26T23:00:00.000Z';
const listener=seat=>({
 pid:2200+seat,name:'Runner.Listener.exe',executablePath:exe(seat),
 sessionId:1,serviceAncestor:false,serviceObservationAvailable:true,
 startedAtUtc:started
});
const worker=()=>({...listener(3),pid:3303,name:'Runner.Worker.exe',
 executablePath:exe(3,'Worker'),startedAtUtc:'2026-11-26T23:35:00.000Z'});
const service=()=>({...listener(1),pid:1999,executablePath:'',
 sessionId:0,serviceAncestor:true,startedAtUtc:started});
const rows=()=>[...Array.from({length:6},(_,i)=>listener(i+1)),worker(),service()];
const project=(arr,options={})=>projectPrivateOrphanWmiEvidence(arr,{
 controllerRoot:root,canonicalize:x=>x,
 originalHeartbeatAt:oldAt,observedAt:observed,...options
});

test('private Win32 birth observations return sanitized public summary and in-memory six seats',()=>{
 const report=project(rows());
 assert.equal(report.status,'PASS');
 assert.equal(report.code,'ORPHAN_PRIVATE_WMI_NEW_OBSERVATION_ONLY');
 assert.equal(report.exactSeatCount,6);
 assert.equal(report.workerCount,1);
 assert.equal(report.originalPinsCompared,false);
 assert.equal(report.adoptionAuthorized,false);
 assert.equal(report.nonceVerified,false);
 assert.equal(report.operationalWrites,0);
 assert.equal(report.leaseMutationAuthorized,false);
 const privateProof=readPrivateOrphanWmiEvidence(report);
 assert.equal(privateProof.source,'WIN32_PROCESS_PRIVATE_SAME_HOST');
 assert.equal(privateProof.rows.length,6);
 assert.deepEqual(privateProof.rows.map(x=>x.seat),[1,2,3,4,5,6]);
 assert.equal(privateProof.rows[0].pid,2201);
 assert.equal(privateProof.rows[0].startedAtUtc,started);
 assert.equal(privateProof.rows[0].canonicalPathSha256.length,64);
 assert.equal(privateProof.workers[0].pid,3303);
 assert.doesNotMatch(JSON.stringify(report),/2201|3303|1999|startedAtUtc|executablePath|pc-control|nonce value/i);
 assert.equal(readPrivateOrphanWmiEvidence({...report}),null);
 assert.equal(readPrivateOrphanWmiEvidence(JSON.parse(JSON.stringify(report))),null);
});

test('pins captured from one private snapshot permit matching subsequent birth identity only',()=>{
 const first=project(rows());
 const pins=readPrivateOrphanWmiEvidence(first).rows;
 const second=project(rows(),{originalSeatPins:pins});
 assert.equal(second.status,'PASS');
 assert.equal(second.code,'ORPHAN_PRIVATE_WMI_SUPPLIED_PINS_MATCH');
 assert.equal(second.originalPinsCompared,true);
 assert.equal(second.adoptionAuthorized,false);
 assert.equal(second.nonceVerified,false);
 for(const mutate of [
  x=>{x[0].pid+=500;},
  x=>{x[0].startedAtUtc='2026-11-26T23:01:00.000Z';},
  x=>{x[0].executablePath=exe(2);},
  x=>{x[0].executablePath=exe(1).toUpperCase().replace('BIN','bin-other');}
 ]){
  const modified=rows();mutate(modified);
  assert.equal(project(modified,{originalSeatPins:pins}).status,'STATE_UNKNOWN');
 }
});

test('late-spawned Listener after old Supervisor heartbeat fails closed',()=>{
 const changed=rows();
 changed[0].startedAtUtc='2026-11-26T23:15:00.000Z';
 const result=project(changed);
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'ORPHAN_PRIVATE_WMI_PROCESS_BIRTH_OR_PATH_UNVERIFIED');
 assert.equal(readPrivateOrphanWmiEvidence(result),null);
});

test('duplicates, other controller roots, unknown exe or service ambiguity block',()=>{
 for(const mutate of [
  x=>{x.splice(0,1);},
  x=>{x[0].pid=x[1].pid;},
  x=>{x[0].executablePath='';},
  x=>{x[0].executablePath='C:\\other\\Runner.Listener.exe';},
  x=>{x[0].executablePath=exe(6);},
  x=>{x.push({...service(),pid:9900});},
  x=>{x[7].serviceAncestor=false;},
  x=>{x[7].startedAtUtc='not-time';},
  x=>{x[6].startedAtUtc='2026-11-26T23:50:00.000Z';}
 ]){
  const x=rows();mutate(x);
  assert.equal(project(x).status,'STATE_UNKNOWN');
 }
});

test('untrusted timestamps, canonicalizer failures and new pin sets do not authorize',()=>{
 assert.equal(project(rows(),{observedAt:'invalid'}).status,'STATE_UNKNOWN');
 assert.equal(project(rows(),{originalHeartbeatAt:observed}).status,'PASS');
 assert.equal(project(rows(),{originalHeartbeatAt:'2026-11-26T23:50:00.000Z'}).status,'STATE_UNKNOWN');
 assert.equal(project(rows(),{canonicalize:()=>{throw Error('ACCESS');}}).status,'STATE_UNKNOWN');
 assert.equal(project(rows(),{originalSeatPins:[]}).status,'STATE_UNKNOWN');
 assert.equal(project(rows(),{originalSeatPins:Array(6).fill({seat:1})}).status,'STATE_UNKNOWN');
});

test('fixed Windows private WMI read uses bounded CIM query and no shell or secret output',()=>{
 let command;
 const report=inspectPrivateOrphanWmiReadonly({
  platform:'win32',hostname:'PC',env:{SystemRoot:'C:\\Windows'},
  filesystem:{statSync:()=>({isFile:()=>true})},canonicalize:x=>x,
  originalHeartbeatAt:oldAt,now:()=>observed,
  run:(exe,args,options)=>{
   command={exe,args,options};return {status:0,stdout:JSON.stringify({rows:rows()})};
  }
 });
 assert.equal(report.status,'PASS');
 assert.equal(report.exactSeatCount,6);
 assert.equal(command.options.shell,false);
 assert.equal(command.options.windowsHide,true);
 assert.equal(command.options.timeout,15000);
 assert.match(command.args[4],/Win32_Process/);
 assert.match(command.args[4],/Win32_Service/);
 assert.match(command.args[4],/CreationDate/);
 assert.match(command.args[4],/ToUniversalTime/);
 assert.doesNotMatch(command.args[4],/Stop-Process|Set-CimInstance|Remove-Item|Start-Process|Invoke-Expression|Terminate\(/);
 assert.doesNotMatch(JSON.stringify(report),/2201|pc-control|Runner.Listener|startedAtUtc|PRIVATE_WINDOWS_SUPERVISOR_LAUNCH_LINEAGE/);
 assert.equal(readPrivateOrphanWmiEvidence(report).rows.length,6);
});

test('wrong host, non-Windows and WMI failures always return sanitized unknown',()=>{
 for(const props of [
  {platform:'linux',hostname:'PC',env:{SystemRoot:'C:\\Windows'}},
  {platform:'win32',hostname:'OTHER',env:{SystemRoot:'C:\\Windows'}},
  {platform:'win32',hostname:'PC',env:{SystemRoot:'X:\\Other'}}
 ]){
  const out=inspectPrivateOrphanWmiReadonly({...props,run:()=>{throw Error('SHOULD_NOT_RUN');}});
  assert.equal(out.status,'STATE_UNKNOWN');
  assert.equal(readPrivateOrphanWmiEvidence(out),null);
 }
 const opts={platform:'win32',hostname:'PC',env:{SystemRoot:'C:\\Windows'},
  filesystem:{statSync:()=>({isFile:()=>true})},originalHeartbeatAt:oldAt,
  now:()=>observed,canonicalize:x=>x};
 for(const run of [
  ()=>{throw Error('CREDENTIAL_SECRET');},
  ()=>({status:1,stdout:'CREDENTIAL_SECRET'}),
  ()=>({status:0,stdout:'CREDENTIAL_SECRET'})
 ]){
  const out=inspectPrivateOrphanWmiReadonly({...opts,run});
  assert.equal(out.status,'STATE_UNKNOWN');
  assert.doesNotMatch(JSON.stringify(out),/CREDENTIAL_SECRET/);
 }
});

test('private read-only source has no credential reader, process/lease mutation or log',()=>{
 const source=fs.readFileSync(new URL('../tools/supervisor-orphan-private-wmi.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/process\.kill|taskkill|Stop-Process|Set-CimInstance|Get-Process -IncludeUserName/);
 assert.doesNotMatch(source,/writeFileSync|renameSync|unlinkSync|mkdirSync|spawn\(|execFileSync|console\.log|process\.stdout\.write/);
 assert.doesNotMatch(source,/ZGMINI_SUPERVISOR_NONCE|SetEnvironmentVariable|ProcessEnvironment/);
 assert.match(source,/const internal=new WeakMap/);
 assert.match(source,/projectOrphanSeatMap/);
});
