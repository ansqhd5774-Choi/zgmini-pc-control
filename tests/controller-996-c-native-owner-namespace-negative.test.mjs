// Exact native candidate negative proof: only the separate queue-PC TEMP tree.
// It intentionally creates a competing JSON in a synthetic fixture and MUST
// stop before SetFileInformationByHandle. Never call the production C operator.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build996OwnerArchiveFixtureScript} from '../tools/controller-996-c-native-owner-operator.mjs';
import {review996UntrustedNativeIdReceipt} from '../tools/controller-996-winpe-native-receipt-review.mjs';
import {plan996SingleBootRecovery} from '../tools/controller-996-windows-archive-adapter.mjs';

const hostAllowed = process.platform==='win32' &&
  process.env.GITHUB_ACTIONS==='true' &&
  process.env.COMPUTERNAME==='DESKTOP-N62L0NG' &&
  process.env.RUNNER_NAME==='zgmini-handoff-ci-spare-01' &&
  !fs.existsSync('E:/ZGmini');

test('native TEMP fixture demonstrates insertion can race pinned file handles without any move', {
  skip: !hostAllowed && 'Only on the existing isolated handoff Windows runner',
}, () => {
  const tmp=fs.realpathSync.native(os.tmpdir());
  assert.equal(path.win32.parse(tmp).root.toLowerCase(),'c:\\');
  const dir=fs.mkdtempSync(path.join(tmp,'zgmini-996-handle-fixture-'));
  const src=path.join(dir,'source');
  const dst=path.join(dir,'would-have-moved');
  assert.equal(path.dirname(dir).toLowerCase(),tmp.toLowerCase());
  const nonce=randomUUID();
  const bytes=Buffer.from(JSON.stringify({pid:process.pid,nonce})+'\n');
  try {
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src,'owner.json'),bytes,{flag:'wx'});
    const powershell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
    assert.equal(fs.existsSync(powershell),true);
    const input={operation:'move',root:dir,source:src,destination:dst,
      pins:{'owner.json':createHash('sha256').update(bytes).digest('hex')},
      ownerMode:'LIVE_NEW',actorPid:process.pid,nonce,simulateNamespaceInsert:true};
    // Fixture=true is fixed in the generated C# and prevents production roots.
    const script=build996OwnerArchiveFixtureScript();
    assert.match(script,/static readonly bool Fixture = true;/);
    assert.match(script,/C996_NATIVE_COMPETING_INSERT_NOT_BLOCKED/);
    assert.match(script,/Need\(Fixture,"C996_NATIVE_NAMESPACE_ATOMICITY_UNPROVEN"\);/);
    const result=spawnSync(powershell,['-NoProfile','-NonInteractive','-Command',script],{
      input:JSON.stringify(input),encoding:'utf8',windowsHide:true,timeout:25000,
      maxBuffer:100000,
    });
    assert.equal(result.error,undefined,result.error?.message);
    assert.equal(result.status,0,
      'Native fixture unavailable: '+String(result.stderr).slice(-1500));
    const report=JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
    assert.equal(report.ok,false);
    assert.equal(report.code,'C996_NATIVE_COMPETING_INSERT_NOT_BLOCKED');
    assert.equal(report.moveOccurred,false);
    assert.deepEqual(fs.readFileSync(path.join(src,'owner.json')),bytes);
    assert.equal(fs.readFileSync(path.join(src,'competing.json'),'utf8'),'{}');
    assert.equal(fs.existsSync(dst),false);
  } finally {
    // Only remove the unique TEMP fixture created by this test.
    assert.ok(path.basename(dir).startsWith('zgmini-996-handle-fixture-'));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});


test('isolated TEMP probes whether exclusive directory share zero blocks an independent child insertion', {
  skip: !hostAllowed && 'Only the existing isolated handoff Windows Runner',
}, () => {
  const temp=fs.realpathSync.native(os.tmpdir());
  assert.equal(path.win32.parse(temp).root.toLowerCase(),'c:\\');
  const root=fs.mkdtempSync(path.join(temp,'zgmini-996-exclusive-dir-probe-'));
  const source=path.join(root,'source');
  const child=path.join(source,'independent-child.json');
  const powershell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
  // This is a separate OS process, not a second managed call in the lock holder.
  const script=String.raw`
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class C996ExclusiveDirProbe {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 private static extern SafeFileHandle CreateFileW(string name,uint access,uint share,
  IntPtr security,uint disposition,uint flags,IntPtr template);
 public static string Probe(string directory,string node,string childScript) {
  using(var handle=CreateFileW(directory,0x80,0,IntPtr.Zero,3,0x02000000|0x00200000,IntPtr.Zero)) {
   if(handle.IsInvalid)return "EXCLUSIVE_OPEN_FAILED_"+Marshal.GetLastWin32Error();
   var p=new ProcessStartInfo();
   p.FileName=node;p.Arguments="-e \""+childScript+"\"";
   p.UseShellExecute=false;p.CreateNoWindow=true;
   p.RedirectStandardOutput=true;p.RedirectStandardError=true;
   using(var competing=Process.Start(p)) {
    if(competing==null)return "CHILD_START_FAILED";
    if(!competing.WaitForExit(7000)){competing.Kill();competing.WaitForExit();return "CHILD_TIMEOUT";}
    return competing.ExitCode==0?"CHILD_INSERT_SUCCEEDED":"CHILD_INSERT_DENIED_"+competing.ExitCode;
   }
  }
 }
}
'@ -ReferencedAssemblies 'System.Core'
$inputObject=ConvertFrom-Json ([Console]::In.ReadToEnd())
[Console]::WriteLine([C996ExclusiveDirProbe]::Probe(
 $inputObject.directory,$inputObject.node,$inputObject.script))
`;
  try {
    fs.mkdirSync(source);
    assert.equal(fs.existsSync(powershell),true);
    const pathBase64=Buffer.from(child,'utf8').toString('base64');
    const childScript="require('node:fs').writeFileSync(Buffer.from('"+
      pathBase64+"','base64').toString('utf8'),'{}',{flag:'wx'})";
    const result=spawnSync(powershell,['-NoProfile','-NonInteractive','-Command',script],{
      input:JSON.stringify({directory:source,node:process.execPath,script:childScript}),
      encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:100000});
    assert.equal(result.error,undefined,result.error?.message);
    assert.equal(result.status,0,String(result.stderr).slice(-1800));
    const status=String(result.stdout).trim().split(/\r?\n/).at(-1);
    // A directory share lock is not assumed to make child namespace insertion
    // exclusive. A surprising block is a separate research outcome, not C approval.
    assert.equal(status,'CHILD_INSERT_SUCCEEDED',
      'Exclusive-directory insertion outcome: '+status);
    assert.equal(fs.readFileSync(child,'utf8'),'{}');
    assert.equal(fs.existsSync(path.join(root,'destination')),false);
  } finally {
    assert.ok(path.basename(root).startsWith('zgmini-996-exclusive-dir-probe-'));
    fs.rmSync(root,{recursive:true,force:true});
  }
});


test('WinPE-style native FILE_ID_INFO identifies the same directory across a rename and rejects a replaced name', {
  skip: !hostAllowed && 'Only the existing isolated handoff Windows Runner',
}, () => {
  const tmp=fs.realpathSync.native(os.tmpdir());
  assert.equal(path.win32.parse(tmp).root.toLowerCase(),'c:\\');
  const root=fs.mkdtempSync(path.join(tmp,'zgmini-996-native-id-fixture-'));
  const source=path.join(root,'source');
  const archive=path.join(root,'archive');
  const powershell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
  const script="\n$ErrorActionPreference='Stop'\nAdd-Type -TypeDefinition @'\nusing System;\nusing System.Runtime.InteropServices;\nusing Microsoft.Win32.SafeHandles;\npublic static class C996WinpeNativeIdTest {\n [StructLayout(LayoutKind.Sequential)]\n public struct FileIdInfo {\n  public UInt64 VolumeSerialNumber;\n  [MarshalAs(UnmanagedType.ByValArray, SizeConst=16)]\n  public byte[] FileId;\n }\n [DllImport(\"kernel32.dll\",CharSet=CharSet.Unicode,SetLastError=true)]\n private static extern SafeFileHandle CreateFileW(string name,uint access,uint share,\n  IntPtr security,uint disposition,uint flags,IntPtr template);\n [DllImport(\"kernel32.dll\",SetLastError=true)]\n [return:MarshalAs(UnmanagedType.Bool)]\n private static extern bool GetFileInformationByHandleEx(SafeFileHandle handle,\n  int infoClass,out FileIdInfo info,uint size);\n public static string ReadOnlyId(string directory) {\n  using(var h=CreateFileW(directory,0x80,7,IntPtr.Zero,3,0x02000000|0x00200000,IntPtr.Zero)){\n   if(h.IsInvalid)throw new InvalidOperationException(\"OPEN_FAILED_\"+Marshal.GetLastWin32Error());\n   FileIdInfo info;\n   if(!GetFileInformationByHandleEx(h,18,out info,(uint)Marshal.SizeOf(typeof(FileIdInfo))))\n    throw new InvalidOperationException(\"FILE_ID_INFO_FAILED_\"+Marshal.GetLastWin32Error());\n   if(info.FileId==null||info.FileId.Length!=16)\n    throw new InvalidOperationException(\"FILE_ID_INFO_INVALID\");\n   return info.VolumeSerialNumber.ToString(\"x16\")+\"|\"+\n    BitConverter.ToString(info.FileId).Replace(\"-\",\"\").ToLowerInvariant();\n  }\n }\n}\n'@\n$inputObject=ConvertFrom-Json ([Console]::In.ReadToEnd())\n[Console]::WriteLine([C996WinpeNativeIdTest]::ReadOnlyId($inputObject.path))\n";
  const observe=directory=>{
    const proc=spawnSync(powershell,['-NoProfile','-NonInteractive','-Command',script],{
      input:JSON.stringify({path:directory}),encoding:'utf8',
      windowsHide:true,timeout:30000,maxBuffer:120000});
    assert.equal(proc.error,undefined,proc.error?.message);
    assert.equal(proc.status,0,String(proc.stderr).slice(-800));
    const result=String(proc.stdout).trim().split(/\r?\n/).at(-1);
    assert.match(result,/^[0-9a-f]{16}\|[0-9a-f]{32}$/);
    return result.split('|');
  };
  try{
    fs.mkdirSync(source);
    assert.equal(fs.existsSync(powershell),true);
    const [serialBefore,idBefore]=observe(source);
    fs.renameSync(source,archive);
    const [serialAfter,idAfter]=observe(archive);
    assert.equal(serialAfter,serialBefore);
    assert.equal(idAfter,idBefore);
    // Keep original archive in place: a replacement has a different native ID.
    fs.mkdirSync(source);
    const [serialReplaced,idReplaced]=observe(source);
    assert.equal(serialReplaced,serialBefore);
    assert.notEqual(idReplaced,idBefore);
    assert.equal(fs.readdirSync(root).sort().join(','),'archive,source');
    // This is a local NTFS/Windows native API fixture, not WinPE boot proof.
  }finally{
    assert.ok(path.basename(root).startsWith('zgmini-996-native-id-fixture-'));
    fs.rmSync(root,{recursive:true,force:true});
  }
});


const nativeVolumeReaderPath=new URL(
  '../tools/controller-996-winpe-native-volume-ids-readonly.c',import.meta.url);

test('eight pinned WinPE directory identities can only be collected by an inert native reader',()=>{
  const source=fs.readFileSync(nativeVolumeReaderPath,'utf8');
  assert.match(source,/#if defined\(C996_ENABLE_C_GRADE_OPERATOR\)\s*#error/);
  assert.match(source,/#define C996_FIXED_ID_COUNT 8/);
  for(const key of ['VOLUME_ROOT','ZGMINI','AUTOMATION','MAINTENANCE',
                    'LEASES','OLD_C','INSTALL','CONTINUATION'])
    assert.ok(source.includes('"'+key+'"'),'missing fixed '+key);
  assert.match(source,/c996_valid_volume_guid\(untrustedVolumeGuid\)/);
  assert.match(source,/c996_valid_uuid\(untrustedContinuationUuid\)/);
  assert.match(source,/c996_expected_serial\(untrustedVolumeSerial/);
  assert.match(source,/CreateFileW\(fullPath,FILE_READ_ATTRIBUTES,/);
  assert.match(source,/FILE_FLAG_BACKUP_SEMANTICS\|FILE_FLAG_OPEN_REPARSE_POINT/);
  assert.match(source,/GetFileInformationByHandleEx\(h,FileAttributeTagInfo,/);
  assert.match(source,/GetFileInformationByHandleEx\(h,FileIdInfo,/);
  assert.match(source,/FILE_ATTRIBUTE_REPARSE_POINT/);
  assert.match(source,/C996_NATIVE_ID_READ_COMPLETE_UNTRUSTED/);
  assert.match(source,/observation\.idsCollected=C996_FIXED_ID_COUNT/);
  assert.match(source,/observation\.isSourceOnlyObservation=1/);
  assert.doesNotMatch(source,/\b(?:SetFileInformationByHandle|MoveFileExW|WriteFile|DeleteFileW|RemoveDirectoryW|CreateDirectoryW|ShellExecuteW|WinExec|RegSetValueExW|ExitWindowsEx)\s*\(/);
  assert.doesNotMatch(source,/(?:^|\n)\s*(?:int|void)\s+main\s*\(/);
  assert.doesNotMatch(source,/executionAuthorized\s*=\s*(?:true|1)/i);
});

test('native fixed eight-ID WinPE reader builds as x64 object when isolated MSVC is installed',{
  skip: !hostAllowed && 'Only existing isolated Windows C: TEMP runner may compile',
},(t)=>{
  const pf86=process.env['ProgramFiles(x86)'];
  if(!pf86) return t.skip('MSVC installation root unavailable; no fallback install');
  const vswhere=path.join(pf86,'Microsoft Visual Studio','Installer','vswhere.exe');
  if(!fs.existsSync(vswhere)) return t.skip('vswhere not installed, no new compiler installation');
  const vs=spawnSync(vswhere,['-latest','-products','*',
    '-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property','installationPath'],{
    encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:8000});
  if(vs.status!==0||vs.error) return t.skip('MSVC discovery not available');
  const root=String(vs.stdout).trim().split(/\r?\n/)[0]||'';
  const dev=path.join(root,'Common7','Tools','VsDevCmd.bat');
  if(!root||!fs.existsSync(dev))return t.skip('x64 MSVC tools not installed');
  const tmp=fs.realpathSync.native(os.tmpdir());
  assert.equal(path.win32.parse(tmp).root.toLowerCase(),'c:\\');
  const output=fs.mkdtempSync(path.join(tmp,'zgmini-996-native-reader-build-'));
  try{
    const object=path.join(output,'reader.obj');
    const reader=fileURLToPath(nativeVolumeReaderPath);
    // cmd.exe /c quoting differs for paths with spaces. Use an isolated
    // fixed TEMP script rather than a nested command-line string.
    for(const v of [dev,reader,object])
      assert.doesNotMatch(v,/[\r\n"&|<>]/);
    const batch=path.join(output,'compile-reader.cmd');
    const contents=[
      '@echo off',
      'setlocal EnableExtensions DisableDelayedExpansion',
      'call "'+dev+'" -arch=x64 -host_arch=x64 >nul',
      'if errorlevel 1 exit /b 51',
      'cl.exe /nologo /W4 /WX /TC /c /D_WIN32_WINNT=0x0A00 '+
        '/Fo:"'+object+'" "'+reader+'"',
      'if errorlevel 1 exit /b 52',
      'exit /b 0',
    ].join('\r\n')+'\r\n';
    fs.writeFileSync(batch,contents,{flag:'wx'});
    const c=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c',batch],{
      encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:100000});
    assert.equal(c.error,undefined,c.error?.message);
    assert.equal(c.status,0,'isolated native object compile failed: '+
      String(c.stdout).slice(-1700)+' '+String(c.stderr).slice(-1700));
    assert.equal(fs.statSync(object).isFile(),true);
    assert.ok(fs.statSync(object).size>100);
    // Compile only. This intentionally does not execute or trust any WinPE C operator.
  }finally{
    assert.ok(path.basename(output).startsWith('zgmini-996-native-reader-build-'));
    fs.rmSync(output,{recursive:true,force:true});
  }
});


test('actual compiled x64 FileIdInfo reader preserves original native ID across safe isolated TEMP rename',{
  skip: !hostAllowed && 'Only existing isolated Windows Runner may run this TEMP-only harness',
},(t)=>{
  const pf86=process.env['ProgramFiles(x86)'];
  if(!pf86)return t.skip('MSVC not installed');
  const vswhere=path.join(pf86,'Microsoft Visual Studio','Installer','vswhere.exe');
  if(!fs.existsSync(vswhere))return t.skip('vswhere not installed');
  const vs=spawnSync(vswhere,['-latest','-products','*',
    '-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property','installationPath'],{
      encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:8000});
  if(vs.status!==0||vs.error)return t.skip('MSVC discovery unavailable');
  const rootVs=String(vs.stdout).trim().split(/\r?\n/)[0]||'';
  const dev=path.join(rootVs,'Common7','Tools','VsDevCmd.bat');
  if(!rootVs||!fs.existsSync(dev))return t.skip('native x64 toolchain unavailable');
  // GetTempPathW chooses TMP before TEMP; Node os.tmpdir() can choose a
  // different spelling/variable. Bind this test to the Win32 selection order.
  const temp=process.env.TMP||process.env.TEMP;
  assert.ok(temp,'Windows TMP/TEMP required for isolated native test');
  assert.equal(path.win32.parse(temp).root.toLowerCase(),'c:\\');
  assert.equal(path.win32.parse(fs.realpathSync.native(temp)).root.toLowerCase(),'c:\\');
  const build=fs.mkdtempSync(path.join(temp,'zgmini-996-native-reader-build-'));
  const root=fs.mkdtempSync(path.join(temp,'zgmini-996-native-reader-fixture-'));
  const source=path.join(root,'source');
  const archive=path.join(root,'archive');
  try{
    fs.mkdirSync(source);
    const exe=path.join(build,'read-id-temp.exe');
    const nativeSource=fileURLToPath(new URL(
      './c996_winpe_native_volume_id_temp_harness.c',import.meta.url));
    for(const input of [dev,nativeSource,exe])
      assert.doesNotMatch(input,/[\r\n"&|<>]/);
    const batch=path.join(build,'build-temp-reader.cmd');
    fs.writeFileSync(batch,[
      '@echo off','setlocal EnableExtensions DisableDelayedExpansion',
      'call "'+dev+'" -arch=x64 -host_arch=x64 >nul',
      'if errorlevel 1 exit /b 51',
      'cl.exe /nologo /W4 /WX /TC /O2 /MT /GS '+
        '/DC996_NATIVE_VOLUME_ID_TEMP_HARNESS_ONLY=1 '+
        '/D_WIN32_WINNT=0x0A00 /Fe:"'+exe+'" "'+nativeSource+'" '+
        '/link /MACHINE:X64 /SUBSYSTEM:CONSOLE /DYNAMICBASE /NXCOMPAT /INCREMENTAL:NO',
      'if errorlevel 1 exit /b 52','exit /b 0',
    ].join('\r\n')+'\r\n',{flag:'wx'});
    const compiler=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c',batch],{
      encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:100000});
    assert.equal(compiler.error,undefined,compiler.error?.message);
    assert.equal(compiler.status,0,'native TEMP build error: '+
      String(compiler.stdout).slice(-1800)+' '+String(compiler.stderr).slice(-1200));
    assert.ok(fs.statSync(exe).isFile());
    const observe=where=>{
      const proc=spawnSync(exe,[where],{
        encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:16000});
      assert.equal(proc.error,undefined,proc.error?.message);
      assert.equal(proc.status,0,String(proc.stderr)+' '+String(proc.stdout));
      const match=String(proc.stdout).trim().match(
        /^C996_NATIVE_ID_TEMP_PASS:([0-9a-f]{16}):([0-9a-f]{32})$/);
      assert.ok(match,'unknown native receipt');
      return {serial:match[1],id:match[2]};
    };
    const before=observe(source);
    fs.renameSync(source,archive);
    const after=observe(archive);
    assert.deepEqual(after,before);
    fs.mkdirSync(source);
    const replaced=observe(source);
    assert.equal(replaced.serial,before.serial);
    assert.notEqual(replaced.id,before.id);
    assert.deepEqual(fs.readdirSync(root).sort(),['archive','source']);
    const synthetic=spawnSync(exe,[source,'--emit-untrusted-synthetic-8'],{
      encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:16000});
    assert.equal(synthetic.error,undefined,synthetic.error?.message);
    assert.equal(synthetic.status,0,String(synthetic.stdout)+' '+String(synthetic.stderr));
    const marker='C996_NATIVE_SYNTHETIC_SOURCE_RECEIPT:';
    const receiptLine=String(synthetic.stdout).trim().split(/\r?\n/)
      .find(line=>line.startsWith(marker));
    assert.ok(receiptLine,'C formatter must emit bounded synthetic JSON');
    const receipt=Buffer.from(receiptLine.slice(marker.length),'utf8');
    const untrusted=review996UntrustedNativeIdReceipt({rawReceipt:receipt});
    assert.equal(untrusted.status,'SOURCE_ONLY_UNTRUSTED_RECEIPT_SHAPE_VALID');
    assert.equal(untrusted.nativeDirectoryCount,8);
    assert.equal(untrusted.executionAuthorized,false);
    assert.equal(untrusted.offlineBootVerified,false);
    const decoded=JSON.parse(receipt.toString('utf8'));
    assert.equal(decoded.source,'WIN32_NATIVE_SOURCE_ONLY_UNTRUSTED');
    assert.equal(decoded.ownerSignatureVerified,false);
    assert.equal(decoded.winpeBootAuthenticated,false);
    // This is an isolated Windows TEMP C execution, never a WinPE boot.
  }finally{
    assert.ok(path.basename(root).startsWith('zgmini-996-native-reader-fixture-'));
    assert.ok(path.basename(build).startsWith('zgmini-996-native-reader-build-'));
    fs.rmSync(root,{recursive:true,force:true});
    fs.rmSync(build,{recursive:true,force:true});
  }
});


// Deliberately SYNTHETIC native IDs and GUID. Metadata mirrors the fixed
// historical A receipt format, but no operational E: directory IDs are copied.
// Exact runtime evidence remains in the main-branch Run #43124923743.
const PINNED_ONLINE_ID={
  schema:'ZGMINI_PC_VOLUME_IDENTITY_PROBE_V1',
  status:'PASS',code:'VOLUME_IDS_READONLY_OBSERVED',
  issueNumber:1265,runId:'43124923743',
  requestId:'e741024c-47c5-40ca-b9d1-fbb250e79e42',
  attempt:'1',role:'operating',host:'pc',runnerName:'zgmini-pc-05',
  source:'WIN32_GET_VOLUME_NAME_AND_FILE_ID_INFO',
  volumeGuid:'\\\\?\\Volume{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa}\\',
  volumeSerial:'1111111111111111',
  directories:Object.fromEntries([
    'VOLUME_ROOT','ZGMINI','AUTOMATION','MAINTENANCE','LEASES',
    'OLD_C','INSTALL',
  ].map((k,i)=>[k,{state:'PRESENT',
    fileId128:(i+1).toString(16).padStart(32,'0')}])),
  offlineVolumeVerified:false,ownerApprovalVerified:false,
  cExecutionAuthorized:false,operationalWrites:0,automaticRetries:0,
};
const FAKE_CONTINUATION='70a4c347-25ea-4fc6-83d2-c0c670115249';
const FAKE_ID='9'.repeat(32);
const fakeSignedNativeSourceManifest=()=>({
  schema:'ZGMINI_CONTROLLER_996_SIGNED_OFFLINE_HANDOFF_V1',
  algorithm:'RSA_PSS_SHA256_SALT32',
  scope:'ARCHIVE_OLD_C_THEN_CONTINUATION_THEN_INSTALL_NO_REPLACE',
  originalRequestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
  continuationId:FAKE_CONTINUATION,winpeBootCount:1,
  existingPcName:'기존 ZGMINI PC',queuePcName:'공통 대기열 PC',
  ownerKeySpkiSha256:'a'.repeat(64),
  ownerNonce:'11111111-1111-4111-8111-111111111111',
  bootEpoch:'22222222-2222-4222-8222-222222222222',
  machineBindingSha256:'b'.repeat(64),
  volumeGuid:PINNED_ONLINE_ID.volumeGuid,
  volumeSerial:PINNED_ONLINE_ID.volumeSerial,
  sourceSha256:'c'.repeat(64),bootImageSha256:'d'.repeat(64),
  nativeMoverSha256:'e'.repeat(64),workflowSha256:'f'.repeat(64),
  protectedStateSha256:'1'.repeat(64),runnerAdmissionSha256:'2'.repeat(64),
  originalJobsSha256:'3'.repeat(64),
  issuedAt:'2026-11-12T00:00:00Z',expiresAt:'2026-11-12T00:20:00Z',
  moves:plan996SingleBootRecovery(FAKE_CONTINUATION).phases[1].moves.map((m,i)=>({
    name:m.name,source:m.source,destination:m.destination,
    sourceFileId:i===0?PINNED_ONLINE_ID.directories.OLD_C.fileId128:
      i===2?PINNED_ONLINE_ID.directories.INSTALL.fileId128:FAKE_ID,
    sourceVolumeSerial:PINNED_ONLINE_ID.volumeSerial,
  })),
});
const nativeUntrustedFixture=()=>({
  schema:'ZGMINI_CONTROLLER_996_NATIVE_IDS_UNTRUSTED_V1',
  source:'WIN32_NATIVE_SOURCE_ONLY_UNTRUSTED',
  untrustedVolumeGuid:PINNED_ONLINE_ID.volumeGuid,
  volumeSerial:PINNED_ONLINE_ID.volumeSerial,
  directories:Object.fromEntries([
    ...Object.entries(PINNED_ONLINE_ID.directories).map(([k,v])=>
      [k,{fileId128:v.fileId128,volumeSerial:PINNED_ONLINE_ID.volumeSerial,
        isReparse:false}]),
    ['CONTINUATION',{fileId128:FAKE_ID,volumeSerial:PINNED_ONLINE_ID.volumeSerial,
      isReparse:false}],
  ]),
  idsCollected:8,readOnly:true,winpeBootAuthenticated:false,
  ownerSignatureVerified:false,offlineClockTrusted:false,
  volumeGuidAuthenticated:false,cExecutionAuthorized:false,
  operationalWrites:0,
});
const reviewUntrustedFixture=(fixture=nativeUntrustedFixture(),
  manifest=fakeSignedNativeSourceManifest())=>
    review996UntrustedNativeIdReceipt({
      rawReceipt:Buffer.from(JSON.stringify(fixture)),
      onlineObservation:PINNED_ONLINE_ID,signedManifest:manifest,
    });
test('native source-only JSON must be untrusted despite correct eight-directory structure',()=>{
  const result=reviewUntrustedFixture();
  assert.equal(result.status,'SOURCE_ONLY_UNTRUSTED_EIGHT_IDS_MATCH_PINNED_INPUTS');
  assert.equal(result.matchedFixedCount,7);
  assert.equal(result.matchedSignedMoveCount,3);
  for(const field of ['nativeReceiptAuthenticated','offlineBootVerified',
    'ownerTrustAnchorVerified','ownerApprovalVerified','offlineClockTrusted',
    'executionAuthorized']) assert.equal(result[field],false);
  assert.equal(result.operationalWrites,0);
});
test('native JSON bridge refuses altered directory, fake boot approval, duplicate or bad raw bytes',()=>{
  const changes=[
    x=>{x.directories.ZGMINI.fileId128='0'.repeat(32);},
    x=>{x.directories.CONTINUATION.fileId128='e'.repeat(32);},
    x=>{x.directories.AUTOMATION.isReparse=true;},
    x=>{x.directories.CONTINUATION.fileId128=x.directories.INSTALL.fileId128;},
    x=>{delete x.directories.LEASES;},
    x=>{x.directories.UNEXPECTED={...x.directories.ZGMINI};},
    x=>{x.volumeSerial='0'.repeat(16);},
    x=>{x.untrustedVolumeGuid='C:\\';},
    x=>{x.winpeBootAuthenticated=true;},
    x=>{x.ownerSignatureVerified=true;},
    x=>{x.cExecutionAuthorized=true;},
    x=>{x.operationalWrites=1;},
    x=>{x.extraField='anything';},
  ];
  for(const modify of changes){
    const a=nativeUntrustedFixture();modify(a);
    const result=reviewUntrustedFixture(a);
    assert.equal(result.status,'SOURCE_ONLY_BLOCKED');
    assert.equal(result.executionAuthorized,false);
  }
  const raw=Buffer.from(JSON.stringify(nativeUntrustedFixture()));
  const forged=Buffer.from(raw.toString('utf8').replace(
    '"readOnly":true','"readOnly":true,"readOnly":true'));
  assert.equal(review996UntrustedNativeIdReceipt({rawReceipt:forged}).status,
    'SOURCE_ONLY_BLOCKED');
  assert.equal(review996UntrustedNativeIdReceipt({rawReceipt:Buffer.from([255])}).status,
    'SOURCE_ONLY_BLOCKED');
  assert.equal(review996UntrustedNativeIdReceipt({}).executionAuthorized,false);
});


test('preopened source and nested directory handles can create children after TEMP rename', {
  skip: !hostAllowed && 'Only isolated Windows handoff Runner C: TEMP; never original PC',
}, async () => {
  // A real competing OS process retains TWO native handles across an actual
  // directory rename. No C recovery operator, admin ACL or E: is touched.
  const temp=fs.realpathSync.native(os.tmpdir());
  assert.equal(path.win32.parse(temp).root.toLowerCase(),'c:\\');
  const root=fs.mkdtempSync(path.join(temp,'zgmini-996-preopen-nt-race-'));
  const source=path.join(root,'source');
  const nested=path.join(source,'nested');
  const archive=path.join(root,'archive');
  const goFile=path.join(root,'go.token');
  const ps=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
  const script=String.raw`$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
public static class C996PreopenedNamespaceProbe {
 [StructLayout(LayoutKind.Sequential)]
 struct UNICODE_STRING {
  public ushort Length,MaximumLength;
  public IntPtr Buffer;
 }
 [StructLayout(LayoutKind.Sequential)]
 struct OBJECT_ATTRIBUTES {
  public uint Length;
  public IntPtr RootDirectory,ObjectName;
  public uint Attributes;
  public IntPtr SecurityDescriptor,SecurityQualityOfService;
 }
 [StructLayout(LayoutKind.Sequential)]
 struct IO_STATUS_BLOCK {
  public IntPtr Status,Information;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 static extern IntPtr CreateFileW(string name,uint access,uint share,
  IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]
 static extern bool CloseHandle(IntPtr handle);
 [DllImport("ntdll.dll")]
 static extern uint NtCreateFile(out IntPtr handle,uint desiredAccess,
  ref OBJECT_ATTRIBUTES attributes,out IO_STATUS_BLOCK ios,
  IntPtr allocationSize,uint fileAttributes,uint shareAccess,
  uint createDisposition,uint createOptions,IntPtr eaBuffer,uint eaLength);
 static void Need(bool ok,string error) {
  if(!ok)throw new InvalidOperationException(error);
 }
 static string CreateRelative(IntPtr directory,string name) {
  var u=new UNICODE_STRING();
  u.Buffer=Marshal.StringToHGlobalUni(name);
  u.Length=(ushort)(name.Length*2);
  u.MaximumLength=(ushort)(u.Length+2);
  IntPtr up=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UNICODE_STRING)));
  try {
   Marshal.StructureToPtr(u,up,false);
   var a=new OBJECT_ATTRIBUTES();
   a.Length=(uint)Marshal.SizeOf(typeof(OBJECT_ATTRIBUTES));
   a.RootDirectory=directory;
   a.ObjectName=up;
   a.Attributes=0x40;
   IO_STATUS_BLOCK io;IntPtr h;
   uint status=NtCreateFile(out h,0x40100000,ref a,out io,IntPtr.Zero,
    0x80,7,2,0x60,IntPtr.Zero,0);
   if(status==0)CloseHandle(h);
   return status.ToString("X8");
  } finally {
   Marshal.FreeHGlobal(up);
   Marshal.FreeHGlobal(u.Buffer);
  }
 }
 public static void Run(string source,string nested,string goFile) {
  // FILE_ADD_FILE|FILE_READ_ATTRIBUTES, full share including DELETE
  IntPtr s=CreateFileW(source,0x82,7,IntPtr.Zero,3,0x02000000,IntPtr.Zero);
  Need(s!=new IntPtr(-1),"SOURCE_HANDLE_OPEN_"+Marshal.GetLastWin32Error());
  try {
   IntPtr c=CreateFileW(nested,0x82,7,IntPtr.Zero,3,0x02000000,IntPtr.Zero);
   Need(c!=new IntPtr(-1),"CHILD_HANDLE_OPEN_"+Marshal.GetLastWin32Error());
   try {
    Console.WriteLine("C996_PREOPENED_READY");
    Console.Out.Flush();
    for(int i=0;i<400&&!File.Exists(goFile);i++)Thread.Sleep(25);
    Need(File.Exists(goFile),"RENAME_SIGNAL_MISSING");
    Console.WriteLine("C996_PREOPENED_PARENT_NT="+CreateRelative(s,"parent-late.txt"));
    Console.WriteLine("C996_PREOPENED_CHILD_NT="+CreateRelative(c,"nested-late.txt"));
   } finally {CloseHandle(c);}
  } finally {CloseHandle(s);}
 }
}
'@
$i=ConvertFrom-Json ([Text.Encoding]::UTF8.GetString(
 [Convert]::FromBase64String($env:C996_PREOPENED_INPUT)))
[C996PreopenedNamespaceProbe]::Run($i.source,$i.nested,$i.goFile)
`;
  let child=null,timer=null;
  try{
    assert.equal(fs.existsSync('E:/ZGmini'),false);
    fs.mkdirSync(source);fs.mkdirSync(nested);
    assert.equal(fs.existsSync(ps),true);
    const input=Buffer.from(JSON.stringify({source,nested,goFile}),'utf8').toString('base64');
    child=spawn(ps,['-NoProfile','-NonInteractive','-Command',script],{
      windowsHide:true,
      env:{...process.env,C996_PREOPENED_INPUT:input},
      stdio:['ignore','pipe','pipe'],
    });
    let stdout='',stderr='',ready=false;
    const done=new Promise((resolve,reject)=>{
      child.on('error',reject);
      child.stdout.on('data',d=>{stdout+=d.toString('utf8');});
      child.stderr.on('data',d=>{stderr+=d.toString('utf8');});
      child.on('close',(code)=>resolve(code));
    });
    const waitReady=new Promise((resolve,reject)=>{
      child.stdout.on('data',()=>{if(!ready&&stdout.includes('C996_PREOPENED_READY')){
        ready=true;resolve();
      }});
      child.on('error',reject);
      child.on('close',code=>{
        if(!ready)reject(Error('PREOPENED_HANDLE_NOT_READY rc='+code+
          ' out='+stdout.slice(-500)+' err='+stderr.slice(-1200)));
      });
    });
    timer=setTimeout(()=>child.kill(),25000);
    await waitReady;
    // The other process holds both handles; move is orchestrated by Node.
    fs.renameSync(source,archive);
    fs.writeFileSync(goFile,'1',{flag:'wx'});
    const code=await done;
    assert.equal(code,0,'native child exit '+code+' '+stderr.slice(-1200));
    assert.match(stdout,/C996_PREOPENED_PARENT_NT=00000000/);
    assert.match(stdout,/C996_PREOPENED_CHILD_NT=00000000/);
    assert.equal(fs.existsSync(source),false);
    assert.equal(fs.readFileSync(path.join(archive,'parent-late.txt')).length,0);
    assert.equal(fs.readFileSync(path.join(archive,'nested','nested-late.txt')).length,0);
    // Even a successful isolated race grants ZERO C execution authority.
  }finally{
    if(timer)clearTimeout(timer);
    if(child&&!child.killed)child.kill();
    assert.ok(path.basename(root).startsWith('zgmini-996-preopen-nt-race-'));
    fs.rmSync(root,{recursive:true,force:true});
  }
});
