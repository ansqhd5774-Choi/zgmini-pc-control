import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {authenticateVmRequest,handoffSeat,parseWmi,probeVmFirmware,
 WMI_QUERY,VM_DISCOVERY_QUERY,parseVmDiscovery,probeVmDiscovery,
 toVmText,TITLE,SCHEMA} from '../tools/pc-winpe-vm-firmware-readonly.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const owner='ansqhd5774-Choi';
const fixture=()=>({
 event:{action:'opened',repository:{full_name:repo,private:true},
  issue:{number:1996,user:{login:owner},title:TITLE,body:JSON.stringify({
   schema:SCHEMA,operation:'winpe-vm-firmware-readonly',
   role:'handoff',scope:'C996_ISOLATED_VM_PREFLIGHT',
   requestId:'e7b30cc2-5208-4c53-9078-378d4b50c8c7'})}},
 env:{GITHUB_REPOSITORY:repo,GITHUB_ACTOR:owner,GITHUB_EVENT_NAME:'issues',
   GITHUB_RUN_ID:'43000000001',GITHUB_RUN_ATTEMPT:'1'},
});
const fakeVm=()=>({scope:'STANDARD_C_PATHS_ONLY',pathCount:6,
  programs:['VIRTUALBOX','QEMU','VMWARE_X64','VMWARE_X86','PLAYER','HYPERV'].map(
    id=>({id,status:'ABSENT_AT_FIXED_PATH'}))});
const wmi=values=>['VM_MONITOR','SLAT','FIRMWARE_ENABLED','HYPERVISOR_PRESENT']
  .map((key,i)=>key+'='+(values[i]??'unknown')).join('\r\n')+'\r\n';

test('exact owner, issue, run-once and request scope only',()=>{
 const x=fixture();assert.equal(authenticateVmRequest(x.event,x.env).attempt,'1');
 for(const edit of [
  e=>{e.issue.user.login='other';},
  e=>{e.issue.title='pc-job';},
  e=>{let v=JSON.parse(e.issue.body);v.shell='cmd.exe';e.issue.body=JSON.stringify(v);},
  e=>{let v=JSON.parse(e.issue.body);v.role='operating';e.issue.body=JSON.stringify(v);},
  e=>{let v=JSON.parse(e.issue.body);v.scope='C996_ORIGINAL_E';e.issue.body=JSON.stringify(v);},
 ]){
  let bad=structuredClone(x.event);edit(bad);
  assert.throws(()=>authenticateVmRequest(bad,x.env));
 }
 assert.throws(()=>authenticateVmRequest(x.event,{...x.env,GITHUB_RUN_ATTEMPT:'2'}));
});
test('handoff PC cannot match original operating PC or foreign Runner',()=>{
 const good={platform:'win32',host:'DESKTOP-N62L0NG',
  runner:'zgmini-handoff-ci-spare-01',originalRootExists:false};
 assert.equal(handoffSeat(good),null);
 for(const change of [
  {host:'PC'},{runner:'zgmini-pc-01'},{originalRootExists:true},{platform:'linux'},
 ]){
  assert.equal(handoffSeat({...good,...change}),'VM_HANDOFF_HOST_DENIED');
 }
});
test('WMI query is fixed read-only processor/system attributes only',()=>{
 assert.ok(WMI_QUERY.includes('Get-CimInstance -ClassName Win32_Processor'));
 assert.ok(WMI_QUERY.includes('Get-CimInstance -ClassName Win32_ComputerSystem'));
 for(const term of ['Set-CimInstance','Invoke-Expression','New-VM',
   'Set-VM','Restart-Computer','Start-VM','Win32_DiskDrive'])
  assert.equal(WMI_QUERY.includes(term),false);
 assert.deepEqual(parseWmi(wmi(['true','true','false','unknown'])),{
  VM_MONITOR:true,SLAT:true,FIRMWARE_ENABLED:false,HYPERVISOR_PRESENT:null,
 });
 assert.equal(parseWmi('VM_MONITOR=true'),null);
 assert.equal(parseWmi(wmi(['YES','true','false','false'])),null);
});
test('firmware observation does not imply existing VM software, boot or C authority',()=>{
 let called=false;
 const result=probeVmFirmware({platform:'win32',
  spawn:(exe,args,opts)=>{
   called=true;
   assert.equal(exe,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
   assert.deepEqual(args.slice(0,2),['-NoProfile','-NonInteractive']);
   assert.equal(opts.shell,false);
   return {status:0,stdout:wmi(['true','true','true','false'])};
  },vmProbe:fakeVm,discoveryProbe:()=>({status:'PASS',code:'TEST_ONLY'}),
 });
 assert.equal(called,true);
 assert.equal(result.status,'PASS');
 assert.equal(result.readiness,'VM_HARDWARE_FEATURES_PRESENT_ONLY');
 assert.equal(result.binaryPresentAtFixedPath,false);
 assert.equal(result.winpeBooted,false);
 assert.equal(result.bootAuthorized,false);
 assert.equal(result.cExecutionAuthorized,false);
 assert.equal(result.operationalWrites,0);
 const off=probeVmFirmware({platform:'win32',
  spawn:()=>({status:0,stdout:wmi(['true','true','false','false'])}),
  vmProbe:fakeVm,discoveryProbe:()=>({status:'PASS',code:'TEST_ONLY'})});
 assert.equal(off.readiness,'VM_FIRMWARE_DISABLED');
});
test('WMI access failures and malformed response are unknown, no fabricated zeros',()=>{
 const inputs=[
  {spawn:()=>({status:1,stdout:''}),expected:'VM_WMI_UNAVAILABLE'},
  {spawn:()=>({status:0,stdout:'invalid'}),expected:'VM_WMI_OUTPUT_INVALID'},
 ];
 for(const {spawn,expected} of inputs){
  let x=probeVmFirmware({platform:'win32',spawn,vmProbe:fakeVm,discoveryProbe:()=>({status:'PASS',code:'TEST_ONLY'})});
  assert.equal(x.status,'STATE_UNKNOWN');assert.equal(x.code,expected);
  assert.equal(x.bootAuthorized,false);
 }
 const unknown=probeVmFirmware({platform:'win32',
  spawn:()=>({status:0,stdout:wmi(['unknown','true','true','false'])}),
  vmProbe:fakeVm,discoveryProbe:()=>({status:'PASS',code:'TEST_ONLY'})});
 assert.equal(unknown.readiness,'VM_FIRMWARE_UNKNOWN');
 assert.equal(probeVmFirmware({platform:'linux'}).code,'VM_WINDOWS_ONLY');
 const t=toVmText({...unknown,requestId:'id',runId:'1',attempt:'1'});
 assert.doesNotMatch(t,/VM_MONITOR|ProcessorId|AppData|C:\\|E:\\/);
});
test('real handoff Runner reads native WMI only; no VM starts',t=>{
 if(process.platform!=='win32'||os.hostname().toUpperCase()!=='DESKTOP-N62L0NG'||
    process.env.RUNNER_NAME!=='zgmini-handoff-ci-spare-01'){
  t.skip('requires the existing isolated Windows Runner');return;
 }
 assert.equal(fs.existsSync('E:\\ZGmini'),false);
 const result=probeVmFirmware();
 assert.equal(result.status,'PASS',result.code);
 assert.equal(result.vmPrograms.length,6);
 assert.equal(result.winpeBooted,false);
 assert.equal(result.bootAuthorized,false);
 assert.equal(result.operationalWrites,0);
});


test('registered VM/PATH search uses only fixed application names and registry read calls',()=>{
 for(const token of ['Get-ItemProperty','Get-Command -Name','VBoxManage.exe',
  'qemu-system-x86_64.exe','vmware.exe','vmplayer.exe'])
  assert.ok(VM_DISCOVERY_QUERY.includes(token));
 for(const forbidden of ['Invoke-Expression','Start-Process','New-VM',
  'Set-ItemProperty','Remove-Item','Install-','Get-ChildItem','Restart-Computer',
  'Start-VM','E:\\ZGmini','WIM','Set-ExecutionPolicy'])
  assert.equal(VM_DISCOVERY_QUERY.includes(forbidden),false,forbidden);
});
test('scoped discovery cannot claim missing portable installs or VM execution',()=>{
 const p=parseVmDiscovery('REGISTERED=VIRTUALBOX,QEMU\r\nIN_PATH=VMWARE\r\nREGISTRY_PARTIAL=false\r\n');
 assert.deepEqual(p.registered,['VIRTUALBOX','QEMU']);
 assert.deepEqual(p.executableInPath,['VMWARE']);
 assert.equal(p.scope,'UNINSTALL_REGISTRY_AND_CURRENT_RUNNER_PATH');
 assert.equal(p.portableOutsidePathChecked,false);
 assert.equal(p.executableOperabilityVerified,false);
 const missing=parseVmDiscovery('REGISTERED=NONE\r\nIN_PATH=NONE\r\nREGISTRY_PARTIAL=true\r\n');
 assert.deepEqual(missing.registered,[]);
 assert.equal(missing.registryScanPartial,true);
 for(const invalid of [
  'REGISTERED=UNKNOWN\r\nIN_PATH=NONE\r\nREGISTRY_PARTIAL=false\r\n',
  'REGISTERED=VIRTUALBOX,VIRTUALBOX\r\nIN_PATH=NONE\r\nREGISTRY_PARTIAL=false\r\n',
  'REGISTERED=NONE\r\nIN_PATH=NONE\r\nREGISTRY_PARTIAL=yes\r\n',
  'REGISTERED=NONE\r\nIN_PATH=NONE\r\nREGISTRY_PARTIAL=false\r\nEXTRA=1',
 ]) assert.equal(parseVmDiscovery(invalid),null);
});
test('VM/PATH probe handles partial registry and malformed data without invented absences',()=>{
 let called=0;
 const ok=probeVmDiscovery({platform:'win32',
  spawn:(exe,args,opts)=>{
   called++;
   assert.equal(exe,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
   assert.equal(opts.shell,false);
   return {status:0,stdout:'REGISTERED=NONE\r\nIN_PATH=QEMU\r\nREGISTRY_PARTIAL=false\r\n'};
  }});
 assert.equal(called,1);
 assert.equal(ok.status,'PASS');
 assert.deepEqual(ok.executableInPath,['QEMU']);
 const partial=probeVmDiscovery({platform:'win32',spawn:()=>({
  status:0,stdout:'REGISTERED=NONE\r\nIN_PATH=NONE\r\nREGISTRY_PARTIAL=true\r\n',
 })});
 assert.equal(partial.status,'PARTIAL');
 assert.equal(probeVmDiscovery({platform:'win32',spawn:()=>({
  status:0,stdout:'ERROR: invalid output',
 })}).status,'STATE_UNKNOWN');
 assert.equal(probeVmDiscovery({platform:'linux'}).status,'STATE_UNKNOWN');
});
