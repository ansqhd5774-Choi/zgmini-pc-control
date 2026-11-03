// Fixed-root, exact-approval operator entry for interrupted partial switches.
import fs from'node:fs';import path from'node:path';import{execFileSync}from'node:child_process';
import{fileURLToPath}from'node:url';import{createHash,randomUUID}from'node:crypto';
const root='E:/ZGmini/automation/pc-maintenance',control='E:/ZGmini/automation/pc-control';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digest=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p));
const need=(b,c)=>{if(!b)throw Object.assign(Error(c),{code:c});};
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};
export async function main(args=process.argv.slice(2)){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'ROLLBACK_OPERATOR_WINDOWS_REQUIRED');
 need(args.length===4&&args[0]==='--request-id'&&/^pc-[a-z0-9-]{8,76}$/.test(args[1])&&args[2]==='--source-sha'&&/^[a-f0-9]{40}$/.test(args[3]),'ROLLBACK_USAGE');
 const id=args[1],source=args[3],g=a=>execFileSync('git',a,{cwd:repo,windowsHide:true,maxBuffer:4e6});
 const rel='approvals/maintenance-recoveries/'+id+'.rollback.json',raw=fs.readFileSync(path.join(repo,rel));
 need(digest(raw)===digest(g(['show','HEAD:'+rel])),'ROLLBACK_APPROVAL_UNCOMMITTED');g(['merge-base','--is-ancestor',source,'HEAD']);
 const approval=JSON.parse(raw),ledgerFile=path.join(root,'ledger',id+'.json'),ledgerBytes=fs.readFileSync(ledgerFile),ledger=JSON.parse(ledgerBytes);
 const required=['tools/controller-rollback-recovery.mjs','tools/update.mjs','tools/maintenance-apply.mjs','tools/maintenance-contract.mjs','tools/maintenance-lock.mjs'];
 need(Array.isArray(approval.files)&&approval.files.length===required.length&&required.every(p=>approval.files.filter(x=>x.path===p).length===1),'ROLLBACK_FILES_REQUIRED');
 for(const f of approval.files)need(required.includes(f.path)&&/^[a-f0-9]{64}$/.test(f.sha256)&&digest(g(['show',source+':'+f.path]))===f.sha256&&digest(fs.readFileSync(path.join(repo,f.path)))===f.sha256,'ROLLBACK_SOURCE_DRIFT');
 const {loadApprovedPackage,makePorts}=await import('./update.mjs');
 const {reconcileInterruptedRollback}=await import('./maintenance-apply.mjs');
 const dir=path.join(root,'leases/controller-install'),ownerBytes=fs.readFileSync(path.join(dir,'owner.json')),markerBytes=fs.readFileSync(path.join(dir,'RECOVERY_REQUIRED.json'));
 const owner=JSON.parse(ownerBytes),marker=JSON.parse(markerBytes);
 const snapshot=path.join(control,'backups','controller-update-'+id,'snapshot','host.json');
 const baseline=path.join(control,'backups','controller-update-'+id,'PROTECTED_BEFORE.json');
 need(approval.schema==='ZGMINI_PC_ROLLBACK_APPROVAL_V1'&&approval.approved===true&&approval.requestId===id&&approval.sourceSha===source&&
  approval.toolSha256===digest(g(['show',source+':tools/controller-rollback-recovery.mjs']))&&approval.toolSha256===digest(fs.readFileSync(fileURLToPath(import.meta.url)))&&
  approval.ledgerSha256===digest(ledgerBytes)&&approval.ownerSha256===digest(ownerBytes)&&approval.markerSha256===digest(markerBytes)&&
  approval.snapshotHostSha256===digest(fs.readFileSync(snapshot))&&approval.protectionSha256===digest(fs.readFileSync(baseline)),'ROLLBACK_APPROVAL_MISMATCH');
 need(ledger.requestId===id&&Number.isSafeInteger(owner.pid)&&owner.pid>0&&marker.requestOwnerPid===owner.pid&&marker.nonce===owner.nonce&&alive(owner.pid)===false,'ROLLBACK_OWNER_NOT_PROVEN_DEAD');
 const data=loadApprovedPackage(id,path.join(root,'approved',id+'.json'),{recovery:true});
 need(data.manifest.installedSha===ledger.installedShaBefore&&data.manifest.targetSha===ledger.targetSha,'ROLLBACK_ORIGINAL_TARGET_MISMATCH');
 const claim=path.join(root,'leases/controller-recovery');fs.mkdirSync(claim);
 const claimFile=path.join(claim,'owner.json'),nonce=randomUUID();
 fs.writeFileSync(claimFile,JSON.stringify({pid:process.pid,nonce,requestId:id}),{flag:'wx'});
 const reports=path.join(root,'recovery');fs.mkdirSync(reports,{recursive:true});
 const record=path.join(reports,id+'-rollback-'+nonce+'.json');let keep=false,archived=false;
 const persist=async r=>{if(r.mutationStarted)keep=true;const temp=record+'.tmp';fs.writeFileSync(temp,JSON.stringify(r,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,record);};
 try{
  need(fs.readFileSync(path.join(dir,'owner.json')).equals(ownerBytes)&&fs.readFileSync(ledgerFile).equals(ledgerBytes)&&alive(owner.pid)===false,'ROLLBACK_EVIDENCE_CHANGED');
  const {ports}=makePorts(data,data.issueNumber,{recoveryOperator:true});
  const r=await reconcileInterruptedRollback(ledger,ports,persist);
  if(r.status==='ROLLED_BACK'){
   need(fs.readFileSync(path.join(dir,'owner.json')).equals(ownerBytes)&&fs.readFileSync(path.join(dir,'RECOVERY_REQUIRED.json')).equals(markerBytes)&&fs.readFileSync(ledgerFile).equals(ledgerBytes),'ROLLBACK_EVIDENCE_CHANGED');
   fs.renameSync(dir,path.join(reports,id+'-rollback-'+nonce+'.lease'));keep=false;archived=true;
   await persist({...r,leaseArchived:true,originalLedgerPreserved:true});
  }
  try{execFileSync('C:/Program Files/GitHub CLI/gh.exe',['issue','comment',String(data.issueNumber),'--repo','ansqhd5774-Choi/zgmini-pc-control','--body-file',record],{windowsHide:true,timeout:30000,stdio:'pipe'});}catch{}
  return {...r,leaseArchived:archived,originalLedgerPreserved:true};
 }finally{if(!keep){need(read(claimFile).nonce===nonce,'ROLLBACK_CLAIM_CHANGED');fs.unlinkSync(claimFile);fs.rmdirSync(claim);}}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const r=await main();console.log(JSON.stringify(r));if(r.status!=='ROLLED_BACK')process.exitCode=2;}
 catch(e){console.log(JSON.stringify({status:'RECOVERY_REQUIRED',code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'ROLLBACK_INSPECTION_FAILED',next:'INSPECT_ORIGINAL_LEDGER_RECOVERY_RECORD_AND_CLAIM_NO_RETRY'}));process.exitCode=2;}
}
