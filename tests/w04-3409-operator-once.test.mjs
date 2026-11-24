import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs,{readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {FIXED,assertOperatorScope,assertOrigin,sanitizedChildEnvironment,isolatedGitArguments,
 validateSourceReceipt,validateRecoveryResult} from '../tools/operator-packets/w04-3409-recovery-once.mjs';

const read=rel=>readFileSync(new URL('../'+rel,import.meta.url));
const approval=JSON.parse(read('approvals/maintenance-recoveries/'+
 FIXED.original+'.post-writer.json'));
const rawResult=()=>({
 status:'RECOVERED_INSTALLED_STATE',
 code:'INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN',
 requestId:FIXED.original,sourceSha:FIXED.approvedSource,
 installedSha:FIXED.controller,leaseArchived:true,
 historicalPostcheck:'OUTCOME_UNKNOWN',historicalLedgerPreserved:true,
 originalRequestRetried:false,controllerChanged:false,writerChanged:false,
 workflowChanged:false,dbD1Writes:0,casDigests:{...approval.casDigests}
});
const prepared=()=>({
 status:'SOURCE_PREPARED_ONLY',code:'EXACT_RELEASE_WORKTREE_CAS_VERIFIED',
 requestId:FIXED.original,sourceSha:FIXED.approvedSource,
 stagedHead:FIXED.release,controllerWrites:0,leaseWrites:0,recoveryExecuted:false
});
test('the one-click driver authenticates exact committed JS file bytes and rejects runner execution',()=>{
 const source=read('tools/operator-packets/w04-3409-recovery-once.mjs');
 const cmd=read('tools/operator-packets/W04_3409_INDEPENDENT_RECOVERY_ONCE_V1.cmd').toString();
 const blob=createHash('sha1').update(Buffer.from('blob '+source.length+'\0')).update(source).digest('hex');
 assert.match(cmd,new RegExp('set "ZG_JS_BLOB='+blob+'"'));
 assert.match(cmd,/if defined GITHUB_ACTIONS goto :no_runner/);
 assert.match(cmd,/if defined RUNNER_NAME goto :no_runner/);
 assert.match(cmd,/--once/);
 assert.doesNotMatch(cmd,/--force|reset --hard|git clean|powershell|RUNNER_NAME=|GITHUB_ACTIONS=/i);
});
test('only nonrunner independent Windows scope can reach operator preflight',()=>{
 assert.equal(assertOperatorScope({platform:'win32',env:{TEMP:'C:\\Users\\Operator\\AppData\\Local\\Temp'}}),true);
 assert.throws(()=>assertOperatorScope({platform:'linux',env:{TEMP:'C:\\Temp'}}),
  /OPERATOR_INTERACTIVE_WINDOWS_REQUIRED/);
 assert.throws(()=>assertOperatorScope({platform:'win32',env:{TEMP:'C:\\Temp',GITHUB_ACTIONS:'true'}}),
  /OPERATOR_INTERACTIVE_WINDOWS_REQUIRED/);
 assert.throws(()=>assertOperatorScope({platform:'win32',env:{TEMP:'C:\\Temp',RUNNER_NAME:'zgmini-pc-04'}}),
  /OPERATOR_INTERACTIVE_WINDOWS_REQUIRED/);
 assert.throws(()=>assertOperatorScope({platform:'win32',env:{TEMP:'relative'}}),
  /OPERATOR_TEMP_UNAVAILABLE/);
});
test('operator child environment rejects Git executable, config, hooks and helper injection',()=>{
 const env={
  GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.hooksPath',
  GIT_CONFIG_VALUE_0:'C:/untrusted-hooks',
  GIT_CONFIG_PARAMETERS:'core.hooksPath=C:/untrusted-hooks',
  GIT_CONFIG_GLOBAL:'C:/untrusted-config',
  GIT_EXEC_PATH:'C:/untrusted-exec',GIT_TEMPLATE_DIR:'C:/untrusted-templates',
  GIT_SSH_COMMAND:'C:/untrusted-ssh',GIT_ASKPASS:'C:/untrusted-askpass',
  GIT_DIR:'C:/other-repo',GCM_INTERACTIVE:'always',
  SSH_ASKPASS:'C:/untrusted-askpass',
  APPDATA:'C:/Users/Operator/AppData/Roaming',USERPROFILE:'C:/Users/Operator',
  PATH:'C:/Windows/System32',GH_TOKEN:'test-placeholder-not-a-token'
 };
 const clean=sanitizedChildEnvironment(env);
 for(const k of Object.keys(env).filter(k=>/^GIT_|^GCM_|^SSH_ASKPASS$/.test(k)))
  assert.equal(Object.hasOwn(clean,k),k==='GIT_TERMINAL_PROMPT'||k==='GIT_OPTIONAL_LOCKS'||k==='GCM_INTERACTIVE',k);
 assert.equal(clean.GIT_TERMINAL_PROMPT,'0');
 assert.equal(clean.GIT_OPTIONAL_LOCKS,'0');
 assert.equal(clean.GCM_INTERACTIVE,'never');
 assert.equal(clean.APPDATA,env.APPDATA);
 assert.equal(clean.USERPROFILE,env.USERPROFILE);
 assert.equal(clean.PATH,env.PATH);
 assert.equal(clean.GH_TOKEN,env.GH_TOKEN);
});

test('actual Git worktree with injected config cannot run active post-checkout hooks',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w04-3409-operator-argv-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const repo=path.join(root,'fixture-repo'),safe=path.join(root,'nohooks'),
  malicious=path.join(root,'malicious-hooks'),stage=path.join(root,'stage');
 fs.mkdirSync(repo);fs.mkdirSync(safe);fs.mkdirSync(malicious);
 const injected={...process.env,HOME:root,
  GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.hooksPath',
  GIT_CONFIG_VALUE_0:malicious,GIT_CONFIG_PARAMETERS:'core.hooksPath='+malicious,
  GIT_EXEC_PATH:path.join(root,'untrusted-git-exec'),
  GIT_TEMPLATE_DIR:malicious,GIT_ASKPASS:path.join(root,'untrusted-helper')};
 const env=sanitizedChildEnvironment(injected);
 const git=(args)=>execFileSync('git',args,{
  cwd:repo,env,stdio:'pipe',timeout:15000,windowsHide:true});
 git(['init','-q']);git(['config','user.name','ZGMINI Operator Test']);
 git(['config','user.email','test@example.invalid']);
 fs.writeFileSync(path.join(repo,'source.txt'),'fixed source\n');
 git(['add','source.txt']);git(['commit','-qm','fixture']);
 const defaultHooks=path.join(repo,'.git','hooks');
 const script='#!/bin/sh\nprintf executed > hook-triggered.txt\n';
 for(const d of [defaultHooks,malicious]){
  fs.writeFileSync(path.join(d,'post-checkout'),script,{mode:0o755});
  fs.chmodSync(path.join(d,'post-checkout'),0o755);
 }
 const args=isolatedGitArguments(['worktree','add','--detach',stage,'HEAD'],
   {hooksPath:safe,root:repo});
 assert.deepEqual(args.slice(0,5),['--no-optional-locks','-c',
  'core.hooksPath='+safe,'-C',repo]);
 git(args);
 assert.equal(fs.readFileSync(path.join(stage,'source.txt'),'utf8'),'fixed source\n');
 assert.equal(fs.existsSync(path.join(stage,'hook-triggered.txt')),false);
 assert.equal(fs.existsSync(path.join(repo,'hook-triggered.txt')),false);
});

test('official repository origin is exact; credentials, forks and alternative hosts are forbidden',()=>{
 assert.equal(assertOrigin('https://github.com/ansqhd5774-Choi/zgmini-pc-control.git'),true);
 assert.equal(assertOrigin('git@github.com:ansqhd5774-Choi/zgmini-pc-control'),true);
 for(const value of [
  'https://token@github.com/ansqhd5774-Choi/zgmini-pc-control.git',
  'https://github.com/other/zgmini-pc-control',
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control.git/evil',
  'https://github.evil/ansqhd5774-Choi/zgmini-pc-control'
 ])assert.throws(()=>assertOrigin(value),/OPERATOR_GIT_ORIGIN_MISMATCH/);
});
test('only exact source-only preparation receipt permits subsequent recovery',()=>{
 assert.equal(validateSourceReceipt(prepared()),true);
 for(const [key,value] of [
  ['status','PASS'],['sourceSha','0'.repeat(40)],
  ['stagedHead','invalid'],['controllerWrites',1],
  ['leaseWrites',1],['recoveryExecuted',true],['requestId','other']
 ]){const forged={...prepared(),[key]:value};
  assert.throws(()=>validateSourceReceipt(forged),/OPERATOR_SOURCE_PREP_RESULT_INVALID/,key);
 }
});
test('recovery result requires approved seven CAS, archived lease and no protected writes',()=>{
 assert.equal(FIXED.approvedSource,'23d04ff8e4687b46e93aa7dd80cca58520816fed');
 assert.equal(FIXED.release,'b80eccfe05f2d94528c3b0fba6353373ff41762e');
 assert.equal(validateRecoveryResult(rawResult(),approval),true);
 for(const [key,value] of [
  ['status','BLOCKED'],['code','WRONG'],
  ['sourceSha','fcb098d20fb9a6c48f371786c69f7f1fdf5bc34a'],
  ['leaseArchived',false],['originalRequestRetried',true],
  ['controllerChanged',true],['writerChanged',true],['workflowChanged',true],
  ['dbD1Writes',1],['historicalPostcheck','PASS']
 ]){const forged={...rawResult(),[key]:value};
  assert.throws(()=>validateRecoveryResult(forged,approval),
   /OPERATOR_RECOVERY_RESULT_UNVERIFIED/,key);
 }
 const changed=rawResult();
 changed.casDigests.writerSha256='0'.repeat(64);
 assert.throws(()=>validateRecoveryResult(changed,approval),
  /OPERATOR_RECOVERY_RESULT_UNVERIFIED/);
 const extra=rawResult();extra.casDigests.otherSha256='0'.repeat(64);
 assert.throws(()=>validateRecoveryResult(extra,approval),
  /OPERATOR_RECOVERY_RESULT_UNVERIFIED/);
 assert.throws(()=>validateRecoveryResult(rawResult(),{...approval,approved:false}),
  /OPERATOR_APPROVAL_SCOPE_INVALID/);
});
test('packet stages through pinned Git ancestry; runtime path never invokes source reset or install',()=>{
 const src=read('tools/operator-packets/w04-3409-recovery-once.mjs').toString();
 assert.match(src,/git\(\['fetch','--no-tags','origin','main'\]\)/);
 assert.match(src,/core\.hooksPath='\+isolatedHooksPath/);
 assert.match(src,/ZGMINI_W04_3409_EMPTY_HOOKS_/);
 assert.match(src,/OPERATOR_HOOK_ISOLATION_DRIFT/);
 assert.match(src,/git\(\['worktree','add','--detach',FIXED.bootstrap,FIXED.release\]\)/);
 assert.match(src,/git\(\['worktree','add','--detach',FIXED.staged,FIXED.release\]\)/);
 assert.match(src,/module.verifyStagedFiles\(approval,git\)/);
 assert.match(src,/module.verifyCas\(approval\)/);
 assert.match(src,/validateSourceReceipt\(prepared\)/);
 assert.match(src,/validateRecoveryResult\(result,approval\)/);
 assert.match(src,/verifyArchive\(result,approval\)/);
 assert.ok(src.indexOf('validateSourceReceipt(prepared)')<
  src.indexOf("'reconcile-installed','--request-id'"));
 assert.doesNotMatch(src,/(\['reset'|\['clean'|fs\.rmSync|fs\.unlinkSync|rm -rf|git checkout|spawn\([^)]*shell:\s*true)/);
});
