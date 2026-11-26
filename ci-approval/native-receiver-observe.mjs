// A / Writer B native workflow_dispatch observation. READ ONLY.
// Bridges a real GitHub event, immutable REST reads, and local installed scope
// to inspectNativeReceiver. It MUST NOT call PC engines, installers, scripts,
// workflow_dispatch, create Issues, or turn CONTRACT_MATCH_ONLY into a grant.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectNativeReceiver} from './native-receiver-contract.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const EFFECTS=Object.freeze({
 A_READONLY:'ci-native-a-approved.json',
 B_WRITER_SOURCE:'ci-native-writer-b-approved.json'
});
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const out=(state,code)=>Object.freeze({state,code,canExecute:false,canInstall:false,
 canPublish:false,operationalWrites:0});
function decode(base64,limit){
 if(typeof base64!=='string'||base64.length<4||base64.length>Math.ceil(limit/3)*4+4||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))
  throw Error('CI_NATIVE_SCOPE_BYTES_INVALID');
 const bytes=Buffer.from(base64,'base64');
 if(!bytes.length||bytes.length>limit||bytes.toString('base64')!==base64)
  throw Error('CI_NATIVE_SCOPE_BYTES_INVALID');
 return bytes;
}
function inspectFilePath(root,filename){
 if(typeof root!=='string'||!path.isAbsolute(root)||root.includes('\0'))
  throw Error('CI_NATIVE_SCOPE_ROOT_INVALID');
 const resolved=path.resolve(root);
 // Do not allow a reparse-point/symlink substitution anywhere in the path.
 for(let cur=resolved;;){
  const s=fs.lstatSync(cur);
  if(!s.isDirectory()||s.isSymbolicLink())throw Error('CI_NATIVE_SCOPE_ROOT_UNVERIFIED');
  const parent=path.dirname(cur);if(parent===cur)break;cur=parent;
 }
 const file=path.join(resolved,filename);
 const s=fs.lstatSync(file);
 if(!s.isFile()||s.isSymbolicLink()||s.size<=0||s.size>131072)
  throw Error('CI_NATIVE_SCOPE_FILE_UNVERIFIED');
 return file;
}
export function readNativeScope(effect,{root='E:\\ZGmini\\data\\pc-writer\\ci-native'}={}){
 const filename=EFFECTS[effect];
 if(!filename)throw Error('CI_NATIVE_SCOPE_EFFECT_DENIED');
 const file=inspectFilePath(root,filename);
 let scope;
 try{scope=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error('CI_NATIVE_SCOPE_FILE_UNVERIFIED')}
 if(!scope||typeof scope!=='object'||Array.isArray(scope)||
   Object.keys(scope).sort().join('|')!=='approvalBytesBase64|policy|requestBytesBase64|schema'||
   scope.schema!=='ZGMINI_CI_NATIVE_READONLY_SCOPE_V1'||scope.policy?.effect!==effect)
  throw Error('CI_NATIVE_SCOPE_SHAPE_DENIED');
 return Object.freeze({
  policy:scope.policy,
  approvalBytes:decode(scope.approvalBytesBase64,65536),
  requestBytes:decode(scope.requestBytesBase64,32768)
 });
}
const assertEvent=(event,env,effect)=>{
 if(!EFFECTS[effect]||env?.GITHUB_REPOSITORY!==REPO||
  env.GITHUB_EVENT_NAME!=='workflow_dispatch'||
  env.GITHUB_REF!=='refs/heads/main'||!sha(env.GITHUB_SHA)||
  env.GITHUB_ACTOR!=='github-actions[bot]'||env.GITHUB_RUN_ATTEMPT!=='1'||
  event?.repository?.id!==1442936296||event.repository.private!==true||
  event.repository.full_name!==REPO||event.sender?.id!==41898282||
  event.sender.login!=='github-actions[bot]'||event.sender.type!=='Bot')
  throw Error('CI_NATIVE_RECEIVER_EVENT_DENIED');
};
function toFile(json,pathValue,ref){
 // The GitHub Contents response doesn't include the caller's immutable ref.
 // Bind it to the exact reviewed ref that the authenticated REST call used.
 if(json?.path!==pathValue||json.type!=='file')throw Error('CI_NATIVE_FILE_PATH_DENIED');
 return {...json,ref};
}
/**
 * Real receiver observation adapter. Port reads MUST be authenticated REST
 * and local scope MUST be independently installed. This function never
 * stores or publishes the received approval/manifest bytes.
 */
export async function observeNativeReceiver({event,env,effect,ports}={}){
 try{assertEvent(event,env,effect);}catch{return out('REJECTED','CI_NATIVE_RECEIVER_EVENT_DENIED');}
 if(typeof ports?.readNativeScope!=='function'||typeof ports?.getJson!=='function')
  return out('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_PORTS_UNAVAILABLE');
 let scope;
 try{scope=await ports.readNativeScope(effect);}catch{return out('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_LOCAL_SCOPE_UNAVAILABLE');}
 const installed=scope?.policy;
 if(installed?.enabled!==true)return out('DISABLED','CI_NATIVE_RECEIVER_NOT_ENABLED');
 // A preapproved completion-bound scope pins the reviewed commit, workflow
 // and effect; only its first authenticated dispatcher event supplies the
 // future CI run ID. This field is never written back into installed scope.
 const eventBound=installed.sourceRunMode==='EVENT_COMPLETION_V1';
 const supplied=event?.inputs?.source_run_id;
 const boundId=typeof supplied==='string'&&/^[1-9]\d*$/.test(supplied)
  ?Number(supplied):null;
 if(eventBound&&(Object.hasOwn(installed,'sourceRunId')||
    !id(boundId)||String(boundId)!==supplied||installed.sourceAttempt!==1))
  return out('REJECTED','CI_NATIVE_RECEIVER_SOURCE_RUN_INPUT_DENIED');
 const policy=eventBound?{...installed,sourceRunId:boundId}:installed;
 if(!id(policy.sourceRunId)||!id(policy.sourceAttempt)||!sha(policy.sourceHeadSha)||
    typeof policy.sourceWorkflowPath!=='string')
  return out('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_LOCAL_SCOPE_INVALID');
 let run,source,receiver;
 try{
  [run,source,receiver]=await Promise.all([
   ports.getJson('actions/runs/'+policy.sourceRunId+'/attempts/'+policy.sourceAttempt),
   ports.getJson('contents/'+policy.sourceWorkflowPath+'?ref='+policy.sourceHeadSha),
   ports.getJson('contents/'+policy.receiverWorkflowPath+'?ref='+env.GITHUB_SHA)
  ]);
 }catch{return out('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_GITHUB_READ_UNAVAILABLE');}
 let sourceFile,receiverFile;
 try{
  sourceFile=toFile(source,policy.sourceWorkflowPath,policy.sourceHeadSha);
  receiverFile=toFile(receiver,policy.receiverWorkflowPath,env.GITHUB_SHA);
 }catch{return out('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_GITHUB_FILE_UNVERIFIED');}
 const res=inspectNativeReceiver({event,env,policy,
   approvalBytes:scope.approvalBytes,requestBytes:scope.requestBytes,
   sourceRun:run,sourceWorkflow:sourceFile,receiverWorkflow:receiverFile});
 return Object.freeze({state:res.state,code:res.code,
  effectKey:res.effectKey??null,canExecute:false,canInstall:false,
  canPublish:false,operationalWrites:0});
}
async function runGithubReceiver(){
 const effect=process.env.ZGMINI_CI_NATIVE_EFFECT;
 let event;
 try{
  if(typeof process.env.GITHUB_EVENT_PATH!=='string')throw Error('NO_EVENT_PATH');
  const s=fs.lstatSync(process.env.GITHUB_EVENT_PATH);
  if(!s.isFile()||s.isSymbolicLink()||s.size>32768||s.size<=0)throw Error('EVENT_INVALID');
  event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 }catch{
  const failed=out('REJECTED','CI_NATIVE_RECEIVER_EVENT_UNAVAILABLE');
  console.log(JSON.stringify(failed));return 1;
 }
 const env=process.env;
 if(!env.GITHUB_TOKEN||env.GITHUB_TOKEN.length>1024){
  console.log(JSON.stringify(out('EVIDENCE_MISSING','CI_NATIVE_RECEIVER_GITHUB_TOKEN_UNAVAILABLE')));return 1;
 }
 const getJson=async route=>{
  if(typeof route!=='string'||route.includes('..')||route.includes('\n')||
     !/^(?:actions\/runs\/[0-9]+\/attempts\/[0-9]+|contents\/\.github\/workflows\/[a-z0-9-]+\.yml\?ref=[a-f0-9]{40})$/.test(route))
   throw Error('CI_NATIVE_GITHUB_ROUTE_DENIED');
  const response=await fetch('https://api.github.com/repos/'+REPO+'/'+route,{
   method:'GET',signal:AbortSignal.timeout(12000),headers:{
    Accept:'application/vnd.github+json',
    Authorization:'Bearer '+env.GITHUB_TOKEN,
    'X-GitHub-Api-Version':'2022-11-28'
   }});
  if(!response.ok)throw Error('CI_NATIVE_GITHUB_GET_UNVERIFIED');
  const bytes=await response.text();
  if(bytes.length>150000)throw Error('CI_NATIVE_GITHUB_BYTES_EXCESSIVE');
  return JSON.parse(bytes);
 };
 const result=await observeNativeReceiver({
  effect,event,env,ports:{readNativeScope,getJson}
 });
 // Never emit source content, approval bytes, token, installed paths or
 // sensitive HTTP bodies. CONTRACT_MATCH_ONLY is not execution.
 console.log(JSON.stringify(result));
 return result.state==='CONTRACT_MATCH_ONLY'?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.exitCode=await runGithubReceiver();
}
