import {test} from 'node:test';
// Include Owner policy transition rollback regressions in the existing source CI path.
import './ci-native-policy-install.test.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readInstalledControllerSha,recordNativeWriterBFailure,selectNativeWriterControlRoot} from '../ci-approval/native-writer-b-execute.mjs';
import {authorizeWriterBNative,assertAuthenticatedWriterBIssue,
 validateWriterBRequestManifest,ISSUE_LABEL}
 from '../writer-b/contract.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 // Real reviewed Writer approval fixture, copied only into a source-only
 // synthetic test: remove its optional extended-window grant. Never send it
 // as a real install request or install this fixture on a PC.
 const manifest=JSON.parse(fs.readFileSync(
  new URL('../approvals/writer-updates/w05-r304-maintenance-window-20261119.json',import.meta.url)));
 delete manifest.coreMaintenance;
 const approvalBytes=Buffer.from(JSON.stringify(manifest));
 const request={schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
  requestId:'12345678-1234-4234-8234-123456789abc',
  chatId:'12345678-1234-4234-8234-123456789abd',
  operation:'pc-writer-source-install',controlRepository:REPO,
  approvalManifestPath:'approvals/writer-updates/w05-r304-maintenance-window-20261119.json',
  approvalManifestSha256:hash(approvalBytes)};
 const requestBytes=Buffer.from(JSON.stringify(request));
 const adapterBytes=Buffer.from('exact pinned independent native Writer adapter');
 const p={schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',enabled:true,
  effect:'B_WRITER_SOURCE',nativeWriterBExecutionEnabled:true,
  nativeWriterBControlSha:'a'.repeat(40),
  nativeWriterBAdapterSha256:hash(adapterBytes),
  businessApprovalSha256:hash(approvalBytes),
  approvedRequestSha256:hash(requestBytes)};
 const scope={policy:p,approvalBytes,requestBytes};
 const observation={state:'CONTRACT_MATCH_ONLY',
  code:'CI_NATIVE_RECEIVER_INDEPENDENT_EVIDENCE_MATCH',
  effectKey:hash(JSON.stringify([
   p.effect,p.businessApprovalSha256,p.approvedRequestSha256
  ]))};
 const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'workflow_dispatch',
  GITHUB_ACTOR:'github-actions[bot]',GITHUB_REF:'refs/heads/main',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'123456',
  RUNNER_NAME:'zgmini-pc-01',GITHUB_SHA:'a'.repeat(40)};
 return {scope,observation,env,controlHead:env.GITHUB_SHA,adapterBytes};
}
test('native Writer B requires independent receiver and installed exact opt-in',()=>{
 const x=fixture(),a=authorizeWriterBNative(x);
 assert.equal(a.requestId,'12345678-1234-4234-8234-123456789abc');
 assert.equal(a.manifestSha256,hash(x.scope.approvalBytes));
 assert.equal(a.issueNumber,null);
 assert.equal(assertAuthenticatedWriterBIssue(a),a);
});
test('arbitrary object cannot create a Writer B installer seal',()=>{
 const x=fixture();
 assert.throws(()=>assertAuthenticatedWriterBIssue({
  requestId:'12345678-1234-4234-8234-123456789abc',
  manifest:JSON.parse(x.scope.approvalBytes)
 }),{code:'WRITER_B_UNVERIFIED_ISSUE_STOP'});
});
test('CI receiver admission cannot be substituted by a synthetic skip',()=>{
 const x=fixture();x.observation.state='REJECTED';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_INDEPENDENT_GRANT_STOP'});
});
test('missing separate runtime activation denies B even when CI source passed',()=>{
 const x=fixture();delete x.scope.policy.nativeWriterBExecutionEnabled;
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_INDEPENDENT_GRANT_STOP'});
});
test('Writer B cannot be reinterpreted as A or Controller B',()=>{
 const x=fixture();x.scope.policy.effect='A_READONLY';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_INDEPENDENT_GRANT_STOP'});
});
test('native Writer B does not run on generic CI/Owner manually dispatched identity',()=>{
 const x=fixture();x.env.GITHUB_ACTOR='ansqhd5774-Choi';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('native Writer B cannot execute on isolated CI controller Runner',()=>{
 const x=fixture();x.env.RUNNER_NAME='zgmini-handoff-ci-isolated';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('only first run attempt is eligible for one-shot Writer installation',()=>{
 const x=fixture();x.env.GITHUB_RUN_ATTEMPT='2';
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('transitive Writer installer revision must match exact installed control SHA',()=>{
 const x=fixture();x.scope.policy.nativeWriterBControlSha='b'.repeat(40);
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('unreviewed native adapter SHA is blocked before installer',()=>{
 const x=fixture();x.adapterBytes=Buffer.from('different adapter');
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('changed manifest or request bytes cannot gain a native grant',()=>{
 const x=fixture();x.scope.approvalBytes=Buffer.from('{}');
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_APPROVAL_BYTES_STOP'});
 const y=fixture();y.scope.requestBytes=Buffer.from('{}');
 assert.throws(()=>authorizeWriterBNative(y),{code:'WRITER_B_NATIVE_APPROVAL_BYTES_STOP'});
});
test('source drift between Actions checkout and running workflow is denied',()=>{
 const x=fixture();x.controlHead='b'.repeat(40);
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});
test('extended Core Task pause approval is not silently included in initial native B',()=>{
 const x=fixture();
 const m=JSON.parse(x.scope.approvalBytes);
 m.coreMaintenance='PAUSE_NEW_STARTS_DRAIN_360S_V1';
 const changed=Buffer.from(JSON.stringify(m));
 x.scope.approvalBytes=changed;
 x.scope.policy.businessApprovalSha256=hash(changed);
 x.scope.requestBytes=Buffer.from(JSON.stringify({
  ...JSON.parse(x.scope.requestBytes),approvalManifestSha256:hash(changed)
 }));
 x.scope.policy.approvedRequestSha256=hash(x.scope.requestBytes);
 x.observation.effectKey=hash(JSON.stringify([
  'B_WRITER_SOURCE',x.scope.policy.businessApprovalSha256,x.scope.policy.approvedRequestSha256
 ]));
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_MAINTENANCE_SCOPE_STOP'});
});

test('public Writer B seal remains bound to exact independent execution opt-in',()=>{
 const x=fixture();
 Object.assign(x.scope.policy,{repositoryVisibility:'public',installedControllerSha:'f'.repeat(40)});
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
 x.env.ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED='true';
 x.installedControllerSha=x.scope.policy.installedControllerSha;
 const a=authorizeWriterBNative(x);
 assert.equal(a.issueNumber,null);
 const wrong=fixture();
 wrong.scope.policy.repositoryVisibility='public';
 wrong.scope.policy.installedControllerSha='not-a-sha';
 wrong.env.ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED='true';
 assert.throws(()=>authorizeWriterBNative(wrong),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});

test('#4135 paid MarketParquet four-file manifest is exact native B scope, never an execution grant',()=>{
 // Historical request reconstructed for source-only validation, not replayed.
 const p='approvals/writer-updates/us-breadth-paid-r2-guarded-fourfile-natural-idle-20261127.json';
 const bytes=fs.readFileSync(new URL('../'+p,import.meta.url));
 const digest='c4f58408f4360f7d03b9c359cda78ce4602c447d86ff15ad538cdb57d820acda';
 assert.equal(hash(bytes),digest);
 const original={schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
  requestId:'d1e33802-9e86-4b4b-ae20-6cfdb0c2c2b8',
  chatId:'a67cd0f6-508a-4a73-87e3-88174bd8e52e',
  operation:'pc-writer-source-install',controlRepository:REPO,
  approvalManifestPath:p,approvalManifestSha256:digest};
 const input={body:JSON.stringify(original),
  labels:[{name:ISSUE_LABEL}],manifestBytes:bytes};
 const {request,manifest}=validateWriterBRequestManifest(input);
 assert.equal(request.approvalManifestPath,p);
 assert.equal(request.requestId,original.requestId);
 assert.equal(Object.hasOwn(manifest,'coreMaintenance'),false);
 assert.equal(manifest.runCount,1);
 assert.deepEqual(manifest.files.map(f=>f.path),[
  'scripts/pc-writer/local-cycle.mjs',
  'scripts/pc-writer/marketparquet-paid-store.mjs',
  'scripts/pc-writer/us-breadth-paid-r2-cycle.mjs',
  'scripts/pc-writer/us-breadth-paid-r2-stored.mjs'
 ]);
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskDefinitionChanges','allowOtherSourceChanges'])
  assert.equal(manifest[key],false,key);
 const mutated={...original,approvalManifestSha256:'0'.repeat(64)};
 assert.throws(()=>validateWriterBRequestManifest({...input,body:JSON.stringify(mutated)}),
  {code:'WRITER_B_MANIFEST_HASH_STOP'});
 const noLabel={...input,labels:[]};
 assert.throws(()=>validateWriterBRequestManifest(noLabel),
  {code:'WRITER_B_ISSUE_AUTH_STOP'});
});

test('Public Writer B rejects a missing or stale installed Controller identity',()=>{
 const x=fixture();
 Object.assign(x.scope.policy,{repositoryVisibility:'public',installedControllerSha:'f'.repeat(40)});
 x.env.ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED='true';
 for(const actual of [undefined,null,'e'.repeat(40),'not-a-sha']){
  x.installedControllerSha=actual;
  assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
 }
 x.installedControllerSha='f'.repeat(40);
 assert.equal(authorizeWriterBNative(x).issueNumber,null);
 x.scope.policy.installedControllerSha='e'.repeat(40);
 assert.throws(()=>authorizeWriterBNative(x),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
 // Private pre-existing grant has no new host-read dependency.
 const old=fixture();
 assert.equal(authorizeWriterBNative(old).issueNumber,null);
});
test('Public Writer B reads the actual fixed host.json bytes, refusing absence and drift',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'writer-b-installed-controller-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'host.json'),sourceSha='f'.repeat(40);
 fs.writeFileSync(file,JSON.stringify({controllerSourceSha:sourceSha}));
 assert.equal(readInstalledControllerSha({root}),sourceSha);
 fs.writeFileSync(file,'{"controllerSourceSha":"stale"}');
 assert.throws(()=>readInstalledControllerSha({root}),
  {code:'WRITER_B_NATIVE_INSTALLED_CONTROLLER_UNVERIFIED_STOP'});
 fs.unlinkSync(file);
 assert.throws(()=>readInstalledControllerSha({root}),
  {code:'WRITER_B_NATIVE_INSTALLED_CONTROLLER_UNVERIFIED_STOP'});
 const ioDenied={
  lstatSync:p=>fs.lstatSync(p),
  readFileSync:()=>{const e=new Error('access denied');e.code='EACCES';throw e;}
 };
 fs.writeFileSync(file,JSON.stringify({controllerSourceSha:sourceSha}));
 assert.throws(()=>readInstalledControllerSha({root,io:ioDenied}),
  {code:'WRITER_B_NATIVE_INSTALLED_CONTROLLER_UNVERIFIED_STOP'});
 assert.throws(()=>readInstalledControllerSha({root:path.join(root,'missing')}),
  {code:'WRITER_B_NATIVE_INSTALLED_CONTROLLER_UNVERIFIED_STOP'});
 fs.writeFileSync(file,JSON.stringify({controllerSourceSha:sourceSha}));
 const bytes=fs.readFileSync(file);
 let calls=0;
 const changed={
  lstatSync:p=>fs.lstatSync(p),
  readFileSync:p=>{
   calls++;
   return calls===2?Buffer.concat([bytes,Buffer.from(' ')]):Buffer.from(bytes);
  }
 };
 assert.throws(()=>readInstalledControllerSha({root,io:changed}),
  {code:'WRITER_B_NATIVE_INSTALLED_CONTROLLER_UNVERIFIED_STOP'});
 // Existing immutable root policy forbids redirected metadata.
 fs.renameSync(file,path.join(root,'real.json'));
 fs.symlinkSync(path.join(root,'real.json'),file);
 assert.throws(()=>readInstalledControllerSha({root}),
  {code:'WRITER_B_NATIVE_INSTALLED_CONTROLLER_UNVERIFIED_STOP'});
});

test('native B preflight error creates bounded, sanitized, create-only artifact pair',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-b-failure-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const env={RUNNER_TEMP:root,GITHUB_RUN_ID:'12345678',GITHUB_RUN_ATTEMPT:'1'};
 const error=Object.assign(new Error('SECRET_TOKEN_OR_PATH_CANARY'),{
  code:'WRITER_B_NATIVE_INSTALLED_CONTROLLER_UNVERIFIED_STOP'
 });
 const result=recordNativeWriterBFailure({env,mode:'--preflight',error});
 assert.deepEqual(result,{recorded:true,code:error.code});
 const base=path.join(root,'zgmini-ci-native-writer-b-12345678-setup-preflight');
 const json=fs.readFileSync(base+'.json','utf8');
 const txt=fs.readFileSync(base+'.txt','utf8');
 const record=JSON.parse(json);
 assert.equal(record.schema,'ZGMINI_CI_NATIVE_WRITER_B_FAILURE_V1');
 assert.equal(record.status,'WRITER_B_SETUP_STOP');
 assert.equal(record.installEffect,'NOT_STARTED');
 assert.equal(record.code,error.code);
 assert.equal(record.requestId,null);
 assert.match(txt,/RETRY=READ_ONLY_RECONCILE_NO_REEXECUTE/);
 assert.doesNotMatch(json+txt,/SECRET_TOKEN_OR_PATH_CANARY|native.*policy.*bytes/i);
 assert.equal(fs.readdirSync(root).length,2);
 assert.equal(recordNativeWriterBFailure({env,mode:'--preflight',error}).recorded,false);
 assert.equal(fs.readFileSync(base+'.json','utf8'),json);
 assert.equal(fs.readFileSync(base+'.txt','utf8'),txt);
});
test('execute-stage B failure reports state UNKNOWN rather than false restored or no-effect',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-b-outcome-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const env={RUNNER_TEMP:root,GITHUB_RUN_ID:'945',GITHUB_RUN_ATTEMPT:'1'};
 const r=recordNativeWriterBFailure({
  env,mode:'--execute',error:new Error('RAW_PRIVATE_WRITER_SOURCE_CANARY')
 });
 assert.deepEqual(r,{recorded:true,code:'WRITER_B_NATIVE_SETUP_UNVERIFIED_STOP'});
 const basename='zgmini-ci-native-writer-b-945-setup-execute';
 const receipt=JSON.parse(fs.readFileSync(path.join(root,basename+'.json'),'utf8'));
 const txt=fs.readFileSync(path.join(root,basename+'.txt'),'utf8');
 assert.equal(receipt.status,'WRITER_B_STATE_UNKNOWN');
 assert.equal(receipt.installEffect,'UNVERIFIED');
 assert.equal(receipt.retry,'READ_ONLY_RECONCILE_NO_REEXECUTE');
 assert.doesNotMatch(JSON.stringify(receipt)+txt,/RAW_PRIVATE_WRITER_SOURCE_CANARY|WRITER_B_INSTALLED_VERIFIED/);
});
test('native failure reporter never trusts caller paths, invalid run or retries',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-b-no-retry-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const base={RUNNER_TEMP:root,GITHUB_RUN_ID:'55',GITHUB_RUN_ATTEMPT:'1'};
 for(const [mode,env] of [
  ['--preflight',{...base,GITHUB_RUN_ID:'not-numeric'}],
  ['--execute',{...base,GITHUB_RUN_ATTEMPT:'2'}],
  ['--bad',base],
  ['--preflight',{...base,RUNNER_TEMP:path.join(root,'missing')}]
 ]){
  const out=recordNativeWriterBFailure({env,mode,error:{code:'BAD_SOURCE_PATH'}});
  assert.equal(out.recorded,false);
  assert.equal(out.code,'WRITER_B_NATIVE_SETUP_UNVERIFIED_STOP');
 }
 assert.equal(fs.readdirSync(root).length,0);
 const real=path.join(root,'actual');fs.mkdirSync(real);
 const alias=path.join(root,'link');fs.symlinkSync(real,alias,'dir');
 const refused=recordNativeWriterBFailure({
  env:{...base,RUNNER_TEMP:alias},mode:'--preflight',error:{code:'WRITER_B_NATIVE_TOKEN_STOP'}
 });
 assert.equal(refused.recorded,false);
 assert.equal(fs.readdirSync(real).length,0);
});
test('existing native Writer B workflow uploads the exact fixed receipt glob on failure',()=>{
 const wf=fs.readFileSync(new URL('../.github/workflows/ci-approved-writer-b-once.yml',import.meta.url),'utf8');
 assert.match(wf,/if: always\(\) && vars\.ZGMINI_CI_NATIVE_WRITER_B_EXEC_ENABLED == 'true'/);
 assert.match(wf,/zgmini-ci-native-writer-b-\$\{\{ github\.run_id \}\}-\*\.json/);
 assert.match(wf,/zgmini-ci-native-writer-b-\$\{\{ github\.run_id \}\}-\*\.txt/);
 assert.match(wf,/if-no-files-found: error/);
});

test('denied native B receiver still emits a bounded preflight refusal without candidate execution',()=>{
 const y=fs.readFileSync(new URL('../.github/workflows/ci-approved-writer-b-once.yml',import.meta.url),'utf8');
 const between=(start,end)=>{
  const a=y.indexOf(start),b=y.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'native B step ordering preserved: '+start);
  return y.slice(a,b);
 };
 const admission=between('- name: Independently verify CI receiver scope without PC execution',
  '- name: Verify installed native Writer B grant');
 const preflight=between('- name: Verify installed native Writer B grant',
  '- name: Checkout only the independently approved Writer B candidate SHA');
 const checkout=between('- name: Checkout only the independently approved Writer B candidate SHA',
  '- name: Execute existing Writer B CAS lease and rollback transaction once');
 const execute=between('- name: Execute existing Writer B CAS lease and rollback transaction once',
  '- name: Upload bounded native Writer B result pair');
 const upload=y.slice(y.indexOf('- name: Upload bounded native Writer B result pair'));
 assert.match(admission,/id: native-writer-admission/);
 assert.match(admission,/native-receiver-observe\.mjs/);
 assert.match(preflight,/if: always\(\) && vars\.ZGMINI_CI_NATIVE_WRITER_B_EXEC_ENABLED == 'true'/);
 assert.match(preflight,/native-writer-b-execute\.mjs --preflight/);
 assert.doesNotMatch(preflight,/performWriterBInstall|--execute|writer-b-candidate/);
 for(const step of [checkout,execute])
  assert.match(step,/if: steps\.native-writer-admission\.outcome == 'success' && steps\.native-writer-preflight\.outcome == 'success'/);
 assert.match(execute,/native-writer-b-execute\.mjs --execute/);
 assert.match(upload,/if: always\(\) && vars\.ZGMINI_CI_NATIVE_WRITER_B_EXEC_ENABLED == 'true'/);
 assert.match(upload,/if-no-files-found: error/);
 assert.match(y,/vars\.ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED == 'true'/);
});

test('Public Writer exact pinned source remains bound across a separate authenticated dispatch origin',()=>{
 const x=fixture();
 Object.assign(x.scope.policy,{repositoryVisibility:'public',installedControllerSha:'f'.repeat(40),
  nativeWriterBControlMode:'PINNED_CHECKOUT_V1'});
 x.env.ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED='true';
 x.installedControllerSha='f'.repeat(40);
 x.env.GITHUB_SHA='b'.repeat(40);
 x.dispatchControlHead=x.env.GITHUB_SHA;
 assert.equal(authorizeWriterBNative(x).controlSha,'a'.repeat(40));
 for(const mutate of [
  y=>{y.dispatchControlHead='c'.repeat(40)},
  y=>{y.controlHead='c'.repeat(40)},
  y=>{delete y.scope.policy.nativeWriterBControlMode},
  y=>{y.scope.policy.nativeWriterBControlMode='UNKNOWN'},
  y=>{y.scope.policy.repositoryVisibility='private'},
  y=>{y.adapterBytes=Buffer.from('different')}
 ]){
  const y={...x,scope:{...x.scope,policy:{...x.scope.policy}},env:{...x.env}};
  mutate(y);
  assert.throws(()=>authorizeWriterBNative(y),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
 }
});
test('checkout selection binds the actual origin and exact separate approved checkout',()=>{
 const root=path.resolve('synthetic-workspace'),pinned=path.join(root,'writer-b-control');
 const policy={repositoryVisibility:'public',nativeWriterBControlMode:'PINNED_CHECKOUT_V1',
  nativeWriterBControlSha:'a'.repeat(40)};
 const env={GITHUB_SHA:'b'.repeat(40)};
 const readHead=p=>p===root?'b'.repeat(40):p===pinned?'a'.repeat(40):'c'.repeat(40);
 const x={workspace:root,ownRoot:root,policy,env,readHead,mode:'--resolve-control'};
 assert.equal(selectNativeWriterControlRoot(x).dispatchControlHead,env.GITHUB_SHA);
 assert.equal(selectNativeWriterControlRoot({...x,ownRoot:pinned,mode:'--preflight'}).controlHead,policy.nativeWriterBControlSha);
 for(const bad of [
  {...x,mode:'--preflight'},
  {...x,ownRoot:pinned,mode:'--resolve-control'},
  {...x,ownRoot:pinned,mode:'--execute',readHead:()=>env.GITHUB_SHA},
  {...x,env:{GITHUB_SHA:'c'.repeat(40)}}
 ])assert.throws(()=>selectNativeWriterControlRoot(bad),{code:'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP'});
});

test('real isolated Git checkouts keep the approved runtime after receipt publication',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-writer-git-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const source=path.join(temp,'source'),workspace=path.join(temp,'dispatch');
 const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],
  {encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
 const commit=(cwd,message)=>git(cwd,'-c','user.name=Source fixture',
  '-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-m',message);
 fs.mkdirSync(source);
 git(source,'init');
 fs.writeFileSync(path.join(source,'runtime.mjs'),'export const fixture = 1;\n');
 git(source,'add','runtime.mjs');commit(source,'reviewed runtime');
 const pin=git(source,'rev-parse','HEAD');
 fs.mkdirSync(path.join(source,'results'));
 fs.writeFileSync(path.join(source,'results','native-policy-fixture.json'),'{}\n');
 git(source,'add','results/native-policy-fixture.json');commit(source,'receipt publication');
 const dispatch=git(source,'rev-parse','HEAD');
 assert.notEqual(dispatch,pin);
 git(temp,'clone','--no-hardlinks',source,workspace);
 const pinned=path.join(workspace,'writer-b-control');
 const policy={repositoryVisibility:'public',nativeWriterBControlMode:'PINNED_CHECKOUT_V1',
  nativeWriterBControlSha:pin};
 const env={GITHUB_SHA:dispatch};
 const resolve={workspace,ownRoot:workspace,policy,env,mode:'--resolve-control'};
 const execute={...resolve,ownRoot:pinned,mode:'--execute'};
 assert.equal(selectNativeWriterControlRoot(resolve).dispatchControlHead,dispatch);
 fs.mkdirSync(pinned);
 assert.throws(()=>selectNativeWriterControlRoot(execute),{code:'WRITER_B_NATIVE_CHECKOUT_ROOT_STOP'});
 fs.rmdirSync(pinned);
 git(temp,'clone','--no-hardlinks',source,pinned);
 git(pinned,'checkout','--detach',pin);
 const selected=selectNativeWriterControlRoot(execute);
 assert.equal(selected.controlHead,pin);
 assert.equal(selected.dispatchControlHead,dispatch);
 fs.mkdirSync(path.join(workspace,'writer-b-candidate'));
 assert.equal(selectNativeWriterControlRoot(execute).controlHead,pin);
 fs.appendFileSync(path.join(pinned,'runtime.mjs'),'// unexpected tracked change\n');
 assert.throws(()=>selectNativeWriterControlRoot(execute),{code:'WRITER_B_NATIVE_CHECKOUT_DIRTY_STOP'});
});
