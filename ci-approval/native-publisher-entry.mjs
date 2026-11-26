// Native A/Writer B CI workflow_run producer. This code is not an authority
// source: both trusted local business scope and an independent B installation
// receipt must be verified before any dispatch. No PC executor or installer.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {readNativeScope} from './native-receiver-observe.mjs';
import {dispatchApprovedCiEffect,createCiNativeReceiptStore} from './native-dispatch.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control',REPO_ID=1442936296;
const RECEIVERS=Object.freeze({
 A_READONLY:'.github/workflows/ci-approved-a-once.yml',
 B_WRITER_SOURCE:'.github/workflows/ci-approved-writer-b-once.yml'
});
const INSTALLED=Object.freeze({
 A_READONLY:'ci-native-a-installed-proof.json',
 B_WRITER_SOURCE:'ci-native-writer-b-installed-proof.json'
});
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const sha256=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const digest=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error(code)};
const out=(state,code,extra={})=>Object.freeze({state,code,dispatched:false,
 executed:false,pcOperationalWrites:0,...extra});
const scoped=(pathValue,root)=>{
 if(typeof root!=='string'||!path.isAbsolute(root)||root.includes('\0'))fail('CI_NATIVE_PROOF_ROOT_DENIED');
 for(let cur=path.resolve(root);;){
  const st=fs.lstatSync(cur);
  if(!st.isDirectory()||st.isSymbolicLink())fail('CI_NATIVE_PROOF_ROOT_UNTRUSTED');
  const parent=path.dirname(cur);if(parent===cur)break;cur=parent;
 }
 const full=path.join(path.resolve(root),pathValue);
 const s=fs.lstatSync(full);
 if(!s.isFile()||s.isSymbolicLink()||s.size<2||s.size>65536)
  fail('CI_NATIVE_PROOF_FILE_UNVERIFIED');
 return full;
};
export function readNativeInstalledProof(effect,{root='E:\\ZGmini\\data\\pc-writer\\ci-native'}={}){
 const file=INSTALLED[effect];
 if(!file)fail('CI_NATIVE_PROOF_EFFECT_DENIED');
 const raw=fs.readFileSync(scoped(file,root),'utf8');
 let v;try{v=JSON.parse(raw)}catch{fail('CI_NATIVE_PROOF_INVALID')}
 if(v?.schema!=='ZGMINI_CI_NATIVE_B_INSTALLED_PROOF_V1'||v.effect!==effect||
    !sha256(v.nativePolicySha256)||!sha256(v.installationReceiptSha256)||
    !/^results\/maintenance-pc-update-[a-z0-9-]{36}\.json$/.test(v.installationReceiptPath??'')||
    !/^pc-update-[a-f0-9-]{36}$/.test(v.installationRequestId??'')||
    !sha(v.actualControllerSha)||!v.policy||v.policy.effect!==effect)
  fail('CI_NATIVE_PROOF_INVALID');
 const actual=digest(Buffer.from(JSON.stringify(v.policy)));
 if(actual!==v.nativePolicySha256)fail('CI_NATIVE_PROOF_POLICY_SHA_UNVERIFIED');
 return Object.freeze(v);
}
// The publisher runs on the isolated handoff host, not the operating PC.
// Policy/installed B proof MUST be independently provisioned in a read-only
// location separated from the writable one-shot receipt store. No path is
// taken from an event, PR, Issue, or repository checkout.
export function createNativePublisherLocalPolicyPorts({scopeRoot,receiptRoot,volatileRoots=[]}={}){
 const checkedRoot=root=>{
  if(typeof root!=='string'||!path.isAbsolute(root)||root.includes('\\0'))
   fail('CI_NATIVE_PUBLISH_LOCAL_ROOT_DENIED');
  const full=path.resolve(root);
  for(let cur=full;;){
   const st=fs.lstatSync(cur);
   if(!st.isDirectory()||st.isSymbolicLink())
    fail('CI_NATIVE_PUBLISH_LOCAL_ROOT_UNVERIFIED');
   const parent=path.dirname(cur);if(parent===cur)break;cur=parent;
  }
  const real=fs.realpathSync(full);
  const comparable=v=>process.platform==='win32'?path.normalize(v).toLowerCase():path.normalize(v);
  if(comparable(real)!==comparable(full))
   fail('CI_NATIVE_PUBLISH_LOCAL_ROOT_UNVERIFIED');
  return full;
 };
 const policy=checkedRoot(scopeRoot),receipts=checkedRoot(receiptRoot);
 const inside=(parent,child)=>{
  const rel=path.relative(parent,child);
  return rel===''||(rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel));
 };
 if(inside(policy,receipts)||inside(receipts,policy)||
    !Array.isArray(volatileRoots)||volatileRoots.some(p=>
      typeof p==='string'&&path.isAbsolute(p)&&inside(path.resolve(p),policy)))
  fail('CI_NATIVE_PUBLISH_POLICY_ROOT_NOT_INDEPENDENT');
 return Object.freeze({
  readNativeScope:effect=>readNativeScope(effect,{root:policy}),
  readNativeInstalledProof:effect=>readNativeInstalledProof(effect,{root:policy})
 });
}
function decodeContents(f,pathValue){
 if(f?.type!=='file'||f.path!==pathValue||f.encoding!=='base64'||
    typeof f.content!=='string'||f.content.length>140000)
  fail('CI_NATIVE_PROOF_GITHUB_RECEIPT_INVALID');
 const bytes=Buffer.from(f.content,'base64');
 if(bytes.length<2||bytes.length>65536)fail('CI_NATIVE_PROOF_GITHUB_RECEIPT_INVALID');
 return bytes;
}
export async function verifyNativeInstalledProof(effect,proof,{getJson}={}){
 if(proof?.effect!==effect||typeof getJson!=='function')
  fail('CI_NATIVE_PROOF_INDEPENDENT_EVIDENCE_REQUIRED');
 let file;
 try{file=await getJson('contents/'+proof.installationReceiptPath+'?ref=main')}catch{fail('CI_NATIVE_PROOF_RECEIPT_UNAVAILABLE')}
 const bytes=decodeContents(file,proof.installationReceiptPath);
 if(digest(bytes)!==proof.installationReceiptSha256)
  fail('CI_NATIVE_PROOF_RECEIPT_SHA_MISMATCH');
 let receipt;try{receipt=JSON.parse(bytes.toString('utf8'))}catch{fail('CI_NATIVE_PROOF_RECEIPT_INVALID')}
 // Existing B result without these explicit native-effect attestations is
 // deliberately insufficient; an unrelated successful B cannot grant CI rights.
 if(receipt?.schema!=='ZGMINI_PC_MAINTENANCE_RESULT_V1'||
    receipt.requestId!==proof.installationRequestId||
    receipt.actualControllerSha!==proof.actualControllerSha||
    receipt.targetControllerSha!==proof.actualControllerSha||
    receipt.status!=='SUCCEEDED'||receipt.protectedStateUnchanged!==true||
    receipt.ciNativeEffect!==effect||
    receipt.ciNativePolicySha256!==proof.nativePolicySha256)
  fail('CI_NATIVE_PROOF_INSTALLATION_SCOPE_UNVERIFIED');
 return Object.freeze(proof.policy);
}
function sourceEventMatches(event,env,policy){
 const run=event?.workflow_run;
 // A future CI run ID is unknowable at policy-install time. An explicitly
 // installed EVENT_COMPLETION_V1 scope instead pins the reviewed source SHA,
 // workflow and business effect; the signed event provides the one-shot ID.
 const eventBound=policy?.sourceRunMode==='EVENT_COMPLETION_V1'&&
   !Object.hasOwn(policy,'sourceRunId')&&
   Number.isSafeInteger(run?.id)&&run.id>0&&policy.sourceAttempt===1;
 const fixed=policy?.sourceRunMode===undefined&&
   run?.id===policy.sourceRunId;
 return (eventBound||fixed)&&env?.GITHUB_EVENT_NAME==='workflow_run'&&
  env.GITHUB_REPOSITORY===REPO&&env.GITHUB_REF==='refs/heads/main'&&
  event?.action==='completed'&&event.repository?.id===REPO_ID&&
  event.repository.full_name===REPO&&event.repository.private===true&&
  run.run_attempt===policy.sourceAttempt&&
  run.workflow_id===policy.sourceWorkflowId&&run.path===policy.sourceWorkflowPath&&
  run.head_sha===policy.sourceHeadSha&&run.status==='completed'&&
  run.conclusion==='success'&&run.event==='pull_request'&&
  run.repository?.id===REPO_ID&&run.head_repository?.id===REPO_ID;
}
export async function publishNativeCompletion({effect,event,env,ports}={}){
 if(!Object.hasOwn(RECEIVERS,effect))return out('REJECTED','CI_NATIVE_PUBLISH_EFFECT_DENIED');
 if(!ports||typeof ports.readNativeScope!=='function'||typeof ports.readInstalledReceiver!=='function')
  return out('EVIDENCE_MISSING','CI_NATIVE_PUBLISH_PORTS_UNAVAILABLE');
 let scope;
 try{scope=await ports.readNativeScope(effect)}catch{return out('EVIDENCE_MISSING','CI_NATIVE_PUBLISH_SCOPE_UNAVAILABLE')}
 if(scope?.policy?.enabled!==true)return out('DISABLED','CI_NATIVE_PUBLISH_POLICY_DISABLED');
 // An unrelated successful CI run is not an approval failure. Only the
 // exact installed source Run may produce a dispatch; ignore all others.
 if(!sourceEventMatches(event,env,scope.policy))
  return out('IGNORED','CI_NATIVE_PUBLISH_SOURCE_EVENT_NOT_TARGET');
 // Do not irreversibly consume a one-shot dispatch claim if the locally
 // installed business approval bytes have drifted. The receiver also checks
 // the bytes independently before any PC effect.
 if(!Buffer.isBuffer(scope.approvalBytes)||
    digest(scope.approvalBytes)!==scope.policy.businessApprovalSha256)
  return out('EVIDENCE_MISSING','CI_NATIVE_PUBLISH_APPROVAL_BYTES_DRIFT');
 // Bind only the original authenticated event's actual run number; it is
 // neither an approval grant nor a replacement for the installed SHA pins.
 const approvedPolicy=scope.policy.sourceRunMode==='EVENT_COMPLETION_V1'
  ?{...scope.policy,sourceRunId:event.workflow_run.id}:scope.policy;
 const publishPorts={...ports};
 return dispatchApprovedCiEffect({policy:approvedPolicy,requestBytes:scope.requestBytes,
  ports:publishPorts});
}
async function main(){
 const env=process.env,effect=env.ZGMINI_CI_NATIVE_EFFECT;
 let event;try{
  const st=fs.lstatSync(env.GITHUB_EVENT_PATH);
  if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>65536)throw Error('EVENT');
  event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 }catch{console.log(JSON.stringify(out('REJECTED','CI_NATIVE_PUBLISH_EVENT_UNAVAILABLE')));return 1}
 const token=env.GITHUB_TOKEN;
 if(!token||token.length>1024){console.log(JSON.stringify(out('EVIDENCE_MISSING','CI_NATIVE_PUBLISH_TOKEN_UNAVAILABLE')));return 1}
 const getJson=async route=>{
  if(typeof route!=='string'||route.includes('..')||!/^(?:actions\/runs\/[0-9]+\/attempts\/[0-9]+|contents\/(?:\.github\/workflows\/[a-z0-9-]+\.yml\?ref=(?:main|[a-f0-9]{40})|results\/maintenance-pc-update-[a-z0-9-]{36}\.json\?ref=main))$/.test(route))
   fail('CI_NATIVE_PUBLISH_READ_ROUTE_DENIED');
  const res=await fetch('https://api.github.com/repos/'+REPO+'/'+route,{
   method:'GET',signal:AbortSignal.timeout(15000),
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28'}});
  if(!res.ok)fail('CI_NATIVE_PUBLISH_GITHUB_READ_FAILED');
  const raw=await res.text();if(raw.length>150000)fail('CI_NATIVE_PUBLISH_GITHUB_READ_LIMIT');
  return JSON.parse(raw);
 };
 const receiptRoot=env.ZGMINI_CI_NATIVE_RECEIPT_ROOT;
 const scopeRoot=env.ZGMINI_CI_NATIVE_SCOPE_ROOT;
 const volatileRoots=[env.RUNNER_TEMP,env.TEMP,env.TMP,env.GITHUB_WORKSPACE]
  .filter(x=>typeof x==='string'&&path.isAbsolute(x));
 let store,local;
 // Both roots must already exist on the isolated host; no auto-create,
 // TEMP/checkout policy files, or writable-receipt-root authority.
 try{
  local=createNativePublisherLocalPolicyPorts({scopeRoot,receiptRoot,volatileRoots});
  store=createCiNativeReceiptStore(receiptRoot,{volatileRoots});
 }catch{console.log(JSON.stringify(out('EVIDENCE_MISSING','CI_NATIVE_PUBLISH_LOCAL_ROOTS_UNVERIFIED')));return 1}
 const dispatchWorkflow=async (workflow,{ref,inputs})=>{
  if(!Object.values(RECEIVERS).includes(workflow)||ref!=='main')fail('CI_NATIVE_PUBLISH_ROUTE_DENIED');
  const name=workflow.split('/').at(-1);
  const res=await fetch('https://api.github.com/repos/'+REPO+'/actions/workflows/'+name+'/dispatches',{
   method:'POST',signal:AbortSignal.timeout(20000),
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
    'X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json'},
   body:JSON.stringify({ref,inputs})});
  if(res.status===204)return {status:204};
  if(res.status!==200)fail('CI_NATIVE_PUBLISH_DISPATCH_RESPONSE_UNVERIFIED');
  const raw=await res.text();if(raw.length>8192)fail('CI_NATIVE_PUBLISH_DISPATCH_RESPONSE_INVALID');
  return {status:200,...JSON.parse(raw)};
 };
 const ports={readNativeScope:local.readNativeScope,
  readSourceRun:(id,attempt)=>getJson('actions/runs/'+id+'/attempts/'+attempt),
  readSourceWorkflow:(workflow,ref)=>getJson('contents/'+workflow+'?ref='+ref),
  readReceiverWorkflow:workflow=>getJson('contents/'+workflow+'?ref=main'),
  readInstalledReceiver:async effect=>{
   const proof=local.readNativeInstalledProof(effect);
   return verifyNativeInstalledProof(effect,proof,{getJson});
  },
  loadReceipt:store.loadReceipt,saveReceipt:store.saveReceipt,dispatchWorkflow};
 const result=await publishNativeCompletion({effect,event,env,ports});
 // Log status only. Never log approval bytes, request body, token or paths.
 console.log(JSON.stringify(result));
 return ['DISPATCH_ACCEPTED_NOT_EXECUTED','IGNORED'].includes(result.state)?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.exitCode=await main();
}
