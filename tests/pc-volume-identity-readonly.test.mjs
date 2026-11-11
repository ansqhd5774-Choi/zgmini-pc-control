import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {authenticateVolumeIssue,originalPcGate,buildFixedVolumeProbe,
 decodeFixedVolumeResponse,probeFixedVolume,volumeText,SCHEMA,TITLE}
 from '../tools/pc-volume-identity-readonly.mjs';

const owner='ansqhd5774-Choi',repo=owner+'/zgmini-pc-control';
const validRequest=()=>({
 event:{action:'opened',repository:{full_name:repo,private:true},
  issue:{number:1996,title:TITLE,user:{login:owner},
   body:JSON.stringify({schema:SCHEMA,operation:'volume-identity-readonly',
    scope:'C996_FIXED_E_VOLUME',requestId:'5e71cf98-5b8f-4dd4-8fb2-8a2be809e400'})}},
 env:{GITHUB_REPOSITORY:repo,GITHUB_ACTOR:owner,GITHUB_EVENT_NAME:'issues',
  GITHUB_RUN_ID:'43120000001',GITHUB_RUN_ATTEMPT:'1'},
});
const guid='\\\\?\\Volume{33333333-3333-4333-8333-333333333333}\\';
const id=(k)=>'1'.repeat(16)+':'+String(k).repeat(32);
const response=(mode='operating', overrides={})=>{
 const data={VOLUME_GUID:guid,VOLUME_ROOT:id(1),ZGMINI:id(2),LEASES:id(3)};
 if(mode==='operating')Object.assign(data,{OLD_C:id(4),INSTALL:id(5)});
 Object.assign(data,overrides);
 return Object.entries(data).map(([k,v])=>k+'='+v).join('\r\n')+'\r\n';
};

test('fixed owner/role/scope Issue admits one unique A read-only request',()=>{
 const x=validRequest(),y=authenticateVolumeIssue(x.event,x.env);
 assert.equal(y.issueNumber,1996);
 assert.equal(y.attempt,'1');
 for(const edit of [
  e=>{e.issue.title='pc-job';},
  e=>{e.issue.user.login='other';},
  e=>{let b=JSON.parse(e.issue.body);b.path='E:\\other';e.issue.body=JSON.stringify(b);},
  e=>{let b=JSON.parse(e.issue.body);b.operation='exec';e.issue.body=JSON.stringify(b);},
  e=>{let b=JSON.parse(e.issue.body);b.scope='OTHER';e.issue.body=JSON.stringify(b);},
 ]){
  const bad=structuredClone(x.event);edit(bad);
  assert.throws(()=>authenticateVolumeIssue(bad,x.env));
 }
 assert.throws(()=>authenticateVolumeIssue(x.event,{...x.env,GITHUB_RUN_ATTEMPT:'2'}));
});
test('original PC identity requires correct Windows hostname, Runner, operating Node',()=>{
 assert.equal(originalPcGate({platform:'win32',hostname:'PC',runnerName:'zgmini-pc-03',
  nodePath:'E:\\ZGmini\\runtime\\node.exe'}),null);
 for(const value of [
  {hostname:'DESKTOP-N62L0NG'},{runnerName:'zgmini-handoff-ci-spare-01'},
  {nodePath:'C:\\Program Files\\nodejs\\node.exe'},{platform:'linux'},
 ]){
  const input={platform:'win32',hostname:'PC',runnerName:'zgmini-pc-03',
   nodePath:'E:\\ZGmini\\runtime\\node.exe',...value};
  assert.equal(originalPcGate(input),'VOLUME_ORIGINAL_PC_IDENTITY_DENIED');
 }
});
test('fixed Win32 script references only known drives and read-only functions',()=>{
 const source=fs.readFileSync(new URL('../tools/pc-volume-identity-win32-readonly.cs',import.meta.url),'utf8');
 for(const call of ['GetVolumeNameForVolumeMountPointW','GetFileInformationByHandleEx',
   'FileIdInfo','FileAttributeTagInfo','OPEN_REPARSE_POINT'])
   assert.ok(source.includes(call),'missing '+call);
 for(const call of ['SetFileInformationByHandle','MoveFile','DeleteFile',
   'FSCTL_LOCK_VOLUME','SetNamedSecurityInfo','RegSetValue','WinExec','Process.Start'])
   assert.ok(!source.includes(call),'forbidden '+call);
 const script=buildFixedVolumeProbe('operating',source);
 assert.match(script,/Add-Type -TypeDefinition/);
 assert.match(script,/E:\\ZGmini\\automation\\pc-maintenance\\leases\\controller-install/);
 assert.doesNotMatch(script,/Get-Content|Invoke-Expression|ExecutionPolicy Bypass/);
 const fixture=buildFixedVolumeProbe('handoff-fixture',source);
 assert.match(fixture,/C:\\Windows\\System32/);
 assert.doesNotMatch(fixture,/E:\\ZGmini/);
 assert.throws(()=>buildFixedVolumeProbe('arbitrary',source));
});
test('fixed response checks GUID, 128-bit IDs, same-volume serial, missing C',()=>{
 const proof=decodeFixedVolumeResponse(response(),'operating');
 assert.equal(proof.status,'PASS');
 assert.equal(proof.source,'WIN32_GET_VOLUME_NAME_AND_FILE_ID_INFO');
 assert.equal(Object.keys(proof.directories).length,5);
 assert.equal(proof.volumeSerial,'1'.repeat(16));
 assert.equal(proof.directories.INSTALL.fileId128,'5'.repeat(32));
 assert.equal(proof.offlineVolumeVerified,false);
 assert.equal(proof.cExecutionAuthorized,false);
 assert.equal(proof.operationalWrites,0);
 assert.equal(decodeFixedVolumeResponse(response('operating',{OLD_C:'ABSENT'}),'operating').code,
  'VOLUME_ORIGINAL_C_DIR_MISSING');
 assert.equal(decodeFixedVolumeResponse(response('operating',{VOLUME_GUID:'E:\\'}),'operating').code,
  'VOLUME_GUID_INVALID');
 assert.equal(decodeFixedVolumeResponse(response('operating',{INSTALL:'1'.repeat(16)+':'+'a'.repeat(31)}),'operating').code,
  'VOLUME_ID_INVALID');
 assert.equal(decodeFixedVolumeResponse(response('operating',{INSTALL:'2'.repeat(16)+':'+'a'.repeat(32)}),'operating').code,
  'VOLUME_SERIAL_MISMATCH');
 assert.equal(decodeFixedVolumeResponse(response()+'EXTRA=foo','operating').code,
  'VOLUME_NATIVE_OUTPUT_INVALID');
});
test('report text reveals no raw volume GUID, file IDs, paths or secrets',()=>{
 const proof=decodeFixedVolumeResponse(response(),'operating');
 const text=volumeText({...proof,requestId:'id',runId:'1',attempt:'1'});
 assert.match(text,/operationalWrites=0/);
 assert.doesNotMatch(text,/Volume\{|E:\\|ZGmini|1111111111111111|TOKEN|PASSWORD/);
 assert.equal(probeFixedVolume('operating',{platform:'linux'}).code,'VOLUME_WINDOWS_ONLY');
});
test('native read-only Win32 proof runs on isolated Windows fixture only',t=>{
 if(process.platform!=='win32'||os.hostname().toUpperCase()!=='DESKTOP-N62L0NG'||
    process.env.RUNNER_NAME!=='zgmini-handoff-ci-spare-01'){
  t.skip('requires existing isolated Windows GitHub Runner');return;
 }
 assert.equal(fs.existsSync('E:\\ZGmini'),false);
 const proof=probeFixedVolume('handoff-fixture');
 assert.equal(proof.status,'PASS',proof.code);
 assert.equal(proof.directoryFileIds?.length,undefined);
 assert.equal(Object.keys(proof.directories).length,3);
 assert.equal(proof.offlineVolumeVerified,false);
 assert.equal(proof.operationalWrites,0);
});
