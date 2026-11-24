import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createMaintenanceAgent} from '../tools/maintenance-agent.mjs';
import {SOURCE_BUNDLE_OPERATION,SOURCE_BUNDLE_APPROVAL_SCHEMA}
  from '../tools/source-bundle-register.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const ID='pc-12345678-1234-4123-8123-123456789abc';
const CHAT='chat-12345678-1234-4123-8123-123456789abc';
const CONTROLLER_SHA='b'.repeat(40),SOURCE_SHA='a'.repeat(40);

function routeFixture(t,{corruptApprovedBytes=false,operation=SOURCE_BUNDLE_OPERATION}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-bundle-routing-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const stateDir=path.join(dir,'maintainer'),leaseRoot=path.join(dir,'leases');
 fs.mkdirSync(stateDir);fs.mkdirSync(leaseRoot);
 const manifest={schema:SOURCE_BUNDLE_APPROVAL_SCHEMA,operation:SOURCE_BUNDLE_OPERATION,
  scope:'HOST_APPROVED_SOURCES_SINGLE_CAS_ONLY',sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'codex/theme-fear-greed-integration-20261025',sourceSha:SOURCE_SHA,
  sourceManifestPath:`approvals/source-bundles/manifests/${SOURCE_SHA}.json`,
  sourceManifestSha256:'d'.repeat(64),entrypoint:'scripts/pc-writer/theme-platform.mjs',
  installedControllerSha:CONTROLLER_SHA,
  hostPath:'E:/ZGmini/automation/pc-control/host.json',
  stageBundle:`E:/ZGmini/automation/pc-control/source-bundles/source-${SOURCE_SHA}`,
  backupDirectory:`E:/ZGmini/automation/pc-control/backups/source-${ID}`,
  approval:{grade:'B',scope:'HOST_APPROVED_SOURCES_SINGLE_CAS_ONLY',
   ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/552'},
  backup:{strategy:'VERSIONED_SNAPSHOT',rollback:'RESTORE_HOST_SHA256'}};
 const bytes=Buffer.from(JSON.stringify(manifest));
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',requestId:ID,chatId:CHAT,
  operation,controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  targetControllerSha:CONTROLLER_SHA,approvalManifestSha256:sha(bytes)};
 const issue={number:124,state:'OPEN',title:'pc-source-bundle-register',
  author:{login:'ansqhd5774-Choi'},labels:[{name:'pc-maintenance'}],
  comments:[],body:JSON.stringify(request)};
 const calls=[];
 const output=value=>({stdout:JSON.stringify(value),stderr:''});
 const execFileImpl=async(_binary,args)=>{
  // Node updater invocation is [absolute updateScript, subcommand, ...].
  if(/[/\\]update\.mjs$/.test(args[0]??''))args=args.slice(1);
  calls.push([...args]);
  if(args[0]==='issue'&&args[1]==='view')return output(issue);
  if(args[0]==='issue'&&args[1]==='comment')return output({});
  if(args[0]==='api'&&args[1]?.includes('/contents/approvals/source-bundles/')){
   const result=corruptApprovedBytes?Buffer.concat([bytes,Buffer.from(' ')]):bytes;
   return output({type:'file',encoding:'base64',content:result.toString('base64')});
  }
  if(args[0]==='api'&&args[1]?.includes('/contents/results/')){
   throw Object.assign(new Error('HTTP_404'),{code:'HTTP_404'});
  }
  if(args[0]==='source-bundle-status')return output({actualControllerSha:CONTROLLER_SHA,
   installLock:{held:false},ledger:null});
  if(args[0]==='source-bundle-apply')return output({status:'PASS',code:'BUNDLE_REGISTERED',
   actualControllerSha:CONTROLLER_SHA,sourceSha:SOURCE_SHA});
  if(args[0]==='status'||args[0]==='host-r6-status')return output({status:'BLOCKED',
   actualControllerSha:CONTROLLER_SHA,installLock:{held:false},ledger:null});
  throw new Error(`unexpected mock command ${args.join(' ')}`);
 };
 const agent=createMaintenanceAgent({stateDir,leaseRoot,execFileImpl,
  updateScript:path.resolve('tools/update.mjs'),ghBinary:'fixture-gh',
  nodeBinary:'fixture-node',leaseAttempts:1});
 return {dir,stateDir,issue,request,manifest,bytes,calls,agent};
}

test('common B issue goes through pinned approval read + source-bundle-status/apply',async t=>{
 const f=routeFixture(t),result=await f.agent.processIssue(f.issue);
 assert.equal(result.status,'SUCCEEDED');
 const commands=f.calls.filter(args=>['source-bundle-status','source-bundle-apply'].includes(args[0]));
 assert.deepEqual(commands.map(args=>args[0]),['source-bundle-status','source-bundle-apply']);
 const packagePath=commands[1][3];
 assert.equal(fs.existsSync(packagePath),true);
 const registered=JSON.parse(fs.readFileSync(packagePath));
 assert.equal(registered.issue.approvalManifestSha256,sha(f.bytes));
 assert.equal(registered.manifestRawBase64, f.bytes.toString('base64'));
 assert.equal(f.calls.some(args=>args[0]==='apply'),false);
 assert.equal(f.calls.some(args=>args[0]==='host-r6-apply'),false);
 assert.equal(f.calls.some(args=>args[0]==='r54-b-apply'),false);
 const again=await f.agent.processIssue(f.issue);
 assert.equal(again.code,'DUPLICATE_REQUEST_SUPPRESSED');
 assert.equal(f.calls.filter(args=>args[0]==='source-bundle-apply').length,1);
});
test('invalid approval manifest hash fails before B apply',async t=>{
 const f=routeFixture(t,{corruptApprovedBytes:true});
 const result=await f.agent.processIssue(f.issue);
 assert.equal(result.status,'BLOCKED');
 assert.equal(f.calls.some(args=>args[0]==='source-bundle-apply'),false);
});
test('source bundle title/operation mismatch blocks before updater',async t=>{
 const f=routeFixture(t,{operation:'controller-update'});
 const result=await f.agent.processIssue(f.issue);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'ISSUE_TITLE_OPERATION_MISMATCH');
 assert.equal(f.calls.some(args=>args[0]==='apply'||args[0]==='source-bundle-apply'),false);
});
test('legacy Controller and R6 status commands remain routed unchanged',async t=>{
 const f=routeFixture(t);
 await f.agent.updaterStatus(ID,'controller-update');
 await f.agent.updaterStatus(ID,'employment-r6-host-register');
 assert.deepEqual(f.calls.map(args=>args[0]),['status','host-r6-status']);
});
