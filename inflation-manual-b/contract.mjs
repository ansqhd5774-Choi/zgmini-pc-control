// Fixed-scope, source-only authorization for a future one-shot Windows B
// receiver. This module never downloads data or writes a PC file.
import {createHash} from 'node:crypto';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
export const ISSUE_TITLE='pc-inflation-official-manual-once';
export const ISSUE_LABEL='pc-writer-b-install';
export const OPERATION='inflation-official-manual';
export const REQUEST_SCHEMA='ZGMINI_INFLATION_OFFICIAL_MANUAL_B_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_INFLATION_OFFICIAL_MANUAL_B_APPROVAL_V1';
// New approvals must opt in explicitly; V1 remains source-SHA exact.
export const APPROVAL_SCHEMA_V2='ZGMINI_INFLATION_OFFICIAL_MANUAL_B_APPROVAL_V2';
export const SOURCE_POLICY_V2='CLEAN_CONFIGURED_HEAD_AND_FIXED_IMPORT_CLOSURE';
export const SCOPE='INFLATION_OFFICIAL_STATIC_TWO_RAW_JSON_ONLY';
export const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const DATA_ROOT=String.raw`E:\ZGmini\data\pc-writer`;
export const SOURCE_FILES=Object.freeze([
 'scripts/pc-writer/inflation-causal-candidate-manual-official-r1.mjs',
 'scripts/pc-writer/inflation-causal-candidate-manual-official-store-r1.mjs',
 'lib/diagnostic-layer/xlsx-lite.mjs',
 'scripts/pc-writer/local-cycle.mjs',
]);
// V2 permits unrelated clean checkout HEAD drift, NEVER unknown executable
// bytes. Only two EXACT reviewed, all-four-file source closures are allowed:
// - EXISTING: the four SHA-256 values observed on the PC (#1434/#1435).
//   This may pass the real workbook preflight; success is NOT assumed.
// - CORRECTED: identical three modules + the official XLSX attribute-order
//   correction from W01 PR #1089 (blob 62e028e..., SHA-256 d80c6a...).
// The approval manifest pins ONE complete profile by exact file SHA256.
// If EXISTING fails on real official XLSX, it fails before claim/commit and
// CORRECTED must be separately installed with exact source approval. Never
// silently change source files during this B, whose allowSourceChanges=false.
// The collector/store XLSX imports are fully pinned; local-cycle is pinned
// separately to preserve the existing shared Core lock contract.
export const V2_EXECUTABLE_SHA256_EXISTING=Object.freeze([
 '53c01bbc129e1c4c5ff129d37fae8e0ff801c30bfe50a6ad0ab1227d394a5ed6',
 '3ef346bd5e240cdcdbd741a0f62b665bba42bf33556e37a6efa359f07de834ec',
 '44d4c230a0620faea0d8bb2575e6f13c9ab7cfb5700aa11d752017db747f619a',
 '2e6200e5637fb99f339fdc74a64592f34c1272423a39366b8559c16ea1b13b5d',
]);
export const V2_EXECUTABLE_SHA256=Object.freeze([
 '53c01bbc129e1c4c5ff129d37fae8e0ff801c30bfe50a6ad0ab1227d394a5ed6',
 '3ef346bd5e240cdcdbd741a0f62b665bba42bf33556e37a6efa359f07de834ec',
 'd80c6a705d4d15be0b1381a04e0b26b50053eb4f87d37b5da64ccb340841e4b0',
 '2e6200e5637fb99f339fdc74a64592f34c1272423a39366b8559c16ea1b13b5d',
]);
// REVIEWED SOURCE CANDIDATE ONLY: #2515 installed a later Core local-cycle
// byte profile while W01 official collectors/XLSX remained untouched.
// Exact after-SHA is from the independently verified B installation receipt,
// not derived from the current GitHub HEAD. This constant DOES NOT create an
// approval manifest or authorize a B Issue. A fresh current-PC readback and
// an explicitly authorized manifest are still required before live execution.
export const V2_EXECUTABLE_SHA256_CORE_2515=Object.freeze([
 V2_EXECUTABLE_SHA256_EXISTING[0],
 V2_EXECUTABLE_SHA256_EXISTING[1],
 V2_EXECUTABLE_SHA256_EXISTING[2],
 '2cfa0f9ae794e36d0a2fcf865a571258c5d3a4e1709557a5e4c1059dde46da75',
]);
export const V2_EXECUTABLE_SHA256_ALLOWED=Object.freeze([
 V2_EXECUTABLE_SHA256_EXISTING,V2_EXECUTABLE_SHA256,
 V2_EXECUTABLE_SHA256_CORE_2515,
]);
export const URLS=Object.freeze({
 bls:'https://download.bls.gov/pub/time.series/cu/cu.data.12.USHousing',
 census:'https://www.census.gov/manufacturing/m3/prel/historical_data/histshts/naics/naicsinvp.xlsx',
});
export const TARGETS=Object.freeze({
 bls:String.raw`E:\ZGmini\data\pc-writer\inflation-causal-candidates-r1\bls-cpi-ppi3.json`,
 census:String.raw`E:\ZGmini\data\pc-writer\inflation-causal-candidates-r1\census-m3-manufacturing-inventories.json`,
});
export const MAX_BYTES=Object.freeze({bls:8_000_000,census:6_000_000});

const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATH=/^approvals\/inflation-manual-b\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const REQUEST_KEYS=['schema','requestId','chatId','operation','controlRepository',
 'approvalManifestPath','approvalManifestSha256'];
const APPROVAL_KEYS=['schema','status','scope','sourceRoot','sourceSha',
 'sourceFiles','providerUrls','targetFiles','maxBytes','timeoutMs','runCount',
 'coreLeaseMode',
 'allowDbWrites','allowD1Writes','allowTaskChanges','allowSourceChanges',
 'allowOtherWrites'];
// V2 replaces the *whole-checkout* SHA pin with a clean checkout bound to the
// approved config SHA and the exact four effective module hashes. V2 is a new
// approval schema, never an implicit fallback for a failed V1 preimage.
const APPROVAL_KEYS_V2=APPROVAL_KEYS.filter(k=>k!=='sourceSha').concat('sourcePolicy');
const authenticated=new WeakSet();
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(condition,code)=>{if(!condition)fail(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&
 keys.every(key=>Object.hasOwn(x,key));
const fixed=(actual,expected)=>exact(actual,Object.keys(expected))&&
 Object.entries(expected).every(([key,value])=>actual[key]===value);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

// Git for Windows may check out a text JSON blob with CRLF. Authenticate the
// immutable HEAD blob, and allow only Git's exact LF→CRLF worktree conversion.
// Never hash or authorize arbitrary worktree bytes as the approval original.
export function verifiedPinnedManifestBytes(worktreeBytes,blobBytes){
 need(Buffer.isBuffer(worktreeBytes)&&Buffer.isBuffer(blobBytes)&&
  blobBytes.length>=250&&blobBytes.length<=8192,
  'INFL_MANUAL_B_MANIFEST_GIT_BLOB_STOP');
 const checkoutCrlf=Buffer.from(blobBytes.toString('utf8')
  .replace(/\r?\n/g,'\r\n'),'utf8');
 need(worktreeBytes.equals(blobBytes)||worktreeBytes.equals(checkoutCrlf),
  'INFL_MANUAL_B_MANIFEST_WORKTREE_DRIFT_STOP');
 return blobBytes;
}

export function validateApprovalManifest(m){
 const v1=m?.schema===APPROVAL_SCHEMA;
 const v2=m?.schema===APPROVAL_SCHEMA_V2;
 need(exact(m,v2?APPROVAL_KEYS_V2:APPROVAL_KEYS),
  'INFL_MANUAL_B_MANIFEST_FIELDS_STOP');
 need((v1&&SHA40.test(m.sourceSha??''))||
  (v2&&m.sourcePolicy===SOURCE_POLICY_V2),
  'INFL_MANUAL_B_MANIFEST_SOURCE_POLICY_STOP');
 need(m.status==='APPROVED_B'&&
  m.scope===SCOPE&&m.sourceRoot===SOURCE_ROOT&&m.runCount===1&&
  m.coreLeaseMode==='EXCLUSIVE_EXISTING_LOCAL_CYCLE_LOCK'&&
  m.timeoutMs===40_000&&fixed(m.providerUrls,URLS)&&
  fixed(m.targetFiles,TARGETS)&&fixed(m.maxBytes,MAX_BYTES)&&
  ['allowDbWrites','allowD1Writes','allowTaskChanges',
   'allowSourceChanges','allowOtherWrites'].every(key=>m[key]===false),
  'INFL_MANUAL_B_MANIFEST_SCOPE_STOP');
 need(Array.isArray(m.sourceFiles)&&m.sourceFiles.length===SOURCE_FILES.length&&
  m.sourceFiles.every((entry,i)=>exact(entry,['path','sha256'])&&
   entry.path===SOURCE_FILES[i]&&SHA64.test(entry.sha256??'')),
  'INFL_MANUAL_B_SOURCE_FILES_STOP');
 // A V2 manifest may NOT silently re-approve a new imported code graph.
 // This additional V2-only check is a prerequisite for avoiding HEAD pinning.
 if(v2)need(V2_EXECUTABLE_SHA256_ALLOWED.some(closure=>
  m.sourceFiles.every((entry,i)=>entry.sha256===closure[i])),
  'INFL_MANUAL_B_SOURCE_CLOSURE_STOP');
 return m;
}

export function verifyIssueEvent(event,env){
 need(env?.GITHUB_REPOSITORY===CONTROL_REPO&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_ACTOR===OWNER&&env.GITHUB_RUN_ATTEMPT==='1'&&
  SHA40.test(env.GITHUB_SHA??'')&&
  event?.action==='opened'&&
  event?.repository?.full_name===CONTROL_REPO&&
  event.repository.private===true&&event?.sender?.login===OWNER&&
  event?.issue?.user?.login===OWNER&&!event.issue.pull_request&&
  event.issue.title===ISSUE_TITLE&&
  event.issue.labels?.some(x=>x.name===ISSUE_LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'INFL_MANUAL_B_EVENT_AUTH_STOP');
 let req;
 try{req=JSON.parse(event.issue.body);}catch{fail('INFL_MANUAL_B_REQUEST_JSON_STOP');}
 need(exact(req,REQUEST_KEYS)&&req.schema===REQUEST_SCHEMA&&
  UUID.test(req.requestId??'')&&UUID.test(req.chatId??'')&&
  req.operation===OPERATION&&req.controlRepository===CONTROL_REPO&&
  PATH.test(req.approvalManifestPath??'')&&
  SHA64.test(req.approvalManifestSha256??''),
  'INFL_MANUAL_B_REQUEST_SCOPE_STOP');
 return req;
}

export function authorizeManualReceiver({event,env,manifestBytes}){
 const request=verifyIssueEvent(event,env);
 need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>=250&&
  manifestBytes.length<=8192&&
  sha256(manifestBytes)===request.approvalManifestSha256,
  'INFL_MANUAL_B_MANIFEST_HASH_STOP');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'));}
 catch{fail('INFL_MANUAL_B_MANIFEST_JSON_STOP');}
 validateApprovalManifest(manifest);
 const auth=Object.freeze({request:Object.freeze(request),
  manifest:Object.freeze(manifest),controlSha:env.GITHUB_SHA,
  issueNumber:event.issue.number});
 authenticated.add(auth);
 return auth;
}

export function assertAuthorizedManualReceiver(auth){
 need(object(auth)&&authenticated.has(auth),
  'INFL_MANUAL_B_AUTH_OBJECT_STOP');
 return auth;
}
