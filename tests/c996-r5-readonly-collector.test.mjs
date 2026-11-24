import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {allowedLogName,eventCode,logTimestamp,classification,TARGET_HOST,statNoLink} from '../c996-r5-readonly/collector.mjs';
test('exact target PC is pinned',()=>assert.equal(TARGET_HOST,'DESKTOP-N62L0NG'));
test('known DISM log basenames are accepted',()=>{
  assert.equal(allowedLogName('COMMIT_NEW_WIM.dism.log'),true);
  assert.equal(allowedLogName('MOUNT_NEW_WIM.dism.log'),true);
  assert.equal(allowedLogName('dism.log'),true);
});
test('dangerous or unrelated names rejected',()=>{
 for(const x of ['..\\secrets.dism.log','../secrets.dism.log','secrets.txt','.env','test.bat','private.log','x.dism.log/abc','C:\\x.dism.log']) assert.equal(allowedLogName(x),false,x);
});
test('commit event without leaking line',()=>assert.equal(eventCode('[12/12/2026 14:22:11] dism.exe /Unmount-Image /Commit /MountDir:C:\\private'),'COMMIT_REQUEST'));
test('mount event',()=>assert.equal(eventCode('DismMountImage index 1'), 'MOUNT_REQUEST'));
test('metadata mention',()=>assert.equal(eventCode('Processing image metadata'), 'METADATA_MENTION'));
test('error mention',()=>assert.equal(eventCode('Error: 5'), 'ERROR_MENTION'));
test('normal unrelated log lines not included',()=>assert.equal(eventCode('User account appears in this diagnostic'),null));
test('timestamps are limited to brackets',()=>{
 assert.equal(logTimestamp('[11/12/2026 08:05:22] blah'),'11/12/2026 08:05:22');
 assert.equal(logTimestamp('secret 11/12/2026 08:05:22'),null);
});
test('commit log absent never implies full validation',()=>assert.equal(classification([],[]),'COMMIT_LOG_NOT_ESTABLISHED'));
test('identified commit log still does not claim drift stage known',()=>assert.equal(classification([], [{name:'COMMIT_NEW_WIM.dism.log',counts:{}}]),'LOGS_PRESENT_STAGE_UNPROVEN'));

test('unchanged no-follow lstat path traversal emits bounded progress markers',()=>{
 const steps=[];
 const st=statNoLink(fileURLToPath(import.meta.url),(operation,depth)=>steps.push({operation,depth}));
 assert.equal(st.isFile(),true);
 assert.deepEqual(steps[0],{operation:'PATH_LSTAT',depth:0});
 assert.deepEqual(steps.at(-1),{operation:'LEAF_RECHECK',depth:0});
 assert.ok(steps.some(x=>x.operation==='PATH_LSTAT'&&x.depth>=1));
 assert.ok(steps.every(x=>Number.isSafeInteger(x.depth)&&x.depth>=0&&x.depth<=24));
});

// CI-only focused test: old b9's four symlink fixture tests require Windows
// CreateSymbolicLink privilege unavailable on this isolated low-privilege runner.
// Retain that full-suite failure as evidence; do not change permissions or
// soften production symlink protections. Test the new diagnostic contract only.
import {spawnSync} from 'node:child_process';
test('CNN #1521 b9 known Sidecar hash allowlist focused regression on isolated Windows',()=>{
 const target=fileURLToPath(new URL('./fear-greed-archive-status.test.mjs',import.meta.url));
 const exact='^read-only Sidecar diagnosis accepts only explicitly pinned source generations, never unknown bytes$';
 const run=spawnSync(process.execPath,['--test','--test-name-pattern='+exact,target],{
  encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:1024*1024,
 });
 assert.equal(run.error,undefined,String(run.error));
 assert.equal(run.status,0,(run.stdout??'')+'\\n'+(run.stderr??''));
 assert.match(run.stdout,/# pass 1/);
 assert.match(run.stdout,/# fail 0/);
 assert.match(run.stdout,/ok \\d+ - read-only Sidecar diagnosis accepts only explicitly pinned source generations/);
});
