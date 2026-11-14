// TEMP-only TxF feasibility proof. No operational C adapter or authorization.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const native=String.raw`
using System;using System.Runtime.InteropServices;
public static class C996TempTx {
 [DllImport("KtmW32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateTransaction(IntPtr a,IntPtr b,uint c,uint d,uint e,uint f,string g);
 [DllImport("KtmW32.dll",SetLastError=true)]static extern bool CommitTransaction(IntPtr t);
 [DllImport("KtmW32.dll",SetLastError=true)]static extern bool RollbackTransaction(IntPtr t);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool CloseHandle(IntPtr t);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateFileW(string p,uint a,uint s,IntPtr security,uint d,uint f,IntPtr template);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool MoveFileTransactedW(string a,string b,IntPtr c,IntPtr d,uint flags,IntPtr tx);
 [StructLayout(LayoutKind.Sequential)]struct US {public ushort Length,MaximumLength;public IntPtr Buffer;}
 [StructLayout(LayoutKind.Sequential)]struct OA {public uint Length;public IntPtr RootDirectory,ObjectName;public uint Attributes;public IntPtr SecurityDescriptor,SecurityQualityOfService;}
 [StructLayout(LayoutKind.Sequential)]struct IOS {public IntPtr Status;public UIntPtr Information;}
 [DllImport("ntdll.dll")]static extern uint NtCreateFile(out IntPtr h,uint access,ref OA a,out IOS io,IntPtr size,uint attributes,uint share,uint disposition,uint options,IntPtr ea,uint eaLength);
 static string InsertRelative(IntPtr directory,string name){
  var u=new US();u.Buffer=Marshal.StringToHGlobalUni(name);u.Length=(ushort)(name.Length*2);u.MaximumLength=(ushort)(u.Length+2);
  IntPtr up=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(US)));
  try{Marshal.StructureToPtr(u,up,false);var a=new OA();a.Length=(uint)Marshal.SizeOf(typeof(OA));a.RootDirectory=directory;a.ObjectName=up;a.Attributes=0x40;IOS io;IntPtr h;
   uint status=NtCreateFile(out h,0x40100000,ref a,out io,IntPtr.Zero,0x80,7,2,0x60,IntPtr.Zero,0);
   if(status==0)CloseHandle(h);return status.ToString("X8");
  }finally{Marshal.FreeHGlobal(up);Marshal.FreeHGlobal(u.Buffer);}
 }
 public static void PreopenedChild(string root){
  IntPtr control=CreateFileW(System.IO.Path.Combine(root,"control"),0x82,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
  if(control==new IntPtr(-1))throw new Exception("CONTROL_OPEN_FAILED");
  string positive;try{positive=InsertRelative(control,"positive.json");}finally{CloseHandle(control);}
  if(positive!="00000000")throw new Exception("CONTROL_INSERT_FAILED_"+positive);
  IntPtr source=CreateFileW(System.IO.Path.Combine(root,"install"),0x82,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
  if(source==new IntPtr(-1))throw new Exception("PREOPEN_FAILED");
  try{System.IO.File.WriteAllText(System.IO.Path.Combine(root,"CHILD_READY"),positive);
   for(int i=0;i<500&&!System.IO.File.Exists(System.IO.Path.Combine(root,"GO"));i++)System.Threading.Thread.Sleep(10);
   if(!System.IO.File.Exists(System.IO.Path.Combine(root,"GO")))throw new Exception("GO_MISSING");
   System.IO.File.WriteAllText(System.IO.Path.Combine(root,"CHILD_DONE"),InsertRelative(source,"late.json"));
  }finally{CloseHandle(source);}
 }
 static IntPtr tx;
 public static string Begin(){tx=CreateTransaction(IntPtr.Zero,IntPtr.Zero,0,0,0,15000,"ZGMINI TEMP ONLY");return tx==IntPtr.Zero||tx==new IntPtr(-1)?"CREATE_FAILED_"+Marshal.GetLastWin32Error():"CREATED";}
 public static string Move(string from,string to){return MoveFileTransactedW(from,to,IntPtr.Zero,IntPtr.Zero,0,tx)?"STAGED":"MOVE_FAILED_"+Marshal.GetLastWin32Error();}
 public static string End(bool commit){bool ok=commit?CommitTransaction(tx):RollbackTransaction(tx);int error=Marshal.GetLastWin32Error();CloseHandle(tx);return ok?(commit?"COMMITTED":"ROLLED_BACK"):"END_FAILED_"+error;}
}`;
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const names=['old-claim','continuation','install'];
const identities=new Map();
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-txf-fixture-'));
 assert.equal(path.parse(root).root.toLowerCase(),'c:\\');
 for(const n of names){fs.mkdirSync(path.join(root,n));fs.writeFileSync(path.join(root,n,'owner.json'),JSON.stringify({fixture:n}));}
 identities.set(root,Object.fromEntries(names.map(n=>[n,{dir:fs.statSync(path.join(root,n),{bigint:true}).ino,
  file:fs.statSync(path.join(root,n,'owner.json'),{bigint:true}).ino}])));
 return root;
}
function script(root,mode){
 assert.ok(['commit','rollback','insert','collision','interrupted','preopened'].includes(mode));
 assert.equal(path.dirname(root).toLowerCase(),os.tmpdir().replace(/[\\/]$/,'').toLowerCase());
 assert.match(path.basename(root),/^zgmini-996-txf-fixture-[a-z0-9]+$/i);
 return `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
Add-Type -TypeDefinition @'
${native}
'@
$root=${quote(root)};$mode=${quote(mode)}
if(!$root.StartsWith([IO.Path]::GetTempPath(),[StringComparison]::OrdinalIgnoreCase)){throw 'TEMP_ONLY'}
$begun=[C996TempTx]::Begin();if($begun -ne 'CREATED'){throw $begun}
$finish=$null
try{
 $moves=@()
 foreach($n in @('old-claim','continuation','install')){
  $r=[C996TempTx]::Move((Join-Path $root $n),(Join-Path $root ($n+'-archive')))
  $moves+=$r
  if($r -ne 'STAGED'){break}
 }
 $hidden=([IO.Directory]::Exists((Join-Path $root 'install')) -and ![IO.Directory]::Exists((Join-Path $root 'install-archive')))
 $insert=$null
 if($mode -eq 'insert'){
  $info=New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName=${quote(process.execPath)}
  $info.Arguments='"'+(Join-Path $root 'competitor.mjs')+'" "'+(Join-Path $root 'install\\competing.json')+'"'
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true
  $info.RedirectStandardError=$true
  $child=New-Object System.Diagnostics.Process;$child.StartInfo=$info
  [void]$child.Start()
  if(!$child.WaitForExit(3000)){$child.Kill();[void]$child.WaitForExit(2000);throw 'COMPETITOR_TIMEOUT'}
  $insert=$child.StandardOutput.ReadToEnd().Trim()
 }
 if($mode -eq 'interrupted'){
  [IO.File]::WriteAllText((Join-Path $root 'READY'),'STAGED')
  Start-Sleep -Seconds 12
  throw 'PARENT_DID_NOT_INTERRUPT'
 }
 if($mode -eq 'preopened'){
  [IO.File]::WriteAllText((Join-Path $root 'GO'),'GO')
  for($i=0;$i -lt 500 -and ![IO.File]::Exists((Join-Path $root 'CHILD_DONE'));$i++){Start-Sleep -Milliseconds 10}
  if(![IO.File]::Exists((Join-Path $root 'CHILD_DONE'))){throw 'CHILD_PROBE_TIMEOUT'}
  $insert=[IO.File]::ReadAllText((Join-Path $root 'CHILD_DONE'))
 }
 $finish=[C996TempTx]::End($mode -eq 'commit' -and $moves.Count -eq 3 -and @($moves|Where-Object {$_ -ne 'STAGED'}).Count -eq 0)
 [pscustomobject]@{moves=$moves;outsideOriginalVisible=$hidden;competitor=$insert;finish=$finish;operationalWrites=0;executionAuthorized=$false}|ConvertTo-Json -Compress
}finally{if($null -eq $finish){[void][C996TempTx]::End($false)}}`;
}
function args(code){return ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')];}
function check(root,moved,collision=false){
 for(const n of names){
  assert.equal(fs.existsSync(path.join(root,n)),!moved);
  assert.equal(fs.existsSync(path.join(root,n+'-archive')),moved||(collision&&n==='old-claim'));
  assert.deepEqual(fs.readFileSync(path.join(root,n+(moved?'-archive':''),'owner.json')),Buffer.from(JSON.stringify({fixture:n})));
  assert.equal(fs.statSync(path.join(root,n+(moved?'-archive':'')),{bigint:true}).ino,identities.get(root)[n].dir);
  assert.equal(fs.statSync(path.join(root,n+(moved?'-archive':''),'owner.json'),{bigint:true}).ino,identities.get(root)[n].file);
 }
}
function clean(root){assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));assert.match(path.basename(root),/^zgmini-996-txf-fixture-/);fs.rmSync(root,{recursive:true});identities.delete(root);}
function acl(root,moved=false){
 const code=`$ErrorActionPreference='Stop';$list=@();foreach($name in @('old-claim','continuation','install')){foreach($leaf in @('','owner.json')){$p=Join-Path (Join-Path ${quote(root)} ($name+${moved?"'-archive'":"''"})) $leaf;$info=if([IO.Directory]::Exists($p)){[IO.DirectoryInfo]::new($p)}else{[IO.FileInfo]::new($p)};$list+=$info.GetAccessControl().GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)}};$h=[Security.Cryptography.SHA256]::Create();try{[BitConverter]::ToString($h.ComputeHash([Text.Encoding]::UTF8.GetBytes(($list -join '|')))).Replace('-','')}finally{$h.Dispose()}`;
 const run=spawnSync(ps,args(code),{windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:2000});
 assert.equal(run.status,0,run.stderr);assert.match(run.stdout.trim(),/^[A-F0-9]{64}$/);return run.stdout.trim();
}
for(const mode of ['commit','rollback','insert','collision'])test('Windows TEMP transaction '+mode,{
 skip:process.platform!=='win32',
},()=>{
 const root=fixture();
 try{
  const beforeAcl=acl(root);
  if(mode==='insert'){
   const competitor=path.join(root,'competitor.mjs');
   fs.writeFileSync(competitor,
    'import fs from "node:fs";try{fs.writeFileSync(process.argv[2],"{}",{flag:"wx"});console.log("INSERT_SUCCEEDED");}catch(e){console.log("INSERT_BLOCKED");}\n');
   // The exact same child must first be able to insert outside a transaction.
   // A broken command, missing permission or invalid path is not isolation.
   const control=spawnSync(process.execPath,[competitor,path.join(root,'control.json')],
    {windowsHide:true,encoding:'utf8',timeout:3000});
   assert.equal(control.status,0);assert.equal(control.stdout.trim(),'INSERT_SUCCEEDED');
  }
  if(mode==='collision'){fs.mkdirSync(path.join(root,'old-claim-archive'));fs.writeFileSync(path.join(root,'old-claim-archive','keep.txt'),'PRESERVE');}
  const run=spawnSync(ps,args(script(root,mode)),{windowsHide:true,encoding:'utf8',timeout:12000,maxBuffer:30000});
  assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr.slice(-1200));
  const receipt=JSON.parse(run.stdout.trim());
  assert.equal(receipt.executionAuthorized,false);
  if(mode==='collision'){
   assert.match(receipt.moves[0],/^MOVE_FAILED_/);
   assert.equal(receipt.finish,'ROLLED_BACK');
   assert.equal(fs.readFileSync(path.join(root,'old-claim-archive','keep.txt'),'utf8'),'PRESERVE');
   assert.equal(fs.readFileSync(path.join(root,'old-claim','owner.json'),'utf8'),'{"fixture":"old-claim"}');
   assert.equal(fs.existsSync(path.join(root,'continuation-archive')),false);
   assert.equal(fs.existsSync(path.join(root,'install-archive')),false);
   check(root,false,true);
  }else{
   assert.deepEqual(receipt.moves,['STAGED','STAGED','STAGED']);
   assert.equal(receipt.outsideOriginalVisible,true);
   assert.equal(receipt.finish,mode==='commit'?'COMMITTED':'ROLLED_BACK');
   if(mode==='insert')assert.equal(receipt.competitor,'INSERT_BLOCKED');
   check(root,mode==='commit');
  }
  assert.equal(acl(root,mode==='commit'),beforeAcl);
 }finally{clean(root);}
});
test('Windows TEMP killed transaction owner preserves all three original directories',{
 skip:process.platform!=='win32',
},async()=>{
 const root=fixture();let child;
 try{
  const beforeAcl=acl(root);
  child=spawn(ps,args(script(root,'interrupted')),{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  const deadline=Date.now()+7000;
  while(!fs.existsSync(path.join(root,'READY'))&&Date.now()<deadline&&child.exitCode===null)
   await new Promise(r=>setTimeout(r,50));
  assert.equal(fs.existsSync(path.join(root,'READY')),true);
  check(root,false);child.kill();await closed;
  check(root,false);
  assert.equal(acl(root),beforeAcl);
 }finally{if(child&&child.exitCode===null)child.kill();clean(root);}
});
test('Windows TEMP preopened independent directory handle cannot silently bypass namespace isolation',{
 skip:process.platform!=='win32',
},async()=>{
 const root=fixture();let child;fs.mkdirSync(path.join(root,'control'));
 const beforeAcl=acl(root);
 try{
  const code=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Add-Type -TypeDefinition @'\n${native}\n'@\n[C996TempTx]::PreopenedChild(${quote(root)})`;
  child=spawn(ps,args(code),{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  const deadline=Date.now()+6000;
  while(!fs.existsSync(path.join(root,'CHILD_READY'))&&Date.now()<deadline&&child.exitCode===null)await new Promise(r=>setTimeout(r,40));
  assert.equal(fs.existsSync(path.join(root,'CHILD_READY')),true);
  assert.equal(fs.readFileSync(path.join(root,'CHILD_READY'),'utf8'),'00000000');
  const run=spawnSync(ps,args(script(root,'preopened')),{windowsHide:true,encoding:'utf8',timeout:10000,maxBuffer:30000});
  assert.equal(run.status,0,run.stderr.slice(-1200));assert.equal(await closed,0);
  const receipt=JSON.parse(run.stdout.trim());
  assert.equal(receipt.finish,'ROLLED_BACK');check(root,false);
  assert.equal(acl(root),beforeAcl);
  if(receipt.moves.every(x=>x==='STAGED')){
   // Exact NTSTATUS for a transaction conflict, not an arbitrary failure.
   assert.equal(receipt.competitor,'C0190001');
   assert.equal(fs.existsSync(path.join(root,'install','late.json')),false);
  }else{
   assert.match(receipt.moves.at(-1),/^MOVE_FAILED_/);
   assert.equal(receipt.competitor,'00000000');
  }
  console.log('C996_TXF_PREOPENED_OUTCOME='+JSON.stringify({staged:receipt.moves.filter(x=>x==='STAGED').length,
   lastMove:receipt.moves.at(-1),relativeInsertNtStatus:receipt.competitor,
   rollback:receipt.finish,identityPreserved:true,aclPreserved:true,executionAuthorized:false}));
 }finally{if(child&&child.exitCode===null)child.kill();clean(root);}
});
