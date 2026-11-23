// #2821 independent Windows operator one-shot read-only probe and GitHub receipt.
// Never invokes rollback, pauses intake, edits source, leases, Workflow, or Controller.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const ISSUE=2821;
export const REQUEST_ID='pc-update-c09a58ae-4d2d-4f70-ae66-aa64d976ee51';
export const SOURCE_SHA='fda563c93f4680709788ba782ad1918abf74ff2d';
export const REPO='ansqhd5774-Choi/zgmini-pc-control';
const repo='E:/ZGmini/projects/zgmini-pc-control';
const maint='E:/ZGmini/automation/pc-maintenance';
const control='E:/ZGmini/automation/pc-control';
const cscript='C:/Windows/System32/cscript.exe';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const sourceFiles=[
 'tools/controller-rollback-recovery.mjs','tools/update.mjs',
 'tools/maintenance-apply.mjs','tools/maintenance-contract.mjs',
 'tools/maintenance-lock.mjs'
];
const hash=b=>createHash('sha256').update(b).digest('hex');
const hfile=p=>{try{return hash(fs.readFileSync(p));}catch{return null;}};
const exec=(bin,args,opts={})=>spawnSync(bin,args,{windowsHide:true,encoding:'utf8',
 timeout:15000,maxBuffer:262144,...opts});
const g=args=>exec('git',['-C',repo,...args]);
const code=s=>/^[A-Z][A-Z0-9_]{0,79}$/.test(String(s??''))?String(s):'UNKNOWN';

// OPERATOR text alone is insufficient: verify that the executable probe is
// exactly the committed checkout and that the installed WMI proof is the
// maintenance receiver's own approved file. Never publish raw source/identity.
export function inspectProbeProvenance({
 readFile=fs.readFileSync,
 git=(args,opts)=>exec('git',['-C',repo,...args],opts),
 installation=maint,entry=fileURLToPath(import.meta.url)
}={}){
 const evidence={probeCheckout:'FAIL',operatorVbs:'FAIL'};
 try{
  const branch=git(['branch','--show-current']);
  if(branch?.status!==0||String(branch.stdout).trim()!=='main')return evidence;
  const src=git(['show','HEAD:tools/w05-2821-operator-readonly-receipt.mjs'],
   {encoding:'buffer'});
  if(src?.status!==0||!Buffer.isBuffer(src.stdout)||
   !src.stdout.equals(Buffer.from(readFile(entry))))return evidence;
  evidence.probeCheckout='PASS';
  const a=JSON.parse(readFile(path.join(installation,'MAINTENANCE_INSTALL.json')));
  const expected=a?.files?.['tools/maintenance-ancestry.vbs'];
  if(a?.schema!=='ZGMINI_PC_MAINTENANCE_INSTALL_V1'||
   !/^[a-f0-9]{64}$/.test(expected??''))return evidence;
  const live=readFile(path.join(installation,'tools/maintenance-ancestry.vbs'));
  if(hash(live)!==expected)return evidence;
  // Checkout history is a second, independent source reference. A self-edited
  // installation manifest with matching tampered VBS cannot authorize a PASS.
  if(!/^[a-f0-9]{40}$/.test(a.sourceSha??''))return evidence;
  const pinned=git(['show',a.sourceSha+':tools/maintenance-ancestry.vbs'],
   {encoding:'buffer'});
  if(pinned?.status!==0||!Buffer.isBuffer(pinned.stdout)||
   hash(pinned.stdout)!==expected)return evidence;
  evidence.operatorVbs='PASS';
 }catch{/* Safe: source cannot be attested. */}
 return evidence;
}

export function newReport({now=new Date(),id=randomUUID()}={}){
 return {schema:'ZGMINI_W05_2821_INDEPENDENT_OPERATOR_READONLY_V1',
 requestId:REQUEST_ID,incidentIssue:ISSUE,receiptId:id,observedAtUtc:now.toISOString(),
 nodeOperator:'UNVERIFIED',nodeOperatorExit:'UNKNOWN',probeCheckout:'UNKNOWN',
 operatorVbs:'UNKNOWN',approval:'UNKNOWN',
 toolHashes:'0/5',originalCas:'0/5',recoveryClaim:'UNKNOWN',claimOwner:'UNKNOWN',
 originalOwnerAlive:'UNKNOWN',priorRecoveryRecord:'UNKNOWN',
 priorRecoveryCode:'UNKNOWN',priorRecoveryOperation:'UNKNOWN',
 readStatus:'NOT_STARTED',operationalWrites:0,rollbackInvocations:0};
}
const fields=Object.freeze(Object.keys(newReport({id:'11111111-2222-4333-8444-555555555555'})));

export function collectReport({pid=process.pid,report=newReport()}={}){
 if(process.platform!=='win32'||process.env.GITHUB_ACTIONS||process.env.RUNNER_NAME){
  report.readStatus='INDEPENDENT_WINDOWS_OPERATOR_REQUIRED';return report;
 }
 const provenance=inspectProbeProvenance();
 report.probeCheckout=provenance.probeCheckout;
 report.operatorVbs=provenance.operatorVbs;
 if(provenance.probeCheckout!=='PASS'||provenance.operatorVbs!=='PASS'){
  report.nodeOperator='FAIL';
  report.readStatus='OPERATOR_SOURCE_NOT_VERIFIED';
  return report;
 }
 // Prove this very Node PID, never its parent PowerShell or a Runner.
 const ancestry=exec(cscript,['//NoLogo',path.join(maint,'tools/maintenance-ancestry.vbs'),
  'OPERATOR',String(pid),'0']);
 report.nodeOperatorExit=Number.isInteger(ancestry.status)?String(ancestry.status):'UNKNOWN';
 report.nodeOperator=ancestry.status===0&&String(ancestry.stdout).trim()==='INDEPENDENT_OPERATOR'?'PASS':'FAIL';
 try{
  const rel='approvals/maintenance-recoveries/'+REQUEST_ID+'.rollback.json';
  const bytes=fs.readFileSync(path.join(repo,rel));
  const a=JSON.parse(bytes);
  const committed=exec('git',['-C',repo,'show','HEAD:'+rel],{encoding:'buffer'});
  const ancestor=g(['merge-base','--is-ancestor',SOURCE_SHA,'HEAD']);
  report.approval=a.schema==='ZGMINI_PC_ROLLBACK_APPROVAL_V1'&&
   a.approved===true&&a.requestId===REQUEST_ID&&a.sourceSha===SOURCE_SHA&&
   committed.status===0&&hash(committed.stdout)===hash(bytes)&&ancestor.status===0?'PASS':'FAIL';
  const entries=Array.isArray(a.files)?a.files:[];
  const exact=entries.length===5&&sourceFiles.every(p=>entries.filter(x=>x?.path===p).length===1);
  let valid=0;
  if(exact)for(const file of sourceFiles){
   const expected=entries.find(x=>x.path===file).sha256;
   const origin=exec('git',['-C',repo,'show',SOURCE_SHA+':'+file],{encoding:'buffer'});
   if(/^[a-f0-9]{64}$/.test(expected??'')&&origin.status===0&&
    hash(origin.stdout)===expected&&hfile(path.join(repo,file))===expected)valid++;
  }
  report.toolHashes=valid+'/5';
  if(a.toolSha256!==entries.find(x=>x?.path===sourceFiles[0])?.sha256)report.approval='FAIL';

  const install=path.join(maint,'leases/controller-install');
  const checks=[
   ['ledgerSha256',path.join(maint,'ledger',REQUEST_ID+'.json')],
   ['ownerSha256',path.join(install,'owner.json')],
   ['markerSha256',path.join(install,'RECOVERY_REQUIRED.json')],
   ['snapshotHostSha256',path.join(control,'backups','controller-update-'+REQUEST_ID,'snapshot/host.json')],
   ['protectionSha256',path.join(control,'backups','controller-update-'+REQUEST_ID,'PROTECTED_BEFORE.json')]
  ];
  report.originalCas=checks.filter(([key,file])=>/^[a-f0-9]{64}$/.test(a[key]??'')&&
   hfile(file)===a[key]).length+'/5';
  const claim=path.join(maint,'leases/controller-recovery');
  try{fs.lstatSync(claim);report.recoveryClaim='PRESENT';}
  catch(e){if(e.code!=='ENOENT')throw e;report.recoveryClaim='ABSENT';}
  if(report.recoveryClaim==='PRESENT'){
   try{
    const owner=JSON.parse(fs.readFileSync(path.join(claim,'owner.json')));
    report.claimOwner=owner.requestId===REQUEST_ID?'ORIGINAL_REQUEST':'OTHER_OR_INVALID';
   }catch{report.claimOwner='UNKNOWN';}
  }else report.claimOwner='NONE';
  const owner=JSON.parse(fs.readFileSync(checks[1][1]));
  if(Number.isSafeInteger(owner.pid)&&owner.pid>0){
   try{process.kill(owner.pid,0);report.originalOwnerAlive='YES';}
   catch(e){report.originalOwnerAlive=e.code==='ESRCH'?'NO':'UNKNOWN';}
  }
  const recovery=path.join(maint,'recovery');
  const records=fs.readdirSync(recovery).filter(n=>n.startsWith(REQUEST_ID+'-rollback-')&&n.endsWith('.json'))
   .map(n=>({name:n,mtime:fs.statSync(path.join(recovery,n)).mtimeMs}))
   .sort((a,b)=>b.mtime-a.mtime).slice(0,1);
  if(records.length){
   const prior=JSON.parse(fs.readFileSync(path.join(recovery,records[0].name)));
   report.priorRecoveryRecord=prior.requestId===REQUEST_ID?'FOUND':'UNVERIFIED';
   report.priorRecoveryCode=code(prior.code);
   report.priorRecoveryOperation=['prepareRecovery','restore','resumeIntake','none']
    .includes(prior.failureOperation)?prior.failureOperation:'UNKNOWN';
  }else report.priorRecoveryRecord='ABSENT';
  report.readStatus='READ_ONLY_COLLECTED';
 }catch(e){
  report.readStatus=e.code==='ENOENT'?'REQUIRED_FILE_MISSING':
   e instanceof SyntaxError?'ORIGINAL_JSON_INVALID':'READ_ONLY_INCOMPLETE';
 }
 return report;
}

// One POST and one GET, without retrying ambiguous publication. The only
// remote write is a sanitized GitHub comment; no source/lease/Workflow mutation.
export function postAndVerify(r,{invoke=exec}={}){
 if(r?.schema!=='ZGMINI_W05_2821_INDEPENDENT_OPERATOR_READONLY_V1'||
  r.requestId!==REQUEST_ID||r.incidentIssue!==ISSUE||
  !/^[a-f0-9-]{36}$/.test(r.receiptId??'')||
  Object.keys(r).length!==fields.length||!fields.every(key=>Object.hasOwn(r,key))||
  !['PASS','FAIL'].includes(r.nodeOperator))return {status:'REPORT_UNVERIFIED'};
 const body='<!-- W05_2821_INDEPENDENT_OPERATOR_READONLY:'+r.receiptId+' -->\n'+
  '~~~json\n'+JSON.stringify(r,null,2)+'\n~~~';
 if(Buffer.byteLength(body)>8192)return{status:'REPORT_TOO_LARGE'};
 const post=invoke(gh,['api','--method','POST','repos/'+REPO+'/issues/'+ISSUE+'/comments',
  '--input','-'],{input:JSON.stringify({body}),encoding:'utf8',windowsHide:true,
   timeout:30000,maxBuffer:65536});
 if(post.status!==0)return{status:'NO_REMOTE_RECEIPT'};
 let comment;
 try{comment=JSON.parse(post.stdout);}catch{return{status:'REMOTE_RECEIPT_UNVERIFIED'};}
 const issueUrl='https://api.github.com/repos/'+REPO+'/issues/'+ISSUE;
 if(!Number.isSafeInteger(comment?.id)||comment.id<=0||comment.body!==body||
  comment.issue_url!==issueUrl)return{status:'REMOTE_RECEIPT_UNVERIFIED'};
 const get=invoke(gh,['api','repos/'+REPO+'/issues/comments/'+comment.id],
  {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:65536});
 if(get.status!==0)return{status:'REMOTE_RECEIPT_UNVERIFIED'};
 let remote;
 try{remote=JSON.parse(get.stdout);}catch{return{status:'REMOTE_RECEIPT_UNVERIFIED'};}
 if(remote.id!==comment.id||remote.body!==body||remote.issue_url!==issueUrl)
  return{status:'REMOTE_RECEIPT_UNVERIFIED'};
 return{status:'REMOTE_RECEIPT_VERIFIED',
  url:'https://github.com/'+REPO+'/issues/'+ISSUE+'#issuecomment-'+comment.id};
}
export function publishReceipt(report){
 if(process.platform!=='win32'||process.env.GITHUB_ACTIONS||process.env.RUNNER_NAME)
  return{status:'INDEPENDENT_WINDOWS_OPERATOR_REQUIRED'};
 return postAndVerify(report);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const r=collectReport(),receipt=publishReceipt(r);
 console.log(JSON.stringify({requestId:REQUEST_ID,nodeOperator:r.nodeOperator,
  readStatus:r.readStatus,receiptStatus:receipt.status,receiptUrl:receipt.url??null,
  rollbackInvocations:0}));
 if(receipt.status!=='REMOTE_RECEIPT_VERIFIED'||r.nodeOperator!=='PASS'||
  r.probeCheckout!=='PASS'||r.operatorVbs!=='PASS'||
  r.approval!=='PASS'||r.toolHashes!=='5/5'||r.originalCas!=='5/5'||
  r.recoveryClaim!=='ABSENT'||r.originalOwnerAlive!=='NO')process.exitCode=2;
}
