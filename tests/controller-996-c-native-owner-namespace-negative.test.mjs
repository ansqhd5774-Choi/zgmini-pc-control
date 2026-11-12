// Exact native candidate negative proof: only the separate queue-PC TEMP tree.
// It intentionally creates a competing JSON in a synthetic fixture and MUST
// stop before SetFileInformationByHandle. Never call the production C operator.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build996OwnerArchiveFixtureScript} from '../tools/controller-996-c-native-owner-operator.mjs';

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
  const temp=fs.realpathSync.native(os.tmpdir());
  assert.equal(path.win32.parse(temp).root.toLowerCase(),'c:\\');
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
    // This is an isolated Windows TEMP C execution, never a WinPE boot.
  }finally{
    assert.ok(path.basename(root).startsWith('zgmini-996-native-reader-fixture-'));
    assert.ok(path.basename(build).startsWith('zgmini-996-native-reader-build-'));
    fs.rmSync(root,{recursive:true,force:true});
    fs.rmSync(build,{recursive:true,force:true});
  }
});
