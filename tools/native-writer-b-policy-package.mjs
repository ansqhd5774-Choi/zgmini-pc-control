// Owner tooling for the already approved #4135 first policy installation.
// prepare/finalize never enable execution or dispatch the reserved request.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {preparePublicWriter4135PolicyPreview} from '../ci-approval/request-preview.mjs';
import {readNativeScope} from '../ci-approval/native-receiver-observe.mjs';
import {readNativeInstalledProof,verifyNativeInstalledProof} from '../ci-approval/native-publisher-entry.mjs';
import {POLICY_INSTALL as F,makeIndependentPolicyScope,makeIndependentPolicyProof,
 policyDigest as hash,verifyFirstScopeTransition,FIRST_SOURCE_HEAD,FIRST_SCOPE_SHA256} from '../ci-approval/native-policy-install.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const need=(v,c)=>{if(!v)throw Error(c)};
const api=(route,method='GET',body)=>JSON.parse(execFileSync('gh',
 ['api','--method',method,route,...(body?['--input','-']:[])],
 {encoding:'utf8',input:body?JSON.stringify(body):undefined,windowsHide:true,timeout:30000,maxBuffer:2000000}));
const read=(relative,revision)=>{
 const f=api('repos/'+repo+'/contents/'+relative+'?ref='+revision);
 need(f.type==='file'&&f.path===relative&&f.encoding==='base64','NATIVE_POLICY_REMOTE_FILE_STOP');
 const bytes=Buffer.from(f.content,'base64');
 need(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')===f.sha,
  'NATIVE_POLICY_REMOTE_BLOB_STOP');
 return {repository:repo,revision,path:relative,blobSha:f.sha,bytes};
};
const write=(dir,name,bytes)=>fs.writeFileSync(path.join(dir,name),bytes,{flag:'wx'});
function authenticate(){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,
  'NATIVE_POLICY_OWNER_ENVIRONMENT_STOP');
 const user=api('user');need(user.id===327938088&&user.login==='ansqhd5774-Choi','NATIVE_POLICY_OWNER_STOP');
 const approval=api('repos/'+repo+'/issues/comments/7238358611');
 need(approval.user.id===327938088&&approval.issue_url.endsWith('/issues/4135')&&
  approval.body.includes(F.approvalSha256)&&approval.body.includes('Public Native Writer B'),
  'NATIVE_POLICY_OWNER_APPROVAL_STOP');
}
const beforeScopePath='E:/ZGmini/data/pc-writer/ci-native/ci-native-writer-b-approved.json';
function requireUnactivated(){
 const list=api('repos/'+repo+'/actions/variables?per_page=100');
 need(list.total_count===list.variables.length,'NATIVE_POLICY_VARIABLE_LIST_INCOMPLETE_STOP');
 for(const name of ['ZGMINI_CI_NATIVE_WRITER_B_ENABLED','ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED',
  'ZGMINI_CI_NATIVE_WRITER_B_EXEC_ENABLED']){
  const old=list.variables.find(x=>x.name===name);
  need(!old||old.value==='false','NATIVE_POLICY_TRANSITION_ACTIVATION_STOP');
 }
}
function verifyPinnedDeployment(p,pack){
 need(p.nativeWriterBControlMode==='PINNED_CHECKOUT_V1'&&
  p.sourceHeadSha===FIRST_SOURCE_HEAD&&p.policyRevision===p.nativeWriterBControlSha&&
  pack.controlHead===p.nativeWriterBControlSha&&pack.sourceHeadSha===p.sourceHeadSha,
  'NATIVE_POLICY_PINNED_DEPLOYMENT_STOP');
 const head=api('repos/'+repo+'/commits/main').sha;
 const cmp=api('repos/'+repo+'/compare/'+p.nativeWriterBControlSha+'...'+head);
 need(['ahead','identical'].includes(cmp.status)&&cmp.merge_base_commit?.sha===p.nativeWriterBControlSha,
  'NATIVE_POLICY_CONTROL_ANCESTRY_STOP');
 need(read(p.receiverWorkflowPath,head).blobSha===p.receiverWorkflowBlobSha&&
  read(p.receiverWorkflowPath,p.nativeWriterBControlSha).blobSha===p.receiverWorkflowBlobSha&&
  read(p.sourceWorkflowPath,p.sourceHeadSha).blobSha===p.sourceWorkflowBlobSha&&
  hash(read('ci-approval/native-writer-b-execute.mjs',p.nativeWriterBControlSha).bytes)===p.nativeWriterBAdapterSha256,
  'NATIVE_POLICY_DEPLOYMENT_PIN_DRIFT_STOP');
 const past=api('repos/'+repo+'/actions/runs?head_sha='+p.sourceHeadSha+'&event=pull_request&per_page=100');
 need(past.total_count===0,'NATIVE_POLICY_SOURCE_EVENT_ALREADY_STARTED_STOP');
}
const [mode,arg,output,reviewedControlSha]=process.argv.slice(2);
try{
 authenticate();
 if(mode==='prepare'||mode==='prepare-transition'){
  const transition=mode==='prepare-transition';
  if(transition){requireUnactivated();need(arg===FIRST_SOURCE_HEAD,'NATIVE_POLICY_TRANSITION_SOURCE_STOP');}
  need(/^[a-f0-9]{40}$/.test(arg??'')&&output&&path.isAbsolute(output)&&!fs.existsSync(output),
   'NATIVE_POLICY_PREPARE_ARGS_STOP');
  const liveMain=api('repos/'+repo+'/commits/main').sha;
  let controlHead=liveMain;
  if(transition){
   need(/^[a-f0-9]{40}$/.test(reviewedControlSha??''),'NATIVE_POLICY_REVIEWED_CONTROL_REQUIRED_STOP');
   const merged=api('repos/'+repo+'/pulls/4387');
   need(merged.merged===true&&merged.base?.ref==='main'&&
    merged.merge_commit_sha===reviewedControlSha,'NATIVE_POLICY_REVIEWED_MERGE_STOP');
   const cmp=api('repos/'+repo+'/compare/'+reviewedControlSha+'...'+liveMain);
   need(['ahead','identical'].includes(cmp.status)&&cmp.merge_base_commit?.sha===reviewedControlSha,
    'NATIVE_POLICY_CONTROL_ANCESTRY_STOP');
   controlHead=reviewedControlSha;
  }
  const past=api('repos/'+repo+'/actions/runs?head_sha='+arg+'&event=pull_request&per_page=100');
  need(past.total_count===0,'NATIVE_POLICY_SOURCE_EVENT_ALREADY_STARTED_STOP');
  // Source tooling must itself be the reviewed, immutable main bytes.
  const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  if(transition){
   const git=(...args)=>execFileSync('git',['-C',sourceRoot,...args],
    {encoding:'utf8',windowsHide:true}).trim();
   need(git('rev-parse','HEAD')===controlHead&&
    git('status','--porcelain','--untracked-files=no')==='',
    'NATIVE_POLICY_REVIEWED_CHECKOUT_STOP');
  }
  for(const rel of ['tools/native-writer-b-policy-package.mjs','ci-approval/native-policy-install.mjs',
   'ci-approval/native-publisher-entry.mjs','tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1']){
   need(fs.readFileSync(path.join(sourceRoot,rel)).equals(read(rel,controlHead).bytes),
    'NATIVE_POLICY_PACKAGE_MAIN_BYTES_STOP');
  }
  const m=read(F.approvalPath,controlHead),manifest=JSON.parse(m.bytes);
  need(hash(m.bytes)===F.approvalSha256,'NATIVE_POLICY_MANIFEST_STOP');
  const root=manifest.sourceRoot;
  const head=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
  const config=JSON.parse(fs.readFileSync(manifest.configPath));
  need(head===manifest.baseHead&&config.source===manifest.baseConfigSourceSha,
   'NATIVE_POLICY_WRITER_BASE_CAS_STOP');
  for(const f of manifest.files)need(hash(fs.readFileSync(path.join(root,f.path)))===f.beforeSha256,
   'NATIVE_POLICY_WRITER_FILE_CAS_STOP');
  need(!fs.existsSync('E:/ZGmini/data/pc-writer/writer-b-install-once/'+F.requestId),
   'NATIVE_POLICY_RESERVED_WRITER_CLAIM_STOP');
  const host=JSON.parse(fs.readFileSync('E:/ZGmini/automation/pc-control/host.json'));
  const preview=preparePublicWriter4135PolicyPreview({requestInput:{effect:'B_WRITER_SOURCE',
   pin:{repository:repo,revision:controlHead,path:F.approvalPath,blobSha:m.blobSha,sha256:F.approvalSha256},
   observation:m,requestIdentity:{requestId:F.requestId,chatId:'a67cd0f6-508a-4a73-87e3-88174bd8e52e'},
   requestState:'NEW',targetSha:manifest.candidateSourceSha,
   context:{observedHead:head,observedConfigSha:config.source}},
   controlHead,sourceHeadSha:arg,installedControllerSha:host.controllerSourceSha,
   sourceWorkflow:read('.github/workflows/controller-maintenance-source-tests.yml',arg),
   receiverWorkflow:read('.github/workflows/ci-approved-writer-b-once.yml',controlHead),
   adapter:read('ci-approval/native-writer-b-execute.mjs',controlHead)});
  need(preview.state==='PUBLIC_WRITER_POLICY_PREVIEW_ONLY','NATIVE_POLICY_PREVIEW_STOP');
  const scope=makeIndependentPolicyScope({policy:preview.proposedPolicy,approvalBytes:m.bytes,
   requestBytes:Buffer.from(preview.body)});
  const migration=transition?verifyFirstScopeTransition(fs.readFileSync(beforeScopePath),scope):null;
  if(transition)verifyPinnedDeployment(preview.proposedPolicy,{controlHead,sourceHeadSha:arg});
  fs.mkdirSync(output,{recursive:false});
  write(output,'scope.json',scope);write(output,'policy.json',JSON.stringify(preview.proposedPolicy));
  const ps=read('tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1',controlHead).bytes;
  write(output,'INSTALL_ONCE.ps1',ps);
  write(output,'package.json',JSON.stringify({schema:'ZGMINI_NATIVE_POLICY_PACKAGE_V1',controlHead,
   scopeSha256:hash(scope),installerSha256:hash(ps),requestId:F.requestId,sourceHeadSha:arg,
   ...(migration?{migration}:{})},null,2));
  console.log(JSON.stringify({status:'PACKAGE_PREPARED_NOT_INSTALLED',scopeSha256:hash(scope),
   installerSha256:hash(ps),requestId:F.requestId,variablesEnabled:false,dispatched:false}));
 }else if(mode==='finalize'){
  need(arg&&path.isAbsolute(arg),'NATIVE_POLICY_FINALIZE_ARGS_STOP');
  const dir=arg,p=JSON.parse(fs.readFileSync(path.join(dir,'policy.json')));
  const pack=JSON.parse(fs.readFileSync(path.join(dir,'package.json')));
  requireUnactivated();verifyPinnedDeployment(p,pack);
  need(hash(fs.readFileSync(path.join(dir,'scope.json')))===pack.scopeSha256,
   'NATIVE_POLICY_PACKAGE_SCOPE_DRIFT_STOP');
  const hosts=F.hosts.map(host=>JSON.parse(fs.readFileSync(path.join(dir,host+'.json'))));
  const receipt={schema:'ZGMINI_NATIVE_POLICY_INSTALL_RECEIPT_V1',effect:'B_WRITER_SOURCE',
   requestId:F.requestId,status:'POLICY_INSTALLED_VERIFIED',nativePolicySha256:hash(JSON.stringify(p)),
   actualControllerSha:p.installedControllerSha,approvalSha256:F.approvalSha256,
   requestSha256:F.requestSha256,controllerChanged:false,writerChanged:false,
   variablesEnabled:false,dispatched:false,hosts};
  need(hosts.every(x=>x.scopeSha256===pack.scopeSha256)&&
   pack.migration?.beforeScopeSha256===FIRST_SCOPE_SHA256&&
   pack.migration.afterScopeSha256===pack.scopeSha256&&
   pack.migration.afterPolicySha256===receipt.nativePolicySha256&&
   hosts.every(x=>x.previousScopeSha256===FIRST_SCOPE_SHA256&&x.backupVerified===true),
   'NATIVE_POLICY_PACKAGE_HOST_SCOPE_STOP');
  const receiptBytes=Buffer.from(JSON.stringify(receipt)+'\n');
  const installationRequestId='native-policy-'+randomUUID();
  const proof=makeIndependentPolicyProof({policy:p,receipt,receiptBytes,installationRequestId});
  // Durable posting intent before the only create-only Contents PUT.
  write(dir,'receipt-posting.json',JSON.stringify({installationRequestId,sha256:hash(receiptBytes)}));
  const route='repos/'+repo+'/contents/'+proof.installationReceiptPath;
  api(route,'PUT',{message:'chore(ci-native): 독립 정책 설치 영수증 기록',branch:'main',content:receiptBytes.toString('base64')});
  need(read(proof.installationReceiptPath,'main').bytes.equals(receiptBytes),'NATIVE_POLICY_RECEIPT_READBACK_STOP');
  write(dir,'proof.json',JSON.stringify(proof)+'\n');
  console.log(JSON.stringify({status:'RECEIPT_PUBLISHED_PROOF_FINALIZATION_REQUIRED',
   installationRequestId,requestId:F.requestId,variablesEnabled:false,dispatched:false}));
 }else if(mode==='activate'){
  need(arg&&path.isAbsolute(arg),'NATIVE_POLICY_ACTIVATE_ARGS_STOP');
  const dir=arg,pack=JSON.parse(fs.readFileSync(path.join(dir,'package.json')));
  const proofBytes=fs.readFileSync(path.join(dir,'proof.json')),proof=JSON.parse(proofBytes);
  verifyPinnedDeployment(proof.policy,pack);
  for(const host of F.hosts){
   const report=JSON.parse(fs.readFileSync(path.join(dir,host+'.final.json')));
   need(report.host===host&&report.status==='POLICY_PROOF_INSTALLED_VERIFIED'&&
    report.scopeSha256===pack.scopeSha256&&report.proofSha256===hash(proofBytes)&&
    report.aclVerified===true,'NATIVE_POLICY_FINAL_HOST_READBACK_STOP');
  }
  const local=readNativeScope('B_WRITER_SOURCE');
  const installedProof=readNativeInstalledProof('B_WRITER_SOURCE');
  need(JSON.stringify(installedProof)===JSON.stringify(proof)&&
   JSON.stringify(local.policy)===JSON.stringify(proof.policy),'NATIVE_POLICY_ACTUAL_LOCAL_PROOF_STOP');
  await verifyNativeInstalledProof('B_WRITER_SOURCE',proof,{getJson:route=>api('repos/'+repo+'/'+route)});
  const variables={ZGMINI_CI_NATIVE_SCOPE_ROOT:'C:\\ProgramData\\ZGMINI-CI\\NativeWriterBPolicy',
   ZGMINI_CI_NATIVE_RECEIPT_ROOT:'C:\\ProgramData\\ZGMINI-CI\\NativeWriterBReceipts',
   ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED:'true',ZGMINI_CI_NATIVE_WRITER_B_ENABLED:'true',
   ZGMINI_CI_NATIVE_WRITER_B_EXEC_ENABLED:'true'};
  const existing=api('repos/'+repo+'/actions/variables?per_page=100').variables;
  const before=Object.fromEntries(Object.keys(variables).map(name=>[name,
   existing.find(x=>x.name===name)?.value??null]));
  need(Object.entries(before).every(([name,value])=>value===null||value===variables[name]||
   (name.startsWith('ZGMINI_CI_NATIVE_WRITER_B_')&&value==='false')),
   'NATIVE_POLICY_VARIABLE_PREIMAGE_DRIFT_STOP');
  write(dir,'activation-intent.json',JSON.stringify({before,desired:variables,requestId:F.requestId}));
  for(const [name,value] of Object.entries(variables)){
   if(before[name]===value)continue;
   // gh exits successfully with empty output for variable writes (204).
   execFileSync('gh',['api','--method',before[name]===null?'POST':'PATCH',
    'repos/'+repo+'/actions/variables'+(before[name]===null?'':'/'+name),'--input','-'],
    {input:JSON.stringify({name,value}),encoding:'utf8',windowsHide:true,timeout:30000});
  }
  const actual=api('repos/'+repo+'/actions/variables?per_page=100').variables;
  need(Object.entries(variables).every(([name,value])=>actual.some(x=>x.name===name&&x.value===value)),
   'NATIVE_POLICY_VARIABLE_READBACK_STOP');
  write(dir,'activation-result.json',JSON.stringify({status:'POLICY_AND_VARIABLES_READY_NOT_EXECUTED',
   requestId:F.requestId,dispatched:false}));
  console.log(JSON.stringify({status:'POLICY_AND_VARIABLES_READY_NOT_EXECUTED',requestId:F.requestId,
   next:'OPEN_PREPARED_SOURCE_PR_ONCE',dispatched:false,writerInstalled:false}));
 }else throw Error('NATIVE_POLICY_MODE_STOP');
}catch(e){
 console.error(JSON.stringify({status:'STOPPED',code:/^NATIVE_POLICY_[A-Z_]+$/.test(e.message)?e.message:
  'NATIVE_POLICY_STATE_UNKNOWN_NO_RETRY',variablesEnabled:false,dispatched:false}));process.exitCode=1;
}
