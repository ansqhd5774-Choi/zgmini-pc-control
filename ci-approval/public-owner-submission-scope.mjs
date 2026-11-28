// Publication authority only. Actual Windows B execution still requires the
// receiver's separately installed V2 policy and all existing live safeguards.
import {createHash} from 'node:crypto';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const verified=new WeakMap();
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const owner=x=>x?.id===327938088&&x.login==='ansqhd5774-Choi'&&x.type==='User';
const fail=()=>{throw Error('CI_OWNER_SUBMISSION_SCOPE_UNVERIFIED');};
const FILES=['maintenance-contract.mjs','maintenance-apply.mjs','maintenance-agent.mjs',
 'maintenance-lock.mjs','update.mjs','maintenance-ancestry.vbs','source-bundle-register.mjs',
 'bootstrap-maintenance.mjs','handoff-maintenance.mjs'].map(x=>'tools/'+x);
export function validatePublicSubmissionPolicy(p){
 const keys=['schema','enabled','workflowId','workflowBlobSha','workflowPath',
  'repositoryVisibility','installedSha','targetSha','manifestSha256'];
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==keys.length||
  !keys.every(k=>Object.hasOwn(p,k))||p.schema!=='ZGMINI_CI_CONTROLLER_B_INSTALLED_POLICY_V2'||
  p.enabled!==true||p.repositoryVisibility!=='public'||
  !Number.isSafeInteger(p.workflowId)||p.workflowId<=0||!sha(p.workflowBlobSha)||
  p.workflowPath!=='.github/workflows/ci-approval-controller-b.yml'||
  !sha(p.installedSha)||!sha(p.targetSha)||p.installedSha===p.targetSha||!hash(p.manifestSha256))fail();
 return Object.freeze(structuredClone(p));
}
export async function readOwnerApprovedSubmissionScope({getJson,handoffSourceSha}={}){
 if(typeof getJson!=='function'||!sha(handoffSourceSha))fail();
 const file='approvals/maintenance-handoffs/'+handoffSourceSha+'.json';
 const read=async ref=>{
  const f=await getJson('contents/'+file+'?ref='+ref);
  if(f?.type!=='file'||f.path!==file||f.encoding!=='base64'||!sha(f.sha)||
   typeof f.content!=='string'||f.content.length>180000)fail();
  const b=Buffer.from(f.content,'base64');
  if(b.length<2||b.length>131072||createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex')!==f.sha)fail();
  return b;
 };
 const bytes=await read('main');let a;try{a=JSON.parse(bytes.toString('utf8'));}catch{fail();}
 if(a?.schema!=='ZGMINI_MAINTENANCE_HANDOFF_V2'||a.transition!=='SEVEN_TO_SEVEN'||
  a.approved!==true||a.targetSha!==handoffSourceSha||!sha(a.installedSha)||
  a.installedSha===a.targetSha||
  !['STOPPED_RECEIVER_IN_PLACE_ONLY','COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE'].includes(a.scope)||
  !a.files||Object.keys(a.files).length!==FILES.length||!FILES.every(p=>hash(a.files[p])))fail();
 const match=typeof a.publisherApprovalRef==='string'&&a.publisherApprovalRef.match(
  /^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/([1-9][0-9]*)$/);
 if(!match)fail();const n=Number(match[1]);if(!Number.isSafeInteger(n))fail();
 const pr=await getJson('pulls/'+n);
 if(pr?.number!==n||pr.merged!==true||!owner(pr.user)||!owner(pr.merged_by)||
  !sha(pr.merge_commit_sha)||pr.base?.ref!=='main'||
  pr.base?.repo?.full_name!==REPO||pr.head?.repo?.full_name!==REPO)fail();
 if(!(await read(pr.merge_commit_sha)).equals(bytes))fail();
 const policy=validatePublicSubmissionPolicy(a.ciControllerBPolicy);
 const scope=Object.freeze({schema:'ZGMINI_OWNER_CONTROLLER_B_SUBMISSION_SCOPE_V1',
  approvalPrNumber:n,approvalMergeSha:pr.merge_commit_sha,
  approvalManifestSha256:createHash('sha256').update(bytes).digest('hex'),
  maintenanceSourceSha:handoffSourceSha,executionAuthorized:false});
 verified.set(scope,policy);return scope;
}
export function ownerSubmissionPolicy(scope){
 if(!scope||!verified.has(scope))fail();return verified.get(scope);
}
