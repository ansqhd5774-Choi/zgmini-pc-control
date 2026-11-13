// #996: compile and execute the fixed C TEMP-only NT relative rename candidate.
// Scoped exclusively to the already-authorized isolated Windows Runner; it
// never accesses, builds, mounts, or modifies an operating Controller/volume.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const hostAllowed=process.platform==='win32' &&
  process.arch==='x64' && process.env.GITHUB_ACTIONS==='true' &&
  process.env.COMPUTERNAME==='DESKTOP-N62L0NG' &&
  process.env.RUNNER_NAME==='zgmini-handoff-ci-spare-01' &&
  !fs.existsSync('E:/ZGmini');

const expectedFlags=[
  '/nologo','/W4','/WX','/TC','/O2','/MT','/GS','/guard:cf',
  '/DC996_NATIVE_TEMP_TEST_ONLY=1',
  '/DC996_NATIVE_NT_RELATIVE_TEMP_DIAGNOSTIC_ONLY=1',
  '/D_WIN32_WINNT=0x0A00',
];
const fixedPrefix='zgmini-996-winpe-fixture-';
const isSafeTemp=(name)=>path.win32.parse(name).root.toLowerCase()==='c:\\' &&
  !/[&|<>^%"\r\n]/.test(name);
function execFixed(binary,args,opts={}){
  return spawnSync(binary,args,{encoding:'utf8',windowsHide:true,timeout:45000,
    maxBuffer:32768,...opts});
}

test('compiled x64 C TEMP-only NT root-relative rename and existing archive refusal', {
  skip:!hostAllowed && 'Only pinned common queue PC isolated Runner; no operating PC'
},()=>{
  const temp=fs.realpathSync.native(os.tmpdir());
  assert.ok(isSafeTemp(temp),'Untrusted TEMP root');
  const candidates=[
    path.join(process.env['ProgramFiles(x86)']||'C:\\Program Files (x86)',
      'Microsoft','Visual Studio','Installer','vswhere.exe'),
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\Installer\\vswhere.exe',
  ];
  const where=candidates.find(x=>fs.existsSync(x));
  assert.ok(where,'C996_NATIVE_C_TOOLCHAIN_VSWHERE_UNAVAILABLE');
  const found=execFixed(where,['-latest','-products','*','-version','[18.0,19.0)',
    '-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property','installationPath']);
  assert.equal(found.status,0,'C996_VSWHERE_FAILED');
  const install=found.stdout.trim().split(/\r?\n/)[0];
  assert.ok(install&&isSafeTemp(install),'C996_NATIVE_C_VS2026_UNAVAILABLE');
  const devCmd=path.join(install,'Common7','Tools','VsDevCmd.bat');
  assert.equal(fs.existsSync(devCmd),true,'C996_VSDEV_CMD_NOT_FOUND');
  const build=fs.mkdtempSync(path.join(temp,'zgmini-996-native-compile-'));
  const token=randomBytes(16).toString('hex');
  const root=path.join(temp,fixedPrefix+token);
  const collideToken=randomBytes(16).toString('hex');
  const collide=path.join(temp,fixedPrefix+collideToken);
  const src=path.resolve('tools','controller-996-winpe-native-temp-rename.c');
  const exe=path.join(build,'c996-native-nt-temp.exe');
  const bat=path.join(build,'build-nt-temp-only.cmd');
  const output=path.join(build,'compile.out.txt');
  assert.equal(fs.existsSync(src),true);
  assert.ok(isSafeTemp(src)&&isSafeTemp(build));
  let initialized=false,collisionInitialized=false;
  try{
    // This script has fixed compiler flags and one reviewed source file;
    // no arbitrary shell or environmental input supplied by an Issue.
    const cmd=[
      '@echo off',
      'call "'+devCmd+'" -arch=x64 -host_arch=x64 >nul 2>&1',
      'if errorlevel 1 exit /b 21',
      'cl.exe '+expectedFlags.join(' ')+' /Fe:"'+exe+'" "'+src+'" /link /MACHINE:X64 /SUBSYSTEM:CONSOLE /DYNAMICBASE /NXCOMPAT /INCREMENTAL:NO >"'+output+'" 2>&1',
      'exit /b %ERRORLEVEL%',
      '',
    ].join('\r\n');
    fs.writeFileSync(bat,cmd,{flag:'wx'});
    const compile=execFixed(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe',
      ['/d','/c',bat],{timeout:90000});
    if(compile.status!==0){
      const diagnostic=fs.existsSync(output)?fs.readFileSync(output,'utf8'):'';
      console.log('C996_NATIVE_C_BUILD_FAIL='+String(compile.status));
      console.log(diagnostic.slice(-2400));
    }
    assert.equal(compile.status,0,'C996_NATIVE_C_BUILD_STOP');
    assert.equal(fs.existsSync(exe),true);
    console.log('C996_NATIVE_C_BUILD_PASS');

    fs.mkdirSync(root);initialized=true;
    fs.mkdirSync(path.join(root,'source'));
    const proof=Buffer.from('zgmini-996-nt-relative-compiled-source\n');
    fs.writeFileSync(path.join(root,'source','proof.txt'),proof,{flag:'wx'});
    const success=execFixed(exe,['--test-token',token],{timeout:20000});
    console.log('C996_NATIVE_C_SUCCESS_RC='+success.status);
    assert.equal(success.status,0,'C996_NATIVE_C_RENAME_STOP');
    assert.match(success.stdout,/C996_NATIVE_TEMP_MODE:NTDLL_RELATIVE_ROOT_DIAGNOSTIC_ONLY/);
    assert.match(success.stdout,/C996_NATIVE_TEMP_RENAMED_AND_ID_VERIFIED/);
    assert.equal(fs.existsSync(path.join(root,'source')),false);
    assert.deepEqual(fs.readFileSync(path.join(root,'archive','proof.txt')),proof);
    console.log('C996_NATIVE_C_ROOT_RELATIVE_PASS');

    fs.mkdirSync(collide);collisionInitialized=true;
    fs.mkdirSync(path.join(collide,'source'));
    fs.mkdirSync(path.join(collide,'archive'));
    const left=Buffer.from('source-unchanged\n');
    const right=Buffer.from('destination-unchanged\n');
    fs.writeFileSync(path.join(collide,'source','proof.txt'),left,{flag:'wx'});
    fs.writeFileSync(path.join(collide,'archive','proof.txt'),right,{flag:'wx'});
    const blocked=execFixed(exe,['--test-token',collideToken],{timeout:20000});
    assert.equal(blocked.status,2,'C996_NATIVE_C_COLLISION_NOT_REFUSED');
    assert.match(blocked.stderr,/C996_NATIVE_TEMP_STOP:DESTINATION_EXISTS_OR_UNKNOWN/);
    assert.deepEqual(fs.readFileSync(path.join(collide,'source','proof.txt')),left);
    assert.deepEqual(fs.readFileSync(path.join(collide,'archive','proof.txt')),right);
    console.log('C996_NATIVE_C_EXISTING_DESTINATION_PRESERVED_PASS');
  }finally{
    // These are only directories created above with random TEST_ONLY tokens.
    if(initialized)fs.rmSync(root,{recursive:true,force:true});
    if(collisionInitialized)fs.rmSync(collide,{recursive:true,force:true});
    fs.rmSync(build,{recursive:true,force:true});
  }
});
