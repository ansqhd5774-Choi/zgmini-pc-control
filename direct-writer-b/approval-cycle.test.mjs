import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const entry=fileURLToPath(new URL('./run.mjs',import.meta.url));

test('real CLI top-level-await resolves fixed receiver import without exit 13',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-direct-b-cycle-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  // The child executes the production CLI with a pinned, read-only fake
  // Git approval. Its fixed receiver stops before creating any PC effects.
  const childCode=String.raw`
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import {createHash} from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.env.CYCLE_TEST_ROOT;
const entry=process.env.CYCLE_TEST_ENTRY;
const actor='ansqhd5774-Choi';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const controlSha='a'.repeat(40),sourceSha='b'.repeat(40);
const manifest={
  schema:'ZGMINI_CONFIGURED_RUNTIME_B_APPROVAL_V1',
  status:'APPROVED_B',scope:'PC_WRITER_CONFIGURED_THEME_REPEAT_UPGRADE_ONLY',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceSha,
  profileId:'configured-themes',
  runnerPath:'scripts/pc-writer/theme-config-package-runner.mjs',
  packageManifestSha256:'c'.repeat(64),
  runtimeMode:'REPEATABLE_ACTIVE_RUNTIME',
  runtimePreimage:{
    activeRuntimeSha256:'d'.repeat(64),
    taskXmlSha256:'e'.repeat(64),
    scheduledCmdSha256:'f'.repeat(64),
    scheduledVbsSha256:'1'.repeat(64)},
  effects:{providerCalls:false,dbWrites:false,d1Writes:false,
    taskDefinitionChanges:false,newTasks:false,otherOperationalFiles:false}
};
const raw=Buffer.from(JSON.stringify(manifest));
const mSha=createHash('sha256').update(raw).digest('hex');
const approvalDir=path.join(root,'generic-b-control','approvals','approved-runtime-b');
const temp=path.join(root,'runner-temp');
fs.mkdirSync(approvalDir,{recursive:true});
fs.mkdirSync(temp,{recursive:true});
fs.writeFileSync(path.join(approvalDir,mSha+'.json'),raw);
const requestId='9b4e50f9-8674-4894-9c5e-8ba454d6f79d';
const chatId='fb3dd7e4-e3cc-4a49-851b-377f9f824529';
const issue={repository:{full_name:repo,private:true},sender:{login:actor},
  issue:{number:846,user:{login:actor},title:'pc-approved-runtime-b',
    labels:[{name:'pc-writer-b-install'}],
    body:JSON.stringify({schema:'ZGMINI_PC_APPROVED_RUNTIME_B_ACTIONS_REQUEST_V1',
      requestId,chatId,operation:'pc-approved-runtime-b',
      controlRepository:repo,approvalManifestSha256:mSha})}};
const eventPath=path.join(root,'event.json');
fs.writeFileSync(eventPath,JSON.stringify(issue));
Object.assign(process.env,{
  GITHUB_REPOSITORY:repo,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:actor,
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:controlSha,
  GITHUB_EVENT_PATH:eventPath,GITHUB_WORKSPACE:root,RUNNER_TEMP:temp
});
const exists=fs.existsSync;
fs.existsSync=file=>
  typeof file==='string'&&file.startsWith('C:')&&file.includes('git.exe')?
    true:exists(file);
cp.spawnSync=(_binary,args)=>{
  if(args.includes('rev-parse'))return {status:0,
    stdout:Buffer.from(String(args[1]).includes('configured-feature-source')?
      sourceSha:controlSha)};
  if(args.includes('show'))return {status:0,stdout:raw};
  return {status:1,stdout:Buffer.alloc(0)};
};
syncBuiltinESMExports();
Object.defineProperty(process,'platform',{value:'win32',configurable:true});
process.argv[1]=entry;
await import(pathToFileURL(entry).href);
const result=JSON.parse(fs.readFileSync(path.join(temp,
  'approved-runtime-b-once-result.json'),'utf8'));
if(result.status!=='DIRECT_B_EFFECT_BLOCKED' ||
   !/^DIRECT_B_[A-Z0-9_]+$/.test(result.code??'')) {
  throw new Error('unexpected bounded receiver stop: '+result.status+' '+result.code);
}
process.stdout.write('CLI_CYCLE_SAFE_STOP_OBSERVED\n');
`;
  const child=spawnSync(process.execPath,
    ['--input-type=module','-e',childCode],{
      env:{...process.env,CYCLE_TEST_ROOT:root,CYCLE_TEST_ENTRY:entry},
      encoding:'utf8',timeout:15000,maxBuffer:200000,
    });
  assert.equal(child.error,undefined,
    'CLI cycle test must finish instead of hanging');
  assert.equal(child.signal,null);
  assert.equal(child.status,1,
    'approved no-effect preflight stops with code 1, never unresolved TLA 13');
  assert.match(child.stdout,/CLI_CYCLE_SAFE_STOP_OBSERVED/);
  const result=JSON.parse(fs.readFileSync(path.join(root,
    'runner-temp','approved-runtime-b-once-result.json'),'utf8'));
  assert.equal(result.status,'DIRECT_B_EFFECT_BLOCKED');
  assert.equal(result.operationSucceeded,false);
});
