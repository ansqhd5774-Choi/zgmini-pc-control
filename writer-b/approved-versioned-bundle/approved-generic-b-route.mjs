// OFFLINE source candidate, NOT an installed GitHub/PC receiver.
// Hook this into the existing independent maintainer only after a NEW narrow
// B effect approval, installer SHA/route registration and Windows verification.
// It does not fetch Issues, execute a command, open paths or write any file.
import {createHash} from 'node:crypto';
import {runApprovedRegistryCas,PIN_CAS_SCHEMA,PIN_CAS_SCOPE}
 from './approved-registry-cas.mjs';
import {runVersionedBundleTransaction}
 from './versioned-bundle-transaction.mjs';
import {SCHEMA as BUNDLE_SCHEMA,SCOPE as BUNDLE_SCOPE}
 from './versioned-bundle-plan.mjs';
import {isWriterBRequestId} from './writer-b-request-id.mjs';

export const GENERIC_B_OPERATION='pc-approved-runtime-b';
export const GENERIC_B_TITLE='pc-approved-runtime-b';
export const GENERIC_B_LABEL='pc-approved-runtime-b';
export const GENERIC_B_ISSUE_SCHEMA='ZGMINI_PC_APPROVED_RUNTIME_B_ISSUE_V1';
export const GENERIC_B_CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const EXISTING_MAINTENANCE_LABEL='pc-maintenance';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const stop=code=>{const e=Error(code);e.code=code;throw e;};
const need=(x,code)=>{if(!x)stop(code);};
const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join('|')===[...keys].sort().join('|');
const ISSUE_KEYS=['schema','requestId','chatId','operation','controlRepository',
 'expectedInstalledReceiverSha','approvalManifestSha256'];
const MODES=new Map([
 [PIN_CAS_SCHEMA,{mode:'PIN_REGISTRY_CAS',scope:PIN_CAS_SCOPE}],
 [BUNDLE_SCHEMA,{mode:'VERSIONED_BUNDLE_ACTIVATE',scope:BUNDLE_SCOPE}],
]);

// The new Issue envelope has exactly seven STRING-valued top-level keys.
// Scan their raw occurrences so JSON.parse's last-key-wins behavior cannot
// hide duplicated authorization fields. Whitespace/field order are harmless.
function parseIssueFlatStrings(body){
 let i=0;const keys=[];const parsed=Object.create(null);
 const space=()=>{while(/\s/.test(body[i]??''))i++;};
 const string=()=>{
  need(body[i]==='"','B_ROUTE_ISSUE_JSON');
  const start=i++;
  let escaped=false;
  while(i<body.length){
   const c=body[i++];
   if(escaped){escaped=false;continue;}
   if(c==='\\'){escaped=true;continue;}
   if(c==='"'){
    try{return JSON.parse(body.slice(start,i));}
    catch{stop('B_ROUTE_ISSUE_JSON');}
   }
  }
  stop('B_ROUTE_ISSUE_JSON');
 };
 space();need(body[i++]==='{','B_ROUTE_ISSUE_JSON');
 for(;;){
  space();
  if(body[i]==='}'){i++;break;}
  const key=string();
  space();need(body[i++]===':','B_ROUTE_ISSUE_JSON');
  space();const value=string();
  need(typeof key==='string'&&typeof value==='string'&&
   !Object.hasOwn(parsed,key),'B_ROUTE_ISSUE_DUPLICATE_KEY');
  keys.push(key);parsed[key]=value;
  space();if(body[i]===','){i++;continue;}
  need(body[i]==='}','B_ROUTE_ISSUE_JSON');i++;break;
 }
 space();need(i===body.length&&keys.length===ISSUE_KEYS.length&&
  ISSUE_KEYS.every(x=>keys.includes(x)),'B_ROUTE_ISSUE_CONTRACT');
 return parsed;
}

export function authenticateApprovedGenericBIssue(issue){
 need(issue?.title===GENERIC_B_TITLE&&issue?.state==='OPEN'&&
  issue?.author?.login===OWNER&&Number.isSafeInteger(issue?.number)&&issue.number>0&&
  Array.isArray(issue?.labels)&&issue.labels.some(x=>x?.name===GENERIC_B_LABEL)&&
  issue.labels.some(x=>x?.name===EXISTING_MAINTENANCE_LABEL),
  'B_ROUTE_ISSUE_ORIGIN');
 need(typeof issue.body==='string'&&Buffer.byteLength(issue.body)<=16384,
  'B_ROUTE_ISSUE_BODY');
 const request=parseIssueFlatStrings(issue.body);
 need(exact(request,ISSUE_KEYS)&&request.schema===GENERIC_B_ISSUE_SCHEMA&&
  request.operation===GENERIC_B_OPERATION&&
  request.controlRepository===GENERIC_B_CONTROL_REPO&&
  isWriterBRequestId(request.requestId)&&isWriterBRequestId(request.chatId)&&
  SHA40.test(request.expectedInstalledReceiverSha)&&
  SHA64.test(request.approvalManifestSha256),
  'B_ROUTE_ISSUE_CONTRACT');
 return request;
}

// No Issue-supplied file/path/command: only the SHA picks a *fixed* namespace.
export function approvalPathFromDigest(rawSha256){
 need(SHA64.test(rawSha256),'B_ROUTE_APPROVAL_DIGEST');
 return `approvals/approved-runtime-b/${rawSha256}.json`;
}

/**
 * Built by the already installed, SHA-pinned independent maintainer.
 * Every IO/trust hook is mandatory, with no no-op default:
 * - installed(): inspect actual receiver installation/source SHA, not docs;
 * - readApprovalFromControlCommit(): read exact raw bytes from immutable
 *   authenticated control commit, not issue-provided URL/path;
 * - verifyOriginAndApproval(): prove private repo, issue actor, reviewed B
 *   effect, candidate source immutable SHA, and exact allowed scope;
 * - requestStatus(): consult durable previous claim/ledger without retry;
 * - make*Adapter(): return already-approved fixed-path Windows bridge only.
 *
 * Existing source-only Writer B and 4 maintenance routes are NOT modified.
 */
export function createApprovedGenericBReceiverRoute({
 installed,readApprovalFromControlCommit,verifyOriginAndApproval,
 requestStatus,makePinAdapter,makeBundleAdapter,
 pinRunner=runApprovedRegistryCas,bundleRunner=runVersionedBundleTransaction,
}={}){
 const hooks={installed,readApprovalFromControlCommit,verifyOriginAndApproval,
  requestStatus,makePinAdapter,makeBundleAdapter,pinRunner,bundleRunner};
 need(Object.values(hooks).every(f=>typeof f==='function'),
  'B_ROUTE_UNINSTALLED_DEPENDENCY');
 return Object.freeze({
  async process({issue}={}){
   // Repositories/Issues cannot enable an uninstalled receiver.
   const runtime=await installed();
   need(runtime?.operation===GENERIC_B_OPERATION&&
    runtime?.status==='INSTALLED_APPROVED_B_RECEIVER'&&
    SHA40.test(runtime?.installedReceiverSha)&&SHA40.test(runtime?.controlCommitSha)&&
    runtime?.privateRepositoryVerified===true,
    'B_ROUTE_NOT_INSTALLED');
   const request=authenticateApprovedGenericBIssue(issue);
   need(request.expectedInstalledReceiverSha===runtime.installedReceiverSha,
    'B_ROUTE_RECEIVER_SHA_DRIFT');
   const previous=await requestStatus({requestId:request.requestId,
    issueNumber:issue.number});
   need(previous?.status==='NOT_CLAIMED',
    'B_ROUTE_PRIOR_REQUEST_RECONCILE');
   const manifestPath=approvalPathFromDigest(request.approvalManifestSha256);
   const raw=await readApprovalFromControlCommit({
    repository:GENERIC_B_CONTROL_REPO,controlCommitSha:runtime.controlCommitSha,
    path:manifestPath});
   need(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=262144&&
    sha(raw)===request.approvalManifestSha256,
    'B_ROUTE_APPROVAL_BYTES_DRIFT');
   let manifest;
   try{manifest=JSON.parse(raw.toString('utf8'));}
   catch{stop('B_ROUTE_APPROVAL_JSON');}
   const approved=MODES.get(manifest?.schema);
   need(approved&&manifest.scope===approved.scope&&
    ['APPROVED','APPROVED_B'].includes(manifest.status)&&
    SHA40.test(manifest.sourceSha)&&
    typeof manifest.profileId==='string',
    'B_ROUTE_EFFECT_NOT_APPROVED');
   const proof=await verifyOriginAndApproval({issue,request,
    controlCommitSha:runtime.controlCommitSha,
    rawApprovalBytes:raw,manifestPath,manifest,approvedMode:approved.mode});
   need(proof?.verified===true&&proof?.effect===approved.mode&&
    proof?.scope===approved.scope&&
    proof?.controlCommitSha===runtime.controlCommitSha&&
    proof?.approvedRawSha256===sha(raw)&&
    proof?.sourceSha===manifest.sourceSha&&
    proof?.issueNumber===issue.number,
    'B_ROUTE_OWNER_EFFECT_UNVERIFIED');
   // The effect is chosen exclusively by the independently verified, pinned
   // manifest schema. No Issue-selected operation, paths, shell or Task.
   if(approved.mode==='PIN_REGISTRY_CAS'){
    need(manifest.status==='APPROVED_B','B_ROUTE_PIN_STATUS');
    const pin={requestId:request.requestId,profileId:manifest.profileId,
     sourceSha:manifest.sourceSha,rawApprovalSha256:sha(raw)};
    const adapter=await makePinAdapter({request,manifest,pin,proof});
    return pinRunner({approvalRaw:raw,pinnedApproval:pin,adapter});
   }
   need(manifest.status==='APPROVED','B_ROUTE_BUNDLE_STATUS');
   const pin={requestId:request.requestId,rawManifestSha256:sha(raw),
    approvalRef:manifestPath,sourceSha:manifest.sourceSha,
    profileId:manifest.profileId};
   const installedBundle=await makeBundleAdapter({request,manifest,pin,proof});
   need(installedBundle?.adapter&&installedBundle?.trustedProfiles,
    'B_ROUTE_BUNDLE_BRIDGE_MISSING');
   return bundleRunner({rawManifest:raw,pinnedApproval:pin,
    trustedProfiles:installedBundle.trustedProfiles,
    adapter:installedBundle.adapter});
  },
 });
}
