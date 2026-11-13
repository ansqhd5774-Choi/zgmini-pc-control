// #996 Native NtSetInformationFile TEMP diagnostic on the existing
// isolated Windows runner. No E:, production C operator, WinPE or remote VM.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const hostAllowed=process.platform==='win32' &&
 process.arch==='x64' &&
 process.env.GITHUB_ACTIONS==='true' &&
 process.env.COMPUTERNAME==='DESKTOP-N62L0NG' &&
 process.env.RUNNER_NAME==='zgmini-handoff-ci-spare-01' &&
 !fs.existsSync('E:/ZGmini');
const script="$ErrorActionPreference='Stop'\nAdd-Type -TypeDefinition @'\nusing System;\nusing System.Text;\nusing System.Runtime.InteropServices;\nusing Microsoft.Win32.SafeHandles;\npublic static class C996NtRelativeTempProbe {\n  [StructLayout(LayoutKind.Sequential)]\n  public struct IO_STATUS_BLOCK {\n    public IntPtr Status;\n    public IntPtr Information;\n  }\n  [DllImport(\"kernel32.dll\", CharSet=CharSet.Unicode, SetLastError=true)]\n  private static extern SafeFileHandle CreateFileW(\n    string filename, uint access, uint share, IntPtr security,\n    uint disposition, uint flags, IntPtr template);\n  [DllImport(\"ntdll.dll\", ExactSpelling=true)]\n  private static extern int NtSetInformationFile(\n    SafeFileHandle file, out IO_STATUS_BLOCK statusBlock,\n    IntPtr renameInfo, uint length, uint infoClass);\n  public static string Attempt(string root, string source, string targetLeaf) {\n    const uint OPEN_EXISTING=3u;\n    const uint BACKUP_AND_NO_REPARSE=0x02200000u;\n    const uint SHARE_READ_WRITE=3u;\n    const uint READ_ATTRS_TRAVERSE_ADD_CHILD=0x000000a4u;\n    const uint DELETE_AND_READ_ATTRS=0x00010080u;\n    using(var parent=CreateFileW(root,READ_ATTRS_TRAVERSE_ADD_CHILD,\n       SHARE_READ_WRITE,IntPtr.Zero,OPEN_EXISTING,BACKUP_AND_NO_REPARSE,\n       IntPtr.Zero))\n    using(var from=CreateFileW(source,DELETE_AND_READ_ATTRS,\n       SHARE_READ_WRITE,IntPtr.Zero,OPEN_EXISTING,BACKUP_AND_NO_REPARSE,\n       IntPtr.Zero)) {\n      if(parent.IsInvalid || from.IsInvalid) return \"OPEN_REJECTED\";\n      if(targetLeaf != \"archive\" && targetLeaf != \"archive2\")\n        return \"NAME_REJECTED\";\n      byte[] name=Encoding.Unicode.GetBytes(targetLeaf);\n      int total=24+name.Length+2;\n      IntPtr bytes=Marshal.AllocHGlobal(total);\n      try {\n        for(int i=0;i<total;i++) Marshal.WriteByte(bytes,i,0);\n        Marshal.WriteByte(bytes,0,0); // ReplaceIfExists FALSE.\n        Marshal.WriteIntPtr(bytes,8,parent.DangerousGetHandle());\n        Marshal.WriteInt32(bytes,16,name.Length);\n        Marshal.Copy(name,0,IntPtr.Add(bytes,20),name.Length);\n        IO_STATUS_BLOCK io;\n        int ntstatus=NtSetInformationFile(from,out io,bytes,\n            (uint)total,10u); // Native FileRenameInformation, not Win32 3.\n        return ntstatus==0 && io.Status==IntPtr.Zero\n          ? \"NT_SUCCESS\" : \"NT_STATUS_\"+ntstatus.ToString(\"X8\");\n      } finally {\n        Marshal.FreeHGlobal(bytes);\n      }\n    }\n  }\n}\n'@ -ErrorAction Stop\n$inputObject=ConvertFrom-Json ([Console]::In.ReadToEnd())\n[Console]::WriteLine('C996_NT_POSITIVE='+[C996NtRelativeTempProbe]::Attempt(\n  $inputObject.root,$inputObject.source,'archive'))\n[Console]::WriteLine('C996_NT_COLLISION='+[C996NtRelativeTempProbe]::Attempt(\n  $inputObject.root,$inputObject.source2,'archive2'))\n";

test('native NT root-relative rename succeeds only inside a controlled TEMP fixture and rejects collision', {
 skip:!hostAllowed && 'Existing isolated Windows Runner only, never the original PC'
},()=>{
 const temp=fs.realpathSync.native(os.tmpdir());
 assert.equal(path.win32.parse(temp).root.toLowerCase(),'c:'+path.win32.sep);
 const root=fs.mkdtempSync(path.join(temp,'zgmini-996-nt-relative-'));
 const source=path.join(root,'source'),source2=path.join(root,'source2');
 const archive=path.join(root,'archive'),archive2=path.join(root,'archive2');
 const payload=Buffer.from('{"isolated":true}\n');
 const second=Buffer.from('{"collision":"source"}\n');
 const existing=Buffer.from('{"collision":"destination"}\n');
 try {
  fs.mkdirSync(source);fs.mkdirSync(source2);fs.mkdirSync(archive2);
  fs.writeFileSync(path.join(source,'proof.json'),payload,{flag:'wx'});
  fs.writeFileSync(path.join(source2,'proof.json'),second,{flag:'wx'});
  fs.writeFileSync(path.join(archive2,'proof.json'),existing,{flag:'wx'});
  const shell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
  assert.equal(fs.existsSync(shell),true);
  const result=spawnSync(shell,['-NoProfile','-NonInteractive','-Command',script],{
   input:JSON.stringify({root,source,source2}),encoding:'utf8',
   windowsHide:true,timeout:30000,maxBuffer:30000,
  });
  assert.equal(result.error,undefined,String(result.error));
  assert.equal(result.status,0,String(result.stderr).slice(-1800));
  const rows=result.stdout.trim().split(/\r?\n/);
  const positive=rows.find(line=>line.startsWith('C996_NT_POSITIVE='));
  const collision=rows.find(line=>line.startsWith('C996_NT_COLLISION='));
  console.log(positive??'C996_NT_POSITIVE_MISSING');
  console.log(collision??'C996_NT_COLLISION_MISSING');
  assert.equal(positive,'C996_NT_POSITIVE=NT_SUCCESS');
  assert.match(collision??'',/^C996_NT_COLLISION=NT_STATUS_[0-9A-F]{8}$/);
  assert.equal(fs.existsSync(source),false);
  assert.deepEqual(fs.readFileSync(path.join(archive,'proof.json')),payload);
  assert.deepEqual(fs.readFileSync(path.join(source2,'proof.json')),second);
  assert.deepEqual(fs.readFileSync(path.join(archive2,'proof.json')),existing);
  console.log('C996_NT_TEMP_ROOT_RELATIVE_NO_REPLACE_PASS');
 } finally {
  assert.ok(path.basename(root).startsWith('zgmini-996-nt-relative-'));
  assert.equal(path.dirname(root).toLowerCase(),temp.toLowerCase());
  fs.rmSync(root,{recursive:true,force:true});
 }
});
